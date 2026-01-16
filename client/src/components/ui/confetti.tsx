import { motion } from "framer-motion";
import { useEffect, useState } from "react";

interface ConfettiPiece {
  id: number;
  x: number;
  color: string;
  delay: number;
  rotation: number;
  size: number;
}

const colors = [
  "hsl(152, 45%, 25%)", // kora evergreen
  "hsl(36, 72%, 52%)", // kora gold
  "hsl(152, 35%, 35%)", // evergreen light
  "hsl(36, 65%, 62%)", // gold light
  "hsl(40, 30%, 85%)", // cream accent
  "hsl(152, 40%, 42%)", // fresh green
];

export function Confetti({ isActive }: { isActive: boolean }) {
  const [pieces, setPieces] = useState<ConfettiPiece[]>([]);

  useEffect(() => {
    if (isActive) {
      const newPieces = Array.from({ length: 50 }, (_, i) => ({
        id: i,
        x: Math.random() * 100,
        color: colors[Math.floor(Math.random() * colors.length)],
        delay: Math.random() * 0.5,
        rotation: Math.random() * 360,
        size: Math.random() * 8 + 4,
      }));
      setPieces(newPieces);
    }
  }, [isActive]);

  if (!isActive) return null;

  return (
    <div className="fixed inset-0 pointer-events-none overflow-hidden z-50">
      {pieces.map((piece) => (
        <motion.div
          key={piece.id}
          className="absolute"
          initial={{
            x: `${piece.x}vw`,
            y: -20,
            rotate: piece.rotation,
            opacity: 1,
          }}
          animate={{
            y: "110vh",
            rotate: piece.rotation + 360,
            opacity: [1, 1, 0],
          }}
          transition={{
            duration: 3 + Math.random() * 2,
            delay: piece.delay,
            ease: [0.22, 1, 0.36, 1],
          }}
          style={{
            width: piece.size,
            height: piece.size * 0.6,
            backgroundColor: piece.color,
            borderRadius: 2,
          }}
        />
      ))}
    </div>
  );
}

export function SuccessCheckmark({ delay = 0 }: { delay?: number }) {
  return (
    <motion.div
      initial={{ scale: 0 }}
      animate={{ scale: 1 }}
      transition={{ delay, type: "spring", stiffness: 200, damping: 15 }}
      className="relative"
    >
      <motion.div
        className="absolute inset-0 rounded-full bg-[hsl(var(--kora-evergreen))]/20"
        initial={{ scale: 1 }}
        animate={{ scale: 2, opacity: 0 }}
        transition={{ delay: delay + 0.2, duration: 0.25 }}
      />
      <motion.div
        className="absolute inset-0 rounded-full bg-[hsl(var(--kora-evergreen))]/10"
        initial={{ scale: 1 }}
        animate={{ scale: 2.5, opacity: 0 }}
        transition={{ delay: delay + 0.25, duration: 0.25 }}
      />
      <div className="w-20 h-20 rounded-full bg-[hsl(var(--kora-evergreen))] flex items-center justify-center shadow-lg shadow-[hsl(var(--kora-evergreen))]/30">
        <motion.svg
          className="w-10 h-10 text-white"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth={3}
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <motion.path
            d="M5 13l4 4L19 7"
            initial={{ pathLength: 0 }}
            animate={{ pathLength: 1 }}
            transition={{ delay: delay + 0.3, duration: 0.4, ease: "easeOut" }}
          />
        </motion.svg>
      </div>
    </motion.div>
  );
}
