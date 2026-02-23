import { useParams } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { Heart, Sparkles, Star, TreeDeciduous, Users, ChevronLeft } from "lucide-react";
import { GeminiSparkle, SparkleBurst, GradientText, EnlighteningReveal } from "@/components/ui/gemini";
import { haptic } from "@/lib/haptics";
import { Logo } from "@/components/ui/logo";
import mascot from "@/assets/kora-mascot.png";
import { useState } from "react";

function useFundData(fundId: string) {
  return useQuery({
    queryKey: ["kid-fund", fundId],
    queryFn: async () => {
      const res = await fetch(`/api/public/funds/${fundId}/overview`);
      if (!res.ok) throw new Error("Could not load your garden");
      return res.json();
    },
    enabled: !!fundId,
  });
}

function useGiftsData(fundId: string) {
  return useQuery({
    queryKey: ["kid-gifts", fundId],
    queryFn: async () => {
      const res = await fetch(`/api/public/funds/${fundId}/gifts`);
      if (!res.ok) throw new Error("Could not load gifts");
      return res.json();
    },
    enabled: !!fundId,
  });
}

function useMemoryData(fundId: string) {
  return useQuery({
    queryKey: ["kid-memory", fundId],
    queryFn: async () => {
      const res = await fetch(`/api/public/funds/${fundId}/memory`);
      if (!res.ok) throw new Error("Could not load memories");
      return res.json();
    },
    enabled: !!fundId,
  });
}

function GrowthPlant({ growthPercent }: { growthPercent: number }) {
  const clampedGrowth = Math.min(Math.max(growthPercent, 0), 100);
  const stemHeight = 20 + (clampedGrowth / 100) * 80;

  return (
    <div className="flex flex-col items-center" data-testid="growth-plant">
      <motion.div
        className="relative flex flex-col items-center"
        initial={{ opacity: 0, scale: 0.8 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
      >
        {clampedGrowth >= 50 && (
          <motion.div
            className="absolute -top-2 left-1/2 -translate-x-1/2"
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ delay: 0.8, type: "spring", stiffness: 200 }}
          >
            <TreeDeciduous className="w-16 h-16 text-emerald-500" />
          </motion.div>
        )}

        {clampedGrowth >= 25 && clampedGrowth < 50 && (
          <motion.div
            className="absolute -top-1"
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ delay: 0.6, type: "spring" }}
          >
            <span className="text-3xl">🌿</span>
          </motion.div>
        )}

        {clampedGrowth < 25 && (
          <motion.div
            className="absolute -top-1"
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ delay: 0.4, type: "spring" }}
          >
            <span className="text-2xl">🌱</span>
          </motion.div>
        )}

        <div className="w-4 bg-emerald-200 rounded-full overflow-hidden mt-8" style={{ height: 120 }}>
          <motion.div
            className="w-full bg-gradient-to-t from-emerald-600 to-emerald-400 rounded-full"
            initial={{ height: 0 }}
            animate={{ height: `${stemHeight}%` }}
            transition={{ duration: 1.5, delay: 0.3, ease: [0.16, 1, 0.3, 1] }}
            style={{ position: "absolute", bottom: 0 }}
          />
          <motion.div
            className="absolute bottom-0 w-full bg-gradient-to-t from-emerald-600 to-emerald-400 rounded-full"
            initial={{ height: "0%" }}
            animate={{ height: `${stemHeight}%` }}
            transition={{ duration: 1.5, delay: 0.3, ease: [0.16, 1, 0.3, 1] }}
          />
        </div>

        <motion.div
          className="w-10 h-10 bg-amber-100 rounded-full flex items-center justify-center border-2 border-amber-300 mt-1"
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ delay: 0.2, type: "spring", stiffness: 300 }}
        >
          <span className="text-lg">🌰</span>
        </motion.div>
      </motion.div>
    </div>
  );
}

