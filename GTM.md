# Kiddo — Go-To-Market (the execution half of ARCHITECTURE_2026)

> Created 2026-05-26. The phased channel plan, the EarlyBird-orphan capture
> playbook, and the metric targets. Pairs with `ARCHITECTURE_2026.md` (how it's
> built) and `OUTREACH_KIT.md` (custody + B2B2C + lawyer send-copy).
>
> Voice per `KORA_VOICE.md`: warm, specific, real numbers, founder-honest, no
> deck-speak. Strategy framing is blunt on purpose.

---

## The thesis

**Kiddo is never *bought* by users. It is *given away* — by the people who
already love the kid (gifters) and the institutions that already serve parents
(employers/brokers). Every channel must be near-zero CAC or it is a death
sentence.** EarlyBird died acquiring parents one at a time; you will not. This
is a stack of structural distribution mechanics, ordered by leverage — not a
marketing budget.

---

## The metric spine (the only numbers that matter)

Ignore MRR, MAU, and downloads — none of them tell you whether the loop is firing. These five do:

| Metric | What it is | Target | Status |
|---|---|---|---|
| **Gifter→parent conversion** | % of gifters who then start their own fund (`gaveToOthersFundBefore`) — the loop's k-factor | **≥ 1–2%** | instrumented ✅ |
| **Free→paid conversion** | parents who convert to a paid plan (`plan_purchased`) | **beat EarlyBird's ~6%, materially** | instrumented ✅ |
| **AFRG** | active funds receiving gifts (your North Star) | trending up | dashboard exists |
| **LTV : CAC** | the survival ratio | **≥ 3 : 1** | needs live data |
| **Founding members** | pre-launch willingness-to-pay proof | toward the 1,000 cap | capture live |

If gifter→parent clears 1–2% and one B2B2C deal lands, you have a business. If
not, the EarlyBird verdict stands. Measure these from day one, obsessively.
Everything else is noise.

---

## The phasing (custody gates the real loop — so GTM splits in two)

The loop can't truly fire until real money flows (Alpaca live + RIA decision).
So:

- **Phase 0 — NOW, pre-custody (demand capture + validation, ~$0).** You cannot
  serve users yet, but you can *capture intent and build trust*: seed the first
  cohort by hand, get EarlyBird orphans onto the waitlist, run manual B2B2C
  pilots, and prove willingness-to-pay via founding-member payments. This also
  de-risks the custody spend — you walk into Alpaca and the lawyer with demand
  in hand.
- **Phase 1 — post-custody (ignition).** Turn on the real loop, convert the
  waitlist + orphans, deliver the B2B2C pilots for real, start small creator
  tests. *Now* the gifter→parent meter starts producing the number that decides
  everything.

Be honest in all Phase-0 copy: "we're building / be first," never "use us
today." You're capturing a relationship, not faking a live product.

---

## Channel 1 — The gifter loop (the ENGINE)

Built into the product. A gifter follows a link → gifts $50 → sees *"this became
real shares; it grows until they turn 18"* → some % start a fund for their own
kid or become a recurring gifter. The only channel that scales without spend.

**EarlyBird had a loop and still died — so the game is the conversion RATE, not
the gift count.** Make the loop convert:
- The post-gift moment pitches fund creation, hard: "You just gave Emma a head
  start. Start one for your own."
- The gifter dashboard nudges "start one for yours" with the visceral
  "$50 → $X at 18" projection (route through your canonical `projectFundValue`).
- Every gifter who converts is logged via `gaveToOthersFundBefore`. Watch it weekly.

**The loop needs a seed** (Channel 2 + the hand-recruited first cohort below).

---

## Channel 2 — EarlyBird orphans (the most URGENT move)

250K users, app killed June 23 2025, alienated by Acorns' forced-liquidation
migration, *searching for a dedicated alternative right now.* They already
believe in the category, already proved willingness to pay, already have the
emotional hook. The warmest, cheapest reach you will ever get — **and the
window is closing as they settle into UNest / Fidelity / grudging Acorns.**

**Honest framing (load-bearing):** you're pre-launch, so you can't migrate them
today. The play is *get on their radar + onto the waitlist now,* and be the
obvious choice at launch. Presence now → conversion at launch.

### Where they are
- Reddit: **r/acorns** (where they migrated and complain), r/personalfinance,
  r/fintech, r/investing, r/Bogleheads (custodial threads), and parenting subs
  (r/beyondthebump, r/Mommit, r/Parenting, r/financialindependence).
- The shutdown/acquisition comment threads (TechCrunch, the Jordan Wexler Medium
  posts — real people in the comments).
- Search intent: "EarlyBird alternative," "EarlyBird shut down what now,"
  "EarlyBird Acorns migration." → ship an SEO landing page (below).
- Facebook parenting/mom groups; X search "EarlyBird shut down."

### The rules (or you get banned and damage the brand)
- **Disclose you're the founder. Every time.** No astroturfing.
- **Lead with empathy/value, not a link dump.** Answer the question first.
- **Respect each sub's self-promo rules** (many need mod permission/flair). Don't
  cross-post the identical thing everywhere — Reddit flags it as spam.
- Be a real, present person for weeks, not a drive-by.

