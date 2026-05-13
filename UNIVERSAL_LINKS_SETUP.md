# Universal Links Setup

Updated: 2026-04-12

Purpose:
- document how Kora serves Apple and Android association files
- define the environment values required for real-device universal links

## What The Repo Now Serves

The web app now serves these endpoints from the Express server:

- `/.well-known/apple-app-site-association`
- `/apple-app-site-association`
- `/.well-known/assetlinks.json`

These endpoints are served before the SPA catch-all, so they can be requested directly by Apple and Android verifiers.

## iOS

Kora iOS bundle identifier:

- `app.kora.mobile`

The Apple association file requires the full app ID:

- `{APPLE_TEAM_ID}.app.kora.mobile`

Set one of these environment variables in production:

- `APPLE_TEAM_ID`
- `APPLE_APP_ID_PREFIX`
- `EXPO_APPLE_TEAM_ID`

The server will use the first one it finds.

If none is set, the Apple association file will still be served, but with an empty `details` array, which means universal links will not verify on real devices.

## Android

Kora Android package name:

- `app.kora.mobile`

Android app links require the real signing certificate SHA-256 fingerprint.

Set one of these environment variables in production:

- `ANDROID_SHA256_CERT_FINGERPRINT`
- `ANDROID_SHA256_CERT_FINGERPRINTS`

Use comma-separated values if you need to support more than one signing certificate.

If none is set, the server will return an empty `assetlinks.json` array, which means Android app links will not verify on real devices.

## Current Linked Paths

The Apple association payload currently allows these paths:

- `/gift/*`
- `/g/*`
- `/claim/*`
- `/send/*`

If Kora adds more production deep-link routes later, this list should be expanded.

## Domains

The mobile app is configured to expect links from:

- `getkado.com`
- `*.getkado.com`
- `kora.link`
- `*.kora.link` on iOS
- `getkado.com`
- `kora.link` on Android

Each production domain that should open the app needs to serve the same association files.

## Quick Verification

Once production env vars are set, verify:

1. `https://getkado.com/.well-known/apple-app-site-association`
2. `https://getkado.com/.well-known/assetlinks.json`
3. `https://kora.link/.well-known/apple-app-site-association`
4. `https://kora.link/.well-known/assetlinks.json`

Check for:

- `200 OK`
- `application/json` content type
- real Apple team ID in `appID`
- real Android SHA-256 fingerprint in `sha256_cert_fingerprints`

## Important Note

This repo now handles the server-side file serving.

Real universal link behavior on devices still depends on:

- correct production environment variables
- correct app signing identity
- correct deployed domains
- reinstalling the app after link association changes, when needed
