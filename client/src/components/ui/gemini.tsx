import { motion, AnimatePresence, type Variants } from "framer-motion";
import { type ReactNode, useMemo } from "react";

const GEMINI_COLORS = {
  evergreen: "hsl(152, 45%, 18%)",
  evergreenLight: "hsl(152, 35%, 28%)",
  gold: "hsl(36, 72%, 52%)",
  goldLight: "hsl(40, 65%, 70%)",
  teal: "hsl(180, 30%, 40%)",
  sky: "hsl(200, 60%, 55%)",
  cream: "hsl(40, 30%, 97%)",
};

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
          blur: 60,
        };
      case "thinking":
        return {
          colors: [GEMINI_COLORS.evergreen, GEMINI_COLORS.sky, GEMINI_COLORS.evergreenLight],
          duration: 2.5,
          blur: 40,
        };
      case "success":
        return {
          colors: [GEMINI_COLORS.evergreen, GEMINI_COLORS.gold, GEMINI_COLORS.evergreen],
          duration: 3,
          blur: 50,
        };
      case "hero":
        return {
          colors: [GEMINI_COLORS.evergreen, GEMINI_COLORS.gold, GEMINI_COLORS.teal, GEMINI_COLORS.evergreenLight],
          duration: 8,
          blur: 80,
        };
      default:
        return {
          colors: [GEMINI_COLORS.evergreen, GEMINI_COLORS.evergreenLight],
          duration: 6,
          blur: 70,
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
              width: "60%",
              height: "60%",
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
              scale: [1, 1.2, 0.9, 1],
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
      <motion.div
        className="absolute inset-0 rounded-full"
        style={{
          background: `conic-gradient(from 0deg, ${colors.from}, ${colors.via}, ${colors.to}, ${colors.from})`,
        }}
        animate={active ? {
          rotate: [0, 360],
          scale: [1, 1.05, 1],
        } : {}}
        transition={{
          rotate: { duration: 3, repeat: Infinity, ease: "linear" },
          scale: { duration: 2, repeat: Infinity, ease: "easeInOut" },
        }}
      />
      <motion.div
        className="absolute rounded-full bg-background"
        style={{
          inset: size * 0.15,
        }}
        animate={active ? {
          scale: [1, 0.95, 1],
        } : {}}
        transition={{
          duration: 2,
          repeat: Infinity,
          ease: "easeInOut",
        }}
      />
      {active && (
        <motion.div
          className="absolute inset-0 rounded-full"
          style={{
            background: `conic-gradient(from 0deg, ${colors.from}, ${colors.via}, ${colors.to}, ${colors.from})`,
            filter: "blur(8px)",
          }}
          animate={{
            rotate: [0, 360],
            opacity: [0.3, 0.6, 0.3],
          }}
          transition={{
            rotate: { duration: 3, repeat: Infinity, ease: "linear" },
            opacity: { duration: 2, repeat: Infinity, ease: "easeInOut" },
          }}
        />
      )}
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
        animate={active ? {
          rotate: [0, 360],
        } : {}}
        transition={{
          duration: 4,
          repeat: Infinity,
          ease: "linear",
        }}
      />
      {active && (
        <motion.div
          className="absolute inset-0 rounded-full"
          style={{
            background: `conic-gradient(from 0deg, ${GEMINI_COLORS.evergreen}, ${GEMINI_COLORS.gold}, ${GEMINI_COLORS.teal}, ${GEMINI_COLORS.evergreen})`,
            filter: "blur(6px)",
            opacity: 0.3,
          }}
          animate={{ rotate: [0, 360] }}
          transition={{ duration: 4, repeat: Infinity, ease: "linear" }}
        />
      )}
      {children && (
        <div className="relative z-10">{children}</div>
      )}
    </div>
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
    <motion.div
      className={`relative rounded-2xl overflow-hidden ${className}`}
      initial="rest"
      whileHover={glowOnHover ? "hover" : undefined}
      whileTap="pressed"
      variants={{
        rest: {
          scale: 1,
          boxShadow: "0 1px 3px rgba(0,0,0,0.06), 0 0 0 1px rgba(0,0,0,0.04)",
        },
        hover: {
          scale: 1.005,
          y: -2,
          boxShadow: "0 8px 30px -8px rgba(27,67,50,0.15), 0 0 0 1px rgba(27,67,50,0.08)",
          transition: { duration: 0.25, ease: [0.16, 1, 0.3, 1] },
        },
        pressed: {
          scale: 0.985,
          y: 0,
          boxShadow: "0 1px 2px rgba(0,0,0,0.06), 0 0 0 1px rgba(0,0,0,0.04)",
          transition: { duration: 0.1 },
        },
      }}
    >
      {glowOnHover && (
        <motion.div
          className="absolute inset-0 pointer-events-none rounded-2xl"
          style={{
            background: `linear-gradient(135deg, ${GEMINI_COLORS.evergreen}08, ${GEMINI_COLORS.gold}06, transparent)`,
          }}
          variants={{
            rest: { opacity: 0 },
            hover: { opacity: 1, transition: { duration: 0.3 } },
          }}
        />
      )}
      <div className="relative z-10">{children}</div>
    </motion.div>
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
      className={`relative overflow-hidden rounded-xl px-6 py-3 font-semibold text-sm ${bgClass} ${className}`}
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
          animate={{
            x: ["-100%", "200%"],
          }}
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
          className="absolute -inset-1 rounded-2xl pointer-events-none"
          style={{
            background: `radial-gradient(ellipse at center, ${color}, transparent 70%)`,
            filter: "blur(12px)",
          }}
          animate={{
            opacity: [intensity * 0.5, intensity, intensity * 0.5],
            scale: [0.98, 1.02, 0.98],
          }}
          transition={{
            duration: 3,
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
  animate = true,
}: {
  children: ReactNode;
  className?: string;
  animate?: boolean;
}) {
  return (
    <motion.span
      className={`bg-clip-text text-transparent gemini-text-gradient ${className}`}
      style={{
        backgroundSize: animate ? "200% 100%" : "100% 100%",
      }}
      animate={animate ? {
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
      transition={{ duration: 0.3 }}
    >
      <ThinkingOrb size={56} variant="processing" />
      <div className="text-center space-y-1.5">
        <motion.p
          className="text-base font-medium text-foreground"
          animate={{ opacity: [0.7, 1, 0.7] }}
          transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
        >
          {message}
        </motion.p>
        {submessage && (
          <p className="text-sm text-muted-foreground">{submessage}</p>
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

export const geminiEntrance: Variants = {
  hidden: { opacity: 0, y: 16, scale: 0.97 },
  visible: {
    opacity: 1,
    y: 0,
    scale: 1,
    transition: {
      type: "spring",
      stiffness: 250,
      damping: 22,
      mass: 0.8,
    },
  },
};

export const geminiStagger: Variants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.06,
      delayChildren: 0.08,
    },
  },
};

export const geminiCard: Variants = {
  hidden: { opacity: 0, y: 12, scale: 0.98 },
  visible: {
    opacity: 1,
    y: 0,
    scale: 1,
    transition: {
      type: "spring",
      stiffness: 280,
      damping: 24,
    },
  },
};

export const geminiFloat: Variants = {
  initial: { y: 0 },
  animate: {
    y: [0, -6, 0],
    transition: {
      duration: 4,
      repeat: Infinity,
      ease: "easeInOut",
    },
  },
};

export const geminiBreathe: Variants = {
  initial: { scale: 1, opacity: 0.8 },
  animate: {
    scale: [1, 1.03, 1],
    opacity: [0.8, 1, 0.8],
    transition: {
      duration: 3,
      repeat: Infinity,
      ease: "easeInOut",
    },
  },
};
