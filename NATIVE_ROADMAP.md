# Kiddo Native Superpowers — Roadmap

The benefits of being a *real* iOS/Android app, sequenced into something
buildable. The app today is the web app in a Capacitor shell (`com.kiddo.app`,
`android/` + `ios/`), plus an installable PWA. This doc is the plan for the
native capabilities on top of that.

## The lens (read this first)
Native is NOT an excuse to add engagement mechanics. Kiddo's brand is calm,
anti-compulsion, "earned not coerced," no badges/streaks (you removed the bell
for this reason). Native earns its place only when it does one of two things:

1. **Ambient presence** — the fund quietly visible in someone's life (widgets),
   never nagging.
2. **Less friction at the three moments that matter** — the gift (grandma's 90s),
   watch-it-grow, and the handoff at 18.

Every feature below is filtered through that. Engagement features that fail it
(badge counts, streaks, daily push) are listed under "Deliberately not building."

---

## Capability map

Legend — **Feasibility:** `web` = Capacitor plugin, bridgeable from the web app;
`native` = a separate Swift/Kotlin target that must be built in Xcode / Android
Studio (Capacitor does NOT give these for free). **Gated on:** what blocks it.

| Capability | Why it fits Kiddo | Brand | Feasibility | Gated on |
|---|---|---|---|---|
| **Home/Lock widget** (fund value + sparkline + next milestone) | The ambient "watch it grow"; on the parent's home screen, and on the KID's phone post-handoff = the ownership that drives handoff retention | ⭐ best fit | **native** (WidgetKit + Android Glance) + a data bridge | native env; deployed API |
| **Push notifications** (gift arrived · milestone · recurring reminder · handoff approaching) | Event-driven + rare = the gifter-loop re-exposure, not engagement spam | ✅ if rare/opt-in | **web** (`@capacitor/push-notifications`) or **web-push** for the PWA (VAPID) | email live + 3-channel discipline (below); APNs/FCM for native |
| **Share extension** ("Share to [kid]'s Memory Book" in the system share sheet) | Feeds the Memory Book = the switching-cost moat, zero friction | ✅ strong | **native** | native env |
| **App Clips / Instant Apps** (gift link → give in 90s, no install) | Removes the install barrier from the loop = more funded-k | ✅ wedge | **native** (lightweight target) | native env; deployed domain |
| **Universal / App Links** (gift + share links open the app) | The link *is* the loop | ✅ table-stakes | **web** (config + `apple-app-site-association` / `assetlinks.json`) | deployed domain; Apple Team ID; Android signing SHA-256 |
| **Biometric / Face ID lock** | Financial app; trust = moat | ✅ | **web** plugin | none (do anytime) |
| **Haptics** (gift lands, milestone) | The gift moment *feels* real | ✅ (started) | **web** plugin | none |
| **Passkeys via iCloud/Keychain** | Frictionless secure login (passkey auth already exists) | ✅ | mostly automatic | none |
| **Native camera capture → Memory Book** | Better than web upload for the moat surface | ✅ | **web** plugin | content-scanner gate (NCMEC) |

---

## Deliberately NOT building (off-brand)
- **App-icon badge counts / red dots** — manufactured compulsion; you killed the
  bell for exactly this. If ever used, ONLY for a genuine Tier-1 "needs you"
  action, never for a moment or a count.
- **Streaks / daily engagement loops** — violates the Kid View no-gamification
  principle.
- **Frequent / re-engagement push** ("come back!") — the opposite of "the hook is
  competence, not compulsion."
- **Live Activities / Dynamic Island** — Kiddo's events are slow (a fund grows
  over years), not the minutes-long thing Live Activities are for. Forced fit.

---

## The policy landmines (handle BEFORE submitting, or you get rejected/taxed)
These are the non-obvious blockers of a native launch — they are not optional
thinking.

1. **Apple IAP cut (the big one).** A native app selling Kiddo+ ($3.99/mo) as a
   digital subscription via Stripe risks rejection — Apple wants 30% on digital
   subscriptions. **But** regulated brokerage/financial services have carve-outs
   (the 0.10% AUM and the brokerage itself are not "digital goods"). Whether the
   *subscription* qualifies is the question. **Action:** get a written read from
   counsel + Apple guidance before submission; structure the in-app purchase path
   accordingly. Worst case the subscription must go through IAP (30%) while the
   investing stays outside it.
2. **COPPA / kids.** Kid View is child-facing and stores child PII (names,
   photos). COPPA applies regardless of App Store category, and connects to the
   existing content-scanner / NCMEC gate (`server/contentScanner.ts` stubs). The
   parent is the account holder, so the app is "parental finance," not the Kids
   Category — but the child data obligations stand. **Action:** confirm the data
   posture with counsel; keep child uploads behind the scanner gate.
3. **Sign in with Apple** is required if you offer any third-party login (Google,
   etc.). **Action:** add it if/when third-party auth ships.
4. **Apple "minimum functionality" (4.2).** A pure web-wrapper can be rejected.
   Mitigated by shipping at least one real native plugin (push, biometric, or the
   widget) so it's not "just a website." Bundling `dist/public` (vs a remote
   `server.url`) also helps. See `CAPACITOR_BUILD.md`.

---

## Build order (value ÷ effort, dependency-aware)

### Phase 0 — free wins, do anytime (no gates)
- **Haptics** everywhere the gift/milestone lands (plugin already in use).
- **Biometric lock** (`capacitor-native-biometric` or WebAuthn) — financial trust.
- One native plugin active also satisfies the 4.2 "not just a webview" bar.

