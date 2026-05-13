# Backup and Restore Runbook

## Scope

This runbook covers PostgreSQL backup and restore for Kora.

## Daily Backup (Supabase/Postgres)

1. Set environment variables:
   - `PGHOST`
   - `PGPORT`
   - `PGUSER`
   - `PGPASSWORD`
   - `PGDATABASE`
2. Run:
   - `pg_dump --format=custom --no-owner --no-privileges --file=kora_YYYYMMDD.dump`
3. Verify file size is non-zero.
4. Upload to secure object storage with retention policy.

## Restore (Staging First)

1. Create empty target database.
2. Run:
   - `pg_restore --clean --if-exists --no-owner --no-privileges --dbname=postgresql://... kora_YYYYMMDD.dump`
3. Run app migrations only if needed:
   - `npm run db:migrate`
4. Run smoke tests:
   - `npm run test:smoke` (set `SMOKE_BASE_URL` if needed).

## Monthly Restore Drill

1. Restore latest backup to staging.
2. Confirm app boot and `/api/health?deep=1`.
3. Confirm critical paths:
   - login
   - gift checkout
   - webhook processing
4. Record drill result and timestamp.

## Incident Recovery Priority

1. Restore database.
2. Confirm health endpoint.
3. Replay Stripe webhooks if needed from Stripe dashboard.
4. Verify no failed webhook backlog in Admin -> Recent Webhook Events.
