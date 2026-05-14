# Multi-Account Loophole — A Note, Not A Spec

> Status: **Documentation only**, 2026-05-13. Captures the decision
> that we don't aggressively police users who create multiple Free
> accounts (one per kid) to avoid Kiddo Family. Same shape as
> `CASH_FLOAT_REVENUE_NOTE.md`, `REVIEW_PROMPTS_NOTE.md`.
>
> Companion docs: `KIDDO_ADULT_TIER_SPEC.md`,
> `B2B_GIFTING_SPEC.md` (the revenue specs this composes against).

---

## TL;DR

The loophole: a parent with two kids can create two separate Free
accounts (different emails) instead of paying $7.99/mo for Kiddo
Family. They pay $0/month.

**Decision: don't try to close it.** The Plus features they skip
(recurring investments, parent-authored Memory Book media, custom
mix, co-parent invite, 3 active occasions, priority support) are
substantial. The household-view friction they pay (logout/login,
isolated Memory Books) is real. Most parents who care about
Kiddo's actual value prop convert to Family on their own.

Aggressive policing (cross-account PII matching, hard blocks)
violates the locked acorns-bundle-inflation principle, produces
brand-event-level false positives (divorced parents, grandparents,
blended families), and creates privacy/legal exposure we don't
need.

When the data justifies it, the right move is **soft detection +
calm nudge** (Spotify Family pattern). Not today.

---

## What's actually enforced

| Constraint | Enforced? |
|---|---|
| One email per account | ✓ Yes (unique on `users.email`) |
| One fund per Free account | Partially — extra funds appear to lock to read-only per the cancel-dialog copy; not a hard create-block in the API |
| One account per person | ✗ Not enforced |
| One account per household | ✗ Not enforced |
| Cross-account PII matching (same SSN, address, phone) | ✗ Not enforced |

The architecture doesn't prevent the multi-account workaround.
Anyone with two email addresses can create two Free accounts.

---

## What the multi-Free parent actually pays (in friction)

Doing the loophole is more painful than dollars-only math suggests:

| Lost feature | For both kids? |
|---|---|
| Recurring investments | ✓ |
| Parent-authored Memory Book media (photos, voice, video) | ✓ |
| Custom fund mix | ✓ |
| Co-parent invite | ✓ |
| 3 active occasions at a time | ✓ (collapses to 1 per kid, isolated) |
| Priority support | ✓ |
| Household overview (both kids on one dashboard) | ✓ — requires logout/login per kid |
| Continuous Memory Book across kids | ✓ — each kid's book isolated |
| Single billing relationship | ✓ |

The Plus features ARE the moat. A parent who multi-accounts is
leaving real value on the table for BOTH kids, in exchange for
$7.99/mo. That's the implicit pricing mechanism — friction in
exchange for $0.

---

## Three ways to handle it

### Option A: Aggressively police — wrong call

Cross-account PII matching (same SSN, same address, same phone via
KYC data) + hard block on second-account creation when matches
detected.

