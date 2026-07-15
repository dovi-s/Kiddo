# Kiddo — Loop Test Run-Sheet

*The cheapest test of the only question that decides whether there is a business.
Zero custody, zero lawyer, zero ad spend, zero new features. Just your time.*

**Owner:** founder · **Time-box:** 60 days · **Created:** 2026-06-02
**Updated:** 2026-06-12 — grandma-first k-actor + reminder-as-repeat-engine (§1, §3, §5).
**Governs:** this is the Phase-1 "prove the engine" step from `COMPANY_STRATEGY.md`.

---

## 0. The one question

**Does a funded gift generate a new funded family?** (funded-k ≥ 1.)

Everything else — design, AUM math, custody, the at-18 thesis — is downstream of
this. If the loop compounds, you have a business and 10k families is a waypoint.
If it doesn't, you have a feature that loses money to grow. You do not know which
yet, and neither does anyone else. This test is how you find out for ~$0.

**What this is NOT testing:** "will people gift to kids" (known — billions/yr).
The unknown is whether people gift *into a locked investment, through a
setup→share→gift funnel, and whether it loops.* EarlyBird had the gifting demand
and still died of the funnel + loop economics. "People gift" is true-but-
insufficient. Don't re-test it.

---

## 1. The 4 behaviors + the 5 numbers

The loop is a chain; it breaks at its weakest link. Watch all of it:

| # | Behavior | The number |
|---|---|---|
| 1 | Parent finishes setup *before any gift exists* | **Setup rate** — of families pitched, % who create a fund |
| 2 | Parent shares the link unprompted | **Share rate** — % who put it in a family chat |
| 3 | A gifter actually pays (not "aww cute") | **Gifter conversion** — % of link-viewers who put real money in ← make-or-break |
| 4 | A gift spawns a *new* family or a repeat gift | **Repeat rate** + **new-family rate** ← this is k |

**funded-k (rough) = (new families started because they saw/received a gift) ÷
(families who ran the loop).** k ≥ 1 = compounding. k ≈ 0.4 = decay (you'd have
to buy growth = EarlyBird's grave).

**The k-actor is usually the grandparent, not the parent.** The parent *seeds*
(sets up, shares); the gifter is who both funds heaviest and spawns the next fund
— most often a grandparent, who (a) gives the most, most often, for the longest
horizon, and (b) can't open a fund for their own grown kid, so spawns the next one
*laterally*: nudging their OTHER adult children to set up funds so they can gift
all the grandkids equally. So when you watch behaviors 3 and 4, watch the
**grandparents** — that's where both the dollars and the k actually live.

**"Repeat" is driven by the *reminder*, not an auto-charge.** The product's repeat
engine is the post-gift reminder (an emailed nudge to gift again — no bank link, no
auto-charge), chosen deliberately: a reminder pulls the gifter *back into the flow*
(re-exposure + a fresh chance to re-share), which is what feeds k, whereas a silent
subscription is invisible to the loop. So "repeat rate" means *did the reminder
bring them back* — and that number is only real once email is wired
(Postmark/SendGrid), which gates this whole row. See `project_recurring_engine_decision`.

---

## 2. The mechanism (no custody, no lawyer, no ads)

The product is already built. The test is "point it at real people and watch."
The clean, zero-legal version:

- Gifter sends money **directly to the parent** (Venmo/Zelle). **It never touches
  you** → no holding funds, no money-transmission question, no custodian, no
  lawyer.
- The app's job is to **capture the gift + the note + the funnel events** (who
  set up, who shared, who gave) — the Memory Book, which needs no custody.
- "Investing" is honestly stated: *"we'll invest the moment custody is live"* /
  parent holds it. Real money, real intent, real loop — just a manual back end.

**Be transparent.** Tell every family the literal truth: *"You're an early tester.
Gifts come to you via Venmo, we make gifting + remembering effortless, and we
handle the rest by hand while we build the automated version."* Never show the
*simulated* demo holdings as if they were a funded account. Keep those worlds
separate and you're completely clean.

---

## 3. Who to recruit (~10–15 families)

