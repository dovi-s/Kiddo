# Money Classification Audit: 2026-05-14

First formal audit of how Kiddo distinguishes the four states money
can be in: pending (Stripe in flight), settled-as-cash (in DriveWealth
not yet invested), invested (holdings), and transferred-out
(withdrawal). The honest summary: parent-facing surfaces are mostly
clean, but the gifter-facing and kid-facing surfaces are thinner.
Three real issues surfaced. Two are content/copy fixes; one is
genuinely missing affordance.

This doc is the running record. Update it when surfaces change.

## The four states

| State | Where the money lives | DB shape | Insurance | What the user can do |
|---|---|---|---|---|
| **Pending** | Stripe in flight; not yet at DriveWealth | `gifts.status = 'pending'`, `funds.pendingBalance` | Stripe transit (not SIPC, not FDIC) | Wait. 1 to 3 business days typically. |
| **Cash (settled)** | DriveWealth brokerage cash | `funds.cashBalance` | SIPC up to $250k for cash | Auto-invests per the fund's strategy on next worker cycle |
| **Invested** | DriveWealth fractional shares | `funds.balance` (which is shares-at-market-value), `holdings` rows | SIPC up to $500k including invested | Sell, hold, transfer at majority |
| **Transferred out** | Parent's external bank | (zeroed on the Kiddo side) | FDIC at the parent's bank | Withdrawal complete |

There is no FDIC story on Kiddo's side because Kiddo doesn't custody
cash separately from DriveWealth. Cash sitting in DriveWealth is SIPC
(brokerage cash), not FDIC (bank deposit). This is the right
architecture for Kiddo's shape (custodial brokerage, not bank); the
discipline is just naming it consistently.

## Audit findings

### Issue 1: "Worth today" includes cash but the breakdown lives one line down

`client/src/pages/Dashboard.tsx` Money summary panel:

```
Worth today:        $1,917.41
Of that, $50.00 is still in cash, waiting to invest.
```

The "$1,917.41" is `invested + pendingBalance + cashBalance`. The
sub-line correctly explains that some of that figure is cash. Per the
2026-05-13 audit you did with me, this is the right shape. **No fix
needed.** Listed here as the canonical pattern other surfaces should
copy.

### Issue 2: Gifter-facing pages don't surface the settling state

`client/src/pages/GiftSuccess.tsx` confirms the gift after Stripe
charges. Today it says effectively "Your gift was received" but
doesn't tell the gifter that the money goes through a 1-to-3-business-
day settling window before it becomes invested.

The gifter ends up in three different mental models depending on when
they check:
- Day 0: "I gave $50, fund balance went up $50" (correct)
- Day 1: "I gave $50, but only $35 is invested? Where did the rest go?"
- Day 2+: "Now it's all invested in stocks" (correct again)

The middle period is invisible to the gifter today. Fix is a single
copy line on `GiftSuccess.tsx`:

> "Your $50 is on its way. Settles into Emma's investments over the next 1 to 2 business days."

Plus a matching line on the gifter's per-fund dashboard if/when they
check back during the settling window. Low-risk content change.

### Issue 3: Kid View shows balance but doesn't break it down

`client/src/pages/KidView.tsx` displays the fund value as one number.
The kid sees "$1,917" but no decomposition into "you own this much
of these stocks, this much is cash waiting to invest." For the
participation-age kid (14 to 17 per the locked phase rules), this is
a missed teaching opportunity.

For wonder-age and explanation-age kids (5 to 13), one number is the
right level of abstraction. They're not ready to think about
"settling windows."

Fix is age-gated: for the participation phase only, add a small
"$50 still settling" line under the balance. Same wording the parent
sees. Tiny change to KidView.tsx, gated on the existing age-phase
logic. Real value because participation-age kids are exactly the
ones who'd benefit from understanding "your money is in flight"
vs "your money is invested."

### Issue 4: Account security tab has SIPC, no other surface does

`client/src/pages/Account.tsx` security tab carries the SIPC
disclosure as a card. Good. But:
- `Dashboard.tsx` Money summary doesn't mention SIPC at all. A
  parent who never visits Account → Security never sees the
  protection story.
