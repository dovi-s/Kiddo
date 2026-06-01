# Competitor Legal & Compliance Teardown — research guide

**Purpose.** Mine the *public* legal/compliance docs of incumbents to (a) map the
regulatory floor for offering custodial investing to consumers, and (b) compress
the securities-lawyer engagement by walking in with concrete examples instead of a
blank page. This is a **research input routed through counsel** — NOT a
doc-generator.

**The one rule.** READ everything; COPY nothing into production. Their docs are
bound to *their* entity, *their* custodian, *their* RIA/BD status. A disclosure
that describes a structure Kiddo doesn't have is a **misrepresentation** (worse than
no disclosure), and legal agreements are copyrightable. Use them to learn *how the
category is built*, then have counsel author Kiddo's own.

**The contrast trap (read this first).** Some of these — Acorns above all — are
**registered RIAs** carrying fiduciary/advice obligations. Kiddo's self-directed
pivot was *designed to shed* exactly those obligations (see `ACCOUNT_MODEL.md`,
`LIFECYCLE_MONETIZATION.md`). So the most "complete-looking" compliance docs are the
ones whose obligations you're deliberately avoiding. Read RIA incumbents as a
**contrast** ("this is what we'd owe *if* we were an RIA — we chose not to be"), not
a template.

---

## 1. The competitor set + what to confirm each one *is*

Do not trust the rows below as fact — they're hypotheses to **verify from the actual
filings/agreements**. Confirming the real structure is half the value.

| Company | Hypothesized structure (VERIFY) | Why it's instructive for Kiddo |
|---|---|---|
| **Acorns** | RIA (Acorns Advisers) + BD (Acorns Securities) + bank partner; Acorns Early = UTMA | The full RIA+BD build — the *contrast* case for the self-directed pivot |
| **EarlyBird** | Gifting → UTMA via a custodian/clearing partner | Closest model to Kiddo; how they paper the **gift→account** flow + hold money |
| **Stockpile** | Fractional gift-of-stock; BD; self-directed | The 0.10%-fee / self-directed posture analog (per `project_account_model_decisions`) |
| **UNest** | UTMA app + custodian | Direct UTMA-app comparable; fee + disclosure set |
| **Greenlight** | Kids debit + investing (advisory entity + BD partner) | Multi-product minor-money compliance + COPPA posture |
| **Step** | Teen banking + investing via BD partner | Teen (near-majority) data/consent handling |
| **Fidelity Youth / Schwab / Fidelity custodial** | Incumbent brokerage UTMA/custodial | Gold-standard custodial/UTMA agreement language to benchmark against |
| **529 plans** (a state plan + Backer/Sootchy) | Tax-advantaged, use-restricted | The **contrast** for your "why not a 529?" answer (`project_positioning_distinct_voice`) |

---

## 2. What to pull per company — and where to find it

All public. Footer links are usually `/legal`, `/disclosures`, `/terms`,
`/agreements`.

1. **Form ADV (RIAs only)** → **SEC IAPD: adviserinfo.sec.gov** (search the firm).
   Parts 1, 2A (the brochure), 2B. Tells you fiduciary scope, fee schedule,
   conflicts, AUM, custody arrangement. *The single richest doc when present.*
2. **BD registration / FINRA membership** → **FINRA BrokerCheck:
   brokercheck.finra.org**. Confirms broker-dealer status + clearing relationships.
3. **Customer / Program / Advisory Agreement** (site legal page, often a PDF) — the
   master terms: who does what, custody, discretion, liability.
4. **Custodial / UTMA Account Agreement** — UTMA mechanics, custodian-of-record,
   state-of-residence majority handling, transfer-at-majority terms.
5. **Fee schedule / fee disclosure** — exact model (AUM %, flat sub, per-trade) and
   the *wording* of how it's disclosed.
6. **Privacy policy + any COPPA/children's notice** — minor PII handling, parental
   consent, deletion.
7. **SIPC / FINRA / risk disclosure block** — the standard battery + exact framing.
8. **Money-transmission / funds-handling language** — how they describe holding or
   routing customer cash before it's invested.
9. **Advertising / testimonial / performance-claim disclaimers** — how they gate
   marketing under FINRA/SEC ad rules.
10. **State MTL/MSB licensing** (if you suspect they hold funds) → **NMLS Consumer
    Access: nmlsconsumeraccess.org**.

---

## 3. The 11 structural questions to extract from each

Fill these in per company (matrix in §4). Each maps to a Kiddo launch gate (§5).

1. **Registrations** — RIA? BD (FINRA member)? Bank partner? State MTL/MSB? IA-rep
   vs introducing vs clearing?
2. **Custody** — who is the qualified custodian / clearing firm (Apex, DriveWealth,
   etc.)? Self-clearing or introduced?
3. **Account establishment** — how is the UTMA opened, who is custodian-of-record,
   how is state-of-residence majority age handled?
4. **Advice posture** — discretionary managed portfolio (RIA/fiduciary) vs
   self-directed (no advice given)? ← the RIA-shedding question.
