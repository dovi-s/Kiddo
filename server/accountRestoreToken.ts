// Restore-token plumbing for in-app account deletion.
//
// When a user soft-deletes their account, performAccountDeletion mints a
// signed bearer token that's emailed to them as a one-tap "Restore my
// account" link. Token lifetime is 30 days, matching the grace-period
// promise in the modal copy. After 30 days the PII-scrub worker runs and
// the user row is anonymized — at that point restoration becomes
// impossible regardless of token state.
//
// Token shape (URL-safe, single string):
//   <base64url(payload_json)>.<base64url(hmac_sha256(payload_b64, key))>
//
// Payload:
//   { v: 1, uid: string, did: number, exp: number }
//     v   = format version (so we can rev without breaking old tokens)
//     uid = user id
//     did = users.deletedAt epoch ms — locks the token to the SPECIFIC
//           deletion event. If the user restores then re-deletes, the
//           old token's `did` no longer matches the user row's
//           deletedAt, so the old token is dead. Defense against
//           someone holding onto an old restore link forever.
//     exp = epoch ms at which the token expires (deletion time + 30d).
//
// Key derivation: HMAC of SESSION_SECRET with a constant string
// namespace ("kiddo.account.restore.v1"). Different namespace from
// session signing so a session compromise doesn't forge restore tokens
// and vice versa.
//
// Validation returns one of:
//   { ok: true, userId, deletedAt }   — token is valid + user is
//                                       currently soft-deleted with
//                                       matching deletedAt. Proceed with
//                                       restoration.
//   { ok: false, reason: ... }        — invalid signature, expired,
//                                       malformed, mismatched deletedAt,
//                                       or user not actually deleted.

import crypto from "crypto";

const NAMESPACE = "kiddo.account.restore.v1";
const RESTORE_TOKEN_TTL_MS = 30 * 24 * 60 * 60 * 1000;

type Payload = { v: 1; uid: string; did: number; exp: number };

function deriveKey(): Buffer {
  const secret = process.env.SESSION_SECRET;
  if (!secret) {
    throw new Error("SESSION_SECRET required for restore-token signing");
  }
  return crypto.createHmac("sha256", secret).update(NAMESPACE).digest();
}

function base64urlEncode(input: Buffer | string): string {
  return Buffer.from(input).toString("base64url");
}

function base64urlDecode(input: string): Buffer {
  return Buffer.from(input, "base64url");
}

/**
 * Mint a fresh restore token for a user who just soft-deleted their
 * account. `deletedAt` should be the Date that performAccountDeletion
 * is about to stamp on users.deletedAt — the two must match for the
 * token to validate later.
 */
export function mintRestoreToken(userId: string, deletedAt: Date): string {
  const payload: Payload = {
    v: 1,
    uid: userId,
    did: deletedAt.getTime(),
    exp: deletedAt.getTime() + RESTORE_TOKEN_TTL_MS,
  };
  const payloadB64 = base64urlEncode(JSON.stringify(payload));
  const sig = crypto
    .createHmac("sha256", deriveKey())
    .update(payloadB64)
    .digest();
  return `${payloadB64}.${base64urlEncode(sig)}`;
}

export type RestoreTokenVerification =
  | { ok: true; userId: string; deletedAtMs: number; expiresAtMs: number }
  | { ok: false; reason: "malformed" | "bad_signature" | "expired" | "version" };

/**
 * Validate the cryptographic + structural integrity of a restore
 * token. Returns the userId + deletedAt embedded in the payload IF
 * the signature checks out AND the expiry hasn't passed.
 *
 * Does NOT check the DB state of the user — callers (the restore
 * endpoint) must additionally verify that users.deletedAt is set
 * AND matches the returned deletedAtMs, so an old token from a
 * previous deletion can't restore a NEWLY-deleted account.
 */
export function verifyRestoreToken(token: string): RestoreTokenVerification {
  if (typeof token !== "string" || token.length < 16) {
    return { ok: false, reason: "malformed" };
  }
  const dot = token.indexOf(".");
  if (dot <= 0 || dot >= token.length - 1) {
    return { ok: false, reason: "malformed" };
  }
  const payloadB64 = token.slice(0, dot);
  const sigB64 = token.slice(dot + 1);
  let presentedSig: Buffer;
  try {
    presentedSig = base64urlDecode(sigB64);
  } catch {
    return { ok: false, reason: "malformed" };
  }
  const expectedSig = crypto
    .createHmac("sha256", deriveKey())
    .update(payloadB64)
    .digest();
  // Constant-time compare to avoid timing side-channels on signature
  // verification. crypto.timingSafeEqual throws on length mismatch,
  // so we guard the lengths first.
  if (presentedSig.length !== expectedSig.length) {
    return { ok: false, reason: "bad_signature" };
  }
  if (!crypto.timingSafeEqual(presentedSig, expectedSig)) {
    return { ok: false, reason: "bad_signature" };
  }
  let payload: Payload;
  try {
    payload = JSON.parse(base64urlDecode(payloadB64).toString("utf8")) as Payload;
  } catch {
    return { ok: false, reason: "malformed" };
  }
  if (payload?.v !== 1) {
    return { ok: false, reason: "version" };
  }
  if (
    typeof payload.uid !== "string" ||
    typeof payload.did !== "number" ||
    typeof payload.exp !== "number"
  ) {
    return { ok: false, reason: "malformed" };
  }
  if (Date.now() > payload.exp) {
    return { ok: false, reason: "expired" };
  }
  return {
    ok: true,
    userId: payload.uid,
    deletedAtMs: payload.did,
    expiresAtMs: payload.exp,
  };
}
