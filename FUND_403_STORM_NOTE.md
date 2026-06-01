# Fund 403-storm: root cause + the real follow-up

*Diagnosed + partially fixed 2026-06-01. A fund 403'd on EVERY per-fund endpoint
(dashboard-summary, holdings, gifts, memory, thank-yous, gift-code, ...) — a full
lockout that broke the dashboard.*

## Root cause

`GET /api/funds` (`server/routes/funds.ts`) ran a **canonical-email merge**: it
looked up every `users` row with the same lowercased email and unioned their
funds into the returned list (`funds = deduped`). The intent was to help
duplicate accounts (same email, multiple `users.id` rows) see "all their funds."

But the **per-fund access middleware** (`server/routes.ts` `requireOwnedFundParam`,
~line 2536) grants access by the **logged-in `userId` only** — owner
(`fund.userId === userId`), accepted collaborator, or `previousOwnerId === userId`.

So a fund owned by a **same-email *sibling* row** appeared in the funds list yet
**403'd on every per-fund endpoint.** And the client couldn't self-heal: the
stale-id defenses (the `main.tsx` 403 wrapper that purges the active-fund id +
the Dashboard self-heal that drops ids absent from the list) only fire when a
fund is *missing* from the list — here it was *present* (and `funds[0]`), so the
client kept re-selecting it and re-firing the storm.

This only triggers for users with **duplicate `users` rows sharing an email**
(single-row users hit a harmless no-op). Such dupes most plausibly come from
OAuth creating a new row alongside an existing email, or repeated demo/signup
testing.

## The fix shipped (consistency, security-safe)

`funds` is now filtered to the **current logged-in row's own funds**
(`f.userId === userId`) after the canonical merge. The list is now consistent
with the access middleware: it never surfaces a fund the middleware would 403.
Cross-row funds were **inaccessible regardless** (every endpoint 403'd), so
hiding the broken rows is strictly better UX and removes nothing usable.

Rejected the opposite fix (make the middleware grant access to any same-email
row): that's a cross-`userId` authorization grant keyed on email — a real
security vector (unverified / shared / spoofed emails) and the wrong layer.

## The REAL follow-up (founder-gated; not done here)

The duplicate `users` rows are the actual problem. While they exist, a user
logged into a fund-less dupe row sees an empty list instead of a 403 storm —
better, but still wrong.

1. **Dedupe / reassign.** Identify duplicate-email `users` rows; pick a canonical
   id; reassign owned funds (and collaborator / subscription / membership rows)
   to it; retire the dupes. This is **live-DB surgery → a founder action**, run
   attended with a backup, not unattended.
2. **Prevent new dupes.** Ensure OAuth (`getOrCreateOAuthUser`) and any other
   account-creation path link to the existing email row instead of minting a new
   one. (A unique index on `LOWER(email)` would enforce it — but only after the
   existing dupes are merged, or the migration fails.)

## Optional client hardening (defense-in-depth, not shipped)

A 403 on the *active* fund could drop that id from active-fund selection
(including the `funds[0]` fallback), so any future list/middleware mismatch
self-recovers instead of storming. Skipped for now: the server fix above makes
the list honest, so the existing self-heal + 403 wrapper suffice. Add this if a
similar storm ever recurs from a different inconsistency (e.g., a transferred-
fund edge).
