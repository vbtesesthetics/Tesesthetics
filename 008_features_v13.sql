-- ============================================================================
-- SALON SCHEDULER — Migration 006
-- Recurring appointments, waitlist, seasonal services, UTM tracking
-- ============================================================================

-- Recurring appointment series
CREATE TABLE recurring_bookings (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
    client_id UUID REFERENCES clients(id) ON DELETE SET NULL,
    service_ids JSONB NOT NULL DEFAULT '[]',
    add_on_ids JSONB NOT NULL DEFAULT '[]',
    day_of_week INT NOT NULL CHECK (day_of_week BETWEEN 0 AND 6),
    start_time TIME NOT NULL,
    frequency_weeks INT NOT NULL DEFAULT 4 CHECK (frequency_weeks > 0),
    customer_name TEXT NOT NULL,
    customer_phone TEXT,
    customer_email TEXT,
    is_new_client BOOLEAN NOT NULL DEFAULT false,
    total_duration_minutes INT NOT NULL,
    is_active BOOLEAN NOT NULL DEFAULT true,
    next_occurrence DATE,
    last_booked_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_rb_business ON recurring_bookings(business_id);
CREATE INDEX idx_rb_next ON recurring_bookings(business_id, next_occurrence, is_active);
ALTER TABLE recurring_bookings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admin full access recurring_bookings" ON recurring_bookings FOR ALL
    USING (business_id IN (SELECT business_id FROM admin_users WHERE auth_user_id = auth.uid()));

-- Waitlist entries
CREATE TABLE waitlist (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
    client_id UUID REFERENCES clients(id) ON DELETE SET NULL,
    preferred_date DATE NOT NULL,
    preferred_time_window TEXT, -- 'morning', 'afternoon', 'evening'
    service_ids JSONB NOT NULL DEFAULT '[]',
    customer_name TEXT NOT NULL,
    customer_phone TEXT,
    customer_email TEXT,
    status TEXT NOT NULL DEFAULT 'waiting' CHECK (status IN ('waiting', 'notified', 'booked', 'expired')),
    notified_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_wl_business ON waitlist(business_id, preferred_date, status);
ALTER TABLE waitlist ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admin full access waitlist" ON waitlist FOR ALL
    USING (business_id IN (SELECT business_id FROM admin_users WHERE auth_user_id = auth.uid()));

-- Seasonal/promotional flag on services
ALTER TABLE services ADD COLUMN IF NOT EXISTS is_seasonal BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE services ADD COLUMN IF NOT EXISTS seasonal_end_date DATE;
ALTER TABLE services ADD COLUMN IF NOT EXISTS seasonal_badge TEXT; -- e.g. "Limited Time", "Spring Special"

-- UTM tracking on bookings
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS utm_source TEXT;
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS utm_medium TEXT;
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS utm_campaign TEXT;
