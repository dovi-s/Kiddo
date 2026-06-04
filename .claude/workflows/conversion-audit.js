export const meta = {
  name: 'conversion-audit',
  description:
    'Multi-agent growth/conversion audit for Kiddo: specialist auditors (technical SEO, intent/content SEO, conversion copy, positioning & brand voice, trust/social-proof honesty, funnel/activation) hunt what blocks discovery + conversion, each finding is adversarially verified (real-or-nitpick / does-it-move-the-metric / on-brand), then synthesized into a prioritized report. Judges against the GTM + positioning source-of-truth.',
  whenToUse:
    'Run before launch, after public-page/copy/SEO changes, or before a creator/registry push. Pass {mode:"diff",base:"main"} to scope to a branch diff, {mode:"full"} for all public + funnel surfaces.',
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
    ? `Scope: ONLY the changes in the current branch vs \`${base}\` (git diff ${base}...HEAD) + the public/funnel surfaces they touch.`
    : `Scope: all public + funnel surfaces — Home, GiveAGift, GiftCheckout, GiftSuccess, the /compare/:slug + state pages, Pricing, FAQ, Blog, emails, sitemap + SSR head (server/seoMeta.ts), and the gifter loop.`

const CONTEXT = `
Kiddo is a US custodial-investment GIFTING platform. The business model is a ZERO-CAC gifter loop:
the GIFTER (grandparent/aunt/friend) is the customer/acquisition channel, not the parent — paid
parent-acquisition is a TRAP (competitor EarlyBird's $200+ CAC / 20-25mo payback proves it). The
North-star metric is FUNDED-k (does each funded fund produce >=1 more funded fund). Wedge = gifting;
the prize = the at-18 handoff into a lifetime relationship (kid -> adult owner -> parent who gives).

DECIDED GTM POSTURE (judge the product against these — don't relitigate them):
 - Channel priority: creators + the loop (near-term heavy) > registry (Babylist, gated) > SEO
   (patient compounding asset, foundation NOW / volume later) > paid-parent (trap). Judge paid by funded-k.
 - OWNED SEO is ~$0 CAC, so target ALL audiences (gifter/parent/education/at-18); organic parents
   become loop seeds. SEO clusters by intent x winnability: gifter-occasion (own it) -> parent
   comparison (/compare/:slug, 7 built — win comparisons, not head terms) -> UTMA-education
   (programmatic state pages) -> at-18/kid-2.0.
 - POSITIONING: avoid EarlyBird's near-identical lane. BANNED phrases (too generic / theirs):
   "gift wealth not waste", "democratize generational wealth", the two origin-story tropes. Kiddo's
   ownable lane: love that compounds / a child's eyes / companies they know / "watch it land". Use
   "gifter" (never "giver"); product name is "Kiddo" (never "Kora") in all prose.
 - The make-or-break conversion lever is GIFTER_CAPTURE_AT_INTENT (capture the card at intent,
   Kickstarter-pledge model — built behind a flag, counsel-gated). Activation must tie to a FUNDED
   account, not just a click. Trust copy must be HONEST (no fabricated testimonials, conditional SIPC).

CANONICAL DOCS: SEO_GTM_STRATEGY.md, project_positioning_distinct_voice.md, MOAT_MEMO.md,
project_launch_wedge_and_creator_distribution.md, COMPANY_STRATEGY.md, server/seoMeta.ts.
Public-surface design was audited clean recently — focus on conversion + discovery, not pixels.`

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
        required: ['title', 'severity', 'area', 'location', 'issue', 'impact', 'fix'],
        properties: {
          title: { type: 'string' },
          severity: { type: 'string', enum: ['high', 'medium', 'low'] },
          area: { type: 'string', enum: ['technical-seo', 'content-seo', 'conversion-copy', 'positioning-voice', 'trust-social-proof', 'funnel-activation'] },
          location: { type: 'string', description: 'file:line OR the page/route/email surface' },
          issue: { type: 'string', description: 'precisely what blocks discovery or conversion, vs which GTM rule' },
          impact: { type: 'string', description: 'the conversion/ranking/funnel consequence — be concrete about which step leaks' },
          fix: { type: 'string', description: 'the specific change (copy, meta, CTA, structured data, flow)' },
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
    isReal: { type: 'boolean', description: 'true only if this genuinely hurts discovery/conversion (not a subjective nitpick) and is consistent with the DECIDED GTM posture' },
    confidence: { type: 'string', enum: ['high', 'medium', 'low'] },
    reasoning: { type: 'string', description: 'cite the actual surface; would fixing it plausibly move ranking/conversion/funded-k?' },
    severityAfterReview: { type: 'string', enum: ['high', 'medium', 'low', 'not-an-issue'] },
  },
}

