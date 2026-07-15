# Kiddo Native — Craft Bar

The standard every native screen is built against. The bar is **best-of-the-best,
not an MVP** (per `DESIGN.md`): the web app is the proven reference; the native app
must feel like the same product rendered with real native craft, and earn its
existence with what only native can do (push, biometric, home-screen presence,
gesture/haptic intimacy).

This dossier is the synthesis of the internal specs (`DESIGN.md`, `APP_ROADMAP.md`,
`FACE_ID_SPEC.md`, `WARM_DATA_AND_LOCK_SPEC.md`, `PUSH_SETUP.md`,
`@kora/tokens`) plus current (2024-2026) external best-practice + competitor
research. URLs are cited inline so each rule is traceable. Keep new copy compliant
with the locked brand voice (no em-dashes, no AI-slop words, no banned icons, no
present-tense custody claims).

---

## 1. Binding brand / token constraints (exact values — from `@kora/tokens`)

There is **ONE** token source: `packages/tokens/src/index.ts` (`@kora/tokens`),
which mirrors the web system (`client/src/index.css`) exactly. No inline hex, no
ad-hoc spacing, no drift. Every screen and primitive reads from it.

### Palette (three-color lock: evergreen + gold + cream; everything else derives)
| Token | Hex | Use |
|---|---|---|
| `evergreen` | `#1B3A2D` | primary, hero gradient start |
| `evergreenDeep` | `#0E2518` | hero gradient end |
| `gold` | `#C5821E` | CTA fill / decorative — **never gold for text** |
| `goldLight` | `#EDC164` | warm highlight on light contexts |
| `goldInk` | `#6F4611` | the AA text color on cream/gold |
| `cream` | `#F8F5F0` | app background |
| `creamDark` | `#EDE7DC` | secondary surface (tab rows) |
| `ink` | `#1A1710` | text (16.4:1 AAA) |
| `muted` | `#61615A` | secondary text (AA, 5.6:1) |
| `border` | `#E5DDD4` | hairlines / dividers |
| `card` | `#FEFDFB` | card surface (faintly warm, **not** pure white) |

Semantic tints exist for `trust` / `gift` / `success` / `warning` / `danger` —
use those, do not hand-mix. Gift surfaces: bg `#FFF8EE`, border `#E8C783`, text
`#6F4611`.

### Type
- Body = **DM Sans** (`DMSans_400/500/600/700`); headings = **Bricolage
  Grotesque** (`BricolageGrotesque_700Bold`), heading tracking **-0.2**, label -0.1.
- Scale (px): **12 / 14 / 16 / 18 / 20 / 24 / 30 / 36**. `16` is also the iOS
  no-zoom input minimum.
- Money/numbers use **tabular figures**.
- Line heights: none 1 / tight 1.25 / snug 1.375 / normal 1.5 / relaxed 1.625.
- Load fonts with `expo-font` + `@expo-google-fonts/dm-sans` + a Bricolage source
  in `App.tsx`; **hold the splash until loaded** (system font is an acceptable
  interim, not brand-final).

### Radius
control **10** · inner **14** · card **16** (canonical) · hero **20** (hero card
only) · container **24** · pill ∞.

### Spacing (4px rhythm)
xs 4 · sm 8 · s3 12 · md 16 · s5 20 · lg 24 · xl 32 · s10 40 · xxl 48 · s16 64.

### Motion (durations ms / easings as cubic-bezier)
- Durations: instant **100** · fast **150** · normal **200** · slow **300** ·
  routeEnter 180 · **cardEnter 450** (LOCKED, list-item arrival) · **countUp 700**
  (LOCKED, ticker midpoint).
- Easings: `outExpo [0.16,1,0.3,1]` (entrances) · `inQuad [0.4,0,1,1]` (exits) ·
  `outBack [0.34,1.56,0.64,1]` (celebration overshoot) · `spring
  [0.175,0.885,0.32,1.275]` (dopamine moments) · `decel [0.32,0.72,0,1]` (sheets) ·
  `standard [0.4,0,0.2,1]` (height shifts).
