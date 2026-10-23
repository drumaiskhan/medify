# MEDIFY 1.3 – notes upload by Year and Module

## What changed
| Area | Change |
|---|---|
| Admin → Subject notes | The upload screen is now split **Year → Module → Note**. Year tabs, module cards (with note counts), a note picker inside the chosen module, then the same Word upload, preview and publish controls as before. Modules can be added, renamed, and shown or hidden from this screen. |
| Curriculum | The starter modules replace the old Block D–L list. **2nd Year:** Neuroscience, Renal, GIT & Hepatobiliary, Endocrine & Reproduction. **3rd Year:** Foundation II, Infection & Inflammation, Blood & Immunology, Multisystem, Cardiovascular & Respiratory. **4th Year:** Neuroscience, GIT & Hepatobiliary, Renal, Endocrine & Reproduction, Otorhinolaryngology (M1), Ophthalmology (M2). |
| Student site | No change to how access works: a note appears in its module for every student whose subscription covers that year. Wording now says "module" and "note" instead of "block" and "subject". |
| Tests | New `backend/test/modules.test.js` checks the module list, that a note uploaded into a module is readable by a student who bought that year only, and that hiding a module hides its notes. |

## Updating an existing site
Run `npm run seed` in `backend` (Docker: `docker compose -f compose.vps.yaml run --rm api npm run seed`; local: `npm run db:init`). It is safe to repeat and never overwrites existing records.

* The new modules are added.
* Old starter blocks (Block D–L) that have **no uploaded notes** are hidden from students (not deleted). This happens once.
* An old block that **already holds uploaded notes** is left untouched and named in the command output. Re-upload those notes into the matching module, then hide the old block.
* No database schema change; `npm run migrate` is not required.

## Notes
* "Hepatobilliary" and "Opthalmology" were spelled "Hepatobiliary" and "Ophthalmology".
* Modules and notes can be renamed or added any time in Admin → Subject notes; the seed only provides the starting list.
