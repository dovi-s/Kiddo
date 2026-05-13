import { useReducedMotion } from "framer-motion";
import { mascotAssets, type MascotVariant } from "@/lib/brand-assets";

interface MascotProps {
  size?: "sm" | "md" | "lg" | "xl";
  className?: string;
  alt?: string;
  context?: string;
  variant?: MascotVariant;
}

const sizeMap = {
  sm: "w-16 h-auto",
  md: "w-24 h-auto",
  lg: "w-32 h-auto",
  xl: "w-44 h-auto",
};

export function Mascot({ size = "md", className = "", alt = "Kiddo mascot", context, variant = "default" }: MascotProps) {
  const reduceMotion = useReducedMotion();
  const asset = mascotAssets[variant];
  const canAnimate = Boolean(asset.animatedSrc) && !reduceMotion;

  if (canAnimate) {
    return (
      <video
        src={asset.animatedSrc!}
        poster={asset.staticSrc}
        className={`${sizeMap[size]} object-contain select-none pointer-events-none ${className}`}
        autoPlay
        loop
        muted
        playsInline
        data-testid={context ? `video-mascot-${context}` : "video-mascot"}
        aria-label={alt}
      />
    );
  }

  return (
    <img
      src={asset.staticSrc}
      alt={alt}
      className={`${sizeMap[size]} object-contain select-none pointer-events-none ${className}`}
      draggable={false}
      data-testid={context ? `img-mascot-${context}` : "img-mascot"}
    />
  );
}
