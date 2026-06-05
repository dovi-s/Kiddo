# Onboarding Audit — against the "surface value fast" bar

**Prompted by** the Tim Gabe onboarding video (2026-06-05): short / value-first by
default; long onboarding only earns its length when it buys real personalization
or a buyer-filter. Mapped both Kiddo flows (gifter + parent) step-by-step and
scored them against that bar.

**Headline:** onboarding is **mostly healthy.** There is exactly **one real
leak**, and it's one already on the radar — the give-a-gift "warm promise" that
doesn't capture at intent. Everything else sits within the rule. The fix for the
leak is already **built behind a flag** (counsel-gated), so the highest-leverage
onboarding move is *clearing a gate, not writing code.*

---

## 1. Gifter — public gift link → ✅ HEALTHY (Granola-aligned)

`GiftCheckout.tsx` + `POST /api/stripe/checkout/gift` (`routes.ts:12393`).

A gifter who lands on a real fund link reaches value in **~2 meaningful steps**:
pick amount → pick payment → Stripe → done. Crucially:
- **No account/signup required to gift.** Name + (optional) email only. This is
  the single most important onboarding property for the loop, and it's correct.
- **Card is captured at intent** (Stripe Checkout). The money lands.
- Everything before payment (amount, execution model, identity, memory media,
  fee summary) is one scrollable page, skippable in ~60s.

**Verdict:** this is the Granola "two screens to value" model done right. Don't
touch it except to keep it fast. No action.

---

## 2. Gifter — `/give-a-gift` "warm promise" → 🔴 THE ONE LEAK

`GiveAGift.tsx` + `POST /api/gift-intents` (`routes.ts:15858`).

6 scrollable sections → **a promise, with NO card captured by default.** The gift
then depends on a chain *outside the gifter's control*:
1. an email to the parent, →
2. the parent creating a fund (async), →
3. the gifter coming *back* via a later "time to complete" email
   (`giftIntentCompletionWorker.ts`) to finally pay.

That is the textbook **intent-without-capture** drop-off — the EarlyBird-death
mechanism, dressed nicely. Against the onboarding rule it's the one flow that
violates "surface value / capture at the moment of intent."

**Why it exists (fairly):** it's the "the kid has no fund yet" path — you can't
charge into a fund that doesn't exist, so it emails the parent instead.

**The fix is already built:** the `GIFTER_CAPTURE_AT_INTENT` flag (Option C) adds
a Stripe **setup**-intent — authorize the card now (Kickstarter pledge model),
charge when the fund exists. It's flag-gated + **awaiting counsel**
(`COUNSEL_ENGAGEMENT_PACKET.md`, the holding-funds question). See memory
[[project_money_at_intent_two_flows]] + [[capture-at-intent-built-behind-flag]].

**Action (highest-leverage onboarding lever there is):** clear the counsel gate,
flip the flag. Secondary: the 6 sections compress fine on one screen — but the
screen *count* isn't the problem; the **deferred capture** is. Don't waste effort
trimming fields here; spend it clearing the gate.

---

## 3. Parent — create a fund → 🟡 REASONABLE (within the rule)

`GetStarted.tsx` + `POST /api/funds` (`routes.ts:3318`) → `Onboard.tsx` splash.

**Critical (essential-data) path = ~5 screens:** auth → who (child/self) →
country gate → child details (name / DOB / state-for-UTMA) → investment choice →
fund created. Every one of those is *required to build a custodial fund* — this is
exactly the "earned personalization" the rule permits. **Full path = ~8 screens**
once you add the 3 optional ones:
- **Occasion + gifter audience** — loop-targeting (who gets the link). Not
  fund-essential, but it's *loop* work, not dead friction. Keep.
- **Projection slider** ("your $500/yr → $X by 18") — the personalized **aha**.
  Justified by the rule (it's the belief-builder). Keep.

So the parent flow is **not** bloated — its "extra" length buys aha + loop
targeting, not government-form friction.

**Two small flags (not blockers):**
- **The 2-second "Setting up your dashboard…" splash** (`Onboard.tsx:43-126`) — if
  it's masking a real data load, fine; if it's an artificial delay, cut it.
  A pause right before first value is the one spot pure friction crept in.
- **Signup precedes the personalized aha.** The projection (the "*your* kid →
  $X" moment) sits *after* account creation. It's mitigated — the **demo already
  delivers the pre-signup aha** (a prospect sees the working product before ever
  signing up; that's our structural advantage). A *possible* optimization: show
  the personalized projection from name+DOB *before* the password step, so the
  aha motivates the signup rather than following it. Optimization, not a fix.

---

## 4. Prioritized actions

1. **🔴 Clear the counsel gate → flip `GIFTER_CAPTURE_AT_INTENT`.** The one real
   onboarding leak, the fix already coded. Not a UI task — a legal-gate task.
2. **🟢 Leave the public gift link alone** (it's the model done right).
3. **🟡 Decide the 2s onboarding splash** — keep if it hides a load, cut if not.
4. **🟡 (Optional) Move the personalized projection ahead of the password step**
   so the aha precedes signup. Nice-to-have; the demo already covers the gap.

**Meta:** the demo is the reason the parent flow can stay short — it does the
belief-building of a long onboarding (à la Cal AI's 20-step quiz) as *play, not a
form*, before any signup. Protect the **demo → signup handoff**; don't make a
convinced prospect re-prove intent.

*Audit 2026-06-05. Source map: step-by-step trace of `GiftCheckout.tsx`,
`GiveAGift.tsx`, `GetStarted.tsx`, `Onboard.tsx` + the gift/fund routes.*
