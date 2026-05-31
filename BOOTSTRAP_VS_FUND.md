# Bootstrap vs. Fund — Kora's capital + operating strategy

> Composite decision memo. Synthesized 2026-05-31 from three bootstrapper
> interviews (Patrick Campbell / ProfitWell, Ben Chestnut / MailChimp, and a
> bootstrapped platform/ecosystem founder) mapped onto Kora's real situation.
> Sits beside `MOAT_MEMO.md`, `LIFECYCLE_MONETIZATION.md`, `ACCOUNT_MODEL.md`,
> `LAUNCH_CHECKLIST.md`.

---

## 0. The decision being deferred (founder-only call)

Is Kora a **cash-flow business** — a great ~$10M/yr company, raise nothing, own
it, run it your way — or a **venture-scale platform swing** (the
kid → adult → parent lifetime platform: banking, Roth, private markets)?

**Both are legitimate. Drifting between them by accident is not.** Patrick's
regret was bootstrapping too long, getting hooked on efficiency, and leaving a
billion on the table because "we're efficient" became the identity by default.
Ben's peace came from *choosing* the own-it path on purpose and never wavering.
The failure mode is not picking.

**Say it out loud, because it changes whether / when / how much you raise.**

---

## 1. The venture-scale math (run it honestly)

- AUM at **0.10%** → **$1B/yr revenue needs ~$1 trillion in AUM.** Subs
  ($29–59/yr) are real but small.
- So **"gift investments to kids" alone is NOT venture scale.** By the
  billion-ARR test it's a beautiful cash-flow business.
- The **only** billion-dollar story is the lifetime platform already written
  into the memory + `LIFECYCLE_MONETIZATION.md` (kid-2.0 ladder, parent-2.0
  re-subscription, AUM-as-annuity, private-markets north star). Everything else
  is the on-ramp to it.

**Implication:** if the ambition is the platform, the custodial-gifting product
is the *wedge*, not the business. Fund the wedge from cash flow / a small raise;
the venture raise is justified by the platform, after the wedge proves the loop.

---

## 2. Recommended path: the hybrid

The three founders agree on the **sequence** even though they disagree on the
endpoint. Their endpoint was set by cheap, unregulated categories (email, SaaS,
web tooling). **Kora's category — custody / securities — is capital-hungry and
legally gated in a way none of theirs was.** So the honest composite:

> **Be Ben / the platform founder on product, growth, support, and partner
> relationships. Be Patrick on capital.**
>
> Bootstrap the loop + the customer obsession to PMF (proof the gifter loop
> compounds, **k ≥ 1**, with a handful of *real funded* funds). *Then* take
> **only strategic** money — custody, regulatory, distribution partners — for
> the regulated core you cannot bootstrap. Don't take a check that isn't
> strategic ("only say yes when it makes sense"). And if the ambition is the
> platform, when you raise, **raise for the fences — don't under-raise** (the
> ProfitWell regret).

---

## 3. What to bootstrap vs. what to fund

| Bootstrap (Ben / platform-founder energy) | Fund (Patrick energy, post-PMF) |
|---|---|
| The gifter loop + the product | Custody / brokerage build-out at scale |
| Customer obsession + support (see §5) | Regulatory / legal / compliance runway |
| Cheap distribution experiments (creators, content, the demo) | Distribution partnerships that need capital to land |
| Partner *relationships* (Babylist etc., relationship-first) | The lifetime-platform expansion (banking, Roth) |
| Brand / a shareable gift artifact | — |

---

## 4. The partner / platform layer is Act 2, not Act 1

The platform founder's 10x unlock was the **partner/integration layer that made
other people bring him users** (app store, ~50 integrations, partners who wanted
in). Kora's version: **gift occasions + distribution channels plugging into the
loop** — a Babylist registry, an employer new-parent benefit, a hospital newborn
packet, a school fundraiser. The `partnerSource` primitive *is* the integration
API; see `project_babylist_integration_plan` + the partner-channel map.

**Sequencing caution (the important part):** his platform worked because the
*core already had PMF + users* — partners wanted in because there was an
audience. **Kora has zero customers.** Partners plug into traction; they don't
manufacture it. `partnerSource` is correctly gated behind custody + legal.
**Resist BD before the loop proves k ≥ 1.** A Babylist deal on top of a loop
that doesn't compound just imports churn faster.

---

## 5. Support is the moat, not a cost center

The platform founder had everyone do support from day one to stay close to where
the product hurts. Pre-launch and near-solo, **you are support — and it's the
research engine, not a chore.** This is also Patrick's "10 customer
conversations on the whiteboard," for free: every gifter/parent support touch is
a research conversation. For an emotionally-loaded product (someone investing in
a child they love) **support quality *is* the brand and the moat** — a
grandparent who hits a wall funding a gift and gets a warm, fast, human reply is
a relationship; a cold one is churn. Do all of it yourself until it physically
can't scale; mine every ticket for the product gap it reveals.

---

## 6. AUM is the value metric — treat it as the engine

Patrick's pound-for-pound #1 lever is the **value metric**: a % that auto-expands
as value grows, downgrades gracefully, needs no reselling. **AUM on a kid's fund
compounding ~18 years is the platonic value metric.** Today AUM is
display-only / uncollected and the flat sub is the live revenue
(`project_aum_fee_display_only`). Reframe: **the sub is the near-term lever; AUM
is the engine.** This also shrinks the revenue-cliff-at-18 worry
(`project_revenue_cliff_at_majority`) — the *sub* cliffs at majority, but the
value metric keeps compounding. (Captured as `project_aum_is_primary_value_metric`.)

---

## 7. The mission metric, and the honest mirror

Patrick's tempo framework: define the **mission metric**, then check every
work-block against "is this moving it." For pre-launch Kora the mission metric is
**funded-k** (does the loop compound with real, funded funds).

Three founders, three phrasings, one verdict: *"build something useful"* (the
logo doesn't matter) / *"I invent new things to feel valuable and it wreaks
havoc"* / *"you're always polishing, you don't ship."* The work that moves
funded-k is: the loop working end-to-end, **live custody**, the legal/AUM memo,
and **one real parent funding a real fund** — not chart dots, loading skeletons,
or copy variants. Polish has GTM/demo value at the margin; the ratio is the
thing to watch. **Default to shipping a piece of the useful core over polishing
an existing one.**

---

## 8. The one open question (only the founder answers)

**Cash-flow business or platform swing?** Write the answer here when it's made:

> _[decision + date]_

Until then, the operating defaults above hold either way (bootstrap to PMF,
support-as-moat, AUM-as-engine, partners-after-k≥1). The answer only changes the
*capital* decision — and it's yours, not derivable from the code.
