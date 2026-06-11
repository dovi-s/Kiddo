// Bereavement / memorial freeze — the fail-closed silence gate.
//
// When a fund is memorialized (a confirmed loss; funds.memorialized_at set by a
// HUMAN, never automation), every automated communication and charge for that
// fund must go silent. This module is the single check the charge paths and the
// email-delivery chokepoint call. See BEREAVEMENT_POSTURE.md.
//
// Fail-closed by design: for a bereaved family, SILENCE is always the safe
// default. If we have a fundId but cannot determine its state (DB error), we
// silence. We do NOT silence when there is no fund context at all — that path
// includes transactional mail (password reset, verification) that must never be
// suppressed, and a non-fund email can't be "a send to a memorialized fund."

import { pool } from "./db";

/**
 * Returns true when the fund's automated comms/charges must be SILENCED:
 *   - the fund is memorialized, OR
 *   - a fundId was given but its state could not be read (fail-closed).
 * Returns false only when we positively know the fund is active, or when there
 * is no fund context to gate on.
 */
export async function shouldSilenceForFund(fundId: string | null | undefined): Promise<boolean> {
  if (!fundId) return false; // no fund context → not a memorialized-fund send; never over-suppress transactional mail
  try {
    const r = await pool.query(
      "select 1 from funds where id = $1 and memorialized_at is not null limit 1",
      [String(fundId)],
    );
    return r.rows.length > 0;
  } catch {
    return true; // fail-closed: we had a fund to check and couldn't — stay silent
  }
}