5. **Gift / money flow** — do they capture payment *at intent*? Do they ever **hold
   funds** before an account exists? How is gift cash custodied pre-investment?
   Any MTL/MSB or FBO/escrow structure? ← your make-or-break.
6. **Fees** — model + the exact disclosure sentence(s).
7. **Minors' data** — COPPA/parental-consent mechanics; PII retention + deletion.
8. **SIPC/FINRA/risk** — exact disclosure wording; "Member FINRA/SIPC" attribution.
9. **Age-of-majority handoff** — how ownership transfers; what they tell the
   now-adult; kiddie-tax / tax-at-handoff disclosure.
10. **Minimums / cash handling** — account minimums, cash sweep, holding-tank.
11. **Advertising compliance** — performance-claim gating, testimonial rules,
    no-fabricated-results posture.

---

## 4. Comparison matrix (fill from the actual docs)

| Q → / Company ↓ | 1 Reg | 2 Custody | 3 UTMA setup | 4 Advice | 5 Money flow | 6 Fees | 7 Minor data | 8 SIPC/FINRA | 9 Handoff | 10 Min/cash | 11 Ad rules |
|---|---|---|---|---|---|---|---|---|---|---|---|
| Acorns | | | | | | | | | | | |
| EarlyBird | | | | | | | | | | | |
| Stockpile | | | | | | | | | | | |
| UNest | | | | | | | | | | | |
| Greenlight | | | | | | | | | | | |
| Step | | | | | | | | | | | |
| Fidelity/Schwab custodial | | | | | | | | | | | |
| 529 (contrast) | | | | | | | | | | | |

**Read the columns, not the rows:** where competitors *converge* = the regulatory
floor you must clear. Where they *diverge* (esp. Q1/Q4 RIA-vs-self-directed and Q5
funds-handling) = the structural fork your lawyer memo has to resolve.

---

## 5. How each finding maps to a Kiddo gate

| Teardown question | Kiddo decision it informs | Repo doc |
|---|---|---|
| Q1, Q4 (RIA vs self-directed) | The AUM/RIA structural decision (the launch blocker) | `AUM_LAWYER_ENGAGEMENT_BRIEF`, `ACCOUNT_MODEL.md` |
| Q2, Q3 (custody, UTMA setup) | Custodian vendor pick (Alpaca/DriveWealth/Apex) | `CUSTODIAN_SOURCE_OF_TRUTH.md` |
| Q5 (money flow / holding funds) | **Capture-money-at-intent** — MTL/MSB + multi-gifter BD acceptance | `LAWYER_Q_HOLDING_GIFT_FUNDS.md`, `P0-1_ADVISORY_PANEL_DECISION.md` |
| Q6 (fees) | 0.10% AUM disclosure + collection design | `AUM_FEE_COLLECTION_SPEC.md` |
| Q7 (minor data) | COPPA + child-PII-on-deletion (open security item) | `project_security_audit_*` |
| Q8 (SIPC/FINRA) | Entity-agnostic custody copy ("broker-dealer partner, Member FINRA/SIPC") | `shared/legal-copy.ts` |
| Q9 (handoff + kiddie tax) | Kiddie-tax canonical copy + the age-18 handoff flow | `shared/legal-copy.ts`, `project_legal_copy_source_of_truth` |
| Q11 (ad rules) | Kill fabricated testimonials / false "SEC RIA" claims | `project_full_expert_audit_*` |

---

## 6. Execution plan

1. **Time-box ~1 day.** Pull the §2 docs for Acorns + EarlyBird + Stockpile first
   (the closest comparables), then the rest.
2. **Fill the §4 matrix.** Note convergences (the floor) and divergences (the forks).
3. **Write a 1–2 page "where we differ and why."** For each fork (RIA-vs-self-
   directed, funds-handling, fee model), state Kiddo's intended structure and the
   open question. This is the artifact that compresses the memo.
4. **Hand §4 + the 1-pager to the securities attorney** alongside
   `LAWYER_Q_HOLDING_GIFT_FUNDS.md` + `AUM_LAWYER_ENGAGEMENT_BRIEF`. Ask, per fork:
   *"Acorns does X as an RIA; we intend self-directed Y — does that hold, and what
   disclosures does Y require?"* Reacting to examples is faster (and cheaper) for
   counsel than drafting from zero.

## 7. What NOT to do

- **Do not** paste any competitor's ToS, custodial agreement, or disclosure into
  Kiddo's product. Structural mismatch = misrepresentation; copyright risk.
- **Do not** mirror Acorns' RIA disclosures — they import the fiduciary/advice
  obligations the self-directed pivot exists to avoid.
- **Do not** copy their marketing voice or fee-bundle framing — separate, locked
  discipline (`project_positioning_distinct_voice`, the Acorns bundle-inflation
  pattern). Borrow regulatory *structure-learnings*, never the voice or the
  overselling.
- **Do not** treat this teardown as legal advice. It scopes questions for a licensed
  attorney; it does not answer them.
