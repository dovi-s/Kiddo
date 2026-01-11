import { useState, useEffect } from "react";
import { useParams, Link } from "wouter";
import { motion, AnimatePresence } from "framer-motion";
import { Share2, Download, Heart, Sparkles, Copy, Check, MessageCircle } from "lucide-react";
import { Logo } from "@/components/ui/logo";
import { Button } from "@/components/ui/button";
import { toast } from "@/hooks/use-toast";

interface GiftCardData {
  id: string;
  recipientName: string;
  fundName: string;
  amount: number;
  fromName: string;
  message: string;
  eventName: string;
  createdAt: Date;
  investedIn: { name: string; emoji: string }[];
}

const mockCard: GiftCardData = {
  id: "gift_123",
  recipientName: "Mila",
  fundName: "Mila's Fund",
  amount: 100,
  fromName: "Uncle Dave",
  message: "So proud of you, kiddo! This is just the beginning of your amazing journey. Can't wait to see all you accomplish.",
  eventName: "5th Birthday",
  createdAt: new Date(),
  investedIn: [
    { name: "Disney", emoji: "🏰" },
    { name: "Apple", emoji: "🍎" },
    { name: "US Market", emoji: "📈" },
  ],
};

function AnimatedValue({ value, prefix = "$" }: { value: number; prefix?: string }) {
  const [display, setDisplay] = useState(0);
  useEffect(() => {
    const duration = 1500;
    const startTime = Date.now();
    const animate = () => {
      const elapsed = Date.now() - startTime;
      const progress = Math.min(elapsed / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 4);
      setDisplay(Math.round(value * eased));
      if (progress < 1) requestAnimationFrame(animate);
    };
    setTimeout(animate, 800);
  }, [value]);
  return <span>{prefix}{display.toLocaleString()}</span>;
}

