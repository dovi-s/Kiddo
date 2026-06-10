-- 0045: fund value-at-transfer keepsake snapshot + previous-owner live-access
-- opt-in (post-handoff parent view, 2026-06-09).
--
-- After the at-18 handoff the fund is the now-adult's private financial account.
-- Previously the former custodian's (parent's) view-only surface showed the
-- now-adult's LIVE balance — which kept updating with the adult's own activity,
-- so a parent watched their grown child's real-time finances by default. The
-- honest, autonomy-respecting design freezes the parent's view to a KEEPSAKE:
-- "what you handed them on {date}" — the fund's value at the moment of handoff.
--
-- value_at_transfer stores that frozen value, captured ONCE when ownership flips,
-- in BOTH handoff doors (routes.ts age-transition complete + auth.ts kid-view
-- claim-account — the two paths must stay in sync). NULL = not transferred, or a
-- legacy transfer predating this column (the view falls back to a clearly labeled
-- live value). Decimal(12,2) to mirror funds.balance.
--
-- previous_owner_live_access_granted_at lets the now-adult OPT the previous owner
-- back into the live fund (vs the frozen keepsake default), reversibly. NULL =
-- keepsake; non-null = live granted at that moment. Distinct from the one-way
-- safety revoke in previous_owner_access_revoked_at.
--
-- Idempotent (IF NOT EXISTS) per the hand-written-migrations discipline.
-- Renumbered 0043 -> 0045 on journaling: concurrent sessions claimed 0043
-- (drop_lesson_tag) and 0044 (stock_requests) while these columns were staged +
-- applied to dev directly, so this takes the next free slot.

ALTER TABLE funds ADD COLUMN IF NOT EXISTS value_at_transfer numeric(12,2);

-- Phase 2 of the keepsake: the now-adult can opt to let the previous owner see
-- the fund LIVE again (vs the frozen keepsake default). NULL = keepsake; non-null
-- = live granted at that moment. Freely reversible by the owner (a visibility
-- preference, distinct from the one-way safety revoke). Idempotent.
ALTER TABLE funds ADD COLUMN IF NOT EXISTS previous_owner_live_access_granted_at timestamp;
