CREATE TABLE projection_processed_events (
    projection_name VARCHAR(100) NOT NULL,
    event_id UUID NOT NULL REFERENCES domain_events(event_id) ON DELETE CASCADE,
    tenant_id UUID NOT NULL,
    aggregate_id UUID NOT NULL,
    aggregate_sequence INT NOT NULL,
    processed_at TIMESTAMP WITH TIME ZONE NOT NULL,
    PRIMARY KEY (projection_name, event_id)
);

CREATE INDEX idx_projection_processed_events_projection_processed_at
    ON projection_processed_events (projection_name, processed_at);

CREATE INDEX idx_projection_processed_events_projection_tenant_aggregate
    ON projection_processed_events (projection_name, tenant_id, aggregate_id, aggregate_sequence);
