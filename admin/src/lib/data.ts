// HTTP data adapter. All storage and authorization are owned by the PostgreSQL API.
import {api} from './client';
export class Timestamp { constructor(public seconds:number){} toMillis(){return this.seconds*1000} toDate(){return new Date(this.toMillis())} }
function revive(v:any):any {if(!v||typeof v!=='object')return v;if(typeof v.seconds==='number')return new Timestamp(v.seconds);if(Array.isArray(v))return v.map(revive);return Object.fromEntries(Object.entries(v).map(([k,x])=>[k,revive(x)]));}
export const serverTimestamp=()=>({__serverTimestamp:true});
type Ref={collection:string;id?:string;filters?:any[]};
export const collection=(_:unknown,name:string):Ref=>({collection:name});
export const doc=(_:unknown,name:string,id:string):Ref=>({collection:name,id});
export const where=(field:string,op:string,value:any)=>({field,op,value});
export const orderBy=(field:string,direction='asc')=>({sort:field,direction});
export const query=(ref:Ref,...filters:any[]):Ref=>({...ref,filters});
const snap=(x:any)=>({id:x.id,exists:()=>x.data!==null,data:()=>revive(x.data)});
export async function getDoc(ref:Ref){return snap(await api('/data/read',ref))}
export async function getDocs(ref:Ref){const rows=await api('/data/query',ref);const docs:ReturnType<typeof snap>[]=rows.map(snap);return {docs,empty:!docs.length,size:docs.length,forEach:(fn:(d:any)=>void)=>docs.forEach(fn)}}
export async function setDoc(ref:Ref,data:any,options?:{merge?:boolean}){await api('/data/write',{...ref,data,merge:!!options?.merge})}
export async function updateDoc(ref:Ref,data:any){await api('/data/write',{...ref,data,merge:true,requireExists:true})}
export function writeBatch(_:unknown){const ops:any[]=[];return {set:(ref:Ref,data:any)=>ops.push({...ref,data}),delete:(ref:Ref)=>ops.push({...ref,remove:true}),commit:()=>api('/data/batch',{ops})}}
