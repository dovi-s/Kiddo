# Kiddo — Launch Punchlist (the verified truth table)

*What's actually broken vs built-but-ugly vs deferred-by-design vs later — grounded
in code verified 2026-06-11 (file:line), not a doc-skim. Sequenced against THE_PLAN.
Two things can be true at once: a thing can be **strategically deferred** AND a
**genuinely missing rail.** This table holds both.*

> **Verification note.** Items are tagged **[verified]** (read in code this pass) or
> **[claimed]** (from docs/memory, the specific prod-config NOT re-traced — treat as
> plausible, confirm before relying). A prior agent pass returned a *stale snapshot*
> (claimed routes.ts=1,358 lines, no DashboardLab, no MFA, no tests) — all false;
> ground truth is below. Don't trust un-checked audits of this repo.

## ✅ Already built — do NOT re-fix (corrects the stale audits)

These were flagged "missing" by shallow/doc-based audits. They exist:
- **MFA / 2FA — BUILT end-to-end. [verified]** TOTP (`server/totp.ts`; `auth.ts:51`),
  login gates on `totpEnabled` (`auth.ts:1297`), verify endpoint + backup codes
  (`auth.ts:1373`), UI (`TwoFactorCard.tsx`), plus passkeys (`PasskeyManager.tsx`).
- **Durable rate limiter — BUILT. [verified]** `server/rateLimiter.ts`, applied
  cross-instance in `index.ts:720`. (Note: `rateLimiter.ts:57` says it *fails open*
  on limiter error — by design, but worth knowing.)
- **Gift text-safety — BUILT. [verified]** `server/giftTextSafety.ts`.
- **Content-scanner seam — BUILT (the vendor behind it is the gap, not the seam). [verified]** `server/contentScanner.ts` + `imagePipeline.ts` + `objectStorage.ts`.
- **KYC has a real failure path — [verified]** (`actionItems.ts:87` handles
  `kycStatus === "failed"`); not naive auto-approve. Fail-closed-in-prod posture =
  **[claimed]**, verify the env gating.

## 🔴 Actually a hole *now* (loop-independent) — honestly thin

The security hygiene is largely done (above), so this bucket is small — good news,
and the opposite of what a shallow audit implies. The one real present-risk item:
- **Guessable-slug child exposure. [verified]** The public gift page is a guessable,
  un-tokened `/<child-name>` slug returning the child's first name + photo with no
  auth (`routes.ts` generateUniqueFundSlug + the public funds endpoint). noindex, so
  not *searched*, but *enumerable*. **Consciously held for the counsel read** (Packet
  Part 5); honest-copy already shipped; photo-gating / slug-tokenization is scoped +
  reversible. Real edge, deliberately parked — not an accident.

## 🟡 Built but ugly (works; debt; NOT launch-blocking)

- **`routes.ts` = 26,034 lines. [verified]** Monolith, partial extraction underway
  (`server/routes/` has ageTransitionLifecycle/Verification, funds). Refactor when it
  slows you down, not before launch.
- **`Dashboard.tsx` 15,727 + `DashboardLab.tsx` 17,289 split-world. [verified]**
  DashboardLab is the live `/dashboard`; classic parked at `/dashboard-classic`.
  Deliberate migration, two surfaces co-existing. Fine for now.
- **Test coverage selective. [verified]** Many `test:*` scripts exist; payment-flow
  coverage is partial per docs. Broaden post-loop.

## 🟦 Deferred by design — AND still genuinely missing rails (both true)

Correctly staged behind the unproven loop (THE_PLAN), and real absent capabilities.
Do NOT rush-fill; clear in sequence when the loop earns it.
- **Brokerage custody not wired. [verified]** Zero real broker HTTP calls;
  `driveWealthAccountSetup.ts` is scaffold (10 TODO/stub markers), holdings/trades/
  balances are simulated. Gated on loop + capital. *The biggest "real-vs-shown" gap.*
- **Legal posture not cleared. [verified intent]** RIA/MTL/COPPA memo
  (Packet 1+2+5+7) — gates public launch. Gated on pulse.
- **Scaled-public-UGC safety incomplete. [verified]** Content-scanner *seam* exists
  but no real CSAM/image vendor wired; **sender-trust gate is SPEC-ONLY** (grep
  empty — not built). Gated on opening public uploads (deferred via invite-only).

## ⏭️ Launch-blocking LATER, not now (post-loop)

- Real CSAM/image moderation **vendor** + the **sender-trust gate** (when public UGC opens).
- Monolith decomposition (routes.ts, Dashboard) when maintainability bites.
- Broader payment-flow test coverage + a pen test.
- Present-tense custody/SIPC copy (gated on custody live + counsel — Packet Part 6).

## What to actually DO (sequenced against THE_PLAN)

- **Now / cheap / loop-independent:** essentially nothing forced — the hygiene is
  built. *Optionally* decide the guessable-slug photo posture (or just fold it into
  the counsel read). That's it.
- **The go-live gates, in order (= GO_LIVE_PLAN):** narrow legal memo → Alpaca custody
  wiring → funding bridge + email → invite-only launch. These are *gates, not bugs.*
- **After the loop proves out:** the moderation vendor + sender-trust gate, the
  monolith decomposition, broader tests, pen test.

## The one-line synthesis

**Not "sloppy and unfinished" — substantially built, strategically staged, and still
missing several launch-critical rails by design.** The hygiene most audits flag as
holes is already done (MFA, rate limiter, text-safety, scanner seam); the genuine
gaps (custody, legal, public-UGC safety) are real *and* correctly deferred — gates,
but gates are still gates. Prove the loop, then clear them in order.
