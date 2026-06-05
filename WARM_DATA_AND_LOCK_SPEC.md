# Warm-Data Layer + Lock Screen — "smooth as fuck" spec

Status: **spec / ready to execute** (not built). Authored 2026-06-05 from the
design-lab session. Step 1 (kill the wrong loading-state numbers) is **shipped**
in `DashboardLab.tsx`; everything below is the next focused build.

---

## North star

**Auth is not a gate you pass through — it's a warm-up runway.** Every second the
user spends doing Face ID / typing a code is a second we spend making the
destination *already there*. The goal isn't "load faster." It's: **by the time
they're in, there is nothing left to load.** No spinner, no skeleton, no
empty-state flash — the dashboard is present, fresh, and animating.

This also *is* the fix for the "loading phase / ugly empty components" problem:
warm data = no skeletons, no empty-state flashes, no double-reveal.

---

## The three layers

### Layer 1 — Instant (0 ms): stale render from local cache
The dashboard's last-known-good state lives in `localStorage`. On **any** open,
paint it **instantly** — balance, projection, faces, recurring, the lot. No
spinner. Worst case it's a few hours stale for half a second, then quietly rolls
to fresh.

- We already do this for the hero number via `useCachedFirstNumber` +
  `FUND_*_CACHE_PREFIX` keys. **Extend it to the whole summary**: cache the full
  `dashboardSummary` (and the per-fund `parent-contributions`) to `localStorage`
  on every successful fetch; seed the queries from that cache on mount.
- React Query gives us in-memory caching for the session; localStorage gives us
  **cross-session / cold-load** instant paint.
- Pattern: `initialData: readCachedSummary(fundId)` + `onSuccess: writeCache(...)`
  on each query, guarded against writing a partial/poisoned payload (mirror the
  existing balance-cache guard).

### Layer 2 — Warm (during auth): prefetch the fresh data
The moment the lock screen (or session check) appears, **we already know who they
are** — so fire every dashboard query in the background. Face ID takes ~1–2 s;
that's plenty to land fresh `summary` + `holdings` + `gifts` + `chart` in the
cache. By unlock, the stale numbers roll to fresh with **no loading state**.

- Implement with `queryClient.prefetchQuery` / `ensureQueryData` for the active
  fund's query keys, triggered from the lock screen mount (or app shell once
  `funds` is known).
- **Caveat:** the dashboard's `queryFn`s are currently defined inline in the
  component. To prefetch from elsewhere, lift the query key + fetcher into a small
  shared module (e.g. `client/src/lib/dashboard-queries.ts`) so both the
  prefetcher and the component use the identical key/fetcher. Do this refactor
  first — it's the enabling step.

