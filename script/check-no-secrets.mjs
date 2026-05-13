#!/usr/bin/env node
// Pre-commit secrets scan. Refuses to commit if any staged file
// contains a recognizable API-key pattern.
//
// Pattern list is intentionally narrow: high precision over high
// recall. False positives cost developer time and erode trust in the
// hook (people start adding --no-verify habitually). False negatives
// are caught by manual review and by the rotate-on-discovery process
// in policies/sdlc.md §3.
//
// Usage:
//   node script/check-no-secrets.mjs            (scans staged files)
//   node script/check-no-secrets.mjs --all       (scans entire repo, slower)
//   node script/check-no-secrets.mjs --fix      (no-op; this hook does not auto-fix)
//
// Install as a pre-commit hook:
//   echo "node script/check-no-secrets.mjs" > .git/hooks/pre-commit
//   chmod +x .git/hooks/pre-commit
// Or via husky if the project adopts it.

import { execSync } from "node:child_process";
import fs from "node:fs/promises";
import path from "node:path";

const ALL_MODE = process.argv.includes("--all");

// Patterns. Each entry: { name, regex, allowExceptionLine? }
// allowExceptionLine: if the matched line ends with `// secret-scan-allow`
// the match is suppressed. Use sparingly and document why in code review.
const PATTERNS = [
  { name: "Stripe live secret key", regex: /\bsk_live_[A-Za-z0-9]{20,}\b/g },
  { name: "Stripe live publishable key", regex: /\bpk_live_[A-Za-z0-9]{20,}\b/g },
  { name: "Stripe restricted key", regex: /\brk_live_[A-Za-z0-9]{20,}\b/g },
  { name: "Stripe webhook signing secret", regex: /\bwhsec_[A-Za-z0-9]{20,}\b/g },
  { name: "AWS access key", regex: /\b(AKIA|ASIA)[0-9A-Z]{16}\b/g },
  // AWS secret access key heuristic — only fires when the 40-char
  // base64 sits within 60 chars of an explicit "aws_secret" / "aws-secret"
  // identifier. Pure substring proximity to the word "aws" was too noisy
  // (npm package metadata triggered it constantly).
  { name: "AWS secret access key (in context)", regex: /aws[_-]?secret[_-]?access[_-]?key["'\s:=]+["']?([A-Za-z0-9/+=]{40})["']?/gi },
  { name: "Supabase anon JWT", regex: /\beyJ[A-Za-z0-9_-]{10,}\.eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\b/g },
  { name: "GitHub fine-grained token", regex: /\bgithub_pat_[A-Za-z0-9_]{82}\b/g },
  { name: "GitHub classic token", regex: /\bghp_[A-Za-z0-9]{36}\b/g },
  { name: "OpenAI key", regex: /\bsk-[A-Za-z0-9]{20,}\b/g },
  { name: "Anthropic key", regex: /\bsk-ant-[A-Za-z0-9-_]{20,}\b/g },
  { name: "Google API key", regex: /\bAIza[0-9A-Za-z_-]{35}\b/g },
  { name: "Slack token", regex: /\bxox[baprs]-[A-Za-z0-9-]{10,}\b/g },
  { name: "RSA private key block", regex: /-----BEGIN (RSA |EC |OPENSSH |DSA )?PRIVATE KEY-----/g },
  { name: "Generic high-entropy token (40+ hex)", regex: /\b[a-f0-9]{40,}\b/g, lowConfidence: true },
];

// Files / paths we never scan. The lockfile, generated artifacts,
// and node_modules are noise.
const SKIP_PATHS = [
  /^node_modules\//,
  /^\.git\//,
  /^dist\//,
  /^build\//,
  /^\.npm-cache\//,
  /^\.cache\//,
  /^\.next\//,
  /^\.turbo\//,
  /^\.parcel-cache\//,
  /package-lock\.json$/,
  /yarn\.lock$/,
  /pnpm-lock\.yaml$/,
  /\.env\.example$/, // template values are intentional
  /\.env\.sample$/,
  /\.env\.template$/,
  /^script\/check-no-secrets\.mjs$/, // this file mentions patterns but doesn't contain real secrets
  /^\.local\//, // local-only state, not committed
  /^server\/public\//, // built static assets
];

