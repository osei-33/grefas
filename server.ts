import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import https from "https";
import { Resend } from "resend";
import { jsPDF } from "jspdf";
import dotenv from "dotenv";
import compression from "compression";
import fs from "fs";
import { v2 as cloudinary } from "cloudinary";
import multer from "multer";
import { sendArkeselSms, checkArkeselBalance } from "./src/lib/arkeselSms";
import { generateDynamicSitemap } from "./src/lib/sitemapGenerator";
import crypto from "crypto";
import {
  verifyPaystackSignature,
  recordWebhookEvent,
  getWebhookEvents,
  createCloudFunctionHandler,
  type PaystackWebhookEvent
} from "./src/lib/paystackWebhookHandler";

// Node version check
const nodeVersion = process.versions.node.split(".")[0];
if (parseInt(nodeVersion) < 20) {
  console.error(`ERROR: Node.js version ${process.versions.node} is not supported.`);
  console.error("This application requires Node.js 20 or higher.");
  process.exit(1);
}

dotenv.config();

// Initialize Cloudinary
if (process.env.CLOUDINARY_CLOUD_NAME && process.env.CLOUDINARY_API_KEY && process.env.CLOUDINARY_API_SECRET) {
  cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET,
    secure: true, // Forces secure https for all generated URLs
  });
  console.log("Cloudinary transcoding configuration loaded with secure HTTPS protocols.");
} else {
  console.warn("Cloudinary credentials not detected. Video transcoding will fallback to standard streams.");
}

// Path resolution that works in both dev (tsx) and prod (bundled cjs)
const distPath = path.resolve(process.cwd(), "dist");
const publicPath = path.resolve(process.cwd(), "public");

const resend = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null;

const getFromEmail = (name: string) => {
  const fromEmail = process.env.RESEND_FROM_EMAIL || "onboarding@resend.dev";
  return `${name} <${fromEmail}>`;
};

