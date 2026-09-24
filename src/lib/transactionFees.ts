/**
 * Grefas Consult & Entertainment - Transaction Fee Configuration & Calculator
 * 
 * Policy:
 * 1. Standard Business Transactions (Consultation Bookings, Casting & Audition Intakes, 
 *    Application Installments, Corporate Invoices):
 *    -> Attract a 1% transaction processing charge (0.01)
 * 
 * 2. Sponsorship & Donation Pages:
 *    -> STRICTLY EXEMPT from 1% charges (0% fee). 100% of the contributed funds 
 *       go directly to funding young talents, equipment, and community film projects.
 */

export const STANDARD_TRANSACTION_FEE_RATE = 0.01; // 1%
export const SPONSORSHIP_TRANSACTION_FEE_RATE = 0.0; // 0% (Exempt)

export interface TransactionChargeBreakdown {
  /** Base amount before any transaction charges (in GHS) */
  baseAmount: number;
  /** Fee rate in decimal, e.g. 0.01 for 1% */
  feeRate: number;
  /** Fee percentage formatted for display, e.g. "1%" or "0%" */
  feePercentageDisplay: string;
  /** Calculated fee amount rounded to 2 decimal places (in GHS) */
  feeAmount: number;
  /** Total amount payable including the fee (in GHS) */
  totalAmount: number;
  /** Whether this transaction is exempt from processing charges */
  isExempt: boolean;
  /** Explanatory note or reason for the fee calculation */
  description: string;
}

/**
 * Computes the transaction charge breakdown for any payment flow.
 * 
 * @param baseAmount The original price or fee before charges
 * @param options Configuration options including whether this is a sponsorship page
 */
export function calculateTransactionCharge(
  baseAmount: number | string,
  options?: {
    isSponsorship?: boolean;
    customFeeRate?: number;
    description?: string;
  }
): TransactionChargeBreakdown {
  const numericBase = Math.max(0, Number(baseAmount) || 0);
  const isSponsorship = Boolean(options?.isSponsorship);

  // Sponsorship and donation pages MUST NOT attract 1% charges
  if (isSponsorship) {
    return {
      baseAmount: numericBase,
      feeRate: 0,
      feePercentageDisplay: '0%',
      feeAmount: 0,
      totalAmount: numericBase,
      isExempt: true,
      description: options?.description || 'Sponsorship page (0% transaction charge exemption applied)',
    };
  }

  // Standard transactions attract 1% charge
  const feeRate = options?.customFeeRate !== undefined ? options.customFeeRate : STANDARD_TRANSACTION_FEE_RATE;
  const rawFee = numericBase * feeRate;
  const feeAmount = Math.round(rawFee * 100) / 100;
  const totalAmount = Math.round((numericBase + feeAmount) * 100) / 100;

  return {
    baseAmount: numericBase,
    feeRate,
    feePercentageDisplay: `${(feeRate * 100).toFixed(feeRate * 100 % 1 === 0 ? 0 : 1)}%`,
    feeAmount,
    totalAmount,
    isExempt: false,
    description: options?.description || 'Standard 1% transaction processing charge applied',
  };
}

/**
 * Format currency amount with GH₵ symbol and 2 decimal places
 */
export function formatGHS(amount: number | string): string {
  const num = Number(amount) || 0;
  return `GH₵ ${num.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}
