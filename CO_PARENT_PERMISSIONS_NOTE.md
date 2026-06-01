# Co-Parent (co-admin) Permissions — Findings + Decision Needed

*2026-05-31 audit of the co-admin (co-parent collaborator) role, surfaced while
sweeping post-handoff/role surfaces. Companion to the owner-mode sweep
(`project_owner_mode_handoff_sweep` memory) and `FUND_STATES_SPEC.md`. This is a
security-adjacent product decision, deliberately flagged not silently shipped.*

## TL;DR

The **server is safe and the permission model is sensible.** The gap is
**client-side only**: Settings has zero co-admin awareness, so a co-parent
(e.g. Claire on Luke's/Alex's fund) sees the FULL owner Settings UI and hits
"View-only access. Ask the fund owner." 403s on the owner-only controls
(investing strategy, gift routing, money movement, fund structure). Same
dead-control class as the `previous_owner` Settings bug I just fixed, but with a
twist: a co-parent SHOULD manage some things, so the fix needs the intended
model before I gate anything.

## How co-admin access actually works (server)

1. `requireOwnedFundParam` (routes.ts ~2536) tags the request:
   owner / co-admin / viewer / previous_owner.
2. **Global write gate** (routes.ts ~2668): every non-GET under
   `/api/funds/:fundId` runs `requireFundMutator`, which passes **owner OR
   co-admin** and returns a clean "View-only access" 403 otherwise. So a
   co-parent has **broad day-to-day write by default** — memory entries,
   contributions, occasions/events, recurring, etc. (anything without an extra
   carve-out).
3. **Owner-only carve-outs** (route adds `fundAccessRole !== 'owner'` or
   `fund.userId !== userId` on top of the global gate) — these are DELIBERATELY
   owner-exclusive:
   - investing strategy — `PATCH /api/funds/:fundId/strategy` (~9655)
   - gift routing / what-people-can-do — `PATCH .../investment-preferences` (~9608)
   - money out — `POST /api/withdrawals` (~8648, `fund.userId` check)
   - + the other ~15 `fundAccessRole !== 'owner'` endpoints (bank, close/reopen,
     collaborator invite/remove, SSN, etc.)

This is a reasonable model: **co-parent runs the day-to-day; owner keeps
strategy, money, and structure.** The 403s are correct and safe — no security
hole, just an ugly UX when the client invites an action the server refuses.

## The client gap

`client/src/pages/Settings.tsx` has **no co-admin/viewer branch** — every role
check is `accessRole === "owner"` (for owner-mode/transferredAt). So:
- `isReadOnlyFund` (Dashboard) is false for co-admin -> full write UI.
- Settings renders all tabs + controls to a co-admin, including the owner-only
  ones, which then 403.

Demo symptom: log in as `claire@dunphyfamily.com`, open Luke's Settings ->
Money tab shows the strategy picker, bank, and "Taking money out"; Gifts tab
shows the gift-routing toggles -> all 403 on use.

## Decision needed (founder)

Confirm the co-parent **Settings** model so I can gate the client to match the
server. Recommended (matches the server's existing carve-outs):

| Surface | Co-parent | Rationale |
|---|---|---|
| Dashboard day-to-day (add gift, recurring, memory, occasions) | **Write** | Already works server-side; the point of co-parenting |
| Child profile / gift-page link (view) | **View / light edit** | Confirm whether profile edits are co-parent-OK |
| Notifications (gifter-notif settings) | **TBD** | Confirm owner-only or shared |
| Investing strategy | **Read only** | Owner sets the investing approach (server: owner-only) |
| Gift routing / what-people-can-do | **Read only** | Owner-only today |
| Money: bank + withdrawals | **Hidden / read only** | Owner-exclusive; money leaves to the owner's bank |
| Fund structure: close, invite/remove co-parents | **Hidden** | Owner-exclusive |

## Implementation plan (mechanical once confirmed)

Mirror the `previous_owner` Settings fix (commit 4054551), but PARTIAL:
1. `const primaryFundIsCoAdmin = (primaryFund as any)?.accessRole === 'co-admin'`.
2. Gate the owner-only surfaces for co-admin (the whole Money tab is owner-only
   for a co-parent -> hide or read-only with a "the fund owner manages investing
   and money" note; gate the gift-routing section + close/invite).
3. Keep the day-to-day + view surfaces. Add a calm co-parent banner ("You're a
   co-parent on {kid}'s fund. The owner manages investing, money, and fund
   settings; you can add gifts, notes, and occasions.").
4. Optional server tidy: the strategy/prefs endpoints could return the same
   structured "View-only access" 403 shape as `requireFundMutator` for
   consistency, but no auth change.

I can ship steps 1-3 immediately on your confirmation of the table above. Until
then nothing is gated, because guessing a permission model is the one place
shipping-before-confirming is genuinely risky.
