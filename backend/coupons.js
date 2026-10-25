// Discount coupons for subscription plans. Plan prices are decided here, never by the browser.
const crypto = require("node:crypto");
const { fail } = require("./security");
const DEFAULT_PRICES = { quarterly: 1000, "half-yearly": 2000, annual: 3500 };
// Optional override, e.g. PLAN_PRICES="quarterly=1200,half-yearly=2200,annual=4000"
async function planPrices(db) {
  const prices = { ...DEFAULT_PRICES };
  for (const part of String(process.env.PLAN_PRICES || "").split(",")) {
    const [k, v] = part.split("=").map((x) => x.trim());
    if (Object.hasOwn(prices, k) && Number(v) > 0) prices[k] = Math.round(Number(v));
  }
  // Admin Settings is the persistent, authoritative source when set.
  if (db) {
    const cfg = (await db.query('SELECT data FROM site_settings WHERE id=1')).rows[0]?.data || {};
    for (const k of Object.keys(prices)) {
      const value = Number(cfg.planPrices?.[k]);
      if (Number.isInteger(value) && value >= 0 && value <= 1000000) prices[k] = value;
    }
  }
  return prices;
}
async function priceFor(db, planId) {
  const p = await planPrices(db);
  if (!Object.hasOwn(p, planId)) fail(400, "Select a valid plan");
  return p[planId];
}
const normalize = (c) => String(c ?? "").trim().toUpperCase();
const CODE = /^[A-Z0-9_-]{3,40}$/;
const num = (v) => Number(v);
const publicCoupon = (r) => ({
  id: r.id,
  code: r.code,
  discountType: r.discount_type,
  discountValue: num(r.discount_value),
  active: r.active,
  maxUses: r.max_uses,
  usedCount: r.used_count,
  expiresAt: r.expires_at ? new Date(r.expires_at).toISOString() : null,
  planIds: r.plan_ids || [],
  yearIds: r.year_ids || [],
  note: r.note,
  createdAt: r.created_at,
});
function discountFor(coupon, listPrice) {
  const v = num(coupon.discount_value);
  const raw = coupon.discount_type === "percent" ? (listPrice * v) / 100 : v;
  const discount = Math.min(Math.max(Math.round(raw), 0), listPrice);
  return { discount, final: listPrice - discount };
}
// Checks a code for one student/plan/year. Does not consume a use.
async function evaluate(db, { code, planId, yearId, userId }) {
  const listPrice = await priceFor(db, planId);
  const c = normalize(code);
  if (!c) fail(400, "Enter a coupon code");
  const coupon = (await db.query("SELECT * FROM coupons WHERE code=$1", [c])).rows[0];
  if (!coupon || !coupon.active) fail(400, "Invalid coupon code");
  if (coupon.expires_at && new Date(coupon.expires_at) < new Date())
    fail(400, "This coupon has expired");
  if (coupon.max_uses !== null && coupon.used_count >= coupon.max_uses)
    fail(400, "This coupon has been fully redeemed");
  if (coupon.plan_ids?.length && !coupon.plan_ids.includes(planId))
    fail(400, "This coupon is not valid for the selected plan");
  if (coupon.year_ids?.length && yearId && !coupon.year_ids.includes(yearId))
    fail(400, "This coupon is not valid for the selected year");
  const used = await db.query(
    "SELECT 1 FROM coupon_redemptions WHERE coupon_id=$1 AND account_id=$2",
    [coupon.id, userId],
  );
  if (used.rows.length) fail(400, "You have already used this coupon");
  const { discount, final } = discountFor(coupon, listPrice);
  return { coupon, listPrice, discountAmount: discount, finalAmount: final };
}
// Consumes one use atomically; call inside the payment-request transaction.
async function redeem(db, { code, planId, yearId, userId, paymentId }) {
  const r = await evaluate(db, { code, planId, yearId, userId });
  const upd = await db.query(
    "UPDATE coupons SET used_count=used_count+1 WHERE id=$1 AND (max_uses IS NULL OR used_count<max_uses) RETURNING id",
    [r.coupon.id],
  );
  if (!upd.rows.length) fail(400, "This coupon has been fully redeemed");
  try {
    await db.query(
      "INSERT INTO coupon_redemptions(coupon_id,account_id,payment_id,discount_amount) VALUES($1,$2,$3,$4)",
      [r.coupon.id, userId, paymentId, r.discountAmount],
    );
  } catch (e) {
    if (e.code === "23505") fail(400, "You have already used this coupon");
    throw e;
  }
  return r;
}
// A rejected or deleted payment gives its coupon use back. Safe to call twice.
async function release(db, paymentId) {
  const rows = (
    await db.query("DELETE FROM coupon_redemptions WHERE payment_id=$1 RETURNING coupon_id", [
      paymentId,
    ])
  ).rows;
  for (const { coupon_id } of rows)
    await db.query("UPDATE coupons SET used_count=GREATEST(used_count-1,0) WHERE id=$1", [
      coupon_id,
    ]);
}
function installCoupons(app, pool) {
  const wrap = (fn) => (req, res, next) => Promise.resolve(fn(req, res)).catch(next);
  const admin = (req) => {
    if (req.user?.role !== "admin") fail(403, "Administrator required");
  };
  app.post(
    "/api/coupons/validate",
    wrap(async (req, res) => {
      if (!req.user) fail(401, "Sign in required");
      // Stops code guessing: 20 checks per student per 15 minutes.
      const hit = await pool.query(
        "INSERT INTO rate_limits(key,count,expires_at) VALUES($1,1,now()+interval '15 minutes') ON CONFLICT(key) DO UPDATE SET count=CASE WHEN rate_limits.expires_at<now() THEN 1 ELSE rate_limits.count+1 END,expires_at=CASE WHEN rate_limits.expires_at<now() THEN now()+interval '15 minutes' ELSE rate_limits.expires_at END RETURNING count",
        ["coupon:" + req.user.id],
      );
      if (Number(hit.rows[0].count) > 20) fail(429, "Too many attempts. Try again later.");
      const { code, planId, yearId } = req.body || {};
      const r = await evaluate(pool, { code, planId, yearId, userId: req.user.id });
      res.json({
        valid: true,
        code: r.coupon.code,
        listPrice: r.listPrice,
        discountAmount: r.discountAmount,
        finalAmount: r.finalAmount,
      });
    }),
  );
  app.get(
    "/api/admin/coupons",
    wrap(async (req, res) => {
      admin(req);
      const rows = (await pool.query("SELECT * FROM coupons ORDER BY created_at DESC")).rows;
      res.json({ coupons: rows.map(publicCoupon), planPrices: await planPrices(pool) });
    }),
  );
  app.post(
    "/api/admin/coupons/save",
    wrap(async (req, res) => {
      admin(req);
      const b = req.body || {};
      const code = normalize(b.code);
      if (!CODE.test(code)) fail(400, "Code must be 3–40 letters, numbers, - or _");
      if (!["percent", "fixed"].includes(b.discountType)) fail(400, "Choose percent or fixed");
      const value = Number(b.discountValue);
      if (!(value > 0)) fail(400, "Discount must be greater than 0");
      if (b.discountType === "percent" && value > 100) fail(400, "A percent discount cannot exceed 100");
      const maxUses = b.maxUses === null || b.maxUses === "" || b.maxUses === undefined ? null : Number(b.maxUses);
      if (maxUses !== null && !(Number.isInteger(maxUses) && maxUses > 0))
        fail(400, "Maximum uses must be a whole number above 0");
      const expiresAt = b.expiresAt ? new Date(b.expiresAt) : null;
      if (expiresAt && Number.isNaN(expiresAt.getTime())) fail(400, "Invalid expiry date");
      const prices = await planPrices(pool);
      const planIds = (Array.isArray(b.planIds) ? b.planIds : []).filter((p) => Object.hasOwn(prices, p));
      const yearIds = (Array.isArray(b.yearIds) ? b.yearIds : []).map(String).slice(0, 20);
      const note = String(b.note || "").slice(0, 200);
      const args = [code, b.discountType, value, b.active !== false, maxUses, expiresAt, planIds, yearIds, note];
      try {
        if (b.id) {
          const r = await pool.query(
            "UPDATE coupons SET code=$2,discount_type=$3,discount_value=$4,active=$5,max_uses=$6,expires_at=$7,plan_ids=$8,year_ids=$9,note=$10 WHERE id=$1 RETURNING *",
            [String(b.id), ...args],
          );
          if (!r.rows.length) fail(404, "Coupon not found");
          return res.json(publicCoupon(r.rows[0]));
        }
        const r = await pool.query(
          "INSERT INTO coupons(id,code,discount_type,discount_value,active,max_uses,expires_at,plan_ids,year_ids,note) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING *",
          [crypto.randomUUID(), ...args],
        );
        res.status(201).json(publicCoupon(r.rows[0]));
      } catch (e) {
        if (e.code === "23505") fail(409, "A coupon with this code already exists");
        throw e;
      }
    }),
  );
  app.post(
    "/api/admin/coupons/delete",
    wrap(async (req, res) => {
      admin(req);
      await pool.query("DELETE FROM coupons WHERE id=$1", [String(req.body?.id || "")]);
      res.json({ ok: true });
    }),
  );
}
module.exports = { installCoupons, evaluate, redeem, release, priceFor, planPrices, normalize };
