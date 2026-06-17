# Notifications Architecture Spec

> Status: **Proposal, pressure-tested 2026-06-12, written up 2026-06-15.**
> Founder-owned surface (loop mechanics + demo feel per CLAUDE.md): AI proposes
> and executes the safe phase, but does NOT ship the paradigm rewrite
> unilaterally. This doc is the single artifact to ratify, so the change lands
> as one coherent piece instead of patches to the most-patched file in the repo
> (`client/src/components/NotificationsPanel.tsx`).
>
> Origin: an 8-agent adversarial + specialist pressure-test (growth, product/UX,
> compliance, trust-safety, engineering, brand-strategy + a red-team + synthesis).
> Per-finding evidence with file:line lives in the workflow output; the load-bearing
> citations are inlined below.

---

## TL;DR (the verdict)

The current notification system is the inbox / social paradigm: a header bell
with an unread count, Activity nav badges (the "9+"), per-fund dots, "Mark all
read", a localStorage `lastReadAt` watermark + `readIds`/`unreadIds`, swipe-to-
mark-read/unread, clock-skew defenses, cross-tab sync, and two count hooks
(`useBellUnreadCount` + `useNotificationUnreadCount`) the code calls "functionally
identical" yet which drift (bell "1" vs Activity "9+").

That paradigm fights Kiddo's locked design lens (the live balance was pulled from
the header to avoid "is it up today"; "you don't need the feed" is the literal
moat in `EDUCATION_THESIS.md`; Kid View bans badges/streaks). The right end state
is calm, with three honest channels. **The direction is unanimous across all six
lenses and the red-team. The danger is entirely in doing the one-way deletion
before the replacement channels exist.**

So: **split the work and sequence it.** Ship the correctness cleanup now; gate the
paradigm deletion behind real prerequisites; route the destructive + persona +
copy decisions to the founder and counsel.

---

## The three-channel model

Replace "unread" (an engagement metric) with three surfaces, each honest about
its job:

1. **Needs You** — the ONLY surface that ever carries a count. Server-truth action
   items (KYC, payment failed, SSN missing, large-gift hold, the at-18 handoff).
   The count persists until the underlying problem is RESOLVED, never cleared by
   glancing. Empty most days, shown as a calm "All clear". Already ~80% built:
   `server/actionItems.ts` `deriveActionItemsForUser` re-derives fresh per request
   from live state, with snooze in `funds.dismissedNudges`. This is extraction,
   not invention.

2. **Money Record ("Activity")** — the financial ledger. Every dollar movement,
   unbadged, tax-relevant, the trust artifact. Behaves like a brokerage statement:
   present when wanted, silent otherwise. Non-money app/system events (you edited a
   memory, strategy auto-rebalanced) are not in this ledger and are not a prominent
   feed.

3. **Moments** — the curated emotional layer (a gift landed, a milestone crossed).
   Delivered via the "while you were away" digest on app open, the gift
   choreography, Memory Book, and email/push. No badge, no accumulating debt.

Plus: user-controllable **preferences** (default quiet; the parent can opt into
pings). Preferences are a DELIVERY axis, not a triage axis, and must NOT be able
to silence the compliance-clocked subset (see Tier D).

---

## What is true today (honest current state, do not skip)

The pressure-test verified several premises were overstated. Correcting them
changes the build:

- **The at-18 handoff is NOT a Needs-You action item.** `actionItems.ts` derives
  only `stalled_handoff` (fires T+90 days AFTER a kid FAILED to claim). The actual
  keystone moment (kid turns 18, claim now available) is carried ONLY as
  informational bell rows `kid_age_18_reached` (`age18TransitionWorker.ts:567`) +
  `age18_invite_auto_sent` (:619), which is the exact surface the deletion removes.
  And `age18_handoff_ready` (the card the bell's dedup claims "is doing the work",
  `NotificationsPanel.tsx:253-258`) is **phantom code written by zero workers.**
  Deleting the informational surface without first building a real handoff
  Needs-You item dark-holes the `COMPANY_STRATEGY.md` §0b keystone in-app.

- **The 9-vs-1 is a feed-window artifact, not just duplicate logic.** Root cause
  (`NotificationsPanel.tsx:1925-1936`): the bell uses a 40-row per-fund
  `useActivities` window; the Activity dot uses `useScopedNotifActivities` (matched
  to the /activity page). "Impossible by construction" is only true if Needs-You
  becomes **account-global AND uncapped**, which reverses the founder-locked
  2026-05-28 per-fund-scoping call.

- **"Money Record = complete / tax-ready / permanent" is false today.** No `fee`
  and no `dividend` activity type exists (`shared/activity-semantics.ts`; AUM fee
  is display-only, holdings simulated), and the account-deletion path actively
  deletes activity rows (`routes.ts:20405,20413`). Branding it "complete" collides
  with the broker-dealer's authoritative 1099 at custody, and UTMA retention is an
  open counsel question (`COUNSEL_ENGAGEMENT_PACKET.md` Part 3).

