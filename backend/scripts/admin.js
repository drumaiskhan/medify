// Creates or resets the administrator account.
// Usage:  ADMIN_EMAIL=you@example.com ADMIN_PASSWORD='a long unique password' npm run admin
// No default credentials exist. The password is hashed; it is never stored or logged.
const pool = require('../db');
const {passwordHash} = require('../security');
const {randomUUID} = require('node:crypto');
(async () => {
  try {
    const email = String(process.env.ADMIN_EMAIL || '').trim().toLowerCase();
    const password = process.env.ADMIN_PASSWORD;
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw Error('Set ADMIN_EMAIL to a valid email address.');
    if (typeof password !== 'string' || password.length < 12 || password.length > 256)
      throw Error('Set ADMIN_PASSWORD to a unique password of at least 12 characters.');
    await pool.query("INSERT INTO accounts(id,email,password_hash,role,email_verified) VALUES($1,$2,$3,'admin',true) ON CONFLICT(email) DO UPDATE SET role='admin',password_hash=EXCLUDED.password_hash,email_verified=true", [randomUUID(), email, await passwordHash(password)]);
    await pool.query('DELETE FROM sessions WHERE account_id=(SELECT id FROM accounts WHERE email=$1)', [email]);
    console.log(`Administrator ready: ${email}. Existing sessions for this account were revoked.`);
  } finally { await pool.end(); }
})().catch(e => { console.error(e.message); process.exitCode = 1; });
