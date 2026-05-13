# Hard Moments — How Kiddo Handles the Worst Days

> Status: **Strategy + architecture spec, 2026-05-13.** Sober
> document. The audience is product + ops + eng. **No code in
> this commit** — this is the spec that should exist before the
> moment that requires it, not written in panic the day after.
>
> Keystone case: child death (Chewy parallel, but bigger stakes).
> Family of cases: parent death, severe child disability, divorce,
> kid-parent estrangement, KYC failure at 18, Kiddo shutdown.
> Shared infrastructure: cascade-suspension architecture +
> memorial mode + human-touch playbook.

---

## TL;DR

At scale (thousands of families), every category of awful thing
that can happen to a family WILL happen to a Kiddo family.
A child will die. A parent will die before their child reaches
majority. A family will divorce. A teenager will become
estranged before the age-18 handoff. A kid will hit 18 with no
KYC-verifiable identity. Kiddo itself will, eventually, change
form (sold, shut down, repositioned).

Each of these is small in volume, infinite in significance to
the family it happens to. Each is a moment where Kiddo either
becomes the brand that handles tragedy with grace — earning
lifetime advocacy — or becomes the brand that ran a "happy
birthday, look how your fund grew!" notification past a child's
grave.

This spec establishes the shared infrastructure (cascade-
suspension, memorial mode, human-touch operations) and walks
through each case. The child-death case is the keystone — the
most acute, the most Chewy-shaped, the one that proves the
architecture works at the worst end of the spectrum.

**This is higher priority than the revenue specs.** Revenue
work moves the business when nothing has gone wrong. This work
defines what kind of business Kiddo is when something has.

---

## The Chewy parallel, made precise

The Chewy story is product-management canon for a reason. Pet
food on subscription. Pet dies. The customer's grief amplifies
into rage every time another bag arrives. Chewy's response:

1. Proactive cessation — they cancel before the next shipment
2. Refund the last bag — and tell the customer to give it to a
   shelter (health-code rules prevent reshipping)
3. Send flowers, with a handwritten note

Cost per incident: roughly $25. Lifetime customer value created:
priceless. The customer never buys dog food anywhere else, and
tells the story for the rest of their life.

**The Kiddo equivalent is bigger because the product is more
intimate.** A bereaved Chewy customer has lost a pet. A bereaved
Kiddo parent has lost a child AND has a Memory Book full of
voice memos, photos, and gifter notes that just became one of
the most precious objects they own.

The opportunity for grace is correspondingly bigger. The
cost-of-getting-it-wrong is correspondingly catastrophic.

---

## Why Kiddo is structurally at risk of getting this wrong

Three reasons the failure mode is acute by default:

**1. Kiddo runs cron-heavy.** Recurring contribution worker,
gifter notification worker, age-18 transition worker, mobile
push worker, post-handoff engagement worker, demo reset worker,
quarterly summary cron. Each one keeps running unless something
tells it to stop. Without a designed pause-signal, every worker
becomes a fresh wound for a grieving family.

**2. The Memory Book is dual-purpose.** Before tragedy, it's a
warm record of gifts. After tragedy, it can be the most
treasured object the family owns OR the most painful place to
visit, depending entirely on whether Kiddo handles it with care.

**3. The handoff promise is built on a future event.** "When
Emma turns 18, the fund is hers." That promise has structural
fragility — what if Emma doesn't reach 18? What if Emma can't
manage it when she does? What if she's estranged when the
moment arrives?

These three properties combine to make Kiddo a uniquely high-
stakes brand at the worst moments. The flip side: get this
right, and the moment becomes Kiddo's strongest possible
relationship signal.

---

# Part I: The keystone case — Child death

## What happens today, without intervention

This is the failure mode catalog. If a child of a Kiddo family
dies and nobody intervenes in the system:

