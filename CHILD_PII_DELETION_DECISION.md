# Decision needed: child PII on parental account deletion

> A product/policy/legal fork that code can't resolve by itself — picking wrong
> in either direction has real consequences, so this writes up the options for
> you (and counsel) to choose. Once you pick, the implementation is small and
> I'll do it. Created 2026-05-28. Pairs with `project_security_audit_2026_05_27`
> (lists this as the open "policy call") and COPPA/CCPA obligations.
>
> **Not legal advice.** Confirm the chosen path with the same securities/privacy
> counsel handling the RIA question.

## What happens today (precise)

On parental account deletion (`server/accountDeletionWorker.ts`, 30-day timer):

- **Scrubbed:** the deleting parent's own user row (name/email/etc. anonymized),
  gifts that parent *sent* to others, and the **SSN** on funds they owned
  (`scrubSsnOnOwnedFunds`, line 245 — explicitly "scoped to SSN only").
- **Retained:** the **child's first name, DOB, photo**, the fund itself, and the
  **entire Memory Book timeline** (gifter notes, photos, voice memos). The
  retention is deliberate — the code comment says "keeping the timeline."

So today's posture is **retain the child's record, scrub the adult's PII + SSN.**

## Why this is a genuine fork (not an obvious bug)

Two legitimate principles point in opposite directions:

- **Delete it (data-minimization / COPPA / deletion rights):** the parent was
  the consent-holder. When they leave, arguably their child's personal data
  (name, DOB, photo of a minor) shouldn't persist on our servers. COPPA governs
  data from children under 13; CCPA/state laws grant deletion rights.
- **Keep it (the product's whole thesis):** a UTMA is the **child's irrevocable
  property** — legally the assets are the kid's, not the parent's. The Memory
  Book (un-ACAT-able gifter notes/voice) is the moat and the emotional point.
  Hard-deleting the child's record on a *parent's* exit destroys the child's own
  property record and every gifter's contribution — and the kid-at-18 handoff
  assumes that record still exists.

**The UTMA-property wrinkle is the crux:** because the fund legally belongs to
the minor, "the parent (custodian) closes their account" is closer to a
**custodian resignation** than to a "delete the data subject" event. You
generally can't erase a minor's property records just because their custodian
walked away. That tension is exactly why this needs a deliberate call.

## The options

### Option A — Hard-delete the child's PII on parental deletion (minimization-max)
Scrub the child's name/DOB/photo (and optionally the Memory Book) when the
parent deletes.
- **Pro:** cleanest privacy/COPPA posture; least retained minor data.
- **Con:** destroys the child's own UTMA record + every gifter's
  contribution/Memory Book; breaks the kid-at-18 retention thesis; arguably
  destroys property records you may be *obligated* to keep (esp. once real money/
  custody exists — broker-dealer recordkeeping rules may *require* retention).
- **Code:** extend `scrubSsnOnOwnedFunds` to also null/anonymize
  recipientFirstName/DOB/photo + cascade an anonymize over `memory_entries` for
  the fund.

### Option B — Status quo (retain child record, scrub adult PII + SSN)
- **Pro:** preserves the child's property + Memory Book; simplest (already built).
- **Con:** minor's name/DOB/photo persist indefinitely tied to a deleted parent
  account, with no guardian and no explicit ongoing consent — the weakest
  consent story, and offers no "delete my child's data" path at all.

### Option C — Treat it as custodian resignation + offer explicit child-data deletion (recommended)
Reframe deletion of a *fund-owning* account as a **guardianship/custodian event**,
not a data purge:
1. Scrub the departing parent's PII + SSN (as today).
2. **Preserve the child's fund + Memory Book** (their property), but move the
   fund to a **dormant/awaiting-successor-custodian** state — no active
   management, flagged for a successor custodian or the kid-at-18 path.
3. Add an **explicit, separate "delete my child's data too" request** that, when
   chosen, runs the Option-A hard scrub — so deletion-on-request is honored
   without making it the silent default that destroys everyone's gifts.
4. Once real custody/money exists, **respect the custodian's recordkeeping
   retention requirements** over a blanket purge.
- **Pro:** matches the UTMA legal reality, preserves the moat + kid-at-18, *and*
  gives a real deletion path on request. Strongest defensible posture.
- **Con:** most logic (a fund lifecycle state + an explicit-delete flow); needs
  the clearest counsel sign-off on the retention rationale + the dormant state.
- **Code:** a fund status (`awaiting_successor_custodian` or similar) set on
  owner deletion; a parent-facing "also delete my child's data" toggle wired to
  the Option-A scrub; copy explaining what's retained and why.

## DECISION (2026-05-28): C is the destination; B stays live until counsel signs off

Picked **Option C** as the target end-state. **No code change now** — and that is the
correct outcome, not a punt, for two reasons discovered while scoping the build:

1. **B is already implemented AND explicitly promised to users.** The deletion flow
   (`server/auth.ts` `POST /api/account/delete`) sends a confirmation email that states:
   *"What stays: The Memory Book for any kid's fund you set up. **It belongs to the kid.**"*
   So retention is a communicated commitment with the right UTMA-property rationale, not
   just a silent default. Shipping a "delete the child's Memory Book" path would
   contradict a promise we actively make to every deleting user.
2. **C's opt-in delete path is NOT a free pre-counsel build.** Deleting a *minor's*
   Memory Book (the child's property + every gifter's contribution) on the *parent's*
   request raises the exact whose-property question this doc sends to counsel (Q1–Q4):
   can a resigning custodian erase a minor's property record? Until counsel answers,
   honoring such a request is legally murky, irreversible, and against the live promise.

**So:** B remains the live behavior (retain child record + Memory Book; scrub the
departing parent's PII + SSN — already shipped). C's additions (the dormant
"awaiting-successor-custodian" fund state AND the explicit child-data-deletion path)
are BOTH gated on the counsel memo. When counsel signs off, the implementation is
small and isolated (a fund status + a worker scrub branch + a deletion-flow opt-in).

## Recommendation

**Option C**, with **B as the safe interim** until counsel signs off — i.e. keep
retaining now (don't ship a destructive default), but add the explicit
child-data-deletion request path and the dormant-fund framing once confirmed.
Rationale: the UTMA property reality makes silent hard-deletion (A) legally
awkward and product-destructive, while pure status quo (B) lacks any deletion
path. C honors both minimization-on-request and the child's property/record.

## To put to counsel (the 4 questions that decide it)

1. For a **UTMA (minor's irrevocable property)**, when the *custodian parent*
   deletes their account, are we permitted/required to **retain** the minor's
   account + identity records, or obligated to delete the minor's PII?
2. Does **COPPA** require deletion of the child's name/DOB/photo on parental
   account closure, or is retention permissible given the property/recordkeeping
   basis? Does the under-13 vs 13+ line change the answer?
3. Once a **broker-dealer custodian + real assets** exist, do **recordkeeping
   rules (e.g., SEC 17a-4-type retention)** *require* us to retain account
   records regardless of a deletion request?
4. Is the **"dormant fund awaiting successor custodian"** model (Option C)
   sound, and what successor-custodian / escheatment handling is required if no
   successor appears before the child reaches majority?

Pick A / B / C (the recommendation is C, B interim) and I'll implement it.
