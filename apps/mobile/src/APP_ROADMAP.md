# Kiddo Mobile Roadmap

**The bar is best-of-the-best, not an MVP.** Full design + build spec lives in
`apps/mobile/DESIGN.md` — read it first. This roadmap is the build order; every
phase is built to the top bar and loadable on a real device (Expo Go), not a stub.

Audience = logged-in account-holders only. Gifters stay on the web (account-less,
one-tap); a native gift flow would only add friction, so the legacy GifterFlow
screen is dropped from the native target.

## Phase 0 — Foundation (in progress)
- [x] `@kora/tokens` corrected to canonical brand (palette, type scale, RN shadows,
      easings, haptics) — the single token source every screen reads.
- [x] `apps/mobile/DESIGN.md` design contract.
- [ ] Add deps (`expo install`, founder action): navigation, reanimated,
      gesture-handler, screens, linear-gradient, haptics, expo-font + DM Sans +
      Bricolage Grotesque, @tanstack/react-query.
- [ ] Primitives: `KiddoCard` (shadow + glass-edge), `Button`, `Text`/type,
      `Screen` (safe-area canvas), `SectionLabel`, `Pill`, `Skeleton`.
- [ ] Fonts loaded in `App.tsx` (splash held until ready).
- [ ] Navigation (native-stack + bottom-tabs) + TanStack Query + haptics wired.
- [ ] Auth / biometric lock → Dashboard (one fund). Proves the whole stack.

## Phase 1 — Core relationship surfaces
- [ ] Funds overview + fund switching.
- [ ] Activity (virtualized list, the web's clean feed register).
- [ ] Memory Book (entries, media, the village/"who loves" roster).
- [ ] Kid View.

## Phase 2 — Management + money
- [ ] Plan & billing (incl. the plan-fit downgrade surface).
- [ ] Recurring + gift management.
- [ ] Add Fund + Occasion composer.
- [ ] Owner-mode / age-18 handoff surfaces.

## Phase 3 — Native superpowers
- [ ] Push notifications (gift landed, milestone crossed, thank-you nudges).
- [ ] Face ID / biometric login.
- [ ] Universal/deep links (gift links, age-18 claim).
- [ ] Celebration moments (milestone, gift-landing) with reanimated + haptics.

## Phase 4 — Ship
- [ ] App icon / splash / store screenshots + copy.
- [ ] EAS builds (iOS + Android).
- [ ] App Store + Play submission + review (founder: dev accounts).

## Sequence note
This is a **parallel / post-launch track.** Public launch is gated by counsel +
custody (the web app), not by this app. Build it alongside; do not let it delay the
counsel packet.
