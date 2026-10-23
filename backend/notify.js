const crypto = require('node:crypto');
const TYPES = ['info', 'success', 'warning'];
function safeLink(value) {
 if(typeof value !== 'string' || !value.startsWith('/') || value.startsWith('//') || /[\\\x00-\x20]/.test(value)) return null;
 try { const url=new URL(value,'https://medify.invalid'); return url.origin==='https://medify.invalid' ? value : null; } catch { return null; }
}
async function notify(db, accountId, {title,body='',type='info',link=null}) {
 await db.query('INSERT INTO notifications(id,account_id,title,body,type,link) VALUES($1,$2,$3,$4,$5,$6)', [crypto.randomUUID(),accountId,String(title).slice(0,200),String(body).slice(0,2000),TYPES.includes(type)?type:'info',safeLink(link)]);
}
module.exports={notify,safeLink,TYPES};
