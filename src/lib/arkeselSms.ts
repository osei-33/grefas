/**
 * Arkesel SMS Service Utility
 * For secure SMS dispatching and balance checking using Arkesel SMS Gateway.
 */

// Helper to clean the Arkesel API key (removing leading colon or spaces)
export function getCleanArkeselKey(rawKey: string | undefined): string {
  if (!rawKey) return "";
  let key = rawKey.trim();
  if (key.startsWith(":")) {
    key = key.substring(1);
  }
  return key;
}

/**
 * Checks the balance of the configured Arkesel SMS account.
 * Tries the check-balance GET endpoint first, then V2 POST balance endpoint, and V1 balance inquiry.
 */
export async function checkArkeselBalance(): Promise<{
  success: boolean;
  status: string;
  balance?: any;
  error?: string | null;
}> {
  const rawApiKey = process.env.ARKESEL_SMS_API_KEY || "OnJGNTZEM2hQOG1peWloUFY=";
  const apiKey = getCleanArkeselKey(rawApiKey);

  if (!apiKey) {
    return {
      success: false,
      status: "Not Configured",
      error: "No Arkesel API key configured",
    };
  }

  // Try check-balance GET endpoint first
  try {
    const checkUrl = `https://sms.arkesel.com/sms/api?action=check-balance&api_key=${encodeURIComponent(apiKey)}&response=json`;
    const checkRes = await fetch(checkUrl);
    const rawResponse = await checkRes.text();

    if (checkRes.ok) {
      try {
        const data = JSON.parse(rawResponse);
        if (data && (data.code === "102" || data.message === "Authentication Failed" || data.status === "error" || (data.message && data.message.includes("Invalid key")))) {
          return {
            success: false,
            status: "Invalid API Key",
            error: data.message || "Authentication Failed",
          };
        }
        return {
          success: true,
          status: "Configured",
          balance: data,
        };
      } catch (e) {
        if (rawResponse.toLowerCase().includes("authentication failed") || rawResponse.toLowerCase().includes("invalid key") || rawResponse.includes("102")) {
          return {
            success: false,
            status: "Invalid API Key",
            error: "Authentication Failed",
          };
        }
        return {
          success: true,
          status: "Configured",
          balance: { balance: rawResponse },
        };
      }
    }
  } catch (err: any) {
    console.warn("[Arkesel Utility] check-balance failed, trying Arkesel V2 Clients Balance...", err.message);
  }

  // Fallback to Arkesel V2 Clients Balance
  try {
    const response = await fetch("https://sms.arkesel.com/api/v2/clients/balance", {
      method: "GET",
      headers: {
        "api-key": apiKey,
        "Accept": "application/json",
      },
    });
    const rawResponse = await response.text();

    if (response.ok) {
      try {
        const data = JSON.parse(rawResponse);
        return {
          success: true,
          status: "Configured",
          balance: data.data !== undefined ? data.data : data,
        };
      } catch (e) {
        return {
          success: true,
          status: "Configured",
          balance: { raw: rawResponse },
        };
      }
    }
  } catch (err: any) {
    console.warn("[Arkesel Utility] Arkesel V2 clients balance check failed, trying v1 style bal-inquiry...", err.message);
  }

  // Fallback to V1 style bal-inquiry
  try {
    const v1Url = `https://sms.arkesel.com/sms/api?action=bal-inquiry&api_key=${encodeURIComponent(apiKey)}&to_json=1`;
    const v1Res = await fetch(v1Url);
    const v1Text = await v1Res.text();

    if (v1Res.ok) {
      try {
        const data = JSON.parse(v1Text);
        if (data && (data.code === "102" || data.message === "Authentication Failed" || data.status === "error" || (data.message && data.message.includes("Invalid key")))) {
          return {
            success: false,
            status: "Invalid API Key",
            error: data.message || "Authentication Failed",
          };
        }
        return {
          success: true,
          status: "Configured",
          balance: data,
        };
      } catch {
        if (v1Text.toLowerCase().includes("authentication failed") || v1Text.toLowerCase().includes("invalid key")) {
          return {
            success: false,
            status: "Invalid API Key",
            error: "Authentication Failed",
          };
        }
        return {
          success: true,
          status: "Configured",
          balance: { balance: v1Text },
        };
      }
    }
  } catch (err: any) {
    return {
      success: false,
      status: "Error",
      error: `All balance checking methods failed. Last error: ${err.message}`,
    };
  }

  return {
    success: false,
    status: "Error",
    error: "Failed to fetch balance from all endpoints",
  };
}

