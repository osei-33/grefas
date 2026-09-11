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
 * Validate that a string conforms to a real Paystack public key (pk_test_... or pk_live_...)
 */
export function isValidPaystackPublicKey(key?: string): boolean {
  if (!key || typeof key !== 'string') return false;
  const trimmed = key.trim();
  if (
    trimmed.includes('sample') ||
    trimmed.includes('placeholder') ||
    trimmed.includes('your_key') ||
    trimmed === 'pk_test_' ||
    trimmed === 'pk_live_' ||
    trimmed === 'pk_test_sample_key'
  ) {
    return false;
  }
  return /^pk_(test|live)_[a-zA-Z0-9_\-]{15,}$/.test(trimmed);
}

/**
 * Renders an interactive in-app sandbox modal when live Paystack credentials are not configured.
 * This guarantees the user or client never encounters Paystack's "Please enter a valid Key" error screen.
 */
function renderPaystackSandboxModal(
  options: OpenPaystackModalOptions,
  ref: string,
  amountInPesewas: number
): void {
  // Remove any existing sandbox overlay
  const existing = document.getElementById('paystack-sandbox-modal-container');
  if (existing) existing.remove();

  const container = document.createElement('div');
  container.id = 'paystack-sandbox-modal-container';
  container.style.position = 'fixed';
  container.style.inset = '0';
  container.style.zIndex = '999999';
  container.style.display = 'flex';
  container.style.alignItems = 'center';
  container.style.justifyContent = 'center';
  container.style.backgroundColor = 'rgba(0, 0, 0, 0.75)';
  container.style.backdropFilter = 'blur(4px)';
  container.style.padding = '16px';
  container.style.fontFamily = 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';

  const titleText = options.metadata?.serviceTitle || options.metadata?.roleType || 'Payment Authorization';
  const customerName = options.metadata?.fullName || 'Client';
  const customerPhone = options.metadata?.phone || '';

  container.innerHTML = `
    <div style="background: #18181b; color: #f4f4f5; border: 1px solid #27272a; border-radius: 16px; max-width: 440px; width: 100%; box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.5); overflow: hidden; animation: popIn 0.2s cubic-bezier(0.16, 1, 0.3, 1);">
      <style>
        @keyframes popIn {
          from { opacity: 0; transform: scale(0.95); }
          to { opacity: 1; transform: scale(1); }
        }
      </style>
      <!-- Header -->
      <div style="background: linear-gradient(135deg, #09090b, #18181b); padding: 18px 20px; border-bottom: 2px solid #10b981; display: flex; justify-content: space-between; align-items: center;">
        <div style="display: flex; align-items: center; gap: 10px;">
          <div style="background: rgba(16, 185, 129, 0.15); border: 1px solid rgba(16, 185, 129, 0.4); color: #34d399; font-weight: 900; width: 34px; height: 34px; border-radius: 8px; display: flex; align-items: center; justify-content: center; font-size: 14px;">
            P
          </div>
          <div>
            <div style="font-size: 10px; text-transform: uppercase; letter-spacing: 0.1em; color: #34d399; font-weight: 700;">
              Paystack Gateway Simulator
            </div>
            <div style="font-size: 15px; font-weight: 800; color: #ffffff;">
              Sandbox Test Checkout
            </div>
          </div>
        </div>
        <span style="background: #27272a; color: #a1a1aa; font-size: 11px; padding: 3px 8px; border-radius: 12px; font-weight: 600;">
          Test Mode
        </span>
      </div>

      <!-- Body -->
      <div style="padding: 20px;">
        <!-- Price Display -->
        <div style="background: #27272a; border-radius: 12px; padding: 14px; text-align: center; margin-bottom: 16px;">
          <div style="font-size: 11px; color: #a1a1aa; text-transform: uppercase; letter-spacing: 0.05em; font-weight: 600;">Amount Due</div>
          <div style="font-size: 28px; font-weight: 900; color: #10b981; font-family: monospace; margin-top: 2px;">
            GH₵ ${Number(options.amount).toFixed(2)}
          </div>
          <div style="font-size: 11px; color: #71717a; margin-top: 4px; font-family: monospace;">Ref: ${ref}</div>
        </div>

        <!-- Info details -->
        <div style="font-size: 12px; line-height: 1.6; color: #d4d4d8; background: #09090b; border: 1px solid #27272a; border-radius: 10px; padding: 12px; margin-bottom: 16px;">
          <div style="display: flex; justify-content: space-between; margin-bottom: 4px;">
            <span style="color: #71717a;">Customer:</span>
            <span style="font-weight: 600;">${customerName}</span>
          </div>
          <div style="display: flex; justify-content: space-between; margin-bottom: 4px;">
            <span style="color: #71717a;">Email:</span>
            <span style="font-weight: 600;">${options.email}</span>
          </div>
          ${customerPhone ? `
          <div style="display: flex; justify-content: space-between; margin-bottom: 4px;">
            <span style="color: #71717a;">Phone:</span>
            <span style="font-weight: 600;">${customerPhone}</span>
          </div>` : ''}
          <div style="display: flex; justify-content: space-between;">
            <span style="color: #71717a;">Purpose:</span>
            <span style="font-weight: 600; color: #6ee7b7;">${titleText}</span>
          </div>
        </div>

        <!-- Notice -->
        <div style="background: rgba(16, 185, 129, 0.08); border: 1px dashed rgba(16, 185, 129, 0.3); border-radius: 8px; padding: 10px; font-size: 11px; color: #a1a1aa; margin-bottom: 20px;">
          💡 <strong style="color: #34d399;">Sandbox Mode Active:</strong> Live Paystack public key is not set in environment variables. You can safely simulate and verify this transaction instantly.
        </div>

        <!-- Actions -->
        <div style="display: flex; flex-direction: column; gap: 8px;">
          <button id="paystack-sandbox-approve-btn" style="background: #10b981; hover:background: #059669; color: #ffffff; font-weight: 700; font-size: 14px; padding: 12px; border-radius: 10px; border: none; cursor: pointer; display: flex; align-items: center; justify-content: center; gap: 8px; transition: all 0.2s;">
            Simulate Approved Payment
          </button>
          <button id="paystack-sandbox-cancel-btn" style="background: transparent; color: #a1a1aa; font-weight: 600; font-size: 13px; padding: 10px; border-radius: 10px; border: 1px solid #27272a; cursor: pointer; transition: all 0.2s;">
            Cancel
          </button>
        </div>
      </div>
    </div>
  `;

  document.body.appendChild(container);

  const cleanup = () => {
    container.remove();
    window.removeEventListener('keydown', handleKey);
  };

  const handleKey = (e: KeyboardEvent) => {
    if (e.key === 'Escape') {
      cleanup();
      if (options.onCancel) options.onCancel();
    }
  };
  window.addEventListener('keydown', handleKey);

  const approveBtn = document.getElementById('paystack-sandbox-approve-btn');
  const cancelBtn = document.getElementById('paystack-sandbox-cancel-btn');

  if (approveBtn) {
    approveBtn.addEventListener('click', () => {
      approveBtn.textContent = 'Processing Authorization...';
      approveBtn.style.opacity = '0.7';
      approveBtn.style.pointerEvents = 'none';

      setTimeout(() => {
        cleanup();
        const simulatedReceipt = {
          id: Math.floor(100000000 + Math.random() * 900000000),
          status: 'success',
          reference: ref,
          amount: amountInPesewas,
          amountInGhs: Number(options.amount),
          channel: 'mobile_money',
          currency: options.currency || 'GHS',
          paid_at: new Date().toISOString(),
          gateway_response: 'Approved (Sandbox Simulator)',
          isDemo: true,
          customer: {
            email: options.email,
            phone: customerPhone
          },
          metadata: options.metadata || {}
        };
        options.onSuccess(simulatedReceipt);
      }, 500);
    });
  }

  if (cancelBtn) {
    cancelBtn.addEventListener('click', () => {
      cleanup();
      if (options.onCancel) options.onCancel();
    });
  }

  // Backdrop click
  container.addEventListener('click', (e) => {
    if (e.target === container) {
      cleanup();
      if (options.onCancel) options.onCancel();
    }
  });
}

