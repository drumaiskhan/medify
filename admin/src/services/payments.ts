import {
  doc,
  getDoc,
  setDoc,
  collection,
  query,
  where,
  getDocs,
  orderBy,
  serverTimestamp,
  updateDoc
} from '../lib/data';
import { db, api } from '../lib/client';

export type PaymentMethod = 'jazzcash' | 'meezan';

export interface JazzCashDetails {
  accountTitle: string;
  number: string;
}

export interface MeezanDetails {
  bankName: string;
  branch: string;
  accountTitle: string;
  accountNumber: string;
  iban?: string;
}

export interface PaymentDetailsDoc {
  jazzcash: JazzCashDetails;
  meezan: MeezanDetails;
  whatsappNumber: string; // digits only, e.g. 923001234567
  instructions: string;
  updatedAt?: any;
}

export type PaymentRequestStatus = 'PENDING' | 'VERIFIED' | 'REJECTED';

export interface PaymentRequestDoc {
  id: string; // Document ID: {method}_{transactionId}
  userId: string;
  userName: string;
  userEmail: string;
  yearId: string;
  yearName: string;
  planId: string;
  planName: string;
  durationMonths: number;
  amountPKR: number | string;
  // Set by the server when a discount coupon was used.
  couponCode?: string;
  listPricePKR?: number;
  discountAmountPKR?: number;
  method: string; // 'jazzcash' | 'meezan' | legacy string
  transactionId: string;
  last4Digits: string;
  paymentTime: string;
  status: PaymentRequestStatus;
  adminNote?: string;
  hasProof?: boolean;
  createdAt: any;
  updatedAt: any;
}

/**
 * Returns human-readable label for payment methods.
 * "jazzcash" => "JazzCash"
 * "meezan" => "Meezan Bank"
 * Legacy or older method => raw value
 */
export function getPaymentMethodLabel(method: string | undefined | null): string {
  if (!method) return 'Unknown';
  if (method.toLowerCase() === 'jazzcash') return 'JazzCash';
  if (method.toLowerCase() === 'meezan') return 'Meezan Bank';
  // If an old payment record has any other method value (e.g. 'easypaisa', 'bank'), show the raw value instead of crashing.
  return method;
}

/**
 * Normalizes a Pakistan WhatsApp number to international 92XXXXXXXXXX format.
 */
export function normalizeWhatsAppNumber(number: string | undefined | null): string {
  // No fallback: payment proofs only go to the number saved in Admin > Payment settings.
  if (!number) return '';
  let cleaned = String(number).trim().replace(/\D/g, '');
  if (!cleaned) return '';
  if (cleaned.startsWith('03')) {
    cleaned = '92' + cleaned.slice(1);
  } else if (cleaned.startsWith('3') && cleaned.length === 10) {
    cleaned = '92' + cleaned;
  } else if (!cleaned.startsWith('92')) {
    cleaned = '92' + cleaned;
  }
  return cleaned;
}

/**
 * Validates Pakistan WhatsApp number:
 * Accepts numbers with or without +92/03/92 prefix.
 */
export function isValidWhatsAppNumber(number: string | undefined | null): boolean {
  if (!number) return false; // Nothing configured in admin settings
  const cleaned = String(number).trim().replace(/\D/g, '');
  return cleaned.length >= 9;
}

/**
 * Generates the standardized verification message for WhatsApp.
 */
export function buildWhatsAppMessage(request: {
  userName: string;
  userEmail: string;
  yearName: string;
  planName: string;
  durationMonths: number;
  amountPKR: number | string;
  method: string;
  transactionId?: string;
  last4Digits?: string;
}): string {
  const methodLabel = getPaymentMethodLabel(request.method);
  const txLine = request.transactionId && request.transactionId.trim()
    ? `\nTransaction ID: ${request.transactionId.trim()}`
    : '';
  const last4Line = request.last4Digits && request.last4Digits.trim()
    ? `\nSender Account (last 4 digits): ${request.last4Digits.trim()}`
    : '';

  return `Assalam o Alaikum. I have transferred the amount for MEDIFY subscription.
Name: ${request.userName || 'Medical Student'}
Email: ${request.userEmail || ''}
Year: ${request.yearName || 'MBBS'}
Plan: ${request.planName || ''} (${request.durationMonths} months)
Amount: PKR ${request.amountPKR}
Method: ${methodLabel}${txLine}${last4Line}

I am attaching my payment screenshot/receipt here for admin verification.`;
}

