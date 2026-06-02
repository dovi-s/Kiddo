# Kiddo — Complete URL / Route Inventory

*Every route the app resolves, pulled from `client/src/App.tsx` (Wouter route
table), the `/sitemap.xml` generator in `server/index.ts`, and the slug data
sources. Source of truth for "what URLs exist." Last audited 2026-06-02.*

**How to read the columns:** *Index* = whether the page sends `index, follow`
(client `getSeoForPath`) and appears in `sitemap.xml`. *Auth* = requires login
(`ProtectedRoute`). *Dynamic* = path contains a param.

---

## 1. Public / indexed marketing (in sitemap.xml)

| URL | Page | Notes |
|---|---|---|
| `/` | Home | priority 1.0 |
| `/get-started` | GetStarted | funnel |
| `/how-it-works` | HowItWorks | |
| `/give-a-gift` | GiveAGift | warm-promise gift (no card) |
| `/pricing` | Pricing | |
| `/founding-members` | FoundingMembers | |
| `/personal-funds` | PersonalFunds | waitlist |
| `/age-18` | Age18 | |
| `/faq` | FAQ | |
| `/security` | Security | |
| `/about` | About | |
| `/contact` | Contact | |
| `/legal` | Legal | terms/privacy/disclosures |

## 2. SEO satellite tools (indexed)

| URL | Page |
|---|---|
| `/compare` | Compare hub |
| `/tools/at-18-calculator` | CalculatorAt18 |
| `/tools/robux-vs-utma` | RobuxVsUtma |
| `/robux-vs-utma` | *alias* → RobuxVsUtma |
| `/tools/trump-account-vs-utma` | TrumpAccountVsUtma |
| `/trump-account-vs-utma` | *alias* → TrumpAccountVsUtma |
| `/tools/utma-by-state` | UtmaByState index |
| `/gift` | GiftLookup (enter a code) — indexable, see §13 note |

## 3. Compare pages — `/compare/:slug` (7, indexed)

`earlybird` · `acorns-early` · `greenlight` · `stockpile` · `529` ·
`savings-account` · `fidelity-utma`
Source: `COMPARISONS` in `client/src/pages/Compare.tsx`; mirrored in
`COMPARE_SLUGS` (sitemap) and `COMPARE` (`server/seoMeta.ts`).

## 4. State pages — `/tools/utma-by-state/:stateCode` (51, indexed, lowercase)

`al ak az ar ca co ct de dc fl ga hi id il in ia ks ky la me md ma mi mn ms mo
mt ne nv nh nj nm ny nc nd oh ok or pa ri sc sd tn tx ut vt va wa wv wi wy`
(50 states + DC). Source: `US_STATES` in `shared/utma.ts` — self-maintaining.

## 5. Blog — `/blog` + `/blog/:slug` (6, indexed)

- `/blog/best-way-to-invest-birthday-money-for-kids`
- `/blog/how-to-ask-family-to-invest-instead-of-buying-toys`
- `/blog/how-to-set-up-a-fund-before-your-baby-shower`
- `/blog/gifts-for-a-kid-who-has-everything`
- `/blog/utma-vs-529-for-family-gifting`
- `/blog/earlybird-alternative`

Source: `client/src/content/blog/*.md`; mirrored in `BLOG_SLUGS` (sitemap).

## 6. Stories — `/stories` + `/stories/:slug` (2, indexed)

- `/stories/emma-birthday-fund`
- `/stories/noah-baby-shower-fund`

Source: `client/src/content/stories/*.md`; mirrored in `STORY_SLUGS` (sitemap,
added 2026-06-02).

## 7. Public gift funnel (dynamic, per-fund — the conversion core)

| Pattern | Page | Notes |
|---|---|---|
| `/:fund` | GiftCheckout | a child's public gift page (user-generated slug) |
| `/:fund/:event` | GiftCheckout | gift page scoped to an occasion/event |

