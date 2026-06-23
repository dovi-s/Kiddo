# Spec — Kid-Initiated "Fund Idea" Onboarding (flag-gated)

**Flag:** `KID_INITIATED_ONBOARDING` — **default OFF**. Inert until (1) a deliberate
business flip AND (2) counsel clears the gates in `COUNSEL_Q_KID_ONBOARDING.md`.

**Source:** 6-specialist advisory panel, adversarially cross-examined (see that
counsel doc). The hinge finding: **the teen must submit ZERO personally identifying
information**; the parent is the sole source of all demographic PII. As long as that
holds, the "from-adults" COPPA structure is intact and this is safe to *build* now.

---

## What ships in v1 (the safest defensible slice)

**Local-only, no-persistence teen exploration** — the strongest COPPA posture and an
explicitly panel-endorsed shape. Nothing the teen enters leaves the device until a
parent takes over. **No new server table, no server PII, no account.**

- Route: `/fund-idea`, lazy-loaded, **rendered only when the flag is ON** (otherwise
  the route is not registered → 404). Public/no-auth is fine *because nothing is
  collected*; a **13+ self-attestation interstitial** gates entry.
- Teen can: **name a fund idea**, **pick tickers** from the existing neutral allowlist
  (`shared/stock-picks.ts` `STOCK_PICKS`), and see a **read-only, family-framed
  projection** (`shared/projection.ts` `projectFundValue` + verbatim
  `PROJECTION_DISCLAIMER` from `shared/legal-copy.ts`).
- Draft persists in **`localStorage` only** (`{fundName, tickers, ts}` — zero PII).
- A calm **"Show a parent"** action explains that a grown-up makes it real. No email
  is collected from the teen.

## The hard CANNOT list (enforced, not just styled)
- ❌ No teen-entered email / name / DOB / phone / any identifier.
- ❌ No transacting, balances, holdings, real account, or Memory Book.
- ❌ No "you own / your account / it's real" present-tense language — strictly
  future/conditional ("a parent will **activate** this").
- ❌ No projection personalized to the minor ("YOUR fund could grow to $X");
  family-framed only ("if your family adds $X/mo…").
- ❌ No reminders / countdowns / scarcity / social proof / guilt / engagement-
  triggered nudges. One-shot: kid creates → kid shows → parent completes.
- ❌ No third-party tracking/pixels on the kid surface.

## Bright-line design rules (do)
- ✅ 13+ gate (self-attestation in v1; **server-side** when persistence is added).
- ✅ Curious/educational tone, never persuasive.
- ✅ The teen's experience is complete and rewarding **without** a parent (no
  friction-gated payoff withheld to force a parent invite).
- ✅ Any future parent invite is **Kiddo-sent to the parent-on-file**, not teen-typed.

---

## v2 (ONLY after counsel clears `COUNSEL_Q_KID_ONBOARDING.md`)

Add server persistence so the idea survives device/loss and a parent can adopt it:

- **Table `fund_ideas`** (zero PII): `{ id, kidUserId?, fundName, selectedTickers[],
  createdAt, expiresAt }`. **30-day auto-delete** of unclaimed rows + immediate delete
  on parent decline (new worker, mirrors `giftIntentExpiryWorker.ts`). **No PII
  columns ever.** *(Schema change = founder-owned; do not migrate without sign-off.)*
- **Server 13+ gate** on the write endpoint (not client-side).
- **Endpoints:** `POST /api/fund-ideas` (create), `GET /api/fund-ideas/:id`,
  `POST /api/fund-ideas/:id/show-parent` (Kiddo-sends to parent-on-file),
  `POST /api/fund-ideas/:id/adopt` (parent completes: existing KYC → UTMA ack →
  Stripe fund → shell becomes a real draft fund `userId = parent`, row deleted).
- **Parental opt-in toggle** (`fundIdeasEnabled`, parent-verified) **iff** counsel
  says state AADC requires opt-in-before-access (Q2).

## Flag wiring
- Server: `server/kidOnboardingFlag.ts` → `isKidInitiatedOnboardingEnabled()`
  (reads `KID_INITIATED_ONBOARDING` env), mirrors `giftCaptureFlag.ts`.
- Client: `client/src/lib/feature-flags.ts` → `KID_INITIATED_ONBOARDING` constant
  (default `false`) gating the route registration. Flip via build env later.

## Reuse (no new infra in v1)
- Allowlist + names: `shared/stock-picks.ts` (`STOCK_PICKS`, `isAllowedStockPick`).
- Projection math: `shared/projection.ts` (`projectFundValue`).
- Disclaimer: `shared/legal-copy.ts` (`PROJECTION_DISCLAIMER`).
- Handoff (the clean at-18 kid-agency vector): `Age18Welcome` / `Age18Plan`.

---

*Decision-support, not legal advice. v1 is build-safe; v2 ships only after the
counsel gates in `COUNSEL_Q_KID_ONBOARDING.md` are cleared in writing.*
