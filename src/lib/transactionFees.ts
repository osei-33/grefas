/**
 * Grefas Consult & Entertainment - Transaction Fee Configuration & Calculator
 * 
 * Policy:
 * 1. Admin Control:
 *    -> The platform admin has TOTAL CONTROL over the transaction fee.
 *    -> Can increase or decrease the percentage fee rate (e.g. 0.5%, 1%, 1.5%, 2.5%, etc.)
 *    -> Can disable it completely (0% fee across all operations)
 *    -> Can customize fee labels
 * 
 * 2. Sponsorship & Donation Pages:
 *    -> STRICTLY EXEMPT from charges (0% fee). 100% of the contributed funds 
 *       go directly to funding young talents, equipment, and community film projects.
 */

import { useState, useEffect } from 'react';
import { doc, onSnapshot } from 'firebase/firestore';
import { db } from '@/firebase';

export const STANDARD_TRANSACTION_FEE_RATE = 0.01; // 1% fallback default
export const SPONSORSHIP_TRANSACTION_FEE_RATE = 0.0; // 0% (Exempt)

export interface TransactionFeeConfig {
  /** Whether the transaction processing fee is active across commercial operations */
  enabled: boolean;
  /** Fee rate in percent (e.g., 1.0 for 1%, 2.5 for 2.5%, 0 for 0%) */
  ratePercent: number;
  /** Fee rate in decimal format (e.g. 0.01 for 1%) */
  feeRate: number;
  /** Label/title shown for the processing fee (e.g., 'Platform Processing Charge') */
  label: string;
  /** Whether sponsorships and donations are strictly 0% fee exempt (always true by policy) */
  exemptSponsorship: boolean;
}

// In-memory active configuration cache
let activeFeeConfig: TransactionFeeConfig = {
  enabled: true,
  ratePercent: 1.0,
  feeRate: 0.01,
  label: 'Platform Processing Charge',
  exemptSponsorship: true
};

// Event listener subscribers for reactive updates across components
type FeeListener = (config: TransactionFeeConfig) => void;
const listeners = new Set<FeeListener>();

function notifyListeners() {
  listeners.forEach(fn => {
    try {
      fn({ ...activeFeeConfig });
    } catch (e) {
      console.debug('Fee subscriber error:', e);
    }
  });
}

// Initialize Firestore real-time listener if in browser
if (typeof window !== 'undefined' && db) {
  try {
    onSnapshot(doc(db, 'settings', 'global'), (snap) => {
      if (snap.exists()) {
        const data = snap.data();
        
        // Check if fee is enabled (defaults to true if not explicitly false)
        const enabled = data.transactionFeeEnabled !== false;
        
        // Fee rate: support both ratePercent or transactionFeeRate
        let ratePercent = 1.0;
        if (data.transactionFeeRate !== undefined && data.transactionFeeRate !== null) {
          const num = Number(data.transactionFeeRate);
          if (!isNaN(num) && num >= 0) {
            // Handle if passed as decimal like 0.01 vs 1.0
            ratePercent = num;
          }
        }

        const feeRate = enabled ? Math.max(0, ratePercent) / 100 : 0;

        activeFeeConfig = {
          enabled,
          ratePercent,
          feeRate,
          label: data.transactionFeeLabel || 'Platform Processing Charge',
          exemptSponsorship: data.transactionFeeExemptSponsorship !== false
        };

        notifyListeners();
      }
    }, (err) => {
      console.debug('Settings fee listener handled notice:', err);
    });
  } catch (err) {
    console.debug('Error setting up settings fee listener:', err);
  }
}

/**
 * Returns current active fee configuration
 */
export function getActiveTransactionFeeConfig(): TransactionFeeConfig {
  return { ...activeFeeConfig };
}

/**
 * Manually update active fee config in memory (useful for optimistic UI updates in Admin)
 */
export function setLocalTransactionFeeConfig(partial: Partial<TransactionFeeConfig>) {
  activeFeeConfig = {
    ...activeFeeConfig,
    ...partial,
    feeRate: (partial.enabled !== undefined ? partial.enabled : activeFeeConfig.enabled) 
      ? Math.max(0, (partial.ratePercent !== undefined ? partial.ratePercent : activeFeeConfig.ratePercent)) / 100 
      : 0
  };
  notifyListeners();
}

