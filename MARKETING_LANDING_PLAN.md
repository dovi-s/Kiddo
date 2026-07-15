# Landing restructure plan (Home.tsx) — for founder sign-off

**Problem:** the landing is ~15,400px on mobile (~40 phone-screens) across **15 sections**, with real
redundancy. A tighter landing converts better. This proposes a keep / merge / cut pass that roughly
halves the length without losing a single message. **No edits made yet — awaiting your call.**

## Current sections (top → bottom)
1. Live stats strip (funds / gifted / gifters)
2. Hero (headline + CTA + gift-preview)
3. Trust micro-strip
4. "Six surfaces. One promise." (feature overview)
5. "The whole story, in the order it happened."
6. "Well-intentioned gifts disappear." (the problem)
7. "From gift link to their fund in under 60 seconds." (the flow)
8. "Your family can send a gift that lasts in 60 seconds." (gift flow — **dup of #7**)
9. "The lesson no classroom teaches." (education)
10. "How the first few gifts tend to go."
11. "One day they open the account and see who showed up for them." (memory/emotional)
12. "Why not just use a savings account?" (comparison)
13. "Your child's money is in safe hands." (security)
14. "Time is the one gift you can't get back." (urgency)
15. "Start your child's fund today." (final CTA)

## Proposed structure (~9 sections)
1. **Hero** — headline + primary CTA + gift-preview (keep; already strong).
2. **Trust micro-strip** — keep, thin (SIPC / FINRA partner / no-fee-to-start).
3. **Problem → shift** — MERGE #6 + #5 into one: "gifts disappear → a gift that lasts."
4. **How it works in seconds** — MERGE #7 + #8 (they're the same beat). One 3-step flow.
5. **What your child receives** — MERGE #4 + #10 + #11 into one section with three sub-beats: the fund, the Memory Book ("who showed up"), Kid View. (This is the heart; it earns space.)
6. **The education beat** — keep #9, tight (real differentiator).
7. **One comparison** — keep #12 condensed, with a "see all comparisons →" link to /compare (don't re-litigate every alternative on the landing).
8. **Security** — keep #13, concise (one block, not a full section).
9. **Live proof + final CTA** — MERGE #1 (stats as social proof) + #14 (urgency) + #15 (CTA) into the closer.

Net: 15 → ~9 sections, roughly half the scroll, every message retained, the emotional core (#5) kept whole.

## Copy notes to fix during the pass (small, in-scope)
- **"60 seconds" vs "a minute" vs "seconds"** is inconsistent across the page (and SSR meta says "under a
  minute"). The locked rule is **seconds, not "a minute."** Standardize to "in seconds."
- **"Six surfaces. One promise."** and **"The whole story, in the order it happened."** are
  rule-of-three / aphoristic AI-tells — soften to plain section headers during the merge.

## Risk / approach
This is the most visible, founder-owned surface, and I build blind — so the plan is **structural** (what
merges, what's cut). If you bless it, I'll execute one merge at a time, screenshot each, and keep every
sentence of substance; the only deletions are the literal duplicate (#8) and section *chrome*, not ideas.
