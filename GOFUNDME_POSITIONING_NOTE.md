# GoFundMe Positioning Note — "Every Dollar Reaches the Kid"

*Launch-ready positioning lifted from the Aug 2025 GoFundMe "Giving Fund" (DAF)
launch + its tip-model backlash. Companion to `MOAT_MEMO.md` (counter-positioning
thesis) and `ACORNS_STRATEGY_DECISIONS.md` (competitive read). This is the
external proof point that sharpens "the gifter is our customer, everyone else's
cost."*

## The thesis in one line

**GoFundMe and Kora make the opposite bet on the same moment — the act of
giving. GoFundMe taxes it (a default-on ~13.5% "tip" to the for-profit). Kora
refuses to (gifters never pay; every dollar reaches the kid). That refusal is
the moat, and GoFundMe's own backlash is the proof.**

## Why this lands now

In Aug 2025 GoFundMe launched the "Giving Fund," a donor-advised-fund product:
no minimum, no admin fee, $5 grants, mobile-first, integrated Vanguard/BlackRock/
State Street passive portfolios, and it deliberately refuses to say "DAF." It
makes ~$55M/yr on ~$2B processed almost entirely from a technically-optional but
default-on ~13.5% tip, with NO explicit platform fee. The public critique is
already forming: tipping a for-profit on top of a charitable/loving act reads as
"creepy" (see the Philanthropy Project comment thread). That is trust debt.

## 1. It validates our thesis (steal the confidence, not the model)

Strip away the tip and the Giving Fund is our playbook on a different regulated
vehicle:

| | GoFundMe Giving Fund | Kora |
|---|---|---|
| Vehicle democratized | DAF (was: wealth managers, $5K minimums) | UTMA / custodial brokerage (was: affluent families with brokers) |
| Posture | no minimum, low/no admin fee, integrated passive ETFs, mobile, small-dollar | same |
| Naming | refuses to say "DAF" -> "Giving Fund" | refuses to say "custodial brokerage" -> a kid's "fund" |

