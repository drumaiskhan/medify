# Book PDFs on your cPanel 50 GB NVMe account

The API stores PDFs and cover images as private files. PostgreSQL stores book descriptions, file names, permissions, progress and annotations. Uploads use random filenames; browsers receive files through the authorized API, including byte-range requests used by the reader. Never expose the upload directory with a public URL or static web-server alias.

## Configure cPanel disk storage

In cPanel File Manager, create `medify-storage/books` in your **home directory**, alongside public_html, not inside it. Use your actual account home path as shown by cPanel; `/home/CPANEL_USER` is only an example. The Node application user must own/have read and write access to this directory. Prefer mode 700 for the directory; do not use 777.

Set in the API environment:

```dotenv
UPLOAD_DIR=/home/CPANEL_USER/medify-storage/books
MAX_BOOK_MB=100
```

Restart the Node app, then run `npm run storage:check` from its application directory. Startup checks the folder is writable and rejects production paths inside the backend deployment folder. The **hosting filesystem decides which SSD is used**; choosing a folder in your cPanel account uses that account's allocated disk. The application cannot increase the quota or independently guarantee the physical drive type.

Your 50 GB is an account allowance shared with other hosted files, mail and possibly databases/backups. The app does not preallocate 50 GB. Check cPanel **Disk Usage** for authoritative account usage. `storage:check` reports only file usage in the book directory. Individual PDFs default to a 100 MB limit and covers to 5 MB. Increase MAX_BOOK_MB deliberately and adjust your provider's HTTP upload/request limits if needed. A server upload limit may reject a large PDF before Express receives it.

## Keep books when redeploying

Upload new backend code into its application folder and new frontend files into their public roots. Never replace or delete `medify-storage`. Keep the same UPLOAD_DIR across releases. Run schema migration explicitly and restart the app. Do not copy an empty uploads folder over existing storage. To relocate an existing library: pause uploads, copy every stored file preserving its filename, set the new absolute UPLOAD_DIR, check ownership, restart, and open existing books before removing the old copy.

## Backup and restore

Back up the PostgreSQL database **and** the whole private books directory. A database-only backup contains no PDFs. Include runtime environment configuration securely, never in a public backup folder. Pause writes while making a coordinated backup, or use the host's consistent snapshot facility. Keep backups outside the same quota when possible; retaining full copies on a 50 GB account can rapidly exhaust it.

On restore: restore the matching database and upload directory, restore environment settings, check path ownership, run `npm run storage:check`, then verify an existing book, its cover and a student's saved annotations. File names must remain unchanged because the database references them.

A storage check demonstrates permissions and path only; persistence must be verified on your host by uploading a book, restarting/redeploying the API without touching the storage folder, and opening it again.
