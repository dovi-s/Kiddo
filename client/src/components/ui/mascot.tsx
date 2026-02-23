import mascotImg from "../../assets/kora-mascot.png";

interface MascotProps {
  size?: "sm" | "md" | "lg" | "xl";
  className?: string;
  alt?: string;
  context?: string;
}

const sizeMap = {
  sm: "w-16 h-auto",
  md: "w-24 h-auto",
  lg: "w-32 h-auto",
  xl: "w-44 h-auto",
};

export function Mascot({ size = "md", className = "", alt = "Kora mascot", context }: MascotProps) {
  return (
    <img
      src={mascotImg}
      alt={alt}
      className={`${sizeMap[size]} object-contain select-none pointer-events-none ${className}`}
      draggable={false}
      data-testid={context ? `img-mascot-${context}` : "img-mascot"}
    />
  );
}
