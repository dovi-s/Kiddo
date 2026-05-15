-- Migration: gift_intents.gifter_reminder_sent_at column.
--
-- Anchors the gifter heads-up that fires ~10 days before an intent
-- expires (60-day total lifecycle). Without this column the worker
-- would re-email the gifter every tick within the expiry window.
--
-- See server/giftIntentExpiryWorker.ts for the worker that uses it.
-- The column is independent from the existing last_reminder_at
-- column (which was reserved for parent-side reminder cadences
-- that haven't shipped) so the two timelines can evolve separately.

ALTER TABLE gift_intents
  ADD COLUMN IF NOT EXISTS gifter_reminder_sent_at TIMESTAMP NULL;

-- Partial index over the worker's eligibility set: intents that are
-- still pending AND have not yet had their gifter reminder sent.
-- The worker query is "WHERE status='pending' AND
-- gifter_reminder_sent_at IS NULL AND expires_at BETWEEN now+1day
-- AND now+10days" — this index covers the gifter_reminder_sent_at
-- IS NULL portion cheaply.
CREATE INDEX IF NOT EXISTS idx_gift_intents_reminder_due
  ON gift_intents (expires_at)
  WHERE status = 'pending' AND gifter_reminder_sent_at IS NULL;
