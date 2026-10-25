const { randomUUID } = require('node:crypto');
const { passwordHash } = require('./security');
async function provisionInitialAdmin(pool) {
  const email = String(process.env.ADMIN_EMAIL || '').trim().toLowerCase();
  const password = process.env.ADMIN_PASSWORD;
  if (!email || !password) return;
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || password.length < 8)
    throw Error('Invalid ADMIN_EMAIL or ADMIN_PASSWORD (minimum 8 characters)');
  const result = await pool.query(
    `INSERT INTO accounts (id,email,password_hash,role,email_verified)
     VALUES ($1,$2,$3,'admin',true)
     ON CONFLICT (email) DO NOTHING RETURNING id`,
    [randomUUID(), email, await passwordHash(password)]
  );
  if (result.rowCount) console.log('[Medify] Initial administrator created');
  else console.log('[Medify] Initial administrator already exists; password unchanged');
}
module.exports = { provisionInitialAdmin };
