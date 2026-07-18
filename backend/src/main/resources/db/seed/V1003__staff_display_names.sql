UPDATE users
SET name = 'Wasilio Super Admin'
WHERE email = 'superadmin@example.com'
  AND (name IS NULL OR TRIM(name) = '');

UPDATE users
SET name = 'Demo Merchant Owner'
WHERE email = 'admin@example.com'
  AND (name IS NULL OR TRIM(name) = '');
