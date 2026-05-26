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
    pathname === "/legal" ||
    pathname === "/tools/at-18-calculator" ||
    pathname === "/tools/robux-vs-utma" ||
    pathname === "/robux-vs-utma" ||
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