- **Rule:** enter on `outExpo`, exit on `inQuad`. Stick to 2-3 durations per
  screen; >300ms feels laggy. (Source-of-truth note is in `client/src/index.css`.)

### Shadows (RN — warm-ink color `#1A1710`, never black)
`shadows.card` (offset y4, opacity .1, radius 12, elevation 3) ·
`shadows.cardHover` · `shadows.hero` (evergreenDeep color) · `shadows.overlay`.
The web card is a 3-layer compound RN can't do in one shadow → `KiddoCard` renders
`shadows.card` **plus a 1px top hairline at `glassEdge` `rgba(255,255,255,0.6)`**
to fake the light-catching glass edge. **That edge is the single biggest "premium
not flat" detail — do not skip it.**

### Haptics by intent (ms arrays; map to `expo-haptics` natively)
light `[10]` · medium `[20]` · heavy `[30]` · selection `[5]` · success `[10,50,20]`
· warning `[30,50,30]` · error `[50,30,50,30,50]` · **gift `[15,80,25]`** ·
**milestone `[80,60,120]`**. Semantic, never random.

### Touch / safe area
Min touch target **44** (`touchTarget.minimum`, HIG/WCAG), comfortable 52, primary
56. Use `react-native-safe-area-context` `useSafeAreaInsets()` — the CSS `env()`
`safeArea` token is web-only/deprecated for native.

### Locked voice rules (enforced)
No em-dashes. No AI-slop words (seamless / empower / journey / …). No banned icons
(Sparkles / SparkleBurst / Wand2 — Sprout is the reserved brand mark). No
hard-named custodian; **no present-tense custody claims** until custody is live
("when investing is live"). Warm, concrete, sentence-case labels, brevity.

---

## 2. Architecture standard

Target stack per `DESIGN.md`: Expo SDK 54, **New Architecture / Fabric**
(required by reanimated 4 + FlashList v2), React Navigation 7.

