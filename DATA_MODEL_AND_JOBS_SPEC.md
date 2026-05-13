# Kado Data Model And Jobs Spec

Updated: 2026-04-03

This document translates the idealized Kado schema into the practical version that fits the current repo.

The repo already has real foundations:
- `users`
- `funds`
- `events`
- `gifts`
- `memory_entries`
- `subscriptions`
- `fund_memberships`
- `transactions`
- `bank_accounts`
- `thank_yous`
- `recurring_gifts`
- `referral_events`
- `webhook_events`
- `audit_logs`

It also already has real job-like behavior:
- Stripe webhook processing
- gifter notification worker
- reverse trial state handling
- age-18 planning and transfer surfaces
- monetization trigger tracking through activities and dedicated endpoints

So the goal is not "replace everything with a greenfield schema."

The goal is:
- preserve working tables and flows
- add the missing fields that make Kado easier to reason about
- normalize a few concepts that are currently spread across JSON or file-backed state
- avoid introducing tables that duplicate existing product plumbing

## Core principles

1. Keep the current `users`, `funds`, `events`, `gifts`, `subscriptions`, and `transactions` backbone.
2. Add missing columns before adding entirely new tables.
3. Use dedicated tables only when the concept is truly many-to-many, event-like, or needs durable history.
4. Do not store sensitive raw SSNs unless the legal and custody model truly requires it. Prefer tokenized or provider-owned storage.

## Recommended target schema

## Users

Current repo:
- already has `email`, name fields, `kycStatus`, `kycData`, admin flags, and timestamps

Recommended target:
- keep `users`
- add these fields over time:
  - `phone`
  - `date_of_birth`
  - `address_json`
  - `kyc_provider`
  - `drivewealth_user_id`
- do not add `ssn_encrypted` unless absolutely required by the chosen custody flow
  - better pattern: keep SSN with the KYC or brokerage provider and store only status, last4, or provider reference in Kado

Practical note:
- `plan` should not live canonically on `users`
- the repo already has `subscriptions` and `fund_memberships`
- keep subscription truth there and derive the effective plan

## Funds

Current repo:
- already has recipient name, birthdate, strategy, account type, balances, projected values, and timestamps

Recommended target:
- keep `funds`
- add next:
  - `gift_code`
  - `gift_link_token`
  - `coverage_state`
  - `trial_ends_at`
  - `drivewealth_account_id`
  - `age_18_notified_at`
  - `last_contribution_at`
  - `dormant_notification_sent_at`
- do not rename core repo fields unless there is a strong migration reason
  - `recipient_first_name` is already doing the job of `child_name`

Sensitive data:
- `child_ssn_encrypted` should follow the same rule as user SSN
- prefer provider-managed storage and store reference metadata in Kado

Investment settings:
- do not collapse everything into one `default_investment jsonb` field if we already have strategy and routing logic
- better:
  - keep `investment_strategy`
  - keep or expand the separate investment-preferences layer for:
    - default mode
    - default stock
    - allow gifter stock pick
    - allow cash gift

## Events

Current repo:
- already has `events` with name, type, slug, description, image, active state, and premium event state

Recommended target:
- keep `events`
- add next if useful:
  - `custom_url_slug`
  - `occasion_type` normalization if current `eventType` drift becomes a problem
- map existing `hasEventPass` to the business idea of `event_boost`
  - no need to create both

## Contributions

Current repo:
- concept is stored in `gifts`
- `transactions` already capture payment and status details

Recommendation:
- do not create a new `contributions` table
- keep `gifts` as the contribution record and extend it

Add to `gifts` next:
- `large_gift_fee`
- `gifter_covered_fee`
- `shares_purchased`
- `drivewealth_order_id`
- `gifter_id` if a durable gifter identity table becomes canonical

Keep in `transactions`:
- Stripe payment intent ids
- checkout session ids
- refund state
- payment lifecycle details

Why:
- `gifts` is the user-facing contribution record
- `transactions` is the payments ledger
- that separation is already sensible

## Gifters

Current repo:
- gifter notification state is currently file-backed
- gifter account save/dashboard behavior exists
- admin gifter reporting exists

Recommendation:
- add a real `gifters` table
- add a real `gifter_funds` table

Why this is worth it:
- this concept is already real in product behavior
- file-backed state is fine for bootstrapping but not a durable long-term data model
- birthday reminders, age-18 updates, unsubscribe state, and contribution history belong in the database

Suggested `gifters` fields:
- `id`
- `email`
- `name`
- `milestone_notifications`
- `opted_in_at`
- `opted_in_ip`
- `unsubscribed`
- `unsubscribed_at`
- `unsubscribe_token`
- `created_at`
- `updated_at`

Suggested `gifter_funds` fields:
- `id`
- `gifter_id`
- `fund_id`
- `total_contributed`
- `contribution_count`
- `last_contributed_at`
- `last_birthday_reminder_year`
- `last_birthday_reminder_sent_at`
- `age_18_notified_at`
- `created_at`
- `updated_at`

## Memory Book

Current repo:
- `memory_entries` already exists and is structurally correct

Recommendation:
- do not replace it with `memory_book_entries`
- evolve `memory_entries`

Add next:
- `title`
- `entry_type` normalization
- `occasion_type`
- `is_shared_with_gifters`
- `shared_at`

Keep current:
- `giftId`
- `content`
- `authorName`
- `photoUrl`
- `videoUrl`

## Subscriptions

Current repo:
- `subscriptions` handles account-level family/free plan state
- `fund_memberships` handles per-fund starter coverage

Recommendation:
- keep both
- do not flatten them into one table

This is one of the places where the current repo is already better than the simplified proposed schema:
- family plan is account-wide
- starter / Kado+ style coverage is fund-specific
- that really is two layers

