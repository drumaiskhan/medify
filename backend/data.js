const { fail } = require("./security");
const coupons = require("./coupons");
const collections = new Set([
  "years",
  "blocks",
  "subjects",
  "chapters",
  "subjectContent",
  "subjectParts",
  "chapterContent",
  "users",
  "paymentRequests",
  "settings",
]);
const metadata = new Set(["years", "blocks", "subjects", "chapters"]);
// Plan durations are decided by the server, never by the browser.
const PLAN_MONTHS = Object.freeze({ quarterly: 3, "half-yearly": 6, annual: 12 });
const emailRequired = () => process.env.REQUIRE_EMAIL_VERIFICATION === "true";
const nowSec = () => Math.floor(Date.now() / 1000);
function addMonths(sec, months) {
  const d = new Date(sec * 1000);
  d.setUTCMonth(d.getUTCMonth() + months);
  return Math.floor(d.getTime() / 1000);
}
function ref(v) {
  if (
    !v ||
    !collections.has(v.collection) ||
    (v.id !== undefined &&
      (typeof v.id !== "string" || !v.id.length || v.id.length > 250))
  )
    fail(400, "Invalid record reference");
  return v;
}
async function get(db, c, id) {
  return (
    (
      await db.query("SELECT data FROM records WHERE collection=$1 AND id=$2", [
        c,
        id,
      ])
    ).rows[0]?.data || null
  );
}
function timestamps(v) {
  if (v && typeof v === "object") {
    if (v.__serverTimestamp === true)
      return { seconds: Math.floor(Date.now() / 1000) };
    if (Array.isArray(v)) return v.map(timestamps);
    return Object.fromEntries(
      Object.entries(v).map(([k, x]) => [k, timestamps(x)]),
    );
  }
  return v;
}
function ordinal(v) {
  v = String(v || "").toLowerCase();
  if (/final|fifth|5th|year[ -]?5/.test(v)) return "5";
  for (let i = 1; i <= 4; i++)
    if (
      v.startsWith(String(i)) ||
      v.includes("year " + i) ||
      v.includes("year-" + i) ||
      v.includes(["", "first", "second", "third", "fourth"][i])
    )
      return String(i);
  return null;
}
function sameYear(a, b) {
  if (!a || !b) return false;
  if (String(a).toLowerCase() === String(b).toLowerCase()) return true;
  const x = ordinal(a);
  return !!x && x === ordinal(b);
}
// Returns the unexpired entitlement covering a year, or null.
function activeEntitlement(profile, yearId, at = nowSec()) {
  const ents = profile?.entitlements;
  if (!ents || typeof ents !== "object") return null;
  for (const [key, e] of Object.entries(ents))
    if (
      (sameYear(key, yearId) || sameYear(e?.yearId, yearId)) &&
      (e?.expiresAt?.seconds || 0) > at
    )
      return e;
  return null;
}
function accessSummary(profile, at = nowSec()) {
  const years = Object.entries(profile?.entitlements || {}).map(([key, e]) => {
    const expiresAt = e?.expiresAt?.seconds || 0;
    return {
      yearId: e?.yearId || key,
      yearName: e?.yearName || "",
      planName: e?.planName || "",
      expiresAt,
      daysLeft: Math.max(0, Math.ceil((expiresAt - at) / 86400)),
      active: expiresAt > at,
    };
  });
  const active = years.filter((y) => y.active);
  const latest = [...years].sort((a, b) => b.expiresAt - a.expiresAt)[0];
  return {
    active: active.length > 0,
    expired: years.length > 0 && active.length === 0,
    expiresAt: latest?.expiresAt || null,
    daysLeft: latest?.daysLeft || 0,
    years,
  };
}
function decorateUser(data) {
  return data && typeof data === "object"
    ? { ...data, access: accessSummary(data) }
    : data;
}
// Extends (never shortens) a year's entitlement. Idempotent per payment ID.
function grantEntitlement(existing, payment, paymentId, months) {
  const t = nowSec();
  const ids = Array.isArray(existing?.paymentIds) ? existing.paymentIds : [];
  if (ids.includes(paymentId)) return existing;
  const base = Math.max(t, existing?.expiresAt?.seconds || 0);
  return {
    yearId: payment.yearId || existing?.yearId || "",
    yearName: payment.yearName || existing?.yearName || "",
    planId: payment.planId || existing?.planId || "",
    planName: payment.planName || existing?.planName || "",
    startsAt: existing?.startsAt || { seconds: t },
    expiresAt: { seconds: addMonths(base, months) },
    paymentIds: [...ids, paymentId].slice(-50),
  };
}
function monthsFor(payment) {
  if (Object.hasOwn(PLAN_MONTHS, payment?.planId))
    return PLAN_MONTHS[payment.planId];
  const n = Number(payment?.durationMonths);
  return Number.isInteger(n) && n >= 1 && n <= 12 ? n : 3;
}
async function hasYearAccess(db, user, yearId) {
  if (user?.role === "admin") return true;
  if (!user) return false;
  if (emailRequired() && !user.email_verified) return false;
  const p = await get(db, "users", user.id);
  if (p?.approvalStatus !== "APPROVED") return false;
  return !!activeEntitlement(p, yearId);
}
async function published(db, c, d) {
  if (d?.published !== true) return false;
  if (c === "blocks")
    return (await get(db, "years", d.yearId))?.published === true;
  if (c === "subjects" || c === "chapters") {
    const b = await get(db, "blocks", d.blockId);
    return !!b && (await published(db, "blocks", b));
  }
  return true;
}
async function readable(db, user, c, id, d) {
  if (user?.role === "admin") return true;
  if (c === "users") return user?.id === id;
  if (c === "paymentRequests") return !!user && d?.userId === user.id;
  if (c === "settings") return id === "paymentDetails";
  if (metadata.has(c)) return published(db, c, d);
  if (["subjectContent", "subjectParts", "chapterContent"].includes(c)) {
    const kind = c === "chapterContent" ? "chapters" : "subjects";
    const sid = c === "subjectParts" ? d?.subjectId : id;
    const subject = await get(db, kind, sid);
    if (!subject || !(await published(db, kind, subject))) return false;
    if (subject.isFreeSample === true) return true;
    return hasYearAccess(db, user, subject.yearId);
  }
  return false;
}
async function write(db, user, op) {
  ref(op);
  if (!op.id) fail(400, "Record ID required");
  if (!user) fail(401, "Sign in required");
  if (op.remove) {
    if (user.role !== "admin") fail(403, "Administrator required");
    await db.query("DELETE FROM records WHERE collection=$1 AND id=$2", [
      op.collection,
      op.id,
    ]);
    if (op.collection === "paymentRequests") await coupons.release(db, op.id);
    return;
  }
  if (!op.data || typeof op.data !== "object" || Array.isArray(op.data))
    fail(400, "Record data required");
  let data = timestamps(op.data);
  const { collection: c, id } = op;
  let previousPayment;
  if(c === 'paymentRequests' && user.role === 'admin') {
    const locked = await db.query("SELECT data FROM records WHERE collection='paymentRequests' AND id=$1 FOR UPDATE", [id]);
    previousPayment = locked.rows[0]?.data;
  }
  // `access` is computed by the server on read; never persist a stale copy.
  if (c === "users") delete data.access;
  if (user.role !== "admin") {
    if (c === "users" && id === user.id) {
      const allowed = new Set([
        "fullName",
        "college",
        "academicYear",
        "curriculum",
        "selectedPlanId",
        "selectedPlanName",
        "planPrice",
        "selectedYearId",
        "selectedYearName",
      ]);
      data = Object.fromEntries(
        Object.entries(data).filter(([k]) => allowed.has(k)),
      );
      // Registration is an update to an account-owned profile. Never accept approval, role or entitlement fields.
      op.merge = true;
    } else if (c === "paymentRequests") {
      if (
        !["jazzcash", "meezan"].includes(data.method) ||
        typeof data.transactionId !== "string" ||
        !data.transactionId.trim() ||
        id !== `${data.method}_${data.transactionId.trim()}`
      )
        fail(400, "Invalid payment reference");
      if (!Object.hasOwn(PLAN_MONTHS, data.planId))
        fail(400, "Select a valid plan");
      if (
        typeof data.yearId !== "string" ||
        !(await get(db, "years", data.yearId))
      )
        fail(400, "Select a valid year");
      const fields = [
        "userName",
        "yearId",
        "yearName",
        "planId",
        "planName",
        "durationMonths",
        "method",
        "transactionId",
        "last4Digits",
        "paymentTime",
      ];
      const couponInput = data.couponCode;
      data = Object.fromEntries(
        fields.filter((k) => data[k] !== undefined).map((k) => [k, data[k]]),
      );
      // The amount is always computed here; any coupon is checked and consumed in this transaction.
      const listPrice = coupons.priceFor(data.planId);
      let pricing = { amountPKR: listPrice };
      if (typeof couponInput === "string" && couponInput.trim()) {
        const r = await coupons.redeem(db, {
          code: couponInput,
          planId: data.planId,
          yearId: data.yearId,
          userId: user.id,
          paymentId: id,
        });
        pricing = {
          amountPKR: r.finalAmount,
          listPricePKR: r.listPrice,
          discountAmountPKR: r.discountAmount,
          couponCode: r.coupon.code,
        };
      }
      data = {
        ...data,
        ...pricing,
        durationMonths: PLAN_MONTHS[data.planId],
        userId: user.id,
        userEmail: user.email,
        status: "PENDING",
        createdAt: timestamps({ __serverTimestamp: true }),
        updatedAt: timestamps({ __serverTimestamp: true }),
      };
      // Unique primary key makes duplicate transaction detection race-safe.
      try {
        await db.query(
          "INSERT INTO records(collection,id,data) VALUES($1,$2,$3)",
          [c, id, data],
        );
      } catch (e) {
        if (e.code === "23505")
          fail(409, "This payment reference has already been submitted");
        throw e;
      }
      await db.query(
        "UPDATE records SET data=data || '{\"paymentStatus\":\"PENDING\"}'::jsonb WHERE collection='users' AND id=$1",
        [user.id],
      );
      return;
    } else fail(403, "Administrator required");
  }
  if (
    c === "users" &&
    user.role === "admin" &&
    data.approvalStatus === "APPROVED"
  ) {
    const p = await get(db, c, id);
    if (!p) fail(404, "Student profile missing");
    data.purchasedYearId =
      data.purchasedYearId || p.purchasedYearId || p.selectedYearId;
    data.purchasedYearName =
      data.purchasedYearName ||
      p.purchasedYearName ||
      p.selectedYearName ||
      p.academicYear;
    // A manual approval (no payment record) still needs an expiry date.
    if (p.approvalStatus !== "APPROVED" && data.purchasedYearId) {
      const ents = { ...(p.entitlements || {}), ...(data.entitlements || {}) };
      if (!activeEntitlement({ entitlements: ents }, data.purchasedYearId))
        ents[data.purchasedYearId] = grantEntitlement(
          undefined,
          {
            yearId: data.purchasedYearId,
            yearName: data.purchasedYearName,
            planId: p.selectedPlanId,
            planName: p.selectedPlanName,
          },
          "manual-" + nowSec(),
          monthsFor({ planId: data.selectedPlanId || p.selectedPlanId }),
        );
      data.entitlements = ents;
    }
  }
  if (op.requireExists && !(await get(db, c, id)))
    fail(404, "Record not found");
  await db.query(
    `INSERT INTO records(collection,id,data) VALUES($1,$2,$3) ON CONFLICT(collection,id) DO UPDATE SET data=${op.merge ? "records.data || EXCLUDED.data" : "EXCLUDED.data"},updated_at=now()`,
    [c, id, data],
  );
  // Approval and entitlement change in the SAME transaction as the payment decision.
  if (
    c === "paymentRequests" &&
    user.role === "admin" &&
    ["VERIFIED", "REJECTED"].includes(data.status)
  ) {
    const p = await get(db, c, id);
    if (!p.userId) fail(400, "Payment user missing");
    if(previousPayment?.status !== data.status) await require('./notify').notify(db,p.userId,{
      title:data.status==='VERIFIED'?'Payment verified':'Payment rejected',
      body:data.status==='VERIFIED'?`${p.planName || 'Your plan'} payment has been verified.`:(data.adminNote || 'Please check your payment details and contact support.'),
      type:data.status==='VERIFIED'?'success':'warning', link:'/dashboard'
    });
    const profile = (await get(db, "users", p.userId)) || {};
    let change;
    if (data.status === "VERIFIED") {
      const ents = { ...(profile.entitlements || {}) };
      const key = Object.keys(ents).find((k) => sameYear(k, p.yearId)) || p.yearId;
      ents[key] = grantEntitlement(ents[key], p, id, monthsFor(p));
      change = {
        approvalStatus: "APPROVED",
        paymentStatus: "VERIFIED",
        purchasedYearId: p.yearId,
        purchasedYearName: p.yearName,
        approvedAt: timestamps({ __serverTimestamp: true }),
        rejectedReason: "",
        entitlements: ents,
      };
    } else {
      await coupons.release(db, id);
      // A rejected renewal must not lock a student out of time they already paid for.
      const stillActive = Object.values(profile.entitlements || {}).some(
        (e) => (e?.expiresAt?.seconds || 0) > nowSec(),
      );
      change = {
        paymentStatus: "REJECTED",
        rejectedReason: data.adminNote || "Payment rejected",
        ...(stillActive ? {} : { approvalStatus: "REJECTED" }),
      };
    }
    await db.query(
      "UPDATE records SET data=data || $2::jsonb,updated_at=now() WHERE collection='users' AND id=$1",
      [p.userId, change],
    );
  }
}
module.exports = {
  sameYear,
  ref,
  get,
  readable,
  write,
  ordinal,
  hasYearAccess,
  decorateUser,
  emailRequired,
  PLAN_MONTHS,
};