function MilestoneBadge({ label, icon, achieved }: { label: string; icon: string; achieved: boolean }) {
  const [showBurst, setShowBurst] = useState(achieved);

  if (!achieved) return null;

  return (
    <motion.div
      className="relative flex flex-col items-center gap-2"
      initial={{ scale: 0, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      transition={{ type: "spring", stiffness: 200, damping: 15 }}
      onClick={() => {
        haptic("medium");
        setShowBurst(true);
        setTimeout(() => setShowBurst(false), 800);
      }}
      data-testid={`milestone-badge-${label.toLowerCase().replace(/\s+/g, "-")}`}
    >
      <div className="relative">
        <div className="w-16 h-16 rounded-full bg-gradient-to-br from-amber-100 to-amber-200 border-2 border-amber-400 flex items-center justify-center shadow-lg cursor-pointer">
          <span className="text-2xl">{icon}</span>
        </div>
        <SparkleBurst active={showBurst} />
        <motion.div
          className="absolute -top-1 -right-1"
          animate={{ rotate: [0, 15, -15, 0] }}
          transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
        >
          <GeminiSparkle size={16} />
        </motion.div>
      </div>
      <span className="text-xs font-semibold text-amber-700 text-center max-w-[80px]">{label}</span>
    </motion.div>
  );
}

export default function KidView() {
  const params = useParams<{ fundId: string }>();
  const fundId = params.fundId || "";

  const { data: fund, isLoading: fundLoading, error: fundError } = useFundData(fundId);
  const { data: giftsData } = useGiftsData(fundId);
  const { data: memoryData } = useMemoryData(fundId);

  const gifts = Array.isArray(giftsData) ? giftsData : giftsData?.gifts || [];
  const memories = Array.isArray(memoryData) ? memoryData : memoryData?.entries || [];

  const balance = fund?.balance || fund?.totalValue || 0;
  const totalContributed = fund?.totalContributed || fund?.contributions || balance;
  const growthPercent = totalContributed > 0
    ? Math.round(((balance - totalContributed) / totalContributed) * 100)
    : 0;
  const displayGrowth = Math.max(growthPercent, 0);

  const contributorCount = gifts.length > 0
    ? new Set(gifts.map((g: any) => g.senderName || g.sender || g.from)).size
    : 0;

  const recentGifts = gifts.slice(0, 5);
  const recentMemories = memories.slice(0, 3);

  const hit25 = displayGrowth >= 25;
  const hit50 = displayGrowth >= 50;
  const hit100 = displayGrowth >= 100;

  if (fundLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-emerald-50 via-green-50 to-amber-50 flex items-center justify-center" data-testid="kid-view-loading">
        <motion.div
          className="flex flex-col items-center gap-4"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
        >
          <motion.img
            src={mascot}
            alt="Kora mascot"
            className="w-24 h-auto"
            animate={{ y: [0, -10, 0] }}
            transition={{ duration: 1.5, repeat: Infinity, ease: "easeInOut" }}
          />
          <p className="text-lg font-semibold text-emerald-700">Growing your garden...</p>
        </motion.div>
      </div>
    );
  }

  if (fundError) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-emerald-50 via-green-50 to-amber-50 flex items-center justify-center p-6" data-testid="kid-view-error">
        <div className="text-center space-y-4">
          <img src={mascot} alt="Kora mascot" className="w-20 h-auto mx-auto opacity-60" />
          <p className="text-lg text-emerald-800">Oops! We could not find your garden right now.</p>
          <p className="text-sm text-emerald-600">Try again in a little bit!</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-emerald-50 via-green-50 to-amber-50" data-testid="kid-view">
      <div className="sticky top-0 z-40 h-14 flex items-center px-4 bg-emerald-50/80 backdrop-blur-lg">
        <button
          onClick={() => window.history.back()}
          className="flex items-center gap-1 text-emerald-700 hover:text-emerald-900 transition-colors"
          data-testid="button-back"
        >
          <ChevronLeft size={20} />
          <span className="text-sm">Back</span>
        </button>
        <div className="flex-1" />
        <Logo size="sm" className="text-emerald-800" />
      </div>
      <div className="max-w-lg mx-auto px-5 py-8 space-y-8">

        <EnlighteningReveal>
          <div className="flex flex-col items-center text-center gap-4" data-testid="kid-header">
            <motion.img
              src={mascot}
              alt="Kora mascot"
              className="w-28 h-auto drop-shadow-lg"
              data-testid="img-mascot"
              initial={{ y: 20, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ duration: 0.6 }}
              whileHover={{ scale: 1.05, rotate: 3 }}
            />
            <div className="space-y-1">
              <h1 className="font-heading text-3xl text-emerald-900" data-testid="text-garden-title">
                <GradientText>Your Growing Garden</GradientText>
              </h1>
              {fund?.name && (
                <p className="text-emerald-600 text-sm" data-testid="text-fund-name">
                  {fund.name}'s Garden
                </p>
              )}
            </div>
          </div>
        </EnlighteningReveal>

        <EnlighteningReveal delay={0.15}>
          <motion.div
            className="bg-white/80 backdrop-blur-sm rounded-3xl p-6 shadow-sm border border-emerald-100 text-center space-y-5"
            data-testid="growth-section"
          >
            <div className="flex items-center justify-center gap-2 mb-2">
              <Sparkles className="w-5 h-5 text-amber-500" />
              <h2 className="font-heading text-xl text-emerald-800">How Your Seed is Growing</h2>
              <Sparkles className="w-5 h-5 text-amber-500" />
            </div>

            <GrowthPlant growthPercent={displayGrowth} />

            <div className="relative inline-block">
              <motion.p
                className="text-2xl font-bold text-emerald-700"
                data-testid="text-growth-percent"
                initial={{ scale: 0.8, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ delay: 0.5, type: "spring" }}
              >
                Your garden has grown {displayGrowth}%!
              </motion.p>
              {displayGrowth > 0 && (
                <SparkleBurst active={true} className="z-20" />
              )}
            </div>

            <div className="w-full bg-emerald-100 rounded-full h-4 overflow-hidden" data-testid="growth-progress-bar">
              <motion.div
                className="h-full bg-gradient-to-r from-emerald-500 via-emerald-400 to-amber-400 rounded-full relative"
                initial={{ width: "0%" }}
                animate={{ width: `${Math.min(displayGrowth, 100)}%` }}
                transition={{ duration: 1.5, delay: 0.5, ease: [0.16, 1, 0.3, 1] }}
              >
                <motion.div
                  className="absolute right-0 top-1/2 -translate-y-1/2 w-3 h-3"
                  animate={{ scale: [1, 1.3, 1] }}
                  transition={{ duration: 1, repeat: Infinity }}
                >
                  <span className="text-xs">🌱</span>
                </motion.div>
              </motion.div>
            </div>
          </motion.div>
        </EnlighteningReveal>

        {gifts.length > 0 && (
          <EnlighteningReveal delay={0.25}>
            <div className="bg-white/80 backdrop-blur-sm rounded-3xl p-6 shadow-sm border border-emerald-100 space-y-4" data-testid="gifts-section">
              <div className="flex items-center gap-2">
                <Users className="w-5 h-5 text-emerald-600" />
                <h2 className="font-heading text-xl text-emerald-800">Seeds in Your Garden</h2>
              </div>

              <motion.p
                className="text-lg text-emerald-700 font-semibold"
                data-testid="text-contributor-summary"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.3 }}
              >
                {contributorCount} {contributorCount === 1 ? "person has" : "people have"} planted seeds in your garden!
              </motion.p>

              <div className="space-y-3">
                {recentGifts.map((gift: any, index: number) => {
                  const name = gift.senderName || gift.sender || gift.from || "Someone special";
                  const amount = gift.amount || gift.value || 0;
                  return (
                    <motion.div
                      key={gift.id || index}
                      className="flex items-center gap-3 bg-gradient-to-r from-emerald-50 to-amber-50 rounded-2xl p-4 border border-emerald-100"
                      data-testid={`card-gift-${index}`}
                      initial={{ x: -20, opacity: 0 }}
                      animate={{ x: 0, opacity: 1 }}
                      transition={{ delay: 0.1 * index + 0.4 }}
                    >
                      <div className="w-10 h-10 rounded-full bg-emerald-100 flex items-center justify-center flex-shrink-0">
                        <span className="text-lg">🌱</span>
                      </div>
                      <p className="text-emerald-800 font-medium text-sm" data-testid={`text-gift-${index}`}>
                        {name} planted a {amount} seed!
                      </p>
                      <Star className="w-4 h-4 text-amber-400 flex-shrink-0 ml-auto" />
                    </motion.div>
                  );
                })}
              </div>
            </div>
          </EnlighteningReveal>
        )}

        {recentMemories.length > 0 && (
          <EnlighteningReveal delay={0.35}>
            <div className="bg-white/80 backdrop-blur-sm rounded-3xl p-6 shadow-sm border border-emerald-100 space-y-4" data-testid="memory-section">
              <div className="flex items-center gap-2">
                <Heart className="w-5 h-5 text-rose-400" />
                <h2 className="font-heading text-xl text-emerald-800">Memory Book</h2>
              </div>

              <div className="space-y-3">
                {recentMemories.map((entry: any, index: number) => {
                  const author = entry.authorName || entry.author || entry.from || "Someone";
                  const message = entry.message || entry.content || entry.text || "";
                  return (
                    <motion.div
                      key={entry.id || index}
                      className="bg-gradient-to-r from-rose-50 to-amber-50 rounded-2xl p-4 border border-rose-100"
                      data-testid={`card-memory-${index}`}
                      initial={{ y: 10, opacity: 0 }}
                      animate={{ y: 0, opacity: 1 }}
                      transition={{ delay: 0.1 * index + 0.4 }}
                    >
                      <p className="text-emerald-800 text-sm italic" data-testid={`text-memory-${index}`}>
                        {author} said: "{message}"
                      </p>
                    </motion.div>
                  );
                })}
              </div>

              <motion.a
                href={`/memory/${fundId}`}
                className="inline-flex items-center gap-2 text-emerald-600 font-semibold text-sm hover:text-emerald-700 transition-colors"
                data-testid="link-memory-book"
                whileHover={{ x: 4 }}
                onClick={() => haptic("light")}
              >
                See your full Memory Book
                <Sparkles className="w-4 h-4" />
              </motion.a>
            </div>
          </EnlighteningReveal>
        )}

        {(hit25 || hit50 || hit100) && (
          <EnlighteningReveal delay={0.45}>
            <div className="bg-white/80 backdrop-blur-sm rounded-3xl p-6 shadow-sm border border-amber-100 space-y-4" data-testid="milestones-section">
              <div className="flex items-center gap-2">
                <Star className="w-5 h-5 text-amber-500" />
                <h2 className="font-heading text-xl text-amber-800">Your Achievements</h2>
              </div>

              <div className="flex justify-center gap-6 flex-wrap">
                <MilestoneBadge
                  label="First Sprout"
                  icon="🌱"
                  achieved={hit25}
                />
                <MilestoneBadge
                  label="Growing Strong"
                  icon="🌿"
                  achieved={hit50}
                />
                <MilestoneBadge
                  label="Garden Doubled!"
                  icon="🌳"
                  achieved={hit100}
                />
              </div>

              {hit100 && (
                <motion.p
                  className="text-center text-lg font-bold text-amber-700"
                  data-testid="text-milestone-celebration"
                  initial={{ scale: 0 }}
                  animate={{ scale: [0, 1.1, 1] }}
                  transition={{ delay: 0.6, duration: 0.5 }}
                >
                  Your garden doubled! Amazing!
                </motion.p>
              )}
            </div>
          </EnlighteningReveal>
        )}

        <EnlighteningReveal delay={0.55}>
          <motion.div
            className="text-center py-6 space-y-2"
            data-testid="kid-footer"
          >
            <div className="flex items-center justify-center gap-2">
              <Heart className="w-5 h-5 text-rose-400 fill-rose-400" />
              <p className="text-emerald-700 font-medium text-sm">
                Powered by your amazing family and friends
              </p>
              <Heart className="w-5 h-5 text-rose-400 fill-rose-400" />
            </div>
            <div className="flex justify-center gap-1">
              {[0, 1, 2].map((i) => (
                <GeminiSparkle key={i} size={14} delay={i * 0.2} />
              ))}
            </div>
          </motion.div>
        </EnlighteningReveal>

      </div>
    </div>
  );
}