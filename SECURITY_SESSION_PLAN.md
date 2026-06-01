# Session & re-auth security plan

*The deliberate answer to "should we auto-sign-out after idle / prompt 'still
here?'". Written 2026-05-31. Companion to `project_security_audit_2026_05_27`
and `COUNSEL_ENGAGEMENT_PACKET.md`.*

## Principle

Kora is a relationship / Memory Book product — lingering is the point, not a
red flag. So the security model is **"never interrupt browsing; always
re-verify the dangerous action,"** not a bank-style global idle logout.

A blanket idle timeout (or a "you've been idle, still here?" modal) is the
wrong tool here: it breaks the calm register, annoys parents who leave a tab
open, and barely touches the real risk. The real risk isn't a tab left open on
your own laptop — it's *someone moving money or reading a kid's SSN* on a
device that isn't theirs. Protect the **action**, not the idle time.

## Shipped (2026-05-31)

- **Rolling sessions.** `rolling: true` + a 30-day TTL (`server/auth.ts`). The
  window slides forward on every request, so an active user is never logged out
  mid-use; only a genuinely abandoned session ages out after 30 days of
  inactivity. (Was a flat 7-day-from-login cookie with no sliding — active
  daily users got logged out mid-use every 7 days.)
- **"Keep me signed in on this device" (default on).** Login form checkbox →
  `rememberMe` on `/api/auth/login`. Unchecked (the shared / public-computer
  case) downgrades the session to a **browser-session cookie** — cleared when
  the browser closes, so no persistent token is left on a machine that isn't
  theirs. Carried through the 2FA step via a pending-session marker. Helper:
  `applySessionDuration()` in `server/auth.ts`.
- Baseline already correct: server-side Postgres session store, `httpOnly`,
  `secure` in prod, `sameSite: lax`, session regeneration on login (anti-
  fixation), new-device email alerts, optional TOTP 2FA.

## Next — step-up re-authentication (THE real control; custody-gated)

When money movement / sensitive PII goes live, require a fresh re-auth
(password, or biometric on mobile) before a *dangerous action*, gated on
"session older than ~10–15 min since last auth" so it isn't every time:

- withdrawals / transfers
- viewing or entering a full SSN
- linking or changing a bank account
- changing a beneficiary
- changing email / password
- closing a fund or account

This is the Robinhood/Coinbase pattern: stay signed in to *browse*, re-auth to
*act*. Most of these surfaces are custody-gated and not live yet, so this is a
**build-it-with-the-custody-integration** item, not a pre-launch one.

## Next — mobile biometric app-lock (mobile audit)

Expo `LocalAuthentication` (FaceID / TouchID) when the app returns from
background after a short threshold. Gold standard for fintech mobile — better
UX *and* security than any idle logout. Belongs in the `apps/mobile/` audit
(the one unswept surface).

## Where an idle "still here? extend / sign out" prompt DOES belong

Only as the **graceful tail of a chosen short / shared-device session** — warn
before a browser-session expires so a half-written Memory Book note isn't lost.
Never as a global default for the persistent ("keep me signed in") session.

## Explicitly NOT doing

- A global idle auto-logout for the persistent session.
- A bank-style "still active?" modal as default behavior.

Both fight the product thesis and provide weak security for the actual threat,
which step-up re-auth + a shared-device option address far better.
