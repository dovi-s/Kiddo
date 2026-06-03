// Route classification helpers shared across the app shell.
//
// Single source of truth for "is this pathname a public marketing
// page?" — consumed by App.tsx (hideGlobalNav + loading-skeleton
// choice) AND DemoBanner (which must NOT render on marketing chrome).
// Keeping both consumers on one function prevents the surface-drift
// the codebase has been bitten by before (see
// project_pricing_truth_must_match_across_surfaces.md): when the
// marketing-page list lived only in App.tsx, any second consumer had
// to duplicate it and the two copies silently diverged.
//
// When you add a new public marketing page, add it HERE and every
// consumer updates together.

// Strip query + hash, drop a trailing slash (except root). Pure.
export function normalizePath(path: string): string {
  const cleaned = path.split("?")[0].split("#")[0] || "/";
  if (cleaned !== "/" && cleaned.endsWith("/")) return cleaned.slice(0, -1);
  return cleaned;
}

// Public, unauthenticated marketing surfaces. These render their own
// Nav + Footer chrome (no app sidebar / mobile nav) and never show the
// demo banner. /demo is included: it is the marketing landing page for
// the Dunphy demo (the actual demo *experience* after login is the
// app, not this page).
export function isMarketingRoute(path: string): boolean {
  const pathname = normalizePath(path);

  if (
    pathname === "/" ||
    pathname === "/demo" ||
    pathname === "/faq" ||
    pathname === "/how-it-works" ||
    pathname === "/pricing" ||
    pathname === "/founding-members" ||
    pathname === "/blog" ||
    pathname === "/stories" ||
    pathname === "/compare" ||
    pathname === "/security" ||
    pathname === "/age-18" ||
    pathname === "/about" ||
    pathname === "/personal-funds" ||
    pathname === "/contact" ||
    pathname === "/partners" ||
    // Self-contained public pages that render their own Nav/Footer. Both
    // previously hid the global nav + got the marketing skeleton only by
    // accident (isPublicGiftRoute mis-classified them as /:fund gift pages,
    // which also fired a spurious /api/public/funds/<slug> 404 prefetch).
    // Now reserved slugs, so listed here explicitly to keep their chrome
    // intentional and net-neutral. /p2p-preview is the fenced P2P concept demo.
    pathname === "/p2p-preview" ||
    pathname === "/legal" ||
    pathname === "/tools/at-18-calculator" ||
    pathname === "/tools/robux-vs-utma" ||
    pathname === "/robux-vs-utma" ||
    pathname === "/tools/trump-account-vs-utma" ||
    pathname === "/trump-account-vs-utma" ||
    pathname === "/tools/utma-by-state"
  ) {
    return true;
  }

  return (
    pathname.startsWith("/blog/") ||
    pathname.startsWith("/stories/") ||
    pathname.startsWith("/compare/") ||
    pathname.startsWith("/tools/utma-by-state/")
  );
}

// Authenticated app surfaces — the pages where a signed-in user is
// actually operating on fund data (theirs or, in the demo, the seeded
// Dunphy data). This is an ALLOWLIST on purpose: the demo banner shows
// ONLY here. Any route not listed (marketing, /login, /get-started,
// claim / transfer / invite flows, public gift checkout, password
// reset, email verify, magic-link landing, etc.) is a public /
// front-door page where the "you're in the demo, amounts reset" banner
// is contextually wrong — even when the visitor happens to be a logged-
// in demo account browsing back out to those pages.
//
// Allowlist (not blocklist) because the failure modes are asymmetric:
// a NEW public page accidentally showing the banner looks broken
// (that's the bug this replaces), whereas a NEW app page that forgets
// to opt in merely lacks the banner until someone adds it here. The
// safe default is "no banner."
//
// When you add a new authenticated app page, add its path here.
const APP_SURFACE_EXACT = new Set<string>([
  "/dashboard",
  "/activity",
  "/events",
  "/event/create",
  "/settings",
  "/account",
  "/profile",
  "/funds",
  "/admin",
  "/age-18-plan",
  "/tax-documents",
  "/memory",
  "/gifter",
  "/my-gifts",
  "/welcome-at-18",
]);
const APP_SURFACE_PREFIXES = [
  "/activity/",
  "/tax-documents/",
  "/projection/",
  "/fund/",
  "/memory/",
  "/kid/",
  "/transition/fund/",
  "/your-story/",
];

export function isDemoAppSurface(path: string): boolean {
  const pathname = normalizePath(path);
  if (APP_SURFACE_EXACT.has(pathname)) return true;
  return APP_SURFACE_PREFIXES.some((p) => pathname.startsWith(p));
}
