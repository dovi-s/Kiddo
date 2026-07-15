# Kiddo — one-page product overview (for counsel / custodian intros)

*Plain-English description of what Kiddo is and how it's structured, to accompany
`COUNSEL_ENGAGEMENT_PACKET.md` (the legal questions) and the custodian diligence. Reusable
as the "what is this" attachment for the securities-counsel call and the Alpaca/DriveWealth
calls. Pre-launch; custody not yet live; nothing here describes a signed agreement.*

## What it is
Kiddo is a **software and experience layer** for investing in a child's future. A parent
opens a **custodial (UTMA/UGMA) account** for their kid; friends and family **gift small
amounts** ($25–$100) that get invested into that account; a relationship layer (the "Memory
Book") records the gifts, notes, and milestones; and at the state **age of majority the
account becomes the now-adult child's own** ("the handoff"). The emotional wedge is
gifting; the long-term thesis is the lifetime financial relationship begun at birth.

## How it's structured (the intended posture)
- **Not a broker-dealer.** Securities are intended to be **custodied and executed by a
  third-party broker-dealer of record** (e.g. Alpaca Securities LLC, Member FINRA/SIPC, or
  DriveWealth). Kiddo rents that license; it does not become one.
- **Rent the regulated rails, own the experience.** Kiddo provides the UX, the gifting
  loop, the Memory Book, and the orchestration layer; the custodian holds the assets,
  issues statements, and handles tax reporting (under the minor's SSN).
- **Money flow intended out of Kiddo's hands.** The design goal is gift money flowing
  gifter → custodian (or via the licensed payment processor), with Kiddo never holding or
  controlling customer funds (to stay out of money-transmission/custody licensing).
- **Self-directed posture.** The parent/gifter affirmatively chooses from a neutral menu
  (a curated stock universe framed by meaning not performance, plus broad-market ETF mix
  presets the user selects). No personalized recommendations at the kid/gift level.

## The fee model
- The **family side is free** to use; gifts arrive whole (gifters pay no fee on the gift).
- A **0.10% annual asset-based fee** on invested assets (the "meter"), continuing onto the
  adult account post-handoff.
- An **optional subscription** (Plus / Family) for premium features (more kids, richer
  Memory Book, co-parent tools) — never gating gifting or investing.
- Future/forward lines (gated, not live): gifter-sponsored premium, interchange on a
  teen/at-18 card, sponsor/B2B contributions. (Detail: `REVENUE_MODEL.md`.)

## Entities (intended)
- **Kiddo, Inc.** — the technology/platform company (not a broker-dealer, not an RIA in the
  base posture).
- A possible **affiliated SEC-registered RIA** if the advisory line is pursued (open
  question — see the packet). (Comparable live template: competitor Endowe runs Endowe Inc.
  = platform + Endowe Advisory LLC = SEC RIA, custodian Interactive Brokers.)

## The open legal questions (full detail in `COUNSEL_ENGAGEMENT_PACKET.md`)
1. Does the 0.10% asset-based fee, on a self-directed platform, require **SEC RIA
   registration** — or is it a platform/technology fee? (Part 1)
2. Can we **capture a gifter's payment before the recipient's account exists** without
   tripping money-transmission/custody rules? (Part 2 — built behind a flag; needs sign-off)
3. **COPPA / children's-privacy** applicability on a "collected from the adult about the
   child" theory. (Parts 3 + 5)
4. National vs state-by-state launch under the rent-the-rails structure. (Part 7)
5. Custody/SIPC + wind-down copy blessing; beneficiary/TOD; advisory/referral boundaries.
   (Parts 4, 6, 8, 10)

## Stage
Pre-launch, US-only. Demo built; custody not yet wired (sandbox in progress with a
candidate custodian). The two answers that finalize both cost and revenue model: the **RIA
determination** (counsel) and the **custody-vendor pick** (Alpaca vs DriveWealth).
