-- ============================================================================
-- SALON SCHEDULER — Migration 007
-- Adds: set_client_pin helper function, consent_to_contact on clients
-- ============================================================================

-- Add consent tracking to clients
ALTER TABLE clients ADD COLUMN IF NOT EXISTS consent_to_contact BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE clients ADD COLUMN IF NOT EXISTS consent_given_at TIMESTAMPTZ;

-- Also track on bookings
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS consent_to_contact BOOLEAN NOT NULL DEFAULT false;

-- Helper: hash and set a client PIN using bcrypt (pgcrypto must be enabled)
CREATE OR REPLACE FUNCTION set_client_pin(
    p_client_id UUID,
    p_pin TEXT
) RETURNS VOID AS $$
BEGIN
    -- Only set PIN if client doesn't already have one, or if resetting
    UPDATE clients
    SET pin_hash = crypt(p_pin, gen_salt('bf'))
    WHERE id = p_client_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Helper: verify a client PIN
CREATE OR REPLACE FUNCTION verify_client_pin(
    p_client_id UUID,
    p_pin TEXT
) RETURNS BOOLEAN AS $$
DECLARE
    v_hash TEXT;
BEGIN
    SELECT pin_hash INTO v_hash FROM clients WHERE id = p_client_id;
    IF v_hash IS NULL THEN RETURN FALSE; END IF;
    RETURN (v_hash = crypt(p_pin, v_hash));
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
