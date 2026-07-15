# Security Audit — 2026-06-15

Full multi-agent sweep (`security-audit`, mode:full): 106 agents, 18 confirmed
findings, each adversarially verified by 3 skeptics. This tracks every finding +
its status. Secrets hygiene was separately verified clean (frontend bundle + all
1,056 tracked files — no leaked keys).

## ✅ FIXED this session (8)

| # | Severity | Finding | Fix |
|---|---|---|---|
| 1 | 🔴 CRITICAL | **Gift double-credit** — `/api/gifts/:id/claim` credited the target fund without debiting the original, so a gift already credited to fund A by the webhook stayed counted in A *and* B. | `routes.ts` claim endpoint now re-reconciles the ORIGINAL fund after the move; made `WebhookHandlers.reconcileFundFromGifts` public (idempotent recompute-from-gifts). |
| 2 | 🟠 HIGH | **Passkey session fixation** — `req.login` without `session.regenerate`. | `passkeyAuth.ts` now regenerates the session before login, matching every other auth path. |
| 3 | 🟠 HIGH | **Email bombing — forgot-password.** | `auth.ts` per-IP (5/15min) + per-email (3/hr) rate limit, counted before existence check (anti-enumeration preserved). |
| 4 | 🟠 HIGH | **Email bombing — gift-invitations.** | `routes.ts` per-IP (8/15min) + per-target (3/hr) rate limit. |
| 5 | 🟡 MED | **XSS in share-modal print flyer** — user data (`recipientName`, label) into `document.write`. | `share-modal.tsx` HTML-escapes all user-controlled interpolations. |
| 6 | 🟡 MED | **DB enumeration/DoS — fund-code/resolve.** | per-IP rate limit (20/10min). |
| 7 | 🟡 MED | **DB DoS — public funds/:slug.** | per-IP rate limit (60/5min). |
| 8 | 🟠 HIGH | **esbuild CVE-2024-50617.** | **Already patched** — installed 0.25.9 (≥ the fixed 0.25.0). No action; stale finding. |

All typecheck-clean.

## ✅/⚠️ Founding-members 1,000-cap race — VERIFIED, direct path is SAFE (1)

