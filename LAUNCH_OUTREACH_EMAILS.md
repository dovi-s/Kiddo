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

**Subject:** Broker API for a custodial kids' investing + gifting product

Hi Alpaca team,

I'm building Kiddo, a custodial investing product for kids funded by family gifting. The
flow: relatives gift small amounts, we invest them in a UTMA account managed by the
parent, and the account hands off to the child at the age of majority. We've signed up for
the Broker API sandbox and are prototyping now.

We've read the custodial, ACAT, funding, and FDIC-sweep docs, so these are the specific
points that decide our fit:

1. Fractional / notional in custodial: confirm dollar-amount (notional) buys work INSIDE a
   custodial account — our gifts are $25 to $100, so notional is mandatory.

2. At-majority handoff (our biggest question): your custodial docs say the beneficiary
   "assumes full control of the account" at majority. Please confirm this is an in-place
   re-registration of the same account that preserves fractional positions and cost basis
   (no liquidation) — i.e. not an ACAT (your ACAT doc notes a full ACAT liquidates
   fractional shares). And is it Alpaca-driven by the minor's DOB/state, or platform-triggered?

3. Non-BD technology partner + enablement: we're a US software platform, not a broker-dealer
   or RIA. Confirm we can be approved as a technology provider under Alpaca Securities (broker-
   dealer of record), what registrations (if any) we must hold, and what's needed to enable
   custodial USA account creation for our sandbox correspondent (firm frvq, currently
   403 "creating custodial USA accounts is not enabled").

4. Gifter (third-party) funding: many non-custodian gifters fund one minor's account. We plan
   to pool gift deposits into a firm/FBO account and journal them into each custodial account.
   Confirm this is supported, what your flow-review process is, whether it requires us to hold
   a money-transmission license, and what Travel-Rule / transmitter info we must collect on
   each (often small) deposit.

5. Excluded states for custodial UTMA/UGMA, if any.

6. Commercials + go-live: per-account and clearing economics, any minimums / AUM floor,
   whether partners share the FDIC-sweep interest or it passes entirely to the customer, and
   the production go-live timeline + prerequisites.

Could we get 30 minutes with the partnerships team?

Thanks,
Dovi Sherman
Founder, Kiddo
dovisherman@gmail.com · kiddofund.com

---

## 3. DriveWealth (sales)

**Subject:** Custodial + fractional API for a kids' gifting investing product

Hi DriveWealth team,

I'm the founder of Kiddo, a custodial investing product for kids funded by family gifting
(gifts get invested into a UTMA account, which hands off to the child at the age of
majority). I'm evaluating custody and brokerage partners, and DriveWealth's track record
with custodial and teen accounts puts you on the shortlist.

Could we set up a call? The questions that matter most to us:

1. Fractional, dollar-amount investing inside custodial accounts (our gifts are $25 to
   $100).
2. The at-majority handoff: whether custodial converts to individual ownership for the
   child as an in-place re-registration that preserves fractional positions and cost basis
   (not an ACAT that liquidates), and how automated that transfer is.
3. Account minimums, per-account and per-trade economics, and your typical onboarding and
   go-live timeline.
4. A couple of reference customers running custodial or teen accounts at scale.

Happy to share more on the product and volume expectations on a call. What does your
availability look like next week?

Thanks,
Dovi Sherman
Founder, Kiddo
dovisherman@gmail.com · kiddofund.com

---

## 4. Alpaca support — enable custodial creation in sandbox (unblocks the smoke test)

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
