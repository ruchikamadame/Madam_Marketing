# Google Calendar API Setup Guide

This document guides you through setting up Google Calendar and Email infrastructure for theMadam_Marketing website booking system.

## Prerequisites

- A Google account for the business
- Google Cloud Platform (GCP) access

## Step 1: Create Google Cloud Project

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project (e.g., "Madam Marketing")
3. Note the Project ID

## Step 2: Enable Google Calendar API

1. Navigate to [APIs & Services](https://console.cloud.google.com/apis/dashboard)
2. Click "ENABLE APIS AND SERVICES"
3. Search for "Google Calendar API"
4. Enable it

## Step 3: Create Service Account

1. Go to [Service Accounts](https://console.cloud.google.com/iam-admin/serviceaccounts)
2. Click "+ CREATE SERVICE ACCOUNT"
3. Fill in:
   - Service account name: `madam-marketing-booking`
   - Description: `Service account for booking system`
4. Click "CREATE AND CONTINUE"
5. Grant the following roles:
   - `Calendar API Service` → `Calendar ACL Reader`
   - `Calendar API Service` → `Calendar Event Writer`
   - `Project` → `Service Account User`
6. Click "DONE"

## Step 4: Generate JSON Key

1. In the service account list, find your account
2. Click the three dots → "Manage keys"
3. Click "ADD KEY" → "Create new key"
4. Select "JSON" format
5. Click "CREATE"
6. Save the downloaded JSON file as `service-account-key.json` in your `backend/` folder

## Step 5: Set Up Service Account Permissions for Admin Calendar

### Option A: Using Domain-Wide Delegation (Recommended for Business Domains)

1. In your Google Workspace admin console, go to [Security > API Controls > Domain-wide delegation](https://admin.google.com/ac/security/security/domain-wide-delegation)
2. Click "ADD NEW"
3. Enter:
   - Client ID: from the service account JSON (field: `client_id`)
   - API Scopes: `https://www.googleapis.com/auth/calendar`
4. Click "ADD"

### Option B: Grant Direct Access (Simpler approach)

1. Create a Google Calendar specifically for bookings (e.g., "Bookings - Madam Marketing")
2. Get the calendar ID by going to Calendar Settings → Integrate calendar
3. Share this calendar with your service account email (found in JSON file as `client_email`)
4. Give it "Make changes to events" permissions

## Step 6: Enable Gmail API (for sending emails)

1. In your Google Cloud project, enable "Gmail API"
2. Go to [OAuth consent screen](https://console.cloud.google.com/apis/credentials/consent) and configure it
3. Set scope to "send mail" and add test users

## Step 7: Set Up Email Credentials

### For Gmail (Recommended for testing):

1. Go to your Google Account → Security
2. Enable 2-Step Verification
3. Go to [App Passwords](https://myaccount.google.com/apppasswords)
4. Create an app password for "Mail"
5. Use this password in your `.env` file

### For Production (G Suite/Workspace):

Consider using:
- SendGrid
- Mailgun
- Amazon SES
- Google Workspace SMTP

## Step 8: Configure Environment Variables

Create a `.env` file in the `backend/` folder:

```env
# Google Calendar Configuration
GOOGLE_CALENDAR_CLIENT_EMAIL=your-service-account-email@project-id.iam.gserviceaccount.com
GOOGLE_CALENDAR_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\nYour-PrivateKey-Here\n-----END PRIVATE KEY-----\n"
GOOGLE_CALENDAR_PROJECT_ID=your-project-id
GOOGLE_CALENDAR_CALENDAR_ID=your-calendar-id@group.calendar.google.com

# Admin Email (will receive notifications)
ADMIN_EMAIL=admin@madamemarketing.com

# Email Configuration (SMTP)
EMAIL_USER=your-email@gmail.com
EMAIL_PASSWORD=your-app-password
EMAIL_HOST=smtp.gmail.com
EMAIL_PORT=587

# Server Configuration
PORT=3000
NODE_ENV=production
FRONTEND_URL=http://localhost:5500
```

**Important:**
- The `GOOGLE_CALENDAR_PRIVATE_KEY` must have literal `\n` inserted where line breaks are
- For multi-line keys, wrap the entire value in quotes and use `\n` between lines
- Never commit `.env` to version control

## Step 9: Update Frontend API URL (for production)

In `js/calendar-intergration.js`, update the fetch URL from `http://localhost:3000` to your production backend URL.

## Testing the Setup

1. Install backend dependencies:
```bash
cd backend
npm install
```

2. Start the server:
```bash
node server.js
```

3. Test the booking endpoint:

```bash
curl -X POST http://localhost:3000/api/book-consultation \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Test User",
    "email": "test@example.com",
    "phone": "+1234567890",
    "company": "Test Corp",
    "service": "Marketing Strategy",
    "message": "Testing booking system",
    "date": "2026-06-15",
    "time": "10:00 AM",
    "timezone": "Asia/Kolkata"
  }'
```

## Troubleshooting

### commonError: ["Access denied"]

- Check the service account has access to the calendar
- For domain accounts, verify domain-wide delegation is configured
- Test by sharing the calendar directly with the service account email

### commonError: ["Invalid grant"]

- Verify your private key has literal `\n` characters (not actual newlines)
- Ensure the service account email is correct
- Check the calendar ID is correct

### commonError: ["Not authorized to create events"]

- Grant the service account "Editor" or "Make changes" permissions on the calendar
- If using a shared calendar, verify permissions were accepted

### Email not sending

- Verify SMTP credentials are correct
- For Gmail, check app password was generated correctly
- Check spam folder for test emails
- Consider switching to a transactional email service for production

## Security Notes

1. **Never commit secrets** - `.env` should be in `.gitignore`
2. **Rotate keys** - Regularly rotate your service account keys
3. **Use HTTPS** - Always deploy with SSL/TLS in production
4. **Rate limiting** - Consider adding rate limiting to prevent abuse
5. **Input validation** - The backend validates input, but stay vigilant

## Support Resources

- [Google Calendar API Docs](https://developers.google.com/calendar/api)
- [Google Auth Library Docs](https://google-auth-library.readthedocs.io/)
- [Nodemailer Docs](https://nodemailer.com/)
