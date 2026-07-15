# Company Moments — "your companies, in the world you already live in"

> **SUPERSEDED / WRONG TURN (2026-06-09).** This news/Moment-card direction was
> built as a shell, rendered, judged, and REJECTED. A corporate product headline
> is the feed in disguise (the Schwab trap), the least relationship-driven thing
> on Kid View, and it repeated the retired gift-lesson mistake. The right answer
> is `EDUCATION_THESIS.md` (a curriculum of ~6 mental models discovered from the
> kid's own fund; the anti-portfolio-news). Kept only as the record of WHY the
> feed direction was rejected. Do not build this.

*2026-06-09. The spec for surfacing rare, curated, positive product/culture
moments about the companies a kid OWNS, on Kid View. Born from the "Schwab vs
Canva" framing: do the hard part FOR the kid (Canva), never import the
adult-investor "portfolio news" mental model (Schwab). Companions:
`KIDDO_VOICE.md` (the Form), `COMPOUNDING_NARRATIVE_NOTE.md`,
`KID_VIEW_PRINCIPLES.md` (no-gamification), `KID_VIEW_SAFETY_GATE_SPEC.md`,
[[project_stock_curation_liability]]. Founder-owned FEEL: this spec decides the
feel before any build; the founder is the eyes on the rendered result.*

---

## 0. The bar (read first)

Trillion-dollar or not worth doing. This surface is loved, intuitive, sleek,
restrained, premium, or it does not ship. Because top-tier motion is never
winged, the feel is specified HERE and judged by the founder on a rendered
shell BEFORE the feature is wired. The AI builds blind; the founder is the eyes.

## 1. The principle (one line)

> **Products and culture = the company. Prices and news = the stock.**
> Connect the kid to the company (what it makes, which they love). NEVER train
> them to watch the stock (prices/news = reactivity, anxiety, the advice line).

## 2. The unit: a Moment (never a feed)

A Moment = one TRUE, POSITIVE, kid-noticeable product/culture event about a
company the kid owns, age-reworded, tied to ownership. Examples:

> "Nintendo just made a new Mario game. You own a tiny piece of Nintendo."
> "Disney's new movie comes out Friday. A piece of it is yours."
> "Nike made the shoes everyone's wearing this year. You own a little of Nike."

Format: `{ ticker, kidHeadline, detail?, ageBand, imageUrl?, publishedAt }`.
Reuses the `COMPANY_EXPLAINERS` voice (concrete, brand-recognition, no numbers
that age, no prices). Younger/older age-band variants like the explainers.

## 3. The surface (where it lives)

NOT a new scrolling feed. A feed is an engagement mechanic, which
`KID_VIEW_PRINCIPLES` bans. Instead:

- A single, rare **Moment card** that appears in Kid View **exactly like the
  sealed-letter unlock and the at-18 celebration cards already do**
  (`KidView.tsx` ~:946 / ~:979) — quiet, warm, occasional, dismissible.
- **Silent when nothing is worthy** (the Stop / silence rule from the Form).
  Most visits show nothing. A handful of moments a year per company, max.
- Also **enriches that company's row** in "companies you own," so the moment is
  tied to the ownership the kid already sees (pull-adjacent, not pushed).
- One at a time. Dismissible. Never nags, never counts ("3 new!"), never streaks.

## 4. The motion language (founder judges this rendered)

The existing Kid View vocabulary, nothing new and nothing louder:
- Slow-in from 8px + opacity, **out-expo** ease `[0.16, 1, 0.3, 1]`, ~0.55s.
- The brand logo settles in; staggered children ~80ms apart.
- **No bounce, no confetti, no Sparkles, no parallax gimmicks.** Restraint reads
  as premium; spectacle reads as cheesy. The reveal should feel like a small
  *gift*, not a notification.
- The "ohhh" is the click of *"I own the thing I love in the world."* The two-
  bucket made growth tangible; this makes ownership tangible.

## 5. The discipline (what it REFUSES to show — this is the trillion-dollar part)

- **Products/culture only. Never prices, never "your stock moved," never news.**
- **Positive and true only.** No downgrades, lawsuits, recalls, controversies,
  scary, or ambiguous. If a company's only recent moment is negative, show
  nothing for it (silence).
- **Human-curated**, or tightly constrained to verified evergreen product facts.
  NEVER raw AI-summarized headlines to a child (hallucination + scary-content
  risk fails the bar). ~24 companies = a person can curate this.
- **Rare.** Silence is the default. Never a daily stream.
- **No engagement mechanics.** No counts, badges, streaks, "new!" nags.

## 6. Gates

- **Parent toggle, opt-in, default OFF.** Content reaching a child = the
  `KID_VIEW_SAFETY_GATE` / COPPA posture. Fund-level setting
  (`companyMomentsEnabled`). The founder mused this; it is required, not
  optional.
- **Counsel touch:** is positive product/culture content *about owned
  securities* still clean of the advice line? Same self-directed / no-RIA bucket
  as [[project_stock_curation_liability]]. Likely yes (it is about the product,
  not the security's value), but confirm.

## 7. Data model

- A curated editorial table `company_moments` (ticker, kid_headline, detail,
  age_band, image_url, published_at, active). Hand-curated via a small admin
  editorial surface (mirrors the stock-requests admin pattern). NOT an ingest
  pipeline.
- Kid-view endpoint surfaces the most relevant recent active moment(s) for the
  fund's actual holdings, gated on `companyMomentsEnabled`.

## 8. Build phases (wave-2; backlog is frozen for launch)

1. **Spec approval** (this doc) — founder signs off on substance + feel.
2. **Motion/structure shell** — the Moment card in Kid View with the motion
   language + placeholder content. Founder judges the FEEL *rendered*. Iterate.
3. **Curation backend** — `company_moments` table + admin editorial UI + the
   fund-level parent toggle.
4. **Wire it** — surfacing logic against real holdings, age-rewording, the
   holdings-row enrichment.
5. **Counsel touch** (Section 6) before it goes live.

This is NOT a launch item. It is the highest-leverage "make Kid View magic"
wave-2 feature: it turns "you own a piece of Disney" from a static fact into a
living relationship, on the exact thesis (companies they know and love), without
a single landmine — IF it obeys Section 5.
