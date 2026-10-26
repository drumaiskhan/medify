const fs=require('node:fs/promises');
const path=require('node:path');
const crypto=require('node:crypto');
const multer=require('multer');
const {fail}=require('./security');
const records=require('./data');
function proofTools(){
 const root=path.join(require('./storage').storageRoot(),'payment-proofs');
 const upload=multer({storage:multer.diskStorage({destination(req,file,cb){fs.mkdir(root,{recursive:true}).then(()=>cb(null,root),cb);},filename(req,file,cb){cb(null,crypto.randomUUID()+'.proof');}}),limits:{fileSize:5*1024*1024,files:1,fields:30,fieldSize:10000}}).single('proof');
 const cleanup=async req=>{if(req.file)await fs.unlink(req.file.path).catch(()=>{});};
 const receive=(req,res,next)=>upload(req,res,e=>{if(e){cleanup(req).finally(()=>{e.status=400;e.message=e.code==='LIMIT_FILE_SIZE'?'Payment proof must be at most 5 MB.':'Invalid payment proof upload.';next(e);});}else next();});
 const validate=async file=>{
  if(!file)return null;
  const h=await fs.open(file.path,'r'),b=Buffer.alloc(12);try{await h.read(b,0,12,0);}finally{await h.close();}
  let mime=b.subarray(0,5).toString()==='%PDF-'?'application/pdf':b.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10]))?'image/png':b.subarray(0,3).equals(Buffer.from([255,216,255]))?'image/jpeg':b.subarray(0,4).toString()==='RIFF'&&b.subarray(8,12).toString()==='WEBP'?'image/webp':null;
  if(!mime)fail(400,'Payment proof must be a JPEG, PNG, WebP or PDF file.');
  return {proofFile:file.filename,proofMime:mime,proofName:path.basename(file.originalname).slice(0,150),hasProof:true};
 };
 const attach=async(db,id,proof)=>{if(proof)await db.query("UPDATE records SET data=data || $2::jsonb WHERE collection='paymentRequests' AND id=$1",[id,proof]);};
 return {root,receive,cleanup,validate,attach};
}
function installProofRoutes(app,pool,proofs,tx){
 const wrap=fn=>(req,res,next)=>Promise.resolve(fn(req,res)).catch(next);
 app.post('/api/payments/submit',(req,res,next)=>req.user?next():res.status(401).json({error:'Sign in required'}),proofs.receive,wrap(async(req,res)=>{
  try{
   const proof=await proofs.validate(req.file),b=req.body;
   if(!String(b.transactionId||'').trim())b.transactionId='WA-'+crypto.randomUUID().slice(0,8).toUpperCase();
   const id=String(b.method)+'_'+String(b.transactionId||'').trim();
   await tx(async db=>{
    await records.write(db,req.user,{collection:'paymentRequests',id,data:b});
    const payment=await records.get(db,'paymentRequests',id);
    // Proof is sent on WhatsApp, so no file upload is required here.
    await proofs.attach(db,id,proof);
    await db.query("UPDATE records SET data=data || $2::jsonb WHERE collection='users' AND id=$1",[req.user.id,{selectedPlanId:payment.planId,selectedPlanName:payment.planName,planPrice:payment.amountPKR,selectedYearId:payment.yearId,selectedYearName:payment.yearName}]);
   });
   res.status(201).json({id});
  }catch(e){await proofs.cleanup(req);throw e;}
 }));
 app.get('/api/payment-proof',wrap(async(req,res)=>{
  if(!req.user)fail(401,'Sign in required');
  const payment=await records.get(pool,'paymentRequests',String(req.query.id||''));
  if(!payment|| (req.user.role!=='admin'&&payment.userId!==req.user.id))fail(404,'Payment proof not found');
  if(!payment.proofFile||!/^[-a-f0-9]+\.proof$/.test(payment.proofFile))fail(404,'Payment proof not found');
  res.set({'Content-Type':payment.proofMime,'Cache-Control':'private, no-store','Content-Disposition':'inline; filename="payment-proof.'+(payment.proofMime==='application/pdf'?'pdf':payment.proofMime==='image/jpeg'?'jpg':payment.proofMime==='image/webp'?'webp':'png')+'"'});
  res.sendFile(path.join(proofs.root,payment.proofFile),e=>{if(e&&!res.headersSent)res.status(404).json({error:'Payment proof unavailable'});});
 }));
}
module.exports={proofTools,installProofRoutes};
