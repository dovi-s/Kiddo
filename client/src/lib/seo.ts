import { useEffect } from "react";

function upsertMeta(selector: "name" | "property", key: string, content: string) {
  let tag = document.head.querySelector(`meta[${selector}="${key}"]`) as HTMLMetaElement | null;
  if (!tag) {
    tag = document.createElement("meta");
    tag.setAttribute(selector, key);
    document.head.appendChild(tag);
  }
  tag.setAttribute("content", content);
}

function upsertCanonical(href: string) {
  let tag = document.head.querySelector('link[rel="canonical"]') as HTMLLinkElement | null;
  if (!tag) {
    tag = document.createElement("link");
    tag.setAttribute("rel", "canonical");
    document.head.appendChild(tag);
  }
  tag.setAttribute("href", href);
}

export function usePageSeo({
  title,
  description,
  ogType = "article",
  robots,
}: {
  title: string;
  description: string;
  ogType?: "website" | "article";
  /**
   * Robots directive. Set to "noindex,nofollow" on private/user-scoped
   * pages (Account, FundsOverview, Settings, etc.) so search engines don't
   * index them. Default behavior (omit prop) = no robots meta tag emitted,
   * which is equivalent to "index,follow" — appropriate for public marketing
   * surfaces (Home, FAQ, Pricing, Compare, blog posts).
   */
  robots?: string;
}) {
  useEffect(() => {
    const canonical = `${window.location.origin}${window.location.pathname}`;
    const existingOgImage =
      (document.head.querySelector('meta[property="og:image"]') as HTMLMetaElement | null)?.content ||
      "/kiddo-og-image.png";
    const imageUrl = existingOgImage.startsWith("http")
      ? existingOgImage
      : `${window.location.origin}${existingOgImage.startsWith("/") ? existingOgImage : `/${existingOgImage}`}`;

    document.title = title;
    upsertCanonical(canonical);
    upsertMeta("name", "description", description);
    upsertMeta("property", "og:title", title);
    upsertMeta("property", "og:description", description);
    upsertMeta("property", "og:type", ogType);
    upsertMeta("property", "og:url", canonical);
    upsertMeta("property", "og:site_name", "Kiddo");
    upsertMeta("property", "og:image", imageUrl);
    upsertMeta("name", "twitter:title", title);
    upsertMeta("name", "twitter:description", description);
    upsertMeta("name", "twitter:image", imageUrl);
    if (robots) {
      upsertMeta("name", "robots", robots);
    }
  }, [description, ogType, title, robots]);
}
