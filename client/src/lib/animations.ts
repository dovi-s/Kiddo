import { Variants, Transition, TargetAndTransition } from "framer-motion";

// ============================================
// MOTION TOKENS - Premium Native Feel
// ============================================

// Spring configurations - iOS/Android-calibrated
export const springSnappy = { type: "spring" as const, stiffness: 400, damping: 30 };
export const springGentle = { type: "spring" as const, stiffness: 300, damping: 25 };
export const springBouncy = { type: "spring" as const, stiffness: 500, damping: 20, mass: 0.8 };
export const springSmooth = { type: "spring" as const, stiffness: 200, damping: 25 };
export const springValue = { type: "spring" as const, stiffness: 100, damping: 20, mass: 0.5 }; // For value counters
export const springMagnetic = { type: "spring" as const, stiffness: 150, damping: 15, mass: 0.1 }; // For magnetic effects

// Easing curves (iOS-inspired) - typed as tuples for framer-motion
export const easeOutExpo: [number, number, number, number] = [0.16, 1, 0.3, 1];
export const easeOutBack: [number, number, number, number] = [0.34, 1.56, 0.64, 1];
export const easeInOutCubic: [number, number, number, number] = [0.65, 0, 0.35, 1];

export const microTransition: Transition = {
  duration: 0.15,
  ease: easeOutExpo,
};

export const standardTransition: Transition = {
  duration: 0.2,
  ease: easeOutExpo,
};

export const emphasisTransition: Transition = {
  duration: 0.25,
  ease: easeInOutCubic,
};

export const smoothEase: Transition = {
  duration: 0.22,
  ease: easeOutExpo,
};

// ============================================
// PAGE TRANSITIONS - iOS push/pop style
// ============================================

export const pageSlideRight: Variants = {
  initial: { x: "100%", opacity: 0.8 },
  animate: { 
    x: 0, 
    opacity: 1,
    transition: { ...springGentle, opacity: { duration: 0.2 } }
  },
  exit: { 
    x: "-30%", 
    opacity: 0.5,
    transition: { duration: 0.2, ease: easeOutExpo }
  }
};

export const pageSlideLeft: Variants = {
  initial: { x: "-30%", opacity: 0.5 },
  animate: { 
    x: 0, 
    opacity: 1,
    transition: { ...springGentle, opacity: { duration: 0.2 } }
  },
  exit: { 
    x: "100%", 
    opacity: 0.8,
    transition: { duration: 0.25, ease: easeOutExpo }
  }
};

export const pageFadeScale: Variants = {
  initial: { opacity: 0, scale: 0.96, y: 8 },
  animate: { 
    opacity: 1, 
    scale: 1, 
    y: 0,
    transition: { duration: 0.25, ease: easeOutExpo }
  },
  exit: { 
    opacity: 0, 
    scale: 0.98,
    transition: { duration: 0.15, ease: "easeIn" }
  }
};

export const pageModalUp: Variants = {
  initial: { y: "100%", opacity: 0.9 },
  animate: { 
    y: 0, 
    opacity: 1,
    transition: springGentle
  },
  exit: { 
    y: "100%", 
    opacity: 0.9,
    transition: { duration: 0.25, ease: easeOutExpo }
  }
};

// ============================================
// TACTILE FEEDBACK - Press depth effects
// ============================================

export const tactilePress = {
  scale: 0.97,
  transition: { duration: 0.1, ease: "easeOut" }
};

export const tactilePressDeep = {
  scale: 0.95,
  transition: { duration: 0.08, ease: "easeOut" }
};

export const tactileRelease = {
  scale: 1,
  transition: springSnappy
};

// Button press variants
export const buttonTactile: Variants = {
  rest: { scale: 1 },
  pressed: { 
    scale: 0.97,
    transition: { duration: 0.08, ease: "easeOut" }
  },
  hover: { 
    scale: 1.02,
    transition: { duration: 0.15, ease: easeOutExpo }
  }
};

export const cardTactile: Variants = {
  rest: { 
    scale: 1,
    y: 0,
    boxShadow: "0 1px 3px 0 rgb(0 0 0 / 0.08)"
  },
  pressed: { 
    scale: 0.98,
    y: 2,
    boxShadow: "0 1px 2px 0 rgb(0 0 0 / 0.05)",
    transition: { duration: 0.1, ease: "easeOut" }
  },
  hover: { 
    scale: 1.01,
    y: -3,
    boxShadow: "0 8px 25px -5px rgb(0 0 0 / 0.1)",
    transition: { duration: 0.2, ease: easeOutExpo }
  }
};

