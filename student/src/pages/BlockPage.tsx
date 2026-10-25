import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import {
  ArrowLeft,
  Lock,
  BookOpen,
  AlertCircle,
  RefreshCw,
  FileText,
  ChevronRight,
  ShieldAlert,
  ShieldCheck
} from 'lucide-react';
import { doc, getDoc } from '../lib/data';
import { db } from '../lib/client';
import { DemoBadge } from '../components/DemoBadge';
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
  getPublishedBlockById,
  getPublishedYearById,
  getPublishedSubjectsForBlock
} from '../services/curriculum';

export function BlockPage() {
  const { blockId } = useParams<{ blockId: string }>();
  const { user, isAdmin } = useAuth();

  const [block, setBlock] = useState<BlockDoc | null>(null);
  const [year, setYear] = useState<YearDoc | null>(null);
  const [subjects, setSubjects] = useState<SubjectDoc[]>([]);
  const [studentAccess, setStudentAccess] = useState<StudentAccessInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchBlockDetails = async () => {
    if (!blockId) return;
    try {
      setLoading(true);
      setError(null);

      const fetchedBlock = await getPublishedBlockById(blockId);
      if (!fetchedBlock) {
        setBlock(null);
        return;
      }
      setBlock(fetchedBlock);

      const [fetchedYear, fetchedSubjects] = await Promise.all([
        getPublishedYearById(fetchedBlock.yearId),
        getPublishedSubjectsForBlock(fetchedBlock.id)
      ]);

      setYear(fetchedYear);
      setSubjects(fetchedSubjects);
    } catch (err: any) {
      console.error('Error fetching block:', err);
      setError('Unable to load module details from database.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchBlockDetails();
  }, [blockId]);
  useEffect(()=>{const refresh=()=>{if(!document.hidden)void fetchBlockDetails();};window.addEventListener("focus",refresh);return()=>window.removeEventListener("focus",refresh);},[blockId]);

  // Load student access info
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
        console.warn('Could not load student access in BlockPage:', e);
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
        <div className="h-4 w-48 bg-slate-200 rounded mb-6" />
        <div className="h-44 rounded-xl bg-slate-200 mb-8" />
        <div className="space-y-4">
          <div className="h-28 rounded-xl bg-slate-200" />
          <div className="h-32 rounded-xl bg-slate-200" />
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
        <h1 className="font-serif-heading text-2xl font-bold text-[#0f2837] mb-2">
          Unable to Load Module
        </h1>
        <p className="text-sm text-slate-600 mb-6">{error}</p>
        <button
          type="button"
          onClick={fetchBlockDetails}
          className="inline-flex items-center gap-2 px-4 py-2 rounded text-xs font-semibold text-white bg-[#1b8e8e] hover:bg-[#147273] transition-colors"
        >
          <RefreshCw className="w-4 h-4" />
          <span>Retry</span>
        </button>
      </div>
    );
  }

  if (!block) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-16 text-center">
        <div className="w-12 h-12 rounded-full bg-red-100 text-red-600 flex items-center justify-center mx-auto mb-4">
          <AlertCircle className="w-6 h-6" />
        </div>
        <h1 className="font-serif-heading text-2xl font-bold text-[#0f2837] mb-2">
          Module Not Found
        </h1>
        <p className="text-sm text-slate-600 mb-6">
          The requested module could not be located or has not yet been published.
        </p>
        <Link
          to="/"
          className="inline-flex items-center gap-2 px-4 py-2 rounded text-xs font-semibold text-white bg-[#1b8e8e] hover:bg-[#147273] transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Return to Curriculum Hub</span>
        </Link>
      </div>
    );
  }

  // RESTRICTION CHECK: When a student purchases his respective class notes package, only show him that year notes!
  const isRestrictedForStudent = Boolean(
    year &&
    studentAccess?.isSubscribed &&
    !isAdmin &&
    !isMatchingYear(year, studentAccess)
  );

  if (isRestrictedForStudent && year) {
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
            <h1 className="font-serif-heading text-2xl font-bold text-[#0f2837]">
              {block.name} Notes Not in Your Package
            </h1>
            <p className="text-xs sm:text-sm text-slate-600 mt-2 leading-relaxed">
              This module belongs to <strong className="text-[#0f2837]">{year.name}</strong>.
              Your active MEDIFY package is for <strong className="text-[#0f2837]">{studentAccess?.purchasedYearName}</strong>.
              Only notes for your purchased academic year are available in your library.
            </p>
          </div>
          <div className="pt-2 flex flex-col sm:flex-row items-center justify-center gap-3">
            <Link
              to={studentAccess?.purchasedYearId ? `/year/${studentAccess.purchasedYearId}` : '/#years'}
              className="inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-lg text-xs font-bold text-white bg-[#1b8e8e] hover:bg-[#147273] transition-colors shadow-xs w-full sm:w-auto"
            >
              <BookOpen className="w-4 h-4" />
              <span>Open My Notes ({studentAccess?.purchasedYearName || 'My Year'})</span>
            </Link>
            <Link
              to="/dashboard"
              className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-xs font-semibold text-slate-700 bg-white border border-[#cfdbe5] hover:bg-slate-50 transition-colors w-full sm:w-auto"
            >
              <span>Go to Dashboard</span>
            </Link>
          </div>
        </div>
      </div>
    );
  }

  const freeSampleSubject = subjects.find((s) => s.isFreeSample);

  return (
    <div className="min-h-screen py-10 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto w-full">
      {/* Navigation Breadcrumbs */}
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2 text-xs text-slate-500">
          <Link to="/" className="text-[#1b8e8e] hover:underline">
            Home
          </Link>
          <span>/</span>
          {year ? (
            <Link to={`/year/${year.id}`} className="text-[#1b8e8e] hover:underline">
              {year.name}
            </Link>
          ) : (
            <span>Year</span>
          )}
          <span>/</span>
          <span className="text-[#0f2837] font-medium">{block.name}</span>
        </div>
        <DemoBadge subtext="Live notes" />
      </div>

      {/* Block Header Banner */}
      <div className="bg-[#0f2837] text-white rounded-xl p-6 sm:p-10 mb-8 shadow-sm">
        <div className="max-w-3xl space-y-3">
          <div className="flex items-center gap-2">
            <span className="px-2.5 py-0.5 rounded text-[11px] font-semibold bg-[#1b8e8e] text-white">
              Order #{block.order}
            </span>
            {year && (
              <span className="text-xs text-[#e8eef3]/80">
                {year.name}
              </span>
            )}
          </div>

          <h1 className="font-serif-heading text-2xl sm:text-4xl font-bold tracking-tight text-white">
            {block.name}
          </h1>

          <div className="pt-2 flex flex-wrap items-center gap-4 text-xs text-[#e8eef3]/60">
            <span>{subjects.length} High-Yield Subject Notes</span>
            <span aria-hidden="true">·</span>
            <span>KMU Modular Syllabus</span>
          </div>
        </div>
      </div>

      {/* Free Sample Callout */}
      {freeSampleSubject && (
        <div className="mb-10 bg-white rounded-xl border border-[#1b8e8e]/40 p-5 sm:p-6 shadow-xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-[#1b8e8e]" />
              <h3 className="font-serif-heading text-base font-bold text-[#0f2837]">
                Free Sample Note Available: {freeSampleSubject.name}
              </h3>
            </div>
            <p className="text-xs text-slate-600 max-w-2xl">
              Preview complete integrated medical notes with clinical tables, diagnostic criteria, and adjustable reading controls.
            </p>
          </div>
          <Link
            to={`/read/subject/${freeSampleSubject.id}`}
            className="shrink-0 px-4 py-2.5 rounded text-xs font-semibold text-white bg-[#1b8e8e] hover:bg-[#147273] transition-colors flex items-center gap-2 shadow-xs"
          >
            <BookOpen className="w-3.5 h-3.5" />
            <span>Read Free Sample</span>
          </Link>
        </div>
      )}

      {/* Constituent Subjects (The Notes Students Read) */}
      <div className="space-y-6">
        <div>
          <h2 className="font-serif-heading text-2xl font-bold text-[#0f2837]">
            Notes in this Module
          </h2>
          <p className="text-xs text-slate-600 mt-1">
            Select any subject below to open the full high-yield study note in the MEDIFY Reader.
          </p>
        </div>

        {subjects.length === 0 ? (
          <div className="bg-white rounded-xl border border-dashed border-[#cfdbe5] p-10 text-center text-slate-500">
            <BookOpen className="w-10 h-10 text-slate-300 mx-auto mb-2" />
            <p className="font-medium text-sm text-[#0f2837]">Nothing published yet</p>
            <p className="text-xs text-slate-500 mt-1">
              Notes for this module will appear here once they are published.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4">
            {subjects.map((subject, idx) => (
              <Link
                key={subject.id}
                to={`/read/subject/${subject.id}`}
                className="group bg-white rounded-xl border border-[#cfdbe5] p-5 sm:px-6 hover:border-[#1b8e8e] hover:shadow-md transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-4"
              >
                <div className="space-y-1.5 flex items-start sm:items-center gap-3.5">
                  <span className="w-8 h-8 rounded-lg bg-[#e8eef3] text-[#0f2837] group-hover:bg-[#0f2837] group-hover:text-white transition-colors flex items-center justify-center text-xs font-bold font-serif-heading shrink-0 mt-0.5 sm:mt-0">
                    {idx + 1}
                  </span>

                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="font-serif-heading text-base font-bold text-[#0f2837] group-hover:text-[#1b8e8e] transition-colors">
                        {subject.name}
                      </h3>
                      {subject.isFreeSample && (
                        <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-[#1b8e8e]/10 text-[#1b8e8e] border border-[#1b8e8e]/20">
                          Free Sample Available
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-slate-500">
                      Full modular note · High-yield KMU format
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0 self-end sm:self-auto">
                  {subject.isFreeSample ? (
                    <span className="px-3.5 py-1.5 rounded text-xs font-semibold text-white bg-[#1b8e8e] group-hover:bg-[#147273] transition-colors flex items-center gap-1.5 shadow-xs">
                      <BookOpen className="w-3.5 h-3.5" />
                      <span>Read Free Sample</span>
                      <ChevronRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" />
                    </span>
                  ) : (
                    <span className="px-3.5 py-1.5 rounded text-xs font-semibold text-[#0f2837] bg-[#e8eef3] group-hover:bg-[#1b8e8e] group-hover:text-white transition-colors flex items-center gap-1.5">
                      <FileText className="w-3.5 h-3.5" />
                      <span>Read Subject</span>
                      <ChevronRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" />
                    </span>
                  )}
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>

      {/* Back to Year */}
      <div className="mt-12 pt-8 border-t border-[#cfdbe5] flex flex-col sm:flex-row items-center justify-between gap-4">
        {year && (
          <Link
            to={`/year/${year.id}`}
            className="inline-flex items-center gap-2 text-xs font-semibold text-[#1b8e8e] hover:underline"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>View other modules in {year.name}</span>
          </Link>
        )}
        <span className="text-xs text-slate-500">
          KMU Integrated Syllabus · Professional Year Package
        </span>
      </div>
    </div>
  );
}
