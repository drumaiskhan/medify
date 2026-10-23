# Deploy MEDIFY on cPanel

## 1. Hosting requirements and domains

Your host must enable **PostgreSQL** and **Setup Node.js App / Application Manager (Passenger)**. Ordinary PHP-only cPanel hosting cannot run this API. Use Node 22.13+ or Node 24. The cPanel server chooses the public application port through Passenger.

Create and enable valid HTTPS certificates for three addresses under the SAME base domain:

- Student: `https://medify.example.com`
- Admin: `https://admin.example.com`
- API: `https://api.example.com`

Replace these examples with your own domains. Same-base-domain HTTPS hosting is required by the default `SameSite=Lax` session cookie configuration. Separate unrelated domains need a different cookie/CSRF design; do not work around this by exposing session tokens to browser storage.

## 2. Create PostgreSQL database and user

In cPanel PostgreSQL Databases, create a database and user, then add the user to the database with the required privileges. Use the full cPanel-prefixed names shown by your hosting panel.

Example backend configuration:

```dotenv
DATABASE_URL=postgresql://account_medify:URL_ENCODED_PASSWORD@127.0.0.1:5432/account_medify
DB_SSL=false
DB_POOL_MAX=5
```

Percent-encode reserved characters in the password when using a connection URL. `127.0.0.1:5432` is appropriate only when PostgreSQL runs on the same hosting server and accepts TCP connections. Some cPanel providers allow only a local Unix socket; in that case leave `DATABASE_URL` blank and set `PGHOST=/var/run/postgresql`, `PGPORT=5432`, `PGDATABASE`, `PGUSER`, and `PGPASSWORD` (using the socket directory confirmed by your host). The backend supports these variables directly. Do not assume enabling external port 5432 is needed for an API on the same server. A separate laptop/VS Code connection can require an SSH tunnel.

For remote PostgreSQL with verified TLS, set `DB_SSL=true` and use a trusted CA/certificate configuration. Do not disable certificate verification.

## 3. Install the backend

Upload the contents of `backend/` to a private application folder such as `/home/CPANEL_USER/medify-api`, outside `public_html`.

Create a Node application with:

| Setting | Value |
|---|---|
| Node | 22.13+ or 24 |
| Mode | Production |
| Application root | `medify-api` |
| Application URL | API subdomain, root path `/` |
| Startup file | `app.js` |

The code already includes `/api` in its routes. Do not mount the app at `/api` as well.

Copy `.env.cpanel.example` to `.env` in the application folder, or set variables in the Node app panel:

```dotenv
NODE_ENV=production
DATABASE_URL=postgresql://account_medify:ENCODED_PASSWORD@127.0.0.1:5432/account_medify
DB_SSL=false
DB_POOL_MAX=5
UPLOAD_DIR=/home/CPANEL_USER/medify-private-books
MAX_BOOK_MB=100
FRONTEND_ORIGINS=https://medify.example.com,https://admin.example.com
STUDENT_URL=https://medify.example.com
COOKIE_SECURE=true
TRUST_PROXY_HOPS=1
SMTP_HOST=mail.example.com
SMTP_PORT=465
SMTP_USER=noreply@example.com
SMTP_PASSWORD=YOUR_MAIL_PASSWORD
SMTP_FROM=MEDIFY <noreply@example.com>
ADMIN_EMAIL=you@example.com
ADMIN_PASSWORD=YOUR_UNIQUE_LONG_PASSWORD
```

Origins have no trailing slash. Set `TRUST_PROXY_HOPS` to the actual trusted proxy count your host confirms; the example `1` assumes one trusted reverse proxy. Never blindly trust every forwarded IP header.

Use the hosting panel's displayed virtual-environment activation command before running npm commands in Terminal. Then, from the backend folder:

```bash
npm ci --omit=dev
npm run migrate
npm run seed
npm run admin
```

`seed` is optional and preserves existing records. Remove `ADMIN_PASSWORD` after the admin command. Running the admin command again resets that account's password and invalidates its sessions. No preset account receives administrator access.

Start/restart from the panel. Application Manager installations can also restart through `tmp/restart.txt`:

```bash
mkdir -p tmp
touch tmp/restart.txt
```

Open `https://api.example.com/api/healthz`. Expect `{"status":"ok","database":"postgresql"}`. If it fails, inspect Node application logs and verify the database connection and schema before proceeding.

## 4. Upload the prebuilt frontends

