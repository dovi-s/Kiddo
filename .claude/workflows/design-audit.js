export const meta = {
  name: 'design-audit',
  description:
    'Multi-agent UX/UI/design audit for Kiddo: specialist auditors (UX heuristics & flow, visual consistency, accessibility, mobile↔web parity, AI-slop tells, empty/loading/error states) hunt real usability + craft problems, each finding is adversarially verified (real-problem-or-nitpick / reproduce-it / severity), then synthesized into a triaged report. Quality-of-experience, not correctness bugs (use security/finance audits for those).',
  whenToUse:
    'Run before launch, after UI/flow changes, or to raise the craft bar on a surface. Pass {mode:"diff",base:"main"} to scope to a branch diff, {mode:"full"} for the whole app + site.',
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
    ? `Scope: ONLY the changes in the current branch vs \`${base}\` (git diff ${base}...HEAD) + the screens/components they touch.`
    : `Scope: the whole experience — the app (Dashboard, Activity, Memory Book, Settings, gift flows, KidView, Age18), the marketing site, emails, and the native app (apps/mobile/).`

const CONTEXT = `
Kiddo is a US custodial-investment gifting fintech. React 19 + TS client (client/src), an Expo
native app (apps/mobile/) being rebuilt to MIRROR the web on a shared brand kit, and emails. Users
span PARENT (custodian), GIFTER (grandparent/aunt/friend), CHILD (KidView), CO-PARENT, and the
ADULT owner post-18 handoff — a multi-actor product where the same screen reframes per viewer
(recipientIsOwner / isOwnerMode / accessRole). The emotional core is the Memory Book + the gifter
loop; the tone is warm, premium, trustworthy, calm (a money product for someone's child).

DECIDED DESIGN POSTURE (judge against these — don't relitigate):
 - NO AI-slop / no "AI design tells". Hard CI rules in script/lint-content.cjs already ban: the
   Sparkles/SparkleBurst/Wand2 icon family, gradient-clipped headlines, default-purple, decorative
   em-dashes. A recent full Sparkles re-sweep + 3 lint guards landed. So flag NEW slop, not the
   already-guarded set — and any regression that slipped a guard.
 - The public-surface design audit came back CLEAN recently (Home/GiveAGift/GiftCheckout: no
   gradient-clip headlines, no default-purple, honest testimonials). Design is NOT the conversion
   bottleneck — so on marketing pages, prioritize real usability/a11y over restyling.
 - Brand kit: evergreen/cream/gold palette via CSS vars (hsl(var(--kiddo-*))), Bricolage Grotesque
   display + serif accents, tactile cards, reduced-motion respected (WCAG 2.3.3). elevate() shadow
   helper on native. Strategy labels canonical in lib/strategy.ts.
 - Multi-actor correctness matters: a screen must read right for the parent vs the owner (post-
   handoff) vs the gifter vs the kid — wrong-audience framing is a real UX bug, not a nit.

The audit's job: find REAL usability friction, accessibility failures, visual-system inconsistency,
web↔native divergence, and broken/missing states — each reproducible and tied to a file:line.
NOT subjective "I'd prefer" restyling, NOT correctness/security/money bugs.`

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
        required: ['title', 'severity', 'area', 'location', 'issue', 'whoHurts', 'fix'],
        properties: {
          title: { type: 'string' },
          severity: { type: 'string', enum: ['high', 'medium', 'low'] },
          area: { type: 'string', enum: ['ux-flow', 'visual-consistency', 'accessibility', 'mobile-web-parity', 'ai-slop', 'states'] },
          location: { type: 'string', description: 'file:line and the screen/component' },
          issue: { type: 'string', description: 'the concrete usability/craft problem, reproducible' },
          whoHurts: { type: 'string', description: 'which actor (parent/gifter/child/owner/co-parent) and in what moment' },
          fix: { type: 'string', description: 'the specific design/code remediation' },
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
    isReal: { type: 'boolean', description: 'true only if a real user would hit a real problem (not a subjective taste preference, not an already-guarded slop pattern)' },
    confidence: { type: 'string', enum: ['high', 'medium', 'low'] },
    reasoning: { type: 'string', description: 'reproduce it against the actual code; would a real user in that flow be hindered?' },
    severityAfterReview: { type: 'string', enum: ['high', 'medium', 'low', 'not-an-issue'] },
  },
}

