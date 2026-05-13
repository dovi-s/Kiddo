# Kiddo Mobile

Native Expo app for Kiddo investment gifting.

## Where The App Is

- `apps/mobile/App.tsx`: root state machine and onboarding
- `apps/mobile/src/screens/`: mobile screens
- `apps/mobile/src/api.ts`: API client and local-device URL resolution
- `apps/mobile/src/push.ts`: push notification setup

## Commands From Repo Root

```bash
npm run mobile:dev      # Start Expo for a physical device over LAN
npm run mobile:phone    # Same device-focused Expo start path
npm run mobile:web      # Browser preview
npm run mobile:check    # TypeScript check
npm run mobile:reset    # Clear Expo and Metro caches
```

## Running On A Physical Device

1. Install Expo Go from the App Store or Google Play.
2. Make sure your phone and computer are on the same Wi-Fi.
3. Run the backend if you need live API data: `npm run dev`.
4. From the repo root, run `npm run mobile:dev`.
5. Scan the QR code in Expo Go.

The mobile app ignores `localhost` API URLs on a physical phone. During local development it derives your computer's LAN host from Expo and uses that for API calls, so the phone does not try to call itself.

Optional `apps/mobile/.env`:

```bash
EXPO_PUBLIC_API_URL=http://YOUR_MACHINE_IP:5000
EXPO_PUBLIC_WEB_URL=https://kiddofund.com
```

Only use a LAN IP for `EXPO_PUBLIC_API_URL` when testing on a real phone. Do not use `localhost` for physical-device testing.

## Current Screen Flow

```text
Splash
  -> Onboarding (welcome -> child -> investment)
      -> Auth (login / register)
          -> Dashboard (tabs: Home | Memory Book | Account)
              -> Fund Detail
              -> Add Fund
              -> Event Composer
              -> Account settings

Deep link (gift URL)
  -> Gifter Entry
      -> Gifter Flow (amount -> personalize -> payment -> confirmation)
```

## Shared Packages Used

- `@kora/tokens`: colors, spacing, radius
- `@kora/types`: shared TypeScript types
- `@kora/utils`: projection calculator and stock choices
- `@kora/content`: shared copy strings

## Environment Variables

| Variable | Default | Description |
|---|---|---|
| `EXPO_PUBLIC_API_URL` | Derived from Expo LAN host in dev | Backend API base URL |
| `EXPO_PUBLIC_WEB_URL` | `https://kiddofund.com` | Web app base URL used for gift share links |
