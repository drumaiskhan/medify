// Administrative curriculum / notes deletion. All related database records are
// removed in one transaction, so students never see partially deleted notes.
const { fail } = require('./security');
const ALLOWED = new Set(['year', 'block', 'subject', 'note']);
const RECORD_ID = /^[A-Za-z0-9][A-Za-z0-9_.-]{0,249}$/;

function installAdminContent(app, pool) {
  app.post('/api/admin/content/delete', async (req, res, next) => {
    const db = await pool.connect();
    try {
      if (req.user?.role !== 'admin') fail(403, 'Administrator required');
      const { kind, id } = req.body || {};
      if (!ALLOWED.has(kind) || typeof id !== 'string' || !RECORD_ID.test(id))
        fail(400, 'Invalid content reference');
      const collection = { year: 'years', block: 'blocks', subject: 'subjects', note: 'subjects' }[kind];
      await db.query('BEGIN');
      const found = (await db.query('SELECT data FROM records WHERE collection=$1 AND id=$2 FOR UPDATE', [collection, id])).rows[0];
      if (!found) fail(404, 'Content not found');

      // Books are separate physical files. Require admins to remove books from
      // the book manager before removing a year, to avoid orphaned uploads.
      if (kind === 'year') {
        const count = (await db.query('SELECT count(*)::int AS n FROM books WHERE year_id=$1', [id])).rows[0].n;
        if (count > 0) fail(409, `Delete the ${count} books assigned to this year in Book library first.`);
      }
      const blockIds = [];
      const subjectIds = [];
      const chapterIds = [];
      if (kind === 'year') {
        const blocks = await db.query("SELECT id FROM records WHERE collection='blocks' AND data->>'yearId'=$1", [id]);
        blockIds.push(...blocks.rows.map(row => row.id));
      } else if (kind === 'block') blockIds.push(id);

      if (kind === 'subject' || kind === 'note') subjectIds.push(id);
      else if (kind === 'year' || kind === 'block') {
        const subjects = await db.query("SELECT id FROM records WHERE collection='subjects' AND (data->>'blockId'=ANY($1::text[]) OR ($2::text IS NOT NULL AND data->>'yearId'=$2))", [blockIds, kind === 'year' ? id : null]);
        subjectIds.push(...subjects.rows.map(row => row.id));
      }
      if (kind === 'year' || kind === 'block' || kind === 'subject') {
        const chapters = await db.query("SELECT id FROM records WHERE collection='chapters' AND (data->>'subjectId'=ANY($1::text[]) OR data->>'blockId'=ANY($2::text[]) OR ($3::text IS NOT NULL AND data->>'yearId'=$3))", [subjectIds, blockIds, kind === 'year' ? id : null]);
        chapterIds.push(...chapters.rows.map(row => row.id));
      }
      // Notes-only deletion keeps its subject and module available for re-upload.
      if (subjectIds.length) {
        await db.query("DELETE FROM records WHERE collection='subjectParts' AND data->>'subjectId'=ANY($1::text[])", [subjectIds]);
        await db.query("DELETE FROM records WHERE collection='subjectContent' AND id=ANY($1::text[])", [subjectIds]);
        await db.query('DELETE FROM note_state WHERE subject_id=ANY($1::text[])', [subjectIds]);
      }
      if (chapterIds.length) {
        await db.query("DELETE FROM records WHERE collection='chapterContent' AND id=ANY($1::text[])", [chapterIds]);
        await db.query("DELETE FROM records WHERE collection='chapters' AND id=ANY($1::text[])", [chapterIds]);
        await db.query('DELETE FROM note_state WHERE subject_id=ANY($1::text[])', [chapterIds]);
      }
      if (kind !== 'note') {
        if (subjectIds.length) await db.query("DELETE FROM records WHERE collection='subjects' AND id=ANY($1::text[])", [subjectIds]);
        if (blockIds.length) await db.query("DELETE FROM records WHERE collection='blocks' AND id=ANY($1::text[])", [blockIds]);
        if (kind === 'year') await db.query("DELETE FROM records WHERE collection='years' AND id=$1", [id]);
      }
      await db.query('COMMIT');
      res.json({ ok: true, removed: { kind, id, blocks: blockIds.length, subjects: subjectIds.length, chapters: chapterIds.length } });
    } catch (err) {
      await db.query('ROLLBACK').catch(() => {});
      next(err);
    } finally { db.release(); }
  });
  // Student deletion is a separately confirmed admin action. Auth accounts
  // cascade to sessions, notifications, feedback, marks and redemptions.
  app.post('/api/admin/student/delete', async (req, res, next) => {
    if (req.user?.role !== 'admin') return next(Object.assign(new Error('Administrator required'), { status: 403 }));
    const id = req.body?.id;
    if (typeof id !== 'string' || !RECORD_ID.test(id) || id === req.user.id)
      return next(Object.assign(new Error('Invalid student reference'), { status: 400 }));
    const db = await pool.connect();
    let proofs = [];
    try {
      await db.query('BEGIN');
      const user = (await db.query("SELECT id FROM accounts WHERE id=$1 AND role='student' FOR UPDATE", [id])).rows[0];
      if (!user) fail(404, 'Student not found');
      const payments = (await db.query("SELECT id,data FROM records WHERE collection='paymentRequests' AND data->>'userId'=$1", [id])).rows;
      const coupons = require('./coupons');
      for (const payment of payments) {
        await coupons.release(db, payment.id);
        if (payment.data?.proofFile && /^[a-f0-9-]+\.proof$/.test(payment.data.proofFile)) proofs.push(payment.data.proofFile);
      }
      await db.query("DELETE FROM records WHERE collection='paymentRequests' AND data->>'userId'=$1", [id]);
      await db.query("DELETE FROM records WHERE collection='users' AND id=$1", [id]);
      await db.query('DELETE FROM accounts WHERE id=$1', [id]);
      await db.query('COMMIT');
      const fs = require('node:fs/promises');
      const path = require('node:path');
      const dir = require('./payment-proof').proofTools().root;
      for (const file of proofs) await fs.unlink(path.join(dir, file)).catch(() => {});
      res.json({ ok: true });
    } catch (err) { await db.query('ROLLBACK').catch(() => {}); next(err); }
    finally { db.release(); }
  });

  // Pending/rejected payment requests can be deleted; verified payments are
  // deliberately retained as an audit record and entitlement evidence.
  app.post('/api/admin/payment/delete', async (req, res, next) => {
    if (req.user?.role !== 'admin') return next(Object.assign(new Error('Administrator required'), { status: 403 }));
    const id = req.body?.id;
    if (typeof id !== 'string' || !id || id.length > 250)
      return next(Object.assign(new Error('Invalid payment reference'), { status: 400 }));
    const db = await pool.connect();
    let proof = null;
    try {
      await db.query('BEGIN');
      const row = (await db.query("SELECT data FROM records WHERE collection='paymentRequests' AND id=$1 FOR UPDATE", [id])).rows[0];
      if (!row) fail(404, 'Payment not found');
      if (row.data.status === 'VERIFIED') fail(409, 'Verified payments must be kept as entitlement and accounting records.');
      await require('./coupons').release(db, id);
      await db.query("DELETE FROM records WHERE collection='paymentRequests' AND id=$1", [id]);
      proof = /^[a-f0-9-]+\.proof$/.test(row.data.proofFile || '') ? row.data.proofFile : null;
      await db.query('COMMIT');
      if (proof) {
        const fs = require('node:fs/promises');
        const path = require('node:path');
        await fs.unlink(path.join(require('./payment-proof').proofTools().root, proof)).catch(() => {});
      }
      res.json({ ok: true });
    } catch (err) { await db.query('ROLLBACK').catch(() => {}); next(err); }
    finally { db.release(); }
  });

}
module.exports = { installAdminContent };
