CREATE TABLE delivery_follow_up_tasks (
    task_id UUID PRIMARY KEY,
    tenant_id UUID NOT NULL REFERENCES tenants(id),
    order_id UUID NOT NULL REFERENCES orders(id),
    recovery_id UUID NOT NULL REFERENCES delivery_failure_recoveries(recovery_id),
    status VARCHAR(50) NOT NULL,
    note VARCHAR(1000),
    due_at TIMESTAMP WITH TIME ZONE,
    assigned_to VARCHAR(255) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL,
    resolved_by VARCHAR(255),
    resolved_at TIMESTAMP WITH TIME ZONE,
    resolution_note VARCHAR(1000)
);

CREATE INDEX idx_delivery_follow_up_tasks_tenant_order_created_at
    ON delivery_follow_up_tasks (tenant_id, order_id, created_at);

CREATE INDEX idx_delivery_follow_up_tasks_tenant_status_due_at
    ON delivery_follow_up_tasks (tenant_id, status, due_at);
