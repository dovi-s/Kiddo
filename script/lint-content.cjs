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
  // shared/ is walked so the INCLUDED_SHARED_FILES allowlist below can
  // catch customer-facing copy that lives in shared modules (email
  // preference labels, gift-lesson explainers). shouldScan filters to
  // just the allowlisted files; the rest of shared/ is skipped.
  "shared",
  // Email templates are 100% user-facing copy. Added 2026-06-03 after five
  // em-dashes were found living in rendered email bodies (gifterMagicLink,
  // giftReceived, parentHandoffRecurring) — the scan had never covered
  // server/, so email copy drifted rule-free. Comments are stripped by
  // extractSegments, so code-facing em-dashes in template comments don't
  // false-positive.
  "server/templates",
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
  // 2026-05-25 MemoryBook audit: 6.9k-line page is the emotional
  // climax of the product (sealed letters, voice notes, memory
  // entries). Locked tier policy makes the parent-media gate
  // load-bearing; adding to lint guards the surrounding copy too.
  path.normalize("client/src/pages/MemoryBook.tsx"),
  // 2026-05-25 Kid View + FundSnapshot audits: kid-facing surface
  // (locked free across all tiers, age-aware copy registers) and
  // print-friendly summary respectively. Adding to lint because
  // both render heavy user copy with state-variance constraints
  // (majority age) that lint catches when hardcoded "18" drifts in.
  path.normalize("client/src/pages/KidView.tsx"),
  path.normalize("client/src/pages/FundSnapshot.tsx"),
  // 2026-05-25 Projection audit: 'Potential' page (age-slider
  // explorer at /projection/:fundId). State-variance already
  // parameterized correctly throughout; lint coverage protects
  // the projection-disclaimer copy from drift.
  path.normalize("client/src/pages/Projection.tsx"),
  // 2026-05-25 sixth-batch audits — Home, FAQ, FoundingMembers
  // already in lint via earlier additions. ClaimFund (highest-
  // emotional kid surface), Onboard (post-signup splash),
  // GetStarted (acquisition entry point) added so the locked
  // marketing-tone-vs-product-tone discipline is enforced
  // across all top-of-funnel + handoff surfaces.
  path.normalize("client/src/pages/Home.tsx"),
  path.normalize("client/src/pages/FAQ.tsx"),
  path.normalize("client/src/pages/ClaimFund.tsx"),
  path.normalize("client/src/pages/Onboard.tsx"),
  path.normalize("client/src/pages/GetStarted.tsx"),
  // 2026-05-25 marketing-page batch audits — add the remaining 6
  // public surfaces that weren't yet in coverage. Together with
  // the ones already linted (Home, About, Blog, Compare, Contact,
  // FAQ, Pricing, Security, Stories, Age18, FoundingMembers) this
  // brings the full marketing-page surface area under lint.
  path.normalize("client/src/pages/Legal.tsx"),
  path.normalize("client/src/pages/Demo.tsx"),
  path.normalize("client/src/pages/RobuxVsUtma.tsx"),
  // 2026-05-29: added with the satellite em-dash sweep. These two comparison/
  // calculator pages were never in the scan, so em-dashes accumulated in rendered
  // copy. Now linted so they can't recur.
  path.normalize("client/src/pages/TrumpAccountVsUtma.tsx"),
  path.normalize("client/src/pages/CalculatorAt18.tsx"),
  path.normalize("client/src/pages/UtmaByState.tsx"),
  path.normalize("client/src/pages/UtmaByStateIndex.tsx"),
  path.normalize("client/src/pages/BlogPost.tsx"),
  // 2026-05-25 gift-flow batch — last 5 uncovered surfaces. Claim is
  // where every gift recipient lands (conversion-critical), EventCreate
  // is the occasion creation flow (1374 lines), the rest are
  // smaller token entry points. Together with the marketing-page
  // batch the entire user-facing page set is now lint-covered.
  path.normalize("client/src/pages/Claim.tsx"),
  // Founder claim landing page (/founder-claim/:token) — added with the
  // founding-member claim flow (2026-05-26). Renders user-facing welcome +
  // benefits copy, so it joins the no-em-dash lint coverage.
  path.normalize("client/src/pages/FounderClaim.tsx"),
  path.normalize("client/src/pages/EventCreate.tsx"),
  path.normalize("client/src/pages/InvitationAccept.tsx"),
  path.normalize("client/src/pages/GiftLookup.tsx"),
  path.normalize("client/src/pages/ActivityDetail.tsx"),
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

