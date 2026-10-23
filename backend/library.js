const { parseDriveLink, canonicalDriveLink, fetchDriveFile } = require('./drive');
const { Readable } = require('node:stream');
const { pipeline } = require('node:stream/promises');
const fs = require("node:fs/promises");
const path = require("node:path");
const crypto = require("node:crypto");
const multer = require("multer");
const { fail } = require("./security");
const { get, hasYearAccess } = require("./data");
const DEFAULTS = {
  siteName: "MEDIFY",
  tagline: "Your space to learn medicine.",
  accent: "#137c72",
  announcement: "",
  registrationOpen: true,
  booksEnabled: true,
  readerTheme: "light",
  supportEmail: "",
};
async function settings(db) {
  return {
    ...DEFAULTS,
    ...(await db.query("SELECT data FROM site_settings WHERE id=1")).rows[0]
      ?.data,
  };
}
async function entitled(db, user, book) {
  if (user?.role === "admin") return true;
  const cfg = await settings(db);
  if (!cfg.booksEnabled || !book.published) return false;
  const year = await get(db, "years", book.year_id);
  if (!year?.published) return false;
  if (book.is_free) return true;
  return hasYearAccess(db, user, book.year_id);
}
function installLibrary(app, pool) {
  const root = require("./storage").storageRoot();
  const wrap = (fn) => (req, res, next) =>
    Promise.resolve(fn(req, res)).catch(next);
  const admin = (req, res, next) =>
    req.user?.role === "admin"
      ? next()
      : res.status(403).json({ error: "Administrator required" });
  const member = (req) => {
    if (!req.user) fail(401, "Sign in to save your reading");
    return req.user;
  };
  async function book(req) {
    const b = (
      await pool.query("SELECT * FROM books WHERE id=$1", [req.params.id])
    ).rows[0];
    if (!b) fail(404, "Book not found");
    return b;
  }
  async function access(req) {
    const b = await book(req);
    if (!(await entitled(pool, req.user, b)))
      fail(403, "This book requires verified email and approval for its year");
    return b;
  }
  const disk = multer.diskStorage({
    destination(req, file, cb) {
      fs.mkdir(root, { recursive: true }).then(() => cb(null, root), cb);
    },
    filename(req, file, cb) {
      cb(null, crypto.randomUUID() + ".upload");
    },
  });
  const upload = multer({
    storage: disk,
    limits: {
      fileSize: Number(process.env.MAX_BOOK_MB || 100) * 1024 * 1024,
      files: 2,
      fields: 15,
      fieldSize: 10000,
    },
  }).fields([
    { name: "pdf", maxCount: 1 },
    { name: "cover", maxCount: 1 },
  ]);
  async function cleanup(req) {
    for (const files of Object.values(req.files || {}))
      for (const file of files) await fs.unlink(file.path).catch(() => {});
  }
  const receive = (req, res, next) =>
    upload(req, res, (e) => {
      if (e) {
        cleanup(req).finally(() => {
          e.status = 400;
          next(e);
        });
      } else next();
    });
  async function validateFile(file, kind) {
    if (!file) return;
    if (kind === "cover" && file.size > 5 * 1024 * 1024)
      fail(400, "Cover must be at most 5 MB");
    const handle = await fs.open(file.path, "r");
    const head = Buffer.alloc(16);
    try {
      await handle.read(head, 0, 16, 0);
    } finally {
      await handle.close();
    }
    const ok =
      kind === "pdf"
        ? head.subarray(0, 5).toString() === "%PDF-"
        : head
            .subarray(0, 8)
            .equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])) ||
          head.subarray(0, 3).equals(Buffer.from([255, 216, 255])) ||
          (head.subarray(0, 4).toString() === "RIFF" &&
            head.subarray(8, 12).toString() === "WEBP");
    if (!ok)
      fail(
        400,
        kind === "pdf"
          ? "Choose a valid PDF"
          : "Cover must be a PNG, JPEG or WebP image",
      );
  }
  function clean(v, n) {
    return typeof v === "string" ? v.trim().slice(0, n) : "";
  }
  function truth(v) {
    return v === true || v === "true";
  }
  async function metadata(body) {
    const b = {
      title: clean(body.title, 200),
      author: clean(body.author, 160),
      description: clean(body.description, 3000),
      year_id: clean(body.yearId, 250),
      category: clean(body.category, 80),
      published: truth(body.published),
      is_free: truth(body.isFree),
      page_count: Number(body.pageCount),
    };
    if (!b.title) fail(400, "Title is required");
    if (!(await get(pool, "years", b.year_id)))
      fail(400, "Choose a valid year");
    if (
      !Number.isInteger(b.page_count) ||
      b.page_count < 1 ||
      b.page_count > 20000
    )
      fail(400, "Invalid PDF page count");
    return b;
  }
  function publicBook(b, allowed, progress) {
    return {
      id: b.id,
      title: b.title,
      author: b.author,
      description: b.description,
      yearId: b.year_id,
      category: b.category,
      published: b.published,
      isFree: b.is_free,
      pageCount: b.page_count,
      fileBytes: Number(b.file_bytes),
      hasCover: !!b.cover_path,
      updatedAt: b.updated_at,
      canRead: allowed,
      ...(progress
        ? {
            page: progress.page,
            favorite: progress.favorite,
            lastRead: progress.updated_at,
          }
        : {}),
    };
  }
  app.get(
    "/api/site-settings",
    wrap(async (req, res) => res.json(await settings(pool))),
  );
  app.get(
    "/api/admin/settings",
    admin,
    wrap(async (req, res) =>
      res.json({
        ...(await settings(pool)),
        emailConfigured: !!process.env.SMTP_HOST,
        maxBookMB: Number(process.env.MAX_BOOK_MB || 100),
      }),
    ),
  );
  app.post(
    "/api/admin/settings",
    admin,
    wrap(async (req, res) => {
      const b = req.body;
      const data = {
        siteName: clean(b.siteName, 60) || "MEDIFY",
        tagline: clean(b.tagline, 160),
        accent: /^#[0-9a-f]{6}$/i.test(b.accent) ? b.accent : DEFAULTS.accent,
        announcement: clean(b.announcement, 500),
        registrationOpen: b.registrationOpen !== false,
        booksEnabled: b.booksEnabled !== false,
        readerTheme: ["light", "sepia", "night"].includes(b.readerTheme)
          ? b.readerTheme
          : "light",
        supportEmail: clean(b.supportEmail, 254),
      };
      await pool.query(
        "INSERT INTO site_settings(id,data) VALUES(1,$1) ON CONFLICT(id) DO UPDATE SET data=EXCLUDED.data",
        [data],
      );
      res.json(data);
    }),
  );
  app.get(
    "/api/admin/overview",
    admin,
    wrap(async (req, res) => {
      const counts = (
        await pool.query(
          "SELECT collection,count(*)::int AS count FROM records GROUP BY collection",
        )
      ).rows;
      const users = (
        await pool.query(
          "SELECT count(*)::int AS count FROM accounts WHERE role='student'",
        )
      ).rows[0].count;
      const pending = (
        await pool.query(
          "SELECT count(*)::int AS count FROM records WHERE collection='paymentRequests' AND data->>'status'='PENDING'",
        )
      ).rows[0].count;
      const books = (
        await pool.query("SELECT count(*)::int AS count FROM books")
      ).rows[0].count;
      const recent = (
        await pool.query(
          "SELECT title,created_at FROM books ORDER BY created_at DESC LIMIT 5",
        )
      ).rows;
      res.json({ counts, users, pending, books, recent, pendingRegistrations:await require('./registrations').pendingRegistrations(pool) });
    }),
  );
  app.get(
    "/api/books",
    wrap(async (req, res) => {
      const cfg = await settings(pool);
      if (!cfg.booksEnabled && req.user?.role !== "admin") return res.json([]);
      const all = (
        await pool.query(
          req.user?.role === "admin"
            ? "SELECT * FROM books ORDER BY created_at DESC"
            : "SELECT * FROM books WHERE published=true ORDER BY created_at DESC",
        )
      ).rows;
      const progress = req.user
        ? (
            await pool.query(
              "SELECT * FROM book_progress WHERE account_id=$1",
              [req.user.id],
            )
          ).rows
        : [];
      const result = [];
      for (const b of all) {
        if (
          req.user?.role !== "admin" &&
          !(await get(pool, "years", b.year_id))?.published
        )
          continue;
        result.push(
          publicBook(
            b,
            await entitled(pool, req.user, b),
            progress.find((p) => p.book_id === b.id),
          ),
        );
      }
      res.json(result);
    }),
  );
  app.get(
    "/api/books/:id",
    wrap(async (req, res) => {
      const b = await access(req);
      res.json(publicBook(b, true));
    }),
  );
  app.get(
    "/api/books/:id/file",
    wrap(async (req, res) => {
      const b = await access(req);
      res.set({
        "Content-Type": "application/pdf",
        "Content-Disposition": 'inline; filename="book.pdf"',
        "Access-Control-Expose-Headers":
          "Accept-Ranges, Content-Length, Content-Range",
        "Cache-Control": "private, no-store",
      });
      if (parseDriveLink(b.pdf_path)) {
        const controller=new AbortController();
        const timer=setTimeout(()=>controller.abort(),180000);
        const close=()=>controller.abort();res.on('close',close);
        try {
          const upstream=await fetchDriveFile(b.pdf_path,{range:req.headers.range,signal:controller.signal});
          for(const name of ['content-length','content-range','accept-ranges']) {
            const value=upstream.headers.get(name);if(value)res.setHeader(name,value);
          }
          res.status(upstream.status);
          if(upstream.status===416){await upstream.body?.cancel();return res.end();}
          if(!upstream.body)fail(502,'Google Drive returned an empty file.');
          await pipeline(Readable.fromWeb(upstream.body),res);
        } catch(e) {
          if(!res.headersSent && !res.destroyed){
            res.removeHeader('content-length');res.removeHeader('content-range');
            res.status(e.status||502).json({error:e.status?e.message:'Google Drive download failed or timed out. Please try again.'});
          }
        } finally {clearTimeout(timer);res.off('close',close);}
        return;
      }
      res.sendFile(path.join(root, b.pdf_path), { acceptRanges: true }, (e) => {
        if (e && !res.headersSent)
          res
            .status(404)
            .json({
              error: "Book file unavailable. Contact the administrator.",
            });
      });
    }),
  );
  app.get(
    "/api/books/:id/cover",
    wrap(async (req, res) => {
      const b = await book(req);
      if (
        req.user?.role !== "admin" &&
        (!b.published ||
          !(await settings(pool)).booksEnabled ||
          !(await get(pool, "years", b.year_id))?.published)
      )
        fail(404, "Cover unavailable");
      if (!b.cover_path) fail(404, "No cover");
      const p = path.join(root, b.cover_path);
      const handle = await fs.open(p, "r");
      const head = Buffer.alloc(12);
      try {
        await handle.read(head, 0, 12, 0);
      } finally {
        await handle.close();
      }
      res.type(head[0] === 137 ? "png" : head[0] === 255 ? "jpeg" : "webp");
      res.sendFile(p);
    }),
  );
  app.post(
    "/api/admin/books",
    admin,
    receive,
    wrap(async (req, res) => {
      try {
        const pdf = req.files?.pdf?.[0],
          cover = req.files?.cover?.[0];
        const driveLink=String(req.body.driveLink||'').trim();
        if(pdf&&driveLink)fail(400,'Choose a PDF upload or Google Drive link, not both.');
        const source=driveLink?canonicalDriveLink(driveLink):null;
        if (!pdf && !source) fail(400, "Choose a PDF or paste a Google Drive link");
        await validateFile(pdf, "pdf");
        await validateFile(cover, "cover");
        const b = await metadata(req.body);
        const id = crypto.randomUUID();
        await pool.query(
          "INSERT INTO books(id,title,author,description,year_id,category,published,is_free,page_count,pdf_path,cover_path,file_bytes) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)",
          [
            id,
            b.title,
            b.author,
            b.description,
            b.year_id,
            b.category,
            b.published,
            b.is_free,
            b.page_count,
            source || pdf.filename,
            cover?.filename || null,
            pdf?.size || 0,
          ],
        );
        res.status(201).json({ id });
      } catch (e) {
        await cleanup(req);
        throw e;
      }
    }),
  );
  app.post(
    "/api/admin/books/:id",
    admin,
    receive,
    wrap(async (req, res) => {
      try {
        const old = await book(req);
        const b = await metadata(req.body);
        const driveLink=String(req.body.driveLink||'').trim();
        if(req.files?.pdf?.[0]&&driveLink)fail(400,'Choose a PDF upload or Google Drive link, not both.');
        const source=driveLink?canonicalDriveLink(driveLink):null;
        const pdf = req.files?.pdf?.[0],
          cover = req.files?.cover?.[0];
        await validateFile(pdf, "pdf");
        await validateFile(cover, "cover");
        await pool.query(
          "UPDATE books SET title=$2,author=$3,description=$4,year_id=$5,category=$6,published=$7,is_free=$8,page_count=$9,pdf_path=$10,cover_path=$11,file_bytes=$12,updated_at=now() WHERE id=$1",
          [
            old.id,
            b.title,
            b.author,
            b.description,
            b.year_id,
            b.category,
            b.published,
            b.is_free,
            b.page_count,
            source || pdf?.filename || old.pdf_path,
            cover?.filename || old.cover_path,
            source ? 0 : (pdf?.size || old.file_bytes),
          ],
        );
        for (const f of [(pdf || source) && old.pdf_path, cover && old.cover_path])
          if (f && !parseDriveLink(f)) await fs.unlink(path.join(root, f)).catch(() => {});
        res.json({ ok: true });
      } catch (e) {
        await cleanup(req);
        throw e;
      }
    }),
  );
  app.post(
    "/api/admin/books/:id/delete",
    admin,
    wrap(async (req, res) => {
      const b = await book(req);
      await pool.query("DELETE FROM books WHERE id=$1", [b.id]);
      for (const f of [b.pdf_path, b.cover_path])
        if (f && !parseDriveLink(f)) await fs.unlink(path.join(root, f)).catch(() => {});
      res.json({ ok: true });
    }),
  );
  app.get(
    "/api/books/:id/state",
    wrap(async (req, res) => {
      const u = member(req);
      await access(req);
      const p = (
        await pool.query(
          "SELECT page,favorite FROM book_progress WHERE account_id=$1 AND book_id=$2",
          [u.id, req.params.id],
        )
      ).rows[0] || { page: 1, favorite: false };
      const marks = (
        await pool.query(
          "SELECT id,page,kind,data FROM book_marks WHERE account_id=$1 AND book_id=$2 ORDER BY created_at",
          [u.id, req.params.id],
        )
      ).rows;
      res.json({ ...p, marks });
    }),
  );
  app.post(
    "/api/books/:id/progress",
    wrap(async (req, res) => {
      const u = member(req);
      const b = await access(req);
      const page = req.body.page,
        favorite = req.body.favorite;
      if (
        page !== undefined &&
        (!Number.isInteger(page) || page < 1 || page > b.page_count)
      )
        fail(400, "Invalid page");
      if (favorite !== undefined && typeof favorite !== "boolean")
        fail(400, "Invalid favourite");
      await pool.query(
        "INSERT INTO book_progress(account_id,book_id,page,favorite) VALUES($1,$2,$3,$4) ON CONFLICT(account_id,book_id) DO UPDATE SET page=COALESCE($5,book_progress.page),favorite=COALESCE($6,book_progress.favorite),updated_at=now()",
        [
          u.id,
          b.id,
          page || 1,
          favorite || false,
          page ?? null,
          favorite ?? null,
        ],
      );
      res.json({ ok: true });
    }),
  );
  app.post(
    "/api/books/:id/marks",
    wrap(async (req, res) => {
      const u = member(req);
      const b = await access(req);
      const { id = crypto.randomUUID(), page, kind, data } = req.body;
      if (
        typeof id !== "string" ||
        id.length > 100 ||
        !Number.isInteger(page) ||
        page < 1 ||
        page > b.page_count ||
        !["bookmark", "note", "highlight", "ink"].includes(kind) ||
        !data ||
        typeof data !== "object"
      )
        fail(400, "Invalid annotation");
      if (JSON.stringify(data).length > 30000)
        fail(400, "Annotation too large");
      const color = /^#[0-9a-f]{6}$/i.test(data.color) ? data.color : "#facc15";
      const text = clean(data.text, 5000);
      let value = { text, color };
      const unit = (v) => Number.isFinite(v) && v >= 0 && v <= 1;
      if (kind === "highlight") {
        const { x, y, w, h } = data;
        if (
          ![x, y, w, h].every(unit) ||
          w <= 0 ||
          h <= 0 ||
          x + w > 1.01 ||
          y + h > 1.01
        )
          fail(400, "Invalid highlight");
        value = { ...value, x, y, w, h };
      }
      if (kind === "ink") {
        if (
          !Array.isArray(data.points) ||
          data.points.length < 2 ||
          data.points.length > 1500 ||
          !data.points.every(
            (p) => Array.isArray(p) && p.length === 2 && p.every(unit),
          )
        )
          fail(400, "Invalid ink stroke");
        value = {
          ...value,
          points: data.points,
          penWidth: Number.isFinite(data.penWidth)
            ? Math.max(1, Math.min(12, data.penWidth))
            : 2,
        };
      }
      const count = (
        await pool.query(
          "SELECT count(*)::int AS n FROM book_marks WHERE account_id=$1 AND book_id=$2",
          [u.id, b.id],
        )
      ).rows[0].n;
      if (count >= 3000) fail(400, "Annotation limit reached for this book");
      const result = await pool.query(
        "INSERT INTO book_marks(id,account_id,book_id,page,kind,data) VALUES($1,$2,$3,$4,$5,$6) ON CONFLICT(id) DO UPDATE SET data=EXCLUDED.data WHERE book_marks.account_id=EXCLUDED.account_id AND book_marks.book_id=EXCLUDED.book_id RETURNING id,page,kind,data",
        [id, u.id, b.id, page, kind, value],
      );
      if (!result.rows.length)
        fail(403, "Annotation belongs to another account");
      res.json(result.rows[0]);
    }),
  );
  app.post(
    "/api/books/:id/marks/:mark/delete",
    wrap(async (req, res) => {
      const u = member(req);
      await access(req);
      await pool.query(
        "DELETE FROM book_marks WHERE id=$1 AND account_id=$2 AND book_id=$3",
        [req.params.mark, u.id, req.params.id],
      );
      res.json({ ok: true });
    }),
  );
}
module.exports = { installLibrary, settings, entitled };
