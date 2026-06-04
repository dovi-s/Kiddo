export const meta = {
  name: 'data-privacy-audit',
  description:
    "Multi-agent data-privacy & governance audit for Kiddo (a CHILDREN's-data company): specialists map the PII inventory + data flows, third-party processors, retention/deletion, consent & subject-rights, data-minimization/exposure, and access/encryption governance. Each finding is adversarially verified + severity-calibrated against COPPA/CCPA/GDPR + minimization principles; a red-team completeness pass names misses; then a triaged report. Decision-support, not legal advice.",
  whenToUse:
    'Run before launch, before adding any data collection or third-party integration, and after changes to deletion/retention/uploads/analytics. Pass {mode:"diff",base:"main"} to scope to a branch diff, {mode:"full"} for all data handling.',
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
    ? `Scope: ONLY the changes in the current branch vs \`${base}\` (git diff ${base}...HEAD) + the data paths they touch.`
    : `Scope: all data handling — collection, storage (shared/schema.ts), flows to third parties, logs, /uploads, the deletion worker, and the privacy policy vs actual practice.`

const CONTEXT = `
Kiddo holds the most sensitive category of data: CHILDREN'S PII. It collects child name, DOB, photo,
voice/video (Memory Book + gifter media), and SSN (on funds, for custodial tax/KYC); plus parent PII,
gifter PII (name/email/payment), and bank/Plaid + Stripe references. Storage: Postgres via Drizzle
(shared/schema.ts). Data flows to: Stripe (payments), Postmark/SendGrid (email), market-data APIs,
the hosting platform, public /uploads (kids' media), and any analytics. Deletion is via
server/accountDeletionWorker.ts (a PII scrub). Custody is a stub, but ALL the data collection +
flows are REAL today.

This is a data-GOVERNANCE audit (distinct from compliance-audit's legal posture and security-audit's
"can an attacker steal it"): is the data handling lawful, minimal, mapped, consented, deletable, and
access-controlled? Judge against — cite in standardRef:
 - COPPA 16 CFR §312: verifiable parental consent for child data, data-minimization, retention only
   as long as needed, deletion on request, no conditioning participation on excess data, §312.8 security.
 - CCPA/CPRA: notice, access/delete/portability rights, do-not-sell/share, service-provider terms;
   sensitive PI (SSN, child data) extra protections.
 - GDPR principles (if any EU exposure): lawful basis, minimization, purpose limitation, DSAR, RTBF.
 - Minimization principle: collect/expose ONLY what's needed (is SSN/DOB needed pre-custody?).
 - Processor governance: a DPA + scoped data per third party; no PII to processors that don't need it.
A finding must name the specific data, the specific flow/store/exposure, and the specific rule/principle.`

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
        required: ['title', 'severity', 'area', 'location', 'dataInvolved', 'issue', 'likelihood', 'impact', 'effort', 'standardRef', 'fix', 'needsLicensedHuman'],
        properties: {
          title: { type: 'string' },
          severity: { type: 'string', enum: ['blocker', 'high', 'medium', 'low'] },
          area: { type: 'string', enum: ['inventory-flows', 'third-party-processors', 'retention-deletion', 'consent-rights', 'minimization-exposure', 'access-encryption'] },
          location: { type: 'string', description: 'file:line / table / flow / surface' },
          dataInvolved: { type: 'string', description: 'the specific PII (child name/DOB/photo/voice/SSN, parent, gifter, payment, bank)' },
          issue: { type: 'string', description: 'the governance gap, precisely' },
          likelihood: { type: 'string', enum: ['high', 'medium', 'low'] },
          impact: { type: 'string', enum: ['high', 'medium', 'low'] },
          effort: { type: 'string', enum: ['S', 'M', 'L'] },
          standardRef: { type: 'string', description: 'the rule/principle (COPPA §312, CCPA, GDPR, minimization, DPA)' },
          fix: { type: 'string', description: 'specific remediation (minimize/redact, add deletion, scope a processor, consent gate, encrypt)' },
          needsLicensedHuman: { type: 'boolean', description: 'true if this is a liability-bearing privacy-law call for counsel' },
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
    isReal: { type: 'boolean', description: 'true only if it is a genuine governance gap given the actual data handling (not already-minimized/deleted/scoped/consented)' },
    confidence: { type: 'string', enum: ['high', 'medium', 'low'] },
    reasoning: { type: 'string', description: 'trace the actual data path/schema; is the gap real or already handled?' },
    severityAfterReview: { type: 'string', enum: ['blocker', 'high', 'medium', 'low', 'not-an-issue'] },
    needsLicensedHuman: { type: 'boolean' },
  },
}

