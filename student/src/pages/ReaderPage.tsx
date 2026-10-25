import { useState, useEffect, useMemo, useRef } from 'react';
import '../notesReader.css';
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

  // The notes scroll inside their own pane (not the whole page)
  const scrollRef = useRef<HTMLElement | null>(null);
  const progressRef = useRef<HTMLDivElement | null>(null);
  const tocScrollRef = useRef<HTMLDivElement | null>(null);

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

  // ScrollSpy: highlight the current heading while the notes pane scrolls
  useEffect(() => {
    const root = scrollRef.current;
    if (tocList.length === 0 || !root) return;

    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries.find((e) => e.isIntersecting);
        if (visible && visible.target.id) {
          setActiveHeadingId(visible.target.id);
        }
      },
      { root, rootMargin: '0px 0px -75% 0px', threshold: 0 }
    );

    tocList.forEach((item) => {
      const el = document.getElementById(item.id);
      if (el) observer.observe(el);
    });

    return () => observer.disconnect();
  }, [tocList, combinedHtml]);

  // Keep the active chapter visible inside the chapter list
  useEffect(() => {
    const list = tocScrollRef.current;
    if (!list || !activeHeadingId) return;
    const btn = list.querySelector<HTMLElement>('[data-toc-active="true"]');
    if (!btn) return;
    const top = btn.offsetTop - list.offsetTop;
    if (top < list.scrollTop + 40 || top + btn.offsetHeight > list.scrollTop + list.clientHeight - 40) {
      list.scrollTo({ top: Math.max(0, top - list.clientHeight / 3), behavior: 'smooth' });
    }
  }, [activeHeadingId]);

  const onNotesScroll = () => {
    const el = scrollRef.current;
    const bar = progressRef.current;
    if (!el || !bar) return;
    const max = el.scrollHeight - el.clientHeight;
    bar.style.width = `${max > 0 ? Math.min(100, Math.max(0, (el.scrollTop / max) * 100)) : 0}%`;
  };

  // Font size mapping
  const getProseFontSizeClass = () => {
    switch (fontSizeLevel) {
      case -1:
        return 'nr-fs-sm';
      case 1:
        return 'nr-fs-lg';
      case 2:
        return 'nr-fs-xl';
      case 0:
      default:
        return 'nr-fs-md';
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
        <div className="h-14 bg-white border-b border-[#cfdbe5] px-6 flex items-center justify-between">
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
            <span className="text-[11px] font-bold uppercase tracking-wider text-[#1b8e8e]">
              Package Restricted
            </span>
            <h1 className="font-serif-heading text-2xl font-bold text-[#0f2837]">
              Note Not in Your Package
            </h1>
            <p className="text-sm text-slate-600 leading-relaxed">
              Your active MEDIFY package is for <strong className="text-[#0f2837]">{studentAccess?.purchasedYearName}</strong>.
              This note ({subject.name}) belongs to <strong className="text-[#0f2837]">{year?.name || 'another academic year'}</strong>.
              Only notes for your purchased academic year are unlocked in your library.
            </p>
          </div>

          <div className="pt-4 space-y-2.5">
            <Link
              to={studentAccess?.purchasedYearId ? `/year/${studentAccess.purchasedYearId}` : '/#years'}
              className="inline-flex items-center justify-center gap-2 px-6 py-3 rounded-lg text-xs font-bold text-white bg-[#1b8e8e] hover:bg-[#147273] transition-colors shadow-xs w-full"
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
        <div className="max-w-md w-full bg-white rounded-2xl border border-[#cfdbe5] shadow-lg p-8 sm:p-10 space-y-5">
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
            <span className="text-[11px] font-bold uppercase tracking-wider text-[#1b8e8e]">
              {isRejectedApproval
                ? 'Approval Declined'
                : isPendingApproval
                ? 'Approval Pending'
                : 'Subscriber Access Required'}
            </span>
            <h1 className="font-serif-heading text-2xl font-bold text-[#0f2837]">
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
                  className="inline-flex items-center justify-center gap-2 px-6 py-3 rounded-lg text-xs font-bold text-white bg-[#1b8e8e] hover:bg-[#147273] transition-colors shadow-xs w-full"
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
                className="inline-flex items-center justify-center gap-2 px-6 py-3 rounded-lg text-xs font-bold text-white bg-[#1b8e8e] hover:bg-[#147273] transition-colors shadow-xs w-full"
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
        <div className="max-w-md w-full bg-white rounded-2xl border border-[#cfdbe5] shadow-lg p-8 sm:p-10 space-y-5">
          <div className="w-16 h-16 rounded-full bg-slate-100 border border-slate-300 text-slate-500 flex items-center justify-center mx-auto">
            <AlertCircle className="w-8 h-8" />
          </div>

          <div className="space-y-2">
            <h1 className="font-serif-heading text-2xl font-bold text-[#0f2837]">
              Subject not found
            </h1>
            <p className="text-sm text-slate-600 leading-relaxed">
              The requested subject or note content does not exist or has not been published yet.
            </p>
          </div>

          <div className="pt-4">
            <Link
              to="/"
              className="inline-flex items-center justify-center gap-2 px-6 py-3 rounded-lg text-xs font-bold text-white bg-[#0f2837] hover:bg-[#1E293B] transition-colors shadow-xs w-full"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>Back to Curriculum</span>
            </Link>
          </div>
        </div>
      </div>
    );
  }

  const fontLabel = ['Small', 'Normal', 'Large', 'XL'][fontSizeLevel + 1];

  const renderToc = () => (
    <>
      <div className="nr-toc-head">
        <span className="nr-toc-kicker">Chapters · {tocList.length}</span>
        <h3 className="nr-toc-title">{subject.name}</h3>
        <div className="nr-toc-meta">
          <Clock className="w-3 h-3" />
          <span>{estimatedReadMinutes} min read</span>
        </div>
      </div>

      <div className="nr-toc-list" ref={tocScrollRef}>
        {tocList.length > 0 ? (
          tocList.map((item, idx) => {
            const isActive = activeHeadingId === item.id;
            return (
              <button
                key={item.id}
                type="button"
                data-toc-active={isActive ? 'true' : undefined}
                onClick={() => scrollToSection(item.id)}
                className={`nr-toc-item nr-lvl-${Math.min(Math.max(item.level, 2), 4)} ${isActive ? 'is-active' : ''}`}
              >
                <span className="nr-toc-num">{idx + 1 < 10 ? `0${idx + 1}` : idx + 1}</span>
                <span className="nr-toc-text">{item.text}</span>
              </button>
            );
          })
        ) : (
          <p className="nr-toc-empty">No section headings found.</p>
        )}
      </div>

      <div className="nr-toc-foot">
        <div>{block ? block.name : 'KMU Modular Syllabus'}</div>
        {year && <div>{year.name}</div>}
        {contentMeta && contentMeta.partCount > 1 && (
          <div>
            {loadedPartCount} of {contentMeta.partCount} parts loaded
          </div>
        )}
      </div>
    </>
  );

  return (
    <div className={`nr-root ${isDarkMode ? 'dark' : ''}`} data-theme={isDarkMode ? 'dark' : 'light'}>
      {/* Compact top bar */}
      <header className="nr-top" aria-label="Reader toolbar">
        <div className="nr-top-left">
          <Link to={backUrl} className="nr-btn" title="Back to Curriculum" aria-label="Back to Curriculum">
            <ArrowLeft className="w-4 h-4" />
            <span className="nr-hide-sm">Back</span>
          </Link>
          <button
            type="button"
            onClick={() => setIsTocOpenDesktop(!isTocOpenDesktop)}
            className={`nr-btn nr-desktop-only ${isTocOpenDesktop ? 'is-on' : ''}`}
            title={isTocOpenDesktop ? 'Hide chapters' : 'Show chapters'}
            aria-pressed={isTocOpenDesktop}
          >
            <BookOpen className="w-4 h-4" />
            <span>Chapters</span>
          </button>
          <button
            type="button"
            onClick={() => setIsTocOpenMobile(true)}
            className="nr-btn nr-mobile-only"
            aria-label="Open chapters"
            title="Chapters"
          >
            <Menu className="w-4 h-4" />
          </button>
        </div>

        <div className="nr-top-title">
          <strong>{subject.name}</strong>
          <small>
            {year ? year.name : 'MBBS'} · {block ? block.name : 'Modular Syllabus'} · {estimatedReadMinutes} min
          </small>
        </div>

        <div className="nr-top-right">
          {subject.isFreeSample && <span className="nr-badge">Free Sample</span>}
          <div className="nr-group" title={`Text size: ${fontLabel}`}>
            <button
              type="button"
              onClick={decreaseFontSize}
              disabled={fontSizeLevel <= -1}
              className="nr-btn nr-btn-sq"
              title="Decrease font size"
              aria-label="Decrease font size"
            >
              A-
            </button>
            <button
              type="button"
              onClick={increaseFontSize}
              disabled={fontSizeLevel >= 2}
              className="nr-btn nr-btn-sq"
              title="Increase font size"
              aria-label="Increase font size"
            >
              A+
            </button>
          </div>
          <button
            type="button"
            onClick={() => setIsDarkMode(!isDarkMode)}
            className="nr-btn nr-btn-sq"
            title={isDarkMode ? 'Switch to light mode' : 'Switch to dark mode'}
            aria-label={isDarkMode ? 'Switch to light mode' : 'Switch to dark mode'}
          >
            {isDarkMode ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
          </button>
        </div>
        <div className="nr-progress" aria-hidden="true">
          <div ref={progressRef} className="nr-progress-bar" />
        </div>
      </header>

      <div className="nr-body">
        {/* Desktop chapter list: full height, scrolls on its own */}
        {isTocOpenDesktop && <aside className="nr-toc nr-desktop-only">{renderToc()}</aside>}

        {/* Mobile chapter drawer */}
        {isTocOpenMobile && (
          <div className="nr-drawer nr-mobile-only" role="dialog" aria-label="Chapters">
            <button
              type="button"
              className="nr-drawer-backdrop"
              aria-label="Close chapters"
              onClick={() => setIsTocOpenMobile(false)}
            />
            <aside className="nr-toc nr-toc-drawer">
              <button
                type="button"
                className="nr-drawer-close"
                onClick={() => setIsTocOpenMobile(false)}
                aria-label="Close chapters"
              >
                <X className="w-4 h-4" />
              </button>
              {renderToc()}
            </aside>
          </div>
        )}

        {/* Notes: only this pane scrolls */}
        <main className="nr-scroll" data-reader-scroll ref={scrollRef} onScroll={onNotesScroll}>
          <div className="nr-page">
            <div className="nr-doc-head">
              <span className="nr-crumb">
                {year ? year.name : 'MBBS'} · {block ? block.name : 'Modular Syllabus'}
              </span>
              <h1>{subject.name}</h1>
            </div>

            <article className={`nr-article ${getProseFontSizeClass()}`}>
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

                  {loadingParts && contentMeta && loadedPartCount < contentMeta.partCount && (
                    <div className="nr-loading">
                      <Layers className="w-4 h-4 animate-spin" />
                      <span>
                        Loading remaining sections (Part {loadedPartCount + 1} of {contentMeta.partCount})...
                      </span>
                    </div>
                  )}
                </>
              ) : (
                <div className="nr-empty">
                  <FileText className="w-8 h-8 mx-auto mb-2" />
                  <p>This subject note does not have content uploaded yet.</p>
                  {isAdmin && (
                    <Link to="/admin" className="nr-admin-link">
                      <span>Upload Word (.docx) content in Admin</span>
                      <ChevronRight className="w-3.5 h-3.5" />
                    </Link>
                  )}
                </div>
              )}
            </article>
          </div>
        </main>
      </div>
    </div>
  );
}