Add next if useful:
- `trial_ends_at` on `fund_memberships` or a dedicated trial table if trial logic becomes too scattered

## Notifications

Current repo:
- notifications are partly operational, partly file-backed, partly activity-based

Recommendation:
- add a real `notifications` table

This is a good next table because it will unify:
- parent notifications
- gifter notifications
- in-app banner state
- email / push / sms delivery state

Suggested fields:
- `id`
- `user_id` nullable
- `gifter_id` nullable
- `fund_id` nullable
- `type`
- `channel`
- `status`
- `sent_at`
- `opened_at`
- `clicked_at`
- `metadata`
- `created_at`

## Trigger events

Current repo:
- monetization trigger events are already tracked through a dedicated endpoint and activity-style logging

Recommendation:
- add a real `trigger_events` table only if we want durable analytics for trigger conversion over time

Suggested fields:
- `id`
- `fund_id`
- `trigger_type`
- `fired_at`
- `converted`
- `converted_at`
- `dismissed`
- `dismissed_at`
- `metadata`

This is useful, but not as urgent as `gifters`, `gifter_funds`, and `notifications`.

## What to avoid

Avoid these schema mistakes:

1. Duplicating plan truth in both `users.plan` and `subscriptions`.
2. Creating `contributions` alongside `gifts` when `gifts` already is the contribution record.
3. Storing raw encrypted SSNs in Kado unless provider-owned storage is impossible.
4. Replacing working `memory_entries` and `fund_memberships` tables just because the names are less ideal.

## Recommended implementation order

## Phase 1

Highest-value, lowest-regret additions:
- add missing columns to `funds`
  - `gift_code`
  - `gift_link_token`
  - `coverage_state`
  - `trial_ends_at`
  - `drivewealth_account_id`
  - `last_contribution_at`
- add real `gifters`
- add real `gifter_funds`

## Phase 2

Operational durability:
- add `notifications`
- move gifter notification state out of `.local` files into DB
- move memory-share counters and reminder state into DB

## Phase 3

Analytics and lifecycle:
- add `trigger_events`
- normalize milestone and upgrade tracking
- add durable scheduled-job run bookkeeping if needed

## Scheduled jobs audit

The proposed jobs are directionally right, but some should remain event-driven and some should become real cron jobs.

## Jobs that already partially exist

- gifter birthday reminder logic
- gifter age-18 notification logic
- memory share queueing
- reverse trial logic
- age-18 planning and handoff flows
- monetization trigger recording

## Recommended daily jobs

Run at 6am Eastern, or as equivalent app-timezone job.

### birthday_reminder_job
- for each fund with a birthday today
- for each opted-in gifter on that fund
- queue birthday reminder email if fund settings allow it

Status:
- concept already exists
- should move from file-backed state to DB-backed `gifters` / `gifter_funds` / `notifications`

### age_18_notification_job
- for each fund crossing the age-18 planning threshold
- queue child invite and parent handoff tasks
- queue opted-in gifter age-18 notifications

Status:
- partially exists
- external brokerage conversion should remain an explicit external handoff, not an invisible cron side effect

Important:
- do not automatically claim that UTMA to personal conversion fully happens inside Kado unless custody ops really support it

### trial_warning_job
- for each fund whose trial ends in 3 days
- queue banner + email

Status:
- good candidate for a real cron-backed notification job

### trial_expiry_job
- for each fund whose trial ends today
- transition coverage state
- queue expiry notification

Status:
- should be formalized once trial state is stored more directly on funds or fund memberships

### dormant_fund_job
- for each fund with no contribution in 60 days
- queue re-engagement
- set notification marker

Status:
- good candidate
- needs durable `last_contribution_at` and dormant notification state

### age_16_notification_job
- useful but secondary
- should be added after core gifter and coverage jobs are durable

### age_17_memory_book_preview_job
- useful but secondary
- should depend on a clearer child-consent / parent-setting model

## Monthly jobs

### monthly_statement_job
- for free-plan users with contributions last month
- compute fee total
- compare to Kado+ / starter equivalent
- send statement

Status:
- good fit
- needs durable fee summary query and notification record

## Triggered jobs

### contribution_received_job
- should stay event-driven
- trigger off successful gift completion / settlement
- fire Trigger 1
- evaluate Trigger 2 threshold
- update `last_contribution_at`
- attach memory entry

Status:
- this is already the right shape conceptually

### large_gift_alert_job
- should stay event-driven
- trigger on contribution amount threshold

Important note:
- "24-hour upgrade window before fee applied" is product logic, not just a job
- implement only if checkout / payment state really supports delayed fee treatment

### memory_book_share_job
- should stay event-driven
- parent manually initiates share
- queue notifications to opted-in gifters

### milestone_notification_job
- should stay event-driven
- trigger when fund value crosses thresholds

Status:
- useful once notifications are DB-backed

## Best practical next step

If we are actually going to implement this, the best next migration is not a full rewrite.

It is:

1. Add missing `funds` columns.
2. Add `gifters`.
3. Add `gifter_funds`.
4. Add `notifications`.
5. Move gifter notification state out of `.local` files into those tables.

That gets us the biggest payoff:
- real lifecycle durability
- real analytics on gifters
- cleaner age-18 and birthday jobs
- less hidden state outside Postgres

## Bottom line

Your proposed schema is strong as a product model, but the repo should implement it as an evolution, not a replacement.

The most important corrections are:
- keep `gifts` instead of adding a duplicate `contributions` table
- keep `subscriptions` plus `fund_memberships`
- avoid storing raw encrypted SSNs unless forced
- move gifter and notification state into the database next

That is the highest-signal path from the current repo to the intended Kado system.
