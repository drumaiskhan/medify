const {test}=require('node:test');
const assert=require('node:assert/strict');
const {parseDriveLink,canonicalDriveLink,fetchDriveFile}=require('../drive');
const link='https://drive.google.com/file/d/abcDEF123456789/view?resourcekey=0-test';
test('Drive file links validate host, protocol and resource keys',()=>{
 assert.equal(parseDriveLink(link).id,'abcDEF123456789');
 assert.equal(canonicalDriveLink(link),link);
 assert.equal(parseDriveLink('https://drive.google.com/open?id=abcDEF123456789').id,'abcDEF123456789');
 for(const bad of ['http://drive.google.com/file/d/abcDEF123456789/view','https://evil.com/?id=abcDEF123456789','https://drive.google.com.evil.com/open?id=abcDEF123456789','https://drive.google.com/drive/folders/abcDEF123456789','https://drive.google.com:444/open?id=abcDEF123456789'])assert.equal(parseDriveLink(bad),null);
});
test('Drive streaming forwards ranges without forwarding user credentials',async()=>{
 const result=await fetchDriveFile(link,{range:'bytes=0-4',fetchImpl:async(url,options)=>{
  assert.equal(new URL(url).searchParams.get('resourcekey'),'0-test');
  assert.deepEqual(options.headers,{Range:'bytes=0-4'});
  assert.equal(options.redirect,'manual');
  return new Response('%PDF-',{status:206,headers:{'content-type':'application/pdf','content-range':'bytes 0-4/99'}});
 }});assert.equal(result.status,206);
});
test('Drive download confirmation works; off-domain redirects and forms are refused',async()=>{
 let calls=0;
 const result=await fetchDriveFile(link,{fetchImpl:async(url)=>{
  calls++;
  if(calls===1)return new Response('<form action="https://drive.usercontent.google.com/download"><input type="hidden" name="id" value="abcDEF123456789"><input name="confirm" value="yes"></form>',{headers:{'content-type':'text/html'}});
  assert.equal(new URL(url).searchParams.get('confirm'),'yes');return new Response('%PDF-',{headers:{'content-type':'application/pdf'}});
 }});assert.equal(result.status,200);assert.equal(calls,2);
 for(const response of [()=>new Response('',{status:302,headers:{location:'http://127.0.0.1/private'}}),()=>new Response('<form action="https://evil.com/download"></form>',{headers:{'content-type':'text/html'}})])await assert.rejects(fetchDriveFile(link,{fetchImpl:async()=>response()}),e=>e.status===502);
});
test('Drive sharing, quota and non-PDF failures are actionable',async()=>{
 for(const [body,type,pattern] of [['quota exceeded','text/html',/quota/],['Please sign in','text/html',/Anyone with the link/],['image','image/png',/PDF/]])await assert.rejects(fetchDriveFile(link,{fetchImpl:async()=>new Response(body,{headers:{'content-type':type}})}),pattern);
});
