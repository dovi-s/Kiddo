// Single source of truth for top-level URL segments that are NOT fund
// gift-slugs — app routes, marketing pages, auth flows, satellite tools, etc.
//
// Funds are served at the URL root (`kiddofund.com/<slug>` and
// `/<slug>/<event>`), so the fund-slug namespace shares the top level with
// every app/marketing route. Two consumers MUST agree on this list:
//   1. client App.tsx isPublicGiftRoute — don't treat these as /:fund gift
//      pages (avoids a stale public-gift prefetch + wrong-page render).
//   2. server generateUniqueFundSlug — never MINT a fund slug equal to one of
//      these, or that fund's gift link would route to the reserved page and
//      be permanently unreachable (e.g. a fund named "Pricing" → /pricing).
// Historically these drifted (the client list was hand-maintained, the server
// didn't check at all). Keeping ONE list here prevents that.
export const RESERVED_FUND_SLUGS: ReadonlySet<string> = new Set([
  // App (authenticated) + core flows
  "login", "get-started", "onboard", "activate", "dashboard", "dashboard-classic", "account",
  "settings", "activity", "events", "event", "send", "claim", "admin",
  "memory", "gift", "kid", "transition", "gifter", "my-gifts",
  "personal-funds", "projection", "tax-documents", "funds", "invitations",
  "take-over", "fund-snapshot", "fund", "welcome-at-18", "give-a-gift",
  "your-story", "profile",
  // Auth / email flows
  "auth", "reset-password", "verify-email", "confirm-email-change",
  "cancel-email-change", "founding-members", "founder-claim", "feedback",
  "sponsor-success",
  // Marketing / content / SEO
  "faq", "how-it-works", "about", "legal", "pricing", "compare", "blog",
  "stories", "security", "updates", "contact", "age-18", "age-18-plan",
  "demo", "tools", "robux-vs-utma", "trump-account-vs-utma", "partners",
  "p2p-preview", "design-lab", "generational-loop",
  // Common infra/well-known segments a fund slug must never shadow
  "api", "assets", "static", "uploads", "public", "app", "www", "robots.txt",
  "sitemap.xml", "favicon.ico", "manifest.json", "health",
]);

export function isReservedFundSlug(segment: string | null | undefined): boolean {
  return RESERVED_FUND_SLUGS.has(String(segment || "").trim().toLowerCase());
}