// ============================================
// CELEBRATION ANIMATIONS
// ============================================

export const celebrationPulse: Variants = {
  initial: { scale: 0.8, opacity: 0 },
  animate: {
    scale: [0.8, 1.1, 1],
    opacity: [0, 1, 1],
    transition: { duration: 0.22, ease: easeOutBack }
  }
};

export const celebrationBurst: Variants = {
  initial: { scale: 0, opacity: 0, rotate: -10 },
  animate: {
    scale: [0, 1.2, 1],
    opacity: [0, 1, 1],
    rotate: [-10, 5, 0],
    transition: { duration: 0.6, ease: easeOutBack }
  }
};

export const successCheck: Variants = {
  initial: { scale: 0, opacity: 0 },
  animate: {
    scale: [0, 1.3, 1],
    opacity: 1,
    transition: { 
      scale: { duration: 0.4, ease: easeOutBack },
      opacity: { duration: 0.2 }
    }
  }
};

export const shimmerGlow = {
  initial: { backgroundPosition: "-200% 0" },
  animate: { 
    backgroundPosition: "200% 0",
    transition: { duration: 1.5, ease: "linear", repeat: Infinity }
  }
};

// ============================================
// GESTURE RESPONSES
// ============================================

export const swipeCardLeft: Variants = {
  rest: { x: 0, opacity: 1 },
  swiping: { 
    opacity: 0.9,
    transition: { duration: 0.1 }
  },
  swiped: { 
    x: "-100%", 
    opacity: 0,
    transition: { duration: 0.25, ease: easeOutExpo }
  }
};

export const swipeCardRight: Variants = {
  rest: { x: 0, opacity: 1 },
  swiping: { 
    opacity: 0.9,
    transition: { duration: 0.1 }
  },
  swiped: { 
    x: "100%", 
    opacity: 0,
    transition: { duration: 0.25, ease: easeOutExpo }
  }
};

export const pullToRefresh: Variants = {
  rest: { y: 0, opacity: 0 },
  pulling: { 
    y: 0, 
    opacity: 1,
    transition: { duration: 0.1 }
  },
  refreshing: {
    rotate: 360,
    transition: { duration: 1, ease: "linear", repeat: Infinity }
  }
};

export const fadeIn: Variants = {
  hidden: { opacity: 0 },
  visible: { 
    opacity: 1,
    transition: { duration: 0.2, ease: "easeOut" }
  }
};

export const fadeInUp: Variants = {
  hidden: { opacity: 0, y: 12 },
  visible: { 
    opacity: 1, 
    y: 0,
    transition: { duration: 0.2, ease: "easeOut" }
  }
};

export const fadeInScale: Variants = {
  hidden: { opacity: 0, scale: 0.97 },
  visible: { 
    opacity: 1, 
    scale: 1,
    transition: { duration: 0.2, ease: "easeOut" }
  }
};

export const slideInLeft: Variants = {
  hidden: { opacity: 0, x: -16 },
  visible: { 
    opacity: 1, 
    x: 0,
    transition: { duration: 0.2, ease: "easeOut" }
  }
};

export const slideInRight: Variants = {
  hidden: { opacity: 0, x: 16 },
  visible: { 
    opacity: 1, 
    x: 0,
    transition: { duration: 0.2, ease: "easeOut" }
  }
};

export const staggerContainer: Variants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.05,
      delayChildren: 0.05
    }
  }
};

export const staggerFast: Variants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.03,
      delayChildren: 0.02
    }
  }
};

export const liftCard: Variants = {
  rest: { 
    y: 0, 
    scale: 1,
    boxShadow: "0 1px 3px 0 rgb(0 0 0 / 0.1)"
  },
  hover: { 
    y: -2, 
    scale: 1.005,
    boxShadow: "0 4px 12px -2px rgb(0 0 0 / 0.08)",
    transition: { duration: 0.2, ease: "easeOut" }
  },
  tap: { 
    y: -1, 
    scale: 0.99,
    transition: { duration: 0.15, ease: "easeOut" }
  }
};

export const buttonPress: TargetAndTransition = {
  scale: 0.98,
  transition: { duration: 0.15, ease: "easeOut" }
};

export const buttonHover: TargetAndTransition = {
  scale: 1.01,
  transition: { duration: 0.15, ease: "easeOut" }
};

export const iconSpin: Variants = {
  initial: { rotate: 0 },
  animate: { 
    rotate: 360,
    transition: {
      duration: 0.8,
      repeat: Infinity,
      ease: "linear"
    }
  }
};

