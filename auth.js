# Salon Scheduler — Technical Plan

## 1. Build Order

### Phase 1: Database (done)
- [x] Design schema with 11 tables + enums
- [x] Row Level Security policies for public reads + admin writes
- [x] `initialize_business()` seed function for new installations
- [x] Indexes on all foreign keys and common query patterns

### Phase 2: Availability Engine (done)
- [x] Slot generation from business hours, blackouts, existing bookings
- [x] Cutoff rule enforcement (pre-blackout, end-of-day)
- [x] Buffer time calculation (before, after, new client extra)
- [x] Collision detection against confirmed bookings + one-off blocks
- [x] Timezone-safe conversion using Intl.DateTimeFormat
- [x] "Next suggestions" finder when no slots on requested date

### Phase 3: Public API (done)
- [x] GET /public-config — returns services, add-ons, hours, settings
- [x] POST /public-availability — generates slots for date range
- [x] POST /public-book — validates + creates booking atomically
- [x] POST /public-request — stores time request for admin review
- [x] Rate limiting on all public endpoints
- [x] Input validation with customer-friendly error messages

### Phase 4: Admin API (done)
- [x] JWT-based auth middleware using Supabase Auth
- [x] GET /admin-dashboard — day/week view with bookings + blocks
- [x] POST /admin-actions — block time, cancel, reschedule, manual book
- [x] POST /admin-manage — CRUD for services, add-ons, hours, blackouts, settings, requests, business profile

### Phase 5: Frontend — Booking Widget (done)
- [x] 5-step flow: new client → services → date/time → contact → confirm
- [x] Mobile-first responsive design (iPhone Chrome/WebKit safe)
- [x] Real-time slot loading per selected date
- [x] "Next available" suggestions when no slots
- [x] "Request a time" form with preferred days/windows
- [x] Non-medical notes field with warning label
- [x] Add-to-calendar buttons (Google Calendar URL + ICS download)
- [x] Policy line on confirmation page

### Phase 6: Frontend — Admin Dashboard (done)
- [x] Supabase Auth login screen
- [x] Tab navigation: Schedule, Requests, Services, Hours, Settings
- [x] Day/week toggle with date navigation
- [x] Booking cards with client details, services, actions
- [x] Modal forms for block time, manual booking, reschedule
- [x] Service and add-on CRUD with modal forms
- [x] Hours editor with per-day open/close/closed toggle
- [x] Recurring blackout management
- [x] Settings editor for all booking rules
- [x] Business profile editor
- [x] Request queue with status management

### Phase 7: Configuration & Deployment (done)
- [x] Netlify config with function routing and security headers
- [x] Environment variable template
- [x] Setup documentation with step-by-step instructions
- [x] Client install checklist

---

## 2. Key Design Decisions

### Why require phone (not just email)?
Salons overwhelmingly prefer texting clients for confirmations, reminders, and last-minute changes. Email-only clients are harder to reach. We require phone as primary, email as optional. The DB constraint is `phone OR email` to not block edge cases.

### Why Supabase Auth (not Netlify Identity)?
Supabase Auth integrates directly with our database and RLS policies. Admin users are linked via `admin_users.auth_user_id`. This gives us a single system for both data and auth, simpler than maintaining two auth systems.

### Why serverless functions for availability (not client-side)?
The availability engine is the "secret sauce." It must run server-side to: (1) prevent exposing business logic, (2) prevent double-booking with authoritative collision checks, (3) access all booking data without exposing it to the client.

### Why in-memory rate limiting?
Serverless functions have short lifetimes, so the in-memory store resets on cold starts. This is sufficient for MVP — it stops rapid-fire abuse within a warm function instance. For production hardening, replace with Redis (Upstash free tier) or a Supabase rate_limits table.

### Why single-file HTML pages?
No build step, no framework dependencies, no bundler configuration. The salon owner (or their developer) can understand and modify the pages. The booking widget is one HTML file. The admin dashboard is one HTML file. Both load fast on mobile. Future iterations could move to React/Svelte if complexity warrants it.

---

## 3. Availability Engine — Algorithm Detail

```
FOR each date in requested range:
  1. Look up business hours for this day_of_week
  2. If closed → skip
  3. Get recurring blackouts for this day_of_week
  4. Get one-off blocks overlapping this date
  5. Get confirmed bookings overlapping this date
  6. Compute effective_close = close_time - end_of_day_cutoff
  7. FOR slot_start = open_time; slot_start < effective_close; slot_start += increment:
     a. slot_end = slot_start + total_duration
     b. If slot_end > effective_close → skip
     c. FOR each blackout:
        - effective_blackout_start = blackout.start - pre_blackout_cutoff
        - If slot overlaps [effective_blackout_start, blackout.end] → skip
     d. Convert slot to UTC
     e. FOR each one-off block: if overlap → skip
     f. FOR each booking: if overlap → skip
     g. If slot is in the past → skip
     h. Add to available_slots
```

**Double-booking prevention** at booking time:
1. Compute exact start_at and end_at in UTC
2. Re-run all validation checks (hours, blackouts, one-offs)
3. Query `bookings WHERE status='confirmed' AND start_at < end_at AND end_at > start_at`
4. If ANY conflicts → reject with "not available" + suggest alternatives
5. If clear → INSERT booking

The gap between step 4 and step 5 is a race condition window. For MVP (single-provider salons with moderate traffic), this is acceptable. For high-concurrency scenarios, wrap in a Postgres serializable transaction or use advisory locks.
