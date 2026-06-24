/* eslint-disable no-console */
// Exact-equivalent codemod: replace hardcoded ink-color literals with the
// canonical `--kiddo-ink` token. --kiddo-ink is defined ONCE in :root as
// `40 23% 8%` (== #1A1710 == rgb(26,23,16)) and is NEVER redefined in .dark,
// so every form below is byte-identical in every theme. Zero visual change —
// purely a consistency / theme-robustness win, removing the biggest
// "hardcoded color" tell across the client.
//
//   rgba(26,23,16,α)  -> hsl(var(--kiddo-ink) / α)
//   rgb(26,23,16)     -> hsl(var(--kiddo-ink))
//   #1A1710 / #1a1710 -> hsl(var(--kiddo-ink))
//
// Only the INK color is touched (proven-equal to a token). Other literals
// (reds, evergreen variants, grays) are NOT converted — they aren't proven
// exact-equivalent to a single token. White literals are left alone too.
//
// Usage:
//   node script/codemod-ink-token.mjs [--dry] [root-or-file ...]
// Default root: client/src  (recurses .ts/.tsx). EXCLUDES by basename:
//   - index.css           (a11y-tuned token source; under WIP; shadows fine as-is)
//   - Dashboard.tsx       (dead classic — never renders; pure churn)
//   - DashboardStaging.tsx / FundTabsStaging.tsx  (active staging WIP)
//   - FundSnapshot.tsx    (isolated <style> docs where :root tokens may be out of scope)
import { readFileSync, writeFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";

const args = process.argv.slice(2);
const dry = args.includes("--dry");
const roots = args.filter((a) => a !== "--dry");
const startRoots = roots.length ? roots : ["client/src"];

const EXCLUDE = new Set([
  "index.css",
  "Dashboard.tsx",
  "DashboardStaging.tsx",
  "FundTabsStaging.tsx",
  "FundSnapshot.tsx",
]);

function walk(p, acc) {
  const st = statSync(p);
  if (st.isDirectory()) {
    for (const e of readdirSync(p)) {
      if (e === "node_modules" || e.startsWith(".")) continue;
      walk(path.join(p, e), acc);
    }
  } else if (/\.(tsx?|css)$/.test(p) && !EXCLUDE.has(path.basename(p))) {
    acc.push(p);
  }
  return acc;
}

const files = [];
for (const r of startRoots) {
  if (statSync(r).isDirectory()) walk(r, files);
  else if (!EXCLUDE.has(path.basename(r))) files.push(r);
}

let grandTotal = 0;
const touched = [];
for (const file of files) {
  const src = readFileSync(file, "utf8");
  let n = 0;
  let out = src
    .replace(/rgba\(\s*26\s*,\s*23\s*,\s*16\s*,\s*([0-9]*\.?[0-9]+)\s*\)/g, (_m, a) => { n++; return `hsl(var(--kiddo-ink) / ${a})`; })
    .replace(/rgb\(\s*26\s*,\s*23\s*,\s*16\s*\)/g, () => { n++; return "hsl(var(--kiddo-ink))"; })
    .replace(/#1[Aa]1710\b/g, () => { n++; return "hsl(var(--kiddo-ink))"; });
  if (n > 0) {
    grandTotal += n;
    touched.push(`  ${file}: ${n}`);
    if (!dry) writeFileSync(file, out, "utf8");
  }
}

console.log(touched.join("\n"));
console.log(`\n${touched.length} file(s), ${grandTotal} ink literal(s) -> --kiddo-ink token${dry ? "  (dry run — not written)" : "  (written)"}`);