export const countUp = (value: number, duration = 250): number[] => {
  const frames = Math.max(15, Math.floor(duration / 16));
  const step = value / frames;
  return Array.from({ length: frames }, (_, i) => Math.round(step * (i + 1)));
};

export const shimmer: Variants = {
  initial: { x: "-100%" },
  animate: {
    x: "100%",
    transition: {
      duration: 1.2,
      repeat: Infinity,
      ease: "linear",
      repeatDelay: 0.3
    }
  }
};

export const pageSlide: Variants = {
  initial: { opacity: 0, x: 12 },
  animate: { 
    opacity: 1, 
    x: 0,
    transition: {
      duration: 0.2,
      ease: "easeOut",
      staggerChildren: 0.05
    }
  },
  exit: { 
    opacity: 0, 
    x: -12,
    transition: { duration: 0.15, ease: "easeIn" }
  }
};

export const modalOverlay: Variants = {
  hidden: { opacity: 0 },
  visible: { 
    opacity: 1,
    transition: { duration: 0.15, ease: "easeOut" }
  },
  exit: { 
    opacity: 0,
    transition: { duration: 0.15, ease: "easeIn" }
  }
};

export const modalContent: Variants = {
  hidden: { 
    opacity: 0, 
    scale: 0.97,
    y: 8
  },
  visible: { 
    opacity: 1, 
    scale: 1,
    y: 0,
    transition: { duration: 0.2, ease: "easeOut" }
  },
  exit: { 
    opacity: 0, 
    scale: 0.97,
    transition: { duration: 0.15, ease: "easeIn" }
  }
};

export const successPop: Variants = {
  hidden: { scale: 0.9, opacity: 0 },
  visible: { 
    scale: 1, 
    opacity: 1,
    transition: { duration: 0.25, ease: "easeOut" }
  }
};

export const checkMark: Variants = {
  hidden: { pathLength: 0, opacity: 0 },
  visible: { 
    pathLength: 1, 
    opacity: 1,
    transition: {
      pathLength: { duration: 0.25, ease: "easeOut" },
      opacity: { duration: 0.15 }
    }
  }
};

export const listItem: Variants = {
  hidden: { opacity: 0, x: -8, scale: 0.98 },
  visible: { 
    opacity: 1, 
    x: 0, 
    scale: 1,
    transition: { duration: 0.2, ease: "easeOut" }
  },
  exit: { 
    opacity: 0, 
    x: 8, 
    scale: 0.98,
    transition: { duration: 0.15, ease: "easeIn" }
  }
};

export const numberPop: Variants = {
  initial: { scale: 1 },
  pop: {
    scale: [1, 1.08, 1],
    transition: {
      duration: 0.2,
      times: [0, 0.5, 1],
      ease: "easeInOut"
    }
  }
};

export const gentleSpring: Transition = standardTransition;
export const bouncySpring: Transition = emphasisTransition;
export const springTransition: Transition = standardTransition;

export const iconPulse: Variants = {
  initial: { scale: 1 },
  pulse: {
    scale: [1, 1.15, 1],
    transition: {
      duration: 0.25,
      times: [0, 0.5, 1],
      ease: "easeInOut"
    }
  }
};

export const iconBounce: Variants = {
  initial: { y: 0 },
  bounce: {
    y: [0, -3, 0],
    transition: {
      duration: 0.2,
      times: [0, 0.5, 1],
      ease: "easeOut"
    }
  }
};

export const iconSpin180: Variants = {
  initial: { rotate: 0 },
  spin: {
    rotate: 180,
    transition: { duration: 0.22, ease: "easeInOut" }
  }
};

export const hoverGlow: Variants = {
  rest: { 
    boxShadow: "0 0 0 0 rgba(var(--kora-gold-rgb), 0)"
  },
  hover: {
    boxShadow: "0 0 20px 4px rgba(var(--kora-gold-rgb), 0.15)",
    transition: { duration: 0.2, ease: "easeOut" }
  }
};

export const hoverLift: Variants = {
  rest: { y: 0, scale: 1 },
  hover: { 
    y: -4, 
    scale: 1.02,
    transition: { duration: 0.2, ease: "easeOut" }
  },
  tap: { 
    y: -2, 
    scale: 0.98,
    transition: { duration: 0.15, ease: "easeOut" }
  }
};