/**
 * Creates the direct wa.me WhatsApp URL with encoded message.
 */
export function buildWhatsAppLink(
  whatsappNumber: string | undefined | null,
  request: {
    userName: string;
    userEmail: string;
    yearName: string;
    planName: string;
    durationMonths: number;
    amountPKR: number | string;
    method: string;
    transactionId?: string;
    last4Digits?: string;
  }
): string {
  const cleanNumber = normalizeWhatsAppNumber(whatsappNumber);
  const message = buildWhatsAppMessage(request);
  return `https://wa.me/${cleanNumber}?text=${encodeURIComponent(message)}`;
}

/**
 * Default empty payment details structure with verified defaults.
 */
export const DEFAULT_PAYMENT_DETAILS: PaymentDetailsDoc = {
  jazzcash: {
    accountTitle: 'Saeedan Nagyaal',
    number: '03279306001'
  },
  meezan: {
    bankName: 'Meezan Bank',
    branch: '-',
    accountTitle: 'Syed Nangyal',
    accountNumber: '00300113961220',
    iban: ''
  },
  whatsappNumber: '',
  instructions: 'Please transfer the exact amount using JazzCash or Meezan Bank. After sending, enter your Transaction ID and the last 4 digits of your sending account below, or send proof directly via WhatsApp.'
};

/**
 * Loads payment details from settings/paymentDetails in database.
 */
export async function getPaymentDetails(): Promise<PaymentDetailsDoc> {
  try {
    const docRef = doc(db, 'settings', 'paymentDetails');
    const snap = await getDoc(docRef);

    if (snap.exists()) {
      const data = snap.data();
      return {
        jazzcash: {
          accountTitle: data.jazzcash?.accountTitle || '',
          number: data.jazzcash?.number || ''
        },
        meezan: {
          bankName: data.meezan?.bankName || 'Meezan Bank',
          branch: data.meezan?.branch || '',
          accountTitle: data.meezan?.accountTitle || '',
          accountNumber: data.meezan?.accountNumber || '',
          iban: data.meezan?.iban || ''
        },
        whatsappNumber: data.whatsappNumber || '',
        instructions: data.instructions || DEFAULT_PAYMENT_DETAILS.instructions,
        updatedAt: data.updatedAt
      };
    }
  } catch (err) {
    console.warn('Could not read settings/paymentDetails from database:', err);
  }

  return DEFAULT_PAYMENT_DETAILS;
}

/**
 * Saves payment details to settings/paymentDetails (Admin only).
 */
export async function savePaymentDetails(
  details: {
    jazzcash: JazzCashDetails;
    meezan: MeezanDetails;
    whatsappNumber: string;
    instructions: string;
  }
): Promise<void> {
  const docRef = doc(db, 'settings', 'paymentDetails');
  await setDoc(
    docRef,
    {
      jazzcash: {
        accountTitle: details.jazzcash.accountTitle.trim(),
        number: details.jazzcash.number.trim()
      },
      meezan: {
        bankName: details.meezan.bankName.trim() || 'Meezan Bank',
        branch: details.meezan.branch.trim(),
        accountTitle: details.meezan.accountTitle.trim(),
        accountNumber: details.meezan.accountNumber.trim(),
        iban: details.meezan.iban?.trim() || ''
      },
      whatsappNumber: details.whatsappNumber.trim().replace(/\D/g, ''),
      instructions: details.instructions.trim(),
      updatedAt: serverTimestamp()
    },
    { merge: true }
  );
}

/**
 * Submits a student payment request with document ID: {method}_{transactionId}.
 * Screenshots are NOT stored in the database. No new fields on paymentRequests.
 */
export interface CouponCheck {
  code: string;
  listPrice: number;
  discountAmount: number;
  finalAmount: number;
}

/**
 * Asks the server whether a coupon applies to this plan/year for the signed-in student.
 * The server repeats the check when the payment request is submitted.
 */
export async function validateCoupon(code: string, planId: string, yearId: string): Promise<CouponCheck> {
  const r = await api('/coupons/validate', { code: code.trim(), planId, yearId });
  return {
    code: r.code,
    listPrice: r.listPrice,
    discountAmount: r.discountAmount,
    finalAmount: r.finalAmount
  };
}

