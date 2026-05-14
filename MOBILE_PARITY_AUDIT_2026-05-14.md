# Mobile Parity Audit: 2026-05-14

Companion audit to `MONEY_CLASSIFICATION_AUDIT_2026-05-14.md`. The
mobile app at `apps/mobile/` is "a real connected app, not a
prototype" per the locked memory rule, so it needs to keep parity
with web on money classification, locked policy rules, and the
shipped audit fixes.

Three real issues surfaced. **One was a CRITICAL locked-policy
violation** that's been silently overcharging large gifts on
mobile for an unknown period. All three fixed in this commit.

## Issues found

### Issue 1: Stale $9.99 large-gift fee (CRITICAL)

**File:** `apps/mobile/src/screens/GifterFlowScreen.tsx`

The mobile gifter flow computed a $9.99 "Kiddo fee" on gifts of
$1,000 or more and displayed it in the fee breakdown:

```js
const kiddoFee = amount >= 1000 ? 9.99 : 0;
const total = amount + fee + kiddoFee;
```

Fee note copy: "Kiddo does not charge a normal platform fee.
Gifts of $1,000 or more include a flat $9.99 premium."

**This contradicts the locked Fee Architecture rule in MEMORY.md:**

> NO platform fee on gifts. "Gift amount stays whole." $50 from
> grandma = $50 to fund. Gifter pays Stripe processing only.
> NO required large-gift fee. Bank transfer recommended for
> lowest gifter processing on large gifts. Old $2/gift platform
> fee is RETIRED.

The web GiftCheckout flow honors this. The mobile flow did not. A
gifter sending $1,000+ on mobile was paying $9.99 more than they
should have, AND the kid was receiving $9.99 less than the gifter
intended.

**How long this was live:** Unknown without a git-blame walk. The
mobile gifter flow has the bug as of the current commit; pre-2026-
05-14 it was active in production.

**Fix:** Set `kiddoFee = 0` permanently. Update fee note copy to
match the locked policy. Keeping the const around (rather than
deleting it) so the fee-row rendering stays structurally identical
if Kiddo ever introduces fees again with a cleaner shape.

### Issue 2: Mobile FundDetailScreen missing cashBalance

**File:** `apps/mobile/src/screens/FundDetailScreen.tsx`

Mobile fund detail showed:
- Hero balance (invested portion only)
- Pending card (Stripe in flight)
- No card for cash settled-but-not-invested

The cash-settled-not-invested state is a real distinct stage in
the gift lifecycle that the web Dashboard Money summary panel
surfaces explicitly. Mobile parents seeing "my balance is $1,917
but I gave $50 yesterday and pending is $0" had no place to find
the missing $50; it was in `cashBalance` (settled into DriveWealth,
waiting for the auto-invest worker) but the mobile UI didn't
expose that state.

**Fix:**
- `apps/mobile/src/api.ts`: added optional `cashBalance` field to
  ApiFund. Marked optional so older API responses (pre-server-
  return-of-cashBalance) don't break the type.
- `apps/mobile/src/screens/FundDetailScreen.tsx`: render a second
  card (same visual register as the existing Pending card) labeled
  "Waiting to invest" with the cash amount and a one-line
  explanation: "Already in [child]'s account. Investing on the
  next cycle."

### Issue 3: Mobile gifter flow handoff missing settling-window note

**File:** `apps/mobile/src/screens/GifterFlowScreen.tsx`

The web `GiftSuccess.tsx` page got a one-line settling-window note
earlier today as part of the money-classification audit:

> Settles into Emma's investments over the next 1 to 2 business
> days.

The mobile gifter handoff step had the Memory Book line ("A gift
from today can become a story...") but didn't tell the gifter the
settling rhythm. Same gap, same surface, same need to close it on
mobile.

**Fix:** Added the matching line under the Memory Book line on
the mobile handoff step. Calm muted register; matches the web
treatment.

## Surfaces NOT changed in this commit

These were audited and confirmed clean:

- **SIPC trust copy.** Mobile already surfaces SIPC in three
  places (`DashboardScreen.tsx:484`, `:592`, `GifterFlowScreen
  .tsx:251`). Coverage exists. No change needed.
- **Mobile Dashboard hero.** Surfaces balance only without
  cash/pending breakdown. This is the right shape for a glance
  surface; the FundDetail screen carries the decomposition (same
  pattern as web Funds Overview cards vs Dashboard).
- **Mobile auth / login.** Doesn't touch money copy.
- **Mobile add-fund screen.** Doesn't show fund balance during
  the flow.

## Surfaces NOT YET present on mobile

These web features have shipped today but mobile doesn't have the
matching surfaces. Listed as follow-up items, NOT shipped in this
commit:

- **Trusted contact (FINRA Rule 4512).** Web Account → Security
  has the section. Mobile doesn't have a corresponding Account
  screen. When mobile ships an Account screen (currently the
  closest is the Dashboard avatar tap), the trusted contact
  card needs to come along.
- **Cross-fund gifter sheet.** Web has the sheet at /funds. Mobile
  Dashboard shows funds list but no equivalent gifter aggregation
  surface. Could ship as a screen reachable from the funds list
  header.
- **Stalled-handoff action item.** Web shows it via the action-
  items system. Mobile doesn't have action-items UI on Dashboard
  yet. Follow-up: render the action items list near the top of
  Dashboard, matching web treatment.
- **Notifications panel parity.** Web has the rich panel with
  needs-your-attention + informational sections. Mobile has push
  notifications but not the in-app panel. Separate ship.
- **Kid View settling-line.** Kid View is browser-based today
  (parents share a link, kid opens in browser). Not a mobile-app
  surface yet. No-op for this audit.

## Re-audit triggers

Re-run this audit when:
- A new mobile screen ships that displays money values.
- Any locked policy in MEMORY.md changes (re-check mobile copy
  matches).
- The mobile API client (`apps/mobile/src/api.ts`) gains new
  response types from the server (verify both shapes line up).
- React Native or Expo SDK upgrade that touches any of the affected
  surfaces.

## Operational note

No schema changes in this commit. The `cashBalance` field was
already exposed on the `/api/funds` response from the server (per
`shared/schema.ts` and the existing web consumers); mobile just
wasn't reading it. So this audit is pure mobile-side correctness.

## References

- Internal: `MONEY_CLASSIFICATION_AUDIT_2026-05-14.md` (web
  companion audit)
- Internal: `MEMORY.md` Fee Architecture section (the locked
  "no platform fee on gifts" rule that Issue 1 violated)
- Internal: `apps/mobile/src/api.ts` (mobile API client + types)
- Internal: `client/src/pages/GiftSuccess.tsx` (web equivalent of
  the gifter handoff step)
- Internal: `client/src/pages/Dashboard.tsx` Money summary panel
  (web canonical pattern that mobile should track)
