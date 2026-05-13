// Gift-curated lessons — optional tag the gifter attaches at checkout.
//
// Why this exists: every "I'm gifting stock to my niece" Reddit thread
// shows people inventing the same DIY pattern — Year 1: a stock with
// "what is a stock" written on it; Year 2: a dividend stock with "what
// is a dividend"; Year 3: stuck on what to teach next. They're hand-
// curating a financial literacy curriculum because no platform offered
// the structure.
//
// Kiddo's gifter-curated lessons turn that DIY pattern into a system:
// the gifter optionally tags their gift with a lesson; the kid at 18
// sees not just the dollar amounts but the curriculum the people who
// loved them taught them, one gift at a time.
//
// CONSTRAINTS:
// - The gifter ALWAYS controls whether to attach a lesson — never
//   inferred, never auto-tagged. Manipulation-free per
//   feedback_no_ai_slop.md (no fake teaching, no fake "Aunt Sarah
//   taught you about diversification" when she didn't).
// - The catalog is small + curated. Adding a lesson here means
//   committing to a kid-side explainer that holds up at age 18.
// - Server validates the tag against this catalog (defense against
//   client-supplied junk values landing in DB).

export type GiftLessonId =
  | "first_investment"
  | "what_is_a_stock"
  | "what_is_a_dividend"
  | "what_is_compounding"
  | "what_is_diversification"
  | "what_is_an_etf"
  | "patience_and_time"
  | "owning_what_you_love";

export type GiftLesson = {
  id: GiftLessonId;
  // Gifter-facing label — what shows in the checkout picker
  gifterLabel: string;
  // Gifter-facing one-line description — small subtitle under the label
  gifterDescription: string;
  // Kid-facing label — what the kid sees in Memory Book / KidView
  kidLabel: string;
  // Kid-facing explainer — 1-2 sentences, age-appropriate. Read at any
  // age (we don't gate on age; the wording is simple enough for a 9yo
  // and resonant enough for an 18yo)
  kidExplainer: string;
  emoji: string;
  // "concept" = financial literacy concept (stock, dividend, ETF, etc.)
  // "wisdom" = principle (patience, owning what you love)
  // "milestone" = rare special tag (first_investment)
  category: "concept" | "wisdom" | "milestone";
};

export const GIFT_LESSONS: Record<GiftLessonId, GiftLesson> = {
  first_investment: {
    id: "first_investment",
    gifterLabel: "First investment",
    gifterDescription: "Mark this as their very first.",
    kidLabel: "Your first investment",
    kidExplainer:
      "This was your first piece of ownership in anything. Everything that came after stacked on top of it.",
    emoji: "🌱",
    category: "milestone",
  },
  what_is_a_stock: {
    id: "what_is_a_stock",
    gifterLabel: "What is a stock?",
    gifterDescription: "The foundational lesson. Owning a tiny piece of a company.",
    kidLabel: "What a stock is",
    kidExplainer:
      "A stock is a tiny piece of a real company. When the company does well, your piece is worth more. When it doesn't, your piece is worth less. You own real things.",
    emoji: "🏢",
    category: "concept",
  },
  what_is_a_dividend: {
    id: "what_is_a_dividend",
    gifterLabel: "What is a dividend?",
    gifterDescription: "Money the company pays you for owning your piece.",
    kidLabel: "What a dividend is",
    kidExplainer:
      "Some companies share their profits with their owners by paying them a small amount each quarter. That payment is called a dividend. You owned a piece, so they paid you for it.",
    emoji: "💰",
    category: "concept",
  },
  what_is_compounding: {
    id: "what_is_compounding",
    gifterLabel: "What is compounding?",
    gifterDescription: "Why time matters more than amount.",
    kidLabel: "What compounding is",
    kidExplainer:
      "When your investments grow, the new amount also grows. Then THAT grows. Over many years, this snowballs in a way that surprises everyone the first time they see it. Time is what makes it powerful, not the amount you start with.",
    emoji: "📈",
    category: "concept",
  },
  what_is_diversification: {
    id: "what_is_diversification",
    gifterLabel: "What is diversification?",
    gifterDescription: "Why you don't put all your eggs in one basket.",
    kidLabel: "What diversification is",
    kidExplainer:
      "Owning many different companies spreads out your risk. If one has a bad year, the others might have a great one. The mix is the safety net.",
    emoji: "🧺",
    category: "concept",
  },
  what_is_an_etf: {
    id: "what_is_an_etf",
    gifterLabel: "What is an ETF?",
    gifterDescription: "A basket of many companies in a single pick.",
    kidLabel: "What an ETF is",
    kidExplainer:
      "Instead of picking one company, you own a small piece of hundreds at once. That's an ETF — one purchase, lots of ownership, automatic diversification.",
    emoji: "🧩",
    category: "concept",
  },
  patience_and_time: {
    id: "patience_and_time",
    gifterLabel: "Patience and time",
    gifterDescription: "The slow, boring magic of holding for years.",
    kidLabel: "Why patience matters",
    kidExplainer:
      "The market goes up and down all the time. The people who make money aren't the ones who guess right — they're the ones who hold for many years and let the company actually grow. Boring is the strategy.",
    emoji: "⏳",
    category: "wisdom",
  },
  owning_what_you_love: {
    id: "owning_what_you_love",
    gifterLabel: "Owning what you love",
    gifterDescription: "Picking a company because it means something to you.",
    kidLabel: "Owning what you love",
    kidExplainer:
      "When you own a piece of a company you actually use — Disney, Apple, Nike, whatever it is — investing stops feeling abstract. You can see your investment in the world. That's a different relationship to money.",
    emoji: "💚",
    category: "wisdom",
  },
};

// Ordered for display in the gifter picker. Milestone first (rare,
// special), then concepts (the financial literacy curriculum),
// then wisdom (principles).
export const GIFT_LESSON_ORDER: GiftLessonId[] = [
  "first_investment",
  "what_is_a_stock",
  "what_is_a_dividend",
  "what_is_an_etf",
  "what_is_compounding",
  "what_is_diversification",
  "patience_and_time",
  "owning_what_you_love",
];

// Validates a server-supplied lesson tag against the canonical catalog.
// Returns the normalized id when valid, null when invalid/missing.
// Use this at every server boundary before writing to the gift row —
// never trust the client-supplied string to match the catalog directly.
export function normalizeGiftLessonId(value: unknown): GiftLessonId | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim().toLowerCase();
  if (!trimmed) return null;
  return (GIFT_LESSONS as Record<string, GiftLesson>)[trimmed]?.id ?? null;
}

export function getGiftLesson(id: string | null | undefined): GiftLesson | null {
  if (!id) return null;
  return GIFT_LESSONS[id as GiftLessonId] ?? null;
}
