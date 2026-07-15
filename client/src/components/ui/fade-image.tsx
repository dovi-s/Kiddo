import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";

// A drop-in <img> that FADES IN on load instead of popping — the premium
// image-landing detail (a photo snapping in reads as "website"). Same hardened
// pattern proven on StockLogo: onLoad drives the fade, and a mount-time
// `complete` check covers CACHED images (which can be complete before React
// binds onLoad, otherwise leaving the image stuck invisible at opacity 0).
//
// Usage: replace `<img ... />` with `<FadeImage ... />`. All the usual <img>
// props (src, alt, className, loading, style, onLoad, …) pass straight through.
export function FadeImage({
  className,
  style,
  onLoad,
  ...props
}: React.ImgHTMLAttributes<HTMLImageElement>) {
  const [loaded, setLoaded] = useState(false);
  const ref = useRef<HTMLImageElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (el && el.complete && el.naturalWidth > 0) setLoaded(true);
    else setLoaded(false);
  }, [props.src]);

  return (
    <img
      ref={ref}
      decoding="async"
      className={cn("transition-opacity duration-300 ease-out", className)}
      style={{ opacity: loaded ? 1 : 0, ...style }}
      onLoad={(e) => {
        setLoaded(true);
        onLoad?.(e);
      }}
      {...props}
    />
  );
}
