import type React from "react";
import { Link } from "wouter";
import koraMarkImg from "../../assets/kiddo-logo-cropped.png";

interface LogoProps {
  size?: "sm" | "md" | "lg";
  showWordmark?: boolean;
  className?: string;
  linkTo?: string | null;
}

const SHIMMER_STYLE: React.CSSProperties = {
  backgroundImage: "linear-gradient(135deg, #1a3d2b 0%, #b8791a 100%)",
  backgroundClip: "text",
  WebkitBackgroundClip: "text",
  color: "transparent",
  WebkitTextFillColor: "transparent",
};

export function Logo({ size = "md", showWordmark = true, className = "", linkTo = "/" }: LogoProps) {
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
        src={koraMarkImg}
        alt=""
        aria-hidden="true"
        className={`${s.icon} object-contain`}
      />
      {showWordmark && (
        <span
          className={`font-serif font-semibold ${s.text} tracking-[0.01em]`}
          style={SHIMMER_STYLE}
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

export function LogoMark({ size = "md", className = "" }: { size?: "sm" | "md" | "lg"; className?: string }) {
  const sizes = {
    sm: { dim: "w-6 h-6" },
    md: { dim: "w-7 h-7" },
    lg: { dim: "w-9 h-9" },
  };

  const s = sizes[size];

  return (
    <img
      src={koraMarkImg}
      alt="Kiddo"
      className={`${s.dim} object-contain ${className}`}
    />
  );
}
