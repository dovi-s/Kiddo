# Simplify Audit — surface area vs. the one thing that matters

**Date:** 2026-07-08
**The one test applied to every surface:** does it move **funded-k** (a gifter completing a gift → a fund getting funded → a gifter coming back) or the **at-18 handoff** (the adult-LTV prize)? If not, it is a candidate to **cut**, **defer**, or **trim**.

## The finding in one paragraph

The codebase has built a **full wealth-platform's surface area before the core loop is proven**. There is sophisticated machinery for custody, dunning/failed-charges, tax-year reconciliation, the post-18 handoff, ~13 lifecycle email drips, a 7-page SEO comparison engine, three parallel dashboards, two parallel checkout implementations, and an AI "holding stories" feed — much of it gated behind `INVESTING_LIVE=false`, counsel, an unpicked custody vendor, or a user base that doesn't exist yet. None of that is on the path to the one gate in `COMPANY_STRATEGY`: **funded-k ≥ 1**. The highest-leverage move is not more building. It is: delete the dead weight, defer everything gated on custody/counsel/scale, ship the narrow loop, and go unblock counsel + Alpaca. This is exactly what `FOUNDER_ACTION_PLAN`'s "~zero net-new code on the critical path" already says.

*(LOC figures below are explorer estimates, approximate. Anything marked ⚠︎ needs a quick verify-before-delete.)*

---

## TIER 1 — CUT NOW (dead / duplicate / inert — low-risk surface removal)

