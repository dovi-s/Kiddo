# Launch-gate outreach emails — ready to send

The four emails that start the two long-lead clocks (counsel + custody). Filled with
your details. Source briefs: `COUNSEL_ENGAGEMENT_PACKET.md`, `CUSTODIAN_VENDOR_DILIGENCE.md`.

## Before you send (60 seconds)
1. **From-address:** all four now use `dovi@kiddofund.com` (the address already on the live
   Alpaca thread) — a domain email reads more credibly to a law firm and a brokerage than a
   gmail. If you'd rather send any of these from `dovisherman@gmail.com`, swap the contact line.
2. **Confirm `kiddofund.com` is live** (or pointing somewhere presentable) before you
   cite it. If it isn't up yet, drop the site line rather than link a dead page.
3. **Counsel email only:** attach the product overview / deck, a TOS draft, and a
   pricing-page screenshot. Do NOT attach any custodian/BD agreement (none is signed;
   the packet's safe framing depends on not implying one).
4. **Counsel: send to 3 firms in parallel**, pick the one that replies with a thoughtful
   scoping question rather than just a fee quote. **Target a boutique securities/IA attorney**
   (senior enough to give a privileged opinion, small enough to take a bounded fixed-fee job) —
   NOT a compliance consultancy. ⚠️ The earlier suggestions **Hardin Compliance** and **ACA
   Group** are compliance *consultancies*, not law firms — they do RIA registration *mechanics*
   but **cannot opine** on the fee-vs-advisory or money-transmission questions; dropped.
   **Verified shortlist (2026-06-24):**
   - **Part 1 / RIA (the primary engagement):**
     - **Parker MacIntyre** (Atlanta GA) — IA/RIA regulatory boutique, ex-regulators. Partner
       J. Steven Parker · `jsparker@parkmac.com` · (404) 490-4060 · contact form at
       parkmac.com/contact-us/.
     - **Fintech Law** — Bo Howell (16+ yrs securities lawyer, ex-SEC, ex-CCO); RIA registration;
       intake form at fintechlaw.ai/contact. Boutique, fixed-fee friendly.
   - **Part 2 / money transmission (only if the securities firm doesn't cover it — see the
     packet's "Parts 3/5 can ride the same call" note):**
     - **Cogent Law** — money-transmitter licensing + custody platforms (cogentlaw.com).
     - **Hudson Cook, LLP** — MSB / money-transmitter regulatory (hudsoncook.com).
   - **Optional BigLaw credibility check (pricier — likely $10K+, may decline a small fixed
     fee):** Cooley, Lowenstein Sandler, or Foley Hoag fintech practices.
   - Contact each via the published email / intake form above — do NOT guess partner emails.
5. Optional: add a phone number to the sign-offs if you want calls to come in faster.

---

## 1. Counsel (send to 3 SEC-RIA fintech boutiques) + attach the packet

**Subject:** RIA question for a pre-launch UTMA app — scoping a short engagement

Hi [Name],

I'm the founder of Kiddo, a pre-launch app where parents open UTMA accounts for their kids
and family chips in gift investments. Custody and execution run through a third-party
broker-dealer — we're the software layer, and we're not live yet.

Before we launch I need a read on two things: whether our 0.10% asset-based fee makes us an
SEC RIA (we think there's a self-directed, platform-fee path), and whether we can capture a
gifter's payment before the child's account exists without tripping money-transmission rules.
I've put the specifics in a short packet I can send over.

What I'm after is a call and a 2 to 3 page memo on which structure to use and what to fix in
the product and TOS — fixed fee, if you'd propose one. Is this the kind of thing you do, and
do you cover the money-transmission side or would that be separate counsel?

Thanks,
Dovi Sherman
Kiddo · dovi@kiddofund.com

---

## 2. Alpaca (Broker API partnerships)

> **Scope note (2026-06-24):** this email was deliberately SHORTENED. We already verified
> custodial account creation + fractional notional buys in sandbox ourselves (ticket 309412
> enabled `frvq`), and the 3 Alpaca Broker API webinars + our doc-research run already answer
> the procedural questions (go-live pipeline, KYC ownership, funding mechanics, the sandbox
> ~1hr ACH delay, what registrations gate *starting*). Two questions remain that only Alpaca
> can answer, and one of them (the handoff) already rides the **support ticket 309412 reply**
> — so this partnerships email is now just the commercials conversation. Do NOT re-ask the
> things we already know (full detail in `CUSTODIAN_VENDOR_DILIGENCE.md`). **Send once a
> partnerships contact is named; from `dovi@kiddofund.com`.**

**Subject:** Production onboarding — custodial kids' app on Broker API

Hi [Name],

Kiddo founder here. We've got the custodial flow working in your Broker API sandbox — account
open plus fractional notional buys inside the custodial account — and we're heading toward
production.

Could we grab 30 minutes on the commercial side? Mainly per-account economics and any
minimums, whether partners share the FDIC sweep on custodial cash, and what go-live takes —
including getting approved as a tech partner under Alpaca Securities (we're software, not a
broker-dealer; the RIA question's with our own counsel).

Thanks,
Dovi Sherman
Kiddo · dovi@kiddofund.com

> **Held for the same thread (already asked in ticket 309412, don't double-ask):** confirm the
> at-majority transition is an in-place re-registration preserving fractional positions + cost
> basis (not an ACAT). If support hasn't answered it by the time you reach partnerships, fold
> it in here.

---

## 3. DriveWealth (sales)

**Subject:** Custodial + fractional API — worth a quick call?

> **Scope note (2026-06-24):** DriveWealth is the **proven-incumbent comparison**, not the
> lead — we've already verified custodial open + fractional-in-custodial on Alpaca's sandbox.
> This call exists to pressure-test the two places Alpaca's month-old product is least proven:
> the **at-majority handoff** and **small-account economics** (DriveWealth historically carries
> higher minimums — the thing most likely to decide this). Send from `dovi@kiddofund.com`.

Hi DriveWealth team,

I'm the founder of Kiddo — family gifting into a kid's UTMA that hands off to the child at
the age of majority. I'm picking a custody partner and want DriveWealth in the mix.

Two things will really decide it for us: at majority, does the custodial re-register in place
to the child (keeping the fractional shares and cost basis, not an ACAT that liquidates), and
how do your minimums and per-account costs look — our accounts start small, gifts are $25 to
$100. Fractional-in-custodial too, though I assume that's a given for you.

Free for a short call next week? Happy to share more on the product and the volume we expect.

Thanks,
Dovi Sherman
Kiddo · dovi@kiddofund.com

---

## 4. Alpaca support — enable custodial creation in sandbox (unblocks the smoke test)

> ✅ **DONE / SUPERSEDED (2026-06-24).** Sent 2026-06-18; Alpaca enabled `frvq` on 2026-06-24
> (ticket **309412**). We then verified custodial open + fractional-in-custodial in sandbox.
> The remaining asks (handoff confirmation + partnerships contact) moved to the **reply on
> ticket 309412** — see that draft, not this template. Kept below for the record only.

**Subject:** Enable custodial USA account creation for sandbox correspondent (firm frvq)

Hi Alpaca team,

We're building on the Broker API (sandbox) and prototyping custodial UTMA account
creation. Our sandbox correspondent is firm **frvq**.

When we POST a custodial account create, we get:

`403 {"code":40310000,"message":"creating custodial USA accounts is not enabled"}`

It looks like custodial account creation is an entitlement that's off by default, even in
sandbox. Could you enable custodial USA account creation for correspondent **frvq** so we
can test the open → fractional notional buy → at-majority flow end to end?

While you're in there, two quick confirmations would help us finish diligence:
1. Fractional, notional (dollar-amount) buys are supported inside custodial accounts.
2. The supported at-majority mechanism is an in-place re-registration to the child's
   individual account (preserving fractional positions and cost basis), not an ACAT.

Thanks very much,
Dovi Sherman
Founder, Kiddo
dovisherman@gmail.com · kiddofund.com
