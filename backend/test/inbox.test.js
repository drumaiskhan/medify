// Feedback threads and notifications: ownership, replies, payment alerts, broadcasts, recall.
const { test, before, after } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const os = require("node:os");
const { PGlite } = require("@electric-sql/pglite");
const { createApp } = require("../server");
const { profileInYear } = require("../inbox");
const { safeLink } = require("../notify");

let db, server, base, s1, s2, s1Id, s2Id, admin;
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
const inbox = async (cookie) => (await call("/notifications", undefined, cookie)).data;

before(async () => {
  process.env.UPLOAD_DIR = fs.mkdtempSync(path.join(os.tmpdir(), "medify-inbox-"));
  db = new PGlite();
  await db.exec(fs.readFileSync(path.join(__dirname, "../schema.sql"), "utf8"));
  const pool = { query: (...a) => db.query(...a), connect: async () => ({ query: (...a) => db.query(...a), release() {} }) };
  server = createApp(pool, { sendMail: async () => {} }).listen(0);
  await new Promise((r) => server.once("listening", r));
  base = `http://127.0.0.1:${server.address().port}/api`;
  let r = await call("/auth/register", { email: "i-admin@example.com", password: "Test123456!" });
  await db.query("UPDATE accounts SET role='admin',email_verified=true WHERE id=$1", [r.data.user.uid]);
  admin = r.cookie;
  r = await call("/auth/register", { email: "i-s1@example.com", password: "Test123456!" });
  s1 = r.cookie; s1Id = r.data.user.uid;
  r = await call("/auth/register", { email: "i-s2@example.com", password: "Test123456!" });
  s2 = r.cookie; s2Id = r.data.user.uid;
  await write("years", "year-1", { name: "1st Year", published: true });
  await write("years", "year-2", { name: "2nd Year", published: true });
  await write("users", s1Id, { selectedYearId: "year-1", fullName: "Sara Khan" });
  await write("users", s2Id, { selectedYearId: "year-2" });
});
after(async () => {
  await new Promise((r) => server.close(r));
  await db.close();
});

test("year matching and link safety helpers", () => {
  assert.equal(profileInYear({ selectedYearId: "year-1" }, "year-1"), true);
  assert.equal(profileInYear({ purchasedYearId: "year-2" }, "year-2"), true);
  assert.equal(profileInYear({ entitlements: { "year-3": {} } }, "year-3"), true);
  assert.equal(profileInYear({ selectedYearId: "year-1" }, "year-2"), false);
  assert.equal(profileInYear(null, "year-1"), false);
  assert.equal(safeLink("/feedback"), "/feedback");
  for (const bad of ["//evil.com", "https://evil.com", "javascript:alert(1)", "feedback", "/\\\\evil.com", "/\n/evil.com"])
    assert.equal(safeLink(bad), null);
});

test("signed-out users and non-admins are kept out", async () => {
  assert.equal((await call("/notifications")).status, 401);
  assert.equal((await call("/notifications/count")).data.unread, 0);
  assert.equal((await call("/feedback/submit", { message: "hello there" })).status, 401);
  for (const p of ["/admin/feedback", "/admin/feedback/summary", "/admin/notifications/recent"])
    assert.equal((await call(p, undefined, s1)).status, 403);
  assert.equal((await call("/admin/notifications/broadcast", { title: "x" }, s1)).status, 403);
  assert.equal((await call("/admin/feedback/reply", { id: "x", message: "y" }, s1)).status, 403);
});

