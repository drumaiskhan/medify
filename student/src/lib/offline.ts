// Offline reading support. Notes the student has opened are kept on their own device
// so they can study without internet. Access still ends with the subscription:
//  - offline use requires a recent online check-in (the "lease", 7 days), and
//  - saved paid notes are only readable while the cached subscription is unexpired.
// Same name as utils/noteImages (duplicated to avoid an import cycle with the API client).
const NOTE_IMAGE_CACHE = 'medify-note-images-v1';

const DB_NAME = 'medify-offline';
const STORE = 'kv';
const LEASE_KEY = 'medify-lease';
const USER_KEY = 'medify-last-user';
export const LEASE_MS = 7 * 24 * 60 * 60 * 1000;

const CACHEABLE = new Set([
  'years', 'blocks', 'subjects', 'chapters', 'subjectContent', 'subjectParts', 'users'
]);
const LISTABLE = new Set(['years', 'blocks', 'subjects', 'chapters']);

function open(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(STORE);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}
async function kvGet<T = any>(key: string): Promise<T | undefined> {
  try {
    const db = await open();
    return await new Promise((resolve, reject) => {
      const r = db.transaction(STORE).objectStore(STORE).get(key);
      r.onsuccess = () => resolve(r.result as T | undefined);
      r.onerror = () => reject(r.error);
    });
  } catch {
    return undefined;
  }
}
async function kvSet(key: string, value: unknown): Promise<void> {
  try {
    const db = await open();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE, 'readwrite');
      tx.objectStore(STORE).put(value, key);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } catch {
    /* private mode or storage full: offline copy is simply skipped */
  }
}

export function markLease(user: { uid: string; [k: string]: any }) {
  try {
    localStorage.setItem(LEASE_KEY, JSON.stringify({ uid: user.uid, at: Date.now() }));
    localStorage.setItem(USER_KEY, JSON.stringify(user));
  } catch { /* ignore */ }
}
export function cachedUser(): any | null {
  try {
    const lease = JSON.parse(localStorage.getItem(LEASE_KEY) || 'null');
    const user = JSON.parse(localStorage.getItem(USER_KEY) || 'null');
    if (!lease || !user || lease.uid !== user.uid) return null;
    return Date.now() - lease.at < LEASE_MS ? user : null;
  } catch {
    return null;
  }
}
export const leaseValid = () => cachedUser() !== null;

/** Removes every saved note, image and sign-in hint from this device (used on logout). */
export async function clearOffline() {
  try { localStorage.removeItem(LEASE_KEY); localStorage.removeItem(USER_KEY); } catch { /* ignore */ }
  try {
    Object.keys(localStorage)
      .filter((k) => k.startsWith('medify-notes-'))
      .forEach((k) => localStorage.removeItem(k));
  } catch { /* ignore */ }
  try { indexedDB.deleteDatabase(DB_NAME); } catch { /* ignore */ }
  try { if ('caches' in window) await caches.delete(NOTE_IMAGE_CACHE); } catch { /* ignore */ }
}

type Ref = { collection: string; id?: string; filters?: any[] };
const docKey = (r: Ref) => `doc:${r.collection}/${r.id}`;
const listKey = (r: Ref) => `q:${JSON.stringify([r.collection, r.filters || []])}`;

export function canCacheDoc(ref: Ref, uid?: string): boolean {
  if (!CACHEABLE.has(ref.collection) || !ref.id) return false;
  return ref.collection !== 'users' || ref.id === uid;
}
export const canCacheList = (ref: Ref) => LISTABLE.has(ref.collection);

export function storeDoc(ref: Ref, res: any, uid?: string) {
  if (canCacheDoc(ref, uid) && res?.data) void kvSet(docKey(ref), res);
}
export function storeList(ref: Ref, rows: any[]) {
  if (canCacheList(ref)) void kvSet(listKey(ref), rows);
}

// Kept local (not imported) to avoid a circular import with the data layer.
function extractYearOrdinal(text?: string | null): string | null {
  const t = (text || '').toLowerCase().trim();
  if (!t) return null;
  if (/final|fifth|5th|year[ -]?5/.test(t) || t.startsWith('5')) return 'final';
  if (/4th|fourth|year[ -]?4/.test(t) || t.startsWith('4')) return '4';
  if (/3rd|third|year[ -]?3/.test(t) || t.startsWith('3')) return '3';
  if (/2nd|second|year[ -]?2/.test(t) || t.startsWith('2')) return '2';
  if (/1st|first|year[ -]?1/.test(t) || t.startsWith('1')) return '1';
  return null;
}
const sameYear = (a?: string, b?: string) => {
  if (!a || !b) return false;
  if (a.toLowerCase() === b.toLowerCase()) return true;
  const x = extractYearOrdinal(a);
  return !!x && x === extractYearOrdinal(b);
};

async function paidAccessStillValid(subjectId: string): Promise<boolean> {
  const subject = await kvGet(`doc:subjects/${subjectId}`);
  if (!subject?.data) return false;
  if (subject.data.isFreeSample === true) return true;
  const uid = cachedUser()?.uid;
  const profile = uid ? await kvGet(`doc:users/${uid}`) : undefined;
  const years: any[] = profile?.data?.access?.years || [];
  const now = Date.now() / 1000;
  return years.some((y) => y.expiresAt > now && sameYear(y.yearId, subject.data.yearId));
}

/** Saved copy of a record, only if the student is still allowed to read it offline. */
export async function offlineDoc(ref: Ref): Promise<any | null> {
  if (!leaseValid() || !ref.id) return null;
  const res = await kvGet(docKey(ref));
  if (!res) return null;
  if (ref.collection === 'subjectContent' || ref.collection === 'subjectParts') {
    const subjectId = ref.collection === 'subjectParts' ? res.data?.subjectId : ref.id;
    if (!subjectId || !(await paidAccessStillValid(subjectId))) return null;
  }
  return res;
}
export async function offlineList(ref: Ref): Promise<any[] | null> {
  if (!leaseValid()) return null;
  return (await kvGet(listKey(ref))) || null;
}
