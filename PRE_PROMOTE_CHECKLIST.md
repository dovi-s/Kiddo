# Pre-Promote Checklist

Work staged this session (recurring / gifter / Activity / Memory Book polish + the
missed-charge recovery + skip-a-cycle). Review, then promote. **The dashboard
hero/stories WIP is explicitly held — do not promote it yet.**

> Scope note: the working tree also carries unrelated parallel WIP (workers, email
> templates, KidView, GiveAGift, etc.) that isn't part of this list — review that
> separately. Nothing here is committed. Typecheck + `lint-content.cjs` were green
> at each step.

---

## How it ships (two paths)
- **`staging:promote`** syncs `DashboardStaging.tsx → DashboardLab.tsx` only. It copies the **whole file**, so the held hero/stories ride along unless pulled out of staging first (or you do a selective promote).
- **Everything else is a normal deploy.** `Activity.tsx`, `MemoryBook.tsx`, `DetailHistoryModal.tsx`, `AmountKeypad.tsx`, `demo-live-gifts.ts`, and `server/routes.ts` are shared (not staging/live-split) — they reach live on commit/deploy, not the promote.

---

## ✅ Ready — recurring / keypad / skip
- [ ] **"Change" button** on the recurring destination → jumps to the target step *(Staging + Lab, synced)*
- [ ] **Edit-mode "Save changes"** directly on the amount step (no forced target→bank→legal walk) *(Staging + Lab)*
- [ ] **In-app AmountKeypad** replaces the OS keyboard on recurring + one-time; step compacted (merged the two projection cards, smaller register, "$0.83/day" no longer says "about", "$5 min" only-when-under) *(Staging + `AmountKeypad.tsx`)*
- [ ] **Skip a cycle** — "Skip next charge" in the Manage sheet (gentlest off-ramp, listed first) → `POST /parent-contributions/:id/skip-cycle` advances one cycle · demo overlay so it visibly advances the date *(Staging + server + `demo-live-gifts.ts`)*

## ✅ Ready — missed-charge recovery (now ONE flow)
- [ ] **"Add it now" unified to a single lean confirm → payment** across card · feed · detail · dashboard (retired the heavier catch-up modal for recovery; keypad stays for composing new deposits) *(Staging + Activity)*
- [ ] **Resolution-aware state** (already correct server-side): caught up → clears immediately · next success → clears · ignored → auto-expires at 14 days
- [ ] **Demo catch-up resolves in place** — "Charge missed" → "Active" without a redirect to a mock success page *(Staging + demo overlay)*
- [ ] **Payment method consistent** — the plan shows the real card it charges (from charge history incl. a failed attempt), matching the decline; removed the fabricated "Ally Bank" fallback *(server `cardMap`)*
- [ ] **Failed-charge icon = calm amber** everywhere (was red in the feed), matching the "Charge missed" pill + detail modal. Red stays for `payment_failed` (a real plan lapse) *(Activity)*
- [ ] **Failed-charge prose de-duped** — no card#/date repeated between the sentence and the "Charged to / Next charge" block *(DetailHistoryModal + Activity)*

## ✅ Ready — Activity / detail
- [ ] Schedule detail: **brand logo + real tier name**, dropped redundant "into SBUX" *(Activity)*
- [ ] Contributions modal **"diversified mix" → "Growth mix"** *(Activity)*
- [ ] **Recurring / One-time labels** on contribution rows (feed + modal) *(Activity + DetailHistoryModal)*
- [ ] Pending empty-state is **failure-aware** ("One recurring charge didn't go through… See Schedules") *(Activity)*
- [ ] Facts row **wraps instead of clipping** ("Fired 84 times" no longer sheared) *(Activity)*
- [ ] **"View holding →" deep-links to the specific holding sheet** *(Activity + Lab + Staging)*

## ✅ Ready — Memory Book
- [ ] **Toolbar de-cram** — "Awaiting" no longer clips; year picker moved into "More filters" *(MemoryBook)*

---

## 🚫 HOLD — do not promote
- [ ] Dashboard **hero / stories** WIP — `StagingLandscapeHero`, `HoldingStories`, `GifterStories`, `client/public/hero-proto.html`. Pull these out of staging before the promote (or promote selectively) so they don't ride along.

---

## ⚠️ Reconcile before LIVE (decisions, not bugs)
- [ ] **Payment rail vs copy vs demo — CODE-CONFIRMED it's a card, not ACH (2026-07-08).** The recurring *setup* copy says "runs from your connected bank account (costs less / more reliable than a card)," and the setup even has a bank-picker step — but `recurringContributionWorker.ts` (~L171-241) charges `customer.invoice_settings.default_payment_method` **off-session**, reads **card-only** reconcile fields (`pm.card.brand` / `pm.card.last4`), and **ignores the contribution's `bankAccountId` entirely**. So today recurring charges a CARD (with the ~2.9% fee), and both the "from your bank / costs less than a card" copy AND the bank-picker are aspirational. The demo's "Visa ····4242" decline is therefore *accurate* to the current rail. This is now a concrete GO-LIVE ticket, not an open question — **the fix is to actually pull the selected bank via ACH** (`us_bank_account` PM + mandate; note ACH settles async and can return days later → route returns through the existing missed-charge lifecycle), then flip the reconcile + demo to bank. Founder/payments + custody-gated. The "from your bank" copy is the desired end state — raise the rail to meet it, don't downgrade the copy. See memory `project_gift_processing_fee_locked_built` + `project_missed_charge_lifecycle`.
- [ ] **"Update payment method" recovery.** "Add it now" catches up the missed charge but doesn't *fix* the declining method, so it can re-fail next cycle. The complete-recovery piece ("Update card/bank") is flag-gated off — turn it on (Stripe billing portal) before live if recurring is actually charging.
- [ ] **Activity → catch-up:** already unified on the lean confirm, so no follow-up needed there (earlier plan to "point Activity at the catch-up modal" is moot — the modal was retired for recovery).

## 🧹 Post-promote cleanup (safe, non-blocking)
- [ ] Prune the now-dormant catch-up-modal code in the one-time flow (`oneTimeCatchUp` state + its branches) — inert since recovery went lean, but worth removing so it doesn't confuse the next reader.
