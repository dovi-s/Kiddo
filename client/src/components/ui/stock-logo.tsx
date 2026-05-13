import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";

interface StockLogoProps {
  ticker?: string | null;
  symbol?: string | null;
  size?: number;
  className?: string;
}

export function StockLogo({ ticker, symbol, size = 36, className }: StockLogoProps) {
  const [failed, setFailed] = useState(false);
  const upper = String(ticker || symbol || "STK").trim().toUpperCase() || "STK";
  const src = `https://assets.parqet.com/logos/symbol/${upper}?format=jpg`;
  const testId = `stock-logo-${upper}`;

  const containerStyle = { width: size, height: size, minWidth: size };

  useEffect(() => {
    setFailed(false);
  }, [upper]);

  if (failed) {
    return (
      <div
        style={containerStyle}
        data-testid={testId}
        data-state="fallback"
        aria-label={`${upper} logo fallback`}
        className={cn(
          "flex items-center justify-center rounded-full bg-primary/10 text-primary font-semibold overflow-hidden shrink-0",
          className,
        )}
      >
        <span
          data-testid={`stock-logo-fallback-${upper}`}
          style={{ fontSize: size <= 28 ? 9 : size <= 36 ? 10 : 12 }}
          className="leading-none text-center px-0.5"
        >
          {upper.length > 4 ? upper.slice(0, 4) : upper}
        </span>
      </div>
    );
  }

  return (
    <div
      style={containerStyle}
      data-testid={testId}
      data-state="image"
      aria-label={`${upper} logo`}
      className={cn("rounded-full overflow-hidden shrink-0 bg-white border border-border/30", className)}
    >
      <img
        data-testid={`stock-logo-image-${upper}`}
        src={src}
        alt={upper}
        width={size}
        height={size}
        className="w-full h-full object-cover"
        onError={() => setFailed(true)}
      />
    </div>
  );
}
