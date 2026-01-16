import { motion, useAnimation } from "framer-motion";
import { ReactNode } from "react";
import { springSnappy, easeOutExpo } from "@/lib/animations";

interface TactileCardProps {
  children: ReactNode;
  className?: string;
  onClick?: () => void;
  "data-testid"?: string;
}

export function TactileCard({ 
  children, 
  className = "", 
  onClick,
  "data-testid": testId 
}: TactileCardProps) {
  return (
    <motion.div
      onClick={onClick}
      whileHover={{ 
        y: -4, 
        boxShadow: "0 16px 40px -12px rgba(0,0,0,0.15)",
        transition: { duration: 0.2, ease: easeOutExpo }
      }}
      whileTap={{ 
        scale: 0.98, 
        y: 1,
        boxShadow: "0 2px 8px -4px rgba(0,0,0,0.1)",
        transition: { duration: 0.1, ease: "easeOut" }
      }}
      className={`bg-card border border-border rounded-2xl cursor-pointer transition-colors ${className}`}
      data-testid={testId}
      style={{ willChange: "transform" }}
    >
      {children}
    </motion.div>
  );
}

export function TactileButton({ 
  children, 
  className = "", 
  onClick,
  disabled,
  variant = "primary",
  "data-testid": testId 
}: TactileCardProps & { disabled?: boolean; variant?: "primary" | "secondary" | "ghost" }) {
  const baseStyles = "font-semibold transition-colors touch-target";
  const variants = {
    primary: "bg-primary text-primary-foreground",
    secondary: "bg-secondary text-secondary-foreground",
    ghost: "bg-transparent text-foreground hover:bg-muted"
  };

  return (
    <motion.button
      onClick={onClick}
      disabled={disabled}
      whileHover={!disabled ? { 
        scale: 1.02,
        transition: { duration: 0.15, ease: easeOutExpo }
      } : undefined}
      whileTap={!disabled ? { 
        scale: 0.96,
        transition: { duration: 0.08, ease: "easeOut" }
      } : undefined}
      className={`${baseStyles} ${variants[variant]} ${disabled ? "opacity-50 cursor-not-allowed" : ""} ${className}`}
      data-testid={testId}
    >
      {children}
    </motion.button>
  );
}

export function PulseOnMount({ children, className = "", delay = 0 }: { children: ReactNode; className?: string; delay?: number }) {
  return (
    <motion.div
      initial={{ scale: 0.9, opacity: 0 }}
      animate={{ 
        scale: [0.9, 1.05, 1], 
        opacity: 1,
        transition: { 
          delay,
          duration: 0.5, 
          ease: [0.34, 1.56, 0.64, 1]
        }
      }}
      className={className}
    >
      {children}
    </motion.div>
  );
}

export function StaggeredList({ children, className = "" }: { children: ReactNode; className?: string }) {
  return (
    <motion.div
      initial="hidden"
      animate="visible"
      variants={{
        hidden: { opacity: 0 },
        visible: {
          opacity: 1,
          transition: { staggerChildren: 0.05, delayChildren: 0.02 }
        }
      }}
      className={className}
    >
      {children}
    </motion.div>
  );
}

export function StaggeredItem({ children, className = "" }: { children: ReactNode; className?: string }) {
  return (
    <motion.div
      variants={{
        hidden: { opacity: 0, y: 12, scale: 0.98 },
        visible: { 
          opacity: 1, 
          y: 0, 
          scale: 1,
          transition: { duration: 0.2, ease: easeOutExpo }
        }
      }}
      className={className}
    >
      {children}
    </motion.div>
  );
}
