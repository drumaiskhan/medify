import { useEffect, useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { doc, getDoc } from '../lib/data';
import { sendEmailVerification } from '../lib/auth';
import { useAuth } from '../context/AuthContext';
import { db } from '../lib/client';
import {
  User,
  Mail,
  GraduationCap,
  Calendar,
  BookOpen,
  LogOut,
  AlertCircle,
  CheckCircle2,
  RefreshCw,
  Loader2,
  Send,
  CreditCard,
  Clock,
  Layers,
  ChevronRight,
  ArrowRight
} from 'lucide-react';
import {
  PaymentRequestDoc,
  PaymentDetailsDoc,
  getUserPaymentRequests,
  getPaymentDetails,
  isValidWhatsAppNumber
} from '../services/payments';
import { PaymentModal } from '../components/PaymentModal';
import { WhatsAppButton } from '../components/WhatsAppButton';
import { ShieldCheck, ShieldAlert } from 'lucide-react';
import { PLANS } from '../data/plans';
import {
  YearDoc,
  BlockDoc,
  SubjectDoc,
  getPublishedYears,
  getPublishedBlocksForYear,
  getAllYearsAdmin,
  getAllBlocksAdmin,
  getAllSubjectsAdmin
} from '../services/curriculum';
import {
  getStudentAccessInfo,
  isMatchingYear,
  StudentAccessInfo
} from '../utils/studentAccess';

interface UserProfile {
  fullName: string;
  email: string;
  college: string;
  academicYear: string;
  curriculum: string;
  approvalStatus?: 'PENDING' | 'APPROVED' | 'REJECTED';
  paymentStatus?: 'UNPAID' | 'PENDING' | 'VERIFIED' | 'REJECTED';
  selectedPlanId?: string;
  selectedPlanName?: string;
  planPrice?: string;
  purchasedYearId?: string;
  purchasedYearName?: string;
  selectedYearId?: string;
  selectedYearName?: string;
  rejectedReason?: string;
  approvedAt?: any;
  access?: {
    active: boolean;
    expired: boolean;
    expiresAt: number | null;
    daysLeft: number;
    years: { yearId: string; yearName: string; planName: string; expiresAt: number; daysLeft: number; active: boolean }[];
  };
}

export function DashboardPage() {
  const { user, isAdmin, logout, reloadUser } = useAuth();
  const navigate = useNavigate();

  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loadingProfile, setLoadingProfile] = useState(true);
  const [profileError, setProfileError] = useState<string | null>(null);

  // Email verification action feedback
  const [resendStatus, setResendStatus] = useState<string | null>(null);
  const [isResending, setIsResending] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Payments & Subscription state
  const [paymentRequests, setPaymentRequests] = useState<PaymentRequestDoc[]>([]);
  const [paymentDetails, setPaymentDetails] = useState<PaymentDetailsDoc | null>(null);
  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);

  // Student's purchased library year and modular blocks
  const [libraryYear, setLibraryYear] = useState<YearDoc | null>(null);
  const [libraryBlocks, setLibraryBlocks] = useState<BlockDoc[]>([]);
  const [loadingLibrary, setLoadingLibrary] = useState<boolean>(false);

  // Administrator preview: every year, module and note, exactly where students find them
  const [adminYears, setAdminYears] = useState<YearDoc[]>([]);
  const [adminBlocks, setAdminBlocks] = useState<BlockDoc[]>([]);
  const [adminSubjects, setAdminSubjects] = useState<SubjectDoc[]>([]);
  const [loadingAdminLibrary, setLoadingAdminLibrary] = useState<boolean>(false);
  useEffect(() => {
    if (!isAdmin) return;
    let cancelled = false;
    setLoadingAdminLibrary(true);
    Promise.all([getAllYearsAdmin(), getAllBlocksAdmin(), getAllSubjectsAdmin()])
      .then(([y, b, s]) => {
        if (cancelled) return;
        setAdminYears(y);
        setAdminBlocks(b);
        setAdminSubjects(s);
      })
      .catch((err) => console.warn('Failed to load admin library preview:', err))
      .finally(() => {
        if (!cancelled) setLoadingAdminLibrary(false);
      });
    return () => {
      cancelled = true;
    };
  }, [isAdmin]);

  // Load user profile
  const fetchProfile = async () => {
    if (!user) return;
    try {
      setLoadingProfile(true);
      setProfileError(null);
      const userDocRef = doc(db, 'users', user.uid);
      const docSnap = await getDoc(userDocRef);

      if (docSnap.exists()) {
        setProfile(docSnap.data() as UserProfile);
      } else {
        setProfile({
          fullName: user.displayName || 'Medical Student',
          email: user.email || '',
          college: 'Not specified',
          academicYear: 'Not specified',
          curriculum: 'KMU'
        });
      }
    } catch (err: any) {
      console.error('Failed to load user profile:', err);
      setProfileError('Failed to load profile details from database.');
    } finally {
      setLoadingProfile(false);
    }
  };

  useEffect(() => {
    fetchProfile();
  }, [user]);

  // Load payment requests and settings
  const fetchPayments = async () => {
    if (!user) return;
    try {
      const [requests, details] = await Promise.all([
        getUserPaymentRequests(user.uid),
        getPaymentDetails()
      ]);
      setPaymentRequests(requests);
      setPaymentDetails(details);
    } catch (err) {
      console.error('Failed to load user payments:', err);
    }
  };

  useEffect(() => {
    fetchPayments();
  }, [user]);

  // Load purchased year & blocks for approved student: ONLY show him that year notes in the library!
  useEffect(() => {
    if (!profile) return;
    const access = getStudentAccessInfo(profile, paymentRequests);
    if (!access.isSubscribed) {
      setLibraryYear(null);
      setLibraryBlocks([]);
      return;
    }

    let isCancelled = false;
    async function loadStudentLibrary() {
      try {
        setLoadingLibrary(true);
        const allYears = await getPublishedYears();
        const matched = allYears.find((y) => isMatchingYear(y, access));
        if (matched && !isCancelled) {
          setLibraryYear(matched);
          const blocks = await getPublishedBlocksForYear(matched.id);
          if (!isCancelled) {
            setLibraryBlocks(blocks);
          }
        }
      } catch (err) {
        console.warn('Failed to load student library in dashboard:', err);
      } finally {
        if (!isCancelled) {
          setLoadingLibrary(false);
        }
      }
    }

    loadStudentLibrary();

    return () => {
      isCancelled = true;
    };
  }, [profile, paymentRequests]);

  const handleLogout = async () => {
    try {
      await logout();
      navigate('/');
    } catch (err) {
      console.error('Logout failed:', err);
    }
  };

  const handleResendVerification = async () => {
    if (!user) return;
    try {
      setIsResending(true);
      setResendStatus(null);
      await sendEmailVerification(user);
      setResendStatus('Verification link sent! Please check your inbox and spam folder.');
    } catch (err: any) {
      console.error('Resend verification error:', err);
      if (err.code === 'auth/too-many-requests') {
        setResendStatus('Too many requests. Please wait a moment before trying again.');
      } else {
        setResendStatus('Failed to send verification email. Please try again.');
      }
    } finally {
      setIsResending(false);
    }
  };

  const handleRefreshVerification = async () => {
    try {
      setIsRefreshing(true);
      await reloadUser();
    } catch (err) {
      console.error('Failed to refresh verification status:', err);
    } finally {
      setIsRefreshing(false);
    }
  };

  return (
    <div className="min-h-screen py-10 px-4 sm:px-6 lg:px-8 max-w-4xl mx-auto w-full space-y-8">
      <Link to="/books" className="library-resume" style={{margin:'24px 0'}}><div><div className="library-kicker">YOUR PERSONAL LIBRARY</div><h2>Pick up your next chapter</h2><p style={{fontSize:12}}>Books, bookmarks, and your saved reading progress.</p></div><span className="library-btn primary">Open library →</span></Link>

      
      {/* Top Welcome Strip */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-[#CFDBE5]">
        <div>
          <span className="text-xs font-bold text-[#1B8E8E] uppercase tracking-wider">
            Student Portal
          </span>
          <h1 className="font-serif-heading text-2xl sm:text-3xl font-bold text-[#0F2837] mt-1">
            Welcome, {profile?.fullName || user?.displayName || 'Student'}
          </h1>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setIsPaymentModalOpen(true)}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-semibold text-white bg-[#1B8E8E] hover:bg-[#147273] transition-colors shadow-2xs cursor-pointer"
          >
            <CreditCard className="w-3.5 h-3.5" />
            <span>Subscribe / Pay</span>
          </button>

          <button
            type="button"
            onClick={handleLogout}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-semibold text-slate-700 bg-white border border-[#CFDBE5] hover:bg-slate-50 hover:text-red-600 transition-colors shadow-2xs cursor-pointer"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span>Log out</span>
          </button>
        </div>
      </div>

      {/* Email Verification Banner */}
      {user && user.emailVerificationRequired && !user.emailVerified && (
        <div className="p-4 sm:p-5 rounded-xl bg-amber-50 border border-amber-300 text-amber-900 shadow-xs">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div className="flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
              <div>
                <h3 className="font-semibold text-sm text-amber-900">
                  Please verify your email
                </h3>
                <p className="text-xs text-amber-800/90 mt-0.5">
                  A verification email was sent to <strong className="font-mono">{user.email}</strong>. Please confirm your address.
                </p>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
              <button
                type="button"
                onClick={handleResendVerification}
                disabled={isResending}
                className="flex-1 sm:flex-initial inline-flex items-center justify-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded bg-amber-100 hover:bg-amber-200 text-amber-900 border border-amber-300 disabled:opacity-50 transition-colors cursor-pointer"
              >
                {isResending ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <Send className="w-3.5 h-3.5" />
                )}
                <span>Resend verification email</span>
              </button>

              <button
                type="button"
                onClick={handleRefreshVerification}
                disabled={isRefreshing}
                className="flex-1 sm:flex-initial inline-flex items-center justify-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded bg-[#1B8E8E] hover:bg-[#147273] text-white disabled:opacity-50 transition-colors cursor-pointer"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin' : ''}`} />
                <span>I've verified – refresh</span>
              </button>
            </div>
          </div>

          {resendStatus && (
            <p className="mt-3 text-xs font-medium text-amber-950 bg-amber-100/70 p-2 rounded border border-amber-200/80">
              {resendStatus}
            </p>
          )}
        </div>
      )}

      {/* Verified Banner Indicator */}
      {user && user.emailVerificationRequired && user.emailVerified && (
        <div className="p-3 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
          <span>Email address verified</span>
        </div>
      )}

      {/* =========================================================
          ACCOUNT APPROVAL & ACCESS STATUS CARD
          ========================================================= */}
      {(() => {
        const pendingPayment = paymentRequests.find((r) => r.status === 'PENDING');
        const verifiedPayment = paymentRequests.find((r) => r.status === 'VERIFIED');
        const access = profile?.access;
        const isExpired = access?.expired === true;
        const isApproved = !isExpired && (profile?.approvalStatus === 'APPROVED' || Boolean(verifiedPayment));
        const isRejected = profile?.approvalStatus === 'REJECTED';
        const hasPendingPayment = Boolean(pendingPayment) || profile?.paymentStatus === 'PENDING';
        const isUnpaid = !isApproved && !isRejected && !hasPendingPayment;

        if (isExpired && !hasPendingPayment) {
          return (
            <div className="p-6 rounded-2xl bg-amber-50/60 border border-amber-400 shadow-xs">
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <div>
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-100 text-amber-900 border border-amber-300 uppercase tracking-wider">Subscription expired</span>
                  <h2 className="font-serif-heading text-lg font-bold text-[#0F2837] mt-2">Your access has ended</h2>
                  <p className="text-xs text-slate-600 mt-0.5 leading-relaxed max-w-xl">
                    {access?.years?.[0]?.yearName ? `Your ${access.years[0].yearName} plan ended` : 'Your plan ended'}
                    {access?.expiresAt ? ` on ${new Date(access.expiresAt * 1000).toLocaleDateString()}` : ''}. Renew to open your notes again. Highlights you saved are kept.
                  </p>
                </div>
                <button type="button" onClick={() => setIsPaymentModalOpen(true)} className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-xs font-bold text-white bg-[#1B8E8E] hover:bg-[#147273] transition-colors shadow-xs w-full sm:w-auto shrink-0 cursor-pointer">
                  <RefreshCw className="w-4 h-4" />
                  <span>Renew subscription</span>
                </button>
              </div>
            </div>
          );
        }

        if (isApproved) {
          return (
            <div className="p-6 rounded-2xl bg-emerald-50/60 border border-emerald-300 shadow-xs space-y-4">
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <div className="flex items-start gap-3.5">
                  <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-300 text-emerald-700 flex items-center justify-center shrink-0 mt-0.5">
                    <ShieldCheck className="w-5 h-5 text-emerald-600" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-900 border border-emerald-300 uppercase tracking-wider">
                        Account Approved
                      </span>
                      <span className="text-xs text-emerald-800 font-medium">
                        Active Subscriber
                      </span>
                    </div>
                    <h2 className="font-serif-heading text-lg font-bold text-[#0F2837] mt-1">
                      Full Curriculum Access Granted
                    </h2>
                    <p className="text-xs text-slate-600 mt-0.5 leading-relaxed max-w-xl">
                      Your registration and payment have been approved by the administrator. You can read all published notes, tables and diagrams for the year you subscribed to, until your plan ends.
                    </p>
                    {access?.years?.filter((y) => y.active).map((y) => (
                      <p key={y.yearId} className="mt-2 text-xs font-semibold text-emerald-900 flex flex-wrap items-center gap-x-2">
                        <span>{y.yearName || y.yearId}: valid until {new Date(y.expiresAt * 1000).toLocaleDateString()} ({y.daysLeft} day{y.daysLeft === 1 ? '' : 's'} left)</span>
                        {y.daysLeft <= 14 && (
                          <button type="button" onClick={() => setIsPaymentModalOpen(true)} className="underline text-[#147273] cursor-pointer">Renew now</button>
                        )}
                      </p>
                    ))}
                  </div>
                </div>

                <Link
                  to={libraryYear ? `/year/${libraryYear.id}` : "/#years"}
                  className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-xs font-bold text-white bg-[#1B8E8E] hover:bg-[#147273] transition-colors shadow-xs w-full sm:w-auto shrink-0"
                >
                  <BookOpen className="w-4 h-4" />
                  <span>Open {libraryYear?.name || 'Curriculum'} Notes</span>
                </Link>
              </div>
            </div>
          );
        }

        if (isRejected) {
          return (
            <div className="p-6 rounded-2xl bg-rose-50/60 border border-rose-300 shadow-xs space-y-4">
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <div className="flex items-start gap-3.5">
                  <div className="w-10 h-10 rounded-xl bg-rose-500/10 border border-rose-300 text-rose-700 flex items-center justify-center shrink-0 mt-0.5">
                    <ShieldAlert className="w-5 h-5 text-rose-600" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-rose-100 text-rose-900 border border-rose-300 uppercase tracking-wider">
                        Approval Declined
                      </span>
                    </div>
                    <h2 className="font-serif-heading text-lg font-bold text-[#0F2837] mt-1">
                      Registration / Payment Not Approved
                    </h2>
                    <p className="text-xs text-slate-600 mt-0.5 leading-relaxed max-w-xl">
                      {profile?.rejectedReason
                        ? `Admin Note: ${profile.rejectedReason}`
                        : 'Your payment details could not be verified against bank statements (JazzCash / Meezan Bank). Please double check your Transaction ID and submit again.'}
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => setIsPaymentModalOpen(true)}
                  className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-xs font-bold text-white bg-rose-600 hover:bg-rose-700 transition-colors shadow-xs w-full sm:w-auto shrink-0 cursor-pointer"
                >
                  <RefreshCw className="w-4 h-4" />
                  <span>Resubmit Payment</span>
                </button>
              </div>
            </div>
          );
        }

        if (hasPendingPayment) {
          return (
            <div className="p-6 rounded-2xl bg-amber-50/50 border border-amber-300 shadow-xs space-y-4">
              <div className="flex flex-col sm:flex-row items-start justify-between gap-4">
                <div className="flex items-start gap-3.5">
                  <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-300 text-amber-700 flex items-center justify-center shrink-0 mt-0.5">
                    <Clock className="w-5 h-5 text-amber-600" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-100 text-amber-900 border border-amber-300 uppercase tracking-wider">
                        Awaiting Admin Approval
                      </span>
                      <span className="text-xs text-amber-800 font-medium">
                        Payment Under Review
                      </span>
                    </div>
                    <h2 className="font-serif-heading text-lg font-bold text-[#0F2837] mt-1">
                      Payment Verification In Progress
                    </h2>
                    <p className="text-xs text-slate-600 mt-0.5 leading-relaxed max-w-xl">
                      Thank you! Your payment details (JazzCash / Meezan Bank) have been received. An administrator will verify the Transaction ID against account statements and approve your account. Once approved, all curriculum notes will unlock immediately.
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => {
                    fetchProfile();
                    fetchPayments();
                  }}
                  className="inline-flex items-center justify-center gap-1.5 px-3.5 py-2 rounded-lg text-xs font-semibold text-slate-700 bg-white border border-slate-300 hover:bg-slate-50 transition-colors shadow-2xs w-full sm:w-auto shrink-0 cursor-pointer"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  <span>Check Approval Status</span>
                </button>
              </div>

              {/* Fast-track with WhatsApp screenshot helper */}
              {pendingPayment && paymentDetails && isValidWhatsAppNumber(paymentDetails.whatsappNumber) && (
                <div className="pt-3 border-t border-amber-200/80 bg-white/60 p-3.5 rounded-xl">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div>
                      <p className="text-xs font-bold text-slate-900">
                        Want faster approval? Send payment screenshot on WhatsApp
                      </p>
                      <p className="text-[11px] text-slate-500 mt-0.5">
                        Our team verifies transaction proofs rapidly via our official WhatsApp desk.
                      </p>
                    </div>
                    <WhatsAppButton
                      whatsappNumber={paymentDetails.whatsappNumber}
                      request={pendingPayment}
                      compact={true}
                    />
                  </div>
                </div>
              )}
            </div>
          );
        }

        // Default: Registration Received, Unpaid
        return (
          <div className="p-6 rounded-2xl bg-teal-50/40 border border-[#1B8E8E]/30 shadow-xs space-y-4">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              <div className="flex items-start gap-3.5">
                <div className="w-10 h-10 rounded-xl bg-[#1B8E8E]/10 border border-[#1B8E8E]/20 text-[#1B8E8E] flex items-center justify-center shrink-0 mt-0.5">
                  <CreditCard className="w-5 h-5" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-blue-100 text-blue-900 border border-blue-200 uppercase tracking-wider">
                      Step 2 of 2: Submit Payment
                    </span>
                    <span className="text-xs text-slate-500 font-medium">
                      Admin Approval Required
                    </span>
                  </div>
                  <h2 className="font-serif-heading text-lg font-bold text-[#0F2837] mt-1">
                    Submit Payment for Admin Activation
                  </h2>
                  <p className="text-xs text-slate-600 mt-0.5 leading-relaxed max-w-xl">
                    You selected the{' '}
                    <strong className="text-slate-900">
                      {profile?.selectedPlanName || 'Subscription Plan'}
                    </strong>
                    {profile?.planPrice ? ` (${profile.planPrice})` : ''}.
                    To complete your registration and unlock full modular notes, transfer your fee via JazzCash or Meezan Bank and submit your Transaction ID for admin approval.
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setIsPaymentModalOpen(true)}
                className="inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-lg text-xs font-bold text-white bg-[#1B8E8E] hover:bg-[#147273] transition-colors shadow-xs w-full sm:w-auto shrink-0 cursor-pointer"
              >
                <CreditCard className="w-4 h-4" />
                <span>Submit Payment Now</span>
              </button>
            </div>
          </div>
        );
      })()}

      {/* =========================================================
          ADMIN VIEW: all uploaded notes, by year and module
          ========================================================= */}
      {isAdmin && (
        <div className="bg-white rounded-xl border border-[#1B8E8E]/40 p-6 sm:p-8 shadow-xs space-y-6">
          <div className="border-b border-[#E8EEF3] pb-4">
            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-[#1B8E8E]/10 text-[#147273] border border-[#1B8E8E]/30 uppercase tracking-wider">
              Administrator view
            </span>
            <h2 className="font-serif-heading text-lg font-bold text-[#0F2837] mt-1">All Notes Library</h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Every module and the notes uploaded into it. Subscribed students see the published ones inside their year.
            </p>
          </div>

          {loadingAdminLibrary ? (
            <div className="py-8 flex flex-col items-center justify-center text-slate-400">
              <Loader2 className="w-5 h-5 animate-spin text-[#1B8E8E] mb-2" />
              <p className="text-xs">Loading all modules...</p>
            </div>
          ) : (
            adminYears.map((y) => {
              const yearBlocks = adminBlocks.filter((b) => b.yearId === y.id).sort((a, b) => a.order - b.order);
              if (yearBlocks.length === 0) return null;
              return (
                <div key={y.id} className="space-y-3">
                  <h3 className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-2">
                    <span>{y.name}</span>
                    {!y.published && <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-200 text-slate-700">Hidden</span>}
                  </h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                    {yearBlocks.map((b) => {
                      const notes = adminSubjects.filter((s) => s.blockId === b.id).sort((a, c) => a.order - c.order);
                      return (
                        <div key={b.id} className="p-4 rounded-xl border border-[#CFDBE5] bg-[#F8FAFC] flex flex-col justify-between gap-3">
                          <div className="space-y-2">
                            <div className="flex items-start justify-between gap-2">
                              <h4 className="font-serif-heading text-sm font-bold text-[#0F2837]">{b.name}</h4>
                              {!b.published && <span className="shrink-0 text-[10px] px-1.5 py-0.5 rounded bg-slate-200 text-slate-700 font-semibold">Hidden</span>}
                            </div>
                            {notes.length === 0 ? (
                              <p className="text-[11px] text-slate-500">No notes uploaded yet</p>
                            ) : (
                              <ul className="space-y-1">
                                {notes.map((n) => (
                                  <li key={n.id}>
                                    <Link to={`/read/subject/${n.id}`} className="text-xs font-semibold text-[#1B8E8E] hover:text-[#147273] inline-flex items-center gap-1.5">
                                      <BookOpen className="w-3.5 h-3.5" />
                                      <span>Read {notes.length > 1 ? n.name : 'notes'}</span>
                                      {!n.published && <span className="text-[10px] px-1 rounded bg-amber-100 text-amber-800 font-semibold">Draft</span>}
                                    </Link>
                                  </li>
                                ))}
                              </ul>
                            )}
                          </div>
                          <Link to={`/block/${b.id}`} className="pt-2 border-t border-[#E8EEF3] flex items-center justify-between text-xs font-semibold text-slate-600 hover:text-[#1B8E8E]">
                            <span>Open as a student sees it</span>
                            <ChevronRight className="w-3.5 h-3.5" />
                          </Link>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })
          )}
        </div>
      )}

      {/* =========================================================
          MY NOTES LIBRARY (Only shows student's purchased year)
          ========================================================= */}
      {(() => {
        const verifiedPayment = paymentRequests.find((r) => r.status === 'VERIFIED');
        const isApproved = profile?.approvalStatus === 'APPROVED' || Boolean(verifiedPayment);

        if (!isApproved) return null;

        return (
          <div className="bg-white rounded-xl border border-[#CFDBE5] p-6 sm:p-8 shadow-xs space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-[#E8EEF3] pb-4">
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-300 uppercase tracking-wider">
                    Enrolled Package Active
                  </span>
                  <span className="text-xs text-slate-500 font-medium">
                    {libraryYear ? libraryYear.name : profile?.academicYear || 'MBBS'}
                  </span>
                </div>
                <h2 className="font-serif-heading text-lg font-bold text-[#0F2837] mt-1">
                  My Notes Library — {libraryYear?.name || profile?.academicYear || 'MBBS Year'}
                </h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  In accordance with your subscription, only notes for your purchased academic year are displayed.
                </p>
              </div>

              {libraryYear && (
                <Link
                  to={`/year/${libraryYear.id}`}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-[#1B8E8E] bg-[#1B8E8E]/10 hover:bg-[#1B8E8E]/20 transition-colors w-fit"
                >
                  <span>View All Year Modules</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </Link>
              )}
            </div>

            {loadingLibrary ? (
              <div className="py-8 flex flex-col items-center justify-center text-slate-400">
                <Loader2 className="w-5 h-5 animate-spin text-[#1B8E8E] mb-2" />
                <p className="text-xs">Loading modules from your library...</p>
              </div>
            ) : libraryBlocks.length === 0 ? (
              <div className="p-6 rounded-lg bg-slate-50 border border-dashed border-slate-300 text-center">
                <Layers className="w-8 h-8 text-slate-400 mx-auto mb-2" />
                <p className="text-xs font-semibold text-slate-700">Modules are being updated</p>
                <p className="text-[11px] text-slate-500 mt-1">
                  High-yield chapters and tables for your enrolled year are being curated by KMU faculty editors.
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                {libraryBlocks.map((block) => (
                  <Link
                    key={block.id}
                    to={`/block/${block.id}`}
                    className="group p-4 rounded-xl border border-[#CFDBE5] hover:border-[#1B8E8E] hover:shadow-xs bg-[#F8FAFC] transition-all flex flex-col justify-between"
                  >
                    <div className="space-y-1.5">
                      <span className="text-[10px] font-bold text-[#1B8E8E] uppercase tracking-wider block">
                        Order #{block.order}
                      </span>
                      <h3 className="font-serif-heading text-sm font-bold text-[#0F2837] group-hover:text-[#1B8E8E] transition-colors">
                        {block.name}
                      </h3>
                    </div>

                    <div className="pt-4 flex items-center justify-between text-xs font-semibold text-[#1B8E8E]">
                      <span>Open Block Notes</span>
                      <ChevronRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" />
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </div>
        );
      })()}

      {/* Profile Details Card */}
      <div className="bg-white rounded-xl border border-[#CFDBE5] p-6 sm:p-8 shadow-xs">
        <div className="border-b border-[#E8EEF3] pb-4 mb-6">
          <h2 className="font-serif-heading text-lg font-bold text-[#0F2837]">
            Student Account Profile
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Your registered academic credentials from the MEDIFY user database
          </p>
        </div>

        {loadingProfile ? (
          <div className="py-12 flex flex-col items-center justify-center text-slate-400">
            <Loader2 className="w-6 h-6 animate-spin text-[#1B8E8E] mb-2" />
            <p className="text-xs">Loading profile from database...</p>
          </div>
        ) : profileError ? (
          <div className="p-4 rounded-lg bg-red-50 border border-red-200 text-red-700 text-xs">
            {profileError}
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
            
            {/* Full Name */}
            <div className="flex items-start gap-3 p-3.5 rounded-lg bg-[#F8FAFC] border border-[#CFDBE5]/60">
              <div className="w-8 h-8 rounded bg-[#E8EEF3] text-[#0F2837] flex items-center justify-center shrink-0 mt-0.5">
                <User className="w-4 h-4 text-[#1B8E8E]" />
              </div>
              <div className="min-w-0">
                <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider block">
                  Full Name
                </span>
                <span className="text-sm font-bold text-[#0F2837] truncate block">
                  {profile?.fullName || 'Not recorded'}
                </span>
              </div>
            </div>

            {/* Email Address */}
            <div className="flex items-start gap-3 p-3.5 rounded-lg bg-[#F8FAFC] border border-[#CFDBE5]/60">
              <div className="w-8 h-8 rounded bg-[#E8EEF3] text-[#0F2837] flex items-center justify-center shrink-0 mt-0.5">
                <Mail className="w-4 h-4 text-[#1B8E8E]" />
              </div>
              <div className="min-w-0">
                <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider block">
                  Email Address
                </span>
                <span className="text-sm font-bold text-[#0F2837] truncate block">
                  {profile?.email || user?.email || 'Not recorded'}
                </span>
              </div>
            </div>

            {/* Medical College */}
            <div className="flex items-start gap-3 p-3.5 rounded-lg bg-[#F8FAFC] border border-[#CFDBE5]/60">
              <div className="w-8 h-8 rounded bg-[#E8EEF3] text-[#0F2837] flex items-center justify-center shrink-0 mt-0.5">
                <GraduationCap className="w-4 h-4 text-[#1B8E8E]" />
              </div>
              <div className="min-w-0">
                <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider block">
                  Medical College
                </span>
                <span className="text-sm font-bold text-[#0F2837] truncate block">
                  {profile?.college || 'Not specified'}
                </span>
              </div>
            </div>

            {/* Academic Year */}
            <div className="flex items-start gap-3 p-3.5 rounded-lg bg-[#F8FAFC] border border-[#CFDBE5]/60">
              <div className="w-8 h-8 rounded bg-[#E8EEF3] text-[#0F2837] flex items-center justify-center shrink-0 mt-0.5">
                <Calendar className="w-4 h-4 text-[#1B8E8E]" />
              </div>
              <div className="min-w-0">
                <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider block">
                  Academic Year
                </span>
                <span className="text-sm font-bold text-[#0F2837] truncate block">
                  {profile?.academicYear || 'Not specified'}
                </span>
              </div>
            </div>

            {/* Curriculum */}
            <div className="sm:col-span-2 flex items-start gap-3 p-3.5 rounded-lg bg-[#F8FAFC] border border-[#CFDBE5]/60">
              <div className="w-8 h-8 rounded bg-[#E8EEF3] text-[#0F2837] flex items-center justify-center shrink-0 mt-0.5">
                <BookOpen className="w-4 h-4 text-[#1B8E8E]" />
              </div>
              <div className="min-w-0">
                <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider block">
                  Curriculum Board
                </span>
                <span className="text-sm font-bold text-[#0F2837] truncate block">
                  {profile?.curriculum || 'KMU'}
                </span>
              </div>
            </div>

          </div>
        )}
      </div>

      {/* Navigation Footer */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-4 border-t border-[#CFDBE5]">
        <Link
          to="/#years"
          className="inline-flex items-center gap-2 text-xs font-semibold text-[#1B8E8E] hover:underline"
        >
          ← Browse MBBS Curriculum Blocks
        </Link>
        <span className="text-xs text-slate-400">
          User ID: <span className="font-mono text-[11px]">{user?.uid}</span>
        </span>
      </div>

      {/* Payment Checkout Modal */}
      <PaymentModal
        isOpen={isPaymentModalOpen}
        initialPlan={profile?.selectedPlanId ? PLANS.find((p) => p.id === profile.selectedPlanId) || null : null}
        onClose={() => setIsPaymentModalOpen(false)}
        onSuccess={() => {
          fetchPayments();
          fetchProfile();
        }}
      />

    </div>
  );
}
