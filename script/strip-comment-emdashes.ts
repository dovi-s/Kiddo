// Strip em-dashes ONLY from JS/TS comment regions (line + block).
// String literals are preserved.
//
// Scope: deferred Tier-3 sweep #10 — em-dashes inside JS comments
// across all email templates. The locked discipline bans em-dashes
// in user-facing copy (toast text, marketing pages, etc.); the
// comment sweep extends the same to implementation comments so
// editors don't copy/paste em-dash structure forward into new
// user-facing copy.
//
// Why a script not a manual edit: ~100 em-dashes across a dozen
// files. Doing it by hand invites missed ones. The script's logic
// is small enough to spot-check; the resulting diff is what matters.
//
// Substitution rules (most → least common):
//   " — " (em-dash surrounded by spaces) → " " (collapse the dash
//      and one of the spaces; reads as a natural pause-without-dash)
//   "— " (start-of-fragment em-dash with trailing space) → ""
//   " —" (em-dash with leading space, end-of-fragment) → ""
//   "—" (bare em-dash, rare) → " "
//
// Run: npx tsx script/strip-comment-emdashes.ts

import fs from "fs";
import path from "path";

const TARGETS = [
  "server/gifterNotificationWorker.ts",
  "server/age18TransitionWorker.ts",
  "server/gifterYearEndWorker.ts",
  "server/stalledHandoffWorker.ts",
  "server/postHandoffEngagementWorker.ts",
  "server/giftIntentExpiryWorker.ts",
  "server/parentLifecycleWorker.ts",
  "server/fundBirthdayWorker.ts",
  "server/kidMilestoneWorker.ts",
  "server/gifterReturnReminderWorker.ts",
  "server/fundAnniversaryWorker.ts",
  "server/emailDelivery.ts",
];

const EM_DASH = "—";

function stripEmDashes(input: string): string {
  // Order matters: most-specific patterns first so " — " collapses
  // to " " before bare "—" gets its own replacement pass.
  return input
    .replace(/ — /g, " ")
    .replace(/— /g, "")
    .replace(/ —/g, "")
    .replace(/—/g, " ");
}

// Rewrite a single file. Walks character-by-character tracking:
//   - inside a string literal (', ", `) → preserve em-dashes
//   - inside a line comment (// ... \n) → strip em-dashes
//   - inside a block comment (/* ... */) → strip em-dashes
//   - elsewhere → preserve (em-dashes outside comments stay; they
//     would be in `RegExp` text or template-string interpolation,
//     both of which are user-facing or syntactic)
function rewriteFile(filePath: string): { changed: boolean; before: number; after: number } {
  const original = fs.readFileSync(filePath, "utf8");
  const beforeCount = (original.match(/—/g) || []).length;

  let out = "";
  let i = 0;
  type State =
    | "normal"
    | "lineComment"
    | "blockComment"
    | "singleQuote"
    | "doubleQuote"
    | "templateLiteral";
  let state: State = "normal";
  // Buffer comment regions so we can run stripEmDashes() on the
  // contiguous comment text in one pass (handles " — " spanning
  // a tokenization boundary cleanly).
  let commentBuf = "";

  const flushComment = () => {
    out += stripEmDashes(commentBuf);
    commentBuf = "";
  };

  while (i < original.length) {
    const c = original[i];
    const next = original[i + 1] || "";
    if (state === "normal") {
      if (c === "/" && next === "/") {
        state = "lineComment";
        commentBuf += "//";
        i += 2;
        continue;
      }
      if (c === "/" && next === "*") {
        state = "blockComment";
        commentBuf += "/*";
        i += 2;
        continue;
      }
      if (c === "'") { state = "singleQuote"; out += c; i += 1; continue; }
      if (c === '"') { state = "doubleQuote"; out += c; i += 1; continue; }
      if (c === "`") { state = "templateLiteral"; out += c; i += 1; continue; }
      out += c;
      i += 1;
      continue;
    }
    if (state === "lineComment") {
      if (c === "\n") {
        flushComment();
        out += "\n";
        state = "normal";
        i += 1;
        continue;
      }
      commentBuf += c;
      i += 1;
      continue;
    }
    if (state === "blockComment") {
      if (c === "*" && next === "/") {
        commentBuf += "*/";
        flushComment();
        state = "normal";
        i += 2;
        continue;
      }
      commentBuf += c;
      i += 1;
      continue;
    }
    if (state === "singleQuote") {
      if (c === "\\") {
        out += c + (next || "");
        i += 2;
        continue;
      }
      if (c === "'") { state = "normal"; out += c; i += 1; continue; }
      out += c;
      i += 1;
      continue;
    }
    if (state === "doubleQuote") {
      if (c === "\\") {
        out += c + (next || "");
        i += 2;
        continue;
      }
      if (c === '"') { state = "normal"; out += c; i += 1; continue; }
      out += c;
      i += 1;
      continue;
    }
    if (state === "templateLiteral") {
      // ${ ... } inside a template can contain nested code; for the
      // simple cases in this codebase we don't expect em-dashes
      // inside ${}. Treat the whole template-literal body as a
      // string until the closing backtick.
      if (c === "\\") {
        out += c + (next || "");
        i += 2;
        continue;
      }
      if (c === "`") { state = "normal"; out += c; i += 1; continue; }
      out += c;
      i += 1;
      continue;
    }
  }
  // Trailing unterminated line comment (no newline at EOF).
  if (state === "lineComment" || state === "blockComment") {
    flushComment();
  }

  const afterCount = (out.match(/—/g) || []).length;
  const changed = out !== original;
  if (changed) fs.writeFileSync(filePath, out, "utf8");
  return { changed, before: beforeCount, after: afterCount };
}

function main() {
  const root = process.cwd();
  let totalBefore = 0;
  let totalAfter = 0;
  let filesChanged = 0;
  for (const rel of TARGETS) {
    const abs = path.join(root, rel);
    if (!fs.existsSync(abs)) {
      console.warn(`  skip: ${rel} (not found)`);
      continue;
    }
    const { changed, before, after } = rewriteFile(abs);
    totalBefore += before;
    totalAfter += after;
    if (changed) filesChanged += 1;
    console.log(`  ${rel}  em-dashes: ${before} -> ${after}  ${changed ? "(edited)" : ""}`);
  }
  console.log("");
  console.log(`Total: ${totalBefore} em-dashes before, ${totalAfter} after (across ${filesChanged} files edited).`);
}

main();
