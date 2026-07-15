export const meta = {
  name: 'compliance-audit',
  description:
    'Multi-agent regulatory/legal/compliance audit for the Kiddo custodial-investing fintech: specialist auditors (securities/RIA, money-transmission/BSA, UTMA/UGMA custodial law, tax/kiddie-tax, COPPA/child-privacy, consumer-disclosure, custody-honesty) each hunt gaps against the canonical posture docs, each finding is adversarially verified, then synthesized into a memo that SPLITS "safe to fix now" from "needs a licensed human sign-off". Decision-support, NOT legal advice.',
  whenToUse:
    'Run before launch, before sending the counsel packet, after copy/flow changes that touch money/claims, or per-PR. Pass {mode:"diff",base:"main"} to scope to a branch diff, {mode:"full"} for the whole product.',
  phases: [
    { title: 'Scope' },
    { title: 'Audit' },
    { title: 'Verify' },
    { title: 'Report' },
  ],
}

// ── Inputs ──────────────────────────────────────────────────────────────────
const mode = (args && args.mode) || 'full' // 'full' | 'diff'
const base = (args && args.base) || 'main'
const scopeNote =
  mode === 'diff'
    ? `Scope: ONLY the changes in the current branch vs \`${base}\` (use git diff ${base}...HEAD), plus the surfaces they touch.`
    : `Scope: the whole product — rendered customer-facing copy (client/ + emails), the money/account model, and the posture docs.`

// Product + regulatory posture. Every auditor judges against THIS, and against
// the canonical docs named below — the audit is "does the product match the
// posture we've decided + the law," not generic compliance theater.
const CONTEXT = `
Kiddo is a US investment-gifting platform built on CUSTODIAL accounts (UTMA/UGMA) for minors,
plus personal accounts. React 19 + TS client, Express + Drizzle/Postgres server. It holds
children's PII (name, DOB, photo, and SSN on funds), parents' PII, and moves gift money via
Stripe. CRITICAL REALITY: custody/brokerage (DriveWealth/Alpaca) is a SCAFFOLD STUB — there is
NO live broker-dealer and NO real trade today; "investing" is a local-DB simulation, AUM fee is
display-only (charges nothing). Public launch is GATED on (a) a custodian going live and (b) a
narrow securities-counsel opinion.

DECIDED POSTURE (the audit checks the product against these — do not relitigate them, check
COMPLIANCE WITH them):
 - We are a SOFTWARE/experience layer on a RENTED registered custodian/BD; we intend NOT to be an
   RIA. The 0.10%/yr is framed as a PLATFORM fee (not advisory); the custodian collects+remits.
   The self-directed pivot REMOVED personalized investment recommendations (no glide-path nudges,
   no "recommended for your child" — users pick from neutral expert-designed model mixes).
 - Custody copy must be ENTITY-AGNOSTIC + CONDITIONAL: "our broker-dealer partner, Member
   FINRA/SIPC", "when investing is live", SIPC framed as future/conditional — never present-tense
   "your money is protected" while custody is a stub.
 - Gifts are IRREVOCABLE transfers to the minor's custodial account; the custodian is a fiduciary;
   funds belong to the child; ownership transfers at the state age of majority (18-21, varies).
 - P2P/holding gift funds pre-account is gated (money-transmission/MTL question) and flag-gated.

CANONICAL SOURCE-OF-TRUTH DOCS (read the relevant ones — findings MUST cite where the product
contradicts the doc OR the doc contradicts the law):
  COUNSEL_ENGAGEMENT_PACKET.md (the consolidated counsel-gated questions — the master list),
  BUSINESS_STRUCTURE.md (software-on-rented-rails thesis), ACCOUNT_MODEL.md (fees/minimums/lifecycle),
  CUSTODIAN_SOURCE_OF_TRUTH.md (custody copy rules), REAL_VS_SIMULATED.md (what's real vs simulated),
  shared/legal-copy.ts (canonical KIDDIE_TAX_NOTE + PROJECTION_DISCLAIMER), LAUNCH_CHECKLIST.md.

This is DECISION-SUPPORT to brief a licensed professional — it is NOT legal advice and cannot
clear a liability-bearing call. Every finding is tagged needsLicensedHuman so the report can split
"safe to fix in-house now" from "must go to counsel."`

const FINDINGS_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['findings'],
  properties: {
    findings: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['title', 'severity', 'area', 'location', 'issue', 'risk', 'fix', 'needsLicensedHuman', 'sourceOfTruth'],
        properties: {
          title: { type: 'string' },
          severity: { type: 'string', enum: ['blocker', 'high', 'medium', 'low'] },
          area: { type: 'string', enum: ['securities-ria', 'money-transmission', 'utma-ugma', 'tax', 'coppa-privacy', 'disclosure', 'custody-honesty'] },
          location: { type: 'string', description: 'file:line OR the rendered surface (page/email/component) where it appears' },
          issue: { type: 'string', description: 'precisely what is non-compliant or risky, vs which rule/doc' },
          risk: { type: 'string', description: 'the concrete regulatory/legal exposure if shipped as-is' },
          fix: { type: 'string', description: 'specific in-house remediation (copy change, gate, disclosure) OR what to ask counsel' },
          needsLicensedHuman: { type: 'boolean', description: 'true if this is a liability-bearing call only a licensed attorney/compliance officer can clear' },
          sourceOfTruth: { type: 'string', description: 'the doc/rule this is judged against (e.g. CUSTODIAN_SOURCE_OF_TRUTH.md §7, UTMA age-of-majority)' },
        },
      },
    },
  },
}

