# Gifter-path friction audit — the PLG-critical journey

> The one journey the whole growth loop depends on: a gifter taps a shared link
> and a gift lands. Audited 2026-05-29 against `client/src/pages/GiftCheckout.tsx`.
> Verdict: **genuinely low-friction and well-built.** The right move from here is
> data-driven (you already instrument it), not a blind redesign.

## The funnel
`landing → amount → preview → payment → [Stripe hosted checkout] → /gift/success`
(Occasion pages compress: landing ↔ preview, skipping the standalone amount step.)

## What's RIGHT — the five friction-killers are all present (do NOT touch blindly)

1. **No account required.** The whole flow is public; pay → `window.location` to a
   Stripe-hosted Checkout Session. The single biggest PLG unlock, and it's there.
2. **No forced email on a one-time gift.** `isEmailValid` is true when the field
   is blank (`!senderEmail.trim() || <valid>`); Stripe collects the receipt email
   on its page. Email is required ONLY for recurring (to manage the schedule).
3. **No forced investment decision.** `executionModel` defaults to `"auto"` (the
   family's managed mix) and `hasValidExecutionChoice` is true by default — a
   gifter just taps Continue. They only pick a ticker if they *opt in* to "pick."
   (Most gifters want to give money, not choose a strategy — this respects that.)
4. **Note + media are optional**, never gated (gifter media is always free).
5. **Stripe-hosted checkout** handles card + **Apple Pay / Google Pay** — the
   fast path for the mobile grandparent cohort.

Also: the **"preview" step is persuasion, not dead friction** — it shows "where it
lands" + the at-18 projection, i.e. it *sells the gift's impact*. Don't treat it as
a step to cut on instinct.

## The real recommendation: read your own funnel data, don't guess

Every step transition already fires `trackGiftEvent("cta_click", ...)` with the
step label (`gift_page_start`, `gift_occasion_start`, `gift_preview_continue`,
`button-pay`). So you can measure the actual drop-off:

`landing → amount → preview → payment → paid`

**Fix the step that actually leaks.** Don't compress the funnel on instinct — the
instrumentation exists precisely so step changes are evidence-led. (E.g. if
preview→payment is healthy, the persuasion step is earning its place; if
landing→amount leaks, that's where to act.)

## A/B candidates (test against the funnel data — not blind changes)

- **Amount selector on the landing page** (immediacy) vs the current
  landing-then-amount (emotional warm-up first). A classic gift-flow tradeoff;
  let the landing→amount drop-off decide.
- **Merge amount + preview** into one screen (since execution defaults to auto,
  the preview is mostly confirmation). One fewer tap — but you'd lose the
  dedicated persuasion beat; measure both.
- **The $5 minimum** (`activeAmount >= 5`) — reasonable, but if small impulse
  gifts ($1–$4) show intent-without-completion, worth revisiting.

## Adjacent ease win (different path)

The one-time gift path needs no account — so OAuth doesn't apply there. But when a
gifter goes *further* (saves the fund, sets up recurring, becomes a parent), that
account creation is where **Google/Apple sign-in** removes friction
(`OAUTH_SETUP.md`). That's the upstream PLG lever, distinct from this pay path.

## Bottom line
The gifter pay path is **well-designed and low-friction** — no account, no forced
email or investment choice, Apple/Google Pay, optional media. It does not need a
redesign; it needs **its funnel data read** so any step change is earned. The
highest-leverage *new* ease win is upstream (OAuth for the gifter→parent step).
