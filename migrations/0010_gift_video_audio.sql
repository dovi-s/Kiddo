-- Mirror video and audio URLs onto the gifts row, alongside the
-- existing photo_url column. Before this migration, the gifter flow
-- captured video and voice but persisted them ONLY in the Stripe
-- checkout session metadata; the Memory Book entry for the gift was
-- created from that metadata when payment_intent.succeeded fired.
--
-- Why that was fragile: a Stripe metadata field has a 500-character
-- per-value limit. URLs that fit today (relative /uploads/... paths
-- or short Supabase Storage URLs) leave headroom, but any future
-- shape (longer signed URLs, vendor switch) could silently truncate.
-- More importantly, if the webhook ever failed to land in time or
-- the gift had to be reconstructed later, the URLs were unrecoverable.
--
-- With these columns present, video and audio are first-class fields
-- on the gift row. ensureMemoryEntryForGift reads from the gift row
-- first, falling back to Stripe metadata for legacy gifts that
-- pre-date this migration. Forward-only — no backfill possible
-- because the URLs were never persisted to our DB before.

ALTER TABLE gifts ADD COLUMN IF NOT EXISTS video_url TEXT;
ALTER TABLE gifts ADD COLUMN IF NOT EXISTS audio_url TEXT;
