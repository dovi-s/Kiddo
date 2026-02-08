import { motion, AnimatePresence, type Variants } from "framer-motion";
import { type ReactNode, useMemo, useState, useCallback, useEffect } from "react";

const GEMINI_COLORS = {
  evergreen: "hsl(152, 45%, 18%)",
  evergreenLight: "hsl(152, 35%, 28%)",
  gold: "hsl(36, 72%, 52%)",
  goldLight: "hsl(40, 65%, 70%)",
  teal: "hsl(180, 30%, 40%)",
  sky: "hsl(200, 60%, 55%)",
  cream: "hsl(40, 30%, 97%)",
};

export function GeminiSparkle({
  size = 20,
  color = GEMINI_COLORS.gold,
  delay = 0,
  className = "",
}: {
  size?: number;
  color?: string;
  delay?: number;
  className?: string;
}) {
  return (
    <motion.svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      className={className}
      initial={{ scale: 0, rotate: -30, opacity: 0 }}
      animate={{
        scale: [0, 1.2, 1, 1.1, 1],
        rotate: [-30, 10, 0, 5, 0],
        opacity: [0, 1, 0.8, 1, 0.9],
      }}
      transition={{
        duration: 0.8,
        delay,
        ease: [0.16, 1, 0.3, 1],
      }}
    >
      <motion.path
        d="M12 2L13.5 8.5L20 10L13.5 11.5L12 18L10.5 11.5L4 10L10.5 8.5L12 2Z"
        fill={color}
        animate={{
          opacity: [0.7, 1, 0.7],
          scale: [0.95, 1.05, 0.95],
        }}
        transition={{
          duration: 2.5,
          repeat: Infinity,
          ease: "easeInOut",
          delay: delay + 0.8,
        }}
      />
      <motion.path
        d="M19 15L19.75 17.25L22 18L19.75 18.75L19 21L18.25 18.75L16 18L18.25 17.25L19 15Z"
        fill={color}
        animate={{
          opacity: [0.5, 1, 0.5],
          scale: [0.9, 1.1, 0.9],
        }}
        transition={{
          duration: 2,
          repeat: Infinity,
          ease: "easeInOut",
          delay: delay + 1.2,
        }}
      />
    </motion.svg>
  );
}

export function SparkleCluster({
  count = 3,
  spread = 40,
  className = "",
}: {
  count?: number;
  spread?: number;
  className?: string;
}) {
  const sparkles = useMemo(() => {
    return Array.from({ length: count }, (_, i) => ({
      id: i,
      x: (Math.random() - 0.5) * spread,
      y: (Math.random() - 0.5) * spread,
      size: 10 + Math.random() * 14,
      delay: i * 0.15,
      color: i % 2 === 0 ? GEMINI_COLORS.gold : GEMINI_COLORS.evergreen,
    }));
  }, [count, spread]);

  return (
    <div className={`relative pointer-events-none ${className}`}>
      {sparkles.map((s) => (
        <div
          key={s.id}
          className="absolute"
          style={{ left: `calc(50% + ${s.x}px)`, top: `calc(50% + ${s.y}px)` }}
        >
          <GeminiSparkle size={s.size} color={s.color} delay={s.delay} />
        </div>
      ))}
    </div>
  );
}

