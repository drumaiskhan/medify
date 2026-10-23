import {api} from './client';
export interface User {uid:string;email:string;emailVerified:boolean;role:string;displayName?:string;reload:()=>Promise<void>}
export const auth:{currentUser:User|null}={currentUser:null};
const listeners=new Set<(u:User|null)=>void>();
export function update(u:any){auth.currentUser=u?{...u,reload:refreshUser}:null;listeners.forEach(fn=>fn(auth.currentUser));}
export async function refreshUser(){const r=await api('/auth/me');update(r.user)}
export function onAuthStateChanged(_:unknown,fn:(u:User|null)=>void){listeners.add(fn);const check=()=>{refreshUser().catch(()=>fn(null));};check();window.addEventListener('medify-auth-check',check);return ()=>{listeners.delete(fn);window.removeEventListener('medify-auth-check',check);}}
export async function signInWithEmailAndPassword(_:unknown,email:string,password:string){const r=await api('/auth/login',{email,password});update(r.user);return {user:auth.currentUser!}}
export async function createUserWithEmailAndPassword(_:unknown,email:string,password:string){const r=await api('/auth/register',{email,password});update(r.user);return {user:auth.currentUser!}}
export async function signOut(_:unknown){await api('/auth/logout',{});update(null)}
export async function sendEmailVerification(_:User){await api('/auth/verify-request',{})}
export async function sendPasswordResetEmail(_:unknown,email:string){await api('/auth/reset-request',{email})}
