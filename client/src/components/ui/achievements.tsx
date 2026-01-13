import { motion } from "framer-motion";
import { Gift, TrendingUp, Calendar, Users, Star, Sparkles, Clock, Heart, Trophy, Zap } from "lucide-react";

export interface Achievement {
  id: string;
  title: string;
  description: string;
  icon: React.ReactNode;
  unlocked: boolean;
  unlockedAt?: Date;
  progress?: number;
  color: string;
}

const ACHIEVEMENT_ICONS: Record<string, React.ReactNode> = {
  first_gift: <Gift className="w-5 h-5" />,
  hundred_club: <Star className="w-5 h-5" />,
  five_hundred: <Trophy className="w-5 h-5" />,
  thousand: <Zap className="w-5 h-5" />,
  first_dividend: <TrendingUp className="w-5 h-5" />,
  one_year: <Calendar className="w-5 h-5" />,
  five_givers: <Users className="w-5 h-5" />,
  ten_givers: <Heart className="w-5 h-5" />,
  stayed_invested: <Clock className="w-5 h-5" />,
};

export function AchievementBadge({ 
  achievement, 
  size = "md" 
}: { 
  achievement: Achievement;
  size?: "sm" | "md" | "lg";
}) {
  const sizes = {
    sm: "w-10 h-10",
    md: "w-14 h-14",
    lg: "w-20 h-20",
  };

  const iconSizes = {
    sm: "w-4 h-4",
    md: "w-6 h-6",
    lg: "w-8 h-8",
  };

  return (
    <motion.div
      initial={{ scale: 0, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      whileHover={achievement.unlocked ? { scale: 1.1, rotate: 5 } : {}}
      className="relative group"
    >
      <div
        className={`${sizes[size]} rounded-2xl flex items-center justify-center transition-all ${
          achievement.unlocked
            ? `bg-gradient-to-br ${achievement.color} shadow-lg`
            : "bg-stone-100 opacity-40"
        }`}
      >
        <div className={`${iconSizes[size]} ${achievement.unlocked ? "text-white" : "text-stone-400"}`}>
          {achievement.icon}
        </div>
        
        {achievement.unlocked && (
          <motion.div
            className="absolute -top-1 -right-1 w-4 h-4 bg-emerald-500 rounded-full flex items-center justify-center"
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ delay: 0.3, type: "spring", stiffness: 500 }}
          >
            <Sparkles className="w-2.5 h-2.5 text-white" />
          </motion.div>
        )}
      </div>

      {achievement.progress !== undefined && !achievement.unlocked && (
        <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-full px-1">
          <div className="h-1 bg-stone-200 rounded-full overflow-hidden">
            <div 
              className="h-full bg-stone-400 transition-all"
              style={{ width: `${achievement.progress}%` }}
            />
          </div>
        </div>
      )}

      <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-10">
        <div className="bg-stone-900 text-white text-xs px-3 py-2 rounded-lg whitespace-nowrap shadow-lg">
          <p className="font-medium">{achievement.title}</p>
          <p className="text-stone-400">{achievement.description}</p>
        </div>
      </div>
    </motion.div>
  );
}

export function AchievementRow({ achievements }: { achievements: Achievement[] }) {
  return (
    <div className="flex items-center gap-3 overflow-x-auto pb-2 scrollbar-hide">
      {achievements.map((achievement, i) => (
        <motion.div
          key={achievement.id}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: i * 0.1 }}
        >
          <AchievementBadge achievement={achievement} size="md" />
        </motion.div>
      ))}
    </div>
  );
}