export function SparkleBurst({
  active = false,
  onComplete,
  className = "",
}: {
  active?: boolean;
  onComplete?: () => void;
  className?: string;
}) {
  const particles = useMemo(() => {
    return Array.from({ length: 12 }, (_, i) => {
      const angle = (i / 12) * Math.PI * 2;
      const distance = 30 + Math.random() * 50;
      return {
        id: i,
        x: Math.cos(angle) * distance,
        y: Math.sin(angle) * distance,
        size: 6 + Math.random() * 10,
        delay: Math.random() * 0.15,
        color: [GEMINI_COLORS.gold, GEMINI_COLORS.evergreen, GEMINI_COLORS.teal, GEMINI_COLORS.goldLight][i % 4],
      };
    });
  }, []);

  return (
    <AnimatePresence onExitComplete={onComplete}>
      {active && (
        <div className={`absolute inset-0 pointer-events-none flex items-center justify-center ${className}`}>
          {particles.map((p) => (
            <motion.div
              key={p.id}
              className="absolute"
              initial={{ x: 0, y: 0, scale: 0, opacity: 1 }}
              animate={{
                x: p.x,
                y: p.y,
                scale: [0, 1.5, 0.8],
                opacity: [1, 1, 0],
              }}
              exit={{ opacity: 0, scale: 0 }}
              transition={{
                duration: 0.7,
                delay: p.delay,
                ease: [0.16, 1, 0.3, 1],
              }}
            >
              <svg width={p.size} height={p.size} viewBox="0 0 24 24" fill="none">
                <path
                  d="M12 2L13.5 8.5L20 10L13.5 11.5L12 18L10.5 11.5L4 10L10.5 8.5L12 2Z"
                  fill={p.color}
                />
              </svg>
            </motion.div>
          ))}
          <motion.div
            className="absolute rounded-full"
            style={{
              width: 80,
              height: 80,
              background: `radial-gradient(circle, ${GEMINI_COLORS.gold}40, transparent 70%)`,
              filter: "blur(10px)",
            }}
            initial={{ scale: 0, opacity: 0 }}
            animate={{ scale: [0, 2, 2.5], opacity: [0, 0.6, 0] }}
            transition={{ duration: 0.6, ease: "easeOut" }}
          />
        </div>
      )}
    </AnimatePresence>
  );
}

export function SpectrumWave({
  width = 200,
  height = 40,
  active = true,
  className = "",
}: {
  width?: number;
  height?: number;
  active?: boolean;
  className?: string;
}) {
  const bars = 5;
  return (
    <div className={`flex items-center justify-center gap-1 ${className}`} style={{ width, height }}>
      {Array.from({ length: bars }, (_, i) => (
        <motion.div
          key={i}
          className="rounded-full"
          style={{
            width: Math.max(3, width / (bars * 3)),
            background: `linear-gradient(to top, ${GEMINI_COLORS.evergreen}, ${
              i % 2 === 0 ? GEMINI_COLORS.gold : GEMINI_COLORS.teal
            })`,
          }}
          animate={active ? {
            height: [
              height * 0.2,
              height * (0.4 + Math.random() * 0.5),
              height * 0.15,
              height * (0.5 + Math.random() * 0.4),
              height * 0.2,
            ],
            opacity: [0.6, 1, 0.5, 1, 0.6],
          } : {
            height: height * 0.15,
            opacity: 0.3,
          }}
          transition={{
            duration: 1.5 + i * 0.2,
            repeat: Infinity,
            ease: "easeInOut",
            delay: i * 0.12,
          }}
        />
      ))}
    </div>
  );
}

export function GeminiGradient({
  variant = "ambient",
  intensity = 0.15,
  className = "",
  children,
}: {
  variant?: "ambient" | "energy" | "thinking" | "success" | "hero";
  intensity?: number;
  className?: string;
  children?: ReactNode;
}) {
  const gradientConfig = useMemo(() => {
    switch (variant) {
      case "energy":
        return {
          colors: [GEMINI_COLORS.evergreen, GEMINI_COLORS.gold, GEMINI_COLORS.teal],
          duration: 4,
          blur: 80,
          size: "50%",
        };
      case "thinking":
        return {
          colors: [GEMINI_COLORS.evergreen, GEMINI_COLORS.sky, GEMINI_COLORS.evergreenLight],
          duration: 2.5,
          blur: 60,
          size: "45%",
        };
      case "success":
        return {
          colors: [GEMINI_COLORS.evergreen, GEMINI_COLORS.gold, GEMINI_COLORS.evergreen],
          duration: 3,
          blur: 70,
          size: "50%",
        };
      case "hero":
        return {
          colors: [GEMINI_COLORS.evergreen, GEMINI_COLORS.gold, GEMINI_COLORS.teal, GEMINI_COLORS.evergreenLight],
          duration: 6,
          blur: 100,
          size: "55%",
        };
      default:
        return {
          colors: [GEMINI_COLORS.evergreen, GEMINI_COLORS.evergreenLight, GEMINI_COLORS.gold],
          duration: 6,
          blur: 90,
          size: "50%",
        };
    }
  }, [variant]);

  return (
    <div className={`relative overflow-hidden ${className}`}>
      <div className="absolute inset-0 pointer-events-none">
        {gradientConfig.colors.map((color, i) => (
          <motion.div
            key={i}
            className="absolute rounded-full"
            style={{
              background: `radial-gradient(circle, ${color} 0%, transparent 70%)`,
              opacity: intensity,
              filter: `blur(${gradientConfig.blur}px)`,
              width: gradientConfig.size,
              height: gradientConfig.size,
            }}
            animate={{
              x: [
                `${20 + i * 15}%`,
                `${50 - i * 10}%`,
                `${30 + i * 20}%`,
                `${20 + i * 15}%`,
              ],
              y: [
                `${10 + i * 20}%`,
                `${40 - i * 10}%`,
                `${20 + i * 15}%`,
                `${10 + i * 20}%`,
              ],
              scale: [1, 1.15, 0.9, 1],
            }}
            transition={{
              duration: gradientConfig.duration + i * 1.5,
              repeat: Infinity,
              ease: "easeInOut",
            }}
          />
        ))}
      </div>
      {children && <div className="relative z-10">{children}</div>}
    </div>
  );
}

