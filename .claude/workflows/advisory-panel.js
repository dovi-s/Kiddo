export const meta = {
  name: 'advisory-panel',
  description:
    'Multi-agent expert advisory panel for Kiddo decisions: independent specialists (securities/investment counsel, money-transmission & BSA/AML compliance, tax/UTMA, payments architect, consumer-protection/disclosures, pragmatic GC) each give a grounded position, each position is adversarially cross-examined by opposing counsel, then a lead synthesizes a DECISION MEMO that splits "safe to proceed NOW" from "needs a licensed human sign-off". Decision-support — NOT a substitute for licensed counsel on liability-bearing calls.',
  whenToUse:
    'When facing a structuring / compliance / strategy decision (e.g. P0-1 holding gift funds pre-account) and you want expert perspectives to weigh in, debate, and converge before you act or brief a real professional. Pass {question, context} to scope it; defaults to the P0-1 capture-money-at-intent decision.',
  phases: [
    { title: 'Brief' },
    { title: 'Positions' },
    { title: 'Cross-examine' },
    { title: 'Decision' },
  ],
}

// ── Inputs ──────────────────────────────────────────────────────────────────
const DEFAULT_QUESTION = `P0-1 "capture money at intent": today /give-a-gift (server/routes.ts:14575) records a no-card gift_intents row that only pays if the gifter makes a SECOND trip after the parent creates a fund — the make-or-break leak. We want to capture the gifter's payment at the emotional moment and settle when the parent's fund is created. THREE options (see P0-1_SPEC_CAPTURE_AT_INTENT.md): A) auth-and-hold (Stripe manual capture; ~7-day auth expiry); B) charge-and-hold/escrow (capture now, hold as refundable liability, invest-or-refund — best conversion, but we hold customer funds pre-account); C) vault-and-charge-later (SetupIntent saves the card now, off-session charge when the fund is created — no funds held). THE DECISION: which option, and specifically — is Option C buildable NOW without waiting on a licensed legal opinion, given it never holds funds? What MUST a human attorney still sign off on before it ships?`

const question = (args && args.question) || DEFAULT_QUESTION
const extraContext = (args && args.context) || ''

// What this product is — every adviser needs this to judge real exposure.
const CONTEXT = `
Kiddo is a US custodial-UTMA investment-gifting fintech. Anyone can gift money toward a child's
account (custodial UTMA held by a broker-dealer partner). Custody is a SCAFFOLD STUB today —
"investing" is a local-DB simulation; no real custodian wired; no AUM fee collected yet. The AUM
regulatory question (RIA/custody structure) is already out to securities counsel (see
LAWYER_Q_HOLDING_GIFT_FUNDS.md + the AUM engagement brief). Payments run on Stripe. The gift
lifecycle: gift_intents (pending→paired→completed) and gifts (pending→invested). Relevant code:
server/routes.ts (gift-intents :14575, fund-creation pairing :3402), server/webhookHandlers.ts
(Stripe settlement, investGiftImmediatelyIfNeeded), P0-1_SPEC_CAPTURE_AT_INTENT.md (the 3-option
spec), CLAUDE.md (provider-integration boundaries). The company is pre-launch; the goal is the
fastest RESPONSIBLE path to a working, compliant gifter loop. Read these files before opining.
${extraContext ? `\nADDITIONAL CONTEXT FROM THE CALLER:\n${extraContext}` : ''}`

const POSITION_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['recommendation', 'keyReasoning', 'safeToProceedNow', 'whatNeedsHumanSignoff', 'risksIfWrong', 'confidence', 'openQuestions'],
  properties: {
    recommendation: { type: 'string', description: 'this adviser\'s concrete recommended action on the decision' },
    keyReasoning: { type: 'string', description: 'the load-bearing reasoning, grounded in real rules/code, not generic' },
    safeToProceedNow: { type: 'boolean', description: 'true if SOME concrete part can responsibly be built/shipped before a licensed sign-off' },
    whatCanProceed: { type: 'string', description: 'if safeToProceedNow, exactly what is safe to build now; else empty' },
    whatNeedsHumanSignoff: { type: 'string', description: 'the specific thing a licensed human must approve before it ships' },
    risksIfWrong: { type: 'string', description: 'the concrete downside if this recommendation is wrong (fines, rescission, liability, rework)' },
    confidence: { type: 'string', enum: ['high', 'medium', 'low'] },
    openQuestions: { type: 'array', items: { type: 'string' }, description: 'questions that must be answered to finalize' },
  },
}

const CRITIQUE_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['strongestCounter', 'holdsUp', 'worstCaseIfFollowed', 'amendedRecommendation'],
  properties: {
    strongestCounter: { type: 'string', description: 'the sharpest argument AGAINST this position' },
    holdsUp: { type: 'boolean', description: 'does the original position survive the counter?' },
    worstCaseIfFollowed: { type: 'string', description: 'realistic worst case if the team follows this and it is wrong' },
    amendedRecommendation: { type: 'string', description: 'the position as it should read after the critique (may equal the original)' },
  },
}

