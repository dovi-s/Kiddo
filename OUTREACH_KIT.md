# Outreach Kit — the human work no tool can do for you

> Created 2026-05-26. This is send-ready copy + targets for the three
> founder actions that actually decide survival: (1) custody, (2) B2B2C
> demand validation, (3) acquirer relationships. None of this is code.
> All of it is you, talking to humans. The artifact is the easy 10%;
> the call, the rejection, the follow-up is the 90% — and it's yours.
>
> Grounded in `B2B_GIFTING_SPEC.md` (Phase 1 = manual, validate before
> build) and `KORA_VOICE.md` (warm, specific, real numbers, no deck-speak).
>
> The EarlyBird lesson driving all of this: a beloved consumer product
> died of CAC at $480K ARR after 6 years. The escape they never tried
> was B2B2C distribution. That's section 2. It's the most important page.

---

## 1. CUSTODY — evaluate Alpaca FIRST (the wall is lower than the doom analysis claimed)

You can't ship real money, AUM, tax docs, or the kid-2.0 funnel without a
custodial brokerage partner. The payload assembly is already built behind an
interface (`server/driveWealthAccountSetup.ts`) — and per CLAUDE.md that
interface exists precisely so the custodian is a *swap, not a rebuild*. Use
that: the code scaffolded for DriveWealth, but **Alpaca looks materially more
bootstrap-friendly and should be the first thing you evaluate.**

**The reframe that changes your bootstrap math.** The "fintech needs SEC/FINRA
compliance + five-to-six-figure clearing minimums before launch" story
describes the **Apex era EarlyBird launched into.** In 2026, Alpaca is a
FINRA-regulated, self-clearing broker-dealer (DTCC/FICC/OCC member, SIPC) that
offers custodial UGMA/UTMA via its Broker API — fractional shares, cash-only,
KYC on the adult custodian, and **Alpaca custodies + issues monthly statements
+ handles annual tax reporting on the minor.** That is the *entire stack*
EarlyBird had to assemble through Apex. Two consequences that move your whole
fund-or-bootstrap decision:
- **You ride Alpaca's broker-dealer license — you do NOT become a broker-dealer.**
  The single biggest piece of the "compliance wall" the doom analysis cited is gone.
- **There's a self-serve sign-up** (`broker-app.alpaca.markets/sign-up`). You can
  get sandbox keys and build against the real custodial API *this week*, before
  any sales call — the fastest way on earth to learn the true height of the wall.

**Do this, in order:**
1. **Get Alpaca Broker API sandbox keys today (self-serve).** Wire one custodial
   UGMA/UTMA account creation end-to-end behind the existing custodian interface.
   You'll learn more from one sandbox account than from ten more strategy docs.
2. **Read the Brokerage Fee Schedule + hit "Contact Sales"** for the one thing the
   sandbox won't tell you: production approval + pricing for a consumer-facing app
   that holds customers' money.
3. **In parallel, ping DriveWealth + Apex** (cold email below) to compare — but treat
   Alpaca as the lead unless its numbers disqualify it.

**Cold email (DriveWealth / Apex comparison, ≤120 words):**

> Subject: Custodial (UTMA) brokerage for a kids' gifting platform — partner fit?
>
> Hi [Name],
>
> I'm building Kiddo — family and friends gift money into a real investment
> fund for a child, managed by the parent until they turn 18 (UGMA/UTMA). A
> grandparent sends $50 in 60 seconds, it buys real shares, the kid takes it
> over at majority.
>
> We're pre-launch and comparing custodians. We need fractional-share custodial
> minor accounts, programmatic account creation, ACH funding, and custody + tax
> reporting handled on your side. Our account-creation payload (custodian KYC,
> child SSN pass-through, state majority age, successor custodian) is already built.
>
> Could we get sandbox access and 20 minutes on minimums, per-account pricing,
> and onboarding timeline?
>
> [Your name] · [phone] · kiddofund.com

