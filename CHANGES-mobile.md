# Mobile friendly pass (student + admin)

**Both sites**
- Pages can use the full phone screen including the notch area (`viewport-fit=cover`) and keep clear of the home bar.
- Form fields are 16px on phones, so iPhones no longer zoom in when you tap a field.
- Bigger tap targets (44px) for menu and toolbar buttons; nothing scrolls sideways by accident.

**Student site**
- Book reader: tools sit in one swipeable row, the sidebar slides over the page and closes when you tap outside it or jump to a page, pages use nearly the full screen width, "Show tools" button floats above the home bar.
- Workspace top bar and menu respect the notch / home bar.

**Admin site**
- Menu drawer and top bar fit phone screens (drawer is full height, header is compact).
- Pop-up windows scroll when taller than the screen; notices appear across the bottom instead of being cut off at the left edge.
- Tables scroll inside their card.

Files: `student/src/mobile.css`, `admin/src/mobile.css`, end of `student/src/library.css`, `student/src/pages/BookReaderPage.tsx`, `admin/src/pages/admin/AdminPage.tsx`, both `index.html`.
