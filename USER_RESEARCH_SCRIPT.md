# User research script — validate (or kill) the personas with real evidence

> Companion to `USER_PERSONAS_AND_JTBD.md`. That doc is a hypothesis; this turns
> it into tests. Goal: put the product in front of real users, watch behavior,
> and let evidence confirm or destroy each assumption — especially the one the
> whole business rests on (a tech-wary gifter can give in under a minute, unaided).
>
> Method rules (read first):
> - **Recruit strangers in the target group, not friends.** Friends are too kind
>   and too motivated; they'll complete flows a real grandparent abandons.
> - **Task-first, think-aloud, and DO NOT HELP.** Give the goal, then stay silent.
>   Silence and hesitation are the data. The instant you "just point here," you've
>   destroyed the finding.
> - **Watch behavior, distrust opinions.** "Would you use this?" is worthless.
>   "Do this now" + watching is gold. Never ask leading questions.
> - **JTBD discovery before the product:** ask about the *last real time* they did
>   the job (gave a kid money / saved for a kid). The trigger, the struggle, what
>   they used. That surfaces the real job, not a reaction to your UI.
> - **5–8 sessions per type** is enough to see the patterns; do MORE gifters
>   (10–15) — it's the growth engine and the riskiest assumption.

---

## 1. GIFTER (do this first — it's the engine and the biggest risk)

**Recruit:** grandparents / aunts / uncles aged 55+, "not great with apps," who
have given a kid a gift in the last year. NOT anyone who knows Kiddo.

**JTBD discovery (before the product):** "Tell me about the last time you gave a
child money or a gift. What made you decide? What did you give? How'd you send it?
What did you wish were different?"

**The task (the whole ballgame):** "Your daughter texted you this link for her
daughter Emma's birthday. Give Emma a gift." Then **go silent. Start a timer.**
Watch:
- Did they expect to create an account? (Hesitate / look for login?)
- Did they understand the amount step, the "where it lands," the note/voice option?
- Did they get confused by anything (the investment-mix choice)?
- Did they finish? **How many seconds, how many taps, how many hesitations?**
- Did the "it worked + impact" confirmation actually land?

**After:** "What was that like? Anything confusing or that made you nervous? Would
you do it again next birthday — honestly?"

**KILL CRITERIA (the assumption is in trouble if):** unaided completion takes
>2 min or they abandon · they look for / expect an account · they're confused they
"have to pick stocks" · they don't trust the card step · they can't tell if it
worked. **Success looks like:** finishes unaided in ~60–90s, visibly delighted by
the note/voice + the impact number, says "oh that's nice" unprompted.

---

## 2. PARENT (the buyer + the trust gate)

**Recruit:** parents/expecting parents of kids 0–10 who don't know Kiddo.

**JTBD discovery:** "Have you set anything aside for your kid's future? Walk me
through it — or why not? What's stopped you?"

**Tasks:** (a) "You heard about this from a friend. Figure out what it is and decide
if you'd use it." (browse freely — watch what they look for: cost? safety? catch?).
(b) "Set up a fund for your child." Watch the **SSN moment** closely (do they balk?
re-read? abandon?). (c) "Tell me how this is different from just opening a free
account at Fidelity, or a 529." (the substitutes objection).

**Questions:** "Who holds the money — you, Kiddo, someone else?" (tests trust
comprehension). "What's it cost?" (tests pricing clarity). "What happens at 18?"
"What made you hesitate, if anything?"

**KILL CRITERIA:** can't articulate who holds the money / whether it's safe · the
SSN ask kills the setup · "this is just a worse 529/UTMA" with no rebuttal landing ·
confusion about free vs Plus vs Family. **Success:** "the gift-link + the memory
thing is why I'd do this over a Fidelity account," completes setup, trusts the
custody story.

---

## 3. KID (5–13, viewing)

**Recruit:** a few kids across the age bands (with parent present/consent). Keep it
short and playful.

**Tasks/questions (age-appropriate, no jargon):** "What is this?" "Is it yours?"
"What do you own?" "Did it grow?" "Who gave you stuff?" Watch for **wonder and the
sense of ownership** — that's the whole point, not financial comprehension.

**KILL CRITERIA:** bored / confused / feels talked-down-to · doesn't grasp "it's
mine." **Success:** "I own a piece of Disney?!" — genuine delight + ownership.

## 4. KID AT 18 (the handoff — the LTV moment)

**Recruit:** 18–20-year-olds (simulate the walkthrough with a demo fund).

**Tasks:** run them through the Age18Welcome walkthrough think-aloud. Then: "It's
yours now. What would you do?" **Listen for the fork:** cash-out-for-a-car (failure)
vs keep-it/curious (win). Probe the tax screen: "what did that mean?" (tests whether
the kiddie-tax + sell guidance actually landed).

**KILL CRITERIA:** "I'd take it all out" with no second thought · the tax screen
confuses or misleads them. **Success:** "huh, I'd leave most of it" + they understood
the basics without feeling dumb.

## 5. SKEPTIC (sophisticated parent / advisor-minded)

**Recruit:** finance-literate parents (or a friendly advisor). **Task:** "Poke holes
in this. Why shouldn't I just use Fidelity + a 529?" **Watch for:** do they catch
any overclaim (good if they catch none)? Does the honesty (fee-netted, "not
guaranteed," "not a broker-dealer") earn trust? **KILL:** they find a number they
don't believe. **Success:** "okay, it's not about returns — it's the gifting + the
memory thing. That's actually different."

## 6. CPA / advisor (tax season, on the family's behalf)

**Recruit:** a CPA or two. **Task:** "A client has this. Reconcile a sale for their
return." Hand them FundSnapshot + TaxDocuments + the CSV. **Watch:** can they find
cost basis, realized gains, the 1099 story, kiddie-tax handling without frustration?
**KILL:** they distrust or can't reconcile the numbers. **Success:** "this is easier
than most custodial accounts I deal with."

## 7. INSTITUTIONAL / at-scale gifter (discovery, not usability)

**Recruit:** a school PTA lead, a synagogue/church admin, an HR/benefits person, a
registry partner contact. **Interview (no product task yet):** "Do you ever
help families fund kids at scale? A baby program, a class fund, an employee benefit?
How would you want that to work? What would attribution/reporting need to look like?"
**Goal:** validate the second growth loop + the `partnerSource` primitive before
building it.

---

## How to read the results

- **The PMF cut:** you already instrument the Sean Ellis question ("how would you
  feel if you could no longer use Kiddo?"). ≥40% "very disappointed" among
  week-4-active users is the scale-or-pivot line. Pair the qualitative sessions with
  that number.
- **The loop cut:** the gifter sessions feed the k-factor thesis directly — if real
  gifters complete unaided and intend to repeat, k≥1 is plausible; if they abandon,
  no amount of parent marketing saves the model (the EarlyBird lesson).
- **Triangulate:** behavior in the task > what they say after > what they predict
  they'd do. Weight them in that order.
- **One kill is worth a hundred confirmations.** Hunt for the thing that breaks a
  persona, not validation of what you hope.

**If you run only one study, run the gifter task with 10 real strangers over 55.**
That single test tells you more about whether this business works than anything
else you could do this quarter.
