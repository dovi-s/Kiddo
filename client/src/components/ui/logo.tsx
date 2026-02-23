import { useId } from "react";
import { Link } from "wouter";

interface KoraMarkProps {
  size?: number;
  className?: string;
}

function KoraMark({ size = 28, className = "" }: KoraMarkProps) {
  const uid = useId();
  const id = `k${uid.replace(/:/g, "")}`;

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
        <linearGradient
          id={`${id}gf`}
          x1="13"
          y1="24"
          x2="38"
          y2="4"
          gradientUnits="userSpaceOnUse"
        >
          <stop offset="0%" stopColor="hsl(152, 45%, 18%)" />
          <stop offset="45%" stopColor="hsl(152, 45%, 22%)" />
          <stop offset="100%" stopColor="hsl(36, 72%, 50%)" />
        </linearGradient>
      </defs>

      <path
        d="M15 5 C14 13, 13 21, 12.5 28 C12 33, 10.5 37, 8.5 39.5 Q6.5 42, 8.5 43 Q11 44.5, 13.5 41 C14.5 39, 15.5 36, 15.5 31"
        stroke="hsl(152, 45%, 18%)"
        strokeWidth="3.6"
        strokeLinecap="round"
        fill="none"
      />

      <path
        d="M13 23 C17 19, 24 12, 36 4"
        stroke={`url(#${id}gf)`}
        strokeWidth="3.6"
        strokeLinecap="round"
        fill="none"
      />

      <path
        d="M29 11 L37 3.5 L35.5 13"
        stroke="hsl(36, 72%, 50%)"
        strokeWidth="3"
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />

      <path
        d="M13 23 C17 27, 22 31, 27.5 34"
        stroke="hsl(152, 45%, 18%)"
        strokeWidth="3.2"
        strokeLinecap="round"
        fill="none"
      />

      <path
        d="M36 42.5 C33.5 40, 30 37.5, 30 34.5 C30 32, 31.5 30.5, 33.5 30.5 C35 30.5, 36 32, 36 33.5 C36 32, 37 30.5, 38.5 30.5 C40.5 30.5, 42 32, 42 34.5 C42 37.5, 38.5 40, 36 42.5 Z"
        fill="hsl(36, 72%, 50%)"
      />
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
