import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import { Resend } from "resend";
import twilio from "twilio";
import dotenv from "dotenv";
import compression from "compression";
import fs from "fs";
import { v2 as cloudinary } from "cloudinary";
import multer from "multer";

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
      notes 
    } = req.body;

    if (!email || !userName || !serviceTitle || !date) {
      return res.status(400).json({ error: "Missing required fields" });
    }

    const results = { email: "skipped", sms: "skipped" };

    // Send Email
    if (resend) {
      try {
        const displayDate = time ? `${date} at ${time}` : date;
        const displayOrder = orderNumber ? `#${orderNumber}` : 'Pending Confirmation';
        const displaySpecialist = teamMemberName || 'Primary Available Specialist';
        const displayDesc = serviceDescription || 'Strategic planning, advisory, consult, or entertainment production briefing session.';
        const displayNotes = notes ? notes.trim() : 'No special notes provided.';

        await resend.emails.send({
          from: "Grefas Consult <notifications@resend.dev>", // Note: In production, use a verified domain
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
          console.warn("SMS warning (Twilio Trial Account): The recipient number is unverified.");
          results.sms = "failed (Twilio Trial: Unverified Number)";
        } else if (error.code === 21211) {
          console.warn("SMS warning (Invalid Number): The 'To' phone number is invalid.");
          results.sms = "failed (Invalid Phone Number)";
        } else if (error.code === 21408) {
          console.warn("SMS warning (Region Not Supported): The destination region is not supported by this account.");
          results.sms = "failed (Region Not Supported)";
        } else {
          console.warn(`SMS warning (Code ${error.code}):`, error.message);
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
          console.warn("SMS warning (Twilio Trial Account): The recipient number is unverified.");
          results.sms = "failed (Twilio Trial: Unverified Number)";
        } else if (error.code === 21211) {
          console.warn("SMS warning (Invalid Number): The 'To' phone number is invalid.");
          results.sms = "failed (Invalid Phone Number)";
        } else if (error.code === 21408) {
          console.warn("SMS warning (Region Not Supported): The destination region is not supported by this account.");
          results.sms = "failed (Region Not Supported)";
        } else {
          console.warn(`SMS warning (Code ${error.code}):`, error.message);
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

  app.post("/api/notify-intake", async (req, res) => {
    const { 
      fullName, 
      dateOfBirth, 
      age, 
      contact, 
      address, 
      whatsappNumber, 
      emailAddress 
    } = req.body;

    if (!fullName || !emailAddress) {
      return res.status(400).json({ error: "Missing required fields" });
    }

    const results = { email: "skipped" };

    if (resend) {
      try {
        // 1. Send warning/confirmation email to the applicant
        await resend.emails.send({
          from: "Grefas Casting <notifications@resend.dev>",
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
          from: "Grefas Casting Alerts <notifications@resend.dev>",
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