Why this is wrong:
- **False positives are brand-event-level.** Legitimate cases:
  divorced parents with joint custody (each is a custodian on
  different kids' funds), grandparents managing grandkids' funds
  separately, blended families with multiple legal custodians,
  siblings setting up Kiddo for their kids from the same household.
- **Privacy-invasive.** Cross-account PII linking opens legal
  exposure (the cross-reference itself is a data flow that has to
  be defended), brand exposure, and customer-trust exposure.
- **Violates `project_acorns_bundle_inflation_pattern.md`.** Kiddo's
  locked discipline is to refuse artificial restrictions designed
  to force upsells.
- **The aggressive-policing path is Acorns/Robinhood territory.**
  Exactly the brand position Kiddo defines against.

### Option B: Soft detection + calm nudge — the right path when data justifies it

Detect likely multi-account usage via softer signals (same
IP+device within N days, similar KYC names, etc.) and surface a
calm prompt at the right moment: *"Kiddo Family covers all your
kids in one account for $7.99/mo — and you'd unlock recurring
investments and the household view across both kids."*

This is the **Spotify Family pattern**. It works because:
- No false-positive blocks (informational only)
- The user chooses (doesn't override their decision)
- Surfaces Family value at the moment of pain

Cost: ~2-3 hours of engineering + ongoing design tuning. **Not
worth building today** because:
- Detection signals at small scale are weak (NATted shared WiFi,
  shared devices in households, etc.)
- The data to design the heuristic properly doesn't exist yet
- Future-us with real customer patterns will know which signals
  matter

### Option C: Don't police, lean into Family value — recommended for now

Don't try to close the loophole. Make Family **structurally more
valuable** so parents choose it positively, not because we forced
them.

What this looks like:
- Continue investing in the household view (Plan Benefits work
  has the foundation)
- Memory Book cross-kid continuity (one timeline showing all
  family gifts across all funds — deliberately impossible for
  multi-account users)
- Co-parent invite that works across all kids (a partner becomes
  co-parent on every fund in one click)
- B2B gifting flow → corporate gifts land in Family accounts → 
  only multi-fund household-view users get the full experience
- Sibling-gifting features → "Emma's birthday gift can come from
  Bob's recurring" — only works in Family

The principle: the parent who tries the multi-account workaround
eventually hits a feature they want that ONLY works in Family.
They convert when the value lands, not when we force them.

---

## Why I'm declining to build soft detection (Option B) today

Three reasons the timing is wrong:

1. **Signal noise.** Pre-launch / early-launch, detection signals
   are weak. NATted shared-WiFi neighborhoods, school families on
   the same network, shared devices. False positives would dominate
   the few true positives.

2. **Design uncertainty.** Which signals matter? Same IP+device
   within 7 days? Same household name in KYC? Same parent first
   name + last name across accounts? The right heuristic depends
   on real customer patterns we haven't observed yet.

3. **Premature optimization.** The cost of multi-account abuse at
   current scale is near zero. The cost of getting detection
   wrong is brand-event-level. Wait for the trigger.

Same discipline as `REVIEW_PROMPTS_NOTE.md`: don't ship
implementation until the trigger conditions are real.

---

## When to revisit

Five concrete triggers, in approximate likelihood order:

1. **Customer support starts seeing multi-account users emerge.**
   First-party signal: parents who email support about managing
   two funds across two accounts. Detect via support-side tagging.

2. **Active install base crosses ~5,000 households AND Family
   conversion lags target.** If, say, only 20% of multi-kid
   households are on Family when we'd expect 60–80%, that's
   evidence the loophole is real and meaningful.

3. **A competitor with per-family pricing publishes anti-loophole
   detection.** Greenlight, Acorns Early, etc. shipping
   cross-account detection. Watch the pattern; don't blindly copy.

4. **Word-of-mouth signal: parents tell each other about the
   loophole on Reddit / parent forums.** First evidence of
   organized awareness. Detect via search.

5. **KYC infrastructure makes cross-account PII matching
   genuinely privacy-safe.** Today the technical and legal
   surface area for cross-referencing makes detection risky.
   That may improve with better tooling.

Until then: keep this note warm. Don't aggressively police.

---

## What this note is honest about

Three things to surface:

1. **There's a real revenue opportunity cost.** Every multi-Free
   household is a Family subscriber we didn't earn. At small scale
   the dollar value is tiny; at meaningful scale it'd be real.
   The discipline of waiting becomes harder to justify as the
   number grows.

2. **The "lean into Family value" path requires sustained
   investment.** Household view improvements, Memory Book
   cross-kid continuity, sibling-gifting, B2B-to-Family — all
   require real engineering. The pricing strategy depends on the
   product strategy delivering.

3. **Soft detection is a Year-2+ build, not Year-1.** When we
   build it, it goes through user-testing carefully (false
   positives are brand-event-level) and ships with the
   discipline: nudge only, never block.

---

## References

- Internal: `REVIEW_PROMPTS_NOTE.md` — same discipline (don't ship
  until trigger conditions are real)
- Internal: `CASH_FLOAT_REVENUE_NOTE.md` — same doc shape
- Internal: `KIDDO_ADULT_TIER_SPEC.md` — Family tier composes with
  the eventual Adult tier; both depend on the household-value
  story being real
- Internal: `B2B_GIFTING_SPEC.md` — B2B corporate gifts route to
  Family-account funds; gives multi-account households a real
  reason to consolidate
- Internal: locked memory `project_acorns_bundle_inflation_pattern.md` —
  the discipline that rules out aggressive policing
- External: Spotify Family verification UX — the pattern soft
  detection would eventually follow when timing is right
