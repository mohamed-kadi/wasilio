#!/usr/bin/env sh
set -eu

usage() {
  cat <<'USAGE'
Usage: ./scripts/hosted-trial-rehearsal.sh [env-file] [backup-dump]

Runs the hosted backend trial rehearsal checks in the intended order.

Safe default:
  - validates required trial environment values
  - validates production Docker Compose config
  - runs live backend smoke only when WASILIO_API_BASE_URL is set
  - skips database account audit unless RUN_ACCOUNT_AUDIT=true
  - skips restore rehearsal unless a backup dump path is provided

Environment:
  COMPOSE_FILES        Compose files. Defaults to production compose.
  SKIP_COMPOSE_CONFIG  Set true when the hosted backend is not Compose-based.
  WASILIO_API_BASE_URL Backend origin for live smoke, for example https://api.wasilio.ma.
  RUN_ACCOUNT_AUDIT    Set true to run scripts/trial-account-audit.sh.
  POSTGRES_USER        Required when RUN_ACCOUNT_AUDIT=true or restore rehearsal runs.
  POSTGRES_DB          Live database name. Defaults to nexora.
  RESTORE_DUMP_PATH    Backup dump path when not passed as the second argument.

The script does not print secret values.
USAGE
}

if [ "${1:-}" = "--help" ] || [ "${1:-}" = "-h" ]; then
  usage
  exit 0
fi

SCRIPT_DIR=$(CDPATH= cd "$(dirname "$0")" && pwd)
ROOT_DIR=$(CDPATH= cd "$SCRIPT_DIR/.." && pwd)
cd "$ROOT_DIR"

ENV_FILE=${1:-}
RESTORE_DUMP=${2:-${RESTORE_DUMP_PATH:-}}
COMPOSE_FILES=${COMPOSE_FILES:-"-f docker-compose.yml -f docker-compose.prod.yml"}
SKIP_COMPOSE_CONFIG=${SKIP_COMPOSE_CONFIG:-false}
RUN_ACCOUNT_AUDIT=${RUN_ACCOUNT_AUDIT:-false}
POSTGRES_DB=${POSTGRES_DB:-nexora}

if [ -n "$ENV_FILE" ] && [ ! -f "$ENV_FILE" ]; then
  echo "ERROR env file not found: $ENV_FILE" >&2
  exit 2
fi

get_value() {
  key="$1"
  if [ -n "$ENV_FILE" ]; then
    awk -v wanted="$key" '
      /^[[:space:]]*#/ { next }
      /^[[:space:]]*$/ { next }
      {
        line = $0
        sub(/^[[:space:]]*export[[:space:]]+/, "", line)
        split(line, parts, "=")
        key = parts[1]
        gsub(/^[[:space:]]+|[[:space:]]+$/, "", key)
        if (key == wanted) {
          value = substr(line, index(line, "=") + 1)
          gsub(/^[[:space:]]+|[[:space:]]+$/, "", value)
          if (value ~ /^".*"$/) {
            value = substr(value, 2, length(value) - 2)
          }
          print value
          found = 1
          exit
        }
      }
      END { if (!found) exit 1 }
    ' "$ENV_FILE"
  else
    printenv "$key" 2>/dev/null || return 1
  fi
}

step() {
  echo
  echo "==> $1"
}

echo "Hosted backend trial rehearsal"
if [ -n "$ENV_FILE" ]; then
  echo "Environment source: $ENV_FILE"
else
  echo "Environment source: current process environment"
fi

step "1. Environment inventory check"
if [ -n "$ENV_FILE" ]; then
  ./scripts/trial-env-check.sh "$ENV_FILE"
else
  ./scripts/trial-env-check.sh
fi

step "2. Production Compose config validation"
if [ "$SKIP_COMPOSE_CONFIG" = "true" ]; then
  echo "SKIP production Compose config validation - SKIP_COMPOSE_CONFIG=true"
else
  if [ -n "$ENV_FILE" ]; then
    docker compose --env-file "$ENV_FILE" ${COMPOSE_FILES} config >/dev/null
  else
    docker compose ${COMPOSE_FILES} config >/dev/null
  fi
  echo "PASS production Compose config renders without printing secrets."
fi

step "3. Live backend smoke"
API_BASE=${WASILIO_API_BASE_URL:-$(get_value WASILIO_API_BASE_URL 2>/dev/null || true)}
if [ -n "$API_BASE" ]; then
  WASILIO_API_BASE_URL="$API_BASE" node scripts/live-backend-smoke.mjs
else
  echo "SKIP live backend smoke - set WASILIO_API_BASE_URL to the hosted backend origin."
fi

step "4. Account ownership audit"
if [ "$RUN_ACCOUNT_AUDIT" = "true" ]; then
  DB_USER=${POSTGRES_USER:-$(get_value POSTGRES_USER 2>/dev/null || true)}
  if [ -z "$DB_USER" ]; then
    echo "ERROR POSTGRES_USER is required for account audit." >&2
    exit 2
  fi
  POSTGRES_USER="$DB_USER" POSTGRES_DB="$POSTGRES_DB" COMPOSE_FILES="$COMPOSE_FILES" ./scripts/trial-account-audit.sh
else
  echo "SKIP account audit - set RUN_ACCOUNT_AUDIT=true after the hosted database is reachable from this shell."
fi

step "5. Restore rehearsal"
if [ -n "$RESTORE_DUMP" ]; then
  DB_USER=${POSTGRES_USER:-$(get_value POSTGRES_USER 2>/dev/null || true)}
  if [ -z "$DB_USER" ]; then
    echo "ERROR POSTGRES_USER is required for restore rehearsal." >&2
    exit 2
  fi
  POSTGRES_USER="$DB_USER" POSTGRES_DB="$POSTGRES_DB" COMPOSE_FILES="$COMPOSE_FILES" ./scripts/trial-restore-rehearsal.sh "$RESTORE_DUMP"
else
  echo "SKIP restore rehearsal - pass a backup dump path after creating a fresh database backup."
fi

echo
echo "Hosted trial rehearsal command sequence completed."
echo "Manual handoff checks still required: setup email delivery, merchant password setup, media URL review after upload, and off-host backup artifact recording."
