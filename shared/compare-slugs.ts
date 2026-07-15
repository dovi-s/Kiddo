// Single source of truth for which /compare/:slug pages exist.
//
// Consumed by:
//   • client/src/pages/Compare.tsx — renders the hub cards + each comparison page
//     (it asserts, in dev, that its content keys match this list)
//   • server/sitemap.ts — lists /compare/:slug in sitemap.xml
//
// Add a slug here when a new comparison ships. script/test-sitemap-coverage.ts
// fails if the sitemap ever omits one of these, so the two can't drift.
export const COMPARE_SLUGS = [
  "earlybird",
  "acorns-early",
  "greenlight",
  "stockpile",
  "529",
  "savings-account",
  "fidelity-utma",
] as const;

export type CompareSlug = (typeof COMPARE_SLUGS)[number];
