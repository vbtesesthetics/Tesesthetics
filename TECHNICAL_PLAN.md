# Salon Scheduler v13 — New Features

## Environment Variables Required (new in v13)
```
ANTHROPIC_API_KEY=sk-ant-...          # Feature 1: AI Assistant
GOOGLE_CLIENT_ID=...                  # Feature 6: Google Calendar
GOOGLE_CLIENT_SECRET=...              # Feature 6: Google Calendar
GOOGLE_REDIRECT_URI=https://yoursite.netlify.app/.netlify/functions/gcal-sync
```
Twilio vars (TWILIO_ACCOUNT_SID, etc.) already in comm_settings — Feature 2 uses those.

---

## Feature 1: AI Smart Booking Assistant
**File:** `functions/public-ai-assist.js`  
**UI:** Chat bubble (✨) injected at bottom-right of booking page

- Customer types naturally: *"I need a facial next Tuesday afternoon"*
- Claude reads your full service list, hours, and business context
- Pre-fills service selection, date, and notes automatically
- Conversation history maintained per session (last 10 messages)
- Rate-limited to 20 req/IP. Requires `ANTHROPIC_API_KEY`.

---

## Feature 2: Instant Booking Confirmation SMS
**File:** `functions/public-book.js` (added after booking insert)

- Fires the moment a booking is created — no cron lag
- Includes: service name, date/time, intake form link (if set), portal link
- Uses existing Twilio credentials from `comm_settings`
- Logs to `message_log` with type `confirmation`
- Non-blocking — SMS failure never prevents booking confirmation

---

## Feature 3: Client Style Reference Photos
**File:** `functions/admin-photos.js`  
**Table:** `client_photos` (migration 008)  
**UI:** Injected into client detail modal in admin

- Admin pastes a photo URL (e.g. from phone camera upload to Drive/Imgur)
- Grid view in client profile with captions
- Every photo labeled: *"Style reference only — not a medical record"*
- Delete individual photos
- **Note:** For direct camera upload, point to a Supabase Storage signed URL flow (get_upload_url action available)

---

## Feature 4: Smart Rebooking at Checkout
**File:** `functions/public-book.js` (rebook_suggestion in response), `site/booking/index.html`

- On confirmation page: *"Most clients rebook Classic Facial in ~4 weeks. How about Monday, April 7th?"*
- One tap → pre-selects service + jumps to date picker on that week
- Pulls from service's existing `rebook_days` field (set in Services admin tab)
- Shows only when primary service has `rebook_days > 0`

---

## Feature 5: Revenue Forecasting
**File:** `functions/admin-manage.js` (handleRevenue), `site/admin/index.html`

- Added to Revenue dashboard: **Next 7 Days** and **Next 30 Days** forecast cards
- Based on confirmed bookings already in the system
- Shows appointment count + estimated revenue range
- Pulls price ranges from booking_items price_snapshots

---

## Feature 6: Google Calendar Two-Way Sync
**Files:** `functions/gcal-sync.js`, `site/admin/index.html` (Google Cal tab)  
**Table:** `gcal_settings` (migration 008)

**Setup:**
1. Create OAuth 2.0 credentials in Google Cloud Console
2. Add `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GOOGLE_REDIRECT_URI` to Netlify env vars
3. In admin → Google Cal tab → click "Connect Google Calendar"

**What it does:**
- On each new booking: creates a Google Calendar event (async, non-blocking)
- "Import Blocked Times" button: scans next 30 days of GCal, imports personal events as one-off blocks
- Admin controls which calendar to sync to (default: primary)
- Token refresh handled automatically

---

## Feature 7: Shareable "Book With Me" Card
**File:** `site/card/index.html`  
**URL:** `/card/?b=your-slug`

- Beautiful branded mini-page with provider photo, bio, top 3 services, next available slot
- Customizable via Branding tab → new "Booking Card" section:
  - Provider photo URL
  - Card headline & bio
- Inherits all brand colors automatically
- Social links shown at bottom
- Share link copy button in admin branding tab
- Works as Instagram bio link, texted link, etc.

---

## Feature 8: Cancellation Policy Display
**Files:** `functions/public-config.js`, `functions/admin-manage.js`, `site/booking/index.html`  
**Config:** Settings tab → "Cancellation Policy" section

- Policy text shown in step 4 (info collection) of booking flow
- Configurable text (default: *"Cancellations within 24 hours may be subject to a fee."*)
- Also returned in booking API response for custom confirmation UIs
- Admin can set to empty string to hide entirely

---

## Feature 9: Intake Form Link Integration
**Files:** `functions/public-config.js`, `functions/admin-manage.js`  
**Config:** Settings tab → "Intake Form" section  
**UI:** Shown on booking confirmation page + in instant SMS

- Admin pastes any external form URL (Google Forms, Jotform, etc.)
- Confirmation page shows a prominent "Open Form →" button
- Included in instant booking confirmation SMS
- Reminder SMS will include it too (via intake_form_url in settings)
- We never host the form — fully HIPAA-safe

---

## Feature 10: Post-Visit Summary SMS
**File:** `functions/send-reminders.js` (sendPostVisitSummaries)  
**Config:** Admin → Communications → "Post-Visit Summary" section

- Fires via cron (same cadence as reminders): ~1 hour after appointment end
- Message: *"Thanks for visiting [Business]! Today: Classic Facial + LED add-on. Next recommended visit: ~4 weeks. Book again: [link]"*
- Rebook interval pulled from service's `rebook_days` field
- Deduplicated via `message_log` (type: `post_visit_summary`)
- Configurable delay (default 1 hour, max 48)

---

## Database Migration
Run `db/008_features_v13.sql` in Supabase SQL editor before deploying.

## New Files
- `functions/public-ai-assist.js`
- `functions/gcal-sync.js`
- `functions/admin-photos.js`
- `site/card/index.html`
- `db/008_features_v13.sql`
