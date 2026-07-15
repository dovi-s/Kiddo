export const meta = {
  name: 'performance-audit',
  description:
    'Multi-agent performance/reliability/scale audit for Kiddo: specialists (web vitals & bundle, backend latency & DB, scalability & state, caching & network, reliability & resilience, mobile perf) hunt real speed/cost/scale problems against named thresholds (Core Web Vitals, DB best practice), each finding is adversarially verified + costed, a red-team completeness pass names misses, then a triaged report. Perf is SEO + conversion + cloud cost, so this pays for itself.',
  whenToUse:
    'Run before launch, after big features, before a traffic push, or when pages/queries feel slow. Pass {mode:"diff",base:"main"} to scope to a branch diff, {mode:"full"} for the whole app + server.',
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
    ? `Scope: ONLY the changes in the current branch vs \`${base}\` (git diff ${base}...HEAD) + the hot paths they touch.`
    : `Scope: the whole stack — client bundle + render (Vite/React 19), server hot paths (server/routes.ts ~20k lines, webhookHandlers, storage), the DB, workers/cron, third-party calls, and the native app.`

const CONTEXT = `
Kiddo: React 19 + TS client (Vite), Express + Drizzle/Postgres server, an Expo native app, Stripe +
email (Postmark/SendGrid) + market-data (Yahoo/Finnhub/Alpha-Vantage) integrations, plus workers/cron
(gift settlement, recurring auto-invest, age-18 transition, sponsored-sub renewal, account-deletion).
Hot paths: server/routes.ts (huge; /api/activities enriches each row with per-row storage.getGift +
storage.getFund — watch N+1), server/storage.ts (all DB ops), server/webhookHandlers.ts (Stripe
settlement + allocations), the Dashboard (there is a test:dashboard-bundle-budget guard) and the
Activity feed (can render 80+ rows + monthly grouping). Some state is in-memory / .local files
(rate-limiter, trial state) — a multi-instance prod risk.

Judge against NAMED thresholds — cite them in standardRef:
 - Core Web Vitals: LCP < 2.5s, INP < 200ms, CLS < 0.1 (field), TTFB reasonable.
 - JS bundle: per-route budget; avoid shipping the whole app on first paint (code-split).
 - DB: no N+1, indexed lookups for every WHERE/JOIN, bounded result sets, no full-table scans on
   hot paths, connection pooling.
 - Reliability: every third-party call has a timeout + failure handling; webhooks idempotent;
   no single in-memory/per-instance state that breaks horizontal scaling.
A finding must be a REAL, located cost — a measured-or-evident slow path / oversized payload /
unindexed query / unbounded scan / missing-resilience point — tied to a file:line, with the metric
it hurts and a costed fix. Not micro-optimizations with no user/cost impact.`

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
        required: ['title', 'severity', 'area', 'location', 'issue', 'metric', 'impact', 'effort', 'standardRef', 'fix'],
        properties: {
          title: { type: 'string' },
          severity: { type: 'string', enum: ['critical', 'high', 'medium', 'low'] },
          area: { type: 'string', enum: ['web-vitals-bundle', 'backend-db', 'scalability-state', 'caching-network', 'reliability-resilience', 'mobile-perf'] },
          location: { type: 'string', description: 'file:line and the route/screen' },
          issue: { type: 'string', description: 'the performance/scale/reliability problem, precisely' },
          metric: { type: 'string', description: 'what it hurts: LCP / INP / CLS / TTFB / bundle-KB / db-query-ms / N+1-count / cloud-cost / availability' },
          impact: { type: 'string', enum: ['high', 'medium', 'low'], description: 'user-facing or cost/scale impact' },
          effort: { type: 'string', enum: ['S', 'M', 'L'] },
          standardRef: { type: 'string', description: 'the threshold/best-practice it misses (e.g. CWV LCP<2.5s, no-N+1, indexed-lookup)' },
          fix: { type: 'string', description: 'the specific remediation (index, batch query, code-split, cache, timeout, move state to Postgres)' },
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
    isReal: { type: 'boolean', description: 'true only if it is a real, evident cost on a path that matters (not a speculative micro-opt, not already-cached/indexed/bounded)' },
    confidence: { type: 'string', enum: ['high', 'medium', 'low'] },
    reasoning: { type: 'string', description: 'trace the actual path; is it on a hot path, and is the cost real vs negligible?' },
    severityAfterReview: { type: 'string', enum: ['critical', 'high', 'medium', 'low', 'not-an-issue'] },
  },
}

