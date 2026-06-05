ALTER TABLE domain_events
    ADD COLUMN aggregate_sequence INT;

UPDATE domain_events
SET aggregate_sequence = version;

ALTER TABLE domain_events
    ALTER COLUMN aggregate_sequence SET NOT NULL;

ALTER TABLE domain_events
    ADD COLUMN event_schema_version INT NOT NULL DEFAULT 1;

ALTER TABLE domain_events
    DROP COLUMN version;

ALTER TABLE domain_events
    ADD CONSTRAINT uq_domain_events_tenant_aggregate_sequence
        UNIQUE (tenant_id, aggregate_id, aggregate_sequence);
