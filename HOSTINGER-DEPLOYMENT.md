# Hostinger deployment

## Recommended: Hostinger frontends + cPanel API/storage

This uses the **50 GB cPanel account storage** you already have. Upload the contents of `student/dist/` and `admin/dist/` to separate Hostinger domain/subdomain public roots, including `.htaccess` and `pdf-assets/`. Host the API and PostgreSQL on cPanel following `CPANEL-DEPLOYMENT.md` and `BOOK-STORAGE.md`.

Use sibling custom domains under one registered domain, for example:

| Address | Server |
|---|---|
| study.example.com | Hostinger student static website |
| admin.example.com | Hostinger admin static website |
| api.example.com | cPanel Node API + private book files |

Set DNS records for each server. Enable HTTPS on all three. In **both** uploaded frontend `config.js` files set API_URL to `https://api.example.com/api`, ADMIN_URL to `https://admin.example.com`, STUDENT_URL to `https://study.example.com`. Set the API FRONTEND_ORIGINS and STUDENT_URL to those exact frontend origins. Cookies use SameSite=Lax, so unrelated provider preview domains are not a supported authenticated setup. No build is necessary just to change these public URLs.

Books uploaded from the Hostinger admin are sent directly to the cPanel API and stored in its UPLOAD_DIR. They do not consume Hostinger frontend disk space. A Hostinger backend cannot use `/home/CPANEL_USER/...` as a remote disk path.

## Entire application on a Hostinger VPS

This alternative stores books on the **VPS disk**, not on your cPanel SSD. A ready Docker Compose deployment is in `deployment/`. Use a Linux VPS with Docker Engine and Compose installed, sufficient disk space, and ports 80/443 open. Keep PostgreSQL's port private; the supplied compose file does not publish it.

1. Upload the `medify` folder to the VPS, excluding all `.env`, `.local-data`, local uploads and node_modules. Prebuilt frontend dist folders are supplied. Put the project outside any existing public web root.
2. Point three sibling DNS names to the VPS. Copy `deployment/.env.vps.example` to `deployment/.env`; replace every placeholder. Use a new long random database password. Set production SMTP.
3. Edit **both** dist/config.js files with the three HTTPS URLs described above. If you rebuild later, put those same public settings into public/config.js before building.
4. Create a persistent book directory owned by the container's Node user:

```sh
sudo mkdir -p /srv/medify/books
sudo chown 1000:1000 /srv/medify/books
sudo chmod 700 /srv/medify/books
cd deployment
docker compose -f compose.vps.yaml up -d --wait postgres
docker compose -f compose.vps.yaml build api
docker compose -f compose.vps.yaml run --rm api npm run migrate
docker compose -f compose.vps.yaml run --rm api npm run seed
```

5. Create the administrator. In the VPS Bash terminal, enter the email and a strong password without saving the password in shell history:

```sh
read -r -p 'Admin email: ' ADMIN_EMAIL
read -r -s -p 'Admin password: ' ADMIN_PASSWORD
export ADMIN_EMAIL ADMIN_PASSWORD
docker compose -f compose.vps.yaml run --rm -e ADMIN_EMAIL -e ADMIN_PASSWORD api npm run admin
unset ADMIN_EMAIL ADMIN_PASSWORD
docker compose -f compose.vps.yaml up -d
docker compose -f compose.vps.yaml exec api npm run storage:check
```

Caddy obtains HTTPS certificates once DNS and ports are correct. Check all three domains and `/api/health`, upload and open a book, restart the API, and verify the same book still opens. Update source/dist, rebuild the API, run migrations explicitly, then `docker compose -f compose.vps.yaml up -d --build`. Keep `/srv/medify/books` and database volume intact. Never use `down -v` for normal updates. Back up PostgreSQL and `/srv/medify/books` together; see BOOK-STORAGE.md.

## Hostinger managed Node.js hosting

The backend is a conventional Express app and can be deployed as a Node web app from the **backend folder**, with Node 24, install `npm ci --omit=dev`, startup `npm start` / `app.js`. Supply production environment variables through the host panel. Do not upload the workspace root as an Express app. Run schema migration/admin bootstrap once from a trusted machine with connectivity to the same database.

Use an external reachable PostgreSQL database with verified TLS (`DB_SSL=true`) or a VPS database. Hostinger's Web/Cloud plans do not provide an in-account PostgreSQL server. **Before hosting uploads on managed Node, obtain a provider-confirmed persistent, private, writable absolute UPLOAD_DIR outside the deployed application folder.** If your plan does not provide it, use the recommended cPanel API arrangement or VPS option. Do not point to a temporary build directory: startup intentionally rejects an unset or in-project production upload path. No claim is made that managed deployments preserve arbitrary filesystem writes.

Official provider references checked for this package:
- https://www.hostinger.com/support/how-to-deploy-a-nodejs-website-in-hostinger/
- https://www.hostinger.com/support/which-databases-and-data-tools-are-supported-at-hostinger/

No hosting account credentials were supplied; these are deployable configurations, not an already-live installation.
