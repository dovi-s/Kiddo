# COPPA applicability — is Kiddo a covered operator? (internal memo, 2026-06-09)

**Status:** internal analysis to ground the counsel question, NOT legal advice.
The load-bearing conclusion ("we collect from adults, not from children") needs a
licensed lawyer's signature. This memo exists so that conversation takes 15 minutes
instead of an hour, and so the engineering guardrails are written down. Pairs with
`COUNSEL_ENGAGEMENT_PACKET.md` Part 5 and Part 3 (child-PII deletion).

The 2025 COPPA Rule amendments are **in effect now** (published April 22, 2025;
full-compliance date April 22, 2026, which has already passed). So if any
applicability exists, it is live, not "coming."

---

## The thesis: Kiddo sits structurally outside COPPA's core

COPPA triggers on collecting personal information **from a child**, through a
service **directed to children** or with **actual knowledge it is collecting from
under-13s** (16 CFR 312; 15 U.S.C. 6501-6505). In every FTC and FTC-aligned source,
the preposition is invariant: "from the child."

Kiddo is not a child-as-user product. The child is a **beneficiary, not a user.**
Every piece of children's personal information is collected **from the adult**
(parent or gifter), not from the child through the child's own online activity:

- `funds.recipientFirstName` / `recipientLastName` — entered by the parent at fund creation (`shared/schema.ts:32-33`)
- `funds.recipientBirthdate` — entered by the parent (`schema.ts:35`)
- `funds.recipientSsnFullEncrypted` / `recipientSsnLast4` — entered by the parent, **encrypted at rest**, required only for 1099 tax reporting before first investment (`schema.ts:36-41`)
- `funds.childPhotoUrl`, Memory Book `photoUrl` / `videoUrl` / `audioUrl` — uploaded by the parent or by gifters (`schema.ts:31`, `schema.ts:575-577`)
- `funds.recipientState` — entered by the parent, drives UTMA majority age (`schema.ts:44`)

That single fact — collected *from the adult about the child* — is what places the
core product outside COPPA. It is the same posture every UTMA-gifting peer sits in.
**Most of the COPPA "youth app" guidance circulating (e.g. the Bradley/Illman
Law360 piece on COPPA-ready youth apps) is written for teen-debit / youth-banking
products where the kid logs in and uses a card. Its compliance playbook largely
reduces to "you are not that company." We should not over-build verifiable-parental-
consent gates we don't need.**

---

## Why the thesis is load-bearing, not academic: three sharp points

### 1. The "actual knowledge" trap means the *from-whom* distinction carries 100% of the load

Note what Kiddo can **never** argue: lack of knowledge. The whole product is "give
to a child," so we always have actual knowledge a minor exists. The general-audience
escape hatch ("we didn't know there were kids here") is closed to us by design.

So our entire COPPA position rests on a **single hinge**: *we don't collect from the
child, we collect from the adult.* There is no backup argument. The practical
consequence: the only real risk is a surface where a child **submits data or gets
tracked directly.** If one exists, the hinge breaks and we are instantly in-scope
**with full knowledge** — the worst version. Everything below is about protecting
that hinge.

### 2. Kid View is the one child-touching surface — and it is architected correctly

`client/src/pages/KidView.tsx` (route `/kid/:token`) is the only place a child
interacts with the product directly. It is PIN-gated. Critically:

- **Under-13 Kid View is read-only.** The child sees balance, holdings, gifts,
  Memory Book. The child submits nothing.
- **The one write path — kid stock suggestions (free text) — is hard-gated to the
  teen phase.** The server returns 409 unless `ageInfo.phase === "teen"`
  (`server/routes.ts:6892`). Teens are 13+, i.e. **outside COPPA entirely.** So the
  single surface where a child types free text is locked to non-COPPA-age users.

This is the architecture already enforcing the line. The PIN the under-13 enters is
a parent-set shared secret (auth), not collected personal information about the
child. Three residual watch items, none fatal, all worth closing:

- **(a) Google Fonts hotlinking shipped every visitor's IP to a third party — FIXED
  2026-06-09.** `client/index.html` previously loaded fonts from
  `fonts.googleapis.com` / `fonts.gstatic.com`. An IP address is a **persistent
  identifier** under COPPA's expanded definition, and Kid View is viewed by children,
  so this handed every Kid View visitor's IP to Google. **Fixed:** fonts are now
  self-hosted via `@fontsource-variable/dm-sans` + `@fontsource-variable/bricolage-
  grotesque` (the `opsz` variants preserve the optical-sizing axis), imported in
  `client/src/main.tsx`; the Google `<link>` is removed. Verified: production build
  emits 7 local `.woff2` assets and no font CDN hotlink remains on app surfaces.
  (One Google Fonts `@import` for Inter remains in the **adult** print-flyer pop-up,
  `share-modal.tsx` `handlePrintFlyer` — not a child surface, and the flyer is a
  designed brand artifact, so it's left to a founder typography call.)
- **(b) The Sentry seam must scrub child context if ever enabled.**
  `client/src/lib/observability.ts` lazy-loads Sentry only when `VITE_SENTRY_DSN`
  is set (currently **off** by default — good). If turned on, Kid View errors would
  ship to a third party. Today no logged-in `userId` exists on Kid View so none is
  sent, but the URL/stack can contain the share token. Before enabling Sentry,
  confirm Kid View payloads carry no child identifiers/token.
- **(c) Teen free-text suggestion is stored raw + echoed into parent Activity.**
  `routes.ts:6895-6924` stores the 280-char `reason` and copies it into an Activity
  row. Teens are outside COPPA, but it is child-authored free text that could
  contain PII, so keep the existing safety-scan posture (`server/giftTextSafety.ts`)
  applied here and don't widen this endpoint to younger phases.

**Engineering guardrail (write this down):** Kid View, for any under-13 phase, must
remain a **no-collection, no-third-party, no-persistent-identifier read-only room.**
Any future feature that lets an under-13 submit content or adds an analytics/3p SDK
to this surface flips Kiddo into COPPA scope with actual knowledge. That is a
founder/counsel decision, never a default.

### 3. The retention paradox: the 2025 amendment collides head-on with the moat

The 2025 amendments hard-prohibit **indefinite retention** of children's PII and
require data minimization. Kiddo's switching-cost moat **is** the permanent,
lifelong Memory Book of a child's photos, videos, and voice — textbook COPPA
"personal information" (image and voice files). If COPPA applied to Kiddo, the moat
would be partially **illegal** (indefinite retention of children's media) and would
collide with the parental review-and-delete right.

So the from-adults thesis is not a nicety; it is **what keeps the business model
legal.** This raises the stakes on getting counsel to bless it, and it sharpens the
already-open child-PII-deletion question (`CHILD_PII_DELETION_DECISION.md`, packet
Part 3): the "permanent by design" vs "deletable on request" reconciliation has to
hold **regardless of COPPA**, because state age-appropriate-design-code laws (CA
AADC and the wave behind it) reach minors up to 18 and are *not* escaped by the
from-adults structure as cleanly as COPPA is.

---

## What the 2025 amendments change for us (if the thesis holds: almost nothing)

If we are outside COPPA, none of the below is strictly mandatory. But a cheap
defensive subset is worth adopting anyway — it costs little, serves other laws
(state AADC, GLBA, plain trust), and makes the "we took children's data seriously"
story true if a regulator ever squints:

1. **Self-host fonts** (point 2a) — the one concrete egress fix.
2. **Written children's-data security program** — the amendment's new requirement.
   We handle kids' SSNs and faces; write the one-pager even if outside scope.
3. **No third-party ad/analytics SDK on any child-data surface, ever** — the
   amendment's separate-consent-for-third-party-disclosure rule is the sharpest new
   edge; the clean way to never trip it is to never share child data with ad/
   measurement parties at all. Stripe and the custodian are integral-to-service, not
   "disclosures for ads," so they are fine.
4. **Data minimization on the child record** — collect only what UTMA/custody
   actually requires (we largely do; SSN is gated to pre-investment and encrypted).

**Not law, do not build to it:** COPPA 2.0 (raise to 16, FTC youth-marketing
division) is **proposed**, not enacted. Watch it; the from-adults structure still
protects us if it passes.

---

## The narrow question for counsel

> Confirm Kiddo is **not a COPPA-covered operator** on the theory that it collects
> children's personal information **from the adult** (parent/gifter), not from the
> child, and that PIN-gated read-only Kid View plus teen-only (13+) write access
> does not constitute "collection from a child." Identify the one or two surfaces
> where that conclusion is fragile (Kid View third-party egress; Memory Book
> indefinite retention), and tell us which **state children's-privacy / age-
> appropriate-design** obligations attach regardless of the COPPA answer.

That is a 15-minute add to the existing engagement, folded into packet Part 5.

---

## Audit corroboration (2026-06-09)

A 179-agent `data-privacy-audit` (full triage in `DATA_PRIVACY_AUDIT_2026-06-09.md`)
**adversarially validated this memo's thesis**: no third-party tracking on child-
viewed pages (analytics is first-party server-side), no live child-data egress to
surprise processors (Whisper is dormant/triple-gated), and the "from the adult, not
the child" structure holds. Two audit findings that sounded alarming are verified
**false positives**: "SSN stored plaintext" (only `last4` is stored; the encrypted
column is never written plaintext) and "audio → OpenAI" (dormant). The audit's real
value was first-party hygiene, not the legal gate — see the triage doc's section C.
**Two of those are now fixed (2026-06-09):** (C1) the child's photo is gated off the
three unauthenticated endpoints, so the privacy policy's "public minor pages show
only the child's first name" is now true (closing a policy-vs-practice / FTC-
deception gap); (C2) the deletion worker now scrubs analytics-event PII
(ip/user-agent/session/props) on account deletion. The Stripe-media-URL minimization
(C3) is a money-path refactor left for its own tested PR.

## Action items (this is the founder's call on what to take)

- [x] **Self-host the two web fonts** — DONE 2026-06-09 (@fontsource-variable,
      Google `<link>` removed, build verified emitting local woff2). Removed the
      only routine third-party egress on a child-viewed page.
- [ ] (optional) Self-host Inter in the adult print-flyer pop-up too, or fall back
      to a system stack — founder typography call, non-COPPA (adult surface).
- [ ] Add a **"Kid View is a no-collection zone"** code comment / guardrail so the
      invariant survives future features.
- [ ] Before ever enabling Sentry, confirm Kid View payloads carry no child token/PII.
- [ ] Write the **one-page children's-data security program** (cheap insurance).
- [ ] Put the narrow question (above) to counsel via packet Part 5.
- [ ] Reconcile permanent-Memory-Book vs deletable-on-request in the Part 3
      child-PII-deletion decision, framed for state AADC, not just COPPA.
