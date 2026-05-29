# Google + Apple Sign-In — go-live checklist

> The code is built and dormant. The Login + Get-Started pages call
> `GET /api/auth/providers`, which returns `google`/`apple` = true only when the
> creds below are set — so the buttons **appear automatically the moment you
> configure each provider**. No code change. (OIDC flow via `openid-client`;
> callbacks already registered for GET *and* POST at
> `/api/auth/oauth/:provider/callback`.)

## 0. Prerequisite — set the public base URL (prod)

The callback URL is built from the app's base URL. Set ONE of these in prod (it
checks in this order): `APP_BASE_URL` → `PUBLIC_APP_URL` → `APP_URL` → `BASE_URL`.
Example: `APP_BASE_URL=https://app.kiddofund.com`. (In dev it falls back to the
request host, so localhost works without this.)

The exact redirect/callback URLs you'll register with each provider:
- Google: `{APP_BASE_URL}/api/auth/oauth/google/callback`
- Apple:  `{APP_BASE_URL}/api/auth/oauth/apple/callback`

## 1. Google (issuer `accounts.google.com`, scope `openid email profile`)

1. Google Cloud Console → **APIs & Services → Credentials** (create/select a project).
2. Configure the **OAuth consent screen** (External): app name "Kiddo", support
   email, logo, privacy-policy + terms URLs, authorized domain (`kiddofund.com`).
   Add scopes `openid`, `email`, `profile`. Publish (or add test users while in
   "Testing").
3. **Create credentials → OAuth client ID → Web application.**
   - **Authorized redirect URI:** `{APP_BASE_URL}/api/auth/oauth/google/callback`
     (must match EXACTLY — scheme, host, path, no trailing slash).
   - Authorized JavaScript origin: `{APP_BASE_URL}`.
4. Copy the Client ID + Client Secret into env:
   ```
   GOOGLE_CLIENT_ID=...apps.googleusercontent.com
   GOOGLE_CLIENT_SECRET=...
   ```
5. Redeploy. The "Continue with Google" button now renders.

## 2. Apple (issuer `appleid.apple.com`, scope `openid email name`)

Apple is fiddlier — its "client secret" is a **signed JWT you generate**, not a
static string, and it **expires (max 6 months)**.

1. Apple Developer → **Certificates, Identifiers & Profiles.**
   - Create an **App ID** (or reuse) with **Sign in with Apple** enabled.
   - Create a **Services ID** (this is your `APPLE_CLIENT_ID`, e.g.
     `com.kiddofund.web`). Enable Sign in with Apple on it; under "Web
     Authentication Configuration" set:
     - Domain: `app.kiddofund.com`
     - **Return URL:** `{APP_BASE_URL}/api/auth/oauth/apple/callback`
   - Create a **Sign in with Apple key** (`.p8`); note the **Key ID** and your
     **Team ID**.
2. **Generate the client-secret JWT** from the `.p8` key (ES256), claims:
   `iss=Team ID`, `sub=Services ID`, `aud=https://appleid.apple.com`,
   `iat/exp` (exp ≤ 6 months), `kid=Key ID`. (Use a small script or a known
   generator; many `apple-signin` helpers do this.)
3. Set env:
   ```
   APPLE_CLIENT_ID=com.kiddofund.web        # the Services ID
   APPLE_CLIENT_SECRET=<the signed JWT>
   ```
4. Redeploy. The "Continue with Apple" button now renders.
5. **Reminder: rotate `APPLE_CLIENT_SECRET` before it expires** (set a calendar
   reminder ≤6 months out) — Apple login silently breaks when the JWT lapses.

## 3. App Store rule (don't skip)

Apple **guideline 4.8**: if the **iOS app** offers Google (or any third-party)
sign-in, it **must** also offer Sign in with Apple. The code supports both —
so configure **both together** before the iOS app ships social login.

## 4. Verify

- `GET /api/auth/providers` returns `{ "google": true, "apple": true }`.
- Both buttons render on `/login` and `/get-started`.
- Full round-trip: click → provider consent → back to
  `/api/auth/oauth/<p>/callback` → logged in, lands on the dashboard.
- New account created on first social login; signing in again links to the same
  user (email match / linked identity).

## 5. Gotchas

- **Exact redirect-URI match** is the #1 failure (Google `redirect_uri_mismatch`,
  Apple `invalid_redirect`). Copy/paste the callback URLs above verbatim.
- **Apple sends the user's name only on the FIRST authorization** — capture it
  then; later logins omit it.
- Apple may return a **private relay email** (`@privaterelay.appleid.com`) — fine;
  it's a stable per-user address. Don't reject it.
- Keep `GOOGLE_/APPLE_CLIENT_*` out of the client bundle (server env only).
- 2FA composes on top: a social-login user can still enroll TOTP; the gate runs
  after the OAuth session is established, same as password login.
