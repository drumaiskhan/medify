# MEDIFY 1.5 – discount coupons

## Admin → Discount coupons (new sidebar item)
* Create a code with a **percentage** or **fixed PKR** discount.
* Optional: maximum uses, last valid day, limit to chosen plans, internal note.
* Pause/resume, edit or delete. The list shows uses (e.g. 3 / 50) and status (Active, Paused, Expired, Used up).
* Students & payments → Transactions shows the coupon code and amount saved under each amount.

## Student checkout
* New **Discount Coupon** box in the payment window. *Apply* shows the saving and the new total.
* The total, the WhatsApp message and the submitted request all use the discounted amount.
* If a coupon covers 100 % of the fee, no transfer details are needed; a reference is generated and the request goes to the admin as usual.
* Changing the plan or year clears the applied coupon so it is checked again.

## How it is protected (server side)
* The server now sets every payment amount from its own plan prices. A browser can no longer send a different amount.
* A coupon is re-checked and consumed inside the same database transaction that saves the payment request. A duplicate transaction ID uses no coupon.
* One use per student. A **rejected** or deleted payment gives the use back.
* Code checks are limited to 20 per student per 15 minutes to stop guessing.

## Upgrade
1. Back up PostgreSQL.
2. Replace backend files, then run `npm run migrate` (adds `coupons` and `coupon_redemptions`; existing data is untouched).
3. Optional: set `PLAN_PRICES` in `backend/.env` if you ever change plan prices. Defaults match `student/src/data/plans.ts`: 1000 / 2000 / 3500.
4. Rebuild and upload `admin/dist` and `student/dist`.

## Notes
* Plan prices exist in two places (display in `plans.ts`, authority in the backend). If you change one, change the other.
* Verification here: backend syntax and new tests in `backend/test/coupons.test.js` were written, and the changed frontend files pass a TypeScript syntax check. Dependencies could not be installed in this environment, so run `npm test` and `npm run build` once before deploying.