| System | What it does | How it lands |
|---|---|---|
| Recurring contribution worker | Continues firing | Parent's bank account gets debited the week of the funeral |
| Gifter notification worker | Sends "your gift to Emma grew 4% this quarter" | Gifter (grandma) didn't know yet. Now she does, via a marketing-y email |
| Birthday reminder cron | Fires on the child's birthday | Every year, forever, unless suppressed |
| Age-18 transition worker | Eventually fires T-30, T-1, T-0 | Multi-year ticking time bomb |
| Quarterly post-handoff cron | Fires Jan/Apr/Jul/Oct | "Q2 summary: your fund grew $X" lands on the grieving parent's birthday |
| Public gift link | Still accepts gifts | Unaware gifters keep sending money to a fund that has no recipient |
| Dashboard | Animates the count-up balance for "Emma's fund" | Parent opens it to dissolve and immediately sees the animation playing |
| Kid View URL | Still works | The kid's auto-aware copy ("you own Disney!") still renders if anyone visits |
| Memory Book | Still invites new entries from gifters | Strangers and family members add entries not knowing what happened |
| Annual 1099 | Generates + emails | January arrives with a tax doc for a deceased child |

Each of these is a fresh wound. The parent has to navigate
through Settings → cancel recurring, Settings → unsubscribe,
Settings → pause gift link, Dashboard → close fund, KYC re-
verification to withdraw money. Through grief. With every flow
asking them to type the word that just changed their life.

**This is the failure mode Kiddo currently has, and it's
catastrophic the first time it happens.** Not "if." When.

## The Kiddo-grade response

Three principles, mapped to the Chewy three:

| Chewy principle | Kiddo equivalent |
|---|---|
| Proactive cessation | Cascade-suspension: one flag, every system honors it |
| Immaterial gesture | Printed Memory Book + handwritten note + funds returned without paperwork |
| Invitation back when ready | Memorial mode: the fund persists, the Memory Book preserved indefinitely, no expiry |

### Trigger: how cessation is initiated

The hardest UX problem is "how does a grieving parent tell us."
Four valid paths, in order of preference:

1. **Trusted contact / successor custodian.** The
   `successorCustodianName/Email/Relation` schema fields were
   designed for parent-death; they should be re-purposed (or
   joined by sibling fields) for "trusted contact who can
   initiate bereavement on behalf of the parent." Aunt, sibling,
   close friend — someone who can act when the parent can't.
   This is the ideal path because it doesn't require the parent
   to do anything.

2. **Email or call to support.** `hello@kiddofund.com` or a
   support line. No death certificate required for the initial
   pause — a stated bereavement is enough to suspend everything.
   The pause is fully reversible if it's an error (rare).

