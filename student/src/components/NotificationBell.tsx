import {useEffect,useState} from 'react';
import {Link,useLocation} from 'react-router-dom';
import {Bell} from 'lucide-react';
import {api} from '../lib/client';
import {useAuth} from '../context/AuthContext';
export function NotificationBell(){const {user}=useAuth();const [count,setCount]=useState(0);const location=useLocation();useEffect(()=>{let active=true;setCount(0);const refresh=()=>{if(user)api('/notifications/count').then(d=>{if(active)setCount(d.unread);}).catch(()=>{});};refresh();const timer=window.setInterval(refresh,60000);window.addEventListener('inbox-updated',refresh);window.addEventListener('focus',refresh);return()=>{active=false;clearInterval(timer);window.removeEventListener('inbox-updated',refresh);window.removeEventListener('focus',refresh);};},[user?.uid,location.pathname]);if(!user)return null;return <Link to="/notifications" aria-label={`Notifications, ${count} unread`} className="relative inline-flex items-center p-2 rounded hover:bg-white/10"><Bell size={20}/>{count>0&&<span className="absolute -top-1 -right-1 rounded-full bg-red-500 text-white text-[10px] px-1">{count>99?'99+':count}</span>}</Link>;}
