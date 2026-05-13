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

// Skip saving for ANY nav-hidden path (currently /account + /funds).
// Both pages have Back affordances that READ from this store; if
// either page also WROTE to it, navigating Emma's Dashboard →
// /funds → /account would point /account's Back at /funds (the
// previous step) instead of Emma's Dashboard (the actual source).
// Filtering at the save site keeps the journey-source intact.
function shouldSkipSave(path: string): boolean {
  return shouldHidePrimaryNav(path);
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
//   - pageTitle "Home" (Dashboard) → "Back to {kid}'s home" — matches
//     the chrome's home/kid vocabulary; "Home" generic is the page
//     title but the destination IS a specific kid's surface.
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
    return childFirstName ? `Back to ${childFirstName}'s home` : "Back to home";
  }
  if (snap.label === "Home") {
    return childFirstName ? `Back to ${childFirstName}'s home` : "Back to home";
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
