# Design Constitution — cut / keep / merge map

Grounded audit of `client/src/index.css` (2,333 lines) + the shared UI layer,
written against the actual file (line numbers are real). This is the de-risked,
executable version of the Codex design critique: it keeps the good kernel and
drops the inflated scope.

**Headline finding:** the token layer is already disciplined — motion tokens,
spacing scale, and accessibility-justified colors are documented and coherent.
This is NOT a teardown. The real work is a handful of bounded consolidations,
most of which shift pixels on founder-tuned surfaces and therefore need your
eyes, not an AI sweep.

Legend: ✅ done · 🟢 safe/mechanical (no visual change) · 🟡 pixel-shifting (needs
founder review) · 🔴 founder taste call (do not touch without sign-off)

---

## ✅ DONE — dead code removed (no visual change, verified)

- **`glass` card variant + `.glass-effect` CSS** — `0` consumers
  (`variant="glass"` used nowhere). Removed from `card.tsx:7,14` and
  `index.css` (was ~1182-1191). `tsc --noEmit` clean. This was the only
  unambiguously-dead design language; `glass-effect` was a single orphaned card
  variant, not a live surface.

---

## Elevation (shadows) — winner already exists

The 3-tier system Codex asked for is already built and adopted:
`shadow-premium-sm` / `shadow-premium` / `shadow-premium-lg`
(`index.css:1210-1225`, used in **59 files**). That IS the canonical elevation
language. Nothing to invent.

- 🟡 **Ad-hoc `box-shadow` in index.css component classes** (e.g. `:675, :716,
  :727, :738, :759, :784, :790, :796, :828, :908, :1061`). Each was hand-tuned
  (`0 8px 24px -20px rgba(24,33,28,0.22)` etc.) and does NOT equal a premium
  tier. Folding them into the 3 tiers WILL change how those specific surfaces
  (hero/lab cards, FABs) read. Recommend: migrate only after you see each
  rendered. Not a blind sweep.
- 🔴 **Decorative glow shadows** (`:635-637` gold pulse keyframe, `:1136`,
  `:1139`, `:1300` gold glow) — these are motion/brand moments, founder-owned.
  Keep.

## Radius — two scales, both intentional

- `index.css:10-13` — `--radius-sm/md/lg/xl` (Tailwind `@theme`, derived from
  `--radius: 0.625rem`). Powers shadcn `rounded-{sm,md,lg,xl}` utilities.
- `index.css:226-230` — semantic scale `--radius-container/card/inner/control/pill`
  = `24 / 20 / 14 / 10 / 9999`. Used directly on product surfaces.

These are not duplicates (different values, different consumers). The mess is the
**raw px radii scattered in component classes** (`18px`, `28px`, `30px` at
`:712, :723, :769, :779, :807, :824, :887`).

- 🟡 **Migrate raw px → nearest semantic token** (`28→24`, `30→24`, `18→14`).
  Pixel-shifting on those surfaces; recommend after render check.
- 🔴 **Collapsing the two token families into one** — would change what every
  `rounded-*` utility resolves to app-wide. Not worth the blast radius. Keep both;
  just stop adding raw px. **Rule going forward:** product surfaces use the
  semantic scale, shadcn primitives keep the Tailwind scale.

## Typography — the one real Codex hit, but founder-owned

- 🔴 **Global letter-spacing sledgehammer** (`:81-84` zero all `--tracking-*`,
  then `:283-330` force `letter-spacing: 0` on nearly every element AND
  `!important` on every tracking utility incl. arbitrary `[class*="tracking-["]`).
  This neuters the system's own ability to ever track anything. It's clearly an
  intentional "one consistent type texture" decision — but it's enforced with a
  hammer that would surprise any future contributor. **Typography is founder-
  owned; flagging, not flipping.** Decision needed: keep the global zero (and
  document *why* so it reads as intent, not accident), or relax to real type
  roles. See "Type roles" below if you want roles.
- 🟢 **Optional, additive:** define named type-role utilities (`display-xl`,
  `heading-md`, `body-md`, `metric`, `label`…) as Codex suggested. This is purely
  additive (new classes), changes nothing until adopted, and gives future work a
  vocabulary. Low risk, real value. Awaiting go.

## Motion — tokens exist; the gap is adoption, not volume

- ✅ Motion tokens are already defined and well-documented (`:93-122`:
  `--duration-instant/fast/normal/slow`, `--ease-out-expo/in-quad/out-back/spring`).
- 🟢 **Real gap:** components hardcode inline durations (`0.2s`, `200ms`) instead
  of the tokens. A mechanical codemod (inline → token where values match) is
  no-visual-change and worth doing. Awaiting go.
- 🔴 **Codex's "cut motion dramatically" / "demote the hero choreography"** —
  rejected. The hero count-up + digest cascade is already rip-out-and-rebuilt,
  locked, and Playwright-verified; framer motion is a founder-loved taste choice.
  Do NOT blanket-trim. Per-surface only, with founder eyes.

## `gemini-*` — intentional subsystem, NOT drift

Codex framed this as a competing "personality" to delete. It's actually a real,
imported component library: `client/src/components/ui/gemini.tsx` exports
`GradientText`, `GeminiHeroGradient`, `ThinkingOrb`, `EnlighteningReveal`,
`ProcessingState`, `SuccessState` — imported in **15 files** including `App.tsx`
itself, plus Login / Onboard / Pricing / Claim / About / FoundingMembers / Demo.

Ripping it out breaks live conversion surfaces. This is a **founder scope call**:

1. **Keep + freeze (recommended):** leave existing usage, add no new gemini
   surfaces. Lowest risk; it earns its place on hero/auth moments.
2. **Contain:** consciously narrow to 1-2 signature surfaces; replace the rest
   with premium primitives. Real work, per-surface review.
3. **Fold in:** absorb the gradient/glow vocabulary into the premium language.
   Biggest effort, only if you want exactly one visual voice.

No action taken pending your pick.

- 🟡 **The gemini CSS kit is over-built.** `gemini.tsx` only ever applies three
  classes (`gemini-text-gradient`, `gemini-btn-primary`, `gemini-ring`); ~25
  others (`gemini-glow`, `gemini-orb`, `gemini-card-soft`, `gemini-energy-border`,
  `gemini-glass`, `gemini-divider`…) have no traceable consumer, and standalone
  utilities like `pb-safe` / `focus-ring` also scan as orphaned. There IS real
  dead CSS here — but a grep-based purge is unsafe (classes hide in `cn()`
  concatenation, `@apply`, dynamic template strings, and `apps/mobile`). A
  correct purge needs **build-time CSS coverage** (e.g. PurgeCSS / Chrome
  coverage against the built app), not pattern-matching. Deferred until that's
  wired — not worth a blind deletion that silently regresses an unseen surface.

---

## Recommended execution order (once approved)

1. ✅ Dead glass — done.
2. 🟢 Add type-role utilities (additive) + 🟢 motion-token codemod (mechanical).
   Both no-visual-change; safe to greenlight together.
3. 🔴 You decide: tracking sledgehammer (keep+document vs relax) + gemini scope.
4. 🟡 Then, with render checks, migrate ad-hoc shadows + raw-px radii on the
   surfaces you approve.

What I deliberately did NOT do (and why): no dashboard/Memory Book/Kid View/
age-18 rebuild (founder-owned signature surfaces, and launch isn't design-
blocked), no motion cuts on tuned surfaces, no gemini removal, no typography
flip. Those are taste/architecture calls — proposals, never silent edits.
