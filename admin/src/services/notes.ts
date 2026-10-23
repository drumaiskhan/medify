import {
  doc,
  getDoc,
  Timestamp
} from '../lib/data';
import { db } from '../lib/client';
import { TocItem } from '../utils/docxProcessor';
import {
  sanitizeSubjectHtml,
  prepareHtmlForReader,
  ALLOWED_TAGS,
  ALLOWED_ATTR
} from '../utils/docxProcessor';

export interface SubjectContentDoc {
  id: string;
  partCount: number;
  toc: TocItem[];
  totalBytes: number;
  updatedAt?: Timestamp | null;
}

export interface SubjectPartDoc {
  id: string;
  subjectId: string;
  partNumber: number;
  html: string;
  sizeBytes: number;
  updatedAt?: Timestamp | null;
}

export { ALLOWED_TAGS as ALLOWED_NOTE_TAGS, ALLOWED_ATTR as ALLOWED_NOTE_ATTR };

/**
 * Sanitise HTML using DOMPurify with strict medical note whitelist.
 */
export function sanitizeNoteHtml(rawHtml: string): string {
  return sanitizeSubjectHtml(rawHtml);
}

/**
 * Legacy helper for single-string note rendering with responsive table wrapper
 */
export function processNoteForReader(rawHtml: string): {
  html: string;
  headings: { id: string; text: string; level: 2 | 3 }[];
} {
  const prepared = prepareHtmlForReader(rawHtml);
  if (!prepared || typeof window === 'undefined') {
    return { html: prepared, headings: [] };
  }

  try {
    const parser = new DOMParser();
    const doc = parser.parseFromString(prepared, 'text/html');
    const headings: { id: string; text: string; level: 2 | 3 }[] = [];

    const headingElements = doc.body.querySelectorAll('h2, h3');
    headingElements.forEach((el, index) => {
      const text = el.textContent?.trim() || '';
      if (!text) return;

      const level = el.tagName.toLowerCase() === 'h2' ? 2 : 3;
      const currentId = el.getAttribute('id');
      const uniqueId = currentId && currentId.trim().length > 0 ? currentId : `heading-${index + 1}`;
      el.setAttribute('id', uniqueId);

      headings.push({
        id: uniqueId,
        text,
        level
      });
    });

    return {
      html: doc.body.innerHTML,
      headings
    };
  } catch {
    return { html: prepared, headings: [] };
  }
}

/**
 * Fetch subject content metadata for a given subjectId
 */
export async function getSubjectContent(subjectId: string): Promise<SubjectContentDoc | null> {
  const ref = doc(db, 'subjectContent', subjectId);
  const snap = await getDoc(ref);
  if (!snap.exists()) {
    return null;
  }
  const data = snap.data();
  return {
    id: snap.id,
    partCount: Number(data.partCount || 0),
    toc: (data.toc || []) as TocItem[],
    totalBytes: Number(data.totalBytes || 0),
    updatedAt: data.updatedAt || null
  };
}

/**
 * Fetch a specific part for a subject using direct document getDoc
 * (NEVER collection queries, per specification)
 */
export async function getSubjectPart(
  subjectId: string,
  partNumber: number
): Promise<SubjectPartDoc | null> {
  const ref = doc(db, 'subjectParts', `${subjectId}_${partNumber}`);
  const snap = await getDoc(ref);
  if (!snap.exists()) {
    return null;
  }
  const data = snap.data();
  return {
    id: snap.id,
    subjectId: data.subjectId || subjectId,
    partNumber: Number(data.partNumber || partNumber),
    html: data.html || '',
    sizeBytes: Number(data.sizeBytes || 0),
    updatedAt: data.updatedAt || null
  };
}

/**
 * Legacy chapter content reader helper (preserved for backwards compatibility)
 */
export async function getChapterContent(chapterId: string): Promise<{
  id: string;
  html: string;
  sizeBytes: number;
  updatedAt?: Timestamp | null;
} | null> {
  try {
    const ref = doc(db, 'chapterContent', chapterId);
    const snap = await getDoc(ref);
    if (!snap.exists()) {
      return null;
    }
    const data = snap.data();
    return {
      id: snap.id,
      html: data.html || '',
      sizeBytes: Number(data.sizeBytes || 0),
      updatedAt: data.updatedAt || null
    };
  } catch {
    return null;
  }
}