- **Your own network first** — that's where the loop is supposed to start anyway.
- **Bias to one high-density gifting event:** a baby shower, first birthday,
  christening, bar/bat mitzvah. One event = one kid + many gifters at once = the
  densest possible loop ignition. Run *one* by hand this month.
- **Pick it with monopoly intent (the pond rule, `COMPANY_STRATEGY.md` Phase 1,
  2026-06-06):** the event you run by hand should sit inside the COMMUNITY you'd
  want to own 100% of afterward — same criteria: cash-gifts-to-kids normative,
  socially dense (the same gifters recur across events), a calendar of upcoming
  occasions to ride. The test and Phase 1 are ONE motion: you're not just asking
  "does the loop turn," you're asking "can I own every kid-money occasion in
  this circle." The question changes who you pick.
- **Center the grandparent, not just the parent.** The seed is whoever runs the
  kid's occasions (usually a parent/mom); the *highest-signal gifter* is a
  grandparent with an imminent occasion, the means, and the motivation (genuinely
  sick of plastic toys that are landfill by July). Recruit at least a few families
  *through* a gift-ready grandparent. A grandparent who funds, then nudges their
  other adult kid to start a fund so the cousins get the same, is funded-k firing
  in one family in front of you — the densest signal you can get without waiting
  for the slow second-order spread. Don't over-index on "mom with cash": the model
  is the parent brings the kid + occasion + graph, the gifters bring the money.
