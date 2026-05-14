# Ops Runbook: Mobile Gifter UI Fee-Display Bug

Operational follow-up to `MOBILE_PARITY_AUDIT_2026-05-14.md` Issue 1.
Captures the queries, the data limitations, and the decision matrix
for whether to proactively reach out to any gifters who saw the
inflated total displayed before checkout.

**Bottom line up front:** Recommendation is to NOT proactively
email gifters. The bug was UI-only; Stripe charged the correct
amount; nobody was actually overcharged. Reactive support response
template below for the case where a gifter notices the discrepancy
between their Stripe receipt and what the mobile app showed them.

## The bug, recapped

Mobile `GifterFlowScreen.tsx` previously showed gifters a "review
your gift" screen with a fake $9.99 line item on gifts ≥ $1,000.
The total displayed in the app was inflated. **But:**

- The mobile app sent only the base `amount` to the server (not
  the inflated total).
- Server fee logic (`shared/monetization.ts:144`) hardcodes
  `largeGiftComponent = 0`.
- Stripe charged the gifter the correct amount.
- Kid received the full gift.

So a gifter who sent $1,000 saw "$1,049.98 total" in the mobile
app's review screen, then was actually charged $1,040ish (amount +
real Stripe processing) at Stripe. The $9.99 was never collected.

## Data we have to triage

| Field | Available? | Useful for triage? |
|---|---|---|
| `gifts.amount` | Yes | Filter to ≥ $1,000 |
| `gifts.createdAt` | Yes | Time-bound the bug window |
| `gifts.senderEmail` | Yes | Reach the gifter |
| `gifts.senderName` | Yes | Personalize |
| `gifts.status` | Yes | Filter to settled only |
| Mobile vs web source | **No** | This is the gap |
| Stripe payment intent | Yes (id stored) | Could fetch user-agent via Stripe API |

The gifts table doesn't carry a source flag. The mobile app and the
web app both hit the same `/api/stripe/checkout/gift` endpoint. So
we can identify $1,000+ candidates, but we cannot trivially separate
the subset that came from mobile (saw the inflated UI) from web
(saw correct numbers).

Stripe's checkout session metadata MIGHT include user-agent or
device info we could fetch from the Stripe API, but it would
require a per-row Stripe API call to determine. Worth it only if we
decide proactive outreach is necessary.

## SQL: find candidates

Run against the production database to count and list affected
gifts. Safe (read-only).

### Count

```sql
SELECT COUNT(*) AS large_gift_count, SUM(amount) AS total_amount
FROM gifts
WHERE amount >= 1000
  AND status NOT IN ('failed', 'refunded', 'canceled', 'pending')
  AND created_at < '2026-05-15';
-- Replace 2026-05-15 with the deploy date of the mobile fix once
-- the e2d7e2b commit lands in production. Before deploy: filter
-- by the bug's introduction date if known. Without an exact start
-- date, run the count unbounded to get the upper-bound estimate.
```

### Per-row detail (for outreach prep if you decide to email)

```sql
SELECT
  g.id,
  g.created_at,
  g.amount,
  g.sender_name,
  g.sender_email,
  g.stripe_payment_intent_id,
  f.recipient_first_name AS child_first_name,
  f.name AS fund_name
FROM gifts g
JOIN funds f ON f.id = g.fund_id
WHERE g.amount >= 1000
  AND g.status NOT IN ('failed', 'refunded', 'canceled', 'pending')
  AND g.created_at < '2026-05-15'
ORDER BY g.created_at DESC;
```

### Group by gifter (some send multiple large gifts)

```sql
SELECT
  LOWER(sender_email) AS email,
  MAX(sender_name) AS display_name,
  COUNT(*) AS large_gift_count,
  SUM(amount) AS total_amount
FROM gifts
WHERE amount >= 1000
  AND sender_email IS NOT NULL AND sender_email <> ''
  AND status NOT IN ('failed', 'refunded', 'canceled', 'pending')
  AND created_at < '2026-05-15'
GROUP BY LOWER(sender_email)
ORDER BY total_amount DESC;
```

## Decision matrix

### Option A: Proactively email everyone in the candidate list

