import {
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  updateDoc,
  query,
  where,
  serverTimestamp,
  writeBatch
} from '../lib/data';
import { db } from '../lib/client';
import { TocItem, SubjectPartData } from '../utils/docxProcessor';

export interface YearDoc {
  id: string;
  name: string;
  status: 'available' | 'coming-soon';
  order: number;
  published: boolean;
  updatedAt?: any;
}

export interface BlockDoc {
  id: string;
  yearId: string;
  name: string;
  order: number;
  published: boolean;
  updatedAt?: any;
}

export interface SubjectDoc {
  id: string;
  blockId: string;
  yearId: string;
  name: string;
  order: number;
  published: boolean;
  isFreeSample?: boolean;
  updatedAt?: any;
}

export interface ChapterDoc {
  id: string;
  subjectId: string;
  blockId: string;
  yearId: string;
  title: string;
  isFreeSample: boolean;
  order: number;
  published: boolean;
  updatedAt?: any;
}

/**
 * Standard readable slug generator for document IDs.
 * Converts "5th Year MBBS" -> "5th-year-mbbs", "Cardio System" -> "cardio-system".
 */
export function slugify(text: string): string {
  return text
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, '')
    .replace(/[\s_-]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

// =========================================================================
// STUDENT-FACING QUERIES (MUST include where("published", "==", true))
// =========================================================================

/**
 * Fetch all published years sorted by order
 */
export async function getPublishedYears(): Promise<YearDoc[]> {
  const q = query(collection(db, 'years'), where('published', '==', true));
  const snap = await getDocs(q);
  const years: YearDoc[] = snap.docs.map((d) => ({
    id: d.id,
    ...(d.data() as Omit<YearDoc, 'id'>)
  }));
  return years.sort((a, b) => a.order - b.order);
}

/**
 * Fetch a single published year by ID
 */
export async function getPublishedYearById(yearId: string): Promise<YearDoc | null> {
  const targetId = yearId === '5th-year' ? 'final-year' : yearId;
  const dRef = doc(db, 'years', targetId);
  const snap = await getDoc(dRef);
  if (!snap.exists()) return null;
  const data = snap.data() as Omit<YearDoc, 'id'>;
  if (!data.published) return null;
  return { id: snap.id, ...data };
}

/**
 * Fetch all published blocks for a specific year
 */
export async function getPublishedBlocksForYear(yearId: string): Promise<BlockDoc[]> {
  const targetId = yearId === '5th-year' ? 'final-year' : yearId;
  const q = query(
    collection(db, 'blocks'),
    where('published', '==', true),
    where('yearId', '==', targetId)
  );
  const snap = await getDocs(q);
  const blocks: BlockDoc[] = snap.docs.map((d) => ({
    id: d.id,
    ...(d.data() as Omit<BlockDoc, 'id'>)
  }));
  return blocks.sort((a, b) => a.order - b.order);
}

/**
 * Fetch all published blocks across all years (e.g. for homepage preview)
 */
export async function getAllPublishedBlocks(): Promise<BlockDoc[]> {
  const q = query(collection(db, 'blocks'), where('published', '==', true));
  const snap = await getDocs(q);
  const blocks: BlockDoc[] = snap.docs.map((d) => ({
    id: d.id,
    ...(d.data() as Omit<BlockDoc, 'id'>)
  }));
  return blocks.sort((a, b) => a.order - b.order);
}

/**
 * Fetch a published block by ID
 */
export async function getPublishedBlockById(blockId: string): Promise<BlockDoc | null> {
  const dRef = doc(db, 'blocks', blockId);
  const snap = await getDoc(dRef);
  if (!snap.exists()) return null;
  const data = snap.data() as Omit<BlockDoc, 'id'>;
  if (!data.published) return null;
  return { id: snap.id, ...data };
}

/**
 * Fetch all published subjects for a specific block
 */
export async function getPublishedSubjectsForBlock(blockId: string): Promise<SubjectDoc[]> {
  const q = query(
    collection(db, 'subjects'),
    where('published', '==', true),
    where('blockId', '==', blockId)
  );
  const snap = await getDocs(q);
  const subjects: SubjectDoc[] = snap.docs.map((d) => ({
    id: d.id,
    ...(d.data() as Omit<SubjectDoc, 'id'>)
  }));
  return subjects.sort((a, b) => a.order - b.order);
}

/**
 * Fetch every published subject (notes) across all modules, e.g. for the homepage
 */
export async function getAllPublishedSubjects(): Promise<SubjectDoc[]> {
  const q = query(collection(db, 'subjects'), where('published', '==', true));
  const snap = await getDocs(q);
  const subjects: SubjectDoc[] = snap.docs.map((d) => ({
    id: d.id,
    ...(d.data() as Omit<SubjectDoc, 'id'>)
  }));
  return subjects.sort((a, b) => a.order - b.order);
}

/**
 * Fetch a single published subject by ID
 */
export async function getPublishedSubjectById(subjectId: string): Promise<SubjectDoc | null> {
  const dRef = doc(db, 'subjects', subjectId);
  const snap = await getDoc(dRef);
  if (!snap.exists()) return null;
  const data = snap.data() as Omit<SubjectDoc, 'id'>;
  return { id: snap.id, ...data };
}

/**
 * Get the first published subject marked as a free sample (for Homepage "Preview Sample" button).
 * Uses simple filters without composite indexes and sorts in-memory.
 */
export async function getFirstFreeSampleSubject(): Promise<SubjectDoc | null> {
  try {
    const q = query(
      collection(db, 'subjects'),
      where('published', '==', true),
      where('isFreeSample', '==', true)
    );
    const snap = await getDocs(q);
    if (snap.empty) {
      return null;
    }
    const subjects: SubjectDoc[] = snap.docs.map((d) => ({
      id: d.id,
      ...(d.data() as Omit<SubjectDoc, 'id'>)
    }));
    subjects.sort((a, b) => a.order - b.order);
    return subjects[0] || null;
  } catch (err) {
    console.warn('Failed to query first free sample subject:', err);
    return null;
  }
}

/**
 * Legacy chapter query preserved for backwards compatibility
 */
export async function getPublishedChaptersForBlock(blockId: string): Promise<ChapterDoc[]> {
  try {
    const q = query(
      collection(db, 'chapters'),
      where('published', '==', true),
      where('blockId', '==', blockId)
    );
    const snap = await getDocs(q);
    const chapters: ChapterDoc[] = snap.docs.map((d) => ({
      id: d.id,
      ...(d.data() as Omit<ChapterDoc, 'id'>)
    }));
    return chapters.sort((a, b) => a.order - b.order);
  } catch {
    return [];
  }
}

// =========================================================================
// ADMIN QUERIES & MUTATIONS
// =========================================================================

export async function getAllYearsAdmin(): Promise<YearDoc[]> {
  const snap = await getDocs(collection(db, 'years'));
  const years: YearDoc[] = snap.docs.map((d) => ({
    id: d.id,
    ...(d.data() as Omit<YearDoc, 'id'>)
  }));
  return years.sort((a, b) => a.order - b.order);
}

export async function getAllBlocksAdmin(): Promise<BlockDoc[]> {
  const snap = await getDocs(collection(db, 'blocks'));
  const blocks: BlockDoc[] = snap.docs.map((d) => ({
    id: d.id,
    ...(d.data() as Omit<BlockDoc, 'id'>)
  }));
  return blocks.sort((a, b) => a.order - b.order);
}

export async function getAllSubjectsAdmin(): Promise<SubjectDoc[]> {
  const snap = await getDocs(collection(db, 'subjects'));
  const subjects: SubjectDoc[] = snap.docs.map((d) => ({
    id: d.id,
    ...(d.data() as Omit<SubjectDoc, 'id'>)
  }));
  return subjects.sort((a, b) => a.order - b.order);
}

/**
 * Create a new Year with a readable slug ID.
 * Rejects if document with that ID already exists.
 */
export async function createYear(data: {
  name: string;
  status: 'available' | 'coming-soon';
  order: number;
  published: boolean;
}): Promise<string> {
  const slug = slugify(data.name);
  if (!slug) {
    throw new Error('Please enter a valid year name.');
  }

  const yearRef = doc(db, 'years', slug);
  const snap = await getDoc(yearRef);
  if (snap.exists()) {
    throw new Error(`A year with ID "${slug}" already exists. Please choose a distinct name.`);
  }

  await setDoc(yearRef, {
    name: data.name.trim(),
    status: data.status,
    order: Number(data.order),
    published: Boolean(data.published),
    updatedAt: serverTimestamp()
  });

  return slug;
}

/**
 * Update flags on an existing subject directly
 */
export async function updateSubjectFlags(
  subjectId: string,
  flags: { published?: boolean; isFreeSample?: boolean }
): Promise<void> {
  const ref = doc(db, 'subjects', subjectId);
  const data: Record<string, any> = { updatedAt: serverTimestamp() };
  if (typeof flags.published === 'boolean') {
    data.published = flags.published;
  }
  if (typeof flags.isFreeSample === 'boolean') {
    data.isFreeSample = flags.isFreeSample;
  }
  await updateDoc(ref, data);
}

/**
 * Rename a module (a block) or show/hide it for students.
 * Notes inside a hidden module stay saved but students cannot open them.
 */
export async function updateBlock(
  blockId: string,
  changes: { name?: string; published?: boolean }
): Promise<void> {
  const data: Record<string, any> = { updatedAt: serverTimestamp() };
  if (typeof changes.name === 'string') {
    const name = changes.name.trim();
    if (!name) throw new Error('Module name cannot be empty.');
    data.name = name;
  }
  if (typeof changes.published === 'boolean') {
    data.published = changes.published;
  }
  await updateDoc(doc(db, 'blocks', blockId), data);
}

/**
 * Rename a note (a subject). Used to keep a module's single note named like its module.
 */
export async function renameSubject(subjectId: string, name: string): Promise<void> {
  const clean = name.trim();
  if (!clean) throw new Error('Name cannot be empty.');
  await updateDoc(doc(db, 'subjects', subjectId), { name: clean, updatedAt: serverTimestamp() });
}

export interface SaveSubjectNoteParams {
  yearId: string;
  // Block
  blockId?: string;
  newBlockName?: string;
  // Subject
  subjectId?: string;
  newSubjectName?: string;
  // Subject flags
  published: boolean;
  isFreeSample: boolean;
  // Parts and TOC
  parts: SubjectPartData[];
  toc: TocItem[];
  totalBytes: number;
  oldPartCount?: number;
}

/**
 * Atomically saves a full subject note and any newly typed hierarchy items (Block, Subject).
 * Splits writes into batches of at most 400 operations.
 * If saving over an existing subject note, deletes excess old parts (part > new partCount).
 */
export async function saveSubjectNoteWithHierarchy(params: SaveSubjectNoteParams): Promise<{
  yearId: string;
  blockId: string;
  subjectId: string;
  isNewBlock: boolean;
  isNewSubject: boolean;
  partCount: number;
}> {
  let isNewBlock = false;
  let isNewSubject = false;

  // 1. Resolve Block
  let finalBlockId = params.blockId;
  if (!finalBlockId || finalBlockId === '__new__') {
    if (!params.newBlockName?.trim()) {
      throw new Error('Block name is required.');
    }
    const slug = slugify(params.newBlockName.trim());
    if (!slug) throw new Error('Invalid block name for slug ID generation.');
    finalBlockId = `${params.yearId}-${slug}`;

    const bRef = doc(db, 'blocks', finalBlockId);
    const bSnap = await getDoc(bRef);
    if (!bSnap.exists()) {
      const existingBlocksSnap = await getDocs(
        query(collection(db, 'blocks'), where('yearId', '==', params.yearId))
      );
      let maxOrder = 0;
      existingBlocksSnap.docs.forEach((d) => {
        const o = Number(d.data().order) || 0;
        if (o > maxOrder) maxOrder = o;
      });
      await setDoc(bRef, {
        yearId: params.yearId,
        name: params.newBlockName.trim(),
        order: maxOrder + 1,
        published: true,
        updatedAt: serverTimestamp()
      });
      isNewBlock = true;
    }
  }

  // 2. Resolve Subject
  let finalSubjectId = params.subjectId;
  if (!finalSubjectId || finalSubjectId === '__new__') {
    if (!params.newSubjectName?.trim()) {
      throw new Error('Subject name is required.');
    }
    const slug = slugify(params.newSubjectName.trim());
    if (!slug) throw new Error('Invalid subject name for slug ID generation.');
    finalSubjectId = `${finalBlockId}-${slug}`;

    const sRef = doc(db, 'subjects', finalSubjectId);
    const sSnap = await getDoc(sRef);
    if (!sSnap.exists()) {
      const existingSubjSnap = await getDocs(
        query(collection(db, 'subjects'), where('blockId', '==', finalBlockId))
      );
      let maxOrder = 0;
      existingSubjSnap.docs.forEach((d) => {
        const o = Number(d.data().order) || 0;
        if (o > maxOrder) maxOrder = o;
      });
      await setDoc(sRef, {
        blockId: finalBlockId,
        yearId: params.yearId,
        name: params.newSubjectName.trim(),
        order: maxOrder + 1,
        isFreeSample: Boolean(params.isFreeSample),
        published: Boolean(params.published),
        updatedAt: serverTimestamp()
      });
      isNewSubject = true;
    } else {
      await updateDoc(sRef, {
        isFreeSample: Boolean(params.isFreeSample),
        published: Boolean(params.published),
        updatedAt: serverTimestamp()
      });
    }
  } else {
    const sRef = doc(db, 'subjects', finalSubjectId);
    await updateDoc(sRef, {
      isFreeSample: Boolean(params.isFreeSample),
      published: Boolean(params.published),
      updatedAt: serverTimestamp()
    });
  }

  // 3. Prepare operations list:
  // - subjectContent/{subjectId}
  // - subjectParts/{subjectId}_{partNumber} for part 1..N
  // - delete excess parts {subjectId}_{k} if oldPartCount > newPartCount
  type BatchOp =
    | { type: 'set'; ref: any; data: any }
    | { type: 'delete'; ref: any };

  const ops: BatchOp[] = [];

  // Content metadata doc
  const contentRef = doc(db, 'subjectContent', finalSubjectId);
  ops.push({
    type: 'set',
    ref: contentRef,
    data: {
      partCount: params.parts.length,
      toc: params.toc,
      totalBytes: params.totalBytes,
      updatedAt: serverTimestamp()
    }
  });

  // Each part doc
  params.parts.forEach((p) => {
    const partRef = doc(db, 'subjectParts', `${finalSubjectId}_${p.partNumber}`);
    ops.push({
      type: 'set',
      ref: partRef,
      data: {
        subjectId: finalSubjectId,
        partNumber: p.partNumber,
        html: p.html,
        sizeBytes: p.sizeBytes,
        updatedAt: serverTimestamp()
      }
    });
  });

  // Delete excess parts if oldPartCount was higher than new parts count
  if (params.oldPartCount && params.oldPartCount > params.parts.length) {
    for (let k = params.parts.length + 1; k <= params.oldPartCount; k++) {
      const excessPartRef = doc(db, 'subjectParts', `${finalSubjectId}_${k}`);
      ops.push({
        type: 'delete',
        ref: excessPartRef
      });
    }
  }

  // 4. Commit operations in batches of at most 400 operations
  const BATCH_SIZE = 400;
  for (let i = 0; i < ops.length; i += BATCH_SIZE) {
    const chunk = ops.slice(i, i + BATCH_SIZE);
    const batch = writeBatch(db);
    chunk.forEach((op) => {
      if (op.type === 'set') {
        batch.set(op.ref, op.data);
      } else if (op.type === 'delete') {
        batch.delete(op.ref);
      }
    });
    await batch.commit();
  }

  return {
    yearId: params.yearId,
    blockId: finalBlockId,
    subjectId: finalSubjectId,
    isNewBlock,
    isNewSubject,
    partCount: params.parts.length
  };
}
