# B2B, in plain English (the whole idea, end to end)

> The simple version of the B2B story, written to be read start to finish by
> anyone, no jargon. The dense versions live in `B2B_GIFTING_SPEC.md`
> (corporate gifting) and `PARTNERSHIPS_WHERE_WE_STAND.md` +
> `PARTNERSHIPS_STAGE_GATES.md` (distribution). This doc is the map; those are
> the territory.

---

## The one line

Companies already give cash gifts to employees' kids (new baby, bar/bat
mitzvah). Get them to give a **Kiddo fund** instead. They pay us, and we walk
away with hundreds of new families per deal.

---

## The 4 players

- **The company** (e.g. Walmart HR). Has a budget for employee milestone gifts.
- **Kiddo.** Sells them the tool, gets a check, and gets the families.
- **The employee** (a new parent). Receives the gift, opens the fund.
- **The kid.** The long-term prize (keeps the account for life).

---

## The flow, start to finish

1. **The sale.** A Kiddo salesperson reaches Walmart HR: "You give 500
   new-parent employees a $200 gift card every year. Give them a $200 invested
   Kiddo fund instead. It grows for 18 years, and your name is on it the whole
   time."

2. **The contract.** Walmart signs and pays Kiddo:
   - a platform fee (~$10k/yr) for the dashboard and support
   - the gift money itself ($200 x 500 = $100k)
   - a small handling fee (~$5/gift = $2.5k)
   - one bank payment, quarterly or yearly.

3. **The handoff.** Walmart uploads a spreadsheet of employee names and emails.
   Kiddo's tool generates 500 personalized links. Each new parent gets an
   email: "Walmart started a $200 fund for baby Emma. Tap to open it," with a
   small "Gift from Walmart" badge.

4. **The activation.** The employee taps the link and lands on Kiddo's normal
   consumer flow (the exact one a grandma's gift uses), then opens a real fund
   for their kid (or adds it to one they already have). Now they are a Kiddo
   family. 500 of them, from one deal.

5. **The slow payoff.** Those families are in. They watch it grow. Grandma adds
   to it. Some set up $50/month. The kid keeps it into adulthood.

---

## The money, every dollar

**Today (the check):** ~$12.5k from Walmart in fees. The $100k of gift money
passes straight through to the kids' funds. Kiddo does not keep it ("the gift
stays whole").

**Over the years (the real prize):**
- 500 new families, acquired for free (Walmart paid).
- Each family is worth ~$500 over its life (subscription plus a tiny fee on the
  growing balance, for years).
- 500 x $500 = ~$250k of customer value from one deal.
- So the deal is really worth ~$262k, and about 95% of that is the families,
  not the fees.

---

## What we would build

- A **company dashboard** (separate site, e.g. business.kiddofund.com): upload a
  spreadsheet, generate links, track budget, pull records for taxes.
- The **recipient experience** is our existing consumer flow plus a "Gift from
  [Company]" badge. We already have most of this.
- **Invoicing** (companies pay by invoice, not credit card).
- That is basically it: the consumer product plus a batch tool bolted on top.

---

## When to do it

**Not now.** The whole value ("500 families = $250k") is only real once we have
proven a Kiddo family is actually worth $500: that they pay, they stay, the kid
keeps it. We have not proven that yet (no live investing, no retention data).
Enterprise sales is also a slow, different muscle (salespeople, contracts,
3 to 12 month deals) that we do not want to build while the consumer side is
unproven.

The order is: prove one family is worth a lot, then companies become a machine
that hands us 500 at a time.

---

## The catch, said once

- Family proven worth $500: B2B is a money printer (someone else pays to bring
  us customers). Green light.
- Family worth unproven: those 500 might be worth $50 each, and we ground
  through months of sales for not much. Red light.

---

## The smaller cousin (do not confuse them)

Besides selling **to** companies, there is **distribution**: getting platforms
families already use (baby registries like Babylist, party-invite apps,
churches) to show our gift link. Same goal (get families cheaply), even less
hard selling. Same rule: prove the loop first. Full status of every channel is
in `PARTNERSHIPS_WHERE_WE_STAND.md`.

---

## Bottom line

B2B is a customer-acquisition machine where someone else pays the cost of
acquiring our customers. Potentially huge, but only after we have proven a
family is worth keeping. Until then it is a distraction from the thing that
proves it.

---

# What "proving a family is worth $500" actually looks like

This is the gate. B2B unlocks when these numbers exist on real traffic. They map
to the Stage 0 / Stage 1 gates in `PARTNERSHIPS_STAGE_GATES.md`; this is the
plain-English version of why each one matters.

### Step 1: the loop has to be live at all
Right now investing is not live (custodian is a stub) and the `/give-a-gift`
path leaks before money is captured. Nothing below is measurable until those two
are real. So the literal first task is not a metric, it is: custody live + the
capture-at-intent flag flipped.

### Step 2: the four numbers that prove a family is worth something

| What it measures | Plain meaning | Target |
|---|---|---|
| **Share to first gift** | A parent shares the link, does a real gifter actually send money? | >= 20% |
| **Gift checkout completion** | A gifter starts giving, do they finish? | >= 15% |
| **Time to first gift** | How fast does a new fund get its first real gift? | <= 7 days |
| **Gifter to parent signup** | A gifter gives, do they then open a fund for their OWN kid? (this is the loop) | >= 2% |

The first three say "the gift mechanic works." The fourth says "the loop
compounds" (one family creates the next at near-zero cost). That fourth number
is the whole company.

### Step 3: the part that makes it $500, not $50
The four numbers above prove acquisition. They do not yet prove **lifetime
value**. For the "$500/family" figure to be real, we also need, over months:

- **Paid conversion.** What share of funds move to a paid plan ($3.99 or $6.99)?
- **Retention.** Do funds stay funded and active past month 1, month 6, year 1?
- **Balance growth.** Does the average balance climb (recurring gifts, grandma,
  $50/month)? The 0.10% fee only matters on a growing balance.
- **Handoff retention (the real $1B lever).** When the kid turns 18, do they
  keep the account? That is the difference between a $500 family and a lifetime
  customer acquired at birth for ~$0.

Until those exist, $500 is a hope, not a number. That is the honest reason B2B
waits.

### The honest one-liner for a B2B conversation today
We can describe the B2B machine, but we cannot yet quote a per-family value with
a straight face. The first job is the consumer loop. B2B is what we point that
proven loop at, second.
