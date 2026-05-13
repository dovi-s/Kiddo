# Vendor Management Policy

**Owner:** Founder
**Last reviewed:** 2026-05-10
**Review cadence:** annual; vendor reassessment annual per vendor

## 1. Purpose

Ensures every third party that touches customer data or is critical to
Kiddo's availability is intentional, documented, and periodically
reassessed.

## 2. Vendor inventory

The authoritative inventory lives in `SECURITY.md` §4. Summary:

| Vendor | Purpose | Data shared | Compliance posture |
|---|---|---|---|
| Supabase | Production Postgres | All user data | SOC 2 Type 2 |
| Stripe | Payments + subscriptions | Email, name, payment metadata | SOC 1 + 2 + PCI-DSS L1 |
| DriveWealth | UTMA brokerage (scaffolded) | Will share KYC, SSN | SOC 1 + 2 + FINRA member |
| Resend / SES | Transactional email | Email, name | SOC 2 Type 2 |
| Anthropic | AI tooling for engineering | None — code generation only | SOC 2 Type 2 |
| GitHub | Source hosting | Source only | SOC 1 + 2 |
| Sentry (when DSN set) | Error tracking | Stack traces with PII scrubbing | SOC 2 Type 2 |
| Yahoo Finance | Stock quotes | None outbound | N/A — public data |

## 3. Adding a new vendor

Before any new vendor is added to production:

1. **Document the use case.** What does this vendor do? Why this
   vendor over alternatives? What data crosses the boundary?
2. **Compliance check.** Does the vendor have a current SOC 2 (or
   equivalent)? Read the report. If they don't have one, the use case
   has to justify the gap.
3. **Data minimization.** Configure the integration to share only the
   minimum data needed. No PII to vendors that don't need it.
4. **Sub-processors.** Read the vendor's sub-processor list. They count
   as our sub-processors too.
5. **Update SECURITY.md and this policy.**
6. **Founder sign-off** (in PR or commit message that adds the
   integration).

## 4. Annual reassessment

Once per calendar year, for every vendor in the inventory:

1. Confirm the SOC 2 report is current (within 12 months of issuance).
   Download the latest. Skim the auditor opinion.
2. Confirm the data scope hasn't changed.
3. Confirm the vendor still has the right roles/permissions on our
   side (e.g., if Stripe API keys exist that we no longer use,
   rotate or revoke).
4. Note any vendor-side incident in the past year that affected our
   users.
5. Document the review in `incidents/vendor-reviews/YYYY-vendor.md`.

## 5. Vendor offboarding

When discontinuing a vendor:

1. Migrate or export any data Kiddo needs to retain.
2. Request data deletion from the vendor (in writing — keep the
   request and the response).
3. Revoke API keys, webhook endpoints, OAuth grants.
4. Remove the vendor from `SECURITY.md` §4 and from this inventory.
5. Document the offboarding alongside the vendor review file.

## 6. Sub-processor changes

Vendors notify us of new sub-processors. When that notification
arrives:

1. Review the sub-processor's role in handling our data.
2. If the sub-processor handles Tier 1 or Tier 2 data (per
   `data-classification.md`), assess their compliance posture.
3. If acceptable, update the vendor's row in `SECURITY.md` §4 to note
   the new sub-processor in the next review cycle.

## 7. Vendor-side incidents

If a vendor reports a security incident affecting their service:

1. Determine whether Kiddo data was affected.
2. If yes, treat it as a Kiddo incident per `incident-response.md`.
3. If no, log it in the next vendor review.

## 8. Open items

- Formal vendor questionnaire (CAIQ-Lite or similar) for non-SOC-2
  vendors. Today the inventory is small enough that this is not
  needed; revisit at vendor count > 15.
- Automated SOC 2 expiration tracking. Today this is calendar-managed.
