// Source of truth for two legal blurbs that kept DRIFTING across surfaces and
// caused real errors during the 2026-05 copy sweep:
//
//  - The KIDDIE-TAX fact was wrong on FOUR surfaces (Age18Plan, FAQ, Age18,
//    Age18Welcome): three claimed a rosy "0% at 18" omitting the caveat, and
//    one flatly told the kid "the kiddie tax is over." It is NOT over at 18.
//  - The PROJECTION disclaimer wording varied; some instances omitted the
//    "not guaranteed" hedge entirely.
//
// RULE — kiddie tax: any surface describing the at-majority / teen tax picture
// MUST convey that the kiddie tax can still apply through age 18, and for a
// full-time student under 24 whose parents provide most support — taxing larger
// UNEARNED gains at the PARENT's rate until it no longer applies; the 0%
// long-term-gains benefit only arrives AFTER that. Audience-tailored phrasing
// is fine (you / your child / a specific name) AS LONG AS it carries that fact.
// Use KIDDIE_TAX_NOTE verbatim wherever an audience-neutral sentence fits.
//
// RULE — projections: any projected dollar figure MUST be hedged with (a) the
// assumed rate AND that it's net of Kiddo's annual fee, and (b) that returns are
// NOT guaranteed. Wording may be tailored (kid-emotional, gifter, advisor); the
// multi-rate calculator + KidView intentionally keep their tailored variants.
// Use PROJECTION_DISCLAIMER verbatim wherever a terse standalone line fits.
//
// Surfaces to keep consistent —
//   kiddie tax: TaxDocuments, FAQ, Age18Plan, Age18, Age18Welcome, Settings tax.
//   projection: CalculatorAt18, Projection, KidView, Claim, GiftSuccess,
//               RobuxVsUtma, TrumpAccountVsUtma, Age18Plan, FundSnapshot,
//               GifterDashboard.

export const KIDDIE_TAX_NOTE =
  "The kiddie tax can still apply through age 18, and for a full-time student under 24 whose parents provide most of their support. While it applies, larger investment gains are taxed at the parent's rate, not the child's. After it no longer applies, a low earner's long-term gains can be taxed as low as 0%.";

export const PROJECTION_DISCLAIMER =
  "Assumes a 7% average annual return, net of Kiddo's annual fee ($1/yr per $1,000 invested). Markets vary; returns are never guaranteed.";

// RULE — financial aid: a UTMA/UGMA is the CHILD's asset, so the FAFSA counts
// it more heavily against need-based aid than a parent-owned asset like a 529
// (student assets reduce eligibility by up to ~20% of their value; parent
// assets by up to ~5.64%). This is true of EVERY custodial account, Kiddo
// included — a known, material downside vs a 529 for families optimizing
// college aid. We DISCLOSE it rather than dodge it: for the trust-anchor
// brand, being caught omitting a known downside is the only losing move (added
// 2026-06-07 after a competitor-weakness review surfaced it as the sharpest
// honest gap). The counterweight is real and gets said in the same breath:
// UTMA flexibility (the money can go to ANYTHING that benefits the child, not
// only tuition) + the gift loop + the Memory Book + ownership at majority —
// none of which a 529 does. Use FINANCIAL_AID_NOTE verbatim where a neutral
// standalone line fits; tailored variants must still carry the
// student-asset-weighed-more fact and the not-just-college counterweight.
// Rates are inflation/policy-adjustable — keep the "up to ~X%" hedge so a
// missed update reads as approximate, not wrong.
export const FINANCIAL_AID_NOTE =
  "Because this is a custodial account, it counts as the child's own asset on the FAFSA — which can reduce need-based college aid more than a parent-owned 529 (student assets are weighed at up to ~20% of their value, parent assets at up to ~5.64%). The tradeoff is flexibility: unlike a 529, the money can go toward anything that benefits the child, not only tuition. If maximizing need-based college aid is your main goal, weigh a 529 too, or ask a financial-aid advisor.";

// RULE - gift-tax exclusion: the IRS annual gift-tax exclusion changes most
// years with inflation ($17,000 in 2023, $18,000 in 2024, $19,000 in 2025). It
// was hardcoded across ~7 surfaces (gift-checkout, education tooltips, Legal,
// gifter emails) and DRIFTED: some still said "$18,000 for 2024" while others
// said $19,000. Reference these constants everywhere instead of a literal, and
// update the ONE value each January when the IRS publishes the new figure. Keep
// copy year-agnostic ("$19,000 per recipient") rather than "for 2025", so a
// missed update reads as merely outdated, not wrong-for-the-stated-year.
export const GIFT_TAX_EXCLUSION = 19000;
export const GIFT_TAX_EXCLUSION_LABEL = "$19,000";

