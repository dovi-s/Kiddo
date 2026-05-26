# Kora / Kiddo — Codebase Guide

Investment gifting platform (custodial UTMA + personal accounts). React 19 + TS
frontend, Express + Drizzle/Postgres backend, Expo mobile app in `apps/mobile/`.

## Provider integration boundaries (LOCKED)

Third-party providers are not equal. Abstract the ones you might **swap**; accept
coupling on the one you **won't**. The rule below is enforced going forward.

### Stripe — coupling accepted, do not grow it
- Stripe is the standard payments rail and effectively un-swappable for us. Its
  IDs are persisted across the schema (`stripeSubscriptionId`, `stripeCustomerId`,
  `stripePaymentIntentId`, `stripeSessionId`, `stripeCheckoutSessionId`,
  `stripeInvoiceId`, `stripeEventId`). That's fine — you always store *some*
  external reference. **Do not** spend effort abstracting Stripe away.
- Reality today: `routes.ts` already reaches past the service layer to the raw
  SDK at ~56 sites (`stripe.subscriptions.*`, `stripe.checkout.sessions.*`,
  `stripe.products.*`, `stripe.customers.*`, etc.).
- **Rule:** do not *grow* the leak. New payment logic goes through
  `server/stripeService.ts` / `server/stripeClient.ts`. Do not add fresh
  `stripe.*` SDK calls inside `routes.ts`. Keep 56 from becoming 80.

### DriveWealth — NOT yet wired; keep it that way until it's behind an interface
- Status: **scaffold only.** One schema column (`funds.drivewealthAccountId`) +
  `server/driveWealthAccountSetup.ts` + `server/custodianTransfer.ts` stubs +
  comments. No real API client exists yet (see `routes.ts` ~line 19506).
- DriveWealth (custody/brokerage) is the **most realistic swap candidate** —
  custody providers get renegotiated/replaced at scale and carry the most
  regulatory/commercial volatility. This is the one provider where
  "swap = engineering decision, not rebuild" is worth defending.
- **Rule:** when the real DriveWealth client is built, **all** DriveWealth API
  calls live behind a custodian-provider interface in the dedicated modules
  (`driveWealthAccountSetup.ts`, `custodianTransfer.ts`, or a new
  `custodianService.ts`). **Never** inline raw DriveWealth HTTP/SDK calls in
  `routes.ts`. Route handlers call the custodian interface, not the vendor.

### Plaid — keep contained
- Bank-linking is commoditized and swappable. Keep Plaid calls behind a service
  module; do not let Plaid types/IDs spread into `routes.ts` or the schema beyond
  the minimal stored reference.

**Principle:** integrate *up* toward the customer relationship (the kid-2.0
lifetime funnel); keep *renting* the commodity rails *down*. Owning the
orchestration/data layer + clean provider interfaces buys integration's
optionality without its capital/regulatory cost — but only where a swap is
actually plausible (custody/bank-linking), not where it isn't (payments).