const DIMENSIONS = [
  { key: 'inventory-flows', title: 'PII inventory + data flows',
    prompt: `Map what PII is collected and where it goes. Hunt: PII fields in shared/schema.ts with no clear purpose, data written to LOGS (console/error) — esp. SSN/DOB/email/tokens, PII in error responses, undocumented flows to third parties, and child data crossing a boundary it shouldn't. Produce findings where a specific PII field is stored/logged/flowed without a clear, minimal purpose. Cite the field + the sink.` },
  { key: 'third-party-processors', title: 'Third-party processors / data sharing',
    prompt: `Audit every external service that receives data (Stripe, Postmark/SendGrid, market-data, hosting, analytics, Plaid): what PII does each actually get, does it need it, is CHILD data shared with any that shouldn't have it, and is a service-provider/DPA relationship implied (CCPA "service provider", COPPA disclosure)? Hunt PII sent to a processor beyond what the function needs (e.g., child name/DOB to an email or analytics call). Cite the call + the over-shared field.` },
  { key: 'retention-deletion', title: 'Retention + deletion (RTBF)',
    prompt: `Audit deletion + retention against accountDeletionWorker.ts: does deletion actually purge ALL child PII — DB rows, /uploads media (photo/video/audio), Memory Book entries, gifter records, tokens — or only some (the known SSN-only-scrub class)? Is there a retention policy / TTL, or does data live forever? Do backups retain "deleted" data with no purge? Is there a working data-subject deletion request path? Cite what survives deletion.` },
  { key: 'consent-rights', title: 'Consent + data-subject rights',
    prompt: `Audit consent + rights: verifiable PARENTAL consent for collecting child data (COPPA) — is it obtained before collection, and scoped? Data-subject rights (access/export/delete/correct) for parents and, at 18, the now-adult. CCPA notice + do-not-sell/share. Privacy-policy claims vs ACTUAL practice (does the policy promise things the code doesn't do, or vice versa?). Cite the missing consent gate or unfulfillable right.` },
  { key: 'minimization-exposure', title: 'Data minimization + over-exposure',
    prompt: `Audit minimization: is each sensitive field NECESSARY now (SSN/DOB pre-custody? full DOB vs just majority date — note the age-transition already switched to majorityDate)? Hunt over-collection, PII in analytics/tracking, API responses returning more PII than the caller needs, child PII on public/shared surfaces, and PII in URLs/query strings/referrers. Cite the field + where it's over-collected or over-exposed.` },
  { key: 'access-encryption', title: 'Access governance + encryption',
    prompt: `Audit internal data governance: who/what can read child PII (admin surface exposure, broad SELECTs), encryption at rest for the most sensitive fields (SSN) and in transit, key/secret handling, audit-logging of sensitive-PII access, and RLS/least-privilege (there is a db:secure/enable-rls path — is it applied to PII tables?). Cite the access gap or unencrypted-sensitive-field.` },
]

phase('Scope')
log(`Data-privacy audit — ${mode === 'diff' ? `diff vs ${base}` : 'all data handling'}. ${DIMENSIONS.length} governance specialists. NOT legal advice.`)

