const fs = require("node:fs");
const path = require("node:path");
const crypto = require("node:crypto");
function storageRoot(env = process.env) {
  const configured = env.UPLOAD_DIR?.trim();
  if (env.NODE_ENV === "production") {
    if (!configured || !path.isAbsolute(configured))
      throw Error(
        "Production requires an absolute UPLOAD_DIR on persistent private storage.",
      );
    const relative = path.relative(__dirname, configured);
    if (
      !relative ||
      (!relative.startsWith(".." + path.sep) &&
        relative !== ".." &&
        !path.isAbsolute(relative))
    )
      throw Error(
        "UPLOAD_DIR must be outside the backend deployment directory so redeployment preserves books.",
      );
  }
  return configured
    ? path.resolve(__dirname, configured)
    : path.join(__dirname, "private-uploads");
}
function checkStorage(env = process.env) {
  const root = storageRoot(env);
  fs.mkdirSync(root, { recursive: true, mode: 0o700 });
  const probe = path.join(root, `.write-check-${crypto.randomUUID()}`);
  try {
    fs.writeFileSync(probe, "ok", { flag: "wx", mode: 0o600 });
  } finally {
    if (fs.existsSync(probe)) fs.unlinkSync(probe);
  }
  return root;
}
module.exports = { storageRoot, checkStorage };
