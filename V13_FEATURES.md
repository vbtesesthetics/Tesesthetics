-- ============================================================================
-- SALON SCHEDULER — Migration 002
-- Adds: clients table, branding settings, social links
-- ============================================================================

-- ============================================================================
-- 12. CLIENTS (auto-built from bookings, matched by phone)
-- ============================================================================

CREATE TABLE clients (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    phone TEXT,
    email TEXT,
    pin_hash TEXT,  -- bcrypt hash of 4-digit PIN, nullable until client sets one
    first_visit_at TIMESTAMPTZ,
    last_visit_at TIMESTAMPTZ,
    total_visits INT NOT NULL DEFAULT 0,
    total_spend_display TEXT NOT NULL DEFAULT '$0',  -- display only, not actual accounting
    is_no_show_flagged BOOLEAN NOT NULL DEFAULT false,
    no_show_count INT NOT NULL DEFAULT 0,
    tags JSONB NOT NULL DEFAULT '[]',  -- e.g. ["VIP", "referred by Sarah"]
    admin_notes TEXT,  -- internal staff notes, never shown to client
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (business_id, phone)
);

CREATE INDEX idx_clients_business ON clients(business_id);
CREATE INDEX idx_clients_phone ON clients(business_id, phone);
CREATE INDEX idx_clients_name ON clients(business_id, name);

-- Add client_id FK to bookings
ALTER TABLE bookings ADD COLUMN client_id UUID REFERENCES clients(id) ON DELETE SET NULL;
CREATE INDEX idx_bookings_client ON bookings(client_id);

-- Add client_id FK to booking_requests
ALTER TABLE booking_requests ADD COLUMN client_id UUID REFERENCES clients(id) ON DELETE SET NULL;

-- ============================================================================
-- 13. BRANDING (1 row per business)
-- ============================================================================

CREATE TABLE branding (
    business_id UUID PRIMARY KEY REFERENCES businesses(id) ON DELETE CASCADE,
    -- Logo
    logo_url TEXT,  -- URL to uploaded logo (Supabase Storage or external)
    favicon_url TEXT,
    -- Colors
    color_primary TEXT NOT NULL DEFAULT '#2D2A26',
    color_accent TEXT NOT NULL DEFAULT '#8B6F4E',
    color_accent_light TEXT NOT NULL DEFAULT '#C4A882',
    color_background TEXT NOT NULL DEFAULT '#FAF8F5',
    color_surface TEXT NOT NULL DEFAULT '#FFFFFF',
    color_text TEXT NOT NULL DEFAULT '#2D2A26',
    color_text_muted TEXT NOT NULL DEFAULT '#7A756E',
    -- Text
    welcome_title TEXT,  -- e.g. "Welcome to Studio Glow"
    welcome_subtitle TEXT,  -- e.g. "Your skin deserves the best"
    confirmation_message TEXT,  -- custom text on confirmation page
    -- Social links
    social_instagram TEXT,
    social_facebook TEXT,
    social_tiktok TEXT,
    social_x TEXT,  -- twitter/X
    social_nextdoor TEXT,
    social_google TEXT,  -- Google Business Profile URL
    social_youtube TEXT,
    social_linkedin TEXT,
    social_yelp TEXT,
    -- Google review prompt
    google_review_url TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================================================
-- 14. Add no_show status to bookings
-- ============================================================================

-- Recreate the enum with no_show added
ALTER TYPE booking_status ADD VALUE IF NOT EXISTS 'no_show';

-- ============================================================================
-- 15. Add cancellation policy settings
-- ============================================================================

ALTER TABLE settings ADD COLUMN IF NOT EXISTS
    client_cancel_window_hours INT NOT NULL DEFAULT 24;
ALTER TABLE settings ADD COLUMN IF NOT EXISTS
    client_reschedule_window_hours INT NOT NULL DEFAULT 24;
ALTER TABLE settings ADD COLUMN IF NOT EXISTS
    rebook_prompt_days JSONB NOT NULL DEFAULT '{}';  -- per-service rebook intervals e.g. {"service_id": 28}

-- ============================================================================
-- RLS for new tables
-- ============================================================================

ALTER TABLE clients ENABLE ROW LEVEL SECURITY;
ALTER TABLE branding ENABLE ROW LEVEL SECURITY;

-- Public can read branding (needed for booking page styling)
CREATE POLICY "Public can read branding" ON branding FOR SELECT USING (true);

-- Admin full access to clients
CREATE POLICY "Admin full access clients" ON clients FOR ALL
    USING (business_id IN (SELECT business_id FROM admin_users WHERE auth_user_id = auth.uid()));

-- Admin full access to branding
CREATE POLICY "Admin full access branding" ON branding FOR ALL
    USING (business_id IN (SELECT business_id FROM admin_users WHERE auth_user_id = auth.uid()));

-- Public can read limited client info (for phone+PIN portal lookup via serverless)
-- Actual lookup goes through service_role key in serverless function, not direct client access

-- ============================================================================
-- FUNCTION: Find or create client from booking data
-- ============================================================================

CREATE OR REPLACE FUNCTION upsert_client(
    p_business_id UUID,
    p_name TEXT,
    p_phone TEXT,
    p_email TEXT,
    p_is_new BOOLEAN DEFAULT false
) RETURNS UUID AS $$
DECLARE
    v_client_id UUID;
    v_existing clients%ROWTYPE;
BEGIN
    -- Try to find by phone first
    IF p_phone IS NOT NULL THEN
        SELECT * INTO v_existing FROM clients
        WHERE business_id = p_business_id AND phone = p_phone;
    END IF;

    -- If not found by phone, try email
    IF v_existing.id IS NULL AND p_email IS NOT NULL THEN
        SELECT * INTO v_existing FROM clients
        WHERE business_id = p_business_id AND email = p_email
        LIMIT 1;
    END IF;

    IF v_existing.id IS NOT NULL THEN
        -- Update existing client
        UPDATE clients SET
            name = COALESCE(NULLIF(p_name, ''), v_existing.name),
            email = COALESCE(NULLIF(p_email, ''), v_existing.email),
            last_visit_at = now(),
            total_visits = v_existing.total_visits + 1
        WHERE id = v_existing.id;
        v_client_id := v_existing.id;
    ELSE
        -- Create new client
        INSERT INTO clients (business_id, name, phone, email, first_visit_at, last_visit_at, total_visits)
        VALUES (p_business_id, p_name, p_phone, p_email, now(), now(), 1)
        RETURNING id INTO v_client_id;
    END IF;

    RETURN v_client_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- Initialize branding for existing businesses
-- ============================================================================

INSERT INTO branding (business_id)
SELECT id FROM businesses
WHERE id NOT IN (SELECT business_id FROM branding)
ON CONFLICT DO NOTHING;
