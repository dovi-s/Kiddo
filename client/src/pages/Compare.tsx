import { Link, useParams } from "wouter";
import { motion, useReducedMotion } from "framer-motion";
import { ArrowRight, CheckCircle2, Scale, ShieldAlert } from "lucide-react";
import { Nav } from "@/components/layout/Nav";
import { Footer } from "@/components/layout/Footer";
import { Button } from "@/components/ui/button";
import { usePageSeo } from "@/lib/seo";

type ComparisonCard = {
  slug: string;
  title: string;
  teaser: string;
  href: string;
};

type ComparisonRow = {
  label: string;
  competitor: string;
  kora: string;
};

type ComparisonPage = {
  slug: string;
  metaTitle: string;
  metaDescription: string;
  heroTitle: string;
  heroBody: string[];
  ctaLabel: string;
  heroNote?: string;
  tableTitle: string;
  competitorLabel: string;
  comparisonRows: ComparisonRow[];
  sections: Array<{
    title: string;
    body: string[];
  }>;
  bottomTitle: string;
  bottomBody: string;
  disclaimer?: string;
};

type HubSnapshotRow = {
  product: string;
  bestFor: string;
  giftingLink: string;
  noAccountGift: string;
  memoryBook: string;
};

type FullComparisonRow = {
  feature: string;
  kiddo: string;
  earlybird: string;
  acornsEarly: string;
  greenlight: string;
  plan529: string;
  savings: string;
  kiddoHighlight?: boolean;
};

const comparisonCards: ComparisonCard[] = [
  {
    slug: "earlybird",
    title: "EarlyBird vs Kiddo",
    teaser: "EarlyBird was acquired by Acorns and rolled into Acorns Early. Here is how Kiddo compares and what to do next.",
    href: "/compare/earlybird",
  },
  {
    slug: "acorns-early",
    title: "Acorns Early vs Kiddo",
    teaser: "Round-ups are clever. But spare change won't change your child's life. Investment gifting might.",
    href: "/compare/acorns-early",
  },
  {
    slug: "greenlight",
    title: "Greenlight vs Kiddo",
    teaser: "Greenlight teaches kids to spend. Kiddo helps family gifts turn into investments.",
    href: "/compare/greenlight",
  },
  {
    slug: "stockpile",
    title: "Stockpile vs Kiddo",
    teaser: "Stockpile uses gift cards. Kiddo uses a shareable link. That is not a small difference.",
    href: "/compare/stockpile",
  },
  {
    slug: "529",
    title: "529 Plan vs Kiddo",
    teaser: "A 529 is for education. A Kiddo UTMA is for flexibility. Many thoughtful families use both.",
    href: "/compare/529",
  },
  {
    slug: "savings-account",
    title: "Savings Account vs Kiddo",
    teaser: "Savings accounts protect cash. Kiddo is built for long-term gifting and growth.",
    href: "/compare/savings-account",
  },
  {
    slug: "fidelity-utma",
    title: "Fidelity UTMA vs Kiddo",
    teaser: "Fidelity is a great place to hold investments. Kiddo is the gifting ritual a brokerage doesn't give you.",
    href: "/compare/fidelity-utma",
  },
];

