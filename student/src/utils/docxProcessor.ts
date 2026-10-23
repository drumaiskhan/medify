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
