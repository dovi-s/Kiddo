export const meta = {
  name: 'finance-audit',
  description:
    'Multi-agent financial-correctness audit for the Kiddo fintech: specialist auditors (money math, AUM fee, projection math, tax math, strategy/allocation, real-vs-simulated honesty, edge cases) RE-COMPUTE the numbers against the real code, each finding is adversarially verified (recompute / does-the-code-do-this / materiality), then synthesized into a triaged report. Catches "the label says X but the math does Y" drift.',
  whenToUse:
    'Run before launch, after any change to fees/strategy/projection/tax/settlement, or per-PR. Pass {mode:"diff",base:"main"} to scope to a branch diff, {mode:"full"} for the whole money layer.',
  phases: [
    { title: 'Scope' },
    { title: 'Audit' },
    { title: 'Verify' },
    { title: 'Report' },
  ],
}

const mode = (args && args.mode) || 'full'
const base = (args && args.base) || 'main'
const scopeNote =
  mode === 'diff'
    ? `Scope: ONLY the changes in the current branch vs \`${base}\` (git diff ${base}...HEAD) + the money math they touch.`
    : `Scope: the whole money layer — fee/AUM, strategy/allocation, projections, tax, gift settlement, and every customer-facing number derived from them.`

const CONTEXT = `
Kiddo is a US custodial-UTMA investment-gifting fintech (React 19 + TS client, Express +
Drizzle/Postgres server). Money/number surfaces: shared/strategy.ts (tier labels/emoji),
client/src/pages/Settings.tsx (strategy presets, "Today vs target" drift, projection ranges),
server/fundStrategyConfig.ts (ETF allowlist, custom allocations, normalize/validate),
server/webhookHandlers.ts (gift settlement, contribution-based rebalancing computeContributionAllocations,
allocations), shared/projection.ts (projectFundValue), the Taxes tab, the AUM fee estimator.

CRITICAL REALITIES the audit must respect (a finding that ignores these is a false positive):
 - Custody is a SCAFFOLD STUB: holdings are a LOCAL SIMULATION, no broker, no real trade/order.
   Prices are real (Yahoo chart + Finnhub/Alpha-Vantage quotes); holdings/settlement are simulated.
 - The 0.10%/yr AUM fee is DISPLAY-ONLY today — there is NO fee transaction/worker/cron; it's an
   estimator + "(est.)" label. Collection design is in AUM_FEE_COLLECTION_SPEC.md (cash-first,
   never force a taxable share-sale). So "fee isn't collected" is EXPECTED, not a bug.
 - Drizzle decimals are STRINGS — math that treats them as numbers without parseFloat is a real bug.
 - "We don't sell to rebalance" — rebalancing is contribution-weighted toward underweight tickers
   (computeContributionAllocations), NOT by selling. A finding claiming we auto-sell is wrong.
 - Self-directed: model presets are VTI/VXUS/BND only (Growth 62/28/10=90/10, Balanced 50/25/25=75/25,
   Conservative 42/18/40=60/40). "stocks/bonds %" is DERIVED (100 - bond weights), not hardcoded.

CANONICAL DOCS: AUM_FEE_COLLECTION_SPEC.md, REAL_VS_SIMULATED.md, ACCOUNT_MODEL.md,
shared/legal-copy.ts (KIDDIE_TAX_NOTE, PROJECTION_DISCLAIMER), BUSINESS_STRUCTURE.md.

The audit's job: RE-COMPUTE the numbers and find where a displayed/claimed value disagrees with what
the code actually computes, where a math error creates/destroys money, or where a claim is honest-but-
wrong. Report only things you can tie to a file:line and a recomputation.`

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
        required: ['title', 'severity', 'area', 'file', 'line', 'claimed', 'actual', 'impact', 'fix'],
        properties: {
          title: { type: 'string' },
          severity: { type: 'string', enum: ['critical', 'high', 'medium', 'low'] },
          area: { type: 'string', enum: ['money-math', 'aum-fee', 'projection', 'tax', 'strategy-allocation', 'real-vs-simulated', 'edge-case'] },
          file: { type: 'string' },
          line: { type: 'number' },
          claimed: { type: 'string', description: 'the number/behavior shown or promised to the user' },
          actual: { type: 'string', description: 'what the code actually computes — show the recomputation' },
          impact: { type: 'string', description: 'who is misled or how money is created/destroyed, and by how much' },
          fix: { type: 'string', description: 'the specific code-level remediation' },
        },
      },
    },
  },
}

