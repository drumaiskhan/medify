// Student feedback (with reply threads) and in-app notifications.
const crypto = require("node:crypto");
const { fail } = require("./security");
const records = require("./data");
const { notify, safeLink, TYPES } = require("./notify");

const CATEGORIES = ["general", "content", "payment", "bug", "suggestion"];
const STATUSES = ["open", "replied", "reviewed"];
const MAX_BROADCAST = 5000;
const text = (v, max) => String(v ?? "").trim().slice(0, max);

// True when a student profile belongs to a year (chosen, purchased or entitled).
function profileInYear(profile, yearId) {
  if (!profile || !yearId) return false;
  const same = records.sameYear;
  if (same(profile.selectedYearId, yearId) || same(profile.purchasedYearId, yearId))
    return true;
  return Object.entries(profile.entitlements || {}).some(
    ([key, e]) => same(key, yearId) || same(e?.yearId, yearId),
  );
}

function installInbox(app, pool) {
  const wrap = (fn) => (req, res, next) => Promise.resolve(fn(req, res)).catch(next);
  const needUser = (req) => {
    if (!req.user) fail(401, "Sign in required");
    return req.user;
  };
  const needAdmin = (req) => {
    if (req.user?.role !== "admin") fail(403, "Administrator required");
    return req.user;
  };
  // Fixed-window limiter, same table the login/coupon limits use.
  async function limit(key, max, minutes) {
    const r = await pool.query(
      "INSERT INTO rate_limits(key,count,expires_at) VALUES($1,1,now()+make_interval(mins=>$2)) ON CONFLICT(key) DO UPDATE SET count=CASE WHEN rate_limits.expires_at<now() THEN 1 ELSE rate_limits.count+1 END,expires_at=CASE WHEN rate_limits.expires_at<now() THEN now()+make_interval(mins=>$2) ELSE rate_limits.expires_at END RETURNING count",
      [key, minutes],
    );
    if (Number(r.rows[0].count) > max)
      fail(429, "You are doing that too often. Please try again later.");
  }
  async function tx(fn) {
    const db = await pool.connect();
    try {
      await db.query("BEGIN");
      const v = await fn(db);
      await db.query("COMMIT");
      return v;
    } catch (e) {
      await db.query("ROLLBACK");
      throw e;
    } finally {
      db.release();
    }
  }
  const iso = (d) => new Date(d).toISOString();
  const reply = (r) => ({
    id: r.id,
    authorRole: r.author_role,
    message: r.message,
    createdAt: iso(r.created_at),
  });
  async function repliesFor(ids) {
    const map = new Map(ids.map((id) => [id, []]));
    if (!ids.length) return map;
    const rows = (
      await pool.query(
        "SELECT * FROM feedback_replies WHERE feedback_id=ANY($1::text[]) ORDER BY created_at",
        [ids],
      )
    ).rows;
    for (const r of rows) map.get(r.feedback_id)?.push(reply(r));
    return map;
  }
  const feedbackItem = (r, replies) => ({
    id: r.id,
    category: r.category,
    message: r.message,
    rating: r.rating,
    status: r.status,
    createdAt: iso(r.created_at),
    updatedAt: iso(r.updated_at),
    replies,
  });

  // ---------- Student: notifications ----------
  app.get(
    "/api/notifications",
    wrap(async (req, res) => {
      const u = needUser(req);
      // Housekeeping: notifications older than 90 days are dropped.
      await pool.query(
        "DELETE FROM notifications WHERE account_id=$1 AND created_at<now()-interval '90 days'",
        [u.id],
      );
      const rows = (
        await pool.query(
          "SELECT id,title,body,type,link,is_read,created_at FROM notifications WHERE account_id=$1 ORDER BY created_at DESC LIMIT 100",
          [u.id],
        )
      ).rows;
      const count = await pool.query("SELECT count(*)::int AS n FROM notifications WHERE account_id=$1 AND NOT is_read AND created_at>=now()-interval '90 days'", [u.id]);
      res.json({
        notifications: rows.map((r) => ({
          id: r.id,
          title: r.title,
          body: r.body,
          type: r.type,
          link: r.link,
          read: r.is_read,
          createdAt: iso(r.created_at),
        })),
        unread: count.rows[0].n,
      });
    }),
  );
  // Light endpoint for the bell badge.
  app.get(
    "/api/notifications/count",
    wrap(async (req, res) => {
      if (!req.user) return res.json({ unread: 0 });
      const r = await pool.query(
        "SELECT count(*)::int AS n FROM notifications WHERE account_id=$1 AND NOT is_read AND created_at>=now()-interval '90 days'",
        [req.user.id],
      );
      res.json({ unread: r.rows[0].n });
    }),
  );
  app.post(
    "/api/notifications/read",
    wrap(async (req, res) => {
      const u = needUser(req);
      if (req.body?.all === true)
        await pool.query(
          "UPDATE notifications SET is_read=true WHERE account_id=$1 AND NOT is_read AND created_at>=now()-interval '90 days'",
          [u.id],
        );
      else
        await pool.query(
          "UPDATE notifications SET is_read=true WHERE id=$1 AND account_id=$2",
          [String(req.body?.id || ""), u.id],
        );
      res.json({ ok: true });
    }),
  );
  app.post(
    "/api/notifications/clear",
    wrap(async (req, res) => {
      const u = needUser(req);
      await pool.query("DELETE FROM notifications WHERE account_id=$1", [u.id]);
      res.json({ ok: true });
    }),
  );

  // ---------- Student: feedback ----------
  app.post(
    "/api/feedback/submit",
    wrap(async (req, res) => {
      const u = needUser(req);
      await limit("feedback:" + u.id, 5, 60);
      const b = req.body || {};
      const message = text(b.message, 4000);
      if (message.length < 3) fail(400, "Please write a short message");
      const category = CATEGORIES.includes(b.category) ? b.category : "general";
      let rating = null;
      if (b.rating !== undefined && b.rating !== null && b.rating !== "") {
        rating = Number(b.rating);
        if (!Number.isInteger(rating) || rating < 1 || rating > 5)
          fail(400, "Rating must be between 1 and 5");
      }
      const id = crypto.randomUUID();
      await pool.query(
        "INSERT INTO feedback(id,account_id,category,message,rating) VALUES($1,$2,$3,$4,$5)",
        [id, u.id, category, message, rating],
      );
      res.status(201).json({ ok: true, id });
    }),
  );
  app.get(
    "/api/feedback/mine",
    wrap(async (req, res) => {
      const u = needUser(req);
      const rows = (
        await pool.query(
          "SELECT * FROM feedback WHERE account_id=$1 ORDER BY created_at DESC LIMIT 100",
          [u.id],
        )
      ).rows;
      const replies = await repliesFor(rows.map((r) => r.id));
      res.json({ feedback: rows.map((r) => feedbackItem(r, replies.get(r.id))) });
    }),
  );
  // A student following up on their own thread reopens it for the team.
  app.post(
    "/api/feedback/reply",
    wrap(async (req, res) => {
      const u = needUser(req);
      await limit("feedback-reply:" + u.id, 30, 60);
      const message = text(req.body?.message, 4000);
      if (message.length < 1) fail(400, "Write a message first");
      await tx(async (db) => {
        const f = (
          await db.query(
            "SELECT id FROM feedback WHERE id=$1 AND account_id=$2 FOR UPDATE",
            [String(req.body?.id || ""), u.id],
          )
        ).rows[0];
        if (!f) fail(404, "Feedback not found");
        await db.query(
          "INSERT INTO feedback_replies(id,feedback_id,author_id,author_role,message) VALUES($1,$2,$3,'student',$4)",
          [crypto.randomUUID(), f.id, u.id, message],
        );
        await db.query("UPDATE feedback SET status='open',updated_at=now() WHERE id=$1", [f.id]);
      });
      res.status(201).json({ ok: true });
    }),
  );

  // ---------- Admin: feedback ----------
  app.get(
    "/api/admin/feedback",
    wrap(async (req, res) => {
      needAdmin(req);
      const rows = (
        await pool.query(
          "SELECT f.*,a.email,r.data->>'fullName' AS full_name FROM feedback f JOIN accounts a ON a.id=f.account_id LEFT JOIN records r ON r.collection='users' AND r.id=f.account_id ORDER BY f.created_at DESC LIMIT 500",
        )
      ).rows;
      const replies = await repliesFor(rows.map((r) => r.id));
      const counts = { open: 0, replied: 0, reviewed: 0 };
      for (const r of rows) counts[r.status] += 1;
      res.json({
        feedback: rows.map((r) => ({
          ...feedbackItem(r, replies.get(r.id)),
          student: { email: r.email, name: r.full_name || "" },
        })),
        counts,
      });
    }),
  );
  app.get(
    "/api/admin/feedback/summary",
    wrap(async (req, res) => {
      needAdmin(req);
      const r = await pool.query("SELECT count(*)::int AS n FROM feedback WHERE status='open'");
      res.json({ open: r.rows[0].n });
    }),
  );
  app.post(
    "/api/admin/feedback/reply",
    wrap(async (req, res) => {
      const admin = needAdmin(req);
      const message = text(req.body?.message, 4000);
      if (!message) fail(400, "Write a reply first");
      await tx(async (db) => {
        const f = (
          await db.query("SELECT id,account_id FROM feedback WHERE id=$1 FOR UPDATE", [
            String(req.body?.id || ""),
          ])
        ).rows[0];
        if (!f) fail(404, "Feedback not found");
        await db.query(
          "INSERT INTO feedback_replies(id,feedback_id,author_id,author_role,message) VALUES($1,$2,$3,'admin',$4)",
          [crypto.randomUUID(), f.id, admin.id, message],
        );
        await db.query("UPDATE feedback SET status='replied',updated_at=now() WHERE id=$1", [f.id]);
        await notify(db, f.account_id, {
          title: "The team replied to your feedback",
          body: message.length > 140 ? message.slice(0, 137) + "…" : message,
          type: "info",
          link: "/feedback",
        });
      });
      res.status(201).json({ ok: true });
    }),
  );
  app.post(
    "/api/admin/feedback/status",
    wrap(async (req, res) => {
      needAdmin(req);
      if (!STATUSES.includes(req.body?.status)) fail(400, "Invalid status");
      const r = await pool.query(
        "UPDATE feedback SET status=$2,updated_at=now() WHERE id=$1 RETURNING id",
        [String(req.body?.id || ""), req.body.status],
      );
      if (!r.rows.length) fail(404, "Feedback not found");
      res.json({ ok: true });
    }),
  );
  app.post(
    "/api/admin/feedback/delete",
    wrap(async (req, res) => {
      needAdmin(req);
      await pool.query("DELETE FROM feedback WHERE id=$1", [String(req.body?.id || "")]);
      res.json({ ok: true });
    }),
  );

  // ---------- Admin: broadcast notifications ----------
  app.post(
    "/api/admin/notifications/broadcast",
    wrap(async (req, res) => {
      needAdmin(req);
      const b = req.body || {};
      const title = text(b.title, 200);
      const body = text(b.body, 2000);
      if (!title) fail(400, "A title is required");
      const type = TYPES.includes(b.type) ? b.type : "info";
      const link = b.link ? safeLink(String(b.link)) : null;
      if (b.link && !link) fail(400, "Link must be a path inside the app, like /dashboard");

      let audience = "All students";
      const yearId = b.yearId ? String(b.yearId) : "";
      if (yearId) {
        const year = await records.get(pool, "years", yearId);
        if (!year) fail(400, "Select a valid year");
        audience = year.name || yearId;
      }
      const students = (
        await pool.query(
          "SELECT a.id,r.data AS profile FROM accounts a LEFT JOIN records r ON r.collection='users' AND r.id=a.id WHERE a.role='student'",
        )
      ).rows;
      const ids = students
        .filter((s) => !yearId || profileInYear(s.profile, yearId))
        .map((s) => s.id);
      if (!ids.length) fail(400, "No students match this audience yet");
      if (ids.length > MAX_BROADCAST) fail(400, `Audience is larger than ${MAX_BROADCAST} students`);

      const batchId = crypto.randomUUID();
      await pool.query(
        "INSERT INTO notifications(id,account_id,title,body,type,link,batch_id,audience) SELECT n,a,$3,$4,$5,$6,$7,$8 FROM unnest($1::text[],$2::text[]) AS t(a,n)",
        [ids, ids.map(() => crypto.randomUUID()), title, body, type, link, batchId, audience],
      );
      res.status(201).json({ ok: true, batchId, recipients: ids.length, audience });
    }),
  );
  app.get(
    "/api/admin/notifications/recent",
    wrap(async (req, res) => {
      needAdmin(req);
      const rows = (
        await pool.query(
          "SELECT batch_id,max(title) AS title,max(body) AS body,max(type) AS type,max(audience) AS audience,count(*)::int AS recipients,count(*) FILTER (WHERE is_read)::int AS read_count,min(created_at) AS created_at FROM notifications WHERE batch_id IS NOT NULL GROUP BY batch_id ORDER BY min(created_at) DESC LIMIT 20",
        )
      ).rows;
      res.json({
        broadcasts: rows.map((r) => ({
          batchId: r.batch_id,
          title: r.title,
          body: r.body,
          type: r.type,
          audience: r.audience,
          recipients: r.recipients,
          readCount: r.read_count,
          createdAt: iso(r.created_at),
        })),
      });
    }),
  );
  // Removes the message from every student who has not already cleared it.
  app.post(
    "/api/admin/notifications/recall",
    wrap(async (req, res) => {
      needAdmin(req);
      const r = await pool.query(
        "DELETE FROM notifications WHERE batch_id=$1 RETURNING id",
        [String(req.body?.batchId || "")],
      );
      res.json({ ok: true, removed: r.rows.length });
    }),
  );
}
module.exports = { installInbox, profileInYear, CATEGORIES };
