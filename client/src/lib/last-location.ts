// Tracks the user's last non-/account in-app location. On /account
// the Back-to-home affordances (sidebar button + AppHeader arrow)
// read from this so the user lands back where they actually came
// from (Memory Book → Account → Back returns to Memory Book; not
// to a fixed Dashboard default).
//
// Why sessionStorage, not in-memory: the user might refresh /account
// while on it. We want Back to still know where they came from in
// that case. Cross-tab is fine — separate tabs get separate journey
// histories naturally because each tab has its own session storage.
//
// Why not browser history.back(): two reasons:
//   1. The destination label needs to be derived ("Back to Memory
//      Book" vs "Back to Home") — we can't synthesize that from
//      history alone.
//   2. If the user landed on /account via deep link (email, copy-
//      pasted URL), browser back goes OUTSIDE the app. Our fallback
//      stays inside the app on the active fund's home.

import { shouldHidePrimaryNav } from "./page-scope";

const STORAGE_KEY = "kora:last-app-location";

export type LastLocation = {
  path: string;            // e.g. "/memory/abc-123"
  search: string;          // including leading "?", or ""
  label: string;           // page title from PAGE_TITLES, e.g. "Memory Book"
};

// Skip saving for ANY nav-hidden path (currently /account + /funds)
// AND for /settings.
//
// /account and /funds: both pages have Back affordances that READ
// from this store; if either page also WROTE to it, navigating
// Emma's Dashboard → /funds → /account would point /account's Back
// at /funds (the previous step) instead of Emma's Dashboard (the
// actual source). Filtering at the save site keeps the journey-
// source intact.
//
// /settings: added 2026-05-14 per the WHO/HOW IA Phase 1c. Now that
// Settings no longer hosts membership management (that moved to
// Account), Settings is a per-fund side surface for child info,
// gifts, notifications, and money. A parent visiting Settings is
// doing a sidequest, not anchoring their journey there — so a Back
// arrow on Account that reads "Back to Settings" feels wrong (and
// reads to the user as a residual from the pre-IA-inversion world
// where Settings was the membership home). Filtering /settings from
// the journey anchor means: Dashboard → Settings → Account → Back
// returns to Dashboard, not to Settings. Same shape as Dashboard
// → /funds → /account → Back returning to Dashboard.
function shouldSkipSave(path: string): boolean {
  if (shouldHidePrimaryNav(path)) return true;
  if (path === "/settings" || path.startsWith("/settings/")) return true;
  return false;
}

// Save the snapshot. Caller passes the current path + a friendly
// label (the same pageTitle the AppHeader renders).
export function rememberAppLocation(snap: LastLocation): void {
  if (!snap.path || shouldSkipSave(snap.path)) return;
  try {
    window.sessionStorage.setItem(STORAGE_KEY, JSON.stringify(snap));
  } catch {
    // ignore — sessionStorage quota / disabled. Fallback path
    // (active fund's Dashboard) still works.
  }
}

// Read the most recent non-nav-hidden snapshot. Returns null when
// nothing's been recorded yet (cold deep-link to /account or /funds).
export function readLastAppLocation(): LastLocation | null {
  try {
    const raw = window.sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (typeof parsed?.path !== "string" || !parsed.path) return null;
    // Defensive: if a nav-hidden path somehow got saved (a previous
    // version of this module, a stale tab), filter it on read too.
    if (shouldSkipSave(parsed.path)) return null;
    return {
      path: parsed.path,
      search: typeof parsed.search === "string" ? parsed.search : "",
      label: typeof parsed.label === "string" ? parsed.label : "",
    };
  } catch {
    return null;
  }
}

// Compose the "Back to X" label for a given snapshot.
//
// Special cases (locked):
//   - pageTitle "Home" (Dashboard) → "Back to {kid}'s fund" — matches
//     the canonical product entity name used in the hero ("Lauren's
//     fund is live"), the share affordance ("Share Lauren's gift
//     link"), and every other content surface. The page-title chrome
//     still says "Home" (it's the section label), but the Back
//     destination IS a specific kid's fund and the warmer/clearer
//     word is "fund." Updated 2026-05-15 from prior "home" wording
//     per user feedback: "home" risked being misread as "house" and
//     the rest of the app already uses "fund" consistently.
//   - path "/funds" → "Back to your funds" — the page title is
//     "Funds" but the dropdown trigger and the page hero both
//     read "Your funds." Match the contextual label the user
//     sees, not the section name.
//
// Every other page uses the page title verbatim ("Back to Memory
// Book", "Back to Activity"). Adding the kid name to those was
// considered but reads heavier than necessary — the user knows
// whose surface they were on; the chrome doesn't have to repeat it.
export function formatBackLabel(
  snap: LastLocation | null,
  childFirstName: string | null | undefined,
): string {
  if (!snap || !snap.label) {
    return childFirstName ? `Back to ${childFirstName}'s fund` : "Back to your fund";
  }
  if (snap.label === "Home") {
    return childFirstName ? `Back to ${childFirstName}'s fund` : "Back to your fund";
  }
  if (snap.path === "/funds") {
    return "Back to your funds";
  }
  return `Back to ${snap.label}`;
}

// Build the href for the Back target. Search params are preserved
// so "Back to Memory Book" on a fund with ?highlight=xyz lands on
// the same row the user was looking at.
export function backTargetHref(
  snap: LastLocation | null,
  fallbackFundId: string | null | undefined,
): string {
  if (snap) return `${snap.path}${snap.search}`;
  return fallbackFundId ? `/dashboard?fund=${fallbackFundId}` : "/dashboard";
}
