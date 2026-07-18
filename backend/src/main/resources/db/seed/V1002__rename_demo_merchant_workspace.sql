UPDATE tenants
SET name = 'Demo Merchant Workspace',
    status = 'ACTIVE',
    updated_at = now()
WHERE id = '00000000-0000-0000-0000-000000000001'
  AND name = 'Default Tenant';
