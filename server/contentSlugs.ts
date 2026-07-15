import { readdirSync } from "fs";
import { join } from "path";

// The blog/story SEO pages are markdown-file-driven: client/src/content/{blog,stories}/*.md,
// loaded on the client via Vite's import.meta.glob (see client/src/lib/content.ts).
// The server sitemap must list the SAME slugs, but the esbuild server bundle can't
// read the client's Vite glob — so we enumerate the .md files from disk at runtime.
//
// Path is resolved from the repo root (process.cwd()), which is the launch dir for
// both `npm run dev` (nodemon → tsx) and `npm start` (node dist/index.cjs). Render
// checks out the full repo before building, so client/src/content/ is present on the
// production filesystem too. If the directory is ever missing we log and return []
// (a partial sitemap, never a crash) so the miss is visible rather than silent.
function slugsIn(subdir: string): string[] {
  const dir = join(process.cwd(), "client", "src", "content", subdir);
  try {
    return readdirSync(dir)
      .filter((f) => f.endsWith(".md"))
      .map((f) => f.replace(/\.md$/, ""))
      .sort();
  } catch (err) {
    // eslint-disable-next-line no-console
    console.warn(`[sitemap] could not read ${dir}; those URLs will be absent from sitemap.xml`, err);
    return [];
  }
}

export function blogSlugs(): string[] {
  return slugsIn("blog");
}

export function storySlugs(): string[] {
  return slugsIn("stories");
}
