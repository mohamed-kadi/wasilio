#!/bin/sh
set -eu

usage() {
  cat <<'USAGE'
Usage: ./scripts/trial-env-check.sh [env-file]

Checks the controlled merchant trial environment inventory without printing secret values.

Run with no argument to check the current process environment.
Run with a host-only env file path, such as /etc/wasilio/trial.env, to check a Docker Compose trial file.
USAGE
}

if [ "${1:-}" = "--help" ] || [ "${1:-}" = "-h" ]; then
  usage
  exit 0
fi

ENV_FILE="${1:-}"

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

has_value() {
  value="$(get_value "$1" 2>/dev/null || true)"
  [ -n "$value" ]
}

missing_count=0
warning_count=0

check_required_group() {
  title="$1"
  shift

  echo
  echo "$title"
  for key in "$@"; do
    if has_value "$key"; then
      echo "  OK      $key"
    else
      echo "  MISSING $key"
      missing_count=$((missing_count + 1))
    fi
  done
}

warn_if_value() {
  key="$1"
  bad_value="$2"
  message="$3"
  value="$(get_value "$key" 2>/dev/null || true)"
  if [ "$value" = "$bad_value" ]; then
    echo "  REVIEW  $key - $message"
    warning_count=$((warning_count + 1))
  fi
}

warn_if_contains() {
  key="$1"
  needle="$2"
  message="$3"
  value="$(get_value "$key" 2>/dev/null || true)"
  case "$value" in
    *"$needle"*)
      echo "  REVIEW  $key - $message"
      warning_count=$((warning_count + 1))
      ;;
  esac
}

echo "Controlled merchant trial environment check"
if [ -n "$ENV_FILE" ]; then
  echo "Source: $ENV_FILE"
else
  echo "Source: current process environment"
fi
echo "Secret values are not printed."

check_required_group "Backend and database" \
  POSTGRES_DB \
  POSTGRES_USER \
  POSTGRES_PASSWORD \
  JWT_SECRET \
  CORS_ALLOWED_ORIGINS \
  APP_FRONTEND_BASE_URL \
  APP_MEDIA_PUBLIC_BASE_URL \
  APP_ONBOARDING_ENABLED

check_required_group "Email delivery" \
  APP_EMAIL_MODE \
  APP_EMAIL_FROM \
  APP_SUPPORT_CONTACT \
  SMTP_HOST \
  SMTP_PORT \
  SMTP_USERNAME \
  SMTP_PASSWORD

check_required_group "Frontend build values" \
  VITE_API_BASE_URL \
  VITE_LANDING_ENGINE_URL \
  VITE_PUBLIC_SITE_URL \
  VITE_PUBLIC_SUPPORT_EMAIL

echo
echo "Policy review"
warn_if_value APP_EMAIL_MODE log "controlled merchant trials should send through SMTP"
warn_if_value APP_ONBOARDING_ENABLED true "public signup is open; confirm this is intentional"
warn_if_value APP_SUPER_ADMIN_BOOTSTRAP_ENABLED true "disable after the first staff login"
warn_if_value VITE_API_BASE_URL /api "Cloudflare Pages needs the hosted backend /api URL"
warn_if_contains CORS_ALLOWED_ORIGINS localhost "remove local origins from controlled trial CORS"
warn_if_contains APP_FRONTEND_BASE_URL localhost "password/setup links should point to the public frontend"
warn_if_contains APP_MEDIA_PUBLIC_BASE_URL localhost "media URLs should use the public backend/frontend origin"
warn_if_contains VITE_PUBLIC_SITE_URL localhost "public frontend builds should use the real public site URL"

echo
echo "Bootstrap review"
for key in APP_SUPER_ADMIN_BOOTSTRAP_ENABLED APP_SUPER_ADMIN_EMAIL APP_SUPER_ADMIN_PASSWORD APP_SUPER_ADMIN_TENANT_NAME; do
  if has_value "$key"; then
    echo "  SET     $key"
  else
    echo "  UNSET   $key"
  fi
done
echo "  NOTE    Bootstrap email/password should be present only during the first staff-account deployment."

echo
if [ "$missing_count" -gt 0 ]; then
  echo "Result: failed - $missing_count required value(s) missing."
  exit 1
fi

echo "Result: passed - required controlled trial values are present."
if [ "$warning_count" -gt 0 ]; then
  echo "Review: $warning_count policy item(s) need confirmation before merchant handoff."
else
  echo "Review: no policy warnings."
fi
