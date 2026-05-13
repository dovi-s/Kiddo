# P2P Stock Settle — Spec ("Pay me in Disney")

> Status: **Strategy doc, 2026-05-13.** Same shape as the other
> spec docs. **No code in this commit.** This is the most
> speculative of the four revenue docs in this session — could
> be huge, could be a feature that gets used twice a year. Worth
> writing down so the idea survives.
>
> Companion docs: `KIDDO_ADULT_TIER_SPEC.md`,
> `CASH_FLOAT_REVENUE_NOTE.md`, `B2B_GIFTING_SPEC.md`.

---

## TL;DR

The pitch the user surfaced: *"We went to dinner, you paid, I owe
you $30. Want it in cash or in Disney stock?"*

This extends Kiddo's core insight ("stock instead of cash") into
**adult peer-to-peer settle-up**. The recipient chooses how to
receive: into their bank (regular Venmo behavior) or into their
Kiddo Personal account as the ticker of their choice (the
differentiated behavior).

If it works, it's a Venmo competitor with built-in network effects
— every settle-up creates a new Kiddo account holder OR deepens an
existing one. Acquisition cost approaches zero for the receiver side.

If it doesn't work, it's a feature that lives at /pay and gets used
during the early adopter honeymoon then forgotten.

**Both outcomes are worth $0 in build cost to find out, because the
underlying infrastructure (payment in → optional stock conversion +
gift link mechanism) is 80% built already.**

---

## The premise

Kiddo's whole thesis is "stock beats cash because the asset
compounds AND the lesson sticks." Today that thesis runs in one
direction only: from gifter to kid. The kid is the recipient; the
gifter is the donor.

Adult-to-adult settle-up extends the same insight to a different
relationship:

- "Pay you back for dinner" = currently a Venmo/Zelle/Cash App moment
- The recipient (the lender) currently gets cash they'd just spend
- If instead they could choose to receive Apple or VTI or whatever,
  the same $30 becomes a long-term asset for them
- **The choice is the recipient's, not the payer's** — this is the key
  product insight. The payer wants to settle; the recipient wants to
  control the money.

This reframes adult peer-to-peer payments through the same lens Acorns
applied to spare change (the Round-Up insight). It's not a new payment
rail. It's a new wrapper that makes everyday money decisions
build wealth.

---

## The flow

### Sender side

1. Sender opens Kiddo, taps "Pay someone back."
2. Enters amount + recipient (phone, email, or Kiddo username).
3. Picks payment source: Kiddo cash balance, linked bank, or card.
4. Optional message ("dinner at Niko's, 5/10").
5. Tap send.

Sender's job is done. They paid the money. Same UX as any P2P app.

### Recipient side

The differentiator. When the recipient gets the notification, they
see a choice:

> **Alex paid you $30**
>
> "dinner at Niko's, 5/10"
>
> How do you want it?
> [ Cash to bank ]   [ As stock in your fund ]

If they pick **cash**: standard P2P payout. ACH to their linked
bank. Identical to Venmo.

If they pick **stock**: they pick a ticker (or use their default
— "always send incoming Kiddo payments as VTI"). The money lands
in their Kiddo Personal account and buys that stock. Receipt + a
small "your $30 became 0.18 shares of VTI" confirmation.

If they don't choose within N days: defaults to whatever they've
preset, OR sits in their Kiddo cash balance, OR auto-returns to
sender (settable by recipient).

### The onboarding path

If the recipient doesn't have a Kiddo account, the notification
SMS/email is the onboarding entry:

> "Alex sent you $30 via Kiddo. Open the app or claim at
> kiddofund.com/pay/[token]"

Clicking the link → AuthScreen-style claim → kid signs up → lands
on the receive-as choice. **Every send to a non-customer is a free
acquisition channel.**

This is the same mechanic the existing gift-link flow uses; the
infrastructure is already battle-tested.

---

## Why this could work

### 1. The asset compounds (the Acorns Round-Up insight at adult scale)

A 28-year-old who Venmos friends $200/month for dinners, drinks,
and groceries currently turns all of that into "money I spent and
forgot about." If half of it becomes VTI instead, that's $100/month
of forced micro-investing on transactions they were already
making. Over 30 years at 7%: ~$120k.

The user doesn't change behavior. The receiver changes the
default. That's a powerful behavioral lever — one Acorns has
already proven at scale.

### 2. Network effects on the receiver side

Every Kiddo P2P send to a non-customer ends in either:
- Recipient signs up to receive (free CAC)
- Recipient declines (still got the marketing message)

Compare to Venmo's growth model. Venmo grew because the receive
flow was sticky. Same dynamic should work here, with the bonus
that the receiver gets something more interesting than $30
parked in their Venmo wallet.

### 3. Composes with Kiddo Adult tier

