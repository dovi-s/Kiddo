# Launch-gate outreach emails — ready to send

The four emails that start the two long-lead clocks (counsel + custody). Filled with
your details. Source briefs: `COUNSEL_ENGAGEMENT_PACKET.md`, `CUSTODIAN_VENDOR_DILIGENCE.md`.

## Before you send (60 seconds)
1. **From-address:** these go out under `dovisherman@gmail.com` as written. If you have
   a `dovi@kiddofund.com` (or similar) address, send from that instead — a domain email
   reads more credibly to a law firm and a brokerage. Swap the contact line if so.
2. **Confirm `kiddofund.com` is live** (or pointing somewhere presentable) before you
   cite it. If it isn't up yet, drop the site line rather than link a dead page.
3. **Counsel email only:** attach the product overview / deck, a TOS draft, and a
   pricing-page screenshot. Do NOT attach any custodian/BD agreement (none is signed;
   the packet's safe framing depends on not implying one).
4. **Counsel: send to 3 firms in parallel**, pick the one that replies with a thoughtful
   scoping question rather than just a fee quote. Suggested: Hardin Compliance, ACA Group,
   Foley Hoag (fintech), Cooley (emerging companies + fintech), Lowenstein Sandler (RIA).
5. Optional: add a phone number to the sign-offs if you want calls to come in faster.

---

## 1. Counsel (send to 3 SEC-RIA fintech boutiques) + attach the packet

**Subject:** RIA-registration + fund-holding questions — pre-launch UTMA fintech, need a directional call + short memo

Hi [Name],

We're Kiddo, Inc., a pre-launch, US-only fintech. Parents open custodial (UTMA)
investment accounts for their kids, and friends and family contribute gift-investments.
Investments are intended to be custodied and executed by a third-party broker-dealer; we
are the technology and experience layer, and we are pre-launch (custody is not yet live).

We need directional answers, before public launch, on two linked questions: (1) whether
our planned 0.10% asset-based fee requires SEC RIA registration, given a self-directed
platform posture (we've also sketched three fallback structures); and (2) whether we may
capture a gifter's payment before the recipient's account exists, without tripping money
transmission or custody rules. A short attached packet lays out these plus a few
tightly-scoped privacy questions on children's data.

We're looking for a 60 to 90 minute call plus a 2 to 3 page written memo within about two
weeks (which structure, why, and what to change in the product, website, and TOS to be
clean), roughly a $3K to $5K initial engagement, with any follow-up scoped separately.

Does this fit your practice? Happy to answer scoping questions first.

Best,
Dovi Sherman
Founder, Kiddo, Inc.
dovisherman@gmail.com · kiddofund.com

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

**Subject:** Production onboarding for a custodial kids' investing + gifting product

Hi [Name],

I'm building Kiddo, custodial (UTMA) investing for kids funded by family gifting: relatives
gift small amounts, we invest them in a UTMA account managed by the parent, and the account
hands off to the child at the age of majority. We've validated the core flow on the Broker
API sandbox — custodial account open plus fractional notional buys filling inside the
custodial account — and we're planning production.

Could we get 30 minutes on the commercial and go-live side? Specifically:

1. Per-account and clearing economics, and any minimums or AUM floor at our stage.

2. The FDIC sweep on custodial accounts — do partners share in the interest, or does it pass
   entirely to the customer?

3. Production go-live prerequisites and timeline, including approving us as a technology
   partner under Alpaca Securities as broker-dealer of record (we're a US software platform,
   not a broker-dealer; the RIA-registration question we're handling with our own counsel).

We can share product detail and volume expectations on the call.

Thanks,
Dovi Sherman
Founder, Kiddo
dovi@kiddofund.com · kiddofund.com

> **Held for the same thread (already asked in ticket 309412, don't double-ask):** confirm the
> at-majority transition is an in-place re-registration preserving fractional positions + cost
> basis (not an ACAT). If support hasn't answered it by the time you reach partnerships, fold
> it in here.

---

## 3. DriveWealth (sales)

**Subject:** Custodial + fractional API for a kids' gifting investing product

> **Scope note (2026-06-24):** DriveWealth is now the **proven-incumbent comparison**, not
> the lead. We've already verified custodial account open + fractional notional buys inside a
> custodial account on Alpaca's sandbox, so this call exists to pressure-test the two places
> Alpaca's month-old custodial product is least proven — the **at-majority handoff** and
> **small-account economics** (DriveWealth historically carries higher minimums, which is the
> thing most likely to decide this either way). Lead with those. Send from `dovi@kiddofund.com`.

Hi DriveWealth team,

I'm the founder of Kiddo, a custodial investing product for kids funded by family gifting:
gifts get invested into a UTMA account managed by the parent, which hands off to the child
at the age of majority. I'm choosing a custody partner, and DriveWealth's track record with
custodial and teen accounts puts you on the shortlist.

Could we set up a call? In priority order, the questions that decide our fit:

1. The at-majority handoff: when the child reaches the age of majority, does the custodial
   account convert to individual ownership as an in-place re-registration that preserves
   fractional positions and cost basis (not an ACAT that liquidates fractional shares), and
   how automated is that transfer — API-triggered off the minor's DOB/state, or an ops process?

2. Economics at our scale: account minimums, any AUM floor, and per-account / per-trade /
   fractional-share costs. Our accounts start small (gifts are $25 to $100), so minimums
   matter a lot to us.

3. Fractional, dollar-amount investing inside custodial accounts (table stakes for us — we
   know it's a DriveWealth strength, just confirming).

4. Typical onboarding and go-live timeline, and a couple of reference customers running
   custodial or teen accounts at scale.

Happy to share more on the product and volume expectations on a call. What does your
availability look like next week?

Thanks,
Dovi Sherman
Founder, Kiddo
dovi@kiddofund.com · kiddofund.com

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
