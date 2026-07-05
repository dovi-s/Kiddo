import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";

interface StockLogoProps {
  ticker?: string | null;
  symbol?: string | null;
  size?: number;
  className?: string;
  // When false, the no-logo fallback renders just the ticker's first initial
  // instead of the full ticker text. Use it where a ticker LABEL already sits
  // beside the logo (e.g. Activity's "Spread across" pills) so a logo-less ETF
  // doesn't read as a doubled "VTI VTI". Defaults true (full-ticker fallback).
  fallbackText?: boolean;
}

export function StockLogo({ ticker, symbol, size = 36, className, fallbackText = true }: StockLogoProps) {
  const [failed, setFailed] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const imgRef = useRef<HTMLImageElement>(null);
  const upper = String(ticker || symbol || "STK").trim().toUpperCase() || "STK";
  const src = `https://assets.parqet.com/logos/symbol/${upper}?format=jpg`;
  const testId = `stock-logo-${upper}`;

  const containerStyle = { width: size, height: size, minWidth: size };

  useEffect(() => {
    setFailed(false);
    // Cached logos can already be `complete` before React binds onLoad — detect
    // that on (re)mount so a cached image never gets stuck invisible at opacity 0.
    const el = imgRef.current;
    setLoaded(Boolean(el && el.complete && el.naturalWidth > 0));
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
          {fallbackText ? (upper.length > 4 ? upper.slice(0, 4) : upper) : upper.slice(0, 1)}
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
        ref={imgRef}
        data-testid={`stock-logo-image-${upper}`}
        src={src}
        alt={upper}
        width={size}
        height={size}
        decoding="async"
        // Graceful fade-in instead of an abrupt pop when the remote logo lands
        // (premium polish — a logo snapping in reads as "website"). Cached logos
        // fire onLoad ~immediately, so the fade is imperceptible there.
        className="w-full h-full object-cover transition-opacity duration-300 ease-out"
        style={{ opacity: loaded ? 1 : 0 }}
        onLoad={() => setLoaded(true)}
        onError={() => setFailed(true)}
      />
    </div>
  );
}
