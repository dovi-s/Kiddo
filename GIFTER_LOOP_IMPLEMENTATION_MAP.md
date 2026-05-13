# Gifter Loop Implementation Map

This document maps the gifter-to-parent loop to the code and data structures that already exist in this repo.

Use this when turning the strategy into tickets or implementation work.

## Current Building Blocks Already In Repo

### Core data tables

Defined in [shared/schema.ts](/abs/path/c:/Apps/Kora%20(newest)/shared/schema.ts):

- `gifters`
- `gifter_funds`
- `notifications`
- `referral_events`
- `gifts`
- `funds`

These are enough to support a first real attribution layer without inventing a separate analytics platform on day one.

## Existing surfaces

### Gifter success surface

Current file:
- [client/src/pages/GiftSuccess.tsx](/abs/path/c:/Apps/Kora%20(newest)/client/src/pages/GiftSuccess.tsx)

Use for:
- `gift_success_cta`
- gifter opt-in prompt
- save-fund / lightweight account CTA
- first-touch attribution capture in session or notification metadata

### Gifter dashboard

Current file:
- [client/src/pages/GifterDashboard.tsx](/abs/path/c:/Apps/Kora%20(newest)/client/src/pages/GifterDashboard.tsx)

Use for:
- `gifter_dashboard_cta`
- gifter account creation
- saved-fund behavior
- upgrading a warm gifter into a parent journey

### Memory Book parent shares

Current file:
- [client/src/pages/MemoryBook.tsx](/abs/path/c:/Apps/Kora%20(newest)/client/src/pages/MemoryBook.tsx)

Use for:
- `memory_book_share_email`
- downstream CTA and attribution

### Parent notification settings

Current file:
- [client/src/pages/Settings.tsx](/abs/path/c:/Apps/Kora%20(newest)/client/src/pages/Settings.tsx)

Use for:
- birthday reminder enablement
- memory share enablement
- age-18 notification enablement

### Worker + email delivery

Current files:
- [server/gifterNotificationWorker.ts](/abs/path/c:/Apps/Kora%20(newest)/server/gifterNotificationWorker.ts)
- [server/emailDelivery.ts](/abs/path/c:/Apps/Kora%20(newest)/server/emailDelivery.ts)

Use for:
- `gift_receipt_email`
- `birthday_reminder_email`
- `milestone_email`
- `age_18_email`
- send/open/click status plumbing

## Attribution Model To Use

Shared types now live in:
- [packages/types/src/index.ts](/abs/path/c:/Apps/Kora%20(newest)/packages/types/src/index.ts)
- [packages/utils/src/index.ts](/abs/path/c:/Apps/Kora%20(newest)/packages/utils/src/index.ts)

Canonical touchpoints:
- `gift_success_cta`
- `gift_receipt_email`
- `milestone_email`
- `birthday_reminder_email`
- `memory_book_share_email`
- `age_18_email`
- `gifter_dashboard_cta`

Canonical actions:
- `cta_viewed`
- `cta_clicked`
- `email_sent`
- `email_opened`
- `email_clicked`
- `gifter_account_created`
- `parent_onboarding_started`
- `parent_account_created`
- `fund_created`

## Recommended Storage Strategy

### Phase 1: use existing tables

Store attribution in one of these places first:

- `notifications.metadata` for email touchpoints
- `referral_events.metadata` for web CTA and parent-start touchpoints
- session storage / query params in onboarding to preserve source

Why:
- no new analytics system required
- no new dashboarding dependency required
- enough structure to answer the first conversion questions

### Phase 2: add a dedicated attribution table if needed

Only create a dedicated table after:
- touchpoints are firing consistently
- admin needs cohort reporting beyond metadata queries
- volume justifies a more explicit event log

## Concrete Ticket Map

### Ticket 1: instrument gift success CTA

Files:
- [client/src/pages/GiftSuccess.tsx](/abs/path/c:/Apps/Kora%20(newest)/client/src/pages/GiftSuccess.tsx)
- [client/src/pages/GetStarted.tsx](/abs/path/c:/Apps/Kora%20(newest)/client/src/pages/GetStarted.tsx)

Done when:
- CTA view is captured
- CTA click is captured
- onboarding can read source touchpoint

### Ticket 2: add receipt email CTA attribution

Files:
- [server/gifterNotificationWorker.ts](/abs/path/c:/Apps/Kora%20(newest)/server/gifterNotificationWorker.ts)
- [server/emailDelivery.ts](/abs/path/c:/Apps/Kora%20(newest)/server/emailDelivery.ts)

Done when:
- receipt email includes parent CTA
- notification metadata stores touchpoint and target URL source

### Ticket 3: track gifter-account-created event with source

Files:
- [client/src/pages/GifterDashboard.tsx](/abs/path/c:/Apps/Kora%20(newest)/client/src/pages/GifterDashboard.tsx)
- relevant server auth / account routes

Done when:
- a new gifter account can preserve first known loop touchpoint

### Ticket 4: preserve source into parent onboarding

Files:
- [client/src/pages/GetStarted.tsx](/abs/path/c:/Apps/Kora%20(newest)/client/src/pages/GetStarted.tsx)
- [packages/types/src/index.ts](/abs/path/c:/Apps/Kora%20(newest)/packages/types/src/index.ts)
- [packages/utils/src/index.ts](/abs/path/c:/Apps/Kora%20(newest)/packages/utils/src/index.ts)

Done when:
- parent onboarding start includes source touchpoint
- fund creation can be tied back to that source

### Ticket 5: add admin reporting slice

Files:
- [client/src/pages/Admin.tsx](/abs/path/c:/Apps/Kora%20(newest)/client/src/pages/Admin.tsx)
- server admin reporting route(s)

Done when:
- admin can see at least:
  - fund starts by touchpoint
  - gifter accounts by touchpoint
  - median days from first gift to fund creation

## Rule Of Thumb

Do not build a huge analytics system first.
Use the tables and email plumbing that already exist.
Make the loop measurable with the smallest viable amount of new structure.
Then only deepen it after the loop is clearly moving.