Reserved top-level segments (so a fund slug can't shadow a route) live in
`shared/reserved-slugs.ts`, enforced at slug-mint (`generateUniqueFundSlug`).

## 8. Auth & email-action (noindex)

`/login` · `/reset-password` · `/verify-email` · `/auth/magic` ·
`/confirm-email-change` · `/cancel-email-change`

## 9. Token / transactional one-time links (noindex)

| URL | Purpose |
|---|---|
| `/founder-claim/:token` | founding-member claim |
| `/claim/:token` | claim a gift |
| `/take-over/:token` | claim/take over a fund from custodian |
| `/invitations/:token` | accept a co-parent/collaborator invite |
| `/transition/:token` | age-18 transition invite |
| `/transition/verify/:token` | age-18 transition verify |
| `/updates/share/:token` | shared Memory Book update |
| `/updates/unsubscribe/:token` | gifter unsubscribe |

## 10. Authenticated app (ProtectedRoute, noindex)

`/dashboard` · `/profile` · `/account` · `/settings` · `/funds` · `/activity` ·
`/activity/:id` · `/activate` · `/onboard` · `/event/create` ·
`/events` (→ redirects to `/dashboard`) · `/memory` (→ redirect) ·
`/memory/:fundId` · `/projection/:fundId` · `/fund/:fundId/snapshot` ·
`/your-story/:fundId` · `/tax-documents` · `/tax-documents/explainer` ·
`/age-18-plan` · `/welcome-at-18` · `/transition/fund/:fundId` · `/admin`

## 11. Gifter / recipient surfaces

`/gifter` · `/my-gifts` (*alias* → GifterDashboard) · `/kid/:fundId` (KidView) ·
`/gift/success` (GiftSuccess)

## 12. Orphan / unlisted (noindex — not in nav, footer, or sitemap; hand out directly)

`/partners` (hospital/registry/school/employer pitch) · `/demo` ·
`/p2p-preview` · `/feedback/pmf` · `/sponsor-success`

## 13. Server-served / non-page

`/sitemap.xml` · `/robots.txt` · `/api/*` (149 endpoints — not pages) ·
`/uploads/*` (media) · `*` → NotFound (404 catch-all)

---

## Totals

- **~58 distinct route patterns.**
- **Indexable URLs in `sitemap.xml`:** ~13 core + 7 tools + **7 compares + 51
  states + 6 blog + 2 stories** = **~89 concrete URLs.**
- **Dynamic/unbounded:** public gift pages (`/:fund`, `/:fund/:event`) — one per
  fund and per event.

## Three sources of SEO truth (keep aligned)

1. **`server/index.ts` `/sitemap.xml`** — the list of indexable URLs handed to
   crawlers. Hand-maintained slug arrays: `COMPARE_SLUGS`, `BLOG_SLUGS`,
   `STORY_SLUGS` (states are programmatic from `US_STATES`).
2. **`client/src/App.tsx` `getSeoForPath`** — the per-route `robots` + title/desc
   set client-side after hydration. **This is the authoritative index/noindex
   signal** (Google renders the JS).
3. **`server/seoMeta.ts`** — the SSR head injected into initial HTML (title/desc/
   OG only; no robots). Covers static + state + compare routes.

## Audit notes (2026-06-02)

- ✅ **Fixed:** `/give-a-gift` was in the sitemap but rendered `noindex`
  client-side (fell through to the generic branch). Added an explicit
  `index, follow` case in `getSeoForPath`.
- ✅ **Fixed:** story children (`/stories/:slug`) were absent from the sitemap;
  added `STORY_SLUGS` with a sync comment.
- ✅ **Orphans verified:** `/partners`, `/demo`, `/p2p-preview`, `/feedback/pmf`,
  `/sponsor-success` all render `noindex` and are absent from the sitemap —
  intentional.
- ✅ **Fixed:** `/gift` (thin "enter a code" utility) was `index, follow` but not
  in the sitemap — flipped to `noindex, follow` so an empty form page can't get
  indexed as thin content.
- ✅ **Fixed:** the aliases `/robux-vs-utma` and `/trump-account-vs-utma`
  self-canonicalized → duplicate content with their `/tools/` originals. Added
  `CANONICAL_OVERRIDES` in `App.tsx` so each alias's canonical now points at the
  `/tools/` URL (alias stays `index, follow` to resolve inbound links).
- 🟡 **Deliberately deferred (NOT a bug):** blog/story article pages get the
  generic SSR head (only `getSeoForPath` fixes the title post-hydration). Full
  body-snapshot prerender is the documented next step and is **optional per
  `SEO_GTM_STRATEGY.md`** — escalate only if Search Console shows these pages
  aren't indexing. Building a server-side markdown-frontmatter SSR path now would
  contradict that locked decision and add a drift-prone hand-maintained map, so
  it's intentionally left as documented future work, not done here.