const VERDICT_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['isReal', 'confidence', 'reasoning', 'severityAfterReview'],
  properties: {
    isReal: { type: 'boolean', description: 'true only if the recomputation genuinely disagrees with the code AND it is not explained by a stated reality (sim/display-only/decimals-as-strings handled)' },
    confidence: { type: 'string', enum: ['high', 'medium', 'low'] },
    reasoning: { type: 'string', description: 'redo the math against the actual code path; cite file:line' },
    severityAfterReview: { type: 'string', enum: ['critical', 'high', 'medium', 'low', 'not-a-bug'] },
  },
}

const DIMENSIONS = [
  { key: 'money-math', title: 'Money math / settlement / decimals',
    prompt: `Re-compute money flows: gift gross-vs-net (processing + platform fee), settlement crediting the right amount, refund/chargeback reversing balance AND invested holdings AND allocations, Drizzle-decimal-as-string bugs (parseFloat missing → string concat or NaN), rounding that creates/destroys cents at scale, and any place a total is summed inconsistently across surfaces (dashboard vs activity vs detail).` },
  { key: 'aum-fee', title: 'AUM / platform fee math',
    prompt: `Re-compute the 0.10%/yr fee everywhere it's shown: the "(est.)" estimator, per-gift micro-projections ("$1/yr per $1,000"), the prorated in-progress-year fee, and any projection that claims to be "net of fee". Confirm it's display-only (no collection) per AUM_FEE_COLLECTION_SPEC. Flag inconsistent fee figures across surfaces or a projection that says "net of fee" but doesn't subtract it.` },
  { key: 'projection', title: 'Projection / compounding math',
    prompt: `Re-compute projectFundValue + the Settings projection ranges (low/avg/high). Check the sigma/sqrt(n) horizon scaling, the expectedMean/expectedSigma per tier, years-to-majority math (state age, not flat 18), monthly-contribution compounding, and that every projection carries the PROJECTION_DISCLAIMER. Flag ranges that don't match the stated mean/sigma or horizons that mis-handle owner-mode (yearsTo18 clamps to 0).` },
  { key: 'tax', title: 'Tax math (kiddie tax, cost basis, gains)',
    prompt: `Re-compute tax figures on the Taxes tab + first-sell explainer: kiddie-tax thresholds (through 18 + students under 24), cost-basis/holding-period on sells, realized gain, qualified-vs-ordinary dividend wording, and the fee's tax treatment. Cross-check shared/legal-copy.ts. Flag any number or rule that's wrong or oversimplified into being wrong.` },
  { key: 'strategy-allocation', title: 'Strategy / allocation / drift',
    prompt: `Re-compute the strategy layer: that "X% stocks · Y% bonds" is DERIVED from the ETF target weights (not a separate hardcoded number that could drift), the "Today vs target" drift uses the managed-mix sleeve as denominator (not whole fund), Hamilton rounding makes columns sum to 100 and drift net to 0, and computeContributionAllocations actually biases new dollars toward underweight tickers (matching the copy). Flag any preset whose stocks/bonds summary disagrees with its weights, or drift signs that don't net to zero.` },
  { key: 'real-vs-simulated', title: 'Real-vs-simulated honesty',
    prompt: `Hunt numbers/claims that imply more reality than exists: "trade confirmation" / "your shares" / "executed" language for simulated holdings, present-tense SIPC, a real-looking order/settlement that's actually a DB write, or a projection/return presented as a promise. Judge against REAL_VS_SIMULATED.md — the goal is honest framing of the simulation, not removing it.` },
  { key: 'edge-case', title: 'Numeric edge cases',
    prompt: `Hunt numeric edge cases: zero/negative/huge amounts, empty portfolio (divide-by-zero in % calcs), a single-holding fund, a fund that's 100% chosen-with-love (managed sleeve = 0 → drift card), the $100 fallback latent edge, NaN/Infinity from bad parses, and any % that can exceed 100 or go negative. Flag where a user could see a nonsensical number.` },
]