export function GeminiHeroGradient({ className = "" }: { className?: string }) {
  return (
    <div className={`absolute inset-0 overflow-hidden pointer-events-none ${className}`}>
      <motion.div
        className="absolute rounded-full"
        style={{
          width: "700px",
          height: "700px",
          background: `radial-gradient(circle, ${GEMINI_COLORS.evergreen} 0%, transparent 60%)`,
          opacity: 0.1,
          filter: "blur(100px)",
          left: "-10%",
          top: "-25%",
        }}
        animate={{
          x: ["0%", "12%", "3%", "0%"],
          y: ["0%", "8%", "-3%", "0%"],
          scale: [1, 1.1, 0.97, 1],
        }}
        transition={{ duration: 15, repeat: Infinity, ease: "easeInOut" }}
      />
      <motion.div
        className="absolute rounded-full"
        style={{
          width: "550px",
          height: "550px",
          background: `radial-gradient(circle, ${GEMINI_COLORS.gold} 0%, transparent 60%)`,
          opacity: 0.08,
          filter: "blur(90px)",
          right: "-8%",
          top: "5%",
        }}
        animate={{
          x: ["0%", "-15%", "-3%", "0%"],
          y: ["0%", "12%", "-6%", "0%"],
          scale: [1, 0.92, 1.08, 1],
        }}
        transition={{ duration: 18, repeat: Infinity, ease: "easeInOut" }}
      />
      <motion.div
        className="absolute rounded-full"
        style={{
          width: "450px",
          height: "450px",
          background: `radial-gradient(circle, ${GEMINI_COLORS.teal} 0%, transparent 60%)`,
          opacity: 0.06,
          filter: "blur(80px)",
          left: "25%",
          bottom: "-15%",
        }}
        animate={{
          x: ["0%", "8%", "-10%", "0%"],
          y: ["0%", "-12%", "4%", "0%"],
          scale: [0.95, 1.08, 1, 0.95],
        }}
        transition={{ duration: 13, repeat: Infinity, ease: "easeInOut" }}
      />
    </div>
  );
}

export function GeminiBalanceGlow({ className = "" }: { className?: string }) {
  return (
    <div className={`absolute inset-0 overflow-hidden pointer-events-none ${className}`}>
      <motion.div
        className="absolute rounded-full"
        style={{
          width: "300px",
          height: "300px",
          background: `radial-gradient(circle, ${GEMINI_COLORS.evergreen} 0%, transparent 70%)`,
          opacity: 0.08,
          filter: "blur(60px)",
          left: "-20%",
          top: "-30%",
        }}
        animate={{
          x: ["0%", "30%", "0%"],
          y: ["0%", "20%", "0%"],
          opacity: [0.05, 0.1, 0.05],
        }}
        transition={{ duration: 10, repeat: Infinity, ease: "easeInOut" }}
      />
      <motion.div
        className="absolute rounded-full"
        style={{
          width: "250px",
          height: "250px",
          background: `radial-gradient(circle, ${GEMINI_COLORS.gold} 0%, transparent 70%)`,
          opacity: 0.06,
          filter: "blur(55px)",
          right: "-15%",
          bottom: "-20%",
        }}
        animate={{
          x: ["0%", "-25%", "0%"],
          y: ["0%", "-15%", "0%"],
          opacity: [0.04, 0.09, 0.04],
        }}
        transition={{ duration: 12, repeat: Infinity, ease: "easeInOut" }}
      />
    </div>
  );
}

