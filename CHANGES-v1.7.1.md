# Medify v1.7.1 — Admin sidebar scrolling

The fixed admin sidebar now scrolls vertically when its contents exceed the screen height, on desktop and mobile. A thin styled scrollbar is provided; sidebar children keep their normal height instead of shrinking. All menu items and bottom account actions remain reachable. Scrolling at the sidebar boundary no longer chains to the page.

Only admin/src/studio.css changed. Rebuild and deploy the admin frontend. No backend or database update is needed from v1.7.

Validation: admin TypeScript check and Vite production build passed. Browser interaction was not tested.
