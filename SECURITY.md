# Kiddo Security

> Last updated: 2026-05-10
>
> This document describes the security posture of Kiddo as it stands
> today. It is written to be honest, not aspirational. Controls that
> are not yet in place are listed in §6 alongside the planned
> remediation, not omitted.
>
> Kiddo is **not currently SOC 2 audited.** See `PRODUCT.md` §8 for
> the audit-readiness roadmap and the realistic timeline if/when an
> audit is pursued.

---

## 1. Reporting a vulnerability

If you believe you have found a security vulnerability in Kiddo,
please email **security@kiddofund.com** with:

- A description of the issue and its impact
- Steps to reproduce
- Any proof-of-concept code or screenshots

We will acknowledge receipt within 3 business days and provide a
remediation timeline within 10 business days. Please do not publicly
disclose the issue until we have had a chance to address it.

We do not currently run a paid bug bounty program, but we recognize
researchers who report responsibly in our public acknowledgments
once a fix is shipped.

---

## 2. Threat model

Kiddo is a custodial-UTMA investment-gifting platform. The four
populations whose data we hold:

| Population | Data sensitivity |
|---|---|
| Parents (custodians) | Email, name, password hash, recipient SSN (encrypted), recipient birthdate, financial account state |
| Children (recipients pre-18) | First name, birthdate, SSN last-4 + full encrypted, fund balance |
| Children (post-18, claimed) | Same as parents — they own their fund |
| Gifters | Optional name + email, IP address on uploads, message text, photo/video/audio (when provided) |

The four threats we design against, in priority order:

1. **Custodial fraud.** A bad actor takes over a parent account and
   redirects funds. Mitigated by per-fund access controls, audit
   logging on every settlement, and the brokerage layer (DriveWealth)
   adding a separate authentication boundary at money-out.
2. **Child-data exposure.** A leak of recipient SSNs / birthdates would
   be both a regulatory and trust catastrophe. Mitigated by
   `recipientSsnFullEncrypted` (encrypted at rest, only readable by the
   activate-investing path; never returned to the client). Last-4 is
   stored unencrypted but is not by itself a re-identification risk.
3. **Gifter-uploaded content abuse.** Public memory uploads from
   gifters could be a CSAM injection vector. **Open Tier 1 launch
   blocker** — see `project_child_safety_architecture.md` in the
   locked memory. Currently mitigated by rate limiting (10/IP-fund/10min,
   50/IP/10min) and audit logging; CSAM scanning is not yet wired.
4. **Stolen-credential session hijacking.** Mitigated by httpOnly +
   secure cookies, session expiry, and session table in Postgres
   rather than memory. **MFA is not yet available** to parent
   accounts — listed in §6.

---

## 3. Controls in place today

### Authentication

- Passport.js local strategy with bcrypt password hashing
  (12 rounds in production, 10 in development)
- Sessions stored in Postgres via `connect-pg-simple`; not in-memory
- Session cookies are httpOnly and secure-in-production
- Forgot-password flow with single-use tokens (see `server/auth.ts`
  `/api/auth/forgot-password`)
- Per-fund ownership middleware (`requireOwnedFundParam`) gates every
  authenticated fund-scoped endpoint

### Encryption

- TLS in transit on all production traffic (managed by the host)
- TLS to the Postgres pooler (Supabase, with TLS termination)
- Recipient SSN full-form is encrypted at rest before Postgres write
  (column: `funds.recipient_ssn_full_encrypted`)
- Stripe payment processing is fully outsourced; we never touch raw
  card numbers (PCI scope: SAQ A only, the lowest tier)

### Audit logging

- `audit_logs` table records sensitive operations (auth events, role
  changes, fund transfers, sensitive data access). Indexed on user,
  action, resource type
- `webhook_events` table records every Stripe webhook ID we've
  processed (idempotency + replay defense)
- `analytics_events` table records first-party product analytics
  server-side only; no third-party tracking pixel; no kid data
  shipped off-platform

### Application security

- Stripe webhook signature verification at the entry point
- CORS disabled in production (mobile + web share a domain)
- Rate limiting on public memory uploads
- No raw secrets in source — `.env` only, `.gitignore` excludes it
- Pre-commit secrets scan hook blocks commits containing AWS/Stripe/
  Supabase/generic API key patterns (`script/check-no-secrets.mjs`)

### Observability

- `server/ops.ts` — Sentry-ready (deps installed). Auto-wires when
  `SENTRY_DSN` env var is set. Console fallback when unset.
- `client/src/lib/observability.ts` — same shape on the client
  (`VITE_SENTRY_DSN`).
- AppErrorBoundary routes uncaught React errors through `captureError`
  rather than bare console.error.

### Backup

- Supabase manages automatic backups of the production database with
  point-in-time recovery (per their default tier). We do not manage
  the backup process directly.
- `script/backup-restore-drill.mjs` — read-only snapshot of every
  table's row count, written to `.local/backup-drill-{date}.json`.
  Run monthly as evidence the backup pool is healthy and queryable.

### Code change management