export function ThinkingOrb({
  size = 48,
  active = true,
  variant = "default",
}: {
  size?: number;
  active?: boolean;
  variant?: "default" | "processing" | "success";
}) {
  const colors = useMemo(() => {
    switch (variant) {
      case "processing":
        return { from: GEMINI_COLORS.sky, via: GEMINI_COLORS.evergreen, to: GEMINI_COLORS.teal };
      case "success":
        return { from: GEMINI_COLORS.evergreen, via: GEMINI_COLORS.gold, to: GEMINI_COLORS.evergreen };
      default:
        return { from: GEMINI_COLORS.evergreen, via: GEMINI_COLORS.evergreenLight, to: GEMINI_COLORS.teal };
    }
  }, [variant]);

  return (
    <div className="relative" style={{ width: size, height: size }}>
      {active && (
        <motion.div
          className="absolute rounded-full"
          style={{
            inset: -size * 0.15,
            background: `conic-gradient(from 0deg, ${colors.from}, ${colors.via}, ${colors.to}, ${colors.from})`,
            filter: `blur(${size * 0.2}px)`,
          }}
          animate={{
            rotate: [0, 360],
            opacity: [0.2, 0.4, 0.2],
          }}
          transition={{
            rotate: { duration: 4, repeat: Infinity, ease: "linear" },
            opacity: { duration: 3, repeat: Infinity, ease: "easeInOut" },
          }}
        />
      )}
      <motion.div
        className="absolute inset-0 rounded-full"
        style={{
          background: `conic-gradient(from 0deg, ${colors.from}, ${colors.via}, ${colors.to}, ${colors.from})`,
        }}
        animate={active ? {
          rotate: [0, 360],
          scale: [1, 1.04, 1],
        } : {}}
        transition={{
          rotate: { duration: 3, repeat: Infinity, ease: "linear" },
          scale: { duration: 2.5, repeat: Infinity, ease: "easeInOut" },
        }}
      />
      <motion.div
        className="absolute rounded-full bg-background"
        style={{ inset: size * 0.15 }}
        animate={active ? { scale: [1, 0.96, 1] } : {}}
        transition={{ duration: 2.5, repeat: Infinity, ease: "easeInOut" }}
      />
    </div>
  );
}

export function EnergyRing({
  size = 64,
  thickness = 3,
  active = true,
  children,
}: {
  size?: number;
  thickness?: number;
  active?: boolean;
  children?: ReactNode;
}) {
  return (
    <div className="relative inline-flex items-center justify-center" style={{ width: size, height: size }}>
      <motion.div
        className="absolute inset-0 rounded-full"
        style={{
          background: `conic-gradient(from 0deg, ${GEMINI_COLORS.evergreen}, ${GEMINI_COLORS.gold}, ${GEMINI_COLORS.teal}, ${GEMINI_COLORS.evergreen})`,
          padding: thickness,
          WebkitMask: `radial-gradient(farthest-side, transparent calc(100% - ${thickness}px), black calc(100% - ${thickness}px + 1px))`,
          mask: `radial-gradient(farthest-side, transparent calc(100% - ${thickness}px), black calc(100% - ${thickness}px + 1px))`,
        }}
        animate={active ? { rotate: [0, 360] } : {}}
        transition={{ duration: 5, repeat: Infinity, ease: "linear" }}
      />
      {active && (
        <motion.div
          className="absolute inset-0 rounded-full"
          style={{
            background: `conic-gradient(from 0deg, ${GEMINI_COLORS.evergreen}, ${GEMINI_COLORS.gold}, ${GEMINI_COLORS.teal}, ${GEMINI_COLORS.evergreen})`,
            filter: "blur(8px)",
            opacity: 0.25,
          }}
          animate={{ rotate: [0, 360] }}
          transition={{ duration: 5, repeat: Infinity, ease: "linear" }}
        />
      )}
      {children && <div className="relative z-10">{children}</div>}
    </div>
  );
}

