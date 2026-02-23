import { motion, AnimatePresence } from "framer-motion";
import { useState } from "react";
import { Link } from "wouter";
import { Nav } from "@/components/layout/Nav";
import { Footer } from "@/components/layout/Footer";
import { ChevronDown, Search, Gift, Share2, TrendingUp, ArrowRight, Shield, Lock, MousePointerClick, Clock, CheckCircle2 } from "lucide-react";
import { Mascot } from "@/components/ui/mascot";

const parentSteps = [
  {
    icon: <Gift className="w-6 h-6" />,
    title: "Create a Fund",
    desc: "Set up an investment fund for your child in under two minutes.",
  },
  {
    icon: <Share2 className="w-6 h-6" />,
    title: "Share the Link",
    desc: "Send it to family and friends, or display a QR code at your event.",
  },
  {
    icon: <TrendingUp className="w-6 h-6" />,
    title: "Gifts Invest Automatically",
    desc: "Every contribution buys real investments. Watch it grow over time.",
  },
];

const giverSteps = [
  {
    icon: <MousePointerClick className="w-6 h-6" />,
    title: "Tap the Link",
    desc: "Open the link you received. No account or app download needed.",
  },
  {
    icon: <Gift className="w-6 h-6" />,
    title: "Pick an Amount",
    desc: "Choose how much to give. Pay with card, Apple Pay, or bank transfer.",
  },
  {
    icon: <CheckCircle2 className="w-6 h-6" />,
    title: "Done in 60 Seconds",
    desc: "That's it. Your gift is on its way to becoming a real investment.",
  },
];

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
    answer: "A savings account currently earns around 4% per year. Historically, a diversified stock portfolio has averaged around 7% per year over the long run. Over 18 years, that difference adds up significantly. Plus, your child gets real ownership in companies they actually know and use, which is a great way to teach them about money and investing.",
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

function StepCard({ step, index, total }: { step: typeof parentSteps[0]; index: number; total: number }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ delay: index * 0.15, duration: 0.5 }}
      className="flex-1 min-w-0"
      data-testid={`step-card-${index}`}
    >
      <div className="gemini-soft-container rounded-2xl p-6 h-full relative">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center text-primary shrink-0">
            {step.icon}
          </div>
          <span className="text-sm font-semibold text-primary">Step {index + 1}</span>
        </div>
        <h3 className="font-heading text-lg font-semibold text-foreground mb-2">{step.title}</h3>
        <p className="text-sm text-muted-foreground leading-relaxed">{step.desc}</p>
      </div>
      {index < total - 1 && (
        <div className="hidden md:flex items-center justify-center absolute top-1/2 -right-4 -translate-y-1/2 z-10">
          <ArrowRight className="w-5 h-5 text-muted-foreground/40" />
        </div>
      )}
    </motion.div>
  );
}

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

      <section className="pt-24 pb-16 md:pt-32 md:pb-20 gemini-warm-section">
        <div className="container mx-auto px-4">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            className="max-w-3xl mx-auto text-center mb-16"
          >
            <Mascot size="lg" className="mx-auto mb-6 drop-shadow-lg" context="faq-hero" />
            <h1 className="font-heading text-3xl md:text-4xl lg:text-5xl font-semibold text-foreground tracking-tight mb-4" data-testid="text-page-title">
              How Kora Works
            </h1>
            <p className="text-lg text-muted-foreground max-w-xl mx-auto" data-testid="text-page-subtitle">
              Simple for parents. Even simpler for gift-givers.
            </p>
          </motion.div>

          <div className="max-w-5xl mx-auto space-y-16">
            <div>
              <motion.div
                initial={{ opacity: 0 }}
                whileInView={{ opacity: 1 }}
                viewport={{ once: true }}
                className="flex items-center gap-2 mb-6"
              >
                <div className="w-8 h-8 rounded-full bg-primary flex items-center justify-center">
                  <Shield className="w-4 h-4 text-primary-foreground" />
                </div>
                <h2 className="font-heading text-xl md:text-2xl font-semibold text-foreground" data-testid="text-parents-heading">For Parents</h2>
              </motion.div>
              <div className="grid md:grid-cols-3 gap-4 md:gap-6 relative">
                {parentSteps.map((step, i) => (
                  <StepCard key={i} step={step} index={i} total={parentSteps.length} />
                ))}
              </div>
            </div>

            <div>
              <motion.div
                initial={{ opacity: 0 }}
                whileInView={{ opacity: 1 }}
                viewport={{ once: true }}
                className="flex items-center gap-2 mb-6"
              >
                <div className="w-8 h-8 rounded-full bg-primary flex items-center justify-center">
                  <Gift className="w-4 h-4 text-primary-foreground" />
                </div>
                <h2 className="font-heading text-xl md:text-2xl font-semibold text-foreground" data-testid="text-givers-heading">For Gift-Givers</h2>
              </motion.div>
              <div className="grid md:grid-cols-3 gap-4 md:gap-6 relative">
                {giverSteps.map((step, i) => (
                  <StepCard key={i} step={step} index={i} total={giverSteps.length} />
                ))}
              </div>
            </div>
          </div>

          <motion.div
            initial={{ opacity: 0, y: 10 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.3 }}
            className="max-w-md mx-auto text-center mt-12"
          >
            <Link href="/get-started">
              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                className="inline-flex items-center gap-2 bg-primary text-primary-foreground px-8 py-3.5 rounded-full font-semibold text-sm shadow-lg shadow-primary/20"
                data-testid="button-get-started"
              >
                Get started free
                <ArrowRight className="w-4 h-4" />
              </motion.button>
            </Link>
          </motion.div>
        </div>
      </section>

      <section className="py-16 md:py-24 border-t" id="faq">
        <div className="container mx-auto px-4">
          <div className="max-w-3xl mx-auto">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              className="text-center mb-10"
            >
              <h2 className="font-heading text-2xl md:text-3xl font-semibold text-foreground tracking-tight mb-3" data-testid="text-faq-heading">
                Frequently Asked Questions
              </h2>
              <p className="text-muted-foreground">
                Everything you need to know about gifting investments with Kora.
              </p>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 10 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
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
              whileInView={{ opacity: 1 }}
              viewport={{ once: true }}
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
              whileInView={{ opacity: 1 }}
              viewport={{ once: true }}
              className="text-center mt-10 space-y-3"
            >
              <p className="text-sm text-muted-foreground">
                Still have questions?
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