- Upload the **contents** of `student/dist/` into the student domain document root.
- Upload the **contents** of `admin/dist/` into the admin subdomain document root.
- Include the entire `pdf-assets/` folder, which supplies PDF fonts, CMaps and decoders.
- Include hidden `.htaccess` in both. In cPanel File Manager enable “Show Hidden Files” when needed.
- Do not upload backend files, `.env`, source directories or `node_modules` into these public roots.

Edit `config.js` in BOTH deployed roots:

```javascript
window.MEDIFY_CONFIG = {
  API_URL: "https://api.example.com/api",
  ADMIN_URL: "https://admin.example.com",
  STUDENT_URL: "https://medify.example.com"
};
```

These URLs are public. Never put database, mail or admin credentials in `config.js`. Clear browser/CDN cache after changing the file. The production builds work without installing Node for the frontend domains.

For future source changes, in each frontend folder:

```bash
npm ci
npm run build
```

Then re-upload that app's `dist/`. Set its `public/config.js` before building to carry domain settings into the new build, or re-edit deployed `config.js` afterward.

## 5. First-use verification

1. Sign in to the admin URL with the account created by `npm run admin`.
2. Review payment account details and contact information. Upload DOCX notes to a subject; preview and publish it. Mark one subject as a free sample if desired.
3. Register a student account, receive and open its verification email. Confirm that dashboard refresh shows the address as verified.
4. Submit a test/manual payment request; confirm it appears in Admin. Verify it, then check that only that purchased year's paid notes open.
5. Check that an unapproved account cannot open paid notes, and that a free sample opens without payment.
6. Test password reset and direct navigation/refresh at `/login`, `/dashboard`, `/admin`, and a reader URL. `.htaccess` handles SPA routes.

SMTP is necessary for verification and password resets. Missing SMTP is reported as an error; the server never marks an address verified merely because registration succeeded. The default verification/reset link returns to the student site, including when an admin requests a reset.

## Troubleshooting

- **Database connection refused:** verify whether the provider uses TCP or a Unix socket; confirm database/user permissions. A successful cPanel login does not establish PostgreSQL access.
- **503/500 / app does not start:** confirm Node version, `app.js`, activated Node environment, dependencies, env values and `npm run migrate`. Read the Passenger/Node log.
- **CORS / “Origin not allowed”:** put the exact student and admin origins into `FRONTEND_ORIGINS` and restart the API.
- **Login succeeds but session disappears:** check HTTPS on all three domains, the common base domain, `config.js`, and API response cookies. Requests already use `credentials: 'include'`.
- **Deep link returns Apache 404:** upload `.htaccess` and confirm mod_rewrite is enabled.
- **Blank curriculum:** run seed or create years in Admin. Subjects stay unpublished until you publish uploaded notes.
- **Large DOCX fails:** notes are split into parts, but the host's HTTP request-body limit must allow the configured API body size (25 MB). Reduce the upload size or ask the host to adjust its limit.

## Backups and cleanup

Use your hosting database backup facility, or PostgreSQL `pg_dump`, before migrations and large content changes. Store backups privately and verify a restore in a separate database. Also back up the private `UPLOAD_DIR`: book PDFs and thumbnails are stored there, not in PostgreSQL.

Periodically delete expired entries from `sessions`, `auth_tokens`, and `rate_limits` using a database maintenance job; expiry is checked on every use even before cleanup.

## Official deployment references

- https://docs.cpanel.net/knowledge-base/web-services/how-to-install-a-node.js-application/
- https://docs.cpanel.net/cpanel/software/application-manager/
- https://support.cpanel.net/hc/en-us/articles/1500002443862-How-to-restart-an-application-that-s-using-cPanel-s-Application-Manager

For book upload limits, reader features and upgrading an existing deployment, see **FEATURES-AND-UPGRADE.md**.

## Persistent SSD storage and other hosting options

Use `backend/.env.cpanel.example` for production settings. Set `UPLOAD_DIR=/home/CPANEL_USER/medify-storage/books` using your real account home path. This must be outside both public_html and the backend deployment directory; startup now checks it. Run `npm run storage:check` in backend. See **BOOK-STORAGE.md** for the 50 GB quota, safe upgrades and backups.

The same static frontends can be hosted at Hostinger while this cPanel API serves books from your SSD. See **HOSTINGER-DEPLOYMENT.md**. For local VS Code use **LOCAL-VSCODE.md**.
