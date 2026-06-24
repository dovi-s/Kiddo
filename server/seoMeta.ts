import { US_STATES, getMajorityAgeForState } from "@shared/utma";

// Per-route SEO metadata for the PUBLIC marketing + satellite pages, used by
// static.ts to inject a correct <title>/description/canonical/OG into the
// initial HTML before JS runs. Why: production serves one identical index.html
// head for every route (server/static.ts), and usePageSeo only fixes it
// client-side AFTER hydration — so non-JS crawlers (social cards, LLM crawlers,
// Google's first indexing wave) see a generic "Kiddo" shell on every page.
// This is head-level SSR (the high-value, low-risk subset of prerendering);
// full body-snapshot prerendering is the documented next step (SEO_GTM_STRATEGY.md).
//
// This table is the authority for these routes' INITIAL head. Where a page also
// sets a title client-side (Compare, GiveAGift, UtmaByState), the values here
// match it so the pre- and post-hydration heads agree.

export interface PageSeo {
  title: string;
  description: string;
  ogType: "website" | "article";
}

// Static public routes. Private/app/orphan routes are intentionally absent
// (they fall through to the unchanged generic shell + are blocked in robots.txt).
const STATIC: Record<string, PageSeo> = {
  "/": {
    title: "Kiddo | Cash Gifts Disappear. Kiddo Gifts Last.",
    description: "Cash gifts disappear. Kiddo gifts last. Create a child's fund, share one link, and let family gift in under a minute.",
    ogType: "website",
  },
  "/get-started": {
    title: "Start a child's fund | Kiddo",
    description: "Create a child's investment fund in under a minute, then share one link so family can gift.",
    ogType: "website",
  },
  "/how-it-works": {
    title: "How Kiddo works | Kiddo",
    description: "Create a fund, share one link, and let family send investment gifts that grow until your child reaches adulthood.",
    ogType: "article",
  },
  "/give-a-gift": {
    title: "Give a gift that lasts | Kiddo",
    description: "Start a Kiddo gift for a child whose parents haven't set up a fund yet. We'll let the parents know.",
    ogType: "website",
  },
  "/pricing": {
    title: "Pricing | Kiddo",
    description: "Simple plans for families, and gifters never pay. See Kiddo's pricing and what's included.",
    ogType: "website",
  },
  "/founding-members": {
    title: "Founding Members | Kiddo",
    description: "Lock a lifetime price and help shape Kiddo. A limited number of founding-member spots.",
    ogType: "website",
  },
  "/personal-funds": {
    title: "Personal investing funds | Kiddo",
    description: "Open a personal Kiddo fund and invest in the companies you love.",
    ogType: "article",
  },
  "/age-18": {
    title: "What happens at 18 | Kiddo",
    description: "How a Kiddo custodial fund hands off to your child when they reach the age of majority.",
    ogType: "article",
  },
  "/compare": {
    title: "Investment gifting vs the alternatives | Kiddo",
    description: "Honest comparisons: Kiddo vs EarlyBird, Acorns Early, Greenlight, Stockpile, a 529, a savings account, and a Fidelity UTMA.",
    ogType: "article",
  },
  "/tools/at-18-calculator": {
    title: "At-18 value calculator | Kiddo",
    description: "See what regular gifts to a child's fund could be worth by the time they turn 18.",
    ogType: "article",
  },
  "/tools/robux-vs-utma": {
    title: "Robux vs a UTMA: what $50 really becomes | Kiddo",
    description: "Spend $50 on Robux, or invest it in a UTMA custodial account? See the long-term difference for your kid.",
    ogType: "article",
  },
  "/tools/trump-account-vs-utma": {
    title: "Trump Account vs UTMA | Kiddo",
    description: "How a UTMA custodial account compares to a Trump account for investing in your child's future.",
    ogType: "article",
  },
  "/tools/utma-by-state": {
    title: "UTMA age of majority by state | Kiddo",
    description: "When does a custodial UTMA account transfer to the child? See the age of majority in every U.S. state.",
    ogType: "article",
  },
  "/blog": {
    title: "Kiddo blog | Kiddo",
    description: "Guides on custodial accounts, investment gifting, and building your child's future.",
    ogType: "website",
  },
  "/stories": {
    title: "Family stories | Kiddo",
    description: "How families use Kiddo to give gifts that last.",
    ogType: "website",
  },
  "/faq": {
    title: "FAQ | Kiddo",
    description: "Answers about Kiddo gift funds, UTMA custodial accounts, fees, and how the at-18 handoff works.",
    ogType: "article",
  },
  "/security": {
    title: "Security | Kiddo",
    description: "How Kiddo protects your family's money and data.",
    ogType: "article",
  },
  "/about": {
    title: "About Kiddo | Kiddo",
    description: "Why we built Kiddo: gifts that last, for the kids you love.",
    ogType: "website",
  },
  "/contact": {
    title: "Contact | Kiddo",
    description: "Get in touch with the Kiddo team.",
    ogType: "website",
  },
  "/legal": {
    title: "Legal | Kiddo",
    description: "Kiddo terms, privacy, and disclosures.",
    ogType: "website",
  },
};

