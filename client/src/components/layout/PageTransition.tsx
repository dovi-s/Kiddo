import { motion } from "framer-motion";
import { ReactNode } from "react";
import { pageFadeScale, springGentle, easeOutExpo } from "@/lib/animations";

interface PageTransitionProps {
  children: ReactNode;
  className?: string;
}

export function PageTransition({ children, className = "" }: PageTransitionProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12, scale: 0.98 }}
      animate={{ 
        opacity: 1, 
        y: 0, 
        scale: 1,
        transition: { duration: 0.25, ease: easeOutExpo }
      }}
      exit={{ 
        opacity: 0, 
        scale: 0.98,
        transition: { duration: 0.15, ease: "easeIn" }
      }}
      className={className}
    >
      {children}
    </motion.div>
  );
}

export function SlidePageTransition({ children, className = "" }: PageTransitionProps) {
  return (
    <motion.div
      initial={{ x: "8%", opacity: 0 }}
      animate={{ 
        x: 0, 
        opacity: 1,
        transition: { ...springGentle, opacity: { duration: 0.2 } }
      }}
      exit={{ 
        x: "-4%", 
        opacity: 0.5,
        transition: { duration: 0.15, ease: easeOutExpo }
      }}
      className={className}
    >
      {children}
    </motion.div>
  );
}

export function ModalPageTransition({ children, className = "" }: PageTransitionProps) {
  return (
    <motion.div
      initial={{ y: "100%", opacity: 0.9 }}
      animate={{ 
        y: 0, 
        opacity: 1,
        transition: springGentle
      }}
      exit={{ 
        y: "100%", 
        opacity: 0.9,
        transition: { duration: 0.25, ease: easeOutExpo }
      }}
      className={className}
    >
      {children}
    </motion.div>
  );
}
