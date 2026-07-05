# Handoff → payments chat: wire the gift-landing push

**TL;DR:** Web Push is fully built + verified. The one push that belongs to YOUR
lane (not mine) is the gift-landing buzz, because it fires when a gift *payment
clears* — inside `handleGiftPayment` / `handlePaymentIntentSucceeded`, which you own.
It's a **one-line add**. No new infra.

## Why this is yours, not mine
- Lane discipline: the payment/webhook handler is yours; both of us editing it is
  how double-credit-class bugs happen.
- My centralized push path (`server/storage.ts` → `PUSH_WORTHY_ACTIVITY_TYPES`)
  **deliberately excludes payment activity types**, so gift-landing does NOT fire
  through my path. It's intentionally left for you to fire explicitly with
  gift-specific copy.

## What's already built (verified)
- `server/pushService.ts`: `sendPushToUser(userId, { title, body, url })` — sends to
  every device the user opted in on, **auto-prunes dead endpoints**, and is a **silent
  no-op if the user has no subscription** (so you can call it unconditionally, no guard).
- Verified end-to-end: store → send (real FCM) → prune. VAPID configured via env.

## The add (at the point a gift is confirmed credited to the fund)
```ts
import { sendPushToUser } from "./pushService"; // already exported

await sendPushToUser(fundOwnerId, {
  title: "A gift landed",
  body: `${gifterName} added $${amount} to ${childName}'s fund.`,
  url: "/activity",
});
```
- `fundOwnerId` = the parent/owner `users.id` for the fund the gift landed in.
- Fire it AFTER the credit is committed + idempotent (so a webhook retry can't double-buzz).
- Copy is a placeholder — it's brand voice, tune freely. No em-dashes / Sparkles.
- `url` can deep-link anywhere; `/activity` is the safe default.

## Do NOT
- Don't add a gift/payment type to `PUSH_WORTHY_ACTIVITY_TYPES` in `storage.ts` to
  achieve this — fire it explicitly here instead, so the trigger + copy live with the
  payment logic and there's no chance of it firing on a non-clearing activity.

Questions → the push work is logged in memory `project_push_notifications_plumbing.md`.
