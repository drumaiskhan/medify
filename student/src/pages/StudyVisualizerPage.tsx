import { useEffect, useMemo, useState } from 'react';
import { Sparkles, Loader2, Info, ChevronDown } from 'lucide-react';
import { api } from '../lib/client';

type Group = 'core' | 'cause' | 'mechanism' | 'feature' | 'clinical' | 'treatment' | 'other';
interface MapNode { id: string; label: string; detail: string; group: Group }
interface MapEdge { from: string; to: string; label: string }
interface ConceptMap { title: string; summary: string; nodes: MapNode[]; edges: MapEdge[] }

const STYLE: Record<Group, { fill: string; stroke: string; name: string }> = {
  core: { fill: '#0F2837', stroke: '#0F2837', name: 'Core topic' },
  cause: { fill: '#FEF3C7', stroke: '#B45309', name: 'Cause / risk' },
  mechanism: { fill: '#D5EEEE', stroke: '#147273', name: 'Mechanism' },
  feature: { fill: '#DBEAFE', stroke: '#2563EB', name: 'Features' },
  clinical: { fill: '#FCE7F3', stroke: '#BE185D', name: 'Clinical' },
  treatment: { fill: '#DCFCE7', stroke: '#15803D', name: 'Treatment' },
  other: { fill: '#F1F5F9', stroke: '#64748B', name: 'Related' },
};
const EXAMPLES = ['Acute inflammation', 'Cardiac cycle', 'Diabetic ketoacidosis', 'Renin–angiotensin system'];
const W = 1000;
const H = 620;

function wrap(text: string, max = 20, lines = 3): string[] {
  const out: string[] = [];
  let cur = '';
  for (const word of text.split(/\s+/)) {
    if ((cur + ' ' + word).trim().length > max && cur) { out.push(cur); cur = word; }
    else cur = (cur + ' ' + word).trim();
  }
  if (cur) out.push(cur);
  if (out.length > lines) { out.length = lines; out[lines - 1] = out[lines - 1].replace(/.{0,2}$/, '…'); }
  return out;
}