// The kiddie-tax unearned-income threshold (the amount of a child's unearned
// income above which the parent's rate can kick in). Also inflation-adjusted
// yearly ($2,600 in 2024, $2,700 in 2025) and it had drifted too: education.tsx
// said $2,600 while FAQ / Legal / gifter emails said $2,700.
export const KIDDIE_TAX_UNEARNED_THRESHOLD = 2700;
export const KIDDIE_TAX_UNEARNED_THRESHOLD_LABEL = "$2,700";

// Surfaces that hardcode these yearly figures (sweep them when the IRS updates):
//   gift exclusion: education.tsx, GiftCheckout, Legal, gifterNotificationWorker,
//                   gifterYearEndSummary.
//   kiddie threshold: education.tsx, FAQ, Legal, gifterNotificationWorker.
//   lifetime exemption ($13.99M 2025): education.tsx only (single source today).

// RULE — investing-live state: investing is NOT live yet (no custodian wired;
// holdings are a local simulation and the AUM fee is display-only). So EVERY
// customer-facing claim about buying/holding securities, SIPC coverage, and
// broker-dealer-issued tax forms is HEDGED with "once/when investing is live".
// This hedge is the most pervasive piece of custody copy in the product
// (~30 files, ~50 sentences) and has been swept + CI-guarded.
//
// There is deliberately NO boolean threaded through all 50 of those sentences:
// the "live" wording depends on the real custodian's name/terms (vendor not yet
// picked), and the flip is a counsel-reviewed event, not a silent toggle — so
// pre-writing 50 live variants now would be speculative and could become false
// claims the moment someone flipped a switch without re-reading them.
//
// INSTEAD, the atomic-flip hygiene is two-part:
//   (1) NEW hedged copy whose live wording is custodian-AGNOSTIC (app-flow
//       mechanics, not SIPC/broker/tax legal copy) should gate on
//       `investingLiveCopy()` so it flips with the constant below.
//   (2) The FLIP CHECKLIST enumerates every existing surface to RE-READ (not
//       blindly find/replace) against the real custodian's terms when custody
//       goes live. Flipping = set INVESTING_LIVE = true AND walk the checklist.
export const INVESTING_LIVE = false;

// Paved path for (1). Use for new hedged, custodian-agnostic copy so it joins
// the atomic flip instead of hand-typing the phrase (hand-typing is exactly how
// the existing sentences drifted apart in wording).
export function investingLiveCopy(liveText: string, pendingText: string): string {
  return INVESTING_LIVE ? liveText : pendingText;
}

// FLIP CHECKLIST — surfaces that hand-encode the "once/when investing is live"
// hedge today. When INVESTING_LIVE flips true, RE-READ each against the real
// custodian's name + terms (do not just delete the phrase):
//   client: App, About, UtmaByState, TaxDocuments, TaxDocsExplainer, Security,
//     GiftCheckout (SIPC/large-gift lines — the "Where this gift goes" + share
//     estimate already route through investingLiveCopy), FundSnapshot, FAQ,
//     Pricing, Login, Legal, CalculatorAt18, HowItWorks, Home, GiftSuccess,
//     Claim, Account, Settings (Money tab "Investing is active" status +
//     body route through investingLiveCopy), Footer, ui/education,
//     ui/ux-foundations.
//   ⚠️ KidView — currently UNCONDITIONED, not just a re-read item. The
//     COMPANY_EXPLAINERS dictionary states present-tense ownership ("You own a
//     tiny piece of Disney…", ~41 strings) and the "What you own" section
//     headers do NOT route through investingLiveCopy. In-app post-funding
//     surface, so it only deceives a real kid if the kid view is reachable
//     before INVESTING_LIVE flips — confirm that gating, OR condition the
//     section header (one hedge there scopes every per-stock explainer below).
//     See HONESTY_PRESENT_TENSE_AUDIT.md.
//   mobile: GiftTab, GifterFlowScreen, DashboardScreen.
//   server: gifterNotificationWorker, templates/baseTemplate, templates/giftReceived,
//     templates/largeGiftAlert, templates/taxSeasonPrep, routes.ts (KYC
//     "before investing goes live" message).
//   shared/packages: packages/content/src/index.ts.
