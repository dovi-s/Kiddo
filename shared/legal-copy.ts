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
