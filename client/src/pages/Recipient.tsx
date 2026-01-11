import { Card, CardContent } from "@/components/ui/card";
import { motion } from "framer-motion";
import { useSearch, Link } from "wouter";
import { useState, useEffect } from "react";
import { TrendingUp, Heart, Sparkles, Star } from "lucide-react";
import { Logo } from "@/components/ui/logo";

function AnimatedValue({ value, prefix = "$" }: { value: number; prefix?: string }) {
  const [display, setDisplay] = useState(0);
  useEffect(() => {
    const duration = 1000;
    const start = 0;
    const diff = value - start;
    const startTime = Date.now();
    const animate = () => {
      const elapsed = Date.now() - startTime;
      const progress = Math.min(elapsed / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      setDisplay(Math.round(start + diff * eased));
      if (progress < 1) requestAnimationFrame(animate);
    };
    animate();
  }, [value]);
  return <span>{prefix}{display.toLocaleString()}</span>;
}

export default function Recipient() {
  const search = useSearch();
  const params = new URLSearchParams(search);
  const recipientName = decodeURIComponent(params.get("name") || "Mila");
  const totalValue = Number(params.get("value")) || 4250;
  const contributorCount = Number(params.get("contributors")) || 18;

  const milestones = [
    { amount: 500, label: "First $500", reached: true, date: "Jan 2024" },
    { amount: 1000, label: "$1,000", reached: true, date: "Mar 2024" },
    { amount: 2500, label: "$2,500", reached: true, date: "Aug 2024" },
    { amount: 5000, label: "$5,000", reached: false, date: null },
    { amount: 10000, label: "$10,000", reached: false, date: null },
  ];

  const messages = [
    { from: "Uncle Dave", message: "So proud of you, kiddo! This is just the beginning.", amount: 180 },
    { from: "Grandma Ruth", message: "For your future, with all my love. Can't wait to see who you become.", amount: 500 },
    { from: "The Cohens", message: "Here's to many more milestones!", amount: 100 },
    { from: "Aunt Lisa", message: "Can't wait to see all you accomplish!", amount: 75 },
    { from: "The Goldbergs", message: "Wishing you the best!", amount: 50 },
  ];

  const supporters = [
    "Uncle Dave", "Grandma Ruth", "The Cohens", "Aunt Lisa", 
    "The Goldbergs", "Cousin Jake", "Mom & Dad", "Nana", 
    "The Petersons", "Aunt Maya"
  ];

  const holdings = [
    { name: "Disney", emoji: "🏰" },
    { name: "Apple", emoji: "🍎" },
    { name: "US Market", emoji: "📈" },
  ];

  return (
    <div className="min-h-screen bg-gradient-to-b from-stone-50 to-stone-100">
      <header className="sticky top-0 z-50 bg-stone-50/95 backdrop-blur-sm border-b border-stone-200">
        <div className="max-w-lg mx-auto px-4 h-14 flex items-center justify-between">
          <Logo size="sm" className="text-stone-900" />
          <span className="text-xs text-stone-400">{recipientName}'s Story</span>
        </div>
      </header>
      
      <main className="max-w-lg mx-auto px-4 py-10">
        <motion.div 
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="text-center mb-10"
        >
          <motion.div 
            initial={{ scale: 0.9 }}
            animate={{ scale: 1 }}
            transition={{ type: "spring", stiffness: 200, damping: 15 }}
            className="mx-auto mb-5 h-20 w-20 rounded-full bg-gradient-to-br from-stone-800 to-stone-900 text-stone-50 flex items-center justify-center text-3xl font-light shadow-lg"
          >
            {recipientName.charAt(0)}
          </motion.div>
          <h1 className="text-2xl font-light text-stone-900 tracking-tight">{recipientName}'s Fund</h1>
          <p className="text-stone-500 text-sm mt-1">Your future is growing</p>
        </motion.div>

        <motion.div 
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.2, duration: 0.5 }}
          className="text-center mb-10 p-8 rounded-2xl bg-white border border-stone-200 shadow-sm"
        >
          <p className="text-5xl font-light text-stone-900 tracking-tight mb-2">
            <AnimatedValue value={totalValue} />
          </p>
          <div className="flex items-center justify-center gap-2">
            <TrendingUp className="h-4 w-4 text-primary" />
            <span className="text-sm text-primary font-medium">Growing for your future</span>
          </div>
          <p className="text-xs text-stone-400 mt-3">{contributorCount} people believe in you</p>
        </motion.div>

        <motion.div 
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.3 }}
          className="mb-10"
        >
          <div className="flex items-center gap-2 mb-4">
            <Sparkles className="h-4 w-4 text-stone-400" />
            <h2 className="text-sm font-medium text-stone-900">What you own</h2>
          </div>
          <div className="flex gap-3">
            {holdings.map((holding, i) => (
              <motion.div
                key={holding.name}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.4 + i * 0.1 }}
                className="flex-1 p-4 rounded-xl bg-white border border-stone-200 text-center"
              >
                <span className="text-2xl mb-2 block">{holding.emoji}</span>
                <p className="text-xs text-stone-600">{holding.name}</p>
              </motion.div>
            ))}
          </div>
        </motion.div>

        <motion.div 
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.4 }}
          className="mb-10"
        >
          <div className="flex items-center gap-2 mb-4">
            <Star className="h-4 w-4 text-stone-400" />
            <h2 className="text-sm font-medium text-stone-900">Milestones</h2>
          </div>
          <div className="relative">
            <div className="absolute left-3 top-3 bottom-3 w-0.5 bg-stone-200" />
            <div className="space-y-3">
              {milestones.map((milestone, i) => (
                <motion.div
                  key={milestone.amount}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.5 + i * 0.08 }}
                  className="flex items-center gap-3 pl-1"
                >
                  <div className={`w-5 h-5 rounded-full flex items-center justify-center z-10 ${
                    milestone.reached 
                      ? "bg-emerald-500 text-white" 
                      : "bg-stone-200 text-stone-400"
                  }`}>
                    {milestone.reached && <span className="text-xs">✓</span>}
                  </div>
                  <div className="flex-1">
                    <p className={`text-sm ${milestone.reached ? "text-stone-900" : "text-stone-400"}`}>
                      {milestone.label}
                    </p>
                    {milestone.date && (
                      <p className="text-xs text-stone-400">{milestone.date}</p>
                    )}
                  </div>
                </motion.div>
              ))}
            </div>
          </div>
        </motion.div>

        <motion.div 
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.5 }}
          className="mb-10"
        >
          <div className="flex items-center gap-2 mb-4">
            <Heart className="h-4 w-4 text-stone-400" />
            <h2 className="text-sm font-medium text-stone-900">Messages from people who love you</h2>
          </div>
          <div className="space-y-3">
            {messages.map((item, i) => (
              <motion.div 
                key={i} 
                initial={{ opacity: 0, x: -10 }} 
                animate={{ opacity: 1, x: 0 }} 
                transition={{ delay: 0.6 + i * 0.08 }}
              >
                <Card className="border border-stone-200 hover:border-stone-300 transition-colors bg-white">
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between mb-1">
                      <p className="font-medium text-sm text-stone-900">{item.from}</p>
                      <span className="text-xs text-emerald-600 font-medium">+${item.amount}</span>
                    </div>
                    <p className="text-sm text-stone-500 leading-relaxed">{item.message}</p>
                  </CardContent>
                </Card>
              </motion.div>
            ))}
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.7 }}
          className="mb-10"
        >
          <h2 className="text-sm font-medium text-stone-900 mb-4">Your supporters</h2>
          <div className="flex flex-wrap gap-2">
            {supporters.map((name, i) => (
              <motion.span 
                key={name}
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: 0.8 + i * 0.03 }}
                className="inline-flex items-center gap-2 bg-white border border-stone-200 rounded-full px-3 py-1.5 text-sm"
              >
                <span className="h-5 w-5 rounded-full bg-stone-100 flex items-center justify-center text-xs font-medium text-stone-600">
                  {name.charAt(0)}
                </span>
                <span className="text-stone-700">{name}</span>
              </motion.span>
            ))}
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.9 }}
          className="text-center pt-6 border-t border-stone-200"
        >
          <p className="text-xs text-stone-400 mb-2">
            Your fund is invested for long-term growth
          </p>
          <p className="text-[10px] text-stone-300">
            Assets held by Apex Clearing, member FINRA/SIPC
          </p>
        </motion.div>
      </main>
    </div>
  );
}
