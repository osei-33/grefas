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
