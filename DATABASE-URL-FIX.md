# Medify production database connection fix

This repository includes the admin-login database fix confirmed on cPanel. The production backend requires `DATABASE_URL` and refuses to start unless the URL database name is `medschoolpro_medify`. This prevents inherited PG* variables from routing Medify to the MedSchoolProffs database. Local PGlite mode remains available with `MEDIFY_LOCAL_DB=true`.

## Deploy
1. Upload/push the project to your Medify GitHub repository, not MedSchoolProffs.
2. Set `DATABASE_URL` privately in the Medify cPanel app environment and/or `backend/.env`, using the form `postgresql://medschoolpro_Medify:URL_ENCODED_PASSWORD@127.0.0.1:5432/medschoolpro_medify`. Encode special characters in the password (for example `@` as `%40`). Do not commit `.env`.
3. Set `MEDIFY_LOCAL_DB=false`, `NODE_ENV=production`, `DB_SSL=false`, `FRONTEND_ORIGINS=https://med-ify.live,https://admin.med-ify.live`, `STUDENT_URL=https://med-ify.live`, and other app settings as needed.
4. Ensure the cPanel app root and startup file point to Medify `backend/app.js`; restart the Medify Node application.
5. Confirm `/api/health` and `/api/healthz`, then test administrator login.

## Notes
- Do not run the Medify schema initialization against the MedSchoolProffs database. The production database-name guard prevents this if `NODE_ENV=production`.
- Diagnostic password-validation logging has not been added to the distributed code.
- Rotate previously exposed database and administrator credentials.
- SSL/AutoSSL and SMTP configuration are separate hosting tasks and are not changed by this archive.
- The archive is source code, not a backup of production database content or uploaded books.
