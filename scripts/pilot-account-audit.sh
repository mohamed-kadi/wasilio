#!/usr/bin/env sh
set -eu

COMPOSE_FILES=${COMPOSE_FILES:-"-f docker-compose.yml -f docker-compose.prod.yml"}
POSTGRES_SERVICE=${POSTGRES_SERVICE:-postgres}
POSTGRES_DB=${POSTGRES_DB:-nexora}
POSTGRES_USER=${POSTGRES_USER:?POSTGRES_USER must be set}
INTERNAL_TENANT_NAME=${INTERNAL_TENANT_NAME:-Wasilio Internal}

echo "Pilot account audit"
echo "Database: ${POSTGRES_DB}"
echo "Internal tenant: ${INTERNAL_TENANT_NAME}"
echo

docker compose ${COMPOSE_FILES} exec -T "$POSTGRES_SERVICE" \
  psql -v ON_ERROR_STOP=1 \
    -v internal_tenant_name="$INTERNAL_TENANT_NAME" \
    -U "$POSTGRES_USER" \
    -d "$POSTGRES_DB" <<'SQL'
\echo 'Workspace user matrix'
SELECT
    t.name AS workspace,
    t.status,
    COUNT(DISTINCT u.id) AS total_users,
    COUNT(DISTINCT u.id) FILTER (WHERE u.role = 'SUPER_ADMIN') AS staff_users,
    COUNT(DISTINCT u.id) FILTER (WHERE u.role = 'ADMIN') AS owner_admins,
    COUNT(DISTINCT u.id) FILTER (WHERE u.role = 'MERCHANT') AS merchant_users,
    COUNT(DISTINCT o.id) AS orders
FROM tenants t
LEFT JOIN users u ON u.tenant_id = t.id
LEFT JOIN orders o ON o.tenant_id = t.id
GROUP BY t.id, t.name, t.status
ORDER BY LOWER(t.name);

\echo ''
\echo 'Pilot review flags'
WITH workspace_user_counts AS (
    SELECT
        t.id AS tenant_id,
        t.name AS workspace,
        COUNT(u.id) FILTER (WHERE u.role IN ('ADMIN', 'MERCHANT')) AS merchant_login_count
    FROM tenants t
    LEFT JOIN users u ON u.tenant_id = t.id
    GROUP BY t.id, t.name
)
SELECT
    'SUPER_ADMIN_OUTSIDE_INTERNAL' AS flag,
    u.email,
    t.name AS workspace,
    'Super-admin should belong to the internal staff workspace.' AS action
FROM users u
JOIN tenants t ON t.id = u.tenant_id
WHERE u.role = 'SUPER_ADMIN'
  AND LOWER(t.name) <> LOWER(:'internal_tenant_name')

UNION ALL

SELECT
    'MERCHANT_USER_IN_INTERNAL' AS flag,
    u.email,
    t.name AS workspace,
    'Merchant/admin users should belong to a merchant workspace, not the staff workspace.' AS action
FROM users u
JOIN tenants t ON t.id = u.tenant_id
WHERE u.role IN ('ADMIN', 'MERCHANT')
  AND LOWER(t.name) = LOWER(:'internal_tenant_name')

UNION ALL

SELECT
    'WORKSPACE_WITHOUT_MERCHANT_LOGIN' AS flag,
    NULL AS email,
    w.workspace,
    'Each pilot merchant workspace needs one intended owner login before handoff.' AS action
FROM workspace_user_counts w
WHERE LOWER(w.workspace) <> LOWER(:'internal_tenant_name')
  AND w.merchant_login_count = 0

UNION ALL

SELECT
    'MULTIPLE_MERCHANT_LOGINS_REVIEW' AS flag,
    NULL AS email,
    w.workspace,
    'Team management is not fully implemented; review extra logins before pilot handoff.' AS action
FROM workspace_user_counts w
WHERE LOWER(w.workspace) <> LOWER(:'internal_tenant_name')
  AND w.merchant_login_count > 1

UNION ALL

SELECT
    'USER_WITHOUT_DISPLAY_NAME' AS flag,
    u.email,
    t.name AS workspace,
    'Add a display name so headers, receipts, and audit screens do not fall back to email.' AS action
FROM users u
JOIN tenants t ON t.id = u.tenant_id
WHERE u.name IS NULL OR BTRIM(u.name) = ''

ORDER BY flag, workspace, email;
SQL

echo
echo "Audit complete. Any rows under 'Pilot review flags' should be reviewed before real merchant handoff."
