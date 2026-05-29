# Security, Compliance & Child-Protection — Honest Posture & Roadmap

> Locked principle: **claim only what we actually hold.** Never "SOC 2,"
> "bank-level," "256-bit," "certified," or "compliant with X" unless it is
> true and evidenced. We can be genuinely secure and *audit-ready* now;
> *audit-certified* requires external parties (auditors, pentesters, counsel,
> vendors) and cannot be produced by writing code. See the "overclaim audit"
> discipline already in `/security`, `/faq`, and `CUSTODIAN_SOURCE_OF_TRUTH.md`.
> Snapshot: 2026-05-28.

## A. REAL today (verified in code — these back the claims we make)

Engineering substance, confirmed by reading the source + a green regression test
(`npm run test:security-regression`):

- **HTTP security headers** (`server/index.ts`): Content-Security-Policy, HSTS
  `max-age=63072000; includeSubDomains; preload` (prod), `X-Frame-Options:
  SAMEORIGIN` (prod), `X-Content-Type-Options: nosniff`. `/uploads` served with a
  locked-down `default-src 'none'; sandbox; frame-ancestors 'none'` CSP + dotfile
  deny.
- **Sessions/cookies** (`server/auth.ts`): `httpOnly`, `secure` in production,
  `sameSite: lax`, bounded `maxAge`; `SESSION_SECRET` required or the server
  refuses to boot.
- **Credentials**: passwords hashed with **bcrypt cost 12** (prod); all tokens
  (password reset, magic link, email change) via `crypto.randomBytes`.
- **Authorization**: IDOR sweep + mass-assignment blocks (client can't set
  `balance`/`status`/custody fields on `PATCH /api/funds`), public-fund endpoints
  omit balance/gain/contributed — all pinned by the regression test.
- **Money integrity**: duplicate Stripe PaymentIntent insert rejected (double-credit
  race) — pinned by the regression test + migration `0035` unique index.
- **Rate limiting**: durable Postgres cross-instance fixed-window limiter
  (`server/rateLimiter.ts`, migration `0037`), fail-open to in-memory.
- **KYC**: fail-closed in production (no silent approve).
- Prior 17-fix security audit (commits a35928b→fb89f8d) + the regression suite.

**Dependency CVEs (npm audit, 2026-05-28):** 0 critical, 0 high, **17 moderate** —
almost all in the Expo *mobile build toolchain* (`expo-constants`, `expo-asset`,
`expo-notifications`, `@expo/prebuild-config`) plus `ws` (moderate, uninitialized
memory disclosure). These are build/dev-time, not the production server attack
surface. Not urgent, but track them (see B).

## A2. Children's data — the highest-stakes surface (verified 2026-05-29)

Kiddo stores children's PII: first/last name, DOB, SSN (last-4 only), photos,
video, voice, and the Memory Book. Verified controls:
- **SSN: last-4 + a collected-at timestamp only — never the full 9 digits at
  rest** (`/api/funds/:id/recipient-ssn`); collection is audit-logged.
- **Kid View is PIN-gated** — bcrypt-hashed PINs, checked server-side
  (`bcrypt.compare`, 401 on mismatch).
- **A child's fund/gift page is `noindex`** (X-Robots-Tag + meta on both the
  scraper/og path and the SPA path) — their name can't land in a search index.
- **`/uploads` hardened** — noindex/noimageindex, no-referrer, CSP sandbox,
  dotfile-deny, so kids' photos/video/voice aren't crawlable.
- Fund mutations (incl. SSN) gated to owner/co-admin; viewers blocked.

Gaps (gated — not codeable here):
- **`/uploads` → signed URLs** — kids' media is still served from
  public-but-unguessable URLs; the signed-URL flip is built + dormant, gated on
  Supabase Storage creds. This is the top open child-data item.
- **Child-PII deletion (Option C)** — decided, partially built, counsel-gated.
- **COPPA / state children's-privacy** — the parent-provides-it + PIN-gated
  model narrows COPPA's "collected from a child" trigger, but applicability and
  obligations are a privacy-counsel call.

## B. Code-fixable next (no external party needed — do deliberately, with tests)

- **CSRF**: today we rely on `sameSite: lax` (a real baseline that blocks most
  cross-site POSTs). Stronger: explicit CSRF tokens on state-changing routes.
  CAUTION: must not break the mobile app / existing API clients — do it with a
  shared token scheme + full client test, not a blind middleware drop-in.
- **`npm audit` cleanup**: `npm audit fix` for `ws` and any non-breaking moderate;
  the Expo ones need a coordinated Expo SDK bump (mobile release), not a quick fix.
  Run with a build + smoke verification, never blind (lockfile churn).
- **`/uploads` → signed URLs**: code is built and dormant; flip when Supabase
  Storage creds exist. Removes public-object exposure for kids' media. (creds-gated)
- **2FA/MFA for parent accounts (TOTP) — SHIPPED 2026-05-29.** Dependency-free
  RFC 6238 (`server/totp.ts`, pinned to the RFC test vectors), migration 0039,
  `/api/auth/2fa/*` endpoints, login-enforcement gate (inert until enrolled —
  non-enrolled login byte-for-byte unchanged), and the Account > Security UI
  (QR enroll + backup codes + disable). REMAINING: founder must verify enroll +
  2FA login + a backup code on a real account (the one flow not testable in the
  build env); recovery = backup codes + the disable endpoint.
- **Audit logging review**: confirm sensitive actions (withdrawals, role changes,
  PII edits) write an immutable trail.

## C. External — CANNOT be self-served or coded (the honest ceiling)

Each needs an outside party; none can be "shipped." Do not claim any of these
until the artifact is in hand.

| Item | Requires | Notes |
|---|---|---|
| **SOC 2 Type II** | Audit firm, 3–12 mo observation window | Readiness ≠ certification. |
| **Penetration test** | Security vendor | Get a report + remediation pass before any "pen-tested" claim. |
| **COPPA / children's-privacy** | Privacy counsel | We store kids' PII (name, DOB, SSN, photos, voice). Parent (not child) provides it and Kid View is PIN-gated/parent-controlled, which *narrows* COPPA's "collected from a child" trigger — but applicability + state-law (e.g. children's-privacy acts) obligations are a counsel call. Pairs with the child-PII-deletion decision (Option C). |
| **KYC / AML** | Identity/OFAC vendor | Fail-closed today; real verification needs a provider. |
| **Custody + SIPC** | Broker-dealer onboarding + custodian pick | SIPC coverage is the broker-dealer's, not ours — only true once accounts are live there. The "(at launch)" / "when investing is live" conditioning across the site is correct and must stay until then. |
| **RIA determination** | Securities counsel | The self-directed posture is designed to avoid RIA status; counsel must confirm. |

## D. Discipline (keep doing this)

- Every customer-facing security/custody claim stays **conditional** ("when
  investing is live") and **entity-agnostic** ("our broker-dealer partner") until
  the real thing exists.
- Re-run `npm run test:security-regression` in CI; treat a failure as a launch
  blocker.
- When an external artifact lands (SOC 2 letter, pentest report, KYC vendor,
  custody live), update the matching claim in one sweep — and only then.