| Concern | Standard | Rationale | Source |
|---|---|---|---|
| **Runtime** | Expo SDK 54, New Architecture ON (`newArchEnabled: true`) | SDK 54 is the last to support legacy arch; reanimated 4 + FlashList v2 are New-Arch-only | https://docs.expo.dev/guides/new-architecture/ · https://swmansion.com/blog/introducing-reanimated-4-2-0-71eea21ca861/ |
| **Navigation** | **React Navigation 7** — `native-stack` (real iOS/Android back-swipe + transitions) + `bottom-tabs`. Use the v7 static config API for typed routes + deep linking | RN7 over Expo Router here: account-holder-only app, mobile-first, no web-parity need, and we want bespoke transitions + low-level control. Expo Router is built *on top of* RN, so we lose nothing native. | https://medium.com/@stranzer/expo-router-vs-react-navigation-which-one-should-you-use-in-2026-5f55dbd19e50 · https://viewlytics.ai/blog/react-navigation-7-vs-expo-router |
| **Tabs** | Bottom tabs: **Home · Memory Book · Activity · Account**. Thumb-first; primary actions in bottom third. Gifters stay on web (deep link → web flow). | Per `DESIGN.md` §5. Native bottom-tab bar = learned mental model + thumb reachability. | `DESIGN.md` |
| **Server state** | **TanStack Query** against the existing API; reuse `shared/` money math + types. Query-key **factory pattern**; mutations with proper rollback. Zero business-logic duplication. | Native must never drift from web truth. Factory keys = clean invalidation. | https://oneuptime.com/blog/post/2026-01-15-react-native-tanstack-query/view · `DESIGN.md` §3 |
| **Local/secure state** | `expo-secure-store` for the biometric pref + last-active timestamp (AsyncStorage isn't encrypted on iOS). `localStorage`-equivalent warm cache for stale-render. | `FACE_ID_SPEC.md`; warm-data Layer 1. | `FACE_ID_SPEC.md` · `WARM_DATA_AND_LOCK_SPEC.md` |
| **Animation** | **react-native-reanimated 4** + **react-native-gesture-handler**, all on the UI thread (60fps). Use `useReducedMotion()` / `ReduceMotion.System` on every transform/scale animation. | Reanimated 4 is optimized for Fabric/concurrent; gesture-handler drives press-states + sheet drags. | https://docs.swmansion.com/react-native-reanimated/docs/guides/performance/ · https://docs.swmansion.com/react-native-reanimated/docs/guides/accessibility/ |
| **Lists** | **FlashList v2** (`@shopify/flash-list`) for Activity + Memory Book; no size estimates needed in v2. | v2 is a New-Arch JS rewrite — faster load, precise rendering, pairs with expo-image for max list perf. | https://shopify.github.io/flash-list/ · https://docs.expo.dev/versions/latest/sdk/flash-list/ |
| **Images** | **expo-image** everywhere (Memory Book media, avatars), with `placeholder` + `transition` (cross-fade) + `contentFit`. | Minimizes decode/network/battery; built-in placeholder + transition make lists feel faster; best paired with FlashList. | https://medium.com/@engin.bolat/why-expo-image-is-the-best-image-solution-for-expo-in-2026-and-how-to-use-it-properly-fd648023a9c1 |
| **Gradients** | `expo-linear-gradient` for the hero (evergreen → evergreenDeep). | Hero card per token spec. | `DESIGN.md` |
| **Biometric** | `expo-local-authentication` (Face ID / Touch ID / Fingerprint, device-passcode fallback) behind `src/biometric.ts`. 5-min background re-lock. | Category table stakes; composes with Kid View hand-off. | `FACE_ID_SPEC.md` · https://docs.expo.dev/versions/latest/sdk/local-authentication/ |
| **Push** | Expo push already wired (registration, device storage, queued delivery, deep-link routing). Finish EAS project id + APNs/FCM creds + universal-link domain files for prod. | Native superpower; gift-landed / milestone / thank-you nudges. | `PUSH_SETUP.md` |
| **Primitives** | `KiddoCard` (shadow + glass-edge), `Button`, `Text`/type, `Screen` (safe-area canvas), `SectionLabel`, `Pill`, `Skeleton`. All read tokens only. | One vocabulary → no drift. | `DESIGN.md` §6 |

**Add-deps (founder runs `expo install` — picks SDK-54-safe versions):**
`@react-navigation/native @react-navigation/native-stack @react-navigation/bottom-tabs`,
`react-native-reanimated`, `react-native-gesture-handler`, `react-native-screens`,
`@shopify/flash-list`, `expo-image`, `expo-linear-gradient`, `expo-haptics`,
`expo-font @expo-google-fonts/dm-sans` + a Bricolage Grotesque source,
`@tanstack/react-query`, `@gorhom/bottom-sheet`. (Present: safe-area-context,
secure-store, local-authentication, push.)

---

## 3. Interaction & motion craft checklist (concrete, implementable)

### Haptics-by-intent map (wire `@kora/tokens` `haptics` → `expo-haptics`)
| Intent | expo-haptics call | Fires on |
|---|---|---|
| selection `[5]` | `Haptics.selectionAsync()` | tab change, fund switch, toggle, list-row tap |
| light `[10]` | `Haptics.impactAsync(Light)` | button press-in, sheet snap |
| medium `[20]` | `Haptics.impactAsync(Medium)` | primary CTA commit, pull-to-refresh trigger |
| success `[10,50,20]` | `Haptics.notificationAsync(Success)` | save/confirm landed (recurring set, note saved) |
| warning `[30,50,30]` | `Haptics.notificationAsync(Warning)` | destructive confirm shown |
| error `[50,30,50,30,50]` | `Haptics.notificationAsync(Error)` | failed mutation |
| **gift `[15,80,25]`** | custom double-impact (Light→pause→Medium) | a gift lands on the fund |
| **milestone `[80,60,120]`** | impact crescendo synced to the celebration | balance crosses a milestone |

Honor reduced-motion: when `useReducedMotion()` is true, drop scale/transform but
keep subtle fades, and soften/skip the celebratory crescendo (Reduce Motion often
correlates with reduced haptic preference). Source:
https://docs.swmansion.com/react-native-reanimated/docs/guides/accessibility/

### The count-up (hero balance) — the signature moment
- Drive with a reanimated `useSharedValue` + `withTiming(target, { duration: 700,
  easing: Easing.bezier(...outExpo) })`; format with tabular figures in a
  `useDerivedValue` → `useAnimatedProps` on a text component (no per-frame
  React re-render).
- **Roll once per kid** and snap on return (mirror the web's `rollKey` /
  per-key completion lock from `use-cached-first-number.ts` — do not re-roll on
  every fund switch). Seed from the **warm cache** so there's a number before the
  fetch lands.
- Directional color like Robinhood (up = settle on gain green, down = neutral) —
  but per brand honesty rules **never animate a loss as a gain**. Sources:
  https://medium.com/@ericyi/ux-teardown-3-robinhood-79e310f7578 ·
  https://matt-croak.medium.com/animate-your-digits-like-robinhood-2fd3e24bdc16

### Celebration moments (gift-landing, milestone)
- reanimated entrance on `outBack`/`spring` overshoot + the matching haptic
  (`gift` / `milestone`), **synced** so the buzz lands with the visual beat —
  Robinhood's rocket+haptic is the reference for "buzz in sync with motion."
  https://goodux.appcues.com/blog/robinhood-haptic-feature-announcement
- Faces/contributors cascade in (stagger ~`cardEnter` 450 per item), mirroring
  the web hero's `whileInView` face cascade.
- All celebration motion gated on `useReducedMotion()`.

### Sheets (`@gorhom/bottom-sheet`)
- Use for Add Fund, Occasion composer, gift-detail, plan/billing. Reanimated +
  gesture-handler under the hood → 60fps drag. Memoize snap points + callbacks;
  proper keyboard handling. Light haptic on snap.
  https://github.com/gorhom/react-native-bottom-sheet ·
  https://gorhom.dev/react-native-bottom-sheet/
- `+` means **add**, never expand (locked web rule). One 44px close affordance.

### Pull-to-refresh
- `RefreshControl` on the scroll/list container; only triggers at scrollY 0; debounce
  so spamming can't thrash. Medium haptic on trigger. Tint the spinner evergreen.
  Don't over-refresh — warm cache means most opens need no spinner at all.
  https://blog.expo.dev/react-native-pull-to-refresh-make-refreshing-easy-for-users-813088732c4f ·
  https://reactnative.dev/docs/refreshcontrol

### Skeletons / optimistic / warm-data (never a blank spinner)
- **Warm-data first** (`WARM_DATA_AND_LOCK_SPEC.md`): paint last-known-good from
  cache instantly (Layer 1), prefetch fresh during the Face ID / session check
  (Layer 2), then morph lock → dashboard (Layer 3). Goal: *by the time they're in,
  there's nothing left to load.*
- When a genuinely cold load needs a placeholder, use a **shimmer skeleton that
  matches the real layout's dimensions** (prevents layout shift), 60fps, respects
  reduced motion, screen-reader friendly. Reveal **once, fully real** — no
  half-loaded mix (the web "weird in-between" bug; cold loads fade in, never pop).
  https://oneuptime.com/blog/post/2026-01-15-react-native-skeleton-loading/view
- Mutations use **optimistic updates** (TanStack `onMutate` + rollback on error),
  with the success haptic on settle.
  https://tanstack.com/query/latest/docs/framework/react/guides/optimistic-updates

### Transitions
- Native-stack default platform transitions for stack pushes (free, correct,
  back-swipe works).
- **Shared-element / hero transitions** (reanimated `sharedTransitionTag`) for
  Memory Book thumbnail → full media, and fund card → fund detail. Only width /
  height / originX / originY / transformMatrix animate; reanimated shared transitions
  are react-navigation-only (fine, that's our nav). Fallback to a "fake" shared
  transition (measure + animate) where the real API is finicky.
  https://docs.swmansion.com/react-native-reanimated/docs/shared-element-transitions/overview/ ·
  https://mrousavy.com/blog/Shared-Element-Transitions-in-React-Native
- **App-switcher privacy:** branded snapshot (not live balances) — deferred to a
  config plugin per `FACE_ID_SPEC.md`, but on the punch list before any media demo.

### Press states
- Every tappable: scale-down ~0.97 on press-in (`outExpo` 150ms) + `selection`/
  `light` haptic. Run on the UI thread via reanimated/gesture-handler so it never
  drops a frame during scroll.

---

## 4. Competitor lessons

| App | What they do well natively | What to steal for Kiddo | Source |
|---|---|---|---|
| **Greenlight** | 4.8★; praised for simple setup + intuitive nav; **same app, two visual experiences** (parent controls vs. kid view of balance/goals). Hated: in-app cancel/dispute friction. | The dual-experience pattern → our parent surface vs **Kid View** must each feel native and complete. Avoid the cancel/dispute dark-pattern (recurring management must be easy to exit — aligns with our anti-dark-pattern stance). | https://www.finder.com/kids-banking/greenlight-card · https://www.benzinga.com/money/greenlight-debit-card-review |
| **Robinhood** | Iconic **rolling-digit balance** (digits rotate + tint by direction); **haptic synced to animation** (rocket); "subtle yet meaningful" motion that conveys progress without pressure; clean 4.2★ simplicity. | The count-up + directional tint (honest version) and **haptic-in-sync-with-motion** for our gift/milestone moments. Restraint: motion that informs, never hypes. | https://medium.com/@ericyi/ux-teardown-3-robinhood-79e310f7578 · https://goodux.appcues.com/blog/robinhood-haptic-feature-announcement |
| **Acorns / Acorns Early (+ EarlyBird)** | Managed-portfolio "hands-off" simplicity for families; EarlyBird's gifting-into-a-kid's-account was the direct analog (acquired + sunset by Acorns 2025). | Validates our wedge (gifting into a custodial fund). Lesson from EarlyBird's sunset: own the **relationship/loop**, not just the gifting feature. Keep the managed-default simplicity. | https://www.acorns.com/learn/acorns-earlybird-acquisition/ · https://thecollegeinvestor.com/17779/acorns-investing-review/ |
| **Cash App (teens)** | Deep **personalization** as delight: customize the Cash Card (color, stamps, draw, glow-in-the-dark); real-time alerts to parents. | Personalization as an emotional hook → let families personalize the fund/Memory Book surface (within brand). Real-time push on every money event. | https://techcrunch.com/2021/11/03/squares-cash-app-opens-up-to-teens-ages-13-to-17-with-parental-oversight/amp · https://www.emarketer.com/content/block-cash-app-preteens-parental-controls |
| **Monzo** | Actively hiring for **microinteractions + haptics** on its design-system team; baseline = instant push on transactions, clean mobile-first, fast feature discovery. | Treat microinteractions + haptics as a first-class design-system concern, not garnish. Instant push on every gift/contribution. | https://www.feelystudio.com/journal/the-evolution-of-fintech-design · https://peerlist.io/company/monzo45/careers |
| **Revolut / Cash App (brand)** | "Visually exciting while keeping credibility through dynamic animations: microinteractions that delight without distracting." | Permission to be delightful within a trust product — but our three-color lock + restraint keeps it calm, not loud. | https://www.feelystudio.com/journal/the-evolution-of-fintech-design |
| **Step (teens)** | Designed for teens + parents; the lifelong-user wedge (acquire young, keep for life). | Directly mirrors our at-18 handoff thesis — the native app is the relationship surface that carries the kid past 18. | https://techcrunch.com/2019/01/31/step-targets-teens-and-parents-with-a-no-fees-mobile-bank-account-and-visa-card |

**William Candillon / Software Mansion lesson:** declarative gestures +
animations (reanimated + gesture-handler) are how RN reaches native-grade feel —
animate on the UI thread, build interactions declaratively, and the gap to native
closes. (https://github.com/wcandillon/can-it-be-done-in-react-native ·
https://docs.swmansion.com/react-native-reanimated/docs/guides/performance/)

---

## 5. Prioritized "raise-the-bar" punch list (per Kiddo screen)

Priority: **P0** = the hero moments that define "premium"; **P1** = high-impact
craft; **P2** = polish/native superpowers.

### Home / Dashboard hero
- **P0** Count-up hero balance: reanimated shared-value `withTiming` 700ms outExpo,
  tabular figures, **roll once per kid + snap on return** (mirror web `rollKey`),
  seeded from warm cache. (§3 count-up; Robinhood)
- **P0** Hero card = `expo-linear-gradient` evergreen→evergreenDeep + `shadows.hero`
  + the glass-edge hairline. (tokens / `DESIGN.md`)
- **P0** Warm-data: instant stale paint → prefetch during lock → reveal once fully
  real, no skeleton flash. (`WARM_DATA_AND_LOCK_SPEC.md`)
- **P1** Contributors/faces cascade in (`cardEnter` stagger, `whileInView` analog);
  fund switch = `selection` haptic + instant (other funds prefetched).
- **P1** Projection / "on track for $X" never renders a half-loaded wrong number
  (the web bug) — gate on `heroDataReady`.

### Memory Book
- **P0** FlashList v2 + expo-image (placeholder + cross-fade transition). (§2 lists/images)
- **P0** Shared-element hero transition: thumbnail → full media. (§3 transitions)
- **P1** The "who loves this kid" roster as a warm, cascading native grid; avatars
  via expo-image with initials fallback (Kid View currently initials-only).
- **P1** Pull-to-refresh (evergreen tint, medium haptic).

### Activity
- **P0** FlashList v2 virtualized feed (the web's clean register).
- **P1** New-item arrival animation on `cardEnter` 450; `gift` haptic when a gift
  row lands live.
- **P1** Pull-to-refresh + optimistic "mark seen" (clears the row's New badge,
  mirroring web behavior) with rollback.

### Gift (account-holder view of gifts; gifters stay on web)
- **P0** Gift-landing celebration: `outBack`/`spring` entrance + `gift` haptic in
  sync; honest framing (never animate a loss as a gain). (§3 celebration)
- **P1** Gift detail in a `@gorhom/bottom-sheet` (drag, snap haptic, 44px close).
- **P1** Personalization touch (Cash App lesson) — a tasteful, on-brand way to make
  a gift moment feel made-for-this-kid.

### Account
- **P0** Face ID / biometric toggle + 5-min re-lock + branded lock screen with
  Sign-out escape hatch (`FACE_ID_SPEC.md`); lock screen shows a blurred warm
  teaser + cached-balance heartbeat (`WARM_DATA_AND_LOCK_SPEC.md`).
- **P1** Plan & billing in a sheet; recurring management that's **easy to exit**
  (anti-Greenlight-cancel-friction; aligns with our anti-dark-pattern stance).
- **P2** App-switcher privacy snapshot (branded, not live balances) before any
  media demo. (`FACE_ID_SPEC.md` deferred item)
- **P2** Push opt-in flow + deep-link routing verified on cold-start
  (`PUSH_SETUP.md` test checklist).

---

## Top 8 highest-impact craft moves (the summary)

1. **One token source, zero drift** — every screen reads `@kora/tokens`; the 1px
   `glassEdge` hairline on `KiddoCard` is the single biggest premium-vs-flat tell.
2. **The count-up hero**, reanimated 700ms outExpo, tabular figures, **roll once
   per kid + snap on return**, seeded from warm cache (Robinhood-grade, honest).
3. **Warm-data lock→dashboard morph** — instant stale paint, prefetch during Face
   ID, reveal once fully real; no spinner, no skeleton flash, no wrong numbers.
4. **Haptics by intent, synced to motion** — the `gift [15,80,25]` and `milestone
   [80,60,120]` patterns firing in sync with the visual beat (the Robinhood lesson).
5. **New-Architecture stack done right** — RN7 native-stack + bottom-tabs,
   reanimated 4 + gesture-handler on the UI thread, FlashList v2 + expo-image for
   Memory Book / Activity.
6. **Shared-element hero transitions** — Memory Book thumbnail → full media, fund
   card → detail, for that "the element flew with me" native feel.
7. **Celebration moments with restraint** — `outBack`/`spring` overshoot + matched
   haptic for gift-landing and milestones, every bit gated on `useReducedMotion()`.
8. **Biometric lock as trust + Kid-View boundary** — Face ID gate, 5-min re-lock,
   branded snapshot, blurred warm teaser; category table stakes that also powers the
   "parent is here right now" Kid View handoff.