export async function submitPaymentRequest(params: {
  userId: string;
  userName: string;
  userEmail: string;
  yearId: string;
  yearName: string;
  planId: string;
  planName: string;
  durationMonths: number;
  amountPKR: number | string;
  method: 'jazzcash' | 'meezan';
  transactionId: string;
  last4Digits: string;
  paymentTime: string;
  couponCode?: string;
}): Promise<string> {
  const cleanTxId = params.transactionId.trim();
  const docId = `${params.method}_${cleanTxId}`;
  const docRef = doc(db, 'paymentRequests', docId);

  // Check if identical request already exists
  const existing = await getDoc(docRef);
  if (existing.exists()) {
    throw new Error(
      `A payment request with Transaction ID "${cleanTxId}" for ${getPaymentMethodLabel(params.method)} has already been submitted.`
    );
  }

  await setDoc(docRef, {
    userId: params.userId,
    userName: params.userName,
    userEmail: params.userEmail,
    yearId: params.yearId,
    yearName: params.yearName,
    planId: params.planId,
    planName: params.planName,
    durationMonths: params.durationMonths,
    amountPKR: params.amountPKR,
    method: params.method,
    transactionId: cleanTxId,
    last4Digits: params.last4Digits.trim(),
    paymentTime: params.paymentTime.trim(),
    ...(params.couponCode ? { couponCode: params.couponCode } : {}),
    status: 'PENDING',
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp()
  });

  // Sync user document paymentStatus
  try {
    const userRef = doc(db, 'users', params.userId);
    await updateDoc(userRef, {
      paymentStatus: 'PENDING',
      selectedPlanId: params.planId,
      selectedPlanName: params.planName,
      planPrice: params.amountPKR,
      selectedYearId: params.yearId,
      selectedYearName: params.yearName
    });
  } catch (syncErr) {
    console.warn('Could not sync paymentStatus to user profile:', syncErr);
  }

  return docId;
}

/**
 * Fetches all payment requests for a student to show in their Payment history.
 */
export async function getUserPaymentRequests(userId: string): Promise<PaymentRequestDoc[]> {
  try {
    const q = query(
      collection(db, 'paymentRequests'),
      where('userId', '==', userId)
    );
    const snap = await getDocs(q);
    const results: PaymentRequestDoc[] = [];

    snap.forEach((d) => {
      const data = d.data();
      results.push({
        id: d.id,
        userId: data.userId || '',
        userName: data.userName || '',
        userEmail: data.userEmail || '',
        yearId: data.yearId || '',
        yearName: data.yearName || '',
        planId: data.planId || '',
        planName: data.planName || '',
        durationMonths: data.durationMonths || 0,
        amountPKR: data.amountPKR || 0,
        couponCode: data.couponCode || undefined,
        listPricePKR: data.listPricePKR,
        discountAmountPKR: data.discountAmountPKR,
        method: data.method || '',
        transactionId: data.transactionId || '',
        last4Digits: data.last4Digits || '',
        paymentTime: data.paymentTime || '',
        status: data.status || 'PENDING',
        adminNote: data.adminNote || '',
        hasProof: data.hasProof === true,
        createdAt: data.createdAt,
        updatedAt: data.updatedAt
      });
    });

    // Sort newest first
    results.sort((a, b) => {
      const timeA = a.createdAt?.toMillis ? a.createdAt.toMillis() : (a.createdAt?.seconds ? a.createdAt.seconds * 1000 : 0);
      const timeB = b.createdAt?.toMillis ? b.createdAt.toMillis() : (b.createdAt?.seconds ? b.createdAt.seconds * 1000 : 0);
      return timeB - timeA;
    });

    return results;
  } catch (err) {
    console.error('Failed to get user payment requests:', err);
    return [];
  }
}

/**
 * Fetches all payment requests across the system (Admin only).
 */
