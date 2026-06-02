# Kiddo Mobile — Design Contract

This is the binding design + build spec for the native iOS/Android app. The bar is
**best-of-the-best, not an MVP.** The web app (desktop + responsive) is the proven,
polished reference; the native app must feel like the same product, rendered with
real native craft — and earn its existence with things only native can do (push,
biometric, home-screen presence, gesture/haptic intimacy).

> **The one rule that makes this work:** there is ONE design-token source —
> `@kora/tokens` (`packages/tokens/src/index.ts`) — and it mirrors the web system
> (`client/src/index.css`) exactly. Every screen and primitive reads from it. No
> inline hex, no ad-hoc spacing, no drift. (As of 2026-06-02 the tokens were
> corrected from a drifted palette — wrong greens/gold/ink, Inter font, web
> box-shadow strings — back to canonical.)

---

## 1. Inherited brand system (from the web, now in `@kora/tokens`)

- **Palette:** evergreen `#1B3A2D` (primary), evergreen-deep `#0E2518` (hero
  gradient end), gold `#C5821E` (CTA fill / decorative — **never** gold for text),
  gold-ink `#6F4611` (the AA text color on cream/gold), cream `#F8F5F0` (app bg),
  cream-dark `#EDE7DC` (tab rows), ink `#1A1710` (text), muted `#61615A` (secondary
  text, AA), border `#E5DDD4`, card `#FEFDFB` (faintly-warm near-white, not pure
  white). Three-color lock: evergreen + gold + cream; everything else derives.
- **Type scale:** 12/14/16/18/20/24/30/36. Body = **DM Sans**, headings =
  **Bricolage Grotesque** (`-0.2` tracking). Money/numbers use tabular figures.
- **Radius:** control 10, inner 14, **card 16** (canonical — 20 is hero only),
  container 24, pill ∞.
- **Motion:** durations 100/150/200/300 + cardEnter 450 + countUp 700 (locked);
  easings outExpo `[0.16,1,0.3,1]` (enter), inQuad (exit), outBack/spring
  (celebrations), decel (sheets). Mirror exactly — scatter breaks the premium feel.
- **Haptics by intent** (not random): selection / light / success / **gift**
  `[15,80,25]` / **milestone** `[80,60,120]`.

## 2. Native-translation decisions (where web ≠ RN)

- **The card shadow** is a 3-layer web compound (inset glass edge + near + depth)
  RN can't do in one shadow. `KiddoCard` renders: the `shadows.card` RN shadow
  (warm-ink color `#1A1710`, not black) **+** a 1px top hairline at `glassEdge`
  `rgba(255,255,255,0.6)` to fake the light-catching glass edge. That edge is the
  single biggest "premium not flat" detail — do not skip it.
- **Fonts** must be loaded with `expo-font` + `@expo-google-fonts/dm-sans` /
  `bricolage-grotesque` in `App.tsx` (hold splash until loaded). Until then RN
  falls back to the system font — acceptable interim, but **not** brand-final.
- **Safe areas:** use `react-native-safe-area-context` `useSafeAreaInsets()` — the
  `safeArea` CSS `env()` token is web-only (deprecated for native).
- **Haptics:** map intents to `expo-haptics` (`selectionAsync`,
  `notificationAsync(Success)`, `impactAsync`); raw `haptics` arrays are the
  Vibration fallback.
- **Inputs:** 16px minimum font (the web iOS-zoom fix applies natively too); 44px
  min touch targets (HIG/WCAG) — `touchTarget` token.

## 3. My top-tier mobile principles (added on top)

- **Thumb-first layout:** primary actions in the bottom third; destructive/rare
  actions out of the thumb arc. Bottom tab bar for top-level nav.
- **Native navigation,** not hand-rolled: `@react-navigation` (native-stack +
  bottom-tabs) for real gestures, transitions, deep links, and back-swipe.