test("feedback validation and thread flow with a notification to the student", async () => {
  assert.equal((await call("/feedback/submit", { message: "  " }, s1)).status, 400);
  assert.equal((await call("/feedback/submit", { message: "Great notes", rating: 9 }, s1)).status, 400);
  let r = await call("/feedback/submit", { message: "The anatomy notes are great", rating: 5, category: "content" }, s1);
  assert.equal(r.status, 201);
  const id = r.data.id;
  await call("/feedback/submit", { message: "Unknown category falls back", category: "<script>" }, s2);

  let mine = (await call("/feedback/mine", undefined, s1)).data.feedback;
  assert.equal(mine.length, 1);
  assert.deepEqual([mine[0].category, mine[0].rating, mine[0].status], ["content", 5, "open"]);
  assert.equal((await call("/feedback/mine", undefined, s2)).data.feedback[0].category, "general");

  let list = (await call("/admin/feedback", undefined, admin)).data;
  assert.equal(list.counts.open, 2);
  const item = list.feedback.find((f) => f.id === id);
  assert.deepEqual([item.student.email, item.student.name], ["i-s1@example.com", "Sara Khan"]);
  assert.equal((await call("/admin/feedback/summary", undefined, admin)).data.open, 2);

  assert.equal((await call("/admin/feedback/reply", { id, message: "Thank you! More coming." }, admin)).status, 201);
  mine = (await call("/feedback/mine", undefined, s1)).data.feedback;
  assert.equal(mine[0].status, "replied");
  assert.deepEqual(mine[0].replies.map((x) => x.authorRole), ["admin"]);
  const n = await inbox(s1);
  assert.equal(n.unread, 1);
  assert.equal(n.notifications[0].title, "The team replied to your feedback");
  assert.equal(n.notifications[0].link, "/feedback");

  // Student follow-up reopens the thread; another student cannot touch it.
  assert.equal((await call("/feedback/reply", { id, message: "Can you add more physiology?" }, s2)).status, 404);
  assert.equal((await call("/feedback/reply", { id, message: "Can you add more physiology?" }, s1)).status, 201);
  mine = (await call("/feedback/mine", undefined, s1)).data.feedback;
  assert.deepEqual([mine[0].status, mine[0].replies.length], ["open", 2]);

  assert.equal((await call("/admin/feedback/status", { id, status: "reviewed" }, admin)).status, 200);
  assert.equal((await call("/admin/feedback/status", { id, status: "nonsense" }, admin)).status, 400);
  assert.equal((await call("/admin/feedback/reply", { id: "missing", message: "x" }, admin)).status, 404);
});

test("feedback submissions are rate limited", async () => {
  let last;
  for (let i = 0; i < 6; i++) last = await call("/feedback/submit", { message: "spam message " + i }, s2);
  assert.equal(last.status, 429);
});

test("deleting feedback removes its replies", async () => {
  const { feedback } = (await call("/admin/feedback", undefined, admin)).data;
  const withReplies = feedback.find((f) => f.replies.length);
  await call("/admin/feedback/delete", { id: withReplies.id }, admin);
  const left = await db.query("SELECT count(*)::int AS n FROM feedback_replies WHERE feedback_id=$1", [withReplies.id]);
  assert.equal(left.rows[0].n, 0);
});

test("payment decisions notify the student once per change", async () => {
  const pay = await write(
    "paymentRequests",
    "jazzcash_N1",
    { method: "jazzcash", transactionId: "N1", yearId: "year-1", yearName: "1st Year", planId: "annual", planName: "Annual Pass" },
    s1,
  );
  assert.equal(pay.status, 200);
  const before = (await inbox(s1)).notifications.length;
  assert.equal((await write("paymentRequests", "jazzcash_N1", { status: "VERIFIED" })).status, 200);
  assert.equal((await write("paymentRequests", "jazzcash_N1", { status: "VERIFIED" })).status, 200);
  let n = (await inbox(s1)).notifications;
  assert.equal(n.length, before + 1);
  assert.match(n[0].title, /verified/i);
  assert.equal(n[0].type, "success");
  assert.match(n[0].body, /Annual Pass/);

  assert.equal((await write("paymentRequests", "jazzcash_N1", { status: "REJECTED", adminNote: "Amount mismatch" })).status, 200);
  n = (await inbox(s1)).notifications;
  assert.equal(n.length, before + 2);
  assert.equal(n[0].type, "warning");
  assert.equal(n[0].body, "Amount mismatch");
});

