-- ============================================================================
-- SALON SCHEDULER — Migration 005
-- Service-to-service compatibility (cannot combine rules)
-- ============================================================================

CREATE TABLE service_exclusions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
    service_id_a UUID NOT NULL REFERENCES services(id) ON DELETE CASCADE,
    service_id_b UUID NOT NULL REFERENCES services(id) ON DELETE CASCADE,
    CHECK (service_id_a <> service_id_b),
    UNIQUE (service_id_a, service_id_b)
);

CREATE INDEX idx_se_business ON service_exclusions(business_id);
ALTER TABLE service_exclusions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public can read service_exclusions" ON service_exclusions FOR SELECT USING (true);
CREATE POLICY "Admin full access service_exclusions" ON service_exclusions FOR ALL
    USING (business_id IN (SELECT business_id FROM admin_users WHERE auth_user_id = auth.uid()));
