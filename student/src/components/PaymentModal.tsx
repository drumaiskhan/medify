import React, { useState, useEffect } from 'react';
import {
  X,
  Check,
  Copy,
  Clock,
  ShieldCheck,
  AlertCircle,
  Loader2,
  Building2,
  Smartphone,
  ChevronRight
} from 'lucide-react';
import { doc, getDoc } from '../lib/data';
import { db } from '../lib/client';
import { useAuth } from '../context/AuthContext';
import { Plan, PLANS } from '../data/plans';
import { YearDoc, getPublishedYears } from '../services/curriculum';
import {
  PaymentDetailsDoc,
  getPaymentDetails,
  submitPaymentRequest,
  getPaymentMethodLabel,
  isValidWhatsAppNumber,
  validateCoupon,
  CouponCheck
} from '../services/payments';
import { WhatsAppButton } from './WhatsAppButton';
import { isMatchingYear } from '../utils/studentAccess';

interface PaymentModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialPlan?: Plan | null;
  initialYearId?: string | null;
  initialYearName?: string | null;
  onSuccess?: () => void;
}

export function PaymentModal({
  isOpen,
  onClose,
  initialPlan,
  initialYearId,
  initialYearName,
  onSuccess
}: PaymentModalProps) {
  const { user } = useAuth();

  // Selected Plan & Year
  const [selectedPlan, setSelectedPlan] = useState<Plan>(initialPlan || PLANS[1]);
  const [years, setYears] = useState<YearDoc[]>([]);
  const [selectedYearId, setSelectedYearId] = useState<string>(initialYearId || '');
  const [selectedYearName, setSelectedYearName] = useState<string>(initialYearName || '');

  // Payment Details from settings/paymentDetails
  const [paymentDetails, setPaymentDetails] = useState<PaymentDetailsDoc | null>(null);
  const [loadingDetails, setLoadingDetails] = useState<boolean>(true);

  // Form State: Only two allowed methods: 'jazzcash' | 'meezan'
  const [method, setMethod] = useState<'jazzcash' | 'meezan'>('jazzcash');
  const [proof,setProof]=useState<File|null>(null);
  const [transactionId, setTransactionId] = useState<string>('');
  const [last4Digits, setLast4Digits] = useState<string>('');
  const [paymentTime, setPaymentTime] = useState<string>(() => {
    const now = new Date();
    return now.toISOString().slice(0, 16); // YYYY-MM-DDTHH:mm
  });

  // UI status
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  // Discount coupon. The server re-checks the code and sets the real amount on submission.
  const [couponInput, setCouponInput] = useState<string>('');
  const [coupon, setCoupon] = useState<CouponCheck | null>(null);
  const [couponError, setCouponError] = useState<string | null>(null);
  const [couponBusy, setCouponBusy] = useState<boolean>(false);
  const listPrice = Number(selectedPlan.price.replace(/[^0-9]/g, '')) || 0;
  const payable = coupon ? coupon.finalAmount : listPrice;
  const isFree = payable === 0;

  // A coupon is checked against one plan and year, so changing either clears it.
  useEffect(() => {
    setCoupon(null);
    setCouponError(null);
  }, [selectedPlan.id, selectedYearId]);

  const applyCoupon = async () => {
    setCouponError(null);
    if (!couponInput.trim()) {
      setCouponError('Enter a coupon code first.');
      return;
    }
    setCouponBusy(true);
    try {
      setCoupon(await validateCoupon(couponInput, selectedPlan.id, selectedYearId));
    } catch (err: any) {
      setCoupon(null);
      setCouponError(err.message || 'Could not check this coupon.');
    } finally {
      setCouponBusy(false);
    }
  };

  const removeCoupon = () => {
    setCoupon(null);
    setCouponInput('');
    setCouponError(null);
  };

  // Completed submission state
  const [submittedRequest, setSubmittedRequest] = useState<{
    id: string;
    userName: string;
    userEmail: string;
    yearName: string;
    planName: string;
    durationMonths: number;
    amountPKR: string;
    method: 'jazzcash' | 'meezan';
    transactionId: string;
  } | null>(null);

  // Fetch available years and payment settings
  useEffect(() => {
    if (!isOpen) return;

    let isCancelled = false;
    async function loadData() {
      setLoadingDetails(true);
      try {
        const [fetchedYears, details] = await Promise.all([
          getPublishedYears(),
          getPaymentDetails()
        ]);

        if (isCancelled) return;

        setYears(fetchedYears);
        setPaymentDetails(details);

        if (!selectedYearId && fetchedYears.length > 0) {
          let matchedYear: YearDoc | undefined;
          if (user) {
            try {
              const uSnap = await getDoc(doc(db, 'users', user.uid));
              if (uSnap.exists()) {
                const uData = uSnap.data();
                const target = uData.purchasedYearId || uData.academicYear || uData.selectedYearId;
                if (target) {
                  matchedYear = fetchedYears.find((y) => isMatchingYear(y, target));
                }
              }
            } catch {
              // fallback to first year
            }
          }
          const chosenYear = matchedYear || fetchedYears[0];
          setSelectedYearId(chosenYear.id);
          setSelectedYearName(chosenYear.name);
        } else if (selectedYearId) {
          const found = fetchedYears.find((y) => y.id === selectedYearId);
          if (found) setSelectedYearName(found.name);
        }
      } catch (err) {
        console.error('Failed to load payment options:', err);
      } finally {
        if (!isCancelled) {
          setLoadingDetails(false);
        }
      }
    }

    loadData();

    return () => {
      isCancelled = true;
    };
  }, [isOpen, selectedYearId]);

  // Sync plan if prop changes
  useEffect(() => {
    if (initialPlan) setSelectedPlan(initialPlan);
  }, [initialPlan]);

  // Sync year if prop changes
  useEffect(() => {
    if (initialYearId) setSelectedYearId(initialYearId);
    if (initialYearName) setSelectedYearName(initialYearName);
  }, [initialYearId, initialYearName]);

  // Reset form when opened fresh
  useEffect(() => {
    if (isOpen) {
      setSubmittedRequest(null);
      setErrorMessage(null);
      setTransactionId('');
      setLast4Digits('');
      setPaymentTime(new Date().toISOString().slice(0, 16));
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleCopy = (text: string, key: string) => {
    if (!text) return;
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    setTimeout(() => {
      setCopiedKey(null);
    }, 2000);
  };

  const handleYearChange = (yearId: string) => {
    setSelectedYearId(yearId);
    const found = years.find((y) => y.id === yearId);
    setSelectedYearName(found ? found.name : 'MBBS Year');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    if (!user) {
      setErrorMessage('You must be logged in to submit a payment request.');
      return;
    }

    // A coupon that covers the whole fee needs no bank transfer, so a reference is generated.
    const cleanTxId = isFree ? `FREE-${Date.now().toString(36).toUpperCase()}` : transactionId.trim();
    if (!cleanTxId) {
      setErrorMessage('Please enter the Transaction ID provided by your payment receipt.');
      return;
    }

    const cleanLast4 = isFree ? '0000' : last4Digits.trim();
    if (!cleanLast4) {
      setErrorMessage('Please enter the last 4 digits of your account or mobile number.');
      return;
    }

    if (!selectedYearId) {
      setErrorMessage('Please select the MBBS Academic Year you wish to subscribe to.');
      return;
    }

    if(!isFree&&!proof){setErrorMessage('Upload your payment screenshot or receipt.');return;}
    // Amount string or number (e.g. from plan price "PKR XXX" or numeric)
    const amountVal = String(payable);

    setIsSubmitting(true);
    try {
      const docId = await submitPaymentRequest({
        userId: user.uid,
        userName: user.displayName || 'Medical Student',
        userEmail: user.email || '',
        yearId: selectedYearId,
        yearName: selectedYearName || 'MBBS Year',
        planId: selectedPlan.id,
        planName: selectedPlan.name,
        durationMonths: selectedPlan.durationMonths,
        amountPKR: amountVal,
        method: method,
        transactionId: cleanTxId,
        last4Digits: cleanLast4,
        paymentTime: paymentTime,
        proof: proof || undefined,
        couponCode: coupon ? coupon.code : undefined
      });

      setSubmittedRequest({
        id: docId,
        userName: user.displayName || 'Medical Student',
        userEmail: user.email || '',
        yearName: selectedYearName || 'MBBS Year',
        planName: selectedPlan.name,
        durationMonths: selectedPlan.durationMonths,
        amountPKR: amountVal,
        method: method,
        transactionId: cleanTxId
      });

      if (onSuccess) {
        onSuccess();
      }
    } catch (err: any) {
      console.error('Payment request submission error:', err);
      setErrorMessage(err.message || 'Failed to submit payment request. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-black/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4">
      <div className="relative bg-white rounded-2xl shadow-2xl max-w-2xl w-full overflow-hidden border border-slate-200 animate-in fade-in zoom-in-95 duration-150">
        
        {/* Top Header */}
        <div className="bg-[#0F2837] text-white px-5 sm:px-6 py-4 flex items-center justify-between border-b border-white/10">
          <div>
            <span className="text-[11px] font-bold text-teal-300 uppercase tracking-wider block">
              MEDIFY Subscription Checkout
            </span>
            <h2 className="font-serif-heading text-lg sm:text-xl font-bold text-white">
              {submittedRequest ? 'Payment Request Submitted' : 'Complete Manual Transfer'}
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-300 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
            aria-label="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-5 sm:p-6 max-h-[80vh] overflow-y-auto">
          {loadingDetails ? (
            <div className="py-12 flex flex-col items-center justify-center text-slate-400">
              <Loader2 className="w-7 h-7 animate-spin text-[#1B8E8E] mb-2" />
              <p className="text-xs">Loading payment account information...</p>
            </div>
          ) : submittedRequest ? (
            /* =========================================================
               CONFIRMATION SCREEN: Pending Verification
               ========================================================= */
            <div className="space-y-6">
              <div className="p-4 rounded-xl bg-amber-50 border border-amber-200 text-amber-900 flex items-start gap-3">
                <Clock className="w-6 h-6 text-amber-600 shrink-0 mt-0.5" />
                <div>
                  <h3 className="font-bold text-sm text-amber-950">
                    Pending Verification
                  </h3>
                  <p className="text-xs text-amber-900/90 mt-1 leading-relaxed">
                    Thank you! Your payment verification request has been received. Our team will verify your transaction against our bank statement and activate your access shortly.
                  </p>
                </div>
              </div>

              {/* Submitted Details Summary */}
              <div className="bg-[#F8FAFC] rounded-xl p-4 border border-[#CFDBE5] text-xs space-y-2">
                <div className="flex justify-between py-1 border-b border-[#CFDBE5]/60">
                  <span className="text-slate-500">Student:</span>
                  <span className="font-semibold text-slate-800">{submittedRequest.userName} ({submittedRequest.userEmail})</span>
                </div>
                <div className="flex justify-between py-1 border-b border-[#CFDBE5]/60">
                  <span className="text-slate-500">Academic Year:</span>
                  <span className="font-semibold text-slate-800">{submittedRequest.yearName}</span>
                </div>
                <div className="flex justify-between py-1 border-b border-[#CFDBE5]/60">
                  <span className="text-slate-500">Selected Plan:</span>
                  <span className="font-semibold text-slate-800">
                    {submittedRequest.planName} ({submittedRequest.durationMonths} months)
                  </span>
                </div>
                <div className="flex justify-between py-1 border-b border-[#CFDBE5]/60">
                  <span className="text-slate-500">Amount:</span>
                  <span className="font-bold text-slate-900 font-mono">PKR {submittedRequest.amountPKR}</span>
                </div>
                <div className="flex justify-between py-1 border-b border-[#CFDBE5]/60">
                  <span className="text-slate-500">Payment Method:</span>
                  <span className="font-semibold text-[#0F2837]">
                    {getPaymentMethodLabel(submittedRequest.method)}
                  </span>
                </div>
                <div className="flex justify-between py-1">
                  <span className="text-slate-500">Transaction ID:</span>
                  <span className="font-mono font-bold text-[#1B8E8E]">{submittedRequest.transactionId}</span>
                </div>
              </div>

              {/* WhatsApp Screenshot Button & Note */}
              {paymentDetails?.whatsappNumber && (
                <div className="pt-2 border-t border-slate-200">
                  <div className="text-xs font-semibold text-slate-700 mb-2">
                    Speed up verification (Optional):
                  </div>
                  <WhatsAppButton
                    whatsappNumber={paymentDetails.whatsappNumber}
                    request={submittedRequest}
                  />
                </div>
              )}

              <div className="pt-4 flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-5 py-2.5 rounded-lg text-xs font-semibold text-white bg-[#0F2837] hover:bg-[#15345d] transition-colors cursor-pointer"
                >
                  Done & Return
                </button>
              </div>
            </div>
          ) : (
            /* =========================================================
               PAYMENT FORM
               ========================================================= */
            <form onSubmit={handleSubmit} className="space-y-6">
{!isFree&&<label className="block text-xs font-semibold mb-4">Payment screenshot or receipt (required)<input type="file" accept="image/jpeg,image/png,image/webp,application/pdf" className="block w-full mt-2" onChange={e=>{const f=e.target.files?.[0];setProof(null);if(f&&f.size>5*1024*1024){setErrorMessage('Proof must be at most 5 MB.');return;}setProof(f||null);}}/><span className="text-slate-500">Maximum 5 MB · JPEG, PNG, WebP or PDF</span></label>}

              {errorMessage && (
                <div className="p-3.5 bg-rose-50 border border-rose-200 rounded-lg text-xs text-rose-800 flex items-start gap-2.5">
                  <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                  <span className="flex-1">{errorMessage}</span>
                </div>
              )}

              {/* Package & Year Selection Strip */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1">
                    Academic Year
                  </label>
                  <select
                    value={selectedYearId}
                    onChange={(e) => handleYearChange(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg border border-slate-300 text-xs bg-white focus:ring-2 focus:ring-[#1B8E8E] focus:border-transparent outline-hidden"
                  >
                    {years.map((y) => (
                      <option key={y.id} value={y.id}>
                        {y.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1">
                    Subscription Duration
                  </label>
                  <select
                    value={selectedPlan.id}
                    onChange={(e) => {
                      const p = PLANS.find((item) => item.id === e.target.value);
                      if (p) setSelectedPlan(p);
                    }}
                    className="w-full px-3 py-2 rounded-lg border border-slate-300 text-xs bg-white focus:ring-2 focus:ring-[#1B8E8E] focus:border-transparent outline-hidden"
                  >
                    {PLANS.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name} ({p.durationMonths} Months) — {p.price}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Discount coupon */}
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                <label htmlFor="coupon-input" className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Discount Coupon <span className="text-slate-400 normal-case font-medium">(optional)</span>
                </label>
                {coupon ? (
                  <div className="flex items-center justify-between gap-3 text-xs">
                    <span className="text-emerald-800 font-semibold">
                      <Check className="inline w-3.5 h-3.5 mr-1" />
                      {coupon.code} applied — you save PKR {coupon.discountAmount.toLocaleString('en-US')}
                    </span>
                    <button type="button" onClick={removeCoupon} className="text-slate-500 hover:text-slate-800 underline cursor-pointer">
                      Remove
                    </button>
                  </div>
                ) : (
                  <div className="flex gap-2">
                    <input
                      id="coupon-input"
                      type="text"
                      autoCapitalize="characters"
                      autoComplete="off"
                      placeholder="Enter code"
                      value={couponInput}
                      onChange={(e) => setCouponInput(e.target.value.toUpperCase())}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          applyCoupon();
                        }
                      }}
                      className="flex-1 min-w-0 px-3 py-2 rounded-lg border border-slate-300 text-xs font-mono bg-white focus:ring-2 focus:ring-[#1B8E8E] focus:border-transparent outline-hidden"
                    />
                    <button
                      type="button"
                      onClick={applyCoupon}
                      disabled={couponBusy || !selectedYearId}
                      className="px-3.5 py-2 rounded-lg text-xs font-semibold text-white bg-[#0F2837] hover:bg-[#143a4f] disabled:opacity-50 flex items-center gap-1.5 cursor-pointer"
                    >
                      {couponBusy && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                      Apply
                    </button>
                  </div>
                )}
                {couponError && <p className="text-[11px] text-rose-600 mt-1.5">{couponError}</p>}
                {coupon && isFree && (
                  <p className="text-[11px] text-emerald-800 mt-1.5">
                    This coupon covers the full fee, so no payment is needed. Submit to request activation.
                  </p>
                )}
              </div>

              {/* Payment Method Selector: EXACTLY TWO METHODS: JazzCash and Meezan Bank */}
              <div>
                <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-2">
                  Select Payment Method
                </label>
                <div className="grid grid-cols-2 gap-3">
                  {/* JazzCash Radio Option */}
                  <label
                    className={`flex items-center gap-3 p-3.5 rounded-xl border cursor-pointer transition-all ${
                      method === 'jazzcash'
                        ? 'border-[#1B8E8E] bg-teal-50/50 ring-1 ring-[#1B8E8E]'
                        : 'border-slate-200 bg-white hover:bg-slate-50'
                    }`}
                  >
                    <input
                      type="radio"
                      name="paymentMethod"
                      value="jazzcash"
                      checked={method === 'jazzcash'}
                      onChange={() => setMethod('jazzcash')}
                      className="accent-[#1B8E8E] w-4 h-4 cursor-pointer"
                    />
                    <div className="flex items-center gap-2">
                      <Smartphone className={`w-4 h-4 ${method === 'jazzcash' ? 'text-[#1B8E8E]' : 'text-slate-500'}`} />
                      <span className="text-xs font-bold text-slate-900">JazzCash</span>
                    </div>
                  </label>

                  {/* Meezan Bank Radio Option */}
                  <label
                    className={`flex items-center gap-3 p-3.5 rounded-xl border cursor-pointer transition-all ${
                      method === 'meezan'
                        ? 'border-[#1B8E8E] bg-teal-50/50 ring-1 ring-[#1B8E8E]'
                        : 'border-slate-200 bg-white hover:bg-slate-50'
                    }`}
                  >
                    <input
                      type="radio"
                      name="paymentMethod"
                      value="meezan"
                      checked={method === 'meezan'}
                      onChange={() => setMethod('meezan')}
                      className="accent-[#1B8E8E] w-4 h-4 cursor-pointer"
                    />
                    <div className="flex items-center gap-2">
                      <Building2 className={`w-4 h-4 ${method === 'meezan' ? 'text-[#1B8E8E]' : 'text-slate-500'}`} />
                      <span className="text-xs font-bold text-slate-900">Meezan Bank</span>
                    </div>
                  </label>
                </div>
              </div>

              {/* Matching Account Card with Copy Buttons */}
              <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-3">
                <div className="flex items-center justify-between pb-2 border-b border-slate-200">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-[#0F2837]">
                      {method === 'jazzcash' ? 'JazzCash Account Details' : 'Meezan Bank Account Details'}
                    </span>
                  </div>
                  <span className="text-[11px] text-slate-500">Click to copy</span>
                </div>

                {method === 'jazzcash' ? (
                  <div className="space-y-2 text-xs">
                    <div className="flex items-center justify-between gap-2 p-2 bg-white rounded border border-slate-200">
                      <div>
                        <span className="text-[10px] text-slate-400 uppercase tracking-wider block">Account Title</span>
                        <span className="font-bold text-slate-800">
                          {paymentDetails?.jazzcash.accountTitle || 'Configured in Admin'}
                        </span>
                      </div>
                      {paymentDetails?.jazzcash.accountTitle && (
                        <button
                          type="button"
                          onClick={() => handleCopy(paymentDetails.jazzcash.accountTitle, 'jc-title')}
                          className="px-2 py-1 rounded text-[11px] font-semibold bg-slate-100 hover:bg-slate-200 text-slate-700 flex items-center gap-1 cursor-pointer"
                        >
                          {copiedKey === 'jc-title' ? <Check className="w-3 h-3 text-emerald-600" /> : <Copy className="w-3 h-3" />}
                          <span>{copiedKey === 'jc-title' ? 'Copied' : 'Copy'}</span>
                        </button>
                      )}
                    </div>

                    <div className="flex items-center justify-between gap-2 p-2 bg-white rounded border border-slate-200">
                      <div>
                        <span className="text-[10px] text-slate-400 uppercase tracking-wider block">Mobile / Account Number</span>
                        <span className="font-mono font-bold text-base text-[#1B8E8E]">
                          {paymentDetails?.jazzcash.number || 'Configured in Admin'}
                        </span>
                      </div>
                      {paymentDetails?.jazzcash.number && (
                        <button
                          type="button"
                          onClick={() => handleCopy(paymentDetails.jazzcash.number, 'jc-num')}
                          className="px-2 py-1 rounded text-[11px] font-semibold bg-slate-100 hover:bg-slate-200 text-slate-700 flex items-center gap-1 cursor-pointer"
                        >
                          {copiedKey === 'jc-num' ? <Check className="w-3 h-3 text-emerald-600" /> : <Copy className="w-3 h-3" />}
                          <span>{copiedKey === 'jc-num' ? 'Copied' : 'Copy'}</span>
                        </button>
                      )}
                    </div>
                  </div>
                ) : (
                  <div className="space-y-2 text-xs">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      <div className="p-2 bg-white rounded border border-slate-200">
                        <span className="text-[10px] text-slate-400 uppercase tracking-wider block">Bank</span>
                        <span className="font-bold text-slate-800">{paymentDetails?.meezan.bankName || 'Meezan Bank'}</span>
                      </div>

                      {paymentDetails?.meezan.branch && (
                        <div className="p-2 bg-white rounded border border-slate-200">
                          <span className="text-[10px] text-slate-400 uppercase tracking-wider block">Branch</span>
                          <span className="font-medium text-slate-800">{paymentDetails.meezan.branch}</span>
                        </div>
                      )}
                    </div>

                    <div className="flex items-center justify-between gap-2 p-2 bg-white rounded border border-slate-200">
                      <div>
                        <span className="text-[10px] text-slate-400 uppercase tracking-wider block">Account Title</span>
                        <span className="font-bold text-slate-800">
                          {paymentDetails?.meezan.accountTitle || 'Configured in Admin'}
                        </span>
                      </div>
                      {paymentDetails?.meezan.accountTitle && (
                        <button
                          type="button"
                          onClick={() => handleCopy(paymentDetails.meezan.accountTitle, 'm-title')}
                          className="px-2 py-1 rounded text-[11px] font-semibold bg-slate-100 hover:bg-slate-200 text-slate-700 flex items-center gap-1 cursor-pointer"
                        >
                          {copiedKey === 'm-title' ? <Check className="w-3 h-3 text-emerald-600" /> : <Copy className="w-3 h-3" />}
                          <span>{copiedKey === 'm-title' ? 'Copied' : 'Copy'}</span>
                        </button>
                      )}
                    </div>

                    <div className="flex items-center justify-between gap-2 p-2 bg-white rounded border border-slate-200">
                      <div>
                        <span className="text-[10px] text-slate-400 uppercase tracking-wider block">Account Number</span>
                        <span className="font-mono font-bold text-base text-[#1B8E8E]">
                          {paymentDetails?.meezan.accountNumber || 'Configured in Admin'}
                        </span>
                      </div>
                      {paymentDetails?.meezan.accountNumber && (
                        <button
                          type="button"
                          onClick={() => handleCopy(paymentDetails.meezan.accountNumber, 'm-num')}
                          className="px-2 py-1 rounded text-[11px] font-semibold bg-slate-100 hover:bg-slate-200 text-slate-700 flex items-center gap-1 cursor-pointer"
                        >
                          {copiedKey === 'm-num' ? <Check className="w-3 h-3 text-emerald-600" /> : <Copy className="w-3 h-3" />}
                          <span>{copiedKey === 'm-num' ? 'Copied' : 'Copy'}</span>
                        </button>
                      )}
                    </div>

                    {paymentDetails?.meezan.iban && (
                      <div className="flex items-center justify-between gap-2 p-2 bg-white rounded border border-slate-200">
                        <div>
                          <span className="text-[10px] text-slate-400 uppercase tracking-wider block">IBAN</span>
                          <span className="font-mono font-bold text-xs text-slate-800">
                            {paymentDetails.meezan.iban}
                          </span>
                        </div>
                        <button
                          type="button"
                          onClick={() => handleCopy(paymentDetails.meezan.iban!, 'm-iban')}
                          className="px-2 py-1 rounded text-[11px] font-semibold bg-slate-100 hover:bg-slate-200 text-slate-700 flex items-center gap-1 cursor-pointer"
                        >
                          {copiedKey === 'm-iban' ? <Check className="w-3 h-3 text-emerald-600" /> : <Copy className="w-3 h-3" />}
                          <span>{copiedKey === 'm-iban' ? 'Copied' : 'Copy'}</span>
                        </button>
                      </div>
                    )}
                  </div>
                )}

                {/* Free Text Instructions */}
                {paymentDetails?.instructions && (
                  <p className="text-[11px] text-slate-600 leading-relaxed pt-2 border-t border-slate-200/80">
                    {paymentDetails.instructions}
                  </p>
                )}
              </div>

              {/* WhatsApp Direct Option: Send Amount Proof directly to Admin WhatsApp */}
              <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-950">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3.5">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="w-2.5 h-2.5 rounded-full bg-[#25D366] animate-pulse" />
                      <h3 className="text-xs font-bold text-emerald-950">
                        Fast-Track: Send Amount to Admin WhatsApp
                      </h3>
                    </div>
                    <p className="text-[11px] text-emerald-800 leading-relaxed max-w-md">
                      Sent the fee? Open WhatsApp to send your payment screenshot directly to admin for rapid manual verification and instant activation.
                    </p>
                  </div>
                  <WhatsAppButton
                    whatsappNumber={paymentDetails?.whatsappNumber}
                    request={{
                      userName: user?.displayName || 'Medical Student',
                      userEmail: user?.email || '',
                      yearName: selectedYearName || 'MBBS Year',
                      planName: selectedPlan.name,
                      durationMonths: selectedPlan.durationMonths,
                      amountPKR: payable,
                      method: method,
                      transactionId: transactionId.trim(),
                      last4Digits: last4Digits.trim()
                    }}
                    label="Send Amount on WhatsApp"
                    compact={false}
                    showHelpText={false}
                    className="w-full sm:w-auto"
                  />
                </div>
              </div>

              {/* Form Divider */}
              <div className="relative py-1">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-slate-200" />
                </div>
                <div className="relative flex justify-center text-xs">
                  <span className="bg-white px-3 text-slate-500 font-medium">
                    Or Submit Transaction Details for Portal Verification
                  </span>
                </div>
              </div>

              {/* Transaction Proof Form Fields */}
              <div className="space-y-4">
                <div>
                  <label htmlFor="tx-id-input" className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                    Transaction ID / Reference Number <span className="text-rose-500">*</span>
                  </label>
                  <input
                    id="tx-id-input"
                    type="text"
                    required={!isFree}
                    placeholder="e.g. TID123456789 or Bank Ref"
                    value={transactionId}
                    onChange={(e) => setTransactionId(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-lg border border-slate-300 text-sm font-mono focus:ring-2 focus:ring-[#1B8E8E] focus:border-transparent outline-hidden bg-white"
                  />
                  <p className="text-[11px] text-slate-500 mt-1">
                    Enter the exact transaction ID shown on your payment receipt or SMS notification.
                  </p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label htmlFor="last4-input" className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                      Last 4 Digits of Sender Account / Phone <span className="text-rose-500">*</span>
                    </label>
                    <input
                      id="last4-input"
                      type="text"
                      required={!isFree}
                      maxLength={10}
                      placeholder="e.g. 4567"
                      value={last4Digits}
                      onChange={(e) => setLast4Digits(e.target.value)}
                      className="w-full px-3.5 py-2.5 rounded-lg border border-slate-300 text-sm font-mono focus:ring-2 focus:ring-[#1B8E8E] focus:border-transparent outline-hidden bg-white"
                    />
                  </div>

                  <div>
                    <label htmlFor="payment-time-input" className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                      Payment Date & Time <span className="text-rose-500">*</span>
                    </label>
                    <input
                      id="payment-time-input"
                      type="datetime-local"
                      required
                      value={paymentTime}
                      onChange={(e) => setPaymentTime(e.target.value)}
                      className="w-full px-3.5 py-2 rounded-lg border border-slate-300 text-xs focus:ring-2 focus:ring-[#1B8E8E] focus:border-transparent outline-hidden bg-white"
                    />
                  </div>
                </div>
              </div>

              {/* Submit Buttons */}
              <div className="pt-4 border-t border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-3">
                <span className="text-xs text-slate-500">
                  Total Payable:{' '}
                  {coupon && (
                    <s className="text-slate-400 mr-1">PKR {listPrice.toLocaleString('en-US')}</s>
                  )}
                  <strong className="text-slate-900 font-serif-heading font-bold">PKR {payable.toLocaleString('en-US')}</strong>
                </span>

                <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto justify-end">
                  <WhatsAppButton
                    whatsappNumber={paymentDetails?.whatsappNumber}
                    request={{
                      userName: user?.displayName || 'Medical Student',
                      userEmail: user?.email || '',
                      yearName: selectedYearName || 'MBBS Year',
                      planName: selectedPlan.name,
                      durationMonths: selectedPlan.durationMonths,
                      amountPKR: payable,
                      method: method,
                      transactionId: transactionId.trim(),
                      last4Digits: last4Digits.trim()
                    }}
                    label="Send on WhatsApp"
                    compact={true}
                    showHelpText={false}
                  />
                  <button
                    type="button"
                    onClick={onClose}
                    className="px-3.5 py-2 rounded-lg text-xs font-semibold text-slate-700 hover:bg-slate-100 transition-colors cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="px-4 sm:px-5 py-2 rounded-lg text-xs font-semibold text-white bg-[#1B8E8E] hover:bg-[#147273] disabled:opacity-50 transition-colors flex items-center justify-center gap-1.5 cursor-pointer shadow-xs"
                  >
                    {isSubmitting && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                    <span>Submit Verification</span>
                  </button>
                </div>
              </div>
            </form>
          )}
        </div>

      </div>
    </div>
  );
}
