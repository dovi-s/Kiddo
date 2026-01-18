import { useEffect, useRef, useState } from "react";
import { motion, useSpring, useTransform, MotionValue } from "framer-motion";

interface AnimatedValueProps {
  value: number;
  prefix?: string;
  suffix?: string;
  className?: string;
  duration?: number;
}

export function AnimatedValue({ 
  value, 
  prefix = "$", 
  suffix = "",
  className = "",
  duration = 800
}: AnimatedValueProps) {
  const spring = useSpring(0, { 
    stiffness: 50, 
    damping: 20,
    mass: 0.5 
  });
  
  const display = useTransform(spring, (v) => 
    `${prefix}${Math.round(v).toLocaleString()}${suffix}`
  );
  
  const [hasAnimated, setHasAnimated] = useState(false);
  
  useEffect(() => {
    const timer = setTimeout(() => {
      spring.set(value);
      setHasAnimated(true);
    }, hasAnimated ? 0 : 100);
    return () => clearTimeout(timer);
  }, [value, spring, hasAnimated]);
  
  return (
    <motion.span 
      className={className}
      initial={{ opacity: 0, y: 12, scale: 0.95 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ 
        type: "spring",
        stiffness: 100,
        damping: 15,
        delay: 0.1
      }}
    >
      <motion.span>{display}</motion.span>
    </motion.span>
  );
}

export function AnimatedPercentage({ 
  value, 
  className = "" 
}: { 
  value: number; 
  className?: string;
}) {
  const spring = useSpring(0, { stiffness: 60, damping: 20 });
  const display = useTransform(spring, (v) => `${v.toFixed(1)}%`);
  
  useEffect(() => {
    spring.set(value);
  }, [value, spring]);
  
  return <motion.span className={className}>{display}</motion.span>;
}
