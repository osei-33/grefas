import PaystackPop from '@paystack/inline-js';

export { PaystackPop };

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
 * Submit order & pay via /save-order-and-pay endpoint
 */
export async function saveOrderAndPay(params: {
  user_email: string;
  amount: number | string;
  cartid?: string;
  currency?: string;
  callback_url?: string;
  metadata?: Record<string, any>;
}): Promise<PaystackInitResponse> {
  const res = await fetch('/save-order-and-pay', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: JSON.stringify(params),
  });

  if (!res.ok) {
    const errData = await res.json().catch(() => ({ error: 'Payment request failed' }));
    throw new Error(errData.error || errData.message || 'Payment initiation failed');
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

export interface OpenPaystackModalOptions {
  publicKey?: string;
  email: string;
  amount: number; // in GHS (e.g. 50.00)
  currency?: string; // default GHS
  reference?: string;
  access_code?: string;
  authorization_url?: string;
  channels?: ('card' | 'mobile_money' | 'bank_transfer' | string)[];
  metadata?: Record<string, any>;
  onSuccess: (receipt: any) => void;
  onCancel?: () => void;
}

/**
 * Open Paystack popup modal in browser with full parameter verification
 */
export async function openPaystackModal(options: OpenPaystackModalOptions): Promise<{ opened: boolean; reason?: string }> {
  if (typeof window === 'undefined') {
    return { opened: false, reason: 'SSR environment' };
  }

  // Ensure script is ready
  await loadPaystackInlineScript();

  const activeKey = options.publicKey || 
                    ((import.meta as any).env?.VITE_PAYSTACK_PUBLIC_KEY as string) || 
                    'pk_test_sample_key';
  const amountInPesewas = Math.round(Number(options.amount) * 100);
  const ref = options.reference || generatePaystackReference('GREFAS');
  const curr = options.currency || 'GHS';
  const channels = options.channels || ['card', 'mobile_money'];

  let modalTriggered = false;

  // Method 1: Try @paystack/inline-js v2 SDK
  try {
    const paystack = typeof PaystackPop === 'function' ? new PaystackPop() : null;
    if (paystack) {
      if (typeof paystack.newTransaction === 'function') {
        paystack.newTransaction({
          key: activeKey,
          email: options.email,
          amount: amountInPesewas,
          currency: curr,
          reference: ref,
          access_code: options.access_code,
          channels: channels as any,
          metadata: options.metadata || {},
          onSuccess: (transaction: any) => {
            options.onSuccess(transaction);
          },
          onCancel: () => {
            if (options.onCancel) options.onCancel();
          },
          onError: (err: any) => {
            console.warn('Paystack inline transaction error:', err);
          }
        });
        modalTriggered = true;
      } else if (options.access_code && typeof paystack.resumeTransaction === 'function') {
        paystack.resumeTransaction(options.access_code);
        modalTriggered = true;
      }
    }
  } catch (sdkErr) {
    console.warn('@paystack/inline-js trigger exception:', sdkErr);
  }

  // Method 2: Fallback to classic window.PaystackPop.setup
  if (!modalTriggered && typeof (window as any).PaystackPop?.setup === 'function') {
    try {
      const handler = (window as any).PaystackPop.setup({
        key: activeKey,
        email: options.email,
        amount: amountInPesewas,
        currency: curr,
        ref: ref,
        metadata: options.metadata || {},
        channels: channels,
        callback: (response: any) => {
          options.onSuccess(response);
        },
        onClose: () => {
          if (options.onCancel) options.onCancel();
        }
      });
      if (handler && typeof handler.openIframe === 'function') {
        handler.openIframe();
        modalTriggered = true;
      }
    } catch (legacyErr) {
      console.warn('window.PaystackPop.setup trigger exception:', legacyErr);
    }
  }

  // Method 3: If iframe modal blocked, open authorization URL
  if (!modalTriggered && options.authorization_url) {
    const newWin = window.open(options.authorization_url, '_blank', 'noopener,noreferrer');
    if (!newWin || newWin.closed || typeof newWin.closed === 'undefined') {
      window.location.href = options.authorization_url;
    }
    return { opened: true, reason: 'opened_external_url' };
  }

  return { opened: modalTriggered };
}

/**
 * Fetch received Paystack webhook events from the server
 */
export async function getPaystackWebhookEvents(params?: { reference?: string; event?: string }) {
  const query = new URLSearchParams();
  if (params?.reference) query.set('reference', params.reference);
  if (params?.event) query.set('event', params.event);
  const url = `/api/paystack/webhook/events${query.toString() ? `?${query.toString()}` : ''}`;
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error('Failed to fetch Paystack webhook events');
  }
  return await res.json();
}

/**
 * Fetch webhook event status for a specific reference
 */
export async function getPaystackWebhookByRef(reference: string) {
  const res = await fetch(`/api/paystack/webhook/events/${encodeURIComponent(reference)}`);
  if (!res.ok) {
    throw new Error('Failed to fetch webhook status for reference');
  }
  return await res.json();
}

/**
 * Local storage key prefix for preserving transaction data during redirects
 */
const PENDING_PAYMENT_PREFIX = 'grefas_pending_paystack_';

/**
 * Save pending payment and form state
 */
export function savePendingPayment(reference: string, data: any): void {
  if (typeof window === 'undefined') return;
  try {
    const payload = JSON.stringify({
      data,
      reference,
      createdAt: Date.now()
    });
    sessionStorage.setItem(`${PENDING_PAYMENT_PREFIX}${reference}`, payload);
    localStorage.setItem(`${PENDING_PAYMENT_PREFIX}last_ref`, reference);
    localStorage.setItem(`${PENDING_PAYMENT_PREFIX}${reference}`, payload);
  } catch (err) {
    console.warn('Failed to save pending payment state:', err);
  }
}

/**
 * Retrieve pending payment state by reference or fallback to last reference
 */
export function getPendingPayment(reference?: string): any | null {
  if (typeof window === 'undefined') return null;
  try {
    const ref = reference || localStorage.getItem(`${PENDING_PAYMENT_PREFIX}last_ref`);
    if (!ref) return null;

    const raw = sessionStorage.getItem(`${PENDING_PAYMENT_PREFIX}${ref}`) || 
                localStorage.getItem(`${PENDING_PAYMENT_PREFIX}${ref}`);
    if (!raw) return null;

    const parsed = JSON.parse(raw);
    return parsed?.data || null;
  } catch (err) {
    console.warn('Failed to retrieve pending payment state:', err);
    return null;
  }
}

/**
 * Clear pending payment data from storage
 */
export function clearPendingPayment(reference?: string): void {
  if (typeof window === 'undefined') return;
  try {
    const ref = reference || localStorage.getItem(`${PENDING_PAYMENT_PREFIX}last_ref`);
    if (ref) {
      sessionStorage.removeItem(`${PENDING_PAYMENT_PREFIX}${ref}`);
      localStorage.removeItem(`${PENDING_PAYMENT_PREFIX}${ref}`);
    }
    localStorage.removeItem(`${PENDING_PAYMENT_PREFIX}last_ref`);
  } catch (err) {
    console.warn('Failed to clear pending payment state:', err);
  }
}

/**
 * Trigger a simulated Paystack webhook event in test/sandbox mode
 */
export async function simulateTestWebhook(params: {
  event?: 'charge.success' | 'charge.failed' | string;
  amount?: number;
  reference?: string;
  email?: string;
  phone?: string;
  channel?: string;
}) {
  const res = await fetch('/api/paystack/webhook/test', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(params),
  });
  if (!res.ok) {
    throw new Error('Failed to simulate webhook event');
  }
  return await res.json();
}


