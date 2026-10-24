// Creates or resets the administrator account.
// Usage: npm run admin (uses requested initial credentials)
// Or override: ADMIN_EMAIL=you@example.com ADMIN_PASSWORD='a long unique password' npm run admin
// This is a manual one-time provisioning command, never run on server startup.
const pool = require('../db');
const {passwordHash} = require('../security');
const {randomUUID} = require('node:crypto');
const defaults = require('../admin-defaults');
(async () => {
  try {
    const email = String(process.env.ADMIN_EMAIL || defaults.email).trim().toLowerCase();
    const password = process.env.ADMIN_PASSWORD || defaults.password;
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw Error('Set ADMIN_EMAIL to a valid email address.');
    if (typeof password !== 'string' || password.length < 8 || password.length > 256)
      throw Error('Set ADMIN_PASSWORD to a unique password of at least 8 characters.');
    await pool.query("INSERT INTO accounts(id,email,password_hash,role,email_verified) VALUES($1,$2,$3,'admin',true) ON CONFLICT(email) DO UPDATE SET role='admin',password_hash=EXCLUDED.password_hash,email_verified=true", [randomUUID(), email, await passwordHash(password)]);
    await pool.query('DELETE FROM sessions WHERE account_id=(SELECT id FROM accounts WHERE email=$1)', [email]);
    console.log(`Administrator ready: ${email}. Existing sessions for this account were revoked.`);
  } finally { await pool.end(); }
})().catch(e => { console.error(e.message); process.exitCode = 1; });
