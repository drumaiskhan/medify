import {PaymentProof} from '../../components/PaymentProof';
import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Link } from 'react-router-dom';
import {
  FolderPlus,
  Upload,
  AlertCircle,
  CheckCircle2,
  RefreshCw,
  Sparkles,
  BookOpen,
  Info,
  Plus,
  FileText,
  AlertTriangle,
  CreditCard,
  Building2,
  Smartphone,
  Check,
  X,
  Clock,
  CheckCircle,
  XCircle,
  ShieldCheck,
  ShieldAlert,
  Shield,
  Copy,
  ExternalLink,
  MessageCircle,
  Receipt,
  UserCheck,
  UserX,
  Users,
  GraduationCap
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import {
  YearDoc,
  BlockDoc,
  SubjectDoc,
  getAllYearsAdmin,
  getAllBlocksAdmin,
  getAllSubjectsAdmin,
  createYear,
  saveSubjectNoteWithHierarchy,
  updateSubjectFlags,
  renameSubject,
  updateBlock,
  slugify
} from '../../services/curriculum';
import {
  getSubjectContent,
  SubjectContentDoc
} from '../../services/notes';
import {
  convertAndProcessSubjectDocx,
  ProcessedSubjectDocx,
  prepareHtmlForReader
} from '../../utils/docxProcessor';
import { hydrateNoteImages } from '../../utils/noteImages';
import {
  getPaymentDetails,
  savePaymentDetails,
  getAllPaymentRequestsAdmin,
  updatePaymentRequestStatus,
  getAllStudentSignupsAdmin,
  approveStudentAccount,
  rejectStudentAccount,
  getPaymentMethodLabel,
  isValidWhatsAppNumber,
  PaymentDetailsDoc,
  PaymentRequestDoc,
  StudentSignupDoc
} from '../../services/payments';



interface Toast {
  id: string;
  type: 'success' | 'error' | 'info';
  message: string;
}

export function AdminPage({section='year'}:{section?:'year'|'notes'|'settings'|'payments'}) {
  const { user } = useAuth();

  // Navigation / Tabs (Tabs on mobile & desktop)
  const [activeTab, setActiveTab] = useState<'year' | 'notes' | 'settings' | 'payments'>(section);

  // Shared Curriculum State
  const [years, setYears] = useState<YearDoc[]>([]);
  const [blocks, setBlocks] = useState<BlockDoc[]>([]);
  const [subjects, setSubjects] = useState<SubjectDoc[]>([]);
  const [loadingCurriculum, setLoadingCurriculum] = useState<boolean>(true);

  // database Rules Guide modal
  const [showRulesModal, setShowRulesModal] = useState<boolean>(false);
  const [copiedRules, setCopiedRules] = useState<boolean>(false);

  // Toasts
  const [toasts, setToasts] = useState<Toast[]>([]);
  const addToast = (type: 'success' | 'error' | 'info', message: string) => {
    const id = `${Date.now()}-${Math.random()}`;
    setToasts((prev) => [...prev, { id, type, message }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 4500);
  };

  // =========================================================================
  // SECTION 1: ADD YEAR STATE
  // =========================================================================
  const [yearName, setYearName] = useState<string>('');
  const [yearStatus, setYearStatus] = useState<'available' | 'coming-soon'>('available');
  const [yearOrder, setYearOrder] = useState<number>(10);
  const [yearPublished, setYearPublished] = useState<boolean>(true);
  const [isSavingYear, setIsSavingYear] = useState<boolean>(false);
  const [yearError, setYearError] = useState<string | null>(null);

  // Computed slug for new year preview
  const previewYearSlug = useMemo(() => {
    return slugify(yearName);
  }, [yearName]);

  // Load curriculum from database
  const loadCurriculum = async () => {
    setLoadingCurriculum(true);
    try {
      const [y, b, s] = await Promise.all([
        getAllYearsAdmin(),
        getAllBlocksAdmin(),
        getAllSubjectsAdmin()
      ]);
      setYears(y);
      setBlocks(b);
      setSubjects(s);

      // Auto-set reasonable default order for Add Year
      if (y.length > 0) {
        const maxOrder = Math.max(...y.map((item) => item.order || 0));
        setYearOrder(maxOrder + 10);
      } else {
        setYearOrder(10);
      }
    } catch (err: any) {
      console.error('Failed to load curriculum:', err);
      addToast('error', `Could not load curriculum data: ${err.message}`);
    } finally {
      setLoadingCurriculum(false);
    }
  };

  useEffect(() => {
    loadCurriculum();
  }, []);

  // Handle Create Year submit
  const handleCreateYear = async (e: React.FormEvent) => {
    e.preventDefault();
    setYearError(null);

    const trimmed = yearName.trim();
    if (!trimmed) {
      setYearError('Please enter a year name.');
      return;
    }

    const slug = slugify(trimmed);
    if (!slug) {
      setYearError('Could not generate a valid identifier from this name.');
      return;
    }

    // Check if slug already exists locally before calling backend
    if (years.some((y) => y.id === slug)) {
      setYearError(`A year with ID "${slug}" already exists. Please choose a distinct name.`);
      addToast('error', `A year with ID "${slug}" already exists.`);
      return;
    }

    setIsSavingYear(true);
    try {
      await createYear({
        name: trimmed,
        status: yearStatus,
        order: Number(yearOrder),
        published: Boolean(yearPublished)
      });

      addToast('success', `Created year "${trimmed}" with ID "${slug}".`);
      setYearName('');
      // Refresh curriculum
      await loadCurriculum();
    } catch (err: any) {
      console.error('Failed to create year:', err);
      setYearError(err.message || 'Failed to create year.');
      addToast('error', err.message || 'Failed to create year.');
    } finally {
      setIsSavingYear(false);
    }
  };

  // =========================================================================
  // SECTION 2: UPLOAD FULL SUBJECT (DOCX) STATE
  // =========================================================================
  const [selectedYearId, setSelectedYearId] = useState<string>('');
  const [selectedBlockId, setSelectedBlockId] = useState<string>('');
  const [newBlockName, setNewBlockName] = useState<string>('');
  const [selectedSubjectId, setSelectedSubjectId] = useState<string>('');

  // Subject flags
  const [subjectPublished, setSubjectPublished] = useState<boolean>(true);
  const [subjectIsFreeSample, setSubjectIsFreeSample] = useState<boolean>(false);
  const [isUpdatingFlags, setIsUpdatingFlags] = useState<boolean>(false);

  // Content & conversion state
  const [existingContent, setExistingContent] = useState<SubjectContentDoc | null>(null);
  const [loadingContent, setLoadingContent] = useState<boolean>(false);
  const [convertedSubjectId, setConvertedSubjectId] = useState('');
  const [processedDocx, setProcessedDocx] = useState<ProcessedSubjectDocx | null>(null);
  const [conversionError, setConversionError] = useState<string | null>(null);
  const [fileName, setFileName] = useState<string>('');
  const [isConverting, setIsConverting] = useState<boolean>(false);
  const [isSavingSubject, setIsSavingSubject] = useState<boolean>(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Set default selected year when years load
  useEffect(() => {
    if (!selectedYearId && years.length > 0) {
      // Open on the first year that already has modules (e.g. 2nd Year), not an empty one.
      const firstWithModules = years.find((y) => blocks.some((b) => b.yearId === y.id));
      setSelectedYearId((firstWithModules || years[0]).id);
    }
  }, [years, blocks, selectedYearId]);

  // Blocks filtered by selected year
  const availableBlocks = useMemo(() => {
    if (!selectedYearId) return [];
    return blocks.filter((b) => b.yearId === selectedYearId);
  }, [blocks, selectedYearId]);

  // Nothing is open until a module is clicked. Changing year closes the open module.
  useEffect(() => {
    if (selectedBlockId && selectedBlockId !== '__new__' && !availableBlocks.some((b) => b.id === selectedBlockId)) {
      setSelectedBlockId('');
    }
  }, [availableBlocks, selectedBlockId]);

  // The upload panel opens below the module cards; bring it into view when a module is clicked.
  const uploadPanelRef = useRef<HTMLDivElement | null>(null);

  // Active module (block) document, if an existing module is selected
  const currentBlock = useMemo(() => {
    if (!selectedBlockId || selectedBlockId === '__new__') return null;
    return blocks.find((b) => b.id === selectedBlockId) || null;
  }, [blocks, selectedBlockId]);

  // Module settings (rename / show-hide)
  const [moduleNameDraft, setModuleNameDraft] = useState<string>('');
  const [isSavingModule, setIsSavingModule] = useState<boolean>(false);
  useEffect(() => {
    setModuleNameDraft(currentBlock?.name || '');
  }, [currentBlock?.id, currentBlock?.name]);

  const showUploadPanel = Boolean(currentBlock) || (selectedBlockId === '__new__' && newBlockName.trim().length > 0);
  useEffect(() => {
    if (selectedBlockId && selectedBlockId !== '__new__') {
      window.setTimeout(() => uploadPanelRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 60);
    }
  }, [selectedBlockId]);

  const handleRenameModule = async () => {
    if (!currentBlock) return;
    const name = moduleNameDraft.trim();
    if (!name || name === currentBlock.name) return;
    setIsSavingModule(true);
    try {
      await updateBlock(currentBlock.id, { name });
      setBlocks((prev) => prev.map((b) => (b.id === currentBlock.id ? { ...b, name } : b)));
      // The module's note carries the module's name; keep them together.
      const sameName = subjects.filter((x) => x.blockId === currentBlock.id && x.name === currentBlock.name);
      for (const x of sameName) await renameSubject(x.id, name);
      if (sameName.length) {
        setSubjects((prev) => prev.map((x) => (sameName.some((n) => n.id === x.id) ? { ...x, name } : x)));
      }
      addToast('success', `Module renamed to "${name}".`);
    } catch (err: any) {
      addToast('error', `Could not rename module: ${err.message || 'Unknown error'}`);
    } finally {
      setIsSavingModule(false);
    }
  };

  const handleToggleModuleVisible = async () => {
    if (!currentBlock) return;
    const next = !currentBlock.published;
    setIsSavingModule(true);
    try {
      await updateBlock(currentBlock.id, { published: next });
      setBlocks((prev) => prev.map((b) => (b.id === currentBlock.id ? { ...b, published: next } : b)));
      addToast('success', `${currentBlock.name} is now ${next ? 'visible to' : 'hidden from'} students.`);
    } catch (err: any) {
      addToast('error', `Could not update module: ${err.message || 'Unknown error'}`);
    } finally {
      setIsSavingModule(false);
    }
  };

  // Subjects filtered by selected block
  const availableSubjects = useMemo(() => {
    if (!selectedBlockId || selectedBlockId === '__new__') return [];
    return subjects.filter((s) => s.blockId === selectedBlockId);
  }, [subjects, selectedBlockId]);

  // Each module holds one set of notes. It is picked automatically: the module's existing note,
  // or a new one (named like the module) created on the first save.
  useEffect(() => {
    if (selectedBlockId === '__new__' || availableSubjects.length === 0) {
      setSelectedSubjectId('__new__');
    } else if (!availableSubjects.some((s) => s.id === selectedSubjectId)) {
      setSelectedSubjectId(availableSubjects[0].id);
    }
  }, [availableSubjects, selectedBlockId, selectedSubjectId]);

  // Reset the file when a different module is opened
  useEffect(() => {
    setProcessedDocx(null);
    setConversionError(null);
    setFileName('');
  }, [selectedBlockId]);

  // Active selected subject document (if existing)
  const currentSubject = useMemo(() => {
    if (selectedSubjectId === '__new__' || !selectedSubjectId) return null;
    return subjects.find((s) => s.id === selectedSubjectId) || null;
  }, [subjects, selectedSubjectId]);

  // Sync flags when existing subject selected
  useEffect(() => {
    if (currentSubject) {
      setSubjectPublished(currentSubject.published);
      setSubjectIsFreeSample(Boolean(currentSubject.isFreeSample));
    } else {
      setSubjectPublished(true);
      setSubjectIsFreeSample(false);
    }
  }, [currentSubject]);

  // Load existing content when selected subject changes
  useEffect(() => {
    if (!selectedSubjectId || selectedSubjectId === '__new__') {
      setExistingContent(null);
      setProcessedDocx(null);
      setConversionError(null);
      setFileName('');
      return;
    }

    let isCancelled = false;
    setLoadingContent(true);
    setConversionError(null);

    getSubjectContent(selectedSubjectId)
      .then((content) => {
        if (isCancelled) return;
        setExistingContent(content);
        // First upload into an empty note: publish by default so students and admin can see it.
        if (!content) setSubjectPublished(true);
      })
      .catch((err) => {
        if (isCancelled) return;
        console.error('Failed to load existing subject content:', err);
        setExistingContent(null);
      })
      .finally(() => {
        if (!isCancelled) {
          setLoadingContent(false);
        }
      });

    return () => {
      isCancelled = true;
    };
  }, [selectedSubjectId]);

  // Preview images are private: load them with the administrator's session.
  const previewRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    const el = previewRef.current;
    if (!el || !processedDocx) return;
    return hydrateNoteImages(el);
  }, [processedDocx]);

  // In-browser Mammoth DOCX conversion and node partitioning
  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.name.toLowerCase().endsWith('.docx')) {
      addToast('error', 'Please select a valid Word document (.docx).');
      return;
    }

    setFileName(file.name);
    setIsConverting(true);
    setProcessedDocx(null);
    setConversionError(null);

    try {
      const targetBlockId=currentBlock?.id || (selectedYearId && newBlockName.trim() ? `${selectedYearId}-${slugify(newBlockName.trim())}` : '');
      const targetName=(currentBlock?.name || newBlockName).trim();
      const targetSubjectId=currentSubject?.id || (targetBlockId && targetName ? `${targetBlockId}-${slugify(targetName)}` : '');
      if(!targetSubjectId)throw new Error('Select the academic year and module before uploading a Word file.');
      const result = await convertAndProcessSubjectDocx(file, targetSubjectId);
      setProcessedDocx(result);
      setConvertedSubjectId(targetSubjectId);
      addToast(
        'success',
        `Converted "${file.name}" successfully: ${result.totalSizeKb} KB in ${result.partCount} part${
          result.partCount > 1 ? 's' : ''
        }.`
      );
    } catch (err: any) {
      console.error('DOCX conversion failed:', err);
      const msg = err.message || 'Failed to read and parse the Word file.';
      setConversionError(msg);
      setProcessedDocx(null);
      addToast('error', msg);
    } finally {
      setIsConverting(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  // Toggle subject flag immediately if existing subject is selected
  const handleImmediateToggleFlag = async (field: 'published' | 'isFreeSample') => {
    if (!currentSubject) {
      if (field === 'published') setSubjectPublished(!subjectPublished);
      if (field === 'isFreeSample') setSubjectIsFreeSample(!subjectIsFreeSample);
      return;
    }

    setIsUpdatingFlags(true);
    const newValue = field === 'published' ? !subjectPublished : !subjectIsFreeSample;
    if (field === 'published') setSubjectPublished(newValue);
    if (field === 'isFreeSample') setSubjectIsFreeSample(newValue);

    try {
      await updateSubjectFlags(currentSubject.id, { [field]: newValue });
      addToast(
        'success',
        `Updated ${field === 'published' ? 'published status' : 'free sample status'} for ${currentSubject.name}.`
      );
      // Update local state in subjects list
      setSubjects((prev) =>
        prev.map((s) => (s.id === currentSubject.id ? { ...s, [field]: newValue } : s))
      );
    } catch (err: any) {
      console.error('Failed to update subject flag:', err);
      addToast('error', `Failed to update flag: ${err.message}`);
      // Revert on failure
      if (field === 'published') setSubjectPublished(!newValue);
      if (field === 'isFreeSample') setSubjectIsFreeSample(!newValue);
    } finally {
      setIsUpdatingFlags(false);
    }
  };

  // Handle Save Subject Note
  const handleSaveSubject = async () => {
    if (!selectedYearId) {
      addToast('error', 'Please select a Year.');
      return;
    }

    if (!processedDocx || processedDocx.parts.length === 0) {
      addToast('error', 'Please select and convert a Word (.docx) file first.');
      return;
    }

    // Validate new item names if selected
    const isNewBlock = selectedBlockId === '__new__';
    const isNewSubject = selectedSubjectId === '__new__';

    if (isNewBlock && !newBlockName.trim()) {
      addToast('error', 'Please enter a name for the new module.');
      return;
    }
    const noteTitle = (isNewBlock ? newBlockName : currentBlock?.name || '').trim();
    if (isNewSubject && !noteTitle) {
      addToast('error', 'Open a module first.');
      return;
    }

    const finalBlockId = isNewBlock ? `${selectedYearId}-${slugify(newBlockName.trim())}` : selectedBlockId;
    const finalSubjectId = isNewSubject ? `${finalBlockId}-${slugify(noteTitle)}` : selectedSubjectId;
    if (convertedSubjectId !== finalSubjectId) {
      addToast('error', 'The destination changed. Please upload the Word file again for this module.');
      return;
    }
    setIsSavingSubject(true);

    try {
      const res = await saveSubjectNoteWithHierarchy({
        yearId: selectedYearId,
        blockId: isNewBlock ? undefined : selectedBlockId,
        newBlockName: isNewBlock ? newBlockName.trim() : undefined,
        subjectId: isNewSubject ? undefined : selectedSubjectId,
        newSubjectName: isNewSubject ? noteTitle : undefined,
        published: subjectPublished,
        isFreeSample: subjectIsFreeSample,
        parts: processedDocx.parts,
        toc: processedDocx.toc,
        totalBytes: processedDocx.totalBytes,
        oldPartCount: existingContent?.partCount
      });

      addToast(
        'success',
        `Note saved to the module! "${res.subjectId}" (${processedDocx.totalSizeKb} KB in ${res.partCount} part${
          res.partCount > 1 ? 's' : ''
        }).`
      );

      // Reset new input fields if they were used
      if (isNewBlock) setNewBlockName('');

      // Refresh curriculum data from database
      await loadCurriculum();

      // Ensure newly saved subject is selected and its content is updated
      setSelectedBlockId(res.blockId);
      setSelectedSubjectId(res.subjectId);
      setProcessedDocx(null);
      setFileName('');

      // Reload content for this subject
      const freshContent = await getSubjectContent(res.subjectId);
      setExistingContent(freshContent);
    } catch (err: any) {
      console.error('Failed to save subject note:', err);
      addToast('error', `Failed to save note: ${err.message || 'Unknown error'}`);
    } finally {
      setIsSavingSubject(false);
    }
  };

  // =========================================================================
  // SECTION 3: PLANS & PAYMENT DETAILS STATE
  // =========================================================================
  const [jazzcashTitle, setJazzcashTitle] = useState<string>('');
  const [jazzcashNumber, setJazzcashNumber] = useState<string>('');
  const [meezanBankName, setMeezanBankName] = useState<string>('Meezan Bank');
  const [meezanBranch, setMeezanBranch] = useState<string>('');
  const [meezanTitle, setMeezanTitle] = useState<string>('');
  const [meezanNumber, setMeezanNumber] = useState<string>('');
  const [meezanIban, setMeezanIban] = useState<string>('');
  const [whatsappNumber, setWhatsappNumber] = useState<string>('');
  const [paymentInstructions, setPaymentInstructions] = useState<string>('');
  const [loadingPaymentDetails, setLoadingPaymentDetails] = useState<boolean>(false);
  const [isSavingPaymentDetails, setIsSavingPaymentDetails] = useState<boolean>(false);
  const [paymentFormError, setPaymentFormError] = useState<string | null>(null);

  // =========================================================================
  // SECTION 4: STUDENT PAYMENTS & SIGNUPS MANAGEMENT STATE
  // =========================================================================
  const [adminPayments, setAdminPayments] = useState<PaymentRequestDoc[]>([]);
  const [loadingAdminPayments, setLoadingAdminPayments] = useState<boolean>(false);
  const [updatingPaymentId, setUpdatingPaymentId] = useState<string | null>(null);
  const [paymentFilter, setPaymentFilter] = useState<'ALL' | 'PENDING' | 'VERIFIED' | 'REJECTED'>('ALL');

  // Student signups approval state
  const [studentSignups, setStudentSignups] = useState<StudentSignupDoc[]>([]);
  const [loadingSignups, setLoadingSignups] = useState<boolean>(false);
  const [signupFilter, setSignupFilter] = useState<'ALL' | 'PENDING' | 'APPROVED' | 'REJECTED'>('PENDING');
  const [section4SubTab, setSection4SubTab] = useState<'signups' | 'transactions'>('signups');
  const [processingStudentId, setProcessingStudentId] = useState<string | null>(null);

  // Rejection modal state
  const [rejectingStudent, setRejectingStudent] = useState<StudentSignupDoc | null>(null);
  const [rejectReason, setRejectReason] = useState<string>('');

  // Load payment settings from settings/paymentDetails
  const loadPaymentSettings = async () => {
    setLoadingPaymentDetails(true);
    setPaymentFormError(null);
    try {
      const details = await getPaymentDetails();
      setJazzcashTitle(details.jazzcash?.accountTitle || '');
      setJazzcashNumber(details.jazzcash?.number || '');
      setMeezanBankName(details.meezan?.bankName || 'Meezan Bank');
      setMeezanBranch(details.meezan?.branch || '');
      setMeezanTitle(details.meezan?.accountTitle || '');
      setMeezanNumber(details.meezan?.accountNumber || '');
      setMeezanIban(details.meezan?.iban || '');
      setWhatsappNumber(details.whatsappNumber || '');
      setPaymentInstructions(details.instructions || '');
    } catch (err: any) {
      console.error('Failed to load payment details:', err);
      addToast('error', `Could not load payment settings: ${err.message}`);
    } finally {
      setLoadingPaymentDetails(false);
    }
  };

  // Load all payment requests across the system
  const loadAdminPayments = async () => {
    setLoadingAdminPayments(true);
    try {
      const requests = await getAllPaymentRequestsAdmin();
      setAdminPayments(requests);
    } catch (err: any) {
      console.error('Failed to load payment requests:', err);
      addToast('error', `Could not load payment requests: ${err.message}`);
    } finally {
      setLoadingAdminPayments(false);
    }
  };

  // Load all registered student signups across the system
  const [signupError,setSignupError]=useState("");
  const loadStudentSignups = async (quiet=false) => {
    if(!quiet)setLoadingSignups(true);
    try {
      const data = await getAllStudentSignupsAdmin();
      setStudentSignups(data);
      setSignupError("");
    } catch (err: any) {
      setSignupError(err.message||'Could not load registrations');
      console.error('Failed to load student signups:', err);
      addToast('error', `Could not load student signups: ${err.message}`);
    } finally {
      setLoadingSignups(false);
    }
  };

  // Refresh both signups and payments
  const refreshSection4Data = async () => {
    await Promise.all([loadStudentSignups(), loadAdminPayments()]);
  };

  // Fetch payments data on mount
  useEffect(() => {
    loadPaymentSettings();
    loadAdminPayments();
    loadStudentSignups();
  }, []);

  useEffect(()=>{
    if(activeTab!=='payments')return;
    let active=true,inFlight=false;
    const refresh=async()=>{if(!active||inFlight||document.hidden)return;inFlight=true;try{await loadStudentSignups(true);await loadAdminPayments();}finally{inFlight=false;}};
    const timer=window.setInterval(refresh,30000);window.addEventListener('focus',refresh);
    return()=>{active=false;clearInterval(timer);window.removeEventListener('focus',refresh);};
  },[activeTab]);

  // Save payment settings
  const handleSavePaymentDetails = async (e: React.FormEvent) => {
    e.preventDefault();
    setPaymentFormError(null);

    const cleanWhatsapp = whatsappNumber.trim().replace(/\D/g, '');
    if (whatsappNumber.trim()) {
      if (!isValidWhatsAppNumber(cleanWhatsapp)) {
        setPaymentFormError(
          'WhatsApp number must be digits only and start with 92 (e.g. 923001234567).'
        );
        addToast('error', 'Invalid WhatsApp number format. Must start with 92.');
        return;
      }
    }

    setIsSavingPaymentDetails(true);
    try {
      await savePaymentDetails({
        jazzcash: {
          accountTitle: jazzcashTitle,
          number: jazzcashNumber
        },
        meezan: {
          bankName: meezanBankName,
          branch: meezanBranch,
          accountTitle: meezanTitle,
          accountNumber: meezanNumber,
          iban: meezanIban
        },
        whatsappNumber: cleanWhatsapp,
        instructions: paymentInstructions
      });

      addToast('success', 'Payment details and WhatsApp settings updated in database.');
    } catch (err: any) {
      console.error('Failed to save payment details:', err);
      setPaymentFormError(err.message || 'Failed to save payment details.');
      addToast('error', err.message || 'Failed to save payment details.');
    } finally {
      setIsSavingPaymentDetails(false);
    }
  };

  // Update payment request status
  const handleUpdatePaymentStatus = async (
    requestId: string,
    newStatus: 'VERIFIED' | 'REJECTED'
  ) => {
    setUpdatingPaymentId(requestId);
    try {
      await updatePaymentRequestStatus(requestId, newStatus);
      setAdminPayments((prev) =>
        prev.map((req) => (req.id === requestId ? { ...req, status: newStatus } : req))
      );
      window.dispatchEvent(new Event('registrations-updated'));
      // Also reload signups to reflect updated user approvalStatus
      loadStudentSignups();
      addToast(
        'success',
        `Payment request ${requestId} marked as ${newStatus}.`
      );
    } catch (err: any) {
      console.error('Failed to update status:', err);
      const isPerm =
        err?.message?.includes('Missing or insufficient permissions') ||
        err?.message?.includes('permission-denied') ||
        err?.code === 'permission-denied';
      if (isPerm) {
        setShowRulesModal(true);
        addToast(
          'error',
          'Access denied. Please sign in again or contact the server owner.'
        );
      } else {
        addToast('error', `Failed to update status: ${err.message}`);
      }
    } finally {
      setUpdatingPaymentId(null);
    }
  };

  // Approve student account & their payment in one integrated action
  const handleApproveStudent = async (student: StudentSignupDoc) => {
    setProcessingStudentId(student.uid);
    try {
      await approveStudentAccount(
        student.uid,
        student.latestPaymentRequest?.id,
        'Approved by administrator'
      );

      window.dispatchEvent(new Event('registrations-updated'));
      setStudentSignups((prev) =>
        prev.map((s) =>
          s.uid === student.uid
            ? { ...s, approvalStatus: 'APPROVED', paymentStatus: 'VERIFIED' }
            : s
        )
      );

      if (student.latestPaymentRequest?.id) {
        setAdminPayments((prev) =>
          prev.map((p) =>
            p.id === student.latestPaymentRequest!.id ? { ...p, status: 'VERIFIED' } : p
          )
        );
      }

      addToast(
        'success',
        `Approved ${student.fullName}! Student now has active subscriber access.`
      );
    } catch (err: any) {
      console.error('Failed to approve student:', err);
      const isPerm =
        err?.message?.includes('Missing or insufficient permissions') ||
        err?.message?.includes('permission-denied') ||
        err?.code === 'permission-denied';
      if (isPerm) {
        setShowRulesModal(true);
        addToast(
          'error',
          'Access denied. Please sign in again or contact the server owner.'
        );
      } else {
        addToast('error', `Approval failed: ${err.message}`);
      }
    } finally {
      setProcessingStudentId(null);
    }
  };

  // Confirm rejection for student account
  const handleConfirmRejectStudent = async () => {
    if (!rejectingStudent) return;
    setProcessingStudentId(rejectingStudent.uid);
    try {
      const reason = rejectReason.trim() || 'Payment or registration could not be verified.';
      await rejectStudentAccount(
        rejectingStudent.uid,
        rejectingStudent.latestPaymentRequest?.id,
        reason
      );

      window.dispatchEvent(new Event('registrations-updated'));
      setStudentSignups((prev) =>
        prev.map((s) =>
          s.uid === rejectingStudent.uid
            ? {
                ...s,
                approvalStatus: 'REJECTED',
                paymentStatus: 'REJECTED',
                rejectedReason: reason
              }
            : s
        )
      );

      if (rejectingStudent.latestPaymentRequest?.id) {
        setAdminPayments((prev) =>
          prev.map((p) =>
            p.id === rejectingStudent.latestPaymentRequest!.id ? { ...p, status: 'REJECTED' } : p
          )
        );
      }

      addToast('info', `Marked ${rejectingStudent.fullName} as Rejected.`);
      setRejectingStudent(null);
      setRejectReason('');
    } catch (err: any) {
      console.error('Failed to reject student:', err);
      const isPerm =
        err?.message?.includes('Missing or insufficient permissions') ||
        err?.message?.includes('permission-denied') ||
        err?.code === 'permission-denied';
      if (isPerm) {
        setShowRulesModal(true);
        addToast(
          'error',
          'Access denied. Please sign in again or contact the server owner.'
        );
      } else {
        addToast('error', `Rejection failed: ${err.message}`);
      }
    } finally {
      setProcessingStudentId(null);
    }
  };

  // Count pending payments
  const pendingCount = useMemo(() => {
    return adminPayments.filter((p) => p.status === 'PENDING').length;
  }, [adminPayments]);

  // Count pending student approvals
  const pendingApprovalsCount = useMemo(() => {
    return studentSignups.filter((s) => s.approvalStatus === 'PENDING').length;
  }, [studentSignups]);

  // Filtered payments list
  const filteredPayments = useMemo(() => {
    if (paymentFilter === 'ALL') return adminPayments;
    return adminPayments.filter((p) => p.status === paymentFilter);
  }, [adminPayments, paymentFilter]);

  // Filtered student signups list
  const filteredSignups = useMemo(() => {
    if (signupFilter === 'ALL') return studentSignups;
    return studentSignups.filter((s) => s.approvalStatus === signupFilter);
  }, [studentSignups, signupFilter]);

  return (
    <div className="min-h-screen bg-[#F8FAFC] text-slate-800 pb-24">
      {/* Toast Notifications Stack */}
      <div className="fixed bottom-5 right-5 z-50 flex flex-col gap-2 max-w-md w-full pointer-events-none px-4 sm:px-0">
        {toasts.map((toast) => (
          <div
            key={toast.id}
            className={`pointer-events-auto p-3.5 rounded-lg shadow-lg border text-sm font-medium flex items-start gap-2.5 transition-all ${
              toast.type === 'success'
                ? 'bg-emerald-900/95 text-white border-emerald-700'
                : toast.type === 'error'
                ? 'bg-rose-900/95 text-white border-rose-700'
                : 'bg-[#0F2837]/95 text-white border-[#1B8E8E]'
            }`}
          >
            {toast.type === 'success' ? (
              <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
            ) : toast.type === 'error' ? (
              <AlertCircle className="w-5 h-5 text-rose-400 shrink-0 mt-0.5" />
            ) : (
              <Info className="w-5 h-5 text-teal-400 shrink-0 mt-0.5" />
            )}
            <span className="flex-1 leading-snug">{toast.message}</span>
          </div>
        ))}
      </div>

      {/* Main Workspace Area */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mt-6">
        {/* SECTION 1: ADD YEAR */}
        <div className={activeTab === 'year' ? 'block' : 'hidden'}>
          {activeTab !== 'year' && (
            <div className="hidden sm:block my-8 border-t border-slate-300/60" />
          )}

          <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden mb-8">
            <div className="p-5 sm:p-6 border-b border-slate-100 bg-slate-50/50 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <div>
                <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                  <FolderPlus className="w-5 h-5 text-[#1B8E8E]" />
                  <span>Section 1: Add Year</span>
                </h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  Create a new academic MBBS year. It will immediately appear on the student homepage and Year page.
                </p>
              </div>
              <span className="text-xs font-semibold px-2.5 py-1 rounded bg-teal-50 text-teal-800 border border-teal-200 self-start sm:self-auto">
                Automatic Slug ID
              </span>
            </div>

            <div className="p-5 sm:p-6 grid grid-cols-1 lg:grid-cols-12 gap-8">
              {/* Add Year Form (5 cols on lg) */}
              <div className="lg:col-span-5">
                <form onSubmit={handleCreateYear} className="space-y-4">
                  {yearError && (
                    <div className="p-3 bg-rose-50 border border-rose-200 rounded-lg text-xs text-rose-800 flex items-start gap-2">
                      <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                      <div>{yearError}</div>
                    </div>
                  )}

                  <div>
                    <label htmlFor="year-name-input" className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                      Year Name <span className="text-rose-500">*</span>
                    </label>
                    <input
                      id="year-name-input"
                      type="text"
                      required
                      placeholder="e.g. 5th Year MBBS"
                      value={yearName}
                      onChange={(e) => setYearName(e.target.value)}
                      className="w-full px-3.5 py-2.5 rounded-lg border border-slate-300 text-sm focus:ring-2 focus:ring-[#1B8E8E] focus:border-transparent outline-hidden bg-white"
                    />
                    {previewYearSlug && (
                      <div className="mt-1.5 text-xs text-slate-500 flex items-center gap-1 font-mono">
                        <span className="text-slate-400">Document ID:</span>
                        <span className="font-semibold text-slate-800 bg-slate-100 px-1.5 py-0.5 rounded">
                          {previewYearSlug}
                        </span>
                      </div>
                    )}
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label htmlFor="year-status-select" className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                        Status
                      </label>
                      <select
                        id="year-status-select"
                        value={yearStatus}
                        onChange={(e) => setYearStatus(e.target.value as 'available' | 'coming-soon')}
                        className="w-full px-3 py-2 rounded-lg border border-slate-300 text-sm focus:ring-2 focus:ring-[#1B8E8E] focus:border-transparent outline-hidden bg-white"
                      >
                        <option value="available">Available</option>
                        <option value="coming-soon">Coming soon</option>
                      </select>
                    </div>

                    <div>
                      <label htmlFor="year-order-input" className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                        Display Order
                      </label>
                      <input
                        id="year-order-input"
                        type="number"
                        min="0"
                        step="1"
                        value={yearOrder}
                        onChange={(e) => setYearOrder(Number(e.target.value))}
                        className="w-full px-3 py-2 rounded-lg border border-slate-300 text-sm focus:ring-2 focus:ring-[#1B8E8E] focus:border-transparent outline-hidden bg-white"
                      />
                    </div>
                  </div>

                  {/* Show on homepage switch */}
                  <div className="pt-2 pb-1">
                    <label className="flex items-center justify-between p-3 rounded-lg border border-slate-200 bg-slate-50/50 cursor-pointer hover:bg-slate-50 transition-colors">
                      <div className="pr-3">
                        <span className="text-xs font-bold text-slate-800 block">
                          Show on homepage
                        </span>
                        <span className="text-[11px] text-slate-500 block">
                          Sets published status to true. Required for student visibility.
                        </span>
                      </div>
                      <input
                        type="checkbox"
                        checked={yearPublished}
                        onChange={(e) => setYearPublished(e.target.checked)}
                        className="w-4 h-4 text-[#1B8E8E] rounded border-slate-300 focus:ring-[#1B8E8E] cursor-pointer"
                      />
                    </label>
                  </div>

                  <button
                    type="submit"
                    disabled={isSavingYear || !yearName.trim()}
                    className="w-full py-2.5 px-4 rounded-lg bg-[#1B8E8E] hover:bg-[#147273] text-white font-semibold text-sm transition-all shadow-xs flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {isSavingYear ? (
                      <>
                        <RefreshCw className="w-4 h-4 animate-spin" />
                        <span>Creating Year...</span>
                      </>
                    ) : (
                      <>
                        <Plus className="w-4 h-4" />
                        <span>Save & Create Year</span>
                      </>
                    )}
                  </button>
                </form>
              </div>

              {/* Current Years Read-Only List (7 cols on lg) */}
              <div className="lg:col-span-7 lg:border-l lg:border-slate-200 lg:pl-8">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                    Current Years ({years.length})
                  </h3>
                  <span className="text-[11px] text-slate-400">Read-only list (no edit/delete)</span>
                </div>

                {loadingCurriculum ? (
                  <div className="p-8 text-center text-slate-400 text-sm">
                    <RefreshCw className="w-5 h-5 animate-spin mx-auto mb-2 text-teal-600" />
                    <span>Loading years...</span>
                  </div>
                ) : years.length === 0 ? (
                  <div className="p-8 text-center text-slate-500 text-sm border border-dashed rounded-lg">
                    No years created yet. Use the form on the left to add the first year.
                  </div>
                ) : (
                  <div className="overflow-hidden border border-slate-200 rounded-lg shadow-2xs">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-slate-100/80 text-slate-700 font-semibold border-b border-slate-200">
                        <tr>
                          <th className="py-2.5 px-3">Order</th>
                          <th className="py-2.5 px-3">Year Name</th>
                          <th className="py-2.5 px-3">ID (Slug)</th>
                          <th className="py-2.5 px-3">Status</th>
                          <th className="py-2.5 px-3 text-right">Visibility</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 bg-white">
                        {years.map((y) => (
                          <tr key={y.id} className="hover:bg-slate-50/70 transition-colors">
                            <td className="py-2.5 px-3 font-mono text-slate-500">{y.order}</td>
                            <td className="py-2.5 px-3 font-semibold text-slate-900">{y.name}</td>
                            <td className="py-2.5 px-3 font-mono text-slate-500">{y.id}</td>
                            <td className="py-2.5 px-3">
                              {y.status === 'available' ? (
                                <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                                  Available
                                </span>
                              ) : (
                                <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-semibold bg-amber-50 text-amber-700 border border-amber-200">
                                  Coming soon
                                </span>
                              )}
                            </td>
                            <td className="py-2.5 px-3 text-right">
                              {y.published ? (
                                <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-semibold bg-teal-50 text-teal-800 border border-teal-200">
                                  Visible
                                </span>
                              ) : (
                                <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-semibold bg-slate-100 text-slate-600 border border-slate-200">
                                  Hidden
                                </span>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* SECTION 2: UPLOAD FULL SUBJECT (DOCX) */}
        <div className={activeTab === 'notes' ? 'block' : 'hidden'}>
          <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
            <div className="p-5 sm:p-6 border-b border-slate-100 bg-slate-50/50 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <div>
                <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                  <Upload className="w-5 h-5 text-[#1B8E8E]" />
                  <span>Section 2: Upload Notes</span>
                </h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  Pick the year, click a module, then upload its Word (.docx) notes in the section that opens below. Students who bought that year see them in the module straight away, and you see them in your own student account.
                </p>
              </div>

              {/* Status Indicator */}
              <div className="text-xs self-start sm:self-auto">
                {!showUploadPanel ? (
                  <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-slate-100 text-slate-600 font-medium border border-slate-200">
                    <Info className="w-3.5 h-3.5 text-slate-400" />
                    <span>Click a module to upload its notes</span>
                  </span>
                ) : selectedSubjectId === '__new__' ? (
                  <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-blue-50 text-blue-700 font-medium border border-blue-200">
                    <Sparkles className="w-3.5 h-3.5 text-blue-600" />
                    <span>Nothing uploaded for this module yet</span>
                  </span>
                ) : loadingContent ? (
                  <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-slate-100 text-slate-600 font-medium">
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    <span>Checking content status...</span>
                  </span>
                ) : existingContent ? (
                  <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-50 text-emerald-800 font-medium border border-emerald-200">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                    <span>
                      Content uploaded ({(existingContent.totalBytes / 1024).toFixed(1)} KB in {existingContent.partCount} part{existingContent.partCount > 1 ? 's' : ''})
                      {existingContent.updatedAt && (
                        <span className="text-emerald-700 ml-1">
                          &bull; updated {existingContent.updatedAt.toDate ? existingContent.updatedAt.toDate().toLocaleDateString() : 'recently'}
                        </span>
                      )}
                    </span>
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-slate-100 text-slate-600 font-medium border border-slate-200">
                    <Info className="w-3.5 h-3.5 text-slate-400" />
                    <span>No notes uploaded yet for this module</span>
                  </span>
                )}
              </div>
            </div>

            <div className="p-5 sm:p-6 space-y-6">
              {/* STEP 1: Year sections */}
              <div>
                <span className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
                  1. Year
                </span>
                {years.length === 0 ? (
                  <p className="text-xs text-slate-500">No years found. Add a year in Section 1 first.</p>
                ) : (
                  <div className="flex flex-wrap gap-2" role="tablist" aria-label="Academic year">
                    {years.map((y) => {
                      const moduleCount = blocks.filter((b) => b.yearId === y.id).length;
                      const active = y.id === selectedYearId;
                      return (
                        <button
                          key={y.id}
                          type="button"
                          role="tab"
                          aria-selected={active}
                          onClick={() => setSelectedYearId(y.id)}
                          className={`px-4 py-2 rounded-lg border text-left transition-colors cursor-pointer ${
                            active
                              ? 'bg-[#0F2837] border-[#0F2837] text-white shadow-xs'
                              : 'bg-white border-slate-300 text-slate-700 hover:border-[#1B8E8E] hover:bg-teal-50/40'
                          }`}
                        >
                          <span className="block text-sm font-bold">
                            {y.name} {!y.published ? '(Hidden)' : ''}
                          </span>
                          <span className={`block text-[11px] ${active ? 'text-teal-100' : 'text-slate-500'}`}>
                            {moduleCount} {moduleCount === 1 ? 'module' : 'modules'}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* STEP 2: Module sections for the selected year */}
              {selectedYearId && (
                <div>
                  <span className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
                    2. Click a module ({years.find((y) => y.id === selectedYearId)?.name || 'Year'})
                  </span>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                    {availableBlocks.map((b) => {
                      const moduleSubjects = subjects.filter((s) => s.blockId === b.id);
                      const publishedCount = moduleSubjects.filter((s) => s.published).length;
                      const active = b.id === selectedBlockId;
                      return (
                        <button
                          key={b.id}
                          type="button"
                          onClick={() => setSelectedBlockId(b.id)}
                          aria-pressed={active}
                          className={`p-3.5 rounded-xl border text-left transition-all cursor-pointer ${
                            active
                              ? 'border-[#1B8E8E] bg-teal-50 ring-2 ring-[#1B8E8E]/30'
                              : 'border-slate-200 bg-white hover:border-[#1B8E8E] hover:bg-slate-50'
                          }`}
                        >
                          <span className="flex items-start justify-between gap-2">
                            <span className="text-sm font-bold text-slate-900 leading-snug">{b.name}</span>
                            {!b.published && (
                              <span className="shrink-0 text-[10px] px-1.5 py-0.5 rounded bg-slate-200 text-slate-700 font-semibold">
                                Hidden
                              </span>
                            )}
                          </span>
                          <span className="block text-[11px] text-slate-500 mt-1.5">
                            {moduleSubjects.length === 0
                              ? 'No notes uploaded yet'
                              : publishedCount > 0
                                ? '✓ Notes uploaded · Published'
                                : '✓ Notes uploaded · Draft (hidden)'}
                          </span>
                        </button>
                      );
                    })}
                    <button
                      type="button"
                      onClick={() => setSelectedBlockId('__new__')}
                      aria-pressed={selectedBlockId === '__new__'}
                      className={`p-3.5 rounded-xl border-2 border-dashed text-left transition-colors cursor-pointer flex items-center gap-2 ${
                        selectedBlockId === '__new__'
                          ? 'border-amber-400 bg-amber-50/60'
                          : 'border-slate-300 bg-white hover:border-amber-400 hover:bg-amber-50/40'
                      }`}
                    >
                      <Plus className="w-4 h-4 text-amber-600" />
                      <span className="text-sm font-semibold text-slate-700">Add a module</span>
                    </button>
                  </div>

                  {/* New module name */}
                  {selectedBlockId === '__new__' && (
                    <div className="mt-3 max-w-md">
                      <input
                        type="text"
                        placeholder="Enter new module name (e.g. Neuroscience Module)..."
                        value={newBlockName}
                        onChange={(e) => { setNewBlockName(e.target.value); setProcessedDocx(null); }}
                        className="w-full px-3 py-2 text-sm rounded-lg border border-amber-300 bg-amber-50/40 focus:ring-2 focus:ring-amber-400 outline-hidden"
                      />
                      {newBlockName.trim() ? (
                        <span className="text-[10px] text-slate-500 font-mono block mt-0.5">
                          ID: {selectedYearId}-{slugify(newBlockName)}
                        </span>
                      ) : (
                        <span className="text-[11px] text-slate-500 block mt-1">The upload section opens once you type a name.</span>
                      )}
                    </div>
                  )}
                </div>
              )}

              {showUploadPanel && (
              <div ref={uploadPanelRef} className="space-y-6 pt-6 border-t-2 border-[#1B8E8E]/30 scroll-mt-4">
              <div className="flex items-center gap-2">
                <span className="w-8 h-8 rounded-lg bg-[#1B8E8E] text-white flex items-center justify-center shrink-0">
                  <Upload className="w-4 h-4" />
                </span>
                <div>
                  <h3 className="text-base font-bold text-slate-900 leading-tight">
                    Upload notes &mdash; {currentBlock ? currentBlock.name : newBlockName.trim()}
                  </h3>
                  <p className="text-[11px] text-slate-500">
                    {years.find((y) => y.id === selectedYearId)?.name}
                  </p>
                </div>
              </div>

              {/* Module settings: rename / show or hide */}
              {currentBlock && (
                <div className="p-4 rounded-xl border border-slate-200 bg-slate-50/60 flex flex-col lg:flex-row lg:items-end gap-4">
                  <div className="flex-1">
                    <label htmlFor="module-name-input" className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                      Module name
                    </label>
                    <div className="flex gap-2">
                      <input
                        id="module-name-input"
                        type="text"
                        value={moduleNameDraft}
                        onChange={(e) => setModuleNameDraft(e.target.value)}
                        className="flex-1 min-w-0 px-3 py-2 rounded-lg border border-slate-300 text-sm focus:ring-2 focus:ring-[#1B8E8E] focus:border-transparent outline-hidden bg-white"
                      />
                      <button
                        type="button"
                        onClick={handleRenameModule}
                        disabled={isSavingModule || !moduleNameDraft.trim() || moduleNameDraft.trim() === currentBlock.name}
                        className="px-4 py-2 rounded-lg text-xs font-semibold text-white bg-[#0F2837] hover:bg-[#1E293B] transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
                      >
                        Rename
                      </button>
                    </div>
                  </div>
                  <label className="flex items-center justify-between gap-3 p-3 rounded-lg border border-slate-200 bg-white cursor-pointer hover:bg-slate-50 transition-colors lg:w-72">
                    <div>
                      <span className="text-xs font-bold text-slate-800 block">Module visible to students</span>
                      <span className="text-[11px] text-slate-500 block">Turn off to hide the whole module.</span>
                    </div>
                    <input
                      type="checkbox"
                      checked={currentBlock.published}
                      onChange={handleToggleModuleVisible}
                      disabled={isSavingModule}
                      className="w-4 h-4 text-[#1B8E8E] rounded border-slate-300 focus:ring-[#1B8E8E] cursor-pointer"
                    />
                  </label>
                </div>
              )}

              {/* Only for older modules that already hold several notes */}
              {availableSubjects.length > 1 && (
                <div className="p-3 rounded-lg border border-amber-200 bg-amber-50/60 text-xs text-amber-900 flex flex-col sm:flex-row sm:items-center gap-2">
                  <span className="font-semibold">This module has {availableSubjects.length} older notes. Editing:</span>
                  <select
                    value={selectedSubjectId}
                    onChange={(e) => setSelectedSubjectId(e.target.value)}
                    className="px-2 py-1.5 rounded-md border border-amber-300 bg-white text-xs font-semibold"
                  >
                    {availableSubjects.map((s) => (
                      <option key={s.id} value={s.id}>{s.name}</option>
                    ))}
                  </select>
                </div>
              )}

              {/* Subject Flags (Published & Free Sample) */}
              <div className="p-4 rounded-xl border border-slate-200 bg-slate-50/60 grid grid-cols-1 sm:grid-cols-2 gap-4">
                <label className="flex items-center justify-between p-3 rounded-lg border border-slate-200 bg-white cursor-pointer hover:bg-slate-50 transition-colors">
                  <div className="pr-2">
                    <span className="text-xs font-bold text-slate-800 block">
                      Published
                    </span>
                    <span className="text-[11px] text-slate-500 block">
                      Shown to subscribed students in this module, and in your admin student account.
                    </span>
                  </div>
                  <input
                    type="checkbox"
                    checked={subjectPublished}
                    onChange={() => handleImmediateToggleFlag('published')}
                    disabled={isUpdatingFlags}
                    className="w-4 h-4 text-[#1B8E8E] rounded border-slate-300 focus:ring-[#1B8E8E] cursor-pointer"
                  />
                </label>

                <label className="flex items-center justify-between p-3 rounded-lg border border-slate-200 bg-white cursor-pointer hover:bg-slate-50 transition-colors">
                  <div className="pr-2">
                    <span className="text-xs font-bold text-slate-800 block flex items-center gap-1.5">
                      <span>Free Sample Note</span>
                      <span className="text-[10px] px-1.5 py-0.2 rounded bg-amber-100 text-amber-800 font-semibold">
                        Previewable
                      </span>
                    </span>
                    <span className="text-[11px] text-slate-500 block">
                      Lets students without a subscription read these notes.
                    </span>
                  </div>
                  <input
                    type="checkbox"
                    checked={subjectIsFreeSample}
                    onChange={() => handleImmediateToggleFlag('isFreeSample')}
                    disabled={isUpdatingFlags}
                    className="w-4 h-4 text-[#1B8E8E] rounded border-slate-300 focus:ring-[#1B8E8E] cursor-pointer"
                  />
                </label>
              </div>

              {/* DOCX Upload Dropzone */}
              <div className="border-2 border-dashed border-slate-300 hover:border-[#1B8E8E] rounded-xl p-6 sm:p-8 text-center bg-white transition-colors">
                <input
                  ref={fileInputRef}
                  type="file"
                  id="docx-file-input"
                  accept=".docx"
                  onChange={handleFileChange}
                  className="hidden"
                />

                <div className="max-w-md mx-auto space-y-3">
                  <div className="w-12 h-12 rounded-full bg-teal-50 text-[#1B8E8E] flex items-center justify-center mx-auto">
                    {isConverting ? (
                      <RefreshCw className="w-6 h-6 animate-spin" />
                    ) : (
                      <Upload className="w-6 h-6" />
                    )}
                  </div>

                  <div>
                    <h3 className="text-sm font-bold text-slate-900">
                      {fileName ? fileName : 'Choose the note&apos;s Word (.docx) file'}
                    </h3>
                    <p className="text-xs text-slate-500 mt-1">
                      Converts Word Heading 1 &rarr; h2, Heading 2 &rarr; h3, Heading 3 &rarr; h4. Keeps tables and formatting.
                    </p>
                  </div>

                  <div className="pt-2">
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      disabled={isConverting}
                      className="px-4 py-2 rounded-lg text-xs font-semibold text-white bg-[#0F2837] hover:bg-[#1E293B] transition-colors cursor-pointer disabled:opacity-50"
                    >
                      {fileName ? 'Select a different .docx file' : 'Browse .docx File'}
                    </button>
                  </div>

                  {conversionError && (
                    <div className="p-3 bg-rose-50 border border-rose-200 rounded-lg text-xs text-rose-800 text-left flex items-start gap-2">
                      <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                      <div>{conversionError}</div>
                    </div>
                  )}

                  {processedDocx?.imageNotice && (
                    <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg text-xs text-amber-800 text-left flex items-start gap-2">
                      <Info className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                      <div>{processedDocx.imageNotice}</div>
                    </div>
                  )}

                  {processedDocx && processedDocx.imageCount > 0 && (
                    <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-lg text-xs text-emerald-800 text-left flex items-start gap-2">
                      <Info className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                      <div>
                        {processedDocx.imageCount} image{processedDocx.imageCount > 1 ? 's' : ''} saved and stored privately.
                        Check them in the preview below, then press Save.
                      </div>
                    </div>
                  )}

                  {processedDocx?.hasNoH1 && (
                    <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg text-xs text-amber-800 text-left flex items-start gap-2">
                      <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                      <div>
                        Notice: This document contains no Word "Heading 1" styles. Top-level sections cannot be structured cleanly into major modules without Heading 1.
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Conversion Statistics & Metrics */}
              {processedDocx && (
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 p-4 rounded-xl border border-slate-200 bg-slate-50/70">
                  <div className="p-3 bg-white rounded-lg border border-slate-200 shadow-2xs">
                    <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block">
                      Total Note Size
                    </span>
                    <span className="text-lg font-bold text-slate-900 mt-0.5 block">
                      {processedDocx.totalSizeKb} KB
                    </span>
                  </div>

                  <div className="p-3 bg-white rounded-lg border border-slate-200 shadow-2xs">
                    <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block">
                      Partitioned Parts
                    </span>
                    <span className="text-lg font-bold text-[#1B8E8E] mt-0.5 block">
                      {processedDocx.partCount} {processedDocx.partCount === 1 ? 'part' : 'parts'}
                    </span>
                  </div>

                  <div className="p-3 bg-white rounded-lg border border-slate-200 shadow-2xs">
                    <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block">
                      Headings in TOC
                    </span>
                    <span className="text-lg font-bold text-slate-900 mt-0.5 block">
                      {processedDocx.headingCount} headings
                    </span>
                  </div>

                  <div className="p-3 bg-white rounded-lg border border-slate-200 shadow-2xs flex flex-col justify-center">
                    <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block">
                      Target Boundary
                    </span>
                    <span className="text-xs font-semibold text-slate-700 mt-0.5 block">
                      &le; 600 KB / part
                    </span>
                  </div>
                </div>
              )}

              {/* Save Subject Action */}
              <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-2 border-t border-slate-200">
                <div className="text-xs text-slate-500">
                  {processedDocx ? (
                    <span>
                      Ready to save {processedDocx.partCount} part{processedDocx.partCount > 1 ? 's' : ''} into this module.
                    </span>
                  ) : (
                    <span>Select a Word file to preview and save.</span>
                  )}
                </div>

                <button
                  type="button"
                  onClick={handleSaveSubject}
                  disabled={isSavingSubject || isConverting || !processedDocx}
                  className="w-full sm:w-auto px-6 py-2.5 rounded-lg bg-[#1B8E8E] hover:bg-[#147273] text-white font-semibold text-sm transition-all shadow-xs flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isSavingSubject ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin" />
                      <span>Saving...</span>
                    </>
                  ) : (
                    <>
                      <FileText className="w-4 h-4" />
                      <span>Save Notes</span>
                    </>
                  )}
                </button>
              </div>

              {/* Where these notes appear for students */}
              {currentBlock && existingContent && (() => {
                const yr = years.find((y) => y.id === selectedYearId);
                const studentBase = (window.MEDIFY_CONFIG?.STUDENT_URL || (import.meta as any).env?.VITE_STUDENT_URL || 'http://localhost:3000').replace(/\/$/, '');
                const problems: string[] = [];
                if (yr && !yr.published) problems.push(`${yr.name} is hidden (Section 1)`);
                if (!currentBlock.published) problems.push('this module is hidden (switch on "Module visible to students")');
                if (currentSubject && !currentSubject.published) problems.push('the notes are not Published');
                const live = problems.length === 0;
                return (
                  <div className={`p-4 rounded-xl border text-xs space-y-2 ${live ? 'border-emerald-200 bg-emerald-50/70 text-emerald-900' : 'border-amber-300 bg-amber-50 text-amber-900'}`}>
                    <p className="font-bold">
                      {live ? 'Live: students and your admin account can read these notes here' : 'Not visible to students yet'}
                    </p>
                    {live ? (
                      <p>
                        Student site &rarr; Home &rarr; &ldquo;Notes Available Now&rdquo; &rarr; <strong>{currentBlock.name}</strong>. Subscribers of {yr?.name || 'this year'} also see it in their Dashboard library.
                      </p>
                    ) : (
                      <p>Because {problems.join(' and ')}.</p>
                    )}
                    <div className="flex flex-wrap gap-3 pt-1">
                      <a href={`${studentBase}/block/${currentBlock.id}`} target="_blank" rel="noreferrer" className="font-semibold underline">Open this module on the student site</a>
                      <a href={`${studentBase}/`} target="_blank" rel="noreferrer" className="font-semibold underline">Open student homepage</a>
                      <a href={`${studentBase}/dashboard`} target="_blank" rel="noreferrer" className="font-semibold underline">Open admin dashboard library</a>
                    </div>
                  </div>
                );
              })()}

              {/* Live Preview of First Part */}
              {processedDocx && processedDocx.firstPartHtml && (
                <div className="mt-8 pt-6 border-t border-slate-200 space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                        <BookOpen className="w-4 h-4 text-[#1B8E8E]" />
                        <span>Live Preview (Part 1 of {processedDocx.partCount})</span>
                      </h3>
                      <p className="text-xs text-slate-500 mt-0.5">
                        Rendered with identical typography and responsive tables as the reader.
                      </p>
                    </div>
                    <span className="text-xs font-semibold px-2.5 py-1 rounded bg-slate-100 text-slate-700">
                      {(processedDocx.parts[0]?.sizeBytes / 1024).toFixed(1)} KB
                    </span>
                  </div>

                  <div className="p-6 sm:p-8 bg-[#F8FAFC] rounded-xl border border-slate-200 max-h-[500px] overflow-y-auto">
                    <div
                      ref={previewRef}
                      className="medify-reader-content text-slate-800 leading-relaxed"
                      dangerouslySetInnerHTML={{
                        __html: prepareHtmlForReader(processedDocx.firstPartHtml)
                      }}
                    />
                  </div>
                </div>
              )}
              </div>
              )}
            </div>
          </div>
        </div>

        {/* SECTION 3: PLANS & PAYMENT DETAILS */}
        <div className={activeTab === 'settings' ? 'block' : 'hidden'}>
          <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden mb-8">
            <div className="p-5 sm:p-6 border-b border-slate-100 bg-slate-50/50 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <div>
                <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                  <CreditCard className="w-5 h-5 text-[#1B8E8E]" />
                  <span>Section 3: Plans & Payment Details</span>
                </h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  Configure JazzCash, Meezan Bank, and WhatsApp verification. Saved to settings/paymentDetails in database.
                </p>
              </div>

              <button
                type="button"
                onClick={loadPaymentSettings}
                disabled={loadingPaymentDetails}
                className="px-3 py-1.5 text-xs font-semibold rounded bg-slate-100 hover:bg-slate-200 text-slate-700 transition-colors flex items-center gap-1.5 cursor-pointer self-start sm:self-auto disabled:opacity-50"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${loadingPaymentDetails ? 'animate-spin' : ''}`} />
                <span>Reload Settings</span>
              </button>
            </div>

            <div className="p-5 sm:p-6">
              {paymentFormError && (
                <div className="mb-6 p-4 bg-rose-50 border border-rose-200 rounded-lg text-xs text-rose-800 flex items-start gap-2.5">
                  <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                  <span>{paymentFormError}</span>
                </div>
              )}

              <form onSubmit={handleSavePaymentDetails} className="space-y-8">
                
                {/* 1. JazzCash Account Configuration */}
                <div className="p-5 rounded-xl border border-slate-200 bg-slate-50/40 space-y-4">
                  <div className="flex items-center gap-2 border-b border-slate-200 pb-2.5">
                    <Smartphone className="w-4 h-4 text-[#1B8E8E]" />
                    <h3 className="text-sm font-bold text-slate-900">1. JazzCash Account Details</h3>
                    <span className="text-[11px] text-slate-500">(Only JazzCash & Meezan Bank are allowed)</span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label htmlFor="jc-title-input" className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                        Account Title <span className="text-rose-500">*</span>
                      </label>
                      <input
                        id="jc-title-input"
                        type="text"
                        required
                        placeholder="e.g. Syed Nangyal"
                        value={jazzcashTitle}
                        onChange={(e) => setJazzcashTitle(e.target.value)}
                        className="w-full px-3.5 py-2.5 rounded-lg border border-slate-300 text-sm focus:ring-2 focus:ring-[#1B8E8E] focus:border-transparent outline-hidden bg-white"
                      />
                    </div>

                    <div>
                      <label htmlFor="jc-num-input" className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                        Mobile / Account Number <span className="text-rose-500">*</span>
                      </label>
                      <input
                        id="jc-num-input"
                        type="text"
                        required
                        placeholder="e.g. 03001234567"
                        value={jazzcashNumber}
                        onChange={(e) => setJazzcashNumber(e.target.value)}
                        className="w-full px-3.5 py-2.5 rounded-lg border border-slate-300 text-sm font-mono focus:ring-2 focus:ring-[#1B8E8E] focus:border-transparent outline-hidden bg-white"
                      />
                    </div>
                  </div>
                </div>

                {/* 2. Meezan Bank Account Configuration */}
                <div className="p-5 rounded-xl border border-slate-200 bg-slate-50/40 space-y-4">
                  <div className="flex items-center gap-2 border-b border-slate-200 pb-2.5">
                    <Building2 className="w-4 h-4 text-[#1B8E8E]" />
                    <h3 className="text-sm font-bold text-slate-900">2. Meezan Bank Account Details</h3>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label htmlFor="mb-name-input" className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                        Bank Name
                      </label>
                      <input
                        id="mb-name-input"
                        type="text"
                        value={meezanBankName}
                        onChange={(e) => setMeezanBankName(e.target.value)}
                        className="w-full px-3.5 py-2.5 rounded-lg border border-slate-300 text-sm focus:ring-2 focus:ring-[#1B8E8E] focus:border-transparent outline-hidden bg-white"
                      />
                    </div>

                    <div>
                      <label htmlFor="mb-branch-input" className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                        Branch Name / City
                      </label>
                      <input
                        id="mb-branch-input"
                        type="text"
                        placeholder="e.g. Hayatabad Branch Peshawar"
                        value={meezanBranch}
                        onChange={(e) => setMeezanBranch(e.target.value)}
                        className="w-full px-3.5 py-2.5 rounded-lg border border-slate-300 text-sm focus:ring-2 focus:ring-[#1B8E8E] focus:border-transparent outline-hidden bg-white"
                      />
                    </div>

                    <div>
                      <label htmlFor="mb-title-input" className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                        Account Title <span className="text-rose-500">*</span>
                      </label>
                      <input
                        id="mb-title-input"
                        type="text"
                        required
                        placeholder="e.g. Syed Nangyal"
                        value={meezanTitle}
                        onChange={(e) => setMeezanTitle(e.target.value)}
                        className="w-full px-3.5 py-2.5 rounded-lg border border-slate-300 text-sm focus:ring-2 focus:ring-[#1B8E8E] focus:border-transparent outline-hidden bg-white"
                      />
                    </div>

                    <div>
                      <label htmlFor="mb-num-input" className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                        Account Number <span className="text-rose-500">*</span>
                      </label>
                      <input
                        id="mb-num-input"
                        type="text"
                        required
                        placeholder="e.g. 01020304050607"
                        value={meezanNumber}
                        onChange={(e) => setMeezanNumber(e.target.value)}
                        className="w-full px-3.5 py-2.5 rounded-lg border border-slate-300 text-sm font-mono focus:ring-2 focus:ring-[#1B8E8E] focus:border-transparent outline-hidden bg-white"
                      />
                    </div>

                    <div className="sm:col-span-2">
                      <label htmlFor="mb-iban-input" className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                        IBAN <span className="text-slate-400 font-normal">(Optional)</span>
                      </label>
                      <input
                        id="mb-iban-input"
                        type="text"
                        placeholder="e.g. PK00MEZN0001020304050607"
                        value={meezanIban}
                        onChange={(e) => setMeezanIban(e.target.value)}
                        className="w-full px-3.5 py-2.5 rounded-lg border border-slate-300 text-sm font-mono focus:ring-2 focus:ring-[#1B8E8E] focus:border-transparent outline-hidden bg-white"
                      />
                    </div>
                  </div>
                </div>

                {/* 3. WhatsApp Verification Setup */}
                <div className="p-5 rounded-xl border border-slate-200 bg-slate-50/40 space-y-4">
                  <div className="flex items-center gap-2 border-b border-slate-200 pb-2.5">
                    <MessageCircle className="w-4 h-4 text-emerald-600" />
                    <h3 className="text-sm font-bold text-slate-900">3. WhatsApp Screenshot Helper</h3>
                  </div>

                  <div>
                    <label htmlFor="wa-input" className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                      WhatsApp Number (digits only, international format without + or leading zeros)
                    </label>
                    <input
                      id="wa-input"
                      type="text"
                      placeholder="e.g. 923001234567"
                      value={whatsappNumber}
                      onChange={(e) => setWhatsappNumber(e.target.value)}
                      className="w-full px-3.5 py-2.5 rounded-lg border border-slate-300 text-sm font-mono focus:ring-2 focus:ring-[#1B8E8E] focus:border-transparent outline-hidden bg-white"
                    />
                    <p className="text-xs text-slate-600 mt-1 font-medium">
                      Example: 923001234567 (no +, no spaces, no leading 0)
                    </p>
                    <p className="text-[11px] text-slate-400 mt-0.5">
                      If left blank or invalid, the WhatsApp screenshot button will be automatically hidden from student screens.
                    </p>
                  </div>
                </div>

                {/* 4. Payment Instructions */}
                <div className="p-5 rounded-xl border border-slate-200 bg-slate-50/40 space-y-4">
                  <div className="flex items-center gap-2 border-b border-slate-200 pb-2.5">
                    <Info className="w-4 h-4 text-[#1B8E8E]" />
                    <h3 className="text-sm font-bold text-slate-900">4. Student Payment Instructions</h3>
                  </div>

                  <div>
                    <label htmlFor="inst-input" className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                      Instructions Text (Displayed to student during checkout)
                    </label>
                    <textarea
                      id="inst-input"
                      rows={3}
                      value={paymentInstructions}
                      onChange={(e) => setPaymentInstructions(e.target.value)}
                      placeholder="Please transfer the exact amount using JazzCash or Meezan Bank. After sending, enter your Transaction ID and the last 4 digits of your sending account below."
                      className="w-full px-3.5 py-2.5 rounded-lg border border-slate-300 text-xs focus:ring-2 focus:ring-[#1B8E8E] focus:border-transparent outline-hidden bg-white"
                    />
                  </div>
                </div>

                {/* Save Button */}
                <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-200">
                  <button
                    type="submit"
                    disabled={isSavingPaymentDetails}
                    className="px-6 py-2.5 rounded-lg bg-[#1B8E8E] hover:bg-[#147273] text-white font-semibold text-xs sm:text-sm transition-all shadow-xs flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
                  >
                    {isSavingPaymentDetails ? (
                      <>
                        <RefreshCw className="w-4 h-4 animate-spin" />
                        <span>Saving Settings...</span>
                      </>
                    ) : (
                      <>
                        <Check className="w-4 h-4" />
                        <span>Save Payment Details</span>
                      </>
                    )}
                  </button>
                </div>

              </form>
            </div>
          </div>
        </div>

        {/* SECTION 4: STUDENT SIGNUPS & PAYMENTS MANAGEMENT */}
        <div className={activeTab === 'payments' ? 'block' : 'hidden'}>
          <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden mb-8">
            {/* Header & Sub-tab navigation */}
            <div className="p-5 sm:p-6 border-b border-slate-100 bg-slate-50/50 flex flex-col gap-4">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                <div>
                  <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                    <Users className="w-5 h-5 text-[#1B8E8E]" />
                    <span>Section 4: Student Signups & Payment Approvals</span>
                  </h2>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Admin must verify payment proofs (JazzCash / Meezan Bank) and approve accounts to grant curriculum notes access.
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setShowRulesModal(true)}
                    className="px-3 py-1.5 text-xs font-semibold rounded-lg bg-amber-50 hover:bg-amber-100 text-amber-900 border border-amber-300 transition-colors flex items-center gap-1.5 cursor-pointer shadow-2xs"
                    title="Administrator access help"
                  >
                    <Shield className="w-3.5 h-3.5 text-amber-600" />
                    <span>Access help</span>
                  </button>

                  <button
                    type="button"
                    onClick={refreshSection4Data}
                    disabled={loadingSignups || loadingAdminPayments}
                    className="px-3 py-1.5 text-xs font-semibold rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 transition-colors flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${loadingSignups || loadingAdminPayments ? 'animate-spin' : ''}`} />
                    <span>Refresh</span>
                  </button>
                </div>
              </div>

              {/* View Switcher: Signups vs Raw Transactions */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-2 border-t border-slate-200/80">
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setSection4SubTab('signups')}
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer flex items-center gap-1.5 ${
                      section4SubTab === 'signups'
                        ? 'bg-[#0F2837] text-white shadow-xs'
                        : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'
                    }`}
                  >
                    <UserCheck className="w-3.5 h-3.5" />
                    <span>Student Accounts & Approvals ({studentSignups.length})</span>
                    {pendingApprovalsCount > 0 && (
                      <span className="ml-1 text-[10px] px-1.5 py-0.2 rounded-full bg-amber-400 text-slate-900 font-bold">
                        {pendingApprovalsCount}
                      </span>
                    )}
                  </button>

                  <button
                    type="button"
                    onClick={() => setSection4SubTab('transactions')}
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer flex items-center gap-1.5 ${
                      section4SubTab === 'transactions'
                        ? 'bg-[#0F2837] text-white shadow-xs'
                        : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'
                    }`}
                  >
                    <Receipt className="w-3.5 h-3.5" />
                    <span>Transaction Proofs ({adminPayments.length})</span>
                    {pendingCount > 0 && (
                      <span className="ml-1 text-[10px] px-1.5 py-0.2 rounded-full bg-amber-400 text-slate-900 font-bold">
                        {pendingCount}
                      </span>
                    )}
                  </button>
                </div>

                {/* Filter Chips */}
                {section4SubTab === 'signups' ? (
                  <div className="inline-flex rounded-lg border border-slate-200 p-0.5 bg-slate-100 text-xs">
                    <button
                      type="button"
                      onClick={() => setSignupFilter('ALL')}
                      className={`px-2.5 py-1 rounded font-semibold transition-colors cursor-pointer ${
                        signupFilter === 'ALL'
                          ? 'bg-white text-slate-900 shadow-2xs'
                          : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      All ({studentSignups.length})
                    </button>
                    <button
                      type="button"
                      onClick={() => setSignupFilter('PENDING')}
                      className={`px-2.5 py-1 rounded font-semibold transition-colors cursor-pointer ${
                        signupFilter === 'PENDING'
                          ? 'bg-white text-amber-900 shadow-2xs'
                          : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      Pending ({pendingApprovalsCount})
                    </button>
                    <button
                      type="button"
                      onClick={() => setSignupFilter('APPROVED')}
                      className={`px-2.5 py-1 rounded font-semibold transition-colors cursor-pointer ${
                        signupFilter === 'APPROVED'
                          ? 'bg-white text-emerald-900 shadow-2xs'
                          : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      Approved
                    </button>
                    <button
                      type="button"
                      onClick={() => setSignupFilter('REJECTED')}
                      className={`px-2.5 py-1 rounded font-semibold transition-colors cursor-pointer ${
                        signupFilter === 'REJECTED'
                          ? 'bg-white text-rose-900 shadow-2xs'
                          : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      Rejected
                    </button>
                  </div>
                ) : (
                  <div className="inline-flex rounded-lg border border-slate-200 p-0.5 bg-slate-100 text-xs">
                    <button
                      type="button"
                      onClick={() => setPaymentFilter('ALL')}
                      className={`px-2.5 py-1 rounded font-semibold transition-colors cursor-pointer ${
                        paymentFilter === 'ALL'
                          ? 'bg-white text-slate-900 shadow-2xs'
                          : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      All ({adminPayments.length})
                    </button>
                    <button
                      type="button"
                      onClick={() => setPaymentFilter('PENDING')}
                      className={`px-2.5 py-1 rounded font-semibold transition-colors cursor-pointer ${
                        paymentFilter === 'PENDING'
                          ? 'bg-white text-amber-900 shadow-2xs'
                          : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      Pending ({pendingCount})
                    </button>
                    <button
                      type="button"
                      onClick={() => setPaymentFilter('VERIFIED')}
                      className={`px-2.5 py-1 rounded font-semibold transition-colors cursor-pointer ${
                        paymentFilter === 'VERIFIED'
                          ? 'bg-white text-emerald-900 shadow-2xs'
                          : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      Verified
                    </button>
                    <button
                      type="button"
                      onClick={() => setPaymentFilter('REJECTED')}
                      className={`px-2.5 py-1 rounded font-semibold transition-colors cursor-pointer ${
                        paymentFilter === 'REJECTED'
                          ? 'bg-white text-rose-900 shadow-2xs'
                          : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      Rejected
                    </button>
                  </div>
                )}
              </div>
            </div>

            {/* Sub-tab 1: Student Accounts & Approvals */}
            {section4SubTab === 'signups' && (
              <div className="p-5 sm:p-6">
                <p className="text-xs text-slate-500 mb-3">New registrations appear here automatically. Refreshes every 30 seconds while this page is visible.</p>
                {signupError&&<div role="alert" className="p-3 mb-3 bg-red-50 text-red-700 text-xs rounded">Could not refresh registrations: {signupError}. Use Refresh to retry.</div>}
                {loadingSignups ? (
                  <div className="py-12 text-center text-slate-400">
                    <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-[#1B8E8E]" />
                    <p className="text-xs">Loading registered students...</p>
                  </div>
                ) : filteredSignups.length === 0 ? (
                  <div className="py-12 text-center text-slate-500 text-sm border border-dashed rounded-lg bg-slate-50">
                    No student registrations found for the selected filter.
                  </div>
                ) : (
                  <div className="overflow-x-auto border border-slate-200 rounded-lg shadow-2xs">
                    <table className="w-full text-left text-xs min-w-[850px]">
                      <thead className="bg-slate-100/80 text-slate-700 font-semibold border-b border-slate-200">
                        <tr>
                          <th className="py-3 px-3">Student & Academic Profile</th>
                          <th className="py-3 px-3">Chosen Package</th>
                          <th className="py-3 px-3">Payment Proof (JazzCash / Meezan)</th>
                          <th className="py-3 px-3">Account Status</th>
                          <th className="py-3 px-3 text-right">Approval Actions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 bg-white">
                        {filteredSignups.map((s) => {
                          const isApproved = s.approvalStatus === 'APPROVED';
                          const isPending = s.approvalStatus === 'PENDING';
                          const isRejected = s.approvalStatus === 'REJECTED';
                          const isProcessing = processingStudentId === s.uid;
                          const payment = s.latestPaymentRequest;

                          return (
                            <tr key={s.uid} className="hover:bg-slate-50/70 transition-colors">
                              {/* Student & Academic Info */}
                              <td className="py-3 px-3">
                                <div className="font-bold text-slate-900 flex items-center gap-1.5">
                                  <span>{s.fullName}</span>
                                </div>
                                <div className="text-[11px] text-slate-500 font-mono">
                                  {s.email}
                                </div>
                                <div className="text-[11px] text-slate-600 flex items-center gap-1 mt-0.5">
                                  <GraduationCap className="w-3 h-3 text-[#1B8E8E]" />
                                  <span>{s.college} • {s.academicYear}</span>
                                </div>
                              </td>

                              {/* Chosen Package */}
                              <td className="py-3 px-3">
                                <span className="font-semibold text-slate-800 block">
                                  {s.selectedPlanName || payment?.planName || 'Plan Not Set'}
                                </span>
                                <span className="text-xs font-mono font-bold text-slate-900">
                                  {s.planPrice ? `PKR ${s.planPrice}` : payment?.amountPKR ? `PKR ${payment.amountPKR}` : 'PKR --'}
                                </span>
                              </td>

                              {/* Payment Proof */}
                              <td className="py-3 px-3">
                                {payment ? (
                                  <div className="space-y-0.5">
                                    <div className="flex items-center gap-1.5">
                                      <span
                                        className={`inline-flex items-center px-1.5 py-0.2 rounded text-[10px] font-bold ${
                                          payment.method === 'jazzcash'
                                            ? 'bg-amber-100 text-amber-900 border border-amber-300'
                                            : payment.method === 'meezan'
                                            ? 'bg-teal-100 text-teal-900 border border-teal-300'
                                            : 'bg-slate-100 text-slate-700 border border-slate-300'
                                        }`}
                                      >
                                        {getPaymentMethodLabel(payment.method)}
                                      </span>
                                      <span className="font-mono font-bold text-[#1B8E8E]">
                                        {payment.transactionId}
                                        
                                      </span>
                                    </div>
                                    <div className="text-[11px] text-slate-500">
                                      Last 4: {payment.last4Digits || 'N/A'}{' '}
                                      {payment.paymentTime ? `• ${payment.paymentTime.slice(0, 10)}` : ''}
                                    </div>
                                    {payment.hasProof ? <PaymentProof paymentId={payment.id}/> : <p className="text-[11px] text-slate-500">No receipt uploaded</p>}
                                  </div>
                                ) : (
                                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-medium bg-amber-50 text-amber-800 border border-amber-200">
                                    <Clock className="w-3 h-3 text-amber-500" />
                                    <span>Awaiting transfer (Unpaid)</span>
                                  </span>
                                )}
                              </td>

                              {/* Approval Status */}
                              <td className="py-3 px-3">
                                {isApproved && (
                                  <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-900 border border-emerald-300">
                                    <CheckCircle className="w-3 h-3 text-emerald-600" />
                                    <span>Approved & Active</span>
                                  </span>
                                )}
                                {isPending && (
                                  <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-900 border border-amber-300">
                                    <Clock className="w-3 h-3 text-amber-600" />
                                    <span>Pending Approval</span>
                                  </span>
                                )}
                                {isRejected && (
                                  <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-rose-100 text-rose-900 border border-rose-300">
                                    <XCircle className="w-3 h-3 text-rose-600" />
                                    <span>Rejected</span>
                                  </span>
                                )}
                                {s.rejectedReason && (
                                  <p className="text-[10px] text-rose-600 truncate max-w-[150px] mt-0.5" title={s.rejectedReason}>
                                    {s.rejectedReason}
                                  </p>
                                )}
                              </td>

                              {/* Actions */}
                              <td className="py-3 px-3 text-right">
                                <div className="flex items-center justify-end gap-1.5">
                                  {!isApproved && (
                                    <button
                                      type="button"
                                      onClick={() => handleApproveStudent(s)}
                                      disabled={isProcessing}
                                      className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 transition-colors shadow-2xs cursor-pointer disabled:opacity-50"
                                      title="Approve student account and verify payment in one action"
                                    >
                                      {isProcessing ? (
                                        <RefreshCw className="w-3 h-3 animate-spin" />
                                      ) : (
                                        <UserCheck className="w-3.5 h-3.5" />
                                      )}
                                      <span>Approve Account</span>
                                    </button>
                                  )}

                                  {!isRejected && (
                                    <button
                                      type="button"
                                      onClick={() => {
                                        setRejectingStudent(s);
                                        setRejectReason('Payment details or transaction ID could not be verified against bank statements.');
                                      }}
                                      disabled={isProcessing}
                                      className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-semibold text-rose-700 bg-rose-50 hover:bg-rose-100 border border-rose-200 transition-colors cursor-pointer disabled:opacity-50"
                                      title="Reject account and registration"
                                    >
                                      <UserX className="w-3.5 h-3.5" />
                                      <span>Reject</span>
                                    </button>
                                  )}

                                  {isApproved && (
                                    <span className="text-[11px] text-slate-400 font-medium">
                                      Curriculum Active
                                    </span>
                                  )}
                                </div>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}

            {/* Sub-tab 2: Raw Transaction Proofs */}
            {section4SubTab === 'transactions' && (
              <div className="p-5 sm:p-6">
                {loadingAdminPayments ? (
                  <div className="py-12 text-center text-slate-400">
                    <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-[#1B8E8E]" />
                    <p className="text-xs">Loading student payment requests...</p>
                  </div>
                ) : filteredPayments.length === 0 ? (
                  <div className="py-12 text-center text-slate-500 text-sm border border-dashed rounded-lg bg-slate-50">
                    No payment requests found for the selected filter.
                  </div>
                ) : (
                  <div className="overflow-x-auto border border-slate-200 rounded-lg shadow-2xs">
                    <table className="w-full text-left text-xs min-w-[750px]">
                      <thead className="bg-slate-100/80 text-slate-700 font-semibold border-b border-slate-200">
                        <tr>
                          <th className="py-3 px-3">Student</th>
                          <th className="py-3 px-3">Package / Year</th>
                          <th className="py-3 px-3">Amount</th>
                          <th className="py-3 px-3">Method</th>
                          <th className="py-3 px-3">Transaction ID / Last 4</th>
                          <th className="py-3 px-3">Status</th>
                          <th className="py-3 px-3 text-right">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 bg-white">
                        {filteredPayments.map((p) => {
                          const isPending = p.status === 'PENDING';
                          const isVerified = p.status === 'VERIFIED';
                          const isRejected = p.status === 'REJECTED';
                          const isUpdating = updatingPaymentId === p.id;
                          const methodLabel = getPaymentMethodLabel(p.method);

                          return (
                            <tr key={p.id} className="hover:bg-slate-50/70 transition-colors">
                              {/* Student */}
                              <td className="py-3 px-3">
                                <span className="font-bold text-slate-900 block truncate max-w-[160px]">
                                  {p.userName || 'Medical Student'}
                                </span>
                                <span className="text-[11px] text-slate-500 font-mono block truncate max-w-[160px]">
                                  {p.userEmail}
                                </span>
                              </td>

                              {/* Year & Plan */}
                              <td className="py-3 px-3">
                                <span className="font-semibold text-slate-800 block">
                                  {p.yearName}
                                </span>
                                <span className="text-[11px] text-slate-500 block">
                                  {p.planName} ({p.durationMonths} mos)
                                </span>
                              </td>

                              {/* Amount */}
                              <td className="py-3 px-3 font-mono font-bold text-slate-900">
                                PKR {p.amountPKR}
                                {p.couponCode && (
                                  <span className="block text-[10px] font-semibold text-emerald-700 font-sans">
                                    {p.couponCode}
                                    {p.discountAmountPKR ? ` · −PKR ${p.discountAmountPKR}` : ''}
                                  </span>
                                )}
                              </td>

                              {/* Method */}
                              <td className="py-3 px-3">
                                <span
                                  className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-semibold ${
                                    p.method === 'jazzcash'
                                      ? 'bg-amber-100/70 text-amber-900 border border-amber-300'
                                      : p.method === 'meezan'
                                      ? 'bg-teal-100/70 text-teal-900 border border-teal-300'
                                      : 'bg-slate-100 text-slate-700 border border-slate-300'
                                  }`}
                                >
                                  {methodLabel}
                                </span>
                              </td>

                              {/* Transaction ID */}
                              <td className="py-3 px-3">
                                <span className="font-mono font-bold text-[#1B8E8E] block">
                                  {p.transactionId}
                                  
                                </span>
                                <span className="text-[11px] text-slate-500 block">
                                  Last 4: {p.last4Digits || 'N/A'}{' '}
                                  {p.paymentTime ? `• ${p.paymentTime.slice(0, 10)}` : ''}
                                </span>
                                {p.hasProof ? <PaymentProof paymentId={p.id}/> : <p className="text-[11px] text-slate-500">No receipt uploaded</p>}
                              </td>

                              {/* Status */}
                              <td className="py-3 px-3">
                                {isPending && (
                                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-900 border border-amber-300">
                                    <Clock className="w-3 h-3 text-amber-600" />
                                    <span>Pending</span>
                                  </span>
                                )}
                                {isVerified && (
                                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-900 border border-emerald-300">
                                    <CheckCircle className="w-3 h-3 text-emerald-600" />
                                    <span>Verified</span>
                                  </span>
                                )}
                                {isRejected && (
                                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-100 text-rose-900 border border-rose-300">
                                    <XCircle className="w-3 h-3 text-rose-600" />
                                    <span>Rejected</span>
                                  </span>
                                )}
                              </td>

                              {/* Actions */}
                              <td className="py-3 px-3 text-right">
                                <div className="flex items-center justify-end gap-1.5">
                                  {!isVerified && (
                                    <button
                                      type="button"
                                      onClick={() => handleUpdatePaymentStatus(p.id, 'VERIFIED')}
                                      disabled={isUpdating}
                                      className="px-2.5 py-1 rounded text-[11px] font-semibold text-white bg-emerald-600 hover:bg-emerald-700 transition-colors cursor-pointer disabled:opacity-50"
                                      title="Verify student payment and enable curriculum access"
                                    >
                                      Verify
                                    </button>
                                  )}

                                  {!isRejected && (
                                    <button
                                      type="button"
                                      onClick={() => handleUpdatePaymentStatus(p.id, 'REJECTED')}
                                      disabled={isUpdating}
                                      className="px-2.5 py-1 rounded text-[11px] font-semibold text-rose-700 bg-rose-50 hover:bg-rose-100 border border-rose-200 transition-colors cursor-pointer disabled:opacity-50"
                                      title="Reject invalid transaction"
                                    >
                                      Reject
                                    </button>
                                  )}
                                </div>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Modal: Reject Student Account & Payment */}
        {rejectingStudent && (
          <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-xl space-y-4">
              <div className="flex items-start justify-between">
                <div>
                  <h3 className="font-bold text-base text-slate-900">
                    Reject Student Registration / Payment
                  </h3>
                  <p className="text-xs text-slate-500 mt-0.5">
                    For student: <strong className="text-slate-800">{rejectingStudent.fullName}</strong> ({rejectingStudent.email})
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setRejectingStudent(null)}
                  className="p-1 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-slate-600 cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Reason for rejection (Visible to student)
                </label>
                <textarea
                  rows={3}
                  value={rejectReason}
                  onChange={(e) => setRejectReason(e.target.value)}
                  placeholder="e.g. Transaction ID could not be verified in Meezan Bank / JazzCash statement."
                  className="w-full px-3.5 py-2.5 rounded-lg border border-slate-300 text-xs focus:ring-2 focus:ring-rose-500 focus:border-transparent outline-hidden"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setRejectingStudent(null)}
                  className="px-4 py-2 rounded-lg text-xs font-semibold text-slate-600 hover:bg-slate-100 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleConfirmRejectStudent}
                  disabled={Boolean(processingStudentId)}
                  className="px-4 py-2 rounded-lg text-xs font-bold text-white bg-rose-600 hover:bg-rose-700 transition-colors cursor-pointer disabled:opacity-50"
                >
                  Confirm Rejection
                </button>
              </div>
            </div>
          </div>
        )}

        {showRulesModal && <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center"><div className="bg-white rounded-xl p-8 max-w-lg"><h2>Administrator access</h2><p>Your session may have expired. Sign out and sign back in. Ask the server owner to verify your administrator role if access remains denied.</p><button onClick={()=>setShowRulesModal(false)}>Close</button></div></div>}

      </div>
    </div>
  );
}