- `KidView.tsx` doesn't surface it either. The kid never learns
  their fund is SIPC-protected, which is a small but real piece of
  the financial-literacy story.
- The `trust-elements.tsx` component does have a SIPC microstrip
  but it's only rendered on a few marketing/auth surfaces, not the
  Dashboard or Money settings.

Fix is a small SIPC microstrip on the Money tab of Settings
(`client/src/pages/Settings.tsx` settingsTab === "money"), positioned
near the bottom as ambient trust. Plus an age-gated one-line mention
in Kid View's age-18 walkthrough (the kid should learn the asset is
protected). Both are content additions, low risk.

### Issue 5: "Balance" alone is ambiguous on the funds-overview cards

`client/src/pages/FundsOverview.tsx` per-kid card shows balance as
one number. Looking at the data shape: `parseFloat(balance) +
parseFloat(pendingBalance) + parseFloat(cashBalance)` is the
aggregate. The card doesn't break this down. For a household-glance
surface this is correct (per the locked discipline that /funds is
admin glance, not destination), but a parent who sees "Emma $1,917"
and clicks in is briefly confused if Dashboard shows "$1,867
invested + $50 cash."

No fix recommended. The household card is by design a single number;
the per-fund Dashboard does the decomposition. Listed for awareness.

## Surfaces NOT audited

This pass covered the main user-facing money displays. Not audited:

- Mobile app screens (`apps/mobile/src/screens/`). Parallel surfaces
  to web; same patterns should apply but worth a separate pass.
- Admin panel money displays. Internal-only; different audience.
- Email templates (gift receipt, recurring confirmation, etc.). The
  receipt copy probably already has the settling story; should be
  verified.
- Tax document surfaces. These deal with realized vs unrealized
  gains which is a different (related) classification problem.
- Withdrawal flow. End-of-life-of-account; covered separately by
  the Age-18 handoff spec.

## Recommended fixes (none shipped in this pass)

Ranked by leverage:

1. **Gifter-facing settling story on `GiftSuccess.tsx`.** One-line
   copy change. Highest leverage because every gifter sees this
   page; one line teaches them the rhythm.

2. **SIPC microstrip on Settings → Money tab.** Calm ambient trust.
   Discoverable to the parent who's checking their money.

3. **Age-gated "still settling" line on Kid View.** Participation
   phase (14-17) only. Small change, real financial-literacy value.

4. **Mobile app parity audit.** Should mirror these fixes once they
   land on web.

All four are content/copy changes. None require schema work or new
endpoints. Total work: probably one focused 2-hour session.

## What the audit confirmed is already right

- Dashboard Money summary panel decomposition (cash sub-line under
  the aggregate). Locked pattern, canonical.
- Account security tab SIPC disclosure with DriveWealth named
  explicitly.
- `trust-elements.tsx` SIPC microstrip component exists and renders
  correctly where used.
- The recurring contribution flow correctly distinguishes parent
  contributions (auto-invest) from gifter gifts (custodial flow);
  the auto-invest boilerplate suppression pattern is locked.

## Re-audit triggers

Re-run this audit when:
- A new parent-facing money surface ships (e.g., the withdrawal
  flow, the Roth IRA setup, fund liquidation at-18).
- Anything in the underlying `funds.balance` / `cashBalance` /
  `pendingBalance` math changes (would affect every consumer).
- A new carrier broker is added (Apex parallel deployment, etc.).
- A user reports a money-classification confusion in support.

## References

- Internal: `Dashboard.tsx` Money summary panel (the locked
  canonical pattern)
- Internal: `client/src/components/ui/trust-elements.tsx` (the SIPC
  microstrip)
- Internal: `MEMORY.md` Fee Architecture section (the 0.10% AUM line
  + "no platform fee on gifts" line discipline)
- External: [SIPC Insurance FAQ](https://www.sipc.org/for-investors/what-sipc-protects)
- External: [DriveWealth Customer Account Agreement](https://legal.drivewealth.com/)
