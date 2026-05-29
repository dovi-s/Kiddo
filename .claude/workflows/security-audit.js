export const meta = {
  name: 'security-audit',
  description:
    'Multi-agent security audit for the Kiddo fintech: parallel specialist auditors hunt NEW vulns by dimension, each finding is adversarially verified by skeptics, then synthesized into a triaged report. Complements test:security-regression (which only re-checks known fixes).',
  whenToUse:
    'Run before launch, after large changes, on a schedule, or per-PR. Pass {mode:"diff",base:"main"} to scope to a branch diff, or {mode:"full"} for a whole-tree sweep.',
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
    ? `Scope: ONLY the changes in the current branch vs \`${base}\` (use git diff ${base}...HEAD to find changed files, then audit those + the code they touch).`
    : `Scope: the whole server + client codebase, prioritizing money/PII/auth paths.`

// What this product is — every auditor needs this context to judge severity.
const CONTEXT = `
Kiddo is a US custodial-UTMA investment-gifting fintech (React 19 + TS client, Express +
Drizzle/Postgres server in server/, shared schema in shared/schema.ts). It holds children's
PII (name, DOB, photo, SSN on funds), parents' PII, and moves gift money via Stripe into
funds. Custody (DriveWealth/Alpaca) is a SCAFFOLD STUB — "investing" is a local-DB simulation
today. Key money/PII surfaces: server/routes.ts (~20k lines, fund/gift endpoints),
server/webhookHandlers.ts (Stripe webhooks, gift settlement, allocations), server/auth.ts
(passport local + sessions, account deletion), server/storage.ts (all DB ops),
server/accountDeletionWorker.ts (PII scrub), public /uploads (kids' media). Per-fund access
is gated by an owner/collaborator model; many endpoints live under /api/funds/:fundId.
Known past classes (already fixed, do NOT re-report unless reintroduced): gift double-credit,
collaborator IDOR, public balance leak, mass-assignment on /api/funds, KidView PIN/takeover,
stored XSS on public gift page, SSN-only deletion scrub.`

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
        required: ['title', 'severity', 'file', 'line', 'description', 'exploit', 'fix'],
        properties: {
          title: { type: 'string' },
          severity: { type: 'string', enum: ['critical', 'high', 'medium', 'low'] },
          file: { type: 'string', description: 'path:line of the vulnerable code' },
          line: { type: 'number' },
          description: { type: 'string', description: 'what the flaw is, precisely' },
          exploit: { type: 'string', description: 'concrete attack: who does what, what they gain' },
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
    isReal: { type: 'boolean', description: 'true only if the exploit genuinely works against the actual code' },
    confidence: { type: 'string', enum: ['high', 'medium', 'low'] },
    reasoning: { type: 'string', description: 'why it is real or a false positive — cite the actual code path' },
    severityAfterReview: { type: 'string', enum: ['critical', 'high', 'medium', 'low', 'not-a-bug'] },
  },
}

