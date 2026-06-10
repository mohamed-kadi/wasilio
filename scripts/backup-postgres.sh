#!/usr/bin/env sh
set -eu

COMPOSE_FILES=${COMPOSE_FILES:-"-f docker-compose.yml -f docker-compose.prod.yml"}
POSTGRES_SERVICE=${POSTGRES_SERVICE:-postgres}
POSTGRES_DB=${POSTGRES_DB:-nexora}
POSTGRES_USER=${POSTGRES_USER:?POSTGRES_USER must be set}
BACKUP_DIR=${BACKUP_DIR:-backups}
BACKUP_PREFIX=${BACKUP_PREFIX:-nexora}
BACKUP_RETENTION_DAYS=${BACKUP_RETENTION_DAYS:-}

timestamp=$(date -u +"%Y%m%dT%H%M%SZ")
artifact="${BACKUP_DIR}/${BACKUP_PREFIX}-${timestamp}.dump"

mkdir -p "$BACKUP_DIR"

echo "Creating PostgreSQL backup: ${artifact}"
docker compose ${COMPOSE_FILES} exec -T "$POSTGRES_SERVICE" \
  pg_dump -U "$POSTGRES_USER" -d "$POSTGRES_DB" --format=custom --no-owner --no-acl \
  > "$artifact"

echo "Verifying backup catalog: ${artifact}"
docker compose ${COMPOSE_FILES} exec -T "$POSTGRES_SERVICE" \
  pg_restore --list \
  < "$artifact" \
  > /dev/null

if [ -n "$BACKUP_RETENTION_DAYS" ]; then
  echo "Pruning local backups older than ${BACKUP_RETENTION_DAYS} days in ${BACKUP_DIR}"
  find "$BACKUP_DIR" -type f -name "${BACKUP_PREFIX}-*.dump" -mtime +"$BACKUP_RETENTION_DAYS" -print -delete
fi

echo "Backup complete: ${artifact}"
