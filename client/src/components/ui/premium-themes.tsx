import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Check, Sparkles, Lock, Crown } from "lucide-react";

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
    gradient: "from-stone-50 to-stone-100", 
    accent: "stone-900",
    textColor: "stone-900",
    isPremium: false,
    preview: "bg-gradient-to-br from-stone-50 to-stone-100"
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
        <h3 className="text-sm font-medium text-stone-900">Page Theme</h3>
        {!hasEventPass && (
          <button
            onClick={onUpgrade}
            className="flex items-center gap-1.5 text-xs text-amber-600 hover:text-amber-700 font-medium"
          >
            <Crown size={12} />
            Unlock all themes
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
              onClick={() => !isLocked && onSelectTheme(theme.id)}
              whileHover={{ scale: isLocked ? 1 : 1.02 }}
              whileTap={{ scale: isLocked ? 1 : 0.98 }}
              data-testid={`theme-${theme.id}`}
              className={`relative aspect-[4/3] rounded-xl overflow-hidden transition-all ${
                isSelected 
                  ? "ring-2 ring-stone-900 ring-offset-2" 
                  : isLocked 
                    ? "opacity-60 cursor-not-allowed" 
                    : "hover:shadow-md cursor-pointer"
              }`}
            >
              <div className={`absolute inset-0 ${theme.preview}`} />
              
              {isLocked && (
                <div className="absolute inset-0 bg-white/60 backdrop-blur-[1px] flex items-center justify-center">
                  <Lock size={16} className="text-stone-400" />
                </div>
              )}
              
              {isSelected && !isLocked && (
                <div className="absolute top-1.5 right-1.5 w-5 h-5 bg-stone-900 rounded-full flex items-center justify-center">
                  <Check size={12} className="text-white" />
                </div>
              )}
              
              {theme.isPremium && !isLocked && (
                <div className="absolute top-1.5 left-1.5">
                  <Sparkles size={12} className="text-amber-500" />
                </div>
              )}
              
              <div className="absolute bottom-0 left-0 right-0 px-2 py-1.5 bg-gradient-to-t from-black/20 to-transparent">
                <p className={`text-[10px] font-medium ${theme.id === 'midnight' ? 'text-white' : 'text-stone-700'}`}>
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
      className="bg-gradient-to-br from-amber-50 via-orange-50 to-rose-50 rounded-2xl p-6 border border-amber-100 shadow-sm"
    >
      <div className="flex items-center gap-2 mb-4">
        <div className="w-8 h-8 rounded-full bg-amber-100 flex items-center justify-center">
          <Sparkles className="w-4 h-4 text-amber-600" />
        </div>
        <div>
          <p className="text-xs text-amber-600 font-medium uppercase tracking-wider">Group Goal</p>
          <p className="text-sm font-medium text-stone-900">{eventTitle}</p>
        </div>
      </div>
      
      <div className="mb-4">
        <div className="flex items-baseline gap-2 mb-2">
          <span className="text-3xl font-semibold text-stone-900">${currentAmount.toLocaleString()}</span>
          <span className="text-stone-400">of ${goalAmount.toLocaleString()}</span>
        </div>
        <div className="h-3 bg-white rounded-full overflow-hidden shadow-inner">
          <motion.div 
            className="h-full bg-gradient-to-r from-amber-400 to-orange-400 rounded-full"
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
                className="w-6 h-6 rounded-full bg-white border-2 border-amber-50 flex items-center justify-center text-[10px] font-medium text-stone-600"
              >
                {String.fromCharCode(65 + i)}
              </div>
            ))}
            {contributorCount > 4 && (
              <div className="w-6 h-6 rounded-full bg-amber-100 border-2 border-amber-50 flex items-center justify-center text-[10px] font-medium text-amber-700">
                +{contributorCount - 4}
              </div>
            )}
          </div>
          <span className="text-stone-600">{contributorCount} contributors</span>
        </div>
        <span className="text-amber-600 font-medium">${remaining.toLocaleString()} to go</span>
      </div>
    </motion.div>
  );
}

interface EventPassBadgeProps {
  size?: "sm" | "md";
}

export function EventPassBadge({ size = "md" }: EventPassBadgeProps) {
  return (
    <div className={`inline-flex items-center gap-1.5 bg-gradient-to-r from-amber-100 to-orange-100 text-amber-700 font-medium rounded-full ${
      size === "sm" ? "px-2 py-0.5 text-[10px]" : "px-3 py-1 text-xs"
    }`}>
      <Crown size={size === "sm" ? 10 : 12} />
      Event Pass
    </div>
  );
}

interface EventPassUpgradeProps {
  eventTitle: string;
  onUpgrade: () => void;
  onDismiss: () => void;
}

export function EventPassUpgrade({ eventTitle, onUpgrade, onDismiss }: EventPassUpgradeProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-gradient-to-br from-stone-900 via-stone-800 to-stone-900 rounded-2xl p-6 text-white overflow-hidden relative"
    >
      <div className="absolute top-0 right-0 w-48 h-48 bg-amber-500/10 rounded-full blur-3xl" />
      <div className="absolute bottom-0 left-0 w-32 h-32 bg-orange-500/10 rounded-full blur-2xl" />
      
      <div className="relative">
        <div className="flex items-center gap-2 mb-3">
          <Crown className="w-5 h-5 text-amber-400" />
          <span className="text-amber-400 font-medium text-sm">Event Pass</span>
        </div>
        
        <h3 className="text-xl font-semibold mb-2">Make {eventTitle} unforgettable</h3>
        <p className="text-stone-400 text-sm mb-6">
          One-time $99 upgrade. Premium themes, goal cards, thank-you automation, and Kora fee waived up to $7,500.
        </p>
        
        <ul className="space-y-2 mb-6">
          {[
            "6 premium page themes",
            "Group goal progress card",
            "Automatic thank-you drafts",
            "Priority support",
            "Kora fee waived (up to $7,500)"
          ].map((feature) => (
            <li key={feature} className="flex items-center gap-2 text-sm text-stone-300">
              <Check size={14} className="text-emerald-400" />
              {feature}
            </li>
          ))}
        </ul>
        
        <div className="flex gap-3">
          <button
            onClick={onUpgrade}
            data-testid="button-upgrade-event-pass"
            className="flex-1 py-3 bg-gradient-to-r from-amber-400 to-orange-400 text-stone-900 font-semibold rounded-xl hover:from-amber-300 hover:to-orange-300 transition-colors"
          >
            Upgrade for $99
          </button>
          <button
            onClick={onDismiss}
            data-testid="button-dismiss-event-pass"
            className="px-4 py-3 text-stone-400 hover:text-white transition-colors"
          >
            Not now
          </button>
        </div>
      </div>
    </motion.div>
  );
}
