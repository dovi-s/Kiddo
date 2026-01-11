import { Link } from "wouter";

interface LogoProps {
  size?: "sm" | "md" | "lg";
  showWordmark?: boolean;
  className?: string;
  linkTo?: string | null;
}

export function Logo({ size = "md", showWordmark = true, className = "", linkTo = "/" }: LogoProps) {
  const sizes = {
    sm: { icon: "w-5 h-5", text: "text-[14px]", gap: "gap-1.5", stroke: 2.5 },
    md: { icon: "w-6 h-6", text: "text-[16px]", gap: "gap-2", stroke: 2.5 },
    lg: { icon: "w-8 h-8", text: "text-[20px]", gap: "gap-2.5", stroke: 2.5 },
  };

  const s = sizes[size];

  const logoContent = (
    <span className={`flex items-center ${s.gap} ${className}`}>
      <svg className={s.icon} viewBox="0 0 32 32" fill="none">
        <path 
          d="M8 6v20M8 16l10-10M8 16l10 10" 
          stroke="currentColor" 
          strokeWidth={s.stroke}
          strokeLinecap="round" 
          strokeLinejoin="round"
        />
      </svg>
      {showWordmark && (
        <span 
          className={`font-medium ${s.text} tracking-[0.02em]`}
          style={{ 
            letterSpacing: '0.02em',
            fontFeatureSettings: '"kern" 1',
          }}
        >
          <span style={{ letterSpacing: '-0.02em' }}>ko</span>
          <span style={{ letterSpacing: '-0.01em' }}>ra</span>
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
    sm: "w-5 h-5",
    md: "w-6 h-6", 
    lg: "w-8 h-8",
  };

  return (
    <svg className={`${sizes[size]} ${className}`} viewBox="0 0 32 32" fill="none">
      <path 
        d="M8 6v20M8 16l10-10M8 16l10 10" 
        stroke="currentColor" 
        strokeWidth={2.5}
        strokeLinecap="round" 
        strokeLinejoin="round"
      />
    </svg>
  );
}
