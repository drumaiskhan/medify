# Medify v1.7 — Google Drive books

Admin → Book library → Add book / Edit book now accepts a Google Drive PDF link as an alternative to a local PDF upload.

## Using it
1. In Google Drive, open the PDF's sharing dialog. Set General access to Anyone with the link (Viewer), and allow downloading.
2. Paste its file link in the new Google Drive field. Enter the actual PDF page count, book title and academic year. Add a cover image if desired.
3. Save and test the book in the student reader before publishing widely. Sharing and file availability are checked when the reader requests the PDF, not when the link is saved.
4. When editing, leave both source inputs blank to keep the current book, or select a replacement PDF / paste a new Drive link.

The server stores the canonical link using the existing book source field. No database migration or new dependency is required for this update. Existing year, membership, publishing and library-enabled checks apply before any Drive fetch. Student API responses do not include the Drive source. PDFs stream through the API, including byte-range responses; they are not copied to private upload storage. Common download confirmation forms are supported. Google sharing rules, download quotas, hosting bandwidth and request timeouts still apply. A public Drive file can still be accessed by anyone who obtains its original link outside Medify.

Drive PDFs have no automatically generated cover or page count. File size is unknown in metadata. Upload an optional cover and enter the PDF page count. Local uploads retain automatic cover/page inspection. Deleting a book only removes its Medify entry, annotations and locally uploaded files; it does not delete the original file on Drive.

## Upgrade
Replace backend and admin source, restart the backend, and rebuild/deploy the admin frontend (`npm run build --prefix admin` from project root). Student reader changes are not needed. If upgrading from before v1.6, also follow CHANGES-v1.6.md for the feedback/notification migration.

## Validation
55 backend tests passed, including Drive link validation, redirect restrictions, confirmation handling, ranges, permissions, source privacy, creation and replacement. The admin TypeScript check and production build passed. Drive responses were mocked in tests; a live Google Drive file and browser interaction were not tested in this environment.
