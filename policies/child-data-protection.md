# Children's Data Protection Program

**Owner:** Founder
**Last reviewed:** 2026-06-10
**Review cadence:** annual; on every change to a child-facing surface, child data
field, processor, or retention/deletion behavior

## 1. Purpose & posture

This is Kiddo's **written children's personal-information security program** — the
artifact the 2025 COPPA Rule amendments expect a covered operator to maintain.

We adopt it as **defense-in-depth and diligence-readiness**, not as a concession on
applicability. Our position (full analysis in `COPPA_APPLICABILITY_MEMO.md`) is that
Kiddo sits **outside COPPA's core**: we are an adult-facing financial service that
collects information **about** a child beneficiary **from the adult** (parent or
gifter), not a child-directed service that collects information **from** the child.
That position is load-bearing, so this program exists to (a) keep the one surface a
child actually touches a no-collection zone, and (b) be ready for partner / counsel
diligence on a children's-data company. It complements, and does not restate,
`data-classification.md`, `access-control.md`, `incident-response.md`, and
`SECURITY.md`.

## 2. Child data we hold, and how it is collected

All of the following is provided **by the adult**, never collected from the child:

| Data | Where | Notes |
|---|---|---|
| Child first/last name | `funds.recipient_first_name` / `_last_name` | Tier 2 |
| Child birthdate | `funds.recipient_birthdate` | drives UTMA majority age |
| Child SSN | `funds.recipient_ssn_last4` (+ `_full_encrypted`) | **only last-4 stored today**; full-SSN collection is pre-custody and not yet active; encrypted column is a stub until then |
| Child photo | `funds.child_photo_url` | gated off public endpoints (§4) |
| Memory Book media (photo/video/voice) + transcript | `memory_entries.*` | retained by design (§6) |
| Residence state | `funds.recipient_state` | majority-age lookup |

The collection model is the program's foundation: **from the adult, about the
child.** No child-facing intake form collects a child's own PII.

## 3. The "no-collection zone" rule for child surfaces

The only surface a child interacts with directly is **Kid View**
(`client/src/pages/KidView.tsx`). For any under-13 phase it must remain a
**read-only, no-collection, no-third-party, no-persistent-identifier zone**:

- Under-13 Kid View is **read-only**. The single write path (kid stock suggestions,
  free text) is **hard-gated to the teen phase (13+)** server-side
  (`server/routes.ts`, `ageInfo.phase === "teen"`), i.e. above the COPPA age.
- The PIN is a parent-set shared secret (authentication), not collected child PII.
- **No analytics/ad SDK, no third-party script, no persistent identifier** may be
  added to a child-viewed page. Fonts are self-hosted (no font-CDN IP egress);
  product analytics are first-party server-side only; error reporting (Sentry) is
  off and **safe-by-default** when enabled (token/PII redaction in
  `observability.ts`).

**Any future feature that lets an under-13 submit data, or adds a third-party
SDK/identifier to a child surface, flips Kiddo into COPPA scope with actual
knowledge. That is a founder + counsel decision, never an engineering default.**

## 4. Public exposure of minor data

Per the privacy policy, **public-facing minor pages display the child's first name
only.** Enforced in code (2026-06-09): `child_photo_url` is **not returned** by the
unauthenticated endpoints (`/api/public/funds/:slug`, `/api/public/events/:slug`,
`/api/stripe/session/:id/gift-summary`). Authenticated parent/co-admin surfaces
still resolve the photo. Minor funds are non-discoverable (direct-link only).

## 5. Data minimization

- Collect only what UTMA/custody requires; full SSN is gated to pre-investment and
  not collected until custody is wired.
- **No third-party advertising/analytics** on any child-data surface. Product
  analytics are first-party (`server/analytics.ts`), written to an internal table.
- Child Memory Book **media URLs are still sent to Stripe checkout metadata**
  (`stripeService.ts`) as the checkout→webhook transport — a known minimization gap
  scheduled for the persist-server-side refactor (open items, §9).

## 6. Retention & deletion

- Account deletion is two-phase: synchronous Phase 1 + a 30-day grace window, then
  the `accountDeletionWorker` PII scrub (anonymizes user row, Memory Book
  authorship, gift-sender identity; nulls owned-fund SSN; **nulls analytics-event
  ip/user-agent/session/props** — added 2026-06-09).
- **Memory Book content (incl. child media/voice) is retained by design** per the
  kid-at-18 principle — the timeline belongs to the child, not the deleting adult.
  Whether the child's name/photo should be deletable on **parental** deletion is an
  **open counsel decision** (`COUNSEL_ENGAGEMENT_PACKET.md` Part 3). The 2025
  amendment's retention-minimization rule applies *if* COPPA covers us, which is the
  Part 5 question — this tension is tracked, not resolved here.
- State age-appropriate-design-code laws reach minors to 18 and are **not** escaped
  by the from-adults structure as cleanly as COPPA; factor them into the Part 3
  retention decision.

## 7. Third-party processors that may touch child data

DPAs must be executed for the processors that are **actually live**; the privacy
policy conditionally lists others ("if we enable…") that are not wired. See
`EXTERNAL_SERVICES.md` for configured-vs-missing status and `vendor-management.md`.

| Processor | Child data | Status |
|---|---|---|
| Stripe | gift media URLs in metadata (§5), payer identity | **live** — DPA to confirm |
| Email (Postmark/SendGrid) | child first name in some templates | integrated; keys pending |
| Object storage (Supabase) | Memory Book media files | **live** — DPA to confirm |
| Plaid | parent bank data (not child) | pre-ACH; token-vault gap noted |
| Custodian (DriveWealth) | KYC/SSN when wired | **not wired** (scaffold) |
| OpenAI Whisper | child voice (transcription) | **dormant** — triple-gated, off |
| Sentry | none (off; safe-by-default scrubbing if enabled) | off |

## 8. Security controls (cross-reference)

Encryption, access gating, audit logging, and incident response are governed by
`data-classification.md` (Tier 1/2 handling), `access-control.md`, and
`incident-response.md`. Child data is Tier 1 (SSN) / Tier 2 (name, DOB, media).

## 9. Parental rights

Parents (account holders) may review, correct, and request deletion of data; the
deletion flow is §6. A formal self-service **DSAR/export** endpoint is not yet built
(open item). Requests are honored via support per the privacy policy.

## 10. Open items

- **C3** — move child Memory Book media off Stripe metadata (persist server-side +
  token; money-path refactor, own tested PR). See `DATA_PRIVACY_AUDIT_2026-06-09.md`.
- **Part 3** — counsel decision on child name/photo retention vs parental deletion.
- **DPA execution** for the live processor short-list (§7).
- **DSAR/export** self-service endpoint (§9).
- COPPA applicability confirmation from counsel (`COUNSEL_ENGAGEMENT_PACKET.md` Part 5).