/**
 * Open Paystack popup modal in browser with full parameter verification.
 * Automatically selects the best launch mechanism:
 * 1. Resumes server-generated access_code via PaystackPop.resumeTransaction (no client key required)
 * 2. Launches PaystackPop.newTransaction if a verified public key is provided
 * 3. Safely opens the authorization URL in a new tab if inline modal is blocked
 * 4. Gracefully renders the in-app Sandbox simulator if no live keys are configured (preventing "Please enter a valid Key" error)
 */
export async function openPaystackModal(options: OpenPaystackModalOptions): Promise<{ opened: boolean; reason?: string }> {
  if (typeof window === 'undefined') {
    return { opened: false, reason: 'SSR environment' };
  }

  const rawKey = options.publicKey || 
                 ((import.meta as any).env?.VITE_PAYSTACK_PUBLIC_KEY as string) || 
                 '';
  const hasValidKey = isValidPaystackPublicKey(rawKey);
  const isRealAccessCode = Boolean(options.access_code && !options.access_code.startsWith('demo_') && options.access_code.length > 5);
  const isRealAuthUrl = Boolean(
    options.authorization_url &&
    (options.authorization_url.startsWith('https://checkout.paystack.com/') ||
     options.authorization_url.startsWith('https://paystack.com/'))
  );

  const amountInPesewas = Math.round(Number(options.amount) * 100);
  const ref = options.reference || generatePaystackReference('GREFAS');
  const curr = options.currency || 'GHS';
  const channels = options.channels || ['card', 'mobile_money'];

  // Case 1: Server initialized a real Paystack access code
  // In @paystack/inline-js, resumeTransaction(accessCode) does NOT require a public key
  if (isRealAccessCode) {
    await loadPaystackInlineScript();
    try {
      const paystack = typeof PaystackPop === 'function' ? new PaystackPop() : null;
      if (paystack && typeof paystack.resumeTransaction === 'function') {
        paystack.resumeTransaction(options.access_code!, {
          onSuccess: (transaction: any) => {
            options.onSuccess(transaction);
          },
          onCancel: () => {
            if (options.onCancel) options.onCancel();
          }
        });
        return { opened: true, reason: 'resumed_access_code' };
      }
    } catch (resumeErr) {
      console.warn('Paystack resumeTransaction notice:', resumeErr);
    }
  }

  // Case 2: We have a verified, genuine Paystack public key
  if (hasValidKey) {
    await loadPaystackInlineScript();
    let modalTriggered = false;

    // Try @paystack/inline-js v2 SDK
    try {
      const paystack = typeof PaystackPop === 'function' ? new PaystackPop() : null;
      if (paystack && typeof paystack.newTransaction === 'function') {
        paystack.newTransaction({
          key: rawKey.trim(),
          email: options.email,
          amount: amountInPesewas,
          currency: curr,
          reference: ref,
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
        return { opened: true, reason: 'new_transaction_with_valid_key' };
      }
    } catch (sdkErr) {
      console.warn('@paystack/inline-js trigger exception:', sdkErr);
    }

    // Classic window.PaystackPop.setup fallback with valid key
    if (!modalTriggered && typeof (window as any).PaystackPop?.setup === 'function') {
      try {
        const handler = (window as any).PaystackPop.setup({
          key: rawKey.trim(),
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
          return { opened: true, reason: 'paystack_pop_setup_opened' };
        }
      } catch (legacyErr) {
        console.warn('window.PaystackPop.setup trigger exception:', legacyErr);
      }
    }
  }

  // Case 3: Real Paystack authorization URL
  if (isRealAuthUrl && options.authorization_url) {
    const newWin = window.open(options.authorization_url, '_blank', 'noopener,noreferrer');
    if (!newWin || newWin.closed || typeof newWin.closed === 'undefined') {
      window.location.href = options.authorization_url;
    }
    return { opened: true, reason: 'opened_external_url' };
  }

  // Case 4: No live keys or real Paystack session detected
  // Instead of passing a dummy key to Paystack which outputs "Please enter a valid Key",
  // open the high-fidelity in-app sandbox simulator modal.
  renderPaystackSandboxModal(options, ref, amountInPesewas);
  return { opened: true, reason: 'sandbox_simulator_modal' };
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


