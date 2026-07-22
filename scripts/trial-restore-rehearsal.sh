#!/usr/bin/env sh
set -eu

usage() {
  cat <<'USAGE'
Usage: ./scripts/trial-restore-rehearsal.sh <backup-dump>

Restores a PostgreSQL custom-format dump into an isolated temporary database and
runs sanity checks without touching the live application database.

Environment:
  COMPOSE_FILES       Compose files to use. Defaults to production compose.
  POSTGRES_SERVICE    Compose service name. Defaults to postgres.
  POSTGRES_USER       Required PostgreSQL user.
  POSTGRES_DB         Live database name. Defaults to nexora.
  RESTORE_DB          Temporary database name. Defaults to wasilio_restore_rehearsal_<timestamp>.
  KEEP_RESTORE_DB     Set true to keep the restored database for manual review. Defaults to false.

The script refuses RESTORE_DB values that match POSTGRES_DB.
USAGE
}

if [ "${1:-}" = "--help" ] || [ "${1:-}" = "-h" ]; then
  usage
  exit 0
fi

DUMP_PATH=${1:-}
if [ -z "$DUMP_PATH" ]; then
  usage >&2
  exit 2
fi

if [ ! -s "$DUMP_PATH" ]; then
  echo "ERROR backup dump not found or empty: $DUMP_PATH" >&2
  exit 2
fi

COMPOSE_FILES=${COMPOSE_FILES:-"-f docker-compose.yml -f docker-compose.prod.yml"}
POSTGRES_SERVICE=${POSTGRES_SERVICE:-postgres}
POSTGRES_DB=${POSTGRES_DB:-nexora}
POSTGRES_USER=${POSTGRES_USER:?POSTGRES_USER must be set}
RESTORE_DB=${RESTORE_DB:-wasilio_restore_rehearsal_$(date -u +"%Y%m%d%H%M%S")}
KEEP_RESTORE_DB=${KEEP_RESTORE_DB:-false}

case "$RESTORE_DB" in
  ""|*[!A-Za-z0-9_]*)
    echo "ERROR RESTORE_DB must contain only letters, numbers, and underscores." >&2
    exit 2
    ;;
esac

if [ "$RESTORE_DB" = "$POSTGRES_DB" ]; then
  echo "ERROR RESTORE_DB must not match the live POSTGRES_DB ($POSTGRES_DB)." >&2
  exit 2
fi

restore_created=false

psql_postgres() {
  docker compose ${COMPOSE_FILES} exec -T "$POSTGRES_SERVICE" \
    psql -U "$POSTGRES_USER" -d postgres -v ON_ERROR_STOP=1 "$@"
}

psql_restore() {
  docker compose ${COMPOSE_FILES} exec -T "$POSTGRES_SERVICE" \
    psql -U "$POSTGRES_USER" -d "$RESTORE_DB" -v ON_ERROR_STOP=1 "$@"
}

drop_restore_db() {
  psql_postgres -c "DROP DATABASE IF EXISTS \"$RESTORE_DB\" WITH (FORCE);" >/dev/null
}

cleanup() {
  if [ "$restore_created" = "true" ] && [ "$KEEP_RESTORE_DB" != "true" ]; then
    echo "Dropping temporary restore database: $RESTORE_DB"
    drop_restore_db || true
  fi
}

trap cleanup EXIT INT TERM

echo "Controlled merchant trial restore rehearsal"
echo "Backup dump: $DUMP_PATH"
echo "Live database: $POSTGRES_DB"
echo "Temporary restore database: $RESTORE_DB"

echo "Verifying backup catalog"
docker compose ${COMPOSE_FILES} exec -T "$POSTGRES_SERVICE" \
  pg_restore --list \
  < "$DUMP_PATH" \
  > /dev/null

echo "Creating isolated restore database"
drop_restore_db
psql_postgres -c "CREATE DATABASE \"$RESTORE_DB\";" >/dev/null
restore_created=true

echo "Restoring backup into isolated database"
docker compose ${COMPOSE_FILES} exec -T "$POSTGRES_SERVICE" \
  pg_restore -U "$POSTGRES_USER" -d "$RESTORE_DB" --no-owner --no-acl \
  < "$DUMP_PATH"

echo "Running restored database sanity checks"
required_tables="tenants users domain_events orders"
optional_tables="marketing_leads tenant_payments products media_assets inbound_orders order_intelligence_snapshots"

for table_name in $required_tables; do
  exists=$(psql_restore -At -c "SELECT to_regclass('public.${table_name}') IS NOT NULL;")
  if [ "$exists" != "t" ]; then
    echo "ERROR required table missing after restore: $table_name" >&2
    exit 1
  fi
  count=$(psql_restore -At -c "SELECT COUNT(*) FROM ${table_name};")
  echo "  OK required table ${table_name}: ${count} rows"
done

for table_name in $optional_tables; do
  exists=$(psql_restore -At -c "SELECT to_regclass('public.${table_name}') IS NOT NULL;")
  if [ "$exists" = "t" ]; then
    count=$(psql_restore -At -c "SELECT COUNT(*) FROM ${table_name};")
    echo "  OK optional table ${table_name}: ${count} rows"
  else
    echo "  SKIP optional table ${table_name}: not present"
  fi
done

echo "Restore rehearsal passed: backup restored into isolated database and required tables are present."

if [ "$KEEP_RESTORE_DB" = "true" ]; then
  echo "KEEP_RESTORE_DB=true, leaving restored database available for manual review: $RESTORE_DB"
  trap - EXIT INT TERM
fi
