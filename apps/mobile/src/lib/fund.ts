// Fund access-role helpers — the single source of truth for "can this viewer
// write?" and "is this the post-handoff owner?", so the rule can't drift across
// screens (it had: each screen computed isReadOnly = previous_owner only, which
// WRONGLY gave read-only `viewer` collaborators write CTAs that 403 server-side).
//
// accessRole (from /api/funds): 'owner' | 'co-admin' = full write; 'viewer' =
// read-only collaborator; 'previous_owner' = post-handoff parent (read-only).

import type { ApiFund } from "../api";

/** Read-only when the viewer is a viewer-collaborator OR the post-handoff parent. */
export function isReadOnlyFund(fund?: ApiFund | null): boolean {
  const role = (fund as any)?.accessRole;
  if (role === "viewer") return true;
  if (role === "previous_owner" && Boolean((fund as any)?.transferredAt)) return true;
  return false;
}

/** Owner mode = the now-adult who took ownership at majority (kid-2.0 surfaces). */
export function isOwnerModeFund(fund?: ApiFund | null): boolean {
  return Boolean((fund as any)?.transferredAt) && (fund as any)?.accessRole === "owner";
}
