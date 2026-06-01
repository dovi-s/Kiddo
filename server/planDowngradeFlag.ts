// Seamless Family -> Kiddo+ downgrade feature flag.
//
// DEFAULTS OFF. Gates the *fully-seamless* downgrade path (create the Kiddo+
// subscription now with its first charge anchored to the Family period end, so
// the switch happens automatically the instant Family lapses — no gap, no
// re-confirm). This is real, future money movement (the saved card gets charged
// off-session at renewal), so it stays INERT in production until:
//   1. A deliberate flip of PLAN_DOWNGRADE_SEAMLESS=true, AND
//   2. The flow is verified in Stripe TEST MODE (trial-end charge fires on the
//      saved PM; Family cancels cleanly; the subscription.updated webhook syncs
//      the membership trialing -> active; the rollback path works).
//
// While OFF, POST /api/subscription/downgrade-to-plus falls back to the SAFE,
// already-shipped behavior: cancel Family at period end, and the one remaining
// fund re-takes Kiddo+ via the normal uncovered-fund nudge (one extra confirm,
// brief gap). See SUBSCRIPTION_DOWNGRADE_SPEC.md.
export function isSeamlessPlanDowngradeEnabled(): boolean {
  const flag = String(process.env.PLAN_DOWNGRADE_SEAMLESS || "").trim().toLowerCase();
  return flag === "true" || flag === "1" || flag === "yes";
}
