# Kiddo on iOS + Android (Capacitor)

This ships the **web app you already love** as real App Store + Play Store apps.
It is the web app running inside a native shell — so it looks identical to the
mobile web, and you maintain ONE codebase. (This replaces the React Native rebuild
for the "native that matches the web" goal.)

What's already set up in this repo:
- `@capacitor/core` + `cli` + `ios` + `android` (v8.4) installed
- `capacitor.config.ts` (app id `com.kiddo.app`, name "Kiddo")
- `android/` — Android Studio project
- `ios/` — Xcode project

There are **two modes**, now switched by the `CAP_SERVER_URL` env var (no file
edits needed — `capacitor.config.ts` reads it):

### A. DEV PREVIEW (default) — see it native, fast
Leave `CAP_SERVER_URL` unset. `capacitor.config.ts` falls back to a `server.url`
pointing at your running web server (`http://192.168.1.66:5000`). The native shell
loads the live web app over your Wi-Fi. Nothing to bundle. Requires `npm run dev`
running + phone on the same Wi-Fi. (Update the IP if it changes: `ipconfig` → IPv4.)

### B. SHIP — store-ready (two sub-options)
Run the web build first either way:  `npm run build`  (→ `dist/public`). ✅ verified.

**B1 — Remote (simplest, zero extra code).** Point the shell at your DEPLOYED
domain; it loads client + API same-origin, so login/cookies just work:
```
CAP_SERVER_URL=https://your-deployed-domain  npx cap sync
```
Tradeoff: needs network to launch, and a pure-remote app can draw Apple "minimum
functionality" review scrutiny — mitigated by shipping a native plugin (push).

**B2 — Bundled (store-safest).** Ship the built web files inside the app:
```
CAP_SERVER_URL=  npx cap sync     # empty = no server block, loads dist/public
```
✅ verified: drops `server.url`, copies the real build into `android/` + `ios/`.
Catch: the bundled app has no same-origin API, so the web client must call your
deployed backend by ABSOLUTE url + the backend must allow that origin (CORS +
SameSite=None cookies, or token auth). **Do this step against the live backend so
auth can be verified — don't wire it blind.** (Claude will do it once deployed.)

---

## Accounts you need (only you can create these)
- **Apple Developer Program** — $99/yr — https://developer.apple.com/programs/ (App Store)
- **Google Play Console** — $25 one-time — https://play.google.com/console (Play Store)

---

## Build ANDROID (works on your Windows machine)
1. Install **Android Studio** (bundles the SDK + JDK): https://developer.android.com/studio
2. `npx cap open android`  (opens the project in Android Studio)
3. Run on a connected phone/emulator (▶), or **Build → Generate Signed Bundle/APK**
   for a Play Store `.aab`.
   - First run: Android Studio will offer to install the missing SDK/Gradle — accept.

## Build iOS WITHOUT a Mac (the key part on Windows)
iOS builds require macOS — but you don't need to OWN a Mac. Two routes:

- **Cloud CI (recommended, no Mac):**
  - **Codemagic** — https://codemagic.io — free tier, native Capacitor support,
    macOS build machines. Connect this repo, point it at `ios/App/App.xcworkspace`,
    add your Apple signing, and it builds + can auto-submit to TestFlight/App Store.
  - or **Ionic Appflow** (Capacitor's own) — https://ionic.io/appflow
  - or **GitHub Actions** with a `macos-latest` runner.
  - I can write the `codemagic.yaml` / GitHub Actions workflow for whichever you pick.
- **If you have a Mac:** `npx cap open ios` → in Xcode set your Team (signing) →
  Run, or Product → Archive → upload to App Store Connect. (On the Mac, run
  `cd ios/App && pod install` first.)

---

## Native superpowers (add when you want them)
Capacitor has official plugins — add later, no UI rewrite:
- **Push notifications:** `@capacitor/push-notifications` (+ the web-push SW already
  in `client/public/sw.js` for the installed-PWA path)
- **Biometric/Face ID:** community `capacitor-native-biometric` or WebAuthn passkeys
- **Status bar / splash / app icon:** `@capacitor/status-bar`, `@capacitor/splash-screen`,
  and set the icons via `@capacitor/assets`.

---

## TL;DR fastest path to "it's on my phone, native, looking like the web"
- **Today, zero build:** install the PWA (web app → Add to Home Screen). Same look.
- **Android store app:** Android Studio → `npx cap open android` → run/sign.
- **iOS store app (no Mac):** Codemagic builds `ios/` in the cloud → TestFlight.