const comparisonPages: Record<string, ComparisonPage> = {
  earlybird: {
    slug: "earlybird",
    metaTitle: "EarlyBird Alternative | Kiddo is the natural next step",
    metaDescription:
      "EarlyBird was acquired by Acorns and the standalone product retired. Kiddo is the natural replacement: same shareable gifting link, no account needed for gifters, full Memory Book media (note, photo, video, voice), and no monthly fee to start.",
    heroTitle: "EarlyBird was acquired by Acorns. Now what?",
    heroBody: [
      "EarlyBird was bought by Acorns and rolled into Acorns Early. Your child's money is not gone, but the product families loved is.",
      "If what you want back is a simple gifting link, a personal family experience, and a Memory Book that holds every gift, every note, every voice, Kiddo is the closest fit.",
    ],
    ctaLabel: "Switch to Kiddo",
    heroNote: "Free to start. Rebuild your gifting flow without starting from scratch emotionally.",
    tableTitle: "EarlyBird vs Kiddo: the honest comparison",
    competitorLabel: "EarlyBird",
    comparisonRows: [
      { label: "Status", competitor: "Acquired by Acorns; brand retired", kora: "Active and growing" },
      { label: "Monthly fee", competitor: "$3/mo per child (legacy)", kora: "Free to start. Kiddo+ is $3.99/mo or $29/yr." },
      { label: "UTMA investment account", competitor: "Yes", kora: "Yes, via DriveWealth" },
      { label: "Gifting link for family", competitor: "Yes", kora: "Yes" },
      { label: "No account needed to give", competitor: "Yes", kora: "Yes" },
      { label: "Occasion pages", competitor: "Basic", kora: "Custom, with QR codes" },
      { label: "Memory Book", competitor: "Basic (note + photo)", kora: "Note, photo, video, voice. Every gift, every occasion." },
      { label: "Age-18 handoff", competitor: "Not addressed", kora: "UTMA ownership transfer explained clearly" },
    ],
    sections: [
      {
        title: "What EarlyBird did well",
        body: [
          "EarlyBird built something families genuinely loved: a personal, non-clinical way to invest for a child.",
          "It made gifting feel emotional instead of clinical. That is exactly the part many parents are now trying to replace.",
        ],
      },
      {
        title: "Why families are switching",
        body: [
          "Kiddo keeps the gifting-link experience, but adds stronger occasion pages, a richer Memory Book, and a more celebration-first product story.",
          "It is also free to start, which gives displaced EarlyBird families a lower-friction way to land, set up, and begin sharing again.",
        ],
      },
      {
        title: "What to do next",
        body: [
          "Create your Kiddo account and set up your child's fund first. Then email transfers@kiddofund.com so support can help you understand the best transfer path from your current provider.",
          "Brokerage transfer timing and in-kind eligibility depend on the current custodian and account details, so this is a support-assisted process rather than a fake one-click promise.",
        ],
      },
      {
        title: "Considering Acorns Early too?",
        body: [
          "Acorns acquired EarlyBird, so many displaced families are naturally comparing Kiddo with Acorns Early next.",
          "What Kiddo brings back from EarlyBird is the easy multi-contributor giving experience: a shareable gift link, no account needed for the gifter, full Memory Book entries (note, photo, video, voice), occasion pages with QR codes for parties, and reminder emails that bring family back when birthdays and holidays come around. Recurring contributions are free across all plans (parents and gifters both). Plus is for the parent who wants to design the custom fund mix, switch strategy, and operate the portfolio. Not for the recurring mechanism itself.",
          "If what you want is a parent savings tool inside the wider Acorns ecosystem, that is a real option. If what you want is the gifting link, occasion pages, and full-media Memory Book that EarlyBird families loved, Kiddo is the closer fit.",
        ],
      },
    ],
    bottomTitle: "Start your move from EarlyBird",
    bottomBody:
      "Start free, set up your child's new fund, and get your gifting flow back online. If you are moving an existing custodial account, Kiddo can help you understand the next step.",
  },
  "acorns-early": {
    slug: "acorns-early",
    metaTitle: "Acorns Early vs Kiddo | Micro-investing vs investment gifting",
    metaDescription:
      "Acorns invented micro-investing. Brilliant. But round-ups won't change your child's life. Kiddo invented investment gifting. Here is the honest difference.",
    heroTitle: "Acorns is brilliant. Round-ups are clever. But spare change won't change Emma's life.",
    heroBody: [
      "Acorns created micro-investing. Genuinely category-defining. Every coffee, every Uber, every grocery run quietly building a portfolio in the background. That is elegant.",
      "But here is the honest math: the average round-up is about $0.50. At 30 transactions a month, that is $15 of micro-investment. At 7% annual returns over 18 years, you are looking at roughly $6,500. That is a nice bonus. Not a head start.",
      "Kiddo is a different category entirely. Not micro-investing. Investment gifting. The $75 grandma gives at every birthday. The $100 from uncle Joe at Christmas. The $50 from a friend who followed a link in a text message. All of it compounding together for 18 years.",
    ],
    ctaLabel: "Start your child's fund",
    heroNote: "Free to start. Takes 2 minutes. Investing involves risk.",
    tableTitle: "Acorns Early vs Kiddo: the honest differences",
    competitorLabel: "Acorns Early",
    comparisonRows: [
      { label: "Category", competitor: "Micro-investing (parent saves for child)", kora: "Investment gifting (family invests in child)" },
      { label: "How money enters the fund", competitor: "Round-ups and manual deposits from parent", kora: "Gifts from anyone via shareable link" },
      { label: "Monthly fee", competitor: "$5/mo through Acorns Gold", kora: "Free to start. Kiddo+ is $3.99/mo or $29/yr." },
      { label: "Shareable gift link", competitor: "No", kora: "Yes" },
      { label: "No account needed to give", competitor: "No", kora: "Yes" },
      { label: "Occasion pages", competitor: "No", kora: "Yes" },
      { label: "QR code for parties", competitor: "No", kora: "Yes" },
      { label: "Memory Book", competitor: "No", kora: "Yes" },
      { label: "Auto round-up investing", competitor: "Yes", kora: "No" },
      { label: "Broader financial ecosystem", competitor: "Yes", kora: "No" },
      { label: "UTMA custodial account", competitor: "Yes", kora: "Yes, via DriveWealth" },
    ],
    sections: [
      {
        title: "Acorns created a real category",
        body: [
          "Micro-investing is a genuine innovation. Acorns built a $2B+ company on the insight that friction is the enemy of saving. Remove the friction, the saving happens. That is true.",
          "If you already use Acorns and want a custodial account inside that same ecosystem, Acorns Early is a coherent choice. No dishonesty here.",
        ],
      },
      {
        title: "The math tells the story",
        body: [
          "Acorns model: $15/month in round-ups at 7% for 18 years is roughly $6,500. Real money. Not life-changing money.",
          "Kiddo model: eight people who love your child each gifting $50 to $100 per year is $400 to $800 annually. At 7% over 18 years, that is $14,000 to $28,000. And that is conservative. That is a real head start.",
          "The difference is not the product. It is the model. One person saving versus a whole community investing.",
        ],
      },
      {
        title: "Investment gifting is a new category",
        body: [
          "Acorns = one person investing for themselves. Kiddo = a community investing in a child. Those are different jobs. Different emotional experiences. Different outcomes.",
          "Nobody had built the category for investing in someone else until now. For the child. For the 18-year relationship. For the birthday and the Christmas and the baby shower that already exist in family life.",
          "That is what Kiddo is. Gifts that actually last.",
        ],
      },
    ],
    bottomTitle: "Gifts that last. Not just spare change.",
    bottomBody:
      "Round-ups are clever. But the $50 grandma gives at every birthday has always been the bigger opportunity. Kiddo turns that moment into a real investment. In under 60 seconds. No account needed to give.",
  },
  greenlight: {
    slug: "greenlight",
    metaTitle: "Greenlight vs Kiddo | Spending app vs gifting platform",
    metaDescription:
      "Greenlight is a debit card and spending app for kids. Kiddo is a gifting and investing platform. They solve different problems.",
    heroTitle: "Greenlight and Kiddo solve different problems.",
    heroBody: [
      "Greenlight is excellent at teaching kids to manage money through a debit card, chores, and spending controls.",
      "Kiddo does something different: it turns birthdays, holidays, and family gifting moments into real investments for your child.",
    ],
    ctaLabel: "Start your child's fund",
    heroNote: "Many families use both.",
    tableTitle: "Greenlight vs Kiddo: the real differences",
    competitorLabel: "Greenlight",
    comparisonRows: [
      { label: "Primary focus", competitor: "Spending and banking", kora: "Gifting and investing" },
      { label: "Monthly fee", competitor: "$5.99 to $24.98/mo", kora: "Free to start. Paid plans from $3.99/mo" },
      { label: "Debit card for kids", competitor: "Yes", kora: "No" },
      { label: "Parental spending controls", competitor: "Yes", kora: "No" },
      { label: "Gifting link for family", competitor: "No", kora: "Yes" },
      { label: "No account needed to give", competitor: "No", kora: "Yes" },
      { label: "UTMA investment account", competitor: "Add-on", kora: "Core product" },
      { label: "Memory Book", competitor: "No", kora: "Yes" },
    ],
    sections: [
      {
        title: "Choose Greenlight if",
        body: [
          "You want a debit card for your child, allowance controls, chores, and a day-to-day spending product.",
          "That is a real job to be done, and Greenlight is built for it.",
        ],
      },
      {
        title: "Choose Kiddo if",
        body: [
          "You want your family to be able to invest in your child's future easily through birthdays, holidays, and every occasion that already exists in your life.",
          "Kiddo is strongest when the emotional moment is gifting, not weekly spending.",
        ],
      },
      {
        title: "The gifting gap",
        body: [
          "Greenlight does not give your family a no-account-required link they can use in under 60 seconds to invest for your child.",
          "Kiddo was built around that exact experience. Grandma taps a link, pays, and the gift goes to work.",
        ],
      },
    ],
    bottomTitle: "Start your child's fund",
    bottomBody:
      "If you want a child spending app, Greenlight is worth considering. If you want a gifting platform that invests, Kiddo is built for that job.",
  },
  stockpile: {
    slug: "stockpile",
    metaTitle: "Stockpile vs Kiddo | Gift cards vs a shareable gifting link",
    metaDescription:
      "Stockpile uses gift cards. Kiddo uses a shareable link. Here is why that difference matters for your family.",
    heroTitle: "Stockpile uses gift cards. Kiddo uses a link.",
    heroBody: [
      "That sounds like a small difference. It is not.",
      "Gift cards create extra steps. A shareable link removes them. For family gifting, that difference changes whether people actually follow through.",
    ],
    ctaLabel: "Start your child's fund",
    heroNote: "Free to start. Takes 2 minutes.",
    tableTitle: "Stockpile vs Kiddo: the real differences",
    competitorLabel: "Stockpile",
    comparisonRows: [
      { label: "Monthly fee", competitor: "$4.95/mo", kora: "Free to start. Paid plans from $3.99/mo" },
      { label: "Gifting model", competitor: "Gift card purchase and redemption", kora: "Shareable link" },
      { label: "Account needed to give", competitor: "Often yes", kora: "No" },
      { label: "Occasion pages", competitor: "No", kora: "Yes" },
      { label: "Memory Book", competitor: "No", kora: "Yes" },
      { label: "QR code for parties", competitor: "No", kora: "Yes" },
      { label: "Ongoing family gifting", competitor: "Clunky", kora: "Easy to repeat" },
      { label: "Age-18 transition", competitor: "Not addressed", kora: "Part of product direction" },
    ],
    sections: [
      {
        title: "Why the gift-card model creates friction",
        body: [
          "With Stockpile, a family member has to buy a card, send a card, and then someone has to redeem it.",
          "With Kiddo, you share a link once and family members can give without needing to learn a redemption workflow.",
        ],
      },
      {
        title: "What that means in real life",
        body: [
          "A clunky model works for one-off novelty gifting. It struggles when you want birthdays, holidays, and repeat family gifting to feel easy every time.",
          "Kiddo is better suited to an ongoing family habit.",
        ],
      },
      {
        title: "Why the story matters too",
        body: [
          "Stockpile tracks transactions. Kiddo aims to preserve the context: who gave, what they said, and what occasion it was tied to.",
          "That is what turns a list of deposits into something your child might actually care about later.",
        ],
      },
    ],
    bottomTitle: "Start your child's fund",
    bottomBody:
      "If you want the easiest path from family gift to investment, the link beats the gift card.",
  },
  "529": {
    slug: "529",
    metaTitle: "529 vs UTMA | Which is right for your child?",
    metaDescription:
      "A 529 is for education. A Kiddo UTMA is for flexibility. Here is an honest comparison to help you decide. Many families use both.",
    heroTitle: "UTMA vs 529: the honest comparison.",
    heroBody: [
      "This is one of the most common questions parents ask when they start investing for a child.",
      "For many thoughtful families, the answer is not one or the other. It is both, because the products solve different jobs.",
    ],
    ctaLabel: "Start your child's fund",
    heroNote: "Many families use both.",
    tableTitle: "529 vs Kiddo UTMA: the honest differences",
    competitorLabel: "529 Plan",
    comparisonRows: [
      { label: "Primary purpose", competitor: "Education savings", kora: "Any future purpose" },
      { label: "Tax-deductible giving", competitor: "Often yes", kora: "No" },
      { label: "Tax-free qualified growth", competitor: "Yes", kora: "No" },
      { label: "Restrictions on use", competitor: "Education-focused", kora: "None" },
      { label: "Family can gift easily", competitor: "Usually awkward", kora: "Yes, via shareable link" },
      { label: "Investment options", competitor: "Limited menus", kora: "Stocks, ETFs, fractional shares" },
      { label: "Memory Book", competitor: "No", kora: "Yes" },
      { label: "Control transfer", competitor: "Owner-controlled", kora: "Child takes control at majority" },
    ],
    sections: [
      {
        title: "Choose a 529 if",
        body: [
          "You are primarily saving for college and want the tax advantages that come with education-specific use.",
          "That is a strong reason to open a 529. It is a real advantage, and it should be acknowledged plainly.",
        ],
      },
      {
        title: "Choose a Kiddo UTMA if",
        body: [
          "You want family gifting to be easy, flexible, and connected to real occasions instead of provider portals and account numbers.",
          "You also want the money to be usable later for more than just education.",
        ],
      },
      {
        title: "Why many families use both",
        body: [
          "A 529 can handle the systematic college-saving side. Kiddo can handle the emotional family-gifting side.",
          "The 529 is the tax tool. Kiddo is the gifting tool. Those are different jobs.",
        ],
      },
    ],
    bottomTitle: "Start your child's Kiddo fund",
    bottomBody:
      "You do not have to choose a single tool for every job. Many families use a 529 for education savings and Kiddo for gifting occasions.",
    disclaimer:
      "Tax treatment depends on your state and your family's situation. Talk to a tax advisor about your specific circumstances.",
  },
  "savings-account": {
    slug: "savings-account",
    metaTitle: "Savings Account vs Kiddo | 0.01% interest vs real stock investments",
    metaDescription:
      "A savings account earns almost nothing. A Kiddo UTMA invests in real stocks. Here is the honest comparison for long-term family gifting.",
    heroTitle: "A savings account earns almost nothing.",
    heroBody: [
      "Savings accounts are useful for safety and short-term cash. They are not designed to turn years of family gifts into long-term growth.",
      "If the horizon is 18 years, the tradeoff between protection and growth needs to be understood clearly.",
    ],
    ctaLabel: "Start your child's fund",
    heroNote: "Investing involves risk. Past performance does not guarantee future results.",
    tableTitle: "Savings account vs Kiddo UTMA: the honest differences",
    competitorLabel: "Savings Account",
    comparisonRows: [
      { label: "Primary use", competitor: "Short-term cash savings", kora: "Long-term investing" },
      { label: "Invests in real stocks", competitor: "No", kora: "Yes" },
      { label: "Family can gift easily", competitor: "No", kora: "Yes, via shareable link" },
      { label: "FDIC / SIPC coverage", competitor: "FDIC", kora: "SIPC for securities" },
      { label: "Risk of loss", competitor: "Very low", kora: "Yes" },
      { label: "Memory Book", competitor: "No", kora: "Yes" },
      { label: "Occasion pages", competitor: "No", kora: "Yes" },
      { label: "Best fit", competitor: "Emergency or near-term savings", kora: "Long-horizon family gifting" },
    ],
    sections: [
      {
        title: "What savings accounts are actually good for",
        body: [
          "They are great for money you may need soon and cannot afford to have fluctuate.",
          "That makes them useful for emergency funds and short-term goals. It does not make them the best tool for an 18-year child timeline.",
        ],
      },
      {
        title: "Why Kiddo is different",
        body: [
          "Kiddo is built for the gifts that arrive over time and have years to grow. That is a different job than cash storage.",
          "The point is not that savings accounts are bad. It is that they solve a different problem.",
        ],
      },
      {
        title: "The honest risk disclosure",
        body: [
          "Investing means the value can go down as well as up. That risk is real and should never be hidden.",
          "For long horizons, many families still choose investing because the historical growth potential has been meaningfully higher than cash.",
        ],
      },
    ],
    bottomTitle: "Start your child's fund",
    bottomBody:
      "A gift that gets invested has a chance to grow into something meaningful. A gift parked in a low-yield savings account usually does not.",
    disclaimer:
      "Kiddo does not provide investment advice. Consider your own time horizon and risk tolerance before investing.",
  },
  "fidelity-utma": {
    slug: "fidelity-utma",
    metaTitle: "Fidelity UTMA vs Kiddo | Brokerage account vs gifting ritual",
    metaDescription:
      "Fidelity is great for holding investments. Kiddo is great for the family gifting ritual a brokerage doesn't give you: shareable links, occasion pages, a Memory Book, and an at-18 handoff that's actually designed.",
    heroTitle: "Fidelity is a brokerage. Kiddo is a gifting ritual.",
    heroBody: [
      "Fidelity, Schwab, and Vanguard are excellent places to hold investments for a child. They are not designed to make giving feel like an occasion.",
      "Kiddo is the layer on top of a brokerage account that families actually use: a link grandma can open in 30 seconds, an occasion page for a baby shower, a Memory Book that compounds alongside the money, and an at-18 transition that's been thought through.",
    ],
    ctaLabel: "Start your child's fund",
    heroNote: "Many thoughtful families have a Fidelity 529 for education AND a Kiddo UTMA for the gifting ritual. Different jobs, different products.",
    tableTitle: "Fidelity UTMA vs Kiddo: the honest comparison",
    competitorLabel: "Fidelity UTMA",
    comparisonRows: [
      { label: "Monthly subscription", competitor: "$0", kora: "$0 Free. Plus $3.99/mo or $29/yr." },
      { label: "Annual fee on invested assets", competitor: "None on the UTMA itself. ETF expense ratios apply.", kora: "$1/year per $1,000 invested, all plans (about $10/yr on a $10,000 fund). ETF expense ratios still apply on top." },
      { label: "Account opening time", competitor: "About 20 to 30 minutes including KYC", kora: "About 5 minutes. KYC handled in flow." },
      { label: "Investment universe", competitor: "Full ETFs, mutual funds, individual stocks", kora: "Curated age-appropriate mixes plus custom ticker selection" },
      { label: "Shareable gifting link", competitor: "None. Brokerages don't do gifting flow.", kora: "Yes. Family opens, picks an amount, pays in under a minute." },
      { label: "No-account-needed gifting", competitor: "No. Gifts arrive as a transfer the parent has to wire in.", kora: "Yes. Gifters never sign up." },
      { label: "Occasion pages for birthdays and milestones", competitor: "None", kora: "Custom occasion pages with QR codes" },
      { label: "Memory Book of every gift", competitor: "Statement only", kora: "Every gift, every note, photo, video, voice memory" },
      { label: "Sealed letter for the 18th birthday", competitor: "None", kora: "Yes. Text plus voice plus photo plus video, opened only at 18." },
      { label: "Age-18 handoff guidance", competitor: "Statutory only. Account flips to the kid; you figure out the rest.", kora: "Five-stage parent ramp from age 13 through 18, FAQ, checklist, projection, transition worker." },
      { label: "Kid-facing view", competitor: "None", kora: "Kid View on every plan. Age-aware copy from 5 to 17. Family covers every child." },
      { label: "Brokerage", competitor: "Fidelity", kora: "DriveWealth. SIPC-protected." },
    ],
    sections: [
      {
        title: "What Fidelity does well",
        body: [
          "If your only job is to hold investments for a child until they turn 18, Fidelity is excellent. The fees are competitive, the investment universe is wide, and the brand is established. Many families already have a Fidelity relationship for their own retirement and 529 accounts, and adding a custodial UTMA there is a one-form decision.",
          "What Fidelity does NOT do is the part most families struggle with: the actual ritual of giving. There's no shareable link. There's no occasion page for the baby shower. There's no clean way for grandma to gift from across the country in under a minute without a paper check. Brokerages were built for self-directed investors, not for the family-and-friends gifting layer that builds a kid's fund over 18 years.",
        ],
      },
      {
        title: "Why families use Kiddo on top of, or instead of, Fidelity",
        body: [
          "Four moats separate Kiddo from a generic brokerage UTMA. First, the gifting infrastructure: shareable link, occasion pages, no-account-needed checkout. Second, the Memory Book that compounds alongside the money. Every gift remembered, every note saved, voice memories sealed for 18. Third, the brokerage UX opinionated for a kid-fund: age-aware Kid View, age-band strategy nudges from 11 onward. Fourth, the at-18 transition designed as an emotional climax rather than a statutory cliff.",
          "Many thoughtful families keep their Fidelity 529 for education and start a Kiddo UTMA for the gifting ritual. Different jobs, different products. The 529 is restricted to qualified education expenses; the Kiddo UTMA is the kid's at 18, no restrictions, no penalties.",
        ],
      },
      {
        title: "The honest tradeoff",
        body: [
          "Kiddo's annual fee is $1 per $1,000 invested across all plans, on top of ETF expense ratios. Fidelity charges nothing on the UTMA wrapper. On a $10,000 invested fund that's about $10 per year of fee difference, in exchange for the gifting layer, the Memory Book, the age-band nudges, and the at-18 ramp.",
          "If those features are not worth $10 per year per $10,000 to you, Fidelity is the right choice. If they are, Kiddo is.",
        ],
      },
    ],
    bottomTitle: "Start your child's fund",
    bottomBody:
      "Fidelity is a great brokerage. Kiddo is what makes a brokerage account feel like a gift family can actually give.",
    disclaimer:
      "Kiddo does not provide investment advice. Consider your own time horizon and risk tolerance before investing. Fees, features, and account terms at Fidelity may change. Always confirm current offerings with the provider directly.",
  },
};

