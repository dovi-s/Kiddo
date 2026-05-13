# Mobile Push Setup

This app already has Expo push registration, backend device storage, queued delivery, and deep-link handling for notification taps. Production delivery still depends on finishing the real Expo/EAS configuration below.

## 1. Required config

Set these before a production build:

- `apps/mobile/app.json`
  - replace `expo.extra.eas.projectId` with the real EAS project id
  - keep the `scheme` in sync with the links your backend sends
  - keep `associatedDomains` and Android `intentFilters` aligned with the real public gift hosts
- backend env/config
  - make sure queued push jobs point at the same deep-link hosts and app scheme
  - make sure the production API base URL is available to the app build

## 2. Expo / EAS

In Expo/EAS:

1. Link the mobile app to the correct Expo project.
2. Confirm the EAS project id matches `app.json`.
3. Store the iOS push key in Expo/EAS credentials.
4. Store the Android FCM server credentials in Expo/EAS credentials.
5. Build once per platform so the push entitlements are embedded in the native binaries.

## 3. Apple setup

For iOS, verify all of these:

- Push Notifications capability is enabled for the app id.
- Associated Domains capability is enabled.
- `apple-app-site-association` is served for `kiddofund.com` and any secondary link domain you keep live.
- The bundle id in Expo matches the Apple app id exactly.
- A physical iPhone test device can grant notification permission and receive a test push.

## 4. Android setup

For Android, verify all of these:

- FCM is configured for the Android package id.
- The SHA fingerprints used by Firebase match the build you ship.
- Asset links are served for `kiddofund.com` and any secondary link domain you keep live.
- A physical Android device can grant notification permission and receive a test push.

## 5. Deep-link routes this app now handles

Notification taps and universal links now route these cases inside the mobile app:

- `/gift/:identifier` -> opens the gifter flow directly
- `/dashboard`, `/activity`, `/events`, `/settings`, `/profile`, `/updates`, `/activate` -> opens the signed-in dashboard
- `/memory/:fundId`, `/kid/:fundId`, `/fund/:fundId`, `/funds/:fundId` -> opens the matching signed-in fund when found
- relative deep links like `/dashboard` -> normalized to `https://kiddofund.com/...` before routing

If a user is not signed in and the deep link needs account access, the app sends them to auth first.

## 6. Test checklist

Run this checklist before release:

1. Install a production-like build on a physical iPhone.
2. Install a production-like build on a physical Android device.
3. Enable notifications in the dashboard.
4. Send the backend test push.
5. Verify foreground receipt.
6. Verify background tap routing.
7. Verify cold-start tap routing from a terminated app.
8. Verify a `/gift/...` push opens the gifter flow.
9. Verify a `/memory/...` or `/fund/...` push opens the correct signed-in fund.
10. Verify a signed-out user lands on auth instead of a broken screen.
11. Verify disabling push stops future sends for that device.
12. Verify outdated domains are not still present in native link settings.

## 7. Common failure points

If push works in development but not in production, check these first:

- wrong or missing EAS project id
- APNs or FCM credentials missing in Expo/EAS
- universal-link domain files not deployed
- deep links still pointing at an old domain
- testing on simulator/emulator instead of a physical device
- user has notifications disabled at OS level
