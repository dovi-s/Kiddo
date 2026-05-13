# Access Control Policy

**Owner:** Founder
**Last reviewed:** 2026-05-10
**Review cadence:** annual; access reviews quarterly

## 1. Purpose

Defines who gets access to what systems, how access is granted and
revoked, and how we periodically verify that the access list still
matches reality.

## 2. Principles

1. **Least privilege.** Every account has the minimum access needed
   for its role.
2. **Separation of duties** where the population permits it. With one
   person today, this is not enforceable; it becomes operational at
   first hire.
3. **MFA where available.** Required for production-touching systems
   (Supabase admin, Stripe dashboard, DriveWealth admin when wired,
   GitHub, domain registrar, email provider). Verified annually.
4. **Time-bound elevated access.** Engineering does not run as
   super-admin in normal operation. The super-admin role is used only
   for explicit administrative tasks.

## 3. System access matrix

| System | Who has access | MFA | Review cadence |
|---|---|---|---|
| Supabase production | Founder | Required | Quarterly |
| Stripe production dashboard | Founder | Required | Quarterly |
| DriveWealth (when wired) | Founder | Required | Quarterly |
| GitHub repo | Founder | Required | Quarterly |
| Domain registrar | Founder | Required | Annually |
| Email provider (Resend / SES) | Founder | Required | Quarterly |
| Sentry (when DSN set) | Founder | Required | Quarterly |
| Production environment variables | Founder via host platform | Required | Quarterly |

When the team grows past one, this matrix is updated within 5 business
days of each change.

## 4. Account lifecycle

### Onboarding (when first hire happens)

1. Background check completed and reviewed.
2. Signed confidentiality agreement on file.
3. Account creation in each system from the matrix above, with the
   minimum role appropriate to the function.
4. MFA enrollment verified.
5. Security training completion before any production access.
6. Onboarding entry recorded in HR runbook with date and access
   granted.

### Offboarding

When any person leaves (employee, contractor, founder departure):

1. Same-day revocation of access to every system in the matrix.
2. Rotation of any shared secret the person had access to (API keys,
   webhook secrets, database admin credentials).
3. Removal from any group/distribution list.
4. Recovery of company hardware if applicable.
5. Offboarding checklist signed off by the security/compliance owner
   (founder today).
6. Access-revocation evidence stored for 7 years.

### Internal role change

Treated as offboarding-from-old-role + onboarding-to-new-role. Audit
the access matrix; remove access no longer needed.

## 5. Quarterly access review

Run end of each calendar quarter. Evidence retained for 7 years.

1. Open Admin → Access Review (`/admin?tab=access-review`). The page
   lists every admin/super-admin user with last login, last admin
   action timestamp, and a "needs review" flag for inactive accounts.
2. For each account flagged "needs review" or with no admin activity
   in 90 days: confirm whether the account should retain admin access.
3. For each account: confirm MFA is enabled (manual verification in
   the relevant system; the platform doesn't always expose this).
4. Cross-check against the system matrix in §3. Any account in either
   list and not the other is a finding.
5. Save a screenshot or export of the Access Review page to
   `incidents/access-reviews/YYYY-Q#.md` with notes on findings and
   actions taken.
6. Tag the file with the quarter (e.g., `2026-Q3.md`).

## 6. Privileged access

The super-admin email allowlist is configured via
`getConfiguredSuperAdminEmails()` in `server/auth.ts`. Changes to this
list:

1. Require explicit code change in git (no runtime UI for it).
2. PR description must state the business justification.
3. Reviewed by the founder before merge (today: self-reviewed, which
   is a known limitation; first hire changes this).

## 7. Customer data access

Engineering does not query the production database for individual
customer records ad-hoc unless:

1. A customer has explicitly requested support that requires it
   (e.g., they reported a missing gift), AND
2. The query is logged in `audit_logs` via the relevant route
   (sensitive data access is audit-logged automatically).

Direct DB access for ad-hoc analytics should use read-only credentials
and aggregate queries only. Production credentials are not shared with
analytics tools.

## 8. Emergency access

If a critical incident requires elevated access outside normal
process:

1. Document the action taken in `incidents/YYYY-MM-DD-shortname.md`
   per the incident-response policy.
2. Note the elevated access in §3 of the incident report.
3. Revert to baseline access immediately after.

## 9. Open items

- MFA for parent end-user accounts (TOTP) — on roadmap, not yet
  implemented.
- Automated periodic export of access state to an immutable log — not
  yet wired. Today the Admin → Access Review surface is queried on
  demand.
