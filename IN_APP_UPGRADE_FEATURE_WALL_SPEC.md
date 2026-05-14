# In-App Upgrade Feature-Wall Spec

The single highest-leverage UX improvement on the conversion side
that has NOT been built. Surfaced by the strategic pricing review
and validated in the 2026-05-14 audit. This spec scopes the work
so the next focused session can execute against it cleanly.

## The problem

Today, when a parent on Free hits a feature that requires Plus or
Family, the friction-removal path is unclear. Most surfaces either:

- **Silently fail** (the feature is hidden if you're not paid for it)
- **Show a generic "upgrade" link** that routes to `/pricing` or
  `/settings?tab=membership`, both of which are full tier-comparison matrices
- **Show a one-line note** like "Requires Kiddo+" with no context

None of these convert. The full pricing matrix asks the parent to
re-evaluate the entire decision when they were trying to do one
specific thing. The silent fail or one-liner doesn't tell the
parent what they'd unlock.

## The right shape

The notes captured the pattern correctly. When the parent hits a
feature wall, the modal/sheet that fires should be:

- **Specific to the feature they just tried.** "Auto-invest is a
  Kiddo+ feature. Set $25/month and Emma's fund grows on autopilot.
  Forever." NOT "Compare our 3 tiers."
- **Single primary CTA.** "Unlock for $4.99/mo" (or the locked
  pricing for whatever tier the feature requires).
- **Single secondary link** to the full matrix for the rare
  comparison-shopper. "See all Plus features."
- **Calm.** Apple-Settings register. Not a marketing pitch.
- **Respectful of the moment.** The parent was trying to do
  something. Acknowledge it, name the friction, name the price,
  move on.

## Touchpoint inventory

Every in-app surface that gates a paid feature. Each one needs a
contextual wall configured for it. The locked feature-tier
breakdown per `MEMORY.md`:

### Plus-gated features

| Feature | Where it surfaces today | Current friction shape |
|---|---|---|
| Recurring investments | Dashboard "Growing automatically" section + setup flow | Hidden behind a setup CTA that opens an upgrade prompt |
| Parent-authored Memory Book media (photo/video/voice) | NoteEditorSheet, Dashboard composer (3 instances), Age18Plan parent letter | `requiresPlus` prop on `MemoryMediaPicker` per the locked 2026-05-13 audit; behavior unknown until verified |
| Custom fund mix (pick own stocks) | Activate flow / fund settings | Hidden or disabled in Free |
| Co-parent access | Per-fund settings "Invite a co-parent" | Section visible with "Requires Kiddo+ or Family" eyebrow per Settings.tsx:1578 |
| Priority support | Settings | Marketing claim, not a gated feature |

### Family-gated features

| Feature | Where it surfaces today | Current friction shape |
|---|---|---|
| Second fund creation | AddFundSheet | Plan-check + upgrade prompt step |
| Memory Book authoring for additional kids | NoteEditorSheet for second+ kid | Same as Plus parent-authored media but extends across multiple kids |
| Unlimited occasions | Event creation | Active-occasion-count gate; surfaces as `EventGateModal` |

## What "right" looks like per feature wall

Two distinct shapes depending on whether the parent has ever
considered the feature before.

### First-time encounter (most common)

The parent tries to use the feature for the first time. The wall
needs to:
1. Acknowledge what they were trying to do
2. Explain what the feature does in 1-2 sentences
3. Show the price
4. Show the single CTA
5. Give a "not now" escape that doesn't punish

Example for recurring investments:

```
Recurring investments is a Kiddo+ feature.

Set a monthly amount and Emma's fund grows on autopilot.
Forever. Never miss a month.

[ Unlock for $4.99/mo · or $39/yr ]
[ See all Plus features ]
Not now
```

### After they've already dismissed once

If the parent already saw the wall for this feature and dismissed
it, surface a softer version next time. Don't repeat the explainer;
just the price + CTA.

```
Recurring investments unlocks with Kiddo+.

[ Unlock for $4.99/mo ]   [ Maybe later ]
```

State tracking via `localStorage` or `dismissedWalls` JSONB column
on `users` (similar to `funds.dismissedNudges` for action items).

## Implementation scope

### Reusable component

A single `<FeatureWallModal>` component that takes:

```ts
type FeatureWallProps = {
  open: boolean;
  onClose: () => void;
  featureId: string;          // for state tracking + analytics
  requiredTier: "plus" | "family";
  title: string;              // e.g. "Recurring investments is a Kiddo+ feature."
  body: string;               // 1-2 sentence value prop
  upgradePath: string;        // /settings?tab=membership&upgrade=plus&fund=X
  secondaryLink?: string;     // /pricing
};
```

Single component used by every gated feature. Variant logic
(first-time vs repeat) handled internally.

### State tracking

`users.dismissedFeatureWalls` JSONB column:
```json
{
  "recurring_investments": "2026-05-14T12:00:00Z",
  "memory_media": "2026-05-15T09:00:00Z"
}
```

Component reads/writes via existing user-profile patch endpoint.

### Touchpoint wiring

Each surface that currently gates a paid feature replaces its
existing friction-shape (silent fail / generic link / one-liner)
with a `<FeatureWallModal>` invocation. Inventory above.

### Analytics

Track per-wall conversion to inform copy iteration:
- `feature_wall_shown` (featureId, requiredTier)
- `feature_wall_dismissed` (featureId, requiredTier, dismissalCount)
- `feature_wall_clicked_upgrade` (featureId, requiredTier)
- `feature_wall_clicked_secondary` (featureId, requiredTier)

## Recommended ship order

Each phase is independently shippable.

### Phase 1: build the reusable component + ship one touchpoint (1-2 days)
- Build `FeatureWallModal` with the full props + state tracking
- Wire the first touchpoint (suggest: recurring investments, since
  it's the highest-leverage Plus feature per the locked Plus
  eyebrow "for the parent who shows up every month")
- Add the `dismissedFeatureWalls` column to `users`
- Ship + measure conversion delta vs the previous friction shape

### Phase 2: wire the remaining Plus touchpoints (2-3 days)
- Parent-authored Memory Book media (3 composer instances)
- Custom fund mix
- Co-parent access (already has its own card; replace with modal)

### Phase 3: wire the Family touchpoints (1-2 days)
- Second fund creation (replace AddFundSheet upgrade-step)
- Memory Book authoring for additional kids
- Active-occasion-count gate (replace EventGateModal)

### Phase 4: variant testing (ongoing)
- A/B test copy variants per high-traffic wall
- Iterate based on conversion data

## Why this matters

Pricing-page edits move the needle on first-touch conversion (the
stranger who lands on `/pricing`). The contextual feature wall
moves the needle on **already-engaged users at the moment of
felt-need**. That's the highest-quality conversion moment in the
funnel:

- The parent KNOWS what they want (the feature they just tried)
- The price is contextualized against the value they were about
  to get
- The friction is removed in one tap

Industry data on this pattern: contextual upgrade walls convert at
3-8x the rate of generic "see pricing" links because the value is
self-evident. For Kiddo specifically, this could be the single
biggest conversion-rate lever in the model.

## What's NOT in this spec

- **The actual modal copy for each feature.** Will be defined per
  touchpoint during implementation. Each one is its own copy call.
- **Pricing changes.** Out of scope. The wall surfaces current
  locked pricing per `MEMORY.md`.
- **Free-trial flow integration.** The 14-day reverse trial fires
  on signup, not on feature-wall encounter. Could be a future
  variant ("try this feature free for 14 days") if conversion data
  shows the price-first version stalls.
- **Mobile parity.** Mobile doesn't have action-items UI yet; the
  feature-wall pattern there is its own design call.

## Triggers to revisit this spec

- A real spike in feature-gated friction support tickets
- Conversion data from any one touchpoint shipped showing the
  pattern works (or doesn't)
- A new paid feature shipping that needs its own wall
- The pricing structure changes meaningfully (would update modal
  copy across all walls)

## References

- Internal: `MEMORY.md` Subscription Plans section (locked tier
  feature breakdown)
- Internal: `client/src/pages/Pricing.tsx` (the full marketing
  pricing page; secondary-link target from any feature wall)
- Internal: `client/src/pages/Settings.tsx:4255` (`settingsTab ===
  "membership"`; upgrade-trigger surface today)
- Internal: `client/src/components/MemoryMediaPicker.tsx` (already
  has `requiresPlus` prop; first candidate for refactor to use
  the new modal)
- Internal: `client/src/components/EventGateModal.tsx` (existing
  pattern for one specific case; can be folded into the unified
  modal)
- External strategic context: the 2026-05-14 pricing-review notes
  identified contextual feature wall as the single biggest UX win
  on the conversion side that hadn't shipped
