ALTER TABLE users
    ADD COLUMN name VARCHAR(255);

CREATE UNIQUE INDEX uq_tenants_name_lower
    ON tenants (LOWER(name));

CREATE UNIQUE INDEX uq_users_email_lower
    ON users (LOWER(email));
