# Kiddo Brand Identity — the unmistakability system

This is the source of truth for "no matter the circumstance, a glimpse of anything
of ours is unmistakably Kiddo." It sits above the character placement rules
([KADO_CHARACTER_STRATEGY.md](./KADO_CHARACTER_STRATEGY.md)) and the production
specs ([BRAND_ASSET_PRODUCTION_KIT.md](./BRAND_ASSET_PRODUCTION_KIT.md)).

## The test we are designing against

Tear off any corner. A single color swatch, one button, half a sentence of copy,
a tab favicon, a sticker on a gift message. Someone should say "that's Kiddo."
Most products believe they pass this. Almost none do. The bar is the Stripe /
Duolingo / Octocat bar: the fragment is enough.

Today Kiddo is **coherent, not yet iconic.** Nothing clashes and every surface
clearly belongs to the same product (top-1% discipline for pre-launch). But a
*fragment* is not yet enough, because the recognition-carrying assets are either
generic (DM Sans, shadcn chrome) or split (see below). Iconic recognition is
*earned through repetition* post-launch. We cannot shortcut the repetition. We
*can* make sure the assets that repeat are the ownable ones. That is this doc.

## Decision 1 — two-tier identity, split by surface

The tension: we need to be unmistakable, AND we hold a child's real money, so we
cannot let a cartoon become the face of the custody. We resolve it by splitting
the identity across two tiers, assigned by surface, not by taste.

**Trust tier** carries the serious surfaces.
- Assets: the **wordmark** (Kiddo, Bricolage, solid evergreen), the **logo mark**,
  the **evergreen + gold + cream color lock**, the type system.
- Surfaces: pricing, legal, custody / FINRA-SIPC copy, dashboards, billing, bank
  linking, withdrawals, FAQ, blog index.
- Job: "your child's money is safe here."

**Warmth tier** carries the emotional, *viral* surfaces.
- Assets: the **character** (the gold-sprout creature) and the **gift-moment
  motion** (the count-up roll + the "watch it land" beat).
- Surfaces: gift success, Kid View, milestones, share cards, select empty states,
  onboarding encouragement.
- Job: be unmistakable, and *travel*.

Why this works: **the gift moment is the ad.** Creator links land on the demo;
the gift moment rides every share. So the character rides the loop into other
people's phones, and recognition compounds at zero cost, precisely on the
surfaces where warmth (not gravitas) is the right register. The two tiers never
fight because they never share a surface. This is the same "integrate up toward
the customer, rent the rails down" logic, applied to identity.

## Decision 2 — the atomic mark is the gold sprout glyph

**The problem we found:** the atomic mark is *split*. The favicon / app icon was
a hand-drawn **K monogram with a heart**, while the mascot and the "reserved
Sprout mark" use a **gold sprout**. Two atomic marks for one brand is the literal
opposite of unmistakable. A glimpse of the tab said one thing; a glimpse of the
gift moment said another.

**The decision:** unify on the **gold sprout glyph** as the atomic mark.
- It is the product metaphor compressed to one shape: a gift, planted, that grows.
- It is in the color lock (gold on evergreen), so it carries the palette too.
- It is *already on the mascot's head*, so the favicon, the app icon, and the
  character all become the same idea at three sizes. One shape, three fidelities.
- A sprout is more ownable than a letterform. Letter-plus-heart marks are common;
  a gold sprout on deep evergreen, tied to a character, is not.

The vector lives at `client/public/sprout-glyph.svg` and as the
`<SproutGlyph>` React component (`client/src/components/ui/sprout-glyph.tsx`) for
in-app use (share-card watermark, loading, sticker corner, eyebrows).

**Shipped in this pass (additive, reversible):** the browser-tab favicon
(`favicon.svg` + `favicon.png`) now renders the sprout glyph. The K-monogram
app-icon set (`apple-touch-icon`, `icon-192`, `icon-512`, `favicon.ico`) is
deliberately *untouched* — promoting the sprout across the full app-icon set
replaces a founder-tuned mark everywhere, so it is your call, not an AI default.
When you approve it: `node script/gen-brand-icons.mjs --all` regenerates the
whole set from the one vector. Revert the favicon in one line:
`git checkout client/public/favicon.svg client/public/favicon.png`.

> Founder-owned: brand/visual identity is yours to decide. The glyph above is a
> built, eyeball-able starting point (founder is the eyes — run it, judge it,
> retune the leaf curves in the SVG to taste). It is not a claim that the mark is
> final.

## Decision 3 — the character has two fidelities, one identity

The current mascot is a glossy 3D render. It is **perfect in metaphor** (evergreen
body, gold sprout on its head, holding a gift / planting a coin) and **weak in
form for small uses**:
1. The glossy-3D-blob style is the 2024-26 AI-mascot default. The *style* is the
   opposite of ownable even though the *character* is good.
