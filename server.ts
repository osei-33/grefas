import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import { fileURLToPath } from "url";
import { Resend } from "resend";
import twilio from "twilio";
import dotenv from "dotenv";

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const resend = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null;
const twilioClient = (process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN) 
  ? twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN) 
  : null;

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

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
          console.error("SMS error (Twilio Trial Account): The recipient number is unverified. Please verify the number in your Twilio console or upgrade your account.");
          results.sms = "failed (unverified number)";
        } else {
          console.error("SMS error:", error);
          results.sms = "failed";
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
        } else if (!formattedPhone.startsWith('+')) {
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
          results.sms = "failed (unverified number)";
        } else {
          console.error("SMS error:", error);
          results.sms = "failed";
        }
      }
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
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