export async function getAllPaymentRequestsAdmin(): Promise<PaymentRequestDoc[]> {
  try {
    const q = query(collection(db, 'paymentRequests'), orderBy('createdAt', 'desc'));
    const snap = await getDocs(q);
    const results: PaymentRequestDoc[] = [];

    snap.forEach((d) => {
      const data = d.data();
      results.push({
        id: d.id,
        userId: data.userId || '',
        userName: data.userName || '',
        userEmail: data.userEmail || '',
        yearId: data.yearId || '',
        yearName: data.yearName || '',
        planId: data.planId || '',
        planName: data.planName || '',
        durationMonths: data.durationMonths || 0,
        amountPKR: data.amountPKR || 0,
        couponCode: data.couponCode || undefined,
        listPricePKR: data.listPricePKR,
        discountAmountPKR: data.discountAmountPKR,
        method: data.method || '',
        transactionId: data.transactionId || '',
        last4Digits: data.last4Digits || '',
        paymentTime: data.paymentTime || '',
        status: data.status || 'PENDING',
        adminNote: data.adminNote || '',
        hasProof: data.hasProof === true,
        createdAt: data.createdAt,
        updatedAt: data.updatedAt
      });
    });

    return results;
  } catch (err) {
    // Fallback if index on createdAt is building
    try {
      const snap = await getDocs(collection(db, 'paymentRequests'));
      const results: PaymentRequestDoc[] = [];
      snap.forEach((d) => {
        const data = d.data();
        results.push({
          id: d.id,
          userId: data.userId || '',
          userName: data.userName || '',
          userEmail: data.userEmail || '',
          yearId: data.yearId || '',
          yearName: data.yearName || '',
          planId: data.planId || '',
          planName: data.planName || '',
          durationMonths: data.durationMonths || 0,
          amountPKR: data.amountPKR || 0,
        couponCode: data.couponCode || undefined,
        listPricePKR: data.listPricePKR,
        discountAmountPKR: data.discountAmountPKR,
          method: data.method || '',
          transactionId: data.transactionId || '',
          last4Digits: data.last4Digits || '',
          paymentTime: data.paymentTime || '',
          status: data.status || 'PENDING',
          adminNote: data.adminNote || '',
        hasProof: data.hasProof === true,
          createdAt: data.createdAt,
          updatedAt: data.updatedAt
        });
      });

      results.sort((a, b) => {
        const timeA = a.createdAt?.toMillis ? a.createdAt.toMillis() : (a.createdAt?.seconds ? a.createdAt.seconds * 1000 : 0);
        const timeB = b.createdAt?.toMillis ? b.createdAt.toMillis() : (b.createdAt?.seconds ? b.createdAt.seconds * 1000 : 0);
        return timeB - timeA;
      });

      return results;
    } catch (fallbackErr) {
      console.error('Failed to get all payment requests:', fallbackErr);
      throw fallbackErr;
    }
  }
}

/**
 * Updates a payment request status and synchronizes the student's account approval status (Admin only).
 */
export async function updatePaymentRequestStatus(
  requestId: string,
  status: PaymentRequestStatus,
  adminNote?: string,
  userId?: string
): Promise<void> {
  if (!requestId || typeof requestId !== 'string' || !requestId.trim()) {
    throw new Error('Valid payment request ID is required.');
  }
  const cleanReqId = requestId.trim();
  const docRef = doc(db, 'paymentRequests', cleanReqId);
  const updatePayload: any = {
    status,
    updatedAt: serverTimestamp()
  };
  if (adminNote !== undefined) {
    updatePayload.adminNote = adminNote;
  }
  await setDoc(docRef, updatePayload, { merge: true });

  // Also synchronize user account approval
  try {
    let targetUserId = userId && typeof userId === 'string' && userId.trim() ? userId.trim() : undefined;
    let yearIdFromPayment: string | undefined;
    let yearNameFromPayment: string | undefined;

    const snap = await getDoc(docRef);
    if (snap.exists()) {
      const pData = snap.data();
      if (!targetUserId && pData?.userId && typeof pData.userId === 'string') {
        targetUserId = pData.userId.trim();
      }
      if (pData?.yearId) yearIdFromPayment = pData.yearId;
      if (pData?.yearName) yearNameFromPayment = pData.yearName;
    }

    if (targetUserId) {
      const userRef = doc(db, 'users', targetUserId);
      if (status === 'VERIFIED') {
        const updateData: any = {
          approvalStatus: 'APPROVED',
          paymentStatus: 'VERIFIED',
          approvedAt: serverTimestamp(),
          rejectedReason: ''
        };
        if (yearIdFromPayment) updateData.purchasedYearId = yearIdFromPayment;
        if (yearNameFromPayment) updateData.purchasedYearName = yearNameFromPayment;

        await setDoc(userRef, updateData, { merge: true });
      } else if (status === 'REJECTED') {
        await setDoc(
          userRef,
          {
            approvalStatus: 'REJECTED',
            paymentStatus: 'REJECTED',
            rejectedReason: adminNote || 'Payment could not be verified'
          },
          { merge: true }
        );
      }
    }
  } catch (syncErr) {
    console.warn('Could not sync user approvalStatus during payment update:', syncErr);
  }
}

