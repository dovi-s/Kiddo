# AUM Fee — Collection Design Spec

> Status: **DESIGN LOCKED, NOT BUILT.** The 0.10% annual fee is *display-only*
> today. This doc locks the collection design so that whoever wires custody
> does not ship the wrong (taxable) mechanism. Gated on custody going live.
> Locked 2026-05-28.

## Current state (verified 2026-05-28)

- **Nothing charges the AUM fee.** No `fee` transaction type, no accrual worker,
  no cron, no deduction path exists. Greps for `chargeFee`/`accrueFee`/
  `deductFee`/`management_fee` return nothing.
- The only AUM code is **display estimation**:
  - `estimateAnnualAumFee(invested) = invested × 0.001` (`shared/monetization.ts`,
    `KIDDO_AUM_FEE_RATE = 0.001`, `KIDDO_AUM_FEE_BASIS_POINTS = 10`).
  - `estimatedFeesUsd` in the tax-year-summary endpoint, computed from the
    time-weighted average invested balance × 0.001, labeled **"(est.)"** in the
    UI (`routes.ts` ~22878). The code comment already says it is estimated
    "because DriveWealth hasn't been wired for actual fee accruals yet."
- This is **correct** pre-launch: custody isn't live, so there are no real
  invested assets to charge against. You cannot skim a fee off money that isn't
  really invested.

## Why this spec exists

Customer copy used to say the fee is "**deducted from invested balance**"
(Pricing, TaxDocuments, Legal, the Pricing FAQ). That phrasing pre-commits to
the **worst** collection mechanism: selling a child's shares to pay the fee is a
**realized capital gain → a taxable event** under the very kiddie-tax rules the
Tax Documents page explains. Shipping that would create surprise tax bills on a
custodial account. The copy was changed 2026-05-28 to describe daily proration
only ("you only pay for the days assets are invested") and to stop naming the
collection mechanism. This spec records the mechanism we actually want.

## Locked design decisions

1. **Cash-first collection.** Collect the fee from un-invested cash in the fund
   (gift cash not yet invested, dividends/distributions, settlement cash) before
   ever touching invested positions.
2. **Never force a taxable sale to collect a routine fee.** If there is
   insufficient cash, the fee **accrues as a payable** and is settled from the
   next cash inflow (next gift, next dividend, next contribution). It is not
   worth triggering a realized gain + kiddie-tax exposure to collect cents.
   - Edge case — account closing/withdrawal with an outstanding accrued fee:
     settle from the withdrawal proceeds at that point (the user is already
     liquidating; no *additional* surprise sale is created).
3. **Accrue daily, collect periodically.** Accrue `invested × 0.001 / 365` per
   day (so mid-year funds pay only for days invested — matches the customer
   copy). **Collect monthly** from available cash. Daily *collection* would
   create statement noise and micro-transactions; daily *accrual* is the fair
   unit. (Robo convention: accrue daily, debit monthly/quarterly.)
4. **Basis of the fee = invested assets only.** Never on cash, never on pending
   (unsettled) gifts. Matches `estimateAnnualAumFee` and all customer copy.
5. **Authoritative numbers come from the broker once live.** The Kiddo-computed
   accrual is the internal ledger; reconcile against the custodian's actual fee
   debits. Where they differ, the custodian is authoritative (same posture as
   cost basis vs. the 1099-B on the Tax Documents page).

## Build checklist (when custody is wired — not before)

- [ ] `fee` transaction type + ledger rows (date, fund, accrued amount, basis,
      collected amount, source = cash|dividend|withdrawal).
- [ ] Daily accrual job: per fund, `invested_value × 0.001 / 365`, summed into a
      running `accruedFeePayable`. (The 0.10% applies on every plan — it is the fee on
      the invested assets; the subscription is a separate product fee. No greater-of /
      plan-conditional accrual: see `ONE_METER_FEE_DECISION.md`, greater-of was reverted.)
- [ ] Monthly collection job: debit `accruedFeePayable` from available cash;
      leave the remainder as payable if cash is short (per decision #2).
- [ ] Reconciliation against the custodian's fee debits; surface mismatches.
- [ ] Show *collected* (not just estimated) fees in the tax-year-summary once
      real; keep the "(est.)" label only while custody is dark.
- [ ] Confirm customer copy still matches the built mechanism before flipping it
      from "(at launch)" framing to live.

## Surfaces that reference the fee (keep in sync)

`shared/monetization.ts` (rate constants + `estimateAnnualAumFee`),
`server/routes.ts` (tax-year-summary `estimatedFeesUsd`),
`client/src/pages/Pricing.tsx` (cards footnote + "How the annual fee works" +
FAQ), `client/src/pages/TaxDocuments.tsx` (custody block fee card),
`client/src/pages/Account.tsx` (billing-card footnotes),
`client/src/components/ui/ux-foundations.tsx` (`TrustMicroStrip`),
`client/src/pages/Legal.tsx` (§4 Fees).