### Layer 3 — Seamless: the lock *morphs* into the dashboard
Don't cut from lock → blank loading dashboard. The unlock success **cross-fades
straight into the warm, ready screen.** It should feel like the lock *was* the
dashboard, blurred — and literally it was (it's warm behind it). Use a shared
`AnimatePresence` / layout transition between the lock and the dashboard shell.

---

## Mobile (Face ID / PIN) — the lock screen

- A re-auth **app lock** (returning user; we already have the session, so we know
  the funds → prefetch works). Biometric (Face ID / Touch ID via the native
  layer, `expo-local-authentication` in `apps/mobile/`) with a **PIN fallback**.
- **Outside-the-box:** show a **blurred teaser of the real dashboard behind the
  lock** — the balance faintly legible, the faces ghosted. Unlocking feels like
  *lifting fog off something already there* (and it is — warm behind the blur).
- **Bonus heartbeat:** a subtle count-up of the *cached* balance on the lock
  screen itself, so there's life before you're even in.

## Desktop / web

- **Option A — optional PIN lock** (privacy on shared machines; banks do this) →
  same prefetch window, same magic. Off by default; opt-in in Settings.
- **Option B — no lock, warm on the session check**: prefetch in parallel with
  the `/api/auth/me` round-trip.
- **Hover-intent prefetch:** warm the dashboard the instant they hover the login
  button or the "Dashboard" nav link.
- Layer 1 (stale-render) alone makes a cold desktop load feel instant regardless.

## Genuinely outside-the-box

- **Prefetch ALL funds on unlock**, not just the active one → switching kids is
  *instant* too (and the demo's "switch = a gift rolls in" beat lands with zero
  lag). Predictive order: active fund first, siblings as bandwidth frees up.
- **Connection warming:** during the lock, pre-open the API socket
  (DNS / TLS / HTTP2) — e.g. a cheap `HEAD /api/health` or a `<link rel="preconnect">`
  — so the first real fetch is on a warm connection.

---

## Already done (don't redo)

- **Layer 1 — stale-render: ALREADY BUILT** (discovered 2026-06-05). The
  `dashboard-summary` query already has `initialData: () => readCachedDashboardSummary(activeFundId)`
  and writes the cache on every success (`DASHBOARD_SUMMARY_CACHE_PREFIX`).
  `parentContributions` seeds from the summary (`initialData: () => dashboardSummary?.parentContributions`).
  → **Returning to a fund is already instant from localStorage.** The empty
  state only hits a genuinely *cold first-ever view* of a fund.
- **Layer 2 (partial) — prefetch the OTHER funds: SHIPPED** in `DashboardLab.tsx`
  (`e0f593b`). Once the active fund settles, `requestIdleCallback`-prefetches
  every other fund's summary into the cache + localStorage → **instant
  fund-switching**, zero-lag demo switch-beat. Remaining Layer-2 work = prefetch
  the *active* fund *before arrival* (needs a pre-dashboard moment: lock screen,
  landing, or hover-intent).
- **Step 1 — kill the wrong loading-state numbers** (shipped in `DashboardLab.tsx`):
  a `recurringDataReady` / `heroDataReady` gate holds a **calm pulse** instead of a
  *wrong* value while per-fund data loads. Fixed: the hero + handoff "On track for
  $X" projection (was computing from $0/mo recurring → far too low, then jumping),
  the recurring line (was "Set up recurring" when recurring exists), and the chart
  stat ("+$X this month" computed from a half-loaded baseline = the whole balance).
- **React Query already caches in-memory** → returning to a seen fund is already
  instant. The pulses only appear on a genuinely cold first load.

So the warm-data layer is a **polish-of-a-polish** (instant vs. brief-pulse), not
a fix for something broken. Build it for the *delight*, not because the load is
broken — it isn't anymore.

---

## Recommended build order

1. **Lift dashboard query keys + fetchers into a shared module** (enables
   prefetch + consistent caching). Pure refactor; no behavior change.
2. **Layer 1 — localStorage stale-render for the full summary** (extend the
   existing cached-number pattern). Biggest single UX win; works with no lock.
3. **Layer 2 — prefetch hook** (`useWarmDashboard(fundId)` / all funds), called
   from the app shell and later the lock screen.
4. **Connection warming** (`preconnect` + optional `HEAD /api/health`).
5. **Lock screen** (mobile biometric + PIN, desktop optional PIN) with the
   blurred-teaser + count-up heartbeat.
6. **Layer 3 — lock→dashboard morph** transition.

Layers 1–4 are pure performance/UX and ship independently of the lock. The lock
(5–6) is its own feature that *sits on top of* the warm data.

## Open decisions

- Desktop: ship the optional PIN lock, or rely on stale-render + hover-prefetch
  only? (Lean: stale-render now, PIN lock later as a privacy opt-in.)
- Lock default: opt-in or on-by-default for new accounts? (Lean: opt-in; offer it
  in onboarding once there's real money.)
- Cache TTL / staleness display: do we ever show a "as of …" hint, or always
  silently roll? (Lean: silent roll; never show stale-ness to the user.)
