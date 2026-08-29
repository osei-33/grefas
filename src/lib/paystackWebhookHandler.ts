import crypto from "crypto";

export interface PaystackWebhookCustomer {
  id?: number;
  first_name?: string;
  last_name?: string;
  email: string;
  customer_code?: string;
  phone?: string;
  metadata?: Record<string, any>;
}

export interface PaystackWebhookData {
  id: number;
  domain: string;
  status: "success" | "failed" | "abandoned" | "reversed" | string;
  reference: string;
  amount: number; // in pesewas / smallest unit
  message?: string;
  gateway_response: string;
  paid_at?: string;
  created_at?: string;
  channel: string;
  currency: string;
  ip_address?: string;
  metadata?: Record<string, any>;
  customer: PaystackWebhookCustomer;
  authorization?: {
    authorization_code?: string;
    bin?: string;
    last4?: string;
    exp_month?: string;
    exp_year?: string;
    channel?: string;
    card_type?: string;
    bank?: string;
    country_code?: string;
    brand?: string;
    reusable?: boolean;
  };
  plan?: Record<string, any>;
  subaccount?: Record<string, any>;
  fees?: number;
  paidAt?: string;
  createdAt?: string;
}

export interface PaystackWebhookEvent {
  event:
    | "charge.success"
    | "charge.failed"
    | "transfer.success"
    | "transfer.failed"
    | "transfer.reversed"
    | "refund.processed"
    | "refund.failed"
    | "invoice.create"
    | "invoice.update"
    | "invoice.payment_failed"
    | "subscription.create"
    | "subscription.disable"
    | string;
  data: PaystackWebhookData;
}

export interface ProcessedWebhookLog {
  id: string;
  event: string;
  reference: string;
  status: "success" | "failed" | "processed" | "warning";
  amount: number;
  amountInGhs: number;
  customerEmail: string;
  customerPhone?: string;
  channel: string;
  gatewayResponse: string;
  signatureVerified: boolean;
  receivedAt: string;
  rawEvent?: any;
}

// In-memory store for recent webhook events (kept up to 100 entries)
const webhookEventsStore: ProcessedWebhookLog[] = [];

/**
 * Validates the cryptographic HMAC SHA-512 signature sent by Paystack
 * in the 'x-paystack-signature' header.
 */
export function verifyPaystackSignature(
  rawBody: Buffer | string,
  signatureHeader?: string | string[],
  secretKey?: string
): { isValid: boolean; reason?: string } {
  const secret = secretKey || process.env.PAYSTACK_SECRET_KEY || "";

  // In sandbox / development mode without a configured key, permit dev simulation
  if (!secret) {
    return {
      isValid: true,
      reason: "No PAYSTACK_SECRET_KEY configured; running in development / sandbox acceptance mode."
    };
  }

  if (!signatureHeader) {
    return {
      isValid: false,
      reason: "Missing 'x-paystack-signature' header in webhook request."
    };
  }

  const signature = Array.isArray(signatureHeader) ? signatureHeader[0] : signatureHeader;

  try {
    const rawContent = Buffer.isBuffer(rawBody) ? rawBody : Buffer.from(typeof rawBody === "string" ? rawBody : JSON.stringify(rawBody));
    const computedHash = crypto
      .createHmac("sha512", secret)
      .update(rawContent)
      .digest("hex");

    const isMatch = computedHash === signature.trim();

    return {
      isValid: isMatch,
      reason: isMatch ? "HMAC-SHA512 signature verified successfully." : "Computed signature did not match x-paystack-signature header."
    };
  } catch (err: any) {
    return {
      isValid: false,
      reason: `Signature calculation error: ${err.message}`
    };
  }
}

/**
 * Records and processes a verified Paystack Webhook Event
 */
