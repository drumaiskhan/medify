// Public deployment settings. These are URLs only; never put secrets here.
// On the live domains the production addresses below are used. When the site is
// opened from this computer (localhost / 127.0.0.1) it calls "/api" on its own
// address; the Vite dev server forwards that to the local backend (port 3002),
// so `npm run dev` never talks to the live server.
(function () {
  var host = location.hostname;
  var local = host === "localhost" || host === "127.0.0.1" || host === "[::1]" || host === "::1";
  var base = location.protocol + "//" + host;
  window.MEDIFY_CONFIG = local
    ? {
        API_URL: "/api",
        STUDENT_URL: base + ":3000",
        ADMIN_URL: base + ":3001"
      }
    : {
        API_URL: "https://site.med-ify.live/api",
        STUDENT_URL: "https://med-ify.live",
        ADMIN_URL: "https://admin.med-ify.live"
      };
})();
