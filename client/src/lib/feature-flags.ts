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

// In-app embedded checkout (CHECKOUT_IN_APP_SPEC.md). When OFF, the /checkout-preview
// route is not registered and the app keeps the hosted-redirect Checkout. Phase-1
// on-session deposit preview — flip VITE_IN_APP_CHECKOUT=true (and the server
// IN_APP_CHECKOUT) to exercise the embedded Payment Element + Apple Pay.
export const IN_APP_CHECKOUT: boolean =
  String(import.meta.env.VITE_IN_APP_CHECKOUT || "")
    .trim()
    .toLowerCase() === "true";
