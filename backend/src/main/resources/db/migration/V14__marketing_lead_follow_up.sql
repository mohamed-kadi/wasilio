ALTER TABLE marketing_leads
    ADD COLUMN status VARCHAR(40) NOT NULL DEFAULT 'NEW',
    ADD COLUMN next_follow_up_at TIMESTAMP WITH TIME ZONE,
    ADD COLUMN internal_notes VARCHAR(2000);

CREATE INDEX idx_marketing_leads_status_created_at ON marketing_leads(status, created_at DESC);
CREATE INDEX idx_marketing_leads_next_follow_up_at ON marketing_leads(next_follow_up_at);
