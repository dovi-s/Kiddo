-- Migration: sponsored_subscriptions table — gifter-sponsored Plus / Family
-- on a fund (Prong B of pricing-v3 conversion architecture, locked
-- 2026-05-23 in project_gifter_sponsors_plus_subscription.md).
--
-- A gifter (grandparent, baby-shower attendee, generous friend) can
-- purchase a year of Plus ($29) or Family ($59) for the parent's
-- fund. This is a one-time annual payment that activates 12 months
-- of plan benefits on the fund. Renewal is NOT automatic — at month
-- 11 the parent gets a soft-conversion reminder to start direct
-- billing. The gifter's card-on-file is never re-charged.
--
-- Why this table and not extending fund_memberships:
--
--   fund_memberships represents a customer's own Stripe subscription
--   (recurring billing relationship with a Stripe Subscription ID).
--   Sponsored subs are fundamentally different: one-time Stripe
--   payment, no recurring billing relationship, no customer-side
--   subscription object to manage. Modeling them as fund_memberships
--   would overload the table with optional sponsor fields and confuse
--   the existing subscription lifecycle logic. Separate table keeps
--   each concern clean.
--
-- Why activated_at + expires_at as columns vs. computing from
-- created_at + a constant:
--
--   The 12-month window is the v1 default but could change per-tier
--   in the future (e.g., Founder gifting → lifetime). Explicit
--   activated_at + expires_at columns make per-row durations
--   tunable without schema changes.
--
-- Status enum semantics:
--
--   'active'   → currently providing plan benefits on the fund
--   'expired'  → past expires_at; cleared via lazy check in coverage
--                helper OR via future cleanup worker
--   'refunded' → Stripe refund issued within 30-day window; benefits
--                immediately revoked
--
-- Coverage state interaction:
--
--   The new helper hasActiveSponsorshipForFund(fundId) in
--   server/services/monetization.ts checks for active+unexpired
--   rows. It's OR'd into the existing getFundCoverageState logic
--   so a sponsored fund returns covered_starter (or covered_family)
--   alongside direct subscriptions and trials. The parent's UI
--   shows the source ("Plus from Grandma") but the coverage
--   mechanic is identical.
--
-- Stacking guard:
--
--   The endpoint POST /api/funds/:fundId/sponsor-plus checks for an
--   existing active row before allowing a new purchase. UNIQUE index
--   over (fund_id, status='active') is the SQL-level guard but
--   Postgres partial unique indexes are the right tool. Implemented
--   below.

CREATE TABLE IF NOT EXISTS sponsored_subscriptions (
  id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
  fund_id VARCHAR NOT NULL REFERENCES funds(id),
  sponsor_email TEXT NOT NULL,
  sponsor_name TEXT,
  tier TEXT NOT NULL CHECK (tier IN ('starter', 'family')),
  activated_at TIMESTAMP NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMP NOT NULL,
  stripe_session_id TEXT UNIQUE,
  stripe_payment_intent_id TEXT,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'expired', 'refunded')),
  created_at TIMESTAMP DEFAULT NOW()
);

-- Stacking guard at the SQL level: at most one ACTIVE row per fund.
-- Application-level guard ALSO checks this in the endpoint, but the
-- unique partial index is the belt-and-suspenders defense against
-- race conditions or webhook double-fires.
CREATE UNIQUE INDEX IF NOT EXISTS idx_sponsored_subscriptions_active_per_fund
  ON sponsored_subscriptions (fund_id)
  WHERE status = 'active';

-- Coverage-state query path: getFundCoverageState calls
-- hasActiveSponsorshipForFund(fundId) which filters on
-- (fund_id, status='active', expires_at > NOW()). Index for that.
CREATE INDEX IF NOT EXISTS idx_sponsored_subscriptions_fund_active
  ON sponsored_subscriptions (fund_id, expires_at)
  WHERE status = 'active';

-- Sponsor email index for the renewal-reminder worker (deferred to
-- post-MVP follow-on) which will query by upcoming expires_at and
-- email the parent (NOT the sponsor — gifter doesn't get a renewal
-- nudge per the locked "no gifter chargeback risk" discipline).
CREATE INDEX IF NOT EXISTS idx_sponsored_subscriptions_sponsor_email
  ON sponsored_subscriptions (sponsor_email);

COMMENT ON TABLE sponsored_subscriptions IS 'Gifter-sponsored Plus/Family on a fund. One-time annual payment, soft-conversion to parent-paid at month 11. Per project_gifter_sponsors_plus_subscription.md.';
