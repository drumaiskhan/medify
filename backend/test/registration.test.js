const {test,before,after,beforeEach}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs/promises');const os=require('node:os');const path=require('node:path');
const {PGlite}=require('@electric-sql/pglite');const {createApp}=require('../server');
let db,server,base,root,admin,student,failSession=false;
const origin='http://localhost:3000';
async function call(url,body,token,cookie){const r=await fetch(base+url,{method:body===undefined?'GET':'POST',headers:{Origin:origin,...(body instanceof FormData?{}:{'Content-Type':'application/json'}),...(token?{Authorization:'Bearer '+token}:{}),...(cookie?{Cookie:cookie}:{})},body:body===undefined?undefined:body instanceof FormData?body:JSON.stringify(body)});const text=await r.text();return {status:r.status,data:r.headers.get('content-type')?.includes('json')?JSON.parse(text):text,cookie:r.headers.get('set-cookie')?.split(';')[0]};}
function form(email,overrides={},proof=true){const f=new FormData();for(const[k,v]of Object.entries({email,password:'Test123456!',checkout:'true',fullName:'Test Student',college:'AMC',yearId:'year-1',planId:'annual',planName:'Annual',method:'jazzcash',transactionId:'TX-'+email,last4Digits:'1234',...overrides}))f.append(k,String(v));if(proof)f.append('proof',new Blob(['%PDF-1.4 test receipt'],{type:'application/pdf'}),'receipt.pdf');return f;}
before(async()=>{root=await fs.mkdtemp(path.join(os.tmpdir(),'medify-signup-'));process.env.UPLOAD_DIR=root;db=new PGlite();await db.exec(await fs.readFile(path.join(__dirname,'../schema.sql'),'utf8'));const query=async(...a)=>{if(failSession&&a[0].startsWith('INSERT INTO sessions'))throw Error('Injected session failure');return db.query(...a);};const pool={query,connect:async()=>({query,release(){}})};server=createApp(pool,{sendMail:async()=>{throw Error('SMTP offline');}}).listen(0);await new Promise(r=>server.once('listening',r));base='http://127.0.0.1:'+server.address().port+'/api';
const a=await call('/auth/register',{email:'admin@signup.test',password:'Test123456!'});admin=a.data.sessionToken;await db.query("UPDATE accounts SET role='admin' WHERE id=$1",[a.data.user.uid]);const s=await call('/auth/register',{email:'other@signup.test',password:'Test123456!'});student=s.data.sessionToken;
await db.query("INSERT INTO records(collection,id,data) VALUES('years','year-1',$1)",[{name:'First year',published:true}]);});
beforeEach(async()=>{await db.query('DELETE FROM rate_limits');});
after(async()=>{await new Promise(r=>server.close(r));await db.close();await fs.rm(root,{recursive:true,force:true});delete process.env.UPLOAD_DIR;});
test('new registration saves account, profile, payment and private proof together',async()=>{
 const r=await call('/auth/register',form('fresh@signup.test'));assert.equal(r.status,201);assert.ok(r.data.sessionToken);assert.equal(r.data.user.role,'student');
 const p=(await db.query("SELECT data FROM records WHERE collection='users' AND id=$1",[r.data.user.uid])).rows[0].data;assert.equal(p.fullName,'Test Student');assert.equal(p.selectedYearId,'year-1');assert.equal(p.paymentStatus,'PENDING');
 const id=r.data.paymentId;assert.equal((await call('/payment-proof?id='+encodeURIComponent(id),undefined,r.data.sessionToken)).status,200);assert.equal((await call('/payment-proof?id='+encodeURIComponent(id),undefined,admin)).status,200);assert.equal((await call('/payment-proof?id='+encodeURIComponent(id),undefined,student)).status,404);assert.equal((await call('/payment-proof?id='+encodeURIComponent(id))).status,401);
});
test('a failed payment leaves the email available and removes the staged proof',async()=>{
 const before=(await fs.readdir(path.join(root,'payment-proofs'))).length;
 const invalid=await call('/auth/register',form('retry@signup.test',{yearId:'missing'}));assert.equal(invalid.status,400);assert.equal((await db.query('SELECT id FROM accounts WHERE email=$1',['retry@signup.test'])).rows.length,0);assert.equal((await fs.readdir(path.join(root,'payment-proofs'))).length,before);
 assert.equal((await call('/auth/register',form('retry@signup.test'))).status,201);
});
test('duplicate payment reference is not reported as duplicate email; real duplicate emails are rejected',async()=>{
 let r=await call('/auth/register',form('collision@signup.test',{transactionId:'TX-fresh@signup.test'}));assert.equal(r.status,409);assert.match(r.data.error,/payment reference/);assert.equal((await db.query('SELECT id FROM accounts WHERE email=$1',['collision@signup.test'])).rows.length,0);
 r=await call('/auth/register',form('FRESH@signup.test'));assert.equal(r.status,409);assert.match(r.data.error,/Email already/);
});
test('session creation failure rolls back registration so retry works',async()=>{
 failSession=true;try{assert.equal((await call('/auth/register',form('session@signup.test'))).status,500);}finally{failSession=false;}
 assert.equal((await db.query('SELECT id FROM accounts WHERE email=$1',['session@signup.test'])).rows.length,0);assert.equal((await call('/auth/register',form('session@signup.test'))).status,201);
});
test('tab bearer sessions survive another account cookie and cannot fall back when invalid',async()=>{
 const login=await call('/auth/login',{email:'other@signup.test',password:'Test123456!'});assert.equal((await call('/admin/overview',undefined,admin,login.cookie)).status,200);assert.equal((await call('/admin/overview',undefined,student)).status,403);assert.equal((await call('/auth/me',undefined,'a'.repeat(64),login.cookie)).data.user,null);
 const headers=await fetch(base+'/admin/overview',{method:'OPTIONS',headers:{Origin:origin,'Access-Control-Request-Headers':'authorization'}});assert.match(headers.headers.get('access-control-allow-headers'),/Authorization/);
});
test('paid signup requires proof; zero-price coupon does not',async()=>{
 assert.equal((await call('/auth/register',form('noproof@signup.test',{},false))).status,400);
 await db.query("INSERT INTO coupons(id,code,discount_type,discount_value,active) VALUES('free','FULL','percent',100,true)");
 const quote=await call('/registration/quote',{code:'FULL',planId:'annual',yearId:'year-1'});assert.equal(quote.data.finalAmount,0);
 const r=await call('/auth/register',form('free@signup.test',{couponCode:'FULL',transactionId:''},false));assert.equal(r.status,201);const p=(await db.query("SELECT data FROM records WHERE collection='paymentRequests' AND id=$1",[r.data.paymentId])).rows[0].data;assert.equal(p.amountPKR,0);assert.equal(p.status,'PENDING');
});
test('invalid proof is rejected without creating an account',async()=>{
 const f=form('fake@signup.test',{},false);f.append('proof',new Blob(['<script>bad</script>'],{type:'image/png'}),'fake.png');assert.equal((await call('/auth/register',f)).status,400);assert.equal((await db.query('SELECT id FROM accounts WHERE email=$1',['fake@signup.test'])).rows.length,0);
});
test('existing students can submit receipts through the new payment endpoint',async()=>{
 const f=form('ignored@signup.test',{transactionId:'RENEW'});const r=await call('/payments/submit',f,student);assert.equal(r.status,201);const p=(await db.query("SELECT data FROM records WHERE collection='paymentRequests' AND id=$1",[r.data.id])).rows[0].data;assert.equal(p.hasProof,true);assert.equal(p.userEmail,'other@signup.test');
});

