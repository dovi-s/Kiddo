import { Nav } from "@/components/layout/Nav";
import { Card, CardContent } from "@/components/ui/card";
import { motion } from "framer-motion";
import { useSearch } from "wouter";
import { useState, useEffect } from "react";
import { TrendingUp, Heart } from "lucide-react";

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
  const recipientName = decodeURIComponent(params.get("name") || "Ari");
  const totalValue = Number(params.get("value")) || 4250;
  const contributorCount = Number(params.get("contributors")) || 18;

  const messages = [
    { from: "Uncle Dave", message: "Congrats! So proud of you." },
    { from: "Grandma Ruth", message: "For your future, with all my love." },
    { from: "The Cohens", message: "Here's to many more milestones!" },
    { from: "Aunt Lisa", message: "Can't wait to see all you accomplish!" },
    { from: "The Goldbergs", message: "Wishing you the best!" },
  ];

  const people = ["Uncle Dave", "Grandma Ruth", "The Cohens", "Aunt Lisa", "The Goldbergs", "Cousin Jake", "Mom & Dad"];

  return (
    <div className="min-h-screen bg-background">
      <Nav />
      
      <main className="container mx-auto px-4 py-12 max-w-md">
        {/* Header */}
        <motion.div 
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="text-center mb-12"
        >
          <motion.div 
            initial={{ scale: 0.9 }}
            animate={{ scale: 1 }}
            transition={{ type: "spring", stiffness: 200, damping: 15 }}
            className="mx-auto mb-5 h-16 w-16 rounded-full bg-foreground text-background flex items-center justify-center text-2xl font-semibold"
          >
            {recipientName.charAt(0)}
          </motion.div>
          <h1 className="text-2xl font-semibold text-foreground tracking-tight">{recipientName}'s Fund</h1>
          <p className="text-muted-foreground text-sm mt-2">{contributorCount} people in your corner</p>
        </motion.div>

        {/* Value */}
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2, duration: 0.5 }}
          className="text-center mb-12"
        >
          <p className="text-5xl font-semibold text-foreground tracking-tight">
            <AnimatedValue value={totalValue} />
          </p>
          <div className="flex items-center justify-center gap-2 mt-3">
            <TrendingUp className="h-4 w-4 text-green-600" />
            <span className="text-sm text-green-600 font-medium">Growing</span>
          </div>
        </motion.div>

        {/* Messages */}
        <motion.div 
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.3 }}
          className="mb-10"
        >
          <div className="flex items-center gap-2 mb-4">
            <Heart className="h-4 w-4 text-muted-foreground" />
            <h2 className="font-semibold tracking-tight">Messages</h2>
          </div>
          <div className="space-y-3">
            {messages.map((item, i) => (
              <motion.div 
                key={i} 
                initial={{ opacity: 0, x: -10 }} 
                animate={{ opacity: 1, x: 0 }} 
                transition={{ delay: 0.4 + i * 0.08 }}
                whileHover={{ x: 4 }}
              >
                <Card className="border hover:border-foreground/20 transition-colors">
                  <CardContent className="p-4">
                    <p className="font-medium text-sm">{item.from}</p>
                    <p className="text-sm text-muted-foreground mt-1">{item.message}</p>
                  </CardContent>
                </Card>
              </motion.div>
            ))}
          </div>
        </motion.div>

        {/* People */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.6 }}
        >
          <h2 className="font-semibold tracking-tight mb-4">Your supporters</h2>
          <div className="flex flex-wrap gap-2">
            {people.map((name, i) => (
              <motion.span 
                key={name}
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: 0.7 + i * 0.05 }}
                whileHover={{ scale: 1.05 }}
                className="inline-flex items-center gap-2 border rounded-full px-3 py-1.5 text-sm hover:bg-foreground/[0.03] transition-colors cursor-default"
              >
                <span className="h-5 w-5 rounded-full bg-foreground/10 flex items-center justify-center text-xs font-medium">
                  {name.charAt(0)}
                </span>
                {name}
              </motion.span>
            ))}
          </div>
        </motion.div>
      </main>
    </div>
  );
}
