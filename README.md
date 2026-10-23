# MEDIFY — Local, Hostinger & cPanel

This package contains three independently deployable applications:

| Folder | Purpose | Deployment |
|---|---|---|
| `backend/` | Express API, PostgreSQL storage, sessions and email | cPanel Node.js / Passenger, startup `app.js` |
| `admin/` | Administrator React frontend | Upload contents of `admin/dist/` to the admin subdomain's document root |
| `student/` | Student React frontend | Upload contents of `student/dist/` to the student domain's document root |

For this feature update and upgrade steps, read **FEATURES-AND-UPGRADE.md**. For a new installation, start with **CPANEL-DEPLOYMENT.md**. Both frontend `dist` folders are already built, including PDF.js worker and supporting assets. Edit each uploaded `config.js` to set your API and frontend URLs. Source code, lockfiles, environment examples and Apache SPA rewrite files are included.

## What changed

- Removed Firebase SDK, project configuration, browser database connection, Firestore rules, and the hardcoded founder-email admin bypass.
- PostgreSQL owns accounts, hashed passwords, server sessions, email-action tokens, rate limits and application records. Application records use indexed PostgreSQL JSONB to preserve existing curriculum/content/profile field shapes, rather than inventing a new incompatible hierarchy.
- Browser data helpers call the separate HTTP API. The API enforces administrator permissions, profile ownership, payment ownership, publication status and approved-year access.
- Cookies are HttpOnly, host-only and secure in production. Browser POSTs require an allowlisted Origin. All SQL values are parameterized.
- Payment verification updates entitlement in the same database transaction. Duplicate payment references cannot overwrite an existing request. Students cannot set approval, payment verification or purchased-year fields.
- Password-reset links are single use, expire after one hour and revoke old sessions. Email verification and reset delivery use your SMTP server.
- Student builds contain no admin page. The admin has its own entry point, login and deployment. Shared utilities are copied into each app so neither deployment needs the other folder.
- New block/subject IDs include their parent IDs to prevent same-name subjects in different blocks overwriting each other.

## Local development in VS Code

Open this `medify` folder in VS Code. Install Node 24 and Docker Desktop, then run:

```sh
npm run setup
npm run db:start
npm run db:init
npm run dev
```

Student: http://localhost:3000 · Admin: http://localhost:3001. Default admin credentials are in `.local-data/LOCAL-ACCESS.txt`. See **LOCAL-VSCODE.md** for F5 debugging, native PostgreSQL instead of Docker, and local verification emails.

## Choose a hosting setup

- **cPanel:** follow **CPANEL-DEPLOYMENT.md**, using `backend/.env.cpanel.example` as your production template.
- **Hostinger frontends with cPanel API/SSD (recommended for your 50 GB storage):** follow **HOSTINGER-DEPLOYMENT.md**.
- **Hostinger VPS:** ready Docker/Caddy deployment in `deployment/`, with persistent database and book storage on the VPS.
- **Private PDF storage, quotas, backups and updates:** see **BOOK-STORAGE.md**.

Production requires an explicit absolute UPLOAD_DIR outside the backend deployment folder. This prevents accidental use of a replaceable code folder for uploaded books. Frontend dist folders remain prebuilt and independent.

## Data and source limitations

The original ZIP is source code, not an export of its Firebase database or user accounts. No live notes, students, payment records or Firebase passwords were included, so those records have **not** been migrated. The optional seed inserts the starter Years and Modules (see CHANGES-v1.3.md), without overwriting existing records. Seed subjects are drafts until notes are uploaded and published by an administrator.

To move existing live data, obtain a separate database/auth export and map accounts and their record IDs deliberately. Do not copy Firebase password hashes into `accounts.password_hash`: this backend uses scrypt with its own format. Existing users need a suitable migration/reset workflow.

Payment account details, prices, contact information and branding from the original app remain. Review them in Admin and the frontend source before accepting payments. This keeps the original manual approval model: plan duration is displayed, but automatic subscription expiry/renewal billing was not present in the source and is not added here. Content access requires verified email plus administrator approval (or a published free sample).

## Checks completed

- TypeScript checks and production builds passed for both frontends.
- Backend HTTP integration suite: 27 tests passed using PGlite's embedded PostgreSQL engine, including registration, login/session handling, email verification, filtered queries, access control, payment duplication/approval, transactional rollback, CSRF, and password reset/session revocation.
- Local setup configuration preservation and three-process launcher/shutdown passed isolated fixture checks. Compose YAML and VS Code configuration parse successfully. Docker is not installed in the validation environment, so Docker database startup and the VPS stack have not been executed here.
- No live cPanel/Hostinger server or external PostgreSQL credentials were provided. cPanel deployment, remote PostgreSQL connectivity and actual SMTP delivery must be checked after configuration.
- Browser checks passed for admin login, PDF/thumbnail upload, book editing, reader rendering, pen controls, hiding/showing the toolbar, search, notes, bookmarks and saved-position restoration. Desktop/mobile screens were inspected.

Run `npm test` in `backend/` to reproduce integration tests; development dependencies are needed for testing. Production uses `pg`, not PGlite.

## Layout and maintenance

`backend/schema.sql` is idempotent and non-destructive. `npm run migrate` executes it explicitly; startup never silently changes your database. Existing records are stored under their original logical collection names in `records(collection,id,data)`.

Notes are uploaded as DOCX in the admin and converted/sanitized in the browser using the existing reader processing. Each API batch of up to 400 records is transactional; a multi-batch upload is not one global transaction. Back up PostgreSQL before large content changes.

See `backend/.env.example` for connection pool, proxy and SMTP settings. Keep the backend and `.env` outside public document roots. Do not upload `node_modules` from another operating system.

## Default administrator

`npm run db:init` creates a local-only administrator (`admin@medify.local`) with a random password and writes it to `.local-data/LOCAL-ACCESS.txt`. There are no default credentials in the code. For production, create your administrator with `ADMIN_EMAIL` and a unique `ADMIN_PASSWORD` of at least 12 characters (`npm run admin` in `backend`), then remove the password from the environment. Existing accounts are not changed by normal startup or repeated database initialization.

To explicitly create/reset this account in an initialized database, run from the medify root:

```sh
npm run admin:reset
```

This revokes this account's existing sessions. Credentials are embedded only in backend setup code; database passwords remain hashed. Change the administrator password before making the site public. Database connection settings are still required.


## Version 1.2
See `CHANGES-v1.2.md` for the list of changes and `UPLOADING-NOTES.md` for how to upload notes with images.
