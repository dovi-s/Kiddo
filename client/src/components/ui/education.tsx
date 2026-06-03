import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { HelpCircle, X, Lightbulb, Shield, ChevronDown } from "lucide-react";

interface EducationTipProps {
  title: string;
  children: React.ReactNode;
  icon?: "help" | "tip" | "security";
  variant?: "inline" | "expandable" | "tooltip";
  className?: string;
  fundId?: string | null;
  eventId?: string | null;
}

const iconMap = {
  help: HelpCircle,
  tip: Lightbulb,
  security: Shield,
};

export function EducationTip({ title, children, icon = "help", variant = "expandable", className = "", fundId = null, eventId = null }: EducationTipProps) {
  const [isOpen, setIsOpen] = useState(false);
  const Icon = iconMap[icon];
  const trackEducationEvent = async (action: "education_tooltip_open" | "education_tooltip_click") => {
    try {
      await fetch("/api/referrals/events", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action,
          fundId,
          eventId,
          channel: "education_tip",
          metadata: {
            title,
            variant,
            icon,
          },
        }),
      });
    } catch {
      // non-blocking analytics event
    }
  };

  const handleToggle = () => {
    const next = !isOpen;
    setIsOpen(next);
    trackEducationEvent("education_tooltip_click");
    if (next) {
      trackEducationEvent("education_tooltip_open");
    }
  };

  if (variant === "inline") {
    return (
      <div className={`flex items-start gap-3 p-4 rounded-2xl bg-primary/5 border border-primary/10 ${className}`} data-testid="education-tip-inline">
        <Icon size={18} className="text-primary mt-0.5 flex-shrink-0" />
        <div>
          <p className="text-sm font-medium text-foreground mb-1">{title}</p>
          <div className="text-sm text-muted-foreground leading-relaxed">{children}</div>
        </div>
      </div>
    );
  }

  if (variant === "tooltip") {
    return (
      <span className="relative inline-flex items-center">
        <button
          onClick={handleToggle}
          className="ml-1 text-muted-foreground hover:text-foreground transition-colors"
          data-testid="education-tip-trigger"
        >
          <Icon size={14} />
        </button>
        <AnimatePresence>
          {isOpen && (
            <motion.div
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 4 }}
              className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-64 p-3 rounded-xl bg-card border border-border shadow-lg z-50"
              data-testid="education-tip-tooltip"
            >
              <button onClick={() => setIsOpen(false)} className="absolute top-2 right-2 text-muted-foreground hover:text-foreground">
                <X size={12} />
              </button>
              <p className="text-xs font-medium text-foreground mb-1">{title}</p>
              <div className="text-xs text-muted-foreground leading-relaxed">{children}</div>
            </motion.div>
          )}
        </AnimatePresence>
      </span>
    );
  }

  return (
    <div className={`rounded-2xl border border-border/50 overflow-hidden ${className}`} data-testid="education-tip-expandable">
      <button
        onClick={handleToggle}
        className="w-full flex items-center gap-3 p-4 text-left hover:bg-muted/30 transition-colors"
        data-testid="education-tip-toggle"
      >
        <Icon size={18} className="text-primary flex-shrink-0" />
        <span className="text-sm font-medium text-foreground flex-1">{title}</span>
        <motion.div animate={{ rotate: isOpen ? 180 : 0 }} transition={{ duration: 0.2 }}>
          <ChevronDown size={16} className="text-muted-foreground" />
        </motion.div>
      </button>
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
          >
            <div className="px-4 pb-4 text-sm text-muted-foreground leading-relaxed border-t border-border/30 pt-3">
              {children}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export const educationContent = {
  utma: {
    title: "What is a UTMA account?",
    content: "An investment account you manage for your child until they reach adulthood (usually 18 or 21, depending on your state). You control the investments, and the account transfers to them automatically when they're old enough.",
  },
  autoInvest: {
    title: "How does investing automatically work?",
    content: "When your fund receives a gift, the money is automatically invested in a diversified mix of stocks at the next trading window. No action needed from you. You can change the investment strategy anytime.",
  },
  sipc: {
    title: "What is SIPC protection?",
    content: "Once invested, your fund is held through our broker-dealer partner, the brokerage behind Kiddo. SIPC protection then covers up to $500,000 if anything ever happens to the brokerage firm. It does not protect against market losses.",
  },
  fees: {
    title: "How do fees work?",
    content: "There are two parts. First, payment processing on gifts (card/Apple Pay/Google Pay at ~2.9% + $0.30, or bank transfer at 0.8% max $5), paid by the gifter. Kiddo does not charge a platform fee on gifts: $50 from grandma is $50 to the fund. Second, Kiddo's annual fee on invested assets: $1/yr per $1,000 invested (about $10/yr on a $10,000 fund). Same rate on Free, Kiddo+, and Kiddo Family. Cash and pending gifts are not charged. All fees are shown before checkout.",
  },
  pendingCash: {
    title: "What does 'pending' mean?",
    content: "When someone sends a gift, it takes 1 to 2 business days for the payment to clear. During this time, it shows as 'pending.' Once cleared, it's automatically invested based on your chosen strategy.",
  },
  costBasis: {
    title: "What about taxes on gifts?",
    content: "Most gifts are well under the $19,000 annual gift tax exclusion, so there's no gift tax to worry about. When investments are eventually sold, capital gains taxes apply based on the original cost basis. The recipient inherits the gifter's cost basis and holding period, not the value at the time of the gift.",
  },
  giftGrowth: {
    title: "How much can gifts grow?",
    content: "The S&P 500 has historically averaged about 10% per year. A $50 gift today could grow to roughly $278 in 18 years. Past performance doesn't guarantee future results, but long time horizons tend to smooth out market ups and downs.",
  },
  withdrawals: {
    title: "Can I sell or withdraw?",
    content: "Yes. You can sell investments and withdraw cash to your bank account, subject to standard trade settlement (typically T+1). For custodial (UTMA) accounts, withdrawals must benefit the child. For personal accounts, you have full control. Kiddo does not charge withdrawal fees.",
  },
  paymentMethods: {
    title: "What payment methods are accepted?",
    content: "Gifters can pay with Apple Pay, Google Pay, any major credit or debit card, or a bank transfer (ACH). Apple Pay and Google Pay are the fastest. Bank transfers have lower processing fees, which is great for larger gifts.",
  },
  kiddieTax: {
    title: "What is the kiddie tax?",
    content: "For children under 19 (or under 24 if a full-time student), unearned income over $2,600 per year may be taxed at the parent's tax rate instead of the child's. The first $1,300 is tax-free, and the next $1,300 is taxed at the child's rate. This only applies when investments are sold at a gain or when dividends exceed these thresholds. Most custodial accounts stay well below these limits.",
  },
  costBasisGifted: {
    title: "How is cost basis handled for gifted stock?",
    content: "When you receive stock as a gift, you inherit the gifter's original cost basis and their holding period. This means when you eventually sell, your capital gains (or losses) are calculated from what the gifter originally paid, not what the stock was worth when you received it. If the stock has gone up since the gifter bought it, you will owe taxes on the full gain when you sell.",
  },
  giftTaxExclusion: {
    title: "Is there a limit on tax-free gifts?",
    content: "Each person can give up to $19,000 per recipient per year without any gift tax implications. Married couples can combine their exclusions to give up to $38,000 per recipient. Beyond that, there is a lifetime exemption of $13.99 million before any gift tax is owed. Most families never come close to these limits. The recipient never owes income tax on receiving a gift.",
  },
  utmaTransfer: {
    title: "When does my child get control?",
    content: "UTMA accounts automatically transfer to the child's full control at the age of majority, which is 18 or 21 depending on your state. At that point, they can keep the investments, sell them, or transfer to another brokerage. All gifts to a UTMA account are irrevocable, meaning once the gift is made, it legally belongs to the child.",
  },
};

export type MoneyLessonDrip = {
  id: string;
  eyebrow: string;
  title: string;
  body: string;
  whyNow: string;
};

type MoneyLessonDripInput = {
  ageYears: number | null;
  totalValue: number;
  giftCount: number;
  hasHoldings: boolean;
  hasRecentGift: boolean;
  accountType?: string | null;
  fundName?: string | null;
};

export function getMonthlyMoneyLesson({
  ageYears,
  totalValue,
  giftCount,
  hasHoldings,
  hasRecentGift,
  accountType,
  fundName,
}: MoneyLessonDripInput): MoneyLessonDrip {
  const baseLessons: MoneyLessonDrip[] = [];

  if (typeof ageYears === "number" && ageYears <= 6) {
    baseLessons.push({
      id: "young-stock-story",
      eyebrow: "This month's money lesson",
      title: "How to explain a stock to a young child",
      body: `Try this: “A stock is a tiny piece of a real company. When people buy from that company, your ${fundName || "fund"} can grow too.”`,
      whyNow: "This works best at younger ages, when simple stories build the first emotional connection.",
    });
  }

  if (typeof ageYears === "number" && ageYears >= 7 && ageYears <= 12) {
    baseLessons.push({
      id: "middle-compounding",
      eyebrow: "This month's money lesson",
      title: "Show them that money can grow while they wait",
      body: "Open the Child View and compare what people gave with what the fund is worth now. That is the easiest first lesson in growth over time.",
      whyNow: "Kids in this age range can start connecting patience with progress.",
    });
  }

  if (typeof ageYears === "number" && ageYears >= 13) {
    baseLessons.push({
      id: "teen-ownership",
      eyebrow: "This month's money lesson",
      title: "Start treating the fund like a conversation, not a surprise",
      body: "Talk through what the fund owns, why those companies or ETFs are there, and what decisions stay with you until adulthood.",
      whyNow: "Teen years are when the fund can become part of real money judgment, not just a nice story.",
    });
  }

  if (giftCount > 0 && totalValue < 200) {
    baseLessons.push({
      id: "first-gift-meaning",
      eyebrow: "This month's money lesson",
      title: "Use the first gifts to make the fund feel real",
      body: "Point to one gift and explain that it did two things at once: someone showed love, and the money started working for the future.",
      whyNow: "Early gifts create the emotional language your child will remember later.",
    });
  }

  if (totalValue >= 200 && totalValue < 1000) {
    baseLessons.push({
      id: "two-hundred-milestone",
      eyebrow: "This month's money lesson",
      title: "Your fund just crossed a real-money milestone",
      body: "Show your child what $200 or more means in one place. It is no longer abstract. It is money with a visible job and a visible future.",
      whyNow: "Milestones like this are ideal moments to come back into the product between gifting occasions.",
    });
  }

  if (totalValue >= 1000) {
    baseLessons.push({
      id: "four-figure-trust",
      eyebrow: "This month's money lesson",
      title: "A four-figure fund is a trust-building moment",
      body: "Explain that this money is not sitting still. It lives in a real custodial investment account and does not automatically disappear or liquidate at age 18.",
      whyNow: "As balances grow, parents usually start asking more serious long-term questions.",
    });
  }

  if (hasHoldings) {
    baseLessons.push({
      id: "diversification",
      eyebrow: "This month's money lesson",
      title: "Use the holdings list to teach diversification",
      body: "A simple script: “We do not need one company to do everything. We spread the fund across different companies and funds so one bad day does not decide everything.”",
      whyNow: "Once there are real holdings, diversification stops being theory and becomes something parents can point to.",
    });
  }

  if (hasRecentGift) {
    baseLessons.push({
      id: "recent-gift-conversation",
      eyebrow: "This month's money lesson",
      title: "A fresh gift is the best lesson prompt",
      body: "When a new gift lands, show your child who gave it, what they said, and where the money now lives. That turns a transaction into a memory and a money lesson at the same time.",
      whyNow: "Lessons stick better when they are attached to a real moment the child just experienced.",
    });
  }

  if (String(accountType || "").toUpperCase() === "UTMA") {
    baseLessons.push({
      id: "parent-guardrails",
      eyebrow: "This month's money lesson",
      title: "Parent guardrails are part of the lesson too",
      body: "You can tell your child: “This account is for you, but I manage it until you are old enough. My job is to protect it and teach you how it works.”",
      whyNow: "That framing builds trust without making the child feel shut out.",
    });
  }

  if (baseLessons.length === 0) {
    baseLessons.push({
      id: "foundational-stock",
      eyebrow: "This month's money lesson",
      title: "Start with one simple truth",
      body: "A gift fund is not just stored money. It is money with time, meaning, and the chance to grow.",
      whyNow: "This is the clearest foundational idea for parents to repeat early and often.",
    });
  }

  const monthIndex = new Date().getMonth();
  return baseLessons[monthIndex % baseLessons.length];
}
