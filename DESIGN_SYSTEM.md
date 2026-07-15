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

## 9. Enforcement — the operational layer (2026-06-25 whole-app design sweep)
The §1-8 spec is right; a 6-agent sweep confirmed the gap is purely that components
**bypass** it. The tokens exist (radius scale in index.css, motion in `lib/motion.ts`,
`.kiddo-card`); the drift is inline overrides. Found app-wide: ~24 font sizes
(`text-[10.5px]`…), ~10 radii (`rounded-2xl` on cards = NOT in scale; should be
`var(--radius-card)` 20px), ~11 shadows, 3 motion sources, and `share-modal.tsx` = 1,200
lines of raw `style={{}}`. Plus two near-duplicate sheet primitives and 3 close patterns.

**The migration sequence (build new clean, don't tweak chaos):**
1. **Primitives first** — collapse `dialog.tsx` + `sheet.tsx` → one sheet/modal; one
   `ModalCloseButton` (44px) everywhere; `share-modal.tsx` off inline → utilities; one
   `<SectionHeader>`. This is the leverage point; everything else migrates against it.
2. **Surface by surface** — replace inline `text-[…px]`/`rounded-[…]`/`rounded-2xl`(cards)/
   inline `boxShadow`/inline `duration:`/`cubic-bezier(` with the tokens. Render-verify each.
3. **One motion language** — toasts use the sheet easing; reveals expand (don't snap);
   lists stagger 50–80ms; chevrons rotate with content.

**The endgame = a design-lint guard** (extend `lint-content.cjs`) that bans: `text-[…px]`,
inline `style={{ fontSize }}`, `rounded-[…]` + `rounded-2xl` on cards, inline `boxShadow`,
inline `duration:`/`cubic-bezier(` in JS. Until it lands, §1-9 IS the PR review checklist.
Hold the line: ~6 type sizes, 5 radii, 3 shadows, one motion language, one of every component.

## 10. Mobile is NOT desktop — and the mobile app IS the web app (founder, 2026-06-25)
**Critical context:** the React Native app (`apps/mobile/`) is **RETIRED**. The shipping
mobile surface is the **web app wrapped in Capacitor + installable as a PWA** (pivot 2026-06-17;
RN "can only approximate a web app the founder loves, never match it"). So "make mobile feel
native" does NOT mean a separate native build — it means **the web app's phone experience must
feel native-grade, because on a phone it literally IS the app.** This is good news: one
codebase, and this work CONVERGES with the whole design-system effort.

The bar: a parent who installs Kiddo should never think "this is a website in a shell." The
web app at its mobile breakpoint must feel born-on-the-phone, using the responsive layout +
Capacitor APIs (`@capacitor/status-bar`, haptics, safe-area). Non-negotiables:
- **Thumb zone.** Primary actions live in the bottom third (reachable one-handed). Don't put
  the main CTA at the top because the web does.
- **Sheets, not center-modals.** Everything is a bottom-sheet that slides up and **drags down
  to dismiss** (momentum + rubber-band), never a centered web dialog.
- **Native gestures.** Swipe-back, swipe-to-dismiss, pull-to-refresh, long-press. The OS
  conventions, per platform (iOS edge-back vs Android back).
- **Platform haptics** on every meaningful tap/confirm/landing (light/selection/success).
- **Safe areas + insets.** Respect the notch and home indicator; nothing under them.
- **Touch, not hover.** No hover-dependent affordances; ≥44px targets; instant press feedback.
- **Native-feeling motion + scroll.** Page transitions that read like push/slide on the phone
  breakpoint, not desktop fades; momentum scroll; the gift-landing choreography tuned to feel
  native on touch.
- **Less density, bigger type.** A desktop layout merely shrunk reads cramped on a phone; the
  mobile breakpoint gets its own air, thumb-reachable actions, and bottom-sheet patterns.
The failure mode is NOT "it's the website" (it is, by design) — it's "this is the **desktop**
layout shrunk." If the phone view feels like a scaled-down desktop instead of a native app,
it failed. Same content, phone-native composition.
