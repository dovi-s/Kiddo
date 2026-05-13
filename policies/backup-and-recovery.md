# Backup and Recovery Policy

**Owner:** Founder
**Last reviewed:** 2026-05-10
**Review cadence:** annual; restore drill monthly

## 1. Purpose

Defines backup cadence, recovery objectives, and the verification
process that confirms backups are restorable.

## 2. Recovery objectives

| Objective | Target | Notes |
|---|---|---|
| **RPO** (Recovery Point Objective — max acceptable data loss) | 1 hour | Supabase point-in-time recovery supports this for the production tier. |
| **RTO** (Recovery Time Objective — max acceptable downtime) | 4 hours | For a SEV-1 database loss requiring restore from backup. |

These targets are reviewed when the user base or transaction volume
materially changes, or when DriveWealth integration is wired (ACATs
recovery has its own SLA).

## 3. Backup mechanisms

### Production database

- **Supabase manages automatic backups** of the production Postgres
  cluster. Default tier includes daily snapshots + point-in-time
  recovery within a 7-day window. Higher tiers extend the window.
- We do not directly invoke or schedule backups; the responsibility
  is on Supabase per their published SLA.
- We retain the right to export a manual snapshot at any time via
  `pg_dump` against the read replica, and do so before any high-risk
  migration.

### Application code

- All code lives in GitHub. GitHub itself maintains the canonical
  source. No additional backup is required at this scale.
- A clone of the repo lives on the founder's local machine, which
  serves as a working second copy.

### Configuration

- Production env vars are stored in the host platform's secret store.
- A documented inventory of every required env var lives in
  `.env.example`. If the secret store were lost, the application can
  be re-configured from `.env.example` plus credentials retrieved
  from each vendor's dashboard.

### File storage

- Memory entry photos/videos/voice are stored in the host platform's
  file storage (today inline as data URLs and to local disk in dev;
  production storage TBD when scale demands it). Backups inherited
  from the storage provider's policy.

## 4. Restore drill

### Cadence

Monthly. First drill: on adoption of this policy. Subsequent drills:
first business day of each calendar month.

### Procedure

1. Run `node script/backup-restore-drill.mjs` against the production
   `DATABASE_URL`.
2. The script counts rows in every table and writes the result to
   `.local/backup-drill-YYYY-MM-DD.json`.
3. Compare against the previous month's drill file:
   - Tables present in last month's file should be present this
     month.
   - Row counts should be equal-or-greater (data should grow, not
     shrink, except for legitimate retention purges).
4. Annotate the file with any anomalies and the action taken.
5. Commit the drill file to the repo for the audit evidence trail.

### Quarterly: full restore drill

Once per quarter, in addition to the monthly count drill:

1. Spin up a temporary Postgres instance (Supabase branch DB or
   local Docker).
2. Restore from the latest production snapshot via `pg_dump` /
   `pg_restore` (or Supabase's branch-from-prod feature).
3. Run the application against the restored DB; smoke-test the
   dashboard endpoint, gift checkout flow (test mode), and the
   age-18 worker path.
4. Document the drill in `incidents/restore-drills/YYYY-Q#.md`.
5. Tear down the temporary instance.

## 5. Disaster scenarios and recovery paths

| Scenario | Recovery |
|---|---|
| **Application crash / restart loop** | Roll back to previous deploy via the host platform. ETA <15 min. |
| **Bad migration corrupts data** | Roll back the deploy. Restore the affected tables from the last good snapshot. ETA <2h. |
| **Supabase regional outage** | Wait for Supabase recovery (per their SLA). No multi-region failover at our current tier. ETA per Supabase. |
| **Supabase total loss of production DB** | Restore from the most recent point-in-time snapshot. RTO 4h, RPO 1h. |
| **Loss of the founder's access to all systems** | Recovery key store maintained in a separately-secured location (not committed to repo, not in the host platform's env vars). Founder maintains a written recovery plan as part of personal estate planning. |

## 6. Open items

- Multi-region failover for Supabase. Not justified at current scale;
  revisit at $1M ARR or at first regulated-channel partnership
  requirement.
- Off-Supabase backup copies. Currently relying on Supabase's
  retention. Add an independent export to S3 / R2 once GDPR or
  enterprise customers materialize.
- Documented runbook for the "Supabase outage during business hours"
  scenario including customer communication template.
