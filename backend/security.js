const crypto = require("node:crypto");
const { promisify } = require("node:util");
const scrypt = promisify(crypto.scrypt);
const hashToken = (t) => crypto.createHash("sha256").update(t).digest("hex");
async function passwordHash(password) {
  const salt = crypto.randomBytes(16).toString("hex");
  return salt + ":" + (await scrypt(password, salt, 64)).toString("hex");
}
async function passwordMatches(password, hash) {
  const [salt, hex] = hash.split(":");
  const actual = await scrypt(password, salt, 64);
  const expected = Buffer.from(hex, "hex");
  return (
    actual.length === expected.length &&
    crypto.timingSafeEqual(actual, expected)
  );
}
const fail = (status, message) => {
  const e = new Error(message);
  e.status = status;
  throw e;
};
function validatePassword(p) {
  if (typeof p !== "string" || p.length < 8 || p.length > 256)
    fail(400, "Password must contain 8–256 characters");
}
module.exports = {
  hashToken,
  passwordHash,
  passwordMatches,
  fail,
  validatePassword,
};
