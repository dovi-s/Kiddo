# Acquisition / GTM channel strategy — gifter-first, loop-fed

*Locked 2026-05-31. The honest channel priority + the gifter-intent SEO plan +
the prerender decision, so none of it gets re-litigated. Companions:
`MOAT_MEMO.md` (counter-positioning), `memory/project_growth_loop_engine_and_measurement.md`,
`memory/project_creator_outreach_assets_kit.md`, `BOOTSTRAP_VS_FUND.md` (funded-k).*

## The one principle

**Go after the people who bring the parents — never the parents directly.**
The gifter is our customer; everyone else's cost. Parent-direct paid acquisition
is the EarlyBird trap ($200+ CAC, 20-25mo payback, $1 in = 30¢ out). Every
channel below is judged by one metric: **does it feed funded-k (≥1)** — does a
dollar/hour of effort produce a *funded* gift that pulls a parent in and seeds
more gifters? Traffic that doesn't feed the loop is cost dressed as growth.

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

## Gifter-intent SEO — the cluster plan

The win is intercepting the **gifter at the moment of intent** — the searches a
grandparent/aunt/friend runs at gift-time. Three intent clusters, all pointing
at a capture flow (`/give-a-gift`, the comparison/tool pages, the gift link):

1. **Gift-occasion intent** (highest-intent, build first): "meaningful gift for
   a 1-year-old", "gift for the kid who has everything", "investment gift for a
   child", "how to give stock to a grandchild", "baby shower gift that lasts",
   "alternative to toys". → gift-idea + how-to content → `/give-a-gift`.
2. **Comparison / decision intent** (already started — `/compare/:slug`):
   vs EarlyBird, Acorns Early, Greenlight, Stockpile, 529, savings account,
   Fidelity UTMA. Keep expanding; this is bottom-funnel and we own the framing.
3. **UTMA / education intent** (already started — programmatic + tools):
   `/tools/utma-by-state/:code` (51 pages), at-18 calculator, Robux-vs-UTMA,
   Trump-account-vs-UTMA (trend-jacking). Build out the "what is a custodial
   account / kiddie tax / UTMA vs UGMA vs 529" topical cluster around them.

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
2. **Prerendering — the real ceiling-raiser (DECISION PENDING, founder).** The
   app is a client-side SPA: `usePageSeo` injects title/description/content
   **after** JS loads, with no SSR/prerender. Google can render JS (slower,
   weaker); most social + LLM + non-Google crawlers cannot. **This is the #1
   structural cap on any heavy SEO push.** Until it's decided, satellite content
   will under-rank relative to effort.
   - **Recommended:** prerender (static HTML snapshots) the **marketing +
     satellite routes only** (home, how-it-works, pricing, compare/*, tools/*,
     utma-by-state/*, blog/*, stories/*, faq, about, security) — NOT the
     authed/dynamic app. Options: a prerender step in the build (e.g.
     react-snap / a headless-Chrome crawl of the public route list), or move
     these routes to a lightweight SSR/SSG layer. App routes stay SPA.
   - Hold heavy content production until this is decided, so the work isn't
     spent on pages that can't rank.
3. **Topical clusters (then).** Build out the three intent clusters above
   deliberately, internally linked, each with a clear path into the capture
   flow. Measure by funded-k contribution, not sessions.

## Guardrails

- Never charge gifters; never pay gifters to refer (kills the trust that makes
  the loop work).
- Don't geo-gate — the gifter loop is inherently cross-state (`COUNSEL_ENGAGEMENT_PACKET`
  Part 7); any soft launch is cohort/invite-gated, not geographic.
- Don't let SEO scope-creep into the launch sprint. Foundation now; volume later.
