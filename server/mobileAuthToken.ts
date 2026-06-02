// Mobile session token (stateless, signed). The native app has no reliable cookie
// store on a physical device, so /api/auth/login + /register return one of these;
// the app keeps it in SecureStore and sends it as `Authorization: Bearer <token>`.
// resolveRequestUser (server/auth.ts) accepts it ALONGSIDE the web's passport
// cookie session, which is completely unchanged — the web never sends a Bearer
// header, so this path only ever fires for the mobile app.
//
// Stateless, like the restore token (server/accountRestoreToken.ts) — no DB row.
// Revocation is by expiry (60 days) + rotating SESSION_SECRET. A DB-backed
// per-device revocation list is a future hardening (pairs with the existing
// X-Kiddo-Device-Id trusted-device infra).
//
// Token shape:  <base64url(payload_json)>.<base64url(hmac_sha256(payload_b64,key))>
// Payload:      { v: 1, uid: string, exp: number }
// Key:          HMAC(SESSION_SECRET, "kiddo.mobile.auth.v1") — a distinct namespace
//               from session + restore signing so a leak in one domain can't forge
//               tokens in another.

import crypto from "crypto";

const NAMESPACE = "kiddo.mobile.auth.v1";
const MOBILE_TOKEN_TTL_MS = 60 * 24 * 60 * 60 * 1000; // 60 days

type Payload = { v: 1; uid: string; exp: number };

function deriveKey(): Buffer {
  const secret = process.env.SESSION_SECRET;
  if (!secret) {
    throw new Error("SESSION_SECRET required for mobile-auth-token signing");
  }
  return crypto.createHmac("sha256", secret).update(NAMESPACE).digest();
}

function base64urlEncode(input: Buffer | string): string {
  return Buffer.from(input).toString("base64url");
}
function base64urlDecode(input: string): Buffer {
  return Buffer.from(input, "base64url");
}

export function mintMobileAuthToken(userId: string): string {
  const payload: Payload = { v: 1, uid: userId, exp: Date.now() + MOBILE_TOKEN_TTL_MS };
  const payloadB64 = base64urlEncode(JSON.stringify(payload));
  const sig = crypto.createHmac("sha256", deriveKey()).update(payloadB64).digest();
  return `${payloadB64}.${base64urlEncode(sig)}`;
}

export type MobileTokenVerification =
  | { ok: true; userId: string; expiresAtMs: number }
  | { ok: false; reason: "malformed" | "bad_signature" | "expired" | "version" };

export function verifyMobileAuthToken(token: string): MobileTokenVerification {
  if (typeof token !== "string" || token.length < 16) return { ok: false, reason: "malformed" };
  const dot = token.indexOf(".");
  if (dot <= 0 || dot >= token.length - 1) return { ok: false, reason: "malformed" };
  const payloadB64 = token.slice(0, dot);
  const sigB64 = token.slice(dot + 1);
  let presentedSig: Buffer;
  try {
    presentedSig = base64urlDecode(sigB64);
  } catch {
    return { ok: false, reason: "malformed" };
  }
  const expectedSig = crypto.createHmac("sha256", deriveKey()).update(payloadB64).digest();
  if (presentedSig.length !== expectedSig.length) return { ok: false, reason: "bad_signature" };
  if (!crypto.timingSafeEqual(presentedSig, expectedSig)) return { ok: false, reason: "bad_signature" };
  let payload: Payload;
  try {
    payload = JSON.parse(base64urlDecode(payloadB64).toString("utf8")) as Payload;
  } catch {
    return { ok: false, reason: "malformed" };
  }
  if (payload?.v !== 1) return { ok: false, reason: "version" };
  if (typeof payload.uid !== "string" || typeof payload.exp !== "number") {
    return { ok: false, reason: "malformed" };
  }
  if (Date.now() > payload.exp) return { ok: false, reason: "expired" };
  return { ok: true, userId: payload.uid, expiresAtMs: payload.exp };
}

// Pull the token out of an "Authorization: Bearer <token>" header.
export function bearerFromAuthHeader(header: string | string[] | undefined | null): string | null {
  const value = Array.isArray(header) ? header[0] : header;
  if (!value) return null;
  const match = /^Bearer\s+(.+)$/i.exec(String(value).trim());
  return match ? match[1].trim() : null;
}
