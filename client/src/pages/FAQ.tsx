import { motion, AnimatePresence } from "framer-motion";
import { useState, useMemo, type ReactNode } from "react";
import { Link } from "wouter";
import { Nav } from "@/components/layout/Nav";
import { Footer } from "@/components/layout/Footer";
import { JsonLd } from "@/components/JsonLd";
import { ChevronDown, Lock, Search, Shield } from "lucide-react";
import { Button } from "@/components/ui/button";
import { KIDDIE_TAX_NOTE } from "@shared/legal-copy";

const faqItems = [
  {
    id: "international-availability",
    category: "Getting Started",
    question: "Is Kiddo available outside the US?",
    answer: (
      <>
        Not yet. Kiddo is built around the US UTMA (Uniform Transfers to Minors Act) custodial structure,
        and our brokerage partner serves US residents only. Tax documents like the 1099 also
        assume US tax filing. If you live outside the US and want a note when we open to your country,
        join the waitlist on the signup screen. No concrete date today.
      </>
    ),
  },
  {
    id: "why-kiddo",
    category: "Getting Started",
    question: "Why use Kiddo instead of opening a child account somewhere else?",
    answer: (
      <>
        Fidelity and Schwab are great places to hold investments for a child. What they do not give you is
        the gifting ritual. With Kiddo, family and friends can open one link, choose an amount, and give
        in seconds. Every gift can be invested, every note can be saved, and birthdays or baby
        showers can have a real occasion page instead of another round of checks and Venmos. If you want a
        more occasion-based walkthrough, start with{" "}
        <Link href="/blog/best-way-to-invest-birthday-money-for-kids" className="text-primary hover:underline">
          our birthday guide
        </Link>
        .{" "}
        <Link href="/compare" className="text-primary hover:underline">
          See how Kiddo compares to other options &rarr;
        </Link>
        . Already have a brokerage UTMA?{" "}
        <Link href="/compare/fidelity-utma" className="text-primary hover:underline">
          Kiddo vs Fidelity UTMA &rarr;
        </Link>
        . Switching from EarlyBird? Compare{" "}
        <Link href="/compare/earlybird" className="text-primary hover:underline">
          Kiddo vs EarlyBird &rarr;
        </Link>{" "}
        and{" "}
        <Link href="/compare/acorns-early" className="text-primary hover:underline">
          Kiddo vs Acorns Early &rarr;
        </Link>
        .
      </>
    ),
  },
  {
    id: "no-account",
    category: "Giving Gifts",
    question: "Do people need a Kiddo account to send a gift?",
    answer: "No. That is one of the most important parts of the product. They open the link, choose an amount, pay, and they are done. No app download. No account required.",
  },
  {
    id: "gift-code",
    category: "Giving Gifts",
    question: "Can I gift a child without having their fund link?",
    answer: (
      <>
        Yes. Every Kiddo fund has a gift code. Ask the parent, grandparent, or anyone in the family for
        the code, then go to{" "}
        <Link href="/gift" className="text-primary hover:underline">
          /gift
        </Link>{" "}
        and enter it. That opens the same private gift page without requiring the link.
        <br />
        <br />
        If the child does not have a Kiddo fund yet, you can save a parent invitation request from the
        same page so they can set one up first.
      </>
    ),
  },
  {
    id: "occasion-same-fund",
    category: "Giving Gifts",
    question: "Do occasion gifts go to a separate account?",
    answer: (
      <>
        No. Every gift goes directly into the same fund, no matter which link you used.
        <br />
        <br />
        Whether you gifted through the birthday link, the holiday page, or the main fund link, it all lands in the same place. Occasions are just a way to celebrate a specific moment and track who gave what for it. One fund. Always.
      </>
    ),
  },
  {
    id: "gifter-updates",
    category: "Giving Gifts",
    question: "Will I receive any updates after I gift?",
    answer: (
      <>
        Only if you choose to. After gifting, you can opt in to receive occasional milestone updates
        about the child&apos;s fund. If you opt in, Kiddo can send an annual birthday reminder, occasional
        parent-shared Memory Book updates, and one final notification when the child reaches adulthood.
        <br />
        <br />
        We never send portfolio performance emails or imply that a gifter owns the account. Parents stay
        in control of what is shared, and every update includes a one-click unsubscribe.
      </>
    ),
  },
  {
    id: "utma",
    category: "Account Basics",
    question: "What is the account behind my child's fund?",
    answer: "Most child funds use a UTMA legal structure. That means you manage the fund until your child reaches adulthood, usually 18 or 21 depending on your state. Then it becomes fully theirs. Kiddo keeps that legal complexity underneath the gifting experience.",
  },
  {
    id: "what-if-they-spend-it",
    category: "Account Basics",
    question: "What if my child just spends it all at 18?",
    answer: "It is the fear every parent has, and it is the reason we built Kiddo the way we did. By law, a custodial account becomes your child's at the age of majority. No app can change that, and we would not want one that could. What we can do is spend the years before it making the account something they understand and care about, instead of a surprise check. A child who watched it grow, chose some of what is inside, and read a note from their grandfather about it is a very different eighteen-year-old than one handed a number. We cannot promise what they will do. We can promise we spent eighteen years preparing them to do it well.",
  },
  {
    id: "utma-vs-529",
    category: "Account Basics",
    question: "How is this different from a 529?",
    answer: (
      <>
        A 529 is built around one future: college. The money stays in your name until it's spent there, and non-qualified withdrawals are taxed and penalized. A Kiddo fund is your child's money for their whole life: college, a first business, a first home, or whatever they choose when it becomes fully theirs at 18 or 21. It's also the one account your whole family can gift into with a tap: grandparents, aunts, and friends, with each gift landing in your child's Memory Book. 529s are great at the college-savings job, and many families keep both: a 529 for tuition and a Kiddo fund for everything else (and everyone else who wants to show up). To see what consistent investing through a UTMA could grow into for your situation, try the{" "}
        <Link href="/tools/at-18-calculator" className="text-primary hover:underline">
          at-18 calculator
        </Link>
        .
      </>
    ),
  },
  {
    id: "fafsa-financial-aid",
    category: "Account Basics",
    question: "Will my child's Kiddo fund affect their college financial aid?",
    answer: (
      <>
        Maybe, depending on whether you use the fund for college and how much is in it. UTMA accounts count as the child's asset on the FAFSA and are assessed at roughly 20% of value when calculating expected family contribution. A parent-owned 529 plan is assessed at a maximum of 5.64%, and a grandparent-owned 529 is currently assessed at 0% if used for the child's education. So if your only goal for this fund is paying for college, a 529 will usually have less impact on need-based financial aid than a UTMA will. Most Kiddo families use both: a 529 for college specifically, and a Kiddo fund for everything else (first car, gap year, business, down payment, whatever your child decides at 18). Kiddo's whole positioning is that this fund is a different tool, for the cases where 'this is just for college' is the wrong frame. If your fund is large enough that the FAFSA difference is material to your aid eligibility, talk to a financial aid advisor before submitting the form. To see what consistent investing for your specific situation could grow into, try the{" "}
        <Link href="/tools/at-18-calculator" className="text-primary hover:underline">
          at-18 calculator
        </Link>
        .
      </>
    ),
  },
  {
    id: "transfer-out",
    category: "Account Basics",
    question: "Can I move my child's fund to another brokerage?",
    answer: "Yes. Custodial accounts can be transferred. Kiddo doesn't charge a fee to leave. If the receiving brokerage charges an account-transfer fee, we cover it. Some brokerages accept in-kind transfers (the actual shares move over without selling); some require liquidation first (we sell, settle, then send cash). Which path applies depends on the receiving brokerage and how they handle UTMAs. If liquidation is required, the sale realizes capital gains under your child's tax ID. If realized gains exceed roughly $2,700 in a year, kiddie-tax rules apply. A CPA can help you sequence a large transfer across tax years to minimize the bill. Email transfers@kiddofund.com and support will walk you through the specific path for your fund.",
  },
  {
    id: "custodian-death",
    category: "Account Basics",
    question: "What happens to my child's fund if I die before they turn 18?",
    answer: "The fund passes to the successor custodian under your state's UTMA statute. Kiddo stores your designated successor in fund settings so the team knows who to contact and notifications reach the right person, but the in-app designation is not a substitute for your will. The legal transfer of custodianship happens through your estate's executor and the will's named successor custodian. If you need to report a custodian's death, email support@kiddofund.com and the team will walk the successor and executor through the brokerage transfer.",
  },
  {
    id: "utma-in-trust",
    category: "Account Basics",
    question: "Can I put my child's UTMA in a trust?",
    answer: "No, and you don't need to. A UTMA is already a legal structure designed for minor beneficiaries: the assets belong to the child, you manage them as custodian until they reach majority age (18 or 21 depending on your state), and ownership transfers automatically. Retitling a UTMA into a trust would defeat its purpose. If your family has complex estate planning needs (multi-generational planning, irrevocable trusts, asset-protection structures), talk to an estate attorney about how the UTMA fits alongside those structures rather than as a substitute for them. Many families use a UTMA for the kid-fund use case and a separate trust for broader estate planning.",
  },
  {
    id: "fees",
    category: "Pricing & Fees",
    question: "How much does Kiddo cost?",
    answer: "Kiddo is free to start. Free includes one child fund and a gift link. Parents and gifters can make one-time contributions. Gifters can always attach photos, videos, and voice memos. Free parents see every gift, photo, video, and voice memo from gifters in the Memory Book, and can write their own text entries. Free also includes a reminder system for gifters to give again, Kid View so your child can see what they own, and an annual contribution summary for tax records. Kiddo+ is $3.99 per month or $29 per year for one child. Plus unlocks recurring contributions on the fund (for you and for any gifter to the fund), custom fund mix, strategy switching, photo and video and voice authoring in your own Memory Book entries, co-parent access, and unlimited active occasions. Kiddo Family is $6.99 per month or $59 per year for every child fund you manage. Across every plan, Kiddo's annual fee is $1 per $1,000 invested, the only fee on the invested assets themselves (the subscription is separate, for product features). Cash and pending gifts are not charged. Payment processing on gifts is separate and shown before checkout.",
  },
  {
    id: "contribution-fees",
    category: "Pricing & Fees",
    question: "Are there fees on gifts?",
    answer: "Kiddo does not charge a platform fee on gifts. The gift amount stays whole, and the gifter pays payment processing separately. There is no required Kiddo large-gift fee. Optional premium gift upgrades are separate and shown before checkout. And unlike some giving platforms, Kiddo never asks you to add a tip for us on top of your gift. The dollars you send go to the child, not to Kiddo.",
  },
  {
    id: "occasions-free-plan",
    category: "Pricing & Fees",
    question: "How do occasions work on the free plan?",
    answer: "You can run 1 active basic occasion at a time on Free. Once it closes, you can create another. Kiddo+ gives one child richer occasion pages, reminders, and Memory Book features. Kiddo Family covers every child fund you manage.",
  },
  {
    id: "auto-invest",
    category: "Investing",
    question: "What happens after a gift comes in?",
    answer: "Every fund has one family default. Most families use a managed recurring-investment style like Growth Mix or Balanced Mix. Some choose a specific default stock. Others prefer to hold gifts as cash until they invest later. Gifts follow that family default unless the parent has explicitly allowed a stock override or a cash option in fund settings.",
  },
  {
    id: "rebalancing",
    category: "Investing",
    question: "How does Kiddo keep the portfolio balanced over time?",
    answer: "Kiddo doesn't sell to rebalance. Most adult-investor apps drift back to target by selling whatever's overrepresented and buying the underrepresented side, which realizes capital gains every time. On a child's UTMA those gains land on the child's tax ID and can pull the fund into kiddie-tax territory faster than necessary. Kiddo's approach: when an allocation drifts off target, future gifts are weighted toward the underweight side until the mix lands back where it should be. No sales, no surprise tax bill, the same long-term shape. If you ever change strategy explicitly, that does involve sales of the previous holdings, and the kiddie-tax rules apply at that point. Most families never do.",
  },
  {
    id: "safe",
    category: "Safety & Trust",
    question: "Is my child's money safe?",
    answer: (
      <>
        When investing is live, securities are held by our broker-dealer partner, a FINRA-registered broker-dealer. Eligible brokerage
        assets are then covered by SIPC up to $500,000 if the broker-dealer fails. Market prices can still
        move up or down. Kiddo handles the product experience; our broker-dealer partner holds the assets, not Kiddo. If you want the trust-focused version, read{" "}
        <Link href="/security" className="text-primary hover:underline">
          Security
        </Link>
        .
      </>
    ),
  },
  {
    id: "shutdown",
    category: "Safety & Trust",
    question: "What happens if Kiddo shuts down?",
    answer: (
      <>
        Your child's investments are not Kiddo's assets. Once invested, they are held through our broker-dealer partner, separate from Kiddo. If Kiddo ever
        disappeared, the fund's underlying investments would still exist and would not
        disappear with the company. We break that down in more detail on the{" "}
        <Link href="/security" className="text-primary hover:underline">
          Security page
        </Link>
        .
      </>
    ),
  },
  {
    id: "privacy",
    category: "Safety & Trust",
    question: "Can strangers find my child's fund?",
    answer: "No. Kiddo uses private gift links. The fund is shared by invitation, not by public search. It is not meant to act like a social profile or public payment handle.",
  },
  {
    id: "earlybird-vs-kiddo",
    category: "Getting Started",
    question: "How is Kiddo different from EarlyBird?",
    answer: (
      <>
        Both use child-fund structures and both let family gift easily. The difference is what the
        product focuses on. EarlyBird centers on video messages from loved ones. Kiddo centers on the
        gifting experience, the Memory Book, occasion pages for birthdays and baby showers, and an
        age-appropriate Kid View that grows with your child from age 5 to 17.
        <br />
        <br />
        Gifts through Kiddo are invested automatically once investing is live, with notes saved permanently. Parents can run occasion
        pages for specific moments and share a fund link anyone can gift through in seconds.{" "}
        <Link href="/compare/earlybird" className="text-primary hover:underline">
          See the full Kiddo vs EarlyBird comparison &rarr;
        </Link>
      </>
    ),
  },
  {
    id: "personal-funds",
    category: "Getting Started",
    question: "Can I create a fund for myself, not a child?",
    answer: (
      <>
        Personal funds for adults are coming soon. Today Kiddo is built for children&apos;s funds. A
        personal fund would give you the same shareable link, simple gifting from friends and family, and
        a real investment account behind it, held in your own personal brokerage account rather than a
        child-fund structure.
        <br />
        <br />
        You can see the idea and join the waitlist at{" "}
        <Link href="/get-started" className="text-primary hover:underline">
          get started
        </Link>{" "}
        under <span className="font-medium text-foreground">For myself</span>.
      </>
    ),
  },
  {
    id: "taxes",
    category: "Taxes",
    question: "What about taxes?",
    answer: (
      <>
        Most Kiddo-sized gifts are nowhere near the annual gift-tax exclusion, so families usually do not
        need to worry about gift-tax filing just because a grandparent sent a birthday gift. Investment
        income inside the account can create tax reporting over time. {KIDDIE_TAX_NOTE} For many families
        starting small, that is not an immediate issue, but it is worth understanding as the fund grows. If
        you are deciding between
        account types, compare{" "}
        <Link href="/blog/utma-vs-529-for-family-gifting" className="text-primary hover:underline">
          child funds vs 529s for family gifting
        </Link>
        .
      </>
    ),
  },
  {
    id: "tax-docs",
    category: "Taxes",
    question: "Do I get tax documents?",
    answer: "Yes. If the account generates taxable activity, the brokerage side of the experience provides the relevant tax documents. Parents should expect standard year-end reporting when it applies.",
  },
  {
    id: "turns-18",
    category: "Account Basics",
    question: "What happens when my child turns 18?",
    answer: (
      <>
        When your child reaches the age of majority for your state, the fund legally becomes theirs. In
        most states that is age 18 or 21. The investments do not automatically get sold just because that
        birthday arrives. The money stays where it is unless the new account owner decides to sell,
        withdraw, or transfer it.
        <br />
        <br />
        What changes is control. You stop acting as custodian for that child&apos;s fund, and your child gains
        full legal control over it. That is one reason many parents use Kiddo not just to invest, but to
        build healthy money conversations along the way.
      </>
    ),
  },
  {
    id: "memory-book",
    category: "Kid View & Education",
    question: "What is the Memory Book?",
    answer: (
      <>
        Every gift someone sends through Kiddo can include a personal note. Those notes are saved
        permanently in the child&apos;s Memory Book, organized by occasion: birthday, baby shower,
        graduation, or just because. Over years, the Memory Book becomes a record of every person who
        showed up for them and what they wrote.
        <br />
        <br />
        At 18, your child gets both the account and the story behind it: who gave, what they wrote, and
        how much each gift grew since the day it arrived. It is the part of the product that makes parents
        emotional every time.
      </>
    ),
  },
  {
    id: "child-view",
    category: "Kid View & Education",
    question: "What is the Kid View?",
    answer:
      "The Kid View is how your child grows up understanding ownership, seeing which people invested in them, and learning to have real money conversations. Not a brokerage dashboard. Age-appropriate language, real company logos, and the names of the people who showed up for them.",
  },
  {
    id: "child-view-ages",
    category: "Kid View & Education",
    question: "How does the Kid View change as my child gets older?",
    answer:
      "Kiddo adapts the experience by age. Younger kids get simple company recognition and the idea that gifts can grow. Older kids get clearer explanations of what they own and what companies do. Teenagers can start having real investing conversations, including suggesting stocks for future gifts.",
  },
  {
    id: "child-control",
    category: "Kid View & Education",
    question: "Can my child trade or withdraw money from the fund?",
    answer:
      "No. The Kid View is read-only before adulthood. Parents stay in control of trades, withdrawals, and account settings until the legal transfer age for the child fund is reached.",
  },
];