export function AchievementCard({ achievement }: { achievement: Achievement }) {
  return (
    <motion.div
      initial={{ opacity: 0, x: -20 }}
      animate={{ opacity: 1, x: 0 }}
      className={`p-4 rounded-2xl border-2 transition-all ${
        achievement.unlocked
          ? "bg-gradient-to-r from-emerald-50 to-teal-50 border-emerald-200"
          : "bg-stone-50 border-stone-200"
      }`}
    >
      <div className="flex items-center gap-4">
        <div
          className={`w-12 h-12 rounded-xl flex items-center justify-center ${
            achievement.unlocked
              ? `bg-gradient-to-br ${achievement.color}`
              : "bg-stone-200"
          }`}
        >
          <div className={achievement.unlocked ? "text-white" : "text-stone-400"}>
            {achievement.icon}
          </div>
        </div>
        <div className="flex-1">
          <p className={`font-medium ${achievement.unlocked ? "text-stone-900" : "text-stone-500"}`}>
            {achievement.title}
          </p>
          <p className="text-sm text-stone-400">{achievement.description}</p>
        </div>
        {achievement.unlocked && (
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            className="text-emerald-500"
          >
            <Sparkles className="w-5 h-5" />
          </motion.div>
        )}
      </div>
      
      {achievement.progress !== undefined && !achievement.unlocked && (
        <div className="mt-3">
          <div className="flex justify-between text-xs text-stone-400 mb-1">
            <span>Progress</span>
            <span>{achievement.progress}%</span>
          </div>
          <div className="h-2 bg-stone-200 rounded-full overflow-hidden">
            <motion.div 
              className="h-full bg-gradient-to-r from-stone-400 to-stone-500"
              initial={{ width: 0 }}
              animate={{ width: `${achievement.progress}%` }}
              transition={{ duration: 1, ease: "easeOut" }}
            />
          </div>
        </div>
      )}
    </motion.div>
  );
}

export function getDefaultAchievements(totalRaised: number, giverCount: number, daysActive: number): Achievement[] {
  return [
    {
      id: "first_gift",
      title: "First Gift",
      description: "Received your first gift",
      icon: ACHIEVEMENT_ICONS.first_gift,
      unlocked: totalRaised > 0,
      color: "from-rose-400 to-pink-500",
    },
    {
      id: "hundred_club",
      title: "$100 Club",
      description: "Reached $100 in gifts",
      icon: ACHIEVEMENT_ICONS.hundred_club,
      unlocked: totalRaised >= 100,
      progress: totalRaised < 100 ? Math.round((totalRaised / 100) * 100) : undefined,
      color: "from-amber-400 to-orange-500",
    },
    {
      id: "five_hundred",
      title: "$500 Milestone",
      description: "Reached $500 in gifts",
      icon: ACHIEVEMENT_ICONS.five_hundred,
      unlocked: totalRaised >= 500,
      progress: totalRaised < 500 ? Math.round((totalRaised / 500) * 100) : undefined,
      color: "from-violet-400 to-purple-500",
    },
    {
      id: "thousand",
      title: "$1,000 Champion",
      description: "Reached $1,000 in gifts",
      icon: ACHIEVEMENT_ICONS.thousand,
      unlocked: totalRaised >= 1000,
      progress: totalRaised < 1000 ? Math.round((totalRaised / 1000) * 100) : undefined,
      color: "from-emerald-400 to-teal-500",
    },
    {
      id: "five_givers",
      title: "Growing Circle",
      description: "5 people gave gifts",
      icon: ACHIEVEMENT_ICONS.five_givers,
      unlocked: giverCount >= 5,
      progress: giverCount < 5 ? Math.round((giverCount / 5) * 100) : undefined,
      color: "from-blue-400 to-cyan-500",
    },
    {
      id: "one_year",
      title: "One Year Strong",
      description: "Fund active for 1 year",
      icon: ACHIEVEMENT_ICONS.one_year,
      unlocked: daysActive >= 365,
      progress: daysActive < 365 ? Math.round((daysActive / 365) * 100) : undefined,
      color: "from-indigo-400 to-blue-500",
    },
  ];
}

export function MilestoneTimeline({ 
  milestones 
}: { 
  milestones: Array<{ title: string; date: string; amount?: number; achieved: boolean }>;
}) {
  return (
    <div className="relative pl-8">
      <div className="absolute left-3 top-2 bottom-2 w-0.5 bg-stone-200" />
      
      {milestones.map((milestone, i) => (
        <motion.div
          key={i}
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: i * 0.1 }}
          className="relative pb-6 last:pb-0"
        >
          <div 
            className={`absolute left-0 w-6 h-6 rounded-full flex items-center justify-center -translate-x-[11px] ${
              milestone.achieved 
                ? "bg-emerald-500 text-white" 
                : "bg-stone-200 text-stone-400"
            }`}
          >
            {milestone.achieved ? (
              <Sparkles className="w-3 h-3" />
            ) : (
              <div className="w-2 h-2 rounded-full bg-stone-300" />
            )}
          </div>
          
          <div className={milestone.achieved ? "text-stone-900" : "text-stone-400"}>
            <p className="font-medium">{milestone.title}</p>
            <p className="text-sm text-stone-400">
              {milestone.date}
              {milestone.amount && ` · $${milestone.amount.toLocaleString()}`}
            </p>
          </div>
        </motion.div>
      ))}
    </div>
  );
}
