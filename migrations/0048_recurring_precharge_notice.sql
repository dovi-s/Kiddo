-- Pre-charge heads-up email (founder-approved 2026-06-12). A few days before
-- each HEALTHY recurring charge, the worker emails a calm "we're about to charge
-- you on {date}, nothing to do, change or cancel anytime" notice -- the
-- transparency-bias trust lever (Cal AI / Blinkist: stating exactly when you
-- charge raises conversion and cuts complaints). Covers both charging systems:
-- gifter recurring (recurring_gifts, Stripe-billed) and parent auto-invest
-- (parent_contributions, worker-charged).
--
-- Dedup is EXACT: we stamp the charge date we last sent a notice for. A row
-- sends once per cycle; when its next charge date advances, the stamp differs
-- and it re-qualifies. Nullable; legacy rows simply get their next notice on the
-- next cycle. Idempotent -- re-running is safe.
ALTER TABLE recurring_gifts ADD COLUMN IF NOT EXISTS precharge_notice_for_date timestamp;
ALTER TABLE parent_contributions ADD COLUMN IF NOT EXISTS precharge_notice_for_date timestamp;
