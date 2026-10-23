// Note images (private, access-checked) and per-student reading state.
const fs = require("node:fs/promises");
const path = require("node:path");
const crypto = require("node:crypto");
const multer = require("multer");
const { fail } = require("./security");
const records = require("./data");

const MIME = { webp: "image/webp", png: "image/png", jpg: "image/jpeg" };
const COLORS = new Set(["yellow", "green", "pink", "blue"]);
const FILE = /^[a-f0-9]{64}\.(webp|png|jpg)$/;
const safeId = (s) =>
  typeof s === "string" &&
  /^[A-Za-z0-9][A-Za-z0-9_.-]{0,199}$/.test(s) &&
  !s.includes("..");

function imageKind(buf) {
  if (buf.length < 12) return null;
  if (buf[0] === 0x89 && buf.toString("latin1", 1, 4) === "PNG") return "png";
  if (buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return "jpg";
  if (
    buf.toString("latin1", 0, 4) === "RIFF" &&
    buf.toString("latin1", 8, 12) === "WEBP"
  )
    return "webp";
  return null;
}

function cleanState(body) {
  const list = Array.isArray(body?.highlights) ? body.highlights : [];
  if (list.length > 2000) fail(400, "Too many highlights");
  const highlights = list.map((h) => {
    const start = Number(h?.start);
    const end = Number(h?.end);
    if (
      !safeId(h?.id) ||
      !Number.isInteger(start) ||
      !Number.isInteger(end) ||
      start < 0 ||
      end <= start ||
      !COLORS.has(h?.color)
    )
      fail(400, "Invalid highlight");
    return {
      id: h.id,
      start,
      end,
      color: h.color,
      text: String(h.text || "").slice(0, 160),
      at: Number.isFinite(Number(h.at)) ? Number(h.at) : 0,
    };
  });
  const pos = body?.position;
  const position =
    pos && typeof pos === "object"
      ? {
          headingId: String(pos.headingId || "").slice(0, 200),
          scroll: Math.max(0, Math.min(1, Number(pos.scroll) || 0)),
        }
      : null;
  return { highlights, position };
}

function installNotes(app, pool) {
  const root = path.join(require("./storage").storageRoot(), "note-images");
  const wrap = (fn) => (req, res, next) =>
    Promise.resolve(fn(req, res)).catch(next);
  const receive = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 4 * 1024 * 1024, files: 1, fields: 5, fieldSize: 1000 },
  }).single("image");

  // Administrator uploads one already-compressed image for a subject.
  app.post(
    "/api/note-images",
    (req, res, next) => {
      if (req.user?.role !== "admin")
        return res.status(403).json({ error: "Administrator required" });
      receive(req, res, (e) => {
        if (e) e.status = 400;
        next(e);
      });
    },
    wrap(async (req, res) => {
      const subjectId = String(req.body?.subjectId || "");
      if (!safeId(subjectId)) fail(400, "Invalid subject");
      // Admin may stage images under the new note's final ID before saving its metadata.
      // Student image access stays blocked until that note and its parents are published.
      if (!req.file) fail(400, "Image required");
      const ext = imageKind(req.file.buffer);
      if (!ext) fail(400, "Only WebP, PNG or JPEG images are accepted");
      const name =
        crypto.createHash("sha256").update(req.file.buffer).digest("hex") +
        "." +
        ext;
      const dir = path.join(root, subjectId);
      await fs.mkdir(dir, { recursive: true, mode: 0o700 });
      await fs
        .writeFile(path.join(dir, name), req.file.buffer, {
          flag: "wx",
          mode: 0o600,
        })
        .catch((e) => {
          if (e.code !== "EEXIST") throw e; // same bytes already stored
        });
      res.status(201).json({ url: `/api/note-images/${subjectId}/${name}` });
    }),
  );

  // Students receive an image only if they may read that subject's notes.
  app.get(
    "/api/note-images/:subjectId/:file",
    wrap(async (req, res) => {
      const { subjectId, file } = req.params;
      if (!safeId(subjectId) || !FILE.test(file)) fail(404, "Not found");
      const kind=(await records.get(pool,'subjects',subjectId))?'subjectContent':'chapterContent';
      if (!(await records.readable(pool, req.user, kind, subjectId, {})))
        fail(403, "Access denied");
      res.set({
        "Content-Type": MIME[file.split(".")[1]],
        // Content-addressed file names never change, so private caching is safe.
        "Cache-Control": "private, max-age=31536000, immutable",
      });
      res.sendFile(path.join(root, subjectId, file), { dotfiles: "deny" }, (e) => {
        if (e && !res.headersSent)
          res.status(404).json({ error: "Image unavailable" });
      });
    }),
  );

  async function state(req) {
    if (!req.user) fail(401, "Sign in required");
    const id = req.params.subjectId;
    if (!safeId(id)) fail(404, "Not found");
    const kind=(await records.get(pool,'subjects',id))?'subjectContent':'chapterContent';
    if (!(await records.readable(pool, req.user, kind, id, {})))
      fail(403, "Access denied");
    return id;
  }

  app.get(
    "/api/notes/:subjectId/state",
    wrap(async (req, res) => {
      const id = await state(req);
      const row = (
        await pool.query(
          "SELECT data,updated_at FROM note_state WHERE account_id=$1 AND subject_id=$2",
          [req.user.id, id],
        )
      ).rows[0];
      res.json({
        highlights: row?.data?.highlights || [],
        position: row?.data?.position || null,
        updatedAt: row ? new Date(row.updated_at).getTime() : 0,
      });
    }),
  );

  app.post(
    "/api/notes/:subjectId/state",
    wrap(async (req, res) => {
      const id = await state(req);
      const data = cleanState(req.body);
      const row = (
        await pool.query(
          "INSERT INTO note_state(account_id,subject_id,data) VALUES($1,$2,$3) ON CONFLICT(account_id,subject_id) DO UPDATE SET data=EXCLUDED.data,updated_at=now() RETURNING updated_at",
          [req.user.id, id, data],
        )
      ).rows[0];
      res.json({ ok: true, updatedAt: new Date(row.updated_at).getTime() });
    }),
  );
}

module.exports = { installNotes };
