# Kiddo Character Strategy

> Parent doc: [BRAND_IDENTITY.md](./BRAND_IDENTITY.md) is the source of truth for
> the overall identity (the two-tier system, the sprout glyph, the two character
> fidelities). This doc is the detailed **placement rulebook** for the character
> within the warmth tier: where it appears, where it must not, and the emotional
> range. The two stay in sync.

## Decision

The Kiddo character is a product element, not the brand itself.

The logo remains the primary trust mark.
The character exists to add warmth, encouragement, and celebration inside the product.

This decision is binding for v1: the character should support moments, not lead the brand.

## Why

Kiddo is a children's investing and gifting product.
That means it needs:
- emotional warmth
- but also financial trust

Making the character the whole brand would create unnecessary trust risk.
Using the character as a product element gives Kiddo warmth without weakening credibility.

## Naming

The character does not need a public-facing name right now.

Guidance:
- internal codename is fine
- user-facing copy should not require users to "meet" the character
- externally it should simply function as the Kiddo character
- do not use "Pip says" or other named-character framing in public product copy
- default alt text should be "Kiddo character"

## Where It Should Appear

Primary placements:
- child view
- gift success
- milestone celebration
- selected empty states

Secondary placements:
- onboarding encouragement
- gentle educational surfaces
- lightweight prompts where reassurance helps

Approved v1 contexts:
- `child-view`
- `gift-success`
- `send-success`
- `getstarted-success`
- selected `MascotMoment` empty states in Events, Activity, and Memory Book

Review-required contexts:
- public gift lookup
- public memory share
- app loading
- onboarding hero moments

These can use the character if it reduces anxiety or helps orientation, but the logo and copy still carry the surface.

## Where It Should Not Appear

Avoid using the character as a leading element on:
- pricing
- legal and compliance pages
- FAQ and support pages
- blog and editorial index pages
- billing management
- bank linking
- withdrawal flows
- dense analytics or portfolio management views
- homepage hero or top-of-funnel conversion hero

## Visual Requirements

The character should be:
- abstract rather than literal
- warm rather than childish
- expressive without needing words
- readable at small and large sizes
- compatible with Kiddo's gold-forward system

It should not feel like:
- a cartoon mascot for kids only
- a joke inside a serious product
- a replacement for the logo
- a named assistant users must understand before using Kiddo

## Emotion Set

The character only needs a tight emotional range in v1:
- celebration
- encouragement
- curiosity
- empathy

It should not be over-personalized or overly chatty.

## Rollout Rule

V1 should use the character in only a few places consistently.

That is better than scattering it everywhere.

## Do / Don't

Do:
- use the character after meaningful progress
- use it to explain concepts to children
- use it in empty states where encouragement helps
- keep copy direct and useful when the character is present

Don't:
- introduce the character by name in product copy
- place it above pricing, legal, billing, or compliance content
- use it as a substitute for clear instructions
- use it to make risky financial actions feel playful

## V1 Rollout Plan

### Phase 1: Clean Up
- Remove public named-character copy.
- Set shared alt text to "Kiddo character."
- Remove the character from FAQ/blog-leading positions.
- Keep mascot usage in child view, gift success, and select empty states.

### Phase 2: Standardize
- Audit every `Mascot` and `MascotMoment` usage by context.
- Add context naming that matches product purpose, not page leftovers.
- Keep a short approved-context list in this document.

### Phase 3: Deepen
- Add one reusable celebration pattern for gifts and milestones.
- Add one child-view explanation pattern.
- Add one empty-state encouragement pattern.

### Phase 4: Native App
- Translate the same character rules into native app loading, haptics, and Live Activity design.
- Do not expand mascot placement until the first three patterns feel excellent.

## Implementation References

Current repo surfaces related to the character:
- `client/src/components/ui/mascot.tsx`
- `client/src/components/ui/mascot-moment.tsx`
- `client/src/lib/brand-assets.ts`
- `client/src/pages/KidView.tsx`
- `client/src/pages/Send.tsx`

The atomic mark (the unifying piece) lives in:
- `client/public/sprout-glyph.svg` (vector source of truth)
- `client/src/components/ui/sprout-glyph.tsx` (`<SproutGlyph>` in-app)
- `script/gen-brand-icons.mjs` (regenerates the raster icon set)

## Final Rule

If the character adds delight without reducing trust, keep it.

If it starts competing with clarity, trust, or financial seriousness, scale it back.
