-- Founding Members table. Graduates the JSONL flat-file capture surface
-- (.local/founding-members.jsonl) into a real Postgres table with the
-- right constraints. Per project_founding_member_claim_flow_spec.md
-- Day 1 (locked 2026-05-26).
--
-- Why this matters:
--   - 1,000-cap was previously enforced via line-counting a .local file.
--     Two concurrent submits could both pass the count check before
--     either appended; the cap could be exceeded by N concurrent requests.
--     Postgres unique constraint on `position` makes the race impossible:
--     two simultaneous inserts at position 47 → one wins, the other
--     errors and retries with position 48.
--   - Email dedupe was a linear scan of the JSONL. Now enforced at the
--     DB layer via unique index.
--   - The launch claim flow (Days 2-5 of the spec) joins these rows to
--     users.id via `claimed_user_id`. With JSONL there was no clean way
--     to do that join; with a table it's a one-liner.
--   - .local/* files reset across deploys on some hosting platforms;
--     Postgres survives.
--
-- The JSONL file stays in place as an append-only audit log — every
-- successful signup ALSO appends to it. Not the source of truth, just
-- the forensic trail. Backfill of existing JSONL rows into this table
-- is handled by the application on first request (countFoundingMembers
-- + the POST endpoint do a one-time hydrate when the table is empty).
-- This avoids a separate backfill script + lets the migration ship
-- without coordination.
--
-- Claim columns are present from Day 1 even though the claim flow
-- itself doesn't fire until Days 2-5. Adding them now means founders
-- who sign up before the claim flow ships simply have NULL claim
-- columns until they redeem; no second migration needed.

CREATE TABLE IF NOT EXISTS founding_members (
  id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
  email text NOT NULL,
  first_name text NOT NULL,
  position integer NOT NULL,
  signup_message text,
  source_surface text NOT NULL,
  signup_at timestamp NOT NULL DEFAULT NOW(),
  -- Claim state — NULL until the launch claim flow fires.
  claim_token varchar(64),
  claimed_at timestamp,
  claimed_user_id varchar REFERENCES users(id) ON DELETE SET NULL,
  -- Gifted-slot tracking. Direct signups have both NULL; recipients
  -- of a gifted Founder slot have sponsor email + Stripe session id.
  gifted_by text,
  gifted_stripe_session_id text
);

-- Email dedupe: enforced at the DB layer. The POST endpoint can still
-- do an application-level pre-check for the friendlier response shape
-- (returns existing position rather than a 409), but the DB is the
-- canonical defense against concurrent submits.
CREATE UNIQUE INDEX IF NOT EXISTS founding_members_email_unique ON founding_members(email);

-- Position dedupe: makes the 1,000-cap race-safe. Two concurrent
-- INSERTs at the same computed position → only one succeeds.
CREATE UNIQUE INDEX IF NOT EXISTS founding_members_position_unique ON founding_members(position);

-- Lookup index for claim-flow joins (Days 2-5 of the spec): given a
-- user, did they claim a Founder slot?
CREATE INDEX IF NOT EXISTS founding_members_claimed_user_id_idx ON founding_members(claimed_user_id);
