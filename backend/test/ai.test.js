// AI settings helpers: encrypted key storage, safe parsing of model answers, provider call shape.
const { test } = require("node:test");
const assert = require("node:assert/strict");
const http = require("node:http");
const { parseMap, encrypt, decrypt } = require("../ai");

test("API keys round-trip encrypted and tampering is rejected", () => {
  const blob = encrypt("sk-test-1234567890abcdef");
  assert.ok(!blob.includes("sk-test"));
  assert.equal(decrypt(blob), "sk-test-1234567890abcdef");
  assert.equal(decrypt(blob.slice(0, -2) + "AA"), "");
});

test("parseMap cleans model output and drops dangling edges", () => {
  const map = parseMap(
    'Sure!\n```json\n{"title":"Inflammation","summary":"s","nodes":[{"id":"a","label":"Core","detail":"d","group":"core"},{"id":"b","label":"Child","detail":"d","group":"bogus"},{"id":"a","label":"Dupe"}],"edges":[{"from":"a","to":"b","label":"causes"},{"from":"a","to":"zzz","label":"x"}]}\n```',
  );
  assert.equal(map.nodes.length, 2);
  assert.equal(map.nodes[1].group, "other");
  assert.equal(map.edges.length, 1);
  assert.throws(() => parseMap("not json"), /could not be read/);
  assert.throws(() => parseMap('{"nodes":[{"id":"a","label":"only"}]}'), /usable map/);
});

test("OpenAI-compatible call sends the key and reads the reply", async () => {
  let seen;
  const srv = http.createServer((req, res) => {
    let body = "";
    req.on("data", (c) => (body += c));
    req.on("end", () => {
      seen = { auth: req.headers.authorization, body: JSON.parse(body), url: req.url };
      res.setHeader("content-type", "application/json");
      res.end(JSON.stringify({ choices: [{ message: { content: "OK" } }] }));
    });
  });
  await new Promise((r) => srv.listen(0, "127.0.0.1", r));
  const ai = require("../ai");
  // callModel is internal; exercise it through a throwaway app-less route handler substitute.
  const routes = {};
  const app = { get: (p, ...h) => (routes["GET " + p] = h.pop()), post: (p, ...h) => (routes["POST " + p] = h.pop()) };
  let stored = {};
  const pool = {
    query: async (sql, args) => {
      if (/CREATE TABLE/.test(sql)) return {};
      if (/SELECT data/.test(sql)) return { rows: stored.data ? [{ data: stored.data }] : [] };
      if (/INSERT INTO ai_config/.test(sql)) { stored.data = args[0]; return {}; }
      return { rows: [{ count: 1 }] };
    },
  };
  ai.installAi(app, pool);
  const admin = { id: "a", role: "admin" };
  const wrapRun = (route, user, body) =>
    new Promise((resolve) => {
      let out;
      const res = { json: (v) => { out = v; resolve({ out }); }, status() { return this; } };
      routes[route]({ user, body }, res, (e) => resolve({ err: e }));
    });
  // Non-admin cannot read or write settings.
  assert.equal((await wrapRun("GET /api/admin/ai", { id: "s", role: "student" }, {})).err.status, 403);
  // Private/non-https base URLs are refused.
  assert.equal((await wrapRun("POST /api/admin/ai", admin, { provider: "openai", baseUrl: "http://localhost:1/v1", apiKey: "k".repeat(20) })).err.status, 400);
  // Save a key, then confirm the response never contains it.
  const saved = await wrapRun("POST /api/admin/ai", admin, { provider: "openai", model: "m1", apiKey: "sk-secret-ABCD1234" });
  assert.equal(saved.out.keyHint, "••••••••1234");
  assert.ok(!JSON.stringify(saved.out).includes("secret"));
  assert.ok(!JSON.stringify(stored.data).includes("sk-secret"));
  // Point at the mock provider (bypassing the https-only admin validation) and run the test route.
  stored.data.baseUrl = `http://127.0.0.1:${srv.address().port}/v1`;
  const t = await wrapRun("POST /api/admin/ai/test", admin, {});
  assert.equal(t.out.ok, true);
  assert.equal(seen.auth, "Bearer sk-secret-ABCD1234");
  assert.equal(seen.url, "/v1/chat/completions");
  assert.equal(seen.body.model, "m1");
  srv.close();
});
