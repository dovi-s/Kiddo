# Review Prompts — A Note, Not A Spec

> Status: **Documentation only**, 2026-05-13. Captures the decision
> that we don't ship a "rate Kiddo" prompt today and the discipline
> we'd apply when we do. Same shape as `CASH_FLOAT_REVENUE_NOTE.md`.
>
> Companion docs: `FACE_ID_SPEC.md` (Face ID work — the surface this
> would compose with on mobile), `HARD_MOMENTS_SPEC.md` (an example
> of careful behavioral-trigger discipline).

---

## TL;DR

Every fintech we'd be compared to (Acorns, Robinhood, Wealthfront,
Public) shows users an in-app "rate us" prompt. The pattern works
for App Store visibility + social proof but tips easily into
nag-bot territory if done wrong.

**Decision:** don't ship this today. Revisit when scale + trigger-
moment readiness justify it. When we do, use Apple's and Google's
native APIs (not a custom widget), trigger on positive behavioral
moments only, never copy the Acorns 5-star-funnel pattern that
filters negative reviews out of the App Store.

The discipline IS the feature. Premature shipping without the
discipline trains parents to dismiss us.

---

## Why eventually yes

Three real reasons:

1. **App Store visibility math.** Above 4.5★ vs 4.0★ is the
   difference between "Kiddo shows up when someone searches
   'invest for kids'" and not. At scale, this matters.
2. **Social proof.** Real parent reviews beat any marketing copy
   Kiddo could write.
3. **Native APIs are actually polite.** Apple's
   `SKStoreReviewController` and Android's In-App Review API are
   deliberately unobtrusive: small native overlay, max 3 prompts
   per year per device, can't be styled or coerced. Built for
   exactly this use case.

---

## Why no Acorns-style custom widget

The Acorns pattern (and Robinhood, and most fintech) is a custom
in-app 5-star widget that routes 5-star ratings to the App Store
and low ratings to a support feedback form. Kiddo never ships
that. Three reasons:

1. **It's conversion-funnel anatomy** — same shape we removed from
   the smart-nudge modal and the cancel dialog. Brand inconsistency.
2. **It borderline-filters negative reviews.** Apple permits it but
   the spirit of the review system is "ask everyone." Looking like
   we filter is a brand risk we don't need to take.
3. **Zero brand differentiation.** Every fintech does the same
   thing. Kiddo's edge is calm-not-aggressive; matching the
   industry pattern dilutes that.

---

## What "ship it eventually" actually looks like

When we ship, the implementation is small (~3 hours of work). The
discipline is the whole feature:

### Surfaces

| Platform | Mechanism |
|---|---|
| **iOS** | `SKStoreReviewController.requestReview()` — native overlay, Apple-throttled |
| **Android** | Play In-App Review API — equivalent native overlay |
| **Web** | No equivalent. Either skip OR ask for a testimonial via a separate flow (e.g., post-handoff-at-18: "If Kiddo's been good for your family, would you tell another parent?"). Distinct mechanism, different surface, different commit. |

### Triggers (positive behavioral moments only)

Prompt fires AFTER one of:
- A gift just successfully settled into a kid's fund (parent sees it land in the dashboard)
- A kid's birthday occasion successfully concluded with gifts received
- The fund just crossed a meaningful round-number balance the parent didn't have to chase
- Anniversary of fund creation IF the fund has grown meaningfully

Never on a random-time prompt. Never after a parent dismissed an
error. Never on session-open.

### Rate limits (Kiddo-side, in addition to the platform's)

- Apple's native API: max 3 prompts per year per device (platform-enforced)
- Kiddo additional gating:
  - Never within 90 days of any prior prompt
  - Never within 14 days of any support contact or error event
  - Never on a session under 30 seconds
  - Never within 7 days of a cancellation flow (even an abandoned one)
  - Never to a gifter — they're not committed customers; asking
    strangers for a favor erodes trust

### What we never do

- Custom 5-star widget inside Kiddo
- Routing low ratings to support and high ratings to App Store
  (the Acorns funnel)
- Prompting on negative or neutral emotional moments
- Email asking users to leave a review
- Any incentive ("rate us for 1 month free Plus")
- Following up if they dismiss

The brand-honest line: Apple's prompt asks once in a while at a
calm moment, the parent rates or doesn't, that's it.

---

## Why later, not now

Three reasons the timing isn't right today:

1. **Scale.** App Store ratings move the needle at ~10k+ installs.
   Pre-launch, the cost-benefit isn't there. We'd be optimizing a
   number nobody is checking yet.

2. **Trigger moments aren't fully validated.** The "after a gift
   just settled" moment exists in code, but we haven't watched
   real parents through enough cycles to know whether that moment
   lands calmly or feels intrusive. Premature prompting on a
   brittle trigger trains parents to dismiss us, which we can't
   undo.

3. **The discipline matters more than the feature.** Shipping the
   prompt without the guardrails above is the kind of thing that
   quietly ages into "the Kiddo app nags me to rate it." We just
   spent a session pulling that pattern out of three other
   surfaces (smart nudge modal, cancel dialog, "starting early"
   section). Adding it back here, even subtly, would be a
   regression.

---

## When to revisit

Five triggers, in approximate likelihood order:

1. **Active install base crosses ~10k.** App Store rank starts to
   actually move based on rating volume. The math kicks in.

2. **A meaningful share of installs come from App Store organic
   search.** When search traffic is measurable, rating
   visibility is a real lever.

3. **At least one trigger moment has 100+ successful occurrences
   in real-world data.** Validates the moment is reliably positive
   before we attach a prompt to it.

4. **A competitor with higher star ratings starts beating Kiddo on
   App Store search rank.** Don't fight a star-rating war reactively,
   but if rank is being lost, prompting earns its keep.

5. **A parent unprompted writes a positive review in the App Store.**
   If real organic positive reviews are happening, asking is just
   accelerating what's already there. Different ethical posture
   than asking when nobody's saying anything.

Until then: keep this note warm. Don't ship the prompt.

---

## What this note is honest about

Two things to surface:

1. **There's an opportunity cost to waiting.** Every month Kiddo
   doesn't have a review prompt, we leave some ratings on the
   table. At low scale that cost is small. At meaningful scale,
   the discipline of waiting becomes harder to justify.

2. **The web testimonial flow is a separate decision.** Not
   covered here because the mechanism is fundamentally different
   from a native prompt (no native API; would have to be a custom
   surface). When/if web testimonials become a real channel,
   they get their own note. Don't conflate.

---

## References

- Internal: `CASH_FLOAT_REVENUE_NOTE.md` — same doc shape (note, not spec)
- Internal: `FACE_ID_SPEC.md` — the mobile-side composability surface
  (we'd prompt on the same OS layer the biometric prompt uses)
- Internal: `HARD_MOMENTS_SPEC.md` — the email-suppression layer
  there would also suppress review prompts for bereaved families
  + canceled subscribers
- External: [Apple SKStoreReviewController docs](https://developer.apple.com/documentation/storekit/skstorereviewcontroller) — the only iOS prompt path we'd use
- External: [Android In-App Review API docs](https://developer.android.com/guide/playcore/in-app-review) — Android equivalent
- External: Acorns / Robinhood / Wealthfront review-prompt patterns — the conversion-funnel anatomy we don't copy
