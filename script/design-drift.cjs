/* Design-system drift scanner (DESIGN_SYSTEM.md §9). Reports arbitrary values
 * that bypass the token scale — the "feels AI" tells. Report-only, no changes. */
const fs = require("fs");
const path = require("path");
const ROOT = path.join(process.cwd(), "client", "src");
const PATTERNS = {
  "arbitrary-type (text-[Npx])": /text-\[[0-9.]+px\]/g,
  "arbitrary-radius (rounded-[..])": /rounded-\[[^\]]+\]/g,
  "tailwind-2xl/3xl radius on card-ish": /rounded-(2xl|3xl)/g,
  "inline fontSize": /style=\{\{[^}]*fontSize/g,
  "inline boxShadow": /style=\{\{[^}]*boxShadow/g,
  "arbitrary duration": /duration-\[[^\]]+\]/g,
  "inline cubic-bezier": /cubic-bezier\(/g,
};
function walk(dir, out = []) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p, out);
    else if (/\.(tsx|ts)$/.test(e.name)) out.push(p);
  }
  return out;
}
const files = walk(ROOT);
const totals = {}; const perFile = {};
for (const f of files) {
  const src = fs.readFileSync(f, "utf8");
  let fileTotal = 0;
  for (const [name, re] of Object.entries(PATTERNS)) {
    const n = (src.match(re) || []).length;
    if (n) { totals[name] = (totals[name] || 0) + n; fileTotal += n; }
  }
  if (fileTotal) perFile[path.relative(process.cwd(), f)] = fileTotal;
}
console.log("=== DRIFT BY CATEGORY ===");
const grand = Object.values(totals).reduce((a, b) => a + b, 0);
for (const [k, v] of Object.entries(totals).sort((a, b) => b[1] - a[1])) console.log(String(v).padStart(5), k);
console.log(String(grand).padStart(5), "TOTAL across", files.length, "files");
console.log("\n=== TOP 15 FILES BY DRIFT ===");
Object.entries(perFile).sort((a, b) => b[1] - a[1]).slice(0, 15).forEach(([f, n]) => console.log(String(n).padStart(5), f));
