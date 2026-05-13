# Change Management Policy

**Owner:** Founder
**Last reviewed:** 2026-05-10
**Review cadence:** annual

## 1. Purpose

Defines how code, configuration, and infrastructure changes reach
production safely. Every production change leaves an evidence trail.

## 2. Scope

- Application code (server, client, mobile)
- Database schema (migrations)
- Environment configuration (production env vars)
- Third-party integration configuration (Stripe webhook URLs, OAuth
  redirect URIs, DriveWealth callback URLs when wired)
- DNS and domain configuration
- Production deployment process

## 3. Change types

### 3.1 Standard change

Most application code changes. Examples: new feature, bug fix, copy
update, UI tweak.

**Process:**
1. Branch from main.
2. Implement the change.
3. Run `npm run check` (full type-check) and any relevant tests
   locally.
4. Commit. The pre-commit secrets scan hook
   (`script/check-no-secrets.mjs`) blocks commits containing
   recognizable API key patterns.
5. Push. CI runs `.github/workflows/ci.yml` (type-check web + mobile,
   pure-function tests, content lint).
6. Open PR. Self-review today; peer review at first hire.
7. Merge to main on green CI.
8. Deploy from main (auto via host platform).
9. Smoke-test the affected surface in production.

### 3.2 Emergency change

For SEV-1 incidents requiring immediate production change.

**Process:**
1. Document the incident in `incidents/YYYY-MM-DD-shortname.md`
   per `incident-response.md`.
2. Implement the smallest possible fix.
3. Skip CI only if absolutely necessary (and document why in the
   incident file). Never skip the secrets scan.
4. Deploy and smoke-test.
5. Within 5 business days, do the post-mortem; if the emergency
   change introduced technical debt, file the follow-up.

### 3.3 Database migration

**Process:**
1. Generate the migration via `npm run db:generate` (drizzle-kit).
2. Review the SQL — verify it uses `IF NOT EXISTS` / `IF NOT NULL`
   for additive changes.
3. Test locally against a dev Postgres.
4. Apply to production via `npm run db:migrate`.
5. Confirm the migration appears in `migrations/meta/_journal.json`
   (script `apply-missing-migrations.mjs` exists for the case where
   files exist but the journal is out of date).
6. The application restart picks up the new schema.

**Backwards compatibility:** every migration must be deployable while
the previous code version is still running. No column drops in the
same deploy as the code that stops referencing them — that's two
deploys with at least one intervening release.

### 3.4 Configuration change

**Process:**
1. Document the change in the PR description that triggers it (or in
   an incident file for emergency changes).
2. Apply via the host platform's env var UI.
3. Restart the affected service.
4. Confirm via observability (Sentry, application logs).
5. Update `.env.example` if the variable is new.

### 3.5 Third-party integration configuration

Changes to Stripe webhook URLs, OAuth redirect URIs, etc.

**Process:**
1. Plan the change including rollback path.
2. Make the change in the third party first if it's additive (add
   the new endpoint), then in code.
3. For destructive changes (URL change), update code first, deploy,
   then change third-party config.
4. Confirm webhook delivery via the third party's dashboard.

## 4. Deployment

- All deploys originate from main branch.
- The main branch is protected: direct pushes blocked at first hire
  (today: founder discipline).
- Rollback path: `git revert` + redeploy. Database migrations are
  designed to be backwards-compatible so revert doesn't break the DB.

## 5. Evidence

- **Code changes:** git history is the change log. PR descriptions
  carry the rationale.
- **Schema changes:** `migrations/` + `migrations/meta/_journal.json`.
- **Config changes:** PR descriptions or incident files.
- **Deploys:** host platform deploy log.

For SOC 2 audit purposes, the combination of git history + CI run
records + deploy logs constitutes the change evidence trail. No
separate ticket system is required while the team is one person.

## 6. Separation of duties

Today: not enforceable (one person).

At first hire: production deploys require a second person's approval.
The PR review is where this happens. The author cannot also be the
approver.

## 7. Open items

- Branch protection rules on main (block direct pushes, require PR +
  CI). Deferred until first hire.
- Deploy approval gate on the host platform. Deferred until first hire.
- Automated change detection for third-party config (e.g., diff Stripe
  webhook config weekly). Manual today.