function generatePaymentReceiptPDF(data: {
  fullName: string;
  emailAddress: string;
  contact?: string;
  amountPaid: number;
  paymentPlan?: string;
  paymentMethod?: string;
  totalPrice?: number;
  balanceDue?: number;
  paymentStatus?: string;
  refId: string;
}): Buffer {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4'
  });

  // Margins & Dimensions: A4 is 210 x 297 mm
  const margin = 20;
  const pageWidth = 210;
  const contentWidth = pageWidth - (margin * 2);

  // Outer Border
  doc.setDrawColor(31, 41, 55); // #1f2937 (dark grey)
  doc.setLineWidth(0.5);
  doc.rect(margin, margin, contentWidth, 257);

  // Header Banner
  doc.setFillColor(22, 163, 74); // #16a34a (green)
  doc.rect(margin, margin, contentWidth, 35, 'F');

  // Header Text
  doc.setTextColor(255, 255, 255);
  doc.setFont('Helvetica', 'bold');
  doc.setFontSize(22);
  doc.text("GREFAS ENTERTAINMENT", margin + 10, margin + 15);

  doc.setFont('Helvetica', 'normal');
  doc.setFontSize(10);
  doc.text("OFFICIAL FINANCE DIVISION - GHANA", margin + 10, margin + 22);
  doc.text("Email: grefasconsult@gmail.com | Phone: +233 (0) 54 123 4567", margin + 10, margin + 27);

  // Receipt Details Title
  doc.setTextColor(31, 41, 55);
  doc.setFont('Helvetica', 'bold');
  doc.setFontSize(16);
  doc.text("OFFICIAL PAYMENT RECEIPT", margin + 10, margin + 50);

  // Underline
  doc.setDrawColor(22, 163, 74);
  doc.setLineWidth(1);
  doc.line(margin + 10, margin + 53, margin + 85, margin + 53);

  // Date and Receipt ID
  doc.setFont('Helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(100, 116, 139);
  const dateStr = new Date().toLocaleString('en-US', { timeZone: 'UTC' }) + " UTC";
  doc.text(`Date Issued: ${dateStr}`, margin + 10, margin + 60);
  doc.text(`Transaction Reference: ${data.refId || 'N/A'}`, margin + 10, margin + 65);

  // Client Information Section
  doc.setFont('Helvetica', 'bold');
  doc.setFontSize(12);
  doc.setTextColor(17, 24, 39);
  doc.text("CLIENT INFORMATION", margin + 10, margin + 80);
  
  doc.setDrawColor(229, 231, 235); // light grey border
  doc.setLineWidth(0.3);
  doc.line(margin + 10, margin + 83, margin + contentWidth - 10, margin + 83);

  doc.setFont('Helvetica', 'normal');
  doc.setFontSize(10);
  doc.setTextColor(75, 85, 99);
  
  let y = margin + 90;
  doc.text("Full Name:", margin + 10, y);
  doc.setFont('Helvetica', 'bold');
  doc.setTextColor(17, 24, 39);
  doc.text(data.fullName, margin + 50, y);

  doc.setFont('Helvetica', 'normal');
  doc.setTextColor(75, 85, 99);
  y += 7;
  doc.text("Email Address:", margin + 10, y);
  doc.setFont('Helvetica', 'bold');
  doc.setTextColor(17, 24, 39);
  doc.text(data.emailAddress, margin + 50, y);

  doc.setFont('Helvetica', 'normal');
  doc.setTextColor(75, 85, 99);
  y += 7;
  doc.text("Contact Phone:", margin + 10, y);
  doc.setFont('Helvetica', 'bold');
  doc.setTextColor(17, 24, 39);
  doc.text(data.contact || 'N/A', margin + 50, y);

  // Payment Breakdown Section
  y += 15;
  doc.setFont('Helvetica', 'bold');
  doc.setFontSize(12);
  doc.setTextColor(17, 24, 39);
  doc.text("PAYMENT DETAILS", margin + 10, y);
  doc.line(margin + 10, y + 3, margin + contentWidth - 10, y + 3);

  y += 10;
  // Let's create a table-like layout
  doc.setFillColor(243, 244, 246); // extremely light grey background
  doc.rect(margin + 10, y, contentWidth - 20, 8, 'F');
  
  doc.setFont('Helvetica', 'bold');
  doc.setFontSize(9);
  doc.setTextColor(55, 65, 81);
  doc.text("Description", margin + 15, y + 5.5);
  doc.text("Amount", margin + contentWidth - 40, y + 5.5);

  y += 12;
  doc.setFont('Helvetica', 'normal');
  doc.setFontSize(10);
  doc.setTextColor(31, 41, 55);
  doc.text("Casting & Talent Service Enrollment Milestone", margin + 15, y);
  doc.setFont('Helvetica', 'bold');
  doc.text(`GHS ${Number(data.amountPaid).toFixed(2)}`, margin + contentWidth - 40, y);

  y += 10;
  doc.setDrawColor(229, 231, 235);
  doc.line(margin + 10, y, margin + contentWidth - 10, y);

  y += 5;
  // Right aligned summary values
  const rightLabelX = margin + contentWidth - 75;
  const rightValueX = margin + contentWidth - 40;

  doc.setFont('Helvetica', 'normal');
  doc.setTextColor(100, 116, 139);
  doc.text("Payment Method:", rightLabelX, y);
  doc.setFont('Helvetica', 'bold');
  doc.setTextColor(17, 24, 39);
  doc.text(data.paymentMethod || 'Mobile Money', rightValueX, y);

  y += 6;
  doc.setFont('Helvetica', 'normal');
  doc.setTextColor(100, 116, 139);
  doc.text("Payment Plan:", rightLabelX, y);
  doc.setFont('Helvetica', 'bold');
  doc.setTextColor(17, 24, 39);
  doc.text(data.paymentPlan || 'One-time Full', rightValueX, y);

  y += 6;
  doc.setFont('Helvetica', 'normal');
  doc.setTextColor(100, 116, 139);
  doc.text("Total Agreed Price:", rightLabelX, y);
  doc.setFont('Helvetica', 'bold');
  doc.setTextColor(17, 24, 39);
  doc.text(`GHS ${Number(data.totalPrice || 0).toFixed(2)}`, rightValueX, y);

  y += 6;
  doc.setFont('Helvetica', 'bold');
  doc.setTextColor(22, 163, 74);
  doc.text("Amount Received:", rightLabelX, y);
  doc.text(`GHS ${Number(data.amountPaid).toFixed(2)}`, rightValueX, y);

  y += 6;
  doc.setFont('Helvetica', 'bold');
  doc.setTextColor(239, 68, 68);
  doc.text("Balance Outstanding:", rightLabelX, y);
  doc.text(`GHS ${Number(data.balanceDue || 0).toFixed(2)}`, rightValueX, y);

  y += 6;
  doc.setFont('Helvetica', 'bold');
  doc.setTextColor(31, 41, 55);
  doc.text("Payment Status:", rightLabelX, y);
  const statusColor = data.paymentStatus === 'Fully Paid' ? [22, 163, 74] : [217, 119, 6];
  doc.setTextColor(statusColor[0], statusColor[1], statusColor[2]);
  doc.text((data.paymentStatus || 'Partially Paid').toUpperCase(), rightValueX, y);

  // Acknowledgment text
  y += 20;
  doc.setFillColor(249, 250, 251);
  doc.setDrawColor(229, 231, 235);
  doc.rect(margin + 10, y, contentWidth - 20, 22, 'FD');
  
  doc.setFont('Helvetica', 'bold');
  doc.setFontSize(8);
  doc.setTextColor(55, 65, 81);
  doc.text("ACKNOWLEDGEMENT & LEGAL NOTICE:", margin + 14, y + 5);
  doc.setFont('Helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.setTextColor(107, 114, 128);
  doc.text("This official document confirms receipt of the stated amount for Grefas Consult Casting Division.", margin + 14, y + 10);
  doc.text("All payments are non-refundable and subject to the standard terms & conditions of enrollment.", margin + 14, y + 14);
  doc.text("Thank you for choosing Grefas Entertainment.", margin + 14, y + 18);

  // Signatures
  y += 28;
  doc.setDrawColor(156, 163, 175);
  doc.line(margin + 15, y, margin + 65, y);
  doc.line(margin + contentWidth - 65, y, margin + contentWidth - 15, y);

  doc.setFont('Helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(107, 114, 128);
  doc.text("Authorized Signature", margin + 25, y + 4);
  doc.text("Finance Director", margin + contentWidth - 50, y + 4);

  // Footer
  doc.setFont('Helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(156, 163, 175);
  doc.text("This is a system-generated official payment receipt issued by Grefas Consult & Entertainment, Ghana.", margin + 10, margin + 250);

  // Get buffer
  const arrayBuffer = doc.output('arraybuffer');
  return Buffer.from(arrayBuffer);
}

// SMS Logging System
interface SmsLog {
  id: string;
  recipient: string;
  message: string;
  status: string; // 'sent', 'failed (reason)'
  gateway: 'Arkesel';
  timestamp: string;
}

const smsLogs: SmsLog[] = [
  {
    id: "log_1",
    recipient: "+233244123456",
    message: "Hi Ama, your booking for Business Setup Advisory on 2026-06-25 is CONFIRMED! - Grefas Consult",
    status: "sent",
    gateway: "Arkesel",
    timestamp: new Date(Date.now() - 3600000 * 2).toISOString() // 2 hours ago
  },
  {
    id: "log_2",
    recipient: "+233507654321",
    message: "Reminder: Hi Kwame, you have a booking for Visa Interview Prep on 2026-06-24. We look forward to seeing you! - Grefas Consult",
    status: "sent",
    gateway: "Arkesel",
    timestamp: new Date(Date.now() - 3600000 * 5).toISOString() // 5 hours ago
  },
  {
    id: "log_4",
    recipient: "+233201112223",
    message: "Reminder: Hi John, you have a booking for Corporate Strategy Session on 2026-06-24. We look forward to seeing you! - Grefas Consult",
    status: "failed (Arkesel API Key Expired)",
    gateway: "Arkesel",
    timestamp: new Date(Date.now() - 3600000 * 24).toISOString() // 24 hours ago
  }
];

function logSmsAttempt(recipient: string, message: string, status: string, gateway: 'Arkesel') {
  smsLogs.unshift({
    id: "log_" + Math.random().toString(36).substring(2, 9),
    recipient,
    message,
    status,
    gateway,
    timestamp: new Date().toISOString()
  });
  if (smsLogs.length > 100) {
    smsLogs.pop();
  }
}

// Cleans Arkesel API key: strips basic auth colons
function getCleanArkeselKey(rawKey: string): string {
  if (!rawKey) return "";
  let key = rawKey.trim();

  // Strip leading colon if any (common in decoded basic auth tokens like :api_key)
  if (key.startsWith(":")) {
    key = key.substring(1);
  }

  return key;
}

// SMS Sender: Uses Arkesel Ghanaian local SMS Gateway
async function sendSMS(phone: string, message: string): Promise<string> {
  const result = await sendArkeselSms(phone, message);
  logSmsAttempt(phone, message, result.status, "Arkesel");
  return result.status;
}

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(compression());
  app.use(
    express.json({
      verify: (req: any, _res, buf) => {
        req.rawBody = buf;
      }
    })
  );
  app.use(express.urlencoded({ extended: true }));

  // Health check
  app.get("/api/health", (req, res) => {
    res.json({ status: "ok", timestamp: new Date().toISOString() });
  });

  // SEO: Dynamic robots.txt for search engines
  app.get("/robots.txt", (req, res) => {
    res.type("text/plain");
    const protocol = (req.headers['x-forwarded-proto'] as string) || req.protocol || 'https';
    const host = req.get('host') || 'grefasconsultandentertainment.com';
    const domain = process.env.APP_URL || `${protocol}://${host}`;
    
    res.send(`User-agent: *
Allow: /
Disallow: /admin/
Disallow: /api/

Sitemap: ${domain}/sitemap.xml`);
  });

  // SEO: Dynamic sitemap.xml for Google indexing - automatically queries active services and content pages from Firestore
  app.get("/sitemap.xml", async (req, res) => {
    try {
      const protocol = (req.headers['x-forwarded-proto'] as string) || req.protocol || 'https';
      const host = req.get('host') || 'grefasconsultandentertainment.com';
      const currentBaseUrl = process.env.APP_URL || `${protocol}://${host}`;

      const sitemapResult = await generateDynamicSitemap(currentBaseUrl);
      res.type("application/xml");
      res.setHeader("Cache-Control", "public, max-age=3600, s-maxage=3600");
      res.send(sitemapResult.xml);
    } catch (err: any) {
      console.error("Failed to generate dynamic sitemap:", err);
      res.status(500).type("text/plain").send("Error generating dynamic sitemap.xml");
    }
  });

  // API endpoint: Rebuild sitemap manually or via webhook
  app.post("/api/sitemap/generate", async (req, res) => {
    try {
      const protocol = (req.headers['x-forwarded-proto'] as string) || req.protocol || 'https';
      const host = req.get('host') || 'grefasconsultandentertainment.com';
      const currentBaseUrl = req.body?.baseUrl || process.env.APP_URL || `${protocol}://${host}`;

      const sitemapResult = await generateDynamicSitemap(currentBaseUrl);
      res.json({
        status: "ok",
        message: "Dynamic sitemap generated and written to sitemap.xml on disk",
        serviceCount: sitemapResult.serviceCount,
        blogCount: sitemapResult.blogCount,
        portfolioCount: sitemapResult.portfolioCount,
        totalUrls: sitemapResult.totalUrls,
        lastGeneratedAt: sitemapResult.lastGeneratedAt
      });
    } catch (err: any) {
      console.error("API error building sitemap:", err);
      res.status(500).json({ error: err.message || "Failed to generate sitemap" });
    }
  });

  // API endpoint: Get sitemap status info
  app.get("/api/sitemap/status", async (req, res) => {
    try {
      const protocol = (req.headers['x-forwarded-proto'] as string) || req.protocol || 'https';
      const host = req.get('host') || 'grefasconsultandentertainment.com';
      const currentBaseUrl = process.env.APP_URL || `${protocol}://${host}`;

      const sitemapResult = await generateDynamicSitemap(currentBaseUrl);
      res.json({
        status: "ok",
        serviceCount: sitemapResult.serviceCount,
        blogCount: sitemapResult.blogCount,
        portfolioCount: sitemapResult.portfolioCount,
        totalUrls: sitemapResult.totalUrls,
        lastGeneratedAt: sitemapResult.lastGeneratedAt,
        sitemapUrl: `${currentBaseUrl}/sitemap.xml`
      });
    } catch (err: any) {
      res.status(500).json({ error: err.message || "Failed to fetch sitemap status" });
    }
  });

  // Get Email API configuration and health status
  app.get("/api/email-status", (req, res) => {
    res.json({
      status: "ok",
      emailApi: {
        configured: !!process.env.RESEND_API_KEY,
        provider: "Resend",
        domain: "resend.dev",
        status: process.env.RESEND_API_KEY ? "Active" : "Not Configured"
      }
    });
  });

  // Get in-memory SMS logs
  app.get("/api/sms-logs", (req, res) => {
    res.json({ status: "ok", logs: smsLogs });
  });

  // Get SMS balance and configuration status
  app.get("/api/sms-status", async (req, res) => {
    const rawApiKey = process.env.ARKESEL_SMS_API_KEY || "OnJGNTZEM2hQOG1peWloUFY=";
    const apiKey = getCleanArkeselKey(rawApiKey);
    const senderId = (process.env.ARKESEL_SENDER_ID || "Grefas").trim().substring(0, 11).trim();

    const hasArkeselKey = !!process.env.ARKESEL_SMS_API_KEY || apiKey === "OnJGNTZEM2hQOG1peWloUFY=";

    const maskedKey = apiKey 
      ? apiKey.substring(0, 4) + "..." + apiKey.substring(apiKey.length - 4)
      : "Not Configured";

    let balance: any = null;
    let balanceError: string | null = null;
    let arkeselStatus = "Inactive";

    if (hasArkeselKey && apiKey) {
      const balanceResult = await checkArkeselBalance();
      arkeselStatus = balanceResult.status;
      balance = balanceResult.balance || null;
      balanceError = balanceResult.error || null;
    } else if (apiKey) {
      // Demo/Fallback Mode when API key is not configured by user
      arkeselStatus = "Demo Mode";
      balance = {
        balance: "50.00",
        sms_balance: "1000",
        currency: "GHS",
        is_demo: true
      };
      balanceError = null;
    }

    res.json({
      status: "ok",
      arkesel: {
        status: arkeselStatus,
        hasKey: hasArkeselKey,
        maskedKey,
        senderId,
        balance,
        balanceError
      }
    });
  });

  // Send OTP endpoint for client portal signup
  app.post("/api/send-otp", async (req, res) => {
    const { phone, code } = req.body;
    if (!phone || !code) {
      return res.status(400).json({ error: "Phone number and verification code are required" });
    }
    try {
      const message = `Your Grefas Consult verification code is: ${code}. Valid for 10 minutes. Please enter this code to complete your client portal registration.`;
      const smsStatus = await sendSMS(phone, message);
      res.json({ status: smsStatus });
    } catch (err: any) {
      console.error("Error sending OTP SMS:", err);
      res.status(500).json({ error: err.message || "Failed to send SMS OTP" });
    }
  });

  // In-memory cache to prevent spamming low credit email alerts (allow once every 24 hours per unique email)
  const sentLowCreditAlerts = new Map<string, number>();

  app.post("/api/alert-low-credit", async (req, res) => {
    const { balance, threshold, emails } = req.body;

    if (balance === null || balance === undefined || threshold === undefined || !emails || !Array.isArray(emails)) {
      return res.status(400).json({ error: "Missing balance, threshold or emails" });
    }

    if (!resend) {
      return res.status(200).json({ status: "skipped", message: "Resend not configured" });
    }

    const now = Date.now();
    const recipientEmails = emails.filter(e => {
      const lastSent = sentLowCreditAlerts.get(e);
      if (lastSent && (now - lastSent < 24 * 60 * 60 * 1000)) {
        return false; // Skip, sent within 24 hours
      }
      return true;
    });

    if (recipientEmails.length === 0) {
      return res.json({ status: "skipped", message: "Alert emails throttled (already sent in last 24 hours)" });
    }

    try {
      await resend.emails.send({
        from: getFromEmail("Grefas SMS Alert"),
        to: recipientEmails,
        subject: `[CRITICAL ALERT] Arkesel SMS Credit Balance Low`,
        html: `
          <div style="font-family: sans-serif; color: #1f2937; max-width: 600px; margin: 0 auto; border: 1px solid #e5e7eb; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05);">
            <div style="background-color: #ef4444; padding: 24px; text-align: center;">
              <h1 style="color: white; margin: 0; font-size: 20px; font-weight: bold;">SMS GATEWAY CRITICAL ALERT</h1>
            </div>
            <div style="padding: 32px;">
              <p>Hello Admin,</p>
              <p>This is an automated system warning that your Grefas **Arkesel SMS Gateway balance** has dropped below your configured threshold.</p>
              
              <div style="background-color: #fef2f2; border: 1px solid #fee2e2; padding: 20px; border-radius: 8px; margin: 24px 0;">
                <table style="width: 100%; font-size: 14px; border-collapse: collapse;">
                  <tr>
                    <td style="padding: 6px 0; color: #4b5563;"><strong>Current Balance:</strong></td>
                    <td style="padding: 6px 0; font-weight: bold; color: #ef4444; font-size: 16px;">${balance}</td>
                  </tr>
                  <tr>
                    <td style="padding: 6px 0; color: #4b5563;"><strong>Alert Threshold:</strong></td>
                    <td style="padding: 6px 0; font-weight: bold; color: #1f2937;">${threshold}</td>
                  </tr>
                  <tr>
                    <td style="padding: 6px 0; color: #4b5563;"><strong>Gateway Provider:</strong></td>
                    <td style="padding: 6px 0; color: #1f2937;">Arkesel Ghanaian Gateway</td>
                  </tr>
                </table>
              </div>

              <p><strong>Action Required:</strong></p>
              <p>Please log in to your Arkesel account at <a href="https://arkesel.com" style="color: #ea580c; text-decoration: underline;">arkesel.com</a> and top up your credit balance as soon as possible to prevent automated SMS delivery failures for new bookings and applications.</p>
              
              <p style="margin-top: 32px; font-size: 12px; color: #9ca3af; border-top: 1px solid #e5e7eb; padding-top: 16px;">
                This notification has been throttled and will not be sent again to these recipients for the next 24 hours.
              </p>
            </div>
          </div>
        `
      });

      // Update throttle timestamps
      recipientEmails.forEach(e => sentLowCreditAlerts.set(e, now));

      return res.json({ status: "sent", sentTo: recipientEmails });
    } catch (err: any) {
      console.error("Failed to send low credit email alert:", err);
      return res.status(500).json({ error: "Failed to send alert", details: err.message });
    }
  });

  // --- PAYSTACK PAYMENT GATEWAY INTEGRATION ---

  /**
   * Core Paystack Transaction Initializer using standard Node https.request
   * Targets https://api.paystack.co/transaction/initialize
   */
  function initializePaystackTransaction(params: {
    email: string;
    amount: number | string; // in lowest unit (pesewas/cents) e.g. "500000" or in standard GHS e.g. 50
    currency?: string;
    reference?: string;
    callback_url?: string;
    metadata?: Record<string, any>;
    channels?: string[];
  }): Promise<{ status: boolean; message: string; data?: any; error?: string; isDemo?: boolean }> {
    return new Promise((resolve) => {
      const secretKey = process.env.PAYSTACK_SECRET_KEY || "";
      const rawAmount = Number(params.amount);

      if (!params.email || isNaN(rawAmount) || rawAmount <= 0) {
        return resolve({
          status: false,
          message: "Valid email and positive numeric amount are required",
          error: "Invalid email or amount"
        });
      }

      // Calculate amount in lowest currency unit (pesewas)
      // Standard GHS amounts (e.g. 50, 150, 500) are converted (* 100)
      // Large integers (e.g. 500000 from Paystack params) are preserved
      const amountInLowestUnit = rawAmount < 10000 ? Math.round(rawAmount * 100) : Math.round(rawAmount);
      const txRef = params.reference || `GREFAS-${Date.now()}-${Math.random().toString(36).substring(2, 7).toUpperCase()}`;

      // Graceful fallback for sandbox / development environment if SECRET_KEY is not configured
      if (!secretKey) {
        return resolve({
          status: true,
          message: "Paystack transaction initialized (Sandbox / Development Mode)",
          isDemo: true,
          data: {
            authorization_url: params.callback_url ? `${params.callback_url}${params.callback_url.includes('?') ? '&' : '?'}reference=${encodeURIComponent(txRef)}&status=sandbox_success` : "",
            access_code: `demo_acc_${Date.now()}`,
            reference: txRef,
            amount: amountInLowestUnit,
            amountInGhs: amountInLowestUnit / 100
          }
        });
      }

      const postData = JSON.stringify({
        email: params.email,
        amount: String(amountInLowestUnit),
        currency: params.currency || "GHS",
        reference: txRef,
        callback_url: params.callback_url,
        metadata: params.metadata || {},
        channels: params.channels || ["card", "mobile_money", "bank_transfer"]
      });

      const options = {
        hostname: "api.paystack.co",
        port: 443,
        path: "/transaction/initialize",
        method: "POST",
        headers: {
          Authorization: `Bearer ${secretKey}`,
          "Content-Type": "application/json",
          "Content-Length": Buffer.byteLength(postData)
        }
      };

      const paystackReq = https.request(options, (paystackRes) => {
        let responseBody = "";

        paystackRes.on("data", (chunk) => {
          responseBody += chunk;
        });

        paystackRes.on("end", () => {
          try {
            const parsed = JSON.parse(responseBody);
            if (parsed && parsed.status) {
              resolve({
                status: true,
                message: parsed.message || "Paystack authorization URL generated",
                data: {
                  ...parsed.data,
                  reference: txRef,
                  amount: amountInLowestUnit,
                  amountInGhs: amountInLowestUnit / 100
                }
              });
            } else {
              console.warn("Paystack initialize rejected:", parsed);
              resolve({
                status: false,
                message: parsed?.message || "Paystack transaction initialization failed",
                error: parsed?.message,
                data: parsed?.data
              });
            }
          } catch (parseError: any) {
            console.error("Paystack response parse exception:", responseBody, parseError);
            resolve({
              status: false,
              message: "Malformed response received from Paystack",
              error: parseError.message
            });
          }
        });
      });

      paystackReq.on("error", (requestError) => {
        console.error("Paystack HTTPS request error:", requestError);
        resolve({
          status: false,
          message: "Failed to establish secure link to Paystack servers",
          error: requestError.message
        });
      });

      paystackReq.write(postData);
      paystackReq.end();
    });
  }

  // Returns Paystack integration configuration and connection status
  app.get("/api/paystack/config", (req, res) => {
    const secretKey = process.env.PAYSTACK_SECRET_KEY || "";
    const publicKey = process.env.PAYSTACK_PUBLIC_KEY || process.env.VITE_PAYSTACK_PUBLIC_KEY || "";
    const isConfigured = Boolean(secretKey && secretKey.length > 5);

    res.json({
      configured: isConfigured,
      publicKey: publicKey ? (publicKey.startsWith("pk_") ? `${publicKey.substring(0, 8)}...` : "Configured") : "",
      rawPublicKey: publicKey || "",
      currency: "GHS",
      supportedChannels: ["mobile_money", "card", "bank_transfer"],
      supportedNetworks: ["MTN MoMo", "Telecel Cash", "AT Money", "Visa", "Mastercard"],
      environment: secretKey.startsWith("sk_live") ? "live" : "test"
    });
  });

  // Universal HTML Form / API Order & Payment Submission endpoint: /save-order-and-pay and /api/save-order-and-pay
  const handleSaveOrderAndPay = async (req: express.Request, res: express.Response) => {
    const user_email = (req.body?.user_email || req.body?.email || "").toString().trim();
    const amount = req.body?.amount;
    const cartid = (req.body?.cartid || req.body?.order_id || req.body?.reference || "").toString().trim();
    const currency = (req.body?.currency || "GHS").toString().trim();
    const protocol = (req.headers["x-forwarded-proto"] as string) || req.protocol || "https";
    const host = req.get("host") || "localhost:3000";
    const defaultCallback = `${protocol}://${host}/booking?payment_status=success`;
    const callback_url = req.body?.callback_url || defaultCallback;

    if (!user_email || !amount) {
      const errorMsg = "Missing required parameters: 'user_email' (or 'email') and 'amount' are required.";
      const isFormPost = req.is("application/x-www-form-urlencoded") || (!req.xhr && !req.headers.accept?.includes("application/json"));
      if (isFormPost) {
        return res.status(400).send(`
          <div style="font-family: sans-serif; padding: 2rem; max-width: 500px; margin: auto; text-align: center;">
            <h2 style="color: #dc2626;">Payment Error</h2>
            <p style="color: #4b5563;">${errorMsg}</p>
            <a href="/booking" style="display: inline-block; margin-top: 1rem; padding: 0.5rem 1.25rem; background: #16a34a; color: white; border-radius: 0.375rem; text-decoration: none;">Return to Booking</a>
          </div>
        `);
      }
      return res.status(400).json({ status: false, error: errorMsg });
    }

    const txRef = cartid || `GREFAS-${Date.now()}-${Math.random().toString(36).substring(2, 7).toUpperCase()}`;

    const paystackResult = await initializePaystackTransaction({
      email: user_email,
      amount: amount,
      currency,
      reference: txRef,
      callback_url,
      metadata: {
        cartid: cartid || txRef,
        source: "save-order-and-pay-form",
        user_email,
        ...(typeof req.body?.metadata === "object" ? req.body.metadata : {})
      }
    });

    const isFormPost = req.is("application/x-www-form-urlencoded") || (!req.xhr && !req.headers.accept?.includes("application/json"));

    if (paystackResult.status && paystackResult.data?.authorization_url) {
      if (isFormPost) {
        // Direct redirect to Paystack hosted checkout page for HTML forms
        return res.redirect(paystackResult.data.authorization_url);
      }
      return res.json(paystackResult);
    } else if (paystackResult.status) {
      // Sandbox fallback redirect or response
      if (isFormPost) {
        return res.redirect(`/booking?reference=${encodeURIComponent(txRef)}&payment_status=sandbox_success`);
      }
      return res.json(paystackResult);
    } else {
      if (isFormPost) {
        return res.status(400).send(`
          <div style="font-family: sans-serif; padding: 2rem; max-width: 500px; margin: auto; text-align: center;">
            <h2 style="color: #dc2626;">Payment Gateway Notice</h2>
            <p style="color: #4b5563;">${paystackResult.message || paystackResult.error || "Unable to initialize Paystack transaction."}</p>
            <a href="/booking" style="display: inline-block; margin-top: 1rem; padding: 0.5rem 1.25rem; background: #16a34a; color: white; border-radius: 0.375rem; text-decoration: none;">Return to Booking</a>
          </div>
        `);
      }
      return res.status(400).json(paystackResult);
    }
  };

  app.post("/save-order-and-pay", handleSaveOrderAndPay);
  app.post("/api/save-order-and-pay", handleSaveOrderAndPay);

  // Initialize Paystack transaction API
  app.post("/api/paystack/initialize", async (req, res) => {
    const email = req.body?.email || req.body?.user_email;
    const amount = req.body?.amount;
    const currency = req.body?.currency || "GHS";
    const reference = req.body?.reference || req.body?.cartid;
    const metadata = req.body?.metadata;
    const channels = req.body?.channels;
    const protocol = (req.headers["x-forwarded-proto"] as string) || req.protocol || "https";
    const host = req.get("host") || "localhost:3000";
    const callback_url = req.body?.callback_url || `${protocol}://${host}/booking`;

    if (!email || !amount || isNaN(Number(amount)) || Number(amount) <= 0) {
      return res.status(400).json({ 
        status: false, 
        error: "Valid email (or user_email) and positive numeric amount are required for Paystack payment" 
      });
    }

    const result = await initializePaystackTransaction({
      email,
      amount,
      currency,
      reference,
      metadata,
      channels,
      callback_url
    });

    if (!result.status) {
      return res.status(400).json(result);
    }

    return res.json(result);
  });

  // Verify a Paystack transaction by reference
  app.get("/api/paystack/verify/:reference", async (req, res) => {
    const reference = req.params.reference;
    if (!reference) {
      return res.status(400).json({ status: false, error: "Reference parameter is required" });
    }

    const secretKey = process.env.PAYSTACK_SECRET_KEY;

    if (secretKey) {
      try {
        const paystackRes = await fetch(`https://api.paystack.co/transaction/verify/${encodeURIComponent(reference)}`, {
          method: "GET",
          headers: {
            "Authorization": `Bearer ${secretKey}`,
          },
        });

        const paystackData = await paystackRes.json();
        if (!paystackRes.ok || !paystackData.status) {
          return res.status(paystackRes.status || 400).json({
            status: false,
            message: paystackData.message || "Failed to verify transaction with Paystack",
            data: paystackData.data
          });
        }

        const tx = paystackData.data;
        const isSuccess = tx && tx.status === "success";

        return res.json({
          status: isSuccess,
          message: isSuccess
            ? "Transaction verified successfully"
            : `Transaction status is '${tx?.status || "pending"}'. Gateway response: ${tx?.gateway_response || "Payment pending or not completed on Paystack."}`,
          data: {
            ...tx,
            status: tx?.status || "pending",
            amountInGhs: (tx?.amount || 0) / 100
          }
        });
      } catch (err: any) {
        console.error("Paystack verification error:", err);
        return res.status(502).json({
          status: false,
          error: "Could not reach Paystack verification gateway",
          message: err.message
        });
      }
    }

    // Demo/Sandbox fallback
    return res.json({
      status: true,
      message: "Transaction verified (Sandbox / Dev Mode)",
      isDemo: true,
      data: {
        id: Math.floor(Math.random() * 1000000),
        domain: "test",
        status: "success",
        reference: reference,
        amount: 5000,
        amountInGhs: 50,
        gateway_response: "Successful / Approved",
        paid_at: new Date().toISOString(),
        channel: "mobile_money",
        currency: "GHS"
      }
    });
  });

  // ==========================================
  // PAYSTACK WEBHOOK HANDLER & CLOUD FUNCTION
  // ==========================================

  const handlePaystackWebhook = async (req: express.Request, res: express.Response) => {
    const signature = req.headers["x-paystack-signature"] as string;
    const rawBody = (req as any).rawBody || (typeof req.body === "string" ? req.body : JSON.stringify(req.body));
    const secretKey = process.env.PAYSTACK_SECRET_KEY || "";

    // Verify HMAC SHA-512 signature
    const verification = verifyPaystackSignature(rawBody, signature, secretKey);

    if (secretKey && !verification.isValid) {
      console.warn("⚠️ Paystack Webhook Unauthorized Signature:", verification.reason);
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

      // Record event log in memory/queryable store
      const logEntry = recordWebhookEvent(eventPayload, verification.isValid);
      console.log(`🔔 Paystack Webhook Received: [${eventPayload?.event}] Ref: ${logEntry.reference} | Status: ${logEntry.status} | GHS ${logEntry.amountInGhs}`);

      // Process event-specific automations
      if (eventPayload?.event === "charge.success") {
        const txData = eventPayload.data || ({} as any);
        const amountGhs = logEntry.amountInGhs;
        const customerEmail = logEntry.customerEmail;
        const customerPhone = logEntry.customerPhone || txData.customer?.phone || (txData.metadata?.phone as string);
        const customerName =
          (txData.metadata?.fullName as string) ||
          (txData.metadata?.name as string) ||
          `${txData.customer?.first_name || ""} ${txData.customer?.last_name || ""}`.trim() ||
          "Valued Client";

        // 1. Dispatch SMS confirmation if customer phone is available
        if (customerPhone) {
          const smsMsg = `Grefas Consult: Payment of GH₵${amountGhs.toFixed(2)} received successfully! (Ref: ${logEntry.reference}). Thank you for choosing Grefas!`;
          sendSMS(customerPhone, smsMsg).catch((smsErr) => {
            console.warn("Webhook SMS alert notice:", smsErr.message || smsErr);
          });
        }

        // 2. Dispatch Email Receipt if Resend and customer email are available
        if (resend && customerEmail && customerEmail !== "N/A" && customerEmail.includes("@")) {
          try {
            const receiptPdfBuffer = generatePaymentReceiptPDF({
              fullName: customerName,
              emailAddress: customerEmail,
              contact: customerPhone,
              amountPaid: amountGhs,
              paymentPlan: (txData.metadata?.serviceTitle as string) || "Grefas Official Service",
              paymentMethod: txData.channel === "card" ? "Debit/Credit Card (Paystack)" : `Mobile Money (${(txData.channel || "momo").toUpperCase()})`,
              totalPrice: amountGhs,
              balanceDue: 0,
              paymentStatus: "Fully Paid",
              refId: logEntry.reference
            });

            resend.emails.send({
              from: getFromEmail("Grefas Consult & Entertainment"),
              to: customerEmail,
              subject: `Official Payment Receipt [${logEntry.reference}] - GH₵${amountGhs.toFixed(2)}`,
              html: `
                <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e5e7eb; border-radius: 8px;">
                  <div style="background-color: #16a34a; padding: 15px; border-radius: 6px; text-align: center; color: #ffffff;">
                    <h2 style="margin: 0; font-size: 20px;">Payment Verified Successfully</h2>
                  </div>
                  <div style="padding: 20px 0;">
                    <p style="font-size: 15px; color: #374151;">Dear <strong>${customerName}</strong>,</p>
                    <p style="font-size: 14px; color: #4b5563;">
                      We have received your payment of <strong>GH₵ ${amountGhs.toFixed(2)}</strong> via Paystack gateway.
                    </p>
                    <div style="background-color: #f9fafb; padding: 15px; border-radius: 6px; margin: 15px 0; border: 1px solid #e5e7eb;">
                      <table style="width: 100%; font-size: 13px; color: #4b5563;">
                        <tr><td style="padding: 4px 0;"><strong>Reference:</strong></td><td>${logEntry.reference}</td></tr>
                        <tr><td style="padding: 4px 0;"><strong>Amount Paid:</strong></td><td>GH₵ ${amountGhs.toFixed(2)}</td></tr>
                        <tr><td style="padding: 4px 0;"><strong>Payment Channel:</strong></td><td>${logEntry.channel.toUpperCase()}</td></tr>
                        <tr><td style="padding: 4px 0;"><strong>Status:</strong></td><td style="color: #16a34a; font-weight: bold;">VERIFIED & APPROVED</td></tr>
                        <tr><td style="padding: 4px 0;"><strong>Date:</strong></td><td>${new Date().toLocaleString()}</td></tr>
                      </table>
                    </div>
                    <p style="font-size: 13px; color: #6b7280;">Your official PDF payment receipt is attached to this email.</p>
                  </div>
                  <div style="border-top: 1px solid #e5e7eb; padding-top: 15px; text-align: center; font-size: 12px; color: #9ca3af;">
                    Grefas Consult & Entertainment &bull; Accra, Ghana &bull; support@grefas.com
                  </div>
                </div>
              `,
              attachments: [
                {
                  filename: `Grefas_Receipt_${logEntry.reference}.pdf`,
                  content: receiptPdfBuffer
                }
              ]
            }).catch((emailErr) => {
              console.warn("Webhook PDF receipt email notice:", emailErr.message || emailErr);
            });
          } catch (pdfErr) {
            console.warn("Webhook PDF compilation notice:", pdfErr);
          }
        }
      } else if (eventPayload?.event === "charge.failed") {
        console.warn(`[Paystack Webhook] Charge failed for Ref: ${logEntry.reference} - ${logEntry.gatewayResponse}`);
      }

      // Fast 200 HTTP response acknowledgment to Paystack
      return res.status(200).json({
        status: true,
        message: "Paystack webhook processed successfully",
        event: eventPayload?.event,
        reference: logEntry.reference,
        statusResult: logEntry.status
      });
    } catch (err: any) {
      console.error("Paystack webhook parsing error:", err);
      return res.status(200).json({
        status: false,
        warning: "Webhook received with parsing notes",
        error: err.message
      });
    }
  };

  // Mount Paystack Webhook on standard paths
  app.post("/api/paystack/webhook", handlePaystackWebhook);
  app.post("/paystack/webhook", handlePaystackWebhook);

  // Retrieve received Paystack webhook events log
  app.get("/api/paystack/webhook/events", (req, res) => {
    const reference = req.query.reference as string;
    const eventType = req.query.event as string;
    const events = getWebhookEvents({ reference, event: eventType });
    res.json({
      status: true,
      count: events.length,
      data: events
    });
  });

  // Query webhook status for a specific transaction reference
  app.get("/api/paystack/webhook/events/:reference", (req, res) => {
    const ref = req.params.reference;
    const events = getWebhookEvents({ reference: ref });
    if (events.length > 0) {
      res.json({
        status: true,
        found: true,
        data: events[0],
        allEventsForRef: events
      });
    } else {
      res.json({
        status: true,
        found: false,
        message: `No webhook event recorded yet for reference '${ref}'.`
      });
    }
  });

  // Test / Simulate a Paystack webhook event
  app.post("/api/paystack/webhook/test", (req, res) => {
    const eventType = req.body?.event || "charge.success";
    const amount = Number(req.body?.amount) || 5000;
    const reference = req.body?.reference || `GREFAS-TEST-${Date.now()}`;
    const email = req.body?.email || "test.client@example.com";
    const phone = req.body?.phone || "+233244000000";
    const channel = req.body?.channel || "mobile_money";

    const simulatedEvent: PaystackWebhookEvent = {
      event: eventType,
      data: {
        id: Math.floor(1000000 + Math.random() * 9000000),
        domain: "test",
        status: eventType === "charge.success" ? "success" : "failed",
        reference,
        amount,
        gateway_response: eventType === "charge.success" ? "Approved" : "Insufficient funds / Declined",
        channel,
        currency: "GHS",
        customer: {
          email,
          phone,
          first_name: "Test",
          last_name: "User"
        },
        metadata: {
          fullName: "Test User",
          serviceTitle: "Consultation Booking (Simulated Test)",
          phone
        }
      }
    };

    const log = recordWebhookEvent(simulatedEvent, true);
    res.json({
      status: true,
      message: `Simulated '${eventType}' webhook event generated and recorded successfully`,
      data: log
    });
  });

  // Proxy download for images and videos to bypass browser CORS rules on external assets (such as Firebase Storage)
  app.get("/api/proxy-download", async (req, res) => {
    const assetUrl = req.query.url as string;
    if (!assetUrl) {
      return res.status(400).json({ error: "URL query parameter is required" });
    }

    try {
      const response = await fetch(assetUrl);
      if (!response.ok) {
        throw new Error(`Failed to fetch media from remote URL: ${response.status} ${response.statusText}`);
      }

      const contentType = response.headers.get("content-type") || "application/octet-stream";
      
      // Try to determine a friendly filename
      let fileName = "grefas_download";
      try {
        const urlObj = new URL(assetUrl);
        const pathname = urlObj.pathname;
        const decodedName = decodeURIComponent(pathname.substring(pathname.lastIndexOf("/") + 1));
        const cleanName = decodedName.substring(decodedName.lastIndexOf("/") + 1);
        if (cleanName) {
          fileName = cleanName;
        }
      } catch {
        // use fallback filename
      }

      // Add appropriate extension if not present in clean name
      if (!fileName.includes(".")) {
        const ext = contentType.split("/")[1] || "bin";
        fileName = `${fileName}.${ext}`;
      }

      const arrayBuffer = await response.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);

      res.setHeader("Content-Type", contentType);
      res.setHeader("Content-Disposition", `attachment; filename="${fileName}"`);
      res.setHeader("Access-Control-Allow-Origin", "*");
      res.send(buffer);
    } catch (err: any) {
      console.error("Proxy download engine failure:", err);
      res.status(500).json({ error: err.message || "Could not proxy download file" });
    }
  });

  // Configure multer for file memory storage
  const memoryUpload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 105 * 1024 * 1024 }, // 105 MB
  });

  // Video transcoding & upload API
  app.post("/api/upload-gallery-video", memoryUpload.single("video"), async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ error: "No video file provided" });
      }

      console.log(`Video upload requested: ${req.file.originalname} (${req.file.size} bytes)`);

      if (req.file.size > 100 * 1024 * 1024) {
        return res.status(400).json({ error: "File exceeds the maximum 100MB size limit." });
      }

      const isCloudinaryConfigured = !!(
        process.env.CLOUDINARY_CLOUD_NAME &&
        process.env.CLOUDINARY_API_KEY &&
        process.env.CLOUDINARY_API_SECRET
      );

      if (!isCloudinaryConfigured) {
        console.warn("Cloudinary is not configured. Aborting transcoding flow.");
        return res.status(412).json({
          error: "transcoding_missing_credentials",
          message: "Video transcoding requires Cloudinary configuration. Please set the environment variables.",
        });
      }

      // Stream upload to Cloudinary with eager multi-format H.264 transcoder
      const result: any = await new Promise((resolve, reject) => {
        const cloudStream = cloudinary.uploader.upload_stream(
          {
            resource_type: "video",
            folder: "grefas_gallery_videos",
            eager: [
              // Eagerly pre-transcode the video to a universally compatible H.264 / AAC MP4 formatted copy
              { 
                format: "mp4", 
                video_codec: "h264", 
                audio_codec: "aac", 
                quality: "auto", 
                width: 1280, 
                height: 720, 
                crop: "limit" 
              },
              // Eagerly pre-generate high quality thumbnail poster
              { 
                format: "jpg", 
                start_offset: "1", 
                width: 852, 
                height: 480, 
                crop: "fill" 
              }
            ],
            eager_async: false
          },
          (err, response) => {
            if (err) return reject(err);
            resolve(response);
          }
        );
        cloudStream.end(req.file!.buffer);
      });

      console.log("Video transcoded and uploaded successfully. Secure URL:", result.secure_url);

      let videoUrl = result.secure_url || result.url || "";
      let posterUrl = "";

      if (result.eager && result.eager.length > 0) {
        // Retrieve eager MP4 transcoded version
        const mp4Eager = result.eager.find((item: any) => item.format === "mp4");
        if (mp4Eager) {
          videoUrl = mp4Eager.secure_url || mp4Eager.url || videoUrl;
        }

        // Retrieve eager JPEG poster version
        const jpgEager = result.eager.find((item: any) => item.format === "jpg");
        if (jpgEager) {
          posterUrl = jpgEager.secure_url || jpgEager.url || posterUrl;
        }
      }

      // If poster was not found in eager, build fallback replace
      if (!posterUrl) {
        posterUrl = videoUrl.replace(/\.[^/.]+$/, ".jpg");
      }

      // Strictly force all protocol links to secure HTTPS to completely prevent Mixed Content blocks on the client
      videoUrl = videoUrl.replace(/^http:/, "https:");
      posterUrl = posterUrl.replace(/^http:/, "https:");

      return res.json({
        success: true,
        url: videoUrl,
        thumbnail: posterUrl,
        provider: "cloudinary",
        publicId: result.public_id,
        duration: result.duration
      });

    } catch (err: any) {
      console.error("Transcoding pipeline caught an exception:", err);
      return res.status(500).json({
        error: "transcoding_failed",
        message: err.message || "Failed to process and transcode video file."
      });
    }
  });

  // API Routes
  app.post("/api/notify-confirmation", async (req, res) => {
    const { 
      email, 
      phone, 
      userName, 
      serviceTitle, 
      date, 
      time, 
      orderNumber, 
      serviceDescription, 
      teamMemberName, 
      notes,
      customMessage
    } = req.body;

    if (!userName || !serviceTitle || !date) {
      return res.status(400).json({ error: "Missing required fields" });
    }

    const results = { email: "skipped", sms: "skipped" };

    // Send Email
    if (resend && email) {
      try {
        const displayDate = time ? `${date} at ${time}` : date;
        const displayOrder = orderNumber ? `#${orderNumber}` : 'Pending Confirmation';
        const displaySpecialist = teamMemberName || 'Primary Available Specialist';
        const displayDesc = serviceDescription || 'Strategic planning, advisory, consult, or entertainment production briefing session.';
        const displayNotes = notes ? notes.trim() : 'No special notes provided.';

        await resend.emails.send({
          from: getFromEmail("Grefas Consult"),
          to: email,
          subject: `Booking Confirmation ${orderNumber ? `[#${orderNumber}]` : ''} - Grefas Consult & Entertainment`,
          html: `
            <div style="font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #1f2937; max-width: 600px; margin: 0 auto; border: 1px solid #e5e7eb; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05);">
              
              <!-- Branding Header -->
              <div style="background: linear-gradient(135deg, #18181b 0%, #27272a 100%); padding: 32px 24px; text-align: center; border-bottom: 4px solid #ea580c;">
                <span style="color: #ea580c; font-size: 11px; font-weight: 900; letter-spacing: 0.25em; text-transform: uppercase; display: block; margin-bottom: 6px;">Official SECURE receipt</span>
                <h1 style="color: #ffffff; margin: 0; font-size: 28px; font-weight: 800; letter-spacing: -0.03em;">GREFAS</h1>
                <p style="color: #a1a1aa; margin: 8px 0 0 0; font-size: 13px;">Consult & Entertainment Hub</p>
              </div>

              <!-- Main Content Body -->
              <div style="padding: 40px 32px;">
                <div style="text-align: center; margin-bottom: 32px;">
                  <div style="display: inline-block; background-color: #fef2e9; border: 1px solid #ffedd5; border-radius: 9999px; padding: 8px 20px; margin-bottom: 16px;">
                    <span style="color: #ea580c; font-size: 12px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.05em;">Booking confirmed</span>
                  </div>
                  <h2 style="margin: 0; font-size: 22px; font-weight: 800; color: #111827; letter-spacing: -0.02em;">Apointment Reservation Secure</h2>
                  <p style="color: #4b5563; font-size: 14px; margin: 8px 0 0 0;">Hello ${userName}, thank you for choosing Grefas Consult. Here is your official service briefing itinerary receipt.</p>
                </div>

                <!-- Appointment Info Grid -->
                <div style="background-color: #f9fafb; border: 1px solid #f3f4f6; border-radius: 12px; padding: 24px; margin-bottom: 32px;">
                  
                  <div style="border-bottom: 1px solid #e5e7eb; padding-bottom: 12px; margin-bottom: 12px;">
                    <span style="display: block; font-size: 10px; font-weight: 800; color: #9ca3af; text-transform: uppercase; letter-spacing: 0.1em; margin-bottom: 2px;">Receipt Reference</span>
                    <span style="font-family: monospace; font-size: 16px; font-weight: 700; color: #ea580c;">${displayOrder}</span>
                  </div>

                  <div style="border-bottom: 1px solid #e5e7eb; padding-bottom: 12px; margin-bottom: 12px;">
                    <span style="display: block; font-size: 10px; font-weight: 800; color: #9ca3af; text-transform: uppercase; letter-spacing: 0.1em; margin-bottom: 2px;">Reserved Service</span>
                    <span style="font-size: 15px; font-weight: 750; color: #111827;">${serviceTitle}</span>
                  </div>

                  <div style="border-bottom: 1px solid #e5e7eb; padding-bottom: 12px; margin-bottom: 12px;">
                    <span style="display: block; font-size: 10px; font-weight: 800; color: #9ca3af; text-transform: uppercase; letter-spacing: 0.1em; margin-bottom: 2px;">Scheduled Date & Time</span>
                    <span style="font-size: 15px; font-weight: 700; color: #111827;">${displayDate} (UTC)</span>
                  </div>

                  <div style="border-bottom: 1px solid #e5e7eb; padding-bottom: 12px; margin-bottom: 12px;">
                    <span style="display: block; font-size: 10px; font-weight: 800; color: #9ca3af; text-transform: uppercase; letter-spacing: 0.1em; margin-bottom: 2px;">Assigned Coordinator</span>
                    <span style="font-size: 14px; font-weight: 600; color: #374151;">${displaySpecialist}</span>
                  </div>

                  <div style="border-bottom: 1px solid #e5e7eb; padding-bottom: 12px; margin-bottom: 12px;">
                    <span style="display: block; font-size: 10px; font-weight: 800; color: #9ca3af; text-transform: uppercase; letter-spacing: 0.1em; margin-bottom: 2px;">Service Overview</span>
                    <span style="font-size: 13px; color: #4b5563; line-height: 1.5; display: block; margin-top: 2px;">${displayDesc}</span>
                  </div>

                  <div>
                    <span style="display: block; font-size: 10px; font-weight: 800; color: #9ca3af; text-transform: uppercase; letter-spacing: 0.1em; margin-bottom: 2px;">Client Memo / Notes</span>
                    <span style="font-size: 13px; color: #4b5563; font-style: italic; display: block; margin-top: 2px;">"${displayNotes}"</span>
                  </div>

                </div>

                <!-- Guidance note -->
                <p style="font-size: 12px; color: #6b7280; line-height: 1.6; text-align: center; margin: 0;">
                  Need to cancel or reschedule? No problem. Use our live interactive system and search using ticket token <strong>${displayOrder}</strong>, or speak with an administration coordinator via support line.
                </p>
              </div>

              <!-- Sleek Footer -->
              <div style="background-color: #f9fafb; border-top: 1px solid #e5e7eb; padding: 24px; text-align: center;">
                <p style="margin: 0; font-size: 12px; color: #9ca3af;">&copy; 2026 Grefas Consult & Entertainment Hub. All rights reserved.</p>
                <div style="margin-top: 8px;">
                  <span style="display: inline-block; font-size: 11px; color: #9ca3af; text-decoration: none;">Secure Booking Desk Transmission</span>
                </div>
              </div>

            </div>
          `,
        });
        results.email = "sent";
      } catch (error) {
        console.error("Email error:", error);
        results.email = "failed";
      }
    } else {
      console.warn("RESEND_API_KEY not configured");
    }

    // Send SMS (uses Arkesel SMS gateway)
    if (phone) {
      const defaultSms = `Hi ${userName}, your booking ${orderNumber ? `(#${orderNumber}) ` : ''}for ${serviceTitle} on ${date} is CONFIRMED! - Grefas Consult`;
      results.sms = await sendSMS(
        phone,
        customMessage || defaultSms
      );
    } else {
      console.warn("SMS sending skipped: recipient phone number is missing");
    }

    res.json({ status: "ok", results });
  });

  // Dedicated Paystack Booking Payment Confirmation & Receipt Email Hook
  app.post("/api/notify-booking-payment", async (req, res) => {
    const {
      email,
      phone,
      userName,
      serviceTitle,
      date,
      time,
      orderNumber,
      amountPaid,
      paystackReference,
      paymentChannel,
      serviceDescription,
      teamMemberName,
      currency = "GHS"
    } = req.body;

    if (!userName || !serviceTitle || !amountPaid) {
      return res.status(400).json({ error: "Missing required payment receipt fields" });
    }

    const results = { email: "skipped", sms: "skipped" };
    const refCode = paystackReference || orderNumber || `TX-${Date.now()}`;
    const displayDate = time ? `${date} at ${time}` : date || "Scheduled Consultation";
    const displayChannel = paymentChannel || "Paystack Verified Channel";
    const displayAmount = Number(amountPaid).toFixed(2);

    // Send Resend Confirmation with PDF Receipt Attachment
    if (resend && email) {
      try {
        const pdfBuffer = generatePaymentReceiptPDF({
          fullName: userName,
          emailAddress: email,
          contact: phone || "N/A",
          amountPaid: Number(amountPaid),
          paymentPlan: "Consultation Appointment",
          paymentMethod: displayChannel,
          totalPrice: Number(amountPaid),
          balanceDue: 0,
          paymentStatus: "Fully Paid",
          refId: refCode
        });

        await resend.emails.send({
          from: getFromEmail("Grefas Consult & Finance"),
          to: email,
          subject: `Payment Confirmed & Verified [${refCode}] - ${serviceTitle}`,
          attachments: [
            {
              filename: `Official-Receipt-${refCode}.pdf`,
              content: pdfBuffer.toString("base64")
            }
          ],
          html: `
            <div style="font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #1f2937; max-width: 600px; margin: 0 auto; border: 1px solid #e5e7eb; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05);">
              
              <!-- Header -->
              <div style="background: linear-gradient(135deg, #0f172a 0%, #1e293b 100%); padding: 32px 24px; text-align: center; border-bottom: 4px solid #16a34a;">
                <span style="color: #4ade80; font-size: 11px; font-weight: 800; letter-spacing: 0.2em; text-transform: uppercase; display: block; margin-bottom: 6px;">Paystack Verified Transaction</span>
                <h1 style="color: #ffffff; margin: 0; font-size: 26px; font-weight: 800; letter-spacing: -0.03em;">GREFAS CONSULT</h1>
                <p style="color: #94a3b8; margin: 6px 0 0 0; font-size: 13px;">Official Finance & Appointment Desk</p>
              </div>

              <!-- Main Body -->
              <div style="padding: 36px 28px;">
                <div style="text-align: center; margin-bottom: 28px;">
                  <div style="display: inline-block; background-color: #dcfce7; border: 1px solid #bbf7d0; border-radius: 9999px; padding: 6px 18px; margin-bottom: 14px;">
                    <span style="color: #15803d; font-size: 12px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.05em;">✓ Payment Successfully Settled</span>
                  </div>
                  <h2 style="margin: 0; font-size: 22px; font-weight: 800; color: #0f172a;">Appointment & Payment Confirmed</h2>
                  <p style="color: #64748b; font-size: 14px; margin: 8px 0 0 0;">Dear ${userName}, thank you! Your booking payment of <strong>GH₵ ${displayAmount}</strong> has been confirmed and verified via Paystack.</p>
                </div>

                <!-- Transaction Details Card -->
                <div style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 12px; padding: 20px; margin-bottom: 24px;">
                  <h3 style="margin: 0 0 14px 0; font-size: 13px; font-weight: 800; color: #475569; text-transform: uppercase; letter-spacing: 0.08em; border-bottom: 1px solid #e2e8f0; padding-bottom: 8px;">Transaction Summary</h3>
                  
                  <table style="width: 100%; font-size: 13px; border-collapse: collapse;">
                    <tr>
                      <td style="padding: 6px 0; color: #64748b; width: 40%;">Paystack Reference:</td>
                      <td style="padding: 6px 0; font-family: monospace; font-weight: 700; color: #0f172a;">${refCode}</td>
                    </tr>
                    <tr>
                      <td style="padding: 6px 0; color: #64748b;">Amount Paid:</td>
                      <td style="padding: 6px 0; font-weight: 800; color: #16a34a; font-size: 15px;">GH₵ ${displayAmount} (${currency})</td>
                    </tr>
                    <tr>
                      <td style="padding: 6px 0; color: #64748b;">Payment Channel:</td>
                      <td style="padding: 6px 0; font-weight: 600; color: #334155;">${displayChannel}</td>
                    </tr>
                    <tr>
                      <td style="padding: 6px 0; color: #64748b;">Service:</td>
                      <td style="padding: 6px 0; font-weight: 700; color: #0f172a;">${serviceTitle}</td>
                    </tr>
                    <tr>
                      <td style="padding: 6px 0; color: #64748b;">Date & Time:</td>
                      <td style="padding: 6px 0; font-weight: 600; color: #334155;">${displayDate}</td>
                    </tr>
                    ${teamMemberName ? `
                    <tr>
                      <td style="padding: 6px 0; color: #64748b;">Specialist:</td>
                      <td style="padding: 6px 0; font-weight: 600; color: #334155;">${teamMemberName}</td>
                    </tr>
                    ` : ''}
                    <tr>
                      <td style="padding: 6px 0; color: #64748b;">Status:</td>
                      <td style="padding: 6px 0;">
                        <span style="background-color: #dcfce7; color: #166534; font-weight: 700; font-size: 11px; padding: 2px 8px; border-radius: 4px; text-transform: uppercase;">Paid & Verified</span>
                      </td>
                    </tr>
                  </table>
                </div>

                <!-- Attachment Notice -->
                <div style="background-color: #f0fdf4; border: 1px dashed #86efac; border-radius: 10px; padding: 14px 18px; margin-bottom: 24px; text-align: center;">
                  <span style="font-size: 13px; font-weight: 600; color: #166534; display: block;">📄 Official PDF Receipt Attached</span>
                  <span style="font-size: 11px; color: #15803d; display: block; margin-top: 4px;">An official stamped receipt <strong>Official-Receipt-${refCode}.pdf</strong> has been attached to this email for your financial records.</span>
                </div>

                <!-- Client Memo / Notice -->
                <p style="font-size: 12px; color: #64748b; line-height: 1.6; text-align: center; margin: 0;">
                  If you have any questions or need to make adjustments to your appointment, please contact our support team quoting reference <strong>${refCode}</strong>.
                </p>
              </div>

              <!-- Footer -->
              <div style="background-color: #f8fafc; border-top: 1px solid #e2e8f0; padding: 20px; text-align: center;">
                <p style="margin: 0; font-size: 12px; color: #94a3b8;">&copy; 2026 Grefas Consult & Entertainment. All rights reserved.</p>
              </div>

            </div>
          `
        });
        results.email = "sent";
      } catch (err: any) {
        console.error("Resend payment confirmation email error:", err);
        results.email = `failed: ${err.message}`;
      }
    } else if (!resend) {
      console.warn("RESEND_API_KEY not configured on server.");
    }

    // Send SMS Notification
    if (phone) {
      try {
        const smsMsg = `Payment Confirmed! Hi ${userName}, your GH₵ ${displayAmount} booking for ${serviceTitle} (${displayDate}) has been verified via Paystack [Ref: ${refCode}]. Receipt sent to ${email || 'your email'}. - Grefas Consult`;
        results.sms = await sendSMS(phone, smsMsg);
      } catch (sErr: any) {
        results.sms = `failed: ${sErr.message}`;
      }
    }

    res.json({ status: "ok", results, reference: refCode });
  });

  app.post("/api/notify-reminder", async (req, res) => {
    const { email, phone, userName, serviceTitle, date, customMessage } = req.body;

    if (!email || !userName || !serviceTitle || !date) {
      return res.status(400).json({ error: "Missing required fields" });
    }

    const results = { email: "skipped", sms: "skipped" };

    // Send Email Reminder
    if (resend) {
      try {
        await resend.emails.send({
          from: getFromEmail("Grefas Consult"),
          to: email,
          subject: "Reminder: Upcoming Booking - Grefas Consult & Entertainment",
          html: `
            <div style="font-family: sans-serif; color: #18181b; max-width: 600px; margin: 0 auto; border: 1px solid #e4e4e7; border-radius: 12px; overflow: hidden;">
              <div style="background-color: #ea580c; padding: 24px; text-align: center;">
                <h1 style="color: white; margin: 0; font-size: 24px; letter-spacing: -0.025em;">GREFAS.</h1>
              </div>
              <div style="padding: 32px;">
                <h2 style="margin-top: 0; font-size: 20px;">Booking Reminder</h2>
                <p>Hello ${userName},</p>
                <p>This is a friendly reminder for your upcoming booking for <strong>${serviceTitle}</strong>.</p>
                <div style="background-color: #f4f4f5; padding: 16px; border-radius: 8px; margin: 24px 0;">
                  <p style="margin: 0; font-size: 14px; color: #71717a;">Date</p>
                  <p style="margin: 4px 0 0 0; font-weight: bold; font-size: 18px;">${date}</p>
                </div>
                <p>We look forward to seeing you! If you need to reschedule, please let us know as soon as possible.</p>
                <p style="margin-top: 32px; font-size: 14px; color: #71717a;">Best regards,<br>The Grefas Team</p>
              </div>
            </div>
          `,
        });
        results.email = "sent";
      } catch (error) {
        console.error("Email error:", error);
        results.email = "failed";
      }
    }

    // Send SMS Reminder (uses Arkesel SMS gateway)
    if (phone) {
      results.sms = await sendSMS(
        phone,
        customMessage || `Reminder: Hi ${userName}, you have a booking for ${serviceTitle} on ${date}. We look forward to seeing you! - Grefas Consult`
      );
    } else {
      console.warn("SMS reminder skipped: recipient phone number is missing");
    }

    res.json({ status: "ok", results });
  });

  app.post("/api/send-direct-message", async (req, res) => {
    const { recipientEmail, recipientName, senderName, senderEmail, subject, message } = req.body;

    if (!recipientEmail || !recipientName || !senderName || !senderEmail || !message) {
      return res.status(400).json({ error: "Missing required fields" });
    }

    const results = { email: "skipped" };

    if (resend) {
      try {
        await resend.emails.send({
          from: getFromEmail("Grefas Consult"),
          to: recipientEmail,
          replyTo: senderEmail,
          subject: subject || `Grefas Message: ${senderName}`,
          html: `
            <div style="font-family: sans-serif; color: #18181b; max-width: 600px; margin: 0 auto; border: 1px solid #e4e4e7; border-radius: 12px; overflow: hidden;">
              <div style="background-color: #ea580c; padding: 24px; text-align: center;">
                <h1 style="color: white; margin: 0; font-size: 24px; letter-spacing: -0.025em; font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif;">GREFAS.</h1>
              </div>
              <div style="padding: 32px;">
                <h2 style="margin-top: 0; font-size: 20px; color: #ea580c;">Direct Specialist Message Alert</h2>
                <p>Hello ${recipientName},</p>
                <p>You have received a new direct advisory / booking message from a client on your Grefas profile page.</p>
                
                <div style="background-color: #f4f4f5; padding: 20px; border-radius: 8px; margin: 24px 0;">
                  <h3 style="margin-top: 0; font-size: 15px; border-bottom: 1px solid #e4e4e7; padding-bottom: 8px; margin-bottom: 12px; color: #27272a;">Inquiry Details</h3>
                  <p style="margin: 6px 0;"><strong>Sender:</strong> ${senderName}</p>
                  <p style="margin: 6px 0;"><strong>Sender Email:</strong> <a href="mailto:${senderEmail}">${senderEmail}</a></p>
                  <p style="margin: 6px 0;"><strong>Subject:</strong> ${subject || 'No Subject'}</p>
                  <p style="margin: 16px 0 0 0; white-space: pre-wrap; font-style: italic; color: #3f3f46; border-left: 3px solid #ea580c; padding-left: 12px;">"${message}"</p>
                </div>
                
                <p style="font-size: 14px; color: #71717a;">You can reply to this email directly to contact ${senderName} at their email: ${senderEmail}.</p>
                <p style="margin-top: 32px; font-size: 14px; color: #71717a;">Best regards,<br>The Grefas Platform</p>
              </div>
            </div>
          `,
        });
        results.email = "sent";
      } catch (error) {
        console.error("Direct email trigger breakdown:", error);
        results.email = "failed";
      }
    } else {
      console.warn("RESEND_API_KEY NOT configured; direct email skipped.");
    }

    res.json({ status: "ok", results });
  });

  app.post("/api/notify-intake-status", async (req, res) => {
    const { fullName, contact, status, emailAddress, emailNotificationsEnabled } = req.body;

    if (!fullName || !status) {
      return res.status(400).json({ error: "Missing required fields" });
    }

    const results = { sms: "skipped", email: "skipped" };

    if (contact) {
      try {
        let msg = "";
        if (status === "Approved") {
          msg = `Congratulations ${fullName}! Your Grefas Casting/Intake registration has been APPROVED. We will get in touch with you soon! - Grefas`;
        } else if (status === "In Review") {
          msg = `Hi ${fullName}, your Grefas Casting/Intake registration is now In Review. We are carefully evaluating your details! - Grefas`;
        } else if (status === "Rejected") {
          msg = `Hi ${fullName}, thank you for your interest. Unfortunately, your Grefas Casting/Intake application was not approved at this time. - Grefas`;
        } else {
          msg = `Hi ${fullName}, your Grefas Casting/Intake registration status has been updated to: ${status}. - Grefas`;
        }

        results.sms = await sendSMS(contact, msg);
      } catch (smsErr: any) {
        console.error("Failed to send status update SMS:", smsErr);
        results.sms = `failed: ${smsErr.message}`;
      }
    }

    if (resend && emailAddress && emailNotificationsEnabled !== false) {
      try {
        let statusColor = "#9333ea"; // Default violet
        let explanation = "";

        if (status === "Approved") {
          statusColor = "#10b981"; // Emerald
          explanation = "Congratulations! Our casting directors have approved your application. The casting team will reach out to you directly via WhatsApp or phone to finalize audition schedules.";
        } else if (status === "In Review") {
          statusColor = "#d97706"; // Amber
          explanation = "Your application is currently being actively reviewed by our coordinators. We are comparing local portfolios for specific roles.";
        } else if (status === "Rejected") {
          statusColor = "#ef4444"; // Red
          explanation = "Thank you for registering. Unfortunately, casting spaces for current slots are fully booked. We have stored your portfolio in the Grefas Archives for potential upcoming movie sequels.";
        } else {
          explanation = `Your current registration status has been updated to: ${status}.`;
        }

        await resend.emails.send({
          from: getFromEmail("Grefas Casting"),
          to: emailAddress,
          subject: `Audition Status Updated: ${status} - Grefas Entertainment`,
          html: `
            <div style="font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; color: #1f2937; max-width: 600px; margin: 0 auto; border: 1px solid #e5e7eb; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05);">
              <div style="background: linear-gradient(135deg, #18181b 0%, #27272a 100%); padding: 24px; text-align: center; border-bottom: 4px solid #ea580c;">
                <h1 style="color: white; margin: 0; font-size: 24px; font-weight: 800; letter-spacing: -0.025em;">GREFAS CASTING</h1>
                <p style="color: #ffedd5; margin: 4px 0 0 0; font-size: 12px; text-transform: uppercase; tracking-wider; font-weight: 700;">Application Status Update</p>
              </div>
              <div style="padding: 32px;">
                <h2 style="margin-top: 0; font-size: 20px; color: #111827; font-weight: 800;">Status Modified</h2>
                <p>Hello <strong>${fullName}</strong>,</p>
                <p>We are writing to inform you that your Movie & Skit registration status has been updated by Grefas Entertainment directors.</p>
                
                <div style="background-color: #f9fafb; border: 1px solid #f3f4f6; padding: 20px; border-radius: 8px; margin: 24px 0; text-align: center;">
                  <span style="font-size: 11px; text-transform: uppercase; font-weight: 700; color: #6b7280; letter-spacing: 0.05em; display: block; margin-bottom: 4px;">Current Stage</span>
                  <div style="display: inline-block; background-color: ${statusColor}15; color: ${statusColor}; border: 1px solid ${statusColor}30; padding: 8px 16px; border-radius: 9999px; font-weight: 800; font-size: 14px; text-transform: uppercase; letter-spacing: 0.05em;">
                    ● ${status}
                  </div>
                  <p style="font-size: 13px; color: #4b5563; line-height: 1.6; margin-top: 12px; margin-bottom: 0; font-weight: 500;">
                    ${explanation}
                  </p>
                </div>

                <p>You can view your detailed records or duplicate print drafts by logging into the <strong>My Applications</strong> portal.</p>

                <p style="margin-top: 32px; font-size: 13px; color: #71717a;">Warm regards,<br>The Grefas Entertainment Team</p>
              </div>
              <div style="background-color: #f3f4f6; padding: 16px; text-align: center; border-top: 1px solid #e5e7eb;">
                <p style="margin: 0; font-size: 11px; color: #9ca3af;">
                  You received this email because you opted into application status updates on your Grefas profile settings.
                </p>
              </div>
            </div>
          `
        });
        results.email = "sent";
      } catch (emailErr: any) {
        console.error("Failed to send status update email:", emailErr);
        results.email = `failed: ${emailErr.message}`;
      }
    }

    res.json({ status: "ok", results });
  });

  app.post("/api/notify-payment", async (req, res) => {
    const {
      fullName,
      emailAddress,
      contact,
      amountPaid,
      paymentPlan,
      paymentMethod,
      totalPrice,
      balanceDue,
      paymentStatus,
      refId
    } = req.body;

    if (!fullName || !amountPaid || !emailAddress) {
      return res.status(400).json({ error: "Missing required fields" });
    }

    const results = { sms: "skipped", email: "skipped" };

    // SMS Confirmation
    if (contact) {
      try {
        const msg = `Payment Received! Hello ${fullName}, your payment of GHS ${amountPaid} has been received. Balance Due: GHS ${balanceDue}. Thank you! - Grefas`;
        results.sms = await sendSMS(contact, msg);
      } catch (smsErr: any) {
        console.error("Failed to send payment receipt SMS:", smsErr);
        results.sms = `failed: ${smsErr.message}`;
      }
    }

    // Email Receipt
    if (resend && emailAddress) {
      try {
        const pdfBuffer = generatePaymentReceiptPDF({
          fullName,
          emailAddress,
          contact,
          amountPaid,
          paymentPlan,
          paymentMethod,
          totalPrice,
          balanceDue,
          paymentStatus,
          refId
        });

        await resend.emails.send({
          from: getFromEmail("Grefas Finance"),
          to: emailAddress,
          subject: `OFFICIAL RECEIPT: GHS ${amountPaid} Payment Acknowledged - Grefas Entertainment`,
          html: `
            <div style="font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; color: #1f2937; max-width: 600px; margin: 0 auto; border: 1px solid #e5e7eb; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05);">
              <div style="background: linear-gradient(135deg, #16a34a 0%, #15803d 100%); padding: 24px; text-align: center; border-bottom: 4px solid #166534;">
                <h1 style="color: white; margin: 0; font-size: 24px; font-weight: 800; letter-spacing: -0.025em;">GREFAS FINANCE</h1>
                <p style="color: #dcfce7; margin: 4px 0 0 0; font-size: 12px; text-transform: uppercase; tracking-wider; font-weight: 700;">Official Payment Receipt</p>
              </div>
              <div style="padding: 32px;">
                <h2 style="margin-top: 0; font-size: 20px; color: #111827; font-weight: 800; text-align: center;">Payment Successful!</h2>
                <p>Hello <strong>${fullName}</strong>,</p>
                <p>We have successfully received and processed your payment of <strong>GHS ${amountPaid}</strong>. We have generated an official PDF receipt for your records and attached it directly to this email.</p>
                <p>Please see the details of your official invoice transaction below.</p>
                
                <div style="background-color: #f9fafb; border: 1px solid #f3f4f6; padding: 20px; border-radius: 8px; margin: 24px 0;">
                  <h3 style="margin-top: 0; font-size: 14px; color: #111827; border-bottom: 1px solid #e5e7eb; padding-bottom: 8px; margin-bottom: 12px; font-weight: 700;">Receipt & Balance Summary</h3>
                  <table style="width: 100%; font-size: 13px; border-collapse: collapse;">
                    <tr>
                      <td style="padding: 6px 0; color: #71717a; width: 45%;"><strong>Reference Code:</strong></td>
                      <td style="padding: 6px 0; color: #1f2937; font-weight: 600;">${refId || 'N/A'}</td>
                    </tr>
                    <tr>
                      <td style="padding: 6px 0; color: #71717a;"><strong>Payment Method:</strong></td>
                      <td style="padding: 6px 0; color: #1f2937; font-weight: 600;">${paymentMethod || 'Mobile Money'}</td>
                    </tr>
                    <tr>
                      <td style="padding: 6px 0; color: #71717a;"><strong>Payment Plan:</strong></td>
                      <td style="padding: 6px 0; color: #1f2937; font-weight: 600;">${paymentPlan || 'One-time Full'}</td>
                    </tr>
                    <tr style="border-top: 1px solid #f3f4f6;">
                      <td style="padding: 10px 0 6px 0; color: #71717a;"><strong>Total Assigned Price:</strong></td>
                      <td style="padding: 10px 0 6px 0; color: #1f2937; font-weight: 600; font-size: 14px;">GHS ${totalPrice || '0.00'}</td>
                    </tr>
                    <tr>
                      <td style="padding: 6px 0; color: #16a34a; font-weight: bold;"><strong>Amount Received:</strong></td>
                      <td style="padding: 6px 0; color: #16a34a; font-weight: bold; font-size: 15px;">GHS ${amountPaid}</td>
                    </tr>
                    <tr style="border-top: 1px dashed #e5e7eb;">
                      <td style="padding: 10px 0; color: #71717a; font-weight: bold;"><strong>Balance Outstanding:</strong></td>
                      <td style="padding: 10px 0; color: #ef4444; font-weight: bold; font-size: 14px;">GHS ${balanceDue || '0.00'}</td>
                    </tr>
                    <tr>
                      <td style="padding: 6px 0; color: #71717a;"><strong>Payment Status:</strong></td>
                      <td style="padding: 6px 0; color: #1f2937; font-weight: 600;">
                        <span style="color: ${paymentStatus === 'Fully Paid' ? '#16a34a' : '#d97706'}">${paymentStatus || 'Partially Paid'}</span>
                      </td>
                    </tr>
                  </table>
                </div>

                <p>Thank you for partnering with us. Your registration status and digital payment invoice receipts can be accessed live on your Grefas member page under the <strong>My Applications</strong> portal.</p>

                <p style="margin-top: 32px; font-size: 13px; color: #71717a;">With appreciation,<br>The Grefas Finance Team</p>
              </div>
              <div style="background-color: #f3f4f6; padding: 16px; text-align: center; border-top: 1px solid #e5e7eb;">
                <p style="margin: 0; font-size: 11px; color: #9ca3af;">
                  Grefas Consult & Entertainment &bull; Accra, Ghana
                </p>
              </div>
            </div>
          `,
          attachments: [
            {
              filename: `Grefas_Official_Receipt_${refId || 'Payment'}.pdf`,
              content: pdfBuffer,
            }
          ]
        });
        results.email = "sent";
      } catch (emailErr: any) {
        console.error("Failed to send payment confirmation email:", emailErr);
        results.email = `failed: ${emailErr.message}`;
      }
    }

    res.json({ status: "ok", results });
  });

  app.post("/api/notify-intake", async (req, res) => {
    const { 
      fullName, 
      dateOfBirth, 
      age, 
      contact, 
      address, 
      whatsappNumber, 
      emailAddress,
      customMessage
    } = req.body;

    if (!fullName) {
      return res.status(400).json({ error: "Missing required fields: fullName" });
    }

    const results = { email: "skipped", sms: "skipped" };

    // Send SMS confirmation to applicant via Arkesel SMS gateway
    const phoneToUse = (contact || whatsappNumber || "").trim();
    if (phoneToUse) {
      try {
        results.sms = await sendSMS(
          phoneToUse,
          customMessage || `Hello ${fullName}, your Grefas application was received successfully! Status: Pending. Our team will review your profile. - Grefas`
        );
      } catch (smsErr: any) {
        console.error("Failed to send casting confirmation SMS:", smsErr);
        results.sms = `failed: ${smsErr.message}`;
      }
    }

    if (resend && emailAddress) {
      try {
        // 1. Send warning/confirmation email to the applicant
        await resend.emails.send({
          from: getFromEmail("Grefas Casting"),
          to: emailAddress,
          subject: "Casting Registration Received - Grefas Entertainment",
          html: `
            <div style="font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; color: #1f2937; max-width: 600px; margin: 0 auto; border: 1px solid #e5e7eb; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05);">
              <div style="background: linear-gradient(135deg, #18181b 0%, #27272a 100%); padding: 24px; text-align: center; border-bottom: 4px solid #ea580c;">
                <h1 style="color: white; margin: 0; font-size: 24px; font-weight: 800; letter-spacing: -0.025em;">GREFAS CASTING</h1>
                <p style="color: #ffedd5; margin: 4px 0 0 0; font-size: 12px; text-transform: uppercase; tracking-wider; font-weight: 700;">Movie & Skit Production Intake</p>
              </div>
              <div style="padding: 32px;">
                <h2 style="margin-top: 0; font-size: 20px; color: #111827; font-weight: 800;">Registration Received</h2>
                <p>Hello <strong>${fullName}</strong>,</p>
                <p>Thank you for submitting your Actor Casting & Skit Integration Form! Your profile has been logged successfully and is currently set to <strong>Pending</strong>.</p>
                
                <div style="background-color: #f9fafb; border: 1px solid #f3f4f6; padding: 20px; border-radius: 8px; margin: 24px 0;">
                  <h3 style="margin-top: 0; font-size: 14px; color: #111827; border-bottom: 1px solid #e5e7eb; padding-bottom: 8px; margin-bottom: 12px; font-weight: 700;">Submitted Details</h3>
                  <table style="width: 100%; font-size: 13px; border-collapse: collapse;">
                    <tr>
                      <td style="padding: 6px 0; color: #71717a; width: 35%;"><strong>Age:</strong></td>
                      <td style="padding: 6px 0; color: #1f2937; font-weight: 600;">${age} years old</td>
                    </tr>
                    <tr>
                      <td style="padding: 6px 0; color: #71717a;"><strong>Contact SMS:</strong></td>
                      <td style="padding: 6px 0; color: #1f2937; font-weight: 600;">${contact}</td>
                    </tr>
                    <tr>
                      <td style="padding: 6px 0; color: #71717a;"><strong>WhatsApp:</strong></td>
                      <td style="padding: 6px 0; color: #1f2937; font-weight: 600;">${whatsappNumber}</td>
                    </tr>
                    <tr>
                      <td style="padding: 6px 0; color: #71717a;"><strong>Address:</strong></td>
                      <td style="padding: 6px 0; color: #1f2937; font-weight: 600;">${address}</td>
                    </tr>
                    <tr>
                      <td style="padding: 6px 0; color: #71717a;"><strong>Birth Date:</strong></td>
                      <td style="padding: 6px 0; color: #1f2937; font-weight: 600;">${dateOfBirth}</td>
                    </tr>
                  </table>
                </div>

                <p><strong>Next Steps:</strong></p>
                <ul style="padding-left: 20px; font-size: 13px; color: #4b5563; line-height: 1.6; margin: 8px 0;">
                  <li>Our directors and casting division will review your details shortly.</li>
                  <li>Our authorized officers will reach out to schedule an active video audition if selected.</li>
                  <li>You can track your real-time status dynamically in the <strong>My Applications</strong> dashboard!</li>
                </ul>

                <p style="margin-top: 32px; font-size: 13px; color: #71717a;">Warm regards,<br>The Grefas Entertainment Team</p>
              </div>
            </div>
          `
        });

        // 2. Alert admins
        const adminReceipts = ["serwaahlinda1995@gmail.com", "asantegrice@gmail.com", "asantegrifice@gmail.com", "oseikwameemmanuel33@gmail.com"];
        await resend.emails.send({
          from: getFromEmail("Grefas Casting Alerts"),
          to: adminReceipts,
          subject: `[ALERT] New Casting Application - ${fullName}`,
          html: `
            <div style="font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; color: #18181b; max-width: 600px; margin: 0 auto; border: 1px solid #e4e4e7; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05);">
              <div style="background-color: #111827; padding: 24px; text-align: center; border-bottom: 4px solid #ea580c;">
                <h1 style="color: white; margin: 0; font-size: 18px; font-weight: 800; letter-spacing: 0.05em; text-transform: uppercase;">New Casting Registration</h1>
              </div>
              <div style="padding: 32px;">
                <p>Hello Admin,</p>
                <p>A new talent has successfully submitted the Movie & Skit making Form. Here is a summary of the details:</p>
                
                <div style="background-color: #f4f4f5; padding: 20px; border-radius: 8px; margin: 24px 0; border: 1px solid #e4e4e7;">
                  <table style="width: 100%; font-size: 13px; border-collapse: collapse;">
                    <tr>
                      <td style="padding: 6px 0; color: #71717a; width: 35%;"><strong>Applicant Name:</strong></td>
                      <td style="padding: 6px 0; font-weight: bold; color: #ea580c;">${fullName}</td>
                    </tr>
                    <tr>
                      <td style="padding: 6px 0; color: #71717a;"><strong>Email Address:</strong></td>
                      <td style="padding: 6px 0; font-weight: 600;"><a href="mailto:${emailAddress}" style="color: #ea580c; text-decoration: none;">${emailAddress}</a></td>
                    </tr>
                    <tr>
                      <td style="padding: 6px 0; color: #71717a;"><strong>Contact Phone:</strong></td>
                      <td style="padding: 6px 0; font-weight: 600;">${contact}</td>
                    </tr>
                    <tr>
                      <td style="padding: 6px 0; color: #71717a;"><strong>WhatsApp Number:</strong></td>
                      <td style="padding: 6px 0; font-weight: 600;">${whatsappNumber}</td>
                    </tr>
                    <tr>
                      <td style="padding: 6px 0; color: #71717a;"><strong>Residential Address:</strong></td>
                      <td style="padding: 6px 0;">${address}</td>
                    </tr>
                    <tr>
                      <td style="padding: 6px 0; color: #71717a;"><strong>Age context:</strong></td>
                      <td style="padding: 6px 0;">${age} years old (DOB: ${dateOfBirth})</td>
                    </tr>
                  </table>
                </div>

                <p style="font-size: 13px; color: #4b5563; line-height: 1.5;">You can change this applicant's status ('Pending', 'In Review', 'Approved') straight from the secure Administration board intakes section.</p>
                <div style="text-align: center; margin-top: 24px;">
                  <span style="display: inline-block; background-color: #ea580c; color: white; padding: 12px 24px; border-radius: 8px; text-decoration: none; font-size: 13px; font-weight: bold;">Grefas Management Desk</span>
                </div>
              </div>
            </div>
          `
        });

        results.email = "sent";
      } catch (error) {
        console.error("Casting registration notification breakdown error:", error);
        results.email = "failed";
      }
    } else {
      console.warn("RESEND_API_KEY is not configured in environment variables.");
    }

    res.json({ status: "ok", results });
  });

  app.post("/api/letters/generate", async (req, res) => {
    const { recipientName, recipientType, recipientAddress, subject, additionalContext, tone } = req.body;
    
    if (!recipientName || !subject) {
      return res.status(400).json({ error: "Missing required fields: recipientName or subject" });
    }

    if (!process.env.GEMINI_API_KEY) {
      return res.status(500).json({ error: "GEMINI_API_KEY environment variable is not configured." });
    }

    try {
      const { GoogleGenAI } = await import("@google/genai");
      const ai = new GoogleGenAI({
        apiKey: process.env.GEMINI_API_KEY,
        httpOptions: {
          headers: {
            'User-Agent': 'aistudio-build',
          }
        }
      });

      const prompt = `Write a professional official business letter from "Grefas Entertainment & Productions" (also known as Grefas Consult) to an ${recipientType || "individual/organisation"} named "${recipientName}" located at "${recipientAddress || "N/A"}".
The letter subject is "${subject}".
${additionalContext ? `Additional background context and key points to cover: "${additionalContext}"` : ""}
${tone ? `Tone: ${tone}` : "Tone: Professional, authoritative, and polite"}

Please generate ONLY the letter body paragraphs. DO NOT generate any letterhead, date, recipient address, salutation (like "Dear ..."), or sign-off (like "Sincerely ...") as these will be added automatically by the system.
Provide 2 to 4 elegant, well-structured paragraphs. Keep it professional and fully developed.`;

      let responseText = "";
      try {
        console.log("Attempting letter generation with gemini-3.6-flash...");
        const response = await ai.models.generateContent({
          model: "gemini-3.6-flash",
          contents: prompt,
        });
        responseText = response.text || "";
      } catch (firstErr: any) {
        console.log("Primary model gemini-3.6-flash unavailable/quota limited. Trying fallback gemini-flash-latest...", firstErr.message || firstErr);
        try {
          const response = await ai.models.generateContent({
            model: "gemini-flash-latest",
            contents: prompt,
          });
          responseText = response.text || "";
        } catch (secondErr: any) {
          console.log("All remote Gemini models quota limited or offline. Invoking local text generator...", secondErr.message || secondErr);
          // Bulletproof local fallback generator
          const contextText = additionalContext ? `In regard to ${additionalContext}, we want to reiterate our commitment to excellence.` : "We are writing to officially outline our terms and look forward to a highly successful cooperation.";
          responseText = `We are pleased to write to you on behalf of Grefas Entertainment & Productions concerning our ongoing discussions and mutual interests in the creative industry. As we move forward with our strategic plans, we want to express our sincere appreciation for your interest and proposed engagement with our organization.

${contextText} Our team is fully dedicated to ensuring that all aspects of this undertaking are executed with the highest standards of professionalism and artistic integrity. We believe that this collaboration will yield exceptional results and create outstanding value for both parties.

To facilitate the next steps, we propose that we schedule a formal review session to finalize the details and establish a clear timeline for our upcoming projects. Please review the attached contract guidelines, and let us know your availability at your earliest convenience so we can proceed accordingly.`;
        }
      }

      res.json({ text: responseText });
    } catch (err: any) {
      console.log("Gemini letter generation fallback triggered:", err?.message || err);
      const contextText = additionalContext ? `In regard to ${additionalContext}, we want to reiterate our commitment to excellence.` : "We are writing to officially outline our terms and look forward to a highly successful cooperation.";
      const responseText = `We are pleased to write to you on behalf of Grefas Entertainment & Productions concerning our ongoing discussions and mutual interests in the creative industry. As we move forward with our strategic plans, we want to express our sincere appreciation for your interest and proposed engagement with our organization.

${contextText} Our team is fully dedicated to ensuring that all aspects of this undertaking are executed with the highest standards of professionalism and artistic integrity. We believe that this collaboration will yield exceptional results and create outstanding value for both parties.

To facilitate the next steps, we propose that we schedule a formal review session to finalize the details and establish a clear timeline for our upcoming projects. Please review the attached contract guidelines, and let us know your availability at your earliest convenience so we can proceed accordingly.`;
      res.json({ text: responseText, isFallback: true });
    }
  });

  app.post("/api/gallery/generate-image", async (req, res) => {
    const { prompt } = req.body;

    if (!prompt || !prompt.trim()) {
      return res.status(400).json({ error: "Prompt is required." });
    }

    // Dynamic SVG image fallback function
    const generateFallbackSVG = (imagePrompt: string): string => {
      const colors = [
        { start: "#ff7e5f", end: "#feb47b" }, // Sunrise
        { start: "#6a11cb", end: "#2575fc" }, // Royal Blue
        { start: "#ff007f", end: "#7f00ff" }, // Cosmic neon
        { start: "#111111", end: "#e65c00" }, // Grefas Signature black-orange
        { start: "#3a7bd5", end: "#3a6073" }  // Steel blue
      ];
      const color = colors[imagePrompt.length % colors.length];
      
      const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 600 600" width="100%" height="100%">
        <defs>
          <linearGradient id="grad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" style="stop-color:${color.start};stop-opacity:1" />
            <stop offset="100%" style="stop-color:${color.end};stop-opacity:1" />
          </linearGradient>
          <filter id="shadow">
            <feDropShadow dx="2" dy="4" stdDeviation="4" flood-opacity="0.5"/>
          </filter>
        </defs>
        <rect width="600" height="600" fill="url(#grad)" />
        <circle cx="300" cy="300" r="220" fill="none" stroke="white" stroke-opacity="0.1" stroke-width="40" />
        <circle cx="300" cy="300" r="180" fill="none" stroke="white" stroke-opacity="0.15" stroke-width="2" />
        <path d="M150 150 L450 450" stroke="white" stroke-opacity="0.05" stroke-width="10" />
        <path d="M450 150 L150 450" stroke="white" stroke-opacity="0.05" stroke-width="10" />
        <rect x="30" y="30" width="540" height="540" rx="16" fill="none" stroke="white" stroke-opacity="0.2" stroke-width="2" />
        <text x="300" y="80" font-family="'Inter', system-ui, sans-serif" font-weight="900" font-size="16" fill="white" letter-spacing="4" fill-opacity="0.8" text-anchor="middle">GREFAS ENTERTAINMENT</text>
        <text x="300" y="300" font-family="'Inter', system-ui, sans-serif" font-weight="800" font-size="28" fill="white" text-anchor="middle" filter="url(#shadow)" style="text-transform: uppercase; letter-spacing: 2px;">
          ${imagePrompt.length > 35 ? imagePrompt.substring(0, 32) + '...' : imagePrompt}
        </text>
        <rect x="230" y="480" width="140" height="36" rx="18" fill="black" fill-opacity="0.3" stroke="white" stroke-opacity="0.3" stroke-width="1" />
        <text x="300" y="502" font-family="'JetBrains Mono', monospace" font-size="11" font-weight="bold" fill="white" text-anchor="middle" letter-spacing="1">GALLERY CONCEPT</text>
      </svg>`;
      
      return `data:image/svg+xml;base64,${Buffer.from(svg).toString('base64')}`;
    };

    if (!process.env.GEMINI_API_KEY) {
      console.warn("GEMINI_API_KEY environment variable is not configured. Yielding local fallback poster image.");
      return res.json({ success: true, url: generateFallbackSVG(prompt), isFallback: true });
    }

    try {
      const { GoogleGenAI } = await import("@google/genai");
      const ai = new GoogleGenAI({
        apiKey: process.env.GEMINI_API_KEY,
        httpOptions: {
          headers: {
            'User-Agent': 'aistudio-build',
          }
        }
      });

      // 1. Try Imagen 3 primary model
      try {
        console.log("Attempting image generation with imagen-3.0-generate-002...");
        const imgResult = await ai.models.generateImages({
          model: 'imagen-3.0-generate-002',
          prompt: `Generate a high-quality, professional image for a consulting and entertainment business gallery. Topic: ${prompt}. The image should be vibrant and modern.`,
          config: {
            numberOfImages: 1,
            outputMimeType: 'image/jpeg',
            aspectRatio: "1:1"
          }
        });
        const base64Bytes = imgResult.generatedImages?.[0]?.image?.imageBytes;
        if (base64Bytes) {
          return res.json({ success: true, url: `data:image/jpeg;base64,${base64Bytes}` });
        }
      } catch (firstErr: any) {
        console.log("Imagen 3.0 primary model unavailable or quota limited. Trying fallback gemini-3.1-flash-lite-image...", firstErr.message || firstErr);
        // 2. Try Gemini Flash Lite Image output
        try {
          const response = await ai.models.generateContent({
            model: 'gemini-3.1-flash-lite-image',
            contents: {
              parts: [
                {
                  text: `Generate a high-quality, professional image for a consulting and entertainment business gallery. Topic: ${prompt}. The image should be vibrant and modern.`,
                },
              ],
            },
            config: {
              imageConfig: {
                aspectRatio: "1:1"
              }
            }
          });
          let imageUrl = '';
          if (response.candidates?.[0]?.content?.parts) {
            for (const part of response.candidates[0].content.parts) {
              if (part.inlineData) {
                imageUrl = `data:image/png;base64,${part.inlineData.data}`;
                break;
              }
            }
          }
          if (imageUrl) {
            return res.json({ success: true, url: imageUrl });
          }
        } catch (secondErr: any) {
          console.log("Gemini image generation models quota reached. Serving clean SVG artwork fallback:", secondErr.message || secondErr);
          return res.json({ success: true, url: generateFallbackSVG(prompt), isFallback: true });
        }
      }

      res.json({ success: true, url: generateFallbackSVG(prompt), isFallback: true });
    } catch (err: any) {
      console.log("Gemini image generation exception caught. Serving local fallback poster:", err?.message || err);
      res.json({ success: true, url: generateFallbackSVG(prompt), isFallback: true });
    }
  });

  app.post("/api/letters/send-email", async (req, res) => {
    const {
      recipientEmail,
      recipientName,
      recipientAddress,
      date,
      subject,
      salutation,
      body,
      signatoryName,
      signatoryTitle,
      signatorySignature,
      letterheadType,
      logoUrl,
      settings
    } = req.body;

    if (!recipientEmail || !recipientName || !subject || !body) {
      return res.status(400).json({ error: "Missing required fields: recipientEmail, recipientName, subject, or body" });
    }

    if (!resend) {
      return res.status(503).json({ error: "Email server (Resend API Key) is not configured in environment variables." });
    }

    // Determine titles & subtitles based on letterheadType
    let headerTitle = "GREFAS ENTERTAINMENT & CONSULT";
    let headerSubtitle = "Theatre, Film Casting, Artiste Management, Production & Business Consulting";

    if (letterheadType === 'entertainment') {
      headerTitle = settings?.letterheadEntTitle || "GREFAS ENTERTAINMENT & PRODUCTIONS";
      headerSubtitle = settings?.letterheadEntSubtitle || "Skit & Movie Production, Casting Services, Creative Arts and Artiste Management";
    } else if (letterheadType === 'consult') {
      headerTitle = settings?.letterheadConsultTitle || "GREFAS BUSINESS & STRATEGY CONSULT";
      headerSubtitle = settings?.letterheadConsultSubtitle || "Corporate Advisory, Visa Interview Preparation, Strategic Management Consulting";
    } else {
      headerTitle = settings?.letterheadJointTitle || "GREFAS ENTERTAINMENT & CONSULT";
      headerSubtitle = settings?.letterheadJointSubtitle || "Theatre, Film Casting, Artiste Management, Production & Business Consulting";
    }

    const companyAddress = settings?.address || "Accra, Ghana";
    const companyPhone = settings?.phone || "+233 24 412 3456";
    const companyEmail = settings?.email || "info@grefas.com";

    const formattedDate = date 
      ? new Date(date).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })
      : new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });

    // Format paragraphs
    const formattedParagraphs = body
      .split('\n\n')
      .map((p: string) => p.trim())
      .filter((p: string) => p.length > 0)
      .map((p: string) => `<p style="margin: 0 0 16px 0; text-align: justify; text-indent: 24px; line-height: 1.6;">${p.replace(/\n/g, '<br/>')}</p>`)
      .join('');

    const logoHtml = logoUrl 
      ? `<img src="${logoUrl}" style="max-height: 70px; max-width: 130px; object-fit: contain; margin-bottom: 8px;" alt="Grefas Logo" />`
      : `<div style="font-size: 20px; font-weight: 800; color: #ea580c; border: 2px solid #ea580c; padding: 4px 10px; display: inline-block; letter-spacing: 1px; font-family: sans-serif; margin-bottom: 8px;">GREFAS</div>`;

    try {
      await resend.emails.send({
        from: getFromEmail("Grefas Consult"),
        to: recipientEmail,
        subject: `OFFICIAL CORRESPONDENCE: ${subject}`,
        html: `
          <div style="font-family: 'Times New Roman', Times, Georgia, serif; color: #1c1917; max-width: 650px; margin: 20px auto; border: 1px solid #e7e5e4; border-radius: 8px; overflow: hidden; background-color: #ffffff; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05);">
            <!-- Branded Header Letterhead -->
            <div style="border-bottom: 3px solid #ea580c; padding: 24px; background-color: #fcfcfc;">
              <table width="100%" cellspacing="0" cellpadding="0" style="border-collapse: collapse;">
                <tr>
                  <td width="30%" valign="top">
                    ${logoHtml}
                  </td>
                  <td width="70%" align="right" valign="top" style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;">
                    <h2 style="margin: 0 0 4px 0; font-size: 14px; font-weight: 800; color: #1c1917; text-transform: uppercase; letter-spacing: -0.2px;">${headerTitle}</h2>
                    <p style="margin: 0 0 8px 0; font-size: 8px; font-weight: 700; color: #ea580c; text-transform: uppercase; letter-spacing: 0.5px;">${headerSubtitle}</p>
                    <p style="margin: 0; font-size: 9px; color: #57534e; line-height: 1.4;">
                      ${companyAddress}<br/>
                      Phone: ${companyPhone} | Email: ${companyEmail}<br/>
                      Website: <a href="https://grefas.com" style="color: #ea580c; text-decoration: none;">www.grefas.com</a>
                    </p>
                  </td>
                </tr>
              </table>
            </div>

            <!-- Letter Sheet Body -->
            <div style="padding: 40px; font-size: 14px; line-height: 1.6;">
              <!-- Metadata Block -->
              <table width="100%" cellspacing="0" cellpadding="0" style="border-collapse: collapse; margin-bottom: 24px;">
                <tr>
                  <td width="60%" valign="top">
                    <p style="margin: 0 0 4px 0; font-size: 11px; font-weight: bold; color: #ea580c; text-transform: uppercase; font-family: sans-serif;">To Recipient</p>
                    <h3 style="margin: 0 0 4px 0; font-size: 15px; font-weight: bold; color: #1c1917;">${recipientName}</h3>
                    <p style="margin: 0; font-size: 12px; color: #44403c; white-space: pre-line; line-height: 1.4;">${recipientAddress || 'Address N/A'}</p>
                  </td>
                  <td width="40%" align="right" valign="top" style="font-family: sans-serif; font-size: 12px; color: #57534e;">
                    <strong>Date:</strong> ${formattedDate}
                  </td>
                </tr>
              </table>

              <!-- Subject Header -->
              <div style="border-top: 1px solid #d6d3d1; border-bottom: 1px solid #d6d3d1; padding: 10px 0; text-align: center; font-weight: bold; font-size: 15px; text-transform: uppercase; color: #1c1917; margin-bottom: 24px; background-color: #fafaf9; letter-spacing: 0.5px;">
                RE: ${subject}
              </div>

              <!-- Salutation -->
              <div style="font-weight: bold; margin-bottom: 16px; font-size: 14px;">
                ${salutation || 'Dear Sir/Madam,'}
              </div>

              <!-- Paragraphs -->
              <div style="color: #292524; font-size: 14px;">
                ${formattedParagraphs}
              </div>

              <!-- Sign-off Block -->
              <div style="margin-top: 36px; padding-top: 12px; page-break-inside: avoid;">
                <p style="margin: 0 0 12px 0;">Yours sincerely,</p>
                ${signatorySignature ? `<div style="margin: 8px 0;"><img src="${signatorySignature}" style="max-height: 55px; max-width: 170px; object-fit: contain;" alt="Signature" /></div>` : '<div style="height: 35px;"></div>'}
                <p style="margin: 0; font-weight: bold; color: #1c1917;">${signatoryName || 'Grice Asante'}</p>
                <p style="margin: 2px 0 0 0; font-size: 12px; color: #57534e;">${signatoryTitle || 'CEO & Founder'}</p>
              </div>
            </div>

            <!-- Footer Section -->
            <div style="background-color: #fafaf9; border-top: 1px solid #f5f5f4; padding: 16px; text-align: center; font-family: sans-serif; font-size: 10px; color: #a8a29e;">
              This is an official document of ${headerTitle}. All rights reserved. Registered in Ghana.
            </div>
          </div>
        `
      });

      res.json({ status: "ok", message: "Branded official email sent successfully via Resend!" });
    } catch (error: any) {
      console.error("Resend official letter failure:", error);
      res.status(500).json({ error: error.message || "Failed to dispatch official email via Resend." });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
    console.log("Running in development mode (Vite middleware enabled)");
  } else {
    if (fs.existsSync(distPath)) {
      app.use(express.static(distPath, {
        maxAge: '1d',
        index: false // We handle index.html manually below for SPA fallback
      }));
      
      app.get("*", (req, res) => {
        const indexPath = path.join(distPath, "index.html");
        if (fs.existsSync(indexPath)) {
          res.sendFile(indexPath);
        } else {
          res.status(404).send("Production build (index.html) not found. Please run 'npm run build'.");
        }
      });
      console.log(`Serving production assets from ${distPath}`);
    } else {
      console.error(`CRITICAL ERROR: Production 'dist' directory not found at ${distPath}`);
      app.get("*", (req, res) => {
        res.status(500).send("Application is not built. Please contact administrator.");
      });
    }
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
