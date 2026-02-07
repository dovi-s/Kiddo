import { useEffect, useState, useCallback, type ReactNode } from "react";
import { motion, AnimatePresence } from "framer-motion";

interface Particle {
  id: number;
  x: number;
  y: number;
  size: number;
  color: string;
  delay: number;
  rotation: number;
}

const CELEBRATION_COLORS = [
  "hsl(var(--kora-evergreen))",
  "hsl(var(--kora-gold))",
  "hsl(142, 71%, 45%)",
  "hsl(45, 93%, 58%)",
  "hsl(200, 80%, 60%)",
  "hsl(340, 65%, 60%)",
];

const CONFETTI_SHAPES = ["circle", "square", "star"] as const;

interface CelebrationProps {
  trigger: boolean;
  onComplete?: () => void;
  intensity?: "subtle" | "medium" | "grand";
  type?: "confetti" | "sparkle" | "burst";
}

export function Celebration({ 
  trigger, 
  onComplete, 
  intensity = "medium",
  type = "confetti" 
}: CelebrationProps) {
  const [particles, setParticles] = useState<Particle[]>([]);
  const [isActive, setIsActive] = useState(false);

  const particleCount = intensity === "subtle" ? 15 : intensity === "medium" ? 30 : 50;
  const duration = intensity === "subtle" ? 1500 : intensity === "medium" ? 2500 : 3500;

  const generateParticles = useCallback(() => {
    const newParticles: Particle[] = [];
    for (let i = 0; i < particleCount; i++) {
      newParticles.push({
        id: i,
        x: 50 + (Math.random() - 0.5) * 40,
        y: type === "burst" ? 50 : 100,
        size: Math.random() * 8 + 4,
        color: CELEBRATION_COLORS[Math.floor(Math.random() * CELEBRATION_COLORS.length)],
        delay: Math.random() * 0.3,
        rotation: Math.random() * 360,
      });
    }
    return newParticles;
  }, [particleCount, type]);

  useEffect(() => {
    if (trigger && !isActive) {
      setIsActive(true);
      setParticles(generateParticles());
      
      const timer = setTimeout(() => {
        setIsActive(false);
        setParticles([]);
        onComplete?.();
      }, duration);

      return () => clearTimeout(timer);
    }
  }, [trigger, isActive, generateParticles, duration, onComplete]);

  if (!isActive) return null;

  return (
    <div className="fixed inset-0 pointer-events-none z-[100] overflow-hidden">
      <AnimatePresence>
        {particles.map((particle) => (
          <motion.div
            key={particle.id}
            initial={{
              x: `${particle.x}vw`,
              y: type === "burst" ? `${particle.y}vh` : "110vh",
              scale: 0,
              rotate: 0,
              opacity: 1,
            }}
            animate={{
              x: type === "burst" 
                ? `${particle.x + (Math.random() - 0.5) * 60}vw`
                : `${particle.x + (Math.random() - 0.5) * 30}vw`,
              y: type === "burst"
                ? `${particle.y + (Math.random() - 0.5) * 60}vh`
                : `${-20 - Math.random() * 30}vh`,
              scale: [0, 1.2, 1, 0.8],
              rotate: particle.rotation + 360 * (Math.random() > 0.5 ? 1 : -1),
              opacity: [1, 1, 1, 0],
            }}
            transition={{
              duration: duration / 1000,
              delay: particle.delay,
              ease: [0.25, 0.46, 0.45, 0.94],
            }}
            style={{
              position: "absolute",
              width: particle.size,
              height: particle.size,
              backgroundColor: particle.color,
              borderRadius: Math.random() > 0.5 ? "50%" : "2px",
            }}
          />
        ))}
      </AnimatePresence>
    </div>
  );
}

export function SuccessGlow({ children, trigger }: { children: ReactNode; trigger: boolean }) {
  return (
    <motion.div
      className="relative"
      animate={trigger ? {
        filter: ["brightness(1)", "brightness(1.3)", "brightness(1)"],
      } : {}}
      transition={{ duration: 0.6, ease: "easeInOut" }}
    >
      {trigger && (
        <motion.div
          className="absolute inset-0 rounded-2xl bg-gradient-to-r from-[hsl(var(--kora-evergreen))] to-[hsl(var(--kora-gold))] pointer-events-none"
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ 
            opacity: [0, 0.3, 0],
            scale: [0.95, 1.05, 1],
          }}
          transition={{ duration: 0.8, ease: "easeOut" }}
          style={{ filter: "blur(20px)" }}
        />
      )}
      {children}
    </motion.div>
  );
}

export function PulseRing({ trigger, color = "hsl(var(--kora-evergreen))" }: { trigger: boolean; color?: string }) {
  return (
    <AnimatePresence>
      {trigger && (
        <>
          {[0, 1, 2].map((i) => (
            <motion.div
              key={i}
              className="absolute inset-0 rounded-full border-2"
              style={{ borderColor: color }}
              initial={{ scale: 0.8, opacity: 0.8 }}
              animate={{ scale: 2.5, opacity: 0 }}
              exit={{ opacity: 0 }}
              transition={{
                duration: 1.2,
                delay: i * 0.15,
                ease: "easeOut",
              }}
            />
          ))}
        </>
      )}
    </AnimatePresence>
  );
}

export function CountUp({ 
  value, 
  duration = 1500,
  prefix = "",
  suffix = "",
  decimals = 0,
}: { 
  value: number; 
  duration?: number;
  prefix?: string;
  suffix?: string;
  decimals?: number;
}) {
  const [displayValue, setDisplayValue] = useState(0);

  useEffect(() => {
    let startTime: number;
    let animationFrame: number;

    const animate = (currentTime: number) => {
      if (!startTime) startTime = currentTime;
      const progress = Math.min((currentTime - startTime) / duration, 1);
      
      const easeOutQuart = 1 - Math.pow(1 - progress, 4);
      setDisplayValue(value * easeOutQuart);

      if (progress < 1) {
        animationFrame = requestAnimationFrame(animate);
      }
    };

    animationFrame = requestAnimationFrame(animate);

    return () => cancelAnimationFrame(animationFrame);
  }, [value, duration]);

  return (
    <motion.span
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
    >
      {prefix}{displayValue.toFixed(decimals)}{suffix}
    </motion.span>
  );
}

export function Spotlight({ trigger, children }: { trigger: boolean; children: ReactNode }) {
  return (
    <motion.div className="relative">
      <AnimatePresence>
        {trigger && (
          <motion.div
            className="absolute -inset-4 bg-gradient-radial from-white/20 via-transparent to-transparent"
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 1.1 }}
            transition={{ duration: 0.5 }}
            style={{
              background: "radial-gradient(circle, rgba(255,255,255,0.15) 0%, transparent 70%)",
            }}
          />
        )}
      </AnimatePresence>
      {children}
    </motion.div>
  );
}
