import { prepareImage } from './prepareNoteImage';
import {authHeaders} from '../lib/client';
import mammoth, { MammothOptions } from 'mammoth';
import DOMPurify from 'dompurify';
import { slugify } from '../services/curriculum';
import { apiBase } from '../lib/client';
import { NOTE_IMAGE_PREFIX } from './noteImages';

export interface TocItem {
  id: string;
  level: 2 | 3 | 4;
  text: string;
  part: number; // 1-based index (1..N)
}

export interface SubjectPartData {
  partNumber: number;
  html: string;
  sizeBytes: number;
}

export interface ProcessedSubjectDocx {
  parts: SubjectPartData[];
  toc: TocItem[];
  totalBytes: number;
  totalSizeKb: number;
  partCount: number;
  headingCount: number;
  imageNotice: string | null;
  imageCount: number;
  imagesFailed: number;
  hasNoH1: boolean;
  /** Set by the non-Word importer so the UI can word its notices for that format. */
  sourceFormat?: 'docx' | 'pdf' | 'txt' | 'md' | 'html';
  firstPartHtml: string;
}

// Strict whitelist allowed for medical notes
export const ALLOWED_TAGS = [
  'h2',
  'h3',
  'h4',
  'p',
  'br',
  'strong',
  'em',
  'u',
  'ul',
  'ol',
  'li',
  'table',
  'thead',
  'tbody',
  'tr',
  'th',
  'td',
  'a',
  'blockquote',
  'hr',
  'sup',
  'sub',
  'img'
];

export const ALLOWED_ATTR = ['href', 'target', 'rel', 'id', 'src', 'alt', 'width', 'height', 'loading', 'decoding'];

