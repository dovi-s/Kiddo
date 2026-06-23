// Kid-initiated "fund idea" onboarding feature flag (server side, for the v2
// persisted path: /api/fund-ideas endpoints + the fund_ideas table).
//
// DEFAULTS OFF. Keeps the kid-onboarding server path INERT until BOTH:
//   1. A deliberate business flip of KID_INITIATED_ONBOARDING=true, AND
//   2. Counsel has cleared the gates in COUNSEL_Q_KID_ONBOARDING.md (COPPA 2025
//      "collection from a child" + state AADC opt-in + securities + FTC dark-pattern).
//
// v1 (the LOCAL-ONLY, zero-PII teen exploration at /fund-idea) is client-only and
// stores nothing server-side, so it does not depend on this flag — but it ships
// behind the matching CLIENT flag (client/src/lib/feature-flags.ts) for the same
// reason. See KID_FUND_IDEA_SPEC.md.
export function isKidInitiatedOnboardingEnabled(): boolean {
  const flag = String(process.env.KID_INITIATED_ONBOARDING || "").trim().toLowerCase();
  return flag === "true" || flag === "1" || flag === "yes";
}
