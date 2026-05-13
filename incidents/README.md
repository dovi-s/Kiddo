# Kiddo Incident Log

This directory holds the durable record of every security incident,
post-mortem, tabletop exercise, restore drill, vendor review, and
quarterly access review at Kiddo.

The structure is intentionally flat-file Markdown. Audit-grade
evidence does not need a database; a git-tracked Markdown file with
a clear naming convention is sufficient and beats a SaaS tool for
durability.

## Structure

```
incidents/
  README.md                          this file
  TEMPLATE.md                        per-incident template
  YYYY-MM-DD-shortname.md            individual incident files
  access-reviews/
    YYYY-Q#.md                       quarterly access review
  restore-drills/
    YYYY-Q#.md                       quarterly full-restore drill
    YYYY-MM.md                       monthly count-drill notes
  tabletops/
    YYYY-MM-DD-scenario.md           tabletop exercise
  vendor-reviews/
    YYYY-vendor.md                   annual per-vendor review
```

## Naming

- Incidents: `YYYY-MM-DD-shortname.md`. The shortname is 1-3 words
  capturing the gist. Example: `2026-08-15-stripe-webhook-replay.md`.
- Access reviews: `YYYY-Q#.md`. Example: `2026-Q3.md`.
- Restore drills: `YYYY-Q#.md` for the quarterly full-restore;
  `YYYY-MM.md` for the monthly count-drill.
- Tabletops: `YYYY-MM-DD-scenario.md`.
- Vendor reviews: `YYYY-vendor.md`. Example: `2026-supabase.md`.

## Retention

All files in this directory are retained for **7 years minimum**.
Tied to the financial-records retention requirement; aligned with
typical SOC 2 evidence retention.

## See also

- `policies/incident-response.md` — the process this log records
- `policies/access-control.md` — the quarterly access review process
- `policies/backup-and-recovery.md` — the restore drill process
- `policies/vendor-management.md` — the annual vendor review process
- `SECURITY.md` (repo root) — public-facing security posture

## Status

No incidents recorded to date. Drills and reviews begin per the
cadences in the relevant policies; first entries expected:

- First monthly restore-drill: on adoption of `backup-and-recovery.md`
- First quarterly access review: end of Q3 2026 or at first hire
- First tabletop exercise: Q4 2026
- First annual vendor reviews: end of 2026
