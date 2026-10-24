import { useState, useEffect, useMemo, useRef } from 'react';
import { useParams, Link } from 'react-router-dom';
import {
  ArrowLeft,
  Sun,
  Moon,
  Menu,
  X,
  BookOpen,
  Lock,
  AlertCircle,
  Clock,
  Layers,
  ChevronRight,
  FileText,
  ShieldAlert,
  CreditCard,
  LogIn
} from 'lucide-react';
import { doc, getDoc } from '../lib/data';
import { db } from '../lib/client';
import { useAuth } from '../context/AuthContext';
import { SubjectDoc, BlockDoc, YearDoc } from '../services/curriculum';
import {
  getSubjectContent,
  getSubjectPart,
  SubjectContentDoc
} from '../services/notes';
import { TocItem, prepareHtmlForReader } from '../utils/docxProcessor';
import { NoteBody } from '../components/NoteBody';
import { getUserPaymentRequests } from '../services/payments';
import {
  getStudentAccessInfo,
  isMatchingYear,
  StudentAccessInfo
} from '../utils/studentAccess';

export function ReaderPage() {
  const params = useParams<{ subjectId?: string; chapterId?: string }>();
  const subjectId = params.subjectId || params.chapterId;
  const { user, isAdmin } = useAuth();
  const [userProfile, setUserProfile] = useState<{
    approvalStatus?: string;
    paymentStatus?: string;
  } | null>(null);
  const [studentAccess, setStudentAccess] = useState<StudentAccessInfo | null>(null);

  // Data states
  const [loadingInitial, setLoadingInitial] = useState<boolean>(true);
  const [subject, setSubject] = useState<SubjectDoc | null>(null);
  const [block, setBlock] = useState<BlockDoc | null>(null);
  const [year, setYear] = useState<YearDoc | null>(null);
  const [contentMeta, setContentMeta] = useState<SubjectContentDoc | null>(null);
  const [isLocked, setIsLocked] = useState<boolean>(false);
  const [notFound, setNotFound] = useState<boolean>(false);

  // Fetch student approval profile & subscription access info
  useEffect(() => {
    if (!user) {
      setUserProfile(null);
      setStudentAccess(null);
      return;
    }
    let isMounted = true;
    const loadProfile = async () => {
      try {
        const [snap, payments] = await Promise.all([
          getDoc(doc(db, 'users', user.uid)),
          getUserPaymentRequests(user.uid)
        ]);
        if (isMounted && snap.exists()) {
          const data = snap.data();
          setUserProfile({
            approvalStatus: data.approvalStatus,
            paymentStatus: data.paymentStatus
          });
          setStudentAccess(getStudentAccessInfo(data, payments));
        }
      } catch (err) {
        console.warn('Could not load user profile in reader:', err);
      }
    };
    loadProfile();
    return () => {
      isMounted = false;
    };
  }, [user]);

  // Parts map: key = partNumber (1..N), value = HTML string
  const [partsMap, setPartsMap] = useState<Record<number, string>>({});
  const [loadingParts, setLoadingParts] = useState<boolean>(false);

  // TOC & Reading controls
  const [isTocOpenDesktop, setIsTocOpenDesktop] = useState<boolean>(true);
  const [isTocOpenMobile, setIsTocOpenMobile] = useState<boolean>(false);
  const [activeHeadingId, setActiveHeadingId] = useState<string>('');

  // Font size: 0 = normal (16px), -1 = small (14px), +1 = large (18px), +2 = xl (20px)
  const [fontSizeLevel, setFontSizeLevel] = useState<number>(0);

  // Light / Dark reader mode
  const [isDarkMode, setIsDarkMode] = useState<boolean>(false);

  // 1. Fetch Subject metadata, parent block/year, and content metadata + Part 1
  useEffect(() => {
    if (!subjectId) {
      setNotFound(true);
      setLoadingInitial(false);
      return;
    }

    let isMounted = true;
    setLoadingInitial(true);
    setIsLocked(false);
    setNotFound(false);
    setSubject(null);
    setContentMeta(null);
    setPartsMap({});

    const loadInitialData = async () => {
      try {
        // Step A: Fetch Subject document
        const subjectRef = doc(db, 'subjects', subjectId);
        const subjectSnap = await getDoc(subjectRef);

        if (!subjectSnap.exists()) {
          // Check if this was a legacy chapter ID
          const chapSnap = await getDoc(doc(db, 'chapters', subjectId));
          if (!chapSnap.exists()) {
            if (isMounted) setNotFound(true);
            return;
          }
          // If legacy chapter exists, adapt to Subject shape
          const cData = chapSnap.data();
          const legacySubj: SubjectDoc = {
            id: chapSnap.id,
            name: cData.title || 'Medical Note',
            blockId: cData.blockId || '',
            yearId: cData.yearId || '',
            order: cData.order || 1,
            published: Boolean(cData.published),
            isFreeSample: Boolean(cData.isFreeSample)
          };
          if (!legacySubj.published && !isAdmin) {
            if (isMounted) setNotFound(true);
            return;
          }
          if (isMounted) setSubject(legacySubj);
        } else {
          const sData = subjectSnap.data() as Omit<SubjectDoc, 'id'>;
          const subjObj: SubjectDoc = { id: subjectSnap.id, ...sData };

          if (!subjObj.published && !isAdmin) {
            if (isMounted) setNotFound(true);
            return;
          }
          if (isMounted) setSubject(subjObj);

          // Fetch parent block & year for breadcrumb
          if (subjObj.blockId) {
            try {
              const bSnap = await getDoc(doc(db, 'blocks', subjObj.blockId));
              if (bSnap.exists() && isMounted) {
                setBlock({ id: bSnap.id, ...(bSnap.data() as Omit<BlockDoc, 'id'>) });
              }
            } catch {
              // Non-critical
            }
          }
          if (subjObj.yearId) {
            try {
              const ySnap = await getDoc(doc(db, 'years', subjObj.yearId));
              if (ySnap.exists() && isMounted) {
                setYear({ id: ySnap.id, ...(ySnap.data() as Omit<YearDoc, 'id'>) });
              }
            } catch {
              // Non-critical
            }
          }
        }

        // Step B: Fetch Subject Content Metadata
        let meta: SubjectContentDoc | null = null;
        try {
          meta = await getSubjectContent(subjectId);
        } catch (contentErr: any) {
          if (
            contentErr?.code === 'permission-denied' ||
            contentErr?.message?.includes('permission-denied') ||
            contentErr?.message?.includes('Missing or insufficient permissions')
          ) {
            if (isMounted) setIsLocked(true);
            return;
          }
          throw contentErr;
        }

        if (!meta) {
          // Check if legacy chapterContent exists
          try {
            const legacyContentSnap = await getDoc(doc(db, 'chapterContent', subjectId));
            if (legacyContentSnap.exists()) {
              const lcData = legacyContentSnap.data();
              if (isMounted) {
                setContentMeta({
                  id: subjectId,
                  partCount: 1,
                  toc: [],
                  totalBytes: lcData.sizeBytes || 0,
                  updatedAt: lcData.updatedAt || null
                });
                setPartsMap({ 1: lcData.html || '' });
              }
              return;
            }
          } catch (e: any) {
            if (
              e?.code === 'permission-denied' ||
              e?.message?.includes('permission-denied')
            ) {
              if (isMounted) setIsLocked(true);
              return;
            }
          }

          if (isMounted) setNotFound(true);
          return;
        }

        if (isMounted) setContentMeta(meta);

        // Step C: Fetch Part 1 first via direct getDoc on subjectParts/{subjectId}_1
        try {
          const part1 = await getSubjectPart(subjectId, 1);
          if (part1 && isMounted) {
            setPartsMap({ 1: part1.html });
          }
        } catch (p1Err: any) {
          if (
            p1Err?.code === 'permission-denied' ||
            p1Err?.message?.includes('permission-denied')
          ) {
            if (isMounted) setIsLocked(true);
            return;
          }
          throw p1Err;
        }
      } catch (err: any) {
        console.error('Error loading subject reader data:', err);
        if (
          err?.code === 'permission-denied' ||
          err?.message?.includes('permission-denied') ||
          err?.message?.includes('Missing or insufficient permissions')
        ) {
          if (isMounted) setIsLocked(true);
        } else {
          if (isMounted) setNotFound(true);
        }
      } finally {
        if (isMounted) setLoadingInitial(false);
      }
    };

    loadInitialData();

    return () => {
      isMounted = false;
    };
  }, [subjectId, isAdmin]);

  // 2. Background loading for remaining parts (Part 2..N) via direct getDoc
  useEffect(() => {
    if (!contentMeta || contentMeta.partCount <= 1 || !subjectId) return;

    let isCancelled = false;
    setLoadingParts(true);

    const loadRemainingParts = async () => {
      for (let p = 2; p <= contentMeta.partCount; p++) {
        if (isCancelled) break;
        try {
          const partDoc = await getSubjectPart(subjectId, p);
          if (partDoc && !isCancelled) {
            setPartsMap((prev) => ({
              ...prev,
              [p]: partDoc.html
            }));
          }
        } catch (err) {
          console.error(`Failed to load part ${p}:`, err);
        }
      }
      if (!isCancelled) {
        setLoadingParts(false);
      }
    };

    loadRemainingParts();

    return () => {
      isCancelled = true;
    };
  }, [contentMeta, subjectId]);

  // Compute combined HTML rendered sequentially
  const { combinedHtml, loadedPartCount, estimatedReadMinutes } = useMemo(() => {
    if (!contentMeta) {
      return { combinedHtml: '', loadedPartCount: 0, estimatedReadMinutes: 1 };
    }

    const htmlChunks: string[] = [];
    let loadedCount = 0;

    for (let p = 1; p <= contentMeta.partCount; p++) {
      if (partsMap[p]) {
        htmlChunks.push(prepareHtmlForReader(partsMap[p]));
        loadedCount++;
      }
    }

    const fullHtml = htmlChunks.join('\n');
    const plainText = fullHtml.replace(/<[^>]+>/g, ' ');
    const wordCount = plainText.trim().split(/\s+/).filter(Boolean).length;
    const estMinutes = Math.max(1, Math.ceil(wordCount / 180));

    return {
      combinedHtml: fullHtml,
      loadedPartCount: loadedCount,
      estimatedReadMinutes: estMinutes
    };
  }, [partsMap, contentMeta]);

  // Table of Contents from contentMeta.toc
  const tocList: TocItem[] = useMemo(() => {
    return contentMeta?.toc || [];
  }, [contentMeta]);

  // ScrollSpy with IntersectionObserver to highlight current heading in TOC
  useEffect(() => {
    if (tocList.length === 0) return;

    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries.find((e) => e.isIntersecting);
        if (visible && visible.target.id) {
          setActiveHeadingId(visible.target.id);
        }
      },
      {
        rootMargin: '-80px 0px -60% 0px',
        threshold: 0
      }
    );

    tocList.forEach((item) => {
      const el = document.getElementById(item.id);
      if (el) observer.observe(el);
    });

    return () => observer.disconnect();
  }, [tocList, combinedHtml]);

  // Font size mapping
  const getProseFontSizeClass = () => {
    switch (fontSizeLevel) {
      case -1:
        return 'text-sm leading-relaxed';
      case 1:
        return 'text-lg leading-relaxed';
      case 2:
        return 'text-xl leading-relaxed';
      case 0:
      default:
        return 'text-base leading-relaxed';
    }
  };

  const increaseFontSize = () => {
    if (fontSizeLevel < 2) setFontSizeLevel((prev) => prev + 1);
  };

  const decreaseFontSize = () => {
    if (fontSizeLevel > -1) setFontSizeLevel((prev) => prev - 1);
  };

  const scrollToSection = (secId: string) => {
    const el = document.getElementById(secId);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'start' });
      setActiveHeadingId(secId);
    }
    setIsTocOpenMobile(false);
  };

  // Determine back URL
  const backUrl = useMemo(() => {
    if (subject?.blockId) {
      return `/block/${subject.blockId}`;
    }
    if (subject?.yearId) {
      return `/year/${subject.yearId}`;
    }
    return '/';
  }, [subject]);

  // 1. Initial Loading Skeleton
  if (loadingInitial) {
    return (
      <div className="min-h-screen bg-[#F8FAFC] text-slate-800 flex flex-col">
        {/* Skeleton Toolbar */}
        <div className="h-14 bg-white border-b border-[#DDE1F2] px-6 flex items-center justify-between">
          <div className="h-6 w-24 bg-slate-200 rounded animate-pulse" />
          <div className="h-6 w-40 bg-slate-200 rounded animate-pulse" />
          <div className="h-6 w-24 bg-slate-200 rounded animate-pulse" />
        </div>

        {/* Skeleton Body */}
        <div className="max-w-4xl mx-auto w-full py-12 px-6 space-y-6 flex-1">
          <div className="h-4 w-32 bg-slate-200 rounded animate-pulse" />
          <div className="h-10 w-3/4 bg-slate-200 rounded animate-pulse" />
          <div className="h-4 w-48 bg-slate-200 rounded animate-pulse" />
          <div className="pt-8 space-y-4">
            <div className="h-4 w-full bg-slate-200 rounded animate-pulse" />
            <div className="h-4 w-full bg-slate-200 rounded animate-pulse" />
            <div className="h-4 w-5/6 bg-slate-200 rounded animate-pulse" />
            <div className="h-4 w-4/6 bg-slate-200 rounded animate-pulse" />
          </div>
        </div>
      </div>
    );
  }

  // Check year restriction for subscribed student: only show notes for their purchased year package!
  const isYearRestricted = Boolean(
    subject &&
    !subject.isFreeSample &&
    !isAdmin &&
    studentAccess?.isSubscribed &&
    !isMatchingYear(year || { id: subject.yearId, name: '' }, studentAccess)
  );

  if (isYearRestricted && subject) {
    return (
      <div className="min-h-screen bg-[#F8FAFC] flex flex-col items-center justify-center p-6 text-center">
        <div className="max-w-md w-full bg-white rounded-2xl border border-amber-300 shadow-lg p-8 sm:p-10 space-y-5">
          <div className="w-16 h-16 rounded-full bg-amber-500/10 border border-amber-300 text-amber-700 flex items-center justify-center mx-auto">
            <ShieldAlert className="w-8 h-8 text-amber-600" />
          </div>

          <div className="space-y-2">
            <span className="text-[11px] font-bold uppercase tracking-wider text-[#6366F1]">
              Package Restricted
            </span>
            <h1 className="font-serif-heading text-2xl font-bold text-[#171B35]">
              Note Not in Your Package
            </h1>
            <p className="text-sm text-slate-600 leading-relaxed">
              Your active MEDIFY package is for <strong className="text-[#171B35]">{studentAccess?.purchasedYearName}</strong>.
              This note ({subject.name}) belongs to <strong className="text-[#171B35]">{year?.name || 'another academic year'}</strong>.
              Only notes for your purchased academic year are unlocked in your library.
            </p>
          </div>

          <div className="pt-4 space-y-2.5">
            <Link
              to={studentAccess?.purchasedYearId ? `/year/${studentAccess.purchasedYearId}` : '/#years'}
              className="inline-flex items-center justify-center gap-2 px-6 py-3 rounded-lg text-xs font-bold text-white bg-[#6366F1] hover:bg-[#4F46E5] transition-colors shadow-xs w-full"
            >
              <BookOpen className="w-4 h-4" />
              <span>Open My Notes ({studentAccess?.purchasedYearName || 'My Year'})</span>
            </Link>
            <Link
              to="/dashboard"
              className="inline-flex items-center justify-center gap-2 px-6 py-2.5 rounded-lg text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 transition-colors w-full"
            >
              <span>Go to Student Dashboard</span>
            </Link>
          </div>
        </div>
      </div>
    );
  }

  // 2. Permission-Denied Subscriber Lock Screen
  if (isLocked) {
    const isPendingApproval = userProfile?.approvalStatus === 'PENDING';
    const isRejectedApproval = userProfile?.approvalStatus === 'REJECTED';

    return (
      <div className="min-h-screen bg-[#F8FAFC] flex flex-col items-center justify-center p-6 text-center">
        <div className="max-w-md w-full bg-white rounded-2xl border border-[#DDE1F2] shadow-lg p-8 sm:p-10 space-y-5">
          <div className="w-16 h-16 rounded-full bg-amber-500/10 border border-amber-300 text-amber-700 flex items-center justify-center mx-auto">
            {isRejectedApproval ? (
              <ShieldAlert className="w-8 h-8 text-rose-600" />
            ) : isPendingApproval ? (
              <Clock className="w-8 h-8 text-amber-600" />
            ) : (
              <Lock className="w-8 h-8 text-amber-700" />
            )}
          </div>

          <div className="space-y-2">
            <span className="text-[11px] font-bold uppercase tracking-wider text-[#6366F1]">
              {isRejectedApproval
                ? 'Approval Declined'
                : isPendingApproval
                ? 'Approval Pending'
                : 'Subscriber Access Required'}
            </span>
            <h1 className="font-serif-heading text-2xl font-bold text-[#171B35]">
              {isRejectedApproval
                ? 'Account Not Approved'
                : isPendingApproval
                ? 'Account Awaiting Admin Approval'
                : 'Member Exclusive Notes'}
            </h1>
            <p className="text-sm text-slate-600 leading-relaxed">
              {!user ? (
                'This subject note is part of the MEDIFY full curriculum. Please sign in or register to access.'
              ) : isRejectedApproval ? (
                'Your payment or enrollment verification could not be completed. Please visit your student dashboard to review details or submit a new payment request.'
              ) : isPendingApproval ? (
                'Your account and payment (JazzCash / Meezan Bank) are currently under administrator review. Once verified, this note and your entire curriculum will unlock automatically.'
              ) : (
                'This chapter is reserved for approved MEDIFY subscribers. Visit your student dashboard to complete payment and unlock access.'
              )}
            </p>
          </div>

          <div className="pt-4 space-y-2.5">
            {!user ? (
              <>
                <Link
                  to="/register"
                  className="inline-flex items-center justify-center gap-2 px-6 py-3 rounded-lg text-xs font-bold text-white bg-[#6366F1] hover:bg-[#4F46E5] transition-colors shadow-xs w-full"
                >
                  <CreditCard className="w-4 h-4" />
                  <span>Register & Choose Plan</span>
                </Link>
                <Link
                  to="/login"
                  className="inline-flex items-center justify-center gap-2 px-6 py-2.5 rounded-lg text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 transition-colors w-full"
                >
                  <LogIn className="w-4 h-4" />
                  <span>Sign In</span>
                </Link>
              </>
            ) : (
              <Link
                to="/dashboard"
                className="inline-flex items-center justify-center gap-2 px-6 py-3 rounded-lg text-xs font-bold text-white bg-[#6366F1] hover:bg-[#4F46E5] transition-colors shadow-xs w-full"
              >
                <CreditCard className="w-4 h-4" />
                <span>Go to Student Dashboard</span>
              </Link>
            )}

            <Link
              to={backUrl}
              className="inline-flex items-center justify-center gap-2 px-6 py-2.5 rounded-lg text-xs font-semibold text-slate-600 hover:text-slate-900 transition-colors w-full"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>Back to Curriculum</span>
            </Link>
          </div>
        </div>
      </div>
    );
  }

  // 3. Subject Not Found Screen
  if (notFound || !subject) {
    return (
      <div className="min-h-screen bg-[#F8FAFC] flex flex-col items-center justify-center p-6 text-center">
        <div className="max-w-md w-full bg-white rounded-2xl border border-[#DDE1F2] shadow-lg p-8 sm:p-10 space-y-5">
          <div className="w-16 h-16 rounded-full bg-slate-100 border border-slate-300 text-slate-500 flex items-center justify-center mx-auto">
            <AlertCircle className="w-8 h-8" />
          </div>

          <div className="space-y-2">
            <h1 className="font-serif-heading text-2xl font-bold text-[#171B35]">
              Subject not found
            </h1>
            <p className="text-sm text-slate-600 leading-relaxed">
              The requested subject or note content does not exist or has not been published yet.
            </p>
          </div>

          <div className="pt-4">
            <Link
              to="/"
              className="inline-flex items-center justify-center gap-2 px-6 py-3 rounded-lg text-xs font-bold text-white bg-[#171B35] hover:bg-[#1E293B] transition-colors shadow-xs w-full"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>Back to Curriculum</span>
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      className={`min-h-screen flex flex-col transition-colors duration-200 max-w-full overflow-x-hidden ${
        isDarkMode ? 'dark bg-[#111329] text-slate-100' : 'bg-[#F8FAFC] text-slate-800'
      }`}
    >
      {/* 1. Reader Top Toolbar (Sticky, 360px mobile safe, zero horizontal scroll) */}
      <nav
        aria-label="Reader toolbar"
        className={`sticky top-16 z-30 px-2.5 sm:px-6 py-2 border-b transition-colors shadow-2xs w-full max-w-full overflow-x-hidden ${
          isDarkMode
            ? 'bg-[#12152E] border-slate-700/80 text-white'
            : 'bg-white border-[#DDE1F2] text-[#171B35]'
        }`}
      >
        <div className="max-w-7xl mx-auto flex items-center justify-between gap-1.5 sm:gap-3 w-full">
          {/* Left: Back & Outline Toggle Buttons */}
          <div className="flex items-center gap-1 sm:gap-2 shrink-0">
            <Link
              to={backUrl}
              className={`p-1.5 rounded transition-colors text-xs font-semibold flex items-center gap-1 shrink-0 ${
                isDarkMode
                  ? 'hover:bg-slate-800 text-slate-300'
                  : 'hover:bg-[#F0F1FA] text-[#6366F1]'
              }`}
              title="Back to Curriculum"
              aria-label="Back to Curriculum"
            >
              <ArrowLeft className="w-4 h-4 shrink-0" />
              <span className="hidden sm:inline">Back</span>
            </Link>

            {/* Desktop TOC Toggle */}
            <button
              type="button"
              onClick={() => setIsTocOpenDesktop(!isTocOpenDesktop)}
              className={`hidden md:inline-flex items-center gap-1.5 px-2.5 py-1 rounded text-xs font-medium transition-colors shrink-0 ${
                isDarkMode
                  ? 'bg-slate-800 hover:bg-slate-700 text-slate-200'
                  : 'bg-[#F0F1FA] hover:bg-[#DDE1F2] text-[#171B35]'
              }`}
              title={isTocOpenDesktop ? 'Collapse Table of Contents' : 'Expand Table of Contents'}
            >
              <BookOpen className="w-3.5 h-3.5 text-[#6366F1]" />
              <span>{isTocOpenDesktop ? 'Hide Outline' : 'Show Outline'}</span>
            </button>

            {/* Mobile TOC Drawer Trigger */}
            <button
              type="button"
              onClick={() => setIsTocOpenMobile(true)}
              className={`md:hidden p-1.5 rounded text-xs font-medium transition-colors shrink-0 ${
                isDarkMode
                  ? 'bg-slate-800 hover:bg-slate-700 text-slate-200'
                  : 'bg-[#F0F1FA] hover:bg-[#DDE1F2] text-[#171B35]'
              }`}
              aria-label="Open Table of Contents"
              title="Open Outline"
            >
              <Menu className="w-4 h-4 shrink-0 text-[#6366F1]" />
            </button>
          </div>

          {/* Center: Title & Sample Indicator */}
          <div className="flex items-center gap-2 text-xs shrink-0 max-w-[200px] sm:max-w-sm truncate">
            <span className="font-semibold truncate hidden lg:inline">
              {subject.name}
            </span>
            {subject.isFreeSample && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider rounded border border-amber-300 bg-amber-50 text-amber-800 shrink-0">
                <span>Free Sample</span>
              </span>
            )}
          </div>

          {/* Right: Typography Controls & Dark/Light Mode */}
          <div className="flex items-center gap-1 sm:gap-2 shrink-0">
            {/* Font Size Adjuster */}
            <div
              className={`flex items-center rounded border p-0.5 text-xs shrink-0 ${
                isDarkMode
                  ? 'border-slate-700 bg-slate-800 text-slate-200'
                  : 'border-slate-300 bg-slate-50 text-slate-700'
              }`}
            >
              <button
                type="button"
                onClick={decreaseFontSize}
                disabled={fontSizeLevel <= -1}
                className="w-6 h-6 flex items-center justify-center rounded font-bold hover:bg-black/10 disabled:opacity-30 disabled:cursor-not-allowed text-[11px]"
                title="Decrease font size"
                aria-label="Decrease font size"
              >
                A-
              </button>
              <span className="hidden sm:inline px-1 text-[11px] font-mono select-none font-medium">
                {fontSizeLevel === -1
                  ? 'Small'
                  : fontSizeLevel === 0
                  ? 'Normal'
                  : fontSizeLevel === 1
                  ? 'Large'
                  : 'XL'}
              </span>
              <button
                type="button"
                onClick={increaseFontSize}
                disabled={fontSizeLevel >= 2}
                className="w-6 h-6 flex items-center justify-center rounded font-bold hover:bg-black/10 disabled:opacity-30 disabled:cursor-not-allowed text-[11px]"
                title="Increase font size"
                aria-label="Increase font size"
              >
                A+
              </button>
            </div>

            {/* Dark / Light Toggle */}
            <button
              type="button"
              onClick={() => setIsDarkMode(!isDarkMode)}
              className={`p-1.5 rounded transition-colors border shrink-0 ${
                isDarkMode
                  ? 'bg-slate-800 hover:bg-slate-700 border-slate-700 text-amber-300'
                  : 'bg-slate-50 hover:bg-slate-100 border-slate-300 text-slate-700'
              }`}
              title={isDarkMode ? 'Switch to light mode' : 'Switch to dark mode'}
              aria-label={isDarkMode ? 'Switch to light mode' : 'Switch to dark mode'}
            >
              {isDarkMode ? <Sun className="w-4 h-4 shrink-0" /> : <Moon className="w-4 h-4 shrink-0" />}
            </button>
          </div>
        </div>
      </nav>

      {/* 2. Reader Main Body */}
      <div className="flex-1 max-w-7xl mx-auto w-full flex relative min-w-0">
        {/* Desktop Collapsible Table of Contents Sidebar */}
        {isTocOpenDesktop && (
          <aside
            className={`hidden md:block w-72 shrink-0 border-r py-8 px-5 sticky top-28 h-[calc(100vh-7rem)] overflow-y-auto transition-colors ${
              isDarkMode
                ? 'border-slate-800 bg-[#111329]/80'
                : 'border-[#DDE1F2] bg-white/40'
            }`}
          >
            <div className="space-y-6">
              <div>
                <span
                  className={`text-[10px] font-bold uppercase tracking-wider ${
                    isDarkMode ? 'text-[#818CF8]' : 'text-[#6366F1]'
                  }`}
                >
                  Table of Contents
                </span>
                <h3
                  className={`font-serif-heading text-sm font-bold mt-1 line-clamp-2 ${
                    isDarkMode ? 'text-white' : 'text-[#171B35]'
                  }`}
                >
                  {subject.name}
                </h3>
                <div
                  className={`flex items-center gap-1.5 text-[11px] mt-1 ${
                    isDarkMode ? 'text-slate-400' : 'text-[#4A5B70]'
                  }`}
                >
                  <Clock className="w-3 h-3" />
                  <span>{estimatedReadMinutes} min read</span>
                </div>
              </div>

              {tocList.length > 0 ? (
                <nav className="space-y-1 text-xs">
                  {tocList.map((item, idx) => {
                    const isActive = activeHeadingId === item.id;
                    return (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => scrollToSection(item.id)}
                        className={`w-full text-left py-1.5 px-2 rounded transition-colors font-medium flex items-start gap-2 cursor-pointer ${
                          item.level === 3
                            ? 'pl-4 text-[11px]'
                            : item.level === 4
                            ? 'pl-6 text-[10px]'
                            : ''
                        } ${
                          isActive
                            ? isDarkMode
                              ? 'bg-[#6366F1]/30 text-white font-bold border-l-2 border-[#6366F1]'
                              : 'bg-[#F0F1FA] text-[#171B35] font-bold border-l-2 border-[#6366F1]'
                            : isDarkMode
                            ? 'hover:bg-slate-800 text-slate-300 hover:text-white'
                            : 'hover:bg-[#F0F1FA] text-slate-700 hover:text-[#171B35]'
                        }`}
                      >
                        <span className="text-slate-400 font-mono text-[10px] shrink-0">
                          {idx + 1 < 10 ? `0${idx + 1}` : idx + 1}
                        </span>
                        <span className="leading-snug line-clamp-2">{item.text}</span>
                      </button>
                    );
                  })}
                </nav>
              ) : (
                <p className="text-xs text-slate-400 italic">No section headings found.</p>
              )}

              <div className="pt-4 border-t border-slate-300/40 dark:border-slate-800 text-[11px] text-slate-500 space-y-1">
                <div>Curriculum: {block ? block.name : 'KMU Modular Syllabus'}</div>
                {year && <div>Academic Year: {year.name}</div>}
                {contentMeta && contentMeta.partCount > 1 && (
                  <div className="text-[10px] text-slate-400 pt-1">
                    Continuous document: {loadedPartCount} of {contentMeta.partCount} parts loaded
                  </div>
                )}
              </div>
            </div>
          </aside>
        )}

        {/* Mobile Slide-Over Drawer for Table of Contents */}
        {isTocOpenMobile && (
          <div className="fixed inset-0 z-50 md:hidden flex">
            {/* Backdrop */}
            <div
              className="fixed inset-0 bg-black/50 backdrop-blur-2xs"
              onClick={() => setIsTocOpenMobile(false)}
            />

            {/* Drawer Panel */}
            <div className="relative w-72 max-w-[80vw] bg-[#171B35] text-white p-6 h-full flex flex-col justify-between overflow-y-auto shadow-xl">
              <div>
                <div className="flex items-center justify-between pb-4 border-b border-white/10 mb-4">
                  <div className="flex items-center gap-2">
                    <BookOpen className="w-4 h-4 text-[#6366F1]" />
                    <span className="font-serif-heading font-bold text-sm text-white">
                      Table of Contents
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setIsTocOpenMobile(false)}
                    className="p-1 rounded text-slate-400 hover:text-white"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>

                <div className="mb-4">
                  <h4 className="text-xs font-semibold text-slate-300 line-clamp-2">
                    {subject.name}
                  </h4>
                  <p className="text-[11px] text-slate-400 mt-0.5">
                    {block ? block.name : 'KMU Modular Syllabus'}
                  </p>
                </div>

                {tocList.length > 0 ? (
                  <nav className="space-y-1 text-xs">
                    {tocList.map((item, idx) => {
                      const isActive = activeHeadingId === item.id;
                      return (
                        <button
                          key={item.id}
                          type="button"
                          onClick={() => scrollToSection(item.id)}
                          className={`w-full text-left py-1.5 px-2 rounded transition-colors flex items-center gap-2 ${
                            item.level === 3 ? 'pl-4 text-[11px]' : item.level === 4 ? 'pl-6 text-[10px]' : ''
                          } ${
                            isActive
                              ? 'bg-[#6366F1] text-white font-bold'
                              : 'text-slate-300 hover:bg-white/10 hover:text-white'
                          }`}
                        >
                          <span className="text-[#6366F1] font-mono text-[10px] shrink-0">
                            {idx + 1 < 10 ? `0${idx + 1}` : idx + 1}
                          </span>
                          <span className="truncate">{item.text}</span>
                        </button>
                      );
                    })}
                  </nav>
                ) : (
                  <p className="text-xs text-slate-400 italic">No headings in note.</p>
                )}
              </div>

              <div className="pt-4 border-t border-white/10 text-[11px] text-slate-400">
                MEDIFY Reader · KMU Modular Syllabus
              </div>
            </div>
          </div>
        )}

        {/* Main Subject Note Content Area */}
        <main className="flex-1 py-8 px-4 sm:px-8 lg:px-12 max-w-4xl mx-auto w-full min-w-0">
          {/* Header Metadata */}
          <header className="mb-8 pb-6 border-b border-slate-300 dark:border-slate-800">
            {/* Subject / Block breadcrumb */}
            <div className="mb-2 flex items-center gap-1.5 text-xs font-bold text-[#6366F1] uppercase tracking-wider">
              <span>{year ? year.name : 'MBBS'}</span>
              <span>·</span>
              <span>{block ? block.name : 'Modular Syllabus'}</span>
            </div>

            {/* Subject Title */}
            <h1
              className={`font-serif-heading text-2xl sm:text-4xl font-bold tracking-tight mb-3 break-words hyphens-auto ${
                isDarkMode ? 'text-white' : 'text-[#171B35]'
              }`}
            >
              {subject.name}
            </h1>

            {/* Metadata Line */}
            <div
              className={`flex flex-wrap items-center gap-x-2.5 gap-y-1 text-xs font-medium ${
                isDarkMode ? 'text-slate-300' : 'text-[#4A5B70]'
              }`}
            >
              <span>KMU Modular Syllabus</span>
              <span className={isDarkMode ? 'text-slate-600' : 'text-[#4A5B70]/60'}>·</span>
              <span>{block ? block.name : 'Integrated Notes'}</span>
              <span className={isDarkMode ? 'text-slate-600' : 'text-[#4A5B70]/60'}>·</span>
              <span>{estimatedReadMinutes} min read</span>
              {subject.isFreeSample && (
                <>
                  <span className={isDarkMode ? 'text-slate-600' : 'text-[#4A5B70]/60'}>·</span>
                  <span className="text-amber-600 dark:text-amber-400 font-semibold">
                    Free Sample
                  </span>
                </>
              )}
            </div>
          </header>

          {/* Sequential Render of Parts */}
          <article className={`space-y-6 ${getProseFontSizeClass()}`}>
            {combinedHtml ? (
              <>
                <NoteBody
                  html={combinedHtml}
                  subjectId={subjectId || ''}
                  userId={user?.uid}
                  watermarkText={user ? `${user.email} · MEDIFY` : 'MEDIFY free sample'}
                  allLoaded={Boolean(contentMeta) && loadedPartCount >= (contentMeta?.partCount || 0)}
                  isDark={isDarkMode}
                />

                {/* Background parts loading skeleton placeholder */}
                {loadingParts && contentMeta && loadedPartCount < contentMeta.partCount && (
                  <div className="pt-8 pb-12 space-y-4 border-t border-dashed border-slate-300 dark:border-slate-800 animate-pulse">
                    <div className="flex items-center gap-2 text-xs font-semibold text-[#6366F1]">
                      <Layers className="w-4 h-4 animate-spin" />
                      <span>
                        Loading remaining sections (Part {loadedPartCount + 1} of {contentMeta.partCount})...
                      </span>
                    </div>
                    <div className="h-4 w-full bg-slate-200 dark:bg-slate-800 rounded" />
                    <div className="h-4 w-5/6 bg-slate-200 dark:bg-slate-800 rounded" />
                    <div className="h-4 w-4/6 bg-slate-200 dark:bg-slate-800 rounded" />
                  </div>
                )}
              </>
            ) : (
              <div className="p-8 text-center bg-white dark:bg-slate-900 rounded-xl border border-dashed border-slate-300 dark:border-slate-700">
                <FileText className="w-8 h-8 text-slate-400 mx-auto mb-2" />
                <p className="text-sm text-slate-500">
                  This subject note does not have content uploaded yet.
                </p>
                {isAdmin && (
                  <Link
                    to="/admin"
                    className="mt-3 inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-white bg-[#6366F1] hover:bg-[#4F46E5] rounded transition-colors"
                  >
                    <span>Upload Word (.docx) content in Admin</span>
                    <ChevronRight className="w-3.5 h-3.5" />
                  </Link>
                )}
              </div>
            )}
          </article>
        </main>
      </div>
    </div>
  );
}
