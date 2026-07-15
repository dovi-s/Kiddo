# Kiddo — Be Your Own Customer (the founder's-eyes ritual)

*A standing cadence to keep the founder inside the product's real rendered
experience — not the code, the experience — because the conversion surface rots
in ways only eyes catch, and this founder ships partly blind to rendered output.*

**Owner:** founder · **Created:** 2026-06-09 · **Cost:** ~10 min, a few times a week.

This is **not** the funded-k field test (that's `LOOP_TEST_RUNSHEET.md` — real
people, real money, the question of whether the loop compounds). This is craft QA
on the surface that does the converting, run against the seeded demo.

---

## Why this exists

Elena Verna (Survey Monkey → Dropbox → Lovable) has run the same ritual for 15
years: spin up a fresh account every few days and walk the entire core flow, so
she "knows every pixel" and lives in the customer's world. For us it matters
*more,* for a specific reason: the founder often can't see rendered output
directly, so without a deliberate ritual the only feedback loop is "tests pass" —
and the tests assert copy and fees, not whether the gift moment still *lands.*
"Verify, then claim" (CLAUDE.md) needs eyes on pixels, not just green checks.

What this protects is the founder-owned *demo feel:* the count-up roll, the gift
moment, the Memory Book, the "while you were away" digest. Those are taste calls.
Taste calls regress silently. This catches it before a real gifter does.

---

## The ritual

Run after any change to a conversion surface, and ~2x/week regardless.

1. **Reseed the demo to a known-good state.**
   `npm run reset:dunphys` then `npm run seed:dunphys`
   The Rivera demo *is* the conversion surface — Cam's photo, the seeded 17-year
   curve, the graduated kid's fund all live here.

2. **Run the reel — it walks the real funnel and dumps clean screenshots.**
   `npm run founder:reel`
   Output lands in `artifacts/founder-reel/`, named in funnel order. It logs in as
   the demo parent (Marcus), pulls his fund ids/slugs from the live API (so it
   survives a reseed), and waits for loading skeletons to clear before each shot
   so you see *real content, not a loading-pulse.* A surface that errors leaves a
   `*-MISSING.png` and the reel keeps going.

   This is deliberately **not** `test:ui:smoke`. That harness is a regression
   *gate* — it asserts exact copy, fees, and test-ids, and is *meant* to rot when
   the UI changes (you update it alongside the change). The reel asserts almost
   nothing, so it keeps working as the product evolves. Use the reel to *look;*
   use the gate to *catch regressions* (and keep it current).

3. **Flip through the screenshots as a customer would, in funnel order.** Read
   them as the gifter and the parent, not as a test report:
   - `01-home` — is the first five seconds a *wow,* or a value-prop paragraph?
   - `02-pricing` — honest and simple, or a wall?
   - `03-gift-link` (+ `-mobile`) — the gifter moment. Does Theo's page feel like
     a gift (hero, the roster of who's given, the projection), or a form?
   - `04-dashboard` (+ `-mobile`) — the parent's count-up, the "while you were
     away" digest, the faces. Honest, warm, alive?
   - `05-memory-book` — the switching cost. A story, or a CRM?
   - `06-activity` / `07-settings` — chrome copy tight (≤ ~1 sentence), nothing
     clunky; the mobile pass especially.

4. **Gut-check the two things the tests can't see:**
   - **Honesty, not theater.** Any spinner / skeleton / loading-pulse must gate on
     a *real* fetch — never a cosmetic delay to feel "powerful" (the Elena-satire
     anti-pattern). Any number must be honest: never a loss animated as a gain,
     never implied outside "people" for the parent's own money.
   - **Does it still land?** If the gift moment or the count-up stopped feeling
     like *something,* that's a P0 even when every assertion passed.

5. **One fresh-eyes pass, occasionally:** open the public gift link in a private
   window as if you'd never seen it. The thing you've stopped noticing is the
   thing a first-time gifter notices first.

---

## What to do with what you find

- Fix mechanics freely; surface changes to founder-owned zones (demo feel, brand
  voice) as a proposal, not a silent edit (CLAUDE.md craft rules).
- If a screenshot can't be read as a customer story, *that's the finding* — note
  it, don't explain it away because the test is green.
- Keep it cheap. The point is frequency and fresh eyes, not a perfect rig.

---

*Pairs with `LOOP_TEST_RUNSHEET.md` (does the loop compound, with real people)
and `COMPANY_STRATEGY.md` §7 (stop treating this as a product-completeness
problem). This ritual is how the conversion surface stays worth converting on
while the loop test runs.*
