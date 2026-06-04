# Trust & Safety — Launch Blocker Findings (2026-06-04)

Source: `trust-safety-audit` workflow (101 agents, 22 confirmed findings + 3 from the
red-team completeness pass, each adversarially verified). Full report:
the task output for run `wf_cbf43d26-577`.

## VERDICT (audit, verbatim intent)
**A child is NOT safe enough to ship this product publicly today.** The harm is not in
any single finding — it's the *stack of disabled defenses on one surface*: a stranger
gifter → public link (exposes child name/photo/age) → uploads unscanned video/voice
(scanner is a no-op) → moderation off by default → auto-publishes to the child's
PIN-gated KidView → and the child's media card has **no report button**. Every
automated layer is off and the human backstop is absent. **Do not open the public UGC
surface until the CRITICAL items are closed.** (Money/custody is gated+simulated and
unaffected — every harm here is in the UGC layer, which is live today.)

## Two root-cause notes (don't mistake symptom-count for root-count)
- The **scanner** appears across ~4 findings but is ONE architectural root: the
  `Scanner` interface only has `scanImageBuffer` (no video/audio method) and the
  implementations are stubs. One capability build + one fail-closed policy.
- **`senderName`/message validation** appears as 3 findings — ONE root cause, three
  impact vectors (contact channel / family impersonation / brand impersonation).

---

## CRITICAL — public UGC must not open until these close

| ID | Finding | Owner | Status |
|----|---------|-------|--------|
| C1 | Content scanner is a no-op by default and **fails OPEN** on error/stub | mixed | **partially fixed** ↓ |
| C2 | Video & audio uploads bypass scanning entirely (no `scanVideo`/`scanAudio`) | Claude (endpoint gate) + vendor | open |
| C3 | KidView **Memory Book media cards have no report button** (gift cards do) | Claude | open |
| C4 | Age-18 handoff: account-takeover via unverified claim (sibling/hijack) | Claude | open |

**C1 — DONE this pass (`server/contentScanner.ts`):** flipped all three fail-OPEN paths
to **fail-CLOSED** — the `noop` scanner now returns `safe:false` in production (dev/test
stay open), the error catch returns `safe:false`, and the unimplemented vendor stubs
return `safe:false`. Added `isContentScanningLive()` for callers to gate on. **Effect:
in production, photo uploads now refuse unless a real `CONTENT_SCANNER` is wired — this
is intentional per the verdict.** REMAINING for C1: wire a real scanner (PhotoDNA for
CSAM hash-match + a moderation vendor) — **vendor procurement + NCMEC partnership, start
now (months of lead time)**; on a positive hit, the 18 U.S.C. §2258A NCMEC report within
24h is a **legal/ops** workstream.

---

## HIGH

| ID | Finding | Owner |
|----|---------|-------|
| H1 | Gifter-moderation **off by default** — stranger content reaches the child pre-review; no text scanning at all | **founder decision** (flip default to pending_review = product/UX + parent-burden tradeoff; strongly recommended) |
| H2 | `senderName`/message unvalidated — contact info + family/brand impersonation | Claude (server-side validation/redaction) |
| H3 | Public surfaces expose child **name + photo + age** to any link-holder (re-rated ↑ to high) | **founder decision** (the gifting pitch relies on showing the child; tradeoff vs COPPA exposure) |
| H4 | KidView 4-digit PIN brute-forceable via evadable in-memory IP-keyed limiter | Claude (move counter to Postgres, key on token) |
| H5 | Deleted/removed memory media **persists on disk** after parent rejection | Claude (call storage-delete in both handlers) |
| H6 | No parent-level gifter **blocklist** / repeat-offender control | Claude (new table + affordance) |
| H7 | Blocklist is email-only + skipped on recurring/anonymous paths | Claude (enforce on all gift paths) |
| H8 | No per-gifter payment **velocity limits** (card-testing/stolen-card) | Claude (velocity caps) + config (enable Stripe Radar) |
| H9 | Guestbook/message text bypasses scanning (bare domains/shorteners) — phishing | Claude (text scan + whitelist) |

