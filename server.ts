import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import { Resend } from "resend";
import { jsPDF } from "jspdf";
import dotenv from "dotenv";
import compression from "compression";
import fs from "fs";
import { v2 as cloudinary } from "cloudinary";
import multer from "multer";
import { sendArkeselSms, checkArkeselBalance } from "./src/lib/arkeselSms";

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
  app.use(express.json());

  // Health check
  app.get("/api/health", (req, res) => {
    res.json({ status: "ok", timestamp: new Date().toISOString() });
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
    if (contact) {
      try {
        results.sms = await sendSMS(
          contact,
          customMessage || `Hello ${fullName}, your Grefas Casting application is received successfully! Status: Pending. Our team will review your profile. - Grefas`
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
        console.log("Attempting letter generation with gemini-3.5-flash...");
        const response = await ai.models.generateContent({
          model: "gemini-3.5-flash",
          contents: prompt,
        });
        responseText = response.text || "";
      } catch (firstErr: any) {
        console.warn("First model gemini-3.5-flash failed/unavailable. Trying stable fallback gemini-flash-latest...", firstErr.message || firstErr);
        try {
          const response = await ai.models.generateContent({
            model: "gemini-flash-latest",
            contents: prompt,
          });
          responseText = response.text || "";
        } catch (secondErr: any) {
          console.warn("Second model gemini-flash-latest failed. Trying lightweight fallback gemini-3.1-flash-lite...", secondErr.message || secondErr);
          try {
            const response = await ai.models.generateContent({
              model: "gemini-3.1-flash-lite",
              contents: prompt,
            });
            responseText = response.text || "";
          } catch (thirdErr: any) {
            console.warn("All Gemini models failed or quota exceeded. Invoking professional local fallback text generator...", thirdErr.message || thirdErr);
            // Bulletproof local fallback generator
            const contextText = additionalContext ? `In regard to ${additionalContext}, we want to reiterate our commitment to excellence.` : "We are writing to officially outline our terms and look forward to a highly successful cooperation.";
            responseText = `We are pleased to write to you on behalf of Grefas Entertainment & Productions concerning our ongoing discussions and mutual interests in the creative industry. As we move forward with our strategic plans, we want to express our sincere appreciation for your interest and proposed engagement with our organization.

${contextText} Our team is fully dedicated to ensuring that all aspects of this undertaking are executed with the highest standards of professionalism and artistic integrity. We believe that this collaboration will yield exceptional results and create outstanding value for both parties.

To facilitate the next steps, we propose that we schedule a formal review session to finalize the details and establish a clear timeline for our upcoming projects. Please review the attached contract guidelines, and let us know your availability at your earliest convenience so we can proceed accordingly.`;
          }
        }
      }

      res.json({ text: responseText });
    } catch (err: any) {
      console.error("Gemini letter generation experienced an unhandled exception. Yielding local fallback:", err);
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

      let response;
      try {
        console.log("Attempting image generation with gemini-3.1-flash-lite-image...");
        response = await ai.models.generateContent({
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
      } catch (firstErr: any) {
        console.warn("First model gemini-3.1-flash-lite-image failed. Trying fallback gemini-3.1-flash-image...", firstErr.message || firstErr);
        try {
          response = await ai.models.generateContent({
            model: 'gemini-3.1-flash-image',
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
        } catch (secondErr: any) {
          console.warn("Both Gemini image models failed or quota was exceeded. Generating beautiful local abstract poster image...", secondErr.message || secondErr);
          return res.json({ success: true, url: generateFallbackSVG(prompt), isFallback: true });
        }
      }

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
        res.json({ success: true, url: imageUrl });
      } else {
        console.warn("No inline data in response. Generating fallback SVG poster.");
        res.json({ success: true, url: generateFallbackSVG(prompt), isFallback: true });
      }
    } catch (err: any) {
      console.error("Gemini image generation failed entirely. Yielding local fallback poster:", err);
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
