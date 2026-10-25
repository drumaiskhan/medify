# Medify complete GitHub deployment package

Repository: https://github.com/drumaiskhan/medify (branch `main`).

## Contents
- Complete student and admin Vite source
- Complete backend source with automatic additive PostgreSQL schema initialization
- Optional **create-only** initial admin provisioning on backend startup
- GitHub Actions FTPS deployment workflow and setup guide in `deployment/GITHUB-AUTO-DEPLOY.md`

## One-time configuration
1. Back up your existing Medify database, `.env`, and uploaded books/notes.
2. In cPanel Medify app settings / private `.env`, set `ADMIN_EMAIL=syednangyal@gmail.com` and `ADMIN_PASSWORD` to your intended initial password (previously requested: Syed12345). Do NOT commit this secret to GitHub. The account is created only if missing; an existing account is not reset.
3. Configure the 12 GitHub Actions FTP secrets described in `deployment/GITHUB-AUTO-DEPLOY.md` and ensure FTPS access is enabled.
4. Push this project to `drumaiskhan/medify` on `main`.
5. After first successful admin login, change the password and remove `ADMIN_PASSWORD` from the server environment.

## Important
- Do not deploy this repository into MedSchoolProffs paths.
- Do not upload `.env` to GitHub. Existing cPanel `.env` and stored files are not deleted by the workflow.
- The FTP workflow requires valid FTPS credentials and a correctly configured destination; it is not active until secrets are configured.
- A trusted SSL certificate for `site.med-ify.live` must be installed by the host; source code cannot fix certificate trust.
- Database initialization uses schema.sql; review and back up before first production deployment.
- If an admin already exists but has the wrong password, run the `admin` script from cPanel's JS script runner with private ADMIN_EMAIL and ADMIN_PASSWORD variables; automatic startup does not overwrite existing credentials.