2. The planting render has a literal **Sparkle** in the corner — our banned icon
   (`lint-content.cjs`) and an AI-watermark tell. Remove it.
3. 3D does not reduce to 16px. A favicon / emoji / sticker needs flat geometry.

So the character lives at **two fidelities, unified by the glyph**:
- **Hero (3D):** gift moment, Kid View, milestone celebration. The render, kept.
- **Atomic (flat):** favicon, app icon, stickers, loading, watermark. A new flat
  2D sprite + the bare sprout glyph. Spec'd in
  [BRAND_ASSET_PRODUCTION_KIT.md](./BRAND_ASSET_PRODUCTION_KIT.md).

Same creature, same gold sprout, two levels of detail. That is how the gift
sticker, the tab favicon, and the Kid-View hero all read as one brand.

## Naming — stays unnamed in v1

Keep the existing call ([KADO_CHARACTER_STRATEGY.md](./KADO_CHARACTER_STRATEGY.md)):
no public-facing name, no "meet our mascot," alt text "Kiddo character." Internal
codename "Pip" (already in the `VITE_PIP_*` animation env vars) is fine and can be
promoted to a quiet public name *later* if the character earns it. A financial
product does not make a child's money custodian introduce itself by a cartoon
name on day one.

## Fragment audit — score each surface against the glance test

Grade = would an isolated glimpse of this say "Kiddo"? (A = unmistakable,
C = generic / could be anyone, F = says the wrong thing.)

| Fragment | Grade | Ownable? | Action |
| --- | --- | --- | --- |
| Color lock (evergreen + gold + cream) | A- | Yes. Fintech defaults to blue/black; we don't. | Hold. Guard against drift (the kora->kiddo aliasing already does). |
| The gift moment (count-up + "watch it land") | A- | Yes. No one animates a stranger's love arriving on a kid's fund. | Make it the *signature gesture*: identical motion on every value-arrival surface. |
| The character (metaphor) | B+ | Yes in concept (sprout + gift + planting). | Keep hero 3D; add flat fidelity; kill the Sparkle; fix the render's AI-blob tell over time. |
| The sprout glyph | B+ (new) | Yes. Product metaphor + color lock in one shape. | Now the favicon; eyeball + refine; promote to full app-icon set when approved. |
| Atomic mark consistency | was D, now B- | Was split (K vs sprout). | Unifying on the sprout. Finish by swapping the app-icon set. |
| Wordmark "Kiddo" (Bricolage, evergreen) | B- | Somewhat. Solid evergreen, one color everywhere (good). | Hold. The word alone is a weak common-word mark; it needs the glyph lockup to become unmistakable. |
| Typography (DM Sans body) | C | No. Beautiful but everywhere (Notion-adjacent). | Acceptable. Optionally one custom display touch in the wordmark later. |
| Bricolage headings | C+ | Mildly. Distinctive but having a moment. | Acceptable; leans on color + glyph to carry it. |
| UI chrome (cards, radii, shadows, toasts) | C | No. shadcn DNA, same as a huge cohort. | The 3-layer card shadow is craft no one consciously registers. Fine; not a recognition driver. |
| OG / social share image | C | Mixed. Stale `kado-og-image.png` / `kora-og-image.png` still present. | Delete stale-name OG assets; make the share image lead with glyph + gift moment. |

**Read of the scorecard:** recognition has to be carried by the **color lock,
the gift moment, and the sprout glyph/character** — because type and chrome never
will. Everything in this doc points those three at the surfaces that repeat.

## What shipped vs what is proposed

**Shipped this pass (code, additive, reversible):**
- `client/public/sprout-glyph.svg` — the vector atomic mark.
- `favicon.svg` + `favicon.png` — tab favicon now the sprout glyph.
- `client/src/components/ui/sprout-glyph.tsx` — `<SproutGlyph>` for in-app use.
- `script/gen-brand-icons.mjs` — regenerates the raster icon set from the vector.

**Proposed, founder-gated (your call):**
- Swap the full app-icon set to the sprout (`--all`), retire the K monogram, OR
  keep the K monogram as the wordmark lockup and the sprout as the favicon/character
  motif. Pick one atomic mark.
- Commission the flat 2D character sprite + sticker set (production kit).
- Delete stale `kado-og-image.png` / `kora-og-image.png`; rebuild the OG image.
- Remove the Sparkle from the planting mascot render.
- Promote "Pip" to a quiet public name (or not).

## The one rule

If a fragment adds recognition without reducing trust, push it onto the surfaces
that repeat. If it competes with clarity, trust, or financial seriousness, scale
it back. Unmistakable is earned by repeating the *ownable* assets, relentlessly,
on the surfaces that travel.