// ── The panel: each = one independent adviser persona ────────────────────────
const ADVISERS = [
  { key: 'securities', title: 'Securities & investment-adviser counsel',
    prompt: `You are a US securities lawyer (\'40 Act / Advisers Act / custody rule / UTMA gift law). Weigh in on the decision below. Does capturing a gifter payment pre-account, or saving a card to charge later, implicate broker-dealer/RIA/custody rules or change the UTMA gift's legal character or completion? Which option is cleanest? Ground every point in the actual rule and the repo.` },
  { key: 'mtl-aml', title: 'Money-transmission & BSA/AML compliance',
    prompt: `You are a fintech money-transmission / BSA-AML compliance expert. The crux: does HOLDING a gifter's funds before the destination account exists (Option B) make Kiddo a money transmitter / trigger state MTL, FinCEN MSB registration, or safeguarding duties? Does Option C (card vaulted, charged later, never held by us) avoid that? What FBO/segregated structure would make B clean? Be specific about thresholds and what's de-minimis vs not.` },
  { key: 'tax', title: 'Tax adviser (gift / UTMA / kiddie-tax)',
    prompt: `You are a tax attorney/CPA. Focus narrowly: does holding-then-investing (B) or vault-then-charge (C) change the gift's completion date (date of charge vs date of investment), and what must the gifter be told for tax purposes? Any kiddie-tax or UTMA-irrevocability wrinkle introduced by the timing? Reference shared/legal-copy.ts KIDDIE_TAX_NOTE if relevant.` },
  { key: 'payments', title: 'Payments architect (Stripe / PCI / ops risk)',
    prompt: `You are a senior payments engineer. Compare the three options on Stripe mechanics, failure modes, and operational risk: manual-capture auth expiry (~7d), capture-and-refund flows, SetupIntent + off-session charge declines, idempotency, PCI scope, and reconciliation. Which is most robust to build correctly NOW given the existing webhook/settlement code? Read P0-1_SPEC_CAPTURE_AT_INTENT.md.` },
  { key: 'consumer', title: 'Consumer-protection & disclosures counsel',
    prompt: `You are a consumer-financial-protection lawyer (UDAAP / Reg E / state UDAP). What MUST the gifter be told at the moment we capture a card or vault it to charge later — that money is held/charged-later, the refund terms, what happens if the parent never sets up the fund? Draft the minimum required point-of-charge disclosure language for the recommended option.` },
  { key: 'gc', title: 'Pragmatic general counsel / business judgment',
    prompt: `You are the startup's pragmatic GC. Cut through it: weigh ship-now value vs. real (not theoretical) legal exposure for a pre-launch company. Is Option C a responsible "build now, sanity-check in parallel" call, or must everything wait for the licensed opinion? What would a reasonable GC greenlight today, and what would they refuse? Give a clear go/no-go with conditions.` },
]

// ── Run: position → opposing-counsel cross-examination, pipelined ────────────
phase('Brief')
log(`Advisory panel — ${ADVISERS.length} specialists weighing in. Decision-support only; licensed sign-off still required on liability-bearing calls.`)

const perAdviser = await pipeline(
  ADVISERS,
  (a) =>
    agent(
      `${a.prompt}\n\n${CONTEXT}\n\nTHE DECISION:\n${question}\n\nRead the relevant repo files first. Give a grounded, specific position — no generic boilerplate, no "consult an attorney" hand-waving (you ARE the specialist; say what YOU would advise and why). Distinguish what is genuinely safe to do now from what needs a licensed sign-off.`,
      { label: `position:${a.key}`, phase: 'Positions', agentType: 'Explore', schema: POSITION_SCHEMA },
    ),
  // Opposing counsel: stress-test each position with the sharpest counter.
  (position, a) =>
    agent(
      `You are opposing counsel / a skeptical senior partner reviewing a colleague's advice. Find the STRONGEST argument against the position below and state the realistic worst case if the team follows it and it's wrong. Be adversarial but fair; if it holds up, say so.\n\n${CONTEXT}\n\nTHE DECISION:\n${question}\n\nCOLLEAGUE (${a.title}) POSITION:\n${JSON.stringify(position, null, 2)}`,
      { label: `cross-exam:${a.key}`, phase: 'Cross-examine', agentType: 'Explore', schema: CRITIQUE_SCHEMA },
    ).then((critique) => ({ adviser: a.title, key: a.key, position, critique })),
)

const dossier = perAdviser.filter(Boolean)

// ── Synthesize the decision memo ─────────────────────────────────────────────
phase('Decision')
log(`Collected ${dossier.length} cross-examined positions. Synthesizing the decision memo.`)

const memo = await agent(
  `You are the lead adviser chairing the panel, writing the DECISION MEMO for the Kiddo founder. Below are ${dossier.length} specialist positions, each already stress-tested by opposing counsel. Synthesize a tight, decisive markdown memo:

1. **The decision** — one-line recommended answer (which option, and is it buildable now?).
2. **Why** — the load-bearing consensus reasoning (note any real dissent and how you weigh it).
3. **✅ Safe to proceed NOW** — the specific things the team can responsibly build/ship before a licensed sign-off.
4. **🔴 Needs a licensed human sign-off before it ships** — the specific items, and which professional (securities counsel / MTL-AML / tax / consumer) owns each.
5. **Required disclosures** — the minimum point-of-charge language for the recommended option (quote it).
6. **Open questions to send the real lawyer** — bullet list, ready to forward.

Be decisive and non-hand-wavy. END with a one-paragraph standing disclaimer: this panel is AI decision-support that structures the call and sharpens what to ask a licensed professional — it is NOT legal/tax advice and does not replace a human attorney's signature on anything that bears liability.

CROSS-EXAMINED POSITIONS (JSON):
${JSON.stringify(dossier, null, 2)}`,
  { label: 'decision-memo', phase: 'Decision' },
)

return { advisers: dossier.length, dossier, memo }
