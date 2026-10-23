const { test, before, after } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs/promises");
const path = require("node:path");
const os = require("node:os");
const { PGlite } = require("@electric-sql/pglite");
const { createApp } = require("../server");
let db, server, base, root, admin, student, other, studentId, bookId;
const origin = "http://localhost:3000";
async function request(url, body, cookie) {
  const r = await fetch(base + url, {
    method: body === undefined ? "GET" : "POST",
    headers: {
      Origin: origin,
      ...(body instanceof FormData
        ? {}
        : { "Content-Type": "application/json" }),
      ...(cookie ? { Cookie: cookie } : {}),
    },
    body:
      body === undefined
        ? undefined
        : body instanceof FormData
          ? body
          : JSON.stringify(body),
  });
  return {
    status: r.status,
    data: await r.json(),
    cookie: r.headers.get("set-cookie")?.split(";")[0],
  };
}
async function upload(cookie, overrides = {}) {
  const data = new FormData();
  for (const [k, v] of Object.entries({
    title: "Test textbook",
    author: "Test author",
    yearId: "year-1",
    category: "Pathology",
    published: "true",
    isFree: "false",
    pageCount: "6",
    ...overrides,
  }))
    data.append(k, v);
  data.append(
    "pdf",
    new Blob(
      [await fs.readFile(path.join(__dirname, "fixtures/reader-sample.pdf"))],
      { type: "application/pdf" },
    ),
    "reader.pdf",
  );
  return request("/admin/books", data, cookie);
}
before(async () => {
  root = await fs.mkdtemp(path.join(os.tmpdir(), "medify-library-test-"));
  process.env.UPLOAD_DIR = root;
  db = new PGlite();
  await db.exec(
    await fs.readFile(path.join(__dirname, "../schema.sql"), "utf8"),
  );
  const pool = {
    query: (...a) => db.query(...a),
    connect: async () => ({ query: (...a) => db.query(...a), release() {} }),
  };
  server = createApp(pool).listen(0);
  await new Promise((r) => server.once("listening", r));
  base = `http://localhost:${server.address().port}/api`;
  const a = await request("/auth/register", {
    email: "admin@library.example",
    password: "Test123456!",
  });
  admin = a.cookie;
  await db.query(
    "UPDATE accounts SET role='admin',email_verified=true WHERE id=$1",
    [a.data.user.uid],
  );
  const s = await request("/auth/register", {
    email: "student@library.example",
    password: "Test123456!",
  });
  student = s.cookie;
  studentId = s.data.user.uid;
  const o = await request("/auth/register", {
    email: "other@library.example",
    password: "Test123456!",
  });
  other = o.cookie;
  for (const year of ["year-1", "year-2"])
    await db.query(
      "INSERT INTO records(collection,id,data) VALUES('years',$1,$2)",
      [year, { name: year, published: true }],
    );
});
after(async () => {
  await new Promise((r) => server.close(r));
  await db.close();
  await fs.rm(root, { recursive: true, force: true });
  delete process.env.UPLOAD_DIR;
});
test("Private book library and saved study tools", async (t) => {
  await t.test("upload and settings are admin-only", async () => {
    assert.equal((await upload(student)).status, 403);
    assert.equal(
      (await request("/admin/settings", { siteName: "Hijacked" }, student))
        .status,
      403,
    );
  });
  await t.test(
    "upload saves metadata but never exposes disk paths",
    async () => {
      const r = await upload(admin);
      assert.equal(r.status, 201);
      bookId = r.data.id;
      const list = await request("/books", undefined, student);
      assert.equal(list.data[0].canRead, false);
      assert.equal(list.data[0].pdf_path, undefined);
      assert.equal((await fs.readdir(root)).length, 1);
    },
  );
  await t.test("invalid upload is removed from private storage", async () => {
    const form = new FormData();
    form.append("pdf", new Blob(["not a PDF"]), "fake.pdf");
    const r = await request("/admin/books", form, admin);
    assert.equal(r.status, 400);
    assert.equal((await fs.readdir(root)).length, 1);
  });
  await t.test("unapproved and wrong-year file access denied", async () => {
    let r = await fetch(base + `/books/${bookId}/file`, {
      headers: { Cookie: student, Origin: origin },
    });
    assert.equal(r.status, 403);
    await db.query("UPDATE accounts SET email_verified=true WHERE id=$1", [
      studentId,
    ]);
    await db.query(
      "UPDATE records SET data=data||$2::jsonb WHERE collection='users' AND id=$1",
      [
        studentId,
        {
          approvalStatus: "APPROVED",
          entitlements: {
            "year-2": {
              yearId: "year-2",
              expiresAt: { seconds: Math.floor(Date.now() / 1000) + 2592000 },
            },
          },
        },
      ],
    );
    r = await request(`/books/${bookId}`, undefined, student);
    assert.equal(r.status, 403);
  });
  await t.test("approved year reads PDF byte ranges", async () => {
    await db.query(
      "UPDATE records SET data=data||$2::jsonb WHERE collection='users' AND id=$1",
      [
        studentId,
        {
          entitlements: {
            "year-1": {
              yearId: "year-1",
              expiresAt: { seconds: Math.floor(Date.now() / 1000) + 2592000 },
            },
          },
        },
      ],
    );
    const r = await fetch(base + `/books/${bookId}/file`, {
      headers: { Cookie: student, Origin: origin, Range: "bytes=0-31" },
    });
    assert.equal(r.status, 206);
    assert.equal((await r.arrayBuffer()).byteLength, 32);
    assert.equal(r.headers.get("content-type"), "application/pdf");
    assert.ok(r.headers.get("content-range"));
    assert.equal(
      (await request(`/books/${bookId}/state`, undefined, student)).status,
      200,
    );
  });
  await t.test(
    "progress and favourites are persisted independently",
    async () => {
      assert.equal(
        (await request(`/books/${bookId}/progress`, { page: 4 }, student))
          .status,
        200,
      );
      await request(`/books/${bookId}/progress`, { favorite: true }, student);
      const state = (
        await request(`/books/${bookId}/state`, undefined, student)
      ).data;
      assert.equal(state.page, 4);
      assert.equal(state.favorite, true);
      assert.equal(
        (await request(`/books/${bookId}/progress`, { page: 500 }, student))
          .status,
        400,
      );
    },
  );
  let mark;
  await t.test(
    "pen thickness and annotations save to the owner account",
    async () => {
      const r = await request(
        `/books/${bookId}/marks`,
        {
          page: 4,
          kind: "ink",
          data: {
            points: [
              [0.1, 0.2],
              [0.4, 0.5],
            ],
            color: "#2563eb",
            penWidth: 6,
          },
        },
        student,
      );
      assert.equal(r.status, 200);
      assert.equal(r.data.data.penWidth, 6);
      mark = r.data.id;
      assert.equal(
        (
          await request(
            `/books/${bookId}/marks`,
            {
              page: 1,
              kind: "highlight",
              data: { x: -1, y: 0, w: 0.1, h: 0.1 },
            },
            student,
          )
        ).status,
        400,
      );
    },
  );
  await t.test(
    "free books accessible but annotations remain private",
    async () => {
      await db.query("UPDATE books SET is_free=true WHERE id=$1", [bookId]);
      assert.equal((await request(`/books/${bookId}`, undefined)).status, 200);
      assert.equal(
        (await request(`/books/${bookId}/state`, undefined)).status,
        401,
      );
      assert.equal(
        (await request(`/books/${bookId}/state`, undefined, other)).data.marks
          .length,
        0,
      );
      await request(`/books/${bookId}/marks/${mark}/delete`, {}, other);
      assert.equal(
        (await request(`/books/${bookId}/state`, undefined, student)).data.marks
          .length,
        1,
      );
      assert.equal(
        (
          await request(
            `/books/${bookId}/marks`,
            { id: mark, page: 4, kind: "note", data: { text: "overwrite" } },
            other,
          )
        ).status,
        403,
      );
    },
  );
  await t.test(
    "settings disable registration and book delivery on server",
    async () => {
      const r = await request(
        "/admin/settings",
        {
          siteName: "Test brand",
          accent: "#123456",
          registrationOpen: false,
          booksEnabled: false,
          readerTheme: "sepia",
        },
        admin,
      );
      assert.equal(r.status, 200);
      assert.equal(
        (
          await request("/auth/register", {
            email: "closed@example.com",
            password: "Test123456!",
          })
        ).status,
        403,
      );
      assert.equal(
        (await request(`/books/${bookId}`, undefined, student)).status,
        403,
      );
      assert.deepEqual((await request("/books", undefined, student)).data, []);
      assert.equal(
        (await request("/site-settings")).data.siteName,
        "Test brand",
      );
      assert.equal(
        (await request(`/books/${bookId}`, undefined, admin)).status,
        200,
      );
    },
  );
  await t.test(
    "deletion cascades study records and removes book files",
    async () => {
      assert.equal(
        (await request(`/admin/books/${bookId}/delete`, {}, admin)).status,
        200,
      );
      assert.equal((await db.query("SELECT * FROM book_marks")).rows.length, 0);
      assert.equal(
        (await db.query("SELECT * FROM book_progress")).rows.length,
        0,
      );
      assert.equal((await fs.readdir(root)).length, 0);
    },
  );
});

