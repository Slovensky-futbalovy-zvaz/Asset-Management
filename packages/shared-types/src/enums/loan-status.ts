/**
 * Stavy žiadosti o zápožičku.
 *
 * Životný cyklus:
 *   PENDING → APPROVED → (zápožička vznikne)
 *   PENDING → REJECTED
 *   PENDING → CANCELLED (zrušil žiadateľ)
 */
export const LoanRequestStatus = {
  /** Vytvorená, čaká na schválenie správcom. */
  PENDING: 'PENDING',
  /** Schválená, môže byť prevzatá. */
  APPROVED: 'APPROVED',
  /** Zamietnutá správcom. */
  REJECTED: 'REJECTED',
  /** Zrušená žiadateľom pred schválením. */
  CANCELLED: 'CANCELLED',
} as const;

export type LoanRequestStatus = (typeof LoanRequestStatus)[keyof typeof LoanRequestStatus];

export const LOAN_REQUEST_STATUS_VALUES = Object.values(
  LoanRequestStatus,
) as readonly LoanRequestStatus[];

/**
 * Stavy aktívnej zápožičky.
 *
 * Životný cyklus:
 *   ACTIVE → RETURNED (vrátené v poriadku)
 *   ACTIVE → OVERDUE → RETURNED
 *   ACTIVE → OVERDUE → LOST
 *   ACTIVE → DAMAGED (vrátené poškodené, ide na servis)
 */
export const LoanStatus = {
  /** Aktívna zápožička, položka je u používateľa. */
  ACTIVE: 'ACTIVE',
  /** Termín vrátenia uplynul, ešte nevrátené. */
  OVERDUE: 'OVERDUE',
  /** Úspešne vrátené v poriadku. */
  RETURNED: 'RETURNED',
  /** Vrátené, ale poškodené — vyžaduje servis. */
  DAMAGED: 'DAMAGED',
  /** Stratené, nevrátené. */
  LOST: 'LOST',
} as const;

export type LoanStatus = (typeof LoanStatus)[keyof typeof LoanStatus];

export const LOAN_STATUS_VALUES = Object.values(LoanStatus) as readonly LoanStatus[];
