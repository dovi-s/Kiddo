# Face ID / Biometric Lock — Kiddo mobile app

> Status: **Spec + MVP shipped 2026-05-13.**
> The spec is the design doc; the code lives in
> `apps/mobile/src/biometric.ts`, `apps/mobile/src/screens/LockScreen.tsx`,
> and the new `locked` Screen state in `apps/mobile/App.tsx`. Settings
> toggle lives in `DashboardScreen.tsx` AccountTab.
>
> Same shape as `IOS_WIDGETS_SPEC.md` and `DEPLOYMENT_PLAN.md`.

---

## TL;DR

Banking-app-style biometric gate on top of the existing session.
Face ID / Touch ID on iOS, Fingerprint on Android, device passcode as
fallback. Off by default — user opts in from Settings. Once on:

- **Cold launch** — Face ID prompt before any balance is visible
- **Resume from background after 5 minutes** — re-prompt
- **App-switcher snapshot** — branded screen, not the actual content
- **Settings toggle** — Off → On flips after a successful biometric check (proving the device supports it and the user is who they say they are)

Architecture: pure client-side gate. No server changes. Session cookie
continues to do its job — Face ID is the "this device is in the right
hands right now" layer on top.

---

## Why this matters

Three reasons it's the right call for Kiddo:

1. **Category table stakes.** Robinhood, Acorns, Greenlight, Public,
   Chase, every banking app. Not having a Face ID lock reads as
   "this app isn't taking my money seriously." For a finance app
   that's a meaningful trust signal.

2. **Composes with Kid View.** Phone gets handed to the kid → kid
   browses freely → phone comes back → next background-resume after
   5 minutes triggers the lock again. The unlock = "parent is here
   right now" signal is exactly what the Kid View parent/kid
   boundary needs.

3. **Cheap to ship.** `expo-local-authentication` is mature and
   Expo-supported. No native code, no server changes. A focused
   session ships the MVP.

---

## The four pieces

It's not one feature, it's four. Each is small; together they're the
full "smart lock" experience.

| Piece | Library / mechanism | Notes |
|---|---|---|
| **Biometric prompt** | `expo-local-authentication` | Face ID / Touch ID / Fingerprint, with device-passcode fallback. Library exposes `authenticateAsync()` and `getSupportedAuthenticationTypesAsync()`. |
| **Locked-screen UI** | `LockScreen.tsx` | Kiddo logo, "Unlock with Face ID" button, "Use passcode" link, "Sign out" escape hatch when biometric fails or isn't enrolled. |
| **App-switcher privacy** | iOS native config plugin (post-MVP) | Without this, iOS app-switcher snapshot shows actual fund balances. With this, shows a Kiddo logo screen. MVP ships without it because EAS dev-build is required to test, and the JS-side lock already covers the common case. Deferred to phase 2 — see "What's deferred." |
| **Re-lock policy** | `AppState` listener + timestamp | When to re-prompt. Cold launch: always. Background-then-resume: after 5 minutes of background time. |

---

## MVP scope (what shipped 2026-05-13)

| Shipped | Deferred |
|---|---|
| ✅ Settings toggle: "Use Face ID to unlock Kiddo" | ⏳ App-switcher privacy snapshot (needs EAS plugin + dev build) |
| ✅ Cold-launch lock when toggle is on | ⏳ Re-auth on sensitive actions (withdrawal, change bank) — Robinhood pattern |
| ✅ 5-minute background re-lock | ⏳ Passkeys/WebAuthn on web — separate spec when web demand justifies |
| ✅ Locked screen with Face ID button + Sign-out escape hatch | ⏳ "Trusted devices" Settings panel |
| ✅ Device-passcode fallback (handled by `expo-local-authentication`) | ⏳ Lock the gifter flow (currently only the authenticated parent surface locks) |
| ✅ Graceful degrade when biometric isn't enrolled (toggle stays available but shows reason on tap) | |

---

## File-by-file build

### `apps/mobile/package.json`

Add two deps:
- `expo-local-authentication` — the biometric prompt
- `expo-secure-store` — store the "biometric enabled" preference + last-active timestamp securely (AsyncStorage isn't encrypted on iOS by default)

### `apps/mobile/app.json`

Add to `plugins`:
- `expo-local-authentication` with `faceIDPermission` describing why
  the app uses Face ID (App Store review requirement)
- `expo-secure-store` (no config)

### `apps/mobile/src/biometric.ts` (NEW)

Wrapper API the rest of the app talks to. Hides expo-local-authentication
and expo-secure-store behind a small surface:

```ts
isBiometricSupported(): Promise<{ supported: boolean; reason?: string }>
isBiometricEnabled(): Promise<boolean>
setBiometricEnabled(on: boolean): Promise<void>
authenticate(reason: string): Promise<{ success: boolean; error?: string }>
recordAppActiveAt(): Promise<void>
getSecondsSinceLastActive(): Promise<number>
```

Single source of truth for the lock policy. The 5-minute re-lock window
lives here as a constant — change it in one place if we ever revisit.

### `apps/mobile/src/screens/LockScreen.tsx` (NEW)

The locked-screen UI. Renders:
- Kiddo logo + tagline (matches splash visual register)
- Primary "Unlock with Face ID" button
- "Use passcode" link (device passcode fallback)
- "Sign out" escape hatch in small-print at bottom — so a user whose
  Face ID enrollment has changed (or who handed the phone to a partner
  who can't unlock it) isn't trapped

Calls `authenticate()` from `biometric.ts`. On success, fires the
`onUnlocked` prop. On hard failure (3 retries / user cancelled), shows
the "Sign out" path as the recovery.

### `apps/mobile/App.tsx`

Add a `locked` Screen variant:
```ts
| { name: "locked"; user: ApiUser; targetScreen: Screen }
```

`targetScreen` carries what to show after unlock — preserves deep-link
destinations across the lock.

Two new effects:
1. **AppState listener.** When app transitions to `background`, record
   timestamp via `recordAppActiveAt()`. When transitioning to `active`,
   if `(now - lastActive) > 5 min` AND biometric is enabled, push the
   current screen onto `targetScreen` and replace with `locked`.
2. **Boot path gate.** After `apiGetUser()` resolves to a real user,
   check `isBiometricEnabled()`. If yes, show `locked` instead of
   `dashboard`. Cold launches always lock (no "last active" timestamp
   carrying across app process restarts — that's intentional).

### `apps/mobile/src/screens/DashboardScreen.tsx`

Add a "Security" section to AccountTab (above Notifications):
- Toggle row: "Use Face ID to unlock Kiddo"
- Subtext: shows current state + capability:
  - Supported, off → "Off"
  - Supported, on → "On"
  - Not supported (no enrolled biometrics) → "Set up Face ID on this device first"
- Tap the toggle → if turning ON, immediately run an authentication
  to prove it works AND to satisfy the user that the prompt they're
  about to live with works. If turning OFF, no re-auth required (a
  user choosing to remove their lock is exercising authority they
  already have via the session).

Same visual register as the existing push-notifications toggle —
matches the AccountTab pattern users are already learning.

---

## Re-lock policy details

The 5-minute window is the decision the user picked. Three reasons it's the right pick:

1. **Industry norm.** Robinhood (5 min), Acorns (5 min), Greenlight (5 min). User mental model already learned.
2. **Doesn't pester.** "Check Instagram, come back to Kiddo" works without an interruption.
3. **Stops casual phone-grab.** Someone picks up your unattended phone 6+ minutes later → blocked.

Implementation details:
- Timer starts on `AppState === "background"` (NOT inactive — iOS fires
  inactive during control-center pull-down and app-switcher peek, which
  shouldn't restart the clock).
- Timer resets on every `active` transition that succeeds in unlocking.
- Cold launches ALWAYS lock when the toggle is on. Process restart
  invalidates the "last active" timestamp — that's intentional.

---

## Privacy snapshot (deferred to phase 2)

The iOS app-switcher caches a snapshot of every active app. By default,
when the user swipes between apps, that snapshot shows whatever was
on screen — which in Kiddo's case means visible fund balances.

The fix is a native config plugin that swaps the snapshot for a
Kiddo-logo screen when the app enters background. Two ways to ship it:

1. **`react-native-privacy-snapshot`** — third-party, well-maintained,
   requires EAS dev build to test (won't run in Expo Go)
2. **Custom Expo config plugin** — write your own; same mechanism,
   more control, more code

Deferred from MVP because:
- Requires EAS dev build (not Expo Go) — adds a build step to test
- Common attack model is "someone has my unlocked phone" — the 5-min
  background re-lock already covers that case. Snapshot peek is a
  narrower secondary leak.
- Easy to add in phase 2 once we've got users + a real EAS build pipeline

---

## Edge cases

| Case | Behavior |
|---|---|
| User enables Face ID, then deletes their face enrollment in iOS Settings | Next launch, `authenticate()` fails immediately. LockScreen shows "Face ID isn't set up. Sign out and sign back in?" The Sign-out escape hatch covers this. |
| User has biometric on, then loses Face ID temporarily (mask, hat, etc.) | `expo-local-authentication` automatically falls back to device passcode after 2 failed Face ID attempts. No special handling needed. |
| User cancels the Face ID prompt | Stays on LockScreen with "Try again" button. Sign-out remains visible. |
| App is opened by a deep link (gift URL, notification) while locked | Lock takes precedence. After unlock, the deep-link destination is preserved via `targetScreen` and opens automatically. |
| User on a device without biometric (older iPad, etc.) | Toggle in Settings shows "Set up Face ID on this device first" and tap is a no-op with toast. The user can still log in via email/password — that path is unchanged. |
| Demo accounts (Dunphys) | Demo accounts have biometric off by default. Demo visitors can enable it on their personal device and it'll work normally. Per the demo-loop locked pattern, this is fine. |

---

## Testing

**Simulator (limited):**
- iOS Simulator can simulate biometric success/failure via Hardware → Face ID/Touch ID menu. Good for happy path + cancellation.
- Android emulator: Extended Controls → Fingerprint → "Touch sensor" button.

**Real device (required):**
- Cold launch with toggle on → Face ID prompt
- Background app for 5+ min, foreground → Face ID prompt
- Background app for 30s, foreground → NO prompt
- Enable toggle from Settings → immediate Face ID prompt to confirm
- Disable toggle from Settings → no prompt
- Force-quit + relaunch with toggle on → Face ID prompt
- Toggle on, then delete Face ID enrollment in iOS Settings, then launch → Sign-out escape hatch reachable

**Won't work in Expo Go.** `expo-local-authentication` is bundled as a
native module, which means dev requires either:
1. `npx expo run:ios` / `npx expo run:android` (local dev build)
2. EAS dev build

The Expo Go path will throw a runtime error when `authenticate()` is
called. The biometric.ts wrapper detects this and surfaces a friendly
"Face ID isn't available in this build" message.

---

## What's deferred

1. **App-switcher privacy snapshot** — see Privacy snapshot section above
2. **Re-auth on sensitive actions** (withdrawal, change bank, view full SSN) — Robinhood does this. Right call for a follow-up once base lock ships and we have real-money flows hardened.
3. **Passkeys / WebAuthn on web** — different beast, different library, different fallback story. Spec separately when web demand justifies it.
4. **"Trusted devices" panel in Settings** — when you want users to see "Face ID active on iPhone 15 Pro, last unlocked 2 hours ago." Not until multi-device management is a real concern.
5. **Locking the gifter flow** — gifters don't have an authenticated session; they hit the gift link, fill out the form, pay, done. There's no balance to protect. Currently the lock only applies to authenticated parent sessions.
6. **PIN-as-fallback** — some apps offer a 4-digit Kiddo-specific PIN as an alternative to device passcode. Adds friction (another secret to remember) and value is unclear (device passcode is already a 4-6 digit fallback). Skipping unless users ask.

---

## When to come back to this spec

Trigger conditions for each deferred item:

| Item | Trigger to re-open |
|---|---|
| App-switcher privacy snapshot | First time a user mentions seeing the balance in app-switcher, OR before any media/press demo of the app |
| Re-auth on sensitive actions | When withdrawals or bank-change actions ship to real users |
| Web passkeys | When web sessions outnumber mobile sessions, OR a user explicitly requests it |
| Trusted devices panel | When users have 3+ devices on average |
| Gifter-flow lock | Probably never. Gifters have no balance to protect. |

---

## References

- Internal: `IOS_WIDGETS_SPEC.md`, `DUNPHY_DEMO_SPEC.md`, `DEPLOYMENT_PLAN.md` — same spec-doc shape
- External: [expo-local-authentication docs](https://docs.expo.dev/versions/latest/sdk/local-authentication/)
- External: [expo-secure-store docs](https://docs.expo.dev/versions/latest/sdk/securestore/)
- External: [AppState reference](https://reactnative.dev/docs/appstate)