### Phase 1 — push notifications (the first true superpower)
Push IS your loop re-exposure (gift arrived, the post-payoff recurring reminder).
But it must stay calm, so sequence it AFTER the notification discipline exists:
- **Prereq:** email live (`EMAIL_GOLIVE.md`) + the 3-channel model wired
  (`NOTIFICATIONS_ARCHITECTURE_SPEC.md` — Needs You / Money Record / Moments).
  Push categories map 1:1 to those channels; never a 4th "re-engage" channel.
- **Web-push path (PWA, no Apple/Google account needed):** generate VAPID keys,
  client subscribes (the SW in `client/public/sw.js` already has `push` +
  `notificationclick` handlers), store subscriptions, send via the web-push
  protocol. Verifiable on the installed PWA today.
- **Native path:** `@capacitor/push-notifications` + APNs (Apple acct) + FCM
  (Google acct) + backend send. Same backend, different transport.
- **Content rule:** event-driven + rare + opt-in. A gift, a milestone, a reminder,
  the handoff approaching. Nothing daily.

#### Notification sync & dedup — one person, one alert (founder ask, 2026-06-17)
A user can have several surfaces at once: the browser, the installed PWA, AND the
native app — plus email. Naïvely, one gift = three pushes + an email. That is the
bombardment the brand forbids. The rule that prevents it:

1. **The server record is canonical; push is a thin alert.** Every notifiable
   event already creates ONE server notification record per recipient (the same
   records that power `NotificationsPanel` → Activity read-state). The push/email
   only *points at* that record and carries its `notificationId`. So the content
   and the **seen/read state already live on the server** — dismiss on any
   surface, it's read everywhere. Sync is free; don't rebuild it client-side.
2. **Dedupe delivery by `(userId, notificationId)`, not by device.** Register all
   of a user's push targets (web-push endpoints + native tokens) keyed to the
   userId. On an event, send the alert to the user's **most-recently-active push
   surface only** — not every subscription. The native app supersedes the PWA on
   the same device (mark the PWA subscription dormant when the native token
   registers).
3. **Belt-and-suspenders: the client dedupes by id too.** Both the SW
   (`client/public/sw.js`) and the native handler check "have I already shown
   `notificationId`?" before displaying, so even if two targets ever fire, the
   person sees one.
4. **Email is the durable RECORD, not a duplicate ALERT.** Send email only when
   there's no active push surface, or as a daily/threshold digest — never the same
   blaring thing twice for one event. (Aligns with the away-digest + the
   recurring-reminder decisions.)

Net: at most **one alert per event per person**, on their best surface, with one
shared read-state. This is the multi-surface expression of the 3-channel model.

### Phase 2 — the fund widget (highest on-thesis value)
The ambient "watch it grow," and on the kid's phone post-handoff it's the
ownership that drives retention. Real native work:
- **Data bridge:** the web app writes `{ childName, value, sparkline[], nextMilestone }`
  to shared storage — iOS App Group (`group.com.kiddo.app`) and Android
  SharedPreferences — via a small Capacitor plugin. Refresh on dashboard load +
  on a background fetch.
- **iOS:** a WidgetKit extension (Swift) reading the App Group, small/medium
  sizes, calm cream/evergreen brand, the count + a tiny sparkline.
- **Android:** a Glance (or RemoteViews) App Widget reading SharedPreferences.
- **Honesty:** the widget shows the same hedged value the app does (investing not
  live yet → no "live" framing).

### Phase 3 — friction-killers for the loop
- **Universal / App Links:** serve `apple-app-site-association` and
  `assetlinks.json` from the deployed domain; route gift/share links into the app.
  (File contents below — ready once you have the Team ID + Android signing SHA-256.)
- **Share extension:** "Share to [kid]'s Memory Book" in the system share sheet,
  feeding the Memory Book moat.
- **App Clips / Instant Apps:** the gift link launches a no-install native mini-flow
  ("grandma's 90 seconds" with native polish), then offers the full install.

---

## Ready-to-apply: Universal / App Links

When the domain is deployed and you have the IDs, add these.

**`client/public/.well-known/apple-app-site-association`** (no extension, served as
`application/json`; replace `TEAMID`):
```json
{
  "applinks": {
    "apps": [],
    "details": [
      { "appID": "TEAMID.com.kiddo.app", "paths": ["/gift/*", "/g/*", "/claim/*", "/dashboard*"] }
    ]
  }
}
```

**`client/public/.well-known/assetlinks.json`** (replace the SHA-256 from your
Android signing key — `keytool -list -v -keystore ...`):
```json
[{
  "relation": ["delegate_permission/common.handle_all_urls"],
  "target": {
    "namespace": "android_app",
    "package_name": "com.kiddo.app",
    "sha256_cert_fingerprints": ["REPLACE_WITH_SIGNING_SHA256"]
  }
}]
```

Then handle the inbound URL in the app (Capacitor `App.addListener('appUrlOpen', …)`)
and route to the existing web route.

---

## What blocks what (so nothing surprises you)
- **Native env (Xcode / Android Studio):** widget, share extension, App Clips.
- **Founder accounts:** Apple Developer ($99) + Google Play ($25) — signing,
  App Clips, push credentials.
- **Deployed backend (`render.yaml`):** anything that fetches live data (widget,
  push send, universal-link round-trips).
- **Email live + notification discipline:** push (so it stays calm, not spam).
- **Counsel:** the IAP/subscription structure + COPPA posture.

The fastest *visible* native superpower with the least gating is **web-push to the
installed PWA** (VAPID, no app-store accounts) — but only once the 3-channel
notification model is wired so it stays on-brand. The most *valuable* is the
**widget**. Build Phase 0 free wins anytime; everything else waits on the gate
next to it.
