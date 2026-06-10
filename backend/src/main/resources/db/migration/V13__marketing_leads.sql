CREATE TABLE marketing_leads (
    lead_id UUID PRIMARY KEY,
    contact_name VARCHAR(120) NOT NULL,
    store_name VARCHAR(160) NOT NULL,
    phone VARCHAR(40) NOT NULL,
    email VARCHAR(255),
    city VARCHAR(80),
    monthly_order_volume VARCHAR(80),
    message VARCHAR(1000),
    campaign_source VARCHAR(255),
    remote_ip VARCHAR(64),
    created_at TIMESTAMP WITH TIME ZONE NOT NULL
);

CREATE INDEX idx_marketing_leads_created_at ON marketing_leads(created_at DESC);
CREATE INDEX idx_marketing_leads_phone ON marketing_leads(phone);
