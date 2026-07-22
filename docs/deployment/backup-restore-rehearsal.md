# Backup And Restore Rehearsal

This guide proves that Wasilio can recover merchant data before a controlled merchant trial starts.

It covers platform backup and recovery. Merchant-facing CSV or Excel downloads are a separate product feature: useful for trust, accounting, and operational handoff, but not a replacement for Wasilio's own backups.

## What Must Be Protected

Database backup protects:

- workspaces and users
- orders and domain events
- confirmation attempts, callbacks, assignment, delivery, recovery, and intelligence records
- plans, subscriptions, payments, receipts, and demo requests
- products and media metadata

Media backup protects:

- uploaded product images
- gallery and SEO images stored in the backend media volume

Database backups alone do not protect uploaded image files. Media storage must be backed up or moved to object storage before broader production usage.

## Local Rehearsal

Use this against the local Docker stack first. It writes the backup under `/tmp`, restores into a temporary database, runs table/count checks, then drops the temporary database.

```bash
COMPOSE_FILES="-f docker-compose.yml -f docker-compose.override.yml" \
POSTGRES_USER="postgres" \
POSTGRES_DB="nexora" \
BACKUP_DIR="/tmp/wasilio-backups" \
BACKUP_PREFIX="local-rehearsal" \
./scripts/backup-postgres.sh
```

Then run the restore rehearsal using the backup file printed by the command above:

```bash
COMPOSE_FILES="-f docker-compose.yml -f docker-compose.override.yml" \
POSTGRES_USER="postgres" \
POSTGRES_DB="nexora" \
./scripts/trial-restore-rehearsal.sh /tmp/wasilio-backups/local-rehearsal-YYYYMMDDTHHMMSSZ.dump
```

Expected result:

- backup catalog verification passes
- temporary restore database is created
- restore succeeds
- required tables exist
- table counts are printed
- temporary database is dropped unless `KEEP_RESTORE_DB=true`

To inspect the restored database manually:

```bash
KEEP_RESTORE_DB=true \
RESTORE_DB="wasilio_restore_review" \
COMPOSE_FILES="-f docker-compose.yml -f docker-compose.override.yml" \
POSTGRES_USER="postgres" \
POSTGRES_DB="nexora" \
./scripts/trial-restore-rehearsal.sh /tmp/wasilio-backups/local-rehearsal-YYYYMMDDTHHMMSSZ.dump
```

Drop the review database manually after inspection:

```bash
docker compose -f docker-compose.yml -f docker-compose.override.yml exec -T postgres \
  psql -U postgres -d postgres -c 'DROP DATABASE IF EXISTS wasilio_restore_review WITH (FORCE);'
```

## Controlled Merchant Trial Rehearsal

Run this from the deployment host before giving a real merchant access.

```bash
POSTGRES_USER="<production-user>" \
POSTGRES_DB="nexora" \
BACKUP_DIR="/var/backups/wasilio" \
BACKUP_PREFIX="wasilio" \
./scripts/backup-postgres.sh
```

Restore into an isolated database:

```bash
POSTGRES_USER="<production-user>" \
POSTGRES_DB="nexora" \
./scripts/trial-restore-rehearsal.sh /var/backups/wasilio/wasilio-YYYYMMDDTHHMMSSZ.dump
```

The rehearsal must never restore over the live database. `scripts/trial-restore-rehearsal.sh` refuses a `RESTORE_DB` value that matches `POSTGRES_DB`.

## Media Volume Backup

For Docker Compose deployments, uploaded files live in the `backend_media` volume. Confirm the real volume name on the host:

```bash
docker volume ls
```

For a single-node trial, capture a compressed media archive during a quiet period:

```bash
docker run --rm \
  -v "<compose-project>_backend_media:/media:ro" \
  -v "/var/backups/wasilio:/backup" \
  alpine:3.20 \
  tar -C /media -czf /backup/wasilio-media-YYYYMMDDTHHMMSSZ.tgz .
```

After creating the archive:

- copy it to encrypted off-host storage
- record the artifact name beside the database dump
- verify the archive can be listed with `tar -tzf`
- include media restoration in a host-migration drill

## Off-Host Storage

The application host is not a safe final backup location. For a controlled merchant trial, every successful database dump and media archive should be copied to storage outside the application server.

Minimum acceptable trial practice:

- daily database dump
- media archive after media-changing sessions or at least daily once merchants upload images
- encrypted off-host copy
- retention of at least 14 days
- deployment log entry with backup artifact names

## Post-Restore Checks

After an isolated restore, verify:

1. `scripts/trial-restore-rehearsal.sh` passes.
2. Required table counts look plausible for the deployment.
3. `scripts/trial-account-audit.sh` shows no handoff-blocking review flags on the live database before merchant access.
4. `scripts/live-backend-smoke.mjs` passes against the running backend.
5. A recently uploaded media URL still resolves publicly.

If a full emergency restore is ever needed, restore into an isolated database first, verify it, stop live writes, then promote the restored database only after the checks pass.

## Merchant Exports

Merchant exports are a future product feature and should be scoped separately from backups.

Recommended first export:

- Orders CSV from the Orders workspace
- use current filters
- include business fields only
- exclude internal IDs, intelligence formulas, raw audit tables, and staff-only notes

Merchant export helps trust and accounting. Platform backup and restore protects business continuity.
