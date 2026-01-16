import { motion } from "framer-motion";
import { cn } from "@/lib/utils";

interface SkeletonShimmerProps {
  className?: string;
  lines?: number;
  variant?: "text" | "circle" | "card" | "button";
}

export function SkeletonShimmer({ 
  className, 
  lines = 1, 
  variant = "text" 
}: SkeletonShimmerProps) {
  const baseClasses = "relative overflow-hidden bg-muted rounded";
  
  const variantClasses = {
    text: "h-4 w-full",
    circle: "h-12 w-12 rounded-full",
    card: "h-24 w-full rounded-xl",
    button: "h-10 w-28 rounded-lg",
  };

  const shimmerVariants = {
    initial: { x: "-100%" },
    animate: {
      x: "200%",
      transition: {
        duration: 1.5,
        repeat: Infinity,
        ease: "linear" as const,
        repeatDelay: 0.2
      }
    }
  };

  if (lines > 1) {
    return (
      <div className={cn("space-y-3", className)}>
        {Array.from({ length: lines }).map((_, i) => (
          <div 
            key={i} 
            className={cn(baseClasses, variantClasses[variant])}
            style={{ width: i === lines - 1 ? "60%" : "100%" }}
          >
            <motion.div
              className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent"
              variants={shimmerVariants}
              initial="initial"
              animate="animate"
              style={{ width: "50%" }}
            />
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className={cn(baseClasses, variantClasses[variant], className)}>
      <motion.div
        className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent"
        variants={shimmerVariants}
        initial="initial"
        animate="animate"
        style={{ width: "50%" }}
      />
    </div>
  );
}

export function CardSkeleton({ className }: { className?: string }) {
  return (
    <div className={cn("bg-card border border-border rounded-xl p-4", className)}>
      <div className="flex items-center gap-3">
        <SkeletonShimmer variant="circle" />
        <div className="flex-1 space-y-2">
          <SkeletonShimmer className="w-24" />
          <SkeletonShimmer className="w-16" />
        </div>
        <div className="text-right space-y-2">
          <SkeletonShimmer className="w-12 ml-auto" />
          <SkeletonShimmer className="w-8 ml-auto" />
        </div>
      </div>
    </div>
  );
}

export function ListSkeleton({ count = 3 }: { count?: number }) {
  return (
    <motion.div 
      className="space-y-3"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.2 }}
    >
      {Array.from({ length: count }).map((_, i) => (
        <CardSkeleton key={i} />
      ))}
    </motion.div>
  );
}

export function HeroSkeleton() {
  return (
    <div className="bg-muted rounded-2xl p-6 sm:p-8">
      <div className="flex items-center gap-4">
        <SkeletonShimmer variant="circle" className="w-16 h-16 sm:w-20 sm:h-20" />
        <div className="flex-1 space-y-2">
          <SkeletonShimmer className="w-32 h-6" />
          <SkeletonShimmer className="w-48 h-4" />
        </div>
      </div>
      <div className="mt-6 pt-6 border-t border-border/50">
        <div className="flex gap-8">
          <div className="space-y-2">
            <SkeletonShimmer className="w-20 h-8" />
            <SkeletonShimmer className="w-12 h-3" />
          </div>
          <div className="space-y-2">
            <SkeletonShimmer className="w-20 h-8" />
            <SkeletonShimmer className="w-12 h-3" />
          </div>
        </div>
      </div>
    </div>
  );
}