export default function GiftCard() {
  const { id } = useParams<{ id: string }>();
  const [revealed, setRevealed] = useState(false);
  const [copied, setCopied] = useState(false);
  const [showShareModal, setShowShareModal] = useState(false);
  
  const card = mockCard;
  const projectedValue = Math.round(card.amount * 4.6);

  const handleReveal = () => {
    setRevealed(true);
  };

  const handleCopy = () => {
    navigator.clipboard?.writeText(window.location.href);
    setCopied(true);
    toast({ title: "Link copied!" });
    setTimeout(() => setCopied(false), 2000);
  };

  const handleShare = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: `${card.fromName} sent a gift to ${card.recipientName}'s Fund`,
          text: card.message,
          url: window.location.href,
        });
      } catch (e) {
        setShowShareModal(true);
      }
    } else {
      setShowShareModal(true);
    }
  };

  const shareUrl = typeof window !== 'undefined' ? window.location.href : '';
  const shareText = `${card.fromName} just gave $${card.amount} to ${card.recipientName}'s Fund!`;

  return (
    <div className="min-h-screen bg-gradient-to-b from-stone-100 to-stone-200 flex flex-col">
      <header className="bg-transparent py-4">
        <div className="max-w-lg mx-auto px-4 flex items-center justify-center">
          <Logo size="sm" className="text-stone-600" />
        </div>
      </header>

      <main className="flex-1 flex items-center justify-center px-4 py-8">
        <AnimatePresence mode="wait">
          {!revealed ? (
            <motion.div
              key="envelope"
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.8, rotateY: 90 }}
              transition={{ duration: 0.4 }}
              className="w-full max-w-sm"
            >
              <motion.button
                onClick={handleReveal}
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                data-testid="button-reveal-card"
                className="w-full aspect-[3/4] bg-gradient-to-br from-stone-800 via-stone-900 to-stone-950 rounded-3xl shadow-2xl flex flex-col items-center justify-center p-8 cursor-pointer group relative overflow-hidden"
              >
                <motion.div
                  initial={{ opacity: 0.3 }}
                  animate={{ opacity: [0.3, 0.5, 0.3] }}
                  transition={{ duration: 3, repeat: Infinity }}
                  className="absolute inset-0 bg-gradient-to-t from-amber-500/10 via-transparent to-white/5"
                />
                
                <motion.div
                  initial={{ y: 0 }}
                  animate={{ y: [0, -5, 0] }}
                  transition={{ duration: 2, repeat: Infinity }}
                  className="relative z-10"
                >
                  <div className="w-20 h-20 rounded-2xl bg-white/10 backdrop-blur flex items-center justify-center mb-6">
                    <Sparkles className="w-10 h-10 text-amber-300" />
                  </div>
                </motion.div>

                <p className="text-white/60 text-sm uppercase tracking-widest mb-2">A gift for</p>
                <h2 className="text-3xl font-light text-white mb-8">{card.recipientName}</h2>
                
                <div className="flex items-center gap-2 text-white/40 text-sm">
                  <span>from {card.fromName}</span>
                </div>

                <motion.div
                  initial={{ opacity: 0.6 }}
                  animate={{ opacity: [0.6, 1, 0.6] }}
                  transition={{ duration: 2, repeat: Infinity }}
                  className="absolute bottom-8 text-white/50 text-sm flex items-center gap-2"
                >
                  <span>Tap to reveal</span>
                </motion.div>
              </motion.button>
            </motion.div>
          ) : (
            <motion.div
              key="card"
              initial={{ opacity: 0, rotateY: -90 }}
              animate={{ opacity: 1, rotateY: 0 }}
              transition={{ duration: 0.5 }}
              className="w-full max-w-sm"
            >
              <div className="bg-white rounded-3xl shadow-2xl overflow-hidden">
                <div className="bg-gradient-to-br from-stone-800 to-stone-900 p-8 text-center relative overflow-hidden">
                  <motion.div
                    initial={{ scale: 0.5, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    transition={{ delay: 0.3, type: "spring" }}
                    className="relative z-10"
                  >
                    <motion.div
                      initial={{ scale: 0 }}
                      animate={{ scale: [0, 1.2, 1] }}
                      transition={{ delay: 0.5, duration: 0.5 }}
                      className="w-16 h-16 rounded-full bg-white/10 backdrop-blur flex items-center justify-center mx-auto mb-4"
                    >
                      <Heart className="w-8 h-8 text-rose-400" />
                    </motion.div>
                    
                    <p className="text-white/60 text-sm mb-1">{card.fromName} gifted</p>
                    <motion.p 
                      className="text-5xl font-light text-white tracking-tight"
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      transition={{ delay: 0.7 }}
                    >
                      <AnimatedValue value={card.amount} />
                    </motion.p>
                    <p className="text-white/60 text-sm mt-2">to {card.recipientName}'s Fund</p>
                  </motion.div>

                  <motion.div 
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 0.2 }}
                    transition={{ delay: 1 }}
                    className="absolute inset-0 pointer-events-none"
                  >
                    {[...Array(20)].map((_, i) => (
                      <motion.div
                        key={i}
                        initial={{ 
                          x: Math.random() * 400 - 200, 
                          y: -20,
                          rotate: Math.random() * 360 
                        }}
                        animate={{ 
                          y: 400,
                          rotate: Math.random() * 360 + 360
                        }}
                        transition={{ 
                          duration: Math.random() * 3 + 2,
                          delay: 0.5 + Math.random() * 0.5,
                          ease: "linear"
                        }}
                        className="absolute w-2 h-2 rounded-full bg-amber-300"
                        style={{ left: `${Math.random() * 100}%` }}
                      />
                    ))}
                  </motion.div>
                </div>

                <div className="p-6 space-y-6">
                  {card.message && (
                    <motion.div
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 1 }}
                      className="bg-stone-50 rounded-xl p-4"
                    >
                      <div className="flex items-start gap-3">
                        <MessageCircle className="w-5 h-5 text-stone-400 mt-0.5 shrink-0" />
                        <p className="text-stone-600 text-sm leading-relaxed italic">
                          "{card.message}"
                        </p>
                      </div>
                    </motion.div>
                  )}

                  <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 1.2 }}
                  >
                    <p className="text-xs text-stone-400 uppercase tracking-wider mb-2">Growing in</p>
                    <div className="flex gap-2">
                      {card.investedIn.map((asset) => (
                        <div 
                          key={asset.name}
                          className="flex-1 p-3 rounded-lg bg-stone-50 text-center"
                        >
                          <span className="text-lg block mb-1">{asset.emoji}</span>
                          <span className="text-xs text-stone-600">{asset.name}</span>
                        </div>
                      ))}
                    </div>
                  </motion.div>

                  <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 1.4 }}
                    className="bg-gradient-to-r from-emerald-50 to-teal-50 rounded-xl p-4 border border-emerald-100"
                  >
                    <p className="text-xs text-emerald-600 font-medium mb-1">Time will grow this gift</p>
                    <p className="text-sm text-stone-600">
                      <span className="font-semibold text-emerald-700">${projectedValue.toLocaleString()}</span>
                      {" "}projected in 18 years
                    </p>
                    <p className="text-xs text-stone-400 mt-1">Based on historical market returns</p>
                  </motion.div>

                  <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 1.6 }}
                    className="flex gap-2"
                  >
                    <Button
                      onClick={handleShare}
                      data-testid="button-share-card"
                      className="flex-1 bg-stone-900 text-white hover:bg-stone-800"
                    >
                      <Share2 className="w-4 h-4 mr-2" />
                      Share
                    </Button>
                    <Button
                      onClick={handleCopy}
                      data-testid="button-copy-link"
                      variant="outline"
                      className="flex-1"
                    >
                      {copied ? (
                        <>
                          <Check className="w-4 h-4 mr-2" />
                          Copied
                        </>
                      ) : (
                        <>
                          <Copy className="w-4 h-4 mr-2" />
                          Copy link
                        </>
                      )}
                    </Button>
                  </motion.div>

                  <motion.p
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 1.8 }}
                    className="text-center text-xs text-stone-400"
                  >
                    For {card.eventName} · Assets held by Apex Clearing
                  </motion.p>
                </div>
              </div>

              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 2 }}
                className="mt-6 text-center"
              >
                <Link href="/get-started">
                  <span className="text-sm text-stone-500 hover:text-stone-700 underline cursor-pointer">
                    Create your own gift fund
                  </span>
                </Link>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Share Modal (fallback for desktop) */}
        <AnimatePresence>
          {showShareModal && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/50 flex items-end sm:items-center justify-center z-50 p-4"
              onClick={() => setShowShareModal(false)}
            >
              <motion.div
                initial={{ y: 100, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                exit={{ y: 100, opacity: 0 }}
                onClick={(e) => e.stopPropagation()}
                className="bg-white rounded-2xl w-full max-w-sm p-6 space-y-4"
              >
                <h3 className="text-lg font-medium text-stone-900 text-center">Share this gift</h3>
                
                <div className="grid grid-cols-4 gap-3">
                  <a
                    href={`https://twitter.com/intent/tweet?text=${encodeURIComponent(shareText)}&url=${encodeURIComponent(shareUrl)}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex flex-col items-center gap-2 p-3 rounded-xl hover:bg-stone-50 transition-colors"
                  >
                    <div className="w-12 h-12 rounded-full bg-stone-900 flex items-center justify-center text-white text-lg">𝕏</div>
                    <span className="text-xs text-stone-600">X</span>
                  </a>
                  <a
                    href={`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(shareUrl)}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex flex-col items-center gap-2 p-3 rounded-xl hover:bg-stone-50 transition-colors"
                  >
                    <div className="w-12 h-12 rounded-full bg-blue-600 flex items-center justify-center text-white text-lg font-bold">f</div>
                    <span className="text-xs text-stone-600">Facebook</span>
                  </a>
                  <a
                    href={`https://wa.me/?text=${encodeURIComponent(shareText + ' ' + shareUrl)}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex flex-col items-center gap-2 p-3 rounded-xl hover:bg-stone-50 transition-colors"
                  >
                    <div className="w-12 h-12 rounded-full bg-green-500 flex items-center justify-center text-white text-lg">💬</div>
                    <span className="text-xs text-stone-600">WhatsApp</span>
                  </a>
                  <a
                    href={`mailto:?subject=${encodeURIComponent(`${card.fromName} sent a gift!`)}&body=${encodeURIComponent(shareText + '\n\n' + shareUrl)}`}
                    className="flex flex-col items-center gap-2 p-3 rounded-xl hover:bg-stone-50 transition-colors"
                  >
                    <div className="w-12 h-12 rounded-full bg-stone-400 flex items-center justify-center text-white text-lg">✉</div>
                    <span className="text-xs text-stone-600">Email</span>
                  </a>
                </div>

                <div className="pt-2">
                  <div className="flex items-center gap-2 p-3 bg-stone-50 rounded-lg">
                    <input
                      type="text"
                      readOnly
                      value={shareUrl}
                      className="flex-1 bg-transparent text-sm text-stone-600 outline-none truncate"
                    />
                    <Button
                      onClick={() => {
                        navigator.clipboard?.writeText(shareUrl);
                        toast({ title: "Link copied!" });
                      }}
                      size="sm"
                      variant="outline"
                      data-testid="button-modal-copy"
                    >
                      {copied ? "Copied" : "Copy"}
                    </Button>
                  </div>
                </div>

                <Button
                  onClick={() => setShowShareModal(false)}
                  variant="ghost"
                  className="w-full"
                  data-testid="button-close-share"
                >
                  Done
                </Button>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
      </main>
    </div>
  );
}
