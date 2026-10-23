# MEDIFY Library & Reader update

## Included in this update

### Admin workspace

- MedSchoolProffs-inspired sidebar, overview cards, quick actions and responsive mobile navigation.
- Separate pages for Books, Subject Notes, Curriculum, Students & Payments, Payment Details, and Settings.
- PDF uploads with progress feedback; a custom thumbnail or an automatically generated first-page cover.
- Title, author, description, academic year and subject/category metadata.
- Draft/published control and free/member access.
- Edit metadata, replace a PDF or thumbnail, and confirm before deleting a book.
- Site name, library tagline, accent colour, announcement, support email, registration switch, library switch, and default reader theme.
- Hosting information panel showing configured SMTP status and upload limit without exposing credentials.

### Student library

- Book covers, author/category search, year and subject filters.
- Account-saved favourites, progress bars and a Continue Reading card.
- Free books can be opened anonymously; saving reading activity requires an account.
- Member books require verified email and approval for the book's year. File requests enforce access on the server.

### Comfortable PDF reader

- Continuous scrolling with nearby-page rendering and a canvas pixel budget.
- HTTP range requests for loading portions of larger files; locally bundled PDF.js worker, fonts, CMaps and decoding assets.
- Page number navigation, previous/next buttons, PDF contents, text selection and full-document text search.
- Light, sepia and night themes; fit-width zoom controls.
- Windows/Edge-style pen controls: select a pen colour and thickness, then the chooser closes while the pen remains active.
- Pen sizes: 1, 2, 4, 6, 9 and 12 pixels. Pen colour and thickness are remembered on the device.
- Hide tools & study / Show tools: hide the complete toolbar and keep a small floating recovery button.
- Area highlighter, freehand pen, eraser, page bookmarks and written notes.
- Stylus/mouse drawing; in pen mode fingers scroll by default, with a “Draw with finger” option.
- Saved annotations and reading progress in the user's PostgreSQL account.
- Export written notes and bookmarks as a text file.
- Retains the current page when resizing the screen and changing zoom.
- Keyboard: left/right and Page Up/Page Down navigate; Escape closes the sidebar and exits focus mode.

## Upgrade an existing MEDIFY deployment

1. Back up PostgreSQL and your private book-upload directory if one exists.
2. Replace the backend source and lockfile, preserving your real `.env` and private uploads.
3. In the activated cPanel Node environment, run `npm ci --omit=dev` and `npm run migrate`.
4. This migration adds `site_settings`, `books`, `book_progress`, and `book_marks`. Existing account, note, curriculum and payment records are preserved.
5. Configure `UPLOAD_DIR` as a persistent private directory outside public_html. Example: `/home/CPANEL_USER/medify-private-books`.
6. Set `MAX_BOOK_MB=100` (default), or a smaller positive limit supported by your plan. The proxy/server request limit must be at least this size plus a 5 MB cover and multipart overhead. This is a separate multipart route; the JSON endpoint's 25 MB limit does not control book uploads.
7. Restart the Node application.
8. Upload the contents of the new `admin/dist/` and `student/dist/`, including `.htaccess`, `config.js`, the `assets/` folders and `pdf-assets/` folders. Preserve your three public URLs in `config.js`.
9. Open Admin → Settings and review your defaults. Add one test book, check its thumbnail, publish it, and test the reader with a student account.

In development only, the default upload location is `backend/private-uploads` if `UPLOAD_DIR` is blank. Production now requires an explicit absolute private directory outside the backend deployment folder; set this before restarting an upgraded installation. Database backups alone do not include book PDFs/covers: back up the private upload directory as well.

## Important implementation differences from MedSchoolProffs

This adapts the reading features and admin organisation to Medify's separate app architecture. It does not transplant the entire MedSchoolProffs MCQ/exam system, unrelated AI providers, or existing users and payment records.

The MedSchoolProffs reader renders watermarked page images on its server. This cPanel-friendly reader uses PDF.js in the browser behind authenticated, access-checked PDF endpoints; it does not require server PDF rendering binaries. Authorised readers receive PDF bytes. It is **not** an anti-download/DRM implementation and does not claim to prevent copying or screenshots.

Search uses the PDF's embedded text; scanned PDFs without text need OCR before upload for searchable text. Encrypted/password-protected PDFs should be unlocked before uploading. The first-page cover is generated in the admin's browser; a custom image can replace it.

Updating a PDF preserves bookmarks/notes by page number. Use a new book record when uploading a different edition if page numbers have changed. Annotation collections are capped at 3,000 per account per book, with bounded stroke sizes. Concurrent changes to the same annotation follow last-write-wins; this is not a collaborative live editing system.

The previous manual payment/approval flow is retained; this update does not introduce automatic billing or subscription expiry. Do not place SMTP/database credentials in public settings or `config.js`.

## Verification

- Both frontend TypeScript checks and production builds pass.
- 24 backend tests pass against an embedded PostgreSQL engine, including upload restrictions, private file access, range responses, saved progress, pen width, cross-account annotation isolation, feature switches and deletion cleanup.
- Browser checks cover administrator login, book upload, auto-thumbnail generation, metadata editing, PDF rendering, pen colour/thickness, chooser auto-close, hiding/showing the toolbar, drawing, search, notes, bookmarks and resume after reload.
- Desktop and mobile layouts inspected. Actual cPanel hosting, SMTP delivery and physical stylus behaviour still need verification on the deployment/device.

## Source references for the PDF implementation

- https://mozilla.github.io/pdf.js/examples/
- https://github.com/mozilla/pdf.js/wiki/Frequently-Asked-Questions
- https://mozilla.github.io/pdf.js/api/draft/api.js.html

PDF.js is bundled as a dependency under its Apache-2.0 licence; its distribution contains licensing details. The included test PDF is a synthetic software fixture, not medical teaching content.
