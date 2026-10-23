# Medify v1.6 — Feedback, notifications, and organized settings

## Included
- Student feedback form: category, optional 1–5 rating, private history, and follow-up replies.
- Admin feedback inbox: student details, search, status filters, replies, reviewed/reopen, deletion, and open-count badge.
- Student notifications: unread bell on desktop/mobile, mark read/all read, clear, internal links, and 60-second refresh.
- Automatic notifications for admin feedback replies and payment verification/rejection. Re-saving an unchanged decision does not send another alert. Payment changes and alerts commit together.
- Admin announcements: all existing students or an academic year, preview, message type, optional internal link, recent sends, and recall.
- Settings sections: Platform, Branding, Student access, Reader, Communication, Payments, System. Drafts survive section changes; unsaved state and discard are visible. Browser reload warns about unsaved edits; communication/payment shortcuts also warn. Other sidebar navigation does not block unsaved changes.
- Existing coupons, curriculum hierarchy, notes, books, payment approval, and access rules retained.

## Upgrade an existing installation
1. Back up PostgreSQL and the private uploads directory. Keep existing backend environment values and frontend runtime configuration.
2. Replace application source files with this version. Do not delete or overwrite your private uploads or production environment file.
3. From the backend directory, run `npm ci` then `npm run migrate`. This adds feedback, replies and notifications tables/indexes without replacing existing curriculum or student data. The schema can be run again safely.
4. Restart the backend after migration.
5. Run `npm ci` in student and admin, then `npm run build` at the project root. Deploy both resulting dist folders with your production API/runtime configuration.
6. Smoke-test student feedback → admin reply → student notification, then a year-targeted announcement.

## Behaviour and limits
- These are in-app notifications, not email, push, or WhatsApp messages.
- Announcements go to student accounts existing when sent. Year targeting matches selected/purchased year or an entitlement year, including historical entitlements.
- Notification lists show the latest 100 items. Unread badge counts all retained unread items. Mark all read applies to all of the student's notifications.
- Notifications older than 90 days are removed when that student opens their inbox and excluded from the bell count.
- Recent broadcast metrics represent remaining inbox copies, not permanent delivery analytics. Clear, expiry cleanup and recall reduce counts.
- Feedback lists return the latest 100 per student / 500 for admin; replies are threaded. Admin open-count badge counts all open feedback.
- Feedback submissions are limited to 5/hour; follow-ups to 30/hour. Broadcasts support up to 5,000 recipients per send.
- Settings contain platform controls and links to dedicated management screens; hosting secrets stay in backend configuration.

## Validation
- Backend: 50 tests passed using PGlite, including permissions/ownership, replies, payment alerts, rate limits, year targeting, recall, and notification expiry/counting.
- Student and admin: TypeScript checks and Vite production builds passed.
- Student build reports a bundle-size advisory; it completes successfully.
- Production PostgreSQL deployment and browser click-through were not performed here.

Source-only package: node_modules and generated dist folders are excluded. Run the setup/install/build steps locally before deployment.
