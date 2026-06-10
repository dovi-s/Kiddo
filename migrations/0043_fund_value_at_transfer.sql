-- 0043: fund value-at-transfer keepsake snapshot (post-handoff parent view, 2026-06-09).
--
-- After the at-18 handoff the fund is the now-adult's private financial account.
-- Previously the former custodian's (parent's) view-only surface showed the
-- now-adult's LIVE balance — which kept updating with the adult's own activity,
-- so a parent watched their grown child's real-time finances by default. The
-- honest, autonomy-respecting design freezes the parent's view to a KEEPSAKE:
-- "what you handed them on {date}" — the fund's value at the moment of handoff.
--
-- This column stores that frozen value, captured ONCE when ownership flips, in
-- BOTH handoff doors (routes.ts age-transition complete + auth.ts kid-view
-- claim-account — the two paths must stay in sync). NULL = not transferred, or
-- a legacy transfer predating this column (the view falls back to a clearly
-- labeled live value). Decimal(12,2) to mirror funds.balance.
--
-- Idempotent (IF NOT EXISTS) per the hand-written-migrations discipline.
-- NOTE: journal entry intentionally deferred — a parallel session held the
-- migration channel (0041_fund_memorialized_at) when this shipped, so the
-- column was applied to dev directly and this file staged. Add the
-- meta/_journal.json entry (next free idx + this tag) once 0041 lands, so the
-- two sessions don't claim the same idx.

ALTER TABLE funds ADD COLUMN IF NOT EXISTS value_at_transfer numeric(12,2);

-- Phase 2 of the keepsake: the now-adult can opt to let the previous owner see
-- the fund LIVE again (vs the frozen keepsake default). NULL = keepsake; non-null
-- = live granted at that moment. Freely reversible by the owner (a visibility
-- preference, distinct from the one-way safety revoke). Idempotent.
ALTER TABLE funds ADD COLUMN IF NOT EXISTS previous_owner_live_access_granted_at timestamp;
