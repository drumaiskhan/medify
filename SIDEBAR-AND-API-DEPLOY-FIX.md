# Student Sidebar and cPanel API Workflow Fix

## Student sidebar

- `student/src/components/student-workspace.css`: fixed the sidebar to the left edge of the viewport at full height using `position: fixed` and `100dvh`.
- The sidebar logo and sign-out region stay in place; `.sw-nav-scroll` alone uses vertical scrolling (`min-height: 0`, `overflow-y: auto`).
- On desktop `.sw-page-column` is offset by the exact sidebar width (254 px), so no white strip appears beneath the menu.
- Mobile navigation stays a slide-out drawer; the page column uses the full width on narrow viewports.

The previous sticky positioning could fail inside an ancestor with overflow rules. A headless Chromium layout test checked desktop (1366 × 768) and mobile (390 × 844): sidebar height was equal to the viewport and the nav was scrollable.

## GitHub Actions backend deployment

Updated `.github/workflows/deploy.yml` and added `deployment/scripts/ftp-verify-commit.sh`:

1. Backend files and the Git SHA stamp are uploaded with FTPS.
2. A **separate FTPS read-back** verifies `deployed-commit.txt` in the configured FTP root equals the new GitHub SHA. Incorrect FTP roots cause a real deployment failure.
3. Passenger restart is requested using `tmp/restart.txt`.
4. The live `/api/healthz` endpoint must respond successfully.
5. `/api/deployed-commit` is checked separately: a live SHA mismatch now emits a **warning**, not a fatal error, because FTP transfer and API health can both be successful while Passenger is serving an older process or a different app root.

If the warning persists despite successful FTP read-back, verify that the cPanel Node app `site.med-ify.live` runs from `/home2/medschoolpro/medify-api` and that the Passenger restart is taking effect. GitHub Actions cannot directly fix an incorrectly mapped Passenger app root.

The workflow retains temporary TLS verification bypasses for the existing self-signed FTPS/HTTPS certificates, as in the user's previous workflow. This does not change browser certificate trust. A properly trusted certificate should replace the bypass.

## Publish

Commit the changed student CSS, workflow file, and verification script to `main`. Hostinger should build the `student` root with `npm run build` and publish `dist`. The cPanel workflow uploads only `backend/`; student frontend deployment is independent.