const DIMENSIONS = [
  { key: 'technical-seo', title: 'Technical SEO / crawlability / head',
    prompt: `Audit technical SEO: server/seoMeta.ts per-route title/desc/canonical/OG injection (is every public route covered, unique, right length?), the sitemap (all public + 51 states + compares listed, lastmod), robots/noindex correctness (kids' media noindexed, marketing indexed), structured data (Organization/FAQ/Breadcrumb/Product schema — present? valid?), internal linking between clusters, and any SPA route serving a generic head. Flag missing/duplicate/oversized meta and un-crawlable content.` },
  { key: 'content-seo', title: 'Content / intent SEO / cluster coverage',
    prompt: `Audit content-SEO against the intent x winnability map: are the gifter-occasion, parent-comparison (/compare/:slug), UTMA-education (state pages), and at-18 clusters actually built, internally linked, and targeting winnable long-tail (not head terms)? Hunt thin/duplicate programmatic pages, missing high-intent gifter-occasion pages we should own, comparison pages that don't actually answer "why not a 529 / free Fidelity UTMA", and orphaned content.` },
  { key: 'conversion-copy', title: 'Conversion copy / clarity / friction',
    prompt: `Audit the conversion path (Home -> GiveAGift / public gift link -> GiftCheckout -> GiftSuccess): is the value prop clear in 5 seconds, is the primary CTA singular and obvious, where's the friction (form length, account-required-too-early, unclear "what happens to my money"), and does the gifter flow capture intent (card at intent vs warm-promise leak)? Flag every step where a gifter could drop, and weak/buried/duplicated CTAs.` },
  { key: 'positioning-voice', title: 'Positioning / brand voice / differentiation',
    prompt: `Audit positioning against the ownable lane. Hunt BANNED/EarlyBird-clone phrases ("gift wealth not waste", "democratize generational wealth", origin-story tropes), generic me-too messaging that doesn't differentiate from free Fidelity/Schwab UTMA or 529, "giver" instead of "gifter", any stray "Kora" instead of "Kiddo", and places we under-use the ownable angles (love that compounds / companies they know / watch it land). Flag where the voice is generic or off-brand.` },
  { key: 'trust-social-proof', title: 'Trust / social proof / credibility',
    prompt: `Audit trust elements on conversion surfaces: fabricated/named-but-fake testimonials (must be honest), present-tense SIPC/"protected" claims pre-custody, missing trust signals at the payment moment (security, what-happens-next, refundability), credibility gaps for a money product handling kids' funds, and over-promises the funnel makes that the product can't keep. Flag dishonest or missing trust at each conversion step.` },
  { key: 'funnel-activation', title: 'Funnel / loop / activation',
    prompt: `Audit the gifter LOOP + activation: does a gift -> funded account -> the recipient/parent becoming a new gifter actually close, is activation tied to a FUNDED account (not just a click), are the re-loop hooks present (thank-you -> "start one for someone you love", occasion reminders, recurring-gift ask), and is funded-k measurable (the admin k-factor panel)? Flag where the loop leaks, activation is mis-defined, or a viral hook is missing/weak.` },
]

phase('Scope')
log(`Conversion audit — ${mode === 'diff' ? `diff vs ${base}` : 'all public + funnel surfaces'}. ${DIMENSIONS.length} growth specialists.`)

const perDimension = await pipeline(
  DIMENSIONS,
  (d) =>
    agent(
      `You are a senior growth/conversion specialist (${d.title}) for a zero-CAC gifter-loop fintech. ${CONTEXT}\n\n${scopeNote}\n\nDIMENSION: ${d.title}.\n${d.prompt}\n\nRead the ACTUAL pages/copy/config. Report ONLY findings that genuinely block discovery or conversion, tied to a location. Judge against the DECIDED GTM posture. No subjective taste nits, no relitigating channel strategy. If clean, return an empty findings array.`,
      { label: `audit:${d.key}`, phase: 'Audit', agentType: 'Explore', schema: FINDINGS_SCHEMA },
    ),
  (review, d) =>
    parallel(
      (review?.findings || []).map((f) => () =>
        parallel(
          ['real-problem-or-nitpick', 'does-it-actually-move-the-metric', 'on-brand-and-on-strategy'].map((lens) => () =>
            agent(
              `You are an adversarial growth reviewer. Try to REFUTE this finding via the "${lens}" lens. Read the actual surface at ${f.location}. Default to isReal=false if it's a subjective taste nit, wouldn't plausibly move ranking/conversion/funded-k, or contradicts the DECIDED GTM posture.\n\nFINDING: ${f.title}\nAREA: ${f.area}\nLOCATION: ${f.location}\nISSUE: ${f.issue}\nIMPACT: ${f.impact}\n\n${CONTEXT}`,
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
log(`Confirmed ${confirmed.length} conversion/discovery finding(s) after adversarial verification.`)

const report = await agent(
  `You are the lead growth reviewer writing the final report for the Kiddo founder. These findings survived 3-skeptic adversarial verification. Write a tight, prioritized markdown report: a one-line "biggest leak" summary, then findings grouped by severity, each with location, the conversion/ranking impact, and the fix — ordered by likely effect on FUNDED-k. Separate "quick copy/meta wins" from "structural funnel work". If clean, say the audited surfaces are conversion-sound and note coverage.\n\nCONFIRMED (JSON):\n${JSON.stringify(confirmed, null, 2)}`,
  { label: 'synthesize-report', phase: 'Report' },
)

return { confirmedCount: confirmed.length, confirmed, report }
