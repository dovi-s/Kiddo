// P0-1 "capture money at intent" (Option C: vault-and-charge-later) feature flag.
//
// DEFAULTS OFF. This gate keeps the capture-at-intent path INERT on the branch
// and in production until BOTH are true:
//   1. A deliberate business flip of GIFTER_CAPTURE_AT_INTENT=true, AND
//   2. Counsel has cleared the two binary gates in LAWYER_Q_HOLDING_GIFT_FUNDS.md
//      (off-session/MTL classification + broker-dealer multi-gifter acceptance).
//
// While OFF, /api/gift-intents behaves exactly as before (warm-promise, no card).
// See P0-1_ADVISORY_PANEL_DECISION.md and P0-1_SPEC_CAPTURE_AT_INTENT.md.
export function isGifterCaptureAtIntentEnabled(): boolean {
  const flag = String(process.env.GIFTER_CAPTURE_AT_INTENT || "").trim().toLowerCase();
  return flag === "true" || flag === "1" || flag === "yes";
}
