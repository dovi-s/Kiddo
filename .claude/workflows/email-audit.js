export const meta = {
  name: 'email-audit',
  description:
    'Multi-agent email-program audit for Kiddo: specialists hunt deliverability/infra (SPF/DKIM/DMARC), lifecycle-trigger gaps & dupes, template quality & cross-client render, CAN-SPAM/unsubscribe compliance, copy honesty (custody/SIPC/projection rules), and child-PII-in-email. Each finding is adversarially verified + costed, a red-team completeness pass names misses, then a triaged report. Email is the flagged biggest-missing launch-critical surface.',
  whenToUse:
    'Run before launch (email is launch-critical + currently under-configured), after adding/changing any transactional or lifecycle email, or before a send-volume increase. Pass {mode:"diff",base:"main"} to scope to a branch diff, {mode:"full"} for the whole email program.',
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
    ? `Scope: ONLY the changes in the current branch vs \`${base}\` (git diff ${base}...HEAD) + the email paths they touch.`
    : `Scope: the whole email program — server/emailDelivery.ts (Postmark/SendGrid), every template + send site, the trigger/lifecycle logic, unsubscribe/stop mechanics, and EXTERNAL_SERVICES email config.`

const CONTEXT = `
Kiddo sends transactional + lifecycle email via Postmark or SendGrid (server/emailDelivery.ts).
Per the team's own notes, EMAIL is the biggest MISSING launch-critical dependency — provider keys may
be unconfigured in dev, so "no provider configured" paths matter. Emails span: gift received, recurring
turned on (the recurring-request loop emails waiting gifters), gifter reminders (with a one-click stop
link; auto-charge gifters are NOT reminded), KYC status, age-18 handoff, dunning/payment-failed,
founder-claim, subscription lifecycle. Recipients include GIFTERS (often not account holders) and
PARENTS. Emails may reference a CHILD (name, the fund). Two prior email-audit rounds hardened "the
promises the templates make".

Judge against NAMED standards — cite in standardRef:
 - Deliverability: SPF + DKIM + DMARC aligned on the sending domain; sender reputation; bounce +
   complaint (FBL) handling + suppression; transactional vs marketing stream separation.
 - CAN-SPAM Act: accurate From/Subject, a physical mailing address, a working unsubscribe honored
   within 10 days, no misleading headers; transactional messages are exempt from some rules but
   marketing/lifecycle nudges are NOT.
 - Render: works in Gmail/Outlook/Apple Mail + mobile + dark mode + images-off; a plain-text part;
   no broken/tracking-leaking links.
 - Honesty: same custody/SIPC ("when investing is live", Member FINRA/SIPC partner) + projection-
   disclaimer + no-fabrication rules as the app (shared/legal-copy.ts).
 - Child-data: minimize child PII in email; don't expose a child's name/photo to the wrong recipient;
   no third-party tracking pixels on child-related mail.
A finding must name the template/send-site + the specific gap + the standard.`

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
        required: ['title', 'severity', 'area', 'location', 'issue', 'impact', 'effort', 'standardRef', 'fix'],
        properties: {
          title: { type: 'string' },
          severity: { type: 'string', enum: ['critical', 'high', 'medium', 'low'] },
          area: { type: 'string', enum: ['deliverability-infra', 'lifecycle-triggers', 'template-render', 'compliance-can-spam', 'honesty-claims', 'child-pii'] },
          location: { type: 'string', description: 'the template / send-site file:line / config' },
          issue: { type: 'string', description: 'the email gap, precisely' },
          impact: { type: 'string', enum: ['high', 'medium', 'low'], description: 'deliverability / conversion / legal / trust impact' },
          effort: { type: 'string', enum: ['S', 'M', 'L'] },
          standardRef: { type: 'string', description: 'the standard it misses (SPF/DKIM/DMARC, CAN-SPAM, render, custody-honesty, minimization)' },
          fix: { type: 'string', description: 'specific remediation (DNS record, add trigger, fix template, add unsubscribe, conditional copy, redact PII)' },
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
    isReal: { type: 'boolean', description: 'true only if it is a real gap in the actual email program (not already-handled, not a dev-only-missing-key that prod config covers)' },
    confidence: { type: 'string', enum: ['high', 'medium', 'low'] },
    reasoning: { type: 'string', description: 'trace the actual template/send/config; is the gap real?' },
    severityAfterReview: { type: 'string', enum: ['critical', 'high', 'medium', 'low', 'not-an-issue'] },
  },
}

