# Data Classification Policy

**Owner:** Founder
**Last reviewed:** 2026-05-10
**Review cadence:** annual; reviewed on every new data field added

## 1. Purpose

Establishes the sensitivity tiers for data Kiddo holds, and the
handling rules that apply to each tier.

## 2. Tiers

### Tier 1 — Highest sensitivity

Data whose breach would constitute material legal, regulatory, or
trust-shattering harm.

- Recipient SSN (full form)
- Authentication password hashes (already irreversible by design;
  treated as Tier 1 for handling)
- Stripe customer IDs combined with bank account references
  (when DriveWealth integration adds these)
- DriveWealth account credentials and tokens (when wired)
- Encryption keys for any Tier 1 data

**Handling:**
- Encrypted at rest using application-layer encryption (not just
  database encryption — the application must decrypt with a
  separately-managed key)
- Never returned to the client API surface
- Decrypted only at the moment of use
- Read access audit-logged on every access
- Never logged to console, never sent to Sentry, never sent to any
  third-party service
- Never copied to staging/development databases
- Excluded from analytics_events props by policy

### Tier 2 — High sensitivity

Personally identifiable data, financial state, child identity.

- User email, password hash (Tier 1 handling but Tier 2 access
  controls)
- Recipient SSN last-4
- Recipient first name, last name, birthdate
- Fund balance, holdings, transactions
- Gifter email, IP address, user agent on uploads
- Memory entry content (notes, photos, videos, voice)

**Handling:**
- Encrypted in transit (TLS)
- Encrypted at rest (Postgres TDE via Supabase)
- Access gated by `isAuthenticated` + per-fund ownership check
- Audit-logged on access via `audit_logs` table for sensitive
  operations
- May appear in error logs only with PII scrubbed (Sentry config
  must scrub email, name, SSN-shaped strings)
- Customer can request deletion per `SECURITY.md` §5

### Tier 3 — Standard sensitivity

Operational data with low individual sensitivity but aggregate value.

- Product analytics events (event name, fund_id, user_id, props)
- Fund metadata (name, slug, gift code)
- Public memory entries explicitly marked public
- Activity log entries
- Webhook event records

**Handling:**
- Encrypted in transit (TLS)
- Encrypted at rest (Postgres TDE via Supabase)
- Access gated by ownership where applicable; aggregate read for
  admin analytics
- Standard application logging applies

### Tier 4 — Public

Data we publish or that has no individual identification value.

- Stock price quotes (sourced from Yahoo Finance)
- Public marketing copy
- Aggregate North-Star metrics (fund counts, conversion rates) when
  fully anonymized

**Handling:**
- No special controls required
- Verify nothing in higher tiers leaks into a Tier 4 surface

## 3. Data flow examples

### Gifter sends a $50 gift with a note + photo

| Step | Data | Tier | Where |
|---|---|---|---|
| Gifter form submission | Email, name, message, IP, photo | Tier 2 | HTTPS to Express, then to Postgres `gifts` and `memory_entries` |
| Stripe checkout | Email, amount | Tier 2 | HTTPS to Stripe |
| Webhook receipt | Payment intent + metadata | Tier 2 | Stripe → Express; signature verified |
| Activity log | Event details | Tier 3 | `activities` table |
| Analytics event | Name, fund_id, amount, source | Tier 3 | `analytics_events` table |

### Parent activates the fund (recipient SSN collection)

| Step | Data | Tier | Where |
|---|---|---|---|
| Parent enters full SSN | SSN string in plaintext (TLS) | Tier 1 in flight | HTTPS to Express |
| Express encrypts | SSN ciphertext | Tier 1 at rest | `funds.recipient_ssn_full_encrypted` |
| Audit log | "ssn_collected" event | Tier 3 | `audit_logs` |
| Future read at activation | SSN plaintext in memory only | Tier 1 | DriveWealth API call (when wired) |

## 4. Adding a new data field

When adding a new column or table:

1. Classify it per the tiers above.
2. Apply the handling rules.
3. Update this policy with the new field if it represents a new
   category.
4. If Tier 1 or Tier 2, update `SECURITY.md` §2 (threat model) to
   reflect the new attack surface.

## 5. Open items

- ~~Formal PII scrubbing configuration in Sentry~~ — **DONE 2026-06-10.**
  `client/src/lib/observability.ts` now sets `sendDefaultPii: false` and runs a
  `beforeSend` + `beforeBreadcrumb` that redact query strings, UUIDs, and long
  opaque tokens from URLs, messages, and exception text. Safe-by-default before the
  DSN is ever enabled. See `policies/child-data-protection.md` §3.
- Automated detection for Tier 1 data appearing in Tier 3 logs (e.g.,
  SSN-shaped patterns in `analytics_events` props). Partial mitigation: the
  account-deletion worker now nulls `analytics_events` props on deletion.