- **Read signal honestly:** friends/family = a **weak "yes"** (they'll humor you)
  but a **strong "no"** (if even your own people won't, that's an answer). The
  signal that can't be faked: it **spreads past your circle** — a gift
  recipient's friend starts one unprompted. That's true-loop evidence.

---

## 4. The first-family message (ready to send)

> Hey [name] — I'm testing the very first version of Kiddo with a handful of
> families I trust, and I'd love yours to be one of them.
>
> The idea: instead of another toy that's forgotten in a month, family and
> friends gift toward [kid]'s future — real companies they'll recognize — and
> every gift becomes a little note in a "memory book" of who gave and why.
>
> It's early, so I'm doing the behind-the-scenes by hand: gifts come to you
> (Venmo), I help you put them to work, and you get the link + the memory book.
> Takes you about 2 minutes to set up. Would you try it for [kid]'s
> [birthday/shower]? Totally honest feedback is the whole point.

---

## 5. The honest gift-link framing (what gifters see)

> 🎁 A gift for [kid] that grows up with them.
> Instead of something they'll outgrow, give a share of a company they'll know —
> [Disney / their pick]. [Parent] will put it to work for [kid]'s future, and
> your note becomes part of their story.
> *Early access: send your gift to [parent] and they'll handle the rest.*

Keep it warm, keep it honest, make the *note* feel as important as the money (the
note is the Memory Book = the switching cost).

**Link hygiene (matters most for the grandparent).** Send gifters the
*card-capturing* surface — the fund/occasion gift link (`GiftCheckout`), not the
warm-promise `/give-a-gift` flow that takes no card. An older gifter is the most
likely to come away from a no-card flow feeling good and having paid **$0**, which
silently zeroes your gifter-conversion number. The real flow is already built for
her: PayPal is a first-class rail (many will click "Pay with PayPal" before they'll
type a card), a one-time gift needs **no account**, and there's no strategy picker
to stall on. The only friction wall is the *recurring* toggle's password step — so
for the test, point grandma at a **one-time** gift and let the post-gift *reminder*
carry the repeat.

---

## 6. The tracker (one screen / one spreadsheet)

| Family | Setup done? | Shared link? | # gifters who saw | # who actually paid | $ total | Repeat gifts | New families spawned |
|---|---|---|---|---|---|---|---|

Compute weekly: setup rate, share rate, **gifter conversion** (paid ÷ saw),
repeat rate, and **new-family rate** (the k numerator). Don't automate this —
hand-tracking 15 families keeps you close to the truth.

---

## 7. Kill criteria (pre-commit NOW, before you start)

Decide the walk-away line *before* you're emotionally invested, so the test stays
honest and quitting stays guilt-free:

- **Kill if:** after ~15 families, gifter conversion is **< ~25%** AND almost
  nobody repeats AND zero new families spawn beyond your direct circle.
- **Keep going if:** gifters convert *despite the manual jank*, and at least a
  couple of gifts spawn a new family or a repeat — even a faint true-loop signal
  justifies continuing.
- **Time-box: 60 days.** If there's no signal by then, stop. A clean "no" in 60
  days is a *win* — it frees you, having spent weeks not years or dollars.

Walking away on this data = smart. Walking away *before* running it = the one
genuinely dumb move (quitting before the free test that tells you whether to quit).

---

## 8. What NOT to do (the discipline)

- ❌ Don't buy ads / paid parent acquisition (that's EarlyBird's $200-CAC death).
- ❌ Don't wire a custodian, engage counsel, or spend on the regulated core.
- ❌ Don't build new features or polish. The product is done enough.
- ❌ Don't show simulated demo holdings as a real funded account.

If you're tempted to do any of these "to make the test better," you're avoiding
the test. The test is meant to be cheap and slightly janky on purpose.

---

## 9. Reading the result

- **Clear go** (conversion strong, spreads past your circle, repeats) → the load-
  bearing assumption held. *Now* the scary Phase-2 spend (custody + the one legal
  memo) is justified — chase it with conviction. Move to `COMPANY_STRATEGY.md`
  Phase 2.
- **Clear kill** (flatlines even when you smooth every bump by hand) → you have
  your answer for ~$0. Walk away clean, or pivot the wedge.
- **Muddy middle** (works but only because you pushed) → run one more cycle with
  a different occasion before deciding; ambiguity usually means the manual
  friction, not the idea, is the drag.

## 9.5 Read the result through these three lenses (test-design caveats)

A flawed *reading* of this test is the most expensive error available — it green-
lights a loop that isn't there, or kills one that is. The design is sound for a cheap
directional probe; these three caveats are how to interpret it honestly (added
2026-06-09 after an adversarial review of this run-sheet):

1. **This measures "is there a spark," NOT "k ≥ 1."** With ~15 families, funded-k is
   a ratio with a single-digit denominator — one or two spawned families swing it
   from 0.1 to 0.4, and N=15 cannot distinguish k=0.8 from k=1.2. So a **"go" means
   "a spark worth the next investment," not "the loop is proven at k≥1."** Don't let a
   good result get over-read into "raise now." The kill/keep criteria above are
   correctly qualitative for exactly this reason.

2. **The dangerous false-GO: a Venmo-to-a-friend is an *easier* ask than funding a
   real custodial account.** The §2 manual mechanism is a *gentler* proxy than the
   real funnel (a locked UTMA with KYC friction). EarlyBird had gifting demand and
   still died on the *funded*-funnel economics, so a positive proxy signal may not
   transfer. **Strongly preferred: run the capture-at-intent flow (the built
   `GIFTER_CAPTURE_AT_INTENT` Kickstarter-pledge mechanic) instead of the Venmo
   proxy** — even gated, it tests the real ask and predicts the real funnel far
   better. If you can only run the proxy, discount a positive result accordingly.

3. **The false-KILL risk: your strongest signal is your slowest.** "It spreads past
   your circle" (a second-order family starting unprompted) is the unfakeable signal —
   but it needs the loop's *second turn*, which may not appear within the 60-day box
   even if k≥1 in truth. So "no spread yet" is weak evidence of "no loop." The
   conjunctive kill criteria (§7: low conversion AND no repeats AND no spread)
   protect against this — hold the tension consciously and don't kill on the absence
   of the slowest signal alone.

**Net:** don't redesign the test — read it through these lenses, and swap the Venmo
proxy for the capture-at-intent flag if you can. That single swap materially raises
the trustworthiness of the signal.

---

*This run-sheet operationalizes the Phase-1 step in `COMPANY_STRATEGY.md`. The
goal isn't a pretty test — it's the one number (funded-k) that turns "plausible
business" into "yes" or "no." Go read it.*

*Companion: `BE_YOUR_OWN_CUSTOMER.md` — the founder's-eyes ritual that keeps the
conversion surface worth converting on (craft QA against the seeded demo) while
this field test runs against real people.*
