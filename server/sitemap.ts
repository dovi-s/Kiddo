import { US_STATES } from "../shared/utma";
import { COMPARE_SLUGS } from "../shared/compare-slugs";
import { blogSlugs, storySlugs } from "./contentSlugs";

export type SitemapRoute = { path: string; changefreq: string; priority: string };

// Static, hand-curated public marketing/funnel pages. Everything DYNAMIC
// (per-state, per-comparison, per-blog-post, per-story) is derived below from a
// single source of truth so the sitemap can't silently drift when a page or
// content file ships.
//
// Keep this list aligned with the `index, follow` exact-match routes in
// client/src/App.tsx getSeoForPath — script/test-sitemap-coverage.ts fails if an
// indexable route is missing here. Private/user-scoped routes stay out (they're
// noindex client-side and Disallow'd in robots.txt); orphan/noindex pages
// (/partners, /demo, /generational-loop, /gift) stay out by design.
// See SEO_GTM_STRATEGY.md.
const STATIC_ROUTES: SitemapRoute[] = [
  // Core funnel
  { path: "/", changefreq: "weekly", priority: "1.0" },
  { path: "/get-started", changefreq: "weekly", priority: "0.9" },
  { path: "/how-it-works", changefreq: "monthly", priority: "0.8" },
  { path: "/give-a-gift", changefreq: "monthly", priority: "0.8" },
  { path: "/pricing", changefreq: "monthly", priority: "0.7" },
  { path: "/founding-members", changefreq: "monthly", priority: "0.7" },
  { path: "/personal-funds", changefreq: "monthly", priority: "0.6" },
  { path: "/age-18", changefreq: "monthly", priority: "0.6" },
  // Gifter-intent SEO satellites (the strategic core: comparison + tools)
  { path: "/compare", changefreq: "monthly", priority: "0.8" },
  { path: "/tools/at-18-calculator", changefreq: "monthly", priority: "0.8" },
  { path: "/tools/robux-vs-utma", changefreq: "monthly", priority: "0.8" },
  { path: "/tools/trump-account-vs-utma", changefreq: "monthly", priority: "0.8" },
  { path: "/tools/utma-by-state", changefreq: "monthly", priority: "0.7" },
  // Content hubs (children derived below)
  { path: "/blog", changefreq: "weekly", priority: "0.6" },
  { path: "/stories", changefreq: "weekly", priority: "0.6" },
  // Trust / info
  { path: "/faq", changefreq: "monthly", priority: "0.7" },
  { path: "/security", changefreq: "monthly", priority: "0.5" },
  { path: "/about", changefreq: "monthly", priority: "0.6" },
  { path: "/contact", changefreq: "monthly", priority: "0.4" },
  { path: "/legal", changefreq: "monthly", priority: "0.4" },
];

// The full, live list of sitemap routes. Exported (not just the XML) so
// script/test-sitemap-coverage.ts can assert coverage without HTTP.
export function buildSitemapRoutes(): SitemapRoute[] {
  const routes: SitemapRoute[] = [...STATIC_ROUTES];
  // Programmatic: one UTMA page per state (canonical URL is lowercase, matching
  // UtmaByStateIndex links). Self-maintaining from shared US_STATES.
  for (const s of US_STATES) {
    routes.push({ path: `/tools/utma-by-state/${s.code.toLowerCase()}`, changefreq: "monthly", priority: "0.6" });
  }
  // Comparison pages — from the shared SSOT (shared/compare-slugs.ts), which
  // client/src/pages/Compare.tsx also renders from.
  for (const slug of COMPARE_SLUGS) {
    routes.push({ path: `/compare/${slug}`, changefreq: "monthly", priority: "0.7" });
  }
  // Blog + story articles — enumerated from the actual .md files on disk, so a
  // new post appears in the sitemap the moment it ships (no manual list).
  for (const slug of blogSlugs()) {
    routes.push({ path: `/blog/${slug}`, changefreq: "monthly", priority: "0.6" });
  }
  for (const slug of storySlugs()) {
    routes.push({ path: `/stories/${slug}`, changefreq: "monthly", priority: "0.5" });
  }
  return routes;
}

export function renderSitemapXml(base: string, nowIso: string): string {
  const urlset = buildSitemapRoutes()
    .map(
      (r) =>
        `<url><loc>${base}${r.path}</loc><lastmod>${nowIso}</lastmod><changefreq>${r.changefreq}</changefreq><priority>${r.priority}</priority></url>`,
    )
    .join("");
  return `<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${urlset}</urlset>`;
}
