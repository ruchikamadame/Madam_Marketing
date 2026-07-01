require("dotenv").config();
const express = require("express");
const cors = require("cors");
const { body, validationResult } = require("express-validator");
const { google } = require("googleapis");

// Resend (email) and optional fetch (for WhatsApp)
const { Resend } = require("resend");
const resend = new Resend(process.env.RESEND_API_KEY);

// Node 18+ already has global fetch. If you run an older Node version, uncomment the line below:
// const fetch = (...args) => import('node-fetch').then(({default: fetch}) => fetch(...args));

const app = express();
const PORT = process.env.PORT || 3000;

// CORS Configuration - Updated for production
const allowedOrigins = [
  "https://themadamemarketing.com",
  "https://www.themadamemarketing.com",
  "http://localhost:5500",
  "https://127.0.0.1:5500", // Keep for local development
];

app.use(
  cors({
    origin: function (origin, callback) {
      // Allow requests with no origin (like mobile apps or curl requests)
      if (!origin) return callback(null, true);

      if (allowedOrigins.indexOf(origin) !== -1) {
        callback(null, true);
      } else {
        console.log(`Blocked by CORS: ${origin}`);
        callback(new Error("Not allowed by CORS"));
      }
    },
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
    credentials: true,
  }),
);

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// =====================================================
// ENVIRONMENT VARIABLES SETUP
// =====================================================
const requiredEnvVars = [
  "GOOGLE_CALENDAR_CLIENT_EMAIL",
  "GOOGLE_CALENDAR_PRIVATE_KEY",
  "GOOGLE_CALENDAR_CALENDAR_ID",
  "GOOGLE_WORKSPACE_IMPERSONATE_EMAIL",
  "ADMIN_EMAIL",
  // Resend & CallMeBot configuration
  "RESEND_API_KEY"
];

// Validate required environment variables
function validateEnvironment() {
  const missing = requiredEnvVars.filter((envVar) => !process.env[envVar]);
  if (missing.length > 0) {
    console.error("[ERROR] Missing required environment variables:");
    missing.forEach((v) => console.error(`  - ${v}`));
    console.error("\nPlease create a .env file based on .env.example");
    process.exit(1);
  }
}

validateEnvironment();

// =====================================================
// GOOGLE CALENDAR API SETUP
// =====================================================
function getGoogleAuth() {
  const privateKey = process.env.GOOGLE_CALENDAR_PRIVATE_KEY.replace(
    /\\n/g,
    "\n",
  );

  const auth = new google.auth.JWT(
    process.env.GOOGLE_CALENDAR_CLIENT_EMAIL,
    null,
    privateKey,
    [
      "https://www.googleapis.com/auth/calendar.events",
      "https://www.googleapis.com/auth/calendar",
    ],
    process.env.GOOGLE_WORKSPACE_IMPERSONATE_EMAIL,
  );

  return auth;
}

const calendar = google.calendar({ version: "v3", auth: getGoogleAuth() });

// =====================================================
// API ROUTES
// =====================================================

// Health check endpoint
app.get("/api/health", (req, res) => {
  res.json({ status: "ok", message: "Madam Marketing API is running" });
});

// Create booking endpoint
app.post(
  "/api/book-consultation",
  [
    body("name")
      .trim()
      .isLength({ min: 2, max: 100 })
      .withMessage("Name must be 2-100 characters"),
    body("email").isEmail().normalizeEmail().withMessage("Invalid email"),
    body("phone").trim().optional(),
    body("company").trim().optional(),
    body("service").trim().notEmpty().withMessage("Service is required"),
    body("message").trim().optional(),
    body("date").isISO8601().withMessage("Invalid date format"),
    body("time")
      .matches(/^\d{1,2}:\d{2}\s?(AM|PM)$/i)
      .withMessage("Invalid time format"),
    body("timezone").trim().optional(),
  ],
  async (req, res) => {
    try {
      // Validate request
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          errors: errors.array(),
        });
      }

      const bookingData = req.body;
      console.log("[INFO] New booking request:", bookingData);

      // Parse date and time
      const meetingDateTime = parseDateTime(
        bookingData.date,
        bookingData.time,
        bookingData.timezone,
      );
      const endTime = new Date(meetingDateTime.getTime() + 60 * 60 * 1000); // 1 hour meeting

      // Create Google Meet link and calendar event
      const calendarEvent = await createCalendarEvent(
        bookingData,
        meetingDateTime,
        endTime,
      );

      // Send emails to both admin and user
      await sendBookingEmails(bookingData, calendarEvent);

      res.json({
        success: true,
        message: "Booking created successfully",
        data: {
          meetingLink: calendarEvent.hangoutLink,
          eventId: calendarEvent.id,
          user_email: bookingData.email,
          datetime: meetingDateTime.toISOString(),
        },
      });
    } catch (error) {
      console.error("[ERROR] Booking creation failed:", error);
      res.status(500).json({
        success: false,
        message: "Failed to create booking",
        error: error.message,
      });
    }
  },
);

