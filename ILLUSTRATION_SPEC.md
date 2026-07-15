# Kiddo Illustration System — production spec

**Status:** direction locked, art not final. The current marks are hand-coded SVG placeholders (see the proof artifact). This doc is the turnkey brief to produce the **premium** set — via a professional illustrator or an image-generation pass — dropped into the same badge slots, so nothing has to be re-decided.

**North-star visual:** the published proof artifact (occasions grounded, assets logo-weight, both themes). Match its register; raise the craft.

---

## The one principle

Illustrate the **real-world concept** the thing evokes, not the financial instrument. One dominant metaphor per mark. Everything else (badge, palette, ground) exists to make wildly different objects feel like one family, recognizable in under a second.

Adopt Acorns' **system** (circular badge, one metaphor, flat limited palette, ground plane, consistent composition). Reject Acorns' **skin** (thick black outlines, children's-book clouds/bushes/trees). Copying their skin reads as a discount Acorns and undercuts counter-positioning — the one moat. Stay unmistakably Kiddo.

## Palette (exact)

| Token | Light | Dark | Use |
|---|---|---|---|
| Badge ground | `#143A2C` bottle green | `#17402F` | the circle |
| Glyph | `#F7F3EC` aged ivory | `#F7F3EC` | the main object |
| Accent | `#C68F30` brass (`#E7C173` on dark) | `#E7C173` | one gold detail per mark, never the whole object |
| Page | `#F7F3EC` | `#0B2018` | behind the badge |

Flat only. No gradients, no drop shadows, no realistic texture. Evergreen is the structural line — **never black**. Rounded shapes, friendly but restrained (heirloom keepsake, not cartoon).

## Two families (deliberately different density)

- **Occasions** — grounded little scenes. Object centered on a soft ground plane, a bit of air around it. They live alone on a dashboard tile, so they can breathe.
- **Assets** — fuller, edge-to-edge, **no ground plane**. Denser, so they read at logo weight and sit as peers beside real ticker logos in the holdings list. A grassy hill under a token next to a flat VTI logo looks wrong; don't ground assets.

## Where each lives (three levels)

1. **Occasion tiles** (dashboard, gift page): the biggest custom-illustration payoff — no logo can ever exist for "birthday."
2. **Strategy marks** (Growth / Balanced / Conservative Mix): the strategy name carries its own badge mark, distinct from holdings. Also no logo exists.
3. **Individual holdings**: use the **real ticker logo** wherever one exists (VTI, AAPL, most ETFs). A custom token is only a **fallback** — Cash, or a category rollup with no single ETF. So most holding rows are logos; tokens are the exception.

## Per-mark briefs (dominant metaphor)

**Occasions** (grounded): Birthday → cake + candles. Graduation → mortarboard + tassel. New baby → baby bottle. First home → house + key. Wedding → interlocked rings. The fund → sprout growing from the ground (ties to the Kiddo growth mark).

**Strategy** (own marks, ungrounded, glyph-forward): Growth → rising line/arrow. Balanced → scales. Conservative → shield. (Current app uses Lucide `TrendingUp` / `Scale` / `Shield` — render those concepts in the badge.)

**Asset tokens** (fallback only, fuller/ungrounded): US stocks → city skyline. International → globe + location pin. Bonds → classical treasury building. Cash → coin with `$`. Managed mix → allocation pie.

Gold-accent placement per mark: candle flames / tassel / milk / key / gem / bud / antenna / pin / coin. One per mark.

## Image-generation prompt template

> Flat vector spot illustration of **[OBJECT]**, centered in a solid circular badge (`#143A2C` bottle-green fill). Object rendered in aged-ivory `#F7F3EC` with a single antique-brass `#C68F30` accent detail (**[ACCENT]**). No outlines in black — evergreen structure only. Flat color, no gradients, no shadows, no texture. Rounded, friendly, refined (heirloom keepsake, not cartoon). [Occasions: object rests on a soft ground curve inside the badge, small amount of breathing room. Assets: object fills the badge edge-to-edge, no ground.] Recognizable in one second. Centered, square, transparent outside the circle.

Example (birthday): "…of **a birthday cake with three lit candles**, … single brass accent on **the candle flames**, … object rests on a soft ground curve …"

## Integration reality (checked in code 2026-07-08 — read before producing art)

Wiring is **not** a drop-in swap of the current placeholder SVGs. Two constraints the premium set must be designed around:

1. **The render context is a warm cover, not an evergreen badge.** Occasion visuals today come from `client/src/lib/event-cover-themes.ts`: one warm **gold/cream gradient** cover + a large centered **emoji**, reused across the dashboard occasion strip, the gift page, the `CreateEventSheet` picker, and the Memory Book strip. This warm-one-treatment look is a deliberate founder decision (they killed per-type colored gradients; "no AI slop" rule). So decide up front: **(a)** the mark REPLACES the warm cover with the evergreen badge, or **(b)** the mark sits ON the warm cover — in which case the glyph must be **evergreen + gold, not cream** (cream is invisible on the cream gradient). Design the set for whichever is chosen; don't assume the evergreen-disc background from the proof artifact.
2. **~30 keys exist; cover the core, emoji the tail.** `EVENT_EMOJI` has ~30 entries: 5 core event types (`birthday, holiday, graduation, baby_shower, just_because`), goal types (`college, car, home, travel, business, emergency`), and ~20 cultural traditions (`hanukkah, diwali, quinceanera, eid_*, lunar_new_year`, …). Produce premium marks for at least the **5 core event types + the common goals**; cultural traditions are suggestion-driven and long-tail, so they can keep emoji. Whatever the cutoff, it must not leave a *common* type (holiday!) on emoji beside illustrated neighbors.

**Then** wiring is: one `<OccasionIllustration>` component + a registry keyed on `suggestionKey / eventType / savingsGoalType` (same lookup order as `getEventCoverTheme`), returning the mark or `null` (→ emoji fallback). Do it in **`DashboardStaging.tsx` first** (staging is the sandbox; `/dashboard` = `DashboardLab` is promotion-only), verify live, promote. Strategy marks key off `lib/strategy.ts`; holdings keep real logos with tokens as fallback.

## Scope (per SIMPLIFY_AUDIT)

Illustrations are **not** on the funded-k critical path. Produce the loop-carrying few first — **birthday, graduation, new baby, the fund mark, the three strategy marks, and the Cash token** — and only extend when real occasion/category types ship. Do not build 18 up front.
