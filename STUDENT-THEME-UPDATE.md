# Student theme + notes reader update

## Theme
The student app now uses the same teal palette as the admin panel
(primary #1B8E8E, hover #147273, navy #0F2837, borders #CFDBE5, surfaces #E8EEF3).
The indigo/violet colours were replaced everywhere in `student/` (CSS, TSX, index.html).

## Notes reader (`/read/...`)
- Old page-scrolling reader with the top navbar was removed; it now uses the new full-screen layout.
- Compact 48px top bar (back, chapters toggle, title, text size, light/dark).
- Chapter list is a full-height panel that scrolls on its own, shows full titles and follows your position.
- Only the notes pane scrolls (with a thin progress bar). Search, highlights and
  "Continue where you left off" were adapted to the scrolling pane.
- Files: `student/src/pages/ReaderPage.tsx`, `student/src/notesReader.css`,
  `student/src/components/NoteBody.tsx`, `student/src/App.tsx`.

Run `cd student && npm ci && npm run build` before deploying.
