# MEDIFY 1.2 – what changed

Run `npm run migrate` in `backend` after updating (adds the device-limit column and the highlights table).

## Fixed
| Area | Change |
|---|---|
| Images | Word pictures are now kept: compressed to WebP, stored privately, served only to entitled students, cached for offline. |
| Subscriptions | Each purchase now has an expiry (3/6/12 months set by the **server** from the plan). Renewals stack onto remaining time. Several years can be held at once. A rejected renewal does not remove time already paid for. The dashboard shows days left, an expired card and Renew buttons. |
| Admin login | Removed the hardcoded admin email/password. `npm run admin` needs `ADMIN_EMAIL` + `ADMIN_PASSWORD` (12+ chars). Local setup generates a random password in `.local-data/LOCAL-ACCESS.txt`. |
| Secrets | `.env` files, the local database folder and old release zips are no longer in the package. **Rotate any secret that was in the earlier zip.** |
| Email verification | Off by default (`REQUIRE_EMAIL_VERIFICATION=false`); admin approval after payment is the gate. Turn on only after SMTP is tested. |
| Account sharing | A student account may be signed in on 2 devices (`MAX_DEVICES`); signing in on a third signs out the oldest. Admins are exempt. |
| Reader | Text highlights (4 colours, saved to the account), search inside a subject, "continue where you left off", image zoom, watermark with the student's email, printing disabled. |
| Offline | Installable app (PWA). Subjects the student opens are kept on the device; "Save for offline" also downloads images. Offline use needs an online check-in within 7 days and an unexpired subscription; everything is wiped on logout. |
| Wording | Plans say "one-time payment", and the promises that were not delivered (priority corrections, pre-prof summaries) were removed. |
| Curriculum | Added *Forensic Medicine & Toxicology* to Block L. Rename other subjects in Admin → Curriculum. |

## Not changed (needs your decision)
* **Hosting** still needs Node 22+ and PostgreSQL, and all three sites must be subdomains of one domain you own (see HOSTINGER-DEPLOYMENT.md).
* **Payment account titles** (JazzCash vs Meezan) are set in Admin → Settings; make them match what students see in their banking app.
* **Screenshots** cannot be prevented on the web; the watermark discourages sharing.
* Bookmarks are not included; highlights, search and resume are.
