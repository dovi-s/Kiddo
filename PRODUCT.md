# Kiddo Product Doc

> Last updated: 2026-05-10
>
> Read this if you want to understand **why** Kiddo is built the way it is.
> For technical depth, read `ARCHITECTURE.md`. For the day-to-day standing
> rules, read the locked memory directory referenced at the bottom.
>
> Target reader: a designer, PM, VC analyst, or new contributor who has
> 20 minutes and wants to leave knowing what Kiddo will and will not do.

---

## 1. What Kiddo is

Kiddo is a custodial investment-gifting platform. A parent creates a fund
for their child. Family and friends send money via a public link, no
account required on their end. Money lands in a UTMA brokerage account
(via DriveWealth, member FINRA/SIPC). On the kid's 18th birthday,
ownership transfers to the kid, who inherits both the money and the
years of notes, photos, videos, and voice messages attached to every gift.

The product has three surfaces, each with its own design philosophy:

| Surface | Audience | Philosophy | Reference |
|---|---|---|---|
| Gifter | Aunts, uncles, grandparents, friends | Robinhood-minimal. One link, three taps, done. No login. | `project_three_surfaces_three_philosophies.md` |
| Parent | The custodian | Apple-Settings-discoverable. Everything is one or two screens deep, organized, never hidden. | Same |
| Kid | The eventual owner | Mubi-emotional. Memory Book lands like a film, not a spreadsheet. | Same |

The defining moment is the kid opening the fund on their 18th birthday.
Every product decision is evaluated against that moment.

---

## 2. Who Kiddo is for

**Primary user:** a parent who wants to invest for their kid AND wants
extended family/friends to participate without each one needing their own
broker account.

**Why "extended family" matters:** the typical UTMA at Fidelity/Schwab
solves the parent's investing problem. It does not solve the
"grandma wants to send $50 for the birthday" problem. Today that money
either goes via Venmo (and never gets invested) or via cash in a card.
Kiddo collapses that gap with a public link.

**Not for:** parents who want a 529 (education-only, state tax deduction),
solo investors managing their own brokerage, anyone wanting to pick the
underlying broker, anyone wanting crypto or alternative assets.

---

## 3. The competitive frame

| Alternative | What it does well | Where Kiddo differentiates |
|---|---|---|
| **Acorns Early** | Custodial UTMA at scale. Brand, distribution, integration with main Acorns account. | Acorns' moat is acquisition. Kiddo's moat is the gifter loop and the kid-at-18 experience. Acorns Early has no public gift link. No Memory Book. No sealed-letter handoff. |
| **EarlyBird** | First-mover on the gifter-link pattern. Acquired by Acorns mid-2025. | The acquisition validates the thesis. EarlyBird as a standalone product is being absorbed; that creates a window. See `project_earlybird_acquisition_risk.md`. |
| **529 plans** | Tax-advantaged for education. Up to $35k Roth rollover after 15 years (SECURE 2.0). | Different product. Kiddo recommends a two-account model: 529 for education, Kiddo for the rest. We are NOT a 529 substitute. |
| **DIY UTMA at Fidelity/Schwab** | Free, parent picks the broker, full control. | Solves the parent investing problem. Does not solve the gifter problem, the kid-at-18 ceremony problem, or the "every gift is a memory not a transaction" problem. |
| **giveashare.com / Computershare DSPP** | Real registered shares, ceremonial paper certificate. | Beautiful for one-time gifts. Doesn't scale to recurring family gifts and has no kid-facing surface. |

**Defensibility frame:** see `project_defensibility_2x2.md`. Kiddo sits in
the high-complexity + high-utilization quadrant: brokerage layer + age-band
logic + Memory Book voice. The test for any new feature is: could a parent
vibe-code this in an afternoon? If yes, it's not a moat.

---

## 4. The locked product matrix

**Plans (prices locked 2026-05-23 pricing-v3; features reconciled
2026-05-13 Kid View / Memory Book / Plus-audit locks):**

