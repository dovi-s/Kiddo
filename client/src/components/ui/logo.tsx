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
      <img
        src={koraMarkImg}
        alt="Kiddo"
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
