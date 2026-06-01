# Acquisition / GTM channel strategy — gifter-first, loop-fed

*Locked 2026-05-31. The honest channel priority + the gifter-intent SEO plan +
the prerender decision, so none of it gets re-litigated. Companions:
`MOAT_MEMO.md` (counter-positioning), `memory/project_growth_loop_engine_and_measurement.md`,
`memory/project_creator_outreach_assets_kit.md`, `BOOTSTRAP_VS_FUND.md` (funded-k).*

## The one principle

**Go after the people who bring the parents — never the parents directly.**
The gifter is our customer; everyone else's cost. Parent-direct **paid**
acquisition is the EarlyBird trap ($200+ CAC, 20-25mo payback, $1 in = 30¢ out).
Every *paid* channel is judged by one metric: **does it feed funded-k (≥1)** —
does a dollar/hour produce a *funded* gift that pulls a parent in and seeds more
gifters? Traffic that doesn't feed the loop is cost dressed as growth.

**The crucial scope (don't conflate the two cost structures):** "never parents
direct" is a rule about **paid** acquisition, where CAC can exceed LTV. **Owned
SEO / content is the opposite kind of cost** — near-zero marginal CAC, durable,
compounding. So on the SEO surface we go after **every** audience — gifter,
parent, education-seeker, the at-18 adult — because all of them feed the same
loop + relationship at ~$0 incremental cost, and a parent who finds us
*organically* (no CAC) then becomes a loop seed herself. Gifter-intent is where
we **start and weight heaviest** (highest intent, lowest competition, cheapest
loop seed), **not** the only target. "Heavy, deep SEO for all" is correct *as an
owned-asset play*; it does not reopen the paid-CAC discipline.

## Channel priority stack (fastest payback first)

1. **Creators / influencers** — the planned wedge. Fastest, highest-fit, the
   unpaid trusted salesforce at scale. **Near-term heavy effort goes here.**
   (Kit: `project_creator_outreach_assets_kit`.) Discipline: never pay gifters
   to refer; never charge gifters.
2. **The loop itself** — make every gift-link + share moment maximally viral.
   Mostly product, mostly built. Free. Keep polishing the share/“watch it land”
   surfaces.
3. **Registry partnerships (Babylist et al.)** — seeds both sides of the loop.
   Gated by custody + legal + a `partnerSource` attribution primitive.
   Medium-term. (Plan: `project_babylist_integration_plan`.)
4. **SEO / owned content** — the patient compounding asset. Build the foundation
   NOW (long lead to rank), scale the traffic push only once the funnel can
   convert (custody live + capture-at-intent legal-gate cleared). **Not the
   launch engine** — pretending it is would pull focus from the real gates.
5. **Paid parent acquisition** — the trap. Avoid.

## Why SEO is patient capital, not a launch lever

- SEO is a 6-18 month compounding asset. It will not drive launch week.
- The funnel can't fully transact yet (no custody; capture-at-intent is
  flag + legal gated). Pouring optimized traffic in now wastes it.
- BUT ranking takes months, so we **seed the foundation now** and scale later.
  "Build the asset" ≠ "make it the engine."

## The SEO cluster map — all audiences (built in this order)

Owned content targets **every** audience, because each feeds the loop +
relationship at ~$0 CAC. Build/weight in this order — by *intent value ×
winnability*, not by audience importance:

1. **GIFTER intent** *(start here — highest intent, lowest competition, cheapest
   loop seed)*. The searches a grandparent/aunt/friend runs at gift-time:
   "meaningful gift for a 1-year-old", "gift for the kid who has everything",
   "investment gift for a child", "how to give stock to a grandchild", "baby
   shower gift that lasts", "alternative to toys". Almost no one targets this
   well → ours to own. → gift-idea + how-to content → `/give-a-gift` + gift link.
