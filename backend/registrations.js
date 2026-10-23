const {fail}=require('./security');
async function pendingRegistrations(db){
 return (await db.query("SELECT count(*)::int AS n FROM accounts a LEFT JOIN records r ON r.collection='users' AND r.id=a.id WHERE a.role='student' AND COALESCE(r.data->>'approvalStatus','PENDING')='PENDING'")).rows[0].n;
}
function installRegistrations(app,pool){
 const wrap=fn=>(req,res,next)=>Promise.resolve().then(()=>{if(req.user?.role!=='admin')fail(403,'Administrator required');return fn(req,res);}).catch(next);
 app.get('/api/admin/registrations/summary',wrap(async(req,res)=>res.json({pending:await pendingRegistrations(pool)})));
 app.get('/api/admin/registrations',wrap(async(req,res)=>{
  const rows=(await pool.query("SELECT a.id,a.email,a.created_at,r.data FROM accounts a LEFT JOIN records r ON r.collection='users' AND r.id=a.id WHERE a.role='student' ORDER BY a.created_at DESC")).rows;
  res.json(rows.map(r=>({id:r.id,data:{approvalStatus:'PENDING',paymentStatus:'UNPAID',createdAt:{seconds:Math.floor(new Date(r.created_at).getTime()/1000)},...r.data,email:r.email}})));
 }));
}
module.exports={installRegistrations,pendingRegistrations};