/**
 * Sends an SMS using Arkesel SMS Gateway.
 * Strips phone formatting, formats country codes, tries GET endpoint first, and falls back to V2 POST endpoint.
 */
export async function sendArkeselSms(
  phone: string,
  message: string,
  customSenderId?: string
): Promise<{
  success: boolean;
  status: string;
  error?: string | null;
}> {
  const rawApiKey = process.env.ARKESEL_SMS_API_KEY || "OnJGNTZEM2hQOG1peWloUFY=";
  const apiKey = getCleanArkeselKey(rawApiKey);
  const senderId = (customSenderId || process.env.ARKESEL_SENDER_ID || "Grefas")
    .trim()
    .substring(0, 11)
    .trim();

  if (!apiKey) {
    return {
      success: false,
      status: "failed (No Arkesel API key configured)",
      error: "No Arkesel API key configured",
    };
  }

  try {
    // Format the phone number (clean non-digits, format 0-start to 233)
    let formattedPhone = phone.replace(/[^\d+]/g, "");
    if (formattedPhone.startsWith("0") && formattedPhone.length === 10) {
      formattedPhone = "233" + formattedPhone.substring(1);
    } else if (formattedPhone.startsWith("+")) {
      formattedPhone = formattedPhone.substring(1);
    }

    console.log(`[Arkesel Utility] Dispatching SMS to ${formattedPhone} using GET endpoint...`);

    // Try GET endpoint first
    const getUrl = `https://sms.arkesel.com/sms/api?action=send-sms&api_key=${encodeURIComponent(apiKey)}&to=${encodeURIComponent(formattedPhone)}&from=${encodeURIComponent(senderId)}&sms=${encodeURIComponent(message)}`;
    const response = await fetch(getUrl);
    const resText = await response.text();

    const isAuthFailed =
      resText.includes("102") ||
      resText.toLowerCase().includes("authentication failed") ||
      resText.toLowerCase().includes("invalid key") ||
      resText.toLowerCase().includes("invalid_key");
    const isSmsSent =
      resText.includes("100") ||
      resText.toLowerCase().includes("success") ||
      resText.toLowerCase().includes("submitted") ||
      response.ok;

    if (isAuthFailed) {
      return {
        success: false,
        status: "failed (Invalid API Key)",
        error: "Invalid API Key",
      };
    }

    if (isSmsSent) {
      return {
        success: true,
        status: "sent",
      };
    }

    // Try V2 POST fallback
    console.log("[Arkesel Utility] GET endpoint returned non-standard response. Falling back to V2 POST...");
    const v2Response = await fetch("https://sms.arkesel.com/api/v2/sms/send", {
      method: "POST",
      headers: {
        "api-key": apiKey,
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify({
        sender: senderId,
        message: message,
        recipients: [formattedPhone],
      }),
    });

    const v2Text = await v2Response.text();
    let v2Json: any = {};
    try {
      v2Json = JSON.parse(v2Text);
    } catch {
      // ignore
    }

    if (
      v2Response.ok &&
      (v2Json.status === "success" || v2Json.code === 1000 || v2Text.toLowerCase().includes("success"))
    ) {
      return {
        success: true,
        status: "sent",
      };
    } else {
      const errMsg = v2Json.message || v2Json.error || v2Text || resText || "Unknown Arkesel error";
      const isV2AuthFailed =
        errMsg.toLowerCase().includes("invalid key") ||
        errMsg.toLowerCase().includes("authentication failed") ||
        errMsg.toLowerCase().includes("unauthorized") ||
        errMsg.toLowerCase().includes("invalid_key");

      return {
        success: false,
        status: isV2AuthFailed ? "failed (Invalid API Key)" : `failed (${errMsg})`,
        error: errMsg,
      };
    }
  } catch (err: any) {
    const errMsg = err.message || "";
    const isAuthFailed =
      errMsg.toLowerCase().includes("invalid key") ||
      errMsg.toLowerCase().includes("authentication failed") ||
      errMsg.toLowerCase().includes("unauthorized") ||
      errMsg.toLowerCase().includes("invalid_key");

    return {
      success: false,
      status: isAuthFailed ? "failed (Invalid API Key)" : `failed (${errMsg || "Error"})`,
      error: errMsg,
    };
  }
}

export interface NegotiationSmsPayload {
  phone: string;
  email?: string;
  name: string;
  serviceTitle: string;
  agreedPrice: number;
  originalPrice?: number;
  proposedPrice?: number;
  orderNumber?: string;
  adminNote?: string;
  actionType?: "approved" | "counter_offer" | "declined";
  customSmsMessage?: string;
}

export function buildNegotiationSmsMessage(payload: NegotiationSmsPayload): string {
  if (payload.customSmsMessage && payload.customSmsMessage.trim()) {
    return payload.customSmsMessage.trim();
  }
  const clientName = String(payload.name || "Valued Client").trim();
  const serviceName = String(payload.serviceTitle || "Service Order").trim();
  const numAgreed = Number(payload.agreedPrice || 0);
  const numOriginal = Number(payload.originalPrice || 0);
  const formattedAgreed = numAgreed.toLocaleString("en-GH", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  const orderRefPart = payload.orderNumber ? ` (Ref: ${payload.orderNumber})` : "";
  const savingsAmount = numOriginal > numAgreed && numAgreed > 0 ? numOriginal - numAgreed : 0;
  const savingsPart =
    savingsAmount > 0
      ? ` You save GHc ${savingsAmount.toLocaleString("en-GH", {
          minimumFractionDigits: 2,
          maximumFractionDigits: 2,
        })} off the standard rate.`
      : "";
  const notePart = payload.adminNote ? ` Note: "${String(payload.adminNote).trim()}"` : "";
  const action = payload.actionType || "approved";

  if (action === "counter_offer") {
    return `GREFAS CONSULT: Dear ${clientName}, Administration has reviewed your budget request for "${serviceName}"${orderRefPart} and proposed a counter-offer of GHc ${formattedAgreed}.${notePart} Visit our booking portal to review and accept.`;
  }
  if (action === "declined") {
    return `GREFAS CONSULT: Dear ${clientName}, regarding your budget proposal for "${serviceName}"${orderRefPart}, Administration is unable to approve the proposed amount at this time.${notePart} Please contact us or visit our portal for options.`;
  }
  return `GREFAS CONSULT: Dear ${clientName}, your agreed budget of GHc ${formattedAgreed} for "${serviceName}"${orderRefPart} has been APPROVED by Administration!${savingsPart}${notePart} Please visit our booking portal to proceed with your service. Thank you!`;
}

export async function sendNegotiatedPriceApprovedSms(
  payload: NegotiationSmsPayload
): Promise<{ success: boolean; simulated?: boolean; message: string; error?: string }> {
  const message = buildNegotiationSmsMessage(payload);
  const cleanPhone = String(payload.phone || "").trim();
  if (!cleanPhone) {
    return {
      success: false,
      message,
      error: "No client phone number provided for SMS dispatch.",
    };
  }

  try {
    const res = await fetch("/api/notifications/negotiation-approved", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...payload,
        phone: cleanPhone,
        customSmsMessage: message,
      }),
    });

    if (res.ok) {
      const data = await res.json().catch(() => ({}));
      if (data.smsDispatched || data.success) {
        return {
          success: true,
          simulated: Boolean(data.smsSimulated),
          message: data.message || message,
        };
      }
    }
  } catch (err) {
    console.warn("Primary negotiation-approved endpoint failed, falling back to /api/sms/send:", err);
  }

  try {
    const fallbackRes = await fetch("/api/sms/send", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        to: cleanPhone,
        message,
      }),
    });
    const fallbackData = await fallbackRes.json().catch(() => ({}));
    return {
      success: Boolean(fallbackRes.ok && fallbackData.success),
      simulated: Boolean(fallbackData.raw?.simulated),
      message,
      error: fallbackData.error,
    };
  } catch (err: any) {
    return {
      success: false,
      message,
      error: err?.message || "SMS network error",
    };
  }
}