export interface TransactionChargeBreakdown {
  /** Base amount before any transaction charges (in GHS) */
  baseAmount: number;
  /** Fee rate in decimal, e.g. 0.01 for 1% */
  feeRate: number;
  /** Fee percentage formatted for display, e.g. "1%", "2.5%", "0%", or "0% (Waived)" */
  feePercentageDisplay: string;
  /** Calculated fee amount rounded to 2 decimal places (in GHS) */
  feeAmount: number;
  /** Total amount payable including the fee (in GHS) */
  totalAmount: number;
  /** Whether this transaction is exempt from processing charges */
  isExempt: boolean;
  /** Whether transaction charges are currently disabled completely by admin */
  isDisabled: boolean;
  /** Explanatory note or reason for the fee calculation */
  description: string;
  /** Display label for the fee charge */
  label: string;
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
    enabled?: boolean;
    description?: string;
    label?: string;
  }
): TransactionChargeBreakdown {
  const numericBase = Math.max(0, Number(baseAmount) || 0);
  const isSponsorship = Boolean(options?.isSponsorship);

  // 1. Sponsorship and donation pages MUST NOT attract charges (0% fee exempt)
  if (isSponsorship) {
    return {
      baseAmount: numericBase,
      feeRate: 0,
      feePercentageDisplay: '0%',
      feeAmount: 0,
      totalAmount: numericBase,
      isExempt: true,
      isDisabled: false,
      description: options?.description || 'Sponsorship page (0% transaction charge exemption applied)',
      label: 'Sponsorship Exemption (0%)',
    };
  }

  // 2. Check if admin has disabled transaction fees completely
  const isEnabled = options?.enabled !== undefined ? options.enabled : activeFeeConfig.enabled;
  if (!isEnabled) {
    return {
      baseAmount: numericBase,
      feeRate: 0,
      feePercentageDisplay: '0%',
      feeAmount: 0,
      totalAmount: numericBase,
      isExempt: false,
      isDisabled: true,
      description: options?.description || 'Transaction fee currently waived/disabled by administration',
      label: options?.label || activeFeeConfig.label || 'Transaction Fee (Waived)',
    };
  }

  // 3. Compute dynamic fee rate (from options, active config, or fallback)
  const feeRate = options?.customFeeRate !== undefined 
    ? Math.max(0, options.customFeeRate) 
    : activeFeeConfig.feeRate;
    
  const rawFee = numericBase * feeRate;
  const feeAmount = Math.round(rawFee * 100) / 100;
  const totalAmount = Math.round((numericBase + feeAmount) * 100) / 100;

  const percentNumber = feeRate * 100;
  const percentDisplay = percentNumber === 0 
    ? '0%' 
    : `${Number(percentNumber.toFixed(2))}%`;

  return {
    baseAmount: numericBase,
    feeRate,
    feePercentageDisplay: percentDisplay,
    feeAmount,
    totalAmount,
    isExempt: false,
    isDisabled: feeRate === 0,
    description: options?.description || `Platform ${percentDisplay} transaction processing charge applied`,
    label: options?.label || activeFeeConfig.label || 'Platform Processing Charge',
  };
}

/**
 * Format currency amount with GH₵ symbol and 2 decimal places
 */
export function formatGHS(amount: number | string): string {
  const num = Number(amount) || 0;
  return `GH₵ ${num.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

/**
 * React hook to access and react to real-time transaction fee configuration
 */
export function useTransactionFee() {
  const [config, setConfig] = useState<TransactionFeeConfig>(activeFeeConfig);

  useEffect(() => {
    // Sync current
    setConfig({ ...activeFeeConfig });

    const handleUpdate = (updated: TransactionFeeConfig) => {
      setConfig(updated);
    };

    listeners.add(handleUpdate);
    return () => {
      listeners.delete(handleUpdate);
    };
  }, []);

  const calculate = (baseAmount: number | string, isSponsorship: boolean = false) => {
    return calculateTransactionCharge(baseAmount, {
      isSponsorship,
      enabled: config.enabled,
      customFeeRate: config.feeRate,
      label: config.label
    });
  };

  return {
    config,
    enabled: config.enabled,
    ratePercent: config.ratePercent,
    feeRate: config.feeRate,
    label: config.label,
    exemptSponsorship: config.exemptSponsorship,
    calculateCharge: calculate,
    formatGHS
  };
}