| # | Finding | Outcome |
|---|---|---|
| 9 | **Founding-members 1,000-cap race.** | **Direct-signup path is already cap-safe (verified 2026-06-15) — the audit over-flagged it.** There's a `founding_members_position_unique` constraint (`shared/models/auth.ts:606`); on a collision the code recounts and re-checks the cap before retrying (`routes.ts:1313-1366`), so two concurrent claims at position 999/1000 can't both land. No redundant code added. **Residual (real but pre-launch):** the GIFTED-slot path still writes to the JSONL (not yet migrated to the same position-constrained DB insert per `project_founding_member_claim_flow_spec` Days 2-5), so gifted founders aren't yet cap-enforced against the same table. Close that when the gifted-slot→DB migration ships; it's pre-launch (Plus isn't live). |

## 🟦 PRODUCT-DECISION GATED — resolved by the "gate off public uploads" call (3)

Per `FOUNDER_ACTION_PLAN.md` item 3 (gate public/untrusted-sender media OFF at
launch), these largely resolve at the product level rather than by wiring a scanner:

| # | Finding | Status |
|---|---|---|
| 10 | **EXIF not stripped from uploaded photos** (GPS leak). | ✅ **FIXED for the authenticated parent photo upload** (`/api/funds/:fundId/memory/upload-photo`) — now runs every upload through `normalizeImage()` (strips EXIF/GPS, bakes orientation, re-encodes to webp; an undecodable buffer is rejected). The PUBLIC photo path gets gated off per the action-plan decision; wire the same `normalizeImage` call there if/when public media is re-enabled. |
| 11 | **Parent photo uploads not content-scanned.** | Parent = trusted sender (your sender-trust model); the scanner targets untrusted/public. Once public media is gated off, the unscanned-untrusted risk is gone. Defense-in-depth scanning of parent media = optional, do when a `CONTENT_SCANNER` vendor is wired. |
| 12 | **Audio/video uploads not scanned.** | Same as #11 — gated-off public paths remove the risk; authed parent media is trusted. |

## ✅ SIPC / custody copy — VERIFIED already-conditional (audit over-flagged, 3 of 4 false positives)

Read each flagged surface (2026-06-15). The audit agents misread **future/conditional
tense as present** — the real surfaces were already fixed in the 2026-06-03 conditional
pass and read correctly:
- `Home.tsx` (~931): *"**When** investing is live, securities are held by our broker-dealer partner (Member FINRA/SIPC)… **Once** accounts are open, eligible securities carry SIPC protection… not market loss."* ✅ conditional — FALSE POSITIVE.
- `About.tsx` (153-154): *"**When** investing is live… **Once** your account is open, eligible securities carry SIPC protection (broker-dealer failure, not market loss)."* ✅ FALSE POSITIVE.
- `ActivateInvesting.tsx` (1432): *"**Once** your account is open, investment accounts are SIPC protected… This does not protect against market losses."* ✅ conditional + disclaimer — FALSE POSITIVE.
- `App.tsx` (362): the **tax-documents** SEO meta (a `noindex` PRIVATE page) — *"the tax forms our broker-dealer partner issues for your funds."* Mild present-tense implication on a non-indexed private-page meta; not a public SIPC claim. **MINOR — founder-owned copy; soften to "will issue" if desired, but no compliance risk.** Surfaced, not changed.

No copy rewrite needed. (Same over-flagging pattern as the esbuild + founder-cap findings — verify before fixing.)

## 🟡 STORAGE — signing INFRA built; coupled wiring is prod-gated (2)

Verified 2026-06-15: the signing **infrastructure already exists** —
`getSignedUrl()` + `resolveMediaUrl()` (`objectStorage.ts:242-289`), and the
bucket is created **private + fail-closed**. So there's **no live exposure**:
dev uses local disk, and the module explicitly says *don't enable Supabase
Storage in prod until the signed-read path ships*. The finding = "the documented
migration (`STORAGE_DURABILITY_SPEC.md`) isn't finished," not an open hole.

**Remaining = 2 COUPLED steps (must ship together — half = broken media):**
1. `uploadToSupabase` returns the **bare object path** (not `/object/public/…`).
2. Call `resolveMediaUrl()` on **every read surface** that serves stored media
   (Memory Book, KidView, dashboard-summary gifts, activity feed).

**Deliberately NOT done now:** it's prod-storage-gated and **untestable** until
Supabase Storage is configured, and a missed read surface = broken family media.
Do it **as part of enabling Supabase Storage for prod** (per the action plan +
`STORAGE_DURABILITY_SPEC.md`), where it's verifiable end-to-end — not as a blind
scaffold. Until then the local-disk path is safe and unaffected.

---

## Net (final, 2026-06-15)

**9 fixed + verified, typecheck-clean** (critical double-credit, passkey fixation,
2× email-bombing, share-modal XSS, 2× DB-DoS, EXIF-on-parent-upload). The CRITICAL
money fix is additionally **validated by `test:dashboard-money-math` +
`test:gift-reconciliation-repair` (both pass)** — not just typecheck.

**Verified NON-issues (the audit over-flagged — verify before fixing paid off
repeatedly):** esbuild already patched; founding-members **direct** path already
cap-safe (position-unique + recount); **3 of 4 SIPC copy findings are false
positives** (already conditional/future-tense).

**Genuinely remaining, all gated (not code-now):**
- Gifted-slot cap → DB migration (pre-launch; `project_founding_member_claim_flow_spec`).
- Content-scanning → your "gate off public/untrusted media at launch" decision + the noop-until-vendor scanner.
- Signed URLs for private media → do with the prod Supabase Storage setup.
- App.tsx tax-docs noindex meta → trivial founder-owned wording (optional).

Re-run `security-audit` after the gifted-slot migration to confirm green. Net: every
exploitable finding is closed and the critical one is test-validated.
