import { motion, AnimatePresence } from "framer-motion";
import { useState } from "react";
import { Link } from "wouter";
import { Nav } from "@/components/layout/Nav";
import { Footer } from "@/components/layout/Footer";
import { ChevronDown, Search, Shield, Lock, ArrowRight } from "lucide-react";
import { Mascot } from "@/components/ui/mascot";

const faqItems = [
  {
    id: "how-invested",
    question: "How does the money actually get invested?",
    answer: "Kora uses an embedded brokerage model, similar to how apps like Robinhood and Acorns work. When a gift comes in, the money is invested through a regulated broker-dealer and held at a FINRA-member clearing firm. You get a real brokerage account with real investments, and there are no trading commissions. Kora never holds your money directly.",
  },
  {
    id: "utma",
    question: "What is a UTMA account?",
    answer: "A UTMA (Uniform Transfers to Minors Act) account is simply an investment account you manage for your child until they turn 18. You control the investments, and when your child becomes an adult, the account transfers to them.",
  },
  {
    id: "safety",
    question: "Is my child's money safe?",
    answer: "Yes. All accounts are held at a regulated clearing firm and protected by SIPC (Securities Investor Protection Corporation) for up to $500,000. This is the same protection that covers accounts at major brokerages. Kora never holds custody of your funds.",
  },
  {
    id: "fees",
    question: "What are the fees?",
    answer: "There are two parts to fees. First, payment processing: card, Apple Pay, and Google Pay cost about 2.9% + $0.30 per transaction. Bank transfers (ACH) are much cheaper at just 0.8%, capped at $5. Second, the Kora platform fee: 1.5% per gift (minimum $1, maximum $10). Want to cover fees for your guests? The Event Pass ($99) waives the platform fee on up to $7,500 per event. The Family Plan ($149/year) waives the platform fee on up to $15,000 in gifts per year.",
  },
  {
    id: "turns-18",
    question: "What happens when my child turns 18?",
    answer: "When your child turns 18, the UTMA account transfers into their name and they gain full control. They can keep the investments growing, sell them, or transfer to another brokerage. It becomes theirs.",
  },
  {
    id: "no-account",
    question: "Do gift-givers need an account?",
    answer: "No! Gift-givers do not need to create an account or download an app. They just open the link, pick an amount, pay, and they are done. The whole process takes about 60 seconds.",
  },
  {
    id: "taxes",
    question: "What about taxes?",
    answer: "Most gifts fall well under the IRS gift tax exclusion, which is $19,000 per person per year. So in nearly every case, there is nothing to report. For the child's account, the \"kiddie tax\" only kicks in when unearned income (like dividends and gains) exceeds $2,700 in a year, which is uncommon for most gift-sized accounts. Also, the cost basis (what was originally paid for the investments) carries over from the giver, which can help reduce taxes later.",
  },
  {
    id: "vs-savings",
    question: "How is this different from a savings account?",
    answer: "A savings account currently earns around 4% per year. Historically, the S&P 500 has averaged around 10% per year. Over 18 years, that difference is massive. Plus, your child gets real ownership in companies they actually know and use, which is a great way to teach them about money and investing.",
  },
  {
    id: "payment-methods",
    question: "How can gift-givers pay?",
    answer: "Givers can pay with Apple Pay, Google Pay, any major credit or debit card, or a bank transfer (ACH). Apple Pay and Google Pay are the fastest, just one tap. Bank transfers have lower processing fees, which is great for larger gifts. Every method is secure and encrypted.",
  },
  {
    id: "withdraw-sell",
    question: "Can I sell investments or withdraw money?",
    answer: "Yes. For custodial (UTMA) accounts, the parent or guardian can sell investments and withdraw funds, as long as the money is used for the child's benefit (that is the law for custodial accounts). For adult accounts, you have full control to sell and withdraw. Sold investments settle in about one business day (T+1), after which you can transfer to your bank. Kora does not charge withdrawal fees. Gifts are irrevocable once made, meaning they belong to the recipient, but the custodian manages them until the child reaches adulthood.",
  },
  {
    id: "transfer-out",
    question: "Can I transfer to another brokerage?",
    answer: "Yes. You can transfer the account to any other brokerage using a standard ACATS transfer. There are no lock-ups or penalties. Your investments move as-is to the new brokerage.",
  },
  {
    id: "auto-invest",
    question: "What is 'auto-invest'?",
    answer: "Auto-invest means that when a gift comes in, the money automatically buys a diversified mix of investments at the next available trading window. You do not have to pick stocks or time the market. It is a simple, hands-off way to make sure every gift starts growing right away.",
  },
  {
    id: "gift-safe",
    question: "How do gift-givers know their gift is safe?",
    answer: "Gift-givers see transparent fees before they check out, so there are no surprises. Every dollar goes into a real, SIPC-protected brokerage account at a regulated clearing firm. It is not a prepaid card or store credit. It is a real investment in their name.",
  },
  {
    id: "choose-stocks",
    question: "Can I choose specific stocks?",
    answer: "Yes! Givers can pick from a curated list of popular brands and companies, or they can simply let auto-invest handle it. Either way, the gift goes into real investments held in the child's account.",
  },
];

