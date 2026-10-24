# Medify settings and browser access

Admin > Settings > Payments lets admins edit the three existing subscription prices, display names, billing descriptions, benefits and recommendation badges. Plan IDs and subscription durations remain unchanged. New purchases and discount validation use server-side PostgreSQL prices. Existing payments are unaffected.

Admin > Settings > Platform lets admins edit the support email, phone, WhatsApp, HTTPS website, location, founder and footer copy. These are saved in `site_settings`, exposed through `/api/site-settings`, and shown on the student site. The PostgreSQL settings table already exists; no migration is required.

## Browser / SSL

Browsers cannot be instructed by application JavaScript to ignore a bad SSL certificate for HTTPS API calls. `https://site.med-ify.live` must have a valid, publicly trusted TLS certificate and complete intermediate chain. Configure AutoSSL/Let's Encrypt on cPanel for that hostname. Use the same trusted HTTPS API address in both Hostinger frontend builds. Don't use `curl -k`, `rejectUnauthorized:false` or certificate bypass flags in production; these mask the problem and undermine security. Mixed-content API URLs (HTTP calls from HTTPS frontend) will be blocked.

## Deployment

Back up PostgreSQL, deploy the backend API and restart the cPanel Node app, and let Hostinger rebuild the student/admin frontends from the same update. Preserve `.env` and upload storage. Verify `/api/healthz`, `/api/site-settings` and the admin settings save operation before testing payment flows. This archive is source code; it has not been deployed to the live host.