// Comparison pages — titles + descriptions mirror COMPARISONS in
// client/src/pages/Compare.tsx so the pre/post-hydration heads agree.
const COMPARE: Record<string, PageSeo> = {
  "earlybird": {
    title: "EarlyBird Alternative | Kiddo is the natural next step",
    description: "EarlyBird was acquired by Acorns and the standalone product retired. Kiddo is the natural replacement: same shareable gifting link, no account needed for gifters, full Memory Book media, and no monthly fee to start.",
    ogType: "article",
  },
  "acorns-early": {
    title: "Acorns Early vs Kiddo | Micro-investing vs investment gifting",
    description: "Acorns made round-ups famous, but spare change won't change your child's life. Kiddo does something different: investment gifting. Here's the honest comparison.",
    ogType: "article",
  },
  "greenlight": {
    title: "Greenlight vs Kiddo | Spending app vs gifting platform",
    description: "Greenlight is a debit card and spending app for kids. Kiddo is a gifting and investing platform. They solve different problems.",
    ogType: "article",
  },
  "stockpile": {
    title: "Stockpile vs Kiddo | Gift cards vs a shareable gifting link",
    description: "Stockpile uses gift cards. Kiddo uses a shareable link. Here is why that difference matters for your family.",
    ogType: "article",
  },
  "529": {
    title: "529 vs UTMA | Which is right for your child?",
    description: "A 529 is for education. A Kiddo UTMA is for flexibility. Here is an honest comparison to help you decide. Many families use both.",
    ogType: "article",
  },
  "savings-account": {
    title: "Savings Account vs Kiddo | Low-yield cash vs real stock investments",
    description: "A savings account earns almost nothing. A Kiddo UTMA invests in real stocks. Here is the honest comparison for long-term family gifting.",
    ogType: "article",
  },
  "fidelity-utma": {
    title: "Fidelity UTMA vs Kiddo | Brokerage account vs gifting ritual",
    description: "Fidelity is great for holding investments. Kiddo is great for the family gifting ritual a brokerage doesn't give you: shareable links, occasion pages, a Memory Book, and an at-18 handoff that's actually designed.",
    ogType: "article",
  },
};

function normalizePath(pathname: string): string {
  const noQuery = (pathname || "/").split("?")[0].split("#")[0];
  if (noQuery.length > 1 && noQuery.endsWith("/")) return noQuery.slice(0, -1);
  return noQuery || "/";
}

// Returns the SEO metadata for a public/satellite route, or null for app,
// private, dynamic-gift, or unknown routes (which keep the generic shell).
export function getSeoForPath(pathname: string): PageSeo | null {
  const p = normalizePath(pathname);

  const stat = STATIC[p];
  if (stat) return stat;

  // Programmatic: /tools/utma-by-state/:code (canonical lowercase 2-letter)
  const stateMatch = /^\/tools\/utma-by-state\/([a-z]{2})$/.exec(p);
  if (stateMatch) {
    const code = stateMatch[1].toUpperCase();
    const state = US_STATES.find((s) => s.code === code);
    if (state) {
      const age = getMajorityAgeForState(state.code);
      return {
        title: `${state.name} UTMA age of majority: ${age} | Kiddo`,
        description: `When does a UTMA custodial account transfer to the child in ${state.name}? The age of majority is ${age}. See ${state.name}'s rules and start a gift fund with Kiddo.`,
        ogType: "article",
      };
    }
  }

  // Programmatic: /compare/:slug
  const compareMatch = /^\/compare\/([a-z0-9-]+)$/.exec(p);
  if (compareMatch) {
    const entry = COMPARE[compareMatch[1]];
    if (entry) return entry;
  }

  return null;
}