**What you must confirm (across all three, before you commit):**
- **Real cost — and partner pricing ≠ the retail schedule.** The BrokerChooser
  "commission-free / low fees" review is the *retail self-directed* product;
  your **Broker API partner** deal is negotiated and separate (Alpaca's own FAQ
  says so: "arrangements with authorized business partners may preclude
  commission-free trades"). Confirm minimums (if any), monthly platform fee, and
  **per-account + per-trade economics.** This is your true unit cost — the number
  that decides bootstrap vs. surgical raise.
- **Production-approval process + timeline** for a consumer app holding minors'
  money (sandbox is open; production is gated and reviewed).
- **Partner-support SLA.** Your users never talk to Alpaca — they talk to YOU. If
  Alpaca is slow on a stuck transfer or a KYC edge case, you eat the
  customer-facing fire. Their ops responsiveness is your operational risk — get
  the SLA in writing.
- **Cash-float spread — who keeps it?** Alpaca pays ~3.6% on uninvested cash. As
  a Broker API partner, confirm whether you earn/share that spread on gift money
  in the settling window. A real (if modest) revenue line — see `REVENUE_MODEL.md`.
- **Payment for order flow (PFOF).** It's how Alpaca offers commission-free /
  low partner pricing. Immaterial for 18-year buy-and-hold execution, but know
  it's there so you can answer "how does my custodian make money" honestly.
- **Build your own fee reconciliation** (you do this, not a question for them) —
  verify every Alpaca charge against the published SEC/FINRA rates so a billing
  glitch (the r/algotrading corporate-rate horror story) never silently hits your
  users or your margin. Note: those reg fees are on *sells* only — your buy-heavy
  gift flow barely touches them.
- **What YOU must register as / what compliance program YOU run** as their partner
  (AML, supervision). Your securities lawyer confirms this in tandem. (Likely
  answer: not a broker-dealer; yes, your own AML/compliance obligations.)
- **State coverage:** Alpaca UTMA excludes SC + VT (use UGMA there — UGMA is all
  50 states). Confirm the rest.
- The 18-handoff / ownership-transfer event and 1099 generation.

**The legal question that matters most is NOT broker-dealer — it's RIA.**
You almost certainly do NOT need to be a broker-dealer (you ride Alpaca's
broker-dealer license as a technology provider). But your *managed,
auto-invested ETF portfolios + 0.10% AUM fee* is the textbook definition of
**investment advice for asset-based compensation** — which likely makes you a
**Registered Investment Adviser (RIA).** Alpaca solves the brokerage/custody
side; it does NOT solve this, and the custodian cannot answer it. Your lawyer
must. Lead the attorney brief with this question, and ask for a recommendation
among three structures — each changes your cost AND your revenue model:

1. **Register as an RIA** — roughly $10–30k setup + ongoing compliance. Keeps
   the managed portfolios and the 0.10% AUM fee (the compounding revenue line)
   intact.
2. **Go self-directed** — the parent/gifter *chooses* from preset options, you
   give no "advice," and you charge a subscription/platform fee instead of an
   asset-based advisory fee. Likely avoids RIA entirely. The catch: it probably
   means dropping or re-characterizing the 0.10% AUM fee — so the fee the
   EarlyBird post-mortems loved is the very thing that may force the RIA cost.
   Weigh that consciously; don't sleepwalk into it.
3. **Use a sub-adviser / partner RIA** — someone else holds the advisory
   license and you pay them. The middle path.

**The rest of the brief** (your existing `AUM lawyer engagement brief` covers
most): broker-dealer-exempt confirmation, UTMA/state structure, and whether
you're a money transmitter (likely NOT, if funds flow Stripe→Alpaca and you
never custody the cash yourself).

**Sequence it:** Alpaca sandbox keys (you, today, 10 minutes) + the lawyer's RIA
determination (this week) are the two facts that finalize both your **cost** and
your **revenue model.** Everything else — including whether you raise at all —
waits on those two. Both are answerable in days, not months.

---

## 2. B2B2C DEMAND VALIDATION — the CAC escape (most important)

**Do NOT build the corporate dashboard.** Per your own spec, Phase 1 is a
spreadsheet and you making gift links by hand. The goal of this section is
ONE signal: that an HR team or benefits broker would actually use this.
One warm yes changes your whole story.

### The pitch (the clean angle from your spec, in your voice)

Companies already give new-baby gifts: a cash check, a $500 Amazon card, a
branded onesie. That money is gone in a week. Kiddo turns the same budget
into something that compounds for 18 years — with the company's name on it
the whole time.

