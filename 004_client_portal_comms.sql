-- ============================================================================
-- SALON SCHEDULER — Supabase Postgres Schema
-- Migration 001: Initial schema
-- ============================================================================

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ============================================================================
-- ENUM TYPES
-- ============================================================================

CREATE TYPE booking_status AS ENUM ('confirmed', 'cancelled');
CREATE TYPE booking_item_type AS ENUM ('service', 'add_on');
CREATE TYPE request_status AS ENUM ('new', 'contacted', 'booked', 'closed');
CREATE TYPE admin_role AS ENUM ('owner', 'staff');

-- ============================================================================
-- 1. BUSINESSES
-- ============================================================================

CREATE TABLE businesses (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    slug TEXT UNIQUE NOT NULL CHECK (slug ~ '^[a-z0-9\-]+$'),
    name TEXT NOT NULL,
    timezone TEXT NOT NULL DEFAULT 'America/New_York',
    location_text TEXT,
    contact_email TEXT,
    contact_phone TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_businesses_slug ON businesses(slug);

-- ============================================================================
-- 2. SERVICES
-- ============================================================================

CREATE TABLE services (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
    category TEXT NOT NULL DEFAULT 'General',
    name TEXT NOT NULL,
    price_display TEXT NOT NULL DEFAULT '',
    duration_minutes INT NOT NULL CHECK (duration_minutes > 0),
    is_active BOOLEAN NOT NULL DEFAULT true,
    is_inquiry_only BOOLEAN NOT NULL DEFAULT false,
    sort_order INT NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_services_business ON services(business_id);
CREATE INDEX idx_services_active ON services(business_id, is_active);

-- ============================================================================
-- 3. ADD-ONS
-- ============================================================================

CREATE TABLE add_ons (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
    service_id UUID REFERENCES services(id) ON DELETE SET NULL,
    name TEXT NOT NULL,
    price_display TEXT NOT NULL DEFAULT '',
    add_minutes INT NOT NULL DEFAULT 0 CHECK (add_minutes >= 0),
    is_active BOOLEAN NOT NULL DEFAULT true,
    sort_order INT NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_addons_business ON add_ons(business_id);
CREATE INDEX idx_addons_service ON add_ons(service_id);

-- ============================================================================
-- 4. AVAILABILITY RULES (Weekly business hours)
-- ============================================================================

CREATE TABLE availability_rules (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
    day_of_week INT NOT NULL CHECK (day_of_week BETWEEN 0 AND 6),
    open_time TIME NOT NULL DEFAULT '09:00',
    close_time TIME NOT NULL DEFAULT '17:00',
    is_closed BOOLEAN NOT NULL DEFAULT false,
    UNIQUE (business_id, day_of_week)
);

CREATE INDEX idx_availability_business ON availability_rules(business_id);

-- ============================================================================
-- 5. BLACKOUT BLOCKS (Recurring weekly)
-- ============================================================================

CREATE TABLE blackout_blocks (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
    name TEXT NOT NULL DEFAULT 'Break',
    day_of_week INT NOT NULL CHECK (day_of_week BETWEEN 0 AND 6),
    start_time TIME NOT NULL,
    end_time TIME NOT NULL,
    is_active BOOLEAN NOT NULL DEFAULT true,
    CHECK (end_time > start_time)
);

CREATE INDEX idx_blackouts_business ON blackout_blocks(business_id);

-- ============================================================================
-- 6. ONE-OFF BLOCKS (Date-specific blocks)
-- ============================================================================

CREATE TABLE one_off_blocks (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
    name TEXT NOT NULL DEFAULT 'Blocked',
    start_at TIMESTAMPTZ NOT NULL,
    end_at TIMESTAMPTZ NOT NULL,
    created_by UUID,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CHECK (end_at > start_at)
);

CREATE INDEX idx_oneoff_business ON one_off_blocks(business_id);
CREATE INDEX idx_oneoff_range ON one_off_blocks(business_id, start_at, end_at);

-- ============================================================================
-- 7. SETTINGS (1 row per business)
-- ============================================================================

CREATE TABLE settings (
    business_id UUID PRIMARY KEY REFERENCES businesses(id) ON DELETE CASCADE,
    slot_increment_minutes INT NOT NULL DEFAULT 15 CHECK (slot_increment_minutes > 0),
    buffer_before_default INT NOT NULL DEFAULT 0 CHECK (buffer_before_default >= 0),
    buffer_after_default INT NOT NULL DEFAULT 0 CHECK (buffer_after_default >= 0),
    ask_new_client BOOLEAN NOT NULL DEFAULT true,
    new_client_extra_minutes INT NOT NULL DEFAULT 10 CHECK (new_client_extra_minutes >= 0),
    pre_blackout_cutoff_minutes INT NOT NULL DEFAULT 0 CHECK (pre_blackout_cutoff_minutes >= 0),
    end_of_day_cutoff_minutes INT NOT NULL DEFAULT 0 CHECK (end_of_day_cutoff_minutes >= 0),
    allow_request_if_no_slots BOOLEAN NOT NULL DEFAULT true,
    add_on_policy_line TEXT NOT NULL DEFAULT 'Same-day add-ons aren''t guaranteed because we reserve time for each service. If you''d like to add a service, please let us know at least 24 hours before your appointment so we can confirm availability.'
);

-- ============================================================================
-- 8. BOOKINGS
-- ============================================================================

CREATE TABLE bookings (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
    start_at TIMESTAMPTZ NOT NULL,
    end_at TIMESTAMPTZ NOT NULL,
    customer_name TEXT NOT NULL,
    customer_email TEXT,
    customer_phone TEXT,
    is_new_client BOOLEAN NOT NULL DEFAULT false,
    status booking_status NOT NULL DEFAULT 'confirmed',
    internal_notes TEXT,
    public_notes_non_medical TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CHECK (end_at > start_at),
    CHECK (customer_email IS NOT NULL OR customer_phone IS NOT NULL)
);

CREATE INDEX idx_bookings_business ON bookings(business_id);
CREATE INDEX idx_bookings_range ON bookings(business_id, start_at, end_at);
CREATE INDEX idx_bookings_status ON bookings(business_id, status);
CREATE INDEX idx_bookings_date ON bookings(business_id, start_at);

-- ============================================================================
-- 9. BOOKING ITEMS
-- ============================================================================

CREATE TABLE booking_items (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    booking_id UUID NOT NULL REFERENCES bookings(id) ON DELETE CASCADE,
    item_type booking_item_type NOT NULL,
    service_id UUID REFERENCES services(id) ON DELETE SET NULL,
    add_on_id UUID REFERENCES add_ons(id) ON DELETE SET NULL,
    name_snapshot TEXT NOT NULL,
    price_snapshot TEXT NOT NULL DEFAULT '',
    minutes_snapshot INT NOT NULL CHECK (minutes_snapshot >= 0)
);

CREATE INDEX idx_booking_items_booking ON booking_items(booking_id);

-- ============================================================================
-- 10. BOOKING REQUESTS
-- ============================================================================

CREATE TABLE booking_requests (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
    preferred_days JSONB NOT NULL DEFAULT '[]',
    preferred_time_windows JSONB NOT NULL DEFAULT '[]',
    customer_name TEXT NOT NULL,
    customer_email TEXT,
    customer_phone TEXT,
    is_new_client BOOLEAN NOT NULL DEFAULT false,
    request_items JSONB NOT NULL DEFAULT '[]',
    status request_status NOT NULL DEFAULT 'new',
    notes_non_medical TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CHECK (customer_email IS NOT NULL OR customer_phone IS NOT NULL)
);

CREATE INDEX idx_requests_business ON booking_requests(business_id);
CREATE INDEX idx_requests_status ON booking_requests(business_id, status);

-- ============================================================================
-- 11. ADMIN USERS
-- ============================================================================

CREATE TABLE admin_users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
    auth_user_id UUID NOT NULL UNIQUE,
    role admin_role NOT NULL DEFAULT 'owner',
    display_name TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_admin_users_auth ON admin_users(auth_user_id);
CREATE INDEX idx_admin_users_business ON admin_users(business_id);

-- ============================================================================
-- ROW LEVEL SECURITY POLICIES
-- ============================================================================

-- Enable RLS on all tables
ALTER TABLE businesses ENABLE ROW LEVEL SECURITY;
ALTER TABLE services ENABLE ROW LEVEL SECURITY;
ALTER TABLE add_ons ENABLE ROW LEVEL SECURITY;
ALTER TABLE availability_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE blackout_blocks ENABLE ROW LEVEL SECURITY;
ALTER TABLE one_off_blocks ENABLE ROW LEVEL SECURITY;
ALTER TABLE settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE bookings ENABLE ROW LEVEL SECURITY;
ALTER TABLE booking_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE booking_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE admin_users ENABLE ROW LEVEL SECURITY;

-- PUBLIC READ: businesses, services, add_ons, availability_rules, blackout_blocks, settings
-- These are needed by the public booking widget
CREATE POLICY "Public can read businesses" ON businesses FOR SELECT USING (true);
CREATE POLICY "Public can read active services" ON services FOR SELECT USING (is_active = true);
CREATE POLICY "Public can read active add_ons" ON add_ons FOR SELECT USING (is_active = true);
CREATE POLICY "Public can read availability" ON availability_rules FOR SELECT USING (true);
CREATE POLICY "Public can read active blackouts" ON blackout_blocks FOR SELECT USING (is_active = true);
CREATE POLICY "Public can read settings" ON settings FOR SELECT USING (true);

-- PUBLIC INSERT: bookings, booking_items, booking_requests
-- Serverless functions use service_role key, but if using anon key:
CREATE POLICY "Public can create bookings" ON bookings FOR INSERT WITH CHECK (true);
CREATE POLICY "Public can create booking_items" ON booking_items FOR INSERT WITH CHECK (true);
CREATE POLICY "Public can create requests" ON booking_requests FOR INSERT WITH CHECK (true);

-- PUBLIC READ bookings (for collision checking by serverless - uses service_role)
-- No public read on bookings for anon users

-- ADMIN: Full access scoped to their business_id
CREATE POLICY "Admin full access businesses" ON businesses FOR ALL
    USING (id IN (SELECT business_id FROM admin_users WHERE auth_user_id = auth.uid()));

CREATE POLICY "Admin full access services" ON services FOR ALL
    USING (business_id IN (SELECT business_id FROM admin_users WHERE auth_user_id = auth.uid()));

CREATE POLICY "Admin full access add_ons" ON add_ons FOR ALL
    USING (business_id IN (SELECT business_id FROM admin_users WHERE auth_user_id = auth.uid()));

CREATE POLICY "Admin full access availability" ON availability_rules FOR ALL
    USING (business_id IN (SELECT business_id FROM admin_users WHERE auth_user_id = auth.uid()));

CREATE POLICY "Admin full access blackouts" ON blackout_blocks FOR ALL
    USING (business_id IN (SELECT business_id FROM admin_users WHERE auth_user_id = auth.uid()));

CREATE POLICY "Admin full access one_off_blocks" ON one_off_blocks FOR ALL
    USING (business_id IN (SELECT business_id FROM admin_users WHERE auth_user_id = auth.uid()));

CREATE POLICY "Admin full access settings" ON settings FOR ALL
    USING (business_id IN (SELECT business_id FROM admin_users WHERE auth_user_id = auth.uid()));

CREATE POLICY "Admin full access bookings" ON bookings FOR ALL
    USING (business_id IN (SELECT business_id FROM admin_users WHERE auth_user_id = auth.uid()));

CREATE POLICY "Admin full access booking_items" ON booking_items FOR ALL
    USING (booking_id IN (
        SELECT b.id FROM bookings b
        JOIN admin_users a ON a.business_id = b.business_id
        WHERE a.auth_user_id = auth.uid()
    ));

CREATE POLICY "Admin full access requests" ON booking_requests FOR ALL
    USING (business_id IN (SELECT business_id FROM admin_users WHERE auth_user_id = auth.uid()));

CREATE POLICY "Admin read own profile" ON admin_users FOR SELECT
    USING (auth_user_id = auth.uid());

-- ============================================================================
-- SEED FUNCTION: Initialize a new business with defaults
-- ============================================================================

CREATE OR REPLACE FUNCTION initialize_business(
    p_name TEXT,
    p_slug TEXT,
    p_timezone TEXT DEFAULT 'America/New_York',
    p_location_text TEXT DEFAULT NULL,
    p_admin_auth_id UUID DEFAULT NULL
) RETURNS UUID AS $$
DECLARE
    v_business_id UUID;
BEGIN
    -- Create business
    INSERT INTO businesses (name, slug, timezone, location_text)
    VALUES (p_name, p_slug, p_timezone, p_location_text)
    RETURNING id INTO v_business_id;

    -- Create default settings
    INSERT INTO settings (business_id) VALUES (v_business_id);

    -- Create default hours (Mon-Fri 9-5, Sat-Sun closed)
    INSERT INTO availability_rules (business_id, day_of_week, open_time, close_time, is_closed) VALUES
        (v_business_id, 0, '09:00', '17:00', true),  -- Sunday closed
        (v_business_id, 1, '09:00', '17:00', false),  -- Monday
        (v_business_id, 2, '09:00', '17:00', false),  -- Tuesday
        (v_business_id, 3, '09:00', '17:00', false),  -- Wednesday
        (v_business_id, 4, '09:00', '17:00', false),  -- Thursday
        (v_business_id, 5, '09:00', '17:00', false),  -- Friday
        (v_business_id, 6, '09:00', '17:00', true);   -- Saturday closed

    -- Create admin user if auth_id provided
    IF p_admin_auth_id IS NOT NULL THEN
        INSERT INTO admin_users (business_id, auth_user_id, role)
        VALUES (v_business_id, p_admin_auth_id, 'owner');
    END IF;

    RETURN v_business_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
