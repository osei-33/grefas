import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import { Resend } from "resend";
import twilio from "twilio";
import dotenv from "dotenv";
import compression from "compression";
import fs from "fs";

// Node version check
const nodeVersion = process.versions.node.split(".")[0];
if (parseInt(nodeVersion) < 20) {
  console.error(`ERROR: Node.js version ${process.versions.node} is not supported.`);
  console.error("This application requires Node.js 20 or higher.");
  process.exit(1);
}

dotenv.config();

// Path resolution that works in both dev (tsx) and prod (bundled cjs)
const distPath = path.resolve(process.cwd(), "dist");
const publicPath = path.resolve(process.cwd(), "public");

const resend = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null;
const twilioClient = (process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN) 
  ? twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN) 
  : null;

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(compression());
  app.use(express.json());

  // Health check
  app.get("/api/health", (req, res) => {
    res.json({ status: "ok", timestamp: new Date().toISOString() });
  });

  // API Routes
  app.post("/api/notify-confirmation", async (req, res) => {
    const { email, phone, userName, serviceTitle, date } = req.body;

    if (!email || !userName || !serviceTitle || !date) {
      return res.status(400).json({ error: "Missing required fields" });
    }

    const results = { email: "skipped", sms: "skipped" };

    // Send Email
    if (resend) {
      try {
        await resend.emails.send({
          from: "Grefas Consult <notifications@resend.dev>", // Note: In production, use a verified domain
          to: email,
          subject: "Booking Confirmed - Grefas Consult & Entertainment",
          html: `
            <div style="font-family: sans-serif; color: #18181b; max-width: 600px; margin: 0 auto; border: 1px solid #e4e4e7; border-radius: 12px; overflow: hidden;">
              <div style="background-color: #ea580c; padding: 24px; text-align: center;">
                <h1 style="color: white; margin: 0; font-size: 24px; letter-spacing: -0.025em;">GREFAS.</h1>
              </div>
              <div style="padding: 32px;">
                <h2 style="margin-top: 0; font-size: 20px;">Booking Confirmed!</h2>
                <p>Hello ${userName},</p>
                <p>We are excited to confirm your booking for <strong>${serviceTitle}</strong>.</p>
                <div style="background-color: #f4f4f5; padding: 16px; border-radius: 8px; margin: 24px 0;">
                  <p style="margin: 0; font-size: 14px; color: #71717a;">Date</p>
                  <p style="margin: 4px 0 0 0; font-weight: bold; font-size: 18px;">${date}</p>
                </div>
                <p>If you have any questions, feel free to contact us.</p>
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
    } else {
      console.warn("RESEND_API_KEY not configured");
    }

    // Send SMS
    if (twilioClient && process.env.TWILIO_PHONE_NUMBER && phone) {
      try {
        // Format phone number to E.164
        let formattedPhone = phone.replace(/[^\d+]/g, ''); // Remove everything except digits and +
        if (formattedPhone.startsWith('0') && formattedPhone.length === 10) {
          formattedPhone = '+233' + formattedPhone.substring(1);
        } else if (!formattedPhone.startsWith('+')) {
          // Fallback: if no plus, assume it needs one
          formattedPhone = '+' + formattedPhone;
        }

        await twilioClient.messages.create({
          body: `Hi ${userName}, your booking for ${serviceTitle} on ${date} is CONFIRMED! - Grefas Consult`,
          from: process.env.TWILIO_PHONE_NUMBER,
          to: formattedPhone,
        });
        results.sms = "sent";
      } catch (error: any) {
        if (error.code === 21608) {
          console.error("SMS error (Twilio Trial Account): The recipient number is unverified.");
          results.sms = "failed (Twilio Trial: Unverified Number)";
        } else if (error.code === 21211) {
          console.error("SMS error (Invalid Number): The 'To' phone number is invalid.");
          results.sms = "failed (Invalid Phone Number)";
        } else if (error.code === 21408) {
          console.error("SMS error (Region Not Supported): The destination region is not supported by this account.");
          results.sms = "failed (Region Not Supported)";
        } else {
          console.error(`SMS error (Code ${error.code}):`, error.message);
          results.sms = `failed (${error.message || 'Unknown Error'})`;
        }
      }
    } else {
      console.warn("Twilio not configured or phone missing");
    }

    res.json({ status: "ok", results });
  });

  app.post("/api/notify-reminder", async (req, res) => {
    const { email, phone, userName, serviceTitle, date } = req.body;

    if (!email || !userName || !serviceTitle || !date) {
      return res.status(400).json({ error: "Missing required fields" });
    }

    const results = { email: "skipped", sms: "skipped" };

    // Send Email Reminder
    if (resend) {
      try {
        await resend.emails.send({
          from: "Grefas Consult <notifications@resend.dev>",
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

    // Send SMS Reminder
    if (twilioClient && process.env.TWILIO_PHONE_NUMBER && phone) {
      try {
        let formattedPhone = phone.replace(/[^\d+]/g, ''); // Remove everything except digits and +
        if (formattedPhone.startsWith('0') && formattedPhone.length === 10) {
          formattedPhone = '+233' + formattedPhone.substring(1);
        } else if (!formattedPhone.startsWith('+') && formattedPhone.length > 5) {
          formattedPhone = '+' + formattedPhone;
        }

        await twilioClient.messages.create({
          body: `Reminder: Hi ${userName}, you have a booking for ${serviceTitle} on ${date}. We look forward to seeing you! - Grefas Consult`,
          from: process.env.TWILIO_PHONE_NUMBER,
          to: formattedPhone,
        });
        results.sms = "sent";
      } catch (error: any) {
        if (error.code === 21608) {
          console.error("SMS error (Twilio Trial Account): The recipient number is unverified.");
          results.sms = "failed (Twilio Trial: Unverified Number)";
        } else if (error.code === 21211) {
          console.error("SMS error (Invalid Number): The 'To' phone number is invalid.");
          results.sms = "failed (Invalid Phone Number)";
        } else if (error.code === 21408) {
          console.error("SMS error (Region Not Supported): The destination region is not supported by this account.");
          results.sms = "failed (Region Not Supported)";
        } else {
          console.error(`SMS error (Code ${error.code}):`, error.message);
          results.sms = `failed (${error.message || 'Unknown Error'})`;
        }
      }
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
          from: "Grefas Consult <notifications@resend.dev>",
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
