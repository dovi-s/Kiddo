// Page-scope detection. Every page in Kora answers one question
// implicitly — "what is the user operating on right now?" — and the
// chrome (AppHeader, DesktopSidebar, MobileNav) should reflect that
// answer. Four tiers, one classifier function.
//
// See project_chrome_scope_tiers.md for the full framework + per-tier
// chrome rules. This module is just the truth source for "given this
// pathname, which tier."
//
// Tier 1 — fund-scoped: Dashboard, Memory Book, Activity, fund
//   Settings, KidView, Projection, Age18Plan, Tax Documents,
//   FundSnapshot. Active fund context drives the page.
//
// Tier 2 — household-scoped: /funds. Across all the user's funds at
//   once. Active fund concept doesn't apply at the page level but
//   does for the drill-in dropdown.
//
// Tier 3 — user-scoped: /account. The user acting on themselves. No
//   fund context is relevant; chrome suppresses fund affordances but
//   keeps escape-hatch nav.
//
// Tier 4 — system-scoped: /admin, /profile. Different register
//   entirely; pages provide their OWN layout (no AppHeader / sidebar
//   wrap), so no chrome adjustments needed here.

export type PageScope = "fund" | "household" | "user" | "system";

// Pathname → scope. Defaults to "fund" so any new page automatically
// gets Tier-1 chrome unless it's explicitly registered as something
// else. Add new pages to the appropriate set as they ship.
//
// Match is done with exact-equals OR startsWith-+/ so that
// /account/anything and /admin/anything both classify the same as
// their root.
const HOUSEHOLD_PATHS = new Set<string>(["/funds"]);
const USER_PATHS = new Set<string>(["/account"]);
const SYSTEM_PATHS = new Set<string>(["/admin", "/profile"]);

export function getPageScope(pathname: string): PageScope {
  if (HOUSEHOLD_PATHS.has(pathname)) return "household";
  if (USER_PATHS.has(pathname)) return "user";
  for (const p of Array.from(SYSTEM_PATHS)) {
    if (pathname === p || pathname.startsWith(p + "/")) return "system";
  }
  return "fund";
}

// Sugar predicates used most often by chrome components.
export function isFundScopedPath(pathname: string): boolean {
  return getPageScope(pathname) === "fund";
}
export function isHouseholdScopedPath(pathname: string): boolean {
  return getPageScope(pathname) === "household";
}
export function isUserScopedPath(pathname: string): boolean {
  return getPageScope(pathname) === "user";
}
export function isSystemScopedPath(pathname: string): boolean {
  return getPageScope(pathname) === "system";
}

// "Suppress fund-context chrome" is true on household, user, AND
// system pages. Most chrome components only care about this aggregate
// — they're saying "is there an active fund context here or not?" —
// so this helper saves them from importing the full enum.
//
// Returns false ONLY for fund-scoped pages.
export function shouldSuppressFundChrome(pathname: string): boolean {
  return getPageScope(pathname) !== "fund";
}

// "Suppress primary nav items (Home / Memory / Activity / Settings)"
// is stricter than shouldSuppressFundChrome. Tier-1 pages keep the
// nav; non-fund-scoped pages hide it.
//
// History: the first pass kept the nav visible on /funds with the
// argument that "the dropdown is the kid-picker setup; the nav is
// the drill." Reviewer pushed back: the nav labels are GENERIC
// (Home / Memory Book / etc.) so there's no in-label signal that
// tapping them goes to a specific kid. A user on /funds tapping
// "Home" expects Home and silently lands on Emma's Dashboard.
// Same stealth-context-switch we already removed from /account.
// Resolved by promoting /funds into the same nav-hidden set as
// /account.
//
// What stays VISIBLE on /funds (only delta from /account):
//   - AppHeader fund-switcher trigger ("Your funds ⌄") — the
//     primary kid-picker, the actual reason a user is on /funds.
//     /account hides this; /funds keeps it because picking a kid
//     is contextually the whole point of /funds.
const NAV_HIDDEN_PATHS = new Set<string>(["/account", "/funds"]);
export function shouldHidePrimaryNav(pathname: string): boolean {
  return NAV_HIDDEN_PATHS.has(pathname);
}
