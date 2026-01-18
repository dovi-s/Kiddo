import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import { ReactNode, useEffect, useState } from "react";
import { useLocation } from "wouter";

interface PageTransitionProps {
  children: ReactNode;
  className?: string;
}

const premiumEase = [0.16, 1, 0.3, 1] as const;
const premiumSpring = { type: "spring" as const, stiffness: 350, damping: 35 };

export function PageTransition({ children, className = "" }: PageTransitionProps) {
  const shouldReduceMotion = useReducedMotion();
  const [location] = useLocation();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (shouldReduceMotion) {
    return <div className={className}>{children}</div>;
  }

  return (
    <motion.div
      key={location}
      initial={mounted ? { opacity: 0, y: 20, scale: 0.97, filter: "blur(4px)" } : false}
      animate={{ 
        opacity: 1, 
        y: 0, 
        scale: 1,
        filter: "blur(0px)",
        transition: { 
          duration: 0.35,
          ease: premiumEase,
          opacity: { duration: 0.25 },
          filter: { duration: 0.25 }
        }
      }}
      exit={{ 
        opacity: 0,
        y: -8,
        scale: 0.99,
        filter: "blur(2px)",
        transition: { 
          duration: 0.2, 
          ease: [0.4, 0, 1, 1]
        }
      }}
      className={className}
    >
      {children}
    </motion.div>
  );
}

export function SlidePageTransition({ children, className = "" }: PageTransitionProps) {
  const shouldReduceMotion = useReducedMotion();
  const [location] = useLocation();

  if (shouldReduceMotion) {
    return <div className={className}>{children}</div>;
  }

  return (
    <motion.div
      key={location}
      initial={{ x: "6%", opacity: 0, scale: 0.98 }}
      animate={{ 
        x: 0, 
        opacity: 1,
        scale: 1,
        transition: { 
          ...premiumSpring,
          opacity: { duration: 0.2 },
          scale: { duration: 0.25 }
        }
      }}
      exit={{ 
        x: "-4%", 
        opacity: 0,
        scale: 0.99,
        transition: { 
          duration: 0.18, 
          ease: premiumEase 
        }
      }}
      className={className}
    >
      {children}
    </motion.div>
  );
}

export function ModalPageTransition({ children, className = "" }: PageTransitionProps) {
  const shouldReduceMotion = useReducedMotion();

  if (shouldReduceMotion) {
    return <div className={className}>{children}</div>;
  }

  return (
    <motion.div
      initial={{ y: "100%", opacity: 0.9, borderRadius: "24px 24px 0 0" }}
      animate={{ 
        y: 0, 
        opacity: 1,
        borderRadius: "0px",
        transition: premiumSpring
      }}
      exit={{ 
        y: "100%", 
        opacity: 0.9,
        transition: { 
          duration: 0.3, 
          ease: premiumEase 
        }
      }}
      className={className}
    >
      {children}
    </motion.div>
  );
}

export function FadePageTransition({ children, className = "" }: PageTransitionProps) {
  const shouldReduceMotion = useReducedMotion();
  const [location] = useLocation();

  if (shouldReduceMotion) {
    return <div className={className}>{children}</div>;
  }

  return (
    <motion.div
      key={location}
      initial={{ opacity: 0 }}
      animate={{ 
        opacity: 1,
        transition: { duration: 0.3, ease: "easeOut" }
      }}
      exit={{ 
        opacity: 0,
        transition: { duration: 0.15, ease: "easeIn" }
      }}
      className={className}
    >
      {children}
    </motion.div>
  );
}

export function ScalePageTransition({ children, className = "" }: PageTransitionProps) {
  const shouldReduceMotion = useReducedMotion();
  const [location] = useLocation();

  if (shouldReduceMotion) {
    return <div className={className}>{children}</div>;
  }

  return (
    <motion.div
      key={location}
      initial={{ opacity: 0, scale: 0.92, y: 30 }}
      animate={{ 
        opacity: 1, 
        scale: 1,
        y: 0,
        transition: {
          type: "spring",
          stiffness: 280,
          damping: 28,
          mass: 0.8,
          opacity: { duration: 0.22 }
        }
      }}
      exit={{ 
        opacity: 0,
        scale: 0.96,
        transition: { duration: 0.15, ease: "easeIn" }
      }}
      className={className}
    >
      {children}
    </motion.div>
  );
}