function AccordionItem({ item, isOpen, onToggle }: { item: typeof faqItems[0]; isOpen: boolean; onToggle: () => void }) {
  return (
    <div className="border-b border-border last:border-b-0" data-testid={`faq-item-${item.id}`}>
      <button
        onClick={onToggle}
        className="w-full flex items-center justify-between py-5 px-1 text-left group"
        data-testid={`faq-toggle-${item.id}`}
        aria-expanded={isOpen}
      >
        <span className="font-heading text-base md:text-lg font-medium text-foreground pr-4 group-hover:text-primary transition-colors">
          {item.question}
        </span>
        <motion.div
          animate={{ rotate: isOpen ? 180 : 0 }}
          transition={{ duration: 0.3 }}
          className="shrink-0"
        >
          <ChevronDown className="w-5 h-5 text-muted-foreground" />
        </motion.div>
      </button>
      <AnimatePresence initial={false}>
        {isOpen && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
            className="overflow-hidden"
          >
            <p className="pb-5 px-1 text-muted-foreground leading-relaxed text-sm md:text-base" data-testid={`faq-answer-${item.id}`}>
              {item.answer}
            </p>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export default function FAQ() {
  const [searchQuery, setSearchQuery] = useState("");
  const [openId, setOpenId] = useState<string | null>(null);

  const filteredFaqs = faqItems.filter(
    (item) =>
      item.question.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.answer.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="min-h-screen bg-background">
      <Nav />

      <section className="pt-24 pb-16 md:pt-32 md:pb-24">
        <div className="container mx-auto px-4">
          <div className="max-w-3xl mx-auto">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6 }}
              className="text-center mb-10"
            >
              <Mascot size="lg" className="mx-auto mb-6 drop-shadow-lg" context="faq-hero" />
              <h1 className="font-heading text-3xl md:text-4xl lg:text-5xl font-semibold text-foreground tracking-tight mb-4" data-testid="text-page-title">
                Frequently Asked Questions
              </h1>
              <p className="text-lg text-muted-foreground max-w-xl mx-auto" data-testid="text-page-subtitle">
                Everything you need to know about gifting investments with Kora.
              </p>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2, duration: 0.5 }}
              className="relative mb-8"
            >
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
              <input
                type="text"
                placeholder="Search questions..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-12 pr-4 py-3.5 rounded-2xl border border-border bg-card text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/40 transition-all"
                data-testid="input-faq-search"
              />
            </motion.div>

            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.3, duration: 0.5 }}
              className="bg-card rounded-2xl border border-border shadow-premium-sm overflow-hidden"
              data-testid="faq-accordion"
            >
              {filteredFaqs.length > 0 ? (
                filteredFaqs.map((item) => (
                  <AccordionItem
                    key={item.id}
                    item={item}
                    isOpen={openId === item.id}
                    onToggle={() => setOpenId(openId === item.id ? null : item.id)}
                  />
                ))
              ) : (
                <div className="py-12 text-center text-muted-foreground" data-testid="text-no-results">
                  <p>No matching questions found. Try a different search term.</p>
                </div>
              )}
            </motion.div>

            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.4 }}
              className="text-center mt-10 space-y-4"
            >
              <p className="text-sm text-muted-foreground">
                Still have questions? Check out how Kora works on our{" "}
                <Link href="/#how-it-works" className="text-primary hover:underline">home page</Link>.
              </p>
              <div className="flex items-center justify-center gap-3 text-xs text-muted-foreground/70">
                <Lock className="w-3.5 h-3.5" />
                <span>SIPC protected</span>
                <span className="text-border">|</span>
                <Shield className="w-3.5 h-3.5" />
                <span>FINRA regulated</span>
              </div>
            </motion.div>
          </div>
        </div>
      </section>

      <Footer />
    </div>
  );
}
