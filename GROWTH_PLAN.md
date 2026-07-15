# Kiddo Growth & Revenue — Front Door + Current Decisions

**Date:** 2026-07-13 · **Status:** founder-delegated decisions, pending final bless.

**What this is:** the ONE place to start on growth + revenue. It carries (a) the
2026-07-13 decisions, (b) a reconciliation with the deeper docs, and (c) an INDEX
of the growth doc suite. It deliberately does NOT duplicate the deep docs, it
points into them.

**Why it exists (and why we did NOT merge everything into one file):** the growth
thinking lives across ~10 *current, good, operational* docs with no front door. We
considered folding them all into one; that would have destroyed focused live value
(send-ready cold-email templates, the partnership sequencing doctrine, the SEO
cluster map). So: keep the deep docs, add this front door.

---

## The doc suite (open the right one)

| Doc | What it's for | Status |
|---|---|---|
| **GROWTH_PLAN.md** (this) | front door: current decisions + reconciliation + index | current |
| **PRICING_MODEL_OPTIONS.md** | the pricing/monetization framework: the fork, the 3 cruxes, engine ranking | **current, authoritative on pricing** |
| **GTM.md** | go-to-market execution: 5-metric spine, EarlyBird-orphan capture, 90-day timeline | current |
| **SEO_GTM_STRATEGY.md** | the 4-cluster SEO audience map + what's already built | current |
| **PARTNERSHIPS_FLYWHEEL.md** | partnership SEQUENCING + B2B2C pass-through/ownership doctrine | current (naming lag: says "Kora") |
| **OUTREACH_KIT.md** | send-ready cold emails (custody, HR, broker) + Alpaca/RIA sequence + acquirer play | **current, send-ready today** |
| CREATOR_OUTREACH_KIT · OUTREACH_BATCH_1 · PARTNERSHIPS_TICKET_MAP · KORA_GROWTH_TICKET_PACK · EXECUTION_BOARD | the live operational execution system (tickets, batches, board) | current, operational |
| KORA_GROWTH_PLAYBOOK.md | old internal-loop ops + weekly review ritual | **STALE** (2026-03; dead file refs like `EventCreate.tsx`; "Starter"/"Kora"; superseded by GTM.md for metrics). Salvage: the Mon/Wed/Fri review ritual + "stop-doing" list. |

---

## The 2026-07-13 decisions (net-new)

1. **Subscription becomes the primary near-term revenue** (reconciled below). Free
   tier runs the loop forever (gifter never pays, gifts stay whole). Plus ~$7-9/mo
   (power-parent tools). Family ~$12-14/mo (all kids + co-parent). Comps: UNest
   $2.99-5.98, Acorns Early via Gold $12, Greenlight $5.99-15.98 (category = subs,
   not AUM).
2. **"Never the parent" relaxes.** Parent pays for THEIR tools. Two doors STAY
   bolted: gifts stay whole, gifter never pays. No "greater-of."
3. **Funded-k retired as a gate.** Health metric, never a permission slip.

---

## Revenue decision, reconciled with PRICING_MODEL_OPTIONS.md

`PRICING_MODEL_OPTIONS.md` is the authoritative pricing framework and it does NOT
conflict with the call above; it sharpens it.

- **Its fork:** loop compounds + you'll raise → free · loop compounds + you won't
  raise → **charge the parent a small fee to survive** · loop doesn't compound →
  pricing is irrelevant, fix the loop. **"Subscription-primary" = the no-raise
  survival branch.** Consistent.
- **Its principle stays:** *monetize the lifetime, on the adult, never on the
  child's balance.* The parent sub is a **survival bridge, not the destination.**
  The real long-term engines are **card/interchange + the adult OS after 18 +
  float** (needs the wallet primitive + scale/raise). AUM 0.10% is slow + small
  and muddies "never a fee on your child's money"; likely waive it.
