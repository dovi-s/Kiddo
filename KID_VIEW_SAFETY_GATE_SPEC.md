# Kid View Safety Gate — sender-trust pre-visibility filter

*Spec / proposal. Decision-support for a child-safety + COPPA call, NOT a
substitute for a T&S or legal professional. Founder-owned (child safety +
architecture): surfaced as a proposal, not slipped in.*

**Created:** 2026-06-09 · **Status:** proposed, unbuilt · **Owner:** founder
**Gates:** required before the public gift link opens to strangers at scale.
Not a today-emergency (current gifters are seeded/known), but a launch blocker
for a wide public surface.

---

## 1. The problem, precisely

The Kid View (`/api/kid-view/:token/content`, `routes.ts:6607`) is a
**child-facing** surface. A public gift link lets *anyone* — potentially a
stranger — attach a note (`gift.message`) and a photo to a child's fund. Today
those reach the child's screen with **no parent pre-visibility approval.**

What already protects the child (and it is thoughtful):
- **Visibility enum** (`routes.ts:6695`): `parent_only` never shows; `kid_at_18`
  only at majority; `sealed` only after its deliver date; auto-invest/boilerplate
  text suppressed; test-user funds return empty.
- **Reactive Report → auto-flag** on every card (trust-safety audit C3).
- **Submission-time text safety** on gift messages (`test:gift-text-safety`).
- **Upload rate-limit** + 3MB cap + a content-scanner *interface*.

The gap, stated exactly (corrected 2026-06-09 against the real code + `TRUST_SAFETY_FINDINGS.md`):
- Gifter notes and memories **default to `visibility:"kid_now"`** — visible to
  the child immediately. Nothing holds a *stranger's* content for a parent to
  approve before the child sees it. This is finding **H1** ("gifter-moderation off
  by default") — a documented founder-decision item; this spec is the *refinement*
  of H1 that cuts its stated downside (parent burden) by only holding **untrusted**
  senders, not all of them.
- **Report is reactive** — it fires *after* the child has already seen it (and
  KidView media cards historically lacked a report button, C3 — since closed).

What is NOT the gap (corrected — earlier drafts overstated these):
- The **image scanner is NOT fail-open.** `contentScanner.ts` returns `safe:false`
  in production (C1, 2026-06-04), so prod *refuses* unscanned media — the photo
  feature is OFF, not leaking. Turning it back on safely is the vendor-wiring job in
  `CONTENT_SCANNER_VENDOR_SPEC.md`, not this gate.
- **Gifter text is already validated** by `server/giftTextSafety.ts` on all five
  public text paths (contact-info/link/impersonation rules; H2/H9 closed). So a
  stranger note isn't *unfiltered* — it's just not *parent-pre-approved*.

So the residual exposure this gate closes is narrow and real: **stranger content
reaching a child pre-parent-review (H1)** — not raw unscanned images (fail-closed)
and not unfiltered text (giftTextSafety). The fix is the sender-trust pre-visibility
hold below.

## 2. The principle

**Gate by sender trust, not by moderating everyone.** Grandma's note must never
wait in a queue. A stranger's photo must never reach a child unseen by a parent.
The dividing line is *who sent it*, computed at write time.

## 3. Trust tiers (computed when a gift/memory is created)

| Tier | Who | Default kid visibility |
|---|---|---|
| **Trusted** | Fund owner + co-parents/collaborators; invited senders; a `senderEmail` the parent has previously approved or marked "always allow" | **Auto-approved** (pass through as today) |
| **Untrusted** | Public-link gifts with an unknown `senderEmail`; any anonymous gift | **Pending parent approval** (excluded from the child payload until approved) |

Media-specific tightening: **all photos/videos from a non-trusted sender are
Pending regardless of text** — media is the highest-risk artifact. (Note: prod
already *refuses* unscanned media via the fail-closed scanner; once a moderation
vendor is wired per `CONTENT_SCANNER_VENDOR_SPEC.md`, media is scanned but a
stranger's scanned image still shouldn't reach a child unseen by a parent until the
CSAM track is live — this gate is what holds it.) Untrusted *text-only* notes are
already contact/link-validated by `giftTextSafety.ts`, so they may auto-approve;
holding them too is the safer launch default.

## 4. Schema (minimal, additive)

Add a review status to the two surfaces that carry gifter content:

- `gifts.kid_review_status` — enum `auto_approved | pending | approved | blocked`,
  default `auto_approved`.
- `memory_entries.kid_review_status` — same enum + default.

Set at creation: trusted → `auto_approved`; untrusted → `pending`. (A nullable
`kid_reviewed_at` / `kid_reviewed_by` pair is useful for audit but not required
for the gate.) This mirrors the existing `record.suggestions` approve/decline
pattern (`/api/kid-view/:token/suggestions`), so the UX precedent already exists.

## 5. The filter change (one endpoint)

In `/api/kid-view/:token/content`, extend the existing `entries` filter
(`routes.ts:6695`) and the `gifts` map (`~6772`) to exclude anything not
visible to the child:

```
// only auto_approved + approved reach the child; pending/blocked are withheld
.filter((row) => ["auto_approved", "approved"].includes(row.kid_review_status))
```

That is the entire safety-critical change. Everything else is the parent surface.

## 6. The parent approval surface

- A gift/memory landing as `pending` triggers a parent notification ("A new gift
  for {kid} is waiting for your OK before {kid} sees it").
- A review card (reuse the suggestions-review UX) lets the parent **Approve**
  (→ `approved`) or **Block** (→ `blocked`, optionally auto-Report). Approving a
  known `senderEmail` can offer "always allow from this person" → future gifts
  from them compute as Trusted.
- The gifter is never told their gift is held (don't tip off a bad actor); the
  money still settles normally — only the *child's view* of the note/media waits.

## 7. Explicitly out of scope

- ML/CSAM classification of images — that is the **scanner vendor** decision
  (`server/contentScanner.ts` + `CONTENT_SCANNER_VENDOR_SPEC.md`), a separate launch
  item. This gate is complementary: the scanner decides *is this media safe*; this
  gate decides *should a stranger's content reach a child before a parent sees it.*
- A general moderation backend / trust-and-safety console.
- Changing anything for trusted (family) senders — their experience is untouched.

## 8. Why this is the right shape

- **COPPA posture:** minimizes a minor's exposure to unvetted stranger UGC, with
  the parent (the verifiable-consent holder) as the gate. Aligns with the
  data-minimization + child-privacy stance already locked elsewhere.
- **Loop-safe:** zero friction for the family loop that drives funded-k; friction
  only on the stranger path, which is exactly where it belongs.
- **Small:** one enum column on two tables, one filter clause, one reuse of the
  existing approve/decline UX. It is not a moderation empire.

## 9. Open questions for the founder / counsel

1. Hold untrusted *text* notes too, or only media? (Safer: both at launch.)
2. Is "always allow from this sender" enough, or do we want a per-fund global
   "auto-approve all" escape hatch for parents who don't want to review? (Escape
   hatch re-opens the exposure — default OFF, opt-in only.)
3. Does the verifiable-parental-consent framing need counsel sign-off before the
   public link opens wide? (Likely yes — fold into the counsel packet.)

*Pairs with the Kid View principles in `KID_VIEW_PRINCIPLES.md` and the data-
privacy / COPPA posture. This spec is the one open **risk** on the Kid View; the
rest are refinements.*
