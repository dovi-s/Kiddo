# Revenue ledger — built vs planned

**Date:** 2026-07-06. Source: code sweep (not the plan docs). "Built" = a user can
transact against it today. "Plumbed" = code exists but collects nothing yet.
"Planned" = documented, zero code.

## Built and transactable today
| Stream | Who pays | Evidence |
|---|---|---|
| **Subscriptions** (Starter / Family / Legacy) | Parent | Stripe endpoints `/checkout/{starter,family,legacy}-plan`, `subscriptions` table, Settings/Account plan UI, `PlanBenefitsCard`, `EventGateModal`, reverse trial |
| **Sponsored subscriptions** (gifter sponsors Plus/Family for a fund) | Gifter (for the fund, not a fee on their gift) | `/checkout/sponsor-plus`, `/checkout/sponsor-founder`, `sponsored_subscriptions` table, `SponsorPlusCard`, renewal worker |
| **Event passes / premium event coverage** | Parent | `/checkout/event-pass`, `/checkout/premium-event-coverage`, occasion tiers, `CreateEventSheet` |
| **Gift add-ons** | Gifter (opt-in extras, not a fee) | `KIDDO_GIFT_ADD_ONS`, `getGiftAddOn` |
| **Founding members** | Parent | `founding_members` table + welcome flow |
| **Referral tracking** | (attribution only) | `referral_events` table |

## Plumbed but collecting nothing
| Stream | Status |
|---|---|
| **AUM fee 0.10%** | Disclosed + estimated + accrued in tax-doc math, but **no collection mechanism** (custody-gated). Real line, zero dollars until custody is live. |
| **Gifter contribution fee** | Constants exist (`KORA_FREE_GIFT_FEE`, `KORA_LARGE_GIFT_FLAT_FEE`, threshold $1000) but **all set to 0**. Dormant. Consistent with the "no gifter fees" rule; flip-on is a one-constant change if that ever reverses. |

## Planned only — no code, no pages, no functions
- **Employer SaaS / PEPM** — none (only a comment about sharing a URL with an employer)
- **Employer match / rewards** — none
- **Foundation / sponsor pools** — none (forward-looking in the counsel packet)
- **Cashback / card-linked / affiliate** — none
- **Interchange / debit card** — none
- **White-label / API** — none
- **Cash sweep / float yield** — none (idle cash sits; see `INVESTMENT_READINESS.md`)

## Read of it
- The **consumer monetization layer is built and launch-ready** (subscriptions, sponsored subs, event passes). That's your day-one revenue.
- The **AUM fee is your durable long-run line but is custody-gated** (plumbed, not collecting).
- **Family/gifter fees are effectively off** (0). The scaffolding exists but is dormant.
- The **B2B / partnership / expansion streams are intentionally unbuilt** — post-PMF, and building them now would be ahead of need.
- **Revenue *model* = complete on paper** (`REVENUE_MODEL_CURRENT_STATE.md`). **Built product = the consumer layer.**
