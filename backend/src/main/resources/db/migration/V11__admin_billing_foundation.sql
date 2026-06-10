ALTER TABLE tenants
    ADD COLUMN status VARCHAR(32) NOT NULL DEFAULT 'ACTIVE',
    ADD COLUMN created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    ADD COLUMN updated_at TIMESTAMPTZ NOT NULL DEFAULT now();

CREATE INDEX idx_tenants_status ON tenants (status);

CREATE TABLE subscription_plans (
    plan_id UUID PRIMARY KEY,
    code VARCHAR(50) NOT NULL UNIQUE,
    name VARCHAR(120) NOT NULL,
    monthly_price NUMERIC(12,2) NOT NULL,
    currency VARCHAR(3) NOT NULL,
    order_limit INTEGER,
    user_limit INTEGER,
    active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL
);

CREATE TABLE tenant_subscriptions (
    subscription_id UUID PRIMARY KEY,
    tenant_id UUID NOT NULL UNIQUE,
    plan_id UUID NOT NULL,
    status VARCHAR(32) NOT NULL,
    current_period_start TIMESTAMPTZ,
    current_period_end TIMESTAMPTZ,
    trial_ends_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL,
    CONSTRAINT fk_tenant_subscriptions_tenant
        FOREIGN KEY (tenant_id) REFERENCES tenants (id),
    CONSTRAINT fk_tenant_subscriptions_plan
        FOREIGN KEY (plan_id) REFERENCES subscription_plans (plan_id)
);

CREATE INDEX idx_tenant_subscriptions_status
    ON tenant_subscriptions (status);

CREATE TABLE tenant_payments (
    payment_id UUID PRIMARY KEY,
    tenant_id UUID NOT NULL,
    subscription_id UUID,
    receipt_number VARCHAR(64) NOT NULL UNIQUE,
    method VARCHAR(32) NOT NULL,
    amount NUMERIC(12,2) NOT NULL,
    currency VARCHAR(3) NOT NULL,
    paid_at TIMESTAMPTZ NOT NULL,
    period_start TIMESTAMPTZ,
    period_end TIMESTAMPTZ,
    collected_by VARCHAR(255) NOT NULL,
    notes VARCHAR(1000),
    created_at TIMESTAMPTZ NOT NULL,
    CONSTRAINT fk_tenant_payments_tenant
        FOREIGN KEY (tenant_id) REFERENCES tenants (id),
    CONSTRAINT fk_tenant_payments_subscription
        FOREIGN KEY (subscription_id) REFERENCES tenant_subscriptions (subscription_id)
);

CREATE INDEX idx_tenant_payments_tenant_paid_at
    ON tenant_payments (tenant_id, paid_at DESC);

CREATE INDEX idx_tenant_payments_subscription
    ON tenant_payments (subscription_id);

INSERT INTO subscription_plans (
    plan_id,
    code,
    name,
    monthly_price,
    currency,
    order_limit,
    user_limit,
    active,
    created_at,
    updated_at
) VALUES
    ('10000000-0000-0000-0000-000000000001', 'starter', 'Starter', 299.00, 'MAD', 500, 3, true, now(), now()),
    ('10000000-0000-0000-0000-000000000002', 'growth', 'Growth', 699.00, 'MAD', 2000, 10, true, now(), now()),
    ('10000000-0000-0000-0000-000000000003', 'pro', 'Pro', 1499.00, 'MAD', NULL, NULL, true, now(), now())
ON CONFLICT (code) DO NOTHING;
