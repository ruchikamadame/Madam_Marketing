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
      "http://localhost:5500" // Keep for local development
    ];
    
    app.use(
      cors({
        origin: function (origin, callback) {
          // Allow requests with no origin (like mobile apps or curl requests)
          if (!origin) return callback(null, true);
    
          if (allowedOrigins.indexOf(origin) !== -1) {
            callback(null, true);
          } else {
            console.log(Blocked by CORS: ${origin});
            callback(new Error("Not allowed by CORS"));
          }
        },
        methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
        allowedHeaders: ["Content-Type", "Authorization"],
        credentials: true
      })
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
      "ADMIN_EMAIL",
      // Resend & CallMeBot configuration
      "RESEND_API_KEY",
      "CALLMEBOT_APIKEY",
      "OWNER_WHATSAPP"
    ];
    
    // Validate required environment variables
    function validateEnvironment() {
      const missing = requiredEnvVars.filter((envVar) => !process.env[envVar]);
      if (missing.length > 0) {
        console.error("[ERROR] Missing required environment variables:");
        missing.forEach((v) => console.error(  - ${v}));
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
        "\n"
      );
    
      const auth = new google.auth.JWT(
        process.env.GOOGLE_CALENDAR_CLIENT_EMAIL,
        null,
        privateKey,
        [
          "https://www.googleapis.com/auth/calendar.events",
          "https://www.googleapis.com/auth/calendar"
        ]
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
        body("timezone").trim().optional()
      ],
      async (req, res) => {
        try {
          // Validate request
          const errors = validationResult(req);
          if (!errors.isEmpty()) {
            return res.status(400).json({
              success: false,
              errors: errors.array()
            });
          }
    
          const bookingData = req.body;
          console.log("[INFO] New booking request:", bookingData);
    
          // Parse date and time
          const meetingDateTime = parseDateTime(
            bookingData.date,
            bookingData.time,
            bookingData.timezone
          );
          const endTime = new Date(meetingDateTime.getTime() + 60 * 60 * 1000); // 1 hour meeting
    
          // Create Google Meet link and calendar event
          const calendarEvent = await createCalendarEvent(
            bookingData,
            meetingDateTime,
            endTime
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
              datetime: meetingDateTime.toISOString()
            }
          });
        } catch (error) {
          console.error("[ERROR] Booking creation failed:", error);
          res.status(500).json({
            success: false,
            message: "Failed to create booking",
            error: error.message
          });
        }
      }
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
        summary: Consultation - ${bookingData.name},
        description: `
    Client: ${bookingData.name}
    Email: ${bookingData.email}
    Phone: ${bookingData.phone || 'N/A'}
    Company: ${bookingData.company || 'N/A'}
    
    Service: ${bookingData.service}
    Message: ${bookingData.message || 'N/A'}
        `.trim(),
        start: {
          dateTime: formattedStart,
          timeZone: bookingData.timezone || 'UTC'
        },
        end: {
          dateTime: formattedEnd,
          timeZone: bookingData.timezone || 'UTC'
        },
        conferenceData: {
          createRequest: {
            requestId: booking-${Date.now()},
            conferenceSolutionKey: { type: 'hangoutsMeet' }
          }
        },
        reminders: {
          useDefault: false,
          overrides: [
            { method: 'email', minutes: 1440 }, // 1 day before
            { method: 'popup', minutes: 10 }    // 10 minutes before
          ]
        }
      };
    
      // Create event with Google Meet
      const response = await calendar.events.insert({
        calendarId: process.env.GOOGLE_CALENDAR_CALENDAR_ID,
        resource: event,
        conferenceDataVersion: 1
      });
    
      console.log('[INFO] Calendar event created:', response.data.id);
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
        day: "numeric"
      };
      const timeOptions = {
        hour: "numeric",
        minute: "2-digit",
        hour12: true,
        timeZone: bookingData.timezone || "UTC"
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
      <tr><td style="padding:8px; border:1px solid #ddd; font-weight:bold;">Email:</td><td style="padding:8px; border:1px solid #ddd;"><a href="mailto:${bookingData.email}">${bookingData.email}</a></td></tr>
      <tr><td style="padding:8px; border:1px solid #ddd; font-weight:bold;">Phone:</td><td style="padding:8px; border:1px solid #ddd;">${bookingData.phone || 'N/A'}</td></tr>
      <tr><td style="padding:8px; border:1px solid #ddd; font-weight:bold;">Company:</td><td style="padding:8px; border:1px solid #ddd;">${bookingData.company || 'N/A'}</td></tr>
      <tr><td style="padding:8px; border:1px solid #ddd; font-weight:bold;">Service:</td><td style="padding:8px; border:1px solid #ddd;">${bookingData.service}</td></tr>
      <tr><td style="padding:8px; border:1px solid #ddd; font-weight:bold;">Message:</td><td style="padding:8px; border:1px solid #ddd;">${bookingData.message || 'N/A'}</td></tr>
    </table>
    
    <h3>Meeting Details</h3>
    <p>
      <strong>Date:</strong> ${dateString}<br>
      <strong>Time:</strong> ${startTimeStr} - ${endTimeStr}<br>
      <strong>Google Meet Link:</strong> <a href="${meetLink}" target="_blank">Join Meeting</a>
    </p>
    
    <p><em>This meeting has been added to your Google Calendar with automatic reminders.</em></p>`;
    
      await resend.emails.send({
        from: Madame Marketing <${process.env.EMAIL_FROM || 'onboarding@resend.dev'}>,
        to: process.env.ADMIN_EMAIL,
        subject: New Consultation Booking - ${bookingData.name},
        html: adminHtml
      });
      console.log('[INFO] Admin email sent via Resend');
    
      // -------------------------------------------------
      // 2️⃣ USER CONFIRMATION EMAIL
      // -------------------------------------------------
      const userHtml = `
    <h2>Consultation Confirmed!</h2>
    <p>Thank you for booking a consultation with Madame Marketing. Your meeting has been confirmed.</p>
    
    <h3>Meeting Details</h3>
    <p>
      <strong>Date:</strong> ${dateString}<br>
      <strong>Time:</strong> ${startTimeStr} - ${endTimeStr} (${bookingData.timezone || 'UTC'})<br>
      <strong>Google Meet Link:</strong> <a href="${meetLink}" target="_blank">Join Meeting</a>
    </p>
    
    <p>We look forward to speaking with you! If you need to reschedule, just reply to this email.</p>
    
    <p>Best regards,<br>Madame Marketing Team</p>`;
    
      await resend.emails.send({
        from: Madame Marketing <${process.env.EMAIL_FROM || 'onboarding@resend.dev'}>,
        to: bookingData.email,
        subject: Consultation Confirmed - ${dateString} at ${startTimeStr},
        html: userHtml
      });
      console.log('[INFO] User email sent via Resend');
    }
    
    // =====================================================
    // START SERVER
    // =====================================================
    app.listen(PORT, () => {
      console.log([INFO] Server running on port ${PORT});
      console.log([INFO] Environment: ${process.env.NODE_ENV || "development"});
      console.log([INFO] Admin email: ${process.env.ADMIN_EMAIL});
    });