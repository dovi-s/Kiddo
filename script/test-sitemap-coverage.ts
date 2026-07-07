// Sitemap coverage test.
//
// Fails if any page the client marks `index, follow` (the authoritative
// indexability source: getSeoForPath in client/src/App.tsx) is MISSING from
// sitemap.xml — the "we built a page but never told search engines" bug.
//
// It checks both directions of drift:
//   1. every exact-match `index, follow` route in getSeoForPath is in the sitemap
//   2. every dynamic set (states / comparisons / blog / stories) is fully covered,
//      derived independently from its own source of truth
//
// Run: npm run test:sitemap-coverage
import { readFileSync } from "fs";
import { join } from "path";
import { buildSitemapRoutes } from "../server/sitemap";
import { blogSlugs, storySlugs } from "../server/contentSlugs";
import { COMPARE_SLUGS } from "../shared/compare-slugs";
import { US_STATES } from "../shared/utma";

const failures: string[] = [];
const fail = (msg: string) => failures.push(msg);

const sitemapPaths = new Set(buildSitemapRoutes().map((r) => r.path));

// ── 1. Static index,follow routes from getSeoForPath ────────────────────────
// Parse the real client source so this test tracks the indexability SSOT rather
// than a duplicated list. Each `if (cond) { return { ... robots: "..." } }`
// block is one segment; collect the exact `pathname === "..."` literals of any
// block whose robots is "index, follow".
const appSrc = readFileSync(join(process.cwd(), "client", "src", "App.tsx"), "utf8");
const seoStart = appSrc.indexOf("function getSeoForPath");
if (seoStart === -1) {
  fail("could not locate getSeoForPath in client/src/App.tsx (did it move/rename?)");
}
const seoBody = seoStart === -1 ? "" : appSrc.slice(seoStart, appSrc.indexOf("\nfunction ", seoStart + 20));

// Routes that are index,follow but intentionally NOT in the sitemap because they
// are duplicate-content aliases canonicalized onto a /tools/ URL (see
// CANONICAL_OVERRIDES in App.tsx). Excluded from the coverage expectation.
const CANONICAL_ALIASES = new Set(["/robux-vs-utma", "/trump-account-vs-utma"]);

const indexableStatic = new Set<string>();
for (const seg of seoBody.split(/\bif \(/)) {
  if (!/robots:\s*"index, follow"/.test(seg)) continue;
  for (const m of seg.matchAll(/pathname === "([^"]+)"/g)) {
    if (!CANONICAL_ALIASES.has(m[1])) indexableStatic.add(m[1]);
  }
}

if (indexableStatic.size === 0) {
  fail("parsed zero index,follow exact-match routes from getSeoForPath — the parser likely broke");
}
for (const p of indexableStatic) {
  if (!sitemapPaths.has(p)) fail(`indexable route ${p} (index,follow in getSeoForPath) is MISSING from sitemap.xml`);
}

// ── 2. Dynamic sets, each from its own source of truth ──────────────────────
const checkSet = (label: string, slugs: string[], toPath: (s: string) => string) => {
  if (slugs.length === 0) {
    fail(`${label}: source of truth resolved to zero entries (fs read failed or empty?)`);
    return;
  }
  for (const s of slugs) {
    const p = toPath(s);
    if (!sitemapPaths.has(p)) fail(`${label}: ${p} is MISSING from sitemap.xml`);
  }
};

checkSet("states", US_STATES.map((s) => s.code.toLowerCase()), (c) => `/tools/utma-by-state/${c}`);
checkSet("comparisons", [...COMPARE_SLUGS], (s) => `/compare/${s}`);
checkSet("blog", blogSlugs(), (s) => `/blog/${s}`);
checkSet("stories", storySlugs(), (s) => `/stories/${s}`);

// ── Report ──────────────────────────────────────────────────────────────────
if (failures.length > 0) {
  console.error(`\n✗ sitemap coverage: ${failures.length} problem(s)\n`);
  for (const f of failures) console.error(`  • ${f}`);
  console.error("");
  process.exit(1);
}

console.log(
  `✓ sitemap coverage OK — ${sitemapPaths.size} URLs; ` +
    `${indexableStatic.size} static index,follow routes covered, ` +
    `${US_STATES.length} states, ${COMPARE_SLUGS.length} comparisons, ` +
    `${blogSlugs().length} blog, ${storySlugs().length} stories.`,
);