- All production code lives in git
- `.github/workflows/ci.yml` — type-check (web + mobile), pure-function
  tests, content lint on every push and PR; concurrency cancellation
  prevents queue pileup
- All deploys originate from main branch

---

## 4. Vendor inventory

Third parties touching customer data or critical to availability:

| Vendor | Purpose | Data shared | SOC 2 / cert |
|---|---|---|---|
| Supabase | Production Postgres + auth-adjacent infra | All user data | SOC 2 Type 2 (per their docs) |
| Stripe | Payments + subscriptions | Email, name, payment metadata | SOC 1 + SOC 2 + PCI-DSS Level 1 |
| DriveWealth | UTMA brokerage (scaffolded, not yet wired) | Will share KYC, SSN, address | SOC 1 + SOC 2 + FINRA member |
| Resend / SES | Transactional email | Email, optional name | Resend SOC 2 Type 2; SES SOC 1/2/3 |
| Anthropic | AI tooling (development only) | None — used by engineering for code generation, not customer data | SOC 2 Type 2 |
| GitHub | Source code hosting | Source only — no customer data | SOC 1 + SOC 2 |
| Sentry (when DSN set) | Error tracking | Stack traces; PII scrubbed where possible | SOC 2 Type 2 |
| Yahoo Finance | Stock price quotes | None outbound — read-only public data | N/A |

Vendor reassessment cadence: annual review of SOC 2 reports as they
publish. New vendors added only after data-sharing scope is documented.

---

## 5. Data retention and deletion

| Data | Retention | Deletion path |
|---|---|---|
| User account | Until user requests deletion or account inactive >7 years | Account deletion request to security@kiddofund.com triggers a 30-day soft-delete window then full purge |
| Audit logs | 1 year minimum, 7 years for monetary transactions | Automated archive after 1y; manual purge after 7y |
| Memory entries (notes/photos/videos/voice) | For the life of the fund, transferred to the kid at age 18 | Parent can delete their own pre-18; kid can delete their own post-18 |
| Webhook events | 90 days | Automated trim |
| Analytics events | 1 year | Automated trim |

---

## 6. Open items (audit-blocking)

These are known gaps. Do not represent them as in-place.

| Gap | Plan | Reference |
|---|---|---|
| **CSAM scanning on uploaded media** | Tier 1 launch blocker. Required by 18 U.S.C. § 2258A before public upload reaches strangers. Currently mitigated by rate limiting + audit logging only. | `project_child_safety_architecture.md` |
| **MFA for parent accounts** | Not yet implemented. TOTP planned via standard library; no SMS-based MFA (regulatory and security reasons). | Roadmap |
| **Background checks** | N/A today (no employees beyond founder). Required when first hire happens. | HR runbook (TBD) |
| **Annual security training** | N/A today (no employees). Required when first hire happens. | HR runbook (TBD) |
| **Quarterly access reviews** | Admin → Access Review tab now exists (`/admin?tab=access-review`). Process is documented; cadence to begin Q3 2026 or at first hire. | `policies/access-control.md` |
| **Documented incident response** | Template at `incidents/TEMPLATE.md`; process documented at `policies/incident-response.md`. No incidents to date. Tabletop exercise scheduled for Q4 2026. | `policies/incident-response.md` |
| **Penetration test** | Not yet conducted. Planned before public launch. Will share results with auditors when SOC 2 is pursued. | Roadmap |
| **MDM on laptops** | Not in place. Acceptable while team is one person on a managed-by-owner machine. Required at first hire. | `policies/access-control.md` |
| **Centralized log retention beyond Sentry** | Sentry is set up but retention is bounded by the Sentry plan. No SIEM. Acceptable at current scale. | Roadmap |

---

## 7. SOC 2 stance

Kiddo is **not currently SOC 2 audited.** Pursuing SOC 2 Type 1 from
the current state would take 3-4 months and ~$40-60k all-in (auditor
fees + compliance platform like Vanta/Drata + founder time). Type 2
needs an additional 6-12 months of operating evidence on top.

**We are not pursuing SOC 2 right now.** The customers Kiddo serves
(individual parents) do not request SOC 2 reports. The compliance
pressure that DOES land on a custodial brokerage product (FINRA / SEC
oversight via DriveWealth, COPPA, CSAM scanning, 1099 tax reporting,
state money-transmitter rules where applicable) is more pressing for
our user base and risk surface.

If/when Kiddo pursues SOC 2 (e.g., to enable an enterprise channel
partnership or B2B white-label), this document and the policies in
`policies/` are designed to make the audit lift as small as possible.
The technical control set described in §3 already covers most of the
SOC 2 Trust Services Criteria for Security; the remaining work is
operational rhythm (access reviews, training, vendor reassessments,
risk register) and HR controls (background checks, security training)
that only become relevant at first hire.

---

## 8. Where this document lives

- This file: `SECURITY.md` at the repo root
- Policies: `policies/` directory
- Incident log: `incidents/` directory
- Architecture detail: `ARCHITECTURE.md`
- Product context: `PRODUCT.md`
- Locked memory (design discipline): `C:\Users\dovis\.claude\projects\C--Apps-Kora--newest-\memory\`
