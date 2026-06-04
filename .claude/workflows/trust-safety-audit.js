export const meta = {
  name: 'trust-safety-audit',
  description:
    'Multi-agent Trust & Safety audit for Kiddo — a CHILD-facing product where gifters (potentially strangers via a public link) submit messages, photos, videos, and audio that land on a child\'s fund/Memory Book. Specialists hunt child-safety, grooming/contact, illegal-content (CSAM) handling, payment fraud/scams, moderation-pipeline, and minor-account-integrity risks; each finding is adversarially verified and severity-calibrated; a red-team completeness pass names what was missed; then a triaged report. Decision-support, not a substitute for a T&S/legal professional.',
  whenToUse:
    'Run before launch, before opening any public/UGC surface wider, after changes to gifting, Memory Book, uploads, KidView, or moderation. Pass {mode:"diff",base:"main"} to scope to a branch diff, {mode:"full"} for the whole product.',
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
    ? `Scope: ONLY the changes in the current branch vs \`${base}\` (git diff ${base}...HEAD) + the safety surfaces they touch.`
    : `Scope: every surface where outside content reaches a child or a family — public gift link, GiftCheckout, gift messages/media, Memory Book, /uploads, KidView, moderation, and the share mechanic.`

const CONTEXT = `
Kiddo is a US custodial-investing gifting platform for MINORS. CRITICAL: it is a child-facing
user-generated-content product. A GIFTER — who may be a stranger reaching a public gift link —
submits a sender NAME, a free-text MESSAGE, and optionally a PHOTO / VIDEO / AUDIO clip that are
stored and SURFACED on the child's fund + Memory Book, and visible in the child's own "KidView".
The child's name, photo, and age may appear on public/shared surfaces. Money moves via Stripe on
the public gift checkout.

Key surfaces: the public gift page + GiftCheckout (server/routes.ts public endpoints), gift
message/media capture, Memory Book (memoryEntries with status published|pending_review +
moderationStatus null|flagged|approved|hidden|removed|escalated; per-fund gifterMemoryModeration
flag), server/contentScanner.ts (upload content scan), public /uploads serving kids' media,
KidView (client/src/pages/KidView.tsx, PIN-gated), the share/link mechanic, and the at-18 handoff.

This is the highest-consequence audit: harm to a child is unrecoverable and existential to the
company. Judge against the governing standards/norms — CITE them in standardRef:
 - COPPA (16 CFR §312) for any child-data collection/exposure that enables contact.
 - CSAM: 18 U.S.C. §2258A NCMEC reporting obligation + a takedown/scan duty for user uploads.
 - Platform T&S norms: pre-publish vs post-publish moderation, fail-CLOSED on unscanned media,
   no open contact channel to a minor, no PII solicitation, repeat-offender + report/escalate.
 - Payment-fraud norms: card-testing, stolen-card gifts, chargeback abuse, velocity limits.
A finding must be a REAL, reachable harm path with an actor + steps, tied to a file:line/surface.
Respect realities: custody is a stub (money is simulated) — but messages/media/contact paths are
REAL today, so safety findings on UGC/contact are live regardless of custody.`

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
        required: ['title', 'severity', 'area', 'location', 'issue', 'attackPath', 'likelihood', 'impact', 'effort', 'standardRef', 'fix'],
        properties: {
          title: { type: 'string' },
          severity: { type: 'string', enum: ['critical', 'high', 'medium', 'low'] },
          area: { type: 'string', enum: ['child-safety-content', 'grooming-contact', 'csam-illegal', 'fraud-scams', 'moderation-ops', 'minor-account-integrity'] },
          location: { type: 'string', description: 'file:line and/or the surface' },
          issue: { type: 'string', description: 'the safety gap, precisely' },
          attackPath: { type: 'string', description: 'concrete harm path: who does what, what reaches the child/family, what they gain or how the child is harmed' },
          likelihood: { type: 'string', enum: ['high', 'medium', 'low'] },
          impact: { type: 'string', enum: ['high', 'medium', 'low'] },
          effort: { type: 'string', enum: ['S', 'M', 'L'], description: 'remediation effort' },
          standardRef: { type: 'string', description: 'the standard/norm this violates (COPPA §312, §2258A NCMEC, T&S norm, fraud-velocity)' },
          fix: { type: 'string', description: 'the specific remediation (moderation gate, scan, rate-limit, copy, redaction)' },
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
    isReal: { type: 'boolean', description: 'true only if a real actor can reach a real harm against a child/family given the actual code (not hypothetical, not already-gated)' },
    confidence: { type: 'string', enum: ['high', 'medium', 'low'] },
    reasoning: { type: 'string', description: 'trace the actual path in the code; is it reachable, or already moderated/scanned/gated?' },
    severityAfterReview: { type: 'string', enum: ['critical', 'high', 'medium', 'low', 'not-a-risk'] },
  },
}