phase('Scope')
log(`Finance audit — ${mode === 'diff' ? `diff vs ${base}` : 'full money layer'}. ${DIMENSIONS.length} specialists re-computing the numbers.`)

const perDimension = await pipeline(
  DIMENSIONS,
  (d) =>
    agent(
      `You are a senior fintech quantitative auditor (${d.title}). ${CONTEXT}\n\n${scopeNote}\n\nDIMENSION: ${d.title}.\n${d.prompt}\n\nRead the ACTUAL code and RE-COMPUTE. Report ONLY discrepancies you can show with a recomputation tied to a file:line. Respect the stated realities (sim, display-only fee, decimals-as-strings, no-sell-rebalance) — a "bug" explained by those is a false positive. If the math checks out, return an empty findings array.`,
      { label: `audit:${d.key}`, phase: 'Audit', agentType: 'Explore', schema: FINDINGS_SCHEMA },
    ),
  (review, d) =>
    parallel(
      (review?.findings || []).map((f) => () =>
        parallel(
          ['recompute-the-math', 'does-the-code-actually-do-this', 'materiality'].map((lens) => () =>
            agent(
              `You are an adversarial quantitative reviewer. Try to REFUTE this finding via the "${lens}" lens. Read the actual code at ${f.file} and redo the arithmetic yourself. Default to isReal=false if the recomputation actually agrees with the code, or if a stated reality (simulation, display-only fee, decimals-as-strings handled, contribution-rebalancing) explains it.\n\nFINDING: ${f.title}\nFILE: ${f.file}:${f.line}\nCLAIMED: ${f.claimed}\nACTUAL (claimed): ${f.actual}\nIMPACT: ${f.impact}\n\n${CONTEXT}`,
              { label: `verify:${d.key}:${f.title.slice(0, 22)}`, phase: 'Verify', agentType: 'Explore', schema: VERDICT_SCHEMA },
            ),
          ),
        ).then((verdicts) => {
          const v = verdicts.filter(Boolean)
          const real = v.filter((x) => x.isReal).length
          return { ...f, confirmed: real >= 2, votes: `${real}/${v.length}`, verdicts: v }
        }),
      ),
    ),
)

const confirmed = perDimension.flat().filter(Boolean).filter((f) => f && f.confirmed)

phase('Report')
const order = { critical: 0, high: 1, medium: 2, low: 3 }
confirmed.sort((a, b) => (order[a.severity] ?? 9) - (order[b.severity] ?? 9))
log(`Confirmed ${confirmed.length} financial discrepancy(ies) after recomputation + adversarial verification. Running red-team completeness pass.`)

const completeness = await agent(
  `You are the financial/quantitative red-team LEAD reviewing this audit for COMPLETENESS. ${CONTEXT}\n\nDimensions covered: ${DIMENSIONS.map((d) => d.title).join('; ')}.\nConfirmed discrepancies: ${JSON.stringify(confirmed.map((f) => ({ title: f.title, area: f.area, severity: f.severity })), null, 2)}\n\nName, specifically and citing where to look: (1) the single highest-severity money-math error you suspect was MISSED; (2) any blind-spot calculation a top-tier fintech finance team would re-check that isn't in the dimension list; (3) whether the severity calibration looks right. If coverage looks complete, say so and why.`,
  { label: 'red-team-completeness', phase: 'Report' },
)

const report = await agent(
  `You are the lead financial reviewer writing the final report for the Kiddo team. These discrepancies survived 3-reviewer adversarial recomputation. Write a tight, triaged markdown report: a one-line "are the numbers honest" summary, then findings grouped by severity, each with file:line, "claimed vs actual" (show the math), the impact, and the fix, then include the red-team completeness review verbatim at the end. Be precise; a finding must include the recomputation. If clean, say the audited money math is consistent and note coverage.\n\nCONFIRMED (JSON):\n${JSON.stringify(confirmed, null, 2)}\n\nRED-TEAM COMPLETENESS REVIEW:\n${completeness}`,
  { label: 'synthesize-report', phase: 'Report' },
)

return { confirmedCount: confirmed.length, confirmed, completeness, report }
