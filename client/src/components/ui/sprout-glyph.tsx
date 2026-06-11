// SproutGlyph — Kiddo's atomic brand mark, as inline SVG.
//
// The single shape that ties the favicon, the app icon, and the mascot's head
// together. Use it anywhere a tiny "this is Kiddo" stamp belongs and the full
// wordmark/mascot is too much: share-card watermark, loading state, the gift
// sticker corner, a section eyebrow. The vector source of truth lives at
// client/public/sprout-glyph.svg — keep the two in sync if you retune the curves.
//
// Two forms (see BRAND_IDENTITY.md, "two fidelities"):
//   • tile      — gold sprout on an evergreen rounded tile (the icon/app-icon form)
//   • bare      — just the gold sprout, transparent (default; the watermark form)
//
// Color follows the brand tokens by default (gold-light sprout, evergreen tile)
// but honors `color` for the sprout fill when you need it monochrome (e.g. white
// on a dark photo). Decorative by default (aria-hidden); pass `title` to label it.
interface SproutGlyphProps {
  size?: number;
  className?: string;
  /** Render the evergreen rounded tile behind the sprout (icon form). */
  tile?: boolean;
  /** Override the sprout fill (defaults to the gold-light brand token). */
  color?: string;
  /** Accessible label. When omitted the mark is decorative (aria-hidden). */
  title?: string;
}

export function SproutGlyph({
  size = 24,
  className = "",
  tile = false,
  color = "hsl(var(--kiddo-gold-light))",
  title,
}: SproutGlyphProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 32 32"
      className={className}
      role={title ? "img" : undefined}
      aria-label={title}
      aria-hidden={title ? undefined : true}
    >
      {title ? <title>{title}</title> : null}
      {tile ? (
        <rect width="32" height="32" rx="7.2" fill="hsl(var(--kiddo-evergreen))" />
      ) : null}
      <g fill={color}>
        <rect x="14.7" y="14.6" width="2.6" height="12.4" rx="1.3" />
        <path d="M16 16.8 C13.9 12.6 14.4 8.4 16 5.2 C17.6 8.4 18.1 12.6 16 16.8 Z" />
        <path d="M16 16.8 C11.9 16.2 8.2 12.9 7 7.8 C11.8 9.1 14.6 12.3 16 16.8 Z" />
        <path d="M16 16.8 C20.1 16.2 23.8 12.9 25 7.8 C20.2 9.1 17.4 12.3 16 16.8 Z" />
      </g>
    </svg>
  );
}