// =====================================================
// HELPER FUNCTIONS
// =====================================================

function parseDateTime(dateStr, timeStr, timezone) {
  const date = new Date(dateStr);

  // Parse time (e.g., "9:00 AM" or "2:30 PM")
  const timeMatch = timeStr.match(/(\d{1,2}):(\d{2})\s?(AM|PM)/i);
  if (!timeMatch) {
    throw new Error("Invalid time format");
  }

  let hours = parseInt(timeMatch[1]);
  const minutes = parseInt(timeMatch[2]);
  const period = timeMatch[3].toUpperCase();

  if (period === "PM" && hours !== 12) hours += 12;
  if (period === "AM" && hours === 12) hours = 0;

  date.setHours(hours, minutes, 0, 0);

  return date;
}

async function createCalendarEvent(bookingData, startTime, endTime) {
  const formattedStart = startTime.toISOString();
  const formattedEnd = endTime.toISOString();

  const event = {
    summary: `Consultation - ${bookingData.name}`,
    description: `
    Client: ${bookingData.name}
    Email: ${bookingData.email}
    Phone: ${bookingData.phone || "N/A"}
    Company: ${bookingData.company || "N/A"}
    
    Service: ${bookingData.service}
    Message: ${bookingData.message || "N/A"}
        `.trim(),
    start: {
      dateTime: formattedStart,
      timeZone: bookingData.timezone || "UTC",
    },
    end: {
      dateTime: formattedEnd,
      timeZone: bookingData.timezone || "UTC",
    },
    conferenceData: {
      createRequest: {
        requestId: `booking-${Date.now()}`,
        conferenceSolutionKey: { type: "hangoutsMeet" },
      },
    },
    reminders: {
      useDefault: false,
      overrides: [
        { method: "email", minutes: 1440 }, // 1 day before
        { method: "popup", minutes: 10 }, // 10 minutes before
      ],
    },
  };

  // Create event with Google Meet
  const response = await calendar.events.insert({
    calendarId: process.env.GOOGLE_CALENDAR_CALENDAR_ID,
    resource: event,
    conferenceDataVersion: 1,
  });

  console.log("[INFO] Calendar event created:", response.data.id);
  return response.data;
}

/** -------------------------------------------------
 *  SEND EMAILS VIA RESEND
 * ------------------------------------------------- */
