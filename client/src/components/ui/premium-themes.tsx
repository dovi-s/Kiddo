import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
// Crown replaces Sparkles 2026-05-12 for the premium-theme indicator —
// Sparkles banned per feedback_no_ai_slop.md. Crown was already imported
// for premium-tier markings elsewhere; using it here keeps premium-tier
// iconography consistent.
import { Check, Lock, Crown } from "lucide-react";

export interface Theme {
  id: string;
  name: string;
  gradient: string;
  accent: string;
  textColor: string;
  isPremium: boolean;
  preview: string;
}

export const themes: Theme[] = [
  { 
    id: "classic", 
    name: "Classic", 
    gradient: "from-muted to-secondary", 
    accent: "primary",
    textColor: "foreground",
    isPremium: false,
    preview: "bg-gradient-to-br from-muted to-secondary"
  },
  { 
    id: "warm", 
    name: "Warm Sand", 
    gradient: "from-amber-50 via-orange-50 to-rose-50", 
    accent: "amber-600",
    textColor: "amber-900",
    isPremium: false,
    preview: "bg-gradient-to-br from-amber-50 via-orange-50 to-rose-50"
  },
  { 
    id: "ocean", 
    name: "Ocean Breeze", 
    gradient: "from-sky-50 via-cyan-50 to-teal-50", 
    accent: "cyan-600",
    textColor: "cyan-900",
    isPremium: true,
    preview: "bg-gradient-to-br from-sky-50 via-cyan-50 to-teal-50"
  },
  { 
    id: "sunset", 
    name: "Golden Sunset", 
    gradient: "from-rose-50 via-orange-50 to-amber-100", 
    accent: "rose-500",
    textColor: "rose-900",
    isPremium: true,
    preview: "bg-gradient-to-br from-rose-50 via-orange-50 to-amber-100"
  },
  { 
    id: "forest", 
    name: "Forest Whisper", 
    gradient: "from-emerald-50 via-green-50 to-teal-50", 
    accent: "emerald-600",
    textColor: "emerald-900",
    isPremium: true,
    preview: "bg-gradient-to-br from-emerald-50 via-green-50 to-teal-50"
  },
  { 
    id: "midnight", 
    name: "Midnight Luxe", 
    gradient: "from-slate-900 via-slate-800 to-slate-900", 
    accent: "amber-400",
    textColor: "white",
    isPremium: true,
    preview: "bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900"
  },
];

interface ThemeSelectorProps {
  selectedTheme: string;
  onSelectTheme: (themeId: string) => void;
  hasEventPass?: boolean;
  onUpgrade?: () => void;
}

export function ThemeSelector({ 
  selectedTheme, 
  onSelectTheme, 
  hasEventPass = false,
  onUpgrade 
}: ThemeSelectorProps) {
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-medium text-foreground">Page Theme</h3>
        {!hasEventPass && (
          <button
            onClick={onUpgrade}
            className="flex items-center gap-1.5 text-xs text-[hsl(var(--kiddo-gold))] hover:text-[hsl(var(--kiddo-gold))] font-medium"
          >
            <Crown size={12} />
            Upgrade to unlock
          </button>
        )}
      </div>
      
      <div className="grid grid-cols-3 gap-3">
        {themes.map((theme) => {
          const isLocked = theme.isPremium && !hasEventPass;
          const isSelected = selectedTheme === theme.id;
          
          return (
            <motion.button
              key={theme.id}
              onClick={() => {
                if (isLocked) {
                  onUpgrade?.();
                  return;
                }
                onSelectTheme(theme.id);
              }}
              whileHover={{ scale: isLocked ? 1 : 1.02 }}
              whileTap={{ scale: isLocked ? 1 : 0.98 }}
              data-testid={`theme-${theme.id}`}
              className={`relative aspect-[4/3] rounded-xl overflow-hidden transition-all ${
                isSelected 
                  ? "ring-2 ring-primary ring-offset-2" 
                  : isLocked 
                    ? "opacity-60 cursor-not-allowed" 
                    : "hover:shadow-md cursor-pointer"
              }`}
            >
              <div className={`absolute inset-0 ${theme.preview}`} />
              
              {isLocked && (
                <div className="absolute inset-0 bg-card/60 flex items-center justify-center">
                  <Lock size={16} className="text-muted-foreground" />
                </div>
              )}
              
              {isSelected && !isLocked && (
                <div className="absolute top-1.5 right-1.5 w-5 h-5 bg-primary rounded-full flex items-center justify-center">
                  <Check size={12} className="text-primary-foreground" />
                </div>
              )}
              
              {theme.isPremium && !isLocked && (
                <div className="absolute top-1.5 left-1.5">
                  <Crown size={12} className="text-[hsl(var(--kiddo-gold))]" />
                </div>
              )}
              
              <div className="absolute bottom-0 left-0 right-0 px-2 py-1.5 bg-gradient-to-t from-black/20 to-transparent">
                <p className={`text-[10px] font-medium ${theme.id === 'midnight' ? 'text-white' : 'text-foreground'}`}>
                  {theme.name}
                </p>
              </div>
            </motion.button>
          );
        })}
      </div>
    </div>
  );
}