const VERDICT_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['isReal', 'confidence', 'reasoning', 'severityAfterReview', 'needsLicensedHuman'],
  properties: {
    isReal: { type: 'boolean', description: 'true only if this is a genuine gap given the DECIDED posture + the actual rendered product (not a relitigation of a settled decision, not already-mitigated)' },
    confidence: { type: 'string', enum: ['high', 'medium', 'low'] },
    reasoning: { type: 'string', description: 'cite the actual copy/code/doc — is it really non-compliant, or already conditional/gated/handled?' },
    severityAfterReview: { type: 'string', enum: ['blocker', 'high', 'medium', 'low', 'not-an-issue'] },
    needsLicensedHuman: { type: 'boolean' },
  },
}

// ── The team: specialist regulatory dimensions ──────────────────────────────
const DIMENSIONS = [
  { key: 'securities-ria', title: 'Securities / investment-adviser posture',
    prompt: `Judge the no-RIA posture against the actual product. Hunt anything that reads as personalized investment ADVICE or a recommendation (which would imply adviser status): "recommended for {child}", age-matched strategy nudges, glide-path auto-shifts, "best mix for you", any ranking/steering toward a specific allocation. The self-directed pivot was supposed to have removed these — find any survivors in client/, emails, demo seed, or server strategy logic. Also flag platform-fee-vs-advisory-fee framing slips (the 0.10% must read as a platform fee, never an advisory fee).` },
  { key: 'money-transmission', title: 'Money transmission / BSA / holding funds',
    prompt: `Hunt money-transmission exposure: any flow where Kiddo HOLDS or moves gift money in a way that isn't a clean pass-through to the registered custodian — especially the capture-at-intent / pledge / "hold gift funds pre-account" path (flag-gated; confirm the gate, and that copy doesn't promise holding). Check refunds, P2P/account-to-account concepts, and gift-settlement timing for "we are custodying money" implications that trigger MTL/BSA-AML obligations.` },
  { key: 'utma-ugma', title: 'UTMA / UGMA custodial-account law',
    prompt: `Judge custodial-account correctness: gifts must be framed as IRREVOCABLE transfers to the minor; the money is the CHILD'S, the custodian a fiduciary; ownership transfers at the STATE age of majority (18-21, varies — not a flat 18). Hunt copy that implies the parent owns/can reclaim the money, "you can take it back", flat-18 assumptions where state majority varies, mis-stated custodian duties, or the handoff flow contradicting irrevocability. Cross-check the age-of-majority handling (majorityAge per fund/state).` },
  { key: 'tax', title: 'Tax treatment / kiddie tax / cost basis',
    prompt: `Judge tax statements against shared/legal-copy.ts KIDDIE_TAX_NOTE and the real rules. Kiddie tax applies THROUGH 18 + full-time students under 24 (NOT "over at 18"). Hunt wrong/oversimplified tax copy on any surface (Taxes tab, FAQ, emails, projections), cost-basis/holding-period claims on sells, gift-tax-exclusion statements, the "$1/yr per $1,000" fee tax-treatment, and any projection that ignores the kiddie-tax/fee drag it claims to include.` },
  { key: 'coppa-privacy', title: 'COPPA / child privacy / data',
    prompt: `Hunt child-privacy gaps: children's PII (name, DOB, photo, voice, SSN) collection/exposure, public endpoints or /uploads serving kids' media, the account-deletion scrub leaving child PII, consent model for a service ABOUT children (parent-provided), data-retention promises, and any third-party (analytics, email) receiving child data. Judge against COPPA's child-data rules + our own privacy copy.` },
  { key: 'disclosure', title: 'Consumer disclosure / advertising honesty',
    prompt: `Hunt disclosure + UDAP/advertising gaps: projections without the PROJECTION_DISCLAIMER, returns/performance claims, "no fees ever" vs the 0.10% reality, plan/pricing contradictions, auto-renew/cancellation disclosure (dark-pattern risk), reverse-trial copy matching actual behavior, testimonials that must be honest/non-fabricated, and any guarantee/"safe"/"protected" language. Judge against FTC advertising-honesty norms + LAUNCH_CHECKLIST.` },
  { key: 'custody-honesty', title: 'Custody / SIPC / FINRA honesty (stub reality)',
    prompt: `Hunt present-tense protection claims while custody is a STUB: any "SIPC-protected / your money is protected / FINRA member" stated as CURRENT fact rather than conditional ("when investing is live", "our broker-dealer partner, Member FINRA/SIPC"). A hard-named custodian, "SEC RIA", or implying real trades happen today are all false-claim risks. Cross-check every surface against CUSTODIAN_SOURCE_OF_TRUTH.md + REAL_VS_SIMULATED.md.` },
]