- **Gesture + motion intimacy:** `react-native-reanimated` +
  `react-native-gesture-handler` for 60fps press-states, sheet drags, the
  count-up, and the milestone celebration — all respecting `prefers-reduced-motion`
  (vestibular safety is a brand value, same as web).
- **Optimistic + skeleton everywhere:** never a blank spinner; skeletons preview
  the post-load shape (mirror the web pattern). Cold loads fade in, never pop.
- **Lists virtualized** (`FlatList`/`FlashList`) for Activity / Memory Book.
- **Server state via the same contract:** reuse `shared/` logic (money math,
  milestones, types) + TanStack Query against the existing API — zero
  business-logic duplication, so native never drifts from web truth.
- **Empty/error states are designed,** warm, and actionable (never a dead end).

## 4. Locked rules inherited from web (enforced; do not violate)

- **No em-dashes** in user copy. **No AI-slop words** (seamless/empower/journey/…).
  **No banned icons** (Sparkles/SparkleBurst/Wand2) — Sprout is the reserved brand
  mark. **No hard-named custodian** ("our broker-dealer partner, Member FINRA/SIPC")
  and **no present-tense custody claims** until custody is live ("when investing is
  live"). Voice: warm, concrete, sentence-case labels, brevity.

## 5. App scope + navigation (the COMPLETE account-holder app — not a v0)

**Audience:** logged-in account-holders only. **Gifters stay on web** (account-less,
one-tap; an app would add friction) — drop the existing GifterFlow screen from the
native target; deep links to a gift page open the web flow.

**Bottom tabs:** Home (Dashboard) · Memory Book · Activity · Account.
**Stack screens:** Auth/Lock (biometric) → Onboarding → Fund Detail → Add Fund →
Event/Occasion composer → Kid View → Plan & billing → Recurring/gift management →
owner-mode/handoff surfaces → Settings.

## 6. How we build it (slices, each on a real device — every slice is top-tier)

Slicing is how we make a *perfect* thing testable at every step, **not** ship-the-
minimum. Each slice is built to the bar and loadable in Expo Go.

1. **Foundation:** the token layer (done) + primitives (`KiddoCard`, `Button`,
   `Text`/type, `Screen`/safe-area, `SectionLabel`, `Pill`, `Skeleton`), fonts
   loaded, navigation + query + haptics wired. Login/biometric → Dashboard (one
   fund). Proves the whole stack.
2. Funds overview + switching + Activity.
3. Memory Book + Kid View.
4. Plan/billing + recurring + gift management + owner-mode.
5. Push + Face ID + deep links.
6. Icons/splash/store assets → EAS builds → submission.

**Dependencies to add** (founder runs `expo install`, since it picks Expo-54-safe
versions + I can't run it): `@react-navigation/native @react-navigation/native-stack
@react-navigation/bottom-tabs`, `react-native-reanimated`,
`react-native-gesture-handler`, `react-native-screens`, `expo-linear-gradient`,
`expo-haptics`, `expo-font @expo-google-fonts/dm-sans` + a Bricolage Grotesque
source, `@tanstack/react-query`. (Already present: safe-area-context, secure-store,
biometric, push.)

## 7. Reaching "unbelievable" — the collaboration model

Beauty is not a blind one-shot (from anyone — lovable's first pass is iterated too).
The loop is the thing:
- **I build** every screen against this contract — coherent, correct, real data.
- **Hero moments** (Dashboard hero, Memory Book, the gift-landing celebration) get
  hi-fi visual direction (you / a designer / lovable/v0/Figma); I implement it
  pixel-faithfully with these tokens + native craft.
- **You run it on your phone, send screenshots, I iterate fast.** That feedback
  loop is what turns "very good" into "unbelievable." Judge results *after* one
  loop, never on a blind first draft.

**Founder-gated:** Apple Developer ($99/yr) + Google Play ($25) accounts, EAS build
creds, on-device testing, store submission/review. I write 100% of the code.
