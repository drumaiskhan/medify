# Ready upload packages

- backend.zip: extract directly into a private Node application root. Includes source, lockfile, schema and production environment example; install dependencies on the host.
- student.zip: extract directly into the student site document root.
- admin.zip: extract directly into the admin site document root.

Edit config.js in each frontend after extraction. Configure the API environment using the guides in the main package. These archives include the requested default admin credentials in backend setup code. They do not include existing accounts, uploaded books or a database. Frontend builds include PDF reader assets and .htaccess. For future code changes rebuild both frontends and zip their dist contents again; recreate backend.zip from backend source excluding node_modules, .env, uploads and logs.

The full source and local/VPS configurations remain in the main medify folder.