interface GoalCardProps {
  goalAmount: number;
  currentAmount: number;
  recipientName: string;
  eventTitle: string;
  contributorCount: number;
}

export function GoalCard({ 
  goalAmount, 
  currentAmount, 
  recipientName, 
  eventTitle,
  contributorCount 
}: GoalCardProps) {
  const progress = Math.min((currentAmount / goalAmount) * 100, 100);
  const remaining = Math.max(goalAmount - currentAmount, 0);
  
  return (
    <motion.div 
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-[hsl(var(--kiddo-gold))]/5 rounded-2xl p-6 border border-[hsl(var(--kiddo-gold))]/10 shadow-sm"
    >
      <div className="flex items-center gap-2 mb-4">
        <div className="w-8 h-8 rounded-full bg-[hsl(var(--kiddo-gold))]/10 flex items-center justify-center">
          <Crown className="w-4 h-4 text-[hsl(var(--kiddo-gold))]" />
        </div>
        <div>
          <p className="text-xs text-[hsl(var(--kiddo-gold))] font-medium uppercase tracking-wider">Group Goal</p>
          <p className="text-sm font-medium text-foreground">{eventTitle}</p>
        </div>
      </div>
      
      <div className="mb-4">
        <div className="flex items-baseline gap-2 mb-2">
          <span className="text-3xl font-semibold text-foreground">${currentAmount.toLocaleString()}</span>
          <span className="text-muted-foreground">of ${goalAmount.toLocaleString()}</span>
        </div>
        <div className="h-3 bg-card rounded-full overflow-hidden shadow-inner">
          <motion.div 
            className="h-full bg-[hsl(var(--kiddo-gold))] rounded-full"
            initial={{ width: 0 }}
            animate={{ width: `${progress}%` }}
            transition={{ delay: 0.3, duration: 1, ease: "easeOut" }}
          />
        </div>
      </div>
      
      <div className="flex items-center justify-between text-sm">
        <div className="flex items-center gap-2">
          <div className="flex -space-x-2">
            {[...Array(Math.min(contributorCount, 4))].map((_, i) => (
              <div 
                key={i}
                className="w-6 h-6 rounded-full bg-card border-2 border-[hsl(var(--kiddo-gold))]/10 flex items-center justify-center text-[10px] font-medium text-muted-foreground"
              >
                {String.fromCharCode(65 + i)}
              </div>
            ))}
            {contributorCount > 4 && (
              <div className="w-6 h-6 rounded-full bg-[hsl(var(--kiddo-gold))]/10 border-2 border-[hsl(var(--kiddo-gold))]/10 flex items-center justify-center text-[10px] font-medium text-[hsl(var(--kiddo-gold))]">
                +{contributorCount - 4}
              </div>
            )}
          </div>
          <span className="text-muted-foreground">{contributorCount} contributors</span>
        </div>
        <span className="text-[hsl(var(--kiddo-gold))] font-medium">${remaining.toLocaleString()} to go</span>
      </div>
    </motion.div>
  );
}

interface EventPassBadgeProps {
  size?: "sm" | "md";
}

export function EventPassBadge({ size = "md" }: EventPassBadgeProps) {
  return (
    <div className={`inline-flex items-center gap-1.5 bg-[hsl(var(--kiddo-gold))]/10 text-[hsl(var(--kiddo-gold))] font-medium rounded-full ${
      size === "sm" ? "px-2 py-0.5 text-[10px]" : "px-3 py-1 text-xs"
    }`}>
      <Crown size={size === "sm" ? 10 : 12} />
      Kiddo Occasion
    </div>
  );
}

// EventPassUpgrade component removed 2026-05-13. Was the dormant UI for
// the one-time $7.99 Kiddo Occasion purchase product. Per Path A locked
// decision: Kora committed to subscription-only pricing for occasions
// (Free=1 active, Plus=3, Family=unlimited; premium features come via
// subscription, not per-occasion). The component wasn't rendered anywhere
// user-facing, the Account.tsx "Kiddo Occasions $7.99" card it complemented
// was removed in the same commit, and the server-side createOccasionCheckout
// + handleEventPassPurchase endpoints stay in place (dormant) for legacy
// data integrity. If a one-time occasion purchase product is ever
// re-introduced at a different price point, build fresh — don't resurrect
// this component.
