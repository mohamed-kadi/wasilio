ALTER TABLE marketing_leads
    ADD COLUMN converted_tenant_id UUID,
    ADD COLUMN converted_at TIMESTAMP WITH TIME ZONE;

CREATE INDEX idx_marketing_leads_converted_tenant_id ON marketing_leads(converted_tenant_id);
