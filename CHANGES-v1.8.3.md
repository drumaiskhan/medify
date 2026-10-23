# Medify v1.8.3 — note images and student library visibility

- New module notes now upload embedded Word images under the final note ID before metadata is saved. Previously new notes silently skipped every image.
- Conversion stops with an actionable error if any extracted image cannot upload, instead of saving an incomplete note. Changing the destination requires conversion again.
- Legacy chapter images and reading state now use chapter access checks. Published parent and purchased-year restrictions remain enforced.
- Private image URLs are normalized during sanitization, loaded through the configured API with authentication, and show an explicit retry button when unavailable.
- New book uploads default to Published. Save messages explain draft or hidden academic-year status; existing draft books are not automatically published.
- The student book list refreshes every 30 seconds while visible, on window focus, and with Refresh books. Module notes refresh on focus.

## Upgrade
Replace backend source and rebuild/deploy both admin and student apps. No schema migration is needed for this patch. Keep the existing persistent UPLOAD_DIR and its files when deploying.

If the previous importer already removed images from a saved note, upload the original DOCX again and save it. This patch cannot reconstruct missing image bytes or pictures removed from stored HTML. Existing draft books must be published and their academic year must be visible. Students still need access to the relevant year.

## Verification
All 69 backend tests pass, including staged image uploads, image byte retrieval, unpublished and wrong-year restrictions, and legacy chapter image/state access. Admin and student TypeScript checks and production builds pass. Live deployment and browser end-to-end testing were not performed.
