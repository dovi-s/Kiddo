# Kiddo Design System — derived from first principles

> Written 2026-06-19 by deriving the design from **what Kiddo is**, not from what
> the code currently does. Every rule has a *because*. Where the current code
> already obeys a rule, it's marked KEEP (it survived scrutiny — now we know
> why). Where it doesn't, it's marked FIX (accreted default, not a decision).
> Companion: `DESIGN_CONSTITUTION.md` audits the existing CSS; this is the north
> star it should converge to. Rule going in: a label ("locked", "deliberate") is
> not a reason — only first principles are.

## 0. What Kiddo is (everything below is forced by this)
Money + a child + family + **generations** + **legacy** + **trust**. The felt
experience should be a beautiful family heirloom — a handwritten letter, a
savings passbook from someone who loves you — made modern. Primary users skew
**older** (grandparents are the highest-value actors) and **emotionally
motivated**, not finance-natives.

## 1. The seven principles (everything obeys these)
1. **Consistency is trust.** A product holding a grandchild's money cannot look
   sloppy; inconsistency reads, subconsciously, as "can I trust them?" → one
   scale for everything, no drift.
2. **Depth from light.** Premium = clear layered surfaces (canvas → card →
   elevated), not flat. Trust products feel *physical* and calm.
3. **Restraint.** Few accents, much whitespace, no decoration that doesn't carry
   meaning. Every element earns its place.
4. **Human-first composition.** Lead with the child, the people, the story — not
   charts/numbers. We sell love made concrete, not a trading terminal.
5. **Readable for grandparents.** Generous type, strong contrast, big targets,
   simple density. If a 70-year-old struggles, it failed.
6. **Calm, purposeful motion.** Movement rewards the emotional beats (a gift
   landing, the count-up) — never gratuitous.
7. **Honesty over theater.** Never animate a loss as a gain or imply liveness
   that isn't real. Trust is the moat.

## 2. Color — KEEP (survives first principles)
Warm cream + evergreen + gold is *correct* for warm/trust/generational money —
cold fintech blue/white would be wrong. The palette is not the problem; its flat
execution was.
- **Canvas:** warm cream. **Cards:** crisp near-white, clearly lifted off the
  canvas (FIX: card↔canvas lightness gap was 2% → widened; see depth).
- **Evergreen:** primary / trust / growth. **Gold:** value + celebration only,
  used *sparingly* as an accent, never as filler or decoration.

## 3. Surfaces & depth — FIX (the core "not premium" cause)
One elevation ladder, used everywhere:
- **Canvas** (cream, deepened so cards read) → **Card** (near-white + soft
  present shadow, the workhorse) → **Elevated** (modals/sheets, stronger shadow)
  → **Hero** (evergreen, the one dark surface — already premium, KEEP).
- Depth comes from **shadow + a clean edge**, not heavy 1px boxes. Soften borders
  where shadow now carries the lift. No surface should be ambiguous about which
  layer it's on. (Started: stronger card shadow + deeper canvas, render-verified.)

## 4. Type — KEEP the choices, FIX the tuning
- **Bricolage Grotesque** (headings) + **DM Sans** (body), self-hosted. Warm,
  human, readable — correct, KEEP.
- **One modular scale** (e.g. 12/14/16/20/24/32/48), real hierarchy, generous
  line-height. Sizes biased large for older eyes.
- **Tracking — QUESTION the accreted zero.** Everything is forced to
  letter-spacing:0 (an accreted default, not a designed call). First principles:
  big headings want slightly *tight* (~-0.02em) for craft; small uppercase labels
  want slightly *wide* (~+0.04em) to breathe. Reconsider, founder eye on it.

## 5. Spacing & radius — FIX (drift = the consistency failure)
- **Spacing:** one 4px-based scale (4/8/12/16/24/32/48). No off-grid values.
- **Radius:** one scale — pill / control(10) / card(16–20) / container(24). Kill
  the scattered raw 18/28/30px. (Two token families exist; product surfaces use
  the semantic scale, shadcn primitives keep the Tailwind scale — don't mix.)

## 6. Motion — KEEP, with discipline
Use the existing motion tokens (durations/eases) consistently — no hardcoded
inline durations. Calm by default; the count-up / gift-landing / digest cascade
are the *earned* flourishes. Respect reduced-motion.

## 7. Restraint — FIX (audit the decoration)
Question the **gemini gradient/glow kit**: ~25 unused classes, a second visual
voice competing with the premium-card language. Per principle 3, either narrow it
to 1–2 signature moments or fold it in. Two visual voices = the "off" feeling.

## 8. The honest keep/fix ledger
- **KEEP (earned):** cream/evergreen/gold palette, Bricolage+DM Sans, human-first
  composition, the evergreen hero, calm motion, honesty discipline.
- **FIX (accreted, not designed):** flat surface depth, radius/shadow drift,
  letter-spacing sledgehammer, gemini decoration sprawl, hex-vs-token drift.

The foundations survived scrutiny. The *execution and consistency* are the work.
That's the whole diagnosis: Kiddo doesn't need a rebrand — it needs its own brand
executed with rigor.
