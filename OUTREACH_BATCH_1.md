# Outreach — Batch 1 (B2B2C pilot hunt)

> Living tracker. Goal: land **one** free manual pilot to validate B2B2C
> (the CAC escape EarlyBird never pulled). Source copy: `OUTREACH_KIT.md` §2.
> Strategy context: `GTM.md` Channel 3 + `B2B_GIFTING_SPEC.md` (Phase 1 =
> manual, validate before you build). Created 2026-05-27.
>
> **How to use:** fill the tracker, send the cold email (personalize line 1),
> bump once after ~4 days, run the 15-min call off the cheat-sheet. You need
> ONE yes that clears all three signal conditions.

---

## Target tracker (goal: 5–10 brokers + 10 HR leaders)

Find them:
- **Brokers:** LinkedIn `"employee benefits consultant"` / `"benefits broker"` — prefer local/regional firms (faster replies than national). One broker fans out to dozens of employers — highest leverage.
- **HR:** LinkedIn `"Head of People"` / `"People Ops"` / `"VP People"` at 200–2,000-employee companies that publicize parental-leave / family benefits.
- **Warmest:** ask your own network — *"who do you know that gives new-parent gifts at work?"*

| # | Type | Name | Title | Company | Found via | Email / LinkedIn | Sent | Bumped | Replied? | Next step |
|---|------|------|-------|---------|-----------|------------------|------|--------|----------|-----------|
| 1 | HR | | | | | | | | | |
| 2 | HR | | | | | | | | | |
| 3 | HR | | | | | | | | | |
| 4 | HR | | | | | | | | | |
| 5 | HR | | | | | | | | | |
| 6 | Broker | | | | | | | | | |
| 7 | Broker | | | | | | | | | |
| 8 | Broker | | | | | | | | | |

---

## Cold email — HR leader

> **Subject:** a new-baby gift for your team that's still around in 18 years
>
> Hi [Name],
>
> Quick one. When someone on your team has a baby, what do you give them? Most companies do a card or an Amazon gift — gone in a week.
>
> I built Kiddo: the same gift, but it buys real shares in an investment fund for the kid, with your company's note attached, and it grows until they turn 18. Tax-advantaged for the family. The full gift goes to the child — we don't take a cut of it.
>
> I'd love to run your next handful of new-baby gifts by hand, free, just to see if your parents love it. 15 minutes this week?
>
> [Your name] · kiddofund.com

## Cold email — benefits broker

> **Subject:** a differentiated family perk you could put in front of your clients
>
> Hi [Name],
>
> You're always looking for a benefit that makes a client say "I haven't seen that before." Here's one.
>
> Kiddo turns a company's new-baby or milestone gift into a real, compounding investment fund for the employee's child — with the employer's name on the family's app for 18 years. Better story than a gift card, tax-advantaged for the family, and the full gift reaches the kid.
>
> I'll set up a free pilot for one of your clients by hand so you can see it land. Worth 15 minutes?
>
> [Your name] · kiddofund.com

## Follow-up (send ~4 days later if no reply)

> **Subject:** re: [original subject]
>
> Hi [Name] — floating this back up. The pilot's genuinely zero-effort on your side: you send me a list of names + amounts, I do the rest by hand and show you exactly what each family sees. Happy to just send a 60-second example link if that's easier than a call. — [Your name]

**Execution notes:**
- **Personalize line 1** of each cold email with one specific sentence about *their* company (e.g. "Saw [Company] just rolled out 16-week parental leave — congrats."). Templated cold emails die; one human line fixes that.
- **Disclose you're the founder** every time — it's the unfair advantage on a cold send. "I built Kiddo" already does it.

---

## The 15-minute call — cheat-sheet

**Arc: Pain → Reframe → Offer.**
1. *"When someone on your team has a baby, what do you give them today?"* (let them answer: card / Amazon / onesie → gone in a week)
2. Reframe: same budget → real invested shares for the kid → your company's name on the family's app for 18 years → tax-advantaged → **the whole gift reaches the child.**
3. Offer: *"I'll run your next 10 new-baby gifts by hand, free. Send me names + emails. No software, no setup."*

**Objections (honest answers):**
- *"Stock for an employee's baby feels weird."* → Company picks the amount; the **family** picks the investment direction (or takes the default). You're funding a gift, not endorsing a stock.
- *"Tax implications?"* → Above certain thresholds it's a taxable benefit to the employee, deductible for the company — same as a cash gift. *"I'll get you a clean one-pager."* (⚠️ get a real tax pass before scaling.)
- *"How much work for us?"* → For the pilot, none. You send a list; I do the rest.

**The signal that says it worked (go / no-go):**
1. One HR team or broker says **yes to a free manual pilot**, AND
2. the recipient parents **actually fund the accounts** (not just claim them), AND
3. the buyer says **"I'd do this again / I'd pay for this."**

All three from even one pilot → building the real product (CSV import, corporate dashboard, SSO, NET-30 invoicing per `B2B_GIFTING_SPEC.md` Phase 2) is justified. Until then it stays a spreadsheet.

---

## ⚠️ Precondition before you can deliver a pilot

The recipient parents need a real path to **fund** accounts for signal #2 to be measurable. Today demo/seed accounts are **browse-only** (no mock-payment sandbox — see `seed-dunphys.ts` header + `DUNPHY_DEMO_SPEC.md`), and live funding depends on the custody integration (Alpaca/DriveWealth) not yet wired. So a hand-run pilot needs either (a) real custody live, or (b) a documented interim "we'll fund it the moment custody clears" path the recipient understands. Resolve this before promising a company a pilot that ends in funded accounts.
