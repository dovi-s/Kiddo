import { motion } from "framer-motion";
import { cn } from "@/lib/utils";

interface ShimmerProps {
  className?: string;
  width?: string | number;
  height?: string | number;
}

export function Shimmer({ className, width, height }: ShimmerProps) {
  return (
    <div 
      className={cn(
        "relative overflow-hidden bg-stone-100 rounded-lg",
        className
      )}
      style={{ width, height }}
    >
      <motion.div
        className="absolute inset-0 bg-gradient-to-r from-transparent via-white/60 to-transparent"
        initial={{ x: "-100%" }}
        animate={{ x: "100%" }}
        transition={{
          duration: 1.5,
          repeat: Infinity,
          ease: "linear",
          repeatDelay: 0.5
        }}
      />
    </div>
  );
}

export function ShimmerCard({ className }: { className?: string }) {
  return (
    <div className={cn("bg-white rounded-xl border border-stone-200 p-4 space-y-3", className)}>
      <Shimmer className="h-4 w-3/4" />
      <Shimmer className="h-8 w-1/2" />
      <Shimmer className="h-3 w-full" />
    </div>
  );
}

export function ShimmerMetric({ className }: { className?: string }) {
  return (
    <div className={cn("space-y-2", className)}>
      <Shimmer className="h-3 w-24" />
      <Shimmer className="h-10 w-32" />
    </div>
  );
}

export function ShimmerAvatar({ size = 40 }: { size?: number }) {
  return (
    <Shimmer 
      className="rounded-full" 
      width={size} 
      height={size} 
    />
  );
}

export function ShimmerList({ items = 3, className }: { items?: number; className?: string }) {
  return (
    <div className={cn("space-y-3", className)}>
      {Array.from({ length: items }).map((_, i) => (
        <div key={i} className="flex items-center gap-3">
          <ShimmerAvatar size={36} />
          <div className="flex-1 space-y-2">
            <Shimmer className="h-4 w-3/4" />
            <Shimmer className="h-3 w-1/2" />
          </div>
        </div>
      ))}
    </div>
  );
}

interface LoadingSpinnerProps {
  size?: "sm" | "md" | "lg";
  className?: string;
}

export function LoadingSpinner({ size = "md", className }: LoadingSpinnerProps) {
  const sizeClasses = {
    sm: "w-4 h-4",
    md: "w-6 h-6",
    lg: "w-8 h-8"
  };
  
  return (
    <motion.div
      className={cn(sizeClasses[size], className)}
      animate={{ rotate: 360 }}
      transition={{
        duration: 1,
        repeat: Infinity,
        ease: "linear"
      }}
    >
      <svg viewBox="0 0 24 24" fill="none" className="w-full h-full">
        <circle 
          cx="12" 
          cy="12" 
          r="10" 
          stroke="currentColor" 
          strokeWidth="2" 
          strokeOpacity="0.2"
        />
        <path
          d="M12 2a10 10 0 0 1 10 10"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
        />
      </svg>
    </motion.div>
  );
}

interface ProcessingDotsProps {
  className?: string;
}

export function ProcessingDots({ className }: ProcessingDotsProps) {
  return (
    <div className={cn("flex items-center gap-1", className)}>
      {[0, 1, 2].map((i) => (
        <motion.div
          key={i}
          className="w-1.5 h-1.5 rounded-full bg-current"
          animate={{
            scale: [1, 1.3, 1],
            opacity: [0.5, 1, 0.5]
          }}
          transition={{
            duration: 0.8,
            repeat: Infinity,
            delay: i * 0.15
          }}
        />
      ))}
    </div>
  );
}
