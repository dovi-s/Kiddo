// One-shot installer for the git hooks in `hooks/`. Copies each hook
// into `.git/hooks/` and makes it executable.
//
// Run via `npm run setup:hooks` once per clone.
import fs from "node:fs/promises";
import path from "node:path";

const SRC_DIR = "hooks";
const DST_DIR = path.join(".git", "hooks");

try {
  await fs.access(".git");
} catch {
  console.error("[setup-hooks] not a git repo (.git/ not found)");
  process.exit(1);
}

const entries = await fs.readdir(SRC_DIR);
let installed = 0;
for (const name of entries) {
  if (name.startsWith(".") || name === "README.md") continue;
  const src = path.join(SRC_DIR, name);
  const dst = path.join(DST_DIR, name);
  const contents = await fs.readFile(src, "utf8");
  await fs.writeFile(dst, contents);
  try {
    await fs.chmod(dst, 0o755);
  } catch {
    // Windows may not respect chmod; the hook still runs because git
    // invokes it via sh.
  }
  console.log(`[setup-hooks] installed ${name}`);
  installed += 1;
}

console.log(`[setup-hooks] done. ${installed} hook(s) installed.`);