// File extensions worth scanning. Skip binaries.
const TEXT_EXT = new Set([
  ".js", ".mjs", ".cjs", ".ts", ".tsx", ".jsx",
  ".json", ".yml", ".yaml", ".md", ".sh", ".env",
  ".html", ".css", ".sql", ".txt", ".py", ".rb", ".go",
  ".toml", ".ini", ".conf", ".config",
]);

function shouldSkip(p) {
  return SKIP_PATHS.some((re) => re.test(p));
}

function isTextFile(p) {
  const ext = path.extname(p).toLowerCase();
  if (!ext) return true; // dotfiles are mostly text
  return TEXT_EXT.has(ext);
}

async function getStagedFiles() {
  try {
    const out = execSync("git diff --cached --name-only --diff-filter=ACM", { encoding: "utf8" });
    return out.split("\n").map((l) => l.trim()).filter(Boolean);
  } catch (e) {
    console.error("Failed to read git staged files:", e.message);
    process.exit(2);
  }
}

async function getAllFiles() {
  try {
    const out = execSync("git ls-files", { encoding: "utf8" });
    return out.split("\n").map((l) => l.trim()).filter(Boolean);
  } catch (e) {
    console.error("Failed to enumerate repo files:", e.message);
    process.exit(2);
  }
}

async function scanFile(filePath) {
  let content;
  try {
    content = await fs.readFile(filePath, "utf8");
  } catch {
    return []; // unreadable, skip
  }
  const findings = [];
  const lines = content.split("\n");
  for (const pattern of PATTERNS) {
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const matches = line.match(pattern.regex);
      if (!matches) continue;
      if (line.includes("// secret-scan-allow")) continue;
      // For low-confidence patterns, require an additional negative
      // filter against very common 40+ hex strings (git SHAs, bcrypt
      // hashes embedded in test fixtures, etc.). The string must NOT
      // appear adjacent to the words "sha", "hash", "fixture", "test",
      // or "example" within a 60-char window.
      if (pattern.lowConfidence) {
        const lower = line.toLowerCase();
        const negativeFilter = /(sha|hash|fixture|test|example|commit|tag|sample|placeholder|expected)/;
        if (negativeFilter.test(lower)) continue;
      }
      for (const match of matches) {
        findings.push({
          file: filePath,
          line: i + 1,
          pattern: pattern.name,
          excerpt: redact(match),
        });
      }
    }
  }
  return findings;
}

function redact(s) {
  if (s.length <= 12) return s.slice(0, 4) + "***";
  return s.slice(0, 6) + "***" + s.slice(-3);
}

async function main() {
  const files = (ALL_MODE ? await getAllFiles() : await getStagedFiles())
    .filter((f) => !shouldSkip(f))
    .filter((f) => isTextFile(f));

  if (files.length === 0) {
    console.log(`[secrets-scan] no ${ALL_MODE ? "tracked" : "staged"} text files to scan.`);
    process.exit(0);
  }

  const allFindings = [];
  for (const f of files) {
    const findings = await scanFile(f);
    allFindings.push(...findings);
  }

  if (allFindings.length === 0) {
    console.log(`[secrets-scan] OK — scanned ${files.length} ${ALL_MODE ? "tracked" : "staged"} files; no secrets found.`);
    process.exit(0);
  }

  console.error(`\n[secrets-scan] BLOCKED — ${allFindings.length} potential secret(s) detected:\n`);
  for (const f of allFindings) {
    console.error(`  ${f.file}:${f.line}  [${f.pattern}]  ${f.excerpt}`);
  }
  console.error(`
What to do:
  1. If real: REVOKE the credential in the issuing system FIRST. Rotation
     comes before scrubbing. Then remove from the staged change.
  2. If false positive (e.g., test fixture, public docs): add the
     suppress comment "// secret-scan-allow" at the end of the line,
     then re-stage and re-commit. Document why in the PR.
  3. Never bypass with --no-verify. The hook exists to catch the
     pattern that has cost other companies real money.

Policy: policies/sdlc.md §3 — Secrets handling
`);
  process.exit(1);
}

await main();