The three lines that do the work:
- "Your $500 new-baby gift becomes real shares in a fund for that child —
  and it keeps growing until they turn 18."
- "Your company's note sits in that family's app every month for 18 years.
  No Amazon card does that."
- "Tax-advantaged for the family. The gift stays whole — we don't skim it."

### The offer (zero-friction, manual)

> "I'll run your next 10 new-baby gifts by hand, free. Send me the parents'
> names and emails. Each one gets a personal link, the money goes into a
> real investment fund for their kid with your company's message attached,
> and I'll show you exactly what each family sees. No software to buy, no
> setup. I just want to watch whether your people love it."

You're not selling a contract yet. You're buying a signal — and a
testimonial, and a case study, and your first reference customer.

### Who to target (highest-fit first)

| Target | Why | How to find them |
|---|---|---|
| **Benefits brokers / consultants** | One broker distributes to dozens of employers — leverage. They're always hunting for a differentiated perk to pitch. | LinkedIn: "employee benefits consultant" / "benefits broker"; local/regional firms reply faster than national. |
| **HR / People Ops at family-friendly mid-market** (200–2,000 employees) | Discrete budget owner, real pain (current new-baby gifts are bad), recurring need. | LinkedIn "Head of People" / "People Ops" at companies that publicize parental-leave / family benefits. |
| **Founders/HR at companies that already give baby gifts** | Warmest — they've already decided to spend; you're a better swap. | Ask your own network: "who do you know that gives new-parent gifts at work?" |

Start with **5–10 benefits brokers + 10 HR leaders.** That's the whole list. You need one yes.

### Cold email — HR leader (≤110 words)

> Subject: a new-baby gift for your team that's still around in 18 years
>
> Hi [Name],
>
> Quick one. When someone on your team has a baby, what do you give them?
> Most companies do a card or an Amazon gift — gone in a week.
>
> I built Kiddo: the same gift, but it buys real shares in an investment
> fund for the kid, with your company's note attached, and it grows until
> they turn 18. Tax-advantaged for the family. The full gift goes to the
> child — we don't take a cut of it.
>
> I'd love to run your next handful of new-baby gifts by hand, free, just
> to see if your parents love it. 15 minutes this week?
>
> [Your name] · kiddofund.com

### Cold email — benefits broker (≤110 words)

> Subject: a differentiated family perk you could put in front of your clients
>
> Hi [Name],
>
> You're always looking for a benefit that makes a client say "I haven't
> seen that before." Here's one.
>
> Kiddo turns a company's new-baby or milestone gift into a real,
> compounding investment fund for the employee's child — with the
> employer's name on the family's app for 18 years. Better story than a
> gift card, tax-advantaged for the family, and the full gift reaches the
> kid.
>
> I'll set up a free pilot for one of your clients by hand so you can see
> it land. Worth 15 minutes?
>
> [Your name] · kiddofund.com

### Objections you'll hear (and the honest answers)

- *"Stock for an employee's baby feels weird."* → The company picks the
  amount; the family picks the investment direction (or takes the default).
  You're funding a gift, not endorsing a stock.
- *"Tax implications?"* → Above certain thresholds it's a taxable benefit to
  the employee, deductible for the company — same as a cash gift. Say you'll
  get them a clean one-pager (and get the real tax pass before you scale).
- *"Is it set up / how much work for us?"* → For the pilot, none. You send a
  list, I do the rest by hand.

### What counts as the signal (your go-condition)

- 1+ HR team or broker says yes to a free manual pilot, AND
- the recipient parents actually fund the accounts (not just claim them), AND
- the buyer says "I'd do this again / pay for this."

If you get that from even one pilot, the `B2B_GIFTING_SPEC` Phase 2 (real
product) is justified. Until then, it stays a spreadsheet. That's the
discipline — and the cheapest possible way to test the one thing that could
make your unit economics work where EarlyBird's didn't.

---

## 3. ACQUIRER RELATIONSHIPS — from strength, starting now

EarlyBird's founder's single biggest regret: not building acquirer
relationships 6–9 months earlier, from a position of strength. You're not
selling. You're making it so that if the day ever comes, it's a warm
relationship and a soft landing — not a cold scramble at 2 months of runway.