When the giving-tech incumbent chases the small-dollar / mobile / integrated-
investing pattern into a $250B market, it signals the same wave is real in the
adjacent market we own (kids' lifetime accounts). We are riding a validated
pattern into a category nobody owns yet.

## 2. The contrast IS the position (anti-GoFundMe)

Two opposite bets, made explicit:

- **They tax the giving moment. We never do.** A grandmother sending $50 to her
  granddaughter should never see a slider asking her to tip the platform 13.5%.
  That single move would poison the gifter loop. Our locked principle — gifters
  never pay, every dollar reaches the kid — is the trust GoFundMe is spending
  down.
- **They hide the take. We publish it.** GoFundMe organizers cannot even see how
  much donors tipped; the for-profit nature is obscured behind "tip." Our footer
  ("$1/year per $1,000 invested, charged on invested assets only. No hidden
  charges. Ever.") is the literal opposite. In a market where the incumbent
  hides a double-digit skim behind a slider, radical fee legibility is ownable.
- **They take a one-time toll. We grow with you.** GoFundMe cuts the transaction
  once. Our 0.10% rides a compounding asset for ~18 years and only grows when the
  kid's money grows. "The giving layer of the internet" is a toll booth. "The
  place a kid's money grows up" is a partnership.

## 3. The two things worth stealing

1. **On-behalf-of converts better.** GoFundMe's own data: a campaign run by
   someone FOR a beneficiary raises more than one run by the beneficiary —
   instant credibility, and their friends are likelier to give. Our entire
   topology is that (a parent/gifter sets up and shares for the kid). Lean the
   "someone who loves [kid] set this up" framing even harder; it is the
   highest-converting structure, not just the warmest.
2. **Rename the scary vehicle.** "Giving Fund," not "DAF." We already do this
   ("a fund," not "UTMA custodial brokerage account"), but keep the discipline
   absolute across every surface — the jargon is what scares normal people off.

## 4. The discipline lock (do not cross)

**Never monetize the giving moment.** No gift tip, no donor-side skim, no
"support Kora" slider on the gift page, ever — even under revenue pressure.
Revenue comes from the parent (subscription) and the asset (0.10% AUM), never
from the gift. This is not us leaving money on the table; it is the
counter-positioning moat. GoFundMe is the cautionary proof of what taxing the
gift costs you in trust.

## 5. Ready-to-use copy (lift directly — already em-dash-free)

**Website / gift-page reassurance:**
> Every dollar you send reaches the kid. Kora never takes a cut of a gift, and
> never asks you to tip us. The sender covers card processing; that's it.

**FAQ — "Does Kora take a fee on gifts?":**
> No. Gifts are never taxed. Our only ongoing fee is $1 a year per $1,000
> invested, charged on invested assets, and we show it plainly. No platform fee
> on gifts, and no "optional" tip on top of a gift to a child.

**Investor / narrative one-liner:**
> The incumbents tax the giving moment. We refuse to, and that refusal is the
> moat: the gifter is our customer, not our revenue source.

**Positioning foil (internal shorthand):**
> Anti-GoFundMe: they tax love and hide the take; we protect the gift and
> publish the fee.

## Where to deploy

- Gift-page + checkout reassurance microcopy (the "every dollar reaches the kid"
  line near the fee/trust block).
- FAQ entry (the "no gift fee, no tip" answer).
- Investor narrative + any "why is this defensible?" slide (the foil + the
  compounding-vs-toll-booth contrast).
- Press / founder talking points if a reporter asks "how is this different from
  GoFundMe / giving platforms?"

Keep it as a foil, not an attack: we win by being visibly the opposite, not by
naming and shaming. Per `KORA_VOICE.md`, the register is calm and honest, not
combative.

## Audit result — gift page + gifter loop vs the GoFundMe redesign checklist (2026-05-31)

Ran GiftCheckout + the gifter notification system against the trust/clarity
checklist distilled from GoFundMe's 2025 fundraiser-page redesign (Baseman case
study: who-made-this, verification, momentum, speed, and "donate / share /
FOLLOW" as the three jobs). Result: **validated, no gap to fix.** Don't re-audit.

Gift page (GiftCheckout) is trust-sound:
- Who made this + relationship: "Created by {creator}" + FounderBadge (~line 1741);
  the investing default is attributed to the creator (~2185). "Someone who loves
  {kid} shared this" sets the warm frame.
- Verification: TrustMicroStrip (SIPC up to $500k, Member FINRA/SIPC, "no hidden
  charges") + the per-step fee breakdown ("100% of your gift reaches the fund",
  ~2729).
- Momentum: honest social-proof roster + counts (separately confirmed clean).
- No dark patterns: no urgency, no goal inflation, no default tip.

The "FOLLOW + rich updates" lever (the single highest-value steal from the
GoFundMe analysis) is ALREADY fully built + honest in
`server/gifterNotificationWorker.ts`:
- post-gift "your gift is invested" (~1247)
- birthday reminder with the repeat hook ("you gave {kid} before… still part of
  their fund", ~467/535)
- anniversary re-engagement ("a year ago today you gave {kid} {amount}", ~1306)
- lifetime contribution summaries (~609/1038) + majority/handoff final note (~624)
- fund-value milestone updates; full opt-in / queue / outbox / dedup system
- Deliberately honest: "still compounding" / "now theirs", never raw performance
  numbers or "you own this" (FAQ "gifter-updates" locks this) — the same
  refuse-the-manipulation discipline as the no-tip stance.

Optional, NOT built (flagged, low priority): a one-line preview on the gift
LANDING that the gifter can follow along after giving. Left unbuilt on purpose —
the opt-in lives correctly on GiftSuccess (post-gift), and a landing preview
risks adding mid-flow noise for little gain. Revisit only if give->opt-in
conversion data says otherwise.
