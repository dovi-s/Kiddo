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

## Craft & human-owned zones (how AI should build here)

This codebase is heavily AI-assisted. To keep it feeling *crafted* — not generic
AI output — some decisions are **founder-owned**: AI proposes and executes, but
does **not** silently (re)architect them. (Don't let the AI be the architect of
the soul.)

**Human-owned — founder decides; surface a proposal, never slip a change in:**
- **Brand voice & copy.** Locked terminology and tone — "gifter" not "giver",
  product name **Kiddo**, canonical strategy labels (`lib/strategy.ts`), no
  em-dashes, no Sparkles (enforced by `script/lint-content.cjs`). Match the
  surrounding voice.
- **Loop mechanics & moat.** Gifter-as-customer, capture-at-intent, the Memory
  Book switching cost, funded-k as the metric. Don't redesign these.
- **The demo's *feel*.** The Rivera demo is the conversion surface; its
  choreography (the count-up roll, the gift moment, the "while you were away"
  digest) is a taste call — build it, show it, let the founder judge tone.
- **Architecture / data model.** Schema shape, the provider boundaries above, new
  tables or abstractions — a founder call, not an AI default.

**Defaults for AI work here:**
- **Additive, not destructive.** Layer on top of what already works (the initials
  avatars, the count-up, the toasts); never silently change a thing the founder
  has tuned.
- **Minimal LOC; prune.** `Dashboard.tsx` is already a ~15k-line monolith. Prefer
  deleting/simplifying over adding; when a feature stops earning its complexity,
  cut it (we've removed the traditions engine, the smart-nudge modal, etc.). A
  new feature must earn its lines.
- **Honesty over theater.** Never animate a loss as a gain, never imply outside
  "people" for the parent's own money, never claim certainty markets don't give.
  The brand's trust IS the moat.
- **Verify, then claim.** Anything visual/demo: show it rendered (screenshot or
  harness) before calling it done.
