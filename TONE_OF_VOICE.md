# Kiddo Tone of Voice

One source of truth for how Kiddo writes. Consolidates the 26 locked
copy/voice rules scattered across the memory files into a single
reference so any future writer (designer, engineer, AI agent, contractor)
can ship copy that sounds like Kiddo on the first try.

This doc is the rule layer. Pattern catalogs (toast register, button
copy, notification routing) live in their own SPECs and link out here
for the voice rules.

---

## The one principle

**Does this feel like a gift, or a bank statement?**

Every word in the product runs through that question. Bank-statement
phrasing gets cut. Gift phrasing gets amplified. A fee disclosure can be
a gift if it reads like a friend explaining; a milestone celebration can
be a bank statement if it reads like an automated email.

The principle works because Kiddo is the only fintech where the customer
is buying a feeling (their kid will be okay) more than a service
(custodial brokerage). Read every screen through "would a parent forward
this to their partner with pride, or close it with a sigh."

---

## Banned constructions

Hard rules. No exceptions in user-facing copy.

### 1. No em dashes (`—`)
**Locked:** `feedback_no_emdash.md`. Use periods, colons, parens, or
commas. Em dashes read as AI-generated polish because the most common
LLM training data is op-ed prose. Kiddo copy reads warmer with periods.

Bad: "Your gift is on its way — usually 1-2 business days."
Good: "Your gift is on its way. Usually 1 to 2 business days."

Em dashes inside code comments are fine. Em dashes in JSX comments are
fine. The rule is user-facing copy only.

### 2. Never use "contribute" in UI copy
**Locked:** `feedback_no_contribute_word.md`. "Contribute" is what 401(k)
forms say. Kiddo says "Add to" or "Invest in."

Bad: "Contribute $25 to Emma's fund."
Good: "Add $25 to Emma's fund." or "Invest $25 in Emma's fund."

Internal DB column names, function names, code identifiers are fine.
The rule is UI strings only.

### 3. Never headline Free as "$0 forever" / "Always free"
**Locked in MEMORY.md** under Fee Architecture. The 0.10% AUM fee makes
those phrasings technically misleading. Approved instead:
- "$0 per month"
- "$0 / per month" with the AUM line as a feature
- "Free to start"
- "No monthly fee"

The "Free forever" string on the gifter dashboard is fine because gifters
genuinely pay nothing.

### 4. No marketing-teaser quotes around feature names
**Locked:** `feedback_no_marketing_teaser_quotes.md`. Feature names in
running prose go in plain text, not "in quotes" or 'in apostrophes.'
Quotes around a noun read like the writer is hedging or being arch about
their own product.

### 5. Never green-wash a loss
**Locked:** `feedback_no_greenwashing_losses.md`. If Emma's fund is down,
the number is red and the framing acknowledges it. No "you're down but
the long-term trend is up" cope. Numbers tell the truth; the surrounding
copy can give context without softening the number.

### 6. No manufactured antithesis ("It's not X. It's Y.")
**Locked 2026-06-11 (founder):** `feedback_no_manufactured_antithesis.md`. The
strongest AI tell after em dashes. The model sets up a wrong answer nobody asked
for, then reveals the right one, to fake earned insight. A human just says the
thing. Delete the setup.

Bad: "It is not a savings bond your grandparents would recognize. It is a real
investment in companies a kid actually knows."
Good: "It is real stocks in companies the kid already knows."

