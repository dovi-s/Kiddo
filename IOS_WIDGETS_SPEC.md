# iOS Widgets Spec

> Status: **Spec — not built yet.** This document captures the strategic
> + technical plan for shipping iOS home-screen and lock-screen widgets
> for Kora. The mobile app at `apps/mobile/` currently has zero widget
> infrastructure (no `ios/` folder, no Widget Extension target, no App
> Group). This spec exists so when widgets become a Q-priority, the
> full plan is ready to act on without re-deriving it.
>
> Last updated: 2026-05-13

---

## TL;DR

Build small + lock-screen widgets first. Both anchor the kid-at-18 lens
on the parent's daily screen-wake habit. Cost: ~2 weeks of native iOS
work, mostly on the data-bridge + ejection-to-prebuild plumbing, not on
SwiftUI. The actual widget code is small once the infrastructure exists.

---

## Why widgets matter for Kora

The product's whole premise is *"watch this kid's fund grow over 18 years."*
A widget is the only iOS surface that delivers that promise **passively** —
no app launch, no notification, just the kid's balance sitting on the home
screen every time the parent picks up their phone.

Every screen-wake is a memory anchor:
- The parent sees Emma's $1,917 and thinks about the next birthday gift link
- They see today's +$3 and feel the compounding
- They see grandma's recent gift and think about the village
- They long-tap the widget and share the link

That's the **gifter-loop habit trigger built into iOS itself.** Passive,
always working, free distribution from Apple. The closest analog is the
Acorns widget — and our differentiator is that we have something the
generic brokerage doesn't: **a named child, a community of gifters, a
sealed Memory Book waiting for age 18.**

---

## The widget inventory

### Tier 1 — Parent-facing, home screen

| Family | Size | Content | Tap action |
|---|---|---|---|
| `systemSmall` | 2x2 | Child first name · Balance · Period delta | Open fund Dashboard |
| `systemMedium` | 4x2 | Same as small + 2-3 recent gifts ("Grandma · $25 · 2d") | Open Activity |
| `systemLarge` | 4x4 | Balance + sparkline chart + 2 recent gifts + Share button (iOS 17+ AppIntent) | Tap-anywhere → Dashboard; Tap-share → share sheet directly |

### Tier 2 — Parent-facing, lock screen (iOS 16+)

| Family | Form | Content |
|---|---|---|
| `accessoryCircular` | ~30pt circle | Progress ring toward goal (e.g. $5k for "First Car"); inner shows percentage |
| `accessoryRectangular` | small rect under clock | "Emma's fund · $1,917 · +2.3%" |
| `accessoryInline` | single text line above clock | "Emma's fund $1,917" |

Lock-screen widgets are gray-only, no images, severely constrained — but
they're the **highest-visibility surface on iOS.** Every phone wake shows
them. Shipping these alongside small is higher leverage than shipping
medium.

### Tier 3 — Family-tier differentiator

| Family | Variant | Content |
|---|---|---|
| `systemMedium` (configurable) | "All my kids" mode | Rotates between each child's small card every ~10s |
| `systemLarge` (configurable) | "Family overview" mode | All kids in a grid: each cell has name + balance + delta |

This is a real Family-tier benefit, not just chrome. A parent with three
kids on the Family plan can put one widget on their home screen and see
all three at a glance. Locked behind `subscription.effectivePlan === "family"`.

### Tier 4 — Gifter-facing (Phase 2)

| Family | Content | Path |
|---|---|---|
| `systemSmall` | "Your $50 → $52.40 to Emma" | Tap → gift again link |
| `accessoryRectangular` | "Your gifts to Emma: $250 (+$8)" | Tap → fund page |