function AccordionItem({
  item,
  isOpen,
  onToggle,
}: {
  item: typeof faqItems[number] & { answer: ReactNode };
  isOpen: boolean;
  onToggle: () => void;
}) {
  const panelId = `faq-panel-${item.id}`;
  const triggerId = `faq-trigger-${item.id}`;
  return (
    <div className="border-b border-border last:border-b-0">
      <button
        type="button"
        id={triggerId}
        onClick={onToggle}
        aria-expanded={isOpen}
        aria-controls={panelId}
        className="group flex w-full items-center justify-between px-1 py-5 text-left"
        data-testid={`faq-toggle-${item.id}`}
      >
        <div className="pr-4">
          <span className="mb-1.5 inline-block rounded-full bg-primary/10 px-2 py-0.5 text-[11px] text-primary">
            {item.category}
          </span>
          <p className="font-heading text-base font-medium text-foreground transition-colors group-hover:text-primary md:text-lg">
            {item.question}
          </p>
        </div>
        <motion.div
          animate={{ rotate: isOpen ? 180 : 0 }}
          transition={{ duration: 0.3 }}
          className="shrink-0"
          aria-hidden="true"
        >
          <ChevronDown className="h-5 w-5 text-muted-foreground" />
        </motion.div>
      </button>
      <AnimatePresence initial={false}>
        {isOpen && (
          <motion.div
            id={panelId}
            role="region"
            aria-labelledby={triggerId}
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.3 }}
            className="overflow-hidden"
          >
            <div className="px-1 pb-5 text-sm leading-relaxed text-muted-foreground md:text-base">
              {item.answer}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export default function FAQ() {
  const [searchQuery, setSearchQuery] = useState("");
  const [activeCategory, setActiveCategory] = useState("All");
  const [openId, setOpenId] = useState<string | null>("why-kiddo");
  const allCategories = ["All", ...Array.from(new Set(faqItems.map((item) => item.category)))];
  // Recursively extract plain text from any value (string, ReactElement,
  // ReactFragment, array). Without this, the search only worked for the
  // ~25% of answers that happen to be raw strings; the ~75% wrapped in
  // <>...</> fragments were silently unsearchable because the
  // typeof === "string" check returned false and answerText fell back
  // to "". Audit 2026-05-25 caught.
  const extractAnswerText = (node: React.ReactNode): string => {
    if (node == null || typeof node === "boolean") return "";
    if (typeof node === "string" || typeof node === "number") return String(node);
    if (Array.isArray(node)) return node.map(extractAnswerText).join(" ");
    if (typeof node === "object" && "props" in node) {
      const children = (node as any).props?.children;
      return extractAnswerText(children);
    }
    return "";
  };
  const filteredFaqs = faqItems.filter((item) => {
    const q = searchQuery.toLowerCase();
    const answerText = extractAnswerText(item.answer).toLowerCase();
    return (
      (item.question.toLowerCase().includes(q) || answerText.includes(q)) &&
      (activeCategory === "All" || item.category === activeCategory)
    );
  });

  // FAQPage structured data — every Q&A as machine-readable text so Google can
  // surface FAQ rich results. Answers are run through the same plain-text
  // extractor the search uses, so JSX answers contribute too.
  const faqJsonLd = useMemo(
    () => ({
      "@context": "https://schema.org",
      "@type": "FAQPage",
      mainEntity: faqItems
        .map((item) => ({
          "@type": "Question",
          name: item.question,
          acceptedAnswer: { "@type": "Answer", text: extractAnswerText(item.answer).replace(/\s+/g, " ").trim() },
        }))
        .filter((q) => q.acceptedAnswer.text.length > 0),
    }),
    [],
  );

  return (
    <div className="min-h-screen bg-background">
      <JsonLd data={faqJsonLd} id="faq-jsonld" />
      <Nav />

      <section className="pb-16 pt-24 md:pb-24 md:pt-32">
        <div className="container mx-auto px-4">
          <div className="mx-auto max-w-3xl">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6 }}
              className="mb-10 text-center"
            >
              <h1
                className="mb-4 font-heading text-3xl font-semibold tracking-tight text-foreground md:text-5xl"
                data-testid="text-page-title"
              >
                Questions? Good. Here are the answers.
              </h1>
              <p className="mx-auto max-w-xl text-lg text-muted-foreground">
                Every question a parent, grandparent, or gifter might have. If something is missing, email us.
              </p>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.080, duration: 0.5 }}
              className="relative mb-8"
            >
              <Search className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
              <input
                type="text"
                placeholder="Search questions..."
                aria-label="Search questions"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full rounded-2xl border border-border bg-card py-3.5 pl-12 pr-4 text-foreground placeholder:text-muted-foreground transition-all focus:border-primary/40 focus:outline-none focus:ring-2 focus:ring-primary/20"
                data-testid="input-faq-search"
              />
            </motion.div>

            <div className="mb-5 flex flex-wrap gap-2">
              {allCategories.map((category) => (
                <button
                  key={category}
                  type="button"
                  onClick={() => setActiveCategory(category)}
                  className={`rounded-full border px-3 py-1.5 text-xs transition-colors ${
                    activeCategory === category
                      ? "border-primary bg-primary text-primary-foreground"
                      : "border-border bg-card text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {category}
                </button>
              ))}
            </div>

            <div
              className="overflow-hidden rounded-2xl border border-border bg-card shadow-premium-sm"
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
                /* Empty-state polish 2026-05-25 Sprint 2. Was a plain
                   "No matching questions found." line — bland, no
                   recovery path. Now: gentle icon + friendly copy
                   + a clear next action ("Ask us directly") so a
                   user whose search comes up empty has a real
                   exit. Matches the EmptyState primitive's shape
                   without importing it (FAQ is a marketing page
                   with its own visual register). */
                <div className="py-16 text-center" data-testid="faq-empty-state">
                  <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-primary">
                    <Search size={20} />
                  </div>
                  <p className="text-base font-medium text-foreground">
                    Nothing matched &ldquo;{searchQuery.trim()}&rdquo;.
                  </p>
                  <p className="mt-2 text-sm text-muted-foreground">
                    Try a shorter search, browse a category, or ask us directly.
                  </p>
                  <div className="mt-5 flex flex-wrap justify-center gap-3 text-sm">
                    <button
                      type="button"
                      onClick={() => { setSearchQuery(""); setActiveCategory("All"); }}
                      className="rounded-full border border-border bg-card px-4 py-2 font-medium text-foreground hover:bg-muted transition-colors"
                      data-testid="faq-empty-reset"
                    >
                      Clear search
                    </button>
                    <Link href="/contact" className="rounded-full bg-primary px-4 py-2 font-medium text-primary-foreground hover:opacity-90 transition-opacity">
                      Ask us
                    </Link>
                  </div>
                </div>
              )}
            </div>

            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.140 }}
              className="mt-10 space-y-4 text-center"
            >
              <p className="text-sm text-muted-foreground">
                Still have questions? You can start with the basics on the{" "}
                <Link href="/how-it-works" className="text-primary hover:underline">
                  How it works
                </Link>{" "}
                page.
              </p>
              <div className="flex flex-wrap justify-center gap-4 text-sm">
                <Link href="/security" className="text-primary hover:underline">
                  Security
                </Link>
                <Link href="/blog/utma-vs-529-for-family-gifting" className="text-primary hover:underline">
                  Child funds vs 529s
                </Link>
                <Link
                  href="/blog/how-to-ask-family-to-invest-instead-of-buying-toys"
                  className="text-primary hover:underline"
                >
                  How to ask family
                </Link>
              </div>
              <div className="flex items-center justify-center gap-3 text-xs text-muted-foreground/70">
                <Lock className="h-3.5 w-3.5" />
                <span>SIPC protection when live</span>
                <span className="text-border">|</span>
                <Shield className="h-3.5 w-3.5" />
                <span>Broker-dealer custody partner</span>
              </div>
            </motion.div>

            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.180 }}
              className="mt-12 rounded-2xl border border-border bg-card p-8 text-center shadow-premium-sm"
            >
              <h2 className="mb-3 font-heading text-2xl font-semibold text-foreground">Ready to start?</h2>
              <p className="mb-6 text-muted-foreground">
                Your child's fund takes about 2 minutes to set up. Free to start.
              </p>
              <div className="flex flex-col justify-center gap-4 sm:flex-row">
                <Link href="/get-started">
                  <Button size="lg" data-testid="button-faq-cta-primary">
                    Start your child's fund
                  </Button>
                </Link>
                <Link href="/pricing">
                  <Button variant="outline" size="lg" data-testid="button-faq-cta-secondary">
                    See pricing
                  </Button>
                </Link>
              </div>
            </motion.div>
          </div>
        </div>
      </section>

      <Footer />
    </div>
  );
}
