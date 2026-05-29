// TOTP (RFC 6238) — dependency-free, built on Node's `crypto`.
//
// Why no library: the Expo/mobile workspace has peer-dependency conflicts that
// make `npm install` fragile in this monorepo, and TOTP is small, standard, and
// auditable. Implemented against RFC 4648 (base32) + RFC 4226 (HOTP) + RFC 6238
// (TOTP), SHA-1 / 6 digits / 30s period — the defaults every authenticator app
// (Google Authenticator, 1Password, Authy) expects. Correctness is pinned by
// the RFC 6238 test vector in `scripts/verify-totp.ts`.
//
// Security notes:
// - `verifyTotp` uses a constant-time compare and a ±1 step window (±30s) to
//   tolerate clock skew without widening the attack surface.
// - Backup codes are returned to the user ONCE and stored only as bcrypt hashes.

import crypto from "crypto";
import bcrypt from "bcryptjs";

const BASE32_ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
const DIGITS = 6;
const PERIOD_SECONDS = 30;

export function base32Encode(buf: Buffer): string {
  let bits = 0;
  let value = 0;
  let out = "";
  for (let i = 0; i < buf.length; i++) {
    value = (value << 8) | buf[i];
    bits += 8;
    while (bits >= 5) {
      out += BASE32_ALPHABET[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }
  if (bits > 0) {
    out += BASE32_ALPHABET[(value << (5 - bits)) & 31];
  }
  return out;
}

export function base32Decode(input: string): Buffer {
  const clean = input.replace(/[=\s]/g, "").toUpperCase();
  let bits = 0;
  let value = 0;
  const bytes: number[] = [];
  for (const ch of clean) {
    const idx = BASE32_ALPHABET.indexOf(ch);
    if (idx === -1) continue; // skip stray chars defensively
    value = (value << 5) | idx;
    bits += 5;
    if (bits >= 8) {
      bytes.push((value >>> (bits - 8)) & 0xff);
      bits -= 8;
    }
  }
  return Buffer.from(bytes);
}

// New base32 secret. 20 random bytes = 160 bits, the RFC 4226 recommendation.
export function generateTotpSecret(): string {
  return base32Encode(crypto.randomBytes(20));
}

// HOTP (RFC 4226): HMAC-SHA1 over an 8-byte big-endian counter, dynamic
// truncation, mod 10^DIGITS.
function hotp(secret: string, counter: number): string {
  const key = base32Decode(secret);
  const buf = Buffer.alloc(8);
  // counter can exceed 32 bits; write as two 32-bit halves.
  buf.writeUInt32BE(Math.floor(counter / 0x100000000), 0);
  buf.writeUInt32BE(counter >>> 0, 4);
  const hmac = crypto.createHmac("sha1", key).update(buf).digest();
  const offset = hmac[hmac.length - 1] & 0x0f;
  const binary =
    ((hmac[offset] & 0x7f) << 24) |
    ((hmac[offset + 1] & 0xff) << 16) |
    ((hmac[offset + 2] & 0xff) << 8) |
    (hmac[offset + 3] & 0xff);
  const code = binary % 10 ** DIGITS;
  return code.toString().padStart(DIGITS, "0");
}

// Current TOTP code. `forTime` (ms) overridable for tests.
export function totp(secret: string, forTimeMs: number = Date.now()): string {
  const counter = Math.floor(forTimeMs / 1000 / PERIOD_SECONDS);
  return hotp(secret, counter);
}

// Verify a user-entered token against the secret, allowing ±1 step (±30s) for
// clock skew. Constant-time compare per accepted code to avoid timing leaks.
export function verifyTotp(
  secret: string,
  token: string,
  forTimeMs: number = Date.now(),
): boolean {
  const cleaned = String(token || "").replace(/\D/g, "");
  if (cleaned.length !== DIGITS) return false;
  const counter = Math.floor(forTimeMs / 1000 / PERIOD_SECONDS);
  for (let w = -1; w <= 1; w++) {
    const candidate = hotp(secret, counter + w);
    const a = Buffer.from(candidate);
    const b = Buffer.from(cleaned);
    if (a.length === b.length && crypto.timingSafeEqual(a, b)) return true;
  }
  return false;
}

// otpauth:// URI for QR rendering. Standard label "Issuer:account".
export function buildOtpauthUri(accountEmail: string, secret: string, issuer = "Kiddo"): string {
  const label = encodeURIComponent(`${issuer}:${accountEmail}`);
  const params = new URLSearchParams({
    secret,
    issuer,
    algorithm: "SHA1",
    digits: String(DIGITS),
    period: String(PERIOD_SECONDS),
  });
  return `otpauth://totp/${label}?${params.toString()}`;
}

// One-time backup codes (shown once, stored bcrypt-hashed). 10 codes, each
// 10 hex chars (40 bits) — formatted xxxxx-xxxxx for readability.
export function generateBackupCodes(count = 10): string[] {
  const codes: string[] = [];
  for (let i = 0; i < count; i++) {
    const raw = crypto.randomBytes(5).toString("hex"); // 10 hex chars
    codes.push(`${raw.slice(0, 5)}-${raw.slice(5)}`);
  }
  return codes;
}

export async function hashBackupCodes(codes: string[]): Promise<string[]> {
  return Promise.all(codes.map((c) => bcrypt.hash(c.replace(/-/g, ""), 10)));
}

// Returns the index of the matching (unused) hashed code, or -1. Caller removes
// that index so each backup code is single-use.
export async function findBackupCodeMatch(input: string, hashes: string[]): Promise<number> {
  const normalized = String(input || "").replace(/[-\s]/g, "").toLowerCase();
  if (!normalized) return -1;
  for (let i = 0; i < hashes.length; i++) {
    if (await bcrypt.compare(normalized, hashes[i])) return i;
  }
  return -1;
}