| # | Item | Where | ~LOC | Why it's safe to cut |
|---|------|-------|------|----------------------|
| 1 | **Dead membership tab** | `Settings.tsx` L4414+ | ~600 | Removed from nav, a `useEffect` already redirects to `/account?tab=plan`, self-comments "can be deleted." Canonical home exists elsewhere. |
| 2 | **Hero prototype cluster** | `StagingLandscapeHero`, `StagingCleanHero`, `HeroMoment`, `HeroPreview` page (`/hero-preview` TEMP route), `client/public/hero-proto.html` (also in `dist/public` → crawlable), `script/hero-*-shot.mjs` | ~1,100+ | Four competing hero variants + a static HTML proto for a decision that ends with **one** winner. Route self-labeled "delete once approved." Pick one, delete the rest. |
| 3 | **"Coming soon" teaser flags** | `physical_memory_book` (ON), `kiddo_card` (ON) → cards on Age18Plan | small | Advertise products that **do not exist**. Honesty risk (the brand's trust is the moat) + surface. Turn off / remove the cards. |
| 4 | **Duplicated render logic** ⚠︎ | `resolveTypeVisual`, `rewriteLegacyDescription`, `isParentPaidType`, report-issue builder, reconcile-card block — each in **2 copies** (`Activity.tsx` ↔ `activity-helpers.tsx`/`DetailHistoryModal.tsx`); **3** separate recurring-run collapse impls | ~800+ | All carry "keep in sync" comments = known debt. Consolidate to one each. Cut the duplication, not the feature. |
| 5 | **Legacy-seed copy rewriters** ⚠︎ | the regex in `rewriteLegacyDescription` / `normalizeActivityDescription` etc. | ~200 | Exists only to launder old **seed** strings ("Next attempt Aug 3…") a fresh pre-launch DB won't contain. Clean the seed data instead, then delete the rewriters. |
| 6 | **Inert / never-wired UI** ⚠︎ | `MilestoneMoment` confetti/share ("built months ago, never wired" per comment); `DetailHistoryModal` "Trade confirmation" chip (nothing populates it until DriveWealth); `DemoGiftMoment` "switch/dwell scaffolding … inert" (self-admitted dead) | ~300+ | Verify no wiring, then delete. |
| 7 | **Orphaned component files** ⚠︎ | e.g. `ThankYouManager` (import removed 2025-05, file remains) + others | ? | Sweep for `.tsx` with zero importers; delete. Pattern of files lingering after imports are cut. |
| 8 | **`Dashboard.tsx` classic** ⚠︎ (once redesign blessed) | `/dashboard-classic` | ~15k | Pre-redesign monolith, parked for rollback. Live `/dashboard` is `DashboardLab`. Delete once you're confident the redesign is permanent. |

**Cut-now, low-debate (items 1-7):** ~3-4k LOC + a crawlable dead HTML asset + several "keep-in-sync" hazards gone. Item 8 alone is ~15k more once you bless the redesign.

---

## TIER 2 — DEFER (real future value, but gated on something not-yet-true; stop investing, flag off, remove dead UI)

| # | Item | Gated on | Recommendation |
|---|------|----------|----------------|
| 1 | **Entire investing/custody scaffold** — `custodianService` (stub), `driveWealthAccountSetup` (stub), `alpacaBrokerClient` (inert), `holdingsRevaluationWorker`, `holdingStoriesCuration` (throws) | `INVESTING_LIVE` + vendor pick + counsel | Keep the minimal interface, invest **zero** more code until the vendor is chosen. The critical path here is a *decision*, not code. |
| 2 | **Holding Stories stack** — `HoldingStories.tsx` (~1,794 LOC, 100% mock), `GifterStories` prototype, curation engine | an LLM key + a news/fundamentals vendor (both unmade founder calls) | Defer the whole stack. It is not the moat; it's speculative engagement on a simulated portfolio. |
| 3 | **Failed-charge / dunning lifecycle** — spread across ~6 surfaces (StatusPill "Charge missed", HintPill, reconcile card, "Add it now" ×3, flag-off "Update card", `unresolvedFailureCount` empty-states) | real recurring charges running at volume (retry off, investing off) | **~zero real events pre-launch.** Collapse to **one** surface + **one** action. Defer the "Update card" portal path + multi-surface pill folding. |
| 4 | **Two parallel checkouts** — `CheckoutPreview` + `InAppGiftCheckoutModal` + `IN_APP_CHECKOUT` (off) + server `source:'in_app'` branch | a decision | Hosted checkout funds funds **today**. Pick ONE. Don't maintain both. |
| 5 | **Capture-at-intent** — `GiveAGift` `pendingCapture`/`cardSaved` screens + `GIFTER_CAPTURE_AT_INTENT` | counsel (MTL + broker-dealer) | Dormant-but-rendered (~90 LOC). Remove the rendered UI until counsel clears; keep the flag. |
| 6 | **Post-handoff depth** — `PreviousCustodianAccessCard`, `SuccessorCustodianCard`, owner-mode re-attribution threaded through Activity + Settings, `KidOwnerTaxSection`, `stalledHandoff`/`postHandoffEngagement` workers | a fund actually reaching 18 (years away) | Keep the **minimum** handoff path (it's the prize): `age18TransitionWorker` + `AgeTransitionVerify`. Defer the estate-planning form, the previous-custodian live/keepsake toggle, and per-row attribution polish. |
| 7 | **KidView three-age build** — Kid / Big Kid / Teen / adult phases + sealed-letter celebration | a child cohort that doesn't exist at launch | ~2,077 LOC for zero near-term users. Ship **one** phase; defer the rest. *(Founder call — this is the engagement/moat bet.)* |
| 8 | **~13 lifecycle/marketing email workers** — fundBirthday, fundAnniversary, kidMilestone, monthlyPulse, holidayWarmth, yearEndWrapped, taxSeasonPrep, volatilityReassurance, sealedLetterDelivery, gifterReturnReminder, gifterYearEnd, sponsoredSubscriptionRenewal, pmfSurvey | a user base to email | Keep only the loop-relevant few: **birthday, recurring, handoff, activation** (`parentLifecycle`). Defer/disable the rest — each is a template + trigger + worker to maintain for nobody yet. |
| 9 | **SEO / Compare apparatus** — `Compare.tsx` (7 competitor pages, ~1,075 LOC), 50-state UTMA pages, blog+stories sitemap, `test-sitemap-coverage.ts` CI | organic traffic (ramps over months) | Keep 1-2 comparison pages; cut the machinery + the brittle regex-parsing CI test. Won't move funded-k until there's traffic. |
| 10 | **Partners page** | a partner offer that doesn't exist | Orphan, `noindex`, unlinked, "an invitation not a program." Park it. |
| 11 | **Recurring editor in GifterDashboard** — edit-mid-schedule + paused-history | adoption of recurring gifts (unproven) | Comments already say "Tier-1 deferred." Ship pause/cancel only; defer edit + history. |
| 12 | **Off-flag features** — `PLAN_DOWNGRADE_SEAMLESS`, `KID_INITIATED_ONBOARDING`, `SHARED_ELEMENT_HOLDING_MORPH`, `whisper_transcription`, `STRIPE_MEDIA_TOKEN`, public-media stack (`PUBLIC_MEDIA_UPLOADS_ENABLED` + `contentScanner` + gifter `mediaPipeline`) | various | Leave off. Delete the dead client UI where cheap. Public-media-off is a deliberate, correct launch safety call (removes CSAM surface). |

---

## TIER 3 — TRIM (core-loop surfaces that are over-built; simplify to the essential)

| # | Surface | Current | Trim to |
|---|---------|---------|---------|
| 1 | **`GiftCheckout.tsx`** (3,298 LOC) — the actual gift page | 4-step wizard, 3 stock-execution models, in-browser voice recording, video upload, add-ons, countdown, guestbook | For launch: **amount → pay** (one-time card/wallet). Defer gifter-side stock-picking + media. This is the **conversion-critical** path and the demographic (grandparents) won't use a stock picker. |
| 2 | **`GiftSuccess.tsx`** (1,765 LOC) | two "you forgot X" recovery UIs, celebration theater, demo branches, recurring nudge, updates opt-in | Keep recurring-upsell + updates opt-in (the loop levers). Trim the rest. |
| 3 | **Contribution modals** (dashboard, ~3,100 LOC across one-time + recurring) | two parallel stock-picker copies; investing simulated | Default to "auto"; defer per-contribution stock-picking. De-dupe the picker. |
| 4 | **Occasions strip** (~1,500 LOC) | archive/reactivate CRUD + per-tile preview/edit; birthday real, holiday half-built | "Next occasion → share" nudge. Birthday is the real gifting trigger; ship that. |
| 5 | **Dashboard animation budget** | projection slot-spin, count-up cascade, gift-chip rise, faces cascade, confetti, 4 banner collapse anims | Hero balance count-up + one gift beat. (Founder-loved "click" — a taste call, but it's a large maintenance/perf surface.) |
| 6 | **Memory Book view modes** | Story + Timeline + **Book** (3 renderings of one dataset) | Cut/defer **Book** (you already flagged it gimmicky and demoted it) — **re-home the sealed letter/voice first**, it currently lives mostly inside Book. Consider Story-only for launch. Trim the 4-tone bulk thank-you composer to one template. |
| 7 | **`Settings.tsx`** (5,849 LOC monolith) | shell + ~40 states + inline `StrategyEditor` (~1,000 LOC) + 4 modals; 5-role branching everywhere | Extract editors out of the mega-file. Trim co-parent Viewer/Co-Admin tiering to a single "share view" for launch. |
| 8 | **`HoldingDetailSheet` (1,460) / `DetailHistoryModal` (1,035)** | exact per-gift allocation reconstruction; modal generalized for gifter/occasion/holding scopes **with no callers** | Trim `DetailHistoryModal` to the scopes actually used (schedule + contributions). Classic speculative generality. |
| 9 | **Repeated plumbing** | per-fund localStorage dismissal reimplemented **~7×**; 3 Plus-upsell surfaces on one screen; 4 banner components each re-implementing dismiss | One shared dismissal helper; consolidate upsells + banners. |

---

## TIER 4 — KEEP (the loop + trust core; protect, don't touch)

- **`GetStarted.tsx`** — fund creation → the shareable gift link. The single highest-leverage page; it mints funds and seeds the loop.
- **The gift-completion core** inside `GiftCheckout` (amount → pay) + **`GifterInvestmentRulesEditor`** (shapes the gift experience).
- **Memory Book Story view + parent composer + milestones + sealed letter/voice** — the switching-cost moat and the "hear your voice at 18" differentiator.
- **Moderation tray** — trust & safety for a stranger-facing child surface (launch-blocking, not a cut).
- **Core workers:** `recurringContributionWorker`, `gifterNotificationWorker` (birthday), `parentLifecycleWorker` (activation), `age18TransitionWorker` (the handoff).
- **Infra:** `stripeService`, `imagePipeline` (EXIF strip), `marketQuotes` (watch the stale-fallback-price trap), `VoiceNotePlayer`.
- **`Security` page** (trust/compliance), **`AgeTransitionVerify`** (small, the handoff mechanism), **`InvestCashModal` / `AddFundSheet`** cores.

---

## If you do five things this month

1. **Delete the free dead weight** (Tier 1, items 1-7): membership tab, hero-proto cluster + the crawlable `hero-proto.html`, the "coming soon" teasers, the duplicated helpers, orphaned files. Pure carrying-cost removal, ~a day.
2. **Collapse the dunning lifecycle** to one surface + one action (Tier 2 #3). Biggest LOC-per-risk win in the app — it serves a flow with ~zero real events, and touching it can't hurt a real user.
3. **Pick one checkout** (Tier 2 #4) and **defer the whole investing/custody + holding-stories scaffold** (Tier 2 #1, #2). Then the "critical path" is a vendor + counsel conversation, not code.
4. **Trim the gift page and success page** to the conversion core (Tier 3 #1, #2). This is the loop; make it fast and dumb, not feature-rich.
5. **Turn off the 9 non-core lifecycle email workers** (Tier 2 #8). One line each; removes a large future maintenance + deliverability surface for an audience of zero.

---

## Founder-owned calls (I propose; you decide)

These cuts touch founder-owned zones (demo feel, moat, the engagement/at-18 thesis, architecture) — surfaced, not slipped:
- **Dashboard triplication** (Lab live / Staging sandbox / classic rollback, ~37k LOC hand-synced). Staging is your promote-from sandbox and classic is your rollback, so this isn't a free delete — it's an **architecture** question: is three hand-synced 18k-line files worth it, or should it be one file behind a staging flag? Money-critical logic copied 3× is a correctness hazard.
- **KidView depth** and **Memory Book stories** — tied to the pre-18 engagement / moat bet.
- **Demo scaffolding** (~1,150 LOC, `demo-live-gifts` + `DemoGiftMoment`) — the demo is your conversion surface; the ask is only to **isolate it behind a hard boundary** so it can't fire for real users, not to cut the feel.
- **The dashboard animation budget** — your "satisfying click" taste call.

---

## Open strategy questions (not bugs — founder/counsel calls)

Surfaced from a portfolio review vs. Acorns (2026-07-08). The managed defaults are already cleaner than Acorns and match the VTI/VXUS/BND philosophy (VTI not VOO, one US fund not three, all-equity Growth, 3 tiers not 5). Two deliberate decisions remain:

1. **No true capital-preservation tier.** Actual presets: Growth `VTI 70 / VXUS 30` (all equity), Balanced `VTI 50 / VXUS 25 / BND 25`, Conservative `VTI 42 / VXUS 18 / BND 40`. So our *most* conservative option is still **60% equity** — there is no cash / short-Treasury floor (Acorns' Conservative is ~100% T-bills). Fine on an 18-year horizon; the real question is a fund **near the at-18 handoff**, where a 60%-equity "Conservative" could take a drawdown 18 months before the kid receives it — which the label doesn't promise. *Recommendation:* leave the three tiers as-is for launch (no fund is near 18 pre-launch — see the post-handoff defer above), but before the first cohort approaches majority, add either a genuine preservation tier or an auto-glidepath as the fund nears 18. Not urgent; do put a stake in the ground.
2. **Custom mix exposes sector/factor tilts** (`QQQ, VGT, VUG, VYM, SCHD` in `ETF_ALLOWLIST`). That's the opposite of "own the market, don't pick winners." Two mitigations already exist: they're opt-in (never in a default) and VGT was pulled from the default in May as "the most advice-like allocation." But this flows straight into the **RIA / advice-like question in `COUNSEL_ENGAGEMENT_PACKET` Part 1**, and under the simplify lens the whole custom-weights editor is a Tier-3 trim candidate (heavy UI + regulatory surface pre-launch). *Recommendation:* let counsel rule on the sector tilts; independently, consider shipping launch with fixed tiers only (no custom weights) and re-introducing Custom once the loop is proven and the RIA posture is settled.

---

## The meta-point

Every item above was individually justified when it was built. The problem is the **sum**: a product that hasn't yet proven a single gifter will fund a fund is carrying the surface area of a company that has. "Simplify" here doesn't mean lower quality — it means **subtract everything not on the funded-k / handoff path so the thing that has to be proven is the thing you're actually shipping.** The subtraction discipline is already visible in the code (removed: traditions engine, smart-nudge, sparklines, gift pill, lifecycle-email card…). This is that same instinct, applied at the level of the whole app instead of one card.
