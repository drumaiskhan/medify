# Medify v1.8.4 — reliable DOCX image processing

- Browser compression is optional for supported PNG/JPEG/WebP originals within the 4 MB API limit. Canvas, decoding or encoding failures no longer unnecessarily reject these images.
- Detect original raster type from bytes rather than trusting Word MIME metadata. Try WebP, JPEG and PNG output; retain smaller originals rather than inflating them.
- Release canvas memory and image object URLs. Decode, encode and upload timeouts prevent indefinite waits.
- Process embedded images serially to reduce memory pressure. Enforce the 400-image limit against attempted images, not only successful uploads.
- Clear the previous converted document when a new conversion starts and disable Save during conversion, preventing accidental saves of stale content.
- Empty/oversized documents and server upload-size failures show specific errors. Unsupported formats still stop conversion with an explanation instead of silently deleting images.

## Deploy
Rebuild and deploy both frontends. This patch requires no database migration or additional packages. Use the included backend if upgrading from a version earlier than v1.8.3. Preserve persistent uploaded files.

## Validation
69 backend tests pass; eight image-preparation regression tests pass with simulated browser decoder/canvas failure paths. Both frontend TypeScript checks and production builds pass. Run the image tests with Node 24: `node --test tests/note-images.test.mjs`.
A browser executable was unavailable in this environment, so browser end-to-end and live hosting tests were not performed. The specific failing user DOCX was not supplied. No guarantee is made for damaged documents, unsupported Word drawings/EMF/WMF, or server/network outages.
