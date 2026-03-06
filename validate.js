# Salon Scheduler — Setup & Deployment Guide

## Overview

A lightweight, serverless booking system for solo estheticians and small studios. Runs on Netlify (free tier) + Supabase (free tier). No payment processing, no medical/health intake.

**Architecture**: Static HTML frontend → Netlify Functions (serverless) → Supabase Postgres

---

## Prerequisites

- A GitHub account (to host the repo)
- A Netlify account (free tier works)
- A Supabase account (free tier works)
- Node.js 18+ installed locally (for `netlify dev` testing)

---

## Step 1: Create Supabase Project

1. Go to [supabase.com](https://supabase.com) and create a new project.
2. Choose a region close to the salon's location.
3. Set a strong database password and save it.
4. Once created, go to **Settings → API** and note:
   - **Project URL** (e.g. `https://abcdefg.supabase.co`)
   - **anon / public key** (starts with `eyJ...`)
   - **service_role key** (starts with `eyJ...`) — **KEEP THIS SECRET**

## Step 2: Run Database Migration

1. In your Supabase dashboard, go to **SQL Editor**.
2. Click **New Query**.
3. Paste the entire contents of `db/001_schema.sql`.
4. Click **Run**.
5. Verify tables were created under **Table Editor**.

## Step 3: Create First Admin User

1. In Supabase, go to **Authentication → Users**.
2. Click **Add User** → **Create New User**.
3. Enter the salon owner's email and a password.
4. Note the user's UUID (shown in the user list).
5. In **SQL Editor**, run:

```sql
-- Replace values with your actual data
SELECT initialize_business(
    'Studio Glow',           -- business name
    'studio-glow',           -- URL slug (lowercase, hyphens only)
    'America/New_York',      -- IANA timezone
    '123 Main St, Suite 4',  -- location text shown to customers
    'USER-UUID-HERE'::uuid   -- the auth user UUID from step 4
);
```

This creates the business, default settings, default hours (Mon-Fri 9-5), and links the admin user.

## Step 4: Deploy to Netlify

### Option A: Netlify CLI (recommended)

```bash
npm install -g netlify-cli
cd salon-scheduler
netlify login
netlify init
# Choose: Create & configure a new site
# Set build command: (leave blank)
# Set publish directory: site
# Set functions directory: functions
netlify deploy --prod
```

### Option B: GitHub + Netlify UI

1. Push the repo to a private GitHub repository.
2. In Netlify, click **Add new site → Import an existing project**.
3. Connect to GitHub, select the repo.
4. Build settings:
   - Build command: (leave blank)
   - Publish directory: `site`
   - Functions directory: `functions`
5. Click **Deploy**.

## Step 5: Set Environment Variables

In **Netlify → Site settings → Environment variables**, add:

| Key | Value |
|-----|-------|
| `SUPABASE_URL` | `https://your-project.supabase.co` |
| `SUPABASE_SERVICE_ROLE_KEY` | `eyJ...service-role-key` |
| `SUPABASE_ANON_KEY` | `eyJ...anon-key` |

**Redeploy** after setting these.

## Step 6: Configure Client-Side Keys

Edit `site/booking/index.html` and `site/admin/index.html`:

For the **booking page**, set the `SALON_SLUG` variable or pass it via URL parameter `?b=studio-glow`.

For the **admin page**, add before the closing `</head>` tag:

```html
<script>
  window.SUPABASE_URL = 'https://your-project.supabase.co';
  window.SUPABASE_ANON_KEY = 'eyJ...anon-key';
</script>
```

**IMPORTANT**: Only the anon key goes in client-side code. NEVER expose the service_role key.

## Step 7: Test

1. Visit `https://your-site.netlify.app/booking/?b=studio-glow`
2. Walk through the booking flow.
3. Visit `https://your-site.netlify.app/admin/`
4. Log in with the admin credentials from Step 3.
5. Add services, configure hours, test bookings.

## Step 8: Connect Custom Domain (optional)

1. In Netlify, go to **Domain settings → Add custom domain**.
2. Follow DNS instructions to point your domain.
3. Netlify handles HTTPS automatically.

---

## Client Install Checklist

Use this checklist for each new salon installation:

- [ ] Create Supabase project (client pays directly)
- [ ] Run database migration (001_schema.sql)
- [ ] Create Supabase auth user for salon owner
- [ ] Run `initialize_business()` with correct details
- [ ] Create Netlify site (client pays directly)
- [ ] Set 3 environment variables in Netlify
- [ ] Update booking page slug / URL parameter
- [ ] Update admin page Supabase keys
- [ ] Deploy to Netlify
- [ ] Test public booking flow end-to-end
- [ ] Test admin login and dashboard
- [ ] Add services and hours via admin
- [ ] Add lunch break blackout via admin
- [ ] Configure booking rules (slot increment, buffers, etc.)
- [ ] Test a booking and verify it shows in admin
- [ ] Connect custom domain (if applicable)
- [ ] Walk salon owner through admin dashboard
- [ ] Show salon owner how to block time, cancel, reschedule
- [ ] Provide login credentials securely

---

## Embedding the Booking Widget

To embed the booking page on an existing website, use an iframe:

```html
<iframe
  src="https://your-site.netlify.app/booking/?b=studio-glow"
  style="width:100%;min-height:700px;border:none;border-radius:12px"
  title="Book an Appointment"
></iframe>
```

Or link directly: `<a href="https://your-site.netlify.app/booking/?b=studio-glow">Book Now</a>`

---

## Cost Estimate (Per Salon)

| Service | Tier | Monthly Cost |
|---------|------|-------------|
| Supabase | Free | $0 (500MB DB, 50K auth users) |
| Netlify | Free | $0 (100GB bandwidth, 125K function calls) |
| **Total** | | **$0/month** for most small salons |

Supabase Pro ($25/mo) and Netlify Pro ($19/mo) only needed if traffic exceeds free tiers.

---

## Known Risks & Mitigations

### Double Booking
**Risk**: Two customers book the same slot simultaneously.
**Mitigation**: Server-side validation in `public-book.js` re-checks all availability rules AND existing bookings at creation time. The availability check and booking insert happen in sequence in the same function call. For extremely high concurrency, a Postgres advisory lock or serializable transaction could be added.

### Timezone / DST Bugs
**Risk**: Appointments show wrong time during DST transitions.
**Mitigation**: All times stored as `timestamptz` (UTC) in Postgres. Display conversion uses `Intl.DateTimeFormat` with explicit timezone parameter. The availability engine converts between local and UTC using the same API. Business timezone is stored per-business.

### Stale Availability
**Risk**: Customer sees a slot as available, but it's taken by the time they submit.
**Mitigation**: Server re-validates at booking time. If the slot was taken, the response includes the next 5 available times and a friendly error (no reason given).

### Rate Limiting
**Risk**: Automated abuse of public endpoints.
**Mitigation**: In-memory rate limiter (20 requests/minute per IP). For production, upgrade to Redis or a Supabase-based rate limit table. Netlify also provides DDoS protection at the edge.

### Service Role Key Exposure
**Risk**: Leaking the Supabase service_role key grants full DB access.
**Mitigation**: Key is only in Netlify environment variables, never in client code. RLS policies provide defense-in-depth. Admin pages only use the anon key with Supabase Auth.

### Caching
**Risk**: Cloudflare or browser caching serves stale availability data.
**Mitigation**: POST requests are not cached. The config endpoint uses GET but returns real-time data; add `Cache-Control: no-cache` header if caching becomes an issue.

### Data Isolation
**Risk**: One business accessing another's data.
**Mitigation**: All queries are scoped by `business_id`. RLS policies enforce this for direct DB access. Serverless functions always resolve business_id from slug and scope queries.

---

## Future Roadmap (Not Implemented)

These features are scoped out of MVP but designed for:

1. **Multi-chair / Multi-provider**: Add `provider_id` to bookings and availability. Each provider has their own schedule. The schema already has `business_id` isolation.

2. **Email Confirmations**: Via salon-owned EmailJS or SendGrid account. Templates included in design. No email passwords stored by us.

3. **SMS Reminders**: Via salon-owned Twilio account. Triggered by a scheduled Netlify Function or Supabase Edge Function.

4. **Google Calendar Sync**: Two-way sync using Google Calendar API. Salon connects their Google account via OAuth. Bookings create calendar events; blocked time in Google blocks slots.

5. **Waitlist**: When a slot is booked, offer "notify me if this opens up" for other interested customers.

6. **Recurring Appointments**: "Book this same time every 4 weeks" with automatic slot reservation.

7. **Client History**: Track visit history per customer (by phone/email match). Show in admin dashboard.

8. **Multi-language**: Internationalize the booking widget. The architecture supports it — all strings can be moved to a locale file.

9. **Analytics Dashboard**: Booking volume, popular services, peak hours, no-show tracking.

10. **Online Deposit / Prepayment**: When ready, integrate Stripe or Square. The booking flow has a clear step where payment could be inserted between confirmation and final booking. INTENTIONALLY excluded from MVP per constraints.