async function sendBookingEmails(bookingData, calendarEvent) {
  const meetingDate = new Date(calendarEvent.start.dateTime);
  const meetingEnd = new Date(calendarEvent.end.dateTime);

  const dateOptions = {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  };
  const timeOptions = {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
    timeZone: bookingData.timezone || "UTC",
  };

  const dateString = meetingDate.toLocaleDateString("en-US", dateOptions);
  const startTimeStr = meetingDate.toLocaleTimeString("en-US", timeOptions);
  const endTimeStr = meetingEnd.toLocaleTimeString("en-US", timeOptions);
  const meetLink = calendarEvent.hangoutLink;

  // -------------------------------------------------
  // 1️⃣ ADMIN NOTIFICATION EMAIL
  // -------------------------------------------------
  const adminHtml = `
    <h2>New Consultation Booking</h2>
    <p>A new consultation has been booked through the website.</p>
    <table style="border-collapse: collapse; width: 100%;">
      <tr><td style="padding:8px; border:1px solid #ddd; font-weight:bold;">Client Name:</td><td style="padding:8px; border:1px solid #ddd;">${bookingData.name}</td></tr>
      <tr><td style="padding:8px; border:1px solid #ddd; font-weight:bold;">Email:</td><td style="padding:8px; border:1px solid #ddd;"><a href="mailto:${bookingData.email}">${bookingData.email}</a></a></a></td></tr>
      <tr><td style="padding:8px; border:1px solid #ddd; font-weight:bold;">Phone:</td><td style="padding:8px; border:1px solid #ddd;">${bookingData.phone || "N/A"}</td></tr>
      <tr><td style="padding:8px; border:1px solid #ddd; font-weight:bold;">Company:</td><td style="padding:8px; border:1px solid #ddd;">${bookingData.company || "N/A"}</td></tr>
      <tr><td style="padding:8px; border:1px solid #ddd; font-weight:bold;">Service:</td><td style="padding:8px; border:1px solid #ddd;">${bookingData.service}</td></tr>
      <tr><td style="padding:8px; border:1px solid #ddd; font-weight:bold;">Message:</td><td style="padding:8px; border:1px solid #ddd;">${bookingData.message || "N/A"}</td></tr>
    </table>
    
    <h3>Meeting Details</h3>
    <p>
      <strong>Date:</strong> ${dateString}<br>
      <strong>Time:</strong> ${startTimeStr} - ${endTimeStr}<br>
      <strong>Google Meet Link:</strong> <a href="${meetLink}" target="_blank">Join Meeting</a>
    </p>
    
    <p><em>This meeting has been added to your Google Calendar with automatic reminders.</em></p>`;

  await resend.emails.send({
    from: `Madame Marketing <${process.env.EMAIL_FROM || "onboarding@resend.dev"}>`,
    to: process.env.ADMIN_EMAIL,
    subject: `New Consultation Booking - ${bookingData.name}`,
    html: adminHtml,
  });
  console.log("[INFO] Admin email sent via Resend");

  // -------------------------------------------------
  // 2️⃣ USER CONFIRMATION EMAIL
  // -------------------------------------------------
  const userHtml = `
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Consultation Confirmed</title>
    </head>
    <body style="margin: 0; padding: 0; background-color: #000000; font-family: Arial, sans-serif; -webkit-font-smoothing: antialiased; width: 100% !important;">
      <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" style="background-color: #000000;">
        <tr>
          <td align="center" style="padding: 40px 10px;">
            <!-- Outer Container Table -->
            <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" style="max-width: 600px; background-color: #111111; border-top: 4px solid #93061d; border-radius: 12px; overflow: hidden; box-shadow: 0 10px 30px rgba(0,0,0,0.5);">
              
              <!-- 1️⃣ HEADER / LOGO -->
              <tr>
                <td align="center" style="padding: 40px 40px 20px 40px;">
                  <span style="font-family: Georgia, serif; font-size: 24px; font-weight: 600; color: #ffffff; letter-spacing: 1px;">
                    Madame <strong style="color: #93061d;">Marketing</strong>
                  </span>
                  <div style="font-size: 11px; color: #666666; letter-spacing: 3px; text-transform: uppercase; margin-top: 6px; font-weight: 500;">
                    Where Strategy Meets Taste
                  </div>
                </td>
              </tr>

              <!-- 2️⃣ HERO SECTION -->
              <tr>
                <td style="padding: 20px 40px; text-align: center;">
                  <h1 style="font-family: Georgia, serif; font-size: 28px; font-weight: 400; color: #ffffff; margin: 0 0 16px 0; font-style: italic;">
                    Your Consultation is Confirmed.
                  </h1>
                  <p style="font-size: 14px; line-height: 1.6; color: #aaaaaa; margin: 0; max-width: 480px; display: inline-block;">
                    Thank you for reaching out to us. We have reserved dedicated creative time to discuss your brand's direction and strategy.
                  </p>
                </td>
              </tr>

              <!-- 3️⃣ MEETING DETAILS -->
              <tr>
                <td style="padding: 20px 40px;">
                  <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" style="border: 1px solid #222222; border-radius: 8px; background-color: #0c0c0c;">
                    <tr>
                      <td style="padding: 24px;">
                        <h3 style="font-family: Georgia, serif; font-size: 16px; font-weight: 600; color: #ffffff; margin: 0 0 16px 0; border-bottom: 1px solid #222222; padding-bottom: 8px;">
                          Booking Overview
                        </h3>
                        
                        <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%">
                          <!-- Date -->
                          <tr>
                            <td style="padding: 6px 0; font-size: 13px; color: #666666; width: 30%; font-weight: bold; text-transform: uppercase; letter-spacing: 0.5px;">Date:</td>
                            <td style="padding: 6px 0; font-size: 14px; color: #ffffff;">${dateString}</td>
                          </tr>
                          <!-- Time -->
                          <tr>
                            <td style="padding: 6px 0; font-size: 13px; color: #666666; font-weight: bold; text-transform: uppercase; letter-spacing: 0.5px;">Time:</td>
                            <td style="padding: 6px 0; font-size: 14px; color: #ffffff;">${startTimeStr} - ${endTimeStr} (${bookingData.timezone || 'UTC'})</td>
                          </tr>
                          <!-- Service -->
                          <tr>
                            <td style="padding: 6px 0; font-size: 13px; color: #666666; font-weight: bold; text-transform: uppercase; letter-spacing: 0.5px;">Service:</td>
                            <td style="padding: 6px 0; font-size: 14px; color: #ffffff; text-transform: capitalize;">${bookingData.service.replace('-', ' ')}</td>
                          </tr>
                        </table>
                      </td>
                    </tr>
                  </table>
                </td>
              </tr>

              <!-- 4️⃣ CALL TO ACTION (CTA) -->
              <tr>
                <td align="center" style="padding: 10px 40px 40px 40px;">
                  <table role="presentation" border="0" cellpadding="0" cellspacing="0">
                    <tr>
                      <td align="center" style="border-radius: 30px; background-color: #93061d;">
                        <a href="${meetLink}" target="_blank" style="font-family: Arial, sans-serif; font-size: 14px; font-weight: bold; color: #ffffff; text-decoration: none; padding: 16px 36px; display: inline-block; letter-spacing: 1px; text-transform: uppercase;">
                          Join Google Meet →
                        </a>
                      </td>
                    </tr>
                  </table>
                  <p style="font-size: 11px; color: #666666; margin: 12px 0 0 0;">
                    Or join directly via: <a href="${meetLink}" style="color: #93061d; text-decoration: none;">${meetLink}</a>
                  </p>
                </td>
              </tr>

              <!-- 5️⃣ BRAND FOOTER -->
              <tr>
                <td align="center" style="padding: 30px 40px; background-color: #0a0a0a; border-top: 1px solid #1a1a1a;">
                  <p style="font-size: 12px; color: #444444; margin: 0 0 12px 0;">
                    Connect with our creative house:
                  </p>
                  <table role="presentation" border="0" cellpadding="0" cellspacing="0" style="margin-bottom: 20px;">
                    <tr>
                      <td style="padding: 0 10px;">
                        <a href="https://www.instagram.com/themadamemarketing" target="_blank" style="font-size: 12px; color: #93061d; text-decoration: none; font-weight: bold; text-transform: uppercase; letter-spacing: 1px;">
                          Instagram
                        </a>
                      </td>
                      <td style="color: #222222;">|</td>
                      <td style="padding: 0 10px;">
                        <a href="https://wa.me/919217938911" target="_blank" style="font-size: 12px; color: #93061d; text-decoration: none; font-weight: bold; text-transform: uppercase; letter-spacing: 1px;">
                          WhatsApp
                        </a>
                      </td>
                    </tr>
                  </table>
                  <p style="font-size: 11px; color: #333333; margin: 0; letter-spacing: 0.5px;">
                    &copy; 2026 Madame Marketing. All rights reserved.
                  </p>
                </td>
              </tr>

            </table>
          </td>
        </tr>
      </table>
    </body>
    </html>
  `;

  await resend.emails.send({
    from: `Madame Marketing <${process.env.EMAIL_FROM || "onboarding@resend.dev"}>`,
    to: bookingData.email,
    subject: `Consultation Confirmed - ${dateString} at ${startTimeStr}`,
    html: userHtml,
  });
  console.log("[INFO] User email sent via Resend");
}

// =====================================================
// START SERVER
// =====================================================
app.listen(PORT, () => {
  console.log(`[INFO] Server running on port ${PORT}`);
  console.log(`[INFO] Environment: ${process.env.NODE_ENV || "development"}`);
  console.log(`[INFO] Admin email: ${process.env.ADMIN_EMAIL}`);
});
