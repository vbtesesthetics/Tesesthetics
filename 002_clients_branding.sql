-- ============================================================================
-- SALON SCHEDULER — Migration 008
-- Features: cancel policy, intake form, post-visit summary, photo notes,
--           Google Calendar sync, rebooking suggestions, revenue forecasting
-- ============================================================================

-- ============================================================================
-- Settings: new columns
-- ============================================================================
ALTER TABLE settings ADD COLUMN IF NOT EXISTS cancellation_policy_text TEXT
    NOT NULL DEFAULT 'Cancellations within 24 hours may be subject to a fee.';
ALTER TABLE settings ADD COLUMN IF NOT EXISTS intake_form_url TEXT;
ALTER TABLE settings ADD COLUMN IF NOT EXISTS intake_form_label TEXT
    NOT NULL DEFAULT 'Please complete your intake form before your appointment';

-- ============================================================================
-- Comm settings: post-visit summary
-- ============================================================================
ALTER TABLE comm_settings ADD COLUMN IF NOT EXISTS post_visit_summary_enabled
    BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE comm_settings ADD COLUMN IF NOT EXISTS post_visit_summary_delay_hours
    INT NOT NULL DEFAULT 1;

-- ============================================================================
-- Client photos (style reference only, never medical)
-- ============================================================================
CREATE TABLE IF NOT EXISTS client_photos (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
    client_id UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
    booking_id UUID REFERENCES bookings(id) ON DELETE SET NULL,
    storage_path TEXT NOT NULL,         -- Supabase Storage path
    public_url TEXT NOT NULL,           -- Public URL
    caption TEXT,                       -- e.g. "Color result - balayage"
    disclaimer TEXT NOT NULL DEFAULT 'Style reference only — not a medical record',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_client_photos_client ON client_photos(client_id);
CREATE INDEX IF NOT EXISTS idx_client_photos_business ON client_photos(business_id);
ALTER TABLE client_photos ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admin full access client_photos" ON client_photos FOR ALL
    USING (business_id IN (SELECT business_id FROM admin_users WHERE auth_user_id = auth.uid()));

-- ============================================================================
-- Google Calendar sync tokens
-- ============================================================================
CREATE TABLE IF NOT EXISTS gcal_settings (
    business_id UUID PRIMARY KEY REFERENCES businesses(id) ON DELETE CASCADE,
    access_token TEXT,
    refresh_token TEXT,
    token_expiry TIMESTAMPTZ,
    calendar_id TEXT NOT NULL DEFAULT 'primary',
    sync_enabled BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE gcal_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admin full access gcal_settings" ON gcal_settings FOR ALL
    USING (business_id IN (SELECT business_id FROM admin_users WHERE auth_user_id = auth.uid()));

-- Track which bookings have been synced to GCal
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS gcal_event_id TEXT;

-- ============================================================================
-- Branding: shareable card fields
-- ============================================================================
ALTER TABLE branding ADD COLUMN IF NOT EXISTS card_headline TEXT;
ALTER TABLE branding ADD COLUMN IF NOT EXISTS card_bio TEXT;
ALTER TABLE branding ADD COLUMN IF NOT EXISTS card_photo_url TEXT;
ALTER TABLE branding ADD COLUMN IF NOT EXISTS card_featured_service_ids JSONB DEFAULT '[]';

-- ============================================================================
-- Initialize new settings columns for existing businesses
-- ============================================================================
UPDATE settings SET
    cancellation_policy_text = 'Cancellations within 24 hours may be subject to a fee.',
    intake_form_url = NULL,
    intake_form_label = 'Please complete your intake form before your appointment'
WHERE cancellation_policy_text IS NULL OR cancellation_policy_text = '';

INSERT INTO gcal_settings (business_id)
SELECT id FROM businesses
WHERE id NOT IN (SELECT business_id FROM gcal_settings)
ON CONFLICT DO NOTHING;
