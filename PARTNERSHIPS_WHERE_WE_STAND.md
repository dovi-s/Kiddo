# Partnerships — where we actually stand (one page)

Honest status of every distribution channel, mapped to the gate it's waiting on.
Built from `PARTNERSHIPS_STAGE_GATES.md` (your 2026-04-12 playbook) + verified
against the code 2026-05-29. **Nothing below is signed, built, or live.** Per your
own playbook, that's the *correct* state — don't move early.

## The one line that governs all of it
> Close the `/give-a-gift` money-at-intent leak → custody live → prove Stage 0/1
> metrics on real traffic → build the `partnerSource` attribution primitive →
> *then* registries → *then* schools → employers → brands.

We are at the **front** of that line. Every channel below is blocked on the same
root cause: **the loop isn't live and proven yet.**

---

## Status table

| Channel | Stage gate | Waiting on (specific) | Built? | Signed? |
|---|---|---|---|---|
| **Consumer product** | Stage 0 | `share_to_first_gift_rate ≥ 20%`, `gift_checkout_completion ≥ 15%`, `median_time_to_first_gift ≤ 7d` — **unmeasurable today** (no custody, no live traffic; `/give-a-gift` path leaks) | Partial | — |
| **Gifter→parent loop** | Stage 1 | `gifter_to_parent_signup_rate ≥ 2%`, loop attribution measurable. k-factor instrument EXISTS + is real (`/api/admin/k-factor`) but has no live traffic to read | Instrument yes, proof no | — |
| **Registries (Babylist)** | post Stage 1 | The **`partnerSource` attribution primitive — exists in ZERO lines of code** (docs only). Plus custody live + AUM legal memo. Have: gift links + UTM. Lack: any partner-attribution data model, any signed deal | No | No |
| **Advisers / DriveWealth** | Stage 2 | Consistent trust/compliance copy (done), a partnership one-pager/demo, `intro_to_meeting_rate ≥ 30%`, 3 champions. DriveWealth itself is **scaffold-only** (no real client; per CLAUDE.md) | No | No |
| **Schools pilot** | Stage 3 | A signed pilot champion, school-specific landing/code flow, cohort reporting, pilot support workflow — **none exist**. Three gates away | No | No |
| **Employer benefits** | Stage 4 | 1 employer design partner, cohort attribution + reporting, support that absorbs spikes | No | No |
| **Brand partnerships** | Stage 5 | Strong landing conversion, partnership CTA/offer, reliable cross-partner attribution, spike-proof conversion | No | No |
| **Hospitals** | — | **Not a tracked channel.** No plan, no doc, no code. An idea only — if pursued, it would slot near schools (trusted, parent-dense, local) and inherit the same gates | No | No |

`Partners.tsx` exists but is a **marketing/landing page**, not an integration or a
signed partner.

---

## The two primitives every partner channel needs (and their status)

1. **`partnerSource` attribution** — a data-model field stamping where a fund/gift
   originated, so a partner's contribution is measurable and reportable. Your
   stage gates require "attribution from gift session to new parent signup is
   measurable" (Stage 1) and "reliable attribution across partnership traffic"
   (Stage 5). **Status: doc-only, zero code.** This is the first build once the
   loop is proven. (Cross-ref: `MOAT_MEMO.md §2` — embedded distribution is the
   buildable Cornered Resource.)
2. **A proven loop to point partners at** — the k-factor instrument is real and
   trustworthy (see `project_money_at_intent_two_flows`), but it has no live
   traffic to measure. Partners amplify a working loop; they can't create one.

---

## What to actually do (in order)

1. **Forward the lawyer doc** (`LAWYER_Q_HOLDING_GIFT_FUNDS.md`) — unblocks the
   money-at-intent fix that makes Stage 0 real.
2. **Get custody live** — gates everything downstream.
3. **Ship + prove the loop** (Stage 0/1 metrics on real traffic).
4. **Build `partnerSource`** — the first partner-enabling code.
5. **THEN** warm-BD registries (Babylist) — the highest-value first channel.
6. Schools / employers / brands unlock in sequence, each only when the prior is
   measurably healthy.

**Bottom line:** none of it is set, and per your own playbook it shouldn't be.
"All set on partnerships" pre-loop would be the red flag, not the goal. Fix the
leak; prove the loop; the channels become *earnable* — not before.