export type ApprovalStatus = 'PENDING' | 'APPROVED' | 'REJECTED';
export type StudentPaymentStatus = 'UNPAID' | 'PENDING' | 'VERIFIED' | 'REJECTED';

export interface StudentSignupDoc {
  uid: string;
  fullName: string;
  email: string;
  college: string;
  academicYear: string;
  curriculum: string;
  selectedPlanId?: string;
  selectedPlanName?: string;
  planPrice?: string;
  approvalStatus: ApprovalStatus;
  paymentStatus: StudentPaymentStatus;
  approvedAt?: any;
  rejectedReason?: string;
  createdAt: any;
  latestPaymentRequest?: PaymentRequestDoc;
}

/**
 * Loads all student user signups along with their associated payment requests (Admin only).
 * Resilient to individual collection query errors.
 */
export async function getAllStudentSignupsAdmin(): Promise<StudentSignupDoc[]> {
  const studentsMap: Record<string, StudentSignupDoc> = {};

  // 1. Load payment requests first (most critical for verification)
  let allPayments: PaymentRequestDoc[] = [];
  try {
    allPayments = await getAllPaymentRequestsAdmin();
  } catch (err) {
    throw err;
  }

  // Map payments by userId
  const paymentsByUser: Record<string, PaymentRequestDoc> = {};
  allPayments.forEach((p) => {
    if (p.userId && !paymentsByUser[p.userId]) {
      paymentsByUser[p.userId] = p;
    }
  });

  // 2. Query users collection
  try {
    const profiles = await api('/admin/registrations');
    profiles.forEach(({id, data}: {id:string;data:any}) => {
      const latestPayment = paymentsByUser[id];

      const rawApproval = data.approvalStatus as ApprovalStatus | undefined;
      const approvalStatus: ApprovalStatus = rawApproval || (latestPayment?.status === 'VERIFIED' ? 'APPROVED' : 'PENDING');

      const rawPayment = data.paymentStatus as StudentPaymentStatus | undefined;
      const paymentStatus: StudentPaymentStatus = rawPayment || (
        latestPayment?.status === 'VERIFIED'
          ? 'VERIFIED'
          : latestPayment?.status === 'REJECTED'
          ? 'REJECTED'
          : latestPayment?.status === 'PENDING'
          ? 'PENDING'
          : 'UNPAID'
      );

      studentsMap[id] = {
        uid: id,
        fullName: data.fullName || latestPayment?.userName || 'Medical Student',
        email: data.email || latestPayment?.userEmail || '',
        college: data.college || 'Not specified',
        academicYear: data.academicYear || latestPayment?.yearName || 'Not specified',
        curriculum: data.curriculum || 'KMU',
        selectedPlanId: data.selectedPlanId || latestPayment?.planId,
        selectedPlanName: data.selectedPlanName || latestPayment?.planName,
        planPrice: data.planPrice || (latestPayment?.amountPKR ? String(latestPayment.amountPKR) : undefined),
        approvalStatus,
        paymentStatus,
        approvedAt: data.approvedAt,
        rejectedReason: data.rejectedReason,
        createdAt: data.createdAt || latestPayment?.createdAt,
        latestPaymentRequest: latestPayment
      };
    });
  } catch (usersErr) {
    throw usersErr;
  }

  // 3. For any payment request whose user wasn't in usersMap, add synthesized student entry
  allPayments.forEach((p) => {
    if (p.userId && !studentsMap[p.userId]) {
      studentsMap[p.userId] = {
        uid: p.userId,
        fullName: p.userName || 'Medical Student',
        email: p.userEmail || '',
        college: 'From Payment',
        academicYear: p.yearName || 'MBBS',
        curriculum: 'KMU',
        selectedPlanId: p.planId,
        selectedPlanName: p.planName,
        planPrice: String(p.amountPKR || ''),
        approvalStatus: p.status === 'VERIFIED' ? 'APPROVED' : p.status === 'REJECTED' ? 'REJECTED' : 'PENDING',
        paymentStatus: p.status === 'VERIFIED' ? 'VERIFIED' : p.status === 'REJECTED' ? 'REJECTED' : 'PENDING',
        approvedAt: p.updatedAt,
        rejectedReason: p.adminNote,
        createdAt: p.createdAt,
        latestPaymentRequest: p
      };
    }
  });

  const students = Object.values(studentsMap);

  // Sort: Pending approval first, then newest
  students.sort((a, b) => {
    if (a.approvalStatus === 'PENDING' && b.approvalStatus !== 'PENDING') return -1;
    if (a.approvalStatus !== 'PENDING' && b.approvalStatus === 'PENDING') return 1;

    const timeA = a.createdAt?.toMillis ? a.createdAt.toMillis() : (a.createdAt?.seconds ? a.createdAt.seconds * 1000 : 0);
    const timeB = b.createdAt?.toMillis ? b.createdAt.toMillis() : (b.createdAt?.seconds ? b.createdAt.seconds * 1000 : 0);
    return timeB - timeA;
  });

  return students;
}

