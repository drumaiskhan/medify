// Checks the live API address: DNS, HTTPS certificate, /api/health and CORS for
// your website addresses. It sends no data and changes nothing.
//   npm run check:live                  (checks site.med-ify.live)
//   node scripts/check-live.cjs api.example.com
const dns = require("node:dns").promises;
const https = require("node:https");
const tls = require("node:tls");

const [hostArg = "site.med-ify.live"] = process.argv.slice(2);
const [host, port = "443"] = hostArg.replace(/^https?:\/\//, "").replace(/\/.*$/, "").split(":");
const origins = (process.env.CHECK_ORIGINS || "https://med-ify.live,https://admin.med-ify.live,https://www.med-ify.live")
  .split(",").map((s) => s.trim()).filter(Boolean);
const ok = (m) => console.log("  OK   " + m);
const bad = (m) => { console.log("  FAIL " + m); failed = true; };
const info = (m) => console.log("       " + m);
let failed = false;

const CERT_HELP = {
  DEPTH_ZERO_SELF_SIGNED_CERT: "The server presents a SELF-SIGNED certificate (usually cPanel's default). Browsers will always warn. In cPanel > SSL/TLS Status, select this domain and run AutoSSL.",
  SELF_SIGNED_CERT_IN_CHAIN: "The certificate chain contains a self-signed certificate that browsers do not trust. Run AutoSSL or install a certificate from a public authority.",
  UNABLE_TO_VERIFY_LEAF_SIGNATURE: "The certificate is missing its INTERMEDIATE chain. In cPanel > SSL/TLS > Manage SSL sites, re-install the certificate with the CA bundle, or run AutoSSL again.",
  UNABLE_TO_GET_ISSUER_CERT_LOCALLY: "The certificate chain is incomplete (issuer certificate missing). Re-install with the CA bundle or run AutoSSL again.",
  CERT_HAS_EXPIRED: "The certificate has EXPIRED. Run AutoSSL / renew it in cPanel.",
  CERT_NOT_YET_VALID: "The certificate is not valid yet. Check the server clock and the certificate dates.",
  ERR_TLS_CERT_ALTNAME_INVALID: "The certificate is issued for a DIFFERENT name than " + host + ". Issue a certificate that includes exactly this hostname (AutoSSL for this subdomain).",
  ENOTFOUND: "DNS does not resolve this name. Create the DNS record pointing to the cPanel server's IP address.",
  ECONNREFUSED: "Nothing is listening on this address/port. Check the IP, firewall and that the server is running.",
  ETIMEDOUT: "The connection timed out. Check the IP address and the firewall.",
};

function request(method, path, headers = {}) {
  return new Promise((resolve, reject) => {
    const req = https.request({ host, port, path, method, headers, timeout: 10000 }, (res) => {
      let body = ""; res.on("data", (c) => (body += c));
      res.on("end", () => resolve({ status: res.statusCode, headers: res.headers, body }));
    });
    req.on("timeout", () => req.destroy(Object.assign(new Error("timeout"), { code: "ETIMEDOUT" })));
    req.on("error", reject);
    req.end();
  });
}

// Read-only look at the certificate the server presents (no request is sent).
function inspectCertificate() {
  return new Promise((resolve) => {
    const s = tls.connect({ host, port: Number(port), servername: host, rejectUnauthorized: false, timeout: 8000 }, () => {
      const c = s.getPeerCertificate();
      s.end();
      resolve(c && c.subject ? c : null);
    });
    s.on("error", () => resolve(null));
    s.on("timeout", () => { s.destroy(); resolve(null); });
  });
}

(async () => {
  console.log(`Checking https://${host}${port === "443" ? "" : ":" + port}\n`);
  console.log("1. DNS");
  try {
    const addrs = await dns.lookup(host, { all: true });
    ok("resolves to " + addrs.map((a) => a.address).join(", "));
    info("This must be your cPanel (API) server's IP, not your website host's.");
  } catch (e) { bad(`${host} does not resolve (${e.code}). ${CERT_HELP.ENOTFOUND}`); return; }

  console.log("\n2. HTTPS certificate (as a normal browser sees it)");
  let health;
  try {
    health = await request("GET", "/api/health");
    ok("certificate is trusted and matches " + host);
  } catch (e) {
    bad(`${e.code || e.message}`);
    info(CERT_HELP[e.code] || String(e.message));
    const c = await inspectCertificate();
    if (c) {
      info("Certificate presented by the server:");
      info("  subject : " + (c.subject.CN || JSON.stringify(c.subject)));
      info("  names   : " + (c.subjectaltname || "(none)"));
      info("  issuer  : " + (c.issuer.O || "") + " " + (c.issuer.CN || ""));
      info("  valid   : " + c.valid_from + "  ->  " + c.valid_to);
    }
    console.log("\nFix the certificate first, then run this check again.");
    return;
  }

  console.log("\n3. API health");
  if (health.status === 200) ok("/api/health -> 200 " + health.body.trim().slice(0, 80));
  else bad(`/api/health -> HTTP ${health.status} ${health.body.trim().slice(0, 100)}. The API is up but unhealthy: check the cPanel app log (database / environment).`);

  console.log("\n4. CORS (can your websites call the API?)");
  for (const origin of origins) {
    try {
      const r = await request("OPTIONS", "/api/auth/login", {
        Origin: origin, "Access-Control-Request-Method": "POST", "Access-Control-Request-Headers": "content-type",
      });
      if (r.status === 204 && r.headers["access-control-allow-origin"] === origin && r.headers["access-control-allow-credentials"] === "true") ok(origin + " is allowed");
      else bad(`${origin} is BLOCKED (HTTP ${r.status}). Add it to FRONTEND_ORIGINS on the server and restart the app.`);
    } catch (e) { bad(`${origin}: ${e.code || e.message}`); }
  }
})().then(() => {
  console.log(failed ? "\nResult: problems found (see FAIL lines)." : "\nResult: everything looks good.");
  process.exitCode = failed ? 1 : 0;
});
