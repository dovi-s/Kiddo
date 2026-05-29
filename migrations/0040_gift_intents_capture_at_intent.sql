-- P0-1 "capture money at intent" (Option C: vault-and-charge-later).
-- Additive, idempotent. INERT until the GIFTER_CAPTURE_AT_INTENT flag is
-- enabled AND counsel clears the gates in LAWYER_Q_HOLDING_GIFT_FUNDS.md.
-- See P0-1_ADVISORY_PANEL_DECISION.md. We never hold funds — SetupIntent saves
-- the gifter's card at intent, off-session charge fires at pairing.

ALTER TABLE "gift_intents" ADD COLUMN IF NOT EXISTS "payment_status" text NOT NULL DEFAULT 'none';
ALTER TABLE "gift_intents" ADD COLUMN IF NOT EXISTS "stripe_setup_intent_id" text;
ALTER TABLE "gift_intents" ADD COLUMN IF NOT EXISTS "stripe_customer_id" text;
ALTER TABLE "gift_intents" ADD COLUMN IF NOT EXISTS "charged_at" timestamp;
ALTER TABLE "gift_intents" ADD COLUMN IF NOT EXISTS "settled_gift_id" varchar;
ALTER TABLE "gift_intents" ADD COLUMN IF NOT EXISTS "failed_charge_count" integer NOT NULL DEFAULT 0;

DO $$ BEGIN
  ALTER TABLE "gift_intents"
    ADD CONSTRAINT "gift_intents_settled_gift_id_gifts_id_fk"
    FOREIGN KEY ("settled_gift_id") REFERENCES "gifts"("id");
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
