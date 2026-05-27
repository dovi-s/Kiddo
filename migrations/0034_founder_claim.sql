-- Founder claim-flow foundation. Per project_founding_member_claim_flow_spec.md
-- Days 2-3 (decisions locked 2026-05-26: magic-link passwordless claim; $19/yr
-- Plus + $59/yr Family lifetime lock). Adds two columns the claim flow needs:
--
--   1. users.founder_tier — the entitlement flag. NULL for everyone except the
--      <=1,000 founders who claim their slot. 'plus_founder' locks the $19/yr
--      Plus price for life, surfaces the Founding Member badge, and flags the
--      user into every future product's early-access cohort. Set by
--      completeFounderClaim() in server/services/founderClaimAuth.ts; read by
--      the locked-price lookup in stripeService + the badge render sites.
--
--   2. founding_members.claim_token_expires_at — 30-day TTL for the claim
--      token. The token HASH already lives in founding_members.claim_token
--      (migration 0033); this adds the expiry that verify/complete check. TTL
--      is long (vs magic-link's 15 min) because founders may act on the launch
--      email days later.
--
-- Both use ADD COLUMN IF NOT EXISTS so the migration is idempotent and safe to
-- re-run. No backfill needed: existing founders get NULL claim_token_expires_at
-- until a token is issued; existing users get NULL founder_tier (correct — they
-- aren't founders).

ALTER TABLE users ADD COLUMN IF NOT EXISTS founder_tier text;
ALTER TABLE founding_members ADD COLUMN IF NOT EXISTS claim_token_expires_at timestamp;
