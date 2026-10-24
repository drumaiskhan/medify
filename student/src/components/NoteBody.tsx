import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import type { MouseEvent as ReactMouseEvent } from 'react';
import { Search, X, ChevronUp, ChevronDown, Download, CheckCircle2, WifiOff, Bookmark, Trash2 } from 'lucide-react';
import { api } from '../lib/client';
import { hydrateNoteImages, prefetchNoteImages } from '../utils/noteImages';

type Color = 'yellow' | 'green' | 'pink' | 'blue';
interface Hl { id: string; start: number; end: number; color: Color; text: string; at: number }
interface Position { headingId: string; scroll: number }
interface Saved { highlights: Hl[]; position: Position | null; updatedAt: number; dirty?: boolean }

const SWATCH: Record<Color, string> = { yellow: '#facc15', green: '#4ade80', pink: '#f472b6', blue: '#60a5fa' };

function textNodes(root: Node): Text[] {
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  const out: Text[] = [];
  let n: Node | null;
  while ((n = walker.nextNode())) out.push(n as Text);
  return out;
}
function offsetOf(root: HTMLElement, node: Node, off: number): number {
  const r = document.createRange();
  r.selectNodeContents(root);
  r.setEnd(node, off);
  return r.toString().length;
}
/** Wraps characters [start,end) of the container's text in <mark> elements (one per text node). */
function wrap(root: HTMLElement, start: number, end: number, className: string, attrs: Record<string, string>) {
  let pos = 0;
  for (const node of textNodes(root)) {
    const len = node.data.length;
    const s = Math.max(start, pos);
    const e = Math.min(end, pos + len);
    if (s < e) {
      let target = node;
      if (e - pos < len) target.splitText(e - pos);
      if (s - pos > 0) target = target.splitText(s - pos);
      const mark = document.createElement('mark');
      mark.className = className;
      Object.entries(attrs).forEach(([k, v]) => mark.setAttribute(k, v));
      target.parentNode!.insertBefore(mark, target);
      mark.appendChild(target);
    }
    pos += len;
    if (pos >= end) break;
  }
}
function unwrap(root: HTMLElement, selector: string) {
  root.querySelectorAll(selector).forEach((m) => {
    const parent = m.parentNode!;
    while (m.firstChild) parent.insertBefore(m.firstChild, m);
    parent.removeChild(m);
    parent.normalize();
  });
}
function watermark(text: string) {
  const map: Record<string, string> = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
  const esc = text.replace(/[&<>"']/g, (c) => map[c]);
  const svg = `<svg xmlns='http://www.w3.org/2000/svg' width='430' height='260'><text x='20' y='160' transform='rotate(-24 215 130)' font-family='sans-serif' font-size='15' fill='rgb(100,116,139)' fill-opacity='0.17'>${esc}</text></svg>`;
  return `url("data:image/svg+xml,${encodeURIComponent(svg)}")`;
}
const readLocal = (key: string): Saved | null => {
  try { return JSON.parse(localStorage.getItem(key) || 'null'); } catch { return null; }
};

interface Props {
  html: string;
  subjectId: string;
  userId?: string;
  watermarkText: string;
  allLoaded: boolean;
  isDark: boolean;
}

export function NoteBody({ html, subjectId, userId, watermarkText, allLoaded, isDark }: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const saved = useRef<Saved>({ highlights: [], position: null, updatedAt: 0 });
  const timer = useRef<number | undefined>(undefined);
  const queryRef = useRef('');
  const key = `medify-notes-${userId || 'guest'}-${subjectId}`;

  const [highlights, setHighlights] = useState<Hl[]>([]);
  const [selBox, setSelBox] = useState<{ x: number; y: number } | null>(null);
  const [activeHl, setActiveHl] = useState<{ id: string; x: number; y: number } | null>(null);
  const [query, setQuery] = useState('');
  const [hitCount, setHitCount] = useState(0);
  const [hitIndex, setHitIndex] = useState(0);
  const [searchOpen, setSearchOpen] = useState(false);
  const [online, setOnline] = useState(typeof navigator === 'undefined' ? true : navigator.onLine);
  const [offline, setOffline] = useState<{ busy: boolean; done: number; total: number; saved: boolean; failed: number }>({ busy: false, done: 0, total: 0, saved: false, failed: 0 });
  const [resume, setResume] = useState<Position | null>(null);
  const [zoom, setZoom] = useState<{ src: string; big: boolean } | null>(null);

  /* ---------- persistence: this device first, then the student's account ---------- */
  const syncRemote = useCallback(async () => {
    if (!userId) return;
    try {
      const r = await api(`/notes/${subjectId}/state`, { highlights: saved.current.highlights, position: saved.current.position });
      saved.current = { ...saved.current, updatedAt: r.updatedAt, dirty: false };
      localStorage.setItem(key, JSON.stringify(saved.current));
    } catch {
      saved.current.dirty = true; // offline or signed out: retry later
      try { localStorage.setItem(key, JSON.stringify(saved.current)); } catch { /* ignore */ }
    }
  }, [userId, subjectId, key]);

  const persist = useCallback(() => {
    saved.current.dirty = true;
    try { localStorage.setItem(key, JSON.stringify(saved.current)); } catch { /* ignore */ }
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(syncRemote, 1500);
  }, [key, syncRemote]);

  useEffect(() => {
    let cancelled = false;
    const local = readLocal(key);
    if (local) {
      saved.current = local;
      setHighlights(local.highlights || []);
      if (local.position) setResume(local.position);
    }
    (async () => {
      if (!userId) return;
      try {
        if (local?.dirty) return void syncRemote();
        const remote = await api(`/notes/${subjectId}/state`);
        if (cancelled) return;
        if (!local || remote.updatedAt >= (local.updatedAt || 0)) {
          saved.current = { highlights: remote.highlights, position: remote.position, updatedAt: remote.updatedAt };
          localStorage.setItem(key, JSON.stringify(saved.current));
          setHighlights(remote.highlights);
          if (remote.position) setResume(remote.position);
        }
      } catch { /* offline: keep the local copy */ }
    })();
    const goOnline = () => { setOnline(true); if (saved.current.dirty) void syncRemote(); };
    const goOffline = () => setOnline(false);
    window.addEventListener('online', goOnline);
    window.addEventListener('offline', goOffline);
    return () => {
      cancelled = true;
      window.removeEventListener('online', goOnline);
      window.removeEventListener('offline', goOffline);
      if (timer.current) { window.clearTimeout(timer.current); void syncRemote(); }
    };
  }, [key, subjectId, userId, syncRemote]);

  /* ---------- painting: text, images, highlights, search hits ---------- */
  const runSearch = useCallback((q: string) => {
    const el = ref.current;
    if (!el) return;
    unwrap(el, 'mark.note-hit');
    const needle = q.trim().toLowerCase();
    if (needle.length < 2) { setHitCount(0); setHitIndex(0); return; }
    const text = (el.textContent || '').toLowerCase();
    const starts: number[] = [];
    for (let i = text.indexOf(needle); i !== -1 && starts.length < 500; i = text.indexOf(needle, i + needle.length)) starts.push(i);
    starts.forEach((s, n) => wrap(el, s, s + needle.length, 'note-hit', { 'data-hit': String(n) }));
    setHitCount(starts.length);
    setHitIndex(starts.length ? 1 : 0);
  }, []);

  const paint = useCallback((list: Hl[]) => {
    const el = ref.current;
    if (!el) return;
    unwrap(el, 'mark.note-hit');
    unwrap(el, 'mark[data-hl]');
    const total = (el.textContent || '').length;
    [...list].sort((a, b) => a.start - b.start).forEach((h) => {
      if (h.end <= total) wrap(el, h.start, h.end, `note-hl note-hl-${h.color}`, { 'data-hl': h.id });
    });
    if (queryRef.current.trim().length >= 2) runSearch(queryRef.current);
  }, [runSearch]);

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.innerHTML = html;
    const stopImages = hydrateNoteImages(el);
    paint(saved.current.highlights);
    return stopImages;
  }, [html]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { paint(highlights); }, [highlights, paint]);

  useEffect(() => { queryRef.current = query; const t = window.setTimeout(() => runSearch(query), 250); return () => window.clearTimeout(t); }, [query, runSearch]);

  const goToHit = useCallback((n: number) => {
    const el = ref.current;
    if (!el || hitCount === 0) return;
    const idx = ((n - 1 + hitCount) % hitCount);
    el.querySelectorAll('mark.note-hit.active').forEach((m) => m.classList.remove('active'));
    const marks = el.querySelectorAll(`mark.note-hit[data-hit="${idx}"]`);
    marks.forEach((m) => m.classList.add('active'));
    marks[0]?.scrollIntoView({ block: 'center', behavior: 'smooth' });
    setHitIndex(idx + 1);
  }, [hitCount]);

  useEffect(() => { if (hitCount > 0) goToHit(1); }, [hitCount]); // eslint-disable-line react-hooks/exhaustive-deps

  /* ---------- selecting text to highlight ---------- */
  useEffect(() => {
    let t: number | undefined;
    const check = () => {
      window.clearTimeout(t);
      t = window.setTimeout(() => {
        const el = ref.current;
        const sel = window.getSelection();
        if (!el || !sel || sel.isCollapsed || sel.rangeCount === 0 || !el.contains(sel.anchorNode) || !el.contains(sel.focusNode)) { setSelBox(null); return; }
        const rect = sel.getRangeAt(0).getBoundingClientRect();
        const below = rect.bottom + 54 < window.innerHeight;
        setSelBox({ x: Math.min(Math.max(rect.left + rect.width / 2, 130), window.innerWidth - 130), y: below ? rect.bottom + 12 : Math.max(rect.top - 58, 70) });
        setActiveHl(null);
      }, 180);
    };
    document.addEventListener('selectionchange', check);
    return () => { document.removeEventListener('selectionchange', check); window.clearTimeout(t); };
  }, []);

  const addHighlight = (color: Color) => {
    const el = ref.current;
    const sel = window.getSelection();
    if (!el || !sel || sel.rangeCount === 0 || sel.isCollapsed) return;
    const range = sel.getRangeAt(0);
    let a = offsetOf(el, range.startContainer, range.startOffset);
    let b = offsetOf(el, range.endContainer, range.endOffset);
    if (b < a) [a, b] = [b, a];
    if (b - a < 1) return;
    const hl: Hl = { id: 'h' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6), start: a, end: b, color, text: range.toString().slice(0, 160), at: Date.now() };
    const kept = saved.current.highlights.filter((h) => h.end <= a || h.start >= b); // a new highlight replaces any it overlaps
    saved.current.highlights = [...kept, hl].slice(-2000);
    saved.current.updatedAt = Date.now();
    persist();
    sel.removeAllRanges();
    setSelBox(null);
    setHighlights(saved.current.highlights);
  };
  const removeHighlight = (id: string) => {
    saved.current.highlights = saved.current.highlights.filter((h) => h.id !== id);
    saved.current.updatedAt = Date.now();
    persist();
    setActiveHl(null);
    setHighlights(saved.current.highlights);
  };

  const onContentClick = (e: ReactMouseEvent) => {
    const target = e.target as HTMLElement;
    if (target.tagName === 'IMG' && target.classList.contains('note-img-ready')) {
      setZoom({ src: (target as HTMLImageElement).src, big: false });
      return;
    }
    if (!window.getSelection()?.isCollapsed) return;
    const mark = target.closest('mark[data-hl]') as HTMLElement | null;
    if (mark) {
      const r = mark.getBoundingClientRect();
      setActiveHl({ id: mark.getAttribute('data-hl')!, x: Math.min(Math.max(r.left + r.width / 2, 70), window.innerWidth - 70), y: Math.min(r.bottom + 8, window.innerHeight - 56) });
    } else setActiveHl(null);
  };

  /* ---------- remember where the student stopped ---------- */
  useEffect(() => {
    let t: number | undefined;
    const onScroll = () => {
      window.clearTimeout(t);
      t = window.setTimeout(() => {
        const el = ref.current;
        if (!el) return;
        let headingId = '';
        el.querySelectorAll('h1[id],h2[id],h3[id],h4[id]').forEach((h) => { if (h.getBoundingClientRect().top <= 150) headingId = h.id; });
        const max = document.documentElement.scrollHeight - window.innerHeight;
        const scroll = max > 0 ? Math.min(1, Math.max(0, window.scrollY / max)) : 0;
        if (scroll < 0.01 && !headingId) return;
        saved.current.position = { headingId, scroll };
        persist();
      }, 2500);
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => { window.removeEventListener('scroll', onScroll); window.clearTimeout(t); };
  }, [persist]);

  const jumpToResume = () => {
    if (!resume) return;
    const target = resume.headingId ? document.getElementById(resume.headingId) : null;
    if (target) target.scrollIntoView({ behavior: 'smooth', block: 'start' });
    else window.scrollTo({ top: resume.scroll * (document.documentElement.scrollHeight - window.innerHeight), behavior: 'smooth' });
    setResume(null);
  };

  const saveOffline = async () => {
    const el = ref.current;
    if (!el) return;
    setOffline({ busy: true, done: 0, total: 0, saved: false, failed: 0 });
    const r = await prefetchNoteImages(el, (done, total) => setOffline({ busy: true, done, total, saved: false, failed: 0 }));
    setOffline({ busy: false, done: r.done, total: r.done + r.failed, saved: r.failed === 0, failed: r.failed });
  };

  const bar = isDark ? 'bg-[#12152E] border-slate-700 text-slate-200' : 'bg-white border-[#DDE1F2] text-[#171B35]';
  const btn = isDark ? 'bg-slate-800 hover:bg-slate-700 text-slate-100' : 'bg-[#F0F1FA] hover:bg-[#DDE1F2] text-[#171B35]';

  return (
    <div className="note-body-wrap">
      <div className={`sticky top-[7.1rem] z-20 -mx-1 mb-4 px-2 py-1.5 rounded-lg border shadow-2xs flex flex-wrap items-center gap-2 text-xs ${bar}`}>
        <button type="button" onClick={() => setSearchOpen((v) => !v)} className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded font-medium ${btn}`}>
          <Search className="w-3.5 h-3.5" /> <span>Search notes</span>
        </button>
        {searchOpen && (
          <div className="flex items-center gap-1 flex-1 min-w-[190px]">
            <input
              autoFocus value={query} onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') goToHit(hitIndex + (e.shiftKey ? -1 : 1)); }}
              placeholder="Find in this subject…" aria-label="Search within this subject"
              className={`flex-1 min-w-0 px-2 py-1.5 rounded border text-xs ${isDark ? 'bg-slate-900 border-slate-600 text-white' : 'bg-white border-[#DDE1F2]'}`}
            />
            <span className="tabular-nums opacity-70 w-14 text-center">{query.trim().length >= 2 ? `${hitCount ? hitIndex : 0}/${hitCount}` : ''}</span>
            <button type="button" aria-label="Previous match" onClick={() => goToHit(hitIndex - 1)} className={`p-1.5 rounded ${btn}`}><ChevronUp className="w-3.5 h-3.5" /></button>
            <button type="button" aria-label="Next match" onClick={() => goToHit(hitIndex + 1)} className={`p-1.5 rounded ${btn}`}><ChevronDown className="w-3.5 h-3.5" /></button>
            <button type="button" aria-label="Close search" onClick={() => { setQuery(''); setSearchOpen(false); }} className={`p-1.5 rounded ${btn}`}><X className="w-3.5 h-3.5" /></button>
          </div>
        )}
        {resume && (
          <button type="button" onClick={jumpToResume} className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded font-semibold bg-[#6366F1] text-white hover:bg-[#4F46E5]">
            <Bookmark className="w-3.5 h-3.5" /> <span>Continue where you left off</span>
          </button>
        )}
        <span className="flex-1" />
        {!online && <span className="inline-flex items-center gap-1 text-amber-600 font-semibold"><WifiOff className="w-3.5 h-3.5" /> Offline – saved copy</span>}
        <button type="button" onClick={saveOffline} disabled={!allLoaded || offline.busy || !online} className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded font-medium disabled:opacity-50 ${btn}`} title="Keep this subject's text and images on this device">
          {offline.saved ? <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" /> : <Download className="w-3.5 h-3.5" />}
          <span>
            {offline.busy ? `Saving ${offline.done}/${offline.total || '…'}` : offline.saved ? 'Saved offline' : offline.failed ? `${offline.failed} image(s) failed – retry` : !allLoaded ? 'Loading…' : 'Save for offline'}
          </span>
        </button>
      </div>

      <div className="relative">
        <div ref={ref} onClick={onContentClick} className="medify-reader-content text-slate-800 dark:text-slate-200 leading-relaxed" />
        <div aria-hidden="true" className="absolute inset-0 pointer-events-none z-10 select-none" style={{ backgroundImage: watermark(watermarkText) }} />
      </div>

      {selBox && (
        <div role="toolbar" aria-label="Highlight colours" className="fixed z-[70] flex items-center gap-2 px-3 py-2 rounded-full bg-[#171B35] shadow-xl" style={{ left: selBox.x, top: selBox.y, transform: 'translateX(-50%)' }} onMouseDown={(e) => e.preventDefault()} onTouchStart={(e) => e.stopPropagation()}>
          {(Object.keys(SWATCH) as Color[]).map((c) => (
            <button key={c} type="button" aria-label={`Highlight ${c}`} onClick={() => addHighlight(c)} className="w-7 h-7 rounded-full border-2 border-white/70" style={{ background: SWATCH[c] }} />
          ))}
        </div>
      )}
      {activeHl && !selBox && (
        <button type="button" onClick={() => removeHighlight(activeHl.id)} className="fixed z-[70] inline-flex items-center gap-1.5 px-3 py-2 rounded-full bg-[#171B35] text-white text-xs font-semibold shadow-xl" style={{ left: activeHl.x, top: activeHl.y, transform: 'translateX(-50%)' }}>
          <Trash2 className="w-3.5 h-3.5" /> Remove highlight
        </button>
      )}
      {zoom && (
        <div className="fixed inset-0 z-[80] bg-black/90 overflow-auto" onClick={() => setZoom(null)} role="dialog" aria-label="Image viewer">
          <button type="button" aria-label="Close image" className="fixed top-3 right-3 z-[81] p-2 rounded-full bg-white/90 text-slate-900"><X className="w-5 h-5" /></button>
          <div className="min-h-full min-w-full flex items-center justify-center p-3">
            <img src={zoom.src} alt="" onClick={(e) => { e.stopPropagation(); setZoom({ ...zoom, big: !zoom.big }); }} className="bg-white rounded" style={{ maxWidth: zoom.big ? 'none' : '100%', width: zoom.big ? '220%' : 'auto', maxHeight: zoom.big ? 'none' : '92vh', cursor: zoom.big ? 'zoom-out' : 'zoom-in' }} />
          </div>
        </div>
      )}
    </div>
  );
}
