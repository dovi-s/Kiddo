// JsonLd — injects a schema.org JSON-LD <script> into <head> for the page that
// renders it, and removes it on unmount. Structured data is the marketing site's
// biggest untapped organic-discovery lever (FAQ rich results, Article cards,
// Organization knowledge panel) and the content already exists — this just makes
// it machine-readable. Google executes JS and reads JSON-LD from the rendered
// DOM, so client injection is sufficient for these page types.
//
// Pass a plain object (memoize at the call site so it doesn't re-inject every
// render). `id` dedupes if the same block could mount twice.

import { useEffect } from "react";

export function JsonLd({ data, id }: { data: unknown; id?: string }) {
  useEffect(() => {
    if (typeof document === "undefined" || !data) return;
    const el = document.createElement("script");
    el.type = "application/ld+json";
    if (id) el.id = id;
    try {
      el.text = JSON.stringify(data);
    } catch {
      return;
    }
    document.head.appendChild(el);
    return () => {
      el.remove();
    };
  }, [data, id]);
  return null;
}
