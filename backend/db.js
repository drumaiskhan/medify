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
  if (!process.env.DATABASE_URL && !process.env.PGDATABASE)
    throw new Error(
      "Set DATABASE_URL or PGDATABASE with PostgreSQL connection variables",
    );
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL || undefined,
    max: Number(process.env.DB_POOL_MAX || 5),
    connectionTimeoutMillis: 10000,
    idleTimeoutMillis: 30000,
    ssl: process.env.DB_SSL === "true" ? { rejectUnauthorized: true } : false,
  });
  pool.on("error", (e) => console.error("PostgreSQL pool error:", e.message));
  module.exports = pool;
}