**Commercial caveat:** gifters typically don't have the Kora app
installed (that's the design — no account required to gift). The gifter
widget requires download → onboarding → linking gifts to the widget,
which is a meaningful conversion ask. Ship parent-side widgets first;
gifter widget is a Phase 2 acquisition play with its own download
prompt: "See your gifts grow on your home screen — download Kora."

---

## Technical architecture

### The hard part is NOT the SwiftUI

The actual widget Swift code is small (~200 lines per widget). The
real work is everything around it.

### Required infrastructure

1. **Eject Expo managed → prebuild workflow** (or use config plugin)
   - Currently: pure Expo, no `ios/` folder
   - Options:
     - **A. Manual prebuild** (`expo prebuild`) — generates `ios/` once, then maintain by hand. Lose the easy `eas update` OTA pipeline for native changes.
     - **B. Config plugin** (`react-native-widget-extension` or `@bittingz/expo-widgets`) — keeps the project managed, plugin injects the Widget Extension target at prebuild time. Best of both worlds but plugin ecosystem is community-maintained.
     - **C. Custom config plugin** — write our own; gives full control, more work to maintain.
   - **Recommendation: B.** Start with a community config plugin; migrate to C if we hit limitations.

2. **Widget Extension target** (Xcode-side)
   - New target type: "Widget Extension"
   - Bundle ID: `com.kora.mobile.KiddoWidget` (App Store Connect entitlement needed)
   - Deployment target: iOS 16.0 (gets us 95%+ device coverage in 2026; lock-screen widgets require 16+)
   - SwiftUI views + Timeline provider + (optional) AppIntents for iOS 17 interactivity

3. **App Group container** (data bridge)
   - Group ID: `group.com.kora.shared`
   - Both the main app target AND the widget extension need this entitlement
   - Acts as a shared filesystem + UserDefaults namespace both targets can read/write
   - All widget data flows through here

4. **Data sync (RN-side)**
   - Background task in React Native that writes `widget-state.json` to the App Group container
   - Triggers:
     - App foreground (always refresh on open)
     - Push notification arrival (write fresh state, then call `WidgetCenter.shared.reloadAllTimelines()`)
     - Pull-to-refresh on Dashboard (manual refresh)
     - On significant state change (gift received via realtime, milestone hit)
   - Use `react-native-shared-group-preferences` or expose a native module via the config plugin

5. **Widget timeline provider (Swift-side)**
   - Reads `widget-state.json` from App Group at each timeline reload
   - Provides entries based on read state
   - Reload policy: `.atEnd` with hourly placeholder entries — iOS schedules from there
   - Don't try to refresh every 30 min; iOS won't honor it and the budget burns

### Widget state schema

The JSON the RN app writes to App Group, that the widget reads:

```jsonc
{
  "version": 1,
  "lastWriteAt": "2026-05-13T14:32:01Z",
  "activeFund": {
    "id": "fund_abc123",
    "childFirstName": "Emma",
    "pronoun": "she",  // for getPronouns() copy compliance
    "balance": 1917.42,
    "balanceTotal": 2150.00,  // balance + cash + pending (display denominator)
    "deltaAllTime": 273.40,
    "deltaThisMonth": 14.80,
    "deltaToday": 3.10,
    "goalAmount": 5000.00,  // optional, for progress-ring widget
    "goalLabel": "First Car",
    "recentGifts": [
      { "from": "Grandma", "amount": 25, "ago": "2d", "isAnonymous": false }
    ],
    "shareUrl": "https://kiddofund.com/emma",  // for iOS 17+ AppIntent share
    "chartPoints": [/* 30 daily snapshots for sparkline */]
  },
  "allFunds": [/* Family-tier: every fund the parent owns */],
  "settings": {
    "showFundValueInWidget": true,  // privacy toggle
    "preferredDelta": "all_time"  // "today" | "month" | "all_time"
  }
}
```

### Privacy toggle

Putting "Emma · $1,917" on a home screen means anyone who glances at the
parent's phone sees it. Most parents are fine; divorce / custody /
financial-privacy edge cases exist.

Add to mobile settings: **"Show fund value in widget"** (defaults `true`,
toggle to `false`). When off, widget shows generic copy:
- Small: "Emma's fund" (no balance shown)
- Lock screen: "Kora · Tap to open"
- Medium/large: copy collapses to qualitative ("Your fund is growing")

Toggle stored in `widget-state.json.settings.showFundValueInWidget`.

---

## Ship order

Each phase is shippable on its own. The big upfront cost is Phase 0;
after that each widget is incremental.

### Phase 0 — Infrastructure (one-time, ~3 days)

- [ ] Choose config-plugin approach (`react-native-widget-extension` or `@bittingz/expo-widgets`)
- [ ] Configure App Group + entitlements
- [ ] Native module / shared-prefs bridge for writing `widget-state.json`
- [ ] Verify dev client builds with the widget extension included
- [ ] First widget displays test data (hello-world)

### Phase 1 — The home-screen anchor (~2 days)

- [ ] `systemSmall` widget: child name + balance + delta
- [ ] Tap → opens fund Dashboard via deep link
- [ ] RN-side writes fresh state on app foreground + push notification
- [ ] App Store Connect: widget gallery preview asset (~80x80 PNG, see Apple HIG)
- [ ] TestFlight build with one user

### Phase 2 — Lock screen widgets (~1 day)

- [ ] `accessoryCircular` — progress ring (uses goalAmount if set)
- [ ] `accessoryRectangular` — name + balance + delta inline
- [ ] `accessoryInline` — text above clock
- [ ] All three share the same Timeline Provider; just different views
- [ ] Smart Stack relevance hints (low when nothing happened in 7d)

### Phase 3 — Medium widget (~1 day)

- [ ] `systemMedium` — balance + 3 recent gifts row
- [ ] Tap → opens Activity
- [ ] Gifter names: respect anonymity flag (don't show name when `isAnonymous: true`)
- [ ] Pronouns: any subject/possessive uses `getPronouns(activeFund.pronoun)`

### Phase 4 — Large widget with interactive share (~2 days)

- [ ] `systemLarge` — balance + sparkline chart + 2 gifts + Share button
- [ ] iOS 17+ AppIntent: `ShareGiftLinkIntent` — tap-share opens system share sheet directly
- [ ] iOS 16 fallback: tap-share opens app to share modal
- [ ] Chart: minimal sparkline, no axes, green/red based on direction (honest losses, no fabrication)

### Phase 5 — Family-tier configuration (~2 days)

- [ ] `WidgetConfigurationIntent` — let user pick which child's fund the widget shows
- [ ] "All my kids" mode: rotates through funds on iOS-controlled cadence
- [ ] Gated on `subscription.effectivePlan === "family"`; non-Family users see single-kid only

### Phase 6 — Gifter widget (Phase 2 product, defer past initial launch)

- [ ] Requires download flow first ("Watch your gifts grow")
- [ ] Onboarding: link gift email → app account → widget
- [ ] Separate from parent widget bundle; lives in `KoraGifterWidget` extension

---

## Locked rules the widget MUST follow

Per the project's locked design memory:

1. **No em-dashes** in any widget copy. (`feedback_no_emdash.md`)
2. **Pronouns via getPronouns(fund.pronoun)** — never hardcoded "she" / "her" / "their"
3. **Never "contribute" in UI copy** — use "gift" / "gifts" / "Add to"
4. **"Share" and "gift" are not synonyms** — share the link, give the gift
5. **No marketing teaser quotes** — eyebrow + balance + CTA is enough
6. **Total fund balance (cash + invested + pending)** is the display denominator, matching Dashboard hero. Per locked AUM model: fee is on invested only, but DISPLAY is always total.
7. **Anonymous flag must be explicit** — never infer from name patterns. If `isAnonymous: true`, suppress name and show "Anonymous" or omit row entirely.
8. **Calm Apple-Settings register** — no celebration emoji storms, no "WOW", no "Don't miss out". Quiet, honest, factual.
9. **Majority age is state-specific** — when widget shows "until age 18," derive from `fund.majorityAge` (18-21 by state).

---

## Smart Stack relevance + Dynamic Island

### Smart Stack

iOS users put widgets in a rotating stack. Provide relevance hints
via `TimelineEntryRelevance`:

| State | Relevance | Why |
|---|---|---|
| Gift received in last 24h | High | The "village" moment; parent wants to see it |
| Fund crossed milestone in last 24h | High | Once-in-a-while emotional anchor |
| Birthday in 7-14 days | Medium-high | Lead-up window |
| Nothing happened in 7+ days | Low | Don't rotate to front; let other widgets win |

### Dynamic Island (iPhone 14 Pro+ / 15+ / 16+)

Not V1 but cheap to extend once widget infrastructure exists. Use Live
Activities (`ActivityKit`) to pulse the Dynamic Island when:

- A gift just landed: "🌱 +$50 from Grandma" for 30 seconds
- Auto-invest fired: "💚 $50 invested in Emma's fund" for 30 seconds

Live Activities share the same App Group data, so once widgets ship,
this is ~1 day of extra Swift work.

---

## Open questions

1. **Apple kid-data review.** Displaying a custodial UTMA holder's first
   name + balance on the home screen — does this trip any Apple
   kid-data policies (specifically the App Store Review Guidelines on
   apps for kids)? Probably fine because UTMA is the parent's
   responsibility and the kid isn't the user, but worth a 15-min review
   with App Review's Family Account guidance before TestFlight.

2. **Background sync battery cost.** Writing `widget-state.json` on
   every push notification is fine; pulling realtime updates while
   the app is closed isn't worth the battery hit. Confirm the
   notification handler can write the file even when the app is
   suspended (it can on iOS, but verify with the chosen config plugin).

3. **Chart rendering on widget.** SwiftUI `Charts` framework is iOS 16+
   but might not be available in all widget contexts. Fallback to
   manual `Path` drawing for the sparkline.

4. **Localization.** English-only for V1. Spanish + French likely Phase
   2; widget copy short enough that translation isn't blocking.

5. **Android equivalent.** Material You widgets via Glance / Jetpack.
   Out of scope for this spec but worth a parallel spec doc when iOS
   ships and stabilizes.

---

## References

- Apple [WidgetKit framework docs](https://developer.apple.com/documentation/widgetkit)
- Apple [Human Interface Guidelines — Widgets](https://developer.apple.com/design/human-interface-guidelines/widgets)
- Apple [App Intents](https://developer.apple.com/documentation/appintents)
- Expo [Custom Native Code](https://docs.expo.dev/workflow/customizing/)
- `react-native-widget-extension` (community config plugin)
- `@bittingz/expo-widgets` (alternative config plugin)
- Internal: `project_chrome_scope_tiers.md` (every Kora surface has a scope; widget = fund-scoped Tier 1)
- Internal: `feedback_no_emdash.md`, `feedback_iconography_consistency.md`
- Internal: `KORA_DESIGN_GUARDRAILS.md`

---

## When to come back to this spec

Don't ship widgets until:

1. The web Kora dashboard is genuinely polished (currently has known gaps tracked in `EXECUTION_BOARD.md`)
2. The mobile app itself feels production-ready (currently labeled "real but rough")
3. Gifter loop is performing — we have signal that the home-screen anchor would amplify a working loop, not paper over a broken one

When those three things are true, widgets become a focused 2-week sprint
with this spec as the playbook. Until then, this document waits.
