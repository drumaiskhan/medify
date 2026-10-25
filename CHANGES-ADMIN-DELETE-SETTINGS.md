# Medify — Admin content deletion and Settings update

## Included changes

- **Notes:** Delete uploaded DOCX content while retaining the subject for a replacement upload; also delete entire subjects. Deletion cleans `subjectContent`, `subjectParts`, and note reader state. The existing note edit/upload flow remains available.
- **Curriculum:** Admin delete buttons for academic years and modules. Related subjects, chapters, chapter content, note parts and reader state are removed in one PostgreSQL transaction. Year/module deletions require the administrator to type `DELETE`.
- **Students:** Delete student accounts and associated account records and proofs, requiring `DELETE` confirmation. Administrators cannot delete their own accounts via this feature.
- **Payments:** Delete pending or rejected payment requests and attached receipts. **Verified requests cannot be deleted** as they are entitlement and accounting evidence.
- **Existing controls retained:** Book deletion, coupon deletion, feedback deletion, and notification recall.
- **Admin Settings → Payments:** Editable quarterly, half-yearly and annual subscription prices, enforced server-side for payments and coupons; price changes do not modify historical transactions.
- **Admin Settings → Platform / Branding:** Editable site name, tagline, announcement, support email, logo URL, contact location, founder/organization name, footer description and copyright text. Student public pages read these settings from the API.
- **Student footer:** Academic year links now load from published curriculum instead of linking to hardcoded year URLs.

## Operational notes

- The existing PostgreSQL schema is unchanged; settings use the existing JSONB `site_settings` row.
- Before deleting a year, delete its books using Book library to prevent orphaned PDF uploads.
- Do not delete subjects or years you want students to keep; deletion is permanent. **Back up PostgreSQL and the private uploads directory before deployment.**
- No secret credentials were added to source files. Preserve the working production `.env` on cPanel.
- GitHub Actions currently deploys backend code only (`backend/**`); publish newly built `admin/dist` and `student/dist` through your normal frontend hosting workflow as well.
- If prices were previously set by `PLAN_PRICES` in the backend environment, saving prices in Admin Settings takes precedence thereafter.
- Upload size limits, database settings and SMTP credentials remain environment-managed on purpose.
- The supplied GitHub workflow and FTPS script have not been changed. They currently disable certificate checks; replace this workaround with valid TLS certificates in production.

## Run locally to verify

```bash
npm run setup
npm run build
npm test --prefix backend
```

The source files passed JavaScript syntax checks and TypeScript/TSX parsing in the preparation environment. Full package builds and database integration tests could not run there because `node_modules` were not installed and dependency installation did not complete.
