// Client-side feature flags. Default OFF. A flag gates whether a route/surface is
// even registered, so the feature is fully inert until deliberately flipped.

// Kid-initiated "fund idea" onboarding (see KID_FUND_IDEA_SPEC.md +
// COUNSEL_Q_KID_ONBOARDING.md). When OFF, the /fund-idea route is not registered
// (404). v1 is a LOCAL-ONLY, zero-PII teen exploration — safe to build now — but it
// must stay OFF for real teens until counsel clears the COPPA/state-AADC/securities/
// FTC gates in writing. Flip via build env (VITE_KID_INITIATED_ONBOARDING=true) only
// after that sign-off.
export const KID_INITIATED_ONBOARDING: boolean =
  String(import.meta.env.VITE_KID_INITIATED_ONBOARDING || "")
    .trim()
    .toLowerCase() === "true";
