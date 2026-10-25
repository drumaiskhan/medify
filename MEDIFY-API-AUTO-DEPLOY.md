# Medify API cPanel auto-deploy

Only the `backend/` directory is deployed to cPanel. Hostinger deploys student/admin separately.

## GitHub Actions repository secrets
- `API_FTP_SERVER`: `business300.mypowerfulserver.com` (verify with hosting provider)
- `API_FTP_USERNAME`: `medifydeploy@site.med-ify.live`
- `API_FTP_PASSWORD`: password of the dedicated FTP account
- `API_FTP_PORT`: `21` (explicit FTPS)
- `API_FTP_DIR`: `/` if this account's FTP root is `/home2/medschoolpro/medify-api`

## cPanel setup (one time)
- Node application root: `/home2/medschoolpro/medify-api`
- Startup file: `app.js`
- Set production environment variables including `DATABASE_URL` (or `PG*`), `FRONTEND_ORIGINS`, `STUDENT_URL`, `NODE_ENV=production`, and storage variables.
- Set `ADMIN_EMAIL` and `ADMIN_PASSWORD` to bootstrap the initial admin **only if no account with that email exists**. Remove `ADMIN_PASSWORD` after initial provisioning. For an existing account with an unknown password, reset it via a controlled admin recovery procedure; the bootstrap intentionally does not overwrite passwords.
- Ensure production dependencies have been installed via cPanel's Run NPM Install once. FTPS does not install node_modules. Repeat installation when dependencies change.
- On each app start, `backend/app.js` applies idempotent `schema.sql` and creates the initial admin when configured. Missing PostgreSQL tables are created automatically; an incorrect database connection or insufficient CREATE permissions will cause startup to fail loudly rather than run with broken login.
- On deploy, GitHub uploads backend files without deleting server files and touches `tmp/restart.txt` for Passenger restart. Passenger must support this restart mechanism and have permissions to write the `tmp` folder. Confirm via health check and cPanel logs.
- Keep `.env`, uploads and persistent storage on cPanel. Never commit secrets or production data.

If GitHub reports an FTPS certificate failure, use the hostname from cPanel FTP connection details matching its certificate; do not disable certificate verification.
