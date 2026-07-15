# Dashboard Chrome Cleanup — Port-Time Spec

**Status:** ready to execute when the `/staging` dashboard is ported to live `/dashboard`.

> **DONE 2026-06-22 (shipped early at founder request — pure improvements that help live
> too, so done now rather than deferred). Verified via desktop render.**
> - ✅ `DesktopSidebar` **balance echo removed** (the #1 offense — fund header is now
>   identity-only; funds-overview count + on-open switcher-dropdown balances kept).
> - ✅ `DesktopSidebar` **Quick Links** rebuilt: Share dropped, "View gifter page" → "Gifter
>   page", kid-view lowercased, dual "New occasion" + active-occasion collapsed to ONE
>   dynamic occasion. Matches the staging in-content row.
> - ✅ **Quick-links de-dup**: the staging **in-content row is now `md:hidden`** → sidebar
>   owns desktop, in-content owns mobile. One quick-links home per breakpoint.
> - ✅ `AppHeader` **header Share page-scoped** — hidden on `/dashboard` + `/staging` (hero
>   owns it), kept on Memory Book / Activity / Settings (no hero there). `isOnDashboard`.
> - ✅ `AppHeader` **"UTMA · Active" badge** suppressed on the dashboard too (hero owns
>   status; staging hero drops account-type for active funds). Kept on other fund pages.
> - n/a 🌱 emoji — **not present in `AppHeader`** (already handled elsewhere or removed).
>
> **Net score: balance ×1, Share ×1, UTMA badge gone, quick-links 1-per-breakpoint.**
> **Only minor leftover:** the fund NAME shows in two switchers on desktop (sidebar + header)
> — both are *functional* switchers, not redundant labels, so low-priority. If desired, hide
> the header switcher on desktop (sidebar covers it) — but the header switcher is the only
> one on mobile, so gate by breakpoint, don't delete.
**Why now-as-a-spec, not now-as-code:** the offenders live in the **shared** app shell
(`AppHeader.tsx`, `DesktopSidebar.tsx`) that wraps *every* dashboard page, so editing
them is a live change, not a staging-isolated one. Do it in the same pass as the
staging→live port so the two never disagree.

## The problem (harshest read, desktop)

The shared chrome **repeats what the hero already says** — this is the single biggest
reason the dashboard "feels machine-made," now that the page content itself is clean.
On one desktop screen today:

- **"Share Theo's link" ×3** — `DesktopSidebar` Quick Links + `AppHeader` button + the
  hero's gold CTA.
- **Fund name ×3** — sidebar fund header + `AppHeader` label + the hero identity line.
- **Balance `$23,577.27` ×2** — **`DesktopSidebar` echoes the hero's headline number.**
  This is the worst single offense: navigation should never repeat the hero's one big
  number; it guts the hero's impact. (Note: `AppHeader`'s balance was already pulled —
  see its own comment ~line 89 — so the dup is specifically the sidebar.)
- **Quick links ×2** — sidebar Quick Links (`share / gifter page / kid view / occasion`)
  duplicate the staging in-content preview row (`gifter page / kid view / occasion`).

## Principle: one home per thing

| Thing | Single home | Remove from |
|---|---|---|
| Balance (the big number) | **Hero** | `DesktopSidebar` (kill the echo) |
| Primary "Share … link" CTA | **Hero** (gold button) | `DesktopSidebar` Quick Links, `AppHeader` |
| Fund identity (name) | Hero line + the fund **switcher** | a 3rd static label |
| Quick links (preview shortcuts) | **One per breakpoint** (see below) | the duplicate |
| Account / fund-switch / global nav | `AppHeader` + sidebar nav | — |

Target end-state: **balance ×1, Share ×1, fund name ≤2 (switcher + hero), quick links ×1.**

## Per-file changes

### `client/src/components/layout/DesktopSidebar.tsx`
1. **Remove the balance from the sidebar fund header.** (Balance computed ~line 224–229;
   it's the same settlement-synced number as the hero by design — that's exactly why it
   must not show twice.) The sidebar shows fund **identity** (name + optional avatar),
   never the balance.
2. **Drop the Share quick-link** (Quick Links cluster ~line 350–369). The hero owns Share.
   (Bonus: removes the stealth-context foot-gun the comment there already worries about.)
3. **Collapse the dual "New occasion" + active-occasion items into ONE dynamic occasion
   link** — match the staging in-content row's behavior (most-relevant active occasion,
   falling back to the creator).
4. **Match wording** to staging: "View gifter page" → "Gifter page".

Result: sidebar = nav (Home/child, Memory Book, Activity, Settings) + fund name + a lean
quick-links set (gifter page, kid view, occasion). No balance, no Share.

### `client/src/components/layout/AppHeader.tsx`
1. **Cut the "UTMA · Active" badge** — account type/status is chrome dup; the page owns it
   (and staging already dropped it from the hero for active funds).
2. **Drop the header "Share … link" button** (`handleShare` / `headerShareOpen`, Share2
   icon). The hero is the primary Share surface. *Keep* the fund **switcher** dropdown — it
   is mobile-critical — but it should read as a switcher, not a redundant static fund label.
3. **Swap the 🌱 funds-dropdown emoji for a lucide icon** (consistency with the app's icon
   system; no stray emoji in chrome).

### Quick-links de-dup (one decision to make)
On desktop both the sidebar Quick Links **and** the staging in-content preview row render →
duplication. Pick ONE canonical home:
- **Recommended:** the **in-content preview row** is the designed, breakpoint-agnostic one
  (tuned in staging). Make the **sidebar Quick Links desktop-only is the wrong fix** — instead
  drop the sidebar Quick Links entirely and let the in-content row serve both breakpoints,
  **or** gate so exactly one shows per breakpoint (sidebar on desktop / in-content on mobile).
  Decide based on which feels better once the sidebar balance + Share are gone.

### Stray "Theo's fund" line (between header and hero)
Investigate the extra "Theo's fund" that appears before the hero in the DOM order. If it's
an **sr-only `<h1>`** (accessibility landmark) → **keep it** (invisible, good for AT). If it's
a **visible** duplicate label → remove it.

## Verification
- Render desktop (`script/staging-shot.mjs` after port, or the live shot) and confirm on one
  screen: **balance appears once, Share appears once, fund name ≤ twice, quick links once.**
- Mobile: confirm the in-content quick-links still show (no sidebar there) and nothing
  regressed.
- Re-run `npx tsc --noEmit`.

## Founder-owned within this
The *what* (kill the dups) is mechanical. The *taste* calls — whether the header keeps any
fund label at all, and which quick-links home wins — are the founder's; surface a rendered
before/after rather than picking silently.
