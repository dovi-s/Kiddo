import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { HelpCircle, X, Lightbulb, Shield, ChevronDown } from "lucide-react";

interface EducationTipProps {
  title: string;
  children: React.ReactNode;
  icon?: "help" | "tip" | "security";
  variant?: "inline" | "expandable" | "tooltip";
  className?: string;
}

const iconMap = {
  help: HelpCircle,
  tip: Lightbulb,
  security: Shield,
};

export function EducationTip({ title, children, icon = "help", variant = "expandable", className = "" }: EducationTipProps) {
  const [isOpen, setIsOpen] = useState(false);
  const Icon = iconMap[icon];

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
          onClick={() => setIsOpen(!isOpen)}
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
        onClick={() => setIsOpen(!isOpen)}
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
    title: "How does auto-invest work?",
    content: "When your fund receives a gift, the money is automatically invested in a diversified mix of stocks at the next trading window. No action needed from you. You can change the investment strategy anytime.",
  },
  sipc: {
    title: "What is SIPC protection?",
    content: "SIPC (Securities Investor Protection Corporation) protects your investments up to $500,000 if anything ever happens to the brokerage firm. It's like FDIC insurance, but for investment accounts.",
  },
  fees: {
    title: "How do fees work?",
    content: "There are two types of fees: payment processing paid by the gift-giver (card/Apple Pay/Google Pay at ~2.9% + $0.30, or bank transfer at just 0.8% max $5) and the Kora platform fee. On the Free tier, a flat $2 platform fee applies per gift. On Starter ($5/month per fund) and Family ($12/month or $119/year), the platform fee is waived entirely. Free and Starter users can also purchase an Event Boost ($29 one-time) to waive the platform fee for a specific event.",
  },
  pendingCash: {
    title: "What does 'pending' mean?",
    content: "When someone sends a gift, it takes 1 to 2 business days for the payment to clear. During this time, it shows as 'pending.' Once cleared, it's automatically invested based on your chosen strategy.",
  },
  costBasis: {
    title: "What about taxes on gifts?",
    content: "Most gifts are well under the $19,000 annual gift tax exclusion, so there's no gift tax to worry about. When investments are eventually sold, capital gains taxes apply based on the original cost basis. The recipient inherits the giver's cost basis and holding period, not the value at the time of the gift.",
  },
  giftGrowth: {
    title: "How much can gifts grow?",
    content: "The S&P 500 has historically averaged about 10% per year. A $50 gift today could grow to roughly $278 in 18 years. Past performance doesn't guarantee future results, but long time horizons tend to smooth out market ups and downs.",
  },
  withdrawals: {
    title: "Can I sell or withdraw?",
    content: "Yes. You can sell investments and withdraw cash to your bank account, subject to standard trade settlement (typically T+1). For custodial (UTMA) accounts, withdrawals must benefit the child. For personal accounts, you have full control. Kora does not charge withdrawal fees.",
  },
  paymentMethods: {
    title: "What payment methods are accepted?",
    content: "Gift-givers can pay with Apple Pay, Google Pay, any major credit or debit card, or a bank transfer (ACH). Apple Pay and Google Pay are the fastest. Bank transfers have lower processing fees, which is great for larger gifts.",
  },
  kiddieTax: {
    title: "What is the kiddie tax?",
    content: "For children under 19 (or under 24 if a full-time student), unearned income over $2,600 per year may be taxed at the parent's tax rate instead of the child's. The first $1,300 is tax-free, and the next $1,300 is taxed at the child's rate. This only applies when investments are sold at a gain or when dividends exceed these thresholds. Most custodial accounts stay well below these limits.",
  },
  costBasisGifted: {
    title: "How is cost basis handled for gifted stock?",
    content: "When you receive stock as a gift, you inherit the giver's original cost basis and their holding period. This means when you eventually sell, your capital gains (or losses) are calculated from what the giver originally paid, not what the stock was worth when you received it. If the stock has gone up since the giver bought it, you will owe taxes on the full gain when you sell.",
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