3. **The parent themselves.** A "report a bereavement" link in
   Settings → Account, hidden under a calm header ("If something
   has changed"). Tap leads to a one-button flow — name + relation
   to child + confirm — and we take it from there. No forms beyond
   that. No KYC. No questions.

4. **Detection from external sources.** Eventually: integration
   with state vital-records or obituary feeds for proactive
   detection. Far-future, ethically complex, opt-in only. NOT in
   the MVP. Listed for completeness.

### What suspension cascades

When `fund.bereavementState = 'active'` is set:

- All recurring contributions for the fund pause immediately
  (status='paused', pauseReason='bereavement')
- Gifter notification worker skips this fund (no quarterly,
  no milestone, no birthday emails)
- Age-18 transition worker skips this fund forever
- Post-handoff engagement worker skips this fund
- Mobile push worker skips this fund's parent for fund-specific
  notifications
- Public gift link returns a calm `/in-memoriam/[child name]`
  landing page (not 404, not an error — a memorial)
- Dashboard renders the fund in memorial mode (no count-up
  animation, calm typography, "In memory of [child]" header)
- Kid View access is suspended (URL returns memorial page)
- Memory Book stops inviting new gifter entries, but preserves
  every existing one
- Annual 1099 generation continues (legally required) but the
  email notification is suppressed; ops delivers it by post if
  needed
- Quarterly summary email is suppressed
- Any "are you sure you want to leave Kiddo+?" retention flow
  is disabled if the parent cancels billing — no friction at
  this moment

The flag is the single source of truth. Every worker filters
on it. Every public surface checks it. No system loops past
this flag without honoring it.

### Memorial mode for the fund

The fund is preserved indefinitely. Specific treatment:

- **Header copy.** "Emma's fund" becomes "In memory of Emma" —
  warm not stark, definite not euphemistic.
- **No count-up.** The balance is shown statically, not animated.
- **No "see what you could gift" CTAs.** The fund is closed to
  new gifts unless the family opts into memorial gifting (some
  families fund a scholarship, charity, or sibling's fund in
  the child's name — Kiddo can support this, but never push it).
- **No projections.** No "at 18 this would be worth $X" math.
  The future-projection surface is the cruelest possible thing
  to show a parent at this moment.
- **Memory Book is the hero.** When the family visits the fund,
  the Memory Book is what they see first. Photos, voice memos,
  gifter notes preserved. Searchable. Printable.

### Memory Book as the surviving artifact

For most bereaved families, **the Memory Book becomes the most
precious object Kiddo created for them.** Every voice memo from
a grandparent. Every birthday photo. Every gifter note from the
cousin who knew the child best. Irreplaceable, in a way the
money never was.

The Chewy-equivalent gesture is the printed Memory Book mailed
to the family, on Kiddo:

- Voice memos transcribed
- Photos printed at archival quality
- Gifter notes preserved verbatim
- Linen-bound, no Kiddo branding, no logo on the cover
- Mailed within 30 days
- Cost: ~$80–$150 per book at scale

This is the highest-impact gesture in the playbook. It's the
thing the family will keep on their bookshelf. It's the thing
that gets shown to grandkids decades later. It's Kiddo at its
truest.

### The funds, returned gracefully

UTMA legal: on a minor's death, the fund reverts to the minor's
estate, which by default flows to the parents under state-
specific rules. The legal pathway is clear; the UX should
absorb the complexity:

- A Kiddo employee handles the paperwork on the parent's
  behalf
- KYC is not re-verified (the parent already passed)
- The 0.10% AUM fee is waived for the period since death
- ACH transfer to the parent's existing bank account, no card
  required
- Stripe + DriveWealth dissolution handled server-side
- Tax documents that arrive cold in January are mailed in
  advance with a personal note explaining what they are

If the parent wants the funds to flow somewhere else (charity,
sibling's Kiddo fund, scholarship in the child's name), Kiddo
handles that routing instead.

### The human moment

The Chewy-equivalent here is the most delicate brand expression
Kiddo will ever ship. Not from a do-not-reply address. Not a
template with merge fields. A real note from a real Kiddo
employee:

> [Parent's first name],
>
> We just heard about [child's first name]. There are no right
> words. We've paused everything on Kiddo so you don't have to
> think about it — the recurring contributions, the gift link,
> the reminders. The Memory Book is safe and untouched.
>
> Whenever you're ready, even years from now, your account is
> here. Some families want to reopen the Memory Book on what
> would have been a birthday. Some never do. Both are okay.
>
> If there's anything we can do — print the Memory Book in
> linen binding for you, transfer the funds back, route the
> money to a scholarship or sibling's fund, anything — just
> reply to this. No forms.
>
> [Name from Kiddo]

What this note must NOT have:
- CTA buttons of any kind
- Branded footer / Kiddo marketing
- Survey link, NPS, feedback request
- Suggestion to "explore Kiddo Family" or any other product
- Links to Kiddo's blog, FAQ, support center
- Mention of fees, billing, account status
- "Sincerely," or any corporate sign-off — first name only

The locked Kiddo register at peak intensity: calm, real, no
marketing instinct allowed to surface.

---

# Part II: The shared infrastructure

The cascade-suspension architecture serves every case in this
spec, not just child death. Building it carefully once is the
single highest-leverage investment in this category.

## Schema additions

Single source of truth: a state field on `funds` (and a
companion field on `users` for parent-death cases).

```ts
// funds table
bereavementState: text("bereavement_state"),
// Values: null (normal) | 'active' (suspended, memorial mode) |
//   'resolved' (legally dissolved, kept for archival access)
bereavedAt: timestamp("bereaved_at"),
bereavedInitiatedByUserId: varchar("bereaved_initiated_by_user_id"),
bereavementReason: text("bereavement_reason"),
// Values: 'child_death' | 'parent_death' | 'incapacity' |
//   'estrangement' | 'kyc_blocked' | 'other'

// users table
deceasedAt: timestamp("deceased_at"),
incapacitatedAt: timestamp("incapacitated_at"),
```

The state flag is small. The behavioral surface across the app
that honors it is large but mechanical.

## The worker filter pattern

Every cron / worker gets the same filter wrapping its main loop:

```ts
const fundsToProcess = await db.select()
  .from(funds)
  .where(and(
    /* existing conditions */,
    isNull(funds.bereavementState),
  ));
```

Same shape for user-scoped workers, scoped to `users.deceasedAt
IS NULL`. The filter is the canonical pattern; new workers
inherit it without thinking.

## The email-suppression layer

`sendEmail()` in `emailDelivery.ts` grows a check:

```ts
async function shouldSuppress(message: EmailMessage): Promise<boolean> {
  // Look up recipient. If their associated fund OR user is in
  // bereavement state, suppress unless the email is explicitly
  // marked as bereavement-aware (e.g. ops outreach, legal docs).
}
```

The default behavior is suppression for any address on a
bereaved fund. Ops can override with an explicit
`bereavementSafe: true` flag on the message. Belt-and-
suspenders — workers should also skip, but the email layer is
the second line of defense.

## The "graceful degradation" page

Public-facing URLs that hit a bereaved fund:

- `/:fund` (gift checkout) → memorial page: "[Child name]'s
  fund is no longer accepting gifts. The family asks that you
  keep their memory in your heart."
- `/kid/:fundId` (Kid View) → memorial page, same shape
- `/transition/:token` (age-18 invite) → never fires for
  bereaved fund; if accessed directly: memorial page
- `/memory/:fundId` (Memory Book) → preserved access for
  authenticated family + co-parents; gifter access read-only

The memorial page is a calm, single-purpose surface. No Kiddo
marketing on it. Cream background, child's name, a line of
copy chosen by the family if they opt to, no logo. Quiet.

## Operations playbook

The first incoming bereavement signal lands at
`hello@kiddofund.com` or via the trusted-contact field. The
ops response:

1. **Within 24 hours:** Acknowledge receipt. Set
   `fund.bereavementState = 'active'`. Pause everything.
2. **Within 72 hours:** Send the human note (templated text
   above, lightly personalized). Confirm cascade-suspension
   completed. No CTA in the message.
3. **Within 14 days:** Initiate Memory Book printing if
   appropriate. Reach out to confirm shipping address only if
   the family hasn't dismissed the offer.
4. **Within 30 days:** Memory Book arrives. Tax document
   advance-notice sent if applicable.
5. **Ongoing:** No further automated outreach for 1 year.
   Manual check-in at the 1-year mark only if the family has
   opted into being remembered.

The first hire that handles this should be a senior Kiddo
employee (or the founder, at small scale). NOT entry-level
support, NOT a chatbot, NOT a templated workflow.

---

# Part III: The other hard moments

The shared infrastructure serves these cases too, with case-
specific treatment.

## Parent death

The successor-custodian schema fields already exist
(`funds.successorCustodianName`, `successorCustodianEmail`,
`successorCustodianRelation`, `successorCustodianAddedAt`). What
doesn't exist: a wired flow that USES them.

What this case needs:

- Successor custodian receives a notification when triggered
- They can take over fund management without re-creating it
- KYC re-verification happens against the successor's identity
- Funds keep growing (unlike the child-death case, the child is
  still alive — the fund's purpose continues)
- The deceased parent's role in Kiddo (co-parent access, Memory
  Book authorship) is preserved as a historical record
- Workers continue running with the successor as the new owner
  of record

This is **less acute than child death** but happens more often
(at scale, parents under 45 die at a low but non-zero rate).
The handoff to the successor is the keystone UX. Spec needed:
`PARENT_DEATH_SPEC.md` as a follow-up.

## Severe child disability / special needs

Kid reaches majority age but is unable to manage their own
finances. UTMA → special needs trust conversion is the typical
legal path. Kiddo's job:

- Detect that the standard age-18 transition shouldn't fire
  (parent flags it in advance)
- Route the legal conversion through a Kiddo-vetted special
  needs trust attorney (partnership) OR provide the family with
  a referral and clear documentation
- Memory Book and fund preservation continue
- The kid remains a customer in a different category — adult
  with a special needs trust as their custodial wrapper

This is not "bereavement" — it's a transition where the standard
handoff doesn't apply. The infrastructure overlaps (workers
need to skip the standard age-18 path) but the emotional shape
is different.

## Divorce / asset division

Co-parent access already exists. What divorce adds:

- Asset division by court order
- Possible re-titling of the fund (custodian change)
- Removal of one parent's access while preserving the other's
- Memory Book entries by the now-ex parent: preserved or
  redacted? (Default: preserved unless the kid, post-handoff,
  asks for redaction)
- Notifications about the fund: one parent may have opted out

The high-emotional-volume edge case: a parent who feels the
divorce settlement was unfair tries to drain the UTMA. UTMA
funds are legally the kid's — the parent is a custodian, not
an owner — so this is a legal issue not a Kiddo issue, but the
product should make the legal structure visible to prevent
attempts.

## Kid-parent estrangement at the age-18 handoff

The current handoff assumes the parent shares the link with
the kid. What if they won't?

- Kid hits 18, fund is legally theirs
- Parent refuses to provide the claim link
- Currently: kid has no Kiddo presence and no way to know the
  fund exists

The fix is a kid-initiated discovery path. At 18, a young
adult can:

- Visit `kiddofund.com/claim-my-fund`
- Verify identity (KYC, parent's name, their own name + DOB)
- Kiddo locates the matching fund(s) where they're the named
  recipient
- The handoff fires from the kid's side, with the parent
  notified but not required to consent

This is legally clean (the fund IS the kid's) but
architecturally unbuilt. Spec needed:
`KID_INITIATED_HANDOFF_SPEC.md`.

## KYC failure at majority age

The kid hits 18 but can't verify their identity (no SSN, name
change, ID mismatch, fraud flag). Standard handoff path stalls.

The interim: fund is the kid's legally, but Kiddo can't
release control without KYC. The kid is in limbo.

What's needed:

- A manual-review path with a Kiddo human
- Document upload (driver's license, passport, school records)
- Patience: weeks not days
- The fund continues to compound in interim mode (no fees, no
  active management changes)

Less acute than the other cases but real. Probably handled
ad-hoc until a few cases inform a formal flow.

## Kiddo shutdown

The hardest of these to design for, because it asks "what if
WE go away."

Honest answer: the funds are at DriveWealth, not Kiddo. The
brokerage relationship survives Kiddo's existence. What Kiddo
controls and would need to plan for:

- **The Memory Book.** Every voice memo, photo, gifter note.
  This is Kiddo proprietary data. A wind-down plan should
  include exporting every family's Memory Book to a portable
  archive format (HTML + media files in a zip) and emailing
  each family with their archive.
- **The custodian relationship.** Notify every family that the
  DriveWealth account is now their direct relationship.
  Provide DriveWealth's customer service handoff.
- **The data.** Per the locked discipline (`feedback_account
  _deletion_pattern`), all PII deleted on schedule.
- **The promise.** "Your kid's fund stays safe even if Kiddo
  goes away" should be true and clearly communicated.

A formal published "wind-down plan" is a trust signal in itself.
Investors and customers both care that Kiddo has thought about
this.

Not urgent today. Spec-stub for now; full doc once Kiddo's at
real scale.

---

## Brand discipline at peak intensity

Three locked rules for this entire surface, with no exceptions:

1. **No automation in the human moment.** The bereavement note,
   the special-needs handoff, the divorce response — these are
   human-written, human-sent, human-followed-up. No templates
   with merge fields beyond the first name.

2. **No CTA in any communication.** No "log in to Kiddo," no
   "explore Family plan," no "rate your experience." The
   communication is the gesture. Nothing rides alongside it.

3. **No upsell in the recovery flow.** Bereaved family gets a
   refund prompt? Family handling divorce gets a "consider
   upgrading to Family for co-parent access"? Family
   navigating special-needs sees "Kiddo Adult tier might help"?
   None of those. Ever. The recovery surface is sacred.

These three rules cost Kiddo nothing measurable in revenue
and protect everything in trust.

---

## Open questions

| Question | Why it matters |
|---|---|
| Should the printed Memory Book be opt-in or opt-out? | Some families will treasure it. Some will find it unbearable. Default: surface the offer in the note, not silently mail. Family chooses. |
| Should other gifters be notified, and by whom? | Grandma sent a quarterly gift; she should know about the death. But Kiddo shouldn't deliver that news. Parent or family controls who hears. |
| What about social media presence (Memory Book share links, public fund pages)? | Public-facing surfaces should go private immediately on bereavement. Existing share links return memorial page. |
| Does the spec handle international families? | US-only today. Other countries have different inheritance / death-certificate rules. Out of scope V1. |
| Is the trusted-contact field opt-in at fund creation? | Currently part of UTMA setup as "successor custodian" for parent-death. Could be expanded to "trusted contact for hard moments." UX question. |
| What's the bar for "I think a child has died" reports from third parties? | An estranged cousin reports a child's death — do we act? Probably need parent confirmation. Verification path needed. |

---

## Build preconditions

Three preconditions before any of this ships:

1. **A senior Kiddo employee (or founder) commits to being the
   human in the loop.** The first 10 bereavement cases must be
   handled by the same person to develop the muscle. Without
   this, the spec is theoretical.

2. **The Memory Book printing partnership is set up.** Linen-
   bound, archival-quality, no Kiddo branding, ~$80-150 per
   book at scale. Vendor selected, pricing locked.

3. **The legal pathway for UTMA dissolution is mapped per state.**
   The shape varies (most states route to parents as next of
   kin; a few have specific rules). Legal review needed before
   the first dissolution.

None of these are technical blockers. All are operational.

---

## When to come back to this spec

Five triggers:

1. **The first bereavement case happens.** This will happen. The
   spec's job is to make sure the response is handled with grace
   on day one rather than improvised in panic.
2. **The first successor-custodian-needed case happens** (parent
   death). The infrastructure built for child-death applies.
3. **A divorce settlement requires Kiddo to handle co-parent
   access removal.** Already partially possible; formalize.
4. **A kid contacts Kiddo asking "I think my parents set up a
   fund for me, how do I claim it?"** The kid-initiated handoff
   flow needs to be ready by then.
5. **Kiddo's scale crosses 10,000 active families.** At that
   scale, every category in this spec becomes statistically
   inevitable. The spec needs to be operational, not theoretical.

---

## What this spec is honest about

Three things to surface so future sessions don't read this as
purely strategic:

1. **The child-death case is the hardest. It will not happen
   "if." It will happen "when."** Statistical certainty at any
   meaningful customer base. Plan now.

2. **The architecture is small. The operations are large.**
   Cascade-suspension is maybe 200 lines of code. The human-
   touch playbook, the Memory Book printing partnership, the
   per-state UTMA-dissolution legal review — these are real
   operational investments that take months and people.

3. **Done right, this is the most important brand moment Kiddo
   will ever have.** Done badly, it's the most catastrophic.
   There's no middle ground. The Chewy customer who got
   flowers tells the story forever. The Kiddo family that
   got a "happy birthday Emma, your fund grew 4%!" email a
   week after Emma's funeral tells THAT story forever, and so
   does everyone who hears it.

---

## References

- Internal: `AGE_18_HANDOFF_SPEC.md` — the standard transition
  this spec's "kid-initiated handoff" + "severe disability"
  cases diverge from
- Internal: `GIFTER_LED_ACQUISITION_SPEC.md` — gifter
  notifications need to honor the bereavement flag
- Internal: `KIDDO_ADULT_TIER_SPEC.md` — post-handoff
  engagement worker also needs to skip bereaved funds
- Internal: `DEPLOYMENT_PLAN.md` — Kiddo-shutdown / data-export
  preparation lives near the deployment runbook
- Internal: `feedback_account_deletion_pattern` — PII handling
  in the wind-down case
- External: [Chewy bereavement story](https://www.reddit.com/r/aww/comments/9c0p7c/chewy_sends_a_handwritten_card_and_flowers_after/) — the canonical reference for why this matters
- External: [State-by-state UTMA succession rules](https://www.nolo.com/legal-encyclopedia/utma-rules-state) — basis for the legal-pathway review
