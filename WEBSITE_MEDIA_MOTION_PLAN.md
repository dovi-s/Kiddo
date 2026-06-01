# Website media + motion plan — how and when

*Written 2026-06-01. The intentional plan for adding images / video / ambient
loops + the mascot to the marketing site, and the motion that frames them — so
it lands at "millions-spent" quality. Companion to `feedback_animation_primitives.md`
(locked motion rules) and `project_public_surface_design_audit_clean` (the site
was already audited clean — design is not the launch bottleneck).*

## The principle: restraint is the luxury signal

Top-tier sites feel expensive because of **restraint, consistency, and
performance** — not because every section moves. The fastest way to make this
site look cheap is to spray animations and stock imagery across it. So:

- **A few media moments that earn their place** beat media on every section.
- **One motion vocabulary**, used everywhere: fade-and-rise on scroll (once),
  count-ups, staged reveals. No sparkles, confetti, badges, or parallax tricks
  (banned per `feedback_no_ai_slop` / `feedback_animation_primitives`).
- **Reduced-motion is non-negotiable.** Every motion path has a still fallback;
  ambient loops show their poster to `prefers-reduced-motion` users.
- **Real families > stock.** Authentic photos/voice/video are the moat texture
  you can't fake; generic stock reads as cheaper than no image at all.

## The how: one primitive, already built

`client/src/components/ui/MediaReveal` (`media-reveal.tsx`) is the single way to
drop in any image / video / ambient loop:
- Reserves the aspect ratio first → **zero layout shift (CLS)**.
- Fade-and-rise on scroll, once, reduced-motion-safe (matches Home's `<FadeIn>`).
- Ambient loop ("gif") = muted, inline, autoplay — and **swaps to its poster for
  reduced-motion users**. Lazy-loaded images, async-decoded.
- Empty `src` renders a labeled placeholder slot, so a page shows where media
  goes during build instead of collapsing.

Existing primitives to reuse, not reinvent: `FadeIn` (Home), `Mascot`
(`ui/mascot.tsx`, already supports video + still), framer-motion `useReducedMotion`.

**Asset guardrails (the part that actually makes it feel expensive):**
- Video: keep under ~2-3 MB, always supply a `poster`, ambient loops are silent.
- Consistent aspect ratios per surface (16/9 hero, 4/5 portrait, 1/1 product).
- One visual language: same corner radius, same shadow, same reveal timing.

## The where: per-page media map (each moment must earn it)

| Surface | The one or two moments that earn media | Primitive |
|---|---|---|
| **Home — hero** | An ambient, silent **family loop** (a real moment: a grandparent on a phone, a kid's face) behind/beside the headline. The single highest-ROI media on the site. | MediaReveal `ambient` + poster |
| **Home — Memory Book** | A **real screenshot** of the Memory Book (the entries already mocked in copy), so the emotional claim is shown, not told. | MediaReveal image, 4/5 |
| **Home — Kid View** | One **Kid View screenshot** ("you own Disney") to make the kid experience concrete. | MediaReveal image |
| **How it works** | A short **product walkthrough clip** (create fund → share link → gift lands) OR 3 still shots, one per step. | MediaReveal `controls` clip, or 3 stills |
| **Stories** | **Real family photos / a short video** as they come in. Until real, leave text — do NOT stage fake families. | MediaReveal image/video |
| **Pricing** | None. Pricing converts on clarity, not imagery. Keep it clean. | (text only) |
| **Compare / satellite (UTMA-by-state, calculators)** | None / a single explanatory diagram at most. These rank on content; media slows them. | (text only) |
| **At-18 / Age-18** | The emotional peak: a **mockup of the at-18 handoff screen** the kid sees. One moment, done well. | MediaReveal image |
| **About** | A founder/team photo if real; otherwise none. | MediaReveal image |

**Mascot policy:** sparingly, at emotional beats only — hero, empty states, the
at-18 moment, the demo. Never decorative filler on every section (that's the
slop tell). It already exists; use it as punctuation, not wallpaper.

## The when: sequencing (this is the part that matters)

1. **Now (done):** the `MediaReveal` primitive + this plan. **No page edits** —
   the polish backlog is frozen to the five launch must-haves, and a parallel
   agent is live across these exact marketing files. Spraying media now would
   collide and pull focus from the launch gate (custody + counsel).
2. **Single owner, not two agents.** When this executes, ONE owner does the
   media pass end to end. Two agents animating the same pages is how a site gets
   an inconsistent, half-finished feel — the opposite of the goal.
3. **Tier 1 first (highest emotional ROI), once unfrozen:** the Home hero family
   loop + the Memory Book screenshot. These two carry most of the weight.
4. **Tier 2:** Kid View shot, How-it-works walkthrough, the At-18 mockup.
5. **Tier 3 / as real assets arrive:** Stories (real families only), About.
6. **Gated on real assets.** The plan is ready so execution is fast + consistent
   the moment you have the photos/clips — but real, authentic media is the input
   that makes it land. Don't ship stock as a placeholder for soul.

**Bottom line:** the foundation (primitive + guardrails + map) is in place so the
media pass is a fast, consistent, accessible drop-in when it's the right time —
which is after the launch must-haves, with one owner, using real family assets.
Brilliance here is the discipline of *when*, not just *what*.