/**
 * Approves a student's sign-up account and marks payment as verified.
 * Resilient: uses setDoc with merge: true and resolves userId from payment if needed.
 */
export async function approveStudentAccount(
  userId: string,
  requestId?: string,
  adminNote?: string
): Promise<void> {
  let targetUserId = userId && typeof userId === 'string' && userId.trim() ? userId.trim() : '';
  const cleanReqId = requestId && typeof requestId === 'string' && requestId.trim() ? requestId.trim() : '';
  let yearIdFromPayment: string | undefined;
  let yearNameFromPayment: string | undefined;

  // 1. If a payment request exists, mark it as VERIFIED
  if (cleanReqId) {
    const paymentRef = doc(db, 'paymentRequests', cleanReqId);
    await setDoc(
      paymentRef,
      {
        status: 'VERIFIED',
        adminNote: adminNote || 'Approved by administrator',
        updatedAt: serverTimestamp()
      },
      { merge: true }
    );

    try {
      const snap = await getDoc(paymentRef);
      if (snap.exists()) {
        const pData = snap.data();
        if (!targetUserId && pData?.userId) {
          targetUserId = pData.userId;
        }
        if (pData?.yearId) yearIdFromPayment = pData.yearId;
        if (pData?.yearName) yearNameFromPayment = pData.yearName;
      }
    } catch (e) {
      console.warn('Could not read payment request for userId resolution:', e);
    }
  }

  // 2. Update student user document (if userId is available)
  if (targetUserId) {
    try {
      const userRef = doc(db, 'users', targetUserId);
      const updateData: any = {
        approvalStatus: 'APPROVED',
        paymentStatus: 'VERIFIED',
        approvedAt: serverTimestamp(),
        rejectedReason: ''
      };
      if (yearIdFromPayment) updateData.purchasedYearId = yearIdFromPayment;
      if (yearNameFromPayment) updateData.purchasedYearName = yearNameFromPayment;

      await setDoc(userRef, updateData, { merge: true });
    } catch (uErr: any) {
      console.warn('Could not update users document directly:', uErr);
      // If payment was verified, don't throw fatal error if only user doc update was denied
      if (!cleanReqId) {
        throw uErr;
      }
    }
  } else if (!cleanReqId) {
    throw new Error('Valid student user ID or payment request ID is required.');
  }
}

/**
 * Rejects a student's sign-up account / payment request.
 */
export async function rejectStudentAccount(
  userId: string,
  requestId?: string,
  reason?: string
): Promise<void> {
  let targetUserId = userId && typeof userId === 'string' && userId.trim() ? userId.trim() : '';
  const cleanReqId = requestId && typeof requestId === 'string' && requestId.trim() ? requestId.trim() : '';
  const cleanReason = reason?.trim() || 'Payment or registration could not be verified.';

  if (cleanReqId) {
    const paymentRef = doc(db, 'paymentRequests', cleanReqId);
    await setDoc(
      paymentRef,
      {
        status: 'REJECTED',
        adminNote: cleanReason,
        updatedAt: serverTimestamp()
      },
      { merge: true }
    );

    if (!targetUserId) {
      try {
        const snap = await getDoc(paymentRef);
        if (snap.exists() && snap.data()?.userId) {
          targetUserId = snap.data().userId;
        }
      } catch (e) {
        console.warn('Could not read payment request for userId:', e);
      }
    }
  }

  if (targetUserId) {
    try {
      const userRef = doc(db, 'users', targetUserId);
      await setDoc(
        userRef,
        {
          approvalStatus: 'REJECTED',
          paymentStatus: 'REJECTED',
          rejectedReason: cleanReason
        },
        { merge: true }
      );
    } catch (uErr: any) {
      console.warn('Could not update user document directly during rejection:', uErr);
      if (!cleanReqId) {
        throw uErr;
      }
    }
  } else if (!cleanReqId) {
    throw new Error('Valid student user ID or payment request ID is required.');
  }
}