## MEDIUM
- M1 public memory endpoint serves unmoderated text when moderation off (folds into H1).
- M2 `/uploads` URLs guessable/unsigned (require Supabase in prod + signed URLs — on roadmap).
- M3 no per-fund gifter cap → harassment-at-scale / fake social consensus (re-rated ↑ from low).
- M4 **auto-`audioTranscript`** is an unmoderated derivative text surface rendered to the child (red-team find).
- M5 flagged-content **persistence across recurring gifts** (removal doesn't propagate to the subscription) (red-team find).

## LOW
- per-fund gifter cap as pure money-spam (the content-harassment angle is M3).

---

## Remediation plan (ownership buckets)

**A. Claude can fix now (contained, safety-positive, no product-policy change)** — offer to proceed:
C3 (report button on media cards, wired to the T&S/escalate queue), C2 (gate video/audio
uploads on `isContentScanningLive()` → fail-closed), C4 (require email-match/verified +
idempotency on age-18 claim), H2 (senderName/message validation+redaction), H4 (PIN
limiter → Postgres, key on token), H5 (purge files on delete/remove), H6/H7 (blocklist
on all paths), H8 (velocity caps), H9 (text-link scan), M4 (scan transcript text), M5
(suppress flagged recurring re-injection).

**B. Founder product/UX decisions** (strong recommendations, your call):
H1 (flip gifter-moderation default to ON / pending_review), H3 (stop exposing child
name+photo+age on unauthenticated public surfaces).

**C. Vendor / legal (start now — long lead time):**
Real content scanner (PhotoDNA + moderation vendor); NCMEC reporting partnership +
24-hour escalation workflow (18 U.S.C. §2258A); signed `/uploads` URLs in prod.

See `project_child_safety_architecture.md` (referenced by `server/contentScanner.ts`) for
the original architecture intent this audit measured against.

---

## Second independent audit — corroboration (2026-06-04, run `wf_b9213cc9-815`)

A SECOND `trust-safety-audit` (125 agents, 28 confirmed, 3-vote verified) ran
independently from the first and reached the **same verdict and the same two
root causes** — the scanner stub + the unscanned video/audio path, and the
`senderName`/message validation gap. Independent convergence on "do not open
public UGC yet" is strong signal the conclusion is robust, not an artifact of
one agent panel. Every CRITICAL/HIGH above was re-confirmed; nothing in the
remediation plan changes.

Net-new from the second pass (both minor, do not gate launch on them):
- **KidView has no idle/lock timeout** (`KidView.tsx`) — a left-open unlocked
  KidView on a shared device stays open. Low severity (parent's own device,
  PIN-gated, read-only). Fold into the C-bucket KidView hardening.
- **PIN unlock is skipped when `pinHash` is null** (`routes.ts` unlock) — a
  fund whose parent never set a PIN issues an access token without a PIN
  challenge. By-design for no-PIN funds, but the UI shouldn't imply PIN
  protection when none is set. Cosmetic/edge.

Refuted by the second pass (false positives — do NOT spend effort):
- "Kid can claim fund before majority age" — REFUTED: `auth.ts` claim gate
  computes `majorityDate` from the fund's locked `majorityAge` and 409s if
  it's in the future (the PA-kid-claims-at-18 case is already closed).
- The PIN brute-force angle (H4) note: an in-memory per-IP+token limiter (5
  fails / 15 min) already shipped this session (`routes.ts` kid-view unlock);
  H4's durable fix (Postgres-backed, survives restart) remains the real item.

Coordination note: both audits assign the code fixes to "Claude"; the first
session owns the in-flight remediation (this doc + the contentScanner fix +
active `routes.ts` work). The second session stood down on the code to avoid
clobbering that in-flight work — this corroboration note is its contribution.

---

## Gifter-surface child-data minimization (founder principle, 2026-06-04)

Founder, reviewing the gifter dashboard: **"a gifter is not family — they
shouldn't have whole-family info or images of the child."** The line applied:

**FIXED (clean, no product tradeoff):**
- `dcc7f97` — "Latest Memory Book moment" now shows the gifter's OWN note or a
  fund-level system/milestone entry, never another named person's note (a
  grandfather gifter was seeing another gifter's intimate note + the parent's
  "love you, dad").
- `4918251` — gifter payload no longer carries the child's raw DOB (revealed
  birth YEAR = exact age); the projection's years-to-majority is precomputed
  server-side. Gifter keeps month+day birthday + `majorityAge` only.

**VERIFIED already safe on the gifter surface (no change needed):** child
PHOTO not sent, last name not sent, whole portfolio/holdings detail not sent
(only a `holdingsCount` integer).

**DELIBERATELY NOT BUILT (founder "clear no-gos"):** child's full portfolio /
what the kid owns on the gifter surface; child photos to gifters.

**RESOLVED — founder call: remove ALL child money-state from the gifter
surface (`0988305` render removal + `7b37026` payload trim):**
- Total fund value + 30-day value sparkline → gone (child net worth +
  parent performance).
- `holdingsCount` → gone (portfolio size).
- Per-gift live "now worth" → gone — founder's sharpest point: it can become
  a **LIE** the moment the parent sells the gift's shares (the gift row keeps
  the recorded allocation; the holding is gone), implies a donor claim on a
  gift that's the child's now, and leaks performance.
- `summary.trackedFundValue` (Σ net worth across funds) → gone.
The gifter now sees only gifter-OWNED context (what they gave, what it
bought, their notes, the family's thank-yous, occasions) plus the FORWARD
"if invested" projection — safe because it's hypothetical and a later sale
can't falsify it. Removed from the wire, not just the render.
