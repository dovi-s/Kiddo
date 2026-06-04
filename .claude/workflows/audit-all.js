export const meta = {
  name: 'audit-all',
  description:
    'Runs every Kiddo domain audit (security, compliance/regulatory/legal, finance/fintech, conversion/SEO/messaging, design/UX/UI) in sequence and synthesizes ONE launch-readiness executive summary across all of them. Heavy — spawns many agents. Pass {only:["finance","design"]} to run a subset, {mode:"diff",base:"main"} to scope each to the branch diff.',
  whenToUse:
    'The pre-launch / quarterly "audit everything" sweep. For a single domain, run that domain audit directly instead (cheaper).',
  phases: [
    { title: 'Security' },
    { title: 'Compliance / regulatory / legal' },
    { title: 'Finance / fintech correctness' },
    { title: 'SEO / messaging / conversion' },
    { title: 'UX / UI / design' },
    { title: 'Executive summary' },
  ],
}

// The full roster. `only` filters by substring so {only:["finance","design"]} works.
const AUDITS = [
  { name: 'security-audit', label: 'Security' },
  { name: 'compliance-audit', label: 'Compliance / regulatory / legal' },
  { name: 'finance-audit', label: 'Finance / fintech correctness' },
  { name: 'conversion-audit', label: 'SEO / messaging / conversion' },
  { name: 'design-audit', label: 'UX / UI / design' },
]
const only = args && Array.isArray(args.only) ? args.only : null
const selected = only ? AUDITS.filter((a) => only.some((o) => a.name.includes(String(o)))) : AUDITS
const childArgs = { mode: (args && args.mode) || 'full', base: (args && args.base) || 'main' }

log(`audit-all — running ${selected.length} domain audit(s): ${selected.map((a) => a.name).join(', ')}. This is heavy.`)

// Sequential on purpose: paces the token spend, keeps clear per-audit progress,
// and a mid-run interrupt still leaves the completed reports intact. Each child
// shares this run's concurrency cap + token budget; a failing audit is caught so
// one bad domain doesn't sink the sweep.
const results = []
for (const a of selected) {
  phase(a.label)
  log(`Running ${a.name}...`)
  try {
    const r = await workflow(a.name, childArgs)
    results.push({ audit: a.name, label: a.label, ok: true, confirmedCount: r && r.confirmedCount != null ? r.confirmedCount : null, report: (r && r.report) || '(no report returned)' })
  } catch (err) {
    const msg = err && err.message ? err.message : String(err)
    log(`${a.name} failed: ${msg}`)
    results.push({ audit: a.name, label: a.label, ok: false, error: msg })
  }
}

phase('Executive summary')
const reportsBlock = results
  .map((r) => `## ${r.label} (${r.audit})\n${r.ok ? r.report : 'FAILED: ' + r.error}`)
  .join('\n\n')

const executiveSummary = await agent(
  `You are the lead reviewer writing ONE executive summary across all of Kiddo's domain audits below. Produce, in tight markdown: (1) a launch-readiness verdict in 2-3 sentences; (2) the TOP cross-cutting risks, ranked, each tagged with its audit + severity; (3) three buckets — "Must fix before launch", "Soon", and "Needs a licensed human" — pulling the highest items from each domain; (4) name any domain that came back clean. Be precise and non-alarmist. Do NOT invent findings — synthesize only what the audits below actually reported.\n\nAUDIT REPORTS:\n${reportsBlock}`,
  { label: 'executive-summary', phase: 'Executive summary' },
)

return {
  ran: results.map((r) => ({ audit: r.audit, ok: r.ok, confirmedCount: r.confirmedCount ?? null })),
  executiveSummary,
  reports: results,
}
