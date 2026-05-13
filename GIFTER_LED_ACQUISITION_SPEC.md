# Gifter-Led Acquisition — "Grandma is the Sales Team"

> Status: **Spec + MVP shipping 2026-05-13.** Same shape as
> `AGE_18_HANDOFF_SPEC.md` and `FACE_ID_SPEC.md`. This spec
> captures the strategic thinking; the MVP build follows in the
> same session.
>
> Companion specs: `AGE_18_HANDOFF_SPEC.md`,
> `KIDDO_ADULT_TIER_SPEC.md`, `B2B_GIFTING_SPEC.md`.

---

## TL;DR

Kiddo's current acquisition flow assumes the parent is the
discoverer: parent finds Kiddo → creates fund → shares link →
gifter follows link → gifts. **In real life, the motivation is
on the wrong side of that funnel.** Grandparents (and other
gifters) often want to invest for kids more than parents want
to set up another app. The canonical failure mode is: grandma
asks parent to set up a Kiddo / Schwab / 529 account → parent
is busy → nothing happens → grandma gives cash → cash disappears.

**This spec inverts the funnel.** Gifter can land on Kiddo,
express intent to gift to a specific child whose parent hasn't
signed up yet, and the system sends a warm nudge to the parent.
Money is the conversion mechanic: "your mom has $250 ready to
send for Emma — set up a fund (2 minutes) and her gift flows
automatically."

The MVP ships **warm-promise** (no card upfront, follow-up
confirm when parent's ready) for friction-minimal validation.
V2 adds **optional pre-authorization** (Stripe SetupIntent)
once conversion data justifies the extra friction.

Architecture is purely additive: a new table for pending
intents, a new entry point (`/give-a-gift`) for gifters with no
fund yet, a new email type, and a small additive check on the
parent signup path. **No existing flows change.**

---

## The strategic case (why this matters)

Three structural reasons this is potentially the strongest
acquisition channel in the product:

### 1. Motivation is on the wrong side of the current funnel

| Side | Motivation level | Time/attention available |
|---|---|---|
| Grandparents (gifters) | High — guilt about cash gifts, legacy thinking, mortality awareness | High — retired, disposable time |
| Parents of young kids | Low — Kiddo not on their radar | Low — sleep-deprived, time-starved |

Kiddo today asks the unmotivated party to do the setup work.
Inversion fixes the math: gifter (high motivation, has time) does
the setup; parent (low motivation, no time) gets a 2-minute
warm-onboarded flow with money already on the line.

### 2. Trust transfer is real and not replicable

A cold Kiddo email to a parent gets ignored. A nudge from THEIR
OWN MOM saying "I have $250 ready for Emma the moment you set
this up" — that's not marketing. That's family-trust pressure
plus a concrete reward. Schwab can't recreate this (their flow
has no gift-link concept). Even Acorns Early, which has the
gift mechanic, has no nudge-without-fund-yet path.

### 3. WOM coefficient could exceed 1