const DIMENSIONS = [
  { key: 'deliverability-infra', title: 'Deliverability / SPF·DKIM·DMARC / suppression',
    prompt: `Audit deliverability infra: SPF/DKIM/DMARC setup intent for the sending domain (docs/config), provider config (Postmark vs SendGrid, server/emailDelivery.ts), bounce + spam-complaint handling + a suppression list (do we stop emailing a hard-bounce/complaint?), transactional-vs-marketing stream separation, and the "no provider configured" behavior (does a send fail loudly + safely, or silently drop a launch-critical email?). Cite the missing record/handler.` },
  { key: 'lifecycle-triggers', title: 'Lifecycle triggers — gaps + duplicates',
    prompt: `Audit the email lifecycle: is the RIGHT email sent at each key moment (gift received, recurring on, KYC pass/fail, age-18 handoff, payment-failed dunning, founder-claim, recurring-request) — and are there GAPS (a critical moment with no email) or DUPES/spam (the same event emailing twice, or reminders that don't stop)? Confirm the gifter one-click-stop is honored and auto-charge gifters aren't reminded. Cite the missing or duplicated trigger.` },
  { key: 'template-render', title: 'Template quality / cross-client render',
    prompt: `Audit templates: copy quality + on-brand voice, render across Gmail/Outlook/Apple Mail + mobile + dark mode + images-off, a plain-text alternative, broken/incorrect links + correct deep-links, button/CTA clarity, and accessibility (alt text, contrast). Hunt templates that break in a major client or rely on images to be legible. Cite the template + the render risk.` },
  { key: 'compliance-can-spam', title: 'CAN-SPAM / unsubscribe',
    prompt: `Audit CAN-SPAM compliance: a physical mailing address in marketing/lifecycle mail, a working unsubscribe link honored promptly, accurate non-deceptive From/Subject, and correct transactional-vs-marketing classification (a "nudge" is marketing — does it carry unsubscribe?). Check the gifter stop-link + that unsubscribe state is actually persisted + respected on the next send. Cite the non-compliant template.` },
  { key: 'honesty-claims', title: 'Copy honesty / claims',
    prompt: `Audit email copy honesty against the app's rules: present-tense SIPC/custody/"protected" claims (must be conditional), hard-named custodian, projections without the disclaimer, returns/guarantee language, and any promise the email makes that the product can't keep (the prior rounds hardened this — find survivors/regressions). Cross-check shared/legal-copy.ts + CUSTODIAN_SOURCE_OF_TRUTH.md. Cite the over-claim.` },
  { key: 'child-pii', title: 'Child PII in email',
    prompt: `Audit child-data in email: a child's name/photo/DOB sent to the WRONG recipient (e.g., a stranger gifter receiving identifying child info), child PII in subject lines / preview text / URLs, third-party tracking pixels on child-related mail, and PII handed to the email processor beyond need. Cite the template + the exposed child field + recipient.` },
]

phase('Scope')
log(`Email audit — ${mode === 'diff' ? `diff vs ${base}` : 'whole email program'}. ${DIMENSIONS.length} email specialists.`)

const perDimension = await pipeline(
  DIMENSIONS,
  (d) =>
    agent(
      `You are a senior email/lifecycle-marketing + deliverability specialist (${d.title}). ${CONTEXT}\n\n${scopeNote}\n\nDIMENSION: ${d.title}.\n${d.prompt}\n\nRead the ACTUAL templates/send-sites/config. Report ONLY real gaps tied to a location + standard, with an impact level, effort (S/M/L), and the standard missed. Distinguish a real gap from a dev-only-unconfigured-key. If clean, return an empty findings array.`,
      { label: `audit:${d.key}`, phase: 'Audit', agentType: 'Explore', schema: FINDINGS_SCHEMA },
    ),
  (review, d) =>
    parallel(
      (review?.findings || []).map((f) => () =>
        parallel(
          ['is-it-a-real-gap-or-dev-only', 'already-handled', 'severity-deliverability-legal-trust'].map((lens) => () =>
            agent(
              `You are an adversarial email reviewer. Try to REFUTE this finding via the "${lens}" lens. Read the actual template/config at ${f.location}. Default to isReal=false if it's already handled, or it's only a dev-unconfigured-key that prod config covers.\n\nFINDING: ${f.title}\nAREA: ${f.area}\nLOCATION: ${f.location}\nISSUE: ${f.issue}\nSTANDARD: ${f.standardRef}\n\n${CONTEXT}`,
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
log(`Confirmed ${confirmed.length} email finding(s). Running red-team completeness pass.`)

const completeness = await agent(
  `You are the email red-team LEAD reviewing this audit for COMPLETENESS. ${CONTEXT}\n\nDimensions covered: ${DIMENSIONS.map((d) => d.title).join('; ')}.\nConfirmed findings: ${JSON.stringify(confirmed.map((f) => ({ title: f.title, area: f.area, severity: f.severity })), null, 2)}\n\nName, specifically and citing where to look: (1) the single highest-impact email problem you suspect was MISSED (esp. a launch-critical missing email or a deliverability landmine); (2) any blind-spot area a top-tier lifecycle team would cover; (3) whether the severity calibration looks right. If coverage looks complete, say so and why.`,
  { label: 'red-team-completeness', phase: 'Report' },
)

const report = await agent(
  `You are the lead email/lifecycle reviewer writing the final report for the Kiddo team. These findings survived 3-skeptic adversarial verification. Write a tight, triaged markdown report: (1) a one-line "is email launch-ready" verdict; (2) findings grouped by severity, each with the template/location, the gap, impact, effort (S/M/L), the standard, and the fix; (3) a "must-exist emails that are missing" list called out separately (gaps matter as much as bugs here); (4) the red-team completeness review verbatim. If clean, say the program meets the bar and note coverage.\n\nCONFIRMED (JSON):\n${JSON.stringify(confirmed, null, 2)}\n\nRED-TEAM COMPLETENESS REVIEW:\n${completeness}`,
  { label: 'synthesize-report', phase: 'Report' },
)

return { confirmedCount: confirmed.length, confirmed, completeness, report }
