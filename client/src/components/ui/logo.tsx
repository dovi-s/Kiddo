import { Link } from "wouter";
import koraMarkImg from "../../assets/kiddo-logo-cropped.png";
import koraMarkWhiteImg from "../../assets/kiddo-logo-white.png";

interface LogoProps {
  size?: "sm" | "md" | "lg";
  showWordmark?: boolean;
  className?: string;
  linkTo?: string | null;
  /** On evergreen / dark backgrounds: use the white K + cream wordmark so the
      mark stays legible (the default gradient K goes low-contrast on dark). */
  onDark?: boolean;
}

export function Logo({ size = "md", showWordmark = true, className = "", linkTo = "/", onDark = false }: LogoProps) {
  const sizes = {
    sm: { icon: "w-6 h-6", text: "text-[14px]", gap: "gap-1" },
    md: { icon: "w-7 h-7", text: "text-[16px]", gap: "gap-1.5" },
    lg: { icon: "w-9 h-9", text: "text-[20px]", gap: "gap-2" },
  };

  const s = sizes[size];

  const logoContent = (
    <span className={`flex items-center ${s.gap} ${className}`}>
      {/* Brand mark icon is decorative. The adjacent visible "Kiddo"
          wordmark labels the brand for screen readers — either via
          showWordmark={true} (rendered just below) or via a consumer
          (DesktopSidebar, FundSnapshot) that renders its own wordmark
          adjacent. Empty alt + aria-hidden prevents a "Kiddo Kiddo"
          double-read. Fixed 2026-05-15 after the parent flagged the
          duplicate on the Account → Security tab. The icon-only
          LogoMark export below KEEPS alt="Kiddo" because that variant
          is used without an adjacent wordmark and IS the only label. */}
      <img
        src={onDark ? koraMarkWhiteImg : koraMarkImg}
        alt=""
        aria-hidden="true"
        className={`${s.icon} object-contain`}
      />
      {/* Canonical wordmark: solid evergreen, Bricolage (font-heading), bold,
          tight tracking — matches the DesktopSidebar lockup so "Kiddo" reads the
          SAME everywhere. The old evergreen->gold gradient (SHIMMER_STYLE) was
          removed: it drifted from the locked no-gradient-bleeds rule, rendered
          muddy on non-white, and silently overrode consumers (e.g. GiftCheckout)
          that were already asking for solid evergreen. Color is forced here so
          the name is ONE color on every surface (nav, footer, auth, claim, etc.,
          all light backgrounds). The K mark is intentionally left untouched. */}
      {showWordmark && (
        <span
          className={`font-heading font-bold ${s.text} tracking-[-0.01em] ${onDark ? "text-[hsl(var(--kiddo-cream))]" : "text-[hsl(var(--kiddo-evergreen))]"}`}
        >
          Kiddo
        </span>
      )}
    </span>
  );

  if (linkTo === null) {
    return logoContent;
  }

  return (
    <Link href={linkTo} className="flex items-center" data-testid="link-home">
      {logoContent}
    </Link>
  );
}

export function LogoMark({ size = "md", className = "", onDark = false }: { size?: "sm" | "md" | "lg"; className?: string; onDark?: boolean }) {
  const sizes = {
    sm: { dim: "w-6 h-6" },
    md: { dim: "w-7 h-7" },
    lg: { dim: "w-9 h-9" },
  };

  const s = sizes[size];

  return (
    <img
      src={onDark ? koraMarkWhiteImg : koraMarkImg}
      alt="Kiddo"
      className={`${s.dim} object-contain ${className}`}
    />
  );
}
