INSERT INTO tenants (id, name, status)
VALUES ('00000000-0000-0000-0000-000000000099', 'Nexora Internal', 'ACTIVE')
ON CONFLICT DO NOTHING;

INSERT INTO users (id, email, password_hash, role, tenant_id)
VALUES (
    '00000000-0000-0000-0000-000000000099',
    'superadmin@example.com',
    '$2a$10$45WYo1EqytcDGW9zf8G09OvOJSZwKccX1G.yOi3rVVwjAjxqd4SUW',
    'SUPER_ADMIN',
    '00000000-0000-0000-0000-000000000099'
)
ON CONFLICT DO NOTHING;