The receive side ("I now have a Kiddo Personal account with $200
of VTI") is the natural top-of-funnel for the Kiddo Adult tier
spec. Someone who's been receiving stock-as-payment for 6 months
has real assets in Kiddo and is the right candidate for the
$15.99/mo tax-loss-harvesting + Roth IRA Adult tier.

### 4. The brand stretches naturally

Kiddo today is family-focused (kids, parents, gifts). Adult P2P
is a stretch but a logical one because the underlying insight
("stock instead of cash") is the same. The marketing line
practically writes itself: *"You gift your kid's future. Why not
gift your own?"*

The brand color, the calm register, the no-em-dashes copy
discipline all carry over. It's not a pivot — it's the same
insight applied to the same demographic at a different life stage.

---

## Why this could not work

Honest about the risks:

### 1. P2P payments is a graveyard

Many companies have tried to build Venmo competitors. Most fail.
Zelle only succeeded because every bank backed it. Cash App only
won by adding non-payment features (Bitcoin, investing, banking).
Building "yet another P2P" without a clear edge is the default
losing strategy.

Kiddo's edge is the stock-receive option. Whether that's enough
of an edge to overcome the "I already use Venmo" friction is the
empirical question.

### 2. Most adults don't want stock for $30

The honest user research question: how many people receiving $30
on a Wednesday actually want it to become Apple shares vs.
deposited to their checking account? If the answer is "<10%," the
product is academic.

Counter-argument: even 10% adoption at scale is meaningful, and
the conversion compounds (someone who chose stock once is more
likely to choose stock again).

### 3. Regulatory complexity

Brokerage-side acceptance of P2P-funded contributions is messier
than direct gifts. KYC kicks in differently. Money transmitter
licensing might apply for the cash payout half. DriveWealth's
default plumbing might not support this without contract work.

This is solvable but expensive.

### 4. The "what if Apple drops" problem

Sender sends $30. Recipient picks Apple. Three days later Apple
drops 5%. Recipient has $28.50 of Apple. They didn't lose money
on a payment they accepted — they lost money on an investment they
chose. Conceptually correct; emotionally a UX problem.

Mitigation: surface the disclosure clearly at the receive moment.
"Stock values fluctuate. Choosing stock means you're investing,
not just receiving."

### 5. Brand risk in the other direction

Kiddo's safe-and-calm register might get pulled toward
"Venmo-y" cheap-fast-fun if P2P becomes the main use case. The
brand has to stay calm even as the product surface gets more
transactional.

---

## What it would mean technically

Most of the infrastructure exists:

| Need | Exists today? |
|---|---|
| Payment in from sender | ✅ Stripe + bank infrastructure for Kiddo+/Family subs and gift checkout |
| Linking a stranger to a fund via tokenized link | ✅ Existing gift-link mechanism (/claim/:token) |
| Optional ticker selection by recipient | ✅ Existing `selectedTicker` flow used for gifter ticker picks |
| Conversion to shares at brokerage | ✅ DriveWealth integration already handles this for gifts |
| Notification to recipient (email + push) | ✅ existing infrastructure |
| Recipient account creation if they don't exist | ✅ existing claim-and-create flow |
| ACH payout to recipient's bank (cash option) | ✅ existing withdrawal flow |

What's NEW:

| New capability | Complexity |
|---|---|
| "Pay someone" UI surface (sender side) | Medium — new page, payment source picker, recipient lookup |
| "Choose how to receive" decision UI | Medium — new claim-page variant with the cash/stock toggle |
| Default-on-incoming-stock preference per user | Low — single user-settings field |
| Recipient-username lookup (vs email/phone) | Medium — privacy considerations on discoverability |
| Money-transmitter licensing review | Hard — legal + regulatory work |
| Sender → recipient ACH if recipient picks cash | Medium — different from gift→fund→withdrawal flow |

The hard parts are regulatory and discovery (recipient-username
lookup). The product surface itself is mostly composing existing
parts.

---

## Pricing

Two paths:

### Option A: free for both sides (Venmo / Zelle model)

Zero fee. Kiddo earns on:
- Stock-receive: 0.10% AUM going forward (the recipient's new
  Kiddo account compounds the asset over years)
- Cash-receive: zero direct revenue, but indirect — the recipient
  is now in Kiddo's ecosystem
- Cash-float in transit: brokerage-spread revenue per the
  Cash Float note

This is the right starting price. Free is the table-stakes P2P
behavior. The revenue comes from the downstream Kiddo relationship.

### Option B: small fee on cash-out

Charge **$0.30 + 1.5%** on the cash-out path only. Free if they
keep it as stock in Kiddo.

Pros:
- Aligns Kiddo's incentive with "stick around" (cash-out costs;
  stock is free)
- Same model as Cash App's "instant" vs "standard" deposit choice

Cons:
- Fee is friction; reduces adoption
- Could feel coercive ("I'm being charged for choosing not to invest")

