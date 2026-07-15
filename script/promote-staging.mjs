/* eslint-disable no-console */
// Promote the /staging dashboard sandbox to the live /dashboard.
//
// Workflow: try uncertain dashboard changes in DashboardStaging.tsx (/staging),
// then run `node script/promote-staging.mjs` to copy that blessed state onto the
// live DashboardLab.tsx (/dashboard). Live is PROMOTION-ONLY — never hand-edit
// DashboardLab directly, or the two files drift and this clean copy breaks.
//
// What it does: backs up the current live file (timestamped, into artifacts/),
// copies staging -> live, and renames the one export so live stays `DashboardLab`.
// Run `node script/promote-staging.mjs --diff` first to preview what will change.
import { readFileSync, writeFileSync, mkdirSync, copyFileSync } from "node:fs";
import { execSync } from "node:child_process";
import path from "node:path";

const ROOT = process.cwd();
const LIVE = path.join(ROOT, "client/src/pages/DashboardLab.tsx");
const STAGE = path.join(ROOT, "client/src/pages/DashboardStaging.tsx");
const BACKUPS = path.join(ROOT, "artifacts");

const diffOnly = process.argv.includes("--diff");

if (diffOnly) {
  console.log("Pending promotion (staging vs live). Function-name line is expected to differ:\n");
  try {
    execSync(`git diff --no-index --stat "${LIVE}" "${STAGE}"`, { stdio: "inherit" });
  } catch {
    // git diff --no-index exits non-zero when files differ; that's expected.
  }
  console.log("\nRun without --diff to promote.");
  process.exit(0);
}

const stageSrc = readFileSync(STAGE, "utf8");
if (!/export default function DashboardStaging\(\)/.test(stageSrc)) {
  console.error("! Could not find `export default function DashboardStaging()` in staging.");
  console.error("  The export name changed — update this script before promoting.");
  process.exit(1);
}

mkdirSync(BACKUPS, { recursive: true });
const stamp = new Date().toISOString().replace(/[:.]/g, "-");
const backup = path.join(BACKUPS, `DashboardLab.before-promote-${stamp}.tsx`);
copyFileSync(LIVE, backup);

const promoted = stageSrc.replace(
  "export default function DashboardStaging()",
  "export default function DashboardLab()",
);
writeFileSync(LIVE, promoted);

console.log("Promoted /staging -> live /dashboard.");
console.log(`  backup of previous live: ${path.relative(ROOT, backup)}`);
console.log("  next: `npx tsc --noEmit` to typecheck, then verify /dashboard renders.");
console.log("  revert this promotion:  cp the backup above back over DashboardLab.tsx");