Math:
- Each parent acquired via gifter-nudge attracts 1–3 nudgers
  (mom, dad's mom, an aunt) who become Kiddo gifter accounts
- Each successful gifter tells 1–3 friends ("I sent my daughter
  a nudge, she set up in 2 minutes, I gifted $250 for Christmas")
- Some of those friends are themselves grandmas wanting to gift
  for a different family — they start fresh nudge chains

>1 coefficient territory = actual viral growth, not "viral if
the parent shares the link." Today's parent-led loop only reaches
people the parent already thinks of. Gifter-led puts activation
energy on the side that already has it.

---

## What this is NOT (legal + brand boundaries)

Three things this spec intentionally rules out so the architecture
doesn't drift:

### Not: gifter creates the fund

UTMA accounts require the parent (or legal guardian) as the named
custodian, by federal law. A gifter CANNOT create a fund on the
parent's behalf. The architecture routes the nudge through the
parent's setup step — it does not shortcut it. Period.

### Not: nag-bot energy

The risk is that this becomes "the app my mother-in-law uses to
guilt-trip me about being a bad parent." Done wrong, that's the
brand. Done right, Kiddo is the calm messenger, mom is the warm
sender. Copy register, rate limits, and tone matter as much as
the architecture.

### Not: gift creation without a fund

The actual money charge happens only AFTER the parent's fund
exists. The intent ledger is a pre-fund reservation, not a
parked transaction. No held cards, no orphaned payments, no
escrow accounts in V1 (V2 may add pre-auth via Stripe
SetupIntent if data justifies it).

---

## Architecture (what's added, what's preserved)

### What's preserved (the existing product)

Nothing about the current flows changes:

- Parent fund creation: same form, same UTMA-acknowledgment, same setup
- Parent gift-link sharing: same `/:fund` and `/:fund/:event` routes
- Gifter checkout for existing funds: same Stripe checkout, same processing
- Money settlement into funds: same DriveWealth pipeline
- Memory Book mechanic: same entry creation on gift settlement
- Kid View, age-18 handoff, subscriptions, fees: untouched
- All locked copy/UX principles: no em-dashes, "occasions" not "events," calm register

### What's added (the new surfaces)

| Surface | Purpose |
|---|---|
| New table `gift_intents` | Stores pending gifter-led intents before fund exists |
| New page `/give-a-gift` (or similar) | Gifter-side entry point when no fund link exists |
| New email type | "Your mom Sarah wants to invest for Emma — set up Emma's fund" |
| New gifter-dashboard section | "Your pending intents (waiting for parent to set up)" |
| Additive check on parent signup | "We see a pending intent matching your email — claim it?" |
| New endpoint `/api/gift-intents` | CRUD for the intent ledger |
| New endpoint `/api/me/pending-incoming-intents` | Used by parent signup check |

**Brand consistency check:** every new copy surface uses the
same tone register as the rest of the app. Nudge email reads
like a warm family communication, not a marketing blast.

---

## The MVP flow (warm-promise mode)

End-to-end, the V1 user journey:

### Gifter side

1. Grandma lands on `kiddofund.com/give-a-gift` (could also be
   from the main marketing page when there's no parent link)
2. Form: "Who's the parent?" (email or phone), "Who's the
   kid?" (name + optional birthday), "How much?" (preset
   chips: $25 / $50 / $100 / $250 / $500 / custom), "Personal
   message" (optional, max 490 chars per the locked Stripe-
   metadata limit)
3. If grandma doesn't have a Kiddo account, create one inline
   (gifter signup is already a calm flow — reuse it)
4. Submit → intent is saved, nudge fires to parent
5. Confirmation: "Sent. We'll let you know when Sarah sets up
   Emma's fund — usually within a week."

### Parent side (nudge recipient)

1. Email lands in parent's inbox: warm subject ("Your mom Sarah
   wants to invest for Emma"), warm body (concrete: $250 ready,
   personal message included, low-pressure CTA)
2. Click → lands on a custom-framed signup page: hero is "Emma's
   fund is one tap from existing" with the gift amount + message
   visible. Standard fund-creation flow underneath, but the
   reservation is the conversion driver
3. Parent creates fund (same UTMA flow as today; no shortcuts)
4. Server pairs the intent to the new fund; sends grandma a
   "Sarah set up Emma's fund — ready to send your $250?" email
5. Parent lands on dashboard with a "Pending gift from your mom"
   surface indicating the next step is grandma's confirmation

### Gifter side (after parent setup)

1. Grandma gets a follow-up email: "Sarah set up Emma's fund.
   Send your $250?" with a one-click button
2. Click → lands on standard gift checkout (the existing flow),
   pre-filled with the amount/message from her intent
3. Pays via Stripe, gift settles, Memory Book entry creates on
   settlement — all on the existing infrastructure
4. Confirmation: "Sent. Emma's fund just grew."

### Edge cases the MVP handles

| Case | Behavior |
|---|---|
| Parent never sets up | Intent stays pending. Grandma gets a "Sarah hasn't set up yet" reminder at 7 days, 30 days. After 60 days, intent expires (grandma can extend or release). |
| Grandma changes her mind | Gifter dashboard surfaces "Cancel intent" for any pending intent. |
| Parent already has a Kiddo account | The signup check surfaces the intent on next login: "We see a pending intent from Sarah — claim it?" |
| Parent already has a fund for the named kid | The pairing logic detects this and offers grandma the existing fund: "Emma's fund already exists — send to it?" |
| Multiple gifters nudge the same parent | All intents pool into one parent inbox: "3 family members have $700 ready for Emma." Parent setup releases all of them at once. |
| Recipient kid has no parent on Kiddo and grandma doesn't know parent's email | V1 falls back: grandma gets a personal share-link to send via text/email herself. (Future V2 may add phone-only flow.) |
| Anti-spam: grandma tries to nudge 50 random parents | Rate limit: max 5 unique recipient emails per gifter per 7 days. Flag for review beyond that. |

---

## Copy: tone is the conversion lever

The nudge email is the single highest-leverage copy in the entire
flow. The exact phrasing has to land warm-but-clear, not
guilt-trippy. Examples worked through:

### Nudge email — bad versions (don't ship)