export function EtherealCard({
  children,
  glowOnHover = true,
  className = "",
  onClick,
}: {
  children: ReactNode;
  glowOnHover?: boolean;
  className?: string;
  onClick?: () => void;
}) {
  return (
    <motion.div
      className={`relative rounded-2xl overflow-hidden gemini-ethereal-card ${className}`}
      initial="rest"
      whileHover={glowOnHover ? "hover" : undefined}
      whileTap="pressed"
      onClick={onClick}
      variants={{
        rest: {
          scale: 1,
          boxShadow: "0 1px 4px rgba(0,0,0,0.04), 0 0 0 1px rgba(0,0,0,0.03)",
        },
        hover: {
          scale: 1.005,
          y: -2,
          boxShadow: "0 12px 40px -10px rgba(27,67,50,0.12), 0 0 0 1px rgba(27,67,50,0.06)",
          transition: { duration: 0.35, ease: [0.16, 1, 0.3, 1] },
        },
        pressed: {
          scale: 0.985,
          y: 0,
          boxShadow: "0 1px 2px rgba(0,0,0,0.05), 0 0 0 1px rgba(0,0,0,0.03)",
          transition: { duration: 0.1 },
        },
      }}
    >
      {glowOnHover && (
        <motion.div
          className="absolute inset-0 pointer-events-none rounded-2xl"
          style={{
            background: `radial-gradient(ellipse at 30% 20%, ${GEMINI_COLORS.evergreen}12, transparent 60%),
                         radial-gradient(ellipse at 70% 80%, ${GEMINI_COLORS.gold}08, transparent 60%)`,
            filter: "blur(1px)",
          }}
          variants={{
            rest: { opacity: 0 },
            hover: { opacity: 1, transition: { duration: 0.4, ease: "easeOut" } },
          }}
        />
      )}
      <div className="relative z-10">{children}</div>
    </motion.div>
  );
}

export function GeminiCard({
  children,
  glowOnHover = true,
  className = "",
}: {
  children: ReactNode;
  glowOnHover?: boolean;
  className?: string;
}) {
  return (
    <EtherealCard glowOnHover={glowOnHover} className={className}>
      {children}
    </EtherealCard>
  );
}

export function GeminiButton({
  children,
  variant = "primary",
  className = "",
  onClick,
  disabled = false,
  "data-testid": testId,
}: {
  children: ReactNode;
  variant?: "primary" | "secondary" | "ghost";
  className?: string;
  onClick?: () => void;
  disabled?: boolean;
  "data-testid"?: string;
}) {
  const bgClass = variant === "primary"
    ? "gemini-btn-primary"
    : variant === "secondary"
    ? "bg-secondary text-secondary-foreground"
    : "bg-transparent text-foreground";

  return (
    <motion.button
      className={`relative overflow-hidden rounded-2xl px-6 py-3 font-semibold text-sm ${bgClass} ${className}`}
      whileHover={{ scale: disabled ? 1 : 1.01 }}
      whileTap={{ scale: disabled ? 1 : 0.97 }}
      transition={{ duration: 0.15, ease: [0.16, 1, 0.3, 1] }}
      onClick={onClick}
      disabled={disabled}
      data-testid={testId}
    >
      {variant === "primary" && (
        <motion.div
          className="absolute inset-0 pointer-events-none"
          style={{
            background: `linear-gradient(90deg, transparent, rgba(255,255,255,0.12), transparent)`,
          }}
          animate={{ x: ["-100%", "200%"] }}
          transition={{
            duration: 3,
            repeat: Infinity,
            repeatDelay: 2,
            ease: "easeInOut",
          }}
        />
      )}
      <span className="relative z-10">{children}</span>
    </motion.button>
  );
}

