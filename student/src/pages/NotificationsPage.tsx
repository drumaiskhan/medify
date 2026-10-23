import {useEffect,useState} from 'react';
import {Link} from 'react-router-dom';
import {api} from '../lib/client';
import '../inbox.css';
type Notification={id:string;title:string;body:string;type:string;link:string|null;read:boolean;createdAt:string};
export function NotificationsPage(){
 const [items,setItems]=useState<Notification[]>([]),[error,setError]=useState(''),[busy,setBusy]=useState(false),[loading,setLoading]=useState(true);
 const load=async()=>{const d=await api('/notifications');setItems(d.notifications);window.dispatchEvent(new Event('inbox-updated'));};
 useEffect(()=>{load().catch(e=>setError(e.message)).finally(()=>setLoading(false));},[]);
 const act=async(path:string,body:unknown)=>{setBusy(true);setError('');try{await api(path,body);await load();}catch(e:any){setError(e.message);}finally{setBusy(false);}};
 return <div className="inbox"><p className="muted">YOUR UPDATES</p><h1>Notifications</h1><p className="muted">Payment decisions, replies, and announcements. Updates are kept for 90 days.</p>{error&&<div className="error" role="alert">{error}</div>}<div className="actions" style={{marginTop:20}}><button disabled={busy||!items.some(n=>!n.read)} onClick={()=>void act('/notifications/read',{all:true})}>Mark all read</button><button disabled={busy||!items.length} onClick={()=>{if(window.confirm('Clear all your notifications?'))void act('/notifications/clear',{});}}>Clear all</button><button disabled={busy} onClick={()=>load().catch(e=>setError(e.message))}>Refresh</button><Link to="/feedback">Feedback & support</Link></div>{loading?<p role="status">Loading updates…</p>:!items.length?<div className="card">You are all caught up.</div>:items.map(n=><article key={n.id} className={'card '+(!n.read?'unread':'')}><span className="badge">{n.type}</span>{!n.read&&<span className="badge">Unread</span>}<h2>{n.title}</h2><p style={{margin:'12px 0'}}>{n.body}</p><p className="muted">{new Date(n.createdAt).toLocaleString()}</p><div className="actions" style={{marginTop:12}}>{!n.read&&<button disabled={busy} onClick={()=>void act('/notifications/read',{id:n.id})}>Mark read</button>}{n.link&&<Link to={n.link}>Open details →</Link>}</div></article>)}</div>;
}