const DIMENSIONS = [
  { key: 'web-vitals-bundle', title: 'Web vitals / bundle / render',
    prompt: `Audit front-end performance: JS bundle size + code-splitting (is the whole app shipped on first paint? heavy deps on the landing/gift pages?), render-blocking resources, image/media optimization (kids' photos/videos, logos), font loading (Bricolage), layout shift (CLS) from late-loading content, expensive re-renders / unmemoized lists (the Activity feed's 80+ rows + grouping), and hydration cost. Respect the test:dashboard-bundle-budget guard. Cite the CWV metric + a budget.` },
  { key: 'backend-db', title: 'Backend latency / DB / N+1',
    prompt: `Audit server + DB hot paths: N+1 queries (notably /api/activities enriching each row with per-row getGift/getFund — quantify it), missing indexes on hot WHERE/JOIN columns (fund_id, user_id, etc.), unbounded queries/pagination, expensive synchronous work in request handlers, the 20k-line routes.ts hot endpoints, and JSON-string metadata parsing in loops. Cite query counts / index gaps.` },
  { key: 'scalability-state', title: 'Scalability / shared state / workers',
    prompt: `Audit horizontal-scale readiness: in-memory or .local-file state that breaks multi-instance (rate-limiter, reverse-trial/monetization state, any module-level cache) — these silently corrupt or reset under >1 instance; connection-pool sizing; worker/cron safety under multiple instances (double-firing settlement/recurring without locks); Stripe webhook throughput + idempotency under burst. Cite the state that won't survive a second instance.` },
  { key: 'caching-network', title: 'Caching / network / redundant work',
    prompt: `Audit caching + network: react-query staleTime/caching usage (over-fetching, refetch storms, missing cache on stable data), static-asset + CDN caching headers, API responses that should be cacheable but aren't, the SSR head-injection cost per request, duplicate/waterfall fetches on key screens, and payloads that over-return fields. Cite the redundant work + the fix.` },
  { key: 'reliability-resilience', title: 'Reliability / resilience / failure handling',
    prompt: `Audit resilience: third-party calls (Stripe, Postmark/SendGrid, market-data) without timeouts or failure handling (a hung dependency stalling a request), missing retries/backoff + idempotency on money/email paths, market-quote fallback behavior, error boundaries on the client, graceful degradation when a dependency is down, and unhandled-rejection / crash paths. Cite the unguarded dependency call.` },
  { key: 'mobile-perf', title: 'Native app performance',
    prompt: `Audit the Expo native app: list virtualization (the Activity tab rendering many transactions — FlatList vs map-in-ScrollView), image loading/caching for gifter media + logos, unnecessary re-renders, heavy work on the JS thread, bundle/startup cost, and any web-shaped pattern that's expensive on a phone. Cite the screen + the pattern.` },
]

phase('Scope')
log(`Performance audit — ${mode === 'diff' ? `diff vs ${base}` : 'whole stack'}. ${DIMENSIONS.length} performance specialists.`)

const perDimension = await pipeline(
  DIMENSIONS,
  (d) =>
    agent(
      `You are a senior performance engineer (${d.title}) with a high bar — perf is SEO, conversion, and cloud cost. ${CONTEXT}\n\n${scopeNote}\n\nDIMENSION: ${d.title}.\n${d.prompt}\n\nRead the ACTUAL code. Report ONLY real, located costs on paths that matter, each with the metric it hurts, an impact level, an effort (S/M/L), and the threshold/best-practice it misses. No speculative micro-optimizations. If clean, return an empty findings array.`,
      { label: `audit:${d.key}`, phase: 'Audit', agentType: 'Explore', schema: FINDINGS_SCHEMA },
    ),
  (review, d) =>
    parallel(
      (review?.findings || []).map((f) => () =>
        parallel(
          ['is-it-on-a-hot-path', 'is-the-cost-real-or-negligible', 'already-cached-indexed-or-bounded'].map((lens) => () =>
            agent(
              `You are an adversarial performance reviewer. Try to REFUTE this finding via the "${lens}" lens. Read the actual code at ${f.location}. Default to isReal=false if it's a negligible/micro cost, not on a path that matters, or already cached/indexed/bounded.\n\nFINDING: ${f.title}\nAREA: ${f.area}\nLOCATION: ${f.location}\nISSUE: ${f.issue}\nMETRIC: ${f.metric}\n\n${CONTEXT}`,
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
log(`Confirmed ${confirmed.length} performance finding(s). Running red-team completeness pass.`)

const completeness = await agent(
  `You are the performance red-team LEAD reviewing this audit for COMPLETENESS. ${CONTEXT}\n\nDimensions covered: ${DIMENSIONS.map((d) => d.title).join('; ')}.\nConfirmed findings: ${JSON.stringify(confirmed.map((f) => ({ title: f.title, area: f.area, severity: f.severity, metric: f.metric })), null, 2)}\n\nName, specifically and citing where to look: (1) the single highest-impact performance/scale problem you suspect was MISSED; (2) any blind-spot area a top-tier perf team would cover that isn't in the dimension list; (3) whether the severity calibration looks right. If coverage looks complete, say so and why.`,
  { label: 'red-team-completeness', phase: 'Report' },
)

const report = await agent(
  `You are the lead performance reviewer writing the final report for the Kiddo team. These findings survived 3-reviewer adversarial verification. Write a tight, triaged markdown report: (1) a one-line "is it fast + scalable enough to launch" verdict; (2) findings grouped by severity, each with location, the metric hurt, impact, effort (S/M/L), the threshold missed, and the fix — ordered by impact-per-effort; (3) a "scale cliffs" note (what breaks at 10x/100x traffic); (4) the red-team completeness review verbatim. If clean, say the audited paths meet the bar and note coverage.\n\nCONFIRMED (JSON):\n${JSON.stringify(confirmed, null, 2)}\n\nRED-TEAM COMPLETENESS REVIEW:\n${completeness}`,
  { label: 'synthesize-report', phase: 'Report' },
)

return { confirmedCount: confirmed.length, confirmed, completeness, report }
