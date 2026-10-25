# Why old student UI appeared

The new React sidebar is in `student/src/components/StudentWorkspace.tsx` and the dashboard is in `student/src/pages/DashboardPage.tsx`. The old public homepage continued to show for signed-in users at `/`; now it redirects to `/dashboard` after authentication resolves. The app shell cache has been bumped and static assets are fetched network-first, so prior service worker assets do not continue showing an older version after a successful Hostinger deployment.

## Hostinger Git deployment — student project (`med-ify.live`)

If the Hostinger Git deploy settings use repository root, set **Build command** to `npm ci --prefix student && npm run build --prefix student` and **Output/publish directory** to `student/dist` (relative to repository root). If Hostinger instead sets **Project root** to `student`, use `npm ci && npm run build` and publish directory `dist`. Do not combine the two configurations.

The `backend` GitHub Actions FTPS workflow deploys only to cPanel and does NOT update student site. Verify Hostinger latest deployed Git commit matches your push. Visit `/dashboard` while logged in. In Chrome DevTools > Application > Service Workers, unregister the old service worker / clear site data only if old assets persist. Confirm the browser is loading the newly generated `assets/*.js` filenames.

To verify source: `grep -n "sw-dashboard-highlight" student/src/pages/DashboardPage.tsx` should find the redesigned UI, and `student/src/components/StudentWorkspace.tsx` implements the sidebar.

No API, PostgreSQL schema, subscription rules or admin frontend business logic changed.
