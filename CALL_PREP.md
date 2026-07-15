# Kiddo — Field & Call Prep Card

*Everything for this week's three free moves on one page: the user-discovery
conversations, the Alpaca fit/pricing call, the legal scoping calls. Keep it on
your phone. Written 2026-06-11. Companion to GO_LIVE_PLAN.md + LOOP_TEST_RUNSHEET.md.*

---

## 1 · USER-DISCOVERY CONVERSATIONS (the $0 pulse-check)

**The one rule: trust what they DO, not what they say.** "I'd totally use that" is
the *weakest* signal there is. Have the founding-member signup / gift link **open
on your phone** ("reserve your kid's fund now, goes live when investing turns on,
fully refundable") so the moment they lean in, intent becomes action. **Score: did
they act, or just compliment?**

**Every conversation:** open with their *real life* → **show it, shut up, watch
their face** → make a *concrete* ask. Never open with "would you use this?"

**① Parent (account-opener)**
- Open: *"When [kid] gets birthday cash, where does it actually go?"*
- Ask: *"Want me to start one for [kid] right now?"*
- 🟢 reaches for phone/card · asks cost/at-18/is-it-safe · names who they'd invite · texts spouse
- 🔴 "love it, I'd use that" + no motion, no specific person

**② Gifter (grandparent / aunt / uncle / friend — the loop engine)**
- Open: *"What'd you give [niece/grandkid] last birthday? What happened to it?"*
- Ask: *"Send this instead of the check next time?"* then **the loop question:**
  *"Got a kid or grandkid of your OWN you'd want one for?"*
- 🟢 "way better than another toy" + names the kid + asks for the link · **GOLD:** unprompted *"I want one for MY grandkid"*
- 🔴 "what a sweet idea"

**③ Expecting / brand-new parent (highest-intent wedge)**
- Open: *"Are people asking what to get the baby? Doing a registry?"* Frame: *"the
  registry item that's their future, not more plastic."*
- 🟢 *"can I put this on my registry / shower invite?"* (the loop firing through their whole family at once)

**④ The skeptic (deliberately find 3–4)**
- Ask: *"Wouldn't you just open a free custodial at Fidelity?"* Let them push.
- 🟢 (the win) they argue YOUR wedge back: *"Fidelity won't get grandma to contribute / won't be something my kid connects to."*
- 🔴 shrug + "yeah I'd just use Fidelity" → **listen hard, this is what kills you.**

**Reaction ladder:** 🟢 they DO something (start now / phone out / names people / asks for link / pre-commits) · 🟡 sharp questions (fees, at-18, safe, what-if-you-shut-down) = evaluating to buy · 🔴 future-tense praise = score as a NO.
*Mom-Test: "I would…" ≈ worthless. "I do / I did" + anything they DO in the room ≈ gold. Discount friends-and-family heavily — only actions count.*

**After EACH chat, write one line:** what they DID (not said) + strongest objection.

**The bar (pre-commit NOW, while objective):**
> If **< ~1 in 4** does something real (asks to start / names who they'd invite /
> reaches for the link), the wedge isn't there yet — that's a **product/positioning**
> problem, not a "show more people" problem.

**Loop signal (weight highest):** of gifters shown, how many *spontaneously* want one
for their own kid? **Even 1–2 in 10 = a pulse** (wide fan-out makes a small rate
compound to k≈1). Zero in twenty is the loudest answer you can get — worth knowing
in a week, not a year.

**How many:** ~10–15 per core type, ~25–40 total. Stop at *saturation* (no new
reactions/objections), not a magic number.

### Tally sheet (fill as you go)

| # | Type (P/G/NP/Skeptic) | What they DID | Strongest objection | 🟢🟡🔴 | Loop? (wanted own) |
|---|---|---|---|---|---|
| 1 |  |  |  |  |  |
| 2 |  |  |  |  |  |
| 3 |  |  |  |  |  |
| 4 |  |  |  |  |  |
| 5 |  |  |  |  |  |
| … |  |  |  |  |  |

*Roll-up after ~25: green-rate = __ /__ · loop-rate (gifters wanting own) = __ /__*

---

## 2 · ALPACA CALL (get real numbers + confirm fit)

**Pricing (the point of the call):**
- [ ] Cost structure for **custodial** accounts — per-account / per-trade / platform fee / monthly minimum / setup fee?
- [ ] Any **minimum volume or revenue commitment**? (Want pay-as-you-go, no lock-in.)

**Fit — the deal-breakers:**
- [ ] Can custodial accounts buy **ETFs** (VTI/VXUS/BND), not just single stocks? *(Where DriveWealth fails — confirm Alpaca doesn't.)*
- [ ] **Fractional shares + dollar-based orders** for custodial?

**The gifting model — ask hard, these are make-or-break:**
- [ ] Can a **third party (a gifter, not the owner) fund** a custodial account? How?
- [ ] Accept **multiple non-parent gifters** into **one** minor's UTMA — and your **source-of-funds / AML** process for that? Tolerance for many small contributions?
- [ ] Funding end-to-end — **ACH only**, or push from a Stripe/holding account? **Funding API**?
- [ ] Can we **debit our 0.10% platform fee** via your API, or bill separately?

**Operations:**
- [ ] At **majority**, process to convert UTMA → individual account in the adult's name — automated via API?
- [ ] Support **transfer-on-death (TOD)** on post-handoff individual accounts?
- [ ] Which **states** for UTMA + individual? (SC/VT → UGMA?)
- [ ] Confirm **1099s + monthly statements** generated for custodial.
- [ ] **Integration timeline** sign-to-live? **Sandbox** now?

**Exit + compliance:**
- [ ] Any **exclusivity / lock-in / termination** terms?
- [ ] Moving off later — accounts out via **ACATS**? Friction?
- [ ] **What does your compliance team need to review/approve about our model before go-live?** *(free pre-test of the structure.)*

*(Also call DriveWealth + Apex for quotes — but lead Alpaca; confirm the ETF answer above before anything else.)*

---

## 3 · LEGAL SCOPING CALLS (3 fintech-securities firms — read + judge)

Open: *"Pre-launch UTMA fintech, software layer on a rented broker-dealer (Alpaca),
custody not yet live. A few scoping questions before we engage."*

- [ ] **Self-directed** (neutral menu, no managed/age-banded allocations, no nudges) + a **0.10% asset-based platform fee** — does that plausibly keep us OUT of RIA registration, or is an asset-based fee itself the problem?
- [ ] If we *were* an adviser under $100M AUM, we'd register at the **state** level (≈50 states), right? So the self-directed call is what avoids that — match your read?
- [ ] Gifts flow **Stripe → Alpaca** — **money-transmission / MTL** exposure, or pass-through? And holding a gift **before the account exists** (capture-at-intent)?
- [ ] If the structure holds, **launch all 50 states day one**, or carve-out states?
- [ ] Child data collected **from the adult, not the child**; Kid View PIN-gated/read-only — keeps us **outside COPPA**?
- [ ] Cost + timeline for a **written memo** on those? Cover **both securities + privacy**, or need a second firm? Done **UTMA / embedded-investing** clients before?

**Buy:** Packet Parts **1 + 2 + 7 (+ quick 5)**, ~$3–5K. **Defer:** 4, 6, 8, 10, 11.

**The meta-move:** hire the firm that asks YOU a sharp scoping question back
("does your default mix get pre-selected, or does every user actively pick?"),
**not** the one that just emails a fee quote. Pick for the question, not the price.

---

### This week, in order
1. **Send** 3 legal scoping emails (cover email in COUNSEL_ENGAGEMENT_PACKET.md).
2. **Book** Alpaca + DriveWealth + Apex calls.
3. **Start** the conversations — log every one on the tally above.
4. Decide the **$10K** only on **pulse** (theirs or your own honest gut), never on the analysis alone.
