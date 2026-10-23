const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const os = require("node:os");
const { storageRoot, checkStorage } = require("../storage");
test("production refuses missing, relative, and deployment-local storage", () => {
  for (const UPLOAD_DIR of [
    undefined,
    "uploads",
    path.resolve(__dirname, "../uploads"),
    path.resolve(__dirname, ".."),
  ]) {
    assert.throws(() => storageRoot({ NODE_ENV: "production", UPLOAD_DIR }));
  }
});
test("storage checks preserve an existing book across restarts", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "medify-disk-"));
  try {
    const env = { NODE_ENV: "production", UPLOAD_DIR: root };
    assert.equal(checkStorage(env), root);
    fs.writeFileSync(path.join(root, "book.upload"), "existing PDF bytes");
    checkStorage(env);
    checkStorage(env);
    assert.equal(
      fs.readFileSync(path.join(root, "book.upload"), "utf8"),
      "existing PDF bytes",
    );
    assert.deepEqual(fs.readdirSync(root), ["book.upload"]);
  } finally {
    fs.rmSync(root, { recursive: true });
  }
});
test("an unusable storage target fails before serving uploads", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "medify-bad-disk-"));
  try {
    const target = path.join(root, "file");
    fs.writeFileSync(target, "file");
    assert.throws(() =>
      checkStorage({ NODE_ENV: "production", UPLOAD_DIR: target }),
    );
  } finally {
    fs.rmSync(root, { recursive: true });
  }
});
