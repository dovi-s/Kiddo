# Activity / Event Information Architecture

**Status:** Phase 1 shipped 2026-06-03 (`feat/gifter-recurring-management-and-launch-polish`).
**Origin:** Founder review of Acorns' activity surfaces — "they make sense wherever
you're looking, but it's all the same thing. We have many versions and they're
not all the same."

## The diagnosis (grounded in the code, not vibes)

Acorns' trick is **resolve an event's meaning once, render it at different
densities.** Kiddo was ~80% there structurally (one `activities` table, a
`DetailHistoryModal` reused in 5+ places, History/Pending/Scheduled tabs) but the
*meaning layer* had been copied and had drifted into **four disagreeing label
maps**:

| Surface | File | Problem |
|---|---|---|
| Feed (reference, most complete ~60 types) | `client/src/pages/Activity.tsx` (`getTypeConfig`) | The de-facto canonical taxonomy. |
| Detail modal + Dashboard | `client/src/lib/activity-helpers.tsx` (`getTypeConfig`) | Stale subset; minor label drift. |
| Deep-link detail page | `client/src/pages/ActivityDetail.tsx` (own `getTypeConfig`) | Worst drift: "Investment" vs feed "Recurring investment"; "Gift Received" vs "Gift received"; "Sold" vs "Portfolio". **Tapping a feed row landed on a differently-named page.** |
| Native app | `apps/mobile/src/screens/ActivityTab.tsx` | Crude substring matching; different data contract. |

So the issue was **vocabulary drift, not pixel drift, and not a missing
component.** The fix is a single source of truth for *meaning*, placed in
`shared/` like `legal-copy.ts` / `strategy.ts` / `projection.ts` already are.

## What shipped (Phase 1)

### `shared/activity-semantics.ts` (new — the single meaning layer)
Pure TS, zero JSX. Exports:
- `canonicalLabel(type)` — the ONE user-facing string per activity type. Mirrors
  the reference (`Activity.tsx`) exactly, returns `null` for uncovered types so
  callers keep their own fallback.
- `mapActivityTypeToCategory` / `mapItemToCategory` / `isParentContributionItem`
  — the filter-bucket logic (Gifts / Yours / Portfolio / Milestones).
- `GIFT_TYPES` / `AUTO_TYPES` / `GROWTH_TYPES` / `MILESTONE_TYPES` / `isInternalOnlyType`.

### Web surfaces converged onto it (label = `canonicalLabel(type) ?? legacy`)
- `Activity.tsx` — inner config renamed `resolveTypeVisual`; a `getTypeConfig`
  wrapper sources the label from canonical, keeps every color/icon. **Zero visual
  change** to the reference (except the bug fix below).
- `activity-helpers.tsx` — same wrapper → DetailHistoryModal + Dashboard match the feed.
- `ActivityDetail.tsx` — label from canonical; **the tap-through mismatch is gone.**

### Status reaches the detail page (seam: `activities` has no status column)
Status is server-derived from the linked **gift row** in `/api/activities`
(`routes.ts` ~10805). The detail endpoint `/api/activities/:id` was **omitting**
it, so the deep-link page showed no status pill. Fixed: `:id` now mirrors the
list's gift-status rule, and `ActivityDetail` renders the existing shared
`StatusPill` — same Pending/Invested/Processing pill as the feed row.

### Bug fixed along the way
`gifter_recurring_paused/resumed/cancelled` are in `GIFT_TYPES`, so the feed's
`GIFT_TYPES.includes()` check short-circuited *before* their dedicated branches —
those rows rendered the generic **"Gift received"** and their intended labels were
dead code. `canonicalLabel` checks them first, so they now read "Gifter
paused/resumed/cancelled recurring" everywhere. (Icon/color for those 3 rare rows
is still gift-toned — trivial follow-up.)

### Verification
`tsc` (web) clean · `mobile:check` clean · `lint:content` (77 files) clean.

## Deliberately NOT done (and why)

- **NotificationsPanel** — left alone. The bell renders server `title`/`description`
  (not these type-labels) in a distinct emoji register, and its
  `BELL_EXCLUDED_TYPES` / action-item logic is *bell policy* documented to stay
  aligned with server `actionItems.ts`. Centralizing = regression risk on an
  attention-critical surface for ~zero visible gain.
- **Forcing the shared module into mobile** — Metro doesn't resolve the `@shared`
  tsconfig alias at runtime (that's why `apps/mobile/src/api.ts` re-declares server
  types), and the native Activity tab reads a *different* `type` vocabulary
  (`gift`/`sell`/`withdrawal` from `dashboard-summary.transactions`) than the web
  activity vocabulary. A forced import would be a runtime red-screen risk.
- **A DB `activities.status` column** — unnecessary. Status already has a single
  server-side source (the gift row); the gap was the detail endpoint not carrying
  it, now fixed. A migration would touch 56+ money-flow write sites for no benefit.

## Tracked follow-ups (Phase 2, optional)

1. **Mobile → `/api/activities`.** Repoint `ActivityTab` at the activity feed
   (instead of `dashboard-summary.transactions`) and `extraNodeModules`-map
   `@shared` in `metro.config.js`, then import `canonicalLabel`. This is the only
   path to true web↔native label unity. Until then, keep mobile's strings matching
   the canonical wording (noted at `ActivityTab.tsx labelFor`).
2. **Dedupe the two `StatusPill` components** (`Activity.tsx` inline ~809 vs
   `activity-helpers.tsx` exported). Presentation-level; low priority.
3. **Finish the gifter_recurring_* visual** — give those 3 rows their intended
   icon/palette in `resolveTypeVisual` (label already fixed).

## The principle, for future work
Add a new activity type → give it a `canonicalLabel` entry and a category bucket
in `shared/activity-semantics.ts` **first**. Every surface reads meaning from
there; surfaces own only their visual register (feed = rgb tiles, detail = HSL,
mobile = Ionicons, bell = emoji). Never re-invent labels locally.