test("read, mark-all-read and clear affect only the caller", async () => {
  const mine = await inbox(s1);
  assert.ok(mine.unread >= 2);
  const other = (await inbox(s2)).notifications.length;
  await call("/notifications/read", { id: mine.notifications[0].id }, s2); // not theirs: no effect
  assert.equal((await inbox(s1)).unread, mine.unread);
  await call("/notifications/read", { id: mine.notifications[0].id }, s1);
  assert.equal((await inbox(s1)).unread, mine.unread - 1);
  await call("/notifications/read", { all: true }, s1);
  assert.equal((await call("/notifications/count", undefined, s1)).data.unread, 0);
  await call("/notifications/clear", {}, s1);
  assert.equal((await inbox(s1)).notifications.length, 0);
  assert.equal((await inbox(s2)).notifications.length, other);
});

test("broadcast reaches all students or one year, rejects bad input, and can be recalled", async () => {
  assert.equal((await call("/admin/notifications/broadcast", { title: "" }, admin)).status, 400);
  assert.equal((await call("/admin/notifications/broadcast", { title: "Hi", link: "https://evil.com" }, admin)).status, 400);
  assert.equal((await call("/admin/notifications/broadcast", { title: "Hi", yearId: "nope" }, admin)).status, 400);

  let r = await call("/admin/notifications/broadcast", { title: "Welcome back", body: "New notes are up", type: "success", link: "/dashboard" }, admin);
  assert.equal(r.status, 201);
  assert.equal(r.data.recipients, 2);
  const everyone = r.data.batchId;

  r = await call("/admin/notifications/broadcast", { title: "Year 1 exam notice", body: "Friday", yearId: "year-1" }, admin);
  assert.deepEqual([r.data.recipients, r.data.audience], [1, "1st Year"]);
  const yearOne = r.data.batchId;

  const titles = (n) => n.notifications.map((x) => x.title);
  assert.ok(titles(await inbox(s1)).includes("Year 1 exam notice"));
  assert.ok(!titles(await inbox(s2)).includes("Year 1 exam notice"));
  assert.ok(titles(await inbox(s2)).includes("Welcome back"));
  // Admins are never recipients.
  assert.equal((await inbox(admin)).notifications.length, 0);

  const recent = (await call("/admin/notifications/recent", undefined, admin)).data.broadcasts;
  assert.deepEqual(recent.map((b) => b.recipients).sort(), [1, 2]);

  assert.equal((await call("/admin/notifications/recall", { batchId: yearOne }, admin)).data.removed, 1);
  assert.ok(!titles(await inbox(s1)).includes("Year 1 exam notice"));
  assert.ok(titles(await inbox(s1)).includes("Welcome back"));
  await call("/admin/notifications/recall", { batchId: everyone }, admin);
  assert.equal((await call("/admin/notifications/recent", undefined, admin)).data.broadcasts.length, 0);
});

test("a year nobody belongs to is refused instead of sending to no one", async () => {
  await write("years", "year-5", { name: "Final Year", published: true });
  const r = await call("/admin/notifications/broadcast", { title: "Hello", yearId: "year-5" }, admin);
  assert.equal(r.status, 400);
});


test("unread counts exclude expired updates and include updates beyond the latest 100", async () => {
  await call('/notifications/clear', {}, s1);
  await db.query("INSERT INTO notifications(id,account_id,title) SELECT 'count-' || n,$1,'Update' FROM generate_series(1,105) n",[s1Id]);
  await db.query("INSERT INTO notifications(id,account_id,title,created_at) VALUES('expired',$1,'Old',now()-interval '91 days')",[s1Id]);
  assert.equal((await call('/notifications/count',undefined,s1)).data.unread,105);
  const list=await inbox(s1);
  assert.equal(list.notifications.length,100);
  assert.equal(list.unread,105);
  await call('/notifications/read',{all:true},s1);
  assert.equal((await call('/notifications/count',undefined,s1)).data.unread,0);
});
