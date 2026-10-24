# Medify production SSL and upload formats

SSL **must not be bypassed** in browsers. Issue a publicly trusted certificate for `site.med-ify.live` through cPanel AutoSSL / Let’s Encrypt and configure the full intermediate chain. A correct HTTPS certificate is required in Chrome, Firefox, Safari and Android. Re-run GitHub Actions after fixing the certificate; the health check intentionally verifies TLS.

Set `FRONTEND_ORIGINS=https://med-ify.live,https://admin.med-ify.live`, `STUDENT_URL=https://med-ify.live`, and keep API URLs `https://site.med-ify.live/api` in both static `public/config.js` files. Both frontend sites must be deployed separately by Hostinger. Avoid mixed-content HTTP API URLs. The backend limits CORS to approved origins; do not use wildcard CORS with cookie authentication.

Admin notes accept DOCX (preserves supported tables/images), PDF (extracts selectable text), TXT, Markdown as text, HTML (sanitized). PDF scans require OCR; native PDF layouts and images are best stored in the Books reader. The Books uploader remains PDF-only intentionally. Executable files, scripts, and arbitrary binary formats are not accepted.

Subscriptions remain checked server-side for books, notes and note images. The student year-list fallback now denies showing unrelated years when a subscription match fails.

The **Study concept visualizer** is an offline interactive map, available at `/visualizer` to signed-in students. It is not an LLM-based AI service; real AI generation requires choosing a provider and securely configuring a server-side API credential.
