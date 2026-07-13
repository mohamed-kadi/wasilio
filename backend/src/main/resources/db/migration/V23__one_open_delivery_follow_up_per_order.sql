CREATE UNIQUE INDEX uq_delivery_follow_up_tasks_one_open_per_order
    ON delivery_follow_up_tasks (tenant_id, order_id)
    WHERE status = 'OPEN';