- **Email is a config gap, not a build.** `server/emailDelivery.ts` is a full
  layer (Postmark + SendGrid + dedupe + suppression + RFC-8058 unsubscribe +
  bereavement freeze). With no provider key, `sendEmail()` falls to an
  `outbox_fallback` JSONL file nobody reads. So "calm in-app + unconfigured email =
  silent product" is real, but the gate is cheap to clear (key + DNS).

- **The gifter and adult-owner are first-class, not a sequel.** Their contracts are
  OPPOSITE the calm parent (see per-persona section). The gifter is already
  email/worker-driven (`gifterNotificationWorker.ts`), so with email unconfigured
  that side is ALREADY dark.

- **Stranger content containment.** Today's `giftReceived` email ships only
  `hasNote: boolean` ("a note is waiting in the Memory Book"), never the body;
  `giftTextSafety.ts` is contact-pattern matching, NOT content moderation. The H1
  sender-trust gate (`KID_VIEW_SAFETY_GATE_SPEC.md`, `kid_review_status`) is
  spec-only / zero code. Routing stranger note text or attacker-controlled
  `senderName` into email/digest/Moments before H1 is a net-new abuse vector.

---

## Execution split

### Tier A — Safe to ship now (correctness, client-only, reversible)

AI may execute these; founder-ratifiable on sight. None re-architect the surface.

- **A1. Collapse the two count hooks to ONE shared server-truth count** fed by a
  single query key, parameterized by scope. Fixes the 9-vs-1 the user reported.
  (See the scope decision D1 below: doing this the clean, drift-proof way needs the
  account-global call.)
- **A2. Surface the EXISTING action-item layer as the Needs-You channel** for the
  items that genuinely exist today (KYC, `payment_failed`, `large_gift_hold`,
  `ssn_missing`, etc.). Extraction, not invention.
- **A3. Treat deep-link URL conventions as a separate contract from the panel UI.**
  Keep every route target alive (`/age-18-plan`, `/memory/:fundId?gift=`,
  `/activate?fundId=`) when the panel changes; queued emails/pushes still emit them.
- **A4. Handle the 3 importers deliberately** (not a silent break): `Activity.tsx`
  arrival-highlight (`getLastReadAt`) and `DemoGiftMoment.tsx` demo seeding
  (`markNotificationsReadAsOf`). These touch the founder-owned demo feel, so the
  decision to drop or re-anchor them is a sign-off, not a refactor side effect.

### Tier B — Gated on prerequisites (the paradigm deletion)

Do NOT one-way delete the inbox / informational-unread surface until ALL of:

- **B1. Email verified delivering** a real gift-received + needs-you email (not
  just hitting the outbox).
- **B2. PostHog wired** with the guardrail funnel: in-app return-visit rate within
  72h of a gift landing, time-from-gift-settled to gift-viewed, with funded-k as
  the non-regression guardrail. You cannot honestly cut a re-engagement lever you
  cannot measure.
- **B3. A real handoff Needs-You item built** in `actionItems.ts` (kid-turned-18 /
  claim-available) before deleting the informational rows that carry the keystone.
- **B4. Blocking items made account-global + uncapped** (this is what ACTUALLY
  makes 9-vs-1 impossible by construction). Requires D1.
- **B5. Port the owner-mode feed-source selection** (`useScopedNotifActivities`,
  `NotificationsPanel.tsx:1775-1791`) into the Money Record verbatim, with a test
  that a post-handoff adult owner sees their full pre-handoff ledger. Skipping it
  shows the new adult owner an EMPTY ledger at the keystone.
- **B6. Behind a reversible flag, as the LAST step.** The deletion is free to defer
  because the machine is client-only with zero migration cost.

### Tier C — Founder sign-offs required

- **C1.** Removing the informational surface, redefining the bell as Needs-You-only,
  re-routing Moments through the digest, and the "default quiet" default. Verify
  with the demo RENDERED ("verify, then claim").
- **C2.** The demo bell: `deriveActionItemsForUser` early-returns `[]` for demo
  accounts, so under the new model the Rivera demo bell reads permanently "All
  clear / 0", removing the "worn, lived-in" texture. Decide deliberately whether
  the demo's recent-activity feel lands entirely in the digest + gift moment.
- **C3.** Ratify reversing the 2026-05-28 per-fund-scoping call so Needs-You
  blocking items are account-global (recommended: yes; money problems should not
  hide behind active-fund scope).
- **C4.** Approve the bounded "celebrate-now" allowlist: one-time, life-event-
  triggered (first gift ever, handoff day), parent/gifter surface only, never
  balance-triggered, never recurring, never on Kid View. Mobile push is already
  badge-less by construction (`shouldSetBadge:false`), so this delivers the moment
  without reviving accumulating debt.