export const tactileButton: Variants = {
  rest: { scale: 1, y: 0 },
  hover: { 
    scale: 1.02,
    transition: { duration: 0.15, ease: "easeOut" }
  },
  tap: { 
    scale: 0.97,
    y: 1,
    transition: { duration: 0.15, ease: "easeOut" }
  }
};

export const glowPulse: Variants = {
  initial: { opacity: 0.5 },
  animate: {
    opacity: [0.5, 0.8, 0.5],
    transition: {
      duration: 2,
      repeat: Infinity,
      ease: "easeInOut"
    }
  }
};

export const floatAmbient: Variants = {
  initial: { y: 0 },
  animate: {
    y: [0, -4, 0],
    transition: {
      duration: 3,
      repeat: Infinity,
      ease: "easeInOut"
    }
  }
};

export const revealMask: Variants = {
  hidden: { clipPath: "inset(0 100% 0 0)" },
  visible: {
    clipPath: "inset(0 0% 0 0)",
    transition: { duration: 0.25, ease: "easeOut" }
  }
};

export const parallaxScroll = (strength: number = 0.1) => ({
  y: `calc(var(--scroll-y, 0) * ${strength})`,
});

export const tickUp: Variants = {
  hidden: { y: 12, opacity: 0 },
  visible: {
    y: 0,
    opacity: 1,
    transition: { duration: 0.2, ease: "easeOut" }
  }
};

export const flipIn: Variants = {
  hidden: { 
    rotateY: -90, 
    opacity: 0,
    transformPerspective: 600
  },
  visible: {
    rotateY: 0,
    opacity: 1,
    transition: { duration: 0.25, ease: "easeOut" }
  }
};

export const statusDot: Variants = {
  pending: {
    scale: [1, 1.2, 1],
    opacity: [0.7, 1, 0.7],
    transition: {
      duration: 1.5,
      repeat: Infinity,
      ease: "easeInOut"
    }
  },
  active: {
    scale: 1,
    opacity: 1
  }
};

export const progressFill: Variants = {
  hidden: { scaleX: 0, originX: 0 },
  visible: (custom: number) => ({
    scaleX: custom,
    transition: { duration: 0.25, ease: "easeOut" }
  })
};

export const cardReveal: Variants = {
  hidden: { 
    opacity: 0, 
    y: 16,
    scale: 0.98
  },
  visible: {
    opacity: 1,
    y: 0,
    scale: 1,
    transition: { duration: 0.2, ease: "easeOut" }
  }
};

export const staggerReveal: Variants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.04,
      delayChildren: 0.02
    }
  }
};

export const badgePop: Variants = {
  hidden: { scale: 0, opacity: 0 },
  visible: {
    scale: 1,
    opacity: 1,
    transition: { 
      type: "spring",
      stiffness: 500,
      damping: 25,
      duration: 0.2
    }
  }
};

export const switchToggle: Variants = {
  off: { x: 0 },
  on: { 
    x: 16,
    transition: { duration: 0.15, ease: "easeOut" }
  }
};

export const checkboxTick: Variants = {
  unchecked: { scale: 0, opacity: 0 },
  checked: {
    scale: 1,
    opacity: 1,
    transition: { duration: 0.15, ease: "easeOut" }
  }
};

export const inputFocus: Variants = {
  rest: { 
    boxShadow: "0 0 0 0 rgba(var(--kora-evergreen-rgb), 0)"
  },
  focus: {
    boxShadow: "0 0 0 3px rgba(var(--kora-evergreen-rgb), 0.1)",
    transition: { duration: 0.15, ease: "easeOut" }
  }
};

export const slideTab: Variants = {
  hidden: { opacity: 0, x: 8 },
  visible: {
    opacity: 1,
    x: 0,
    transition: { duration: 0.2, ease: "easeOut" }
  },
  exit: {
    opacity: 0,
    x: -8,
    transition: { duration: 0.15, ease: "easeIn" }
  }
};

// ============================================
// PREMIUM MICRO-INTERACTIONS
// ============================================

// Magnetic button - subtle tilt toward cursor
export const magneticButton: Variants = {
  rest: { 
    scale: 1, 
    y: 0,
    rotateX: 0,
    rotateY: 0,
  },
  hover: { 
    scale: 1.02,
    transition: { duration: 0.2, ease: easeOutExpo }
  },
  tap: { 
    scale: 0.97,
    y: 1,
    transition: { duration: 0.1, ease: "easeOut" }
  }
};