### Post copy (founder-disclosed, value-first). Fact-checked 2026-07-14, no em-dashes.
> **Title:** For families who lost EarlyBird when Acorns shut it down
>
> When Acorns bought EarlyBird last year, the standalone app closed on June 23 and
> everyone's fund got liquidated back to their bank. You couldn't move the account
> over, you had to withdraw and open a new Acorns account from scratch. Free year
> of Acorns Gold, but the part a lot of families actually cared about (a dedicated
> gifting fund for your kid, the link relatives could use, the memory time-capsule)
> got folded into a bigger app.
>
> I'm building **Kiddo**, which is that dedicated thing: a custodial fund for a
> child, one gift link family can use in about a minute with no account of their
> own, and a Memory Book where the notes, photos, and voice messages from everyone
> who gave stay put until the kid turns 18.
>
> Full disclosure, I'm the founder, and we're pre-launch, so I'd rather build this
> with people who already know why it matters. If you were an EarlyBird family, or
> just wish this existed, I'd genuinely want your input, and there are founding
> spots here: [link]. Happy to answer anything, including the honest stuff about
> what isn't built yet.

### Comment template (for existing "EarlyBird alternative?" threads)
> If what you miss from EarlyBird is the dedicated gifting fund + the shareable
> link + the memory keepsake (not just the brokerage part), I'm building exactly
> that: **Kiddo**. Full disclosure, I'm the founder, it's pre-launch, founding
> spots here if you want in: [link]. Happy to answer real questions, including what
> isn't built yet.

### SEO landing page (already built)
The orphan search intent is caught by two live pages: **`/compare/earlybird`** (the
honest side-by-side + what-to-do-next) and the **`/blog/earlybird-alternative`**
migration guide. Both were fact-corrected 2026-07-14: EarlyBird liquidated accounts
to cash, so there is NO transfer, families just fund a new Kiddo account from the
bank where that cash landed. No new page to ship.

---

## Channel 3 — B2B2C (the ACCELERANT, the CAC escape EarlyBird never pulled)

Employers (new-baby gifts) + benefits brokers (one broker = many employers). One
deal = hundreds of parents at ~zero CAC. **Validate manually now** (the free
"I'll run 10 gifts by hand" pilot), **build later** per `B2B_GIFTING_SPEC`. Full
target list + cold emails + objection handling already in `OUTREACH_KIT.md §2`.
This is the structural difference between your survival and EarlyBird's death —
weight it heavily.

---

## Channel 4 — Creators / social (the SHOW channel)

The category has no search term yet, so you can't SEO your way in — you have to
*show* the behavior. Parenting + personal-finance creators demonstrating "the
gift that compounds." **Small tests now; heavier push month 3–6** (your
Acorns-playbook discipline; shortlist: Babylist, The Bump, Cup of Jo). Your
creator-outreach kit already exists — use it, don't rebuild it.

---

## Channel 5 — SEO / satellite tools (the CATCH-NET, not the engine)

Long-tail, decision-shaped intents — grandparent-gift-tax, gift-stock-to-child,
UTMA-by-state, college-cost — as interactive tools that survive AI Overviews
because they're *doing* surfaces, not prose. You've shipped two
(robux-vs-utma, utma-by-state). Add the orphan page (Channel 2) and the
ranked candidates. Slow-burn, compounding, supplementary. Never the engine —
the head term ("how to gift stock") is unwinnable.

---

## Channel 6 — Paid ads (FORBIDDEN until LTV:CAC is proven)

This is the discipline EarlyBird violated. **Not one dollar on consumer ads
until the loop + B2B2C prove a CAC well below LTV.** Ads are how you die fast in
this category, not how you grow. Revisit only with LTV:CAC ≥ 3:1 in hand.

---

## Do-NOT-do (the moat-protecting discipline)

- ❌ **Charge gifters a per-gift fee.** It knifes the frictionless loop that is
  your only CAC advantage and cheapens the brand. (Monetize via gifter-sponsors-
  Plus, float, sub, B2B2C — never a toll on the gift. See `ARCHITECTURE_2026.md`.)
- ❌ **Buy users before the loop is proven.** See Channel 6.
- ❌ **Spam the orphan communities.** Founder-disclosed, value-first, or not at all.
- ❌ **Confuse downloads/MAU with progress.** The metric spine is the scorecard.

---

## The 90-day sequence

**Week 1 (all Phase 0, ~$0):**
- Pull Alpaca Broker API sandbox keys (10 min) + send the lawyer the RIA brief.
- Start the EarlyBird-orphan presence + waitlist capture (Channel 2). Most urgent.
- Line up 5–10 B2B2C targets (brokers first) from `OUTREACH_KIT §2`.

**Weeks 2–4:**
- Hand-recruit the first 20–50 parents (network + parenting communities) onto
  founding-members — this seeds the loop for launch.
- Send the B2B2C pilot outreach; aim for one free manual pilot.
- Ship the `/earlybird-alternative` landing page.

**Month 2–3:**
- Resolve the custody + RIA fork (self-directed vs RIA). I build the Alpaca
  integration behind the existing interface.
- Run the first manual B2B2C pilot end-to-end. Small creator tests.

**At launch (Phase 1):**
- Ignite the loop. Convert the waitlist + orphans. Deliver B2B2C for real.
- **Watch gifter→parent conversion every single week.** That number is the
  business. If it clears 1–2%, lean in hard. If it doesn't, you have your answer.

The product was never the question. Distribution at near-zero CAC is. This is
how you get it.
