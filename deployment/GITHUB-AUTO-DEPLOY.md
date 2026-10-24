# Medify GitHub automatic deployment (Hostinger + cPanel)

On each push to `main`, GitHub Actions builds student/admin frontends, uploads both builds to Hostinger over **FTPS**, uploads backend source to cPanel over **FTPS**, requests a Passenger restart using `tmp/restart.txt`, and checks the API health endpoint. A manual **Run workflow** option is also available.

## Configure GitHub repository secrets

GitHub repository → Settings → Secrets and variables → Actions → **New repository secret**. Add all 12 secrets:

| Secret | Value |
|---|---|
| `STUDENT_FTP_HOST` | Hostinger FTP server hostname for student site |
| `STUDENT_FTP_USER` | Student FTP account username |
| `STUDENT_FTP_PASSWORD` | Student FTP password |
| `STUDENT_FTP_DIR` | Student site's **actual** web root as seen by FTP (often `/public_html`) |
| `ADMIN_FTP_HOST` | Hostinger FTP server hostname for admin site |
| `ADMIN_FTP_USER` | Admin FTP account username |
| `ADMIN_FTP_PASSWORD` | Admin FTP password |
| `ADMIN_FTP_DIR` | Admin site's actual FTP web root |
| `API_FTP_HOST` | cPanel FTP server hostname |
| `API_FTP_USER` | FTP account with access to the Medify application root |
| `API_FTP_PASSWORD` | cPanel FTP password |
| `API_FTP_DIR` | Medify Node application root **as visible to this FTP account** |

**Critical:** The API FTP account must have access to `/home2/medschoolpro/medify-api` (possibly mapped to `/` if the FTP account is jailed there). A public_html-only FTP account cannot deploy a private cPanel Node app. Ask the host to create a scoped FTPS account or enable SSH-based Git deployment if necessary. Do not enter a guessed remote directory.

FTPS must be supported by the FTP servers with a valid certificate. This is independent of the API website SSL certificate. The workflow will fail rather than transfer credentials without TLS.

## First-time hosting preparation

1. Confirm both Hostinger sites accept **static built files** via FTP. Some Hostinger **Web App** products use Git deployment rather than an FTP-accessible web root; for those, configure Hostinger's own GitHub auto-deploy instead of these two FTP steps.
2. On cPanel, install backend dependencies using **Run NPM Install** once. Repeat when `backend/package.json` or lockfile changes. This workflow does not run `npm install` on the server.
3. Preserve the existing production `.env` in cPanel. It is **not** uploaded. Database contents and external book storage are not modified.
4. Back up the Medify backend directory and database before enabling automated production deployments.
5. Confirm the cPanel application is managed by **Passenger** and that uploading `tmp/restart.txt` triggers a restart. If your host requires a restart through the control panel, remove the restart step and restart manually after deployment.
6. Fix the API's public SSL certificate before relying on the final health check. This check deliberately does not use `-k`.

## Important limitations

- The upload is **non-destructive**: no remote files are deleted. This protects `.env`, stored PDFs, and uploads, but obsolete hashed frontend assets can remain. Clean old assets manually after checking the site.
- Automatic deployment **does not automatically create database tables or reset administrator passwords**. Use the application's documented migration/provisioning process separately.
- A green workflow means files uploaded and the API health endpoint responded; it does **not** prove login works.
- Backend deployment uses the files in `backend/`, not a generated cPanel ZIP from an earlier conversation. If your live API has newer fixes (auto-table creation or admin provisioning), merge those into this source repository **before** enabling auto-deploy, or it may overwrite those fixes.
- Do not commit `.env`, database passwords, or any generated admin credentials to GitHub. Rotate any credentials that have been shared.

## Push to GitHub

```powershell
cd "C:\path\to\medify"
git add .
git commit -m "Add Medify GitHub auto deployment"
git push origin main
```

Open the repository **Actions → Deploy Medify** to see deployment logs. To avoid overwriting production before configuring secrets, add secrets and review paths before pushing this workflow to `main`.