// shared/ files that carry CUSTOMER-FACING copy (rendered labels,
// descriptions, kid-facing explainers). Added 2026-05-28 after a
// hard-named "DriveWealth" leaked into the tax-prep email-preference
// description (shared/emailPreferences.ts) and em-dashes leaked into
// kid-facing gift-lesson explainers (shared/gift-lessons.ts) — both
// invisible to the old scan because shared/ was never walked.
// DELIBERATELY EXCLUDED: schema.ts (the `drivewealth_account_id`
// column is a legit persisted reference, not copy) and
// platformReadiness.ts (admin-only readiness labels legitimately name
// the vendor they probe). Those would false-positive the custodian
// rule. Only files whose string literals are user-visible prose belong
// here.
const INCLUDED_SHARED_FILES = new Set([
  path.normalize("shared/emailPreferences.ts"),
  path.normalize("shared/milestones.ts"),
]);

const SHARED_ROOT = path.normalize("shared");

function shouldScan(filePath) {
  const normalized = path.normalize(filePath);
  if (normalized.endsWith(".md")) return true;
  // Every email template is user-facing prose — scan the whole directory.
  if (normalized.startsWith(path.normalize("server/templates") + path.sep)) return true;
  if (INCLUDED_COMPONENT_FILES.has(normalized)) return true;
  if (INCLUDED_SHARED_FILES.has(normalized)) return true;
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

  // Hard-named custodian in customer-facing copy. Per CUSTODIAN_SOURCE_OF_TRUTH.md
  // §4: until a custodian is locked AND wired, copy stays entity-agnostic ("our
  // broker-dealer partner, Member FINRA/SIPC"). Naming DriveWealth/Alpaca asserts
  // a vendor that isn't decided and creates re-edit churn. Comments are stripped
  // above, so this only catches RENDERED copy. When a custodian is finally locked
  // (see CUSTODIAN_SOURCE_OF_TRUTH §7), remove this rule and use the real name.
  for (const vendor of ["drivewealth", "alpaca"]) {
    if (normalized.includes(vendor)) {
      issues.push(`Hard-named custodian "${vendor}" in customer copy — use "our broker-dealer partner" (CUSTODIAN_SOURCE_OF_TRUTH.md §4)`);
    }
  }

  // Present-tense custody/SIPC claim with NO "not yet live" conditional. Custody
  // is a scaffold stub (CUSTODIAN_SOURCE_OF_TRUTH.md §4), so copy must never assert
  // that a fund IS held or IS protected today — it must read "when investing is
  // live" / "once invested". The name guard above can't catch tense; this does.
  // (Twice missed by the entity-agnostic sweep: ux-foundations + education.)
  const custodyContext = /broker-dealer|brokerage|custod|sipc/i.test(segment);
  const assertsLiveCustody =
    custodyContext &&
    (/\b(is|are)\s+held\b/i.test(segment) ||
      /\b(is|are)\s+(sipc[- ]?protected|protected up to)/i.test(segment) ||
      /\bsipc protection covers\b/i.test(segment));
  const hasLiveConditional =
    normalized.includes("when investing is live") ||
    normalized.includes("once invested") ||
    normalized.includes("when invested") ||
    normalized.includes("once your"); // "once your (investing) account is open"
  if (assertsLiveCustody && !hasLiveConditional) {
    issues.push(
      'Present-tense custody/SIPC claim — must be conditional ("when investing is live" / "once invested") until custody is wired (CUSTODIAN_SOURCE_OF_TRUTH.md §4)',
    );
  }

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

// ── Banned-icon guard (added 2026-05-29) ──
// The Sparkles and Wand2 lucide icons are banned (feedback_iconography_consistency.md,
// "never re-introduce"). The phrase lint above only scans the copy allowlist; this
// scans ALL client TSX for the icon IDENTIFIERS so a re-introduction fails CI. The
// ban regressed ~16 times across the codebase because it lived only in a memo, never
// in the build. Comments are stripped (so the in-code "banned per..." notes don't
// trip it); \b word boundaries mean SparkleBurst / showSparkles don't false-match.
const BANNED_ICONS = ["Sparkles", "SparkleBurst", "Wand2"];
(function scanForBannedIcons(dir) {
  for (const entry of readdirSync(dir)) {
    const full = path.join(dir, entry);
    if (statSync(full).isDirectory()) { scanForBannedIcons(full); continue; }
    if (!/\.(tsx|ts|jsx|js)$/.test(full)) continue;
    const codeOnly = readFileSync(full, "utf8")
      .replace(/\/\*[\s\S]*?\*\//g, "")
      .replace(/(^|\s)\/\/[^\n]*/g, "$1");
    for (const icon of BANNED_ICONS) {
      if (new RegExp(`\\b${icon}\\b`).test(codeOnly)) {
        allIssues.push({
          file: full,
          issue: `Banned icon "${icon}" — sparkle/wand iconography is AI-slop (feedback_iconography_consistency.md, "never re-introduce"). Use a semantic icon from the canonical map or drop it.`,
          excerpt: "(icon identifier found in non-comment code)",
        });
      }
    }
    // The ✨ sparkle EMOJI is the same banned AI-slop tell as the Sparkles
    // lucide icon, but the identifier ban above misses the raw glyph — it had
    // crept into the occasion-emoji maps + KidView copy. codeOnly has comments
    // stripped, so in-code notes that mention ✨ don't trip this.
    if (codeOnly.includes("✨")) {
      allIssues.push({
        file: full,
        issue: `Sparkle emoji (✨) — same banned AI-slop tell as the Sparkles icon (feedback_iconography_consistency.md). Use a semantic emoji (🎁 custom, 🎉 generic) or drop it.`,
        excerpt: "(✨ found in non-comment code)",
      });
    }
  }
})("client/src");

// ── Em-dash broad guard (added 2026-06-01) ──
// The INCLUDED_PAGE_FILES allowlist above curates which files get the FULL
// content rules (banned phrases, passive voice, sentence length). But the
// em-dash ban (feedback_no_emdash.md) applies to ALL user-facing copy, and
// files outside the allowlist were never scanned — App.tsx route-meta
// (title/description, user-visible in search results), HowItWorks.tsx,
// StoryPage.tsx, server/seoMeta.ts, and any component not individually
// allowlisted. Em-dashes slipped into several of these during the 2026-06-01
// copy sweep precisely because the allowlist didn't cover them. This broad
// pass scans every client/src .tsx/.ts plus the route-meta source for U+2014
// ONLY, reusing the same comment-stripping + string/JSX extraction so code
// comments and non-copy code don't false-trip. Mirrors the banned-icon broad
// scan below. Files already fully scanned above are skipped (no double-report).
// Line-based em-dash detection. The segment-extraction approach (string/JSX
// regexes) used by the main lint misses copy that spans nested tags or sits
// next to {expr} interpolations (TaxDocuments "and — once live — the forms
// {x}", GiftSuccess "Heads up — {name}", GifterDashboard "}— for your CPA").
// After stripping comments, the ONLY thing that can carry an em-dash is copy
// (string literal or JSX text) or a lone "—" empty-cell placeholder. So:
// strip comments (preserving newlines for line numbers), drop lone-"—"
// placeholder strings, then flag any line that still contains an em-dash.
// Catches every prose em-dash regardless of JSX structure; the lone-placeholder
// strip preserves the deliberate "single-char — cell marker is fine" choice.
const emDashScanned = new Set(files.map((f) => path.normalize(f)));
function scanForEmDashes(target) {
  const stat = statSync(target);
  if (stat.isDirectory()) {
    for (const entry of readdirSync(target)) scanForEmDashes(path.join(target, entry));
    return;
  }
  if (!/\.(tsx|ts)$/.test(target) || target.endsWith(".d.ts")) return;
  const normalized = path.normalize(target);
  if (emDashScanned.has(normalized)) return;
  emDashScanned.add(normalized);
  const codeOnly = readFileSync(target, "utf8")
    .replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, " ")) // keep newlines so line numbers stay aligned
    .replace(/(^|\s)\/\/[^\n]*/g, "$1");
  codeOnly.split(/\r?\n/).forEach((line, i) => {
    const stripped = line.replace(/(["'`])—\1/g, ""); // drop lone "—" empty-value placeholders
    if (stripped.includes("—")) {
      allIssues.push({
        file: `${target}:${i + 1}`,
        issue: "Em-dash (—) in user-facing copy (broad scan)",
        excerpt: line.trim().replace(/\s+/g, " ").slice(0, 160),
      });
    }
  });
}
scanForEmDashes("client/src");
scanForEmDashes(path.normalize("server/seoMeta.ts"));

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
