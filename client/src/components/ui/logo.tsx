import { Link } from "wouter";

interface LogoProps {
  size?: "sm" | "md" | "lg";
  showWordmark?: boolean;
  className?: string;
  linkTo?: string | null;
}

export function Logo({ size = "md", showWordmark = true, className = "", linkTo = "/" }: LogoProps) {
  const sizes = {
    sm: { icon: "w-5 h-5", text: "text-[14px]", gap: "gap-1.5", stroke: 2 },
    md: { icon: "w-6 h-6", text: "text-[16px]", gap: "gap-2", stroke: 2.5 },
    lg: { icon: "w-8 h-8", text: "text-[20px]", gap: "gap-2.5", stroke: 2.5 },
  };

  const s = sizes[size];

  const logoContent = (
    <span className={`flex items-center ${s.gap} ${className}`}>
      <svg className={s.icon} viewBox="0 0 32 32" fill="none">
        {/* K stem - deep evergreen */}
        <path 
          d="M7 5v22" 
          className="stroke-primary"
          strokeWidth={s.stroke}
          strokeLinecap="round" 
        />
        {/* K diagonal leg */}
        <path 
          d="M7 16l8 10" 
          className="stroke-primary"
          strokeWidth={s.stroke}
          strokeLinecap="round" 
          strokeLinejoin="round"
        />
        {/* Arrow swoosh with heart curve - warm gold accent */}
        <path 
          d="M7 16c4-4 8-7 12-9c2.5 1 4 3 4 5c0 2.5-2 4-4 4c-1.5 0-2.5-0.5-3-1.5" 
          className="stroke-accent"
          strokeWidth={s.stroke * 0.9}
          strokeLinecap="round" 
          strokeLinejoin="round"
          fill="none"
        />
        {/* Arrow tip */}
        <path 
          d="M17 5l2 2M19 7l2-2" 
          className="stroke-accent"
          strokeWidth={s.stroke * 0.8}
          strokeLinecap="round" 
          strokeLinejoin="round"
        />
      </svg>
      {showWordmark && (
        <span 
          className={`font-medium ${s.text} tracking-[0.02em] text-primary`}
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
    sm: { dim: "w-5 h-5", stroke: 2 },
    md: { dim: "w-6 h-6", stroke: 2.5 }, 
    lg: { dim: "w-8 h-8", stroke: 2.5 },
  };

  const s = sizes[size];

  return (
    <svg className={`${s.dim} ${className}`} viewBox="0 0 32 32" fill="none">
      {/* K stem - deep evergreen */}
      <path 
        d="M7 5v22" 
        className="stroke-primary"
        strokeWidth={s.stroke}
        strokeLinecap="round" 
      />
      {/* K diagonal leg */}
      <path 
        d="M7 16l8 10" 
        className="stroke-primary"
        strokeWidth={s.stroke}
        strokeLinecap="round" 
        strokeLinejoin="round"
      />
      {/* Arrow swoosh with heart curve - warm gold accent */}
      <path 
        d="M7 16c4-4 8-7 12-9c2.5 1 4 3 4 5c0 2.5-2 4-4 4c-1.5 0-2.5-0.5-3-1.5" 
        className="stroke-accent"
        strokeWidth={s.stroke * 0.9}
        strokeLinecap="round" 
        strokeLinejoin="round"
        fill="none"
      />
      {/* Arrow tip */}
      <path 
        d="M17 5l2 2M19 7l2-2" 
        className="stroke-accent"
        strokeWidth={s.stroke * 0.8}
        strokeLinecap="round" 
        strokeLinejoin="round"
      />
    </svg>
  );
}
