require("dotenv").config({
  path: require("node:path").join(__dirname, ".env"),
});
require("./storage").checkStorage();
const pool = require("./db");
const { createApp } = require("./server");
if (
  process.env.NODE_ENV === "production" &&
  (!process.env.FRONTEND_ORIGINS || !process.env.STUDENT_URL)
)
  throw Error("Set FRONTEND_ORIGINS and STUDENT_URL for production");
let sendMail;
if (process.env.SMTP_HOST) {
  const transport = require("nodemailer").createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT || 587),
    secure: process.env.SMTP_PORT === "465",
    auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASSWORD },
  });
  sendMail = (msg) =>
    transport.sendMail({ ...msg, from: process.env.SMTP_FROM });
}
if (process.env.MAIL_MODE === "local") {
  if (process.env.NODE_ENV !== "development")
    throw Error("Local mail mode is development-only");
  const fs = require("node:fs");
  const path = require("node:path");
  const outbox = path.join(__dirname, "../.local-data/outbox");
  fs.mkdirSync(outbox, { recursive: true, mode: 0o700 });
  sendMail = async (message) => {
    const file = path.join(
      outbox,
      `${Date.now()}-${require("node:crypto").randomUUID()}.json`,
    );
    fs.writeFileSync(file, JSON.stringify(message, null, 2), { mode: 0o600 });
    console.log(`Development email saved: ${file}`);
  };
}
// Initialize missing PostgreSQL tables before accepting API traffic.
// schema.sql uses CREATE TABLE IF NOT EXISTS and additive migrations;
// existing account, curriculum and book records are retained.
const fs = require("node:fs");
const path = require("node:path");
async function start() {
  const schema = fs.readFileSync(path.join(__dirname, "schema.sql"), "utf8");
  if (pool.exec) await pool.exec(schema);
  else await pool.query(schema);
  console.log("[Medify] Database tables verified/created");
  await require("./bootstrap-admin").provisionInitialAdmin(pool);
  const app = createApp(pool, { sendMail });
  const server = app.listen(process.env.PORT || 3002, () =>
    console.log("MEDIFY API listening"),
  );
  for (const signal of ["SIGTERM", "SIGINT"])
    process.on(signal, () =>
      server.close(() => pool.end().then(() => process.exit(0))),
    );
}
start().catch(async (err) => {
  console.error("[Medify] Database initialization failed:", err);
  try { await pool.end(); } catch (_) {}
  process.exitCode = 1;
});
// Passenger loads this CommonJS app.js directly; no TypeScript runtime needed.