const hubSnapshotRows: HubSnapshotRow[] = [
  { product: "Kiddo", bestFor: "Investment gifting: family gifts that become real investments", giftingLink: "Yes", noAccountGift: "Yes", memoryBook: "Yes" },
  { product: "Acorns Early", bestFor: "Micro-investing and parent-led saving inside Acorns", giftingLink: "No", noAccountGift: "No", memoryBook: "No" },
  { product: "Greenlight", bestFor: "Spending, chores, debit card", giftingLink: "No", noAccountGift: "No", memoryBook: "No" },
  { product: "Stockpile", bestFor: "Gift-card style stock gifting", giftingLink: "Sort of", noAccountGift: "Not cleanly", memoryBook: "No" },
  { product: "529 plan", bestFor: "Education-first tax savings", giftingLink: "Usually awkward", noAccountGift: "No", memoryBook: "No" },
  { product: "Savings account", bestFor: "Short-term cash storage", giftingLink: "No", noAccountGift: "No", memoryBook: "No" },
] as const;

const fullComparisonRows: FullComparisonRow[] = [
  {
    feature: "Account type",
    kiddo: "UTMA custodial (via DriveWealth)",
    earlybird: "UTMA custodial, shut down June 2025",
    acornsEarly: "UTMA custodial (via Acorns)",
    greenlight: "Debit card + savings",
    plan529: "529 education savings",
    savings: "Bank savings / HYSA",
  },
  {
    feature: "Monthly fee",
    kiddo: "Free to start. Kiddo+ is $3.99/mo.",
    earlybird: "$3/mo per child (no longer available)",
    acornsEarly: "$5/mo bundled with Acorns Gold",
    greenlight: "$4.99 to $14.98/mo depending on tier",
    plan529: "No monthly fee; fund expense ratios vary",
    savings: "Free at most banks",
  },
  {
    feature: "Shareable gift link",
    kiddo: "Yes, anyone can give in under a minute",
    earlybird: "Yes (product no longer active)",
    acornsEarly: "No",
    greenlight: "No",
    plan529: "No easy link; awkward workarounds",
    savings: "No",
    kiddoHighlight: true,
  },
  {
    feature: "No account needed to give",
    kiddo: "Yes, gifters need only a card",
    earlybird: "Yes (product no longer active)",
    acornsEarly: "No",
    greenlight: "No",
    plan529: "No",
    savings: "No",
    kiddoHighlight: true,
  },
  {
    feature: "Occasion pages",
    kiddo: "Yes, birthdays, baby showers, holidays",
    earlybird: "Basic",
    acornsEarly: "No",
    greenlight: "No",
    plan529: "No",
    savings: "No",
    kiddoHighlight: true,
  },
  {
    feature: "Memory Book / emotional layer",
    kiddo: "Yes, every gift, every note, every occasion",
    earlybird: "Basic photo + message",
    acornsEarly: "No",
    greenlight: "No",
    plan529: "No",
    savings: "No",
    kiddoHighlight: true,
  },
  {
    feature: "Stock pick for gifters",
    kiddo: "Yes, gifters can suggest a stock",
    earlybird: "No",
    acornsEarly: "No",
    greenlight: "No",
    plan529: "No",
    savings: "No",
    kiddoHighlight: true,
  },
  {
    feature: "Child view / education layer",
    kiddo: "Yes, age-adapted, fund story, suggestions",
    earlybird: "No",
    acornsEarly: "No",
    greenlight: "Yes, spending and saving focus",
    plan529: "No",
    savings: "No",
  },
  {
    feature: "Investment flexibility",
    kiddo: "Any stock or family mix; parent sets default",
    earlybird: "Family mix only",
    acornsEarly: "Family mix only",
    greenlight: "Fractional stocks (Greenlight Max tier)",
    plan529: "Limited to plan investment options",
    savings: "No investment; interest only",
  },
  {
    feature: "Best for",
    kiddo: "Investment gifting: turning every family occasion into a real investment",
    earlybird: "Gifting, no longer available",
    acornsEarly: "Micro-investing and parent-led saving inside Acorns",
    greenlight: "Kids learning to spend and earn",
    plan529: "Education-specific tax-advantaged savings",
    savings: "Short-term cash with easy access",
  },
];

