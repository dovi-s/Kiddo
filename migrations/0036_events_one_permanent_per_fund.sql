-- One permanent "Gift anytime" event per fund. ensurePermanentEventForFund
-- (server/routes.ts) does a non-atomic check-then-create, so two concurrent
-- fund accesses could each insert one, producing duplicate "Gift anytime"
-- occasions. This collapses any existing duplicates to the earliest per fund,
-- then enforces one-per-fund with a partial unique index (the helper now
-- swallows the 23505 conflict).
--
-- Permanent-event stats are computed from eventId-IS-NULL gifts (gifts are
-- NOT FK-linked to it), so removing a duplicate doesn't orphan gifts. We only
-- null any referral_events pointing at a removed duplicate first, since that
-- FK has no cascade.
UPDATE referral_events SET event_id = NULL WHERE event_id IN (
  SELECT id FROM (
    SELECT id, ROW_NUMBER() OVER (PARTITION BY fund_id ORDER BY created_at, id) AS rn
    FROM events WHERE is_permanent = true
  ) r WHERE r.rn > 1
);
--> statement-breakpoint
DELETE FROM events WHERE id IN (
  SELECT id FROM (
    SELECT id, ROW_NUMBER() OVER (PARTITION BY fund_id ORDER BY created_at, id) AS rn
    FROM events WHERE is_permanent = true
  ) r WHERE r.rn > 1
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "events_one_permanent_per_fund"
  ON "events" ("fund_id") WHERE "is_permanent" = true;
