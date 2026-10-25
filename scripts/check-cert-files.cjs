// Checks certificate files BEFORE you install them in cPanel, so you do not
// find out about a mistake only after the website breaks.
//   node scripts/check-cert-files.cjs certificate.crt private.key ca_bundle.crt [site.med-ify.live]
// Nothing is uploaded or changed; the files are only read.
const fs = require("node:fs");
const { X509Certificate, createPrivateKey } = require("node:crypto");

const [certFile, keyFile, bundleFile, hostArg] = process.argv.slice(2);
const host = hostArg || "site.med-ify.live";
let failed = false;
const ok = (m) => console.log("  OK   " + m);
const bad = (m) => { console.log("  FAIL " + m); failed = true; };
const warn = (m) => console.log("  WARN " + m);

if (!certFile || !keyFile) {
  console.log("Usage: node scripts/check-cert-files.cjs certificate.crt private.key [ca_bundle.crt] [hostname]");
  process.exit(2);
}
const read = (f) => { try { return fs.readFileSync(f, "utf8"); } catch (e) { console.log(`Cannot read ${f}: ${e.message}`); process.exit(2); } };
const pems = (text) => text.match(/-----BEGIN CERTIFICATE-----[\s\S]*?-----END CERTIFICATE-----/g) || [];

const certText = read(certFile);
const leafPem = pems(certText)[0];
if (!leafPem) { bad("The certificate file contains no '-----BEGIN CERTIFICATE-----' block. Did you pick the key or the bundle by mistake?"); process.exit(1); }
const leaf = new X509Certificate(leafPem);
const chain = [...pems(certText).slice(1), ...(bundleFile ? pems(read(bundleFile)) : [])].map((p) => new X509Certificate(p));

console.log(`Checking certificate for ${host}\n`);
console.log("1. Name");
if (leaf.checkHost(host)) ok(`covers ${host}`);
else bad(`does NOT cover ${host}. Names in certificate: ${leaf.subjectAltName || leaf.subject}. Issue the certificate for exactly this hostname.`);
console.log("   names: " + (leaf.subjectAltName || leaf.subject.replace(/\n/g, ", ")));

console.log("\n2. Dates");
const now = Date.now(), from = new Date(leaf.validFrom), to = new Date(leaf.validTo);
if (now < from) bad(`not valid until ${leaf.validFrom}`);
else if (now > to) bad(`EXPIRED on ${leaf.validTo}`);
else {
  const days = Math.floor((to - now) / 86400000);
  ok(`valid until ${leaf.validTo} (${days} days left)`);
  if (days < 20) warn("expires soon: renew it and set a calendar reminder.");
}

console.log("\n3. Private key matches the certificate");
try {
  const key = createPrivateKey(read(keyFile));
  if (leaf.checkPrivateKey(key)) ok("the private key belongs to this certificate");
  else bad("this private key does NOT match the certificate. Use the key that was created together with this certificate request.");
} catch (e) {
  bad("could not read the private key (" + e.message + "). It must be the unencrypted '-----BEGIN PRIVATE KEY-----' / 'RSA PRIVATE KEY' text.");
}

console.log("\n4. Certificate chain (CA bundle)");
if (leaf.issuer === leaf.subject) {
  bad("this is a SELF-SIGNED certificate; browsers will not trust it. Get one from a public authority (Let's Encrypt, ZeroSSL...).");
} else if (!chain.length) {
  warn("no CA bundle given. Browsers may still fail with 'incomplete chain'. In cPanel paste the bundle (often named ca_bundle.crt) into the 'Certificate Authority Bundle' box.");
} else {
  // Walk up: each certificate must be signed by the next one.
  let current = leaf, linked = true;
  for (const issuer of chain) {
    if (current.checkIssued(issuer) && current.verify(issuer.publicKey)) { current = issuer; }
    else { linked = false; break; }
  }
  if (linked) ok(`chain links up through ${chain.length} certificate(s); top issuer: ${current.issuer.replace(/\n/g, ", ")}`);
  else warn("the bundle does not form an unbroken chain from your certificate. Re-download the bundle from the same order, or install it exactly as provided.");
}

console.log(failed ? "\nResult: do NOT install yet (see FAIL lines)." : "\nResult: files look good. Paste them into cPanel > SSL/TLS > Manage SSL sites.");
process.exitCode = failed ? 1 : 0;
