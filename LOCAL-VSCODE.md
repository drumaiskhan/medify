# Run MEDIFY in VS Code — Windows, macOS or Linux

Install Node.js **24 LTS** (22.13+ also works) and VS Code. Local development uses a file-backed embedded database by default, so Docker is not required. Open the extracted **medify folder itself** in VS Code, then use Terminal → New Terminal:

```sh
npm run setup
npm run db:init
npm run dev
```

- Student: http://localhost:3000
- Admin: http://localhost:3001
- API health: http://localhost:3002/api/health
- Your local admin credentials: `.local-data/LOCAL-ACCESS.txt`.

Setup installs each application's locked dependencies and creates local environment files only when absent. It does not replace existing configuration. Database initialization preserves records and does not reset an existing administrator. The local database is stored in `.local-data/postgres/`. Use `localhost`, not a mix of `localhost` and `127.0.0.1`, in browser URLs.

`npm run dev` starts three separate processes; Ctrl+C stops them together. Or select **MEDIFY: all apps** in VS Code Run and Debug and press F5 after setup and database initialization. Do not run F5 and `npm run dev` together. Tasks are available from Terminal → Run Task. If a port is busy, startup fails visibly instead of silently moving a frontend to a different port.

## PostgreSQL without Docker

Install PostgreSQL 13+ yourself, create a database and a dedicated login with ownership of it, run `npm run setup`, then edit `backend/.env` to use that database. Skip `npm run db:start`; run `npm run db:init` and `npm run dev`. The generated Docker URL uses port **5433** on your computer, so it does not compete with a usual local PostgreSQL on 5432.

## Local storage and email

PDFs and covers go to `.local-data/books/`; the database contains metadata, not PDF blobs. Registration/reset emails are JSON files in `.local-data/outbox/` when `MAIL_MODE=local`. Open the newest file to copy its verification/reset link. This mode never sends mail and is forbidden in production. Do not share these files: they contain tokens. To test real delivery, clear MAIL_MODE and configure SMTP in backend/.env.

`npm run db:stop` stops PostgreSQL without deleting its Docker volume. Restart with `npm run db:start`. Do not use `docker compose down -v` unless you intend to erase the local database. Books and the database are separate; back up both for a complete restore. Local files, credentials and database volumes must not be uploaded with production source.

## Daily commands

```sh
npm run dev           # Run API, admin and student
npm run build         # Rebuild both frontend dist folders
npm test              # Backend integration and storage checks
npm run storage:check # Check upload path and report folder usage
```

If the database is not ready, rerun `npm run db:start`; for a native database check the service and DATABASE_URL. If installation fails, ensure Node is 24 and internet access is available for npm. If the project folder moves, update the absolute UPLOAD_DIR in backend/.env to the new `.local-data/books` location and move the existing files with it.

## Default administrator

`npm run db:init` creates a local-only administrator (`admin@medify.local`) with a random password and writes it to `.local-data/LOCAL-ACCESS.txt`. There are no default credentials in the code. For production, create your administrator with `ADMIN_EMAIL` and a unique `ADMIN_PASSWORD` of at least 12 characters (`npm run admin` in `backend`), then remove the password from the environment. Existing accounts are not changed by normal startup or repeated database initialization.

To explicitly create/reset this account in an initialized database, run from the medify root:

```sh
npm run admin:reset
```

This revokes this account's existing sessions. Credentials are embedded only in backend setup code; database passwords remain hashed. Change the administrator password before making the site public. Database connection settings are still required.

## "Failed to fetch" or "Failed to Load Curriculum" on localhost

When opened from `localhost` or `127.0.0.1`, the student and admin apps call `/api` on their own address, and the Vite dev server forwards it to the backend on port 3002 (set `MEDIFY_API_TARGET` to change that). On your real domains, `public/config.js` still points to the live API. If you see the error locally:

1. The **backend must be running** as well as the website. Starting only the student site (for example with "run app in browser") is not enough. Run `npm run dev` from the project folder and keep it open; it starts the API, student and admin together.
2. Open http://localhost:3002/api/health. It should respond. If it does not, the backend is not running or `backend/.env` is missing: run `npm run setup`, then `npm run db:init`, then `npm run dev`. Read the backend lines in the terminal for the real error (for example a database problem).
3. After updating files, stop `npm run dev`, start it again, and hard-refresh the page (Cmd+Shift+R on Mac, Ctrl+Shift+R on Windows).
