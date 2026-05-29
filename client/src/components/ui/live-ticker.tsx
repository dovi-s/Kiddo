import { useState, useEffect } from "react";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import { Gift, TrendingUp, Sprout } from "lucide-react";

export interface Contributor {
  id: string;
  name: string;
  amount: number;
  timestamp: Date | string;
  avatar?: string;
}

const MOCK_CONTRIBUTORS: Contributor[] = [
  { id: "1", name: "Grandma Rose", amount: 100, timestamp: new Date(Date.now() - 60000) },
  { id: "2", name: "Uncle David", amount: 50, timestamp: new Date(Date.now() - 120000) },
  { id: "3", name: "The Smiths", amount: 75, timestamp: new Date(Date.now() - 180000) },
  { id: "4", name: "Aunt Sarah", amount: 25, timestamp: new Date(Date.now() - 240000) },
  { id: "5", name: "Family Friend", amount: 50, timestamp: new Date(Date.now() - 300000) },
];

function getTimeAgo(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  const seconds = Math.floor((Date.now() - d.getTime()) / 1000);
  if (seconds < 60) return "just now";
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  return `${Math.floor(seconds / 86400)}d ago`;
}

export function LiveContributorTicker({ 
  contributors = MOCK_CONTRIBUTORS,
  compact = false 
}: { 
  contributors?: Contributor[];
  compact?: boolean;
}) {
  const [currentIndex, setCurrentIndex] = useState(0);

  useEffect(() => {
    if (contributors.length <= 1) return;
    
    const interval = setInterval(() => {
      setCurrentIndex((prev) => (prev + 1) % contributors.length);
    }, 3000);

    return () => clearInterval(interval);
  }, [contributors.length]);

  if (contributors.length === 0) return null;

  const current = contributors[currentIndex];

  if (compact) {
    return (
      <div className="flex items-center gap-2 text-sm">
        <div className="relative">
          <div className="w-2 h-2 rounded-full bg-success animate-pulse" />
          <div className="absolute inset-0 w-2 h-2 rounded-full bg-success animate-ping opacity-75" />
        </div>
        <AnimatePresence mode="wait">
          <motion.span
            key={current.id}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="text-muted-foreground"
          >
            <span className="font-medium text-foreground">{current.name}</span> gave ${current.amount}
          </motion.span>
        </AnimatePresence>
      </div>
    );
  }

  return (
    <motion.div 
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-success/5 rounded-2xl p-4 border border-success/10"
    >
      <div className="flex items-center gap-2 mb-3">
        <div className="relative">
          <div className="w-2 h-2 rounded-full bg-success" />
          <div className="absolute inset-0 w-2 h-2 rounded-full bg-success animate-ping opacity-75" />
        </div>
        <span className="text-xs font-medium text-success uppercase tracking-wider">Live Activity</span>
      </div>

      <AnimatePresence mode="wait">
        <motion.div
          key={current.id}
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -20 }}
          className="flex items-center gap-3"
        >
          <div className="w-10 h-10 rounded-full bg-card border border-success/20 flex items-center justify-center text-sm font-medium text-success shadow-sm">
            {current.avatar || current.name.charAt(0)}
          </div>
          <div className="flex-1">
            <p className="text-sm font-medium text-foreground">{current.name}</p>
            <p className="text-xs text-success">
              Gave ${current.amount} · {getTimeAgo(current.timestamp)}
            </p>
          </div>
          <Gift className="w-5 h-5 text-success" />
        </motion.div>
      </AnimatePresence>

      <div className="flex justify-center gap-1.5 mt-4">
        {contributors.map((_, i) => (
          <button
            key={i}
            onClick={() => setCurrentIndex(i)}
            className={`w-1.5 h-1.5 rounded-full transition-all ${
              i === currentIndex ? "bg-success w-4" : "bg-success/30"
            }`}
          />
        ))}
      </div>
    </motion.div>
  );
}