export function StudyVisualizerPage() {
  const [available, setAvailable] = useState<boolean | null>(null);
  const [topic, setTopic] = useState('');
  const [notes, setNotes] = useState('');
  const [showNotes, setShowNotes] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [map, setMap] = useState<ConceptMap | null>(null);
  const [selected, setSelected] = useState<string>('');

  useEffect(() => {
    api('/ai/status').then((r) => setAvailable(Boolean(r.available))).catch(() => setAvailable(false));
  }, []);

  const generate = async (t = topic) => {
    const wanted = t.trim();
    if (wanted.length < 3 || busy) return;
    setBusy(true);
    setError('');
    try {
      const r = await api('/ai/visualize', { topic: wanted, notes: showNotes ? notes : '' });
      setMap(r.map);
      setSelected(r.map.nodes[0]?.id || '');
    } catch (e: any) {
      setError(e.message || 'Could not build the map. Please try again.');
    } finally {
      setBusy(false);
    }
  };

  // Centre node in the middle, everything else on an ellipse around it.
  const layout = useMemo(() => {
    const pos: Record<string, { x: number; y: number; lines: string[]; h: number }> = {};
    if (!map) return pos;
    const rest = map.nodes.slice(1);
    map.nodes.forEach((n, i) => {
      const lines = wrap(n.label, i === 0 ? 16 : 20);
      const h = 18 * lines.length + 18;
      if (i === 0) { pos[n.id] = { x: W / 2, y: H / 2, lines, h: h + 10 }; return; }
      const a = -Math.PI / 2 + ((i - 1) / rest.length) * Math.PI * 2;
      pos[n.id] = { x: W / 2 + Math.cos(a) * 385, y: H / 2 + Math.sin(a) * 235, lines, h };
    });
    return pos;
  }, [map]);

  const current = map?.nodes.find((n) => n.id === selected) || map?.nodes[0];

  return (
    <div className="sw-dashboard" style={{ paddingTop: 30 }}>
      <section className="sw-dashboard-intro" style={{ marginBottom: 18 }}>
        <div>
          <div className="sw-eyebrow"><span className="sw-eyebrow-dot" /> AI STUDY TOOL</div>
          <h1>Study <span>visualizer</span></h1>
          <p>Type a medical topic and get an interactive concept map: causes, mechanism, features and treatment, connected.</p>
        </div>
      </section>

      {available === false && (
        <div role="status" className="rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900 mb-4">
          The AI visualizer has not been switched on yet. Please ask your administrator to add the AI key.
        </div>
      )}

      <form
        onSubmit={(e) => { e.preventDefault(); void generate(); }}
        className="rounded-2xl border border-[#dbe6ec] bg-white p-4 sm:p-5 shadow-sm space-y-3"
      >
        <label className="block text-xs font-bold text-slate-700" htmlFor="viz-topic">What do you want to understand?</label>
        <div className="flex flex-col sm:flex-row gap-2">
          <input
            id="viz-topic" value={topic} maxLength={120} onChange={(e) => setTopic(e.target.value)}
            placeholder="e.g. Nephrotic syndrome" disabled={available === false}
            className="flex-1 min-w-0 rounded-lg border border-[#cfdbe5] px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#1b8e8e]"
          />
          <button
            type="submit" disabled={busy || available === false || topic.trim().length < 3}
            className="inline-flex items-center justify-center gap-2 rounded-lg bg-[#1b8e8e] hover:bg-[#147273] disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-bold px-5 py-2.5"
          >
            {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
            {busy ? 'Building…' : 'Visualize'}
          </button>
        </div>
        <div className="flex flex-wrap gap-2">
          {EXAMPLES.map((x) => (
            <button
              key={x} type="button" disabled={busy || available === false}
              onClick={() => { setTopic(x); void generate(x); }}
              className="rounded-full border border-[#cfdbe5] bg-[#e8eef3] hover:bg-[#d5eeee] px-3 py-1 text-xs font-semibold text-[#0f2837] disabled:opacity-50"
            >{x}</button>
          ))}
        </div>
        <button type="button" onClick={() => setShowNotes(!showNotes)} className="inline-flex items-center gap-1 text-xs font-semibold text-[#147273]">
          <ChevronDown className={`w-3.5 h-3.5 transition-transform ${showNotes ? 'rotate-180' : ''}`} />
          {showNotes ? 'Hide my notes' : 'Add my own notes (optional)'}
        </button>
        {showNotes && (
          <textarea
            value={notes} maxLength={3000} rows={5} onChange={(e) => setNotes(e.target.value)}
            placeholder="Paste a few lines from your notes and the map will focus on them."
            className="w-full rounded-lg border border-[#cfdbe5] px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#1b8e8e]"
          />
        )}
      </form>

      {error && <div role="alert" className="mt-4 rounded-xl border border-rose-300 bg-rose-50 p-4 text-sm text-rose-800">{error}</div>}

      {busy && !map && (
        <div className="mt-6 rounded-2xl border border-dashed border-[#cfdbe5] bg-white p-10 text-center text-sm text-slate-500">
          <Loader2 className="w-6 h-6 animate-spin mx-auto mb-2 text-[#1b8e8e]" /> Building your concept map…
        </div>
      )}

      {map && (
        <section aria-label="Concept map" className={`mt-6 space-y-4 ${busy ? 'opacity-60' : ''}`}>
          <div className="rounded-2xl border border-[#dbe6ec] bg-white p-5 shadow-sm">
            <h2 className="text-lg font-bold text-[#0f2837]">{map.title || topic}</h2>
            {map.summary && <p className="mt-1.5 text-sm leading-relaxed text-slate-600">{map.summary}</p>}
          </div>

          <div className="rounded-2xl border border-[#dbe6ec] bg-white p-2 sm:p-4 shadow-sm">
            <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-auto" role="group" aria-label="Interactive concept map">
              {map.edges.map((e, i) => {
                const a = layout[e.from]; const b = layout[e.to];
                if (!a || !b) return null;
                const active = e.from === selected || e.to === selected;
                return (
                  <g key={i}>
                    <line x1={a.x} y1={a.y} x2={b.x} y2={b.y} stroke={active ? '#1b8e8e' : '#cfdbe5'} strokeWidth={active ? 2.5 : 1.5} />
                    {active && e.label && (
                      <text x={(a.x + b.x) / 2} y={(a.y + b.y) / 2 - 4} textAnchor="middle" fontSize="13" fontWeight="600" fill="#147273" stroke="#fff" strokeWidth="4" paintOrder="stroke">{e.label}</text>
                    )}
                  </g>
                );
              })}
              {map.nodes.map((n, i) => {
                const p = layout[n.id]; if (!p) return null;
                const st = STYLE[i === 0 ? 'core' : n.group === 'core' ? 'other' : n.group];
                const w = i === 0 ? 190 : 170;
                const on = n.id === selected;
                const light = i === 0;
                return (
                  <g
                    key={n.id} tabIndex={0} role="button" aria-pressed={on} aria-label={n.label}
                    onClick={() => setSelected(n.id)}
                    onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setSelected(n.id); } }}
                    style={{ cursor: 'pointer', outline: 'none' }}
                  >
                    <rect x={p.x - w / 2} y={p.y - p.h / 2} width={w} height={p.h} rx="14" fill={st.fill} stroke={on ? '#1b8e8e' : st.stroke} strokeWidth={on ? 4 : 2} />
                    {p.lines.map((l, k) => (
                      <text key={k} x={p.x} y={p.y - ((p.lines.length - 1) * 18) / 2 + k * 18 + 5} textAnchor="middle" fontSize="14" fontWeight="700" fill={light ? '#fff' : '#0f2837'}>{l}</text>
                    ))}
                  </g>
                );
              })}
            </svg>
            <div className="flex flex-wrap gap-x-4 gap-y-1 px-2 pb-1 text-[11px] text-slate-500">
              {(Object.keys(STYLE) as Group[]).filter((g) => g !== 'core' && map.nodes.some((n) => n.group === g)).map((g) => (
                <span key={g} className="inline-flex items-center gap-1.5">
                  <span className="inline-block w-3 h-3 rounded-sm border" style={{ background: STYLE[g].fill, borderColor: STYLE[g].stroke }} />{STYLE[g].name}
                </span>
              ))}
            </div>
          </div>

          {current && (
            <div className="rounded-2xl border border-[#1b8e8e]/30 bg-[#e8f5f5] p-5">
              <span className="text-[11px] font-bold uppercase tracking-wider text-[#147273]">{STYLE[current.group === 'core' ? 'core' : current.group].name}</span>
              <h3 className="mt-0.5 text-base font-bold text-[#0f2837]">{current.label}</h3>
              <p className="mt-1.5 text-sm leading-relaxed text-slate-700">{current.detail || 'Select another concept to read more.'}</p>
            </div>
          )}

          <div className="rounded-2xl border border-[#dbe6ec] bg-white p-3 sm:p-4 shadow-sm">
            <p className="text-xs font-bold text-slate-600 mb-2">All concepts</p>
            <div className="flex flex-wrap gap-2">
              {map.nodes.map((n, i) => (
                <button
                  key={n.id} type="button" onClick={() => setSelected(n.id)} aria-pressed={n.id === selected}
                  className={`rounded-lg border px-3 py-1.5 text-xs font-semibold transition-colors ${n.id === selected ? 'border-[#1b8e8e] bg-[#d5eeee] text-[#0f2837]' : 'border-[#cfdbe5] bg-white text-slate-700 hover:border-[#1b8e8e]'}`}
                >{i + 1}. {n.label}</button>
              ))}
            </div>
          </div>

          <p className="flex items-start gap-2 text-xs text-slate-500">
            <Info className="w-4 h-4 shrink-0 mt-px" />
            AI-generated study aid. It can make mistakes, so check important facts against your MEDIFY notes and textbooks.
          </p>
        </section>
      )}
    </div>
  );
}
