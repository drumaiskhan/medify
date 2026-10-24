import { YearDoc } from '../services/curriculum';
import { PaymentRequestDoc } from '../services/payments';

export interface StudentAccessInfo {
  isSubscribed: boolean;
  purchasedYearId?: string;
  purchasedYearName?: string;
  academicYear?: string;
  /** Every year with an unexpired subscription (a student may hold several). */
  years?: { yearId: string; yearName?: string }[];
}

/**
 * Extracts the standardized MBBS year ordinal ('1', '2', '3', '4', 'final') from any year identifier or string.
 */
export function extractYearOrdinal(text: string | undefined | null): string | null {
  if (!text) return null;
  const lower = text.toLowerCase().trim();

  if (lower.includes('1st') || lower.includes('first') || lower.includes('year 1') || lower.includes('year-1') || lower.startsWith('1')) {
    return '1';
  }
  if (lower.includes('2nd') || lower.includes('second') || lower.includes('year 2') || lower.includes('year-2') || lower.startsWith('2')) {
    return '2';
  }
  if (lower.includes('3rd') || lower.includes('third') || lower.includes('year 3') || lower.includes('year-3') || lower.startsWith('3')) {
    return '3';
  }
  if (lower.includes('4th') || lower.includes('fourth') || lower.includes('year 4') || lower.includes('year-4') || lower.startsWith('4')) {
    return '4';
  }
  if (lower.includes('5th') || lower.includes('fifth') || lower.includes('final') || lower.includes('year 5') || lower.includes('year-5') || lower.startsWith('5')) {
    return 'final';
  }

  return null;
}

/**
 * Checks if a YearDoc matches a student's purchased or enrolled year.
 */
export function isMatchingYear(
  year: { id: string; name: string } | null | undefined,
  targetYear: { yearId?: string; yearName?: string; academicYear?: string } | string | null | undefined
): boolean {
  if (!year || !targetYear) return false;

  const targetId = typeof targetYear === 'string' ? targetYear : targetYear.yearId;
  const targetName = typeof targetYear === 'string' ? targetYear : (targetYear.yearName || targetYear.academicYear);

  // Exact ID match
  if (targetId && (year.id.toLowerCase() === targetId.toLowerCase())) {
    return true;
  }

  // Exact name match
  if (targetName && (year.name.toLowerCase().trim() === targetName.toLowerCase().trim())) {
    return true;
  }

  // Compare ordinals ('1', '2', '3', '4', 'final')
  const yearOrdinal = extractYearOrdinal(year.name) || extractYearOrdinal(year.id);
  const targetOrdinal = extractYearOrdinal(targetId) || extractYearOrdinal(targetName);

  if (yearOrdinal && targetOrdinal && yearOrdinal === targetOrdinal) {
    return true;
  }

  return false;
}

/**
 * Resolves a student's active subscription and purchased class package.
 */
export function getStudentAccessInfo(
  profile: {
    approvalStatus?: string;
    paymentStatus?: string;
    academicYear?: string;
    purchasedYearId?: string;
    purchasedYearName?: string;
    selectedYearId?: string;
    access?: { expired?: boolean; years?: { yearId: string; yearName?: string; active: boolean }[] };
  } | null | undefined,
  paymentRequests: PaymentRequestDoc[] = []
): StudentAccessInfo {
  if (!profile) {
    return { isSubscribed: false };
  }

  // The server computes expiry; an expired subscription has no access.
  if (profile.access?.expired) {
    return { isSubscribed: false, academicYear: profile.academicYear };
  }

  // Check verified payments
  const verifiedPayment = paymentRequests.find((r) => r.status === 'VERIFIED');
  const isApproved = profile.approvalStatus === 'APPROVED' || profile.paymentStatus === 'VERIFIED' || Boolean(verifiedPayment);

  if (!isApproved) {
    return {
      isSubscribed: false,
      academicYear: profile.academicYear
    };
  }

  const purchasedYearId = profile.purchasedYearId || verifiedPayment?.yearId || profile.selectedYearId;
  const purchasedYearName = profile.purchasedYearName || verifiedPayment?.yearName || profile.academicYear;

  return {
    isSubscribed: true,
    purchasedYearId,
    purchasedYearName,
    academicYear: profile.academicYear,
    years: (profile.access?.years || []).filter((y) => y.active)
  };
}

/**
 * Filters the list of published years for a student.
 * If the student has purchased a package (isSubscribed) and is NOT an admin:
 * ONLY returns that student's respective class notes package year!
 */
export function filterYearsForStudent(
  years: YearDoc[],
  access: StudentAccessInfo | null | undefined,
  isAdmin: boolean = false
): YearDoc[] {
  if (isAdmin || !access || !access.isSubscribed) {
    return years;
  }

  const matching = access.years && access.years.length > 0
    ? years.filter((y) => access.years!.some((a) => isMatchingYear(y, { yearId: a.yearId, yearName: a.yearName })))
    : years.filter((y) => isMatchingYear(y, access));
  // If matched at least one year, return only the matching year(s)
  if (matching.length > 0) {
    return matching;
  }

  // Never expose other years when an entitlement cannot be matched.
  return [];
}
