import {useEffect,useRef,useState} from 'react';
import {createPortal} from 'react-dom';
import {apiBase,authHeaders} from '../lib/client';

/** Fetch protected receipts with the admin token before rendering a blob URL. */
export function PaymentProof({paymentId}:{paymentId:string}){
 const host=useRef<HTMLDivElement>(null),closeButton=useRef<HTMLButtonElement>(null),trigger=useRef<HTMLButtonElement>(null);
 const [visible,setVisible]=useState(false),[source,setSource]=useState(''),[mime,setMime]=useState(''),[error,setError]=useState(''),[retry,setRetry]=useState(0),[expanded,setExpanded]=useState(false);
 useEffect(()=>{
  if(!host.current)return;
  if(!('IntersectionObserver' in window)){setVisible(true);return;}
  const observer=new IntersectionObserver(entries=>{if(entries.some(e=>e.isIntersecting)){setVisible(true);observer.disconnect();}},{rootMargin:'150px'});
  observer.observe(host.current);return()=>observer.disconnect();
 },[]);
 useEffect(()=>{
  if(!visible)return;
  const controller=new AbortController();let active=true,url='';setSource('');setError('');
  (async()=>{
   const response=await fetch(apiBase()+'/payment-proof?id='+encodeURIComponent(paymentId),{credentials:'include',headers:authHeaders(),signal:controller.signal});
   if(!response.ok){const data=await response.json().catch(()=>({}));throw new Error(data.error||'Could not load payment proof.');}
   const blob=await response.blob();
   if(!['image/jpeg','image/png','image/webp','application/pdf'].includes(blob.type))throw new Error('Unsupported receipt format.');
   if(!active)return;
   url=URL.createObjectURL(blob);setMime(blob.type);setSource(url);
  })().catch(e=>{if(active&&!controller.signal.aborted)setError(e.message||'Could not load payment proof.');});
  return()=>{active=false;controller.abort();if(url)URL.revokeObjectURL(url);};
 },[paymentId,visible,retry]);
 useEffect(()=>{
  if(!expanded)return;
  closeButton.current?.focus();
  const key=(e:KeyboardEvent)=>{if(e.key==='Escape')setExpanded(false);};
  const overflow=document.body.style.overflow;document.body.style.overflow='hidden';
  window.addEventListener('keydown',key);
  return()=>{document.body.style.overflow=overflow;window.removeEventListener('keydown',key);trigger.current?.focus();};
 },[expanded]);
 return <div ref={host} className="mt-2 font-sans font-normal" style={{minWidth:140,maxWidth:200}}>
 {error?<div role="alert" className="text-xs text-red-700"><p>{error}</p><button type="button" className="underline mt-1" onClick={()=>setRetry(n=>n+1)}>Retry loading proof</button></div>:!source?<p className="text-xs text-slate-500" role="status">{visible?'Loading payment proof…':'Payment proof attached'}</p>:<>
 <button ref={trigger} type="button" className="block rounded-lg border border-slate-200 bg-slate-50 p-2 text-left w-full hover:border-teal-600" onClick={()=>setExpanded(true)} aria-label="Enlarge payment proof">
 {mime==='application/pdf'?<span className="block text-xs font-semibold text-teal-700 py-3">PDF receipt · View here</span>:<img src={source} alt="Uploaded payment proof" className="rounded w-full object-contain" style={{height:125}} onError={()=>setError('The receipt image could not be displayed. Try loading it again.')}/>}
 <span className="block text-[11px] text-teal-700 mt-1">{mime==='application/pdf'?'Open receipt':'Click to enlarge'}</span>
 </button>
 {expanded&&createPortal(<div className="fixed inset-0 z-[100] bg-black/70 p-3 sm:p-6 flex items-center justify-center" onClick={e=>{if(e.target===e.currentTarget)setExpanded(false);}}><section role="dialog" aria-modal="true" aria-label="Payment proof preview" className="bg-white rounded-xl w-full max-w-4xl overflow-hidden flex flex-col" style={{maxHeight:'92dvh'}} onKeyDown={e=>{if(e.key==='Tab'){const nodes=Array.from(e.currentTarget.querySelectorAll<HTMLElement>('button,a[href],iframe'));const first=nodes[0],last=nodes[nodes.length-1];if(e.shiftKey&&document.activeElement===first){e.preventDefault();last?.focus();}else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first?.focus();}}}}>
 <header className="flex flex-wrap justify-between items-center gap-3 border-b p-4"><h2 className="font-bold text-slate-900">Payment proof</h2><div className="flex gap-4 items-center"><a href={source} target="_blank" rel="noopener noreferrer" className="text-sm text-teal-700 underline">Open original</a><button ref={closeButton} type="button" className="px-3 py-2 rounded bg-slate-100 text-sm text-slate-800" onClick={()=>setExpanded(false)}>Close</button></div></header>
 <div className="overflow-auto p-3 bg-slate-50" style={{minHeight:0}}>{mime==='application/pdf'?<><iframe src={source} title="Payment receipt PDF" className="w-full border-0" style={{height:'70dvh'}}/><p className="text-xs text-slate-600 mt-2">If the PDF preview is unavailable on your device, choose Open original.</p></>:<img src={source} alt="Payment proof at full size" style={{display:'block',maxWidth:'100%',height:'auto',margin:'0 auto'}}/>}</div>
 </section></div>,document.body)}
 </>}
 </div>;
}
