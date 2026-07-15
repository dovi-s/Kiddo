# The Generational Loop

> Written companion to the `/generational-loop` diagram
> (`client/src/components/GenerationalLoopDiagram.tsx`). For the deck, the
> business plan, and any investor conversation. Grounded in
> `COMPANY_STRATEGY.md` and `MOAT_MEMO.md`; this doc adds no new claims.

## The one line

Most kids' apps end at eighteen. This one starts over. The market does not age
out of us. It loops back into itself.

## The picture

A parent starts a fund. The kid grows up watching it. At eighteen it becomes
theirs. One day they start one for their own child, and the people who gifted
them as a kid want to gift the new baby. Three arrows, one circle:

```
                       Parent
                    (starts the fund)
              the return  ↑      ↓  the gift
                          ·      ·
              Adult ← the handoff ← Kid
        (it becomes theirs)     (watches it grow)
```

- **The gift** (Parent to Kid). Money enters. Acquisition is near-zero CAC
  because it arrives through the gifter loop, not paid ads. Revenue starts: the
  subscription now, the 0.10% AUM line as the meter. The kid spends thirteen-plus
  years watching it grow, and the Memory Book accrues.
- **The handoff** (Kid to Adult). At eighteen the fund flips to the kid. This is
  the punchline: the single most expensive-to-acquire customer in consumer
  finance, a young adult who just came into money and is going financially active
  for the first time, handed to us with eighteen years of trust, for free, years
  before any bank would pay to reach them.
- **The return** (Adult to Parent). The adult eventually has a child and opens a
  fund, re-entering at the top. The loop closes and compounds across generations.
  No competitor has this arrow, because they all stop at eighteen. We turned the
  cliff into the prize.

## The still center

The roles rotate. The thing in the middle does not. **The fund changes hands;
the relationship does not.** An ACAT transfer moves the shares to any broker in
three days, but it cannot move the voice memos, the birthday notes, the thirteen
years of Memory Book attached to the fund. Leaving means abandoning them, not
transferring them. That is the switching cost, and it is the reason the loop
retains as well as acquires.

## Two loops, and why you must not conflate them

The diagram is powerful and easy to oversell. There are actually two loops. A
sharp investor will catch the difference, and conflating them reads as
overclaiming, which is fatal for a brand whose moat is honesty.

| | The fast loop | The generational loop |
|---|---|---|
| **Shape** | Gifter gives, then starts their own fund | Parent to Kid to Adult to Parent |
| **Length** | Months | Eighteen to forty years to close once |
| **Slide** | Traction | Vision and TAM |
| **Metric** | funded-k (does one funded fund produce one more?) | Lifetime value of a relationship that re-originates itself |
| **Status** | Measured today (`/api/admin/k-factor`) | Drawn as structure, never as proven |

The honest pitch puts them in sequence: show the **fast loop turning** as proof
the engine works, then show the **generational loop** as what that engine
compounds into. Every handoff in the circle is already a built mechanic (the
at-eighteen ownership flip exists in code), so the claim is "the rails for every
arrow are built, here is the early loop proving it turns, here is the flywheel it
becomes." Never draw the forty-year loop as proven. Draw it as the structure,
with the first arrow already measurable.

## What it answers in one image

The killer question for any kids-finance company is: *isn't this just a kids' app
that ages out of its market?* The circle is the answer. The market does not age
out. It loops back into itself. Gifting is the wedge, the eighteenth birthday is
the product, and 0.10% AUM is the meter that proves the relationship exists, not
the business. The business is the relationship: the customer acquired once, at
the most expensive moment in consumer finance, for free.

## Where it lives

- Diagram component: `client/src/components/GenerationalLoopDiagram.tsx`
- Page: `client/src/pages/GenerationalLoop.tsx` at `/generational-loop` (unlisted,
  public, same posture as `/demo`)
- Canonical strategy: `COMPANY_STRATEGY.md` (the thesis), `MOAT_MEMO.md` (the
  counter-position and the switching cost), `GTM.md` (the channels and the
  metric spine)
