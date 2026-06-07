-- 0042: previous-owner access revocation (T&S adult-autonomy, 2026-06-07).
--
-- After the at-18 handoff, the former custodian (previousOwnerId) keeps a
-- permanent read-only window into the now-adult owner's fund. Warm default,
-- right for most families -- but it was IRREVOCABLE: an estranged or
-- controlling parent became a permanent observer on an adult's financial
-- account (coercive-control vector; the adult-autonomy sibling of the
-- child-privacy findings). This column lets the OWNER close that window.
--
-- A timestamp (not a destructive NULL on previous_owner_id) so the custodial
-- attribution record survives: who managed a kid's money for 18 years is
-- audit/compliance history that must not be erasable from the row itself.
-- NULL = access active (default, unchanged behavior). Non-null = revoked at
-- that moment; the access middleware and the previously-owned funds list
-- both gate on it.
--
-- Idempotent (IF NOT EXISTS) per the hand-written-migrations discipline.

ALTER TABLE funds ADD COLUMN IF NOT EXISTS previous_owner_access_revoked_at timestamp;
