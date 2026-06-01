# SEO content clusters — build-ready plan

*Started 2026-06-01. The deliberate map for the gifter-intent (and broader)
content clusters, so articles get written on purpose with internal linking and a
clear path into the capture flow — not sprayed. Strategy + priority live in
`SEO_GTM_STRATEGY.md`; this is the execution plan. Measure by funded-k
contribution, not sessions.*

## How content actually ships (execution mechanics)

- An article is a **markdown file** in `client/src/content/blog/<slug>.md`
  (stories live in `client/src/content/stories/`). No new route, no new
  component — `import.meta.glob` picks it up (`client/src/lib/content.ts`),
  it renders at `/blog/<slug>` via `BlogPost.tsx` + `MarkdownContent`.
- **Frontmatter schema:** `title`, `description`, `publishedAt` (YYYY-MM-DD),
  `category`, `tags` (comma list), `eyebrow`, `ctaLabel`, `ctaHref`, `readTime`,
  `heroNote`. Body is markdown below the `---`.
- **Add the slug to the sitemap:** append to `BLOG_SLUGS` in `server/index.ts`
  (the server bundle can't read the client md glob, so this list is hand-kept).
- **House style (non-negotiable, anti-slop):** plain, honest, declarative. No
  em-dashes in customer copy. No hype, no "democratize generational wealth," no
  gradient-headline energy. Match the existing posts' register. Each article
  earns the CTA by being genuinely useful first.
- **CTA routing:** gifter-intent articles → `/give-a-gift` ("Give a gift that
  lasts"); parent-intent / decision articles → `/get-started` ("Start your
  child's fund").

## Cluster 1 — GIFTER intent (highest priority: own it; lowest competition)

The searches a grandparent/aunt/friend runs at gift-time. CTA → `/give-a-gift`.

**Live:**
- `best-way-to-invest-birthday-money-for-kids` (birthday money)
- `how-to-ask-family-to-invest-instead-of-buying-toys` (parent asking gifters)
- `how-to-set-up-a-fund-before-your-baby-shower` (baby shower)
- `gifts-for-a-kid-who-has-everything` (shipped 2026-06-01 — the "has everything" query)

**Gaps to write (in priority order):**
1. `investment-gifts-for-grandchildren` — query: "investment gift for a
   grandchild / grandchildren." The cool-grandparent angle (Jay/Gloria persona).
   Brief: why grandparents are the highest-LTV gifters; how to give without an
   account; the note + Memory Book; "you don't need their parents to have set up
   anything yet" (warm-promise). Links: has-everything, birthday-money.
2. `christmas-money-for-kids-invest` — query: "what to do with Christmas money
   for kids / holiday money invest." Seasonal, high-volume Q4. Brief: the
   envelope-of-cash problem; turn holiday money into one shared link; sibling
   fairness. Links: birthday-money, has-everything.
3. `how-to-give-stock-to-a-child` / `...grandchild` — query: "how to give stock
   to a child." High-intent how-to. Brief: the old way (DRS/transfer agent pain)
   vs one link; custodial/UTMA basics with a link to the education cluster.
   Links: utma-vs-529, the /tools/utma-by-state hub.
4. `meaningful-alternatives-to-toys` — gifter-side complement to the parent-side
   "ask family" post. Query: "meaningful gift instead of toys." Brief: the
   clutter problem; gifts that compound; the note that lasts.
5. `first-birthday-investment-gift` — query: "first birthday gift that lasts /
   1-year-old investment gift." Brief: longest runway = biggest compounding;
   what $X at age 1 looks like at 18 (link the at-18 calculator tool).

## Cluster 2 — PARENT intent (high volume, brutal head terms: win long-tail + comparison)

Don't fight "best custodial account" head-on (Fidelity/Schwab/NerdWallet/529s).
Win the comparison sub-cluster (already strong) + the gift-funded angle. CTA →
`/get-started`.

**Live:** the 7 `/compare/:slug` pages (EarlyBird, Acorns Early, Greenlight,
Stockpile, 529, savings account, Fidelity UTMA); `earlybird-alternative` blog;
`utma-vs-529-for-family-gifting` blog.

**Gaps:**
1. `custodial-account-for-a-child-that-family-can-gift-to` — the long-tail we
   actually own (the gift-funded UTMA), not the head term.
2. `how-to-invest-for-my-child-without-a-529` — flexibility angle; links to
   utma-vs-529 + the 529 compare page.
3. `best-investment-gift-for-a-child` — sits between parent + gifter intent;
   roundup framing that routes to the gifter cluster + /give-a-gift.

## Cluster 3 — EDUCATION / UTMA mechanics (evergreen authority; feeds 1 + 2)

CTA → `/get-started`. Authority content that earns the explainer ranking.

**Live:** programmatic `/tools/utma-by-state/:code` (51), the at-18 calculator,
the Robux-vs-UTMA + Trump-account-vs-UTMA trend-jacks.

**Gaps:**
1. `what-is-a-utma-account` — the definitional cornerstone; internally links to
   every state page + utma-vs-529.
2. `utma-vs-ugma` — the other common comparison.
3. `kiddie-tax-explained` — pair with `shared/legal-copy.ts` KIDDIE_TAX_NOTE so
   the article and the in-app copy never diverge. (Legal-sensitive: keep neutral.)
4. `what-happens-to-a-utma-at-18` — bridges into Cluster 4.

## Cluster 4 — AT-18 / kid-2.0 lifecycle (lower near-term priority; the future moat)

The graduate audience. CTA → `/get-started` (start your own) or owner re-engagement.

**Gaps (later):** `i-turned-18-with-a-custodial-account-now-what`,
`what-to-do-with-a-utma-when-you-turn-18`. Roth / banking come when those
products do.

## SEO-infra follow-ups (not blocking; documented)

- **Blog posts get no server head-SSR yet.** `server/seoMeta.ts` covers static +
  state + compare routes, but NOT `/blog/:slug` — the server bundle can't read
  the client `import.meta.glob` of markdown. So blog articles ship the generic
  shell head until `usePageSeo` runs client-side. They still rank (Google
  JS-renders the body; they're in the sitemap; the `/blog` hub links them), but
  this is the weakest spot. **Fix when it matters:** load the blog frontmatter
  server-side (read the md dir at build into a generated JSON the server can
  import) and add `/blog/:slug` to `getSeoForPath`. Gate on Search Console data.
- **Sitemap blog list is hand-kept** (`BLOG_SLUGS` in `server/index.ts`) for the
  same reason — add a slug when a post ships. The generated-JSON fix above would
  also make this automatic.

## Internal-linking discipline

Hub-and-spoke: `/blog` is the hub; every article links to 2-3 siblings in its
cluster + one cross-cluster bridge (gifter → education, education → comparison),
and ends with the cluster-appropriate CTA. No orphan posts. Cross-link the
comparison pages and the state-page hub from the relevant articles so authority
flows between the satellite surfaces we already rank for and the new content.
