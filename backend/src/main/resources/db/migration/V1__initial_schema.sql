CREATE TABLE tenants (
    id UUID PRIMARY KEY,
    name VARCHAR(255) NOT NULL
);

CREATE TABLE users (
    id UUID PRIMARY KEY,
    email VARCHAR(255) NOT NULL UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    role VARCHAR(50) NOT NULL,
    tenant_id UUID NOT NULL REFERENCES tenants(id)
);

CREATE TABLE orders (
    id UUID PRIMARY KEY,
    tenant_id UUID NOT NULL REFERENCES tenants(id),
    status VARCHAR(50) NOT NULL,
    first_name VARCHAR(255),
    last_name VARCHAR(255),
    email VARCHAR(255),
    phone VARCHAR(255),
    street VARCHAR(255),
    city VARCHAR(255),
    state VARCHAR(255),
    zip_code VARCHAR(255),
    country VARCHAR(255),
    amount DECIMAL(19, 2) NOT NULL,
    courier_id VARCHAR(255),
    failure_reason TEXT,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL,
    version INT NOT NULL
);

CREATE TABLE domain_events (
    event_id UUID PRIMARY KEY,
    event_type VARCHAR(255) NOT NULL,
    version INT NOT NULL,
    tenant_id UUID NOT NULL REFERENCES tenants(id),
    aggregate_id UUID NOT NULL,
    correlation_id UUID,
    causation_id UUID,
    timestamp TIMESTAMP WITH TIME ZONE NOT NULL,
    payload JSONB
);
