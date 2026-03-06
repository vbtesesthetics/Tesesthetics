-- ============================================================================
-- SALON SCHEDULER — Migration 004
-- Client portal, cancel/reschedule tokens, communication settings
-- ============================================================================

-- Cancel/reschedule tokens (one-time-use links sent to clients)
CREATE TABLE booking_tokens (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    booking_id UUID NOT NULL REFERENCES bookings(id) ON DELETE CASCADE,
    token TEXT NOT NULL UNIQUE DEFAULT encode(gen_random_bytes(24), 'hex'),
    action TEXT NOT NULL CHECK (action IN ('cancel', 'reschedule', 'view')),
    expires_at TIMESTAMPTZ NOT NULL,
    used_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_bt_token ON booking_tokens(token);
CREATE INDEX idx_bt_booking ON booking_tokens(booking_id);

ALTER TABLE booking_tokens ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public can read tokens by token value" ON booking_tokens FOR SELECT USING (true);

-- Communication settings per business
CREATE TABLE comm_settings (
    business_id UUID PRIMARY KEY REFERENCES businesses(id) ON DELETE CASCADE,
    -- Twilio (salon-owned)
    twilio_account_sid TEXT,
    twilio_auth_token TEXT,
    twilio_phone_number TEXT,
    sms_enabled BOOLEAN NOT NULL DEFAULT false,
    -- SendGrid or EmailJS (salon-owned)
    sendgrid_api_key TEXT,
    email_from_address TEXT,
    email_from_name TEXT,
    email_enabled BOOLEAN NOT NULL DEFAULT false,
    -- Reminder settings
    reminder_24h_enabled BOOLEAN NOT NULL DEFAULT true,
    reminder_2h_enabled BOOLEAN NOT NULL DEFAULT true,
    -- Review prompt
    review_prompt_enabled BOOLEAN NOT NULL DEFAULT false,
    review_prompt_delay_hours INT NOT NULL DEFAULT 2,
    -- Rebook prompt
    rebook_prompt_enabled BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE comm_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admin full access comm_settings" ON comm_settings FOR ALL
    USING (business_id IN (SELECT business_id FROM admin_users WHERE auth_user_id = auth.uid()));

-- Message log (track what was sent)
CREATE TABLE message_log (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
    booking_id UUID REFERENCES bookings(id) ON DELETE SET NULL,
    client_id UUID REFERENCES clients(id) ON DELETE SET NULL,
    channel TEXT NOT NULL CHECK (channel IN ('sms', 'email')),
    message_type TEXT NOT NULL, -- 'reminder_24h', 'reminder_2h', 'confirmation', 'review_prompt', 'rebook_prompt'
    recipient TEXT NOT NULL, -- phone or email
    status TEXT NOT NULL DEFAULT 'sent', -- 'sent', 'failed', 'delivered'
    error_detail TEXT,
    sent_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_ml_business ON message_log(business_id);
CREATE INDEX idx_ml_booking ON message_log(booking_id);

ALTER TABLE message_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admin full access message_log" ON message_log FOR ALL
    USING (business_id IN (SELECT business_id FROM admin_users WHERE auth_user_id = auth.uid()));

-- Rebook intervals per service
ALTER TABLE services ADD COLUMN IF NOT EXISTS rebook_days INT DEFAULT 0;

-- Add cancel token to booking response
-- (booking confirmation will include a manage link)

-- Initialize comm_settings for existing businesses
INSERT INTO comm_settings (business_id)
SELECT id FROM businesses
WHERE id NOT IN (SELECT business_id FROM comm_settings)
ON CONFLICT DO NOTHING;
