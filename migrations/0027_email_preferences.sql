-- Migration: users.email_preferences column.
--
-- Per-category email opt-outs. Backs the Settings → Notifications →
-- Email preferences UI. Workers that send OPTIONAL emails (birthday,
-- anniversary, kid milestones, monthly pulse, volatility, holiday
-- warmth, etc.) check this map before sending. REQUIRED categories
-- (password reset, verification, new-device alert, large-gift
-- alert, age-transition emails, gift receipts) ignore it — they're
-- transactional and always send.
--
-- Default NULL (treated as 'all categories opted in'). Setting a
-- specific category to false in the JSON opts out of that category
-- only.

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS email_preferences JSONB;
