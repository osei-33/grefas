/**
 * Paystack Payment Gateway Utility
 * Supports Ghanaian Cedis (GHS), MTN MoMo, Telecel Cash, AT Money, and Cards (Visa/Mastercard)
 */

export interface PaystackInitializeOptions {
  email: string;
  amount: number; // In GHS (e.g. 50 for GH₵ 50.00)
  currency?: string; // Default 'GHS'
  reference?: string;
  callback_url?: string;
  metadata?: Record<string, any>;
  channels?: ('card' | 'bank' | 'ussd' | 'qr' | 'mobile_money' | 'bank_transfer')[];
}

export interface PaystackInitResponse {
  status: boolean;
  message: string;
  data?: {
    authorization_url: string;
    access_code: string;
    reference: string;
  };
  error?: string;
  isDemo?: boolean;
}

export interface PaystackVerifyResponse {
  status: boolean;
  message: string;
  data?: {
    id: number;
    domain: string;
    status: 'success' | 'failed' | 'abandoned' | 'pending';
    reference: string;
    amount: number; // in pesewas
    amountInGhs: number; // in GHS
    gateway_response: string;
    paid_at?: string;
    channel: 'card' | 'mobile_money' | 'bank' | 'ussd' | string;
    currency: string;
    ip_address?: string;
    metadata?: Record<string, any>;
    customer?: {
      id: number;
      email: string;
      customer_code: string;
      phone?: string;
      first_name?: string;
      last_name?: string;
    };
    authorization?: {
      authorization_code: string;
      card_type?: string;
      last4?: string;
      exp_month?: string;
      exp_year?: string;
      bin?: string;
      bank?: string;
      channel: string;
      signature?: string;
      reusable?: boolean;
      country_code?: string;
      account_name?: string;
    };
  };
  error?: string;
  isDemo?: boolean;
}

/**
 * Generate a unique Paystack reference string
 */
export function generatePaystackReference(prefix: string = 'GREFAS'): string {
  const timestamp = Date.now();
  const randomStr = Math.random().toString(36).substring(2, 8).toUpperCase();
  return `${prefix}-${timestamp}-${randomStr}`;
}

/**
 * Initialize a Paystack transaction via the server proxy
 */
export async function initializePaystackPayment(
  options: PaystackInitializeOptions
): Promise<PaystackInitResponse> {
  const res = await fetch('/api/paystack/initialize', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(options),
  });

  if (!res.ok) {
    const errData = await res.json().catch(() => ({ error: 'Failed to initialize payment' }));
    throw new Error(errData.error || errData.message || 'Payment initialization failed');
  }

  return await res.json();
}

/**
 * Verify a Paystack transaction reference via the server proxy
 */
export async function verifyPaystackPayment(
  reference: string
): Promise<PaystackVerifyResponse> {
  const res = await fetch(`/api/paystack/verify/${encodeURIComponent(reference)}`);
  
  if (!res.ok) {
    const errData = await res.json().catch(() => ({ error: 'Verification network failed' }));
    throw new Error(errData.error || errData.message || 'Payment verification failed');
  }

  return await res.json();
}

/**
 * Get Paystack configuration and status
 */
export async function getPaystackConfig(): Promise<{
  configured: boolean;
  publicKey?: string;
  currency: string;
  supportedChannels: string[];
}> {
  try {
    const res = await fetch('/api/paystack/config');
    if (res.ok) {
      return await res.json();
    }
  } catch (err) {
    console.warn('Could not fetch Paystack config:', err);
  }
  return {
    configured: false,
    currency: 'GHS',
    supportedChannels: ['mobile_money', 'card', 'bank_transfer']
  };
}

/**
 * Load Paystack Inline script dynamically
 */
export function loadPaystackInlineScript(): Promise<boolean> {
  return new Promise((resolve) => {
    if (typeof window === 'undefined') return resolve(false);
    if ((window as any).PaystackPop) return resolve(true);

    const existingScript = document.querySelector('script[src="https://js.paystack.co/v1/inline.js"]');
    if (existingScript) {
      existingScript.addEventListener('load', () => resolve(true));
      existingScript.addEventListener('error', () => resolve(false));
      return;
    }

    const script = document.createElement('script');
    script.src = 'https://js.paystack.co/v1/inline.js';
    script.async = true;
    script.onload = () => resolve(true);
    script.onerror = () => resolve(false);
    document.body.appendChild(script);
  });
}