export function recordWebhookEvent(
  event: PaystackWebhookEvent,
  signatureVerified: boolean
): ProcessedWebhookLog {
  const data = event.data || ({} as PaystackWebhookData);
  const rawAmount = Number(data.amount) || 0;
  const amountInGhs = rawAmount / 100;

  const logEntry: ProcessedWebhookLog = {
    id: `wh_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
    event: event.event,
    reference: data.reference || "N/A",
    status:
      event.event === "charge.success" || data.status === "success"
        ? "success"
        : event.event === "charge.failed" || data.status === "failed"
        ? "failed"
        : "processed",
    amount: rawAmount,
    amountInGhs,
    customerEmail: data.customer?.email || (data.metadata?.user_email as string) || "N/A",
    customerPhone: data.customer?.phone || (data.metadata?.phone as string) || undefined,
    channel: data.channel || (data.authorization?.channel as string) || "momo",
    gatewayResponse: data.gateway_response || data.message || "Processed by Paystack Webhook",
    signatureVerified,
    receivedAt: new Date().toISOString(),
    rawEvent: event
  };

  webhookEventsStore.unshift(logEntry);
  if (webhookEventsStore.length > 100) {
    webhookEventsStore.pop();
  }

  return logEntry;
}

/**
 * Retrieves the recorded webhook events
 */
export function getWebhookEvents(filter?: { reference?: string; event?: string }): ProcessedWebhookLog[] {
  if (!filter) return [...webhookEventsStore];

  return webhookEventsStore.filter((item) => {
    if (filter.reference && !item.reference.toLowerCase().includes(filter.reference.toLowerCase())) {
      return false;
    }
    if (filter.event && item.event !== filter.event) {
      return false;
    }
    return true;
  });
}

/**
 * Google Cloud Function / Firebase Cloud Functions compatible handler
 * Usage in Cloud Functions:
 * export const paystackWebhook = createCloudFunctionHandler();
 */
export function createCloudFunctionHandler(options?: {
  secretKey?: string;
  onPaymentSuccess?: (event: PaystackWebhookEvent, log: ProcessedWebhookLog) => Promise<void>;
  onPaymentFailure?: (event: PaystackWebhookEvent, log: ProcessedWebhookLog) => Promise<void>;
}) {
  return async (req: any, res: any) => {
    // Only accept POST requests
    if (req.method !== "POST") {
      res.setHeader("Allow", "POST");
      return res.status(405).json({ status: false, error: "Method Not Allowed" });
    }

    const signature = req.headers["x-paystack-signature"];
    const rawBody = req.rawBody || req.body;

    const verification = verifyPaystackSignature(rawBody, signature, options?.secretKey);

    // Reject unverified requests if in production with secret key
    const secretKey = options?.secretKey || process.env.PAYSTACK_SECRET_KEY;
    if (secretKey && !verification.isValid) {
      console.warn("Paystack Webhook Unauthorized:", verification.reason);
      return res.status(401).json({
        status: false,
        error: "Unauthorized Paystack Webhook Signature",
        message: verification.reason
      });
    }

    try {
      let eventPayload: PaystackWebhookEvent;
      if (typeof req.body === "string") {
        eventPayload = JSON.parse(req.body);
      } else if (Buffer.isBuffer(req.body)) {
        eventPayload = JSON.parse(req.body.toString("utf8"));
      } else {
        eventPayload = req.body;
      }

      const log = recordWebhookEvent(eventPayload, verification.isValid);
      console.log(`[Paystack Webhook Cloud Function] Event: ${eventPayload.event} | Ref: ${log.reference} | Status: ${log.status} | GHS ${log.amountInGhs}`);

      // Async event actions
      if (eventPayload.event === "charge.success" && options?.onPaymentSuccess) {
        options.onPaymentSuccess(eventPayload, log).catch((err) => {
          console.error("Error in onPaymentSuccess handler:", err);
        });
      } else if (eventPayload.event === "charge.failed" && options?.onPaymentFailure) {
        options.onPaymentFailure(eventPayload, log).catch((err) => {
          console.error("Error in onPaymentFailure handler:", err);
        });
      }

      // Always return 200 OK fast to Paystack
      return res.status(200).json({
        status: true,
        message: "Webhook event received and verified successfully",
        event: eventPayload.event,
        reference: log.reference
      });
    } catch (err: any) {
      console.error("Failed to parse Paystack webhook payload:", err);
      // Return 200 so Paystack does not retry endlessly on malformed payloads
      return res.status(200).json({
        status: false,
        warning: "Payload received with warnings",
        error: err.message
      });
    }
  };
}

/**
 * Standard pre-configured Google Cloud Function / Firebase Functions export
 * Usage:
 * exports.paystackWebhook = paystackCloudFunction;
 */
export const paystackCloudFunction = createCloudFunctionHandler();

