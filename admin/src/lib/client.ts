export const db = {};
export {auth} from './auth';
export const apiBase=()=> (window.MEDIFY_CONFIG?.API_URL || import.meta.env.VITE_API_URL || "http://localhost:3002/api").replace(/\/$/, "");
const tokenKey='medify-admin-session:'+apiBase();
let token:string|null=null;
try{token=sessionStorage.getItem(tokenKey);}catch{}
export function setSessionToken(value:string|null){token=value;try{if(value)sessionStorage.setItem(tokenKey,value);else sessionStorage.removeItem(tokenKey);}catch{}}
export function authHeaders():Record<string,string>{return token?{Authorization:'Bearer '+token}:{};}
const isLocalHost=()=>/^(localhost|127\.0\.0\.1|\[?::1\]?)$/.test(location.hostname);
/** Work out WHY a request failed, so the message says something useful instead of "Failed to fetch". */
async function explainNetworkFailure():Promise<string>{
 if(isLocalHost())return 'Cannot reach the MEDIFY API. Start the backend with "npm run dev" (and run "npm run db:init" once), then try again.';
 if(typeof navigator!=='undefined'&&navigator.onLine===false)return 'You appear to be offline. Check your internet connection and try again.';
 const url=apiBase()+'/health';
 const probe=(mode:RequestMode)=>fetch(url,{mode,cache:'no-store',credentials:'omit',signal:AbortSignal.timeout(3000)});
 const [cors,opaque]=await Promise.allSettled([probe('cors'),probe('no-cors')]);
 if(cors.status==='fulfilled')return 'Connection problem. Please try again. (E_RETRY)';
 let host=url;try{host=new URL(url,location.href).host;}catch{}
 if(opaque.status==='fulfilled'){console.warn('[MEDIFY] The API at '+host+' answered, but the browser blocked the reply. Either this site ('+location.origin+') is missing from FRONTEND_ORIGINS on the API server, or the API is returning an error page. Open '+url+' directly to tell which.');return 'The server answered but the browser blocked the reply. This is a server setup problem (CORS or an API error page), not your connection. (E_CORS)';}
 console.warn('[MEDIFY] Cannot reach the API at '+host+'. It may be stopped, restarting, or its DNS/SSL certificate is not working.');
 return 'Cannot reach the MEDIFY server ('+host+'). It may be stopped, restarting, or its HTTPS security certificate is missing or invalid. Please try again shortly. (E_SERVER)';
}
export async function api(path:string,body?:unknown,method?:string):Promise<any>{
 const multipart=body instanceof FormData;
 let res:Response;
 try{res=await fetch(apiBase()+path,{method:method||(body===undefined?'GET':'POST'),credentials:'include',headers:{...authHeaders(),...(body===undefined||multipart?{}:{'Content-Type':'application/json'})},body:body===undefined?undefined:multipart?body:JSON.stringify(body)});}
 catch{throw new TypeError(await explainNetworkFailure());}
 let data:any;
 try{data=await res.json();}
 catch{if(res.status>=500)throw new TypeError(isLocalHost()?'Cannot reach the MEDIFY API. Start the backend with "npm run dev" (and run "npm run db:init" once), then try again.':'The server is not responding. Please try again in a moment.');throw new Error('Unexpected response from the server (HTTP '+res.status+').');}
 if(!res.ok){const e:any=new Error(data.error||'Request failed');e.code=data.code;e.status=res.status;if(res.status===401||(res.status===403&&data.error==='Administrator required'))window.dispatchEvent(new Event('medify-auth-check'));throw e;}
 if(data.sessionToken)setSessionToken(data.sessionToken);
 if(path==='/auth/logout'||(path==='/auth/me'&&!data.user))setSessionToken(null);
 return data;
}
export async function openPaymentProof(id:string){
 const tab=window.open('about:blank','_blank');
 if(tab)tab.opener=null;
 try{const res=await fetch(apiBase()+'/payment-proof?id='+encodeURIComponent(id),{credentials:'include',headers:authHeaders()});if(!res.ok){const d=await res.json();throw Error(d.error||'Could not open proof');}const url=URL.createObjectURL(await res.blob());if(tab)tab.location.href=url;else{const a=document.createElement('a');a.href=url;a.download='payment-proof';a.click();}setTimeout(()=>URL.revokeObjectURL(url),60000);}catch(e){tab?.close();throw e;}
}