The whole family is banned, not just that one phrasing:
- Manufactured antithesis: "not X, it's Y", "the opposite of", "isn't another".
- Anaphora lists: three-plus sentences opening the same way ("It compounds. It
  is personal. It models something.").
- Rule-of-three escalation for flourish: "A louder one. A bigger one."
- False-binary setup then pivot: "every list says X... there is a better answer."
- Aphoristic closers: "nowhere to go but up", "is still there."
- Signpost throat-clearing: "Here is the honest answer.", "Here is the math, plainly."

This is not lint-catchable (it is structure, not a token), so it is an editorial
rule, caught by reading. **Founder call 2026-06-11: scorched earth.** Kill the
structure EVERYWHERE, including "good" brand lines and honest objection-rebuttals
("a story, not just a statement", "It is not a ledger. It is a story.", "A UTMA
isn't a gimmick. It's..."). Rewrite every instance as a plain declarative. The
structure itself is the tell; do not preserve it even when the contrast is true.
Test: delete the setup. If the sentence still lands, the setup was the tell, and
the setup goes.

---

## Required distinctions

Words Kiddo treats with strict precision.

### "Share" and "Gift" are not synonyms
**Locked:** `feedback_share_vs_gift_distinction.md`.

- **Share** = distribute a link or info.
- **Gift** = the money or the transaction.

The parent shares the gift link. The gifter gives a gift. Compound
usage like "Share Emma's gift link" is correct when both meanings apply.
"Share a gift" and "Gift a share" are wrong.

### "Recurring investments" and "Auto-invest"
**Locked in MEMORY.md** under Recurring Investments.
- User-facing: "Recurring investments" (label), "Recurring investment"
  (card), "Growing automatically" (section header).
- Internal code: `auto_invest`, `parentContributions`, etc. fine.
- Never use "auto-invest" in user-facing copy.

### "Occasion" not "Event" in user-facing copy
**Locked 2026-05-13 in MEMORY.md** under Locked Copy Rules. Display only.
- User-facing: "occasion", "1 active occasion at a time", "Kiddo Occasions"
- Internal code: `EventCreate`, `events` table, `useEvents` hook all
  stay. Display strings get the swap.

### "Anonymous" as explicit flag, not inferred from string patterns
**Locked:** `feedback_anonymous_as_explicit_flag.md`. Privacy choices
belong as explicit boolean fields. Never infer anonymous from a blank
name or a generic fallback string.

### Tier name canonicalization
- "Kiddo+" (not "Kiddo Plus", not "Kora+", not "Starter")
- "Kiddo Family" (not "Kora Family")
- "Kid View" (not "Kid View Lite" / "Kid View Full")
- "Memory Book" (not "Timeline")

Stripe route lookup searches all historical names so existing records
still resolve, but new copy uses only the canonical form.

---

## Voice register

Apple Settings as the default. Love marks at specific moments.

### Default: Apple Settings calm
Most of the app is ambient chrome. Settings, account screens, lists,
notifications, error states, navigation, balance displays. The register
here is iOS Settings: minimal, factual, no tagline-feel, no exclamation
points, no marketing tone. Information dense, emotionally quiet.

**Why:** taglined copy on every screen becomes wallpaper. It fires too
often, stops carrying meaning, and breaks the "Mario star" test (the
moments that should feel rare lose their weight when the whole app is
already shouting).

### Love mark moments
Specific contextual moments earn warmth. The 🌱 sprout glyph fires here.
Animation gets a spring curve instead of a linear one. The page-turn
animation on Memory Book opens. The wax seal on a parent letter sealed
until 18. The confirmation screen after a first gift.

**Locked:** `project_confirmation_screen_pattern.md` carries the
canonical confirmation register ("gifts that actually last 🌱"). Don't
introduce new love-mark surfaces without checking that one first.

### Gentle nudge register
**Locked:** `feedback_gentle_nudge_pattern.md`. Lifecycle prompts (event
ready to share, no gift in 14 days, etc.) use a short, observational
voice. Not "Try a reminder message!" but "Your event is live."

### Toast pattern
**Locked:** `feedback_toast_pattern_locked.md`. Two variants only.
- **Saved pill** (1200ms, dark, rounded-full, Check icon): "Link copied",
  "Saved", "Sent". For load-bearing nothing-to-read confirmations.
- **Default card**: for descriptions the user genuinely needs to read
  (PIN reminders, UTMA explainers, error messages, payment failures).

Rule of thumb: if the description starts "Paste anywhere..." or
"Share this link..." it's stating the obvious, use the pill.

---

## Structural rules

Things that look like copy questions but are really information-design
questions.

### Structure does not equal behavior
**Locked:** `feedback_structure_vs_behavior.md`. When research shows users
do X, the right product response is usually NOT a structured UI for X.
Either get out of the way (the parent decides themselves), or use a
light prompt. The canonical bad example was the 8-tag lesson picker
(built and killed in one session).

### "VIEWING never gated; AUTHORING is the Plus differential"
**Locked in MEMORY.md** under Subscription Plans. Consumption-side
features (Kid View, projections page, Memory Book viewing, notifications)
are free across all tiers. Authoring-side features (parent-attached
Memory Book media, recurring investments, custom stock mix, co-parent
invite) are the Plus differential.

If you're writing copy that gates a viewing surface, you're probably
writing the wrong gate. Re-read this rule first.

### Form field a11y is locked
**Locked:** `feedback_form_field_a11y_pattern.md`. Every input/textarea/
select needs four things: `id`, `name`, label (htmlFor or sr-only),
autoComplete. Page-scoped id prefixes ("account-", "login-"). Standard
autoComplete tokens (current-password vs new-password).

### Dismissal storage must be a Set, not a single value
**Locked:** `feedback_dismissal_storage_pattern.md`. One-shot UI
dismissals (toasts, banners, nudges) need a Set in localStorage with
cross-tab `storage`-event resync.

---

## Notifications + activity

### Notification routing
**Locked:** `feedback_notification_routing_and_copy.md`. Every bell
notification's destination must match the verb in its description. Copy
must be concrete ("Your event is live") not system-speak ("Try a
reminder message").

### Notifications panel scope rules
Per the 2026-05-13 ship: action items always cross-fund; informational
notifications follow page scope. Bell badge count includes action items
("`N to do · M new · scope`" in the header). Past-notifications toggle
collapses read history.

### Activity is the reference layer
The Activity page is the canonical full ledger (search, filter, CSV
export). The bell is the triage layer (what changed). The two should
not duplicate each other.

---

## Memory Book

### Memory Book voice
The Memory Book is the warmest surface in the app. Two distinct kinds
of entries, two slightly different registers.

- **Gifter-attached media** (photo/video/voice on gifts): the gifter's
  voice, displayed as-is. Always free, all tiers. The retention moat
  per the locked Memory Book tier policy.
- **Parent-authored entries**: the parent talking to their future kid.
  Text-only on Free; media unlocks with Plus. Letters can be sealed
  until age 18 (wax seal UI), opening with a page-turn animation at the
  moment of majority.

### "From: Anonymous parent" is the cost of incomplete profile
A real action item lives at `profile_incomplete` (see action items spec
in `server/actionItems.ts`). Memory Book entries without the parent's
first name display as "Anonymous parent" on the kid's age-18 view. The
nudge copy: "Without it, your notes to your child sign as 'Anonymous
parent' on their 18th-birthday view." Concrete, specific, no AI-slop.

---

## The no-AI-slop rule

**Locked:** `feedback_no_ai_slop.md`. This is the meta-rule that catches
violations the other rules miss.

### Patterns that signal slop

- Mantra repetition. Sentences ending "Always." over and over.
- "Applied to Kiddo. Applied to Emma. Applied to [thing]."
- "Bottom line, in one paragraph:" as a section header.
- "P.S. ... P.P.S. ..." closers.
- "Build something so beautiful that designers want to replicate it."
- Hagiographic comparisons ("That's not a design system. That's a love
  story. Told in pixels.").
- The negation-triplet-into-reveal ("That is not micro-investing. That is
  not a savings account. That is investment gifting. And no one else has
  built it."). Same animal as the hagiographic one — stacked short negations
  as a drumroll, then a triumphant turn. Reads like a keynote slide. Keep the
  claim, lose the cadence: say it in one plain sentence a person would say.
- Every paragraph closing with the same emoji.
- Listing 5 items as "perfect" with no actual analysis.

### How to recognize before shipping

Read the draft aloud. If it sounds like a LinkedIn motivational post,
it's slop. If it sounds like a thoughtful friend writing you an email,
it's Kiddo.

### Cross-reference test

Run the draft through the locked banned constructions above. AI-generated
copy will have em dashes, "always" closures, and "contribute" within
the first three paragraphs almost without fail.

---

## How to test new copy

Five-second self-check before shipping any new string:

1. **Bank statement or gift?** Read it aloud. Which one does it sound
   like? If neither feels right, it's probably slop.
2. **Em dash check.** Search the file for `—`. Zero in user-facing
   strings.
3. **Word ban check.** Search for "contribute" and "always free" and
   "forever". Zero matches in display copy.
4. **Distinction check.** If the string uses "share" or "gift", check
   the share-vs-gift distinction. If it uses "occasion" or "event",
   check the display-only swap.
5. **Mario star test.** Is this string about to fire on every screen,
   or only at a specific moment? If it's ambient chrome, register is
   calm. If it's a love-mark moment, register is warm.

If you can answer all five in under a minute, the copy is likely on
register.