| Bad version | Why it fails |
|---|---|
| "Your mom is waiting for you to set up Kiddo so she can gift!" | Urgency framing = nag. Sets up parent-resentment. |
| "Don't let your mom's gift go to waste. Set up Emma's fund today." | Guilt + urgency. Brand-poisoning. |
| "Sarah wants to gift Emma $250 via Kiddo. Click here to enable." | Transactional. Reads like a marketing email. |
| "🎁 You've got a gift waiting!" | Emoji + sales energy. Not Kiddo's register. |

### Nudge email — ship version

**Subject:** Sarah wants to invest for Emma

**Body:**

> Hi [parent first name],
>
> Your mom Sarah used Kiddo to start a gift for Emma. She has
> $250 ready, plus this note:
>
> > "For my granddaughter, with all my love. Use it for college
> > or whatever Emma's dreams take her toward."
>
> The way Kiddo works: instead of cash that gets spent, the
> gift becomes real shares of stocks Emma will own. The fund
> stays in your name until Emma's 18, then it's hers.
>
> Set up Emma's fund (2 minutes, no card needed) and Sarah's
> gift flows automatically.
>
> [Set up Emma's fund]
>
> No rush — you have plenty of time. Sarah will get a quick
> note once you're set up.

Notes on the version:
- Subject is a sentence, not a marketing-y line
- "Hi [name]" not "Hey there"
- Mom's name is concrete (Sarah, not "a family member")
- Gift amount + message is the hero (real, not abstract)
- Explanation of Kiddo is one paragraph, not a feature list
- "No card needed" addresses the implicit "is this a trick" question
- "No rush" + "plenty of time" explicitly de-pressures
- "Sarah will get a quick note" sets the post-setup expectation
  so parent isn't surprised when grandma confirms her gift later

---

## Anti-spam + abuse controls

Six controls. These are not optional; without them the channel
becomes spam-prone or weaponized:

1. **Rate limit per gifter:** Max 5 unique recipient emails per
   gifter per 7 days. Beyond that, flag for review.
2. **Rate limit per recipient:** Max 3 nudges to a given email in
   the same week. Pooling across gifters when relevant.
3. **Recipient opt-out:** Every nudge email has "I don't want
   gifts from Sarah / I don't want any Kiddo gift nudges" links.
   Soft block (per-gifter) and hard block (all nudges) both
   available.
4. **No nudges to minors directly:** Recipient must be the parent,
   not the kid. Server validates against the kid's likely-being-
   a-minor status (best-effort — based on intent metadata).
5. **Gifter account required for nudge creation:** Anonymous
   nudges are not allowed. Gifter signs up first (lightweight
   signup, no KYC).
6. **Audit trail:** Every nudge logged with sender + recipient +
   timestamp. Abuse reports route to ops with full context.

---

## Conversion funnel metrics

The five points to instrument from day 1:

1. **Intent creation rate** — visitors to `/give-a-gift` who
   submit an intent. Top-of-funnel.
2. **Nudge delivery rate** — intents created that result in
   delivered email (not bounced). Infrastructure health.
3. **Parent click-through rate** — recipients who click the
   nudge email and land on signup. The "did the nudge work"
   metric.
4. **Parent setup conversion rate** — clickers who actually
   complete fund setup. The conversion metric.
5. **Gift settlement rate** — setups where the gifter
   subsequently confirms and pays. The "is the loop closed"
   metric.

The product-market-fit signal: parent setup conversion ≥ 30%.
If it's 5%, the nudge isn't working. If it's 50%, this is the
strongest channel in the product. Real data will reveal which.

---

## V2 (pre-auth path) — when to upgrade

V2 adds optional pre-authorization: at intent creation, grandma
can check "commit my card now" → Stripe SetupIntent saves her
payment method → when parent sets up the fund, the system
auto-captures.

**When to ship V2:**

1. **V1 funnel data shows conversion gap.** If parent setup
   conversion is meaningfully lower for warm-promise intents vs
   pre-auth-able ones (we'd need to A/B test), pre-auth is
   pulling its weight.
2. **Grandmas request "I want to commit it now."** If we see
   organic demand from the gifter side, build the feature.
3. **Volume is high enough to justify Stripe SetupIntent
   complexity.** This adds real engineering surface (card
   expiry, capture failure handling, re-confirmation flows).
   At low volume it's not worth it.

**What V2 changes for the parent nudge copy:**

Warm-promise: "Sarah wants to invest $250 for Emma" (intent-y)

Pre-auth: "Sarah's $250 is ready to go — it'll send the
moment you finish setting up Emma's fund" (concrete-y)

The pre-auth framing converts better empirically (concrete >
hypothetical) but requires the upfront card-entry friction.

---

## Composability with other Kiddo work

This spec touches three other parts of the roadmap:

### B2B Corporate Gifting (`B2B_GIFTING_SPEC.md`)

The mechanic is the SAME shape: bulk gifter (HR team) wants to
gift to employees' kids who don't yet have Kiddo funds. The
nudge flow IS the B2B gifting flow with a different sender. V1
ships the consumer (grandma) version; B2B re-uses the
infrastructure with a corporate-admin dashboard on top.

### Kiddo Adult Tier (`KIDDO_ADULT_TIER_SPEC.md`)

The mechanic ALSO works post-handoff for adult-to-adult gifting.
"My friend just had a baby — I want to start a fund for her kid"
where the friend doesn't have Kiddo yet. Same nudge mechanic;
different gifter persona. Composes.

### Age-18 Handoff

The newly-kid-owner-at-18 cohort eventually has babies. When
they do, their old Kiddo network (uncles, aunts who gifted them
as kids) will want to do the same for THEIR kids. The
gifter-led mechanic captures this 18-year-later loop closure.

---

## Build order

**Week 1 (this session, MVP):**
1. Schema: `gift_intents` table (id, gifter_user_id,
   recipient_email, recipient_phone, kid_first_name,
   kid_birthdate, amount, message, status, fund_id_when_paired,
   created_at, expires_at, paired_at, completed_at)
2. Endpoint `POST /api/gift-intents` — create
3. Endpoint `GET /api/gift-intents` — gifter's pending list
4. Endpoint `DELETE /api/gift-intents/:id` — cancel
5. Endpoint `GET /api/me/pending-incoming-intents` — parent signup check
6. Email infrastructure: nudge template, reminder template,
   follow-up "ready to send" template
7. New page: `/give-a-gift` gifter-side form
8. New page (or auth-redirect overlay): parent-side warm signup
   when arriving via nudge link
9. Server-side pairing logic when parent creates fund

**Week 2-3 (build follow-ups):**
10. Gifter dashboard surface for pending intents
11. Anti-spam controls + rate limiting
12. Funnel instrumentation (5 metrics above)
13. Reminder cadence worker (7d, 30d)
14. Multi-gifter pooling logic for parent UI

**Later (V2):**
15. Stripe SetupIntent integration for pre-auth path
16. Phone-only nudge variant (SMS instead of email)
17. B2B corporate-admin dashboard re-use

---

## When to come back to this spec

Five triggers:

1. **MVP funnel data lands.** Parent setup conversion rate is
   the signal. If ≥30%, double down. If <10%, copy + UX iterate.
2. **First abuse report.** Anti-spam controls might need
   tightening. Real users find real edges.
3. **Pre-auth demand from gifters.** Organic asks = build V2.
4. **B2B corporate inbound asks.** Re-use the mechanic for
   B2B (`B2B_GIFTING_SPEC.md`).
5. **A competitor launches a similar gifter-led flow.** Don't
   be third to market if it validates.

---

## What this spec is honest about

Three things to surface:

1. **Parent-resentment risk is real.** The copy register has to
   land warm-not-pushy from day 1. The first version of the
   nudge email is the conversion lever — get it wrong and the
   brand takes damage. Get it right and Kiddo becomes the warmest
   family-finance brand in the category.

2. **The 30% conversion target is a guess.** Real data will set
   the bar. Be ready to iterate the copy + UX based on what
   actual parents do.

3. **The "no fund exists" check assumes good metadata.** Parents
   sometimes have multiple emails, phone-number-changed, etc.
   The pairing logic has to be forgiving (email-or-phone-or-name
   match, not strict). Some intents will be orphaned despite
   best efforts; the V1 fallback is "grandma can share a
   personal link if pairing fails."

---

## References

- Internal: `AGE_18_HANDOFF_SPEC.md` — same spec-doc shape, also a
  major architectural addition that proved net-positive without
  destabilizing existing flows
- Internal: `B2B_GIFTING_SPEC.md` — re-uses this spec's nudge
  mechanic for HR-team-led acquisition
- Internal: `KIDDO_ADULT_TIER_SPEC.md` — adult-to-adult version
  of the gifter-led flow for friends-having-babies
- Internal: `feedback_anonymous_as_explicit_flag.md` — the
  intent-creation flow needs the same explicit-flag discipline
  (intent message + sender identity are explicit fields, not
  inferred from patterns)
- External: [Stripe SetupIntent docs](https://stripe.com/docs/payments/setup-intents) — V2 pre-auth foundation
- External: [Resend transactional email](https://resend.com/) —
  nudge delivery infrastructure (per `DEPLOYMENT_PLAN.md`)
