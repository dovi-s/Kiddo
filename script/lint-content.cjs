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
  // 2026-05-23 session ships — added after a user-facing em-dash slipped
  // into GiftCheckout's recurring toggle subtitle and the user caught it.
  // These files all carry user-visible copy at the gifter or parent
  // surface; lint coverage prevents future em-dash slip-throughs.
  path.normalize("client/src/pages/GiftCheckout.tsx"),
  path.normalize("client/src/pages/SponsorSuccess.tsx"),
  path.normalize("client/src/pages/FoundingMembers.tsx"),
  // 2026-05-25 settings audit caught four em-dashes in user-facing copy
  // inside Settings/Account that had drifted in over time (Settings tax
  // docs body, taking-money-out body, custom-strategy save status,
  // Account email empty-state). Adding the parent-side membership and
  // profile surfaces to lint so the same drift can't recur.
  path.normalize("client/src/pages/Settings.tsx"),
  path.normalize("client/src/pages/Account.tsx"),
  path.normalize("client/src/pages/Profile.tsx"),
  // 2026-05-25 Activity audit caught an em-dash in the expanded
  // gifter-reminder detail row that the existing lint never scanned.
  // Add Activity to lint so the same drift can't recur on a 4,000+
  // line page that renders heavy user-facing copy.
  path.normalize("client/src/pages/Activity.tsx"),
  // 2026-05-25 Age18Plan audit: parent-facing at-18 handoff page
  // is the locked kid-2.0 funnel signpost. Adding to lint so the
  // copy on the most emotionally-loaded page in the product is
  // protected from drift.
  path.normalize("client/src/pages/Age18Plan.tsx"),
  path.normalize("client/src/pages/Age18Welcome.tsx"),
  // 2026-05-25 Dashboard audit: 14k-line parent surface is the
  // primary engagement page. Spot-fixing here without lint coverage
  // is a losing battle as the page accumulates copy over months.
  path.normalize("client/src/pages/Dashboard.tsx"),
]);

// Component allowlist — same expansion-after-violation reasoning as
// INCLUDED_PAGE_FILES. Components that render user-visible copy
// (cards, sheets, modals, banners) are now scanned for em-dashes
// and the other rules. Internal-utility components and ui/*
// primitives are intentionally NOT included (they don't render
// user-facing prose).
const INCLUDED_COMPONENT_FILES = new Set([
  path.normalize("client/src/components/SponsorPlusCard.tsx"),
  path.normalize("client/src/components/ScheduledLetterEditor.tsx"),
  path.normalize("client/src/components/ScheduledLettersList.tsx"),
  path.normalize("client/src/components/ReminderAndAskParentsCard.tsx"),
  path.normalize("client/src/components/RecurringRequestsNudge.tsx"),
  path.normalize("client/src/components/RothInterestOptIn.tsx"),
  path.normalize("client/src/components/PlusUpgradePromptCard.tsx"),
  path.normalize("client/src/components/MemoryMediaPicker.tsx"),
  path.normalize("client/src/components/CoParentAccessCard.tsx"),
  path.normalize("client/src/components/FeatureWallModal.tsx"),
]);

function shouldScan(filePath) {
  const normalized = path.normalize(filePath);
  if (normalized.endsWith(".md")) return true;
  if (normalized.endsWith(path.normalize("client/src/components/ui/share-kit.tsx"))) return true;
  if (INCLUDED_COMPONENT_FILES.has(normalized)) return true;
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
  // Strip comments first so em-dashes in code comments don't trigger
  // (comments are internal; the em-dash ban applies only to
  // user-facing copy). Order: block comments, then line comments.
  // Block-comment regex uses [\s\S] not . so it crosses newlines.
  const codeOnly = content
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/(^|\s)\/\/[^\n]*/g, "$1");

  // String literals — the original surface.
  const stringMatches = codeOnly.match(/"[^"\n]{12,}"|'[^'\n]{12,}'|`[^`\n]{12,}`/g) || [];

  // JSX text content — em-dashes in `<p>Hello — world</p>` would
  // slip through the string-literal regex above. Match runs of
  // text between > and < that don't include other tag boundaries
  // or JSX expression braces. 12-char minimum keeps single-char
  // separators ("→", " ", etc.) from triggering false positives.
  // Added 2026-05-23 after the GiftCheckout recurring-toggle em-dash
  // slipped past the string-literal-only scan.
  const jsxTextMatches = codeOnly.match(/>[^<>{}\n]{12,}</g) || [];

  return [
    ...stringMatches.map((segment) => segment.slice(1, -1)),
    ...jsxTextMatches.map((segment) => segment.slice(1, -1).trim()),
  ];
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
