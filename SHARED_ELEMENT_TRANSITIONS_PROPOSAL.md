# Shared-Element Transitions — Proposal

> Status: **proposal** (founder-owned — architecture + taste). 2026-06-25.
> The last 1% between Kiddo and "indistinguishable from Apple/Airbnb."

## What it is

A shared-element transition (a.k.a. "magic move" / hero transition) is when an
element that exists on **both** the source and destination animates **between**
its two positions/sizes — instead of the destination fading or sliding in as a
flat new surface. Tap a holding row → its icon + ticker + value **glide and scale
up into the detail header.** Tap a gifter → their face **flies to the top of
their story.**

It's the single signature that separates "great app" from "Apple/Airbnb-tier":
the UI feels **spatially continuous** — you're moving *through one connected
space*, not swapping screens. It's also the one thing on the craft checklist
Kiddo doesn't have yet (the transitions, nav, cache, prefetch, and per-tap press
feedback are all already top-tier).

## You already own the engine

Framer Motion's `layoutId` does exactly this: put the **same `layoutId`** on an
element in screen A and screen B, and Framer automatically animates the transform
between them when one replaces the other. **Kiddo already uses this** — the
bottom-nav active pill (`layoutId="mobile-nav-active-pill"` in `MobileNav.tsx`)
slides between tabs by precisely this mechanism. So this is **not** a new
dependency or a foreign technique — it's extending a pattern that's already live,
tuned, and loved on the most-used surface in the app.

## Two architectures — and they are NOT equal

Kiddo has two kinds of drill-in, and the cost differs by an order of magnitude.

### 1. Sheet / modal drill-ins — EASY. Do these. (80% of the magic, 20% of the cost)

Most of Kiddo's detail views are **sheets/modals**: `HoldingDetailSheet`, the
Activity row-expand, `DetailHistoryModal`, `GiftersAcrossFundsSheet`,
`CreateEventSheet`, etc. The source card and the sheet are **in the same React
tree at the same time** — so a shared `layoutId` "just works" with **no routing
change at all.**

Highest-value targets, ranked — **with the 2026-06-27 investigation result:**

1. **Holding row → `HoldingDetailSheet`** — the holding's logo morphs up into the
   sheet header. ✅ **BUILT + verified** (flag `SHARED_ELEMENT_HOLDING_MORPH`). The
   `StockLogo` has no competing animation, so the morph is clean. This is the
   most-used drill-in on the dashboard and the ideal first (and maybe only) target.
2. **Gifter avatar → gifter detail** (`selectedGifter` sheet) — the *warm* one.
   ⚠️ **Riskier than it looked.** The roster avatar (`DashboardLab` ~10760) is
   *already heavily animated*: a visibility-driven cascade, `kiddo-gifter-avatar-pulse`,
   `kiddo-face-bloom`, `whileHover`, `whileTap`. Layering a shared-element `layoutId`
   on top would *fight* those animations and likely jank. Doable, but needs careful,
   iterative tuning by eye — not a blind wire-up. Hold until the holding morph is felt.
3. **Memory entry card → detail** — ❌ **no clean pair.** Memory entries expand
   *in place*; there's no separate detail view with a header element to morph into.
4. **Occasion tile → `CreateEventSheet`** — ❌ **no clean pair.** The tile's cover
   art is not shared with the sheet (the sheet builds its own hero), so there's no
   common element to animate.

**Honest takeaway:** the "roll it to all four" plan was over-optimistic before
checking each target's element pair. In reality only **one** is a clean, low-risk
morph (holding). That's not a disappointment — it's the *restraint principle from
this very doc proving itself*: a shared-element morph should be reserved for the one
or two most meaningful drill-ins, and here it's one. Better one perfect morph than
four contested ones.

### 2. Route-to-route drill-ins — HARD. Defer. (maybe never)

A morph **between routes** (dashboard → `/projection`, a card → a full page)
needs both pages' shared elements alive **simultaneously** during the transition.
`NavTransition` deliberately does enter-only (no `mode="wait"`), and its own
comment already flags true two-sided parallax as "a separate architecture change"
needing per-page scroll containers. **Do not start here.** Lower ROI, far higher
risk (scroll jank, layout thrash, the 15k-line `DashboardLab`).

## The phased plan

- **Phase 1 — one sheet, on staging, behind a flag.** Prototype **Holding row →
  HoldingDetailSheet**. Tune the spring, the duration, and *what* morphs (just the
  icon? the whole card? only the value?). This is the taste call to make **once**.
- **Phase 2 — roll the template.** Apply the proven recipe to the other 3 sheet
  targets. Each is the same small diff: a shared `layoutId` on the source element
  + the sheet's header element, inside the existing `AnimatePresence`.
- **Phase 3 — maybe never.** Route-to-route morphs, only if Phase 1–2 prove the
  appetite *and* the per-page-container refactor earns its cost.

## The recipe (Phase 1, concretely)

```tsx
// Source (the holding row in the dashboard list):
<motion.div layoutId={`holding-${ticker}`} /* icon + ticker + value cluster */ />

// Destination (HoldingDetailSheet header), same id:
<motion.div layoutId={`holding-${ticker}`} /* the header's icon + ticker + value */ />
```
Framer animates the cluster from row → header automatically when the sheet mounts.
Wrap the pair so both are under one `AnimatePresence`; scope the `layoutId` to the
**small icon/value cluster**, never a large subtree (layout animation measures +
transforms every frame).

## The honest risks (this is why it's founder-owned)

- **Over-animation.** The line between "magical" and "nauseating" is real.
  Shared-element morphs must be **reserved** for the one or two most meaningful
  drill-ins — not every tap. Restraint *is* the craft here.
- **Reduced-motion.** Hard-disable (fall back to today's clean sheet slide) under
  `prefers-reduced-motion` — the same guard the nav + `NavTransition` already honor.
- **Layout cost.** Scope each `layoutId` narrowly; on the heavy dashboard a wide
  layout animation will jank.
- **It's a taste call.** Whether the *icon* morphs, or the *whole card*, or just
  the *value* — that's a founder eye, not an AI default. Build one, feel it, decide.

## Recommended first move

Prototype **Holding row → HoldingDetailSheet** on `/staging` behind a flag: one
contained, fully-reversible diff, instantly feel-able. If it lands, it becomes the
template for the other three sheet targets — and that's the whole magic, shipped
without ever touching the route architecture.
