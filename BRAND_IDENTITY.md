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

## Decision 2 — the atomic mark stays the K monogram (the sprout glyph was tried and rejected)

**The problem we found:** the atomic mark is *split*. The favicon / app icon is a
hand-drawn **K monogram**, while the mascot carries a **gold sprout** on its head.
Two atomic marks for one brand is the literal opposite of unmistakable. A glimpse
of the tab says one thing; a glimpse of the gift moment says another.

**What we tried, and why it's dead:** to unify on one shape, we hand-authored a
gold **sprout glyph** and wired it as the favicon. It was rejected on sight — a
three-leaf green sprout on a children's *financial* product reads as a cannabis
leaf. The glyph files (`sprout-glyph.svg`, `<SproutGlyph>`, `gen-brand-icons.mjs`)
were deleted and the favicon set reverted to the **K monogram** — now a crisp
white-K-on-evergreen tile from founder-supplied art, committed.

**The lesson (load-bearing):** do not have the AI draw the brand mark blind. The
mark is a designer / image-gen job with the **founder as the eyes**. A blind
attempt risks exactly this kind of unintended read. (The same rule the design lab
already runs on: AI builds motion/structure/plumbing; pixel-craft of an identity
mark it cannot.)

**So the atomic mark is the K, for now — and the split is still open.** Reverting
the favicon correctly killed the bad glyph, but it re-opened the K-vs-sprout split
named above. Resolving it (one mark that works at 16px *and* ties to the
character) is the real remaining unmistakability question. It is a **founder +
designer decision**, not an AI default, and not launch-gating: iconic-ness is
earned by post-launch repetition (Decision 1), and the assets that already repeat
(color lock, gift moment, character) carry recognition in the meantime. Do **not**
ship another AI-drawn mark to force a resolution.

## Decision 3 — the character has two fidelities, one identity

The current mascot is a glossy 3D render. It is **perfect in metaphor** (evergreen
body, gold sprout on its head, holding a gift / planting a coin) and **weak in
form for small uses**:
1. The glossy-3D-blob style is the 2024-26 AI-mascot default. The *style* is the
   opposite of ownable even though the *character* is good.
2. The planting render's literal **Sparkle** (our banned icon, an AI-watermark
   tell) is **removed** — replaced with clean transparent art (no white box, no
   sparkle), committed.
3. 3D does not reduce to 16px. A favicon / emoji / sticker needs flat geometry.

So the character lives at **two fidelities**:
- **Hero (3D):** gift moment, Kid View, milestone celebration. The render, kept.
- **Atomic (flat):** favicon, app icon, stickers, loading, watermark. Today this
  is the **K monogram**; a flat 2D character sprite is the open production-kit item
  ([BRAND_ASSET_PRODUCTION_KIT.md](./BRAND_ASSET_PRODUCTION_KIT.md)). The earlier
  plan to use a bare *sprout glyph* as the atomic fidelity is dead (Decision 2).

How the gift sticker, the tab favicon, and the Kid-View hero finally read as one
brand depends on resolving the K-vs-sprout atomic question (Decision 2) — a
founder + designer call.

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
| The character (metaphor) | B+ | Yes in concept (sprout + gift + planting). | Keep hero 3D; add flat fidelity; Sparkle removed; fix the render's AI-blob tell over time. |
| Atomic mark consistency | D (still split) | Favicon = K, mascot = sprout. | Open founder + designer call: resolve to ONE mark. Not via an AI-drawn glyph (Decision 2). |
| Wordmark "Kiddo" (Bricolage, evergreen) | B- | Somewhat. Solid evergreen, one color everywhere (good). | Hold. The word alone is a weak common-word mark; it needs the mark lockup to become unmistakable. |
| Typography (DM Sans body) | C | No. Beautiful but everywhere (Notion-adjacent). | Acceptable. Optionally one custom display touch in the wordmark later. |
| Bricolage headings | C+ | Mildly. Distinctive but having a moment. | Acceptable; leans on color + mark to carry it. |
| UI chrome (cards, radii, shadows, toasts) | C | No. shadcn DNA, same as a huge cohort. | The 3-layer card shadow is craft no one consciously registers. Fine; not a recognition driver. |
| OG / social share image | C | Mixed. Stale `kado-og-image.png` / `kora-og-image.png` still present. | Delete stale-name OG assets; make the share image lead with the mark + gift moment. |

**Read of the scorecard:** recognition has to be carried by the **color lock,
the gift moment, and the character** — because type and chrome never will.
Everything in this doc points those three at the surfaces that repeat.

## What's settled vs what is proposed

**Settled (the brand-mark experiment, reverted):**
- The hand-drawn sprout glyph (`sprout-glyph.svg`, `<SproutGlyph>`,
  `gen-brand-icons.mjs`) was rejected and **deleted**.
- The favicon / app-icon set is the **K monogram**, regenerated crisp
  (white-K-on-evergreen) from founder-supplied art and committed.
- The planting mascot's Sparkle is removed (clean transparent art, committed).

**Proposed, founder-gated (your call):**
- **Resolve the atomic mark:** pick ONE (the K, or a properly *designed*
  sprout/character motif) so the favicon and the character stop saying different
  things. Designer + your eyes, never another AI-drawn mark.
- Commission the flat 2D character sprite + sticker set (production kit).
- Delete stale `kado-og-image.png` / `kora-og-image.png`; rebuild the OG image to
  lead with the mark + gift moment.
- Promote "Pip" to a quiet public name (or not).

## The one rule

If a fragment adds recognition without reducing trust, push it onto the surfaces
that repeat. If it competes with clarity, trust, or financial seriousness, scale
it back. Unmistakable is earned by repeating the *ownable* assets, relentlessly,
on the surfaces that travel.
