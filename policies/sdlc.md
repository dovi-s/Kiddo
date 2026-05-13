# Secure Development Lifecycle Policy

**Owner:** Founder
**Last reviewed:** 2026-05-10
**Review cadence:** annual

## 1. Purpose

Defines how Kiddo writes, reviews, ships, and operates code with
security as a first-class concern.

## 2. Phases

### 2.1 Design

For any feature touching customer data or payment flow:

- Identify the data classification per `data-classification.md`.
- Identify which audit logs need to be added.
- Identify the threat model implications per `SECURITY.md` §2.
- For payment flows: confirm idempotency story, webhook signature
  verification path, refund/chargeback handling.
- For child-safety surfaces (anything publicly writable): verify the
  rate-limit + audit-log + visibility-tier model from
  `project_child_safety_architecture.md` is honored.

For features that don't touch customer data or payment flow, no
formal design step is required — a clear PR description is enough.

### 2.2 Implement

- Write the code.
- Add audit log entries on sensitive operations.
- Add tests for pure functions (the `script/test-*.ts` pattern).
- For schema changes, write the migration. Verify it uses
  `IF NOT EXISTS` for additive changes.
- Avoid third-party dependencies for cryptographic functions; use
  Node built-ins or libraries vendored in our stack already
  (`bcryptjs`, `crypto`).

### 2.3 Review

- Self-review via the PR diff before requesting review.
- At first hire: peer review required before merge to main.
- Reviewer checks:
  - No new secrets introduced.
  - No new third-party dependencies without a justification in the
    PR description.
  - Tests added for new pure functions.
  - Audit logs added for new sensitive operations.
  - Migration safety (additive, backwards-compatible).
  - No customer data printed to logs.
  - No PII in analytics events props.

### 2.4 Test

- `npm run check` — full type-check (web + mobile).
- `npm run test:all:runtime` — pure-function test suites.
- `.github/workflows/ci.yml` runs the same on every push and PR.
- For payment flows, the Stripe test mode is the source of truth
  pre-launch.
- Manual smoke test of affected surfaces in development before
  pushing.

### 2.5 Deploy

Per `change-management.md` §4.

### 2.6 Operate

- Sentry alerts (when DSN configured) for runtime errors.
- Audit log review — manual today, automated alerting on roadmap.
- North-Star and Funnels admin dashboards for behavioral signal
  drift (the "something looks weird" early warning).

## 3. Secrets handling

### Where secrets live

- Local development: `.env` (excluded by `.gitignore`).
- Production: host platform's secret store.
- Never in code.
- Never in commits.

### Hard rules

- The pre-commit hook `script/check-no-secrets.mjs` blocks commits
  containing recognizable API key patterns (Stripe sk/pk, AWS
  AKIA/ASIA, Supabase anon/service, generic hex tokens above
  threshold length).
- The pattern list is documented in the script and reviewed when
  adding a new vendor.
- If a secret is accidentally committed: rotate it immediately, then
  use `git filter-repo` or BFG to scrub from history. **Rotation
  comes first; scrubbing is cleanup.**

### Rotation cadence

| Secret type | Cadence |
|---|---|
| Production API keys (Stripe, Supabase service role, DriveWealth, etc.) | Annual + immediately on suspected compromise |
| Webhook signing secrets | On suspected compromise; not scheduled |
| Database admin password | Annual |
| Session secret (`SESSION_SECRET`) | Rotation invalidates all sessions; do during a planned maintenance window |

## 4. Dependency management

- New dependencies require justification in the PR description.
- Prefer fewer, larger, well-maintained dependencies over many small
  ones.
- Avoid dependencies with no commits in 12+ months unless they're
  intentionally finished (rare).
- `npm audit` is informational, not blocking — high-noise tool.
  Patch high/critical CVEs in dependencies that ship to the client
  or that handle untrusted input.

## 5. Code style and review heuristics

These are not security-critical but are SDLC discipline:

- Prefer editing existing files to creating new ones.
- Don't add features the task doesn't need.
- Don't write comments that explain WHAT — well-named identifiers do
  that. Comments explain WHY when the why is non-obvious.
- Locked copy rules apply to all UI strings (no em dashes, never
  "auto-invest" in user copy, never "contribute" in user copy, etc.
  See locked memory).

## 6. AI-assisted development

Anthropic's Claude is used for code generation during development.
Per the locked memory standing principles:

- AI-generated code is treated as a first draft. The author
  (founder) is accountable for the final shipped code.
- Customer data is never sent to AI tooling. Code generation runs
  against the codebase, not against production data.
- Design judgment is not delegated. The kid-at-18 lens, the locked
  copy rules, and the design discipline in the locked memory are
  applied by the founder, not by the model.

## 7. Open items

- Automated dependency scanning (Dependabot, Snyk, or equivalent).
  Not yet wired.
- SAST (static application security testing) tool. Not yet wired;
  TypeScript's type checker covers a lot of the value at our scale.
- DAST (dynamic application security testing) — addressed by the
  planned penetration test before public launch (see SECURITY.md §6).
