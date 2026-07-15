# SIPC / broker-dealer copy review (for counsel)

**Date:** 2026-07-06
**Constraint:** `INVESTING_LIVE = false` (custodian is a stub; no real broker-dealer
account holds securities yet). SIPC / FINRA / broker-dealer wording is
**founder + legal owned** — nothing here was auto-edited. This doc gives counsel a
precise inventory + draft options to approve.

## Finding (good news)

The security-audit "4x SIPC present-tense" note is **largely stale**. A full grep of
every SIPC / broker-dealer / "$500,000" / "Member FINRA/SIPC" mention (client + shared)
shows ~90% are already correctly conditioned ("When investing is live…", "once your
account is open…", "SIPC at launch", "when live"). There are **no fully naked
present-tense SIPC claims left** on prospect surfaces.

Two real things remain, and both are legal calls, not code bugs:

## Question 1 — standardize the trigger (the one substantive issue)

The copy uses **two different conditions** for when SIPC coverage begins:

- "**When investing is live**" (most surfaces: Footer, education tip, FAQ, About custody
  line, Account, CalculatorAt18, FundSnapshot, ux-foundations, trust-elements, Compare).
- "**Once your account is open**" (ActivateInvesting L625 + L1435, About L164).

These may not be the same moment. SIPC covers securities held at a SIPC-member
broker-dealer, so coverage realistically begins when a **real custodial brokerage
account holds securities**, i.e. when investing is actually live. An account that is
"open" but empty/stubbed arguably isn't covered yet.

**Counsel question:** what is the correct trigger to state, and is "once your account is
open" acceptable **only** if the ActivateInvesting flow is itself gated behind
`INVESTING_LIVE` (so an account only opens when custody is real)?

**Recommendation (pending counsel):** standardize every SIPC line to a single
condition. Draft canonical wording:

> When investing is live, securities are held by our broker-dealer partner
> (Member FINRA/SIPC), not by Kiddo. Eligible securities are then protected by SIPC up
> to $500,000 if the broker-dealer fails. SIPC does not protect against market losses.
> Investments may lose value and are not FDIC insured.

Short chip version (already in use, keep):

> SIPC up to $500,000 once investing is live

## Question 2 — custodian-specific boilerplate (re-read at flip)

Copy currently says the generic "**our broker-dealer partner (Member FINRA/SIPC)**".
Once the custodian is chosen (Alpaca vs DriveWealth), confirm with counsel + the
custodian:

- Whether their **legal name** must appear (e.g. "…via DriveWealth, LLC, Member
  FINRA/SIPC") and where.
- The custodian's **required disclosure language** verbatim (each broker-dealer has an
  approved SIPC/FINRA disclosure they expect partners to use).
- The exact **"go-live" moment** their agreement defines (account approved vs first
  trade settled) — this feeds Question 1's trigger.

Note: `DesktopSidebar.tsx:860` still references "DriveWealth, LLC" by name in a comment;
swap to the chosen custodian at flip.

## Full inventory (every live instance)

| File:line | Current copy (condition) | Verdict |
|---|---|---|
| `Footer.tsx:90` | "When investing is live, investments are held by our broker-dealer partner (Member FINRA/SIPC)…" | OK, re-read custodian name |
| `ux-foundations.tsx:142,186` | "SIPC up to $500,000 once investing is live" + "When investing is live, eligible securities are then protected…" | OK |
| `education.tsx:145` | "When investing is live, your fund will be held… SIPC protection then covers up to $500,000…" | OK |
| `trust-elements.tsx:24` | "When live, securities carry SIPC protection up to $500,000…" | OK |
| `FAQ.tsx:207-208,610` | "When investing is live, securities are held… then covered by SIPC up to $500,000…" / "SIPC protection when live" | OK |
| `Account.tsx:1944` | "When investing is live, securities are held… then protected up to $500,000…" | OK |
| `CalculatorAt18.tsx:502` | "When investing is live… then SIPC-protected up to $500,000…" | OK |
| `FundSnapshot.tsx:693` | "Once investing is live, every gift is invested… Member FINRA / SIPC" | OK |
| `Claim.tsx:341` | "SIPC protection when investing is live" | OK |
| `Compare.tsx:398,459` | "SIPC at launch" / "(SIPC at launch)" | OK |
| `App.tsx:270` | SEO: "When investing is live, investments are held by our broker-dealer partner…" | OK |
| `About.tsx:163` | "When investing is live, investments are held through our broker-dealer partner…" | OK |
| `About.tsx:164` | "**Once your account is open**, eligible securities carry SIPC protection up to $500,000…" | Trigger — Q1 |
| `ActivateInvesting.tsx:624-625` | Heading "SIPC protection up to $500,000" + body "**Once your account is open**, your investments are safeguarded…" | Trigger — Q1 |
| `ActivateInvesting.tsx:1435` | "**Once your account is open**, investment accounts are SIPC protected up to $500,000…" | Trigger — Q1 |

## What to do

1. Counsel answers Q1 (the trigger) → pick "investing is live" or confirm "account open"
   is safe given gating → then a single grep-and-replace standardizes the ~3 "account
   open" instances. One small PR, no new claims.
2. Counsel + custodian answer Q2 → re-read the broker-dealer name + boilerplate at the
   `CUSTODIAN_PROVIDER` flip (this is already on the `legal-copy.ts` FLIP CHECKLIST).

Neither blocks building. Both are read-and-approve, not rewrite.
