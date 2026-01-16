import { Variants, Transition, TargetAndTransition } from "framer-motion";

export const microTransition: Transition = {
  duration: 0.15,
  ease: "easeOut",
};

export const standardTransition: Transition = {
  duration: 0.2,
  ease: "easeOut",
};

export const emphasisTransition: Transition = {
  duration: 0.25,
  ease: "easeInOut",
};

export const smoothEase: Transition = {
  duration: 0.2,
  ease: [0.25, 0.1, 0.25, 1],
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