function FadeIn({
  children,
  delay = 0,
  className = "",
}: {
  children: React.ReactNode;
  delay?: number;
  className?: string;
}) {
  // Respect prefers-reduced-motion per Home.tsx pattern. Without this,
  // OS reduced-motion users get fade-in motion on every scroll-into-view
  // section (Compare.tsx has ~17 FadeIn instances — the cumulative
  // motion load is real). Matches the locked count-up animation a11y
  // discipline.
  const reduceMotion = useReducedMotion();
  return (
    <motion.div
      initial={reduceMotion ? { opacity: 1 } : { opacity: 0, y: 18 }}
      whileInView={reduceMotion ? { opacity: 1 } : { opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-50px" }}
      transition={reduceMotion ? { duration: 0 } : { duration: 0.45, delay }}
      className={className}
    >
      {children}
    </motion.div>
  );
}

function AlsoCompare({ currentSlug }: { currentSlug?: string }) {
  const links = comparisonCards.filter((card) => card.slug !== currentSlug);
  return (
    <div className="mt-10 rounded-2xl border border-border bg-card p-6 shadow-premium-sm">
      <p className="text-sm font-medium text-foreground">Also compare</p>
      <div className="mt-3 flex flex-wrap gap-3 text-sm text-primary">
        {links.map((card) => (
          <Link key={card.slug} href={card.href} className="hover:underline">
            {card.title}
          </Link>
        ))}
      </div>
    </div>
  );
}

function ComparisonDetail({ page }: { page: ComparisonPage }) {
  usePageSeo({
    title: page.metaTitle,
    description: page.metaDescription,
    ogType: "article",
  });

  return (
    <>
      <section className="pt-24 pb-14 md:pt-32 md:pb-18">
        <div className="mx-auto max-w-5xl px-4 text-center">
          <p className="text-sm font-semibold uppercase tracking-[0.2em] text-primary">Compare</p>
          <h1 className="mt-4 font-heading text-4xl md:text-6xl font-bold tracking-tight text-foreground">
            {page.heroTitle}
          </h1>
          <div className="mx-auto mt-6 max-w-3xl space-y-4 text-lg leading-relaxed text-muted-foreground">
            {page.heroBody.map((paragraph) => (
              <p key={paragraph}>{paragraph}</p>
            ))}
          </div>
          <div className="mt-8">
            <Link href="/get-started">
              <Button size="lg" data-testid={`button-compare-${page.slug}-hero`}>
                {page.ctaLabel}
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </Link>
          </div>
          {page.heroNote ? <p className="mt-4 text-sm text-muted-foreground">{page.heroNote}</p> : null}
        </div>
      </section>

      <section className="pb-14 md:pb-18">
        <div className="mx-auto max-w-5xl px-4">
          <FadeIn className="mb-6 rounded-2xl border border-primary/15 bg-primary/5 px-5 py-4 text-sm leading-relaxed text-muted-foreground">
            <span className="font-medium text-foreground">What this table is answering:</span> which product is easiest for family gifting, what kind of account experience it creates, and where Kiddo is meaningfully different.
          </FadeIn>
          <FadeIn className="overflow-hidden rounded-3xl border border-border bg-card shadow-premium-sm">
            <div className="border-b border-border bg-muted/30 px-6 py-5">
              <h2 className="font-heading text-2xl font-semibold text-foreground">{page.tableTitle}</h2>
            </div>
            <div className="grid grid-cols-3 border-b border-border bg-muted/20 text-sm font-medium text-foreground">
              <div className="px-5 py-4"></div>
              <div className="px-5 py-4">{page.competitorLabel}</div>
              <div className="px-5 py-4">Kiddo</div>
            </div>
            {page.comparisonRows.map((row) => (
              <div key={row.label} className="grid grid-cols-3 border-b border-border text-sm last:border-b-0">
                <div className="px-5 py-4 font-medium text-foreground">{row.label}</div>
                <div className="px-5 py-4 text-muted-foreground">{row.competitor}</div>
                <div className="px-5 py-4 text-muted-foreground">{row.kora}</div>
              </div>
            ))}
          </FadeIn>
        </div>
      </section>

      <section className="pb-14 md:pb-18">
        <div className="mx-auto grid max-w-5xl gap-6 px-4 md:grid-cols-3">
          {page.sections.map((section, index) => (
            <FadeIn key={section.title} delay={index * 0.06} className="h-full rounded-3xl border border-border bg-card p-7 shadow-premium-sm">
              <h2 className="font-heading text-2xl font-semibold text-foreground">{section.title}</h2>
              <div className="mt-4 space-y-4 text-sm leading-7 text-muted-foreground">
                {section.body.map((paragraph) => (
                  <p key={paragraph}>{paragraph}</p>
                ))}
              </div>
            </FadeIn>
          ))}
        </div>
      </section>

      <section className="pb-20 md:pb-28">
        <div className="mx-auto max-w-4xl px-4">
          <FadeIn className="rounded-3xl border border-border bg-card p-8 md:p-12 text-center shadow-premium-sm">
            <div className="inline-flex items-center gap-2 rounded-full bg-primary/10 px-4 py-2 text-sm font-medium text-primary">
              <CheckCircle2 className="h-4 w-4" />
              Honest comparison, one clear next step
            </div>
            <h2 className="mt-6 font-heading text-3xl md:text-4xl font-bold tracking-tight text-foreground">
              {page.bottomTitle}
            </h2>
            <p className="mx-auto mt-4 max-w-2xl text-muted-foreground">{page.bottomBody}</p>
            {page.disclaimer ? <p className="mx-auto mt-4 max-w-2xl text-xs text-muted-foreground">{page.disclaimer}</p> : null}
            <div className="mt-8 flex flex-col justify-center gap-4 sm:flex-row">
              <Link href="/get-started">
                <Button size="lg" data-testid={`button-compare-${page.slug}-footer`}>
                  Start your child's fund
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              </Link>
              <Link href="/compare">
                <Button variant="outline" size="lg" data-testid={`button-compare-${page.slug}-footer-secondary`}>
                  See all comparisons
                </Button>
              </Link>
            </div>
          </FadeIn>
          <AlsoCompare currentSlug={page.slug} />
        </div>
      </section>
    </>
  );
}

function ComparisonHub() {
  usePageSeo({
    title: "Investment gifting vs the alternatives | Kiddo",
    description:
      "Acorns created micro-investing. Greenlight owns spending. Nobody built investment gifting, until Kiddo. Honest comparisons with EarlyBird, Acorns Early, Greenlight, 529 plans, and savings accounts.",
    ogType: "website",
  });

  return (
    <>
      <section className="pt-24 pb-16 md:pt-32 md:pb-20">
        <div className="mx-auto max-w-5xl px-4 text-center">
          <p className="text-sm font-semibold uppercase tracking-[0.2em] text-primary">Compare</p>
          <h1 className="mt-4 font-heading text-4xl md:text-6xl font-bold tracking-tight text-foreground">
            Nobody built investment gifting. Until now.
          </h1>
          <p className="mx-auto mt-6 max-w-3xl text-lg leading-relaxed text-muted-foreground">
            Acorns created micro-investing. Greenlight owns spending. 529s handle education. None of them built what comes next: a shareable link that turns every birthday, holiday, and baby shower into a real investment for your child.
          </p>
          <p className="mx-auto mt-4 max-w-2xl text-base leading-relaxed text-muted-foreground">
            That is investment gifting. That is Kiddo. Here is the honest comparison.
          </p>
        </div>
      </section>

      <section className="pb-16 md:pb-20">
        <div className="mx-auto grid max-w-6xl gap-6 px-4 md:grid-cols-2 xl:grid-cols-3">
          {comparisonCards.map((card, index) => (
            <FadeIn key={card.slug} delay={index * 0.05} className="rounded-3xl border border-border bg-card p-7 shadow-premium-sm">
              <p className="text-sm font-semibold uppercase tracking-[0.12em] text-primary">Comparison</p>
              <h2 className="mt-4 font-heading text-2xl font-semibold text-foreground">{card.title}</h2>
              <p className="mt-3 text-sm leading-7 text-muted-foreground">{card.teaser}</p>
              <Link href={card.href} className="mt-6 inline-flex items-center gap-2 text-sm font-medium text-primary hover:underline">
                Read comparison
                <ArrowRight className="h-4 w-4" />
              </Link>
            </FadeIn>
          ))}
        </div>
      </section>

      {/* The math section */}
      <section className="pb-16 md:pb-20">
        <div className="mx-auto max-w-5xl px-4">
          <FadeIn className="grid gap-6 md:grid-cols-2">
            <div className="rounded-3xl border border-border bg-card p-8 shadow-premium-sm">
              <p className="text-xs font-bold uppercase tracking-[0.15em] text-muted-foreground">Micro-investing model</p>
              <h3 className="mt-3 font-heading text-2xl font-bold text-foreground">Round-ups. Clever. But spare change is still spare change.</h3>
              <div className="mt-5 space-y-2 text-sm text-muted-foreground">
                <div className="flex justify-between border-b border-border pb-2">
                  <span>Average round-up per transaction</span>
                  <span className="font-medium text-foreground">$0.50</span>
                </div>
                <div className="flex justify-between border-b border-border pb-2">
                  <span>Transactions per month</span>
                  <span className="font-medium text-foreground">30</span>
                </div>
                <div className="flex justify-between border-b border-border pb-2">
                  <span>Monthly micro-investment</span>
                  <span className="font-medium text-foreground">$15</span>
                </div>
                <div className="flex justify-between border-b border-border pb-2">
                  <span>Annual total</span>
                  <span className="font-medium text-foreground">$180</span>
                </div>
                <div className="flex justify-between pt-1">
                  <span className="font-semibold text-foreground">After 18 years at 7%</span>
                  <span className="text-lg font-bold text-foreground">~$6,500</span>
                </div>
              </div>
              <p className="mt-4 text-xs leading-relaxed text-muted-foreground">Real money. Not a head start. Not the story you want to tell your child when they turn 18.</p>
            </div>

            <div className="rounded-3xl border border-primary/20 bg-primary/5 p-8 shadow-premium-sm">
              <p className="text-xs font-bold uppercase tracking-[0.15em] text-primary">Investment gifting model</p>
              <h3 className="mt-3 font-heading text-2xl font-bold text-foreground">Every birthday. Every holiday. Everyone who loves your child.</h3>
              <div className="mt-5 space-y-2 text-sm text-muted-foreground">
                <div className="flex justify-between border-b border-border pb-2">
                  <span>Average birthday gift</span>
                  <span className="font-medium text-foreground">$75</span>
                </div>
                <div className="flex justify-between border-b border-border pb-2">
                  <span>Average holiday gift</span>
                  <span className="font-medium text-foreground">$75</span>
                </div>
                <div className="flex justify-between border-b border-border pb-2">
                  <span>Other occasions</span>
                  <span className="font-medium text-foreground">$50</span>
                </div>
                <div className="flex justify-between border-b border-border pb-2">
                  <span>Annual gifting (one child, small circle)</span>
                  <span className="font-medium text-foreground">$200+</span>
                </div>
                <div className="flex justify-between pt-1">
                  <span className="font-semibold text-foreground">After 18 years at 7%</span>
                  <span className="text-lg font-bold text-primary">~$17,000+</span>
                </div>
              </div>
              <p className="mt-4 text-xs leading-relaxed text-muted-foreground">And that is conservative. One child. A small circle. No viral loop. Add the people who love your child, and the number grows with them.</p>
            </div>
          </FadeIn>
          <FadeIn delay={0.1}>
            <p className="mt-5 text-center text-xs text-muted-foreground">Hypothetical projections at 7% annual return, compounded annually. Not guaranteed. Investing involves risk. Past performance does not predict future results.</p>
          </FadeIn>
        </div>
      </section>

      <section className="pb-16 md:pb-20">
        <div className="mx-auto max-w-6xl px-4">
          <FadeIn className="overflow-hidden rounded-3xl border border-border bg-card shadow-premium-sm">
            <div className="border-b border-border bg-muted/30 px-6 py-5">
              <h2 className="font-heading text-2xl font-semibold text-foreground">Quick skim: who does what best?</h2>
              <p className="mt-2 max-w-3xl text-sm leading-relaxed text-muted-foreground">
                If you do not want to open six tabs, this is the fast answer. Kiddo wins when the job is getting family and friends to invest through a link that actually gets used.
              </p>
            </div>
            <div className="overflow-x-auto">
              <table className="min-w-full text-left text-sm">
                <thead className="bg-muted/20 text-foreground">
                  <tr>
                    <th className="px-5 py-4 font-medium">Product</th>
                    <th className="px-5 py-4 font-medium">Best for</th>
                    <th className="px-5 py-4 font-medium">Shareable gifting link</th>
                    <th className="px-5 py-4 font-medium">No account needed to give</th>
                    <th className="px-5 py-4 font-medium">Memory Book / emotional layer</th>
                  </tr>
                </thead>
                <tbody>
                  {hubSnapshotRows.map((row) => {
                    const isKiddo = row.product === "Kiddo";
                    return (
                      <tr key={row.product} className={`border-t border-border ${isKiddo ? "bg-primary/5" : ""}`}>
                        <td className={`px-5 py-4 font-medium ${isKiddo ? "text-primary" : "text-foreground"}`}>{row.product}</td>
                        <td className={`px-5 py-4 ${isKiddo ? "font-medium text-foreground" : "text-muted-foreground"}`}>{row.bestFor}</td>
                        <td className={`px-5 py-4 ${isKiddo ? "font-medium text-primary" : "text-muted-foreground"}`}>{row.giftingLink}</td>
                        <td className={`px-5 py-4 ${isKiddo ? "font-medium text-primary" : "text-muted-foreground"}`}>{row.noAccountGift}</td>
                        <td className={`px-5 py-4 ${isKiddo ? "font-medium text-primary" : "text-muted-foreground"}`}>{row.memoryBook}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </FadeIn>
        </div>
      </section>

      <section className="pb-16 md:pb-20">
        <div className="mx-auto max-w-7xl px-4">
          <FadeIn className="overflow-hidden rounded-3xl border border-border bg-card shadow-premium-sm">
            <div className="border-b border-border bg-muted/30 px-6 py-5">
              <h2 className="font-heading text-2xl font-semibold text-foreground">Feature-by-feature: the full picture</h2>
              <p className="mt-2 max-w-3xl text-sm leading-relaxed text-muted-foreground">
                Ten things that matter when choosing how to invest for a child. Kiddo rows highlighted where it leads.
              </p>
            </div>
            <div className="overflow-x-auto">
              <table className="min-w-full text-left text-sm">
                <thead className="bg-muted/20 text-foreground">
                  <tr>
                    <th className="px-4 py-4 font-medium min-w-[160px]"></th>
                    <th className="px-4 py-4 font-semibold text-primary min-w-[140px]">Kiddo</th>
                    <th className="px-4 py-4 font-medium min-w-[130px]">EarlyBird</th>
                    <th className="px-4 py-4 font-medium min-w-[140px]">Acorns Early</th>
                    <th className="px-4 py-4 font-medium min-w-[130px]">Greenlight</th>
                    <th className="px-4 py-4 font-medium min-w-[110px]">529 Plan</th>
                    <th className="px-4 py-4 font-medium min-w-[120px]">Savings Acct</th>
                  </tr>
                </thead>
                <tbody>
                  {fullComparisonRows.map((row) => (
                    <tr key={row.feature} className="border-t border-border">
                      <td className="px-4 py-4 font-medium text-foreground">{row.feature}</td>
                      <td className={`px-4 py-4 ${row.kiddoHighlight ? "text-primary font-medium" : "text-muted-foreground"}`}>
                        {row.kiddo}
                      </td>
                      <td className="px-4 py-4 text-muted-foreground">{row.earlybird}</td>
                      <td className="px-4 py-4 text-muted-foreground">{row.acornsEarly}</td>
                      <td className="px-4 py-4 text-muted-foreground">{row.greenlight}</td>
                      <td className="px-4 py-4 text-muted-foreground">{row.plan529}</td>
                      <td className="px-4 py-4 text-muted-foreground">{row.savings}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="border-t border-border bg-muted/10 px-6 py-4">
              <p className="text-xs text-muted-foreground">EarlyBird shut down in June 2025. Data reflects its last published state. Fees and features for other products are based on publicly available information as of 2025 and may change.</p>
            </div>
          </FadeIn>
        </div>
      </section>

      <section className="pb-20 md:pb-28">
        <div className="mx-auto max-w-4xl px-4">
          <FadeIn className="rounded-3xl border border-border bg-card p-8 md:p-12 text-center shadow-premium-sm">
            <div className="inline-flex items-center gap-2 rounded-full bg-primary/10 px-4 py-2 text-sm font-medium text-primary">
              <Scale className="h-4 w-4" />
              A new category
            </div>
            <h2 className="mt-6 font-heading text-3xl md:text-4xl font-bold tracking-tight text-foreground">
              Gifts that last. Not just spare change.
            </h2>
            <p className="mx-auto mt-4 max-w-2xl text-muted-foreground">
              The $50 grandma puts in a birthday card disappears in three days. The $50 she sends through Kiddo could be $134 when your child turns 18. That is not micro-investing. That is not a savings account. That is investment gifting. And no one else has built it.
            </p>
            <p className="mx-auto mt-3 max-w-2xl text-sm text-muted-foreground">
              No account needed to give. No gift card to redeem. No app to download. Just a link and a gift that grows.
            </p>
            <div className="mt-8 flex flex-col justify-center gap-4 sm:flex-row">
              <Link href="/get-started">
                <Button size="lg" data-testid="button-compare-hub-primary">
                  Start your child's fund
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              </Link>
              <Link href="/pricing">
                <Button variant="outline" size="lg" data-testid="button-compare-hub-secondary">
                  See pricing
                </Button>
              </Link>
            </div>
          </FadeIn>
        </div>
      </section>
    </>
  );
}

export default function Compare() {
  const { slug } = useParams<{ slug?: string }>();
  const page = slug ? comparisonPages[slug] : undefined;

  return (
    <div className="min-h-screen bg-background">
      <Nav />
      <main>
        {slug ? (
          page ? (
            <ComparisonDetail page={page} />
          ) : (
            <section className="pt-24 pb-24 md:pt-32 md:pb-32">
              <div className="mx-auto max-w-3xl px-4 text-center">
                <div className="inline-flex items-center gap-2 rounded-full bg-amber-500/10 px-4 py-2 text-sm font-medium text-amber-700">
                  <ShieldAlert className="h-4 w-4" />
                  Comparison not found
                </div>
                <h1 className="mt-6 font-heading text-4xl font-bold tracking-tight text-foreground">
                  We do not have that comparison page yet.
                </h1>
                <p className="mt-4 text-muted-foreground">
                  The compare hub is live, and the current pages cover the biggest alternatives parents ask
                  about right now.
                </p>
                <div className="mt-8">
                  <Link href="/compare">
                    <Button size="lg">See all comparisons</Button>
                  </Link>
                </div>
              </div>
            </section>
          )
        ) : (
          <ComparisonHub />
        )}
      </main>
      <Footer />
    </div>
  );
}