**Who:** Acorns (they just bought EarlyBird — they're actively consolidating
your space), Greenlight, SoFi, UNest, and any family-fintech / benefits
platform. Also the brokerages (Fidelity, Schwab) whose "buy stock for family"
SEO you can't beat — they may prefer to buy the gifting layer.

**The move (not a pitch — a relationship):**
- Follow their product leads on LinkedIn. Comment substantively, occasionally.
- When you ship something real (first B2B pilot, custody live, a milestone),
  send a short "thought you'd find this interesting" note. No ask.
- Be findable as "the dedicated, family-first, respectful alternative" —
  especially to the 250K EarlyBird users Acorns alienated with the forced
  migration. That orphaned, warm audience is both your cheapest CAC and your
  proof to an acquirer that demand for a *dedicated* product is real.

### The founder-accessibility play — pour the trust floor now (it's free, and it never gets cheaper)

There are two kinds of stickiness. **Hate-stuck:** the dental/EMR software in
the r/SaaS scrape that people trash in every review but can't leave because
their data is a hostage. **Love-stuck:** the Basecamp customer who says the
product is "highly replaceable" and stays nine years anyway, because the
company is honest, responsive, and answers his email. We are structurally
*barred* from hate-stuck — the money is legally the kid's at majority, we pay
the transfer fee, we don't charge to leave (`UNIT_ECONOMICS.md`: retention is
earned, not coerced). So love-stuck is the *only* retention model we're allowed.
That makes founder-accessibility not a nice-to-have but the literal mechanism of
the moat: the thing that keeps an 18-year-old from sweeping the account to
Robinhood "because that's what their friends use" is whether the family trusts
Kiddo. Jason Fried is 25 years of proof that responsiveness alone holds
customers a competitor can't pry loose.

**Why now, specifically:** personal email scales *against* you. The trust floor
you can pour by hand at 50 families is one you can never pour again at 50,000 —
the cost only goes up. Pre-launch and solo is the cheapest this play will ever
be, and a one-person company can out-Fried anyone.

