const pool=require('../db');const fs=require('node:fs');const path=require('node:path');
(async()=>{try{const schema=fs.readFileSync(path.join(__dirname,'../schema.sql'),'utf8');if(pool.exec)await pool.exec(schema);else await pool.query(schema);console.log('Database schema ready')}finally{await pool.end()}})().catch(e=>{console.error(e.message);process.exitCode=1});
