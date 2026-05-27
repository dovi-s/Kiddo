-- One gift row per Stripe PaymentIntent (double-credit race fix).
-- Gift settlement has three entry points (the verified webhook + two
-- unauthenticated session endpoints + the authenticated reconcile loop) that
-- dedup by read-then-insert — a check-then-act race that can credit a fund
-- twice for a single payment when, e.g., the GiftSuccess poller races the
-- webhook. This partial-unique index makes the second insert fail, so the
-- fund is credited exactly once. Partial (WHERE NOT NULL) so the many gift
-- rows with no PaymentIntent (seed / cash-parked / legacy) don't collide on
-- NULL. Hand-written to match the repo's existing migration pattern.
CREATE UNIQUE INDEX IF NOT EXISTS "gifts_stripe_payment_intent_id_unique"
  ON "gifts" ("stripe_payment_intent_id")
  WHERE "stripe_payment_intent_id" IS NOT NULL;