**Do it as a habit, not a feature.** Answer every email personally. Ship the fix
and tell the person who asked. This *is* the "responsive dedicated alternative"
pitch above, executed rather than claimed — and the most on-brand possible proof
of the honest-fintech / anti-dark-pattern lane in §4 ("email the founder, he
actually answers").

**The discipline:** do NOT productize it. No "Contact the Founder" button, no
support-SLA promise on the landing page. The moment it's a UI element it reads as
theater, which is exactly what this audience roasts. It's a behavior you run
quietly, never a banner you ship.

---

## 4. CREATOR / EARNED SOCIAL — the gift moment is the ad

The one distribution channel we own outright, cost ~$0, and have barely turned
on. Two facts make it ours:

**(a) The product films itself.** Lovable grew on "you watch 10 seconds of it and
go: that's new, let me try." Our equivalent is a 10-second, emotionally legible
wow: *watch a $50 birthday gift become a real share of a company the kid knows,
with a note attached, compounding until they turn 18.* Fintech almost never has a
screenshot-able emotional moment; we do — the gift moment, the count-up roll, the
Memory Book page, the "while you were away" digest are each a clip, not a
value-prop paragraph. This audience can't be *told* the value in text; they have
to *see it land.* That's also why influencer beats paid here: a written claim
doesn't carry, a 10-second clip of the moment does.

**(b) Building in public is warmer for us than for a dev tool.** The founder
narrative — "why I'm building the thing that turns gifts to kids into a future
instead of landfill" — is structurally more shareable than a product changelog,
and it doubles as recruiting and acquirer-credibility brand. Treat audience as a
company pillar, not marketing exhaust (`COMPANY_STRATEGY.md` §5).

### What to make (cheapest first)
- **The gift-moment clip.** Screen-record the real flow end to end: gifter picks
  Disney, the moment, the parent's "while you were away," the Memory Book note.
  Caption it with a real person's words, not marketing. This is the ad.
- **Founder build-in-public posts** about the occasion the loop already lives in
  (a pond from `COMPANY_STRATEGY.md` Phase 1: a bar/bat-mitzvah circuit, a church
  baby-shower network). Show the thing, never a deck.
- **Family-finance creators** — the people grandparents and values-driven parents
  already follow. One 10-second "wait, this exists?" reaction outperforms a paid
  placement. They reach the *parent* researching; pair them with the occasion
  channels that reach the *gifter,* who isn't googling anything.

### Stealable language (real people's words, from the field corpus — warmer than any tagline)
- "Instead of toys they'll forget about or break in a month."
- "Plant the seed and let it grow."
- "Set and forget so he can look at it when he's 18."
- "Family members can contribute to it."

Use their phrasing in captions. It already converted them; it isn't invented.

### Two tactics worth stealing from social-led growth (gated, post-loop-proof)
From watching Lovable's run ($0 paid to $300M ARR). Most of their "social-led
growth" doesn't port — it rested on ~9 hires who each arrived with a pre-built
audience (Anton's 54k-star repo, Elena's 100k followers) on the exact platform
their *users* live on. We have one founder and a gifter (grandma) who isn't on
LinkedIn reading build-in-public threads. So discount the headline. But two
mechanics are real and free:
- **First-2-hours velocity.** When we *do* post something (a creator's
  gift-moment clip, a real milestone), front-load engagement fast — the feed
  algorithms reward early velocity before organic reach decays. Cheap, true,
  applies the day we have anything to amplify.
- **Build the audience before the asset, on a lane only we can own.** Anton
  built credibility *years* before the product shipped. Our founder version is
  not "post growth playbooks" — it's slow build-in-public on the
  **honest-fintech / anti-dark-pattern** angle (retention-is-earned, no
  return-theater, the gifter-not-the-parent is the customer). Differentiated,
  on-brand, compounding — and a recruiting + acquirer-credibility asset, not a
  launch lever. It's a long game; start small, don't expect it to move
  funded-k.

These are *amplifiers on a proven loop*, not a substitute for one. Bee-swarming
a team of one is just posting. Sequence both behind funded-k ≥ 1.

### The discipline (do not break these for reach)
- **Two funnels, don't conflate them.** Creator and SEO roundups reach the
  *parent* researching "best kids investing app." They do NOT reach the *gifter,*
  who is stuck for a birthday present and is reached at the *occasion* (the
  shared link, the registry, the event). Measure them separately; a roundup win
  is not a gifter-loop win.
  - **App Store implementation (post-launch, when the native app lists):** Apple
    Custom Product Pages (up to 70/app, limit raised Oct 2025) are the native way
    to serve the two funnels with different first impressions — match traffic
    source → user intent → screenshots. The gifter-link / paid-social CPP leads
    with the gift moment, the count-up, the Memory Book note (the "watch it land"
    story); the organic-search CPP leads with the parent's story — real
    ownership, the at-18 handoff, no dark patterns. Free App Store config, each
    CPP separately measurable in App Analytics. NOT a launch task — gated behind
    custody + email + funded-k + a shippable Expo app. Two craft guardrails for
    the listing: (1) you are the eyes on the screenshots — generic template /
    AI-slop store art actively hurts a trust-first children's-money brand (the
    rejected sprout-glyph lesson); (2) the honesty rule below covers the store
    page too — no simulated demo balance shown as real, no projection theater in
    a screenshot.
- **Honesty over theater is the channel's credibility, not a tax.** This audience
  roasts return-theater on sight ("you're just buying what's hot," "don't expect
  18.75%/yr"). Never animate a loss as a gain, never imply outside "people" for
  the parent's own money, never show simulated demo holdings as a funded account.
  The honesty is *why* the clip is believable.
- **This is a channel candidate, still gated.** Per the spine, the Phase-1 job is
  to prove funded-k ≥ 1 AND find ONE repeatable cheap channel. This is the most
  likely "one channel" — but a clip that drives signups we can't yet fund is
  noise. Sequence it with the loop test (`LOOP_TEST_RUNSHEET.md`); don't outrun
  custody.

(Send-ready creator DM templates, the 30-second demo-video script, and UTM
conventions live in `CREATOR_OUTREACH_KIT.md`. This section is the *why
this channel* and the *what makes it ours* — the part that decides where the
founder's reps go.)

---

## The brutal footer

Every template above is the easy part. The hard part is hitting send 30
times, getting ignored 27 times, and following up anyway — Wexler ate 250
fundraising rejections; that *was* the company. No artifact, and no AI,
does that for you. The danger is letting "Claude made me a polished kit"
feel like progress, when the only thing that counts is a reply in your
inbox from a human who said yes.
