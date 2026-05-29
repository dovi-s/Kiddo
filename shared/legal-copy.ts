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
