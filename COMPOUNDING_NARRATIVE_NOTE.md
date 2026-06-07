# Compounding Narrative — the honest, on-brand version (guardrail + reframe)

*2026-05-31. A durable spec for the "show people what compounding does" idea
(future-value visualization / two-bucket split / "born invested"). Written
because the seductive brainstorm version (27×/3,800× shock, regret meter,
withdrawal-shaming) is compliance-risky AND violates the anti-manipulation
discipline. This note locks the honest version + the two strategic unlocks the
brainstorm misses. Companions: `MOAT_MEMO.md`, `GOFUNDME_POSITIONING_NOTE.md`,
the revenue-cliff / kid-2.0 memory, `shared/projection.ts`, `shared/legal-copy.ts`.*

## What this actually is

NOT a calculator. It's the **emotional proof of "born invested"** — the thing
that makes the whole value prop visceral. It powers acquisition (the shock
converts), the gifter loop (the gift feels permanent), retention (the kid
doesn't cash out at 18), and the mission (financial literacy). Hero line:

> **Time is the gift. Not picking winners — time.**

That sentence sells the product, defends the self-directed / VTI-not-SPY posture,
soothes the RIA question, and teaches the kid the one thing that matters. The
headline is never "10% returns" or "$3.8M."

## 🔴 Hard guardrails (do NOT cross)

0. **The horizon peg is 65 — never raise it for headline size.** (2026-06-06,
   founder noticed Acorns projects to 68.) Every extra year on the endpoint is
   +7% on the terminal number compounding — 68 vs 65 inflates the headline
   ~22% for free, which is the same manipulation as the banned 10% rate
   through a different dial. 65 is the culturally legible retirement idiom
   (Medicare age, "retire at 65") and deliberately CONSERVATIVE vs both
   Acorns' 68 and the technically-precise alternative. If the peg ever
   changes, the only defensible destination is **67** (Social Security FRA
   for everyone born after 1960 — i.e., every kid we will ever serve),
   changed for stated accuracy reasons — never 68/69/70 for size. "Why is
   your number smaller than Acorns'?" is a question we WANT: "we round the
   horizon down, not up."

1. **7% net of fee, NEVER 10%.** The brainstorm's memorable "rules" are 10%-only
   and do not survive the swap. At Kiddo's 7%:
   | | lump-sum multiplier | $100/mo factor |
   |---|---|---|
   | 18 yr (birth→handoff) | ~3.4x | ~420x |
   | 35 yr | ~10.7x | ~1,700x |
   | 65 yr (birth→retirement) | ~80x | n/a |
   So "$50 gift" is ~$169 by 18, ~$535 by 35, ~$4,000 by 65 — all at 7%, all
   hypothetical. Use the canonical `projectFundValue` helper; never hardcode a
   "27x" rule.
2. **Always hypothetical + visible assumptions + `PROJECTION_DISCLAIMER`.** A
   specific future multiplier IS a forward-looking performance representation
   (BD/SEC/FINRA territory). The brainstorm's "No chart. No explanation. Just
   shock." is the literal opposite of what's allowed. Show the rate, "not
   guaranteed," and prefer a range (5/7/9%, which the helper supports) over a
   single magic number.
3. **Reject the manipulation.** NO regret meter, NO "$50 gift card -> $0", NO
   "are you sure you want to withdraw? this costs your child $27,000". That is
   loss-aversion guilt + a withdrawal-shaming dark pattern — the GoFundMe
   manipulation in a new costume (see `GOFUNDME_POSITIONING_NOTE.md`). Keep ONLY
   the positive frame: "time turns a small gift into something big," never "look
   what you gave up / what you're costing them."
4. **Lead with REAL, supplement with hypothetical.** The dashboard already shows
   the actual two-bucket split (gifts vs recurring vs market growth, e.g.
   "+$2,318 the market added"). Real is more credible AND uniquely ours (a
   calculator has no fund behind it). Real first, disclaimed projection second.
5. **Two-horizon honesty.** "By 18: ~$X (near, grounded). If kept growing to
   retirement: ~$Y (a 65-yr hypothetical)." The second number IS the born-invested
   / kid-2.0 story; honesty and strategy point the same way. Never headline the
   35/65-yr shock as if it were the 18-yr reality.

## The two strategic unlocks the brainstorm misses (the real value)

- **Kid View, on the child's REAL fund.** Financial literacy at the one moment it
  lands (a kid looking at money that's theirs). No retirement calculator reaches a
  child; ours can. Direct answer to "why not a free Fidelity UTMA?" Age-aware:
  wonder for the little ones, the real "leave-it-alone" math for teens.
  *(2026-06-05: this same view is also the kid-pull acquisition artifact — the
  thing a kid shows a friend, who goes home and asks. See the Kid-Pull section
  of `GIFTER_TO_PARENT_LOOP.md`. Showability is a design value for this surface;
  never a kid-facing share mechanic.)*
- **The handoff (18-21) as the retention mechanism.** The compounding view is the
  decisive don't-cash-out tool ("here's what this becomes if you don't touch it")
  = the revenue-cliff answer made visual. Highest-leverage use, period.

Everything else (marketing shock, gifter screen) is secondary. Lead with kid +
handoff.

## Keepers (reframed honest)

- **Two buckets (you + the market)** — real fund first. The "the market did most
  of it" punchline also reinforces "time, not stock-picking."
- **Flip point** (year compounding out-works contributions) — computable from the
  existing helper today.
- **"Slow, then fast"** — framed honestly: the first stretch is the quiet
  foundation; the magic needs a lifetime, which is why keeping it past 18 matters.
- **Gift-impact count-up** — animate to the 18-yr number; lifetime as optional
  "the long game" reveal.
- **Ticker-abstract projection lane** ("historical market average," not "VTI")
  while the holdings lane stays specific ("you own Disney"). Two lanes on purpose;
  matches the SPY/VTI discipline.

## Where each layer lives

| Surface | Layer |
|---|---|
| Website / marketing | the shock, at 7%, disclaimed, positive-only; real two-bucket as proof; "time is the gift" |
| Gifter confirmation | 18-yr forward arc (already built) + optional "if kept to retirement" reveal; no guilt |
| Parent dashboard / projection page | flip point + contribution-vs-growth split on the REAL fund |
| Kid View | age-aware compounding on their real fund (the differentiated, mission piece) |
| Handoff (new adult) | the retention view ("what keeping it becomes") |
| Adult-owner / parent-2.0 | the full calculator — now they're the gifter for their kid; loop closes |

## Sequencing (don't make it a rabbit hole)

Polish backlog is FROZEN; the real gate is counsel + custody. So this is mostly
**post-launch**. Two cheap, honest wins could be pulled forward IF chosen:
1. Add **flip-point + two-bucket split to the existing projection page** (uses
   `projectFundValue`; honest; no new toy).
2. The gifter **"if kept to adulthood"** number (extends the forward arc shipped
   2026-05-31).
The full kid/handoff/simulator build is a deliberate later workstream — but a
strong one: it's acquisition + gifter-loop + retention + mission + moat-vs-
substitutes all in one feature. Do NOT build the 10%/regret-meter version.
