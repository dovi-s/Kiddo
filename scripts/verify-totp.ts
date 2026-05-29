// Pins server/totp.ts to the RFC 6238 Appendix-B test vectors (SHA-1).
// The RFC publishes 8-digit codes; our impl is 6-digit, so we compare the
// low 6 digits (code % 1e6). If this passes, the HMAC/base32/truncation math
// matches what Google Authenticator / Authy / 1Password compute.
import { base32Encode, totp, verifyTotp, generateTotpSecret } from "../server/totp";

const secret = base32Encode(Buffer.from("12345678901234567890", "ascii"));

const vectors: Array<[number, string]> = [
  [59, "287082"],
  [1111111109, "081804"],
  [1111111111, "050471"],
  [1234567890, "005924"],
  [2000000000, "279037"],
];

let ok = true;
for (const [tSec, expected] of vectors) {
  const got = totp(secret, tSec * 1000);
  const pass = got === expected;
  ok = ok && pass;
  console.log(`${pass ? "✓" : "✗"} T=${tSec}s  expected ${expected}  got ${got}`);
}

// Round-trip: a freshly generated secret's current code must verify, and a
// wrong code must not.
const s = generateTotpSecret();
const code = totp(s);
const verifies = verifyTotp(s, code);
const rejects = !verifyTotp(s, "000000" === code ? "111111" : "000000");
console.log(`${verifies ? "✓" : "✗"} round-trip verify`);
console.log(`${rejects ? "✓" : "✗"} wrong code rejected`);

if (!ok || !verifies || !rejects) {
  console.error("TOTP verification FAILED");
  process.exit(1);
}
console.log("TOTP matches RFC 6238 vectors.");
