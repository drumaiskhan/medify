// Year -> Module -> Note: a note uploaded into a module reaches students who bought that year.
const { test, before, after } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const os = require("node:os");
const { PGlite } = require("@electric-sql/pglite");
const { createApp } = require("../server");
const seed = require("../curriculum-seed.json");

let db, server, base, student, admin, studentId;
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
const read = (collection, id, cookie = student) => call("/data/read", { collection, id }, cookie);

before(async () => {
  process.env.UPLOAD_DIR = fs.mkdtempSync(path.join(os.tmpdir(), "medify-mod-"));
  db = new PGlite();
  await db.exec(fs.readFileSync(path.join(__dirname, "../schema.sql"), "utf8"));
  const pool = { query: (...a) => db.query(...a), connect: async () => ({ query: (...a) => db.query(...a), release() {} }) };
  server = createApp(pool, { sendMail: async () => {} }).listen(0);
  await new Promise((r) => server.once("listening", r));
  base = `http://127.0.0.1:${server.address().port}/api`;
  for (const r of seed)
    await db.query("INSERT INTO records(collection,id,data) VALUES($1,$2,$3)", [r.collection, r.id, r.data]);
  let r = await call("/auth/register", { email: "mod-student@example.com", password: "Test123456!" });
  student = r.cookie;
  studentId = r.data.user.uid;
  r = await call("/auth/register", { email: "mod-admin@example.com", password: "Test123456!" });
  await db.query("UPDATE accounts SET role='admin',email_verified=true WHERE id=$1", [r.data.user.uid]);
  admin = r.cookie;
});
after(async () => {
  await new Promise((r) => server.close(r));
  await db.close();
});

test("seed defines the requested modules for 2nd, 3rd and 4th year", () => {
  const names = (year) => seed.filter((r) => r.collection === "blocks" && r.data.yearId === year)
    .sort((a, b) => a.data.order - b.data.order).map((r) => r.data.name);
  assert.deepEqual(names("2nd-year"), ["Neuroscience Module", "Renal Module", "GIT & Hepatobiliary Module", "Endocrine & Reproduction Module"]);
  assert.deepEqual(names("3rd-year"), ["Foundation II Module", "Infection & Inflammation Module", "Blood & Immunology Module", "Multisystem Module", "Cardiovascular & Respiratory Module"]);
  assert.deepEqual(names("4th-year"), ["Neuroscience Module", "GIT & Hepatobiliary Module", "Renal Module", "Endocrine & Reproduction Module", "Otorhinolaryngology (M1) Module", "Ophthalmology (M2) Module"]);
});

test("a note uploaded into a module is readable only by students who bought that year", async () => {
  const mod2 = "2nd-year-renal-module", mod3 = "3rd-year-multisystem-module";
  // Admin uploads a note into a 2nd-year module and into a 3rd-year module (same shape the admin screen writes).
  for (const [yearId, blockId, sid] of [["2nd-year", mod2, mod2 + "-anatomy"], ["3rd-year", mod3, mod3 + "-pathology"]]) {
    assert.equal((await write("subjects", sid, { yearId, blockId, name: "Note", order: 1, published: true, isFreeSample: false })).status, 200);
    assert.equal((await write("subjectContent", sid, { partCount: 1, toc: [], totalBytes: 10 })).status, 200);
    assert.equal((await write("subjectParts", sid + "_1", { subjectId: sid, partNumber: 1, html: "<h2>Secret " + yearId + "</h2>" })).status, 200);
  }
  const part2 = mod2 + "-anatomy_1", part3 = mod3 + "-pathology_1";

  // The module itself is listed for everyone; the note body is not.
  assert.equal((await read("blocks", mod2)).status, 200);
  assert.equal((await read("subjectParts", part2)).status, 403);

  // Student buys 2nd year (payment verified by admin).
  await write("users", studentId, { fullName: "Mod Student", selectedYearId: "2nd-year", academicYear: "2nd Year" }, student);
  const pay = { method: "jazzcash", transactionId: "MOD1", yearId: "2nd-year", yearName: "2nd Year MBBS", planId: "quarterly", planName: "Quarterly Access" };
  assert.equal((await write("paymentRequests", "jazzcash_MOD1", pay, student)).status, 200);
  assert.equal((await write("paymentRequests", "jazzcash_MOD1", { status: "VERIFIED" })).status, 200);

  assert.equal((await read("subjectParts", part2)).status, 200, "2nd-year student reads the 2nd-year module note");
  assert.equal((await read("subjectParts", part3)).status, 403, "...but not another year's module note");

  // Hiding the module hides its notes from students; admin still sees them.
  assert.equal((await write("blocks", mod2, { published: false })).status, 200);
  assert.equal((await read("blocks", mod2)).status, 403);
  assert.equal((await read("subjectParts", part2)).status, 403);
  assert.equal((await read("subjectParts", part2, admin)).status, 200);
  assert.equal((await write("blocks", mod2, { published: true })).status, 200);
  assert.equal((await read("subjectParts", part2)).status, 200);
});


test("new note images survive staging and follow publication and year access", async () => {
  const sid = "staged-note-images";
  const png = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII=", "base64");
  const upload = async (id) => {
    const form = new FormData(); form.set("subjectId", id); form.set("image", new Blob([png], {type:"image/png"}), "image.png");
    const r = await fetch(base+"/note-images", {method:"POST", headers:{Origin:origin,Cookie:admin},body:form});
    assert.equal(r.status,201); return (await r.json()).url;
  };
  const image = await upload(sid);
  const fetchImage = (url,cookie=student) => fetch(base.replace(/\/api$/, "")+url,{headers:{Cookie:cookie}});
  assert.equal((await fetchImage(image)).status,403);
  await write("subjects",sid,{yearId:"2nd-year",blockId:"2nd-year-renal-module",published:true,name:"Images",isFreeSample:false});
  const response = await fetchImage(image);
  assert.equal(response.status,200); assert.equal(response.headers.get("content-type"),"image/png");
  assert.deepEqual(Buffer.from(await response.arrayBuffer()),png);
  await write("subjects",sid,{published:false});
  assert.equal((await fetchImage(image)).status,403);
  await write("subjects",sid,{published:true,yearId:"3rd-year",blockId:"3rd-year-multisystem-module"});
  assert.equal((await fetchImage(image)).status,403);
  assert.equal((await fetchImage(image,admin)).status,200);
});

test("legacy chapter images and reading state use chapter access", async () => {
  const sid="legacy-image-subject", cid="legacy-image-chapter";
  await write("subjects",sid,{yearId:"2nd-year",blockId:"2nd-year-renal-module",published:true,name:"Legacy"});
  await write("chapters",cid,{yearId:"2nd-year",blockId:"2nd-year-renal-module",subjectId:sid,published:true,name:"Chapter"});
  const form=new FormData();form.set("subjectId",cid);
  form.set("image",new Blob([Buffer.from("89504e470d0a1a0a00000000","hex")],{type:"image/png"}),"image.png");
  const r=await fetch(base+"/note-images",{method:"POST",headers:{Origin:origin,Cookie:admin},body:form});assert.equal(r.status,201);
  const url=(await r.json()).url;
  assert.equal((await fetch(base.replace(/\/api$/, "")+url,{headers:{Cookie:student}})).status,200);
  assert.equal((await call("/notes/"+cid+"/state",undefined,student)).status,200);
  await write("chapters",cid,{published:false});
  assert.equal((await fetch(base.replace(/\/api$/, "")+url,{headers:{Cookie:student}})).status,403);
});
