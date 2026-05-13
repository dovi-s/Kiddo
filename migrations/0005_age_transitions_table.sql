-- Migrate age-transition state from JSON file (.local/age-transition-flows.json)
-- to a queryable Postgres table. Per-fund state; one row per fund.
--
-- Backfill from the JSON file happens at runtime in
-- server/ageTransitionStore.ts (idempotent ON CONFLICT DO NOTHING insert
-- on first call). The JSON file can be deleted manually after the
-- backfill runs successfully in production.

CREATE TABLE IF NOT EXISTS age_transitions (
  fund_id                            VARCHAR PRIMARY KEY REFERENCES funds(id),
  child_email                        TEXT,
  parent_message                     TEXT,
  preview_token                      TEXT,
  preview_prepared_at                TIMESTAMP,
  preview_viewed_at                  TIMESTAMP,
  invite_token                       TEXT,
  invited_at                         TIMESTAMP,
  invite_viewed_at                   TIMESTAMP,
  child_claimed_at                   TIMESTAMP,
  child_claimed_by_user_id           VARCHAR REFERENCES users(id),
  handoff_requested_at               TIMESTAMP,
  ownership_transferred_at           TIMESTAMP,
  ownership_transferred_by_user_id   VARCHAR REFERENCES users(id),
  former_custodian_user_id           VARCHAR REFERENCES users(id),
  -- Verification gate — see project_age18_handoff_lifecycle_automatic.md
  child_email_verification_token     TEXT,
  child_email_verification_sent_at   TIMESTAMP,
  child_email_verified_at            TIMESTAMP,
  updated_at                         TIMESTAMP DEFAULT NOW()
);

-- Token lookups need to be fast: the public verify endpoint and the
-- transition-link routes search by token. Without these indexes the
-- public endpoint would do a full-table scan on every kid click.
CREATE INDEX IF NOT EXISTS age_transitions_invite_token_idx
  ON age_transitions(invite_token)
  WHERE invite_token IS NOT NULL;

CREATE INDEX IF NOT EXISTS age_transitions_preview_token_idx
  ON age_transitions(preview_token)
  WHERE preview_token IS NOT NULL;

CREATE INDEX IF NOT EXISTS age_transitions_verification_token_idx
  ON age_transitions(child_email_verification_token)
  WHERE child_email_verification_token IS NOT NULL;