const DIMENSIONS = [
  { key: 'child-safety-content', title: 'Harmful content reaching a child',
    prompt: `Hunt paths for inappropriate/harmful content (profane, sexual, violent, hateful, self-harm) to reach a CHILD via gift messages, sender names, or photo/video/audio — especially what KidView renders. Check: is gifter content moderated PRE-publish or only post? Is the gifterMemoryModeration flag default-on or off? What does a child see before a parent approves? Any unsanitized free-text/media surfaced to a minor. Cite the moderation gate (or its absence).` },
  { key: 'grooming-contact', title: 'Grooming / contact / PII solicitation',
    prompt: `Hunt whether the product can be used to CONTACT, identify, or groom a child: free-text gift messages carrying external handles/links/phone/email or grooming language, any reply/DM/two-way channel to the minor, public surfaces exposing the child's name+photo+age+location to a stranger gifter, repeat-gifter patterns enabling a relationship, and the share mechanic leaking child identity. This is the most serious area — flag any open or semi-open contact/identification vector.` },
  { key: 'csam-illegal', title: 'Illegal content (CSAM) scan + reporting',
    prompt: `Hunt illegal-content handling for user uploads (photo/video/audio): does server/contentScanner.ts actually scan, and does it FAIL CLOSED (reject) on scan error/unavailable rather than publishing unscanned media? Is there a CSAM detection + NCMEC reporting path (18 U.S.C. §2258A) and takedown? Are /uploads URLs guessable/listable so illegal content could be hosted/shared? Flag any unscanned-media-published path or missing report/takedown duty.` },
  { key: 'fraud-scams', title: 'Payment fraud / scams / impersonation',
    prompt: `Hunt fraud + scam vectors on the money + share flows: card-testing / stolen-card gifts via public checkout (velocity/rate limits?), chargeback-abuse economics, money-laundering via gift-then-withdraw, phishing/scam use of the share-a-gift-link mechanic (fake Kiddo links), sender-name impersonation ("Grandma"/"Kiddo Team"), and fake-fund scams soliciting gifts. Flag the abuse + what control is missing.` },
  { key: 'moderation-ops', title: 'Moderation pipeline + parent controls',
    prompt: `Audit the moderation system end-to-end: the moderationStatus state machine (flagged/approved/hidden/removed/escalated), whether it fails open or closed, parent controls to review/hide/report gifter content, an escalation/report path for the worst content, repeat-offender/blocklist handling, an audit trail, and whether a removed item is actually purged (incl. /uploads + the kid's view). Flag gaps that let bad content persist or recur.` },
  { key: 'minor-account-integrity', title: 'Minor-account integrity / KidView',
    prompt: `Audit safety of the minor's own access + account: KidView PIN strength + lockout + what a kid can see/do/spend, age-gating of features, account-takeover paths targeting a minor's fund, the at-18 handoff/claim being hijacked, and any way a third party assumes control of or surveils a child's account. Flag integrity gaps specific to the account being a CHILD'S.` },
]

