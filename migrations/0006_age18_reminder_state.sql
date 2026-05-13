-- Migrate age-18 milestone send-state from JSON file
-- (.local/age18-reminder-state.json) to a queryable Postgres table.
-- Per-fund send tracking; one row per fund. Each milestone column is a
-- timestamp set when the email/event fires; NULL means not-yet-sent.
--
-- Backfill from the JSON file happens at runtime in
-- server/age18TransitionWorker.ts (idempotent ON CONFLICT DO NOTHING
-- insert on worker startup). The JSON file can be deleted manually
-- after the backfill runs successfully in production.

CREATE TABLE IF NOT EXISTS age18_reminder_state (
  fund_id                       VARCHAR PRIMARY KEY REFERENCES funds(id),
  t30_sent_at                   TIMESTAMP,
  t1_sent_at                    TIMESTAMP,
  today_invite_auto_sent_at     TIMESTAMP,
  today_parent_email_sent_at    TIMESTAMP,
  updated_at                    TIMESTAMP DEFAULT NOW()
);