const perDimension = await pipeline(
  DIMENSIONS,
  (d) =>
    agent(
      `You are a senior privacy engineer / DPO specialist (${d.title}) for a children's-data company. ${CONTEXT}\n\n${scopeNote}\n\nDIMENSION: ${d.title}.\n${d.prompt}\n\nRead the ACTUAL schema/code/flows. Report ONLY real governance gaps tied to a specific field + location + rule, with likelihood/impact, effort (S/M/L), and whether it needs a licensed human. No generic privacy-theater. If clean, return an empty findings array.`,
      { label: `audit:${d.key}`, phase: 'Audit', agentType: 'Explore', schema: FINDINGS_SCHEMA },
    ),
  (review, d) =>
    parallel(
      (review?.findings || []).map((f) => () =>
        parallel(
          ['is-it-actually-collected-or-flowed', 'already-minimized-deleted-or-scoped', 'severity-and-who-clears-it'].map((lens) => () =>
            agent(
              `You are an adversarial privacy reviewer. Try to REFUTE this finding via the "${lens}" lens. Read the actual schema/code at ${f.location}. Default to isReal=false if the data isn't actually collected/flowed that way, or it's already minimized/deleted/scoped/consented. Decide needsLicensedHuman.\n\nFINDING: ${f.title}\nAREA: ${f.area}\nDATA: ${f.dataInvolved}\nLOCATION: ${f.location}\nISSUE: ${f.issue}\nSTANDARD: ${f.standardRef}\n\n${CONTEXT}`,
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

phase('Report')
const order = { blocker: 0, high: 1, medium: 2, low: 3 }
confirmed.sort((a, b) => (order[a.severity] ?? 9) - (order[b.severity] ?? 9))
log(`Confirmed ${confirmed.length} privacy gap(s). Running red-team completeness pass.`)

const completeness = await agent(
  `You are the privacy red-team LEAD reviewing this audit for COMPLETENESS, for a children's-data company. ${CONTEXT}\n\nDimensions covered: ${DIMENSIONS.map((d) => d.title).join('; ')}.\nConfirmed findings: ${JSON.stringify(confirmed.map((f) => ({ title: f.title, area: f.area, severity: f.severity, data: f.dataInvolved })), null, 2)}\n\nName, specifically and citing where to look: (1) the single highest-severity privacy gap you suspect was MISSED; (2) any blind-spot area a top-tier privacy team would cover that isn't in the dimension list; (3) whether the severity calibration looks right. If coverage looks complete, say so and why.`,
  { label: 'red-team-completeness', phase: 'Report' },
)

const fixNow = confirmed.filter((f) => !f.needsLicensedHuman)
const counselGated = confirmed.filter((f) => f.needsLicensedHuman)
const report = await agent(
  `You are the lead privacy reviewer writing the final report for the Kiddo founder. These gaps survived 3-skeptic adversarial verification. Write a tight markdown report: (1) a one-line "is our children's-data handling defensible" verdict; (2) "Fix in-house now" grouped by severity, each with the data involved, location, likelihood×impact, effort (S/M/L), the rule, and the fix; (3) "Needs a licensed human" as crisp questions for privacy counsel (cross-ref COUNSEL_ENGAGEMENT_PACKET.md where it fits); (4) the red-team completeness review verbatim; end with the "decision-support, not legal advice" caveat. If clean, say so and note coverage.\n\nFIX-NOW (JSON):\n${JSON.stringify(fixNow, null, 2)}\n\nCOUNSEL-GATED (JSON):\n${JSON.stringify(counselGated, null, 2)}\n\nRED-TEAM COMPLETENESS REVIEW:\n${completeness}`,
  { label: 'synthesize-report', phase: 'Report' },
)

return { confirmedCount: confirmed.length, fixNowCount: fixNow.length, counselGatedCount: counselGated.length, confirmed, completeness, report }
