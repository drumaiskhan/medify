import {authHeaders} from '../lib/client';
import { apiBase } from '../lib/client';

// Private note images are served by the API only to students who may read the subject.
// They are fetched with the student's cookie, kept in Cache Storage (for offline reading)
// and shown through blob: URLs.
export const NOTE_IMAGE_CACHE = 'medify-note-images-v1';
export const NOTE_IMAGE_PREFIX = '/api/note-images/';
const PLACEHOLDER =
  'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7';

const resolved = new Map<string, string>();
const inflight = new Map<string, Promise<string>>();

export function noteImageUrl(stored: string): string {
  return apiBase() + stored.slice('/api'.length);
}

export async function loadNoteImage(stored: string): Promise<string> {
  const known = resolved.get(stored);
  if (known) return known;
  let job = inflight.get(stored);
  if (!job) {
    job = (async () => {
      const url = noteImageUrl(stored);
      let blob: Blob | null = null;
      try {
        if ('caches' in window) {
          const cache = await caches.open(NOTE_IMAGE_CACHE);
          const hit = await cache.match(url, { ignoreVary: true });
          if (hit) blob = await hit.blob();
        }
      } catch {
        /* cache unavailable: fall through to the network */
      }
      if (!blob) {
        const res = await fetch(url, { headers:authHeaders(), credentials: 'include' });
        if (!res.ok) throw new Error('Image unavailable (' + res.status + ')');
        const copy = res.clone();
        blob = await res.blob();
        try {
          if ('caches' in window) {
            const cache = await caches.open(NOTE_IMAGE_CACHE);
            await cache.put(url, copy);
          }
        } catch {
          /* storage full or blocked: image still displays this session */
        }
      }
      if(!blob || !/^image\/(png|jpeg|webp)(;|$)/i.test(blob.type))throw new Error('The server did not return a valid note image.');
      const objectUrl = URL.createObjectURL(blob);
      resolved.set(stored, objectUrl);
      return objectUrl;
    })().finally(() => inflight.delete(stored));
    inflight.set(stored, job);
  }
  return job;
}

/** Replaces every note image placeholder in `root` with its protected image, lazily. */
export function hydrateNoteImages(root: HTMLElement): () => void {
  const images = Array.from(root.querySelectorAll<HTMLImageElement>('img')).filter(
    (img) => (img.getAttribute('src') || '').startsWith(NOTE_IMAGE_PREFIX)
  );
  if (images.length === 0) return () => {};
  let active=true;
  const retries=new Map<HTMLImageElement,HTMLButtonElement>();
  const show = (img: HTMLImageElement) => {
    const stored = img.dataset.noteSrc;
    if (!stored) return;
    loadNoteImage(stored)
      .then((u) => {
        if(!active)return;
        retries.get(img)?.remove();retries.delete(img);
        img.classList.remove('note-img-failed');
        img.src = u;
        img.classList.add('note-img-ready');
      })
      .catch(() => {
        if(!active)return;
        img.classList.add('note-img-failed');
        if (!img.alt) img.alt = 'Note image could not load';
        if(!retries.has(img)){
          const retry=document.createElement('button');retry.type='button';retry.textContent='Image unavailable — retry';
          retry.style.cssText='display:block;padding:8px;margin:8px 0;border:1px solid #94a3b8;border-radius:6px;color:#0f766e;background:#f8fafc;font-size:12px';
          retry.onclick=()=>{retry.remove();retries.delete(img);show(img);};img.after(retry);retries.set(img,retry);
        }
      });
  };
  const observer: IntersectionObserver | null =
    'IntersectionObserver' in window
      ? new IntersectionObserver(
          (entries) =>
            entries.forEach((e) => {
              if (e.isIntersecting) {
                observer?.unobserve(e.target);
                show(e.target as HTMLImageElement);
              }
            }),
          { rootMargin: '800px 0px' }
        )
      : null;
  images.forEach((img) => {
    img.dataset.noteSrc = img.getAttribute('src') || '';
    img.src = PLACEHOLDER;
    if (observer) observer.observe(img);
    else show(img);
  });
  const retryFailed=()=>retries.forEach((_,img)=>show(img));
  window.addEventListener('online',retryFailed);
  return () => {active=false;observer?.disconnect();window.removeEventListener('online',retryFailed);retries.forEach(b=>b.remove());};
}

/** Downloads every image found in `root` into the offline cache. */
export async function prefetchNoteImages(
  root: HTMLElement,
  onProgress?: (done: number, total: number) => void
): Promise<{ done: number; failed: number }> {
  const stored = Array.from(
    new Set(
      Array.from(root.querySelectorAll<HTMLImageElement>('img'))
        .map((i) => i.dataset.noteSrc || '')
        .filter((s) => s.startsWith(NOTE_IMAGE_PREFIX))
    )
  );
  let done = 0;
  let failed = 0;
  let cursor = 0;
  const worker = async () => {
    while (cursor < stored.length) {
      const s = stored[cursor++];
      try {
        await loadNoteImage(s);
      } catch {
        failed++;
      }
      done++;
      onProgress?.(done, stored.length);
    }
  };
  await Promise.all([worker(), worker(), worker(), worker()]);
  return { done: done - failed, failed };
}
