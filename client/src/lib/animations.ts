import { Variants, Transition, TargetAndTransition } from "framer-motion";

export const springTransition: Transition = {
  type: "spring",
  stiffness: 400,
  damping: 30,
};

export const gentleSpring: Transition = {
  type: "spring",
  stiffness: 300,
  damping: 25,
};

export const bouncySpring: Transition = {
  type: "spring",
  stiffness: 500,
  damping: 20,
  mass: 0.8,
};

export const smoothEase: Transition = {
  duration: 0.3,
  ease: [0.25, 0.1, 0.25, 1],
};

export const fadeIn: Variants = {
  hidden: { opacity: 0 },
  visible: { 
    opacity: 1,
    transition: { duration: 0.4 }
  }
};

export const fadeInUp: Variants = {
  hidden: { opacity: 0, y: 20 },
  visible: { 
    opacity: 1, 
    y: 0,
    transition: gentleSpring
  }
};

export const fadeInScale: Variants = {
  hidden: { opacity: 0, scale: 0.95 },
  visible: { 
    opacity: 1, 
    scale: 1,
    transition: gentleSpring
  }
};

export const slideInLeft: Variants = {
  hidden: { opacity: 0, x: -30 },
  visible: { 
    opacity: 1, 
    x: 0,
    transition: gentleSpring
  }
};

export const slideInRight: Variants = {
  hidden: { opacity: 0, x: 30 },
  visible: { 
    opacity: 1, 
    x: 0,
    transition: gentleSpring
  }
};

export const staggerContainer: Variants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.08,
      delayChildren: 0.1
    }
  }
};

export const staggerFast: Variants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.05,
      delayChildren: 0.05
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
    y: -4, 
    scale: 1.01,
    boxShadow: "0 10px 25px -5px rgb(0 0 0 / 0.1), 0 8px 10px -6px rgb(0 0 0 / 0.1)",
    transition: gentleSpring
  },
  tap: { 
    y: -2, 
    scale: 0.99,
    transition: { duration: 0.1 }
  }
};

export const buttonPress: TargetAndTransition = {
  scale: 0.97,
  transition: { duration: 0.1 }
};

export const buttonHover: TargetAndTransition = {
  scale: 1.02,
  transition: gentleSpring
};

export const iconSpin: Variants = {
  initial: { rotate: 0 },
  animate: { 
    rotate: 360,
    transition: {
      duration: 1,
      repeat: Infinity,
      ease: "linear"
    }
  }
};

export const pulseGlow: Variants = {
  initial: { opacity: 0.5, scale: 1 },
  animate: {
    opacity: [0.5, 1, 0.5],
    scale: [1, 1.05, 1],
    transition: {
      duration: 2,
      repeat: Infinity,
      ease: "easeInOut"
    }
  }
};

export const countUp = (value: number, duration = 1200): number[] => {
  const frames = 60;
  const step = value / frames;
  return Array.from({ length: frames }, (_, i) => Math.round(step * (i + 1)));
};

export const shimmer: Variants = {
  initial: { x: "-100%" },
  animate: {
    x: "100%",
    transition: {
      duration: 1.5,
      repeat: Infinity,
      ease: "linear",
      repeatDelay: 0.5
    }
  }
};

export const pageSlide: Variants = {
  initial: { opacity: 0, x: 20 },
  animate: { 
    opacity: 1, 
    x: 0,
    transition: {
      ...gentleSpring,
      staggerChildren: 0.1
    }
  },
  exit: { 
    opacity: 0, 
    x: -20,
    transition: { duration: 0.2 }
  }
};

export const modalOverlay: Variants = {
  hidden: { opacity: 0 },
  visible: { 
    opacity: 1,
    transition: { duration: 0.2 }
  },
  exit: { 
    opacity: 0,
    transition: { duration: 0.15 }
  }
};

export const modalContent: Variants = {
  hidden: { 
    opacity: 0, 
    scale: 0.95,
    y: 10
  },
  visible: { 
    opacity: 1, 
    scale: 1,
    y: 0,
    transition: bouncySpring
  },
  exit: { 
    opacity: 0, 
    scale: 0.95,
    transition: { duration: 0.15 }
  }
};

export const successPop: Variants = {
  hidden: { scale: 0, opacity: 0 },
  visible: { 
    scale: 1, 
    opacity: 1,
    transition: {
      type: "spring",
      stiffness: 600,
      damping: 15
    }
  }
};

export const checkMark: Variants = {
  hidden: { pathLength: 0, opacity: 0 },
  visible: { 
    pathLength: 1, 
    opacity: 1,
    transition: {
      pathLength: { duration: 0.4, ease: "easeOut" },
      opacity: { duration: 0.1 }
    }
  }
};

export const listItem: Variants = {
  hidden: { opacity: 0, x: -10, scale: 0.98 },
  visible: { 
    opacity: 1, 
    x: 0, 
    scale: 1,
    transition: gentleSpring
  },
  exit: { 
    opacity: 0, 
    x: 10, 
    scale: 0.98,
    transition: { duration: 0.2 }
  }
};

export const numberPop: Variants = {
  initial: { scale: 1 },
  pop: {
    scale: [1, 1.2, 1],
    transition: {
      duration: 0.3,
      times: [0, 0.5, 1]
    }
  }
};
