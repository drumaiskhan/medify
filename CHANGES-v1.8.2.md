# Medify v1.8.2 — Admin registration approval queue

New registrations appear in Admin → Students & payments → Student Accounts & Approvals → Pending, alongside their saved profile, plan, transaction and uploaded proof. Pending is now the default filter. Use All to see previously approved/rejected students.

The list refreshes every 30 seconds while the payments page is visible, when the window regains focus, or using Refresh. A sidebar badge and Overview pending-registration count show student accounts awaiting account approval. Counts refresh after approval/rejection actions. These counts describe account approval, not renewals by already-approved students; those payments remain under Transactions.

The registration list reads actual student accounts joined with their profiles, excluding administrator accounts. Legacy accounts missing a profile are visible for review. Fetch errors are surfaced instead of silently displaying an empty queue. Payment proofs, access rules and the existing approval/rejection controls are retained.

Deployment from v1.8.1: update/restart the backend and rebuild/deploy the admin frontend. No schema migration or student frontend changes are needed for this increment. The complete package includes earlier fixes.

Validation: 67 backend tests passed, including new registration → admin pending list/count → protected proof retrieval → payment approval → year entitlement and student notification. Admin TypeScript and Vite production build passed. Live browser and production deployment were not tested.
