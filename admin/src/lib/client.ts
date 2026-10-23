export const db = {};
export {auth} from './auth';
export const apiBase=()=> (window.MEDIFY_CONFIG?.API_URL || import.meta.env.VITE_API_URL || "http://localhost:3002/api").replace(/\/$/, "");
const tokenKey='medify-admin-session:'+apiBase();
let token:string|null=null;
try{token=sessionStorage.getItem(tokenKey);}catch{}
export function setSessionToken(value:string|null){token=value;try{if(value)sessionStorage.setItem(tokenKey,value);else sessionStorage.removeItem(tokenKey);}catch{}}
export function authHeaders():Record<string,string>{return token?{Authorization:'Bearer '+token}:{};}
export async function api(path:string,body?:unknown,method?:string):Promise<any>{
 const multipart=body instanceof FormData;
 const res=await fetch(apiBase()+path,{method:method||(body===undefined?'GET':'POST'),credentials:'include',headers:{...authHeaders(),...(body===undefined||multipart?{}:{'Content-Type':'application/json'})},body:body===undefined?undefined:multipart?body:JSON.stringify(body)});
 const data=await res.json();
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