export function BreathingGlow({
  children,
  color = GEMINI_COLORS.evergreen,
  intensity = 0.15,
  active = true,
}: {
  children: ReactNode;
  color?: string;
  intensity?: number;
  active?: boolean;
}) {
  return (
    <div className="relative">
      {active && (
        <motion.div
          className="absolute -inset-2 rounded-2xl pointer-events-none"
          style={{
            background: `radial-gradient(ellipse at center, ${color}, transparent 70%)`,
            filter: "blur(16px)",
          }}
          animate={{
            opacity: [intensity * 0.4, intensity, intensity * 0.4],
            scale: [0.97, 1.03, 0.97],
          }}
          transition={{
            duration: 4,
            repeat: Infinity,
            ease: "easeInOut",
          }}
        />
      )}
      <div className="relative">{children}</div>
    </div>
  );
}

export function GradientText({
  children,
  className = "",
  animate: shouldAnimate = true,
}: {
  children: ReactNode;
  className?: string;
  animate?: boolean;
}) {
  return (
    <motion.span
      className={`bg-clip-text text-transparent gemini-text-gradient ${className}`}
      style={{
        backgroundSize: shouldAnimate ? "200% 100%" : "100% 100%",
      }}
      animate={shouldAnimate ? {
        backgroundPosition: ["0% 50%", "100% 50%", "0% 50%"],
      } : {}}
      transition={{
        duration: 6,
        repeat: Infinity,
        ease: "easeInOut",
      }}
    >
      {children}
    </motion.span>
  );
}

export function ProcessingState({
  message = "Processing...",
  submessage,
}: {
  message?: string;
  submessage?: string;
}) {
  return (
    <motion.div
      className="flex flex-col items-center gap-5 py-8"
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
    >
      <div className="relative">
        <ThinkingOrb size={56} variant="processing" />
        <SparkleCluster count={3} spread={60} className="absolute inset-0" />
      </div>
      <div className="text-center space-y-1.5">
        <motion.p
          className="text-base font-medium text-foreground"
          animate={{ opacity: [0.7, 1, 0.7] }}
          transition={{ duration: 2.5, repeat: Infinity, ease: "easeInOut" }}
        >
          {message}
        </motion.p>
        {submessage && (
          <p className="text-sm text-muted-foreground">{submessage}</p>
        )}
      </div>
      <SpectrumWave width={120} height={20} />
    </motion.div>
  );
}

export function SuccessState({
  message = "Complete!",
  submessage,
  showSparkles = true,
}: {
  message?: string;
  submessage?: string;
  showSparkles?: boolean;
}) {
  return (
    <motion.div
      className="flex flex-col items-center gap-5 py-8"
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
    >
      <div className="relative">
        <motion.div
          className="w-16 h-16 rounded-full flex items-center justify-center"
          style={{
            background: `linear-gradient(135deg, ${GEMINI_COLORS.evergreen}, ${GEMINI_COLORS.teal})`,
          }}
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ type: "spring", stiffness: 300, damping: 20, delay: 0.1 }}
        >
          <motion.svg
            width="28"
            height="28"
            viewBox="0 0 24 24"
            fill="none"
            stroke="white"
            strokeWidth="3"
            strokeLinecap="round"
            strokeLinejoin="round"
            initial={{ pathLength: 0 }}
            animate={{ pathLength: 1 }}
            transition={{ duration: 0.4, delay: 0.3, ease: "easeOut" }}
          >
            <motion.path d="M5 12l5 5L19 7" />
          </motion.svg>
        </motion.div>
        {showSparkles && <SparkleBurst active={true} />}
      </div>
      <div className="text-center space-y-1.5">
        <GradientText className="text-lg font-semibold">{message}</GradientText>
        {submessage && (
          <motion.p
            className="text-sm text-muted-foreground"
            initial={{ opacity: 0, y: 5 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.5 }}
          >
            {submessage}
          </motion.p>
        )}
      </div>
    </motion.div>
  );
}

export function CircularAvatar({
  children,
  size = 48,
  ring = true,
  className = "",
}: {
  children: ReactNode;
  size?: number;
  ring?: boolean;
  className?: string;
}) {
  return (
    <div className={`relative inline-flex items-center justify-center ${className}`}>
      {ring && (
        <div
          className="absolute rounded-full gemini-ring"
          style={{
            width: size + 6,
            height: size + 6,
          }}
        />
      )}
      <div
        className="rounded-full bg-gradient-to-br from-primary/10 to-accent/10 flex items-center justify-center relative overflow-hidden"
        style={{ width: size, height: size }}
      >
        {children}
      </div>
    </div>
  );
}