phase('Scope')
log(`Trust & Safety audit — ${mode === 'diff' ? `diff vs ${base}` : 'all UGC + child + money surfaces'}. ${DIMENSIONS.length} safety specialists. Highest-consequence audit.`)

const perDimension = await pipeline(
  DIMENSIONS,
  (d) =>
    agent(
      `You are a senior Trust & Safety specialist (${d.title}) at a top-tier child-facing platform — the bar is "would this protect a real 8-year-old". ${CONTEXT}\n\n${scopeNote}\n\nDIMENSION: ${d.title}.\n${d.prompt}\n\nRead the ACTUAL code/surfaces. Report ONLY reachable harm paths tied to a file:line + an actor + steps, with a calibrated likelihood/impact, a remediation effort (S/M/L), and the standard it violates. No hypotheticals, no FUD. If clean, return an empty findings array.`,
      { label: `audit:${d.key}`, phase: 'Audit', agentType: 'Explore', schema: FINDINGS_SCHEMA },
    ),
  (review, d) =>
    parallel(
      (review?.findings || []).map((f) => () =>
        parallel(
          ['reachability', 'already-moderated-or-gated', 'severity-for-a-child'].map((lens) => () =>
            agent(
              `You are an adversarial Trust & Safety reviewer. Try to REFUTE this finding via the "${lens}" lens. Read the actual code at ${f.location}. Default to isReal=false if the path isn't actually reachable, the content is already moderated/scanned/gated, or the harm is hypothetical. But do NOT under-rate a real child-harm path.\n\nFINDING: ${f.title}\nAREA: ${f.area}\nLOCATION: ${f.location}\nISSUE: ${f.issue}\nATTACK PATH: ${f.attackPath}\nSTANDARD: ${f.standardRef}\n\n${CONTEXT}`,
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

// Red-team completeness pass — names the highest-severity likely MISS + blind spots.
phase('Report')
const order = { critical: 0, high: 1, medium: 2, low: 3 }
confirmed.sort((a, b) => (order[a.severity] ?? 9) - (order[b.severity] ?? 9))
log(`Confirmed ${confirmed.length} T&S finding(s). Running red-team completeness pass.`)

const completeness = await agent(
  `You are the Trust & Safety red-team LEAD reviewing this audit for COMPLETENESS, for a child-facing product. ${CONTEXT}\n\nDimensions covered: ${DIMENSIONS.map((d) => d.title).join('; ')}.\nConfirmed findings: ${JSON.stringify(confirmed.map((f) => ({ title: f.title, area: f.area, severity: f.severity })), null, 2)}\n\nName, specifically and citing where to look: (1) the single highest-severity child-harm path you suspect was MISSED; (2) any blind-spot area a top-tier T&S team would cover that isn't in the dimension list; (3) whether the severity calibration looks right, inflated, or dangerously deflated. Be concrete. If coverage looks genuinely complete, say so and say why.`,
  { label: 'red-team-completeness', phase: 'Report' },
)

const report = await agent(
  `You are the lead Trust & Safety reviewer writing the final report for the Kiddo founder. These findings survived 3-skeptic adversarial verification. Write a tight, triaged markdown report: (1) a one-line "is a child safe on this product today" verdict; (2) findings grouped by severity, each with location, the attack path in one sentence, likelihood×impact, effort (S/M/L), the standard it violates, and the fix; (3) a "cross-cutting / compound risks" note; (4) the red-team completeness review verbatim at the end. Be precise and non-alarmist, but do not soften a real child-harm finding. If clean, say the audited scope is safe and note coverage.\n\nCONFIRMED FINDINGS (JSON):\n${JSON.stringify(confirmed, null, 2)}\n\nRED-TEAM COMPLETENESS REVIEW:\n${completeness}`,
  { label: 'synthesize-report', phase: 'Report' },
)

return { confirmedCount: confirmed.length, confirmed, completeness, report }