**Why you might:** Maximum transparency. If even one gifter ever
notices the discrepancy and feels misled, the proactive email
prevents that trust-gap from forming.

**Why you probably shouldn't:**
- Most gifters in the list were on web and saw correct numbers.
  Emailing them with "we had a UI bug" creates anxiety about a
  problem they never experienced.
- The bug was UI-only; nobody was actually overcharged. The
  Stripe receipt they received was accurate.
- Outreach can sound like "you were affected by something" even
  when softened. False-positive distress isn't a great trade for
  the small share who actually saw the inflated screen.

### Option B: Don't email; handle reactively (RECOMMENDED)

**Why:** The bug is now fixed. Gifters who never noticed the
discrepancy are happily oblivious. The handful who DID notice
(seeing "$1,049.98 total" in the app then $1,040 on their Stripe
receipt) probably already moved on or never connected the two.

**What to do instead:**
1. Keep the reactive support template below ready.
2. If a gifter ever emails support asking about the discrepancy,
   respond with the template. One paragraph, fully transparent.

### Option C: Future-proofing only

**Why:** Don't address the historical question; just make sure
this kind of bug can be triaged better next time. Specifically:
- Add a `source` column to the `gifts` table (`"web" | "mobile_ios" | "mobile_android"`).
- Capture from the API request user-agent at gift creation.
- Bonus: capture from Stripe metadata via the checkout-session
  creation call.

Worth doing regardless of which Option A/B/C you pick for the
historical question. Schema change scoped:

```sql
ALTER TABLE gifts ADD COLUMN source text DEFAULT NULL;
-- Backfill historical rows to NULL (unknown). New rows get
-- populated by server code.
```

Plus a one-line change in the `/api/stripe/checkout/gift` route
to set `source` based on user-agent or an explicit `clientSource`
parameter from the mobile app.

## Reactive support template

For the case where a gifter emails support saying "the app showed
me $1,049.98 but Stripe charged $1,040, what happened?"

```
Hi [name],

Good catch, and apologies for the confusion. You're right that
there was a discrepancy: our mobile app was showing an inflated
total on the gift review screen, but the actual charge through
Stripe was correct (the smaller number you see on your receipt).

Specifically: there was a stale UI line on our mobile app that
displayed an extra $9.99 on gifts of $1,000 or more. That $9.99
was never charged. Stripe took the correct amount, [child]'s
fund received the correct amount, and nothing was sold or
adjusted.

We caught the bug in an internal audit on May 14, 2026 and
shipped the fix the same day. Everything you see in the app
going forward will match what's actually charged.

Thanks for paying attention to the math, and for showing up for
[child]'s fund.

The Kiddo team
```

## Recommendation

**Option B (don't email) + Option C (future-proofing).**

Don't email historical gifters. The bug was UI-only and the
proactive-outreach downside (creating worry where none existed)
outweighs the marginal trust gain.

Add the `source` column to `gifts` so the next similar incident
has clean data to triage. This is a clean separate ship; doesn't
have to bundle with the current fix.

## Open questions

1. **Bug introduction date.** When did `kiddoFee = amount >= 1000 ? 9.99 : 0` first land in `GifterFlowScreen.tsx`? A git-blame walk on that file would establish the exact window for the SQL queries. Worth doing once before running the count.

2. **Stripe API check (optional).** Could fetch user-agent or device data via the Stripe API on a sample of the candidate payment intents to see what fraction are mobile-Safari / mobile-Chrome / iOS-app / web. Would inform whether the candidate list is mostly mobile (more concerning) or mostly web (less). Probably overkill given Option B is the recommendation.

3. **Customer support history.** Has any gifter ever flagged a mobile-vs-Stripe discrepancy in support emails? If yes, that's a strong signal to lean Option A. If no, Option B is the safer call.

## References

- `MOBILE_PARITY_AUDIT_2026-05-14.md` (parent audit doc, Issue 1
  with the original mis-framing and the corrected severity
  framing per the 2026-05-14 follow-up commit)
- `apps/mobile/src/screens/GifterFlowScreen.tsx` (the fix lives
  in commit `e2d7e2b`, line 110-120)
- `shared/monetization.ts:144` (the server-side hardcoded
  `largeGiftComponent = 0` that meant gifters were never actually
  overcharged)
