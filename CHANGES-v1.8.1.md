# Medify v1.8.1 — Payment proof previews in admin

Students & payments now renders uploaded receipt images directly in both the student review list and Transactions. Images have thumbnails and click-to-enlarge viewing in an admin dialog. PDF receipts have an in-app PDF viewer plus Open original for devices without embedded PDF support.

Receipts are fetched with the admin session token and displayed using temporary blob URLs, so protected images work even if browser cross-site cookies are blocked. Loading/error/retry states are visible. Rows load previews when near the viewport; requests are cancelled and blob URLs released when unmounted. Old records without a receipt show No receipt uploaded. Payment access controls remain unchanged.

Deploy: from v1.8, rebuild and deploy the admin frontend only. No database changes. If upgrading from an earlier release, deploy the complete v1.8 backend and both frontends first (see CHANGES-v1.8.md).

Validation: admin TypeScript and production build passed. All 10 registration/payment/session integration tests passed, including a real PNG upload whose bytes, image MIME type and hasProof flag were verified through the authenticated admin API. Browser click-through and production deployment were not performed.