const DIMENSIONS = [
  { key: 'ux-flow', title: 'UX heuristics / flow / dead-ends',
    prompt: `Audit core flows (create fund, send/receive a gift, write a Memory, set recurring, co-parent invite, at-18 handoff, KidView) against Nielsen heuristics. Hunt dead-ends (a tap that 404s or goes nowhere useful), unclear system status, missing confirmation/undo on destructive actions, steps that demand info too early, more than ~4 levels of nav depth, and wrong-AUDIENCE framing (parent copy shown to the post-handoff owner, "for kids" shown to the adult, etc.).` },
  { key: 'visual-consistency', title: 'Visual system / spacing / type / tokens',
    prompt: `Audit visual consistency: ad-hoc spacing/radii/shadows instead of the system, off-palette colors (raw hex/rgb where a brand CSS var exists), inconsistent type scale, mismatched card/button treatments across screens, alignment bugs (misaligned tiles/rows/columns), and components that diverge from their siblings. Flag concrete inconsistencies, not "make it prettier".` },
  { key: 'accessibility', title: 'Accessibility (WCAG)',
    prompt: `Audit a11y: color contrast (esp. muted text + gold/amber on cream), focus visibility + keyboard navigation, missing/empty alt + aria-labels (icon-only buttons), form labels + error association, touch-target size, reduced-motion compliance (WCAG 2.3.3 — is every interaction-triggered animation gated?), heading order, and screen-reader-hostile patterns. Flag concrete WCAG failures with the element.` },
  { key: 'mobile-web-parity', title: 'Mobile ↔ web parity',
    prompt: `Audit web↔native divergence (apps/mobile mirrors web): screens/flows present on web but stubbed/missing or behaving differently on native, label/data mismatches (native uses a different vocabulary or endpoint), broken native-specific patterns, and safe-area / responsive breakpoints on web (notch padding, small-phone, tablet). Flag where the two platforms tell different stories.` },
  { key: 'ai-slop', title: 'AI-slop / craft tells',
    prompt: `Hunt NEW AI-design tells beyond the CI-guarded set (Sparkles/Wand2, gradient-clip headlines, default-purple, decorative em-dashes already banned in lint-content.cjs): generic "make it pop" gradients, emoji-as-icon overuse, centered-everything layouts, lorem-ish filler copy, inconsistent icon weights/families, fake-depth drop shadows, and any regression that slipped a lint guard. Flag the specific element + which guard should catch it.` },
  { key: 'states', title: 'Empty / loading / error / edge states',
    prompt: `Audit non-happy states across screens: empty states (new fund, no gifts, no activity, no holdings) that are honest + inviting (not a blank or a broken promise), loading (skeletons vs spinners vs layout shift), error states (failed fetch/payment/upload — recoverable + clear), and edge content (very long names, huge balances, a 100%-chosen-with-love fund, owner-mode). Flag missing/poor states and where layout shifts or shows a raw error.` },
]

phase('Scope')
log(`Design audit — ${mode === 'diff' ? `diff vs ${base}` : 'whole app + site + native'}. ${DIMENSIONS.length} UX/UI specialists.`)

const perDimension = await pipeline(
  DIMENSIONS,
  (d) =>
    agent(
      `You are a senior product designer / UX specialist (${d.title}) with a high craft bar for a warm, premium, trustworthy kids-money product. ${CONTEXT}\n\n${scopeNote}\n\nDIMENSION: ${d.title}.\n${d.prompt}\n\nRead the ACTUAL components/screens. Report ONLY real, reproducible problems tied to a file:line — not subjective taste, not already-guarded slop. Wrong-audience framing IS a real bug. If clean, return an empty findings array.`,
      { label: `audit:${d.key}`, phase: 'Audit', agentType: 'Explore', schema: FINDINGS_SCHEMA },
    ),
  (review, d) =>
    parallel(
      (review?.findings || []).map((f) => () =>
        parallel(
          ['real-problem-or-taste-nitpick', 'reproduce-it-in-the-code', 'severity-for-the-actor'].map((lens) => () =>
            agent(
              `You are an adversarial design reviewer. Try to REFUTE this finding via the "${lens}" lens. Read the actual component at ${f.location}. Default to isReal=false if it's a subjective taste preference, an already-CI-guarded slop pattern, or not actually reproducible.\n\nFINDING: ${f.title}\nAREA: ${f.area}\nLOCATION: ${f.location}\nISSUE: ${f.issue}\nWHO IT HURTS: ${f.whoHurts}\n\n${CONTEXT}`,
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
const order = { high: 0, medium: 1, low: 2 }
confirmed.sort((a, b) => (order[a.severity] ?? 9) - (order[b.severity] ?? 9))
log(`Confirmed ${confirmed.length} UX/UI finding(s) after adversarial verification. Running red-team completeness pass.`)

const completeness = await agent(
  `You are the design/UX red-team LEAD reviewing this audit for COMPLETENESS. ${CONTEXT}\n\nDimensions covered: ${DIMENSIONS.map((d) => d.title).join('; ')}.\nConfirmed findings: ${JSON.stringify(confirmed.map((f) => ({ title: f.title, area: f.area, severity: f.severity })), null, 2)}\n\nName, specifically and citing where to look: (1) the single highest-severity usability/a11y problem you suspect was MISSED; (2) any blind-spot flow or actor (parent/gifter/child/owner) a top-tier design team would check that isn't in the dimension list; (3) whether the severity calibration looks right. If coverage looks complete, say so and why.`,
  { label: 'red-team-completeness', phase: 'Report' },
)

const report = await agent(
  `You are the lead design reviewer writing the final report for the Kiddo team. These findings survived 3-skeptic adversarial verification. Write a tight, triaged markdown report: a one-line craft summary, then findings grouped by severity, each with location, who it hurts + in what moment, and the fix. Separate "quick polish" from "real flow/a11y work", then include the red-team completeness review verbatim at the end. Be specific and non-precious — no taste nits. If clean, say the audited experience meets the bar and note coverage.\n\nCONFIRMED (JSON):\n${JSON.stringify(confirmed, null, 2)}\n\nRED-TEAM COMPLETENESS REVIEW:\n${completeness}`,
  { label: 'synthesize-report', phase: 'Report' },
)

return { confirmedCount: confirmed.length, confirmed, completeness, report }