test('Drive books can be created, protected, streamed and replaced without exposing the link',async()=>{
 const link='https://drive.google.com/file/d/abcDEF123456789/view';
 const fields={title:'Drive textbook',yearId:'year-1',pageCount:6,published:true,isFree:false,driveLink:link};
 const form=()=>{const f=new FormData();for(const [k,v] of Object.entries(fields))f.append(k,String(v));return f;};
 assert.equal((await request('/admin/books',form(),student)).status,403);
 const created=await request('/admin/books',form(),admin);assert.equal(created.status,201);
 const id=created.data.id;
 const list=await request('/books',undefined,admin);
 assert.ok(!JSON.stringify(list.data).includes('abcDEF123456789'));
 const denied=await fetch(base+'/books/'+id+'/file',{headers:{Cookie:other}});assert.equal(denied.status,403);
 const originalFetch=global.fetch;
 global.fetch=async(url,options)=>String(url).startsWith('https://drive.usercontent.google.com/')?new Response('%PDF-',{status:206,headers:{'content-type':'application/pdf','content-range':'bytes 0-4/50','content-length':'5','accept-ranges':'bytes'}}):originalFetch(url,options);
 try{
  const response=await originalFetch(base+'/books/'+id+'/file',{headers:{Cookie:admin,Range:'bytes=0-4'}});
  assert.equal(response.status,206);assert.equal(response.headers.get('content-range'),'bytes 0-4/50');assert.equal(await response.text(),'%PDF-');
 }finally{global.fetch=originalFetch;}
 fields.title='Updated Drive textbook';assert.equal((await request('/admin/books/'+id,form(),admin)).status,200);
 const mixed=form();mixed.append('pdf',new Blob(['%PDF-test']),'test.pdf');assert.equal((await request('/admin/books',mixed,admin)).status,400);
 fields.driveLink='https://evil.com/file.pdf';assert.equal((await request('/admin/books',form(),admin)).status,400);
 fields.driveLink='';const replacement=form();replacement.append('pdf',new Blob([await fs.readFile(path.join(__dirname,'fixtures/reader-sample.pdf'))]),'replacement.pdf');
 assert.equal((await request('/admin/books/'+id,replacement,admin)).status,200);
 assert.ok(!(await db.query('SELECT pdf_path FROM books WHERE id=$1',[id])).rows[0].pdf_path.startsWith('https:'));
 assert.equal((await request('/admin/books/'+id+'/delete',{},admin)).status,200);
});