| Plan | Price | Key features |
|---|---|---|
| Free | $0/mo | One fund, full Kid View, text Memory Book entries (gifters can always attach photo/video/voice), 1 active occasion at a time, one-time gifts only, gifter reminder system |
| Kiddo+ | $3.99/mo or $29/yr | One fund. Recurring investments (for the parent AND any gifter to the fund), custom fund mix, parent-authored Memory Book media (photo/video/voice), co-parent access, 3 active occasions, priority support |
| Kiddo Family | $6.99/mo or $59/yr | Everything in Plus / unlimited children / Kid View for every child / Memory Book for every child / one view for every fund in your household / unlimited occasions with premium features / recurring for every fund's gifters |
| Kiddo Legacy | $129/yr (annual only) | **PULLED from public pricing 2026-05-12** (data model intact for existing subscribers). Honest bullets only: Everything in Family + 2 Occasion credits/yr. Re-introduce when premium Memory Book printing, multi-gen fund continuation, or real planning-scenario tooling actually ships |

**Fee architecture (locked 2026-05-08):**

- **0.10% AUM annual fee on invested assets across ALL plans.** Not
  charged on cash or pending gifts. This is the universal monetization
  layer.
- **No platform fee on gifts.** "$50 from grandma stays $50 to the fund."
  Gifter pays Stripe processing only.
- **No required large-gift fee.** Bank transfer recommended for lowest
  processing on large gifts.

**Locked copy patterns:**

- "1 active event at a time" (never "1 event")
- Never "auto-invest" in user copy. Use "Recurring investments" / "Growing
  automatically" / "Recurring investment" depending on context.
- Never "contribute" in user copy. Use "Add to" or "Invest in." Internal
  DB column names (`parent_contributions`, `oneTimeContributionAmount`)
  are fine; only user-facing copy is constrained.
- Never headline Free as "$0 forever" or "Always free." The 0.10% AUM
  fee makes that misleading. Approved phrasings: "$0 per month",
  "Free to start", "No monthly fee."
- Confirmation states land with 🌱 + "Powered by Kiddo · gifts that
  actually last 🌱"
- Strategy emoji: Conservative ⚖️ · Balanced 🌿 · Growth 📈 · Custom 🎯.
  Never 🌱 (brand-reserved).

**Visual system:**

