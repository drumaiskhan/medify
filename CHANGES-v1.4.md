# MEDIFY 1.4 – one click per module

## Admin → Subject notes
* Pick the year, **click a module**, and the upload section opens right below it. There is no separate subject/note step any more.
* Save publishes by default. Notes appear in that module for every student whose subscription covers the year.
* Rename and show/hide for the module are inside the same section.
* Under the hood each module has one note named like the module. Renaming the module renames the note. Older modules that already hold several notes show a small selector so none become unreachable.

## Student site
* **Admin account → Dashboard → All Notes Library:** every year, module and note, with *Read* links and a *Draft* badge for unpublished ones, plus *Open as a student sees it*.
* Subscribed students: unchanged (module → notes inside it).

No backend or database change; `npm run migrate` and `npm run seed` are not needed.

## v1.4.1 – notes visible on the homepage
* **Homepage:** new "Notes Available Now" section lists every module that has published notes (with a note count) and links straight to it. Year cards also show a "Notes ready" tag beside modules that have notes.
* **Admin → module section:** after notes are saved, a status box says exactly where they appear (Home → Notes Available Now → module, and the subscriber Dashboard) and gives links to open the module, homepage and admin dashboard library. If something hides them (hidden year, hidden module, or unpublished notes) it names the cause.
* Modules stay in the admin area exactly as before; only the per-note picker is gone.