// Only images stored by MEDIFY's own private image endpoint may appear in notes.
const NOTE_IMAGE_SRC = /^\/api\/note-images\/[A-Za-z0-9][A-Za-z0-9_.-]*\/[a-f0-9]{64}\.(webp|png|jpg)$/;
let imageHookInstalled = false;
function installImageHook() {
  if (imageHookInstalled) return;
  imageHookInstalled = true;
  DOMPurify.addHook('afterSanitizeAttributes', (node: Element) => {
    if (node.tagName === 'IMG') {
      let source=node.getAttribute('src')||'';
      if(/^https?:\/\//i.test(source))try{source=new URL(source).pathname;}catch{}
      if (NOTE_IMAGE_SRC.test(source))node.setAttribute('src',source);
      if (!NOTE_IMAGE_SRC.test(source)) {
        node.parentNode?.removeChild(node);
        return;
      }
      node.setAttribute('loading', 'lazy');
      node.setAttribute('decoding', 'async');
    }
  });
}

const MAX_PART_BYTES = 600000; // 600 KB UTF-8 split threshold
const MAX_TABLE_BYTES = 900000; // 900 KB hard limit for single table

/**
 * Accurately compute UTF-8 byte length for any string.
 */
export function getUtf8Bytes(str: string): number {
  return new TextEncoder().encode(str).length;
}

/**
 * Sanitises raw HTML with DOMPurify with strict medical tag whitelist.
 * Strips scripts, styles, iframes, and inline event handlers.
 */
export function sanitizeSubjectHtml(rawHtml: string): string {
  installImageHook();
  return DOMPurify.sanitize(rawHtml, {
    ALLOWED_TAGS,
    ALLOWED_ATTR,
    ALLOW_DATA_ATTR: false
  });
}

const MAX_IMAGES_PER_UPLOAD = 400;

async function uploadNoteImage(subjectId: string, blob: Blob): Promise<string> {
  const form = new FormData();
  form.append('subjectId', subjectId);
  form.append('image', blob, blob.type === 'image/webp' ? 'image.webp' : blob.type === 'image/jpeg' ? 'image.jpg' : 'image.png');
  const res = await fetch(apiBase() + '/note-images', {
    method: 'POST',
    signal: AbortSignal.timeout(45000),
    headers:authHeaders(), credentials: 'include',
    body: form
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || typeof data.url !== 'string' || !data.url.startsWith(NOTE_IMAGE_PREFIX)) {
    throw new Error(data.error || (res.status === 413 ? 'The server rejected the image size. Check the upload limit on your hosting server.' : `Image upload failed (HTTP ${res.status}). Please try again.`));
  }
  return data.url;
}

/**
 * Convert a Word (.docx) file into clean, sanitised, and partitioned subject note parts.
 */
export async function convertAndProcessSubjectDocx(
  file: File,
  subjectId?: string
): Promise<ProcessedSubjectDocx> {
  if (!file.size) throw new Error('This Word file is empty.');
  if (file.size > 100 * 1024 * 1024) throw new Error('This Word file exceeds 100 MB. Split it into smaller documents.');
  const arrayBuffer = await file.arrayBuffer();
  let skippedImages = 0; // not uploaded because no existing subject was selected
  let failedImages = 0; // unsupported format or upload error
  let savedImages = 0;
  let seenImages = 0;
  let imageQueue: Promise<unknown> = Promise.resolve();
  const failureReasons = new Set<string>();

  const mammothOptions: MammothOptions = {
    styleMap: [
      "p[style-name='Heading 1'] => h2:fresh",
      "p[style-name='Heading 2'] => h3:fresh",
      "p[style-name='Heading 3'] => h4:fresh"
    ],
    convertImage: mammoth.images.imgElement((image) => {
      const job = imageQueue.then(async () => {
      if (!subjectId) {
        skippedImages++;
        return { src: '' };
      }
      if (++seenImages > MAX_IMAGES_PER_UPLOAD) {
        failedImages++;
        failureReasons.add(`more than ${MAX_IMAGES_PER_UPLOAD} images`);
        return { src: '' };
      }
      try {
        const base64: string = await image.read('base64');
        const prepared = await prepareImage(base64, image.contentType);
        const src = await uploadNoteImage(subjectId, prepared.blob);
        savedImages++;
        return {
          src,
          alt: image.altText || '',
          ...(prepared.width ? { width: String(prepared.width) } : {}),
          ...(prepared.height ? { height: String(prepared.height) } : {})
        };
      } catch (err: any) {
        failedImages++;
        failureReasons.add(err?.message || 'unknown error');
        return { src: '' };
      }
      });
      imageQueue = job.catch(() => {});
      return job;
    })
  };

  const mammothResult = await mammoth.convertToHtml({ arrayBuffer }, mammothOptions);

  const noticeParts: string[] = [];
  if (skippedImages > 0) {
    noticeParts.push(
      `${skippedImages} image${skippedImages > 1 ? 's were' : ' was'} NOT uploaded because no existing subject is selected. Select the subject first, then upload this file again.`
    );
  }
  if (failedImages > 0) {
    noticeParts.push(
      `${failedImages} image${failedImages > 1 ? 's' : ''} could not be saved (${Array.from(failureReasons).join('; ')}). Check the reason above and try uploading again. For unsupported pictures, replace them with PNG/JPG images in Word.`
    );
  }
  if(skippedImages || failedImages)throw new Error(noticeParts.join(' '));
  const imageNotice = noticeParts.length > 0 ? noticeParts.join(' ') : null;

  // Sanitise HTML using DOMPurify
  const cleanHtml = sanitizeSubjectHtml(mammothResult.value);

  // Parse into DOM to inspect tables, assign IDs to headings, and split into parts
  const parser = new DOMParser();
  const doc = parser.parseFromString(cleanHtml, 'text/html');

  // Check 1: Check all tables. Never split inside a table. If any table exceeds 900,000 bytes, refuse to save.
  const allTables = doc.body.querySelectorAll('table');
  allTables.forEach((table, idx) => {
    const tableBytes = getUtf8Bytes(table.outerHTML);
    if (tableBytes > MAX_TABLE_BYTES) {
      const kb = Math.round(tableBytes / 1024);
      throw new Error(
        `Table #${idx + 1} exceeds 900 KB (${kb} KB). Tables must fit within a single note part. Please split or summarize this table in Word before uploading.`
      );
    }
  });

  // Collect top-level elements, wrapping any orphan text in <p>
  const topElements: HTMLElement[] = [];
  Array.from(doc.body.childNodes).forEach((node) => {
    if (node.nodeType === Node.ELEMENT_NODE) {
      topElements.push(node as HTMLElement);
    } else if (node.nodeType === Node.TEXT_NODE && node.textContent?.trim()) {
      const p = doc.createElement('p');
      p.textContent = node.textContent;
      topElements.push(p);
    }
  });

  // Assign stable unique IDs to all headings: 's-<n>-<slug>'
  let headingCounter = 0;
  const headingElements = doc.body.querySelectorAll('h2, h3, h4');
  const hasNoH1 = doc.body.querySelectorAll('h2').length === 0;

  headingElements.forEach((hEl) => {
    headingCounter++;
    const text = hEl.textContent?.trim() || `Section ${headingCounter}`;
    const slug = slugify(text) || `section-${headingCounter}`;
    const uniqueId = `s-${headingCounter}-${slug}`;
    hEl.setAttribute('id', uniqueId);
  });

  // Split into parts algorithm:
  // Walk the sanitised HTML top-level nodes and start a new part at an h2 boundary
  // whenever adding the next h2 section would push the current part over 600,000 bytes (UTF-8 size).
  // If a single h2 section is larger than 600,000 bytes, split it at the next h3, then at paragraph boundaries.
  // Never split inside a table, list (ul, ol) or blockquote.

  // 1. Group top-level elements into H2 sections
  interface H2Section {
    h2El: HTMLElement | null;
    elements: HTMLElement[];
  }

  const h2Sections: H2Section[] = [];
  let currentH2Sec: H2Section = { h2El: null, elements: [] };

  topElements.forEach((el) => {
    if (el.tagName.toLowerCase() === 'h2') {
      if (currentH2Sec.elements.length > 0) {
        h2Sections.push(currentH2Sec);
      }
      currentH2Sec = { h2El: el, elements: [el] };
    } else {
      currentH2Sec.elements.push(el);
    }
  });
  if (currentH2Sec.elements.length > 0) {
    h2Sections.push(currentH2Sec);
  }

  // Helper to compute size of a list of elements
  const getElementsBytes = (els: HTMLElement[]): number => {
    return getUtf8Bytes(els.map((e) => e.outerHTML).join(''));
  };

  const partsElements: HTMLElement[][] = [[]];

  const addToCurrentPart = (els: HTMLElement[]) => {
    const curIdx = partsElements.length - 1;
    partsElements[curIdx].push(...els);
  };

  const startNewPartWith = (els: HTMLElement[]) => {
    if (partsElements[partsElements.length - 1].length === 0) {
      partsElements[partsElements.length - 1].push(...els);
    } else {
      partsElements.push([...els]);
    }
  };

  h2Sections.forEach((h2Sec) => {
    const secBytes = getElementsBytes(h2Sec.elements);
    const curPartBytes = getElementsBytes(partsElements[partsElements.length - 1]);

    if (secBytes <= MAX_PART_BYTES) {
      if (curPartBytes + secBytes > MAX_PART_BYTES && curPartBytes > 0) {
        startNewPartWith(h2Sec.elements);
      } else {
        addToCurrentPart(h2Sec.elements);
      }
    } else {
      // Single H2 section exceeds 600,000 bytes!
      // Sub-split by H3
      interface H3Section {
        h3El: HTMLElement | null;
        elements: HTMLElement[];
      }
      const h3Sections: H3Section[] = [];
      let currentH3Sec: H3Section = { h3El: null, elements: [] };

      h2Sec.elements.forEach((el) => {
        if (el.tagName.toLowerCase() === 'h3') {
          if (currentH3Sec.elements.length > 0) {
            h3Sections.push(currentH3Sec);
          }
          currentH3Sec = { h3El: el, elements: [el] };
        } else {
          currentH3Sec.elements.push(el);
        }
      });
      if (currentH3Sec.elements.length > 0) {
        h3Sections.push(currentH3Sec);
      }

      h3Sections.forEach((h3Sec) => {
        const subBytes = getElementsBytes(h3Sec.elements);
        const curBytes = getElementsBytes(partsElements[partsElements.length - 1]);

        if (subBytes <= MAX_PART_BYTES) {
          if (curBytes + subBytes > MAX_PART_BYTES && curBytes > 0) {
            startNewPartWith(h3Sec.elements);
          } else {
            addToCurrentPart(h3Sec.elements);
          }
        } else {
          // Single H3 section still exceeds 600,000 bytes!
          // Split at element (e.g. paragraph) boundaries.
          // Note: never split inside table, list (ul, ol) or blockquote.
          h3Sec.elements.forEach((elem) => {
            const elBytes = getUtf8Bytes(elem.outerHTML);
            const activeBytes = getElementsBytes(partsElements[partsElements.length - 1]);

            if (activeBytes + elBytes > MAX_PART_BYTES && activeBytes > 0) {
              startNewPartWith([elem]);
            } else {
              addToCurrentPart([elem]);
            }
          });
        }
      });
    }
  });

  // Filter out any empty parts
  const finalPartsElements = partsElements.filter((p) => p.length > 0);
  if (finalPartsElements.length === 0) {
    finalPartsElements.push([]);
  }

  // Build parts and Table of Contents
  const parts: SubjectPartData[] = [];
  const toc: TocItem[] = [];
  let totalBytes = 0;

  finalPartsElements.forEach((els, idx) => {
    const partNumber = idx + 1;
    const html = els.map((e) => e.outerHTML).join('');
    const sizeBytes = getUtf8Bytes(html);
    totalBytes += sizeBytes;

    parts.push({
      partNumber,
      html,
      sizeBytes
    });

    // Collect headings in this part for the TOC
    els.forEach((el) => {
      const tag = el.tagName.toLowerCase();
      if (tag === 'h2' || tag === 'h3' || tag === 'h4') {
        const level = parseInt(tag[1], 10) as 2 | 3 | 4;
        const text = el.textContent?.trim() || '';
        const id = el.getAttribute('id') || '';
        if (text && id) {
          toc.push({
            id,
            level,
            text,
            part: partNumber
          });
        }
      }
      // Also search child headings (if any heading was nested inside blockquote etc.)
      const childHeadings = el.querySelectorAll('h2, h3, h4');
      childHeadings.forEach((ch) => {
        const cTag = ch.tagName.toLowerCase();
        const level = parseInt(cTag[1], 10) as 2 | 3 | 4;
        const text = ch.textContent?.trim() || '';
        const id = ch.getAttribute('id') || '';
        if (text && id && !toc.some((t) => t.id === id)) {
          toc.push({
            id,
            level,
            text,
            part: partNumber
          });
        }
      });
    });
  });

  return {
    parts,
    toc,
    totalBytes,
    totalSizeKb: Number((totalBytes / 1024).toFixed(1)),
    partCount: parts.length,
    headingCount: toc.length,
    imageNotice,
    imageCount: savedImages,
    imagesFailed: failedImages + skippedImages,
    hasNoH1,
    firstPartHtml: parts[0]?.html || ''
  };
}

/**
 * Prepares HTML content for rendering in the reader:
 * 1. Sanitises again with DOMPurify.
 * 2. Wraps all <table> elements in horizontally scrollable `.table-scroll-container`
 *    so tables never cause horizontal page overflow on small mobile viewports.
 */
export function prepareHtmlForReader(html: string): string {
  if (!html) return '';
  const clean = sanitizeSubjectHtml(html);
  if (typeof window === 'undefined') return clean;

  try {
    const parser = new DOMParser();
    const doc = parser.parseFromString(clean, 'text/html');

    const tables = doc.body.querySelectorAll('table');
    tables.forEach((table) => {
      const parent = table.parentElement;
      if (parent && parent.classList.contains('table-scroll-container')) {
        return;
      }
      const wrapper = doc.createElement('div');
      wrapper.className = 'table-scroll-container';
      parent?.insertBefore(wrapper, table);
      wrapper.appendChild(table);
    });

    return doc.body.innerHTML;
  } catch {
    return clean;
  }
}


/** One line of text pulled out of a PDF page, with the font height it was set in. */
interface PdfLine { text: string; height: number; y: number }

/**
 * Rebuild readable lines from pdf.js text items. Items on (almost) the same
 * baseline are joined; the tallest font on the line is kept so headings can be
 * recognised by size later.
 */
function pdfLinesFromItems(items: any[]): PdfLine[] {
  const lines: PdfLine[] = [];
  let cur: PdfLine | null = null;
  for (const item of items) {
    if (!('str' in item)) continue;
    const str = String(item.str);
    const y = Number(item.transform?.[5] ?? 0);
    const height = Math.abs(Number(item.transform?.[3] ?? item.height ?? 0)) || Number(item.height) || 0;
    if (cur && Math.abs(cur.y - y) > Math.max(2, cur.height * 0.4)) { lines.push(cur); cur = null; }
    if (!cur) cur = { text: '', height: 0, y };
    if (str.trim()) cur.text += (cur.text && !/\s$/.test(cur.text) && !/^\s/.test(str) ? ' ' : '') + str;
    cur.height = Math.max(cur.height, height);
    if (item.hasEOL) { lines.push(cur); cur = null; }
  }
  if (cur) lines.push(cur);
  return lines.map(l => ({ ...l, text: l.text.replace(/\s+/g, ' ').trim() })).filter(l => l.text);
}

/** Running totals for pictures imported from PDF, Markdown and HTML notes. */
interface ImageImportState {
  subjectId?: string; seen: number; saved: number; failed: number; skipped: number;
  reasons: Set<string>; cache: Map<string, string>;
}

/** Turn an <img src> (data: URI or web link) into base64 bytes the shared image pipeline understands. */
async function readImageSource(src: string): Promise<{ base64: string; contentType: string }> {
  const data = src.match(/^data:(image\/[a-z0-9.+-]+)((?:;[a-z0-9=_.+-]+)*?)(;base64)?,([\s\S]*)$/i);
  if (data) {
    const contentType = data[1].toLowerCase();
    if (data[3]) return { base64: data[4].replace(/\s+/g, ''), contentType };
    const text = decodeURIComponent(data[4]);
    return { base64: await blobToBase64(new Blob([text], { type: contentType })), contentType };
  }
  if (/^https?:\/\//i.test(src)) {
    let res: Response;
    try {
      res = await fetch(src, { credentials: 'omit', referrerPolicy: 'no-referrer', signal: AbortSignal.timeout(20000) });
    } catch {
      throw new Error('a linked picture could not be downloaded (its website blocks it) — embed the picture inside the file instead');
    }
    if (!res.ok) throw new Error(`a linked picture could not be downloaded (HTTP ${res.status})`);
    const blob = await res.blob();
    if (blob.size > 20 * 1024 * 1024) throw new Error('a linked picture is larger than 20 MB');
    return { base64: await blobToBase64(blob), contentType: blob.type || 'image/png' };
  }
  throw new Error('a picture points to a separate file on your computer — embed it in the file, or use DOCX or PDF');
}

/**
 * Upload every picture found in an HTML string through the same pipeline as Word
 * images (resize, compress, store privately) and rewrite src to the stored copy.
 * Pictures that cannot be imported are removed and counted. Must run on the RAW
 * html: the sanitizer deletes any image that is not already a stored note image.
 * The html is only parsed (never rendered), so nothing in it can execute.
 */
async function embedHtmlImages(html: string, st: ImageImportState): Promise<string> {
  if (!/<img[\s>]/i.test(html)) return html;
  const dom = new DOMParser().parseFromString(html, 'text/html');
  for (const img of Array.from(dom.body.querySelectorAll('img'))) {
    const src = (img.getAttribute('src') || '').trim();
    if (!src) { img.remove(); continue; }
    if (NOTE_IMAGE_SRC.test(src)) continue; // already one of ours
    if (!st.subjectId) { st.skipped++; img.remove(); continue; }
    const hit = st.cache.get(src);
    if (hit) { img.setAttribute('src', hit); img.removeAttribute('srcset'); continue; }
    if (++st.seen > MAX_IMAGES_PER_UPLOAD) { st.failed++; st.reasons.add(`more than ${MAX_IMAGES_PER_UPLOAD} images`); img.remove(); continue; }
    try {
      const { base64, contentType } = await readImageSource(src);
      const prepared = await prepareImage(base64, contentType);
      const url = await uploadNoteImage(st.subjectId, prepared.blob);
      st.cache.set(src, url); st.saved++;
      img.setAttribute('src', url);
      img.removeAttribute('srcset'); img.removeAttribute('sizes');
      if (prepared.width) img.setAttribute('width', String(prepared.width)); else img.removeAttribute('width');
      if (prepared.height) img.setAttribute('height', String(prepared.height)); else img.removeAttribute('height');
    } catch (err: any) {
      st.failed++; st.reasons.add(err?.message || 'unknown error'); img.remove();
    }
  }
  return dom.body.innerHTML;
}

/** An image found on a PDF page, cropped from the rendered page and ready to upload. */
interface PdfImage { y: number; blob: Blob; width?: number; height?: number; key: string; src?: string }
interface PdfPageData { lines: PdfLine[]; images: PdfImage[] }

const mulMatrix = (m: number[], t: number[]) => [
  m[0] * t[0] + m[2] * t[1], m[1] * t[0] + m[3] * t[1],
  m[0] * t[2] + m[2] * t[3], m[1] * t[2] + m[3] * t[3],
  m[0] * t[4] + m[2] * t[5] + m[4], m[1] * t[4] + m[3] * t[5] + m[5],
];

const blobToBase64 = (blob: Blob) => new Promise<string>((resolve, reject) => {
  const r = new FileReader();
  r.onload = () => resolve(String(r.result).split(',')[1] || '');
  r.onerror = () => reject(new Error('Could not read the image data'));
  r.readAsDataURL(blob);
});

/** Tiny fingerprint so a logo repeated on every page can be recognised and skipped. */
function thumbKey(c: HTMLCanvasElement): string {
  const t = document.createElement('canvas'); t.width = 8; t.height = 8;
  const x = t.getContext('2d');
  if (!x) return Math.random().toString(36);
  x.drawImage(c, 0, 0, 8, 8);
  const d = x.getImageData(0, 0, 8, 8).data;
  let k = '';
  for (let i = 0; i < d.length; i += 4) k += Math.min(15, Math.round((d[i] + d[i + 1] + d[i + 2]) / 3 / 16)).toString(16);
  return k + ':' + Math.round((c.width / Math.max(1, c.height)) * 5);
}

/**
 * Find the pictures placed on a PDF page and cut each one out of a rendered copy
 * of the page. Cropping the render (rather than decoding raw image streams)
 * keeps masks, colour spaces, rotation and overlaid labels exactly as shown.
 */
async function extractPdfPageImages(
  pdfjs: any, page: any, textChars: number, limit: number, fail: (reason: string) => void
): Promise<PdfImage[]> {
  if (limit <= 0) return [];
  const OPS = pdfjs.OPS;
  const base = page.getViewport({ scale: 1 });
  const pageArea = base.width * base.height;
  const ops = await page.getOperatorList();
  let ctm = [1, 0, 0, 1, 0, 0];
  const stack: number[][] = [];
  const boxes: { x0: number; y0: number; x1: number; y1: number; top: number }[] = [];
  const seen = new Set<string>();
  for (let i = 0; i < ops.fnArray.length; i++) {
    const fn = ops.fnArray[i];
    const args = ops.argsArray[i];
    if (fn === OPS.save) stack.push(ctm);
    else if (fn === OPS.restore) { if (stack.length) ctm = stack.pop()!; }
    else if (fn === OPS.transform) ctm = mulMatrix(ctm, args as number[]);
    else if (fn === OPS.paintFormXObjectBegin) { stack.push(ctm); if (Array.isArray(args?.[0])) ctm = mulMatrix(ctm, args[0]); }
    else if (fn === OPS.paintFormXObjectEnd) { if (stack.length) ctm = stack.pop()!; }
    else if (fn === OPS.paintImageXObject || fn === OPS.paintInlineImageXObject) {
      const corners = [[0, 0], [1, 0], [0, 1], [1, 1]].map(([u, v]) => [
        ctm[0] * u + ctm[2] * v + ctm[4], ctm[1] * u + ctm[3] * v + ctm[5],
      ]);
      const vp = corners.map(([x, y]) => base.convertToViewportPoint(x, y) as number[]);
      const x0 = Math.max(0, Math.min(...vp.map(p => p[0])));
      const y0 = Math.max(0, Math.min(...vp.map(p => p[1])));
      const x1 = Math.min(base.width, Math.max(...vp.map(p => p[0])));
      const y1 = Math.min(base.height, Math.max(...vp.map(p => p[1])));
      const w = x1 - x0, h = y1 - y0;
      if (w < 40 || h < 40 || w * h < 4000) continue;                 // icons, bullets, rules
      if (Math.max(w / h, h / w) > 12) continue;                      // thin decorative strips
      if (w * h > pageArea * 0.85 && textChars >= 30) continue;       // page background / watermark
      const id = [x0, y0, x1, y1].map(n => Math.round(n)).join(',');
      if (seen.has(id)) continue;
      seen.add(id);
      boxes.push({ x0, y0, x1, y1, top: Math.max(...corners.map(c => c[1])) });
    }
  }
  if (!boxes.length) return [];
  let scale = Math.min(2.5, Math.max(1.25, 1800 / base.width));
  while (base.width * scale * base.height * scale > 20_000_000 && scale > 0.5) scale *= 0.85;
  const viewport = page.getViewport({ scale });
  const canvas = document.createElement('canvas');
  canvas.width = Math.ceil(viewport.width); canvas.height = Math.ceil(viewport.height);
  const ctx = canvas.getContext('2d');
  if (!ctx) { fail('Canvas unavailable'); return []; }
  ctx.fillStyle = '#ffffff'; ctx.fillRect(0, 0, canvas.width, canvas.height);
  const out: PdfImage[] = [];
  try {
    await page.render({ canvas, viewport }).promise;
    for (const b of boxes.slice(0, limit)) {
      const sx = Math.floor(b.x0 * scale), sy = Math.floor(b.y0 * scale);
      const sw = Math.min(canvas.width - sx, Math.ceil((b.x1 - b.x0) * scale));
      const sh = Math.min(canvas.height - sy, Math.ceil((b.y1 - b.y0) * scale));
      if (sw < 8 || sh < 8) continue;
      const crop = document.createElement('canvas'); crop.width = sw; crop.height = sh;
      try {
        const cctx = crop.getContext('2d');
        if (!cctx) throw new Error('Canvas unavailable');
        cctx.fillStyle = '#ffffff'; cctx.fillRect(0, 0, sw, sh);
        cctx.drawImage(canvas, sx, sy, sw, sh, 0, 0, sw, sh);
        const blob: Blob | null = await new Promise(r => crop.toBlob(r, 'image/png'));
        if (!blob) throw new Error('Could not encode a PDF image');
        const prepared = await prepareImage(await blobToBase64(blob), 'image/png');
        out.push({ y: b.top, blob: prepared.blob, width: prepared.width, height: prepared.height, key: thumbKey(crop) });
      } catch (err: any) {
        fail(err?.message || 'unknown error');
      } finally { crop.width = 0; crop.height = 0; }
    }
  } catch (err: any) {
    fail(err?.message || 'could not render a PDF page');
  } finally { canvas.width = 0; canvas.height = 0; }
  return out;
}

/** Import PDF text, plain text, Markdown or HTML as protected, sanitized note parts.
 * PDF import extracts selectable text and detects headings from font size;
 * scanned pages require OCR and visual PDF page layout is not retained.
 * For original PDF layout, use the Books uploader.
 */
export async function convertAndProcessAdditionalNotes(file: File, subjectId?: string): Promise<ProcessedSubjectDocx> {
  if (!file.size || file.size > 60 * 1024 * 1024) throw Error('File must be between 1 byte and 60 MB.');
  const ext = (file.name.toLowerCase().split('.').pop() || '') as string;
  const escapeHtml = (value: string) => value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  let pages: string[] = [];
  let sourceFormat: ProcessedSubjectDocx['sourceFormat'] = 'html';
  let pdfHeadingsFound = false;
  const st: ImageImportState = { subjectId, seen: 0, saved: 0, failed: 0, skipped: 0, reasons: new Set(), cache: new Map() };
  if (ext === 'pdf') {
    sourceFormat = 'pdf';
    const { pdfjs, pdfOptions } = await import('../lib/pdf');
    const task = pdfjs.getDocument({ ...pdfOptions, data: new Uint8Array(await file.arrayBuffer()) });
    try {
      const doc = await task.promise;
      if (doc.numPages > 300) throw Error('PDF exceeds 300 pages; split it first.');
      const pageData: PdfPageData[] = [];
      for (let i = 1; i <= doc.numPages; i++) {
        const page = await doc.getPage(i);
        const content = await page.getTextContent();
        const lines = pdfLinesFromItems(content.items as any[]);
        let images: PdfImage[] = [];
        if (subjectId) {
          const textChars = lines.reduce((n, l) => n + l.text.length, 0);
          images = await extractPdfPageImages(pdfjs, page, textChars, MAX_IMAGES_PER_UPLOAD - st.seen, (r) => { st.failed++; st.reasons.add(r); });
          st.seen += images.length;
          if (st.seen >= MAX_IMAGES_PER_UPLOAD) st.reasons.add(`more than ${MAX_IMAGES_PER_UPLOAD} images`);
        }
        pageData.push({ lines, images });
        page.cleanup();
      }

      // A picture that shows up on 3+ pages (logo, header banner) is decoration — drop it.
      if (doc.numPages >= 3) {
        const pagesByKey = new Map<string, Set<number>>();
        pageData.forEach((p, pi) => p.images.forEach(im => {
          if (!pagesByKey.has(im.key)) pagesByKey.set(im.key, new Set());
          pagesByKey.get(im.key)!.add(pi);
        }));
        pageData.forEach(p => { p.images = p.images.filter(im => (pagesByKey.get(im.key)?.size || 0) < 3); });
      }
      // Upload the kept pictures one at a time, exactly like Word images.
      for (const p of pageData) for (const im of p.images) {
        try { im.src = await uploadNoteImage(subjectId!, im.blob); st.saved++; }
        catch (err: any) { st.failed++; st.reasons.add(err?.message || 'unknown error'); }
      }

      // Body text size = the font height carrying the most characters.
      const weight = new Map<number, number>();
      for (const { lines } of pageData) for (const l of lines) {
        const h = Math.round(l.height * 2) / 2;
        weight.set(h, (weight.get(h) || 0) + l.text.length);
      }
      let body = 0, best = -1;
      weight.forEach((w, h) => { if (w > best && h > 0) { best = w; body = h; } });
      const levelFor = (l: PdfLine): 2 | 3 | 4 | null => {
        if (!body || l.text.length > 120 || l.text.length < 2) return null;
        if (/^\d+$/.test(l.text) || /^page \d+( of \d+)?$/i.test(l.text)) return null; // page numbers
        const r = l.height / body;
        if (r >= 1.6) return 2;
        if (r >= 1.35) return 3;
        if (r >= 1.18) return 4;
        return null;
      };

      const built: { no: number; html: string }[] = [];
      pageData.forEach(({ lines, images }, idx) => {
        // Text lines and pictures in top-to-bottom reading order.
        type Item = { y: number; line?: PdfLine; img?: PdfImage };
        const items: Item[] = [
          ...lines.map(l => ({ y: l.y, line: l } as Item)),
          ...images.filter(im => im.src).map(im => ({ y: im.y, img: im } as Item)),
        ].sort((p, q) => q.y - p.y);
        if (!items.length) return;
        let html = '';
        let para: string[] = [];
        let prev: PdfLine | null = null;
        const flush = () => { if (para.length) html += `<p>${escapeHtml(para.join(' '))}</p>`; para = []; };
        for (const it of items) {
          if (it.img) {
            flush();
            const im = it.img;
            html += `<img src="${escapeHtml(im.src!)}" alt=""${im.width ? ` width="${im.width}"` : ''}${im.height ? ` height="${im.height}"` : ''}>`;
            prev = null;
            continue;
          }
          const l = it.line!;
          const level = levelFor(l);
          if (level) {
            flush();
            // Merge a heading that wraps over two lines of the same size.
            const last = html.match(/<h([234])>([^<]*)<\/h\1>$/);
            if (last && prev && Math.abs(prev.height - l.height) < 0.5 && Number(last[1]) === level && prev.y - l.y < l.height * 1.6) {
              html = html.slice(0, last.index) + `<h${level}>${last[2]} ${escapeHtml(l.text)}</h${level}>`;
            } else {
              html += `<h${level}>${escapeHtml(l.text)}</h${level}>`;
              pdfHeadingsFound = true;
            }
          } else {
            if (prev && prev.y - l.y > Math.max(prev.height, l.height) * 1.9) flush(); // blank-line gap = new paragraph
            para.push(l.text);
          }
          prev = l;
        }
        flush();
        if (html) built.push({ no: idx + 1, html });
      });
      // No real headings in the file: fall back to one section per page so the
      // notes still get a table of contents and clean part boundaries.
      pages = built.map(b => pdfHeadingsFound ? b.html : `<h2>Page ${b.no}</h2>${b.html}`);
    } finally { await task.destroy(); }
    if (!pages.length) throw Error('No selectable PDF text or images found. For scanned PDFs, use OCR first, or upload the original PDF under Books.');
  } else if (ext === 'txt' || ext === 'md') {
    sourceFormat = ext === 'md' ? 'md' : 'txt';
    const text = await file.text();
    if (!text.trim()) throw Error('Empty text file.');
    // Markdown pictures: ![alt](src "title") and raw <img src="..."> tags.
    const mdInline = (x: string) => {
      const re = /!\[([^\]]*)\]\(\s*<?([^)\s>]+)>?(?:\s+(?:"[^"]*"|'[^']*'))?\s*\)|<img\b[^>]*?\bsrc\s*=\s*["']([^"']+)["'][^>]*>/gi;
      let out = '', last = 0, m: RegExpExecArray | null;
      while ((m = re.exec(x))) {
        out += escapeHtml(x.slice(last, m.index)).replace(/\n/g, '<br>');
        const src = m[2] ?? m[3];
        const alt = m[1] ?? (m[0].match(/\balt\s*=\s*["']([^"']*)["']/i)?.[1] ?? '');
        out += `<img src="${escapeHtml(src)}" alt="${escapeHtml(alt)}">`;
        last = m.index + m[0].length;
      }
      return out + escapeHtml(x.slice(last)).replace(/\n/g, '<br>');
    };
    pages = text.split(/\n\s*\n/).map(x => x.trim()).filter(Boolean).map(x => {
      // Markdown headings: # → h2, ## → h3, ### and deeper → h4
      const m = ext === 'md' ? x.match(/^(#{1,6})\s+(.+)$/) : null;
      if (m && !m[2].includes('\n')) { const lvl = m[1].length === 1 ? 2 : m[1].length === 2 ? 3 : 4; return `<h${lvl}>${escapeHtml(m[2].trim())}</h${lvl}>`; }
      return `<p>${ext === 'md' ? mdInline(x) : escapeHtml(x).replace(/\n/g, '<br>')}</p>`;
    });
    if (ext === 'md') for (let i = 0; i < pages.length; i++) pages[i] = await embedHtmlImages(pages[i], st);
  } else if (ext === 'html' || ext === 'htm') {
    sourceFormat = 'html';
    const withImages = await embedHtmlImages(await file.text(), st);
    pages = [sanitizeSubjectHtml(withImages)];
  } else {
    throw Error('Unsupported notes format. Use DOCX, PDF, TXT, MD or HTML.');
  }

  // Give every heading a stable id and remember it for the table of contents.
  let headingCounter = 0;
  const blockHeadings: TocItem[][] = pages.map((block, bi) => {
    const dom = new DOMParser().parseFromString(block, 'text/html');
    const found: TocItem[] = [];
    dom.body.querySelectorAll('h2, h3, h4').forEach((hEl) => {
      headingCounter++;
      const text = hEl.textContent?.trim() || `Section ${headingCounter}`;
      const id = `s-${headingCounter}-${slugify(text) || `section-${headingCounter}`}`;
      hEl.setAttribute('id', id);
      found.push({ id, level: Number(hEl.tagName[1]) as 2 | 3 | 4, text, part: 0 });
    });
    if (found.length) pages[bi] = dom.body.innerHTML;
    return found;
  });

  const parts: SubjectPartData[] = [];
  const toc: TocItem[] = [];
  let buffer = '';
  pages.forEach((block, bi) => {
    // Keep markup intact. Large sanitized blocks remain whole and the existing
    // note-part size limit is enforced by the upload service.
    if (buffer && getUtf8Bytes(buffer + block) > 450000) {
      parts.push({partNumber: parts.length + 1, html: sanitizeSubjectHtml(buffer), sizeBytes: getUtf8Bytes(buffer)});
      buffer = '';
    }
    buffer += block;
    for (const h of blockHeadings[bi]) toc.push({ ...h, part: parts.length + 1 });
  });
  if (buffer) parts.push({partNumber: parts.length + 1, html: sanitizeSubjectHtml(buffer), sizeBytes: getUtf8Bytes(buffer)});
  const totalBytes = parts.reduce((n, part) => n + part.sizeBytes, 0);
  const pdfNoteParts: string[] = [];
  if (sourceFormat === 'pdf') {
    pdfNoteParts.push('PDF text was imported.');
    if (!subjectId) pdfNoteParts.push('Images were NOT imported because no subject is selected. Select the subject, then upload again.');
    else if (st.saved === 0 && st.failed === 0) pdfNoteParts.push('No embedded images were found.');
    if (st.failed > 0) pdfNoteParts.push(`${st.failed} image${st.failed > 1 ? 's' : ''} could not be saved (${Array.from(st.reasons).join('; ')}).`);
    else if (st.reasons.size) pdfNoteParts.push(`Some images were skipped (${Array.from(st.reasons).join('; ')}).`);
    if (!pdfHeadingsFound) pdfNoteParts.push('No headings were detected in the PDF, so sections are split by page.');
  }
  if (sourceFormat === 'md' || sourceFormat === 'html') {
    if (st.skipped > 0) pdfNoteParts.push(`${st.skipped} image${st.skipped > 1 ? 's were' : ' was'} NOT imported because no subject is selected. Select the subject, then upload again.`);
    if (st.failed > 0) pdfNoteParts.push(`${st.failed} image${st.failed > 1 ? 's' : ''} could not be imported (${Array.from(st.reasons).join('; ')}).`);
  }
  const pdfNote = pdfNoteParts.length ? pdfNoteParts.join(' ') : null;
  return {parts, toc, totalBytes, totalSizeKb: Math.ceil(totalBytes / 1024), partCount: parts.length,
    headingCount: toc.length, imageNotice: pdfNote,
    imageCount: st.saved, imagesFailed: st.failed + st.skipped, hasNoH1: !toc.some(t => t.level === 2), sourceFormat, firstPartHtml: parts[0]?.html || ''};
}
