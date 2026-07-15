# Kiddo Voice — the teaching layer (Form, audit, plan)

*2026-06-09. The durable spec for how Kiddo teaches: a voice that is a FORM,
not a character. Distilled from the "greatest-teachers" working session
(Language Transfer / Mihalis, Eddie Woo, 3Blue1Brown as the reference for
guided discovery). Companion to `COMPOUNDING_NARRATIVE_NOTE.md` (the honest
7%-net math + banned figures), `KID_VIEW_PRINCIPLES.md` (no-gamification),
`shared/gift-lessons.ts` (the authored-but-dark curriculum). Founder-owned:
this is a PROPOSAL surface. Mark it up; nothing in product copy changes until
you approve the Form, and no code wires until you say go on the curriculum.*

---

## 0. The two open decisions (everything hangs off these)

1. ~~Approve the Form?~~ **APPROVED 2026-06-09 (founder).** The Form (Section 3)
   now governs every teaching word in the product, the way `lib/strategy.ts`
   governs strategy labels. Per-surface wording stays founder-tunable.
2. ~~Wire the gift-lessons curriculum?~~ **RESOLVED 2026-06-09: do NOT.** On
   inspection the 8-tag system is not "dark / never wired." It was built AND
   deliberately killed the same session, with a locked rationale in
   `feedback_structure_vs_behavior.md`: the Reddit pattern is PROSE, not tags
   (the uncle's note IS the lesson); adoption ~5-10%, most skip; the kid at 18
   reading a "Lesson: what is a dividend" badge gets nothing the note did not
   already convey (metadata-on-metadata). A light prose placeholder already
   shipped on gifter checkout. `shared/gift-lessons.ts` + the `lesson_tag`
   column are dead code, safe to drop. Rebuilding it would reverse a locked
   decision and reintroduce the exact categorization-cheese the Form warns
   against. The gifter still teaches, through the note prose, not a taxonomy.

---

## 1. The principle (one sentence)

> **Kiddo never explains money. It points at what already happened on the
> child's own real fund, and leaves the last step to them.**

That sentence is the whole voice. Everything below is it, applied.

---

## 2. Why this is the voice (and not a mascot, a tutor, or a tone)

The thing that makes the greatest teachers create evangelists is not clarity
and not a warm tone. It is **guided discovery**: they arrange what you see so
that *you* notice the pattern, and you walk away trusting your own head. The
"ohhh" does the learning. The teacher is just the catalyst.

Three consequences, each a decision:

- **The teacher is a FORM, not a who.** Strip Mihalis's voice and convert the
  lessons to text and most of the magic survives. Strip the sequence and keep
  the voice and almost none of it does. The power lives in the ordering. So we
  design a shape, not a personality. (We already killed the mascot and
  Sparkles. Do not smuggle a character back in.)

- **The fund is the TEXTBOOK, not a narrator.** A narrator interprets ("look
  how great this is"). A textbook presents evidence ("$100 became $121") and
  trusts the learner. The only authority in the room is **the child's own real
  data**. That is also the BS detector: if a teaching moment could not
  plausibly arise from looking at the actual account, the actual gifts, the
  actual timeline, it is drifting into curriculum-land, which is where the
  cheese creeps in.

- **The future self is the WHY, never the WHO.** "Born invested," the at-18
  handoff, the kid-2.0 lifetime relationship: that future child is who all of
  this is for. But the moment a surface *speaks as* the future self ("hi, it's
  you at 25, thanks for this"), it becomes a seance: puppeteering a fictional
  person to manufacture emotion. That is the exact theater-over-honesty line
  the brand bans. Future self = gravity, not a voice.

---

## 3. The Form

> **Notice -> Wonder -> [gap] -> Confirm -> Stop**

Four beats and a silence. Many openings are valid (Notice / Compare /
Predict), but two rules are invariant:

- **The Stop is load-bearing.** Defend it like a locked provider boundary.
  Every instinct (growth wants engagement, the educator wants reinforcement,
  the PM wants utilization, the marketer wants activation) pushes toward one
  more sentence. The "ohhh" only belongs to the learner if there is space for
  it. A comedian does not explain the punchline after the laugh. The discovery
  is the product. The second you append the explanation, you have stolen it and
  handed back a lecture.

- **Silence is part of the voice.** If nothing true and meaningful happened,
  Kiddo says nothing. No manufactured "something interesting happened." The
  restraint is the trust signal.

Two supporting rules:

- **Pull over push.** The realest learning starts from the child's own
  confusion ("why is it different than yesterday?"), not a lesson Kiddo decided
  to deliver. So the product's job is to be **answerable at the altitude the
  kid asked**, then stop, more than it is to surface prompts. The number
  visibly moving (the count-up you already love) IS the provocation. Make the
  screen answerable, do not push a tutor at the kid.

- **One artifact, two readers.** The same honest observation reads two ways
  with zero extra work. The kid reads "this is mine, look what it did." The
  parent reads "my kid is going to understand this." Build one true thing, let
  each reader take their meaning.

- **Do not script a question the surface already answers (learned live,
  2026-06-09).** A two-bucket card already labeled "The market added $Y" does
  not need a tappable "where did the $Y come from?" on top of it. That restates
  the same fact and reads as a quiz, not discovery. When the layout already
  shows the contrast, the numbers ARE the Wonder beat. Reserve the explicit
  question for a surface that genuinely withholds the answer.

**The test for any teaching copy:** remove the last sentence. If the moment
gets *stronger*, you had not stopped yet. Most product copy gets worse when
shortened; a real teaching moment usually gets better.

---

## 4. What is real, what is banned (defer to COMPOUNDING_NARRATIVE_NOTE.md)

- **7% net, never 10%.** Doubling is a great intuition device at the **honest
  ~10-year cadence** ("left alone, it doubles itself roughly every decade"),
  **never "every 7 years"** (that is Rule-of-72 for 10.3%, smuggling the banned
  rate in, and it creates a visible seam against every 7% surface).
- **No 3,800x / 27x shock, no regret meter, no withdrawal-shaming.** A specific
  future multiplier with "no chart, no explanation, just shock" is a
  forward-looking performance representation and the literal opposite of what
  is allowed. Always hypothetical, assumptions visible, positive frame only.

---

## 5. Sample moments (the Form, made concrete)

Clean copy, em-dash-free, "gifter" not "giver". Illustrative, founder to tune.

**Compounding (the discovery, pull-triggered when the kid taps the changed number):**
> Two years ago Grandma gave $100.
> Today it is $121.
> Nobody added the extra $21.
> Where do you think it came from?

*(one tap later)*
> The money earned money.

...and stop. No "this is called compound growth," no "learn more."

**A down month (honest, friction kept, never softened into theater):**
> Last month your fund was $1,180. Today it is $1,140.
> Nobody took anything. The companies you own are worth a little less right now.
> Over many years, this up and down is normal. Time is the part that matters.

**Ownership (truth-by-example, already live in the company explainers):**
> You own a tiny piece of Disney.
> Every park, every movie, every character is partly yours.

---

## 6. The surface audit (truth-by-example: live vs authored-but-dark)

| Surface | Live today (verified) | Dark / missing |
|---|---|---|
| **Kid** `client/src/pages/KidView.tsx` | ~30 age-aware company explainers (`:80-258`); "What could this grow to?" projection card, live gift-estimator, by-majority + by-25, disclaimed 7% net (`:1375-1407`); ceremonial 1.4s count-up; teen settling-window line | Two-bucket split (you + the market) not on the kid card (only total gain, `:454-460`); doubling narration absent; balance change not answerable; **gift-lessons not rendered** |
| **Gifter** `client/src/pages/GiftCheckout.tsx` | Forward-arc on the gift; the gift moment as the artifact; a light prose placeholder under the note ("why you picked this company / what you want them to learn / the story of this gift") | Nothing to wire. The lesson-TAG system was built and deliberately retired (`feedback_structure_vs_behavior.md`); the note prose carries the lesson |
| **Parent** `client/src/pages/Projection.tsx` | The richest honest tool: milestone ages 18->65, 3 rates 5/7/9%, monthly lever, doubling-aware default horizon (`:71-89`); real two-bucket split on the dashboard | Parent not armed to teach the under-13 kid (no "one true sentence to say") |
| **Handoff** `client/src/pages/KidView.tsx` adult phase (`:979`) | Adult celebration, "nothing got sold", sealed letters, claim-account | Retention view ("what keeping it becomes", the doubling frame as don't-cash-out tool); the gift-lessons payoff at 18 |

**Headline (corrected 2026-06-09):** `shared/gift-lessons.ts` + the `lesson_tag`
column are not "dark, waiting to be wired" — they are the REMAINS of a system
built and deliberately killed the same session (`feedback_structure_vs_behavior.md`).
The locked reason: the Reddit pattern is prose, not tags. The thoughtful
gifter's curriculum was always in the note paragraphs; a tag picker forces
grandma to confront a decision she does not want and gives the kid at 18 a
decorative badge that competes with the actual note. The shipped answer is a
light prose placeholder, and the dead module + column are safe to drop. This is
the canonical example of the cheese the Form exists to prevent: do not rebuild.

---

## 7. The plan: one fund, four teachers

Because it is all ONE real fund, the same artifact serves every user type, and
each gets their own "ohhh", which is the word-of-mouth engine (every role tells
someone). The curriculum flows through the loop:

- **The gifter teaches, through the note, not a tag.** The uncle's paragraph IS
  the lesson. Kiddo's job is the light prose prompt already shipped ("why you
  picked this company / what you want them to learn / the story of this gift"),
  then get out of the way. NOT a lesson taxonomy (retired by design,
  `feedback_structure_vs_behavior.md`). The meaning lives in the prose.
- **The parent narrates.** The honest attribution ALREADY ships in
  `SinceLastVisitDigest.tsx` ("a $50 gift from Manny, $100 from you, plus $182
  in market growth", down-markets clamped, parent kept out of the "people"
  count). The only un-built piece is an explicit "ask {child} where the growth
  came from" teaching prompt. That is a FOUNDER CALL, not an AI auto-build: it
  brushes the pruned smart-nudge / strategy-nudge territory, and a clean recap
  should not silently grow a "go quiz your kid" instruction. Propose, never
  slip.
- **The kid discovers.** Answerable screen (tap the growth), the two-bucket
  split (the "nobody added it" moment), the honest doubling frame. **SHIPPED
  2026-06-09** (`KidView.tsx`). Pull, not push.
- **The adult keeps it.** ALREADY BUILT: `Age18Plan.tsx` is the retention
  surface (projection hero count-up, 4-row future projection, slider, and the
  don't-cash-out copy "it keeps compounding, there's no rush"). Do not
  duplicate. The Kid View doubling line is gated to age <= 17 so it does not
  collide with this.

The teaching quality is what makes Kid View **showable**: the thing a kid shows
a friend who goes home and asks. That is the kid-pull k-factor artifact. Never
a kid-facing share mechanic; showability is a design value, not a button.

---

## 8. Sequencing, and the honest unlock

**None of this is legal-gated.** Every move is 7%-net, disclaimed, on real
data, no new financial primitive (the math already exists in
`projectFundValue`). The only gates are the frozen polish backlog and your
yes/no. So:

- **Tier 0 (free, do under the freeze, it is voice + honesty not features):**
  this doc (the Form), and the verbatim file (`KID_OHHH_VERBATIMS.md`, the
  empirical input wave-2 is built from). Both cost nothing and start now.
- **Tier 1 (additive truth-by-example on Kid View, small LOC, no legal):**
  two-bucket split (you + the market, side by side) + honest ~10yr doubling
  narration. **SHIPPED 2026-06-09** (`KidView.tsx`). NOTE: the first cut added a
  scripted "where did the +$Y come from? -> nobody added it, the money earned
  money" tap-reveal; founder flagged it weird on the live render (the card
  already labels "The market added", so the quiz restated the same fact) and it
  was removed. The two real numbers carry the discovery. NOT gift-lessons.
- **Tier 2 (arm the parent):** the honest attribution already ships
  (`SinceLastVisitDigest.tsx`). Remaining = an optional explicit teaching
  prompt, which is a founder call (nudge-risk), NOT auto-built. Status: parked
  pending founder yes/no.
- **Tier 3 (handoff retention view):** ALREADY BUILT (`Age18Plan.tsx`). Nothing
  to do; do not duplicate.

---

## 9. Guardrails (so it stays itself)

- **Not a course.** Lessons stay gift-attached, gifter-controlled,
  moment-driven. Never a module the kid is marched through. A course is the
  drill the great teachers reject.
- **The Stop erodes** under every growth instinct. It is named load-bearing
  here on purpose.
- **Never the banned version** (Section 4).
- **COPPA:** interactive tutoring is 13+ / parent-mediated; under-13 is
  read-only and parent-voiced.
- **Each line earns itself.** The Kid View two-bucket reveal earns it: it turns
  the child's own real numbers into the compounding "ohhh" with no new data and
  no legal exposure. The gift-lessons taxonomy did NOT earn it (retired by
  design) — categorization-of-prose when the prose was already the value.

---

## 10. The empirical discipline (do not skip)

This doc is reverse-engineered from the greatest-teachers analogy, not yet from
one observed kid. Mihalis built his sequence from thousands of real learner
stumbles. We have none captured. Before the Form hardens, fill
`KID_OHHH_VERBATIMS.md` with real reactions to real numbers. Twenty real
verbatims beat any framework, and the patterns in them, not this doc, should
decide the final sequence.
