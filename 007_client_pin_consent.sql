-- ============================================================================
-- SALON SCHEDULER — Migration 003
-- Adds: service-addon linking table with limits
-- ============================================================================

-- Many-to-many: which add-ons are available for which services
-- If no links exist for an add-on, it's treated as global (available for all)
CREATE TABLE service_addon_links (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
    service_id UUID NOT NULL REFERENCES services(id) ON DELETE CASCADE,
    add_on_id UUID NOT NULL REFERENCES add_ons(id) ON DELETE CASCADE,
    max_quantity INT NOT NULL DEFAULT 1 CHECK (max_quantity >= 1),
    is_active BOOLEAN NOT NULL DEFAULT true,
    UNIQUE (service_id, add_on_id)
);

CREATE INDEX idx_sal_business ON service_addon_links(business_id);
CREATE INDEX idx_sal_service ON service_addon_links(service_id);
CREATE INDEX idx_sal_addon ON service_addon_links(add_on_id);

-- Add-on exclusions: if addon A is selected, addon B cannot be
-- (bidirectional — if A excludes B, B excludes A)
CREATE TABLE addon_exclusions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
    add_on_id_a UUID NOT NULL REFERENCES add_ons(id) ON DELETE CASCADE,
    add_on_id_b UUID NOT NULL REFERENCES add_ons(id) ON DELETE CASCADE,
    CHECK (add_on_id_a <> add_on_id_b),
    UNIQUE (add_on_id_a, add_on_id_b)
);

CREATE INDEX idx_ae_business ON addon_exclusions(business_id);

-- RLS
ALTER TABLE service_addon_links ENABLE ROW LEVEL SECURITY;
ALTER TABLE addon_exclusions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public can read service_addon_links" ON service_addon_links
    FOR SELECT USING (is_active = true);
CREATE POLICY "Public can read addon_exclusions" ON addon_exclusions
    FOR SELECT USING (true);

CREATE POLICY "Admin full access service_addon_links" ON service_addon_links FOR ALL
    USING (business_id IN (SELECT business_id FROM admin_users WHERE auth_user_id = auth.uid()));
CREATE POLICY "Admin full access addon_exclusions" ON addon_exclusions FOR ALL
    USING (business_id IN (SELECT business_id FROM admin_users WHERE auth_user_id = auth.uid()));

-- Add is_global flag to add_ons for clarity
ALTER TABLE add_ons ADD COLUMN IF NOT EXISTS is_global BOOLEAN NOT NULL DEFAULT true;