// ── The team: specialist dimensions (each = one finder agent) ────────────────
const DIMENSIONS = [
  { key: 'authz-idol', title: 'AuthZ / IDOR / fund access',
    prompt: `Hunt broken access control: can user A read/mutate user B's fund, gift, memory, collaborator, or KYC? Check every /api/funds/:fundId handler for missing owner/collaborator checks, the req.fundAccessRole idiom misused on bare paths, and any mutation that trusts a client-supplied id. Also: mass-assignment (client setting balance/status/role), and session/auth bypass.` },
  { key: 'money', title: 'Money integrity',
    prompt: `Hunt money bugs: double-credit/replay on gift settlement (Stripe webhook idempotency), refund/chargeback not reversing balance, fee math (0.10% AUM, gross-vs-net), withdrawal/transfer flows letting funds exceed real balance, race conditions on concurrent gifts, currency/decimal (Drizzle decimals are strings) errors that create or destroy money.` },
  { key: 'pii', title: 'PII / privacy / COPPA',
    prompt: `Hunt PII exposure of children + parents: SSN/DOB/name/photo leaking via API responses, logs, public endpoints, or /uploads (kids' media). Check public/unauthenticated endpoints for over-returning fields, the account-deletion scrub for gaps, and any endpoint that returns more than the caller should see. Children's data is COPPA-sensitive.` },
  { key: 'injection', title: 'Injection / XSS / SSRF',
    prompt: `Hunt injection: SQL (raw/sql\`\` with interpolation in storage.ts/routes.ts), stored/reflected XSS in user-supplied memory notes/names/gift messages rendered without sanitization, SSRF in any URL-fetch, path traversal in file/upload handling, prototype pollution in object merges.` },
  { key: 'secrets-config', title: 'Secrets / config / headers',
    prompt: `Hunt secret + config flaws: secrets in code/logs/responses, missing or weak CSP/CORS/cookie flags, debug/admin endpoints reachable without auth, env-driven security toggles that fail open, the in-memory vs shared rate-limiter coverage, and any "demo mode" bypass that could leak into production.` },
  { key: 'auth-session', title: 'Auth / session / account lifecycle',
    prompt: `Hunt auth lifecycle flaws: session fixation/regeneration gaps, password-reset/magic-link/OAuth-linking token issues, KYC bypass (the format-stub auto-approve), account-deletion/restore token forgery, privilege escalation via collaborator/co-parent invites, and the founder-claim flow.` },
  { key: 'custody-regulatory', title: 'Custody honesty / regulatory copy',
    prompt: `Hunt false/over-claiming statements that are a legal risk while custody is a stub: present-tense SIPC/custody copy (must be conditional "when investing is live"), hard-named custodian, "SEC RIA"/adviser claims, fabricated testimonials/returns, projections without disclaimers. Cross-check CUSTODIAN_SOURCE_OF_TRUTH.md and ACCOUNT_MODEL.md.` },
]

// ── Run: find → adversarially verify, pipelined so each dimension's findings
//    get verified the moment that dimension finishes (no barrier). ───────────
phase('Scope')
log(`Security audit — ${mode === 'diff' ? `diff vs ${base}` : 'full codebase'}. ${DIMENSIONS.length} specialist auditors.`)

const perDimension = await pipeline(
  DIMENSIONS,
  (d) =>
    agent(
      `You are a senior application-security auditor. ${CONTEXT}\n\n${scopeNote}\n\nDIMENSION: ${d.title}.\n${d.prompt}\n\nRead the actual code. Report ONLY findings you can tie to a real file:line and a concrete exploit. No speculation, no style nits. If nothing real, return an empty findings array.`,
      { label: `audit:${d.key}`, phase: 'Audit', agentType: 'Explore', schema: FINDINGS_SCHEMA },
    ),
  // Verify each finding with 3 independent skeptics (distinct lenses), majority rules.
  (review, d) =>
    parallel(
      (review?.findings || []).map((f) => () =>
        parallel(
          ['exploitability', 'code-reality', 'severity'].map((lens) => () =>
            agent(
              `You are an adversarial security reviewer. Try to REFUTE this finding via the ${lens} lens. Read the actual code at ${f.file}. Default to isReal=false if the exploit does not genuinely work or the code already guards it.\n\nFINDING: ${f.title}\nFILE: ${f.file}\nCLAIM: ${f.description}\nEXPLOIT: ${f.exploit}\n\n${CONTEXT}`,
              { label: `verify:${d.key}:${f.title.slice(0, 24)}`, phase: 'Verify', agentType: 'Explore', schema: VERDICT_SCHEMA },
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

const confirmed = perDimension
  .flat()
  .filter(Boolean)
  .filter((f) => f && f.confirmed)

// ── Synthesize a triaged report ─────────────────────────────────────────────
phase('Report')
const order = { critical: 0, high: 1, medium: 2, low: 3 }
confirmed.sort((a, b) => (order[a.severity] ?? 9) - (order[b.severity] ?? 9))

log(`Confirmed ${confirmed.length} finding(s) after adversarial verification.`)

const report = await agent(
  `You are the lead security reviewer writing the final report for the Kiddo team. Below are security findings that survived 3-skeptic adversarial verification (majority real). Write a tight, triaged markdown report: a one-line risk summary, then findings grouped by severity, each with file:line, the exploit in one sentence, and the fix. Be precise and non-alarmist; if the list is empty, say the audited scope is clean and note what was covered.\n\nCONFIRMED FINDINGS (JSON):\n${JSON.stringify(confirmed, null, 2)}`,
  { label: 'synthesize-report', phase: 'Report' },
)

return { confirmedCount: confirmed.length, confirmed, report }