// ── Run: find → adversarially verify (3 skeptics, distinct lenses) ──────────
phase('Scope')
log(`Compliance audit — ${mode === 'diff' ? `diff vs ${base}` : 'full product'}. ${DIMENSIONS.length} regulatory specialists. NOT legal advice.`)

const perDimension = await pipeline(
  DIMENSIONS,
  (d) =>
    agent(
      `You are a senior fintech compliance specialist (${d.title}). ${CONTEXT}\n\n${scopeNote}\n\nDIMENSION: ${d.title}.\n${d.prompt}\n\nRead the ACTUAL rendered copy / code / docs. Report ONLY gaps you can tie to a specific location and rule. Judge against the DECIDED posture (don't relitigate it). No generic checklist items — only real, citable gaps. If clean, return an empty findings array.`,
      { label: `audit:${d.key}`, phase: 'Audit', agentType: 'Explore', schema: FINDINGS_SCHEMA },
    ),
  (review, d) =>
    parallel(
      (review?.findings || []).map((f) => () =>
        parallel(
          ['is-it-actually-required', 'already-mitigated-or-conditional', 'severity-and-who-clears-it'].map((lens) => () =>
            agent(
              `You are an adversarial compliance reviewer. Try to REFUTE this finding via the "${lens}" lens. Read the actual copy/code at the cited location. Default to isReal=false if the product already handles it (conditional/gated/disclosed), if it relitigates a DECIDED posture, or if it isn't actually required. Decide needsLicensedHuman: is this a liability-bearing call only a licensed attorney can clear, or an in-house copy/gate fix?\n\nFINDING: ${f.title}\nAREA: ${f.area}\nLOCATION: ${f.location}\nISSUE: ${f.issue}\nRISK: ${f.risk}\nJUDGED AGAINST: ${f.sourceOfTruth}\n\n${CONTEXT}`,
              { label: `verify:${d.key}:${f.title.slice(0, 22)}`, phase: 'Verify', agentType: 'Explore', schema: VERDICT_SCHEMA },
            ),
          ),
        ).then((verdicts) => {
          const v = verdicts.filter(Boolean)
          const real = v.filter((x) => x.isReal).length
          const needsHuman = v.filter((x) => x.needsLicensedHuman).length >= 2 || f.needsLicensedHuman
          return { ...f, confirmed: real >= 2, needsLicensedHuman: needsHuman, votes: `${real}/${v.length}`, verdicts: v }
        }),
      ),
    ),
)

const confirmed = perDimension.flat().filter(Boolean).filter((f) => f && f.confirmed)

// ── Synthesize a memo that splits now-fixable from counsel-gated ────────────
phase('Report')
const order = { blocker: 0, high: 1, medium: 2, low: 3 }
confirmed.sort((a, b) => (order[a.severity] ?? 9) - (order[b.severity] ?? 9))
const fixNow = confirmed.filter((f) => !f.needsLicensedHuman)
const counselGated = confirmed.filter((f) => f.needsLicensedHuman)
log(`Confirmed ${confirmed.length} gap(s): ${fixNow.length} fixable in-house, ${counselGated.length} need a licensed human. Running red-team completeness pass.`)

const completeness = await agent(
  `You are the compliance red-team LEAD reviewing this audit for COMPLETENESS. ${CONTEXT}\n\nDimensions covered: ${DIMENSIONS.map((d) => d.title).join('; ')}.\nConfirmed gaps: ${JSON.stringify(confirmed.map((f) => ({ title: f.title, area: f.area, severity: f.severity })), null, 2)}\n\nName, specifically and citing where to look: (1) the single highest-severity regulatory gap you suspect was MISSED; (2) any blind-spot area (a regime/rule) a top-tier compliance team would cover that isn't in the dimension list; (3) whether the severity calibration looks right. If coverage looks complete, say so and why.`,
  { label: 'red-team-completeness', phase: 'Report' },
)

const report = await agent(
  `You are the lead compliance reviewer writing the final memo for the Kiddo founder. These findings survived 3-skeptic adversarial verification. Write a tight markdown DECISION MEMO: (1) one-line posture summary, (2) "Safe to fix in-house now" section — grouped by severity, each with location + the exact fix, (3) "Needs a licensed human" section — each phrased as a crisp question to bring to securities/compliance counsel, cross-referenced to COUNSEL_ENGAGEMENT_PACKET.md where it fits. Include the red-team completeness review verbatim before the caveat. End with the explicit caveat that this is decision-support, NOT legal advice. If clean, say so and note coverage.\n\nFIX-NOW (JSON):\n${JSON.stringify(fixNow, null, 2)}\n\nCOUNSEL-GATED (JSON):\n${JSON.stringify(counselGated, null, 2)}\n\nRED-TEAM COMPLETENESS REVIEW:\n${completeness}`,
  { label: 'synthesize-memo', phase: 'Report' },
)

return { confirmedCount: confirmed.length, fixNowCount: fixNow.length, counselGatedCount: counselGated.length, confirmed, completeness, report }