test('verification mail failure reports success with a warning, not a failed registration',async()=>{
 const previous=process.env.REQUIRE_EMAIL_VERIFICATION;process.env.REQUIRE_EMAIL_VERIFICATION='true';
 try{
  const r=await call('/auth/register',form('mail@signup.test'));assert.equal(r.status,201);assert.match(r.data.verificationWarning,/Email could not be delivered/);assert.equal(r.data.user.emailVerified,false);assert.equal((await call('/auth/me',undefined,r.data.sessionToken)).data.user.uid,r.data.user.uid);
 }finally{if(previous===undefined)delete process.env.REQUIRE_EMAIL_VERIFICATION;else process.env.REQUIRE_EMAIL_VERIFICATION=previous;}
});

test('uploaded receipt image reaches the admin unchanged with an image content type',async()=>{
 const png=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aX1sAAAAASUVORK5CYII=','base64');
 const f=form('image@signup.test',{},false);f.append('proof',new Blob([png],{type:'image/png'}),'payment.png');
 const created=await call('/auth/register',f);assert.equal(created.status,201);
 const listed=await call('/data/query',{collection:'paymentRequests'},admin);
 assert.equal(listed.data.find(p=>p.id===created.data.paymentId).data.hasProof,true);
 const response=await fetch(base+'/payment-proof?id='+encodeURIComponent(created.data.paymentId),{headers:{Origin:origin,Authorization:'Bearer '+admin}});
 assert.equal(response.status,200);assert.match(response.headers.get('content-type'),/^image\/png/);assert.equal(response.headers.get('cache-control'),'private, no-store');assert.deepEqual(Buffer.from(await response.arrayBuffer()),png);
});

