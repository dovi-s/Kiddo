# Security Hardening — Follow-ups (founder-owned decisions)

Companion to the 2026-06-11 auth-hardening batch (CSRF, 2FA brute-force +
step-up, durable report limiter, dev-override boot guard — all shipped and
covered by `npm run test:security-regression`, checks 11–14).

These two items are **real**, but they sit in founder-owned zones (money-flow /
provider boundary, and the trust-&-safety scanner vendor decision). Per
`CLAUDE.md` they are written up here for a decision rather than slipped in. Each
has a recommended path and the exact code seam.

---

## 1. Money-out destination is not verified (manual bank → withdrawal)

**What's true today**
- `POST /api/bank-accounts` (`server/routes.ts`) stores a user-typed bank row as
  `provider:'manual'`, `connectionStatus:'active'`, `status:'active'`. As of
  2026-06-11 it now validates that the last-4 fields are exactly 4 digits
  (input hygiene), but it still does **no destination verification**.
- `POST` withdrawal (`server/routes.ts` ~9396) accepts any bank row the owner
  owns and queues a transfer (`queueCustodianTransfer`), falling back to a
  manual ops outbox when ACH isn't live.

**Why it's not a theft vector (scoping the severity honestly)**
- Withdrawals move the fund's **own settled cash** to a destination the
  **account owner themselves** typed. It's owner-gated, and a first-large-
  withdrawal 24h cooldown already applies to kid-owners post-handoff.
- The real risk is **wrong/unverified destination** (typo, social-engineering a
  user into entering an attacker's account) plus an ops step that trusts
  user-typed bank details. That's an AML / payment-controls concern, not session
  CSRF or IDOR.

**Recommended path (gated on the custody/Plaid decision already in flight)**
1. Treat manual rows as **unverified**: store `connectionStatus:'unverified'`
   and only promote to `'active'` after a verification step.
2. Verify via the rail you're already choosing — Plaid auth (instant) or
   micro-deposits — before a row is withdrawal-eligible.
3. Gate the withdrawal path on `connectionStatus === 'active'` (verified).
4. Until verified-ACH is live, keep the honest "queued for manual processing
   during early access" copy that's already there.

**Decision needed:** this is bound to the Alpaca-vs-DriveWealth custody pick and
the narrow MTL/RIA memo (see `GO_LIVE_PLAN.md`, `COUNSEL_ENGAGEMENT_PACKET.md`).
No code change here until that lands, because the verification rail = the
custody/bank-linking provider choice.

---

## 2. Authenticated parent media uploads bypass the scanner

**What's true today**
- Public image uploads run through `scanImageBuffer(...)`
  (`server/routes.ts` ~8579, ~14867).
- Authenticated **parent** photo/video/audio upload routes do **not** call the
  scanner.
- The scanner itself is **image-only** and currently a **prod no-op** (returns
  `safe:true`) until a real vendor is wired (`server/contentScanner.ts`). So
  today this is a latent gap, not a live regression — nothing is being scanned
  anywhere in prod yet.

**Why it matters anyway**
- The trust-&-safety posture treats the *public stranger* upload as the primary
  threat, which is defensible. But parent-uploaded media still lands on a
  child-facing surface (Memory Book, Kid View). If the legal/vendor posture
  becomes "all child-surface media is scanned," the parent path is the gap.

**Recommended path (gated on the scanner-vendor decision)**
1. When a real scanner is wired, route **all** child-surface media through it —
   parent and public — behind one helper so there's a single chokepoint.
2. Extend beyond images: video (keyframe sample) + audio (the Whisper transcript
   path is a natural hook, and that path needs its own vendor disclosure in
   `EXTERNAL_SERVICES.md` before it's ever enabled in prod).
3. Keep the fail-closed-in-prod stance already in `contentScanner.ts`.

**Decision needed:** which scanner vendor, and the policy line ("scan all child-
surface media" vs "scan public-stranger uploads only"). See
`TRUST_SAFETY_FINDINGS.md`.

---

*No part of this doc has been implemented beyond the bank last-4 input
validation. Both items are deliberately staged behind the custody and scanner-
vendor decisions.*