- **C5.** The visible labels ("Money Record", "Moments") are copy and therefore
  founder-owned. Likely external IA: keep "Activity" as the ledger name, let Moments
  stay delivery surfaces with no dedicated nav, fold Needs-You into the bell +
  dashboard cards.

### Tier D — Counsel-gated

- **D-counsel-1.** No "complete / permanent / tax-ready" framing on the Money
  Record until `fee` + `dividend` ledger rows exist, the deletion path is reconciled
  with retention, and counsel answers UTMA retention vs parental-deletion (and
  whether 17a-4 forces retention post-custody). Interim copy: "your activity
  history".
- **D-counsel-2.** Confirm WHO is the legal furnisher of statements/confirms/1099s
  post-custody and whether the broker-dealer's e-delivery consent covers Kiddo, or
  whether "email-first" requires Kiddo's own E-SIGN / IRS-1099 affirmative
  e-delivery consent (zero e-consent scaffolding exists in the repo today).
- **D-counsel-3.** The compliance ALLOW-LIST: any event with a consumer-protection
  cure window, hold/AML disposition, refund/decline, or required disclosure
  (`payment_failed`, `large_gift_hold`, refund, orphaned-gift) routes to NEEDS YOU
  (persistent, un-muteable), never only to a default-quiet/muteable lane.
- **D-counsel-4 (T&S).** H1 sender-trust gate (`kid_review_status`) is a HARD
  blocker on routing any stranger note text or attacker-controlled `senderName`
  into digest/email/Moments. Until H1 ships, Moments carries amounts + milestones +
  TRUSTED-sender names only; stranger note bodies stay behind the parent wall
  ("waiting in the Memory Book"). Moments email/push is PARENT-only pre-18. Keep
  photos fail-closed. A clean win: fold the H1 untrusted-gift parent-approval queue
  ("a new gift for [kid] is waiting for your OK") INTO Needs-You as a counted item,
  giving Needs-You a real recurring job and a fast in-app block-before-spread path.

---

## Per-persona notification contracts (three customers, three tunings)

The model is one architecture with three tunings, not one global setting.

- **Parent-owner (long-horizon fund):** calm default. Needs-You count, silent
  ledger, Moments via digest/email. The model as written.
- **Gifter (the loop's reusable customer, the funded-k multiplier):** the OPPOSITE.
  "Did my gift land" is the make-or-break confirmation (the moat-memo warm-promise
  leak). The gift-landed event is a Moment that SHOULD actively notify (email/push).
  The gifter's reusable-account view is the loop's ledger, not a tax artifact.
- **Adult owner, post-handoff (the $1B retention bet):** wants MORE relational
  signal, not silence, or a freshly-handed-off teen forgets the account exists. Map
  Moments + the education/identity layer here deliberately.

---

## Open decisions for the founder (the forks)

1. **D1 — DECIDED 2026-06-15: severity-tiered ("both").** Blocking items
   (`payment_failed`, `kyc_action_required`, `ssn_missing`, `large_gift_hold`,
   `recipient_details_missing` — all already `severity:'blocking'` in
   `actionItems.ts`) count **account-global**; advisory/non-blocking items stay
   **fund-scoped**. This refines the 2026-05-28 call rather than reversing it: a
   money/compliance block can never hide behind active-fund scope, while routine
   per-fund todos still don't clutter another kid's page. **Hard constraint:** when
   the badge counts a cross-fund blocking item, the bell PANEL must also SHOW that
   item (with "on [other kid]'s fund" attribution) — otherwise the badge lies
   ("says 1, panel empty"), the exact bug the 2026-05-28 scoping prevented. So the
   panel's `scopedActionItems` filter must also let blocking items through
   regardless of `fundFilter`.
2. **D2 — demo feel after the change** (C2): digest-only "lived-in" feel, signed off
   on a rendered walkthrough.
3. **D3 — celebrate-now allowlist** bounds (C4).
4. **D4 — labels** (C5).
5. Counsel items D-counsel-1..4 routed into `COUNSEL_ENGAGEMENT_PACKET.md`.

---

## Build order

1. **Now (Tier A), on D1:** collapse to one account-global server-truth count
   (fixes 9-vs-1), surface existing action-items as Needs-You, keep routes alive,
   handle the 3 importers deliberately. Fold the H1 approval queue into Needs-You
   when H1 lands.
2. **Prereqs in parallel:** wire one ESP + verify delivery (B1); wire PostHog +
   guardrail funnel (B2); build the real handoff Needs-You item (B3); port owner-mode
   feed source (B5).
3. **Then, behind a reversible flag (Tier B/C):** flip the calm switch as the LAST
   step, measured against funded-k, demo rendered for founder sign-off.
4. **Counsel-gated copy/flows (Tier D)** land when their memos do.

The destination is brand-correct and worth building toward. The discipline is to
build the replacement channels (email, the handoff item, the gifter contract,
instrumentation) before the one-way deletion, and to keep the founder-owned
surfaces a sign-off, not a side effect.
