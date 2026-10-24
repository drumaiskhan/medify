import { useState, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
  ArrowRight,
  AlertCircle,
  RefreshCw,
  Layers,
  ShieldAlert,
  ShieldCheck,
  BookOpen
} from 'lucide-react';
import { doc, getDoc } from '../lib/data';
import { db } from '../lib/client';
import { PLANS, Plan } from '../data/plans';
import { DemoBadge } from '../components/DemoBadge';
import { PlanCard } from '../components/PlanCard';
import { PaymentModal } from '../components/PaymentModal';
import { useAuth } from '../context/AuthContext';
import { getUserPaymentRequests } from '../services/payments';
import {
  getStudentAccessInfo,
  isMatchingYear,
  StudentAccessInfo
} from '../utils/studentAccess';
import {
  YearDoc,
  BlockDoc,
  SubjectDoc,
  getPublishedYearById,
  getPublishedBlocksForYear,
  getPublishedSubjectsForBlock
} from '../services/curriculum';

interface BlockWithSubjects extends BlockDoc {
  subjects: SubjectDoc[];
}

export function YearPage() {
  const { yearId } = useParams<{ yearId: string }>();
  const { user, isAdmin } = useAuth();
  const navigate = useNavigate();

  const [year, setYear] = useState<YearDoc | null>(null);
  const [blocks, setBlocks] = useState<BlockWithSubjects[]>([]);
  const [studentAccess, setStudentAccess] = useState<StudentAccessInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedPlanForCheckout, setSelectedPlanForCheckout] = useState<Plan | null>(null);
  const [isCheckoutOpen, setIsCheckoutOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchYearData = async () => {
    if (!yearId) return;
    try {
      setLoading(true);
      setError(null);

      const fetchedYear = await getPublishedYearById(yearId);
      if (!fetchedYear) {
        setYear(null);
        setBlocks([]);
        return;
      }

      setYear(fetchedYear);

      const fetchedBlocks = await getPublishedBlocksForYear(yearId);

      // Fetch constituent subjects for each block in parallel
      const blocksWithSubjs: BlockWithSubjects[] = await Promise.all(
        fetchedBlocks.map(async (b) => {
          try {
            const subjs = await getPublishedSubjectsForBlock(b.id);
            return { ...b, subjects: subjs };
          } catch {
            return { ...b, subjects: [] };
          }
        })
      );

      setBlocks(blocksWithSubjs);
    } catch (err: any) {
      console.error('Error fetching year:', err);
      setError('Unable to load year package from database.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchYearData();
  }, [yearId]);

  // Fetch student access info
  useEffect(() => {
    if (!user) {
      setStudentAccess(null);
      return;
    }

    const currentUid = user.uid;
    let isMounted = true;
    async function loadAccess() {
      try {
        const [uSnap, payments] = await Promise.all([
          getDoc(doc(db, 'users', currentUid)),
          getUserPaymentRequests(currentUid)
        ]);
        if (isMounted && uSnap.exists()) {
          setStudentAccess(getStudentAccessInfo(uSnap.data(), payments));
        }
      } catch (e) {
        console.warn('Could not load student access in YearPage:', e);
      }
    }

    loadAccess();

    return () => {
      isMounted = false;
    };
  }, [user]);

  if (loading) {
    return (
      <div className="min-h-screen py-10 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto w-full animate-pulse">
        <div className="h-4 w-32 bg-slate-200 rounded mb-6" />
        <div className="h-40 rounded-xl bg-slate-200 mb-10" />
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-64 rounded-xl bg-slate-200" />
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-16 text-center">
        <div className="w-12 h-12 rounded-full bg-red-100 text-red-600 flex items-center justify-center mx-auto mb-4">
          <AlertCircle className="w-6 h-6" />
        </div>
        <h1 className="font-serif-heading text-2xl font-bold text-[#171B35] mb-2">
          Unable to Load Year
        </h1>
        <p className="text-sm text-slate-600 mb-6">{error}</p>
        <button
          type="button"
          onClick={fetchYearData}
          className="inline-flex items-center gap-2 px-4 py-2 rounded text-xs font-semibold text-white bg-[#6366F1] hover:bg-[#4F46E5] transition-colors"
        >
          <RefreshCw className="w-4 h-4" />
          <span>Retry</span>
        </button>
      </div>
    );
  }

  if (!year) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-16 text-center">
        <div className="w-12 h-12 rounded-full bg-red-100 text-red-600 flex items-center justify-center mx-auto mb-4">
          <AlertCircle className="w-6 h-6" />
        </div>
        <h1 className="font-serif-heading text-2xl font-bold text-[#171B35] mb-2">
          Year Not Found
        </h1>
        <p className="text-sm text-slate-600 mb-6">
          The requested MBBS year package does not exist or has not been published yet.
        </p>
        <Link
          to="/"
          className="inline-flex items-center gap-2 px-4 py-2 rounded text-xs font-semibold text-white bg-[#6366F1] hover:bg-[#4F46E5] transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Back to All Years</span>
        </Link>
      </div>
    );
  }

  // RESTRICTION CHECK: When a student purchases his respective class notes package, only show him that year notes!
  const isRestrictedForStudent = Boolean(
    studentAccess?.isSubscribed &&
    !isAdmin &&
    !isMatchingYear(year, studentAccess)
  );

  if (isRestrictedForStudent) {
    return (
      <div className="min-h-screen py-16 px-4 sm:px-6 lg:px-8 max-w-xl mx-auto w-full text-center flex flex-col justify-center">
        <div className="bg-white rounded-2xl border border-amber-300 p-8 sm:p-10 shadow-sm space-y-5">
          <div className="w-16 h-16 rounded-full bg-amber-500/10 border border-amber-300 text-amber-700 flex items-center justify-center mx-auto">
            <ShieldAlert className="w-8 h-8 text-amber-600" />
          </div>
          <div>
            <span className="text-[10px] font-bold px-2.5 py-0.5 rounded-full bg-amber-100 text-amber-900 border border-amber-300 uppercase tracking-wider inline-block mb-2">
              Package Restricted
            </span>
            <h1 className="font-serif-heading text-2xl font-bold text-[#171B35]">
              {year.name} Notes Not in Your Package
            </h1>
            <p className="text-xs sm:text-sm text-slate-600 mt-2 leading-relaxed">
              Your active MEDIFY package is for <strong className="text-[#171B35]">{studentAccess?.purchasedYearName}</strong>.
              In accordance with your subscription, only notes for your purchased academic year are available in your library.
            </p>
          </div>
          <div className="pt-2 flex flex-col sm:flex-row items-center justify-center gap-3">
            <Link
              to={studentAccess?.purchasedYearId ? `/year/${studentAccess.purchasedYearId}` : '/#years'}
              className="inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-lg text-xs font-bold text-white bg-[#6366F1] hover:bg-[#4F46E5] transition-colors shadow-xs w-full sm:w-auto"
            >
              <BookOpen className="w-4 h-4" />
              <span>Open My Notes ({studentAccess?.purchasedYearName || 'My Year'})</span>
            </Link>
            <Link
              to="/dashboard"
              className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-xs font-semibold text-slate-700 bg-white border border-[#DDE1F2] hover:bg-slate-50 transition-colors w-full sm:w-auto"
            >
              <span>Go to Dashboard</span>
            </Link>
          </div>
        </div>
      </div>
    );
  }

  const isSubscribedToThisYear = Boolean(studentAccess?.isSubscribed && isMatchingYear(year, studentAccess));

  return (
    <div className="min-h-screen py-10 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto w-full">
      
      {/* Navigation Breadcrumb */}
      <div className="mb-6 flex items-center justify-between">
        <Link
          to="/"
          className="inline-flex items-center gap-1.5 text-xs font-medium text-[#6366F1] hover:text-[#4F46E5] transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Back to All Years</span>
        </Link>
        <DemoBadge subtext="Live notes" />
      </div>

      {/* Header Banner */}
      <div className="rounded-xl bg-[#171B35] text-white p-6 sm:p-10 mb-10 shadow-sm">
        <div className="max-w-3xl space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded text-[11px] font-semibold bg-[#6366F1] text-white">
              KMU MBBS Package
            </span>
            {isSubscribedToThisYear && (
              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded text-[11px] font-semibold bg-emerald-600 text-white">
                <ShieldCheck className="w-3.5 h-3.5" />
                <span>Your Enrolled Package · Unlocked</span>
              </span>
            )}
          </div>
          <h1 className="font-serif-heading text-3xl sm:text-4xl font-bold tracking-tight text-white">
            {year.name}
          </h1>
        </div>
      </div>

      {/* Blocks List */}
      <section className="mb-16">
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-3 mb-6 pb-3 border-b border-[#DDE1F2]">
          <div>
            <h2 className="font-serif-heading text-2xl font-bold text-[#171B35]">
              Modules Included in {year.name}
            </h2>
            <p className="text-xs text-slate-600 mt-1">
              Open any module to read its notes.
            </p>
          </div>
          <span className="text-xs text-slate-500 font-medium">
            {blocks.length} {blocks.length === 1 ? 'Module' : 'Modules'}
          </span>
        </div>

        {blocks.length === 0 ? (
          <div className="bg-white rounded-xl border border-dashed border-[#DDE1F2] p-10 text-center text-slate-500">
            <Layers className="w-10 h-10 text-slate-300 mx-auto mb-2" />
            <p className="font-medium text-sm text-[#171B35]">Nothing published yet</p>
            <p className="text-xs text-slate-500 mt-1">
              Modules for this academic year are being prepared and will appear here soon.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {blocks.map((block) => (
              <Link
                key={block.id}
                to={`/block/${block.id}`}
                className="group bg-white rounded-xl border border-[#DDE1F2] p-6 shadow-xs hover:border-[#6366F1] hover:shadow-md transition-all flex flex-col justify-between"
              >
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-[#6366F1] tracking-wider uppercase">
                      Order #{block.order}
                    </span>
                    <span className="text-[11px] text-slate-500 bg-[#F0F1FA] px-2 py-0.5 rounded font-medium">
                      {block.subjects.length} {block.subjects.length === 1 ? 'Note' : 'Notes'}
                    </span>
                  </div>

                  <h3 className="font-serif-heading text-lg font-bold text-[#171B35] group-hover:text-[#6366F1] transition-colors">
                    {block.name}
                  </h3>

                  {block.subjects.length > 0 && (
                    <div className="pt-3 border-t border-[#F0F1FA] space-y-1">
                      <span className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider">
                        Notes in this module:
                      </span>
                      <ul className="text-xs text-slate-700 space-y-1">
                        {block.subjects.map((subj) => (
                          <li key={subj.id} className="flex items-center gap-1.5 truncate">
                            <span className="w-1.5 h-1.5 rounded-full bg-[#6366F1]" />
                            <span className="truncate">{subj.name}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>

                <div className="pt-6">
                  <div className="w-full py-2 px-3 rounded text-xs font-semibold text-[#171B35] bg-[#F0F1FA] group-hover:bg-[#6366F1] group-hover:text-white transition-colors flex items-center justify-center gap-1.5">
                    <span>View Subject Notes</span>
                    <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" />
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </section>

      {/* Subscription Plans Section or Active Status */}
      {isSubscribedToThisYear ? (
        <section className="pt-8 border-t border-[#DDE1F2]">
          <div className="bg-emerald-50/70 border border-emerald-300 rounded-2xl p-6 sm:p-8 text-center max-w-2xl mx-auto space-y-2">
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-100 text-emerald-900 border border-emerald-300 text-xs font-bold uppercase tracking-wider">
              <ShieldCheck className="w-4 h-4 text-emerald-600" />
              <span>Full Package Unlocked</span>
            </div>
            <h3 className="font-serif-heading text-xl font-bold text-[#171B35]">
              You have active subscriber access to {year.name}
            </h3>
            <p className="text-xs text-slate-600 max-w-lg mx-auto">
              All modules and high-yield KMU study notes for this year are completely unlocked. Select any module above to begin studying.
            </p>
          </div>
        </section>
      ) : (
        <section className="pt-6 border-t border-[#DDE1F2]">
          <div className="text-center max-w-2xl mx-auto mb-10">
            <div className="inline-flex items-center gap-2 mb-2">
              <span className="text-xs font-bold text-[#6366F1] tracking-wider uppercase">Subscription Pass</span>
            </div>
            <h2 className="font-serif-heading text-2xl sm:text-3xl font-bold text-[#171B35] mb-2">
              Choose Your Access Duration
            </h2>
            <p className="text-xs sm:text-sm text-slate-600">
              Subscribe for 3, 6, or 12 months to unlock complete notes, diagrams, and revision tables across all {year.name} modules.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-5xl mx-auto">
            {PLANS.map((plan) => (
              <PlanCard
                key={plan.id}
                plan={plan}
                yearTitle={year.name}
                onSelect={(p) => {
                  if (!user) {
                    navigate('/login');
                  } else {
                    setSelectedPlanForCheckout(p);
                    setIsCheckoutOpen(true);
                  }
                }}
              />
            ))}
          </div>
        </section>
      )}

      {/* Payment Checkout Modal */}
      <PaymentModal
        isOpen={isCheckoutOpen}
        onClose={() => setIsCheckoutOpen(false)}
        initialPlan={selectedPlanForCheckout}
        initialYearId={year.id}
        initialYearName={year.name}
      />

    </div>
  );
}
