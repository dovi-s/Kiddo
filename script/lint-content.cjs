const { readFileSync, readdirSync, statSync } = require("fs");
const path = require("path");

const BANNED_PHRASES = [
  "seamless",
  "empower",
  "journey",
  "committed to",
  "innovative",
  "leverage",
  "robust",
  "cutting-edge",
  "best-in-class",
  "world-class",
  "game-changing",
  "holistic",
  "synergy",
  "paradigm",
  "transformative",
  "revolutionary",
  "disruptive",
  "streamline",
  "utilize",
  "facilitate",
];

const GENERIC_PHRASES = [
  "bright future",
  "financial freedom",
  "peace of mind",
  "take control",
  "start your journey",
  "easy to use",
  "user-friendly",
];

const PASSIVE_VOICE_PATTERNS = [
  /\bis being\b/i,
  /\bare being\b/i,
  /\bwas being\b/i,
  /\bwere being\b/i,
  /\bwill be\b/i,
];

const CONTENT_ROOTS = [
  "client/src/content",
  "client/src/pages",
  "client/src/components/ui/share-kit.tsx",
];

const INCLUDED_PAGE_FILES = new Set([
  path.normalize("client/src/pages/Home.tsx"),
  path.normalize("client/src/pages/About.tsx"),
  path.normalize("client/src/pages/Compare.tsx"),
  path.normalize("client/src/pages/FAQ.tsx"),
  path.normalize("client/src/pages/Age18.tsx"),
  path.normalize("client/src/pages/Contact.tsx"),
  path.normalize("client/src/pages/Security.tsx"),
  path.normalize("client/src/pages/Stories.tsx"),
  path.normalize("client/src/pages/Blog.tsx"),
  path.normalize("client/src/pages/Pricing.tsx"),
]);

function shouldScan(filePath) {
  const normalized = path.normalize(filePath);
  if (normalized.endsWith(".md")) return true;
  if (normalized.endsWith(path.normalize("client/src/components/ui/share-kit.tsx"))) return true;
  return INCLUDED_PAGE_FILES.has(normalized);
}

function walk(target, found) {
  const stat = statSync(target);
  if (stat.isDirectory()) {
    for (const entry of readdirSync(target)) {
      walk(path.join(target, entry), found);
    }
    return;
  }
  if (shouldScan(target)) found.push(target);
}

function extractSegments(filePath, content) {
  if (filePath.endsWith(".md")) {
    const withoutFrontmatter = content.replace(/^---[\s\S]*?---\s*/m, "");
    return withoutFrontmatter
      .split(/\r?\n\r?\n/)
      .map((segment) => segment.trim())
      .filter(Boolean);
  }
  const matches = content.match(/"[^"\n]{12,}"|'[^'\n]{12,}'|`[^`\n]{12,}`/g) || [];
  return matches.map((segment) => segment.slice(1, -1));
}

function lintSegment(segment) {
  const issues = [];
  const normalized = segment.toLowerCase();

  // Em-dashes are banned in all website/app copy per
  // feedback_no_emdash.md. They're a stylistic-AI tell at Kora's register
  // and historically every Kora content review has flagged them. The unicode
  // codepoint is U+2014 (—); separate from the ASCII double-hyphen (--) which
  // we don't ban because it's a common code pattern (CLI flags, etc.).
  if (segment.includes("—")) issues.push("Em-dash (—) in user-facing copy");

  for (const phrase of BANNED_PHRASES) {
    if (normalized.includes(phrase)) issues.push(`Banned phrase "${phrase}"`);
  }
  for (const phrase of GENERIC_PHRASES) {
    if (normalized.includes(phrase)) issues.push(`Generic phrase "${phrase}"`);
  }
  for (const pattern of PASSIVE_VOICE_PATTERNS) {
    if (pattern.test(segment)) {
      issues.push("Possible passive voice");
      break;
    }
  }

  const sentences = segment
    .split(/[.!?]+/)
    .map((part) => part.trim())
    .filter(Boolean);
  for (const sentence of sentences) {
    const wordCount = sentence.split(/\s+/).filter(Boolean).length;
    if (wordCount > 55) {
      issues.push(`Long sentence (${wordCount} words)`);
      break;
    }
  }

  return issues;
}

const files = [];
for (const root of CONTENT_ROOTS) {
  walk(root, files);
}

const allIssues = [];
for (const file of files) {
  const content = readFileSync(file, "utf8");
  for (const segment of extractSegments(file, content)) {
    const issues = lintSegment(segment);
    for (const issue of issues) {
      allIssues.push({
        file,
        issue,
        excerpt: segment.trim().replace(/\s+/g, " ").slice(0, 160),
      });
    }
  }
}

if (allIssues.length) {
  for (const entry of allIssues) {
    console.error(`\n[content-lint] ${entry.file}`);
    console.error(`- ${entry.issue}`);
    console.error(`- ${entry.excerpt}`);
  }
  console.error(`\n${allIssues.length} content issue(s) found.`);
  process.exit(1);
}

console.log(`content lint passed (${files.length} files scanned)`);
