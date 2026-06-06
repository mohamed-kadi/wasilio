ALTER TABLE confirmation_attempts
    ADD COLUMN callback_at TIMESTAMP WITH TIME ZONE;

ALTER TABLE confirmation_attempts
    ADD COLUMN callback_resolved_at TIMESTAMP WITH TIME ZONE;

ALTER TABLE confirmation_attempts
    ADD COLUMN callback_resolved_by VARCHAR(255);

CREATE INDEX idx_confirmation_attempts_callback_queue
    ON confirmation_attempts (tenant_id, callback_at)
    WHERE outcome = 'CALL_BACK_LATER'
      AND callback_resolved_at IS NULL;
