import { readFileSync, readdirSync, statSync } from "fs";
import path from "path";

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
] as const;

const GENERIC_PHRASES = [
  "bright future",
  "financial freedom",
  "peace of mind",
  "take control",
  "start your journey",
  "easy to use",
  "user-friendly",
] as const;

const PASSIVE_VOICE_PATTERNS = [
  /\bis being\b/i,
  /\bare being\b/i,
  /\bwas being\b/i,
  /\bwere being\b/i,
  /\bhas been\b/i,
  /\bhave been\b/i,
  /\bhad been\b/i,
  /\bwill be\b/i,
] as const;

const CONTENT_ROOTS = [
  "client/src/content",
  "client/src/pages",
  "client/src/components/ui/share-kit.tsx",
] as const;

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

type Issue = {
  file: string;
  issue: string;
  excerpt: string;
};

function shouldScan(filePath: string) {
  const normalized = path.normalize(filePath);
  if (normalized.endsWith(".md")) return true;
  if (normalized.endsWith(path.normalize("client/src/components/ui/share-kit.tsx"))) return true;
  return INCLUDED_PAGE_FILES.has(normalized);
}

function walk(target: string, found: string[]) {
  const stat = statSync(target);
  if (stat.isDirectory()) {
    for (const entry of readdirSync(target)) {
      walk(path.join(target, entry), found);
    }
    return;
  }
  if (shouldScan(target)) found.push(target);
}

function extractSegments(filePath: string, content: string) {
  if (filePath.endsWith(".md")) return [content];

  const matches = content.match(/"[^"\n]{12,}"|'[^'\n]{12,}'|`[^`\n]{12,}`/g) || [];
  return matches.map((segment) => segment.slice(1, -1));
}

function lintSegment(segment: string) {
  const issues: string[] = [];
  const normalized = segment.toLowerCase();

  for (const phrase of BANNED_PHRASES) {
    if (normalized.includes(phrase)) {
      issues.push(`Banned phrase "${phrase}"`);
    }
  }

  for (const phrase of GENERIC_PHRASES) {
    if (normalized.includes(phrase)) {
      issues.push(`Generic phrase "${phrase}"`);
    }
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
    if (wordCount > 36) {
      issues.push(`Long sentence (${wordCount} words)`);
      break;
    }
  }

  return issues;
}

const files: string[] = [];
for (const root of CONTENT_ROOTS) {
  walk(root, files);
}

const allIssues: Issue[] = [];
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
