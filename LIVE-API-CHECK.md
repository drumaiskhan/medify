# "Failed to Load Curriculum" / "Failed to fetch" on the live site

Both messages mean the browser could not get a usable reply from the API (`https://site.med-ify.live/api`). **Quick automatic check:** from this project folder run `npm run check:live` (or `node scripts/check-live.cjs your-api-host`). It tests DNS, the HTTPS certificate (and tells you if it is self-signed, expired, missing its chain or for the wrong name), `/api/health`, and whether your websites are allowed by CORS.

Note: opening the bare address `https://site.med-ify.live` now shows `{"service":"MEDIFY API","status":"running"...}`. (It used to say "Route not found", which is normal for an API that only serves `/api/...`.) A red struck-through `https` / "Not secure" in the address bar means the certificate is not trusted: see step 0.

Check in this order:

0. **HTTPS certificate for the API address.** `https://site.med-ify.live` must have a valid, publicly trusted SSL certificate. Without it, browsers refuse every API call ("Failed to fetch"). A browser where you once clicked "Proceed anyway" (often your own Chrome) will keep working, while every other browser, profile or device fails. Always test in a private window or a different browser. To fix: in cPanel open **SSL/TLS Status**, tick `site.med-ify.live`, click **Run AutoSSL**, wait a few minutes, then reload `https://site.med-ify.live/api/health` and confirm there is a padlock and no warning. If AutoSSL fails, the usual reasons are: the `site` DNS record does not point to the cPanel server's IP, the subdomain does not exist in cPanel Domains, or a CAA record / DNS proxy (for example Cloudflare, which needs "Full (strict)") is in the way.

1. **Open https://site.med-ify.live/api/health in a browser tab.**
   - Shows a small JSON "ok": the API is running. The problem is CORS (step 2).
   - Shows a server error page (503/500, "Application error", Passenger page) or does not load: the API is down or crashed on start (step 3).
2. **CORS.** In the cPanel Node app environment set `FRONTEND_ORIGINS=https://med-ify.live,https://admin.med-ify.live` and `STUDENT_URL=https://med-ify.live`, then restart the app. The API now also accepts `www`/non-`www` forms and trailing slashes, and writes `[Medify] Blocked a request from <origin>` to the app log for any site it refuses.
3. **API will not start.** Read the cPanel Node app log (stderr / `Passenger` log). Common causes: `DATABASE_URL` missing or wrong (the database must be named `medschoolpro_medify`), an absolute `UPLOAD_DIR` missing or inside the backend folder, `ADMIN_EMAIL`/`ADMIN_PASSWORD` invalid, or "Run NPM Install" not run after a deploy. Fix it, then restart the app (`tmp/restart.txt` or the Restart button).
4. The error message on the site now tells you which case you are in: `(E_SERVER)` = API unreachable or down, `(E_CORS)` = API answered but the browser blocked the reply (CORS setup or an API error page), `(E_RETRY)` = a temporary connection problem.

## If your cPanel has no AutoSSL

You need a publicly trusted certificate for `site.med-ify.live`. Pick one:

**A. Ask your hosting provider (free, try this first).** Send this ticket: *"Please enable AutoSSL (or install a free Let's Encrypt/Sectigo certificate) for site.med-ify.live on my cPanel account, including the full certificate chain, and confirm it is set to auto-renew."* Most hosts do this in minutes. Then run `npm run check:live`.

**B. Install a free certificate by hand (no change to anything else).**
1. Create a free certificate for exactly `site.med-ify.live` at zerossl.com (or run `certbot certonly --manual --preferred-challenges dns -d site.med-ify.live` on your computer). Prove ownership with the DNS TXT/CNAME record they show you, added where your domain's DNS is managed.
2. Download the certificate (`certificate.crt`), the CA bundle (`ca_bundle.crt`) and the private key (`private.key`).
3. Check them: `npm run check:cert -- certificate.crt private.key ca_bundle.crt site.med-ify.live`. Do not install if it says FAIL.
4. cPanel > SSL/TLS > **Manage SSL sites** (Install an SSL Website): choose `site.med-ify.live`, paste the certificate, the private key and the CA bundle, and click **Install Certificate**.
5. Run `npm run check:live`.
Free certificates last 90 days. Set a reminder to repeat steps 1-4 every ~60 days, or the same errors will return.

**C. Cloudflare in front of the API (auto-renewing, but bigger change).** Move the domain's DNS to Cloudflare (recreate every record, including email/MX), proxy only the `site` record (orange cloud), and set SSL/TLS mode to **Full**. Note: the API limits logins and sign-ups per IP address, and behind Cloudflare every visitor can look like Cloudflare's address until `TRUST_PROXY_HOPS` is set correctly, so test this carefully before using it for real students.