2. **PARENT intent** *(high volume, MORE competitive — win the long-tail + the
   gift angle, not the head terms)*. "custodial account for kids", "best
   investment account for a child", "how to invest for my child", "UTMA vs 529".
   Head terms are brutal (Fidelity/Schwab/NerdWallet/529s) — don't fight them
   head-on; win the **comparison + decision** sub-cluster (already started,
   `/compare/:slug`: vs EarlyBird, Acorns Early, Greenlight, Stockpile, 529,
   savings account, Fidelity UTMA) where we own the framing, plus the
   gift-funded angle competitors don't have. Organic parents have no CAC and
   become loop seeds — fully on-strategy.
3. **EDUCATION / UTMA-mechanics** *(evergreen authority; feeds 1 + 2)*. "what is
   a UTMA / UGMA", "kiddie tax", "age of majority by state". Already started:
   programmatic `/tools/utma-by-state/:code` (51), at-18 calculator, the
   Robux-vs-UTMA / Trump-account-vs-UTMA trend-jacks. Build the topical cluster
   around them so we rank as the explainer, then route to the funnel.
4. **AT-18 / kid-2.0 lifecycle** *(lower near-term priority; the future moat)*.
   "I turned 18 with a custodial account", "what to do with a UTMA at 18", and
   later Roth / banking. Captures the kid-2.0 lifetime relationship audience.

Every cluster internally links toward a capture flow and is **measured by
funded-k contribution, not sessions.**

What we already have (don't rebuild): `/compare` + 7 comparison pages,
`/tools/utma-by-state` + 51 state pages, at-18 calculator, the two
trend-jack comparison tools, `usePageSeo` (per-page title/description/canonical/
robots), robots.txt with private surfaces disallowed.

## Foundation fixes — order of operations

1. **Sitemap (DONE 2026-05-31).** The satellite pages were built but absent from
   `/sitemap.xml` (it listed only 5 routes) — search engines weren't told they
   exist. Now includes every public/satellite page + all 51 state pages
   (self-maintaining from `@shared/utma`) + the 7 comparison pages.
   (`server/index.ts`.)
2. **Head-level SSR (DONE 2026-05-31).** The problem was: production served one
   identical `index.html` head for **every** route (`server/static.ts`), and
   `usePageSeo` only fixed it client-side *after* hydration — so non-JS crawlers
   (social cards, LLM crawlers, Google's first wave) saw a generic "Kiddo" shell
   on every page, and most public pages had no per-page title even client-side.
   Now the static server injects a correct per-route
   `<title>`/description/canonical/OG into the **initial HTML** for the public
   marketing + satellite routes, from a server-side authority table
   (`server/seoMeta.ts`: static routes + all 51 state pages + the 7 comparison
   pages, titles mirroring the client pages). App/private/dynamic-gift/404 routes
   fall through to the unchanged shell. No build change, no new deps, no
   hydration risk (client upserts the same tags). This is the high-value,
   low-risk subset of prerendering and it shipped without touching the build
   pipeline.
3. **Full body-snapshot prerender — OPTIONAL next step, measure first.** Head SSR
   fixes metadata; the page *body* is still client-rendered (Google renders JS,
   so body content is indexable, just on the slower second wave). Only escalate
   to full static-HTML snapshots (headless-Chrome crawl of the public route list
   at build, e.g. react-snap, writing `dist/public/<route>/index.html`) **if
   Search Console shows the satellite *content* isn't getting indexed.** Don't
   pay the Puppeteer/Chromium-in-CI + hydration cost speculatively — the head-SSR
   above is likely enough for the comparison/tool/state pages. Decision deferred
   to data, not pending on the founder.
4. **Topical clusters (then).** Build out the audience clusters above
   deliberately, internally linked, each with a clear path into the capture
   flow. Measure by funded-k contribution, not sessions.

## Guardrails

- Never charge gifters; never pay gifters to refer (kills the trust that makes
  the loop work).
- Don't geo-gate — the gifter loop is inherently cross-state (`COUNSEL_ENGAGEMENT_PACKET`
  Part 7); any soft launch is cohort/invite-gated, not geographic.
- Don't let SEO scope-creep into the launch sprint. Foundation now; volume later.