- 60-30-10 color palette: cream ~60%, evergreen ~30%, kiddo-gold ~10%
- Brand metaphor: sprout 🌱 / plant. **NOT** acorn or oak (Acorns' IP)
- Slide-up sheet for entity drill-ins (gifter, holding, memory entry).
  Modal/Dialog for system actions (share, confirm, sign-in, error)

---

## 5. The hard noes

Things Kiddo will not do, captured as durable refusals:

1. **No crypto, no alternative assets.** Custodial UTMA scope only.
2. **No full money manager.** Kiddo is investing for kids, not a checking
   account, not a tax tool, not bill pay. Customize-the-mix yes; expand
   the surface no. See `project_product_boundaries.md`.
3. **No DriveWealth handoff fakery.** Until the brokerage integration
   actually wires through, no UI claims "ownership transferred." False
   completion signals are worse than the current honest scaffolded state.
   See `project_age18_handoff_lifecycle_automatic.md`.
4. **No AI investment advice.** Kiddo is a platform, not an RIA. The
   Robinhood $7.5M FINRA precedent (2024) makes the gamification bans
   regulatory, not just aesthetic. See `feedback_no_ai_slop.md`.
5. **No greenwashing losses.** Red is red. Frame losses with the 18-year
   horizon and share-count behavioral context. Never hide them in the
   gain badge. See `feedback_no_greenwashing_losses.md`.
6. **No fear/loss Plus conversion on always-visible surfaces.** Tool-
   benefit framing on contextual surfaces (the recurring investments
   empty state) is the only acceptable upgrade prompt pattern. See
   `project_plus_conversion_framing.md`.
7. **No dark-pattern cancel flow.** No auto-converting trial, no
   retention-discount puzzle, no hidden cancel button, no "I understand"
   guilt language. See `project_cancellation_dark_pattern_avoidance.md`.
8. **No reflexive yes to acquisition or strategic-partnership offers.**
   The Acorns/EarlyBird precedent is the standing reference: design
   depth does not survive horizontal-portfolio acquisition. See
   `project_earlybird_acquisition_risk.md`.
9. **No tax-document delays.** 1099s ship by January 31 every year
   without fail. Acorns' #1 user-trust failure is delayed tax docs.
   See `project_tax_document_timing_discipline.md`.
10. **No acorn / oak / "mighty oaks" brand metaphor.** Direct
    competitor brand collision. The brand metaphor is the sprout. See
    `project_brand_metaphor_locked.md`.

---

## 6. The activation thesis

From `project_setup_aha_habit_per_surface.md`. Different surfaces have
different activation patterns:

| Surface | Setup | Aha | Habit |
|---|---|---|---|
| Gifter | One-shot. They land, gift, leave. | "I gave a real gift, not just $50 in a card." | None. They return next year for the next birthday. |
| Parent | Subscription-rate. Onboarding through first share. | "Family is actually using the link and the fund is growing." | Monthly check-in. Quarterly sharing. |
| Kid | Event-driven. Lives in Kid View pre-18, claims at 18. | The 18th birthday claim. | None pre-18; everything after is the kid's own brokerage life. |

**Measurement default:** pre/post over A/B at Kiddo's traffic level.
Reserve A/B for changes that could regress core flows. See
`feedback_pre_post_over_ab.md`.

**The Stripe precedent:** quality-is-growth. Stripe's checkout polish
delivered a 10.5% revenue lift. The same logic applies to Kiddo.
"Polish the journey" is not gilding the lily; at our traffic level
it IS the growth lever.

**Quality discipline anchors** (load-bearing, see locked memory):

- `project_gravitational_pull_to_mediocrity.md` — institutional twin of
  the kid-at-18 lens, sourced from Stripe's head of design.
- `project_mvqp_minimum_viable_quality_product.md` — sharper than MVP;
  load-bearing flows ship polished or don't ship.
- `project_get_it_right_over_deadline.md` — when polish isn't there,
  push the date deliberately and name it as a decision.

---

## 6.5 The marketing surface (current state)

The home page (`client/src/pages/Home.tsx`) follows the
Stripe / Hera-influenced register:

- **Hero discipline** — 5 elements only (mascot, eyebrow, H1, subhead,
  CTA pair). The earlier 9-element hero stacked preview cards + chips +
  duplicate taglines inside the hero; those moved to dedicated sections
  below.
- **Trust strip directly under the hero** — `TrustMicroStrip` carries
  DriveWealth + FINRA + SIPC, hoisted from the page bottom. Per
  `project_brokerage_as_trust_feature.md`, the brokerage layer is
  celebrated, not buried.
- **Signature trust counter** — live stats from
  `GET /api/public/marketing-stats`: fund count, total gifted, unique
  gifters, earliest claim year. The "earliest claim year" is the moat
  surface — only Kiddo can publish it. Stripe's GDP-counter pattern.
- **Bento + modal-overlay** — 6 product surfaces (Gift page, Memory
  Book, Kid View, Recurring investments, Customize the mix, At-18
  handoff). Click-to-expand modal previews each surface without leaving
  the page. Stripe's "don't leap them off the page" pattern.
- **Marketing nav restraint** — 3 second-tier items (How it works,
  Pricing, Stories) + 1 CTA. Hera ratio. FAQ + About + Guides demoted
  to footer + mobile sheet for thumb-reach.

Sections below the bento (in-flight gifters, Kid View detail, Memory
Book detail, testimonials, age-18 detail, comparison, security band,
final CTA) are intentionally retained — they work; the hero was the
bottleneck.

---

## 7. The age-18 lifecycle (summary)

The most consequential moment in the product. The architecture is
designed so the kid receives the fund automatically on their 18th
birthday regardless of parent attentiveness.

- **T-30 days:** parent gets prep email (3 tasks: add child email,
  share Kid View, walk prep checklist)
- **T-1 day:** parent reminder
- **T-0 (birthday):** if the child's email is verified, the kid is
  auto-emailed the claim link; parent gets one of three variant
  emails (configured / unverified / missing). Activity log records
  the milestone regardless.

**Verification gate:** the at-18 invite is NOT auto-sent unless the
child's email address has been verified. Catches the "parent typo six
years ago" failure mode. Editing the email post-verification resets
the verification.

**Kid claim:** the kid creates their own Kiddo account (separate
password, never shared credentials). On claim, ownership transfers and
the parent loses the parent-managed view. See full lifecycle in
`project_age18_handoff_lifecycle_automatic.md` and the technical
implementation at `server/age18TransitionWorker.ts`.

---

## 8. What's open and known

Honest list of known gaps. None are secret.

| Gap | Why it matters | Reference |
|---|---|---|
| **DriveWealth not yet wired** | Internal accounting works; the actual brokerage call is scaffolded. App behaves AS IF the brokerage exists, but the actual UTMA account opens / KYC / ACATs are TODO. | `ARCHITECTURE.md` §5 |
| **CSAM scanning not in place** | Required under 18 U.S.C. § 2258A before public upload reaches strangers. Tier 1 launch blocker. | `project_child_safety_architecture.md` |
| **Parent review of gifter content not built** | Today gifters can upload directly. Pre-scale this needs a parent-approval queue. | Same |
| **Block-gifter / hide / report not built** | Same family of safety architecture. | Same |
| **Recurring investments are card-on-file, not real ACH** | Stripe Financial Connections is the path; not yet wired. | `project_money_in_architecture.md` |
| **`server/routes.ts` is ~14k lines** | Auditor's first impression. Domain extraction proven (age-transition); ~10 more domain modules to extract. | `ARCHITECTURE.md` §11 |
| **`client/src/pages/Dashboard.tsx` is ~12k lines** | Same. `KidAt18WelcomeBanner` extraction proves the pattern; rest pending. | Same |

---

## 9. Year-1 growth plays

From `project_growth_deferrals.md`. Real plays vs. recurring distractions.

**Real Year-1 plays:**

1. **Single-influencer pilot** — find one parent-influencer who has
   talked about gifting investments before, give them a curated
   experience, ship if it converts.
2. **Easy-to-buy audit** — every friction in the gifter checkout flow
   compounds. Walk-the-store cadence catches drift.
3. **Web-SEO baseline** — answer the high-traffic Reddit threads
   (`REDDIT_ANSWER_TEMPLATE.md`) with honest contributions; build
   satellite pages for "$25 card vs $25 to fund" and similar.
4. **Satellite apps as pre-signup distribution** — free standalone
   calculators (UTMA-at-18 calc, state majority-age lookup) that
   feed organic discovery and can be cited in LLM answers.
5. **Walk-the-store cadence** — monthly journey scoring across the
   7 essential Kiddo journeys. Friction-log + 🟢🟡🔴. See
   `project_walk_the_store_cadence.md`.

**Recurring distractions to refuse:**

- AI investment advice (regulatory landmine, not the moat)
- Stablecoin international (out-of-scope, regulatory tail)
- Acquisition / acquihire offers (see `project_earlybird_acquisition_risk.md`)

---

## 10. The four universal objections

From `project_common_objections_and_structural_answers.md`. Every
custodial-finance conversation hits these. Kiddo's structural answers:

| Objection | Structural answer (NOT defensive answer) |
|---|---|
| "What if the kid blows it all at 18?" | Kiddo's at-18 surface is designed for context, not just access. Memory Book + sealed letter + year-by-year retrospective is the lecture the parent never gets to give in person. The product is the prep. |
| "Shouldn't I save for my own retirement first?" | Yes, and Kiddo is not a retirement substitute. Friends/family contributing means parents don't have to choose between their 401k and their kid's fund. The gifter loop IS the answer to this objection. |
| "Won't UTMA assets hurt FAFSA?" | Yes, at the kid's 20% rate vs the parent's 5.64%. Honest answer. The two-account model (529 for education + UTMA for general) addresses this; we recommend it openly. |
| "Why UTMA over 529?" | Different products. UTMA is general-purpose with no education restriction; 529 is education-only with tax advantages. Kiddo is the UTMA + family-gift coordination layer; we recommend keeping a 529 for college. |

The pattern across all four: reframe to the structural answer, never
win on the objector's terms.

---

## 11. References

- `ARCHITECTURE.md` — technical map (data model, auth, payments, workers,
  audit-readiness)
- `README.md` — quickstart, stack, env vars
- `REDDIT_ANSWER_TEMPLATE.md` — patterns for answering canonical
  "how do I gift stocks to a kid" threads honestly
- `shared/schema.ts` — data model
- `shared/monetization.ts` — locked plan matrix in code
- The locked memory directory — durable principles. Each file is
  one decision; together they encode the design discipline that
  makes Kiddo Kiddo.

If something in the product looks deliberate, it probably is. Check the
memory before assuming it's an oversight.
