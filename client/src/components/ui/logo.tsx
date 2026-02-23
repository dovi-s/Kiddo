import { useId } from "react";
import { Link } from "wouter";

interface KoraMarkProps {
  size?: number;
  className?: string;
}

function KoraMark({ size = 28, className = "" }: KoraMarkProps) {
  const uid = useId();
  const id = `kora-${uid}`;
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 48 48"
      fill="none"
      className={className}
      aria-label="Kora"
    >
      <defs>
        <linearGradient id={`${id}-bg`} x1="8" y1="6" x2="40" y2="42" gradientUnits="userSpaceOnUse">
          <stop stopColor="hsl(152, 45%, 22%)" />
          <stop offset="1" stopColor="hsl(152, 45%, 14%)" />
        </linearGradient>
        <radialGradient id={`${id}-seed`}>
          <stop stopColor="hsl(40, 85%, 62%)" />
          <stop offset="1" stopColor="hsl(36, 72%, 50%)" />
        </radialGradient>
      </defs>

      <circle cx="24" cy="24" r="23" fill={`url(#${id}-bg)`} />

      <circle cx="24" cy="24" r="20.5" stroke="white" strokeWidth="0.35" opacity="0.1" fill="none" />

      <path
        d="M17 13 L17 35"
        stroke="white"
        strokeWidth="3"
        strokeLinecap="round"
      />
      <path
        d="M17.5 24 C21 23, 26 18, 32.5 12.5"
        stroke="white"
        strokeWidth="3"
        strokeLinecap="round"
      />
      <path
        d="M17.5 24 C21 25, 26 30, 32.5 35.5"
        stroke="white"
        strokeWidth="3"
        strokeLinecap="round"
      />

      <circle cx="33.5" cy="11" r="2.4" fill={`url(#${id}-seed)`} />
    </svg>
  );
}

interface LogoProps {
  size?: "sm" | "md" | "lg";
  showWordmark?: boolean;
  className?: string;
  linkTo?: string | null;
}

export function Logo({ size = "md", showWordmark = true, className = "", linkTo = "/" }: LogoProps) {
  const sizes = {
    sm: { icon: 22, text: "text-[14px]", gap: "gap-1.5" },
    md: { icon: 26, text: "text-[16px]", gap: "gap-1.5" },
    lg: { icon: 34, text: "text-[20px]", gap: "gap-2" },
  };

  const s = sizes[size];

  const logoContent = (
    <span className={`flex items-center ${s.gap} ${className}`}>
      <KoraMark size={s.icon} />
      {showWordmark && (
        <span
          className={`font-semibold ${s.text} tracking-[0.01em] text-[hsl(var(--kora-evergreen))]`}
          style={{
            fontFeatureSettings: '"kern" 1',
          }}
        >
          kora
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
  const markSizes = {
    sm: 22,
    md: 28,
    lg: 36,
  };

  return <KoraMark size={markSizes[size]} className={className} />;
}

export { KoraMark };
