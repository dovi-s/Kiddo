export type ContentType = "blog" | "story";

export type ContentEntry = {
  slug: string;
  type: ContentType;
  title: string;
  description: string;
  publishedAt: string;
  category: string;
  tags: string[];
  eyebrow?: string;
  ctaLabel?: string;
  ctaHref?: string;
  readTime?: string;
  heroNote?: string;
  occasion?: string;
  body: string;
};

type Frontmatter = Record<string, string>;

function parseFrontmatter(raw: string) {
  if (!raw.startsWith("---")) return { frontmatter: {} as Frontmatter, body: raw.trim() };

  const end = raw.indexOf("\n---", 3);
  if (end === -1) return { frontmatter: {} as Frontmatter, body: raw.trim() };

  const frontmatterBlock = raw.slice(3, end).trim();
  const body = raw.slice(end + 4).trim();
  const frontmatter = frontmatterBlock.split("\n").reduce<Frontmatter>((acc, line) => {
    const separator = line.indexOf(":");
    if (separator === -1) return acc;
    const key = line.slice(0, separator).trim();
    const value = line.slice(separator + 1).trim();
    acc[key] = value.replace(/^"(.*)"$/, "$1");
    return acc;
  }, {});
  return { frontmatter, body };
}

function toTags(value?: string) {
  return String(value || "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

function fileNameToSlug(filePath: string) {
  const cleaned = filePath.replace(/\\/g, "/");
  return cleaned.slice(cleaned.lastIndexOf("/") + 1).replace(/\.md$/, "");
}

function buildEntry(filePath: string, raw: string, type: ContentType): ContentEntry {
  const { frontmatter, body } = parseFrontmatter(raw);
  return {
    slug: String(frontmatter.slug || fileNameToSlug(filePath)),
    type,
    title: String(frontmatter.title || "Untitled"),
    description: String(frontmatter.description || ""),
    publishedAt: String(frontmatter.publishedAt || "2026-01-01"),
    category: String(frontmatter.category || "getting-started"),
    tags: toTags(frontmatter.tags),
    eyebrow: frontmatter.eyebrow,
    ctaLabel: frontmatter.ctaLabel,
    ctaHref: frontmatter.ctaHref,
    readTime: frontmatter.readTime,
    heroNote: frontmatter.heroNote,
    occasion: frontmatter.occasion,
    body,
  };
}

const blogModules = import.meta.glob("../content/blog/*.md", {
  query: "?raw",
  import: "default",
  eager: true,
}) as Record<string, string>;

const storyModules = import.meta.glob("../content/stories/*.md", {
  query: "?raw",
  import: "default",
  eager: true,
}) as Record<string, string>;

export const blogPosts = Object.entries(blogModules)
  .map(([filePath, raw]) => buildEntry(filePath, raw, "blog"))
  .sort((a, b) => new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime());

export const storyEntries = Object.entries(storyModules)
  .map(([filePath, raw]) => buildEntry(filePath, raw, "story"))
  .sort((a, b) => new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime());

export function getBlogPost(slug: string) {
  return blogPosts.find((entry) => entry.slug === slug);
}

export function getStoryEntry(slug: string) {
  return storyEntries.find((entry) => entry.slug === slug);
}
