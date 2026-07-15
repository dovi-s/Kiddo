-- 0047: funds.memorialized_at — the bereavement / memorial freeze (2026-06-11).
--
-- Set by a HUMAN on a confirmed loss (a child's death, or a family death). NULL =
-- active; non-null = memorialized. When set, ALL automated communications and
-- charges for the fund must go silent — the charge paths and the email-delivery
-- chokepoint hard-gate on this column, fail-closed. NEVER set by automation, and
-- reversible (so a set-in-error can be undone). See BEREAVEMENT_POSTURE.md.
--
-- Idempotent (IF NOT EXISTS): a separate un-journaled 0041 also adds this column;
-- whichever applies first wins, the other is a no-op. This one is journaled so the
-- column ships to prod regardless.

ALTER TABLE funds ADD COLUMN IF NOT EXISTS memorialized_at timestamp;