**Recommended starting price: Option A (free).** The acquisition
math is what matters. Revenue is downstream.

---

## What this would mean for Kiddo's revenue (long-tail)

This is highly speculative. Don't take the numbers literally —
take the order of magnitude as the point:

- Average user sends/receives 4 P2P transactions per month
- Each transaction averages $40
- At 50,000 active users: $96M/year in P2P volume
- If 10% gets received as stock that stays: $9.6M/year of new AUM
- At 0.10% AUM: $9.6k/yr direct revenue (tiny)
- BUT: 50,000 active P2P users → 5,000 Kiddo Adult tier conversions
  at $192/yr = **$960k/yr (real)**

The direct AUM revenue is small; the **conversion to Adult tier
is the real revenue.** P2P is the customer acquisition machine,
not the revenue machine.

---

## Build order if we ship

**Phase 1: validate the receive-side preference** (~1 week of dev)
- Add a single user setting: "If someone sends me money via Kiddo,
  default to: [cash to bank] [stock in fund: ticker]"
- No new P2P surface yet — just expose the preference
- Survey the early adopters: how many actually flip the toggle?

**Phase 2: minimal send surface** (~1 month)
- /pay surface, no fancy features
- Sender + amount + recipient lookup (start with email/phone, not
  usernames)
- Existing gift-claim flow handles receive side
- Track conversion: how many recipients pick stock?

**Phase 3: if Phase 2 shows >15% stock-pick rate, expand** (~3 months)
- Recipient usernames
- Real notifications (push + SMS)
- Default-receive logic
- Edge cases (sender cancellation, expired claims, etc.)
- Money-transmitter licensing review

**Phase 4: marketing push** (~6 months)
- Reposition Kiddo as "the only financial app that turns IOUs
  into long-term investing"
- Adult tier upsell pipeline

---

## What would have to be true to start

Three preconditions:

1. **Kiddo Adult tier is real** (per `KIDDO_ADULT_TIER_SPEC.md`).
   Without it, recipients have nowhere meaningful to "graduate."
2. **Regulatory pass on money-transmitter requirements.** This is
   a lawyer / compliance conversation that has to happen before
   the build, not after.
3. **B2C is healthy.** Don't build a speculative new product line
   while the core consumer product still has gaps.

None of these are true today. This is a year-2 or year-3 spec.

---

## Open questions

| Question | Why it matters |
|---|---|
| Do we support international recipients? | Bigger market, vastly more regulatory complexity. Start US-only. |
| What if the sender is on Kiddo Free and the recipient is on Kiddo Adult? | Pricing tier doesn't restrict P2P sends. Free flows freely both directions. |
| Do we let recipients change the stock pick AFTER the money arrives? | Cleaner UX: yes, until conversion happens (24h window). Adds complexity. |
| What's the username scheme? `@dovi`? Phone? Email? | Privacy + spam concerns. Start with email/phone-only; usernames are phase 3. |
| Does this work for kid-owned funds (post-handoff)? | Yes — they're Personal accounts. They can send and receive. Their parent's transition didn't break their P2P access. |
| What about group settle-up ("split the dinner check")? | Phase 4+ feature. Skips MVP. |
| Recurring P2P ("I send my roommate $500/mo for rent")? | Future. Could be a hook for landlord-side wealth-building too. |

---

## When to come back to this spec

Four triggers:

1. **Kiddo Adult tier ships.** Then this spec has a destination.
2. **A competitor launches a similar idea.** Cash App could pivot
   here. Robinhood already has cash and stocks side by side; they
   could add P2P stock-receive. Don't be third to market if the
   thesis validates.
3. **Inbound user requests.** "Can I pay my friend in stock?"
   asks from existing Kiddo customers are the cleanest validation
   signal.
4. **A regulatory / licensing path becomes clearer.** Cheaper money-
   transmitter compliance paths or a partnership with someone
   already licensed would lower the activation cost.

Until then: keep this spec warm. It's worth more written down
than forgotten.

---

## References

- Internal: `KIDDO_ADULT_TIER_SPEC.md` — the destination this P2P
  flow eventually points at
- Internal: `CASH_FLOAT_REVENUE_NOTE.md` — cash-in-transit during
  P2P sends earns float interest too
- Internal: `feedback_anonymous_as_explicit_flag.md` — the
  recipient choosing how to receive is structurally similar
  ("the recipient owns the privacy/handling decision, not the sender")
- External: [Acorns Round-Up](https://www.acorns.com/round-ups/) —
  the conceptual ancestor of "make everyday money decisions build wealth"
- External: [Cash App's stock/cash duality](https://cash.app/) —
  pattern reference for tight UX coupling between payment and investing
- External: [Wealthsimple Cash](https://www.wealthsimple.com/en-ca/product/cash) —
  Canadian competitor's take on cash + stock integration
