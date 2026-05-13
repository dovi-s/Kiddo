# Information Security Policy

**Owner:** Founder (until a security/compliance owner role exists)
**Last reviewed:** 2026-05-10
**Review cadence:** annual

## 1. Purpose

This policy establishes Kiddo's overarching framework for protecting
the confidentiality, integrity, and availability of customer data and
company systems. It is the parent policy for every other policy in
`policies/`.

## 2. Scope

This policy applies to:

- All systems that store or process customer data (production
  Postgres, file storage, email infrastructure, third-party services
  receiving customer data)
- All people who access those systems (founder today; any future
  employees, contractors, or service-provider personnel)
- All code that runs against production data

## 3. Guiding principles

These are non-negotiable:

1. **The kid at 18 lens applies to security too.** Every security
   decision is evaluated against what the kid sees on their 18th
   birthday. A breach of recipient SSN data would be the most
   destructive thing that could happen to that moment. Security spend
   is justified accordingly.
2. **Honest controls over aspirational controls.** Every control
   described in any policy must reflect what is actually in place.
   Aspirational controls go in the "open items" section, not the
   "controls in place" section. See `SECURITY.md` §6.
3. **Deliberate construction over compliance theater.** SOC 2 and
   similar frameworks are useful only insofar as they describe real
   controls that reduce real risk. We do not pursue compliance for
   appearance.
4. **Defense in depth.** No single control is load-bearing. The
   brokerage layer (DriveWealth) adds a separate authentication
   boundary at money-out; rate limits AND audit logs AND the
   visibility model AND parent review (when shipped) all apply to
   gifter uploads.

## 4. Roles and responsibilities

| Role | Responsibility |
|---|---|
| **Founder** | Today: every role below. Owns the security program, is the named control owner for SOC 2 (if pursued), signs management assertions. |
| **Security/compliance owner** | (When this role exists) — runs access reviews, vendor reassessments, risk register, audits. |
| **Engineering** | Today: founder. Owns code review, secret handling, SDLC controls per `sdlc.md`. |
| **Incident commander** | (When designated for an incident) — owns the incident-response process per `incident-response.md`. Founder by default. |

## 5. Data protection requirements

See `data-classification.md` for the sensitivity tiers and per-tier
handling rules. In summary:

- **Tier 1 (highest sensitivity):** recipient SSN full-form. Encrypted
  at rest. Never returned to the client. Decrypted only in the
  activate-investing path.
- **Tier 2:** authentication credentials, fund balances, gifter
  email/IP. Encrypted in transit. Audit-logged on access.
- **Tier 3:** product analytics events, fund metadata. Encrypted in
  transit; standard access controls.

## 6. Compliance posture

Kiddo is **not currently SOC 2 audited.** See `SECURITY.md` §7 for the
stance and the criteria we'd revisit that decision under.

The compliance regimes that DO apply or will apply when components are
wired:

- **Stripe → PCI DSS SAQ A.** We never touch raw card numbers; Stripe
  manages PCI compliance.
- **DriveWealth (when wired) → FINRA / SEC oversight.** The brokerage
  layer inherits the regulatory framework.
- **COPPA.** Applies to under-13 data. See
  `project_child_safety_architecture.md` in locked memory for the
  Tier 1 launch blockers.
- **18 U.S.C. § 2258A (CSAM reporting).** Applies once public uploads
  reach strangers. Tier 1 launch blocker.
- **Tax / 1099 reporting.** Annual obligations once funds are
  generating reportable income. See
  `project_tax_document_timing_discipline.md` in locked memory.
- **State money-transmitter rules.** Generally delegated to DriveWealth
  but worth periodic review.

## 7. Policy violations

Material violations of any policy in this directory are reviewed by
the founder. Until the engineering org has multiple people, there is
no independent disciplinary process — the founder is accountable to
external auditors and to the regulatory framework.

## 8. Review and updates

- Reviewed annually by the policy owner.
- Revised on material change to the underlying system (new vendor
  category, new data type collected, new compliance regime).
- Version-controlled in git; commit history is the change log.