export function ContributorBubbles({ 
  contributors = MOCK_CONTRIBUTORS.slice(0, 5),
  showCount = true 
}: { 
  contributors?: Contributor[];
  showCount?: boolean;
}) {
  return (
    <div className="flex items-center gap-2">
      <div className="flex -space-x-3">
        {contributors.slice(0, 5).map((contributor, i) => (
          <motion.div
            key={contributor.id}
            initial={{ scale: 0, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ delay: i * 0.1, type: "spring", stiffness: 300, damping: 20 }}
            className="w-8 h-8 rounded-full bg-muted border-2 border-card flex items-center justify-center text-xs font-medium text-muted-foreground shadow-sm"
          >
            {contributor.avatar || contributor.name.charAt(0)}
          </motion.div>
        ))}
        {contributors.length > 5 && (
          <motion.div
            initial={{ scale: 0, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ delay: 0.5, type: "spring", stiffness: 300, damping: 20 }}
            className="w-8 h-8 rounded-full bg-primary border-2 border-card flex items-center justify-center text-xs font-medium text-primary-foreground shadow-sm"
          >
            +{contributors.length - 5}
          </motion.div>
        )}
      </div>
      {showCount && (
        <span className="text-sm text-muted-foreground">
          {contributors.length} {contributors.length === 1 ? "person" : "people"} gave
        </span>
      )}
    </div>
  );
}

export function InvestmentReveal({
  amount,
  stockSymbol = "VTI",
  stockName = "Total US Market",
  shares = "0.1856"
}: {
  amount: number;
  stockSymbol?: string;
  stockName?: string;
  shares?: string;
}) {
  const reduceMotion = useReducedMotion();
  const [stage, setStage] = useState(0);

  useEffect(() => {
    // Respect prefers-reduced-motion: skip the timed spinner -> amount ->
    // converting -> complete reveal (including two continuous spinners) and
    // jump straight to the final invested state. The reveal is decorative;
    // the information (stock, shares) is all in the final stage.
    if (reduceMotion) {
      setStage(3);
      return;
    }
    const timers = [
      setTimeout(() => setStage(1), 500),
      setTimeout(() => setStage(2), 1500),
      setTimeout(() => setStage(3), 2500),
    ];
    return () => timers.forEach(clearTimeout);
  }, [reduceMotion]);

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-primary rounded-2xl p-6 text-primary-foreground overflow-hidden"
    >
      <AnimatePresence mode="wait">
        {stage === 0 && (
          <motion.div
            key="receiving"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="text-center py-8"
          >
            <div className="w-12 h-12 rounded-full border-2 border-primary-foreground/30 border-t-primary-foreground animate-spin mx-auto mb-4" />
            <p className="text-primary-foreground/60">Receiving gift...</p>
          </motion.div>
        )}

        {stage === 1 && (
          <motion.div
            key="amount"
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 1.1 }}
            className="text-center py-8"
          >
            <motion.p
              initial={{ scale: 0.5 }}
              animate={{ scale: 1 }}
              transition={{ type: "spring", stiffness: 300, damping: 20 }}
              className="text-5xl font-light mb-2"
            >
              ${amount}
            </motion.p>
            <p className="text-primary-foreground/60">Gift received</p>
          </motion.div>
        )}

        {stage === 2 && (
          <motion.div
            key="converting"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="text-center py-8"
          >
            <div className="flex items-center justify-center gap-3 mb-4">
              <motion.div
                animate={{ rotate: 360 }}
                transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
              >
                <TrendingUp className="w-8 h-8 text-[hsl(var(--kora-gold))]" />
              </motion.div>
            </div>
            <p className="text-primary-foreground/60">Converting to investment...</p>
          </motion.div>
        )}

        {stage === 3 && (
          <motion.div
            key="complete"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-center"
          >
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ type: "spring", stiffness: 300, damping: 15 }}
              className="w-16 h-16 rounded-2xl bg-success flex items-center justify-center mx-auto mb-4 shadow-lg"
            >
              <span className="text-2xl font-bold text-success-foreground">{stockSymbol.slice(0, 2)}</span>
            </motion.div>
            
            <p className="text-sm text-primary-foreground/60 mb-1">{stockName}</p>
            <p className="text-3xl font-light mb-1">{shares} shares</p>
            {/* Gold text on the dark evergreen success background.
                Migrated 2026-05-14 from --kora-gold (3.92:1 on
                evergreen, fails AA) to --kora-gold-light (7.04:1
                on evergreen, AAA). Gold-light is the right token
                for light-on-dark gold register; gold-ink is wrong
                here because it's darker than the bg. */}
            <p className="text-sm text-[hsl(var(--kora-gold-light))]">of {stockSymbol}</p>

            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.5 }}
              className="mt-6 pt-4 border-t border-primary-foreground/10 flex items-center justify-center gap-2 text-primary-foreground/40 text-xs"
            >
              <Sprout className="w-3 h-3" />
              <span>Now growing in their fund</span>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
