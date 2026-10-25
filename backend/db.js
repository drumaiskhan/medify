require("dotenv").config({
  path: require("node:path").join(__dirname, ".env"),
});
const { Pool } = require("pg");
if (process.env.MEDIFY_LOCAL_DB === "true") {
  const fs = require("node:fs");
  const path = require("node:path");
  const { PGlite } = require("@electric-sql/pglite");
  const dataDir = process.env.MEDIFY_LOCAL_DB_DIR
    ? path.resolve(process.env.MEDIFY_LOCAL_DB_DIR)
    : path.join(__dirname, "../.local-data/postgres");
  const database = new PGlite(dataDir);
  const ready = database.exec(
    fs.readFileSync(path.join(__dirname, "schema.sql"), "utf8"),
  );
  module.exports = {
    query: (...args) => ready.then(() => database.query(...args)),
    exec: (sql) => ready.then(() => database.exec(sql)),
    connect: async () => {
      await ready;
      return {
        query: (...args) => database.query(...args),
        release() {},
      };
    },
    end: () => ready.then(() => database.close()),
  };
} else {
  // Require an explicit connection URL so cPanel's inherited PG* variables
  // cannot silently connect Medify to the MedSchoolProffs database.
  if (!process.env.DATABASE_URL) {
    throw new Error("[Medify] DATABASE_URL is required for PostgreSQL mode");
  }
  const url = new URL(process.env.DATABASE_URL);
  const databaseName = decodeURIComponent(url.pathname.slice(1));
  if (process.env.NODE_ENV === "production" && databaseName !== "medschoolpro_medify") {
    throw new Error("[Medify] Refusing to connect to an unexpected production database");
  }
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    max: Number(process.env.DB_POOL_MAX || 5),
    connectionTimeoutMillis: 10000,
    idleTimeoutMillis: 30000,
    ssl: process.env.DB_SSL === "true" ? { rejectUnauthorized: true } : false,
  });
  pool.on("error", (e) => console.error("PostgreSQL pool error:", e.message));
  module.exports = pool;
}