// Premium card entrance with scale + y offset
export const cardEntrance: Variants = {
  hidden: { 
    opacity: 0, 
    y: 16,
    scale: 0.97
  },
  visible: {
    opacity: 1,
    y: 0,
    scale: 1,
    transition: { 
      type: "spring",
      stiffness: 300,
      damping: 25,
      mass: 0.8
    }
  }
};

// Hero value counter spring
export const valueCounter: Variants = {
  initial: { opacity: 0, y: 20, scale: 0.9 },
  animate: {
    opacity: 1,
    y: 0,
    scale: 1,
    transition: {
      type: "spring",
      stiffness: 100,
      damping: 15,
      mass: 0.5
    }
  }
};

// Subtle icon rotation on hover
export const iconRotate: Variants = {
  rest: { rotate: 0 },
  hover: { 
    rotate: 12,
    transition: { duration: 0.2, ease: easeOutExpo }
  }
};

// Chevron bounce animation (single bounce 180-220ms, repeats)
export const chevronBounce: Variants = {
  rest: { y: 0 },
  animate: {
    y: [0, 2, 0],
    transition: {
      duration: 0.2,
      repeat: Infinity,
      repeatDelay: 2,
      ease: "easeInOut"
    }
  }
};

// Premium share button pulse
export const sharePulse: Variants = {
  rest: { 
    scale: 1,
    boxShadow: "0 4px 20px -4px rgba(27, 67, 50, 0.3)"
  },
  hover: {
    scale: 1.02,
    boxShadow: "0 8px 30px -4px rgba(27, 67, 50, 0.4)",
    transition: { duration: 0.2, ease: easeOutExpo }
  },
  tap: {
    scale: 0.98,
    boxShadow: "0 2px 10px -2px rgba(27, 67, 50, 0.3)",
    transition: { duration: 0.1 }
  }
};

// Stagger for list items with premium timing
export const staggerPremium: Variants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.06,
      delayChildren: 0.1
    }
  }
};

// List item with spring entrance
export const listItemSpring: Variants = {
  hidden: { 
    opacity: 0, 
    y: 12,
    scale: 0.98
  },
  visible: { 
    opacity: 1, 
    y: 0, 
    scale: 1,
    transition: { 
      type: "spring",
      stiffness: 300,
      damping: 24
    }
  }
};

// Expand/collapse with spring (180-220ms range)
export const expandCollapse: Variants = {
  collapsed: { 
    height: 0, 
    opacity: 0,
    transition: { 
      height: { duration: 0.2, ease: [0.25, 0.1, 0.25, 1] },
      opacity: { duration: 0.12 }
    }
  },
  expanded: { 
    height: "auto", 
    opacity: 1,
    transition: { 
      height: { duration: 0.22, ease: [0.25, 0.1, 0.25, 1] },
      opacity: { duration: 0.15, delay: 0.05 }
    }
  }
};

// Premium tab indicator slide
export const tabIndicator: Variants = {
  initial: { scaleX: 0 },
  animate: { 
    scaleX: 1,
    transition: { 
      type: "spring",
      stiffness: 300,
      damping: 25
    }
  }
};

// Ripple effect for buttons (180-220ms range)
export const rippleEffect = {
  initial: { scale: 0, opacity: 0.5 },
  animate: { 
    scale: 2.5, 
    opacity: 0,
    transition: { duration: 0.22, ease: "easeOut" }
  }
};

// Premium notification badge (180-220ms range)
export const notificationBadge: Variants = {
  hidden: { scale: 0, opacity: 0 },
  visible: {
    scale: [0, 1.15, 1],
    opacity: 1,
    transition: { 
      duration: 0.2,
      times: [0, 0.6, 1],
      ease: easeOutBack
    }
  }
};

// Subtle breathing animation for pending states
export const breathe: Variants = {
  initial: { opacity: 0.7 },
  animate: {
    opacity: [0.7, 1, 0.7],
    transition: {
      duration: 2,
      repeat: Infinity,
      ease: "easeInOut"
    }
  }
};

// Premium sheet animation (iOS-like)
export const sheetPremium: Variants = {
  hidden: { 
    y: "100%",
    transition: { 
      type: "spring",
      stiffness: 400,
      damping: 40
    }
  },
  visible: { 
    y: 0,
    transition: { 
      type: "spring",
      stiffness: 300,
      damping: 30
    }
  }
};

// Amount selection pop
export const amountPop: Variants = {
  rest: { scale: 1 },
  selected: {
    scale: [1, 1.08, 1.03],
    transition: { 
      duration: 0.25,
      times: [0, 0.4, 1],
      ease: easeOutBack
    }
  }
};
