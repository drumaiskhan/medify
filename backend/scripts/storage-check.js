require("dotenv").config({
  path: require("node:path").join(__dirname, "../.env"),
});
const fs = require("node:fs");
const path = require("node:path");
try {
  const root = require("../storage").checkStorage();
  let bytes = 0,
    files = 0;
  for (const name of fs.readdirSync(root)) {
    const stat = fs.lstatSync(path.join(root, name));
    if (stat.isFile()) {
      files++;
      bytes += stat.size;
    }
  }
  console.log(
    `Private storage: ${root}\nRead/write: OK\nFiles: ${files}\nUsed by files in this folder: ${(bytes / 1e9).toFixed(3)} GB`,
  );
  console.log(
    "Your hosting account quota is authoritative. Check cPanel Disk Usage for the remaining portion of your 50 GB allowance.",
  );
} catch (e) {
  console.error(e.message);
  process.exitCode = 1;
}