test('new registrations reach the admin pending queue, proof and approval grant the selected year',async()=>{
 const before=(await call('/admin/registrations/summary',undefined,admin)).data.pending;
 const created=await call('/auth/register',form('queue@signup.test'));assert.equal(created.status,201);
 const list=await call('/admin/registrations',undefined,admin);assert.equal(list.status,200);
 const applicant=list.data.find(r=>r.id===created.data.user.uid);assert.equal(applicant.data.fullName,'Test Student');assert.equal(applicant.data.approvalStatus,'PENDING');assert.equal(applicant.data.paymentStatus,'PENDING');
 assert.equal(list.data.some(r=>r.data.email==='admin@signup.test'),false);
 assert.equal((await call('/admin/registrations/summary',undefined,admin)).data.pending,before+1);
 assert.equal((await call('/admin/overview',undefined,admin)).data.pendingRegistrations,before+1);
 assert.equal((await call('/admin/registrations',undefined,student)).status,403);
 assert.equal((await call('/admin/registrations/summary')).status,403);
 assert.equal((await call('/payment-proof?id='+encodeURIComponent(created.data.paymentId),undefined,admin)).status,200);
 const decision=await call('/data/write',{collection:'paymentRequests',id:created.data.paymentId,data:{status:'VERIFIED'},merge:true},admin);assert.equal(decision.status,200);
 const profile=(await call('/admin/registrations',undefined,admin)).data.find(r=>r.id===created.data.user.uid).data;
 assert.equal(profile.approvalStatus,'APPROVED');assert.equal(profile.paymentStatus,'VERIFIED');assert.ok(profile.entitlements['year-1'].expiresAt.seconds>Date.now()/1000);
 assert.equal((await call('/admin/registrations/summary',undefined,admin)).data.pending,before);
 const notices=await call('/notifications',undefined,created.data.sessionToken);assert.ok(notices.data.notifications.some(n=>n.title==='Payment verified'));
});

test('legacy student accounts without profile rows still appear for admin review',async()=>{
 await db.query("INSERT INTO accounts(id,email,password_hash) VALUES('legacy-student','legacy@signup.test','unused')");
 const list=await call('/admin/registrations',undefined,admin);
 const applicant=list.data.find(r=>r.id==='legacy-student');assert.equal(applicant.data.email,'legacy@signup.test');assert.equal(applicant.data.approvalStatus,'PENDING');
});
