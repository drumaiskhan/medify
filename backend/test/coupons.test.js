// Coupons: server-side pricing, limits, one use per student, release on rejection.
const { test, before, after } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const os = require("node:os");
const { PGlite } = require("@electric-sql/pglite");
const { createApp } = require("../server");

let db, server, base, student, student2, admin;
const origin = "http://localhost:3000";
async function call(p, body, cookie) {
  const r = await fetch(base + p, {
    method: body === undefined ? "GET" : "POST",
    headers: { Origin: origin, "Content-Type": "application/json", ...(cookie ? { Cookie: cookie } : {}) },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  return { status: r.status, data: await r.json(), cookie: r.headers.get("set-cookie")?.split(";")[0] };
}
const write = (collection, id, data, cookie = admin) => call("/data/write", { collection, id, data, merge: true }, cookie);
const read = (collection, id, cookie) => call("/data/read", { collection, id }, cookie);
const pay = (tx, extra = {}, cookie = student) =>
  write("paymentRequests", "jazzcash_" + tx, { method: "jazzcash", transactionId: tx, yearId: "year-1", yearName: "1st Year", planId: "annual", planName: "Annual Pass", ...extra }, cookie);
const save = (b) => call("/admin/coupons/save", b, admin);

before(async () => {
  process.env.UPLOAD_DIR = fs.mkdtempSync(path.join(os.tmpdir(), "medify-coupon-"));
  db = new PGlite();
  await db.exec(fs.readFileSync(path.join(__dirname, "../schema.sql"), "utf8"));
  const pool = { query: (...a) => db.query(...a), connect: async () => ({ query: (...a) => db.query(...a), release() {} }) };
  server = createApp(pool, { sendMail: async () => {} }).listen(0);
  await new Promise((r) => server.once("listening", r));
  base = `http://127.0.0.1:${server.address().port}/api`;
  let r = await call("/auth/register", { email: "c-admin@example.com", password: "Test123456!" });
  await db.query("UPDATE accounts SET role='admin',email_verified=true WHERE id=$1", [r.data.user.uid]);
  admin = r.cookie;
  student = (await call("/auth/register", { email: "c-s1@example.com", password: "Test123456!" })).cookie;
  student2 = (await call("/auth/register", { email: "c-s2@example.com", password: "Test123456!" })).cookie;
  await write("years", "year-1", { name: "1st Year", published: true });
});
after(async () => {
  await new Promise((r) => server.close(r));
  await db.close();
});

test("only administrators manage coupons; students cannot read the list", async () => {
  assert.equal((await call("/admin/coupons", undefined, student)).status, 403);
  assert.equal((await call("/admin/coupons/save", { code: "X", discountType: "percent", discountValue: 10 }, student)).status, 403);
  assert.equal((await save({ code: "BAD CODE", discountType: "percent", discountValue: 10 })).status, 400);
  assert.equal((await save({ code: "OVER", discountType: "percent", discountValue: 150 })).status, 400);
  assert.equal((await save({ code: "ZERO", discountType: "fixed", discountValue: 0 })).status, 400);
});

test("percent coupon is applied by the server and cannot be forged by the client", async () => {
  assert.equal((await save({ code: "save20", discountType: "percent", discountValue: 20, maxUses: 5 })).status, 201);
  assert.equal((await save({ code: "SAVE20", discountType: "percent", discountValue: 20 })).status, 409);
  let r = await call("/coupons/validate", { code: " save20 ", planId: "annual", yearId: "year-1" }, student);
  assert.equal(r.status, 200);
  assert.deepEqual([r.data.listPrice, r.data.discountAmount, r.data.finalAmount], [3500, 700, 2800]);
  assert.equal((await call("/coupons/validate", { code: "SAVE20", planId: "annual" })).status, 401);
  // A forged amount is ignored; the stored amount is the server's.
  assert.equal((await pay("C1", { couponCode: "save20", amountPKR: 1 })).status, 200);
  r = await read("paymentRequests", "jazzcash_C1", student);
  assert.equal(r.data.data.amountPKR, 2800);
  assert.equal(r.data.data.couponCode, "SAVE20");
  assert.equal(r.data.data.discountAmountPKR, 700);
  // No coupon, forged amount: full server price.
  assert.equal((await pay("C2", { amountPKR: 1 }, student2)).status, 200);
  assert.equal((await read("paymentRequests", "jazzcash_C2", student2)).data.data.amountPKR, 3500);
});

test("one use per student, and a rejected payment gives the use back", async () => {
  assert.equal((await call("/coupons/validate", { code: "SAVE20", planId: "annual" }, student)).status, 400);
  assert.equal((await pay("C3", { couponCode: "SAVE20" })).status, 400);
  const used = async () => Number((await db.query("SELECT used_count FROM coupons WHERE code='SAVE20'")).rows[0].used_count);
  assert.equal(await used(), 1);
  assert.equal((await write("paymentRequests", "jazzcash_C1", { status: "REJECTED", adminNote: "No match" })).status, 200);
  assert.equal(await used(), 0);
  assert.equal((await write("paymentRequests", "jazzcash_C1", { status: "REJECTED" })).status, 200);
  assert.equal(await used(), 0);
  assert.equal((await call("/coupons/validate", { code: "SAVE20", planId: "annual" }, student)).status, 200);
});

test("duplicate transaction does not burn a coupon use", async () => {
  assert.equal((await pay("C2", { couponCode: "SAVE20" }, student2)).status, 409);
  assert.equal(Number((await db.query("SELECT used_count FROM coupons WHERE code='SAVE20'")).rows[0].used_count), 0);
});

test("expired, inactive, exhausted and plan-restricted coupons are refused", async () => {
  await save({ code: "OLD", discountType: "fixed", discountValue: 100, expiresAt: new Date(Date.now() - 86400000).toISOString() });
  await save({ code: "OFF", discountType: "fixed", discountValue: 100, active: false });
  await save({ code: "ONCE", discountType: "fixed", discountValue: 100, maxUses: 1 });
  await save({ code: "QONLY", discountType: "fixed", discountValue: 100, planIds: ["quarterly"] });
  for (const code of ["OLD", "OFF", "NOPE"])
    assert.equal((await call("/coupons/validate", { code, planId: "annual" }, student)).status, 400);
  assert.equal((await call("/coupons/validate", { code: "QONLY", planId: "annual" }, student)).status, 400);
  assert.equal((await call("/coupons/validate", { code: "QONLY", planId: "quarterly" }, student)).data.finalAmount, 900);
  assert.equal((await pay("C4", { couponCode: "ONCE" }, student)).status, 200);
  assert.equal((await call("/coupons/validate", { code: "ONCE", planId: "annual" }, student2)).status, 400);
});

test("fixed discount never goes below zero", async () => {
  await save({ code: "HUGE", discountType: "fixed", discountValue: 99999 });
  const r = await call("/coupons/validate", { code: "HUGE", planId: "quarterly" }, student2);
  assert.deepEqual([r.data.discountAmount, r.data.finalAmount], [1000, 0]);
});
