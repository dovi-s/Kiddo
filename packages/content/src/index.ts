export const brandTruths = {
  headline: "Cash gifts disappear. Kiddo gifts last.",
  // Positioning updated 2026-05-23 (pricing-v3 session): Memory Book is
  // the soul, the fund is the body. Every UTMA platform says "invest
  // for your kid's future"; only Kiddo can credibly say "the book."
  // Lead with what's unique. See project_pre_launch_strategic_frame.md
  // repositioning beats.
  positioning: "The fund and the book your kid opens at 18.",
  parentHook: "Set up a fund in 2 minutes. Share a link. Watch it grow.",
  gifterHook: "Give $50 that's still there in 18 years.",
  subhead: "A real investment account that grows with them, with letters and photos from the people who loved them. Set up in 2 minutes. Anyone can gift.",
  speed: "60 seconds. No account needed.",
  trust: "Assets are held by our regulated brokerage custodian.",
  longTermExample: "$9,000 in gifts could become much more over time. Investing involves risk and is not guaranteed.",
} as const;

export const kiddoLoopCopy = {
  enemy: "Cash gifts disappear. Kiddo gifts last.",
  giftProvenance: (childName: string) => `Invested in ${childName}'s future with Kiddo.`,
  trustCustodian: "Your child's fund is held by our regulated brokerage custodian.",
  sipcPlainLanguage: "SIPC protects against brokerage failure, not market losses.",
  irrevocableGift: "Once a gift reaches a child's fund, it generally belongs to the child and cannot be taken back by the giver.",
  noAccountFast: "No app. No account. Usually under a minute.",
} as const;

export const websiteCopy = {
  hero: {
    headline: brandTruths.positioning,
    subhead: brandTruths.subhead,
    cta: "Start your child's fund",
    secondaryCta: "See how it works",
  },
} as const;

export const appCopy = {
  onboarding: {
    eyebrow: "Kiddo",
    title: "Start a fund your family can keep showing up for.",
    description:
      "One fund. One shareable link. Gifts turn into real stocks and keep growing over time.",
  },
  dashboard: {
    greeting: (firstName: string) => `Hello, ${firstName}`,
    summary: (childName?: string | null) =>
      childName ? `${childName}'s fund is growing.` : "Your funds are growing.",
    emptyState: {
      title: "No funds yet",
      body: "Start a fund, share the link, and the first gift could arrive today.",
      cta: "Start a fund",
    },
    quickActions: {
      share: "Share gift link",
      addFund: "Add fund",
    },
  },
} as const;

export const gifterCopy = {
  landing: {
    eyebrow: "Gift in under 60 seconds",
    title: (childName: string) => `${childName}'s future is growing. Add to it.`,
    body: (childName: string) =>
      `Choose an amount, add a card-like note, and send an investment gift that can keep growing for ${childName}.`,
    cta: "Gift $50",
  },
  preview: {
    title: (amount: string, company: string, childName: string) =>
      `Your ${amount} buys about ${company} for ${childName}.`,
    note: "No account needed. Secure checkout opens next.",
    cta: "Continue to secure checkout",
  },
  handoff: {
    title: "Secure checkout is open.",
    body: "Finish the payment there with Apple Pay or card. Then come back here if you want to start a fund of your own.",
    cta: "Start my child's fund",
  },
} as const;
