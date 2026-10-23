const fs = require("node:fs");
const path = require("node:path");
const crypto = require("node:crypto");
const { spawn, spawnSync } = require("node:child_process");
const root = path.resolve(__dirname, "..");
const npm = process.platform === "win32" ? "npm.cmd" : "npm";
function run(command, args, folder = root, env = process.env) {
  const result = spawnSync(command, args, {
    cwd: folder,
    env,
    stdio: "inherit",
    shell: process.platform === "win32" && command === npm,
  });
  if (result.error) throw result.error;
  if (result.status !== 0)
    throw Error(
      `${command} failed (${result.status}). Fix the error above and rerun.`,
    );
}
function writeNew(file, contents) {
  if (fs.existsSync(file)) return false;
  fs.writeFileSync(file, contents, { flag: "wx", mode: 0o600 });
  return true;
}
async function main() {
  const [major, minor] = process.versions.node.split(".").map(Number);
  if (major < 22 || (major === 22 && minor < 13))
    throw Error("Install Node.js 24 LTS (or 22.13+) first.");
  const action = process.argv[2];
  if (action === "setup") {
    const envFile = path.join(root, "backend/.env");
    const composeFile = path.join(root, ".env");
    let password;
    if (fs.existsSync(composeFile)) {
      password = fs
        .readFileSync(composeFile, "utf8")
        .match(/^MEDIFY_DB_PASSWORD=([a-f0-9]+)$/m)?.[1];
    } else {
      password = crypto.randomBytes(24).toString("hex");
      writeNew(
        composeFile,
        `# Local Docker database only. Never publish this file.\nMEDIFY_DB_PASSWORD=${password}\n`,
      );
    }
    if (!fs.existsSync(envFile)) {
      if (!password)
        throw Error(
          "Existing root .env needs MEDIFY_DB_PASSWORD; configure backend/.env manually.",
        );
      writeNew(
        envFile,
        `NODE_ENV=development\nMEDIFY_LOCAL_DB=true\nPORT=3002\nDATABASE_URL=postgresql://medify:${password}@127.0.0.1:5433/medify\nDB_SSL=false\nFRONTEND_ORIGINS=http://localhost:3000,http://localhost:3001,http://127.0.0.1:3000,http://127.0.0.1:3001\nSTUDENT_URL=http://localhost:3000\nCOOKIE_SECURE=false\nTRUST_PROXY_HOPS=0\nMAIL_MODE=local\nUPLOAD_DIR=${JSON.stringify(path.join(root, ".local-data/books").replaceAll("\\", "/"))}\nMAX_BOOK_MB=100\n`,
      );
    }
    for (const folder of ["backend", "student", "admin"])
      run(npm, ["ci"], path.join(root, folder));
    console.log(
      "\nSetup complete. Existing configuration was preserved.\nNext: npm run db:start, npm run db:init, npm run dev\nFor installed PostgreSQL, edit backend/.env and skip db:start.",
    );
  } else if (action === "init") {
    require(path.join(root, "backend/node_modules/dotenv")).config({
      path: path.join(root, "backend/.env"),
    });
    if (process.env.NODE_ENV !== "development")
      throw Error(
        "Local init requires NODE_ENV=development. Use backend migration/admin commands in production.",
      );
    run(process.execPath, ["scripts/migrate.js"], path.join(root, "backend"));
    run(process.execPath, ["scripts/seed.js"], path.join(root, "backend"));
    const pool = require(path.join(root, "backend/db"));
    try {
      const exists = await pool.query(
        "SELECT id FROM accounts WHERE role='admin' LIMIT 1",
      );
      if (exists.rows.length) {
        console.log(
          "An administrator already exists; its password was not changed.",
        );
        return;
      }
      // Local-only administrator: random password, shown once in a private file.
      const email = process.env.LOCAL_ADMIN_EMAIL || "admin@medify.local";
      const password = crypto.randomBytes(12).toString("base64url");
      run(process.execPath, ["scripts/admin.js"], path.join(root, "backend"), {
        ...process.env,
        ADMIN_EMAIL: email,
        ADMIN_PASSWORD: password,
      });
      fs.mkdirSync(path.join(root, ".local-data"), {
        recursive: true,
        mode: 0o700,
      });
      fs.writeFileSync(
        path.join(root, ".local-data/LOCAL-ACCESS.txt"),
        `LOCAL DEVELOPMENT ONLY - never reuse this password in production.\nAdmin: http://localhost:3001\nEmail: ${email}\nPassword: ${password}\n`,
        { mode: 0o600 },
      );
      console.log(
        "Local administrator created. Open .local-data/LOCAL-ACCESS.txt for credentials.",
      );
    } finally {
      await pool.end();
    }
  } else if (action === "dev") {
    if (!fs.existsSync(path.join(root, "backend/.env")))
      throw Error("Run npm run setup first.");
    // Direct Node processes ensure Ctrl+C stops all three apps on Windows too.
    const specs = [
      ["backend", ["app.js"]],
      [
        "student",
        [
          "node_modules/vite/bin/vite.js",
          "--host",
          "127.0.0.1",
          "--port",
          "3000",
          "--strictPort",
        ],
      ],
      [
        "admin",
        [
          "node_modules/vite/bin/vite.js",
          "--host",
          "127.0.0.1",
          "--port",
          "3001",
          "--strictPort",
        ],
      ],
    ];
    const children = [];
    let stopping = false;
    function stop(code) {
      if (stopping) return;
      stopping = true;
      for (const child of children) child.kill();
      process.exitCode = code;
    }
    for (const [folder, args] of specs) {
      const child = spawn(process.execPath, args, {
        cwd: path.join(root, folder),
        stdio: "inherit",
      });
      children.push(child);
      child.on("error", (e) => {
        console.error(e.message);
        stop(1);
      });
      child.on("exit", (code) => {
        if (!stopping) stop(code || 1);
      });
    }
    process.on("SIGINT", () => stop(0));
    process.on("SIGTERM", () => stop(0));
    console.log(
      "Student: http://localhost:3000 | Admin: http://localhost:3001 | API: http://localhost:3002/api",
    );
  } else throw Error("Expected setup, init or dev");
}
main().catch((e) => {
  console.error(e.message);
  process.exitCode = 1;
});
