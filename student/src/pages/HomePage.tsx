import { useSite } from '../context/SiteContext';
import { useState, useEffect, useMemo } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowRight, CheckCircle2, BookOpen, AlertCircle, RefreshCw, ShieldCheck } from 'lucide-react';
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
  filterYearsForStudent,
  StudentAccessInfo
} from '../utils/studentAccess';
import {
  YearDoc,
  BlockDoc,
  SubjectDoc,
  getPublishedYears,
  getAllPublishedBlocks,
  getAllPublishedSubjects,
  getFirstFreeSampleSubject
} from '../services/curriculum';

export function HomePage() {
  const site = useSite();
  const { user, isAdmin } = useAuth();
  const navigate = useNavigate();
  const [years, setYears] = useState<YearDoc[]>([]);
  const [blocks, setBlocks] = useState<BlockDoc[]>([]);
  const [subjects, setSubjects] = useState<SubjectDoc[]>([]);
  const [freeSampleSubject, setFreeSampleSubject] = useState<SubjectDoc | null>(null);
  const [studentAccess, setStudentAccess] = useState<StudentAccessInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedPlanForCheckout, setSelectedPlanForCheckout] = useState<Plan | null>(null);
  const [isCheckoutOpen, setIsCheckoutOpen] = useState(false);

  const fetchCurriculum = async () => {
    try {
      setLoading(true);
      setError(null);
      const [fetchedYears, fetchedBlocks, sample, fetchedSubjects] = await Promise.all([
        getPublishedYears(),
        getAllPublishedBlocks(),
        getFirstFreeSampleSubject(),
        getAllPublishedSubjects().catch(() => [] as SubjectDoc[])
      ]);
      setYears(fetchedYears);
      setBlocks(fetchedBlocks);
      setSubjects(fetchedSubjects);
      setFreeSampleSubject(sample);
    } catch (err: any) {
      console.error('Error fetching published curriculum:', err);
      setError('Unable to load curriculum packages from database. Please check your connection.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCurriculum();
  }, []);

  // Fetch student subscription / access info
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
          const info = getStudentAccessInfo(uSnap.data(), payments);
          setStudentAccess(info);
        }
      } catch (err) {
        console.warn('Could not load student access in HomePage:', err);
      }
    }

    loadAccess();

    return () => {
      isMounted = false;
    };
  }, [user]);

  // If student purchased a specific class notes package, only show that year notes in the library!
  const visibleYears = useMemo(() => {
    return filterYearsForStudent(years, studentAccess, isAdmin);
  }, [years, studentAccess, isAdmin]);

  const blocksByYear = useMemo(() => {
    const map: Record<string, BlockDoc[]> = {};
    blocks.forEach((b) => {
      if (!map[b.yearId]) map[b.yearId] = [];
      map[b.yearId].push(b);
    });
    return map;
  }, [blocks]);

  // Modules that already have published notes, grouped by year (for the "Uploaded notes" section)
  const notesByBlock = useMemo(() => {
    const map: Record<string, SubjectDoc[]> = {};
    subjects.forEach((sj) => {
      if (!map[sj.blockId]) map[sj.blockId] = [];
      map[sj.blockId].push(sj);
    });
    return map;
  }, [subjects]);

  const scrollToYears = () => {
    const el = document.getElementById('years');
    if (el) {
      el.scrollIntoView({ behavior: 'smooth' });
    }
  };

  return (
    <div className="flex flex-col min-h-screen">
      
      {/* 1. Petrol Navy Hero Section */}
      <section className="bg-[#171B35] text-white pt-12 pb-20 px-4 sm:px-6 lg:px-8 border-b border-[#171B35]/80">
        <div className="max-w-5xl mx-auto text-center space-y-6">
          
          {/* Official Medify Logo Showcase */}
          <div className="flex justify-center pt-2">
            <img
              src={site.logoUrl}
              alt={`${site.siteName} — ${site.tagline}`}
              className="h-28 sm:h-36 w-auto object-contain drop-shadow-md transform hover:scale-105 transition-transform"
            />
          </div>

          <div className="inline-flex items-center gap-2 px-3.5 py-1 rounded-full bg-white/10 text-xs text-[#F0F1FA] border border-white/15">
            <span className="w-2 h-2 rounded-full bg-[#6366F1]" />
            <span>Khyber Medical University (KMU) Modular Curriculum</span>
          </div>

          <h1 className="sr-only">
            {site.siteName} — {site.tagline}
          </h1>

          <p className="text-base sm:text-lg lg:text-xl text-[#F0F1FA]/85 max-w-3xl mx-auto font-sans leading-relaxed">
            High-yield, integrated study notes built exclusively for MBBS undergraduates in Pakistan. Stop drowning in hundreds of unorganized slides—revise modular blocks with clinical clarity.
          </p>

          <div className="pt-4 flex flex-col sm:flex-row items-center justify-center gap-4">
            <button
              type="button"
              onClick={scrollToYears}
              className="w-full sm:w-auto px-7 py-3.5 rounded-lg text-sm font-semibold text-white bg-[#6366F1] hover:bg-[#4F46E5] transition-colors shadow-sm flex items-center justify-center gap-2 cursor-pointer"
            >
              <span>Browse Notes</span>
              <ArrowRight className="w-4 h-4" />
            </button>
            {freeSampleSubject && (
              <Link
                to={`/read/subject/${freeSampleSubject.id}`}
                className="w-full sm:w-auto px-6 py-3.5 rounded-lg text-sm font-medium text-white/90 border border-white/20 hover:bg-white/10 transition-colors flex items-center justify-center gap-2"
              >
                <BookOpen className="w-4 h-4 text-[#6366F1]" />
                <span>Preview Sample</span>
              </Link>
            )}
          </div>

          <div className="pt-8 flex flex-wrap items-center justify-center gap-6 text-xs text-[#F0F1FA]/70">
            <span className="flex items-center gap-1.5">
              <CheckCircle2 className="w-4 h-4 text-[#6366F1]" /> Modular Block Integration
            </span>
            <span className="flex items-center gap-1.5">
              <CheckCircle2 className="w-4 h-4 text-[#6366F1]" /> High-Yield Tables & Schematics
            </span>
            <span className="flex items-center gap-1.5">
              <CheckCircle2 className="w-4 h-4 text-[#6366F1]" /> Aligned with the KMU Modular Syllabus
            </span>
          </div>
        </div>
      </section>

      {/* 2. Choose Your Year / Student Notes Library Panel */}
      <section id="years" className="py-16 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto w-full">
        {studentAccess?.isSubscribed && !isAdmin ? (
          <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 mb-10 pb-4 border-b border-[#DDE1F2]">
            <div>
              <div className="flex items-center gap-3 mb-2">
                <h2 className="font-serif-heading text-2xl sm:text-3xl font-bold text-[#171B35]">
                  Your Notes Library
                </h2>
                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-300 uppercase tracking-wider flex items-center gap-1">
                  <ShieldCheck className="w-3 h-3 text-emerald-600" />
                  <span>Subscribed Year</span>
                </span>
              </div>
              <p className="text-sm text-slate-600 max-w-2xl">
                Showing modular blocks and high-yield notes for your purchased class package (
                <strong className="text-[#171B35]">{studentAccess.purchasedYearName || visibleYears[0]?.name || 'MBBS'}</strong>
                ). Only your enrolled year's notes are unlocked and displayed in your library.
              </p>
            </div>
            <span className="text-xs text-emerald-800 bg-emerald-50 px-2.5 py-1 rounded border border-emerald-200 font-medium shrink-0">
              {studentAccess.purchasedYearName || 'Subscribed Package'}
            </span>
          </div>
        ) : (
          <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 mb-10 pb-4 border-b border-[#DDE1F2]">
            <div>
              <div className="flex items-center gap-3 mb-2">
                <h2 className="font-serif-heading text-2xl sm:text-3xl font-bold text-[#171B35]">
                  Choose Your Year
                </h2>
                <DemoBadge subtext="Live notes" />
              </div>
              <p className="text-sm text-slate-600 max-w-2xl">
                Select your academic year to view the corresponding KMU modular blocks, subjects, and study packages.
              </p>
            </div>
            <span className="text-xs text-slate-500 shrink-0">
              KMU Integrated Curriculum (by module)
            </span>
          </div>
        )}

        {/* Loading skeleton state */}
        {loading && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 animate-pulse">
            {[1, 2, 3, 4, 5].map((idx) => (
              <div
                key={idx}
                className="rounded-xl border border-[#DDE1F2] bg-white p-6 h-64 flex flex-col justify-between"
              >
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="h-6 w-32 bg-slate-200 rounded" />
                    <div className="h-4 w-16 bg-slate-200 rounded" />
                  </div>
                  <div className="space-y-2 pt-3 border-t border-slate-100">
                    <div className="h-3 w-3/4 bg-slate-100 rounded" />
                    <div className="h-3 w-2/3 bg-slate-100 rounded" />
                    <div className="h-3 w-1/2 bg-slate-100 rounded" />
                  </div>
                </div>
                <div className="h-9 w-full bg-slate-200 rounded" />
              </div>
            ))}
          </div>
        )}

        {/* Error state */}
        {!loading && error && (
          <div className="bg-red-50 border border-red-200 rounded-xl p-8 text-center max-w-md mx-auto">
            <AlertCircle className="w-8 h-8 text-red-500 mx-auto mb-2" />
            <h3 className="font-serif-heading text-base font-bold text-red-900 mb-1">
              Failed to Load Curriculum
            </h3>
            <p className="text-xs text-red-700 mb-4">{error}</p>
            <button
              type="button"
              onClick={fetchCurriculum}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-semibold text-white bg-red-700 hover:bg-red-800 transition-colors"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>Retry</span>
            </button>
          </div>
        )}

        {/* Empty state: Nothing published yet */}
        {!loading && !error && visibleYears.length === 0 && (
          <div className="bg-white rounded-xl border border-dashed border-[#DDE1F2] p-12 text-center max-w-lg mx-auto">
            <div className="w-12 h-12 rounded-full bg-[#F0F1FA] text-[#6366F1] flex items-center justify-center mx-auto mb-3">
              <BookOpen className="w-6 h-6" />
            </div>
            <h3 className="font-serif-heading text-lg font-bold text-[#171B35] mb-1">
              Nothing published yet
            </h3>
            <p className="text-xs text-slate-600 mb-4">
              Curriculum packages are being prepared by the editorial committee. Please check back shortly or contact academic support.
            </p>
          </div>
        )}

        {/* Real Published Years Grid: ONLY shows student's purchased year when subscribed! */}
        {!loading && !error && visibleYears.length > 0 && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {visibleYears.map((year) => {
              const yearBlocks = blocksByYear[year.id] || [];
              const isComingSoon = year.status === 'coming-soon' || yearBlocks.length === 0;

              if (isComingSoon) {
                return (
                  <div
                    key={year.id}
                    className="rounded-xl border border-dashed border-[#DDE1F2] bg-white/60 p-6 flex flex-col justify-between opacity-80 select-none"
                  >
                    <div className="space-y-4">
                      <div className="flex items-center justify-between">
                        <h3 className="font-serif-heading text-xl font-bold text-slate-700">
                          {year.name}
                        </h3>
                        <span className="px-2.5 py-0.5 rounded text-[11px] font-semibold bg-slate-200 text-slate-600">
                          Coming soon
                        </span>
                      </div>
                    </div>
                    <div className="pt-6">
                      <button
                        type="button"
                        disabled
                        aria-disabled="true"
                        className="w-full py-2.5 px-4 rounded text-xs font-medium text-slate-400 bg-slate-100 cursor-not-allowed"
                      >
                        Not yet published
                      </button>
                    </div>
                  </div>
                );
              }

              return (
                <Link
                  key={year.id}
                  to={`/year/${year.id}`}
                  className="group rounded-xl border border-[#DDE1F2] bg-white p-6 shadow-xs hover:shadow-md hover:border-[#6366F1] transition-all flex flex-col justify-between"
                >
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <h3 className="font-serif-heading text-xl font-bold text-[#171B35] group-hover:text-[#6366F1] transition-colors">
                        {year.name}
                      </h3>
                      <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-[#F0F1FA] text-[#171B35]">
                        Active
                      </span>
                    </div>

                    <ul className="text-xs text-slate-700 space-y-2 pt-3 border-t border-[#F0F1FA]">
                      {yearBlocks.map((block) => (
                        <li key={block.id} className="flex items-start gap-2">
                          <span className="w-1.5 h-1.5 rounded-full bg-[#6366F1] mt-1.5 shrink-0" />
                          <span className="font-medium text-[#171B35]">{block.name}</span>
                          {(notesByBlock[block.id]?.length || 0) > 0 && (
                            <span className="ml-auto shrink-0 text-[10px] font-semibold px-1.5 py-0.5 rounded bg-emerald-50 text-emerald-700 border border-emerald-200">
                              Notes ready
                            </span>
                          )}
                        </li>
                      ))}
                    </ul>
                  </div>

                  <div className="pt-6">
                    <div className="w-full py-2.5 px-4 rounded text-xs font-semibold text-white bg-[#171B35] group-hover:bg-[#6366F1] transition-colors flex items-center justify-center gap-2">
                      <span>View Blocks</span>
                      <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" />
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </section>

      {/* Uploaded notes: every module that has notes, with a direct link */}
      {!loading && !error && (() => {
        const rows = visibleYears
          .map((y) => ({
            year: y,
            mods: (blocksByYear[y.id] || []).filter((b) => (notesByBlock[b.id]?.length || 0) > 0)
          }))
          .filter((r) => r.mods.length > 0);
        if (rows.length === 0) return null;
        return (
          <section className="py-12 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto w-full">
            <div className="mb-6 pb-3 border-b border-[#DDE1F2]">
              <h2 className="font-serif-heading text-2xl font-bold text-[#171B35]">Notes Available Now</h2>
              <p className="text-sm text-slate-600 mt-1">Open a module to read its notes.</p>
            </div>
            <div className="space-y-8">
              {rows.map(({ year, mods }) => (
                <div key={year.id} className="space-y-3">
                  <h3 className="text-xs font-bold text-slate-700 uppercase tracking-wider">{year.name}</h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                    {mods.map((b) => (
                      <Link
                        key={b.id}
                        to={`/block/${b.id}`}
                        className="group p-4 rounded-xl border border-[#DDE1F2] bg-white hover:border-[#6366F1] hover:shadow-md transition-all flex items-center justify-between gap-3"
                      >
                        <div>
                          <span className="block font-serif-heading text-sm font-bold text-[#171B35] group-hover:text-[#6366F1] transition-colors">{b.name}</span>
                          <span className="block text-[11px] text-slate-500 mt-0.5">
                            {notesByBlock[b.id].length} {notesByBlock[b.id].length === 1 ? 'note' : 'notes'} uploaded
                          </span>
                        </div>
                        <ArrowRight className="w-4 h-4 text-[#6366F1] shrink-0 group-hover:translate-x-0.5 transition-transform" />
                      </Link>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </section>
        );
      })()}

      {/* 3. How MEDIFY Works Section */}
      <section className="bg-[#F0F1FA]/60 py-16 px-4 sm:px-6 lg:px-8 border-y border-[#DDE1F2]">
        <div className="max-w-7xl mx-auto">
          <div className="text-center max-w-3xl mx-auto mb-12">
            <h2 className="font-serif-heading text-2xl sm:text-3xl font-bold text-[#171B35] mb-3">
              How MEDIFY Works
            </h2>
            <p className="text-sm text-slate-600">
              A streamlined study methodology designed to help medical students master modular exams with precision.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            
            {/* Step 1: Subscribe */}
            <div className="bg-white rounded-xl p-6 border border-[#DDE1F2] shadow-xs space-y-3">
              <div className="w-10 h-10 rounded-lg bg-[#171B35] text-white flex items-center justify-center font-serif-heading font-bold text-base">
                1
              </div>
              <h3 className="font-serif-heading text-lg font-bold text-[#171B35]">
                Subscribe
              </h3>
              <p className="text-xs text-slate-600 leading-relaxed">
                Choose a flexible 3, 6, or 12-month pass matching your upcoming modular block exam schedule.
              </p>
            </div>

            {/* Step 2: Read */}
            <div className="bg-white rounded-xl p-6 border border-[#DDE1F2] shadow-xs space-y-3">
              <div className="w-10 h-10 rounded-lg bg-[#6366F1] text-white flex items-center justify-center font-serif-heading font-bold text-base">
                2
              </div>
              <h3 className="font-serif-heading text-lg font-bold text-[#171B35]">
                Read
              </h3>
              <p className="text-xs text-slate-600 leading-relaxed">
                Study clean, structured notes organized by KMU block and subject, with high-yield clinical tables and schematics.
              </p>
            </div>

            {/* Step 3: Highlight */}
            <div className="bg-white rounded-xl p-6 border border-[#DDE1F2] shadow-xs space-y-3">
              <div className="w-10 h-10 rounded-lg bg-[#171B35] text-white flex items-center justify-center font-serif-heading font-bold text-base">
                3
              </div>
              <h3 className="font-serif-heading text-lg font-bold text-[#171B35]">
                Highlight
              </h3>
              <p className="text-xs text-slate-600 leading-relaxed">
                Spot exam-tested pearls, diagnostic criteria, and pharmacological mechanisms highlighted across every chapter.
              </p>
            </div>

            {/* Step 4: Revise */}
            <div className="bg-white rounded-xl p-6 border border-[#DDE1F2] shadow-xs space-y-3">
              <div className="w-10 h-10 rounded-lg bg-[#6366F1] text-white flex items-center justify-center font-serif-heading font-bold text-base">
                4
              </div>
              <h3 className="font-serif-heading text-lg font-bold text-[#171B35]">
                Revise
              </h3>
              <p className="text-xs text-slate-600 leading-relaxed">
                Quickly recap prior blocks before modular term assessments and pre-prof professional examinations.
              </p>
            </div>

          </div>
        </div>
      </section>

      {/* 4. Plans Preview Section */}
      <section id="plans" className="py-16 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto w-full">
        <div className="text-center max-w-2xl mx-auto mb-12">
          <div className="flex items-center justify-center gap-2 mb-2">
            <h2 className="font-serif-heading text-2xl sm:text-3xl font-bold text-[#171B35]">
              Simple, Transparent Plans
            </h2>
            <DemoBadge subtext="Editable Data" />
          </div>
          <p className="text-sm text-slate-600">
            One standard subscription pricing across all active MBBS years. Select the package that fits your exam calendar.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-5xl mx-auto">
          {PLANS.map((plan) => (
            <PlanCard
              key={plan.id}
              plan={plan}
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

      {/* Payment Checkout Modal */}
      <PaymentModal
        isOpen={isCheckoutOpen}
        onClose={() => setIsCheckoutOpen(false)}
        initialPlan={selectedPlanForCheckout}
        onSuccess={() => {
          // Success handled in modal with pending verification screen and WhatsApp button
        }}
      />

    </div>
  );
}
