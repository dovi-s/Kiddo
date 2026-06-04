import DOMPurify from "dompurify";

// Read-only renderer for stored rich-text HTML. Lives in its OWN module —
// separate from rich-text-editor.tsx — so importing it does NOT static-link
// the ~404KB (130KB gzip) tiptap editor tree. This matters because the PUBLIC
// GiftCheckout funnel (the most cost-sensitive cold-load surface) only needs
// to RENDER stored descriptions, never edit them. It depends on DOMPurify
// only. The editor (RichTextEditor) keeps living in rich-text-editor.tsx,
// which re-exports this component for the authoring pages that import both.
// 2026-06-04 bundle split.

/** Render stored rich text HTML safely, with basic prose styling */
export function RichText({ html, className }: { html: string; className?: string }) {
  if (!html || html === "<p></p>") return null;
  // SECURITY: this stored HTML (event description, etc.) is rendered on the
  // PUBLIC, unauthenticated gift page. The API accepts the raw string, so a
  // crafted payload (`<img src=x onerror=...>`) posted directly to the events
  // endpoint would otherwise execute in any visitor's session (the prod CSP
  // still allows 'unsafe-inline'). Sanitize before injection with a hard
  // allowlist matching what the editor can produce — basic inline formatting,
  // and ZERO attributes, so no event handlers / styles / URL-bearing attrs
  // survive. Defense-in-depth alongside any server-side sanitization.
  const clean = DOMPurify.sanitize(html, {
    ALLOWED_TAGS: ["p", "br", "strong", "em", "b", "i", "u", "s"],
    ALLOWED_ATTR: [],
  });
  if (!clean || clean === "<p></p>") return null;
  return (
    <div
      className={`rich-text text-sm leading-relaxed [&_p]:mb-1.5 [&_p:last-child]:mb-0 [&_strong]:font-semibold [&_em]:italic ${className ?? ""}`}
      dangerouslySetInnerHTML={{ __html: clean }}
    />
  );
}
