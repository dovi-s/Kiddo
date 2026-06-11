# Data-privacy audit — triaged findings (2026-06-09)

Multi-agent `data-privacy-audit` workflow, full-tree, scoped to child-PII flows.
**179 agents, 40 confirmed findings (1 "fix-now", 39 "counsel-gated").** Each raw
finding was adversarially verified inside the workflow; **this doc re-triages them
against the actual code** rather than relaying them credulously. Several high-
severity items are false positives or already-known-by-design; the genuinely new,
actionable gaps are first-party retention/minimization hygiene, not the legal gate.
Decision-support, not legal advice. Pairs with `COPPA_APPLICABILITY_MEMO.md` and
`COUNSEL_ENGAGEMENT_PACKET.md` Parts 3 + 5.

---

## Headline: the from-adults COPPA thesis survived an adversarial audit

The audit independently confirms the load-bearing claims in
`COPPA_APPLICABILITY_MEMO.md`:

- **No third-party tracking on child-viewed pages.** `server/analytics.ts:1-2` is
  first-party, server-side only ("No third-party tracking pixels, no kid data
  shipped off-platform"); events write to an internal `analyticsEvents` Postgres
  table. There is **no** Google Analytics / Mixpanel / Segment SDK in the client.
  The Google Fonts IP-egress (the one real third-party leak on a child page) is
  **already fixed** this session (self-hosted fonts).
- **No live child-data egress to surprise processors.** OpenAI Whisper transcription
  is dormant: triple-gated behind a default-off flag, `OPENAI_API_KEY`, and an
  optional package (`routes.ts:13748-13771`, `featureFlags.ts:74`). It does not run.
- **The "from the adult, not the child" structure holds.** Nothing in the audit
  found an under-13 submitting personal information; the teen-only suggestion gate
  (`routes.ts:6892`) stands.

So the 39 "counsel-gated" findings largely **restate the questions already in the
counsel packet** (COPPA applicability + child-PII deletion). The audit *confirms the
packet's scope*; it does not widen the legal gate. The real engineering work below
is first-party hygiene.

---

## A. Verified FALSE POSITIVE / overstated (do not action)

- **"SSN stored plaintext despite encrypted label" (#16, high, 2/3).** FALSE
  POSITIVE. The collection path writes **only `recipient_ssn_last4`**
  (`routes.ts:10719-10732`); `recipientSsnFullEncrypted` is never written with a
  plaintext value (only set to `null` on deletion, `accountDeletionWorker.ts:250`).
  No plaintext full SSN exists today. The "encrypted" column is a pre-custody stub.
- **"Audio uploaded to OpenAI Whisper without consent" (#6, high).** Overstated —
  dormant/triple-gated (see headline). Real only *if* Whisper is ever enabled, at
  which point child voice → OpenAI needs a DPA + disclosure. Track, don't fix now.
- **"No parental consent gate before child PII collection" (#3, #11, high, 3/3).**
  Miscategorized. The **parent is the data source** for their own child's info —
  COPPA's "verifiable parental consent" governs collection *from the child*. Whether
  a consent artifact is *required* here is exactly the **Part 5 counsel question**,
  not a settled violation. (There is already per-fund UTMA-irrevocability consent at
  `utmaAcknowledgedAt`.)

## B. Already-known / by-design (no new action; tracked elsewhere)

- **Permanent Memory Book never deleted (#14, #25).** This is the **retention
  paradox** already in the COPPA memo — the lifelong Memory Book is the switching-
  cost moat. The permanent-vs-deletable reconciliation is open packet Part 3.
- **Public child first name on the gift page (#17).** By-design (gifters need to
  know who they're giving to); left by-design in the 2026-06-03 security audit.
  **But see C1 — the privacy-policy copy doesn't match what the API returns.**
- **Plaid token-vault gap (#1, #24, #29, #33, high/med).** Real but pre-ACH infra.
  The skeptic dissent is correct: Kiddo deletes all its *own* bank PII immediately on
  account deletion; the residual is that Plaid's *own* Item linkage persists up to
  ~90 days (Plaid's sweep), because the access_token is intentionally never stored.
  Fix belongs with the token-vault work *before production ACH goes live*, not now.

## C. REAL + NEW + worth doing (first-party hygiene, mostly non-legal)

### C1. Privacy-policy copy contradicted actual behavior — RESOLVED 2026-06-09 (gated)
`Legal.tsx:141` promises public minor pages display **"only the child's first
name,"** but the public endpoints returned **`childPhotoUrl`** too (#15, #17), and
the gift-checkout hero rendered the child's face as a circular avatar
(`GiftCheckout.tsx:1650, 1984`). That policy-vs-practice mismatch is the exact FTC
Section 5 "deceptive practice" theory used in COPPA-adjacent enforcement.
**Resolved by gating the photo** (founder delegated the call, "do what's best and
legal"): `childPhotoUrl` is now omitted from the three unauthenticated endpoints —
`/api/public/funds/:slug` (`routes.ts:7440`), `/api/public/events/:slug` (4341),
and `/api/stripe/session/:sessionId/gift-summary` (13419). Chosen over "weaken the
policy copy" because gating needs **no counsel sign-off**, is strictly more
protective of a child's face on a forwardable link, and makes the existing promise
true. Low blast radius: the hero **background** is keyed on the parent's event
cover (`event.imageUrl`), not the child photo, so only the small avatar drops
(already null-guarded → degrades to the existing no-photo treatment). Authenticated
parent/co-admin surfaces still resolve the photo. Reversible: restore the field +
update the policy copy with counsel sign-off if conversion data ever justifies it.

### C2. Deletion-worker coverage gaps (additive, no money-path risk)
`accountDeletionWorker.ts` anonymizes some surfaces but misses others on account
deletion:
- **Child photo URL not scrubbed (#34)** — `funds.childPhotoUrl` survives deletion.
- **Analytics events carry IP + are not scrubbed (#8, #30)** — `analyticsEvents`
  rows (with `ipAddress`, `userAgent`) persist after the user is deleted.
- **Audit logs not anonymized + no retention policy (#20, #27)** —
  `auditLogs` keeps PII-adjacent rows indefinitely.
- **Gifter PII has no deletion path (#7, #39)** — `gifters` rows persist after
  unsubscribe / forever; no scrub.
These are real and additive (extend the existing worker + document a retention
policy). They reinforce the Part 3 deletion decision and the data-minimization story.

### C3. Stripe metadata over-sharing (#5, #22, #23) — money-path, NOT a drive-by
The child's Memory Book **media URLs** (`photoUrl/videoUrl/audioUrl`) ride in Stripe
checkout + payment-intent metadata (`stripeService.ts:438-501`). They are **not**
needed by Stripe to charge a card. BUT the webhook reads them back
(`webhookHandlers.ts:1294-1296`) to attach the gift media — Stripe metadata is the
transport from checkout to webhook. So the clean fix is a **refactor**: persist gift
media server-side (a pending-gift row keyed by the idempotency key/token), pass only
that token through Stripe, and read media from our own DB in the webhook. This aligns
with the CLAUDE.md rule "do not grow the Stripe leak" and is a scoped, testable
change — **not** a 3-line delete (deleting the fields would break media attachment).
(Gifter name/email to the Stripe Customer object, #23, is largely inherent to card
payments — receipts/fraud — and is the most defensible of the three.)

### C4. Field-level encryption gaps (lower live impact)
- `audioTranscript` stored unencrypted (#4, #35) — empty until Whisper is enabled.
- `kycData` JSONB stored plaintext (#32) — pre-custody; revisit when KYC goes live.

## D. The 39 "counsel-gated" findings

These fold into the existing packet, they do not add a new legal workstream:
- Deletion / retention / DSAR / Memory-Book permanence → **Part 3** (child-PII
  deletion). The audit adds concrete file:line evidence (the C2 worker gaps + the
  absence of a DSAR/export endpoint, #13, #26) to that decision.
- COPPA applicability / consent / public child PII → **Part 5** (the from-adults
  question). The audit confirms the thesis rather than contradicting it.
- One genuinely new ops (not counsel) item: **execute DPAs with the processors that
  are actually live** (Stripe, transactional email, object storage; later custodian,
  Plaid, OpenAI). The privacy policy over-lists processors that aren't wired; the
  real DPA need is the short live list. This is vendor-management hygiene
  (`policies/vendor-management.md`), not a launch-gating legal question.

---

## Recommended sequence (founder's call on each)

1. ~~**C1 — resolve the policy-vs-photo discrepancy.**~~ **DONE 2026-06-09** — gated
   the photo on the three public endpoints; the privacy promise is now true.
2. **C2 — extend the deletion worker.** **PARTIALLY DONE 2026-06-09:** added the
   analytics-event PII scrub (ip/user-agent/session/props nulled on deletion,
   `accountDeletionWorker.ts`). The other "gaps" the audit named are NOT bugs:
   child photo/name on parental deletion is the **open Part 3 policy decision**
   (the worker deliberately leaves it per the kid-at-18 retention principle), audit-
   log retention is a security-forensics tradeoff, and gifter-table deletion is a
   separate gifter-initiated flow. Left as-is by design; documented here.
3. **C3 — schedule the Stripe-media-URL refactor** as its own tested PR before the
   gift-media volume grows. Money-path (webhook reads the URLs back), so not bundled.
4. **DPA execution** for the live processor short-list (ops, parallel to counsel).
5. Everything else folds into counsel packet Parts 3 + 5 — already teed up.

---

## Appendix — C3 build-ready implementation plan (Stripe media-URL minimization)

**Why this is a plan, not a commit:** the child Memory Book media URLs ride in
Stripe metadata as the checkout→webhook transport, and the webhook resolves them in
**multiple sites across methods** (`webhookHandlers.ts:1274`, `1294-1296`, and the
`ensureMemoryEntryForGift` paths ~281/411), then *creates the gift row from that
metadata*. Editing those read-sites blind, with no live Stripe webhook to test, risks
**silent gift-media loss**. A feature flag protects the write side but not a missed
read-site. So this lands as one tested unit (apply migration → enable in staging →
smoke-test a real gift → confirm media attaches AND URLs are absent from Stripe).

**Design: flag-gated + graceful degradation.** Ship inert; fall back to legacy
behavior on any error or when the table/flag are absent — so it cannot break gifts.

1. **Flag** — `server/stripeMediaTokenFlag.ts`, env `STRIPE_MEDIA_TOKEN_ENABLED`,
   default **false** (mirror `giftCaptureFlag.ts`).
2. **Table** — `pending_gift_media` (migration `0046`, hand-written SQL + journal
   idx 45 per the migration gotcha; never `db:generate`):
   ```sql
   CREATE TABLE IF NOT EXISTS pending_gift_media (
     token       varchar PRIMARY KEY,
     photo_url   text,
     video_url   text,
     audio_url   text,
     created_at  timestamp NOT NULL DEFAULT now()
   );
   ```
   Add the matching `pendingGiftMedia` Drizzle table in `shared/schema.ts`.
3. **Storage** (`server/storage.ts`): `createPendingGiftMedia({token,photoUrl,
   videoUrl,audioUrl})`, `getPendingGiftMedia(token)`, `deletePendingGiftMedia(token)`.
4. **Checkout call-sites** (`routes.ts:12878` + `17419`): when the flag is on AND any
   media URL is present, generate a `crypto.randomUUID()` token, persist the media,
   and pass `mediaToken` to `createGiftCheckoutSession`. On **any** failure, skip the
   token (→ legacy URLs-in-metadata path). Keep passing the URL params too.
5. **`stripeService.createGiftCheckoutSession`**: add `mediaToken?: string` to
   `GiftCheckoutParams`. In **both** metadata blocks (session ~446-448 and
   payment_intent ~482-484): if `params.mediaToken`, emit `mediaToken` and **omit**
   `photoUrl/videoUrl/audioUrl`; else emit the URLs (legacy).
6. **Webhook hydration** (`webhookHandlers.ts`) — the delicate part; verified
   2026-06-10. Metadata is parsed **per-method** (`const metadata = session.metadata
   || {}` recurs at lines 1102, 1206, 1244, 1360, 1461, 1559, 1615, 2063, 2176,
   2364…), and gift media is read in **at least three distinct methods**: ~264-281
   (parent-contribution path → `ensureMemoryEntryForGift`), ~405-417 (audio/photo
   handling), and ~1244-1296 (main gift creation: reads at 1274 + 1294-1296). There
   is **no single chokepoint**. Preferred approach (additive, no refactor of the live
   read-sites): right after each media-reading method's `const metadata = …`, insert
   one guarded `await hydrateMediaFromToken(metadata)` that, **only when
   `metadata.mediaToken` is set**, fetches the row and populates
   `metadata.photoUrl/videoUrl/audioUrl` in place (then schedules
   `deletePendingGiftMedia` after the gift row is created). With the flag off no token
   is ever set, so the hydration is a proven no-op and every existing read-site
   behaves exactly as today. **Each media-reading method must get the hydration; a
   missed method means flag-on media loss on that path** — which is precisely why the
   flag-on smoke test below must exercise the occasion-event, anonymous, and
   existing-gift paths, not just the happy path.
7. **Cleanup**: opportunistic `DELETE FROM pending_gift_media WHERE created_at <
   now() - interval '7 days'` (abandoned checkouts) — piggyback an existing worker
   tick; low-harm if deferred (rows are URL strings only).

**Test checklist (founder, or a session with live Stripe test webhooks):**
- [ ] Apply migration 0046 (`npm run db:migrate`); confirm table exists.
- [ ] Flag **off**: gift with photo + voice → media attaches (legacy path unchanged).
- [ ] Flag **on**: gift with photo + voice → media attaches AND the Stripe
      dashboard shows `mediaToken` with **no** photo/video/audio URLs in metadata.
- [ ] Anonymous gift with media → media correctly suppressed (gating intact).
- [ ] `pending_gift_media` row deleted after completion; abandoned rows swept.
- [ ] In-flight session created before deploy (legacy metadata) still attaches media.
