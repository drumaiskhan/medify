import {useEffect,useState} from 'react';
import {Link} from 'react-router-dom';
import {api} from '../lib/client';
import {update} from '../lib/auth';
import {markLease} from '../lib/offline';
import {useSite} from '../context/SiteContext';
import {PLANS} from '../data/plans';
import {getPublishedYears,YearDoc} from '../services/curriculum';
import {getPaymentDetails,PaymentDetailsDoc} from '../services/payments';
import '../inbox.css';
export function RegisterPage(){
 const site=useSite();
 const [step,setStep]=useState(1),[fullName,setFullName]=useState(''),[email,setEmail]=useState(''),[password,setPassword]=useState(''),[college,setCollege]=useState(''),[yearId,setYearId]=useState(''),[planId,setPlanId]=useState('half-yearly'),[method,setMethod]=useState('jazzcash'),[transactionId,setTransactionId]=useState(''),[last4,setLast4]=useState(''),[proof,setProof]=useState<File|null>(null),[agree,setAgree]=useState(false),[busy,setBusy]=useState(false),[error,setError]=useState(''),[warning,setWarning]=useState(''),[done,setDone]=useState(false),[verification,setVerification]=useState(false),[loading,setLoading]=useState(true),[years,setYears]=useState<YearDoc[]>([]),[details,setDetails]=useState<PaymentDetailsDoc|null>(null),[prices,setPrices]=useState<Record<string,number>>({}),[couponInput,setCouponInput]=useState(''),[coupon,setCoupon]=useState<{code:string;finalAmount:number}|null>(null);
 useEffect(()=>{Promise.all([getPublishedYears().then(setYears),getPaymentDetails().then(setDetails),api('/registration/options').then(d=>setPrices(d.planPrices))]).catch(e=>setError(e.message)).finally(()=>setLoading(false));},[]);
 useEffect(()=>{setCoupon(null);},[planId,yearId]);
 const plan=PLANS.find(p=>p.id===planId)!;
 const amount=coupon?coupon.finalAmount:prices[planId];
 const selectProof=(file?:File)=>{setProof(null);if(!file)return;if(file.size>5*1024*1024){setError('Payment proof must be at most 5 MB.');return;}if(!['image/jpeg','image/png','image/webp','application/pdf'].includes(file.type)){setError('Choose a JPEG, PNG, WebP or PDF receipt.');return;}setError('');setProof(file);};
 const applyCoupon=async()=>{setBusy(true);setError('');try{setCoupon(await api('/registration/quote',{code:couponInput,planId,yearId}));}catch(e:any){setCoupon(null);setError(e.message);}finally{setBusy(false);}};
 const submit=async(e:React.FormEvent)=>{
  e.preventDefault();setError('');if(busy)return;
  if(step===1){setStep(2);return;}
  if(amount===undefined){setError('Plan prices are unavailable. Reload before submitting.');return;}
  if(amount>0&&(!proof||!transactionId.trim())){setError('Enter your transaction ID and upload payment proof.');return;}
  if(!agree){setError('Please accept the terms and privacy policy.');return;}
  setBusy(true);
  try{
   const data=new FormData();
   const fields={checkout:true,fullName,email:email.trim(),password,college,yearId,planId,planName:plan.name,curriculum:'KMU',method,transactionId:amount===0?'':transactionId.trim(),last4Digits:last4,paymentTime:new Date().toISOString(),couponCode:coupon?.code||''};
   for(const [k,v] of Object.entries(fields))data.append(k,String(v));if(proof)data.append('proof',proof);
   const result=await api('/auth/register',data);update(result.user);markLease(result.user);setVerification(result.user.emailVerificationRequired&&!result.user.emailVerified);setWarning(result.verificationWarning||'');setPassword('');setDone(true);
  }catch(e:any){setError(e.message||'Registration failed. Please try again.');}finally{setBusy(false);}
 };
 if(done)return <div className="inbox" style={{maxWidth:650}}><div className="card"><h1>Application submitted</h1><p>Your account and payment request have been saved. The admin team will review your payment and activate your selected year.</p>{verification&&<p className="reply">Check your email for the verification link. You can resend it from your dashboard.</p>}{warning&&<div className="error" role="alert">Your account was created, but {warning} You do not need to register again.</div>}<Link className="action" to="/dashboard">Go to dashboard</Link></div></div>;
 if(!site.registrationOpen)return <div className="inbox"><h1>Registration is closed</h1><Link to="/login">Sign in to your account</Link></div>;
 return <div className="inbox" style={{maxWidth:650}}><Link to="/">← Back to home</Link><div className="card"><p className="muted">JOIN MEDIFY · STEP {step} OF 2</p><h1>{step===1?'Your student account':'Payment & proof'}</h1><p className="muted">{step===1?'Choose your academic year and subscription.':'Send payment using the details below, then attach your receipt. Your account is created when you submit this step.'}</p>{error&&<div className="error" role="alert">{error}</div>}{loading?<p>Loading registration options…</p>:<form onSubmit={submit}>
 {step===1?<><label>Full name<input required maxLength={200} autoComplete="name" value={fullName} onChange={e=>setFullName(e.target.value)}/></label><label>Email<input required type="email" autoComplete="email" value={email} onChange={e=>setEmail(e.target.value)}/></label><label>Password<input required type="password" minLength={8} maxLength={256} autoComplete="new-password" value={password} onChange={e=>setPassword(e.target.value)}/></label><label>College<input maxLength={200} value={college} onChange={e=>setCollege(e.target.value)}/></label><label>Academic year<select required value={yearId} onChange={e=>setYearId(e.target.value)}><option value="">Select your year</option>{years.map(y=><option value={y.id} key={y.id}>{y.name}</option>)}</select></label><label>Subscription<select value={planId} onChange={e=>setPlanId(e.target.value)}>{PLANS.map(p=><option key={p.id} value={p.id}>{p.name} ({p.durationMonths} months) · PKR {prices[p.id]??'—'}</option>)}</select></label><button className="primary" disabled={!years.length||prices[planId]===undefined}>Continue to payment →</button></>:<>
 <div className="reply"><strong>{fullName}</strong><p>{email} · {years.find(y=>y.id===yearId)?.name}</p><p>{plan.name} · {plan.durationMonths} months</p></div>
 <label>Coupon (optional)<input value={couponInput} disabled={busy} onChange={e=>{setCouponInput(e.target.value);setCoupon(null);}}/></label><div className="actions"><button type="button" disabled={busy||!couponInput.trim()} onClick={applyCoupon}>Apply coupon</button>{coupon&&<button type="button" disabled={busy} onClick={()=>{setCoupon(null);setCouponInput('');}}>Remove coupon</button>}</div><h2 style={{margin:'20px 0'}}>Amount to pay: PKR {amount??'—'}</h2>
 {amount===0?<div className="success">The coupon covers the full fee. No transfer or proof is needed. Admin approval still applies.</div>:<><label>Payment method<select value={method} onChange={e=>setMethod(e.target.value)}><option value="jazzcash">JazzCash</option><option value="meezan">Meezan Bank</option></select></label><div className="reply">{details&&(method==='jazzcash'?<><strong>{details.jazzcash.accountTitle}</strong><p>JazzCash: {details.jazzcash.number}</p></>:<><strong>{details.meezan.accountTitle}</strong><p>{details.meezan.bankName} · {details.meezan.accountNumber}</p>{details.meezan.iban&&<p>IBAN: {details.meezan.iban}</p>}</>)}<p className="muted">{details?.instructions}</p></div><label>Transaction ID<input required maxLength={200} value={transactionId} onChange={e=>setTransactionId(e.target.value)}/></label><label>Sending account's last 4 digits<input required pattern="[0-9]{4}" maxLength={4} inputMode="numeric" value={last4} onChange={e=>setLast4(e.target.value)}/></label><label>Payment screenshot or receipt<input type="file" required={!proof} accept="image/jpeg,image/png,image/webp,application/pdf" onChange={e=>selectProof(e.target.files?.[0])}/><span className="muted">JPEG, PNG, WebP or PDF · maximum 5 MB. Visible only to you and administrators.</span>{proof&&<span>{proof.name}</span>}</label></>}
 <label style={{display:'flex',alignItems:'start'}}><input type="checkbox" required checked={agree} onChange={e=>setAgree(e.target.checked)} style={{width:'auto'}}/><span>I agree to the <Link to="/terms" target="_blank">terms</Link> and <Link to="/privacy" target="_blank">privacy policy</Link>.</span></label><div className="actions"><button type="button" disabled={busy} onClick={()=>setStep(1)}>← Back</button><button className="primary" disabled={busy||amount===undefined}>{busy?'Submitting application…':'Create account & submit payment'}</button></div>
 </>}
 </form>}<p className="muted" style={{marginTop:24}}>Already registered? <Link to="/login">Sign in</Link> to continue your application.</p></div></div>;
}
