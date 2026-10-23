// Drive-backed books remain behind the existing book access check.
const { fail } = require('./security');
function parseDriveLink(input) {
 try {
  const u=new URL(String(input).trim());
  if(u.protocol!=='https:' || u.username || u.password || u.port || !['drive.google.com','docs.google.com','drive.usercontent.google.com'].includes(u.hostname)) return null;
  const id=u.pathname.match(/^\/file\/d\/([A-Za-z0-9_-]+)(?:\/|$)/)?.[1] || (['/open','/uc','/download'].includes(u.pathname)?u.searchParams.get('id'):null);
  if(!id || !/^[A-Za-z0-9_-]{10,200}$/.test(id)) return null;
  const key=u.searchParams.get('resourcekey');
  if(key && !/^[A-Za-z0-9_-]{1,200}$/.test(key)) return null;
  return {id,resourceKey:key||null};
 }catch{return null;}
}
function canonicalDriveLink(value) {
 const p=parseDriveLink(value);if(!p)fail(400,'Paste a valid HTTPS Google Drive PDF file link.');
 return `https://drive.google.com/file/d/${p.id}/view`+(p.resourceKey?'?resourcekey='+p.resourceKey:'');
}
function allowed(url) {
 const u=new URL(url);
 return u.protocol==='https:'&&!u.username&&!u.password&&!u.port&&(['drive.google.com','drive.usercontent.google.com'].includes(u.hostname)||/^[a-z0-9-]+\.googleusercontent\.com$/.test(u.hostname));
}
const decode=s=>s.replace(/&amp;/g,'&').replace(/&quot;/g,'"').replace(/&#39;/g,"'");
async function fetchDriveFile(link,{range,signal,fetchImpl=fetch}={}) {
 const p=parseDriveLink(link);if(!p)fail(400,'Invalid Google Drive file link.');
 const headers={};if(range&&/^bytes=\d*-\d*$/.test(range))headers.Range=range;
 const fetchSafe=async(url)=>{
  for(let i=0;i<6;i++){
   if(!allowed(url))fail(502,'Google Drive returned an unsupported download address.');
   const r=await fetchImpl(url,{headers,signal,redirect:'manual'});
   if([301,302,303,307,308].includes(r.status)){
    const next=r.headers.get('location');await r.body?.cancel();
    if(!next)fail(502,'Google Drive download redirect is missing.');url=new URL(next,url).href;continue;
   }
   return r;
  }
  fail(502,'Too many Google Drive redirects.');
 };
 let url=new URL('https://drive.usercontent.google.com/download');
 url.searchParams.set('id',p.id);url.searchParams.set('export','download');url.searchParams.set('confirm','t');
 if(p.resourceKey)url.searchParams.set('resourcekey',p.resourceKey);
 for(let attempt=0;attempt<2;attempt++){
  const r=await fetchSafe(url.href);
  if(r.status===416)return r;
  if(!r.ok){await r.body?.cancel();fail(502,'Google Drive could not serve this book. Check sharing permissions or try again later.');}
  const type=r.headers.get('content-type')||'';
  if(!type.includes('text/html')){
   if(!/application\/(pdf|octet-stream)/i.test(type)){await r.body?.cancel();fail(502,'The Drive link must point to a PDF file.');}
   return r;
  }
  let html='';
  for await(const chunk of r.body){html+=Buffer.from(chunk).toString();if(html.length>256000)fail(502,'Unexpected Google Drive download page.');}
  const action=html.match(/<form[^>]*action="([^"]*download[^"]*)"[^>]*>/i)?.[1];
  if(attempt===0&&action){
   url=new URL(decode(action),'https://drive.usercontent.google.com');
   if(!allowed(url.href))fail(502,'Unsupported Google Drive confirmation address.');
   for(const m of html.matchAll(/<input\b[^>]*>/gi)){
    const name=m[0].match(/\bname="([^"]+)"/i)?.[1],value=m[0].match(/\bvalue="([^"]*)"/i)?.[1];
    if(name)url.searchParams.set(decode(name),decode(value||''));
   }
   continue;
  }
  fail(502,/quota|too many users/i.test(html)?'Google Drive download quota reached. Try again later.':'In Drive, set Share → General access → Anyone with the link (Viewer), and enable downloading.');
 }
}
module.exports={parseDriveLink,canonicalDriveLink,fetchDriveFile};