export function EnlighteningReveal({
  children,
  className = "",
  delay = 0,
}: {
  children: ReactNode;
  className?: string;
  delay?: number;
}) {
  return (
    <motion.div
      className={className}
      initial={{
        opacity: 0,
        y: 20,
        scale: 0.96,
        filter: "blur(8px)",
      }}
      animate={{
        opacity: 1,
        y: 0,
        scale: 1,
        filter: "blur(0px)",
      }}
      transition={{
        duration: 0.6,
        delay,
        ease: [0.16, 1, 0.3, 1],
        filter: { duration: 0.4, delay: delay + 0.1 },
      }}
    >
      {children}
    </motion.div>
  );
}

export function ExpandReveal({
  children,
  className = "",
  delay = 0,
}: {
  children: ReactNode;
  className?: string;
  delay?: number;
}) {
  return (
    <motion.div
      className={`overflow-hidden ${className}`}
      initial={{ height: 0, opacity: 0 }}
      animate={{ height: "auto", opacity: 1 }}
      exit={{ height: 0, opacity: 0 }}
      transition={{
        height: { duration: 0.4, delay, ease: [0.16, 1, 0.3, 1] },
        opacity: { duration: 0.3, delay: delay + 0.1 },
      }}
    >
      {children}
    </motion.div>
  );
}

export function GlowHalo({
  color = GEMINI_COLORS.evergreen,
  size = 200,
  blur = 60,
  opacity = 0.06,
  className = "",
}: {
  color?: string;
  size?: number;
  blur?: number;
  opacity?: number;
  className?: string;
}) {
  return (
    <motion.div
      className={`absolute rounded-full pointer-events-none ${className}`}
      style={{
        width: size,
        height: size,
        background: `radial-gradient(circle, ${color} 0%, transparent 65%)`,
        filter: `blur(${blur}px)`,
      }}
      animate={{
        opacity: [opacity * 0.6, opacity, opacity * 0.6],
        scale: [0.97, 1.03, 0.97],
      }}
      transition={{
        duration: 5,
        repeat: Infinity,
        ease: "easeInOut",
      }}
    />
  );
}

export const geminiEntrance: Variants = {
  hidden: { opacity: 0, y: 16, scale: 0.97, filter: "blur(4px)" },
  visible: {
    opacity: 1,
    y: 0,
    scale: 1,
    filter: "blur(0px)",
    transition: {
      type: "spring",
      stiffness: 200,
      damping: 22,
      mass: 0.8,
      filter: { duration: 0.3 },
    },
  },
};

export const geminiStagger: Variants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.07,
      delayChildren: 0.1,
    },
  },
};

export const geminiCard: Variants = {
  hidden: { opacity: 0, y: 12, scale: 0.98, filter: "blur(3px)" },
  visible: {
    opacity: 1,
    y: 0,
    scale: 1,
    filter: "blur(0px)",
    transition: {
      type: "spring",
      stiffness: 220,
      damping: 24,
      filter: { duration: 0.25 },
    },
  },
};

export const geminiFloat: Variants = {
  initial: { y: 0 },
  animate: {
    y: [0, -6, 0],
    transition: {
      duration: 5,
      repeat: Infinity,
      ease: "easeInOut",
    },
  },
};

export const geminiBreathe: Variants = {
  initial: { scale: 1, opacity: 0.8 },
  animate: {
    scale: [1, 1.02, 1],
    opacity: [0.8, 1, 0.8],
    transition: {
      duration: 4,
      repeat: Infinity,
      ease: "easeInOut",
    },
  },
};

export const geminiExpand: Variants = {
  hidden: {
    opacity: 0,
    scale: 0.92,
    y: 10,
    filter: "blur(6px)",
  },
  visible: {
    opacity: 1,
    scale: 1,
    y: 0,
    filter: "blur(0px)",
    transition: {
      duration: 0.5,
      ease: [0.16, 1, 0.3, 1],
      filter: { duration: 0.3 },
    },
  },
  exit: {
    opacity: 0,
    scale: 0.95,
    y: -5,
    filter: "blur(4px)",
    transition: { duration: 0.3 },
  },
};
