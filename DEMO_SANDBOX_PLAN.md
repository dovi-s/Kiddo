# Demo Interactivity — Staged Plan

*How to make the demo behave like the real product (add recurring, one-time, buy,
sell, gift — all reflecting live), without shared-state risk. Written 2026-06-03.*

## The two layers (they compose, not compete)

1. **Convert-the-intent (SHIPPED — `DemoActionMoment`).** When a demo visitor
   completes a money-flow action, fire a warm "Start your own fund →" toast. It
   catches the highest-intent moment in the funnel instead of dead-ending. You
   want this *even inside* a full sandbox, so it ships first regardless.
   - Done: wired to **recurring** (`Dashboard` auto-invest save dispatches
     `kiddo:demo-action`). Extend to one-time/sell/buy/gift by dispatching the
     same event with `{ action, amount?, childName? }` + a `COPY` entry.

2. **Full client-side sandbox (THIS DOC — the bigger build).** Make actions
   genuinely *reflect* in the UI, isolated per visitor, persisting for the
   session, resetting on re-entry. The richer "it's real" experience.

## Why client-side (not server forking)

- The demo is a **shared account** (`phil@dunphyfamily.com`). Persisting changes
  server-side would corrupt the demo for every visitor → needs per-session
  isolation, which server-side means forking demo data per session + cleanup
  workers: heavy.
- A **client-side overlay** is isolated *for free* (your browser, your state),
  persists via localStorage, and resets on demo re-entry (which already clears
  caches). Precedent exists: `demo-live-gifts.ts` already overlays client-side
  "live gifts" onto the demo funds.

## Architecture

A **demo-overlay store** (a small client store, localStorage-backed, keyed per
browser session) holding the visitor's *deltas* on top of the server-read seed:

```
serverSeed (read-only)  +  demoOverlay (session deltas)  =  what the UI renders
```

- **Reads:** wrap the demo fund/holdings/recurring/gift reads so they merge in the
  overlay deltas (same shape as `applyDemoLiveGiftsToFunds`, generalized).
- **Writes (money-flow actions):** when `isDemoAccount`, the action writes a delta
  to the overlay instead of (or alongside) the sandbox mock — and the merged read
  reflects it instantly. Still NO real Stripe/DriveWealth (the existing
  `demoSandbox` already no-ops those).
- **Reset:** clear the overlay on demo login / "Exit demo" re-entry. Optionally a
  visible "Reset demo" control.

## Staged build (each stage is independently shippable + eyeballed)

1. **Overlay store + recurring.** Build the store + merge-on-read for recurring,
   wire the recurring save to write a delta. Result: set up recurring → it
   appears in the list and persists for the session. *(Highest value: it's the
   exact action the founder tried that did nothing.)*
2. **One-time / add cash.** Write a one-time contribution delta → balance +
   "your one-time additions" reflect it.
3. **Gift in.** A simulated inbound gift writes a delta → appears in gifts +
   Memory Book + "who gave."
4. **Buy / sell holdings.** Delta on holdings → "What Luke owns" updates. (Most
   complex — touches share counts + the reconciled totals; do last.)
5. **Reset affordance + polish.** Visible reset, edge-cases (reload mid-flow),
   make sure the convert-the-intent toast still fires on top.

## Principles (keep it honest + safe)

- **Demo accounts only.** No-op for real users (gate on `isDemoAccount`).
- **No real rails.** `demoSandbox` already blocks Stripe/DriveWealth; keep it.
- **Per-browser, session-scoped, resettable.** Never shared, never permanent.
- **Don't drift the reconciled numbers silently** — every delta must update the
  same totals the dashboard reconciles (balance, gifts, growth), or the carefully
  honest math breaks.
- **Build staged + eyeballed.** This is a stateful, multi-surface system; do NOT
  one-shot it blind. One action at a time, founder reviews each.

## Is it worth it?

The demo already *demonstrates* the product (rich populated fund). A playable
sandbox is a conversion **amplifier**, not the engine — the engine is whether the
loop converts (funded-k). So: ship convert-the-intent now (done), and build this
when the demo is proven a core conversion surface worth the multi-stage
investment. Start at Stage 1 (recurring) when you commit.
