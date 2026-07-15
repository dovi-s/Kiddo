# Kid View Principles

*Two things: (1) a LOCKED decision — no gamification on the Kid View — and (2) a
PROPOSAL — the loop-seed copy for the pre-handoff runway. The locked decision is
founder-endorsed (2026-06-09). The copy is a proposal: Kid View voice + demo feel
are founder-owned, so it is drafted here, not slipped into the product.*

**Surface:** `client/src/pages/KidView.tsx` (+ `Age18Welcome.tsx`, `YourStory.tsx`
post-handoff). **Created:** 2026-06-09.

---

## Part 1 — LOCKED: no gamification on the Kid View

The Kid View teaches **patience and belonging**, not engagement. No badges,
streaks, points, levels, leaderboards, daily-check-in rewards, spinning wheels,
confetti-for-balance, or anything that turns a child's long-term fund into a
dopamine loop. This is a deliberate refusal of the category's default.

**Why it's locked:**
- **The category trap.** The standard "how to grow a kids' investing app"
  playbook (Greenlight, Acorns Early, KidVestors, and every SEO overview) says
  *gamify the child: missions, badges, streaks.* That is a daily-engagement
  treadmill bolted onto a 0.10%-AUM model — the EarlyBird-adjacent death pattern.
- **The field evidence says it's wrong.** Real parents and advisors are explicit:
  speculative kid-engagement teaches the wrong lesson ("I can't think of a worse
  way to introduce a 12-year-old... self-destructive habits start early"); the
  engagement that *works* is "watch it grow + the relationship" (a 14-year-old who
  "loves watching the balance grow"). Return-theater gets roasted on sight.
- **The brand.** Honesty over theater is the moat. The Kid View already does this
  right: it shows holdings that are **down** (Roblox −$20.33), disclaims every
  projection, and says "a stock going down does not mean the company is broken...
  zoom out." That is the asset. Gamification would corrode it.

**Allowed (the warm, honest register):**
- Watching it grow over time; honest numbers, including losses.
- The relationship: who gave, the notes, the Memory Book, the faces.
- Education: "what these companies do," "what moves a stock," compounding.
- **Parent-mediated** "Suggest a stock" (the kid tells the parent what they'd
  want and why — agency without a trading dopamine loop).

**Forbidden:**
- Badges, streaks, points, levels, leaderboards, daily-reward mechanics.
- Anything that rewards *frequency of checking* rather than *length of holding*.
- Anything that animates a loss as a gain or implies certainty markets don't give.
- Encouraging speculation / stock-picking as a game.

If a future feature proposes engagement mechanics on the Kid View, the answer is
no by default; re-open only with founder sign-off against this principle.

## Part 2 — PROPOSAL: seed the loop on the pre-handoff runway

### The strategic gap
The company thesis (`COMPANY_STRATEGY.md`): the kid who *received* becomes the
adult who *owns* becomes the parent who *gives*. The handoff at majority is the
prize, and the loop regenerating into the next generation is the deepest moat.

The "you'll become the one who gives" seed **already exists — but only AFTER the
handoff**, in the post-claim surfaces:
- `YourStory.tsx:351` — "one day start one for someone whose future you want to
  show up for."
- `Age18Welcome.tsx:366` — "enough to start another Kiddo for the next generation."
- `Age18Welcome.tsx:528` — "one day you'll be the one who shows up."

The **Kid View is the multi-year runway *before* that moment**, and it never
whispers the identity. Today its future framing is about the money only
(`KidView.tsx:465`: "your fund can become something much bigger later"). The
highest-leverage missing beat is to gently plant *"this is chapter one of who
you're becoming"* during the years of anticipation, not just at the finish line.

### Proposed copy (em-dash-free, "gifter"/"Kiddo" voice; founder to approve wording)

A single quiet line, not a feature. Two candidate placements:

**A. Near the "Coming soon / it's all yours" handoff card** (the forward-looking
moment), as a soft second sentence:
> "And it doesn't end here. The people who showed up for you are how this started.
> One day you might be the one who shows up for someone you love."

**B. In the future/"what could this grow to" section**, as a closing aside under
the projection:
> "Money is only half of it. Someone chose to show up for your future. One day,
> when you can, you get to do that for someone too."

Keep it to ONE line, calm register, never a CTA or a nudge — the kid can't act on
it yet, and that's the point. It plants identity, not a task. It must never read
as marketing or pressure.

### Why this is not "polish" (and clears the freeze)
Most Kid View craft is frozen polish (the kid is not the daily user pre-handoff).
This one is not: it is the **prize** (the loop's next turn) expressed as one line
of copy at near-zero cost. It earns its place the way the safety gate does — by
serving strategy, not refinement.

### Out of scope / guardrails
- No mechanic, no reward, no "start a fund for someone" button on a minor's view
  (that would be gamification + a CTA a child can't action). Copy only.
- Respects Part 1: it's relational identity, not engagement bait.

---

*Pairs with `KID_VIEW_SAFETY_GATE_SPEC.md` (the one open risk) and
`COMPANY_STRATEGY.md` (the at-21 handoff as the prize, the loop as the moat).
Part 1 is locked; Part 2 awaits founder sign-off on wording + placement before it
ships into `KidView.tsx`.*
