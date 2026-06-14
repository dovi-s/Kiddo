# Custodian / Brokerage Vendor Diligence — Alpaca Broker API vs DriveWealth

**Decision owner: founder.** This is the regulated core of Kiddo (custodial UTMA +
the at-18 handoff). Per `CLAUDE.md`, custody is the ONE provider worth keeping
swappable — both candidates live behind `server/custodianService.ts`
(`getCustodianProvider()`), never inlined in `routes.ts`.

## The state of play (2026-06)

It became a real two-horse race **one month ago**. Before 2026-05-11, Alpaca had
no custodial support and DriveWealth was the obvious pick. Now both can do the
core UTMA use case.

| | **Alpaca Broker API** | **DriveWealth** |
|---|---|---|
| Custodial UTMA/UGMA | ✅ launched **2026-05-11** (UTMA all states exc. SC, VT) | ✅ years in production (powers many kids' fintechs) |
| Developer experience | 🥇 modern, free self-serve sandbox today | enterprise / sales-led, heavier |
| Fractional in custodial | ⚠️ generally yes, **not confirmed in custodial docs** | 🥇 pioneered fractional, confirmed |
| At-majority handoff | ⚠️ **undocumented** for the new custodial product | explicit teen/custodial age-transition flows |
| Cost / minimums | startup-friendly, lower | enterprise pricing, higher minimums |
| Use the **Broker API**, not Trading API | (Trading API = self-directed/algo; Broker API = embed + own users) | n/a |

**Recommendation:** lean Alpaca on velocity + cost, but do NOT commit before
sandbox-verifying the three make-or-break flows below. Get DriveWealth on a sales
call in parallel as the proven comparison. Decide on facts, not the table above.

## 🔴 The 3 make-or-break questions (any "no" is disqualifying)

1. **Fractional by dollar amount, inside a custodial account.** Gifts are $25–$100,
   so we must buy *notional* (e.g. "$50 of VOO") in a UTMA account — not whole
   shares. Alpaca's custodial docs don't confirm fractional works in custodial;
   confirm explicitly.
2. **The at-18/at-majority handoff.** Can the custodial account convert/transfer to
   an *individual* account owned by the (now-adult) child at the state majority age
   (18–21, varies; CA = 21)? This is Kiddo's entire thesis. Alpaca's is
   undocumented; DriveWealth has explicit flows.
3. **Regulatory model — can we operate WITHOUT being our own broker-dealer?**
   Confirm we run as an introducing/technology partner under the vendor's
   broker-dealer of record (Alpaca Clearing is FINRA/SIPC), and get, in writing,
   exactly what registrations *we* must hold (RIA? none?) given our model. This
   ties directly into `COUNSEL_ENGAGEMENT_PACKET`.

## Full question set (paste into the vendor email / call)

**Accounts & custody**
- Custodial UTMA *and* UGMA? Which states excluded? Who is custodian of record?
- Exact `minor` / beneficiary fields required at open? KYC on custodian only?
- Successor custodian support? Irrevocability handling / statements / 1099 tax
  reporting under the minor's SSN?

**Money in / investing**
- Fractional **notional** buys in custodial accounts — confirm yes.
- Supported instruments: US equities + ETFs (our managed mix + curated single
  stocks)? Any restricted symbols in custodial?
- Order idempotency (so a gift retry can't double-invest)?
- ACH/funding: who moves money, settlement timing, return/NSF handling?

**The handoff (keystone)**
- At majority: custodial → individual account transfer for the child — supported?
  Automated or manual/ops ticket? Timeline? What does the child have to do (KYC)?
- Can the *previous custodian* be cleanly removed from access at transfer?

**Refunds / liquidation**
- Partial + full liquidation by dollar amount? Timeline to cash? Withdrawal rails?

**Commercials & ops**
- Minimums (monthly platform fee, per-account, AUM floor)? Per-trade / clearing
  costs? Fractional-share economics?
- Sandbox terms (free? how close to prod?) and **production go-live timeline +
  prerequisites** (the "Full Live" sign-offs).
- PFOF / order-routing model (we will NOT build on PFOF-dependent economics —
  see `UNIT_ECONOMICS.md`).
- SLAs, support tier, incident history, data-portability / exit terms (we keep
  the orchestration layer — see "integrate up, rent rails down").

### 🔬 Sharpened / new questions (2026-06-12, after sandbox onboarding + reading the Custodial / ACAT / FDIC Sweep docs)

**The handoff — now the #1 risk (ACAT liquidates fractional):**
- At majority, is it an **in-place re-registration** of the custodial account into the
  beneficiary's individual account (same account, **fractional positions + cost basis
  preserved, NO liquidation**), or does it require an **ACAT**? Your ACAT docs say a full
  ACAT **liquidates fractional shares** before transfer — we are fractional-heavy and tell
  customers "nothing was sold," so an ACAT-based handoff is disqualifying as-is. Confirm the
  exact mechanism.
- API-triggered or ops ticket? Timeline? Does the now-adult re-KYC / sign new agreements?
  Does cost basis + holding period carry through for their future capital-gains?
- Do you track the **state-specific majority age** (18–21) and drive UTMA termination, or do we?

**Third-party (gifter) funding — core to our model, not yet covered anywhere:**
- Accounts are funded by **many gifters who are NOT the custodian** (often no Alpaca/KYC
  relationship). Supported architecture? We expect to collect gifts via our PSP (Stripe) into
  a **pooled FBO / sweep account**, then ACH/journal into each custodial account — do you
  support that, and what are the **AML / source-of-funds** expectations for third-party-
  originated deposits?
- Supported rails: ACH, wire, **Instant/JIT funding** (invest a gift before ACH settles)?
  Journal API between a partner FBO and customer accounts?

**Curated mix / managed portfolios (the RIA line):**
- We offer a **default curated-but-self-directed** ETF basket (Growth/Balanced/Conservative;
  no individual recommendations, no discretion). Does using your **Portfolio Rebalancing API**
  to maintain those model portfolios keep us a **Technology Partner**, or tip us into needing
  **RIA** registration? What's the supported non-RIA structure for default model portfolios?
- Confirm **fully-disclosed** (not omnibus) is the structure for our per-kid accounts.

**Kiddo Cash / FDIC sweep:**
- Custodial accounts are eligible for the FDIC sweep — what are the **partner economics** (do
  we share in the interest/float, or does it pass to the customer)? Any extra disclosures we
  must surface (cash is FDIC pass-through, **not SIPC**)?

**Sandbox smoke-test progress (2026-06-12):** auth works (use **Legacy** credential type =
Basic auth; the new `Client Secret` type is OAuth2 and 401s the script). Identity payload now
valid (Alpaca requires the custodian financial profile — income/net-worth/risk/objective). Hit
**`403 {40310000} "creating custodial USA accounts is not enabled"`** → custodial creation is an
**entitlement gated per-correspondent**, OFF by default even in sandbox. **ACTION: ask Alpaca to
enable custodial account creation for our sandbox correspondent (firm `frvq`)**, then re-run.
Fractional-in-custodial (#2) still needs a re-run during market hours once #1 is enabled.

**📄 DOC FINDINGS round 2 (2026-06-12 — Funding / Rebalancing / SSE / Instant Funding / Market Data):**
- **🟢 Gifter-funding architecture RESOLVED → Cash Pooling + Journals API.** Alpaca's "Funding Accounts" doc: *"send customer deposits in a bulk to your firm account first and reconcile later using the Journals API"* (= aggregate funding). This is exactly Kiddo's model: collect gifts via Stripe → pool in a Kiddo firm/FBO account → `Journals API` (JNLC) into each kid's custodial account. **Caveat (not new): "you may need a local license… check your counsel"** + **Travel Rule** transmitter info on journals → this is the SAME money-transmission gate already in `COUNSEL_ENGAGEMENT_PACKET` (holding gift funds pre-account), now concretely mapped to the Alpaca funding path. Not a new blocker; the known counsel gate.
- **🟢 Curated mixes RESOLVED → Portfolio Rebalancing API.** Define Growth/Balanced/Conservative as **Portfolios** (weighted VTI/VXUS/BND), **subscribe** each account, Alpaca auto-runs `invest_cash` (cash >$10 → buys toward target, 9:30-3:30 ET) + `full_rebalance` on drift-band/calendar. Uses **fractional/notional** orders. Min $1/asset, $10 invest_cash. Our gifts ($25-100) + 2-3 assets fit cleanly. (Doc frames it "for investment advisors" — the RIA-vs-tech-partner characterization is still the counsel question, but the *mechanic* is a perfect fit.)
- **🟢 Event sync → SSE Events** (account status / journal / transfer / trade / non-trade-activity / system EOD): replayable by ULID, maps to Kiddo's existing webhook+outbox pattern.
- **🟡 Instant Funding = available but SKIP at launch.** It extends instant buying power *before* funds settle (for ACH-first apps) — needs a partner deposit, T+1 wire settlement, signed pricing amendment, late interest (Fed+8%). Kiddo **pre-collects via Stripe**, so we already hold the cash before investing → don't need the credit/risk. Revisit only if we want sub-day "watch it land."
- **Market data:** Broker API plans = Basic (free, IEX/15-min-delayed) → Standard $500-$2,000/mo. Delayed/IEX is fine for showing fund values. NB market-data auth uses the **OAuth Client-Credentials** flow → the `Client Secret` credential we generated earlier IS the one for market data (Legacy/Basic-auth is for the Broker REST endpoints). Both have a use.

## The plan (sandbox-first, decide on evidence)

1. **Alpaca sandbox today** (free, self-serve). Prototype the three make-or-break
   flows *behind* `custodianService.ts`'s `alpaca` adapter:
   open custodial (`minor_identity`) → fractional gift buy → at-majority transfer.
   If fractional-in-custodial or the handoff don't work cleanly → Alpaca is out.
2. **DriveWealth sales call** in parallel — run the same question set; get real
   pricing/minimums + custodial maturity + handoff confirmation.
3. **Decide** on: fractional + handoff actually work, pricing/minimums for our
   stage, and which structure counsel signs off. Set `CUSTODIAN_PROVIDER` and
   implement that one adapter.

## Integration status & exact wiring (when you pick a provider)

**Built (all inert at the default `stub` provider — zero app risk):**
- `server/custodianService.ts` — the interface + `getCustodianProvider()` (env `CUSTODIAN_PROVIDER`).
- `server/alpacaBrokerClient.ts` — sandbox-ready Alpaca client (real HTTP, inert without keys).
- `server/driveWealthAccountSetup.ts` — DriveWealth account-open scaffold (reused by both the `drivewealth` adapter and the Alpaca payload mapping).
- `script/alpaca-custodial-smoke.ts` (`npm run smoke:alpaca-custodial`) — one-command make-or-break verifier.

**Already live + already provider-neutral (don't refactor — it's compliant):**
- The custodian transfer/handoff path goes through `queueCustodianTransfer` (a webhook + outbox
  event queue, NOT a vendor SDK) in `routes.ts` (withdrawal/handoff) + `routes/ageTransitionLifecycle.ts`.
  `routes.ts` inlines no vendor SDK, so the boundary already holds here.

**NOT yet wired (intentionally — gated on the provider pick + counsel):**
- The account-open path. There is no activate-investing → open-account route yet; building it is a
  founder-owned + counsel-gated feature, not a refactor.

**To wire account-open once a provider is chosen (the only code that should change):**
1. Set `CUSTODIAN_PROVIDER=<drivewealth|alpaca>` + that provider's credentials.
2. In the activate-investing handler, call
   `getCustodianProvider().openCustodialAccount({ fundId, childSsnDigits, custodianSsnDigits })`
   and persist `result.accountId` to `funds.drivewealthAccountId` (or rename that column to
   `custodianAccountId` via a migration — a founder call, not required to ship).
3. Wire `investGift` at gift settlement, `liquidate` at refund/withdrawal, and route the age-18
   worker's handoff through `getCustodianProvider().handoffAtMajority(...)`.
4. Never import a vendor SDK into `routes.ts` — only the interface.

## Reminders

- The provider does NOT clear our regulatory gate — the AUM/RIA decision +
  holding-gift-funds-pre-account questions in `COUNSEL_ENGAGEMENT_PACKET` still
  gate launch regardless of vendor.
- Whichever wins, it stays behind `custodianService.ts`. No vendor SDK in
  `routes.ts`.

## Outreach drafts (ready to send)

Fill the brackets. Brand is **Kiddo** (never "Kora"). Keep these tight; the goal
is a sandbox/call, not a full pitch.

### → Alpaca (Broker API partnerships)

> **Subject: Broker API for a custodial kids' investing + gifting product**
>
> Hi Alpaca team,
>
> I'm building Kiddo, a custodial investing product for kids funded by family
> gifting. The flow: relatives gift small amounts, we invest them in a UTMA
> account managed by the parent, and the account hands off to the child at the
> age of majority. We've signed up for the Broker API sandbox and are
> prototyping now.
>
> Three things decide our fit, and I'd love a straight answer on each:
>
> 1. Do fractional, notional (dollar-amount) buys work inside a custodial
>    account? Our gifts are $25 to $100, so notional orders are mandatory.
> 2. What is the at-majority path? Can a custodial account convert or transfer to
>    an individual account owned by the child when they reach the state majority
>    age, and is that automated or an ops process?
> 3. Can we operate as an introducing/technology partner under Alpaca Securities
>    as broker-dealer of record, and what registrations (if any) must we hold
>    given that model?
>
> Also keen to understand minimums, per-account and clearing economics, and the
> production go-live timeline and prerequisites. Could we get 30 minutes with
> someone on the partnerships team?
>
> Thanks,
> [Name], Founder, Kiddo
> [email] · [site]

### → DriveWealth (sales)

> **Subject: Custodial + fractional API for a kids' gifting investing product**
>
> Hi DriveWealth team,
>
> I'm the founder of Kiddo, a custodial investing product for kids funded by
> family gifting (gifts get invested into a UTMA account, which hands off to the
> child at the age of majority). I'm evaluating custody/brokerage partners and
> DriveWealth's track record with custodial and teen accounts puts you on the
> shortlist.
>
> Could we set up a call? The questions that matter most to us:
>
> 1. Fractional, dollar-amount investing inside custodial accounts (our gifts are
>    $25 to $100).
> 2. The at-majority handoff: custodial to individual ownership for the child,
>    and how automated that transfer is.
> 3. Account minimums, per-account and per-trade economics, and your typical
>    onboarding/go-live timeline.
> 4. A couple of reference customers running custodial/teen accounts at scale.
>
> Happy to share more on the product and volume expectations on a call. What does
> your availability look like next week?
>
> Thanks,
> [Name], Founder, Kiddo
> [email] · [site]

## Decision scorecard (fill in as answers arrive)

**Step 1 — gates (any FAIL eliminates that vendor, no scoring needed):**

| Gate | Alpaca | DriveWealth |
|---|---|---|
| Fractional notional buy works IN custodial (run `npm run smoke:alpaca-custodial`) | ☐ pass / ☐ fail | ☐ pass / ☐ fail |
| At-majority handoff to the child exists (custodial → individual) | ☐ pass / ☐ fail | ☐ pass / ☐ fail |
| We can operate WITHOUT being our own broker-dealer | ☐ pass / ☐ fail | ☐ pass / ☐ fail |

**Step 2 — score the survivors (1-5 each; weight in parens). Highest total wins:**

| Criterion (weight) | Alpaca | DriveWealth |
|---|---|---|
| Developer experience / speed to build (×3) | _ | _ |
| Cost + minimums at our stage (×3) | _ | _ |
| Custodial maturity / proven at scale (×3) | _ | _ |
| Handoff automation quality (×2) | _ | _ |
| Time to production go-live (×2) | _ | _ |
| Support / SLA / references (×1) | _ | _ |
| **Weighted total** | **_** | **_** |

**Decision rule:** a gate FAIL eliminates outright. Otherwise pick the higher weighted
total. If within ~10%, **default to Alpaca on velocity + cost** UNLESS DriveWealth is
materially stronger on custodial maturity or the handoff (the two places Alpaca's
month-old product is least proven). Record the call + date here: ______________________

**Raw answers captured (paste vendor responses):**
- Alpaca: ______________________________________________________________
- DriveWealth: _________________________________________________________

## Sources

- Alpaca custodial launch (2026-05-11): https://alpaca.markets/blog/alpaca-launches-custodial-accounts-for-broker-partners/
- Alpaca custodial docs: https://docs.alpaca.markets/docs/custodial-accounts
- Alpaca Broker vs Trading API: https://docs.alpaca.markets/us/docs/about-broker-api
- Alpaca Broker API onboarding: https://alpaca.markets/broker-resources/guide/getting-started-with-broker-api-guide-to-onboarding-process
- DriveWealth teen & custodial: https://developer.drivewealth.com/apis/docs/teen-custodial-accounts
- DriveWealth fractional: https://developer.drivewealth.com/apis/docs/fractionalized-assets