- **The legal synergy (from OUTREACH_KIT §1):** managed auto-invest portfolios +
  a 0.10% AUM fee is the textbook definition of investment advice for asset-based
  comp, which **likely makes Kiddo an RIA** (~$10-30k setup + ongoing). Going
  **subscription + self-directed presets (give no "advice") and dropping the AUM
  fee likely AVOIDS RIA registration.** So the subscription call may also be the
  cheaper legal structure. Counsel confirms (structure #2 in OUTREACH_KIT).
- **The gate, and a CORRECTION (2026-07-14):** `PRICING_MODEL_OPTIONS` says pull
  **Crux 2 (does the loop compound:** 2nd gift from a distinct 3rd person, median
  $/kid/yr, survives reminders-off) now, zero build, "you half-know it." **That is
  wrong pre-launch.** I ran the query: the DB is 100% QA/test/demo accounts
  (`qa_ui_smoke`, `kiddo_visual_*`, `riverafamily`), **zero real users**, so the
  loop numbers it returns (16/29 funded funds with 2+ gifters, ~$1,974/fund) are
  **seed artifacts, not signal.** Crux 2 is NOT answerable until real families use
  it. So the **honest soft-launch + EarlyBird capture ARE the Crux 2 experiment,
  not a step before it** ("prove the loop" and "acquire real families honestly" are
  the same action). Crux 1 (kid keeps it at 18) + Crux 3 (scale-where-free-pays)
  still gate the long-run model. The query is ready to re-run once real
  (non-`@example.com`, non-demo) users exist.

---

## Gate audit: what's really gated vs stupidly gated

The docs stamp "gated on custody-live / funded-k / counsel" on a LOT of things.
Most of it is self-imposed. The truth: **the growth engine is gated on HONESTY, not
on custody.** You can validate demand, warm every partnership, capture intent, turn
the sub on, and run honest/organic distribution RIGHT NOW, in parallel with the
custody + counsel work on `FOUNDER_ACTION_PLAN.md`. The split:

**REAL gates (hard constraints, respect them):**
- **Actually investing a minor's money** → custody live + securities counsel.
- **Charging / holding real money at scale** → capture-at-intent's point-of-charge
  disclosure needs counsel sign-off; money-transmission posture confirmed. (A
  FEATURES subscription billed through Stripe is standard and lower-risk, it does
  not hold or invest customer money.)
- **Presenting as managing money for an asset-based fee** → RIA determination first
  (or go subscription + self-directed presets to sidestep it).
- **A big creator / paid LAUNCH that promises live investing** → gated on
  investing-live (the Dollarwise trap). Promoting the HONEST soft-launch / waitlist
  is NOT gated.

**STUPID gates (self-imposed, unblock now):**
- The honest gifting loop + capture-at-**intent** (no charge). Built, honest, runs today.
- **Pull the Crux 2 loop-compounding number.** Zero build. No reason to wait.
- **Turn the subscription on to MEASURE willingness-to-pay.** That IS the experiment;
  "decide pricing last" does not mean "start measuring last."
- **SEO content + EarlyBird-orphan capture.** Organic, honest, no custody.
- **Warm BD + demand validation** (CPA referral sheet, employer/broker
  conversations, Babylist outreach): no money moves, do it NOW so the relationships
  are ready the day custody lands. The flywheel over-stamped these "wave-2 gated."
  (The one part that DOES wait on custody: running a pilot that actually invests
  real gift money. But warming, validating interest, and capturing intent do not.)
- **Creator relationship-building + term-sheet drafting** (not launch).
- **Founder-accessibility habit.** Free, now.
- **funded-k as a gate on any of the above.** Retired. The ONLY sensible funded-k
  gate is "don't scale PAID spend before the loop is proven."

**The single real sequencing rule:** don't hype-launch a "real investing" promise
before investing is real. Everything else runs in parallel. "Gated on launch" was
doing a lot of quiet work the facts don't support.

### Proven with the readiness check (`npm run test:launch-readiness`, 2026-07-14)

11/29 checks pass clean. The honest gifting loop is blocked by CONFIG, not custody:

- **REAL blocker, Email (ESP):** no `POSTMARK_SERVER_TOKEN` / `SENDGRID_API_KEY`, so
  emails queue locally and DO NOT SEND. The loop is email-driven (gift notices,
  parent nudges, gifter updates, magic-link sign-in), so this is THE soft-launch
  blocker. Config task, days.
- **REAL blocker, App base URL:** no `APP_BASE_URL`, so email links are wrong. Config.
- **Soft, OAuth (Google/Apple) missing:** email + magic-link sign-in already work,
  not a hard blocker for soft-launch.
- **Already done, Stripe:** keys + the **Kiddo Plus / Family / Occasions products are
  configured and "launch_ready."** Turning the subscription on is a price decision +
  flip, NOT a build.
- **NOT a soft-launch blocker, custody:** DriveWealth / Plaid / custodian-transfer are
  all WARN. They gate REAL INVESTING, not the honest gift-capture loop. Gate audit,
  proven.
- **Data-integrity (likely synthetic):** 333 gifts missing memory entries, 336 missing
  thank-you drafts, 7 draft funds with gifts. Almost certainly the seed/test data (DB
  is 99% synthetic per the Crux 2 run); verify on real gifts at launch.

**Upshot: the soft-launch gate is "configure email + base URL" (days), not the
custody + counsel track (months).**

---

## Growth channels (ranked; deep detail in the linked docs)

| # | Channel | Deep doc | Status |
|---|---|---|---|
| 1 | Gifter loop (core) | GTM, KORA_GROWTH_PLAYBOOK | built |
| 2 | Gift-led (GiveAGift) | GTM | built |
| 3 | Parent subscription | PRICING_MODEL_OPTIONS | needs turn-on |
| 4 | **EarlyBird-orphan capture** (net-new) | GTM.md | do NOW, no custody needed |
| 5 | SEO wedge pages (4-cluster map) | SEO_GTM_STRATEGY | built (87 URLs) |
| 6 | Creator-equity distribution | OUTREACH_KIT §4 | **gated: launch only when investing is live + product delivers** (the Dollarwise trap) |
| 7 | Baby-registry / life-event / B2B2C | PARTNERSHIPS_FLYWHEEL, OUTREACH_KIT §2 | manual pilot ready |
| 8 | Institutional / org gifters | INSTITUTIONAL_FUNDING_MODEL, ORG_OUTREACH_ONEPAGER | one-pager built |
| 9 | Advisers (CPA→RIA→family office) | PARTNERSHIPS_FLYWHEEL | warm now, referral sheet |
| 10 | At-18 loop · organic referral | — | long game |
| 11 | Paid ads | — | deferred until sub-LTV funds it |

**EarlyBird-orphan capture (the timely, free wedge, per GTM.md):** Acorns absorbed
EarlyBird and forced a liquidate-and-re-signup migration; orphaned families are on
Reddit / mom-groups searching "EarlyBird alternative" right now. GTM.md has the
founder-disclosed post + comment templates and a `/earlybird-alternative` landing
page. Loop-only, needs no custody. **Do this now.**

**Partnership ordering (per PARTNERSHIPS_FLYWHEEL, do not skip the order):**
consumer proof → gifter loop proof → adviser/custody intros → schools pilot →
employer benefits → brand partnerships. Every deal must be **pass-through +
co-branded** (the gifter becomes Kiddo's customer, not the partner's). Employer
new-baby-gift pilots need **no custody** and are manual-pilot-ready today.

---

## The 90-day sequence (synthesis across the docs)

**Phase 0 — this week:**
- [ ] Pull the **Crux 2 loop-compounding number** (zero build; gates the model). [PRICING_MODEL_OPTIONS]
- [ ] Get **Alpaca Broker API sandbox keys** + wire one custodial UTMA end-to-end; ask counsel the **RIA determination**. [OUTREACH_KIT §1]
- [ ] Ship the **subscription tiers + prices**; instrument free→paid conversion.
- [ ] Start **EarlyBird-orphan capture** (founder-disclosed, value-first) + ship `/earlybird-alternative`. [GTM]

**Phase 1 — weeks 1-4:**
- [ ] Model **Crux 3** (burn, runway, scale-where-free-pays) on a spreadsheet.
- [ ] Send the **employer/broker cold emails** (5-10 brokers + 10 HR leaders); offer the free manual 10-gift pilot. [OUTREACH_KIT §2]
- [ ] Ship the **3 highest-intent SEO wedge pages** (vs Greenlight/Acorns/UNest, UTMA-vs-529, gift-stock-to-a-child). [SEO_GTM_STRATEGY]
- [ ] Draft the **creator structure** (equity vested on funded accounts + disclosure template) with counsel; shortlist family-money creators. **Do not launch** (gated on product-ready).

**Phase 2 — weeks 4-8:**
- [ ] Start **Crux 1** instrumentation (teen engagement) + recruit a near-18 cohort. [PRICING_MODEL_OPTIONS]
- [ ] Warm **CPA / adviser** referral conversations with the one-page sheet. [PARTNERSHIPS_FLYWHEEL]
- [ ] Open **baby-registry / pediatric** BD (birth = highest-intent). [PARTNERSHIPS_FLYWHEEL]

**Phase 3 — quarter 2:** scale the cheapest funded-account channel; consider paid
ads only once sub-LTV funds it; creator launch **iff** investing is live.

**Always-on:** answer every user email personally (the founder-accessibility moat,
OUTREACH_KIT §3 — the only retention model you're legally allowed is love-stuck,
not hate-stuck). Never productize it into a "Contact the Founder" button.

---

## Metrics (GTM.md's 5-metric spine is authoritative)

1. **Gifter→parent conversion** (`gaveToOthersFundBefore`), target ≥ 1-2% — the loop's k-factor.
2. **Free→paid conversion** (beat EarlyBird's ~6% materially).
3. **AFRG** (active funds receiving gifts) — North Star, trending up.
4. **LTV : CAC** ≥ 3 : 1 — blocks paid ads.
5. **Founding members** toward the 1,000 cap — willingness-to-pay proof.
Plus **cost per funded account by channel** (the honest CAC). Funded-k = background health read.

---

## Risks and guardrails

| Risk | Guardrail |
|---|---|
| **Willingness-to-pay** (a fund opened twice a year won't hold a sub) | fund the engagement surfaces (Memory Book, updates) as the retention engine; instrument day one |
| **RIA trigger** | subscription + self-directed presets + drop AUM likely avoids it; counsel confirms before launch |
| **The Dollarwise trap** (creator hypes a half-built product → refunds, "cash grab," trust burned; literally what Caleb Hammer did) | product excellent + investing LIVE **before** any creator launch; Kiddo has no "side project" buffer, the product IS the business |
| **Finfluencer compliance** | disclosure-first, written agreement, supervision; no return promises; lawyer before post #1 |
| **Partnership leakage** | every deal pass-through + co-branded; pre-wire the attribution primitive before launch |
| **Trust moat** | love-stuck only (never hate-stuck); 1-2 values-aligned creator faces, not a swarm |

---

## Decided / not-yet-changed / open

- **Decided (delegated 2026-07-13):** subscription-primary (no-raise branch); "never the parent" relaxed; funded-k retired as gate. In memory `feedback_monetize_now_not_funded_k`.
- **Reversed:** the "8 growth docs → 1" consolidation. On inspection the docs are current + operational, not stale; merging would destroy live value. This doc became the front-door index instead.
- **Not yet touched (pending bless):** `REVENUE_MODEL.md`, `COMPANY_STRATEGY.md`, `MOAT_MEMO.md`, `PRICING_MODEL_OPTIONS.md`, and the pricing **code**.
- **Open:** is a raise on the table (decides free-vs-sub per the fork)? · counsel's RIA determination · the Crux 2 number.
- **Cleanup flagged, not done:** `PARTNERSHIPS_FLYWHEEL.md` still says "Kora" (naming lag; product is Kiddo, though a LOAM rename is under exploration, so hold).

---

## Sources (verified 2026-07-13)
- Greenlight: https://greenlight.com/plans · Acorns Early: https://www.acorns.com/early-invest/ · Acorns pricing: https://www.acorns.com/pricing/
- SEC finfluencer sweep: https://www.sec.gov/newsroom/press-releases/2024-121 · Sidley 2025 SEC enforcement review: https://www.sidley.com/en/insights/newsupdates/2025/10/2025-fiscal-year-in-review-sec-enforcement-against-investment-advisers
