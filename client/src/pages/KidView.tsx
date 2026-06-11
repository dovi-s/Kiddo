import { useCallback, useEffect, useMemo, useState } from "react";
import { safeLocalSet } from "@/lib/local-cache";
import { useParams } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { motion } from "framer-motion";
// Sparkles dropped 2026-05-12 — banned per feedback_no_ai_slop.md. Both
// usages were on "Is there a company you love?" kid-suggestion prompts;
// replaced with Lightbulb (already imported), the canonical gentle-nudge
// icon per feedback_gentle_nudge_pattern.md.
import { BadgeCheck, BookOpen, Lightbulb, Lock, Target, TrendingUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Logo } from "@/components/ui/logo";
import { StockLogo } from "@/components/ui/stock-logo";
import { haptic } from "@/lib/haptics";
import { capFirst } from "@/lib/format-name";
import { toast } from "@/hooks/use-toast";
import { friendlyHoldingName } from "@/lib/ticker-names";
import { useCountUp } from "@/hooks/use-count-up";
import { ReportContentButton } from "@/components/ReportContentButton";
import { projectFundValue, utmaContributionYearsRemaining } from "@shared/projection";

type KidViewMeta = {
  childName: string;
  fundName: string;
  requiresPin: boolean;
  pinHint: string | null;
  age: number | null;
  phase: "child" | "teen" | "adult" | "unknown";
};

type KidViewContent = {
  fund: {
    id: string;
    name: string;
    slug?: string;
    recipientFirstName?: string;
    balance: string;
    // Cash + pending balances surface the settling window in the
    // teen-phase breakdown ("$50 of $1,917 is still settling into
    // investments"). Server returns both as decimal strings; client
    // sums them for the display line. May be undefined on legacy
    // endpoints that pre-date the 2026-05-14 audit change; treat
    // undefined as 0 (no settling line shown).
    cashBalance?: string;
    pendingBalance?: string;
    totalContributed: string;
    totalGain: string;
    projectedValue?: string;
    /** Fund's state-specific UTMA majority age (18-21). Added 2026-05-15
        so KidView's projection card can compute a contribution window
        that matches the fund's legal majority age, not a hardcoded 18. */
    majorityAge?: number;
  };
  phase: "child" | "teen" | "adult" | "unknown";
  age: number | null;
  gifts: Array<{ id: string; senderName: string; amount: string; message?: string; createdAt?: string; status?: string }>;
  /** Lifetime aggregate counts over ALL gifts, not just the capped `gifts`
      window above (which is the recent slice for display). Drives the hero
      stats so "gifts received / people gave" reflect the whole fund. Without
      this the counts came from the 12-row display window and badly undercounted
      (e.g. 134 gifts from 12 people rendering as "12 gifts / 4 people"). */
  giftStats?: { total: number; gifters: number; noNote: number };
  memories: Array<{ id: string; type?: string; authorName?: string; content?: string; photoUrl?: string | null; videoUrl?: string | null; visibility?: string }>;
  /** Count of human notes (gift messages + parent notes) across the WHOLE
      Memory Book — drives the "N notes from people who love you" line. The
      `memories` array is the full book (human notes first), paginated client-side. */
  memoryNoteCount?: number;
  holdings: Array<{ id: string; ticker: string; name: string; currentValue: string; gain: string }>;
  suggestions: Array<{ id: string; ticker: string; reason: string; reviewedStatus: string }>;
  allowTeenSuggestions: boolean;
  savingsGoals: Array<{ id: string; name: string; eventType: string; goalAmount: string; giftVolume: string; description?: string }>;
  // Count of entries with visibility='kid_at_18' that just unlocked because
  // the kid hit majority age. Populated server-side; always 0 pre-majority.
  unlockedAtMajorityCount?: number;
  // Pricing-v3 Prong B Phase 4: count of sealed-letter entries whose
  // deliver_at fired within the last 14 days. Drives the "A message
  // just unlocked for you" celebration when the kid checks in soon
  // after a scheduled sealed letter arrives. Independent of majority
  // age — sealed letters can deliver at any kid age the parent picked.
  recentlyUnlockedSealedCount?: number;
};

type KidLanguageMode = "younger" | "older";

function fmtMoney(value: string | number | null | undefined) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(Number(value || 0));
}

const COMPANY_EXPLAINERS: Record<string, { emoji: string; youngOwner: string; whatTheyDo: string; whyItMatters: string }> = {
  DIS: {
    emoji: "🏰",
    youngOwner: "You own a tiny piece of Disney. That means every park, every movie, every princess is partly yours.",
    whatTheyDo: "Disney makes movies, streaming shows, theme parks, and characters families already know.",
    whyItMatters: "When people watch Disney movies, visit the parks, or subscribe to Disney+, Disney makes money.",
  },
  AAPL: {
    emoji: "🍎",
    youngOwner: "You own a tiny piece of Apple. Every iPhone, every iPad, every app in the App Store.",
    whatTheyDo: "Apple makes iPhones, iPads, Macs, AirPods, and runs the App Store.",
    whyItMatters: "When people buy Apple devices or apps, Apple makes money and the business can grow.",
  },
  NKE: {
    emoji: "👟",
    youngOwner: "You own a tiny piece of Nike. Every pair of sneakers, every jersey, every swoosh.",
    whatTheyDo: "Nike makes shoes, sports clothing, and gear sold around the world.",
    whyItMatters: "When more people buy Nike products, the company grows and investors pay attention.",
  },
  TSLA: {
    emoji: "🚗",
    youngOwner: "You own a tiny piece of Tesla. Every quiet electric car driving past you on the street.",
    whatTheyDo: "Tesla makes electric cars, batteries, and energy products.",
    whyItMatters: "When investors believe more people will switch to electric cars, Tesla often gets more attention.",
  },
  AMZN: {
    emoji: "📦",
    youngOwner: "You own a tiny piece of Amazon. Every package delivered, every box on every doorstep.",
    whatTheyDo: "Amazon runs online shopping, delivery, and cloud computing services.",
    whyItMatters: "Millions of purchases and internet services flow through Amazon every day.",
  },
  RBLX: {
    emoji: "🎮",
    youngOwner: "You own a tiny piece of Roblox. That means a tiny piece of the place where all those games get played.",
    whatTheyDo: "Roblox is a platform where millions of kids play and build games every day.",
    whyItMatters: "When more people play on Roblox, the company earns more and can grow.",
  },
  GOOGL: {
    emoji: "🔍",
    youngOwner: "You own a tiny piece of Google. Every search, every YouTube video, every map.",
    whatTheyDo: "Google runs the world's most used search engine, YouTube, and many other services.",
    whyItMatters: "Billions of people use Google products every day, which brings in a lot of money from ads.",
  },
  NFLX: {
    emoji: "🎬",
    youngOwner: "You own a tiny piece of Netflix. Every show, every movie, every time someone hits play.",
    whatTheyDo: "Netflix makes and streams TV shows and movies to hundreds of millions of subscribers.",
    whyItMatters: "When more people subscribe or watch more, Netflix earns more.",
  },
  SBUX: {
    emoji: "☕",
    youngOwner: "You own a tiny piece of Starbucks. Every cup of coffee, every drink, in every store worldwide.",
    whatTheyDo: "Starbucks serves coffee, drinks, and food at thousands of stores around the world.",
    whyItMatters: "People buy Starbucks every day, which keeps the business strong and growing.",
  },
  SPOT: {
    emoji: "🎵",
    youngOwner: "You own a tiny piece of Spotify. Every song, every playlist, every time the music starts.",
    whatTheyDo: "Spotify streams music to hundreds of millions of people around the world.",
    whyItMatters: "When more people subscribe, Spotify earns more and can keep making music available.",
  },
  // ETF + diversified-fund explainers — rewritten 2026-05-13 to match
  // the kid-recognition pattern of the single-stock explainers (DIS,
  // AAPL, NKE, etc.). The previous versions used abstract finance
  // language ("hundreds of American companies") while every single-
  // stock entry painted a concrete scene ("every iPhone", "every red
  // shopping cart"). For a kid whose fund is 50%% VTI and 10%% AAPL,
  // the bigger holding shouldn't read more abstractly than the
  // smaller one. Pattern: name the brands they SEE in the world that
  // are inside the fund. Evergreen — no numbers, no rankings that age.
  VTI: {
    emoji: "📈",
    youngOwner: "You own a tiny piece of nearly every big US company at once. The store you shop at, the streaming service you watch, the airline your family flies. Pieces of all of them are yours.",
    whatTheyDo: "VTI is an ETF that owns many different US companies all at once.",
    whyItMatters: "Instead of betting on one company, it spreads money across a large part of the stock market.",
  },
  VXUS: {
    emoji: "🌍",
    youngOwner: "You own a tiny piece of companies all over the world. The car from Japan, the chocolate from Switzerland, the soccer team's sponsor in Europe. Pieces of all of them are yours.",
    whatTheyDo: "VXUS is an ETF that owns companies outside the United States.",
    whyItMatters: "It helps spread your money across the world instead of one country.",
  },
  BND: {
    emoji: "🏦",
    youngOwner: "You own tiny IOUs from companies and the US government. They borrow money from you, and they pay you back a little extra over time.",
    whatTheyDo: "BND is a bond fund, which means it holds many loans instead of company stock.",
    whyItMatters: "Bonds usually move more gently than stocks, which can help smooth the ride.",
  },
  VGT: {
    emoji: "💻",
    youngOwner: "You own a tiny piece of nearly every tech company. Every iPhone, every Windows computer, every Nvidia chip inside a Tesla or an AI server. Pieces of all of them are yours.",
    whatTheyDo: "VGT is an ETF focused on US technology companies: software, hardware, and chips.",
    whyItMatters: "Tech moves fast. When the sector grows, this fund can rise. When it cools, it can fall.",
  },
  VUG: {
    emoji: "🌿",
    youngOwner: "You own a tiny piece of the US companies growing fastest right now. The ones building new things people end up using every day.",
    whatTheyDo: "VUG is an ETF that holds large US companies expected to keep growing.",
    whyItMatters: "Growth funds tend to swing more than the whole market. Bigger ups and bigger downs.",
  },
  VYM: {
    emoji: "💰",
    youngOwner: "You own a tiny piece of steady US companies that share their profits with you. Every few months, a little cash gets paid to your fund just for owning them.",
    whatTheyDo: "VYM is an ETF that holds companies that pay dividends, which are small cash payments to owners.",
    whyItMatters: "Dividend companies tend to be steadier. Slower growth, more income.",
  },
  SCHD: {
    emoji: "📊",
    youngOwner: "You own a tiny piece of US companies that have been paying their owners more and more every year for a long time. The reliable kind.",
    whatTheyDo: "SCHD is an ETF focused on companies with reliable, growing dividends.",
    whyItMatters: "Companies that keep raising what they pay tend to be the steady ones.",
  },
  QQQ: {
    emoji: "🚀",
    youngOwner: "You own a tiny piece of the biggest tech and consumer companies on Nasdaq. Every Netflix show, every Amazon order, every Google search, every Microsoft Word document. Pieces of all of them are yours.",
    whatTheyDo: "QQQ is an ETF tracking the Nasdaq 100, heavy on tech and innovation.",
    whyItMatters: "When tech soars, this rises fast. When tech corrects, it falls fast too.",
  },
  TGT: {
    emoji: "🎯",
    youngOwner: "You own a tiny piece of Target. Every red shopping cart, every store run.",
    whatTheyDo: "Target is one of the largest US retail chains: groceries, clothes, home goods, and more.",
    whyItMatters: "When more people shop at Target stores or online, Target earns more.",
  },
  MCD: {
    emoji: "🍟",
    youngOwner: "You own a tiny piece of McDonald's. Every Happy Meal, every order of fries, in almost every country.",
    whatTheyDo: "McDonald's runs one of the biggest fast-food chains in the world, with restaurants nearly everywhere.",
    whyItMatters: "When more people eat at McDonald's around the world, the company earns more.",
  },
  CMCSA: {
    emoji: "📺",
    youngOwner: "You own a tiny piece of Comcast. Every Xfinity internet bill, every NBC show, every Universal Studios ride. Pieces of all of it are yours.",
    whatTheyDo: "Comcast runs cable TV, internet, NBC broadcasting, and the Universal theme parks.",
    whyItMatters: "Anytime someone subscribes to Xfinity or watches NBC, Comcast earns.",
  },
  DUOL: {
    emoji: "🦉",
    youngOwner: "You own a tiny piece of Duolingo, the green owl that helps people learn languages.",
    whatTheyDo: "Duolingo makes the world's most popular language-learning app.",
    whyItMatters: "When more people learn languages on Duolingo (or pay for the premium tier), it grows.",
  },
  ABNB: {
    emoji: "🏠",
    youngOwner: "You own a tiny piece of Airbnb. Every vacation rental, every stay around the world.",
    whatTheyDo: "Airbnb runs the platform that lets people rent out homes to travelers.",
    whyItMatters: "When more people travel and book through Airbnb, the company earns a fee.",
  },
  NTDOY: {
    emoji: "🎮",
    youngOwner: "You own a tiny piece of Nintendo: Mario, Zelda, the Switch, the whole world.",
    whatTheyDo: "Nintendo makes video games, gaming consoles, and characters that have lasted decades.",
    whyItMatters: "When Nintendo releases new games or hardware, the company can grow.",
  },
  DPZ: {
    emoji: "🍕",
    youngOwner: "You own a tiny piece of Domino's. Every pizza ordered, every delivery.",
    whatTheyDo: "Domino's runs one of the largest pizza chains in the world, with thousands of stores.",
    whyItMatters: "When more people order delivery or carryout, Domino's grows.",
  },
  CHWY: {
    emoji: "🐶",
    youngOwner: "You own a tiny piece of Chewy. Every bag of dog food, every cat toy delivered.",
    whatTheyDo: "Chewy is the biggest online pet store in the US: food, toys, and supplies.",
    whyItMatters: "Pet owners shop on Chewy regularly, which gives the business steady demand.",
  },
  ADBE: {
    emoji: "🎨",
    youngOwner: "You own a tiny piece of Adobe. Every Photoshop edit, every video cut in Premiere, every PDF opened. Pieces of the company that built them are yours.",
    whatTheyDo: "Adobe makes creative software like Photoshop, Premiere, and PDF tools used worldwide.",
    whyItMatters: "Designers, photographers, and businesses pay Adobe monthly to use its tools.",
  },
  Z: {
    emoji: "🏠",
    youngOwner: "You own a tiny piece of Zillow. Every house people scroll through dreaming, every Zestimate, every for-sale sign that ends up in Zillow's app. Pieces of it are yours.",
    whatTheyDo: "Zillow runs the most-visited home and real estate platform in the US.",
    whyItMatters: "When more people search for homes through Zillow, the company can earn from agents and ads.",
  },
  // Roster 2026-06-09 stock-pick additions + Microsoft (offered since 2026-06-01
  // but it never had a kid explainer, so it fell back to the generic glyph).
  MSFT: {
    emoji: "🧱",
    youngOwner: "You own a tiny piece of Microsoft. Every Minecraft world, every Xbox game, every computer running Windows. Pieces of all of them are yours.",
    whatTheyDo: "Microsoft makes Windows computers, Xbox, Minecraft, and software that businesses use every day.",
    whyItMatters: "When people buy Xbox games, play Minecraft, or pay for Microsoft software, the company earns more.",
  },
  MAT: {
    emoji: "🧸",
    youngOwner: "You own a tiny piece of Mattel. Every Barbie, every Hot Wheels car, every UNO game. Pieces of all of them are yours.",
    whatTheyDo: "Mattel makes some of the most famous toys in the world: Barbie, Hot Wheels, Fisher-Price, and UNO.",
    whyItMatters: "When families buy these toys, and watch the Barbie movies, Mattel earns more.",
  },
  HAS: {
    emoji: "🎲",
    youngOwner: "You own a tiny piece of Hasbro. Every Nerf blaster, every Monopoly board, every can of Play-Doh, every Transformer. Pieces of all of them are yours.",
    whatTheyDo: "Hasbro makes Nerf, Monopoly, Play-Doh, Transformers, and many other toys and games.",
    whyItMatters: "When people buy these toys and games, Hasbro earns more.",
  },
  NVDA: {
    emoji: "🤖",
    youngOwner: "You own a tiny piece of Nvidia. The chips inside the computers that run video games, and the AI everyone is talking about, are made by them. A piece of that is yours.",
    whatTheyDo: "Nvidia makes the powerful computer chips that run video games and artificial intelligence.",
    whyItMatters: "As more of the world uses AI and big computers, more companies buy Nvidia's chips.",
  },
  KO: {
    emoji: "🥤",
    youngOwner: "You own a tiny piece of Coca-Cola. Every bottle of Coke, every Sprite, every Fanta, sold almost everywhere on Earth. A piece of that is yours.",
    whatTheyDo: "Coca-Cola makes Coke, Sprite, Fanta, and hundreds of other drinks sold in nearly every country.",
    whyItMatters: "People buy these drinks every single day all over the world, which keeps the business steady.",
  },
  HSY: {
    emoji: "🍫",
    youngOwner: "You own a tiny piece of Hershey. Every chocolate bar, every Kiss, every Reese's cup. Pieces of all of them are yours.",
    whatTheyDo: "Hershey makes chocolate and candy: Hershey bars, Kisses, Reese's, and more.",
    whyItMatters: "When people buy candy, especially around the holidays, Hershey earns more.",
  },
  CROX: {
    emoji: "🐊",
    youngOwner: "You own a tiny piece of Crocs. Every comfy clog, and every pair decorated with little Jibbitz charms. A piece of that is yours.",
    whatTheyDo: "Crocs makes the comfy foam clogs, and the little charms that snap into them, that people wear everywhere.",
    whyItMatters: "When more people buy Crocs and their charms, the company grows.",
  },
};

function getCompanyExplainer(ticker: string, name: string) {
  return (
    COMPANY_EXPLAINERS[ticker] || {
      // Neutral company glyph, not the ✨ sparkle (swept as an AI-tell
      // everywhere else). Demo funds shouldn't hit this — every seeded
      // holding now has a real entry above — but a real fund could pick any
      // ticker, so the fallback stays honest and calm. 2026-06-04.
      emoji: "🏢",
      youngOwner: `You own a tiny piece of ${name}.`,
      whatTheyDo: `${name} is one of the companies or funds in your account.`,
      whyItMatters: "When the business grows or investors get more confident, the value can rise. When confidence drops, it can fall too.",
    }
  );
}

/**
 * Project the kid's fund value forward. Thin local wrapper around the
 * shared projectFundValue helper so the rest of this file's call shape
 * stays "balance, annual gifts, years."
 *
 * Updated 2026-05-15 (canonical-projection audit). The previous local
 * implementation used a raw 7% annual loop without netting the 0.10%
 * AUM fee or compounding monthly — so the kid saw a slightly inflated
 * number that didn't match what the parent's Projection page showed
 * for the same fund. Now both surfaces route through the same math:
 * 7% annual compounded monthly, fee netted, two-phase contribution
 * window respecting the fund's state-specific majority age.
 *
 * `contributionYears` caps the annual-gift contribution window. The
 * kid view caller passes utmaContributionYearsRemaining(currentAge,
 * majorityAge) for it so the gift annuity stops accruing at the fund's
 * actual majority age (18-21 by state), then pure compound runs the
 * rest of the projected horizon.
 */
function projectFutureValue(
  currentBalance: number,
  annualGifts: number,
  years: number,
  contributionYears: number,
): number {
  return projectFundValue({
    startingValue: currentBalance,
    monthlyContribution: annualGifts / 12,
    yearsAhead: years,
    contributionYears,
  });
}

export default function KidView() {
  const { fundId: token } = useParams<{ fundId: string }>();
  const [pin, setPin] = useState("");
  const [accessToken, setAccessToken] = useState<string | null>(() => {
    if (!token || typeof window === "undefined") return null;
    return window.sessionStorage.getItem(`kid-view-access:${token}`);
  });
  const [suggestionTicker, setSuggestionTicker] = useState("");
  const [suggestionReason, setSuggestionReason] = useState("");
  const [savingSuggestion, setSavingSuggestion] = useState(false);
  const [annualGiftEstimate, setAnnualGiftEstimate] = useState(500);
  const [languageMode, setLanguageMode] = useState<KidLanguageMode>("younger");

  const { data: meta, isLoading: metaLoading, isError: metaError } = useQuery<KidViewMeta>({
    queryKey: ["kid-view-meta", token],
    queryFn: async () => {
      const res = await fetch(`/api/kid-view/${token}/meta`);
      if (!res.ok) throw new Error("Could not load this kid view");
      return res.json();
    },
    enabled: !!token,
  });

  const { data: content, isLoading: contentLoading, refetch } = useQuery<KidViewContent>({
    queryKey: ["kid-view-content", token, accessToken],
    queryFn: async () => {
      const res = await fetch(`/api/kid-view/${token}/content?accessToken=${encodeURIComponent(accessToken || "")}`);
      if (!res.ok) throw new Error("Unlock required");
      return res.json();
    },
    enabled: !!token && !!accessToken,
    retry: false,
  });

  const growthSummary = useMemo(() => {
    const balance = Number(content?.fund?.balance || 0);
    const contributed = Number(content?.fund?.totalContributed || 0);
    const gain = balance - contributed;
    const pct = contributed > 0 ? (gain / contributed) * 100 : 0;
    return { gain, pct, contributed };
  }, [content]);

  const futureProjection = useMemo(() => {
    const balance = Number(content?.fund?.balance || 0);
    const age = Number(content?.age || 0);
    // State-specific majority age from the fund (added to the kid-view
    // content endpoint 2026-05-15). Falls back to 18 if the server's
    // response somehow lacks it — same default the underlying schema
    // uses. The yearsTo* horizons compute against this so a CA / MS /
    // etc. UTMA fund (majority 21) correctly shows a 3-extra-year
    // contribution window vs the default-18 fund.
    const majorityAge = Number(content?.fund?.majorityAge) || 18;
    // PRECISE (fractional) years to majority, not integer age. `majorityAge - age`
    // rounded a kid who is 20-and-11-months up to a FULL year, projecting a whole
    // year of growth + gifts when majority is one month away — Alex's "By age 21"
    // read ~$3k high ($42,077 vs the true ~$39k at 1 month out). The content
    // endpoint already provides precise months-to-majority (`monthsUntil18`, named
    // for the legacy 18 but majority-age-aware); use it, fall back to integer only
    // if absent. Fixed 2026-06-10.
    const monthsToMajority = (content as any)?.monthsUntil18;
    const yearsToMajority = (typeof monthsToMajority === "number" && monthsToMajority >= 0)
      ? monthsToMajority / 12
      : Math.max(majorityAge - age, 0);
    const yearsTo25 = Math.max(yearsToMajority + (25 - majorityAge), 0);
    const contributionYears = utmaContributionYearsRemaining(age, majorityAge);
    return {
      majorityAge,
      toMajority: projectFutureValue(balance, annualGiftEstimate, yearsToMajority, contributionYears),
      to25: projectFutureValue(balance, annualGiftEstimate, yearsTo25, contributionYears),
    };
  }, [annualGiftEstimate, content?.age, content?.fund?.balance, content?.fund?.majorityAge, (content as any)?.monthsUntil18]);

  // Test-data hygiene: surgical client-side filter so gifts and memories
  // containing obvious test markers ("test", "tstgin", "asdf", "qqqqq",
  // lorem-ipsum patterns, sender name "test") never reach Emma's view.
  // The durable fix is a server-side is_test_user flag + write gate; this
  // is the immediate band-aid so a developer's keystroke from 2026 doesn't
  // appear in Emma's Memory Book on her 18th birthday. Filters are
  // intentionally narrow: word-boundary matches on tiny strings only, so
  // a real note like "I'm testing the waters with this gift" stays visible.
  // Goal is to catch obvious junk, not police real human language.
  const isLikelyTestData = useCallback((s: string | null | undefined): boolean => {
    if (!s) return false;
    const trimmed = String(s).trim().toLowerCase();
    if (!trimmed) return false;
    // Whole-string exact junk patterns
    const exactJunk = new Set([
      "test", "tests", "testing", "test test", "asdf", "asdfasdf",
      "qwerty", "qwertyuiop", "qqqqq", "aaaaa", "zzzzz",
      "tstgin", "tsting", "tsing", "asdfg", "abc", "abcd", "xxx",
      "lorem", "lorem ipsum", "ipsum",
      "x", "y", "z", "...", ".",
    ]);
    if (exactJunk.has(trimmed)) return true;
    // Bare keyboard-mash (4+ chars of one repeated character)
    if (/^(.)\1{3,}$/.test(trimmed)) return true;
    // Strings that start with "test " or "test:" (parent's test annotations)
    if (/^test[\s:_-]/.test(trimmed)) return true;
    return false;
  }, []);

  // Apply the filter. We never mutate content directly; we derive cleaned
  // arrays for the gifts and memories sections. Counts elsewhere (uniqueGifters,
  // hero stats) reflect the filtered view too — Emma shouldn't see "10 people
  // gave" if 2 of them were test entries.
  const cleanedGifts = useMemo(() => {
    if (!content?.gifts) return [];
    return content.gifts.filter((g) =>
      !isLikelyTestData(g.senderName) && !isLikelyTestData(g.message)
    );
  }, [content?.gifts, isLikelyTestData]);

  const cleanedMemories = useMemo(() => {
    if (!content?.memories) return [];
    return content.memories.filter((m: any) =>
      !isLikelyTestData(m.content) && !isLikelyTestData(m.authorName)
    );
  }, [content?.memories, isLikelyTestData]);

  // The Memory Book is the kid's whole book now (server sends it all, human notes
  // first). Show a generous default so it reads abundant at a glance, with a
  // "see all" to open the rest — nothing is locked away from the kid.
  const MEMORY_PREVIEW = 12;
  const [showAllMemories, setShowAllMemories] = useState(false);
  const visibleMemories = showAllMemories ? cleanedMemories : cleanedMemories.slice(0, MEMORY_PREVIEW);

  useEffect(() => {
    if (!content) return;
    if (content.phase === "teen") {
      setLanguageMode("older");
      return;
    }
    setLanguageMode((content.age || 0) >= 9 ? "older" : "younger");
  }, [content]);

  const shareUrl = useMemo(() => {
    if (!content?.fund?.slug || typeof window === "undefined") return "";
    return `${window.location.origin}/${content.fund.slug}`;
  }, [content?.fund?.slug]);

  const childName = capFirst(meta?.childName) || capFirst(content?.fund?.recipientFirstName) || "Your child";
  const isYoungerMode = languageMode === "younger";
  const headerLabel = childName
    ? `${childName}'s View`
    : content?.phase === "teen" ? "Teen View" : isYoungerMode ? "Kid View" : "Big Kid View";

  // Personalize the browser tab title once we know the child's name. The
  // route's static SEO entry in App.tsx defaults to "Kid View | Kiddo"
  // because route metadata is set at navigation time before any data loads.
  // Now that we have the name, swap to "Emma's View | Kiddo" so the open tab
  // tells the parent / kid which fund this is — useful when several Kid
  // View tabs are open across siblings.
  useEffect(() => {
    if (typeof document === "undefined") return;
    const realName = capFirst(meta?.childName) || capFirst(content?.fund?.recipientFirstName);
    if (!realName) return;
    const possessive = `${realName}${realName.endsWith("s") ? "'" : "'s"}`;
    document.title = `${possessive} View | Kiddo`;
  }, [meta?.childName, content?.fund?.recipientFirstName]);
  const introCopy = content?.phase === "teen"
    ? "This is your fund. What you own, who helped build it, and what it could grow into."
    : content?.fund && Number(content.fund.balance) > 0
      ? `Your fund is worth ${fmtMoney(content.fund.balance)} right now. That is real money in real companies.`
      : "Your family started this for you. Every gift that comes in goes here and starts growing.";
  const growthCopy = growthSummary.gain > 0
    ? isYoungerMode
      ? `Your fund has grown by ${fmtMoney(growthSummary.gain)} so far. The gifts people gave you are making more money on their own.`
      : `Your fund is up ${fmtMoney(growthSummary.gain)}. Your money is making more money on its own. That's called investing.`
    : isYoungerMode
      ? "Your story is just getting started. The first gift is what brings this to life."
      : "Markets move up and down. Long-term growth comes from giving investments plenty of time to grow.";
  const growthCardCopy = isYoungerMode
    ? "Every gift becomes part of a real account in your name. Your parent takes care of it for now while your story keeps building."
    : "Every gift becomes part of a real account in your name. Your parent stays in charge for now, and you can watch how it builds over time.";
  const projectionCopy = isYoungerMode
    ? "If gifts keep coming in each year and investments grow over time, your fund can become something much bigger later."
    : "If gifts keep coming in each year and the investments keep compounding, this fund can look very different by the time you are older.";
  const companiesHeading = content?.phase === "teen" || !isYoungerMode ? "What these companies do" : "Companies you partly own";
  const giftsHeading = isYoungerMode ? "Gifts from people who love you" : "Who helped build your fund";
  const giftsSubcopy = isYoungerMode
    ? "Every single one of them chose to give you something that grows."
    : "Every gift here is part of the story of how your fund got started.";

  const handleShareFund = async () => {
    if (!shareUrl) {
      toast({ title: "Share link not ready", description: "Try again in a moment.", variant: "destructive" });
      return;
    }
    const title = `${childName}'s fund`;
    const text = `Instead of another toy, you can add to ${childName}'s future here.`;
    try {
      if (typeof navigator !== "undefined" && "share" in navigator) {
        await navigator.share({ title, text, url: shareUrl });
      } else {
        await window.navigator.clipboard.writeText(shareUrl);
        toast({ title: "Fund link copied", description: "Share it with family and friends." });
      }
      haptic("success");
    } catch {
      try {
        await window.navigator.clipboard.writeText(shareUrl);
        toast({ title: "Fund link copied", description: "Share it with family and friends." });
        haptic("success");
      } catch {
        toast({ title: "Could not share right now", description: "Please try again.", variant: "destructive" });
      }
    }
  };

  const handleUnlock = async () => {
    try {
      const res = await fetch(`/api/kid-view/${token}/unlock`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pin }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || "That PIN did not work.");
      haptic("success");
      setAccessToken(data.accessToken);
      window.sessionStorage.setItem(`kid-view-access:${token}`, data.accessToken);
    } catch (error) {
      toast({ title: "Could not unlock Kid View", description: error instanceof Error ? error.message : "Please try again.", variant: "destructive" });
      setPin(""); // clear the pad on a wrong PIN (parity with the numpad auto-submit path)
    }
  };

  const handleSuggestStock = async () => {
    try {
      setSavingSuggestion(true);
      const res = await fetch(`/api/kid-view/${token}/suggestions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          accessToken,
          ticker: suggestionTicker.trim(),
          reason: suggestionReason.trim(),
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || "Could not save suggestion.");
      toast({ title: "Suggestion saved", description: "Your parent will see it in their dashboard." });
      setSuggestionTicker("");
      setSuggestionReason("");
      void refetch();
    } catch (error) {
      toast({ title: "Could not save suggestion", description: error instanceof Error ? error.message : "Please try again.", variant: "destructive" });
    } finally {
      setSavingSuggestion(false);
    }
  };

  // Withdraw a still-pending suggestion. Server enforces the pending check;
  // if the parent already approved/declined, the response is 409 and we
  // surface the message ("Your parent already responded to this one — it
  // can't be withdrawn now."). Silent on success — no toast spam, the row
  // just disappears from the list. Same energy as unsending a text mom
  // hadn't read yet.
  const [withdrawingId, setWithdrawingId] = useState<string | null>(null);

  // Suggestion-reviewed celebration moment (Tier-2 deferred item #3,
  // shipped 2026-05-23). When the kid lands on Kid View after their
  // parent has acted on a suggestion, surface a one-time soft beat
  // ("Your parent looked at your AAPL pick"). Per-suggestion-id
  // localStorage flag so each pick gets its own moment, dismissable.
  // Lives in Kid View (not authenticated Dashboard) because Kid View
  // is the kid's surface and the suggestion was THEIRS. PIN-protected
  // access means localStorage on this device is the right scope —
  // the kid uses the same browser repeatedly, this is THEIR moment.
  const SEEN_KEY_PREFIX = "kiddo.kid-suggestion-reviewed-seen:";
  const [seenSuggestionIds, setSeenSuggestionIds] = useState<Set<string>>(() => {
    if (typeof window === "undefined") return new Set();
    const seen = new Set<string>();
    try {
      for (let i = 0; i < window.localStorage.length; i++) {
        const k = window.localStorage.key(i);
        if (k && k.startsWith(SEEN_KEY_PREFIX)) {
          seen.add(k.slice(SEEN_KEY_PREFIX.length));
        }
      }
    } catch {
      // localStorage unavailable — kid sees the celebration every visit
      // until storage works. Better than swallowing the moment.
    }
    return seen;
  });
  const markSuggestionSeen = (suggestionId: string) => {
    try {
      safeLocalSet(`${SEEN_KEY_PREFIX}${suggestionId}`, new Date().toISOString());
    } catch {
      // best-effort
    }
    setSeenSuggestionIds((prev) => {
      const next = new Set(prev);
      next.add(suggestionId);
      return next;
    });
  };
  const handleWithdrawSuggestion = async (suggestionId: string) => {
    if (!suggestionId || !accessToken) return;
    if (!window.confirm("Take this suggestion back? Your parent won't see it.")) return;
    setWithdrawingId(suggestionId);
    try {
      const res = await fetch(`/api/kid-view/${token}/suggestions/${encodeURIComponent(suggestionId)}?accessToken=${encodeURIComponent(accessToken)}`, {
        method: "DELETE",
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.message || data?.error || "Could not withdraw suggestion.");
      void refetch();
    } catch (error) {
      toast({ title: "Could not withdraw", description: error instanceof Error ? error.message : "Please try again.", variant: "destructive" });
    } finally {
      setWithdrawingId(null);
    }
  };

  // Count-up on the balance reveal. EaseOutExpo via useCountUp, anchored
  // from a low start so the rise feels like a slow exhale rather than a
  // flicker. ~1.4s duration — longer than the parent dashboard's 900ms
  // because this surface is ceremonial, not transactional. The kid-at-18
  // lens: when Emma is 18 and opens this on her birthday, the balance
  // should arrive slowly enough that she feels the weight of it.
  //
  // IMPORTANT: this hook lives BEFORE the early-return guards below
  // (metaLoading, !content). React's rules-of-hooks require every hook
  // to be called in the same order on every render, so we read
  // `content?.fund?.balance` safely with `enabled: false` when content
  // hasn't loaded yet. Moving this below the guards would cause
  // "Rendered more hooks than during the previous render."
  const balanceLiveValue = parseFloat(String(content?.fund?.balance || "0"));
  const { value: animatedBalance, isAnimating: balanceAnimating } = useCountUp({
    from: balanceLiveValue * 0.92,
    to: balanceLiveValue,
    duration: 1400,
    enabled: balanceLiveValue > 0,
  });

  if (metaLoading) {
    // Skeleton mirror of the post-unlock layout. This is the surface the
    // kid-at-18 lens is named after — at 18, Emma opens her fund and
    // expects ceremony, not a centered spinner. The skeleton sketches the
    // hero card (evergreen rounded block), three stat tiles, and a
    // holdings list shape so the page never reads as empty. Motion stays
    // off here intentionally — the real motion (count-up balance, staged
    // holdings reveal) fires once data lands and the skeleton swaps to
    // the live render. A pulsing skeleton on the kid's birthday surface
    // would read as theatre; quiet scaffolding reads as competence.
    return (
      <div className="min-h-screen bg-gradient-to-b from-emerald-50 via-white to-amber-50">
        <div className="mx-auto max-w-lg px-4 py-6">
          <div className="flex items-center justify-between mb-6">
            <Logo />
            <div className="h-7 w-14 rounded-full bg-muted/40" />
          </div>
          {/* Hero skeleton — same shape + colors as the real hero so the
              swap to live content feels like a fill, not a layout change. */}
          <div className="rounded-[28px] bg-[hsl(var(--kiddo-evergreen))] text-white p-6 mb-4 shadow-lg">
            <div className="h-3 w-24 rounded bg-white/15 mb-3" />
            <div className="h-7 w-2/3 rounded bg-white/15 mb-2" />
            <div className="h-3 w-3/4 rounded bg-white/15 mb-5" />
            <div className="h-10 w-40 rounded bg-white/20 mb-5" />
            <div className="grid grid-cols-3 gap-2">
              <div className="h-16 rounded-2xl bg-white/10" />
              <div className="h-16 rounded-2xl bg-white/10" />
              <div className="h-16 rounded-2xl bg-white/10" />
            </div>
          </div>
          {/* Holdings skeleton — three rows match the typical fund shape. */}
          <div className="rounded-[24px] border border-border/60 bg-white p-5 mb-4">
            <div className="h-3 w-32 rounded bg-muted/40 mb-4" />
            <div className="space-y-3">
              {[0, 1, 2].map((i) => (
                <div key={i} className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-xl bg-muted/40 shrink-0" />
                  <div className="flex-1 h-3 rounded bg-muted/30" />
                  <div className="h-3 w-16 rounded bg-muted/30 shrink-0" />
                </div>
              ))}
            </div>
          </div>
          <div className="rounded-[24px] border border-border/60 bg-white p-5">
            <div className="h-3 w-28 rounded bg-muted/40 mb-4" />
            <div className="h-3 w-3/4 rounded bg-muted/30 mb-2" />
            <div className="h-3 w-2/3 rounded bg-muted/30" />
          </div>
        </div>
      </div>
    );
  }

  // Invalid / expired / mistyped kid link: the meta query failed, so there is no
  // fund behind this token. Without this branch the page falls through to the PIN
  // pad and the child types PINs forever against a fund that doesn't exist. Tell
  // them plainly, in kid-appropriate language, with a path forward.
  if (metaError) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-b from-emerald-50 via-white to-amber-50 px-4">
        <div className="flex justify-center mb-8"><Logo /></div>
        <div className="w-full max-w-[340px] text-center">
          <h1 className="font-heading text-2xl font-bold text-foreground mb-2">This link isn't working</h1>
          <p className="text-sm text-muted-foreground">
            This fund link is expired or not quite right. Ask the grown-up who shared it to send you a fresh one.
          </p>
        </div>
      </div>
    );
  }

  if (!accessToken || !content) {
    const PIN_LENGTH = 4;
    const pinDigits = pin.split("");
    const numpadKeys = ["1","2","3","4","5","6","7","8","9","","0","⌫"];
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-b from-emerald-50 via-white to-amber-50 px-4">
        <div className="flex justify-center mb-8"><Logo /></div>
        <div className="w-full max-w-[320px]">
          <h1 className="text-center font-heading text-2xl font-bold text-foreground mb-1">
            {meta?.childName ? `Hi ${meta.childName}.` : "Hi there."}
          </h1>
          <p className="text-center text-sm text-muted-foreground mb-8">
            {meta?.childName
              ? `Your family built something for you. Enter your PIN to see it.`
              : "Enter your PIN to open your fund."}
          </p>

          {/* PIN dots */}
          <div className="flex items-center justify-center gap-4 mb-8">
            {Array.from({ length: PIN_LENGTH }).map((_, i) => (
              <div
                key={i}
                className={`w-4 h-4 rounded-full border-2 transition-all duration-150 ${
                  i < pinDigits.length
                    ? "bg-[hsl(var(--kiddo-evergreen))] border-[hsl(var(--kiddo-evergreen))] scale-110"
                    : "border-muted-foreground/30"
                }`}
              />
            ))}
          </div>

          {/* Numpad */}
          <div className="grid grid-cols-3 gap-3">
            {numpadKeys.map((key, idx) => {
              if (key === "") return <div key={idx} />;
              return (
                <button
                  key={idx}
                  type="button"
                  onClick={() => {
                    if (key === "⌫") {
                      setPin((p) => p.slice(0, -1));
                    } else if (pin.length < PIN_LENGTH) {
                      const next = pin + key;
                      setPin(next);
                      if (next.length === PIN_LENGTH) {
                        haptic("light");
                        setTimeout(() => {
                          (async () => {
                            try {
                              const res = await fetch(`/api/kid-view/${token}/unlock`, {
                                method: "POST",
                                headers: { "Content-Type": "application/json" },
                                body: JSON.stringify({ pin: next }),
                              });
                              const data = await res.json().catch(() => ({}));
                              if (!res.ok) throw new Error(data?.error || "That PIN did not work.");
                              haptic("success");
                              setAccessToken(data.accessToken);
                              window.sessionStorage.setItem(`kid-view-access:${token}`, data.accessToken);
                            } catch (error) {
                              haptic("error");
                              const msg = error instanceof Error ? error.message : "Try again.";
                              const isWrongPin = msg.toLowerCase().includes("match") || msg.toLowerCase().includes("pin");
                              toast({
                                title: isWrongPin ? "Wrong PIN" : "Could not unlock",
                                description: msg,
                                variant: "destructive",
                              });
                              setPin("");
                            }
                          })();
                        }, 120);
                      }
                    }
                  }}
                  className={`h-16 rounded-2xl text-xl font-semibold transition-all active:scale-95 ${
                    key === "⌫"
                      ? "text-muted-foreground bg-muted/40 hover:bg-muted/60"
                      : "bg-white border border-border shadow-sm text-foreground hover:bg-muted/20"
                  }`}
                >
                  {key}
                </button>
              );
            })}
          </div>

          {meta?.pinHint && (
            <p className="text-center text-xs text-muted-foreground mt-6">Hint: {meta.pinHint}</p>
          )}
        </div>
      </div>
    );
  }

  // Time-until-18 display: prefer the precise monthsUntil18 from the API
  // (server-computed from the actual birthdate), fall back to integer-year
  // math only when the precise value is unavailable. This stops "8 months
  // remaining" from rounding up to "1 yr" — the kid is counting down, the
  // precision matters.
  // (balance count-up hook moved above the early-return guards — see
  // the comment block before the metaLoading check.)

  // monthsUntil18 / yearsUntil18Fallback — variable names retain the "18"
  // suffix for backwards compat with the server's field name (server has
  // the same naming-but-correct-semantics situation; see
  // server/routes.ts:515 comment block). The server's field IS majority-
  // aware regardless of name. The fallback below is what fires when the
  // server omits the field — fixed 2026-05-25 to use the fund's actual
  // majority age instead of a hardcoded 18, so a CA / MS / etc. teen
  // sees the right years-to-majority even on the fallback path.
  const monthsUntil18 = (content as any).monthsUntil18 as number | null | undefined;
  const fundMajorityAge = Number((content.fund as any)?.majorityAge) || 18;
  const yearsUntil18Fallback = content.age !== null ? Math.max(0, fundMajorityAge - content.age) : null;
  const timeUntil18Display: string = (() => {
    if (monthsUntil18 !== null && monthsUntil18 !== undefined) {
      if (monthsUntil18 === 0) return "Now";
      if (monthsUntil18 <= 12) return `${monthsUntil18} mo${monthsUntil18 === 1 ? "" : "s"}`;
      const years = Math.floor(monthsUntil18 / 12);
      const months = monthsUntil18 % 12;
      if (years <= 1 && months > 0) return `${years} yr ${months}mo`;
      return `${years} yr${years === 1 ? "" : "s"}`;
    }
    if (yearsUntil18Fallback === null) return "-";
    if (yearsUntil18Fallback === 0) return "Now";
    return `${yearsUntil18Fallback} yr${yearsUntil18Fallback === 1 ? "" : "s"}`;
  })();
  const uniqueGifters = new Set(cleanedGifts.map((g) => g.senderName)).size;

  return (
    <div className="min-h-screen bg-gradient-to-b from-emerald-50 via-white to-amber-50">
      <div className="mx-auto max-w-lg px-4 py-6">

        {/* Top bar */}
        <div className="flex items-center justify-between mb-6">
          <Logo />
          <button
            type="button"
            onClick={() => { window.sessionStorage.removeItem(`kid-view-access:${token}`); setAccessToken(null); setPin(""); }}
            className="text-xs font-semibold text-muted-foreground hover:text-foreground transition-colors border border-border rounded-full px-3 py-1.5"
          >
            Lock
          </button>
        </div>

        {/* Hero. Staged reveal with the approved motion vocabulary —
            slow-in from 8px down + opacity, eased with out-expo. The
            "This is yours, {childName}." copy is locked, the balance
            count-ups via useCountUp, and the three stat tiles stagger
            in 80ms apart so the moment reads as the fund being
            *presented*, not just rendered. No sparkles, no confetti,
            no bounce — primitives only. */}
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.55, ease: [0.16, 1, 0.3, 1] }}
          className="rounded-[28px] bg-[hsl(var(--kiddo-evergreen))] text-white p-6 mb-4 shadow-lg"
        >
          <p className="text-sm font-medium opacity-70 mb-1">{headerLabel}</p>
          <h1 className="font-heading text-3xl font-bold leading-tight mb-1">
            This is yours, {childName}.
          </h1>
          <p className="text-sm opacity-70 mb-5">
            {content.phase === "teen"
              ? `Real investments in your name, and they become yours when you turn ${futureProjection.majorityAge}.`
              : `Real stocks invested in your name. They become fully yours when you turn ${futureProjection.majorityAge}.`}
          </p>
          {/* Balance count-ups over 1.4s on mount. Tabular-nums prevents
              digit jitter as the number climbs. aria-live flips "off" during
              animation so screen readers don't fire ~60 announcements/sec on
              the cascading values; on settle it returns to "polite" and the
              final value is announced exactly once. Pattern locked in
              project_count_up_animation_consistency.md. */}
          <div
            className="text-4xl font-bold font-heading mb-1"
            style={{ fontVariantNumeric: "tabular-nums" }}
            aria-live={balanceAnimating ? "off" : "polite"}
            aria-label={fmtMoney(balanceLiveValue)}
          >
            {fmtMoney(animatedBalance)}
          </div>
          {/* Teen-phase settling-window breakdown. Younger phases
              keep the single-number abstraction (cognitive load is
              the right level for wonder + explanation phases per
              the locked phase rules). For participation-phase kids
              (14-17), surfacing "$X is still settling into
              investments" teaches the distinction between
              money-in-flight and money-invested. Per money-
              classification audit 2026-05-14. Conditional on
              positive uninvested cash so the line only renders
              when it has real content; otherwise the hero stays
              clean. */}
          {(() => {
            if (content.phase !== "teen") return null;
            const cash = parseFloat(String(content.fund.cashBalance || "0"));
            const pending = parseFloat(String(content.fund.pendingBalance || "0"));
            const uninvested = (Number.isFinite(cash) ? cash : 0) + (Number.isFinite(pending) ? pending : 0);
            if (uninvested < 1) return null;
            return (
              <p
                className="text-sm opacity-70 mb-4"
                data-testid="kidview-settling-line"
              >
                {fmtMoney(uninvested)} of that is still settling into investments. Lands in your stocks over the next 1 to 2 business days.
              </p>
            );
          })()}
          <div className="mb-5" />{/* preserves the original spacing */}
          {/* Stats — staggered reveal. delay: 0.18 + i*0.08 lands them
              just after the balance starts climbing, so the eye moves
              hero → balance → stats in a natural reading order. */}
          <div className="grid grid-cols-3 gap-2">
            {[
              // Lifetime totals from the server (giftStats), NOT the capped
              // display window — see the giftStats field note. Fallback to the
              // visible counts only if an older endpoint omits giftStats.
              { value: content?.giftStats?.total ?? cleanedGifts.length, label: "gifts\nreceived" },
              { value: content?.giftStats?.gifters ?? uniqueGifters, label: "people\ngave" },
              // "until it's yours", not "until you decide" — ownership
              // framing (terminology locked 2026-06-04): the fact is the
              // fund TRANSFERS at majority; "you decide" overstated a
              // minor's autonomy on a custodial asset.
              { value: timeUntil18Display, label: "until it's\nyours" },
            ].map((stat, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.45, ease: [0.16, 1, 0.3, 1], delay: 0.18 + i * 0.08 }}
                className="rounded-2xl bg-white/10 px-3 py-3 text-center"
              >
                <p className="text-xl font-bold">{stat.value}</p>
                <p className="text-[10px] opacity-65 leading-tight mt-0.5" style={{ whiteSpace: "pre-line" }}>
                  {stat.label}
                </p>
              </motion.div>
            ))}
          </div>
        </motion.div>

        {/* ─── Sealed-letter unlock celebration (Prong B Phase 4) ──
            Renders when sealed-letter entries' deliver_at fired within
            the last 14 days. Independent of phase — sealed letters can
            be scheduled for any age (5th birthday, 13th, graduation,
            etc.) so the celebration fires for any age. Quiet warm
            treatment matching the at-18 ceremony but a degree softer
            because this can fire repeatedly throughout childhood; the
            18-handoff is once-in-a-lifetime, sealed letters are
            recurring touches. Per project_sealed_letters_implementation_plan.md
            Phase 4. */}
        {(content.recentlyUnlockedSealedCount ?? 0) > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.55, ease: [0.16, 1, 0.3, 1], delay: 0.4 }}
            className="rounded-[24px] border border-[hsl(var(--kiddo-gold))]/30 bg-[hsl(var(--kiddo-gold))]/8 px-5 py-4 mb-4 flex items-start gap-3"
            data-testid="kid-view-sealed-unlocked"
          >
            <div className="text-2xl shrink-0" aria-hidden>🕯️</div>
            <div className="flex-1">
              <p className="text-sm font-semibold text-foreground">
                {content.recentlyUnlockedSealedCount === 1
                  ? `A sealed message just unlocked for you, ${childName}.`
                  : `${content.recentlyUnlockedSealedCount} sealed messages just unlocked for you, ${childName}.`}
              </p>
              <p className="mt-1 text-xs text-muted-foreground leading-relaxed">
                Your parent picked today {content.recentlyUnlockedSealedCount === 1 ? "to share something" : "to share these"} with you. Scroll down to read {content.recentlyUnlockedSealedCount === 1 ? "it" : "them"}.
              </p>
            </div>
          </motion.div>
        )}

        {/* ─── Adult-phase celebration ─────────────────────────────
            Renders ONLY when phase === "adult" (kid has actually turned
            18+). The teen-phase "Coming soon" callout further down stops
            firing once they hit adult. Without this card, an 18-year-old
            opening Kid View on her birthday would see the same dashboard
            as the day before — no acknowledgement of the milestone. The
            three things that change at 18 (legal control, full Memory
            Book unlock, ability to claim her own login) all surface here.
            Tone shifts from "soon" to "now." Same warm gold treatment as
            the prior coming-soon card so the visual continuity is felt
            ("the moment we promised has arrived"). */}
        {content.phase === "adult" && (() => {
          const isToday = monthsUntil18 === 0;
          const eighteenthDateRaw = (content.fund as any)?.eighteenthBirthday as string | null | undefined;
          const eighteenthLabel = eighteenthDateRaw
            ? new Date(eighteenthDateRaw).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric", timeZone: "UTC" })
            : null;
          return (
            <section className="rounded-[28px] border border-[hsl(var(--kiddo-gold)/0.40)] bg-[linear-gradient(135deg,hsl(var(--kiddo-gold)/0.18)_0%,#fff_55%,hsl(var(--kiddo-cream))_100%)] p-6 mb-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.78)]" data-testid="kid-view-adult-celebration">
              <div className="flex items-start gap-3">
                <span className="text-3xl shrink-0" aria-hidden="true">{isToday ? "🎉" : "🌱"}</span>
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[hsl(var(--kiddo-gold-ink))]/85 mb-1">
                    {isToday ? "Today's the day" : "Welcome to your fund"}
                  </p>
                  <h2 className="font-heading text-xl font-semibold text-foreground leading-tight">
                    {isToday ? <>It's all yours, {childName}.</> : <>This is your fund now, {childName}.</>}
                  </h2>
                </div>
              </div>
              <div className="mt-4 space-y-2 text-sm text-muted-foreground leading-relaxed">
                <p>Full legal control transferred to you{eighteenthLabel ? ` on ${eighteenthLabel}` : ""}.</p>
                <p>Nothing got sold, and the investments stay exactly where they are. You decide what happens next.</p>
              </div>
              {/* Reveal hint — gentle pointer that there are entries the
                  parent reserved for THIS day, now visible in the Memory
                  Book section below. Two layers:
                    - parentLetter (top): the sealed-letter ceremony copy
                      when the at-18 letter just unsealed; softer wording
                      when it's the legacy always-readable letter.
                    - unlockedAtMajorityCount (below): how many OTHER
                      memory entries (notes, photos, videos) the parent
                      specifically reserved for today by tagging them
                      visibility='kid_at_18'. The kid sees a real count
                      ("3 things your parents saved for today") — not
                      just a vague "scroll down." Each such entry also
                      gets a "Saved for today" badge in the feed below
                      so the kid can spot them as they scroll.
                  unlockedAtMajorityCount is 0 pre-majority and is gated
                  to the adult phase server-side, so the conditional
                  below is effectively "anything was reserved." */}
              {(content as any).parentLetter && (
                <p className={`mt-4 text-xs italic ${(content as any).parentLetter?.isSealedLetter ? "text-[rgb(140,30,30)]/85 font-semibold" : "text-[hsl(var(--kiddo-gold-ink))]/85"}`}>
                  {(content as any).parentLetter?.isSealedLetter
                    ? "A sealed letter from your parent unsealed today. Scroll to read it."
                    : "🔑 Your parent left you a letter. Scroll to the bottom to read it."}
                </p>
              )}
              {(content.unlockedAtMajorityCount ?? 0) > 0 && (
                <p className="mt-2 text-xs italic text-[hsl(var(--kiddo-gold-ink))]/85">
                  {content.unlockedAtMajorityCount} {content.unlockedAtMajorityCount === 1 ? "memory was saved" : "memories were saved"} specifically for today. Look for the gold marker as you scroll.
                </p>
              )}
              {/* Claim-account scaffold. Currently visits a placeholder
                  signup URL with the kid's fund context in the query.
                  When the auth/onboarding flow for "now-18-year-old kid
                  becomes a real Kiddo user account holder" ships, this
                  same CTA will route through it. For now: visible intent
                  ("you can take this over") with a non-broken landing. */}
              <a
                href={`/take-over/${encodeURIComponent(token || "")}?accessToken=${encodeURIComponent(accessToken || "")}`}
                className="mt-5 inline-flex items-center gap-1.5 rounded-full bg-[hsl(var(--kiddo-gold-ink))] px-4 py-2 text-sm font-semibold text-white hover:opacity-90 transition-opacity"
                data-testid="kid-view-claim-account"
              >
                Claim your account →
              </a>
              {/* P2P concept-preview entry. The adult-life surface for the
                  gifter loop ("send a friend cash or stock"). Post-majority
                  is exactly where P2P lives: now that the fund is yours, you
                  can pay it forward. Links to the FENCED /p2p-preview concept
                  page, which states plainly it is not a live feature and moves
                  no real money. Labeled "Preview" so it never reads as a live
                  payment button (per ACCOUNT_MODEL.md section 6). */}
              <div className="mt-4">
                <a
                  href="/p2p-preview"
                  className="inline-flex items-center gap-1.5 text-sm font-medium text-[hsl(var(--kiddo-gold-ink))]/75 underline-offset-4 hover:text-[hsl(var(--kiddo-gold-ink))] hover:underline transition-colors"
                  data-testid="kid-view-p2p-preview"
                >
                  Preview: send a friend cash or stock →
                </a>
              </div>
            </section>
          );
        })()}

        {/* Holdings — younger/child view only.
            The teen view renders its own dedicated "What you own" section
            further down (with full StockLogo + gain) inside the
            content.phase === "teen" block. Without this guard, teens saw
            the holdings list rendered twice (compact emoji-led above,
            ticker-led below) — same data, two presentations, confusing
            duplication. Younger mode keeps the warmer emoji-led version
            because the teen surface gets the financial-detail richer one. */}
        {content.holdings.length > 0 && isYoungerMode && (
          // Holdings card animates in just after the hero's stat tiles
          // finish staging (≈0.42s in). Each holding row then staggers
          // in 60ms apart. The cap on stagger delay (i clamped to 6)
          // prevents a 20-holding fund from reading as a slow waterfall
          // — anything past row 6 lands at the same beat. Approved
          // primitive: slow-in/opacity. No bounce, no scale-jiggle.
          <motion.div
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1], delay: 0.42 }}
            className="rounded-[24px] border border-border/60 bg-white p-5 mb-4"
          >
            <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground/60 mb-3">What you own right now</p>
            <div className="space-y-2.5">
              {content.holdings.map((holding, idx) => {
                const explainer = getCompanyExplainer(holding.ticker, holding.name);
                const gain = parseFloat(holding.gain || "0");
                const stagger = Math.min(idx, 6) * 0.06;
                return (
                  <motion.div
                    key={holding.id}
                    initial={{ opacity: 0, x: -4 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ duration: 0.35, ease: "easeOut", delay: 0.5 + stagger }}
                    className="flex items-center gap-3"
                  >
                    <div className="w-9 h-9 rounded-xl bg-muted/40 flex items-center justify-center text-base shrink-0">
                      {explainer.emoji}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-foreground">{friendlyHoldingName(holding.ticker, holding.name)}</p>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="text-sm font-semibold text-foreground">{fmtMoney(holding.currentValue)}</p>
                      {gain > 0 && <p className="text-[11px] text-green-600">+{fmtMoney(gain)} growth</p>}
                    </div>
                  </motion.div>
                );
              })}
            </div>
          </motion.div>
        )}

        <div className="space-y-4">

          {/* Gifters */}
          <div className="rounded-[24px] border border-border/60 bg-white p-5">
            <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground/60 mb-3">{giftsHeading}</p>
            {cleanedGifts.length === 0 ? (
              <p className="text-sm text-muted-foreground">Gifts will show up here as they come in.</p>
            ) : (() => {
              // Aggregate the "no note" line at the top of the section instead of
              // repeating it under every silent gift. The line is brilliant once;
              // by the eighth repeat it becomes comedy. When most gifts have no
              // note, this single warm sentence does the emotional work for the
              // entire section, and the rows themselves stay quiet — letting the
              // notes that DO exist breathe and feel personal.
              const noteCount = cleanedGifts.filter((g) => g.message && g.message.trim()).length;
              const noNoteCount = cleanedGifts.length - noteCount;
              // "The gift was the message" is the right beat ONLY when notes are
              // genuinely rare. It was firing off the recent (recurring-heavy, mostly
              // silent) gift slice, so it claimed "the gift was the message" even on
              // funds whose Memory Book is full of notes — directly contradicting the
              // "{N} notes from people who love you" line below. Gate it on the fund's
              // ACTUAL note count: suppress when notes are plentiful (let them breathe);
              // fire only for genuinely sparse-note funds. Fixed 2026-06-10.
              const fundIsNotesRich = (Number((content as any).memoryNoteCount) || 0) > 2;
              return (
                <>
                  {noNoteCount >= 3 && !fundIsNotesRich && (
                    <p className="text-[12px] italic text-muted-foreground/75 mb-3 leading-relaxed">
                      {noNoteCount === cleanedGifts.length
                        ? `${noNoteCount} ${noNoteCount === 1 ? "person gave" : "people gave"} without leaving a note. The gift was the message.`
                        : `${noNoteCount} of ${cleanedGifts.length} gave without a note. The gift was the message.`}
                    </p>
                  )}
                  <div className="space-y-3">
                    {cleanedGifts.map((gift) => {
                      const giftDate = gift.createdAt ? new Date(gift.createdAt) : null;
                      const initials = (gift.senderName || "?").split(" ").map((w: string) => w[0]).join("").slice(0, 2).toUpperCase();
                      const hasNote = !!(gift.message && gift.message.trim());
                      return (
                        <div key={gift.id} className="flex items-start gap-3">
                          <div className="w-9 h-9 rounded-full bg-[hsl(var(--kiddo-evergreen)/0.12)] flex items-center justify-center text-xs font-bold text-[hsl(var(--kiddo-evergreen))] shrink-0 mt-0.5">
                            {initials}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-baseline justify-between gap-2">
                              <div className="flex items-center gap-1.5 min-w-0">
                                <p className="text-sm font-semibold text-foreground truncate">{gift.senderName}</p>
                                {/* Recurring rhythm badge — keeps the parent's name as
                                    the warm attributor (Mom/Dad gave) while signaling
                                    that this gift was part of a monthly schedule.
                                    Better than depersonalizing as "Auto-invest" — the
                                    relationship is the point, the cadence is metadata. */}
                                {(gift as any).parentContributionId && (
                                  <span className="inline-flex items-center gap-0.5 rounded-full bg-[hsl(var(--kiddo-evergreen)/0.10)] px-1.5 py-0.5 text-[9px] font-bold text-[hsl(var(--kiddo-evergreen))] shrink-0" title="Recurring">
                                    ↻ Monthly
                                  </span>
                                )}
                              </div>
                              <p className="text-sm font-bold text-foreground shrink-0">{fmtMoney(gift.amount)}</p>
                            </div>
                            {hasNote && (
                              <p className="text-[12px] text-muted-foreground mt-0.5 italic">"{gift.message}"</p>
                            )}
                            {/* When a row has no note, only the aggregate line at the
                                top carries the "the gift was the message" framing. The
                                row itself stays quiet — date + invested status only. */}
                            <p className="text-[10px] text-muted-foreground/50 mt-1">
                              {giftDate ? giftDate.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" }) : ""}
                              {gift.status === "settled" || gift.status === "processing" ? " · Invested" : ""}
                            </p>
                            {/* Subtle report affordance. Lives on every
                                gift card so a kid (or anyone in this
                                view) can flag a concerning note / sender
                                without leaving the page. The text-link
                                styling keeps it discoverable without
                                turning the card into a moderation
                                surface — the kid's relationship is the
                                primary frame, the report path is the
                                quiet fallback. */}
                            <div className="mt-1">
                              <ReportContentButton
                                targetType="gift"
                                targetId={gift.id}
                                context={{ surface: "kid-view", fundId: content.fund.id }}
                              />
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </>
              );
            })()}
          </div>

            <section className="rounded-[28px] border border-border/60 bg-card p-6">
              <div className="flex items-center gap-2">
                <BookOpen className="h-4 w-4 text-primary" />
                <h2 className="font-heading text-2xl font-semibold text-foreground">Memory Book</h2>
              </div>
              {/* The abundance line: one number conveys the moat better than the
                  list. Counts human notes (server's memoryNoteCount), so an auto
                  milestone never inflates "people who love you". */}
              {(content.memoryNoteCount ?? 0) >= 3 && (
                <p className="mt-1.5 text-sm font-semibold text-primary" data-testid="memory-note-count">
                  {content.memoryNoteCount} notes from people who love you.
                </p>
              )}
              {content.phase === "teen" ? (
                <div className="mt-4 space-y-3">
                  {visibleMemories.map((entry) => {
                    // Mark entries that the parent specifically reserved for
                    // today (visibility='kid_at_18' on the entry, became
                    // visible only at majority age). Soft kiddo-gold border
                    // + small "Saved for today" pill so the kid can spot
                    // these as they scroll the feed — pairs with the
                    // celebration card's "✨ N memories were saved
                    // specifically for today" copy above.
                    const isUnlockedAt18 = entry.visibility === "kid_at_18";
                    return (
                      <div
                        key={entry.id}
                        className={`rounded-2xl p-4 ${
                          isUnlockedAt18
                            ? "border border-[hsl(var(--kiddo-gold)/0.40)] bg-[linear-gradient(135deg,hsl(var(--kiddo-gold)/0.10)_0%,#fff_100%)] shadow-[inset_0_1px_0_rgba(255,255,255,0.78)]"
                            : "bg-muted/30"
                        }`}
                        data-testid={isUnlockedAt18 ? "memory-saved-for-today" : undefined}
                      >
                        {isUnlockedAt18 && (
                          <p className="mb-2 inline-flex items-center gap-1 rounded-full bg-[hsl(var(--kiddo-gold)/0.18)] px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-[hsl(var(--kiddo-gold-ink))]">
                            Saved for today
                          </p>
                        )}
                      {/* Memory Book inversion in Kid View: when there's a real
                          note, it's the headline; author becomes attribution.
                          When no note, fall back to a quiet metadata line so we
                          never render the generic "A memory from your fund story." */}
                      {entry.content && entry.content.trim() ? (
                        <>
                          <p className="font-serif text-base leading-relaxed text-foreground italic">&ldquo;{entry.content}&rdquo;</p>
                          <p className="mt-2 text-xs text-muted-foreground">from {entry.authorName || "someone special"}</p>
                        </>
                      ) : (
                        <p className="text-xs text-muted-foreground">A memory from {entry.authorName || "someone"}.</p>
                      )}
                      {entry.photoUrl && <img src={entry.photoUrl} alt="Memory" loading="lazy" className="mt-3 h-44 w-full rounded-2xl object-cover" />}
                      {(entry as any).audioUrl && (
                        <div className="mt-3 rounded-xl border border-border/40 bg-background px-3 py-2">
                          <p className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground mb-1">🎙 Voice note</p>
                          <audio src={(entry as any).audioUrl} controls className="w-full h-9" />
                          {(entry as any).audioTranscript && (
                            <p className="mt-2 text-[12px] italic text-foreground/75 leading-relaxed">
                              &ldquo;{(entry as any).audioTranscript}&rdquo;
                            </p>
                          )}
                        </div>
                      )}
                      {/* Report affordance on the memory card too. The gift cards
                          have one; without it the highest-risk surface (an
                          unscanned stranger photo/voice note) was a reporting
                          dead-end. Same /api/reports -> T&S queue; a memory_entry
                          report is auto-flagged. Trust-safety audit C3. */}
                      <div className="mt-1">
                        <ReportContentButton
                          targetType="memory_entry"
                          targetId={entry.id}
                          context={{ surface: "kid-view", fundId: content.fund.id }}
                        />
                      </div>
                    </div>
                    );
                  })}
                  {cleanedMemories.length > MEMORY_PREVIEW && !showAllMemories && (
                    <button
                      type="button"
                      onClick={() => setShowAllMemories(true)}
                      data-testid="memory-see-all"
                      className="w-full rounded-2xl border border-border/60 bg-muted/20 py-3 text-sm font-semibold text-primary transition-colors hover:bg-muted/40"
                    >
                      See all {cleanedMemories.length} memories
                    </button>
                  )}
                </div>
              ) : (
                <div className="mt-4 rounded-2xl bg-muted/30 p-5 text-center">
                  <p className="text-base font-semibold text-foreground">
                    {cleanedGifts.length > 0
                      ? `${cleanedGifts.length} ${cleanedGifts.length === 1 ? "person has" : "people have"} left you something.`
                      : "People will leave you something here."}
                  </p>
                  <p className="mt-2 text-sm text-muted-foreground">You get to read it all when you turn {futureProjection.majorityAge}.</p>
                </div>
              )}
            </section>

          {content.savingsGoals && content.savingsGoals.length > 0 && (
            <div className="rounded-[24px] border border-[hsl(var(--kiddo-gold)/0.30)] bg-[linear-gradient(135deg,hsl(var(--kiddo-gold)/0.07)_0%,#fff_100%)] p-5 mb-4">
              <div className="flex items-center gap-2 mb-4">
                <Target className="h-4 w-4 text-[hsl(var(--kiddo-gold-ink))]" />
                <p className="text-xs font-bold uppercase tracking-widest text-[hsl(var(--kiddo-gold-ink))]">
                  {isYoungerMode ? "Your big goals" : "Your savings goals"}
                </p>
              </div>
              <div className="space-y-4">
                {content.savingsGoals.map((goal) => {
                  const goalAmt = parseFloat(goal.goalAmount || "0");
                  const saved = parseFloat(goal.giftVolume || "0");
                  const pct = goalAmt > 0 ? Math.min((saved / goalAmt) * 100, 100) : 0;
                  return (
                    <div key={goal.id}>
                      <div className="flex items-start justify-between gap-2 mb-2">
                        <div>
                          <p className="text-sm font-semibold text-foreground">{goal.name}</p>
                          {isYoungerMode ? (
                            <p className="text-[12px] text-muted-foreground mt-0.5">
                              {saved > 0
                                ? `${fmtMoney(saved)} is already saved toward this, in real money.`
                                : "This is something your family is saving for."}
                            </p>
                          ) : (
                            <p className="text-[12px] text-muted-foreground mt-0.5">
                              {fmtMoney(saved)} of {fmtMoney(goalAmt)} target
                            </p>
                          )}
                        </div>
                        <span className="shrink-0 rounded-full bg-[hsl(var(--kiddo-gold)/0.15)] px-2 py-0.5 text-xs font-bold text-[hsl(var(--kiddo-gold-ink))]">
                          {pct.toFixed(0)}%
                        </span>
                      </div>
                      <div className="w-full h-2.5 bg-white/60 rounded-full overflow-hidden border border-[hsl(var(--kiddo-gold)/0.20)]">
                        <div
                          className="h-full rounded-full transition-all duration-700"
                          style={{ width: `${pct.toFixed(1)}%`, background: "hsl(var(--kiddo-gold))" }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
              {isYoungerMode && (
                <p className="mt-4 text-[12px] text-muted-foreground">
                  Every gift that comes in helps get there. You will know what all of this was for when you are older.
                </p>
              )}
            </div>
          )}

          <div className="space-y-6">
            <section className="rounded-[28px] border border-border/60 bg-card p-6">
              <div className="flex items-center gap-2">
                <TrendingUp className="h-4 w-4 text-primary" />
                <h2 className="font-heading text-2xl font-semibold text-foreground">How it is growing</h2>
              </div>
              <p className="mt-3 text-sm text-muted-foreground">
                {growthCopy}
              </p>
              <div className="mt-4 rounded-3xl bg-primary/5 p-4 text-sm text-foreground">
                {growthCardCopy}
              </div>
              {/* Two-bucket split (KIDDO_VOICE.md): what people put in vs what
                  the market added, side by side. The contrast of the two real
                  numbers IS the discovery — no scripted question, no reveal
                  (the label already says where it came from; a quiz on top of
                  it just restated the same fact and read as weird). Only when
                  there is real positive growth to point at: a down or flat fund
                  keeps the honest growthCopy above and shows nothing here
                  (silence is part of the voice). */}
              {growthSummary.gain > 0 && (
                <div className="mt-4 rounded-3xl border border-border/60 p-4">
                  <div className="flex items-end justify-between gap-3">
                    <div>
                      <p className="text-xs uppercase tracking-wide text-muted-foreground">
                        {isYoungerMode ? "People put in" : "You and your family put in"}
                      </p>
                      <p className="mt-1 font-heading text-xl text-foreground">{fmtMoney(growthSummary.contributed)}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-xs uppercase tracking-wide text-muted-foreground">The market added</p>
                      <p className="mt-1 font-heading text-xl text-foreground">+{fmtMoney(growthSummary.gain)}</p>
                    </div>
                  </div>
                </div>
              )}
            </section>

            <section className="rounded-[28px] border border-border/60 bg-card p-6">
              <div className="flex items-center gap-2">
                <Lightbulb className="h-4 w-4 text-primary" />
                <h2 className="font-heading text-2xl font-semibold text-foreground">What could this grow to?</h2>
              </div>
              <p className="mt-3 text-sm text-muted-foreground">
                {projectionCopy}
              </p>
              {/* The doubling device at the HONEST cadence (~10 yrs at 7% net,
                  never "every 7 years" — that imports 10%; see
                  COMPOUNDING_NARRATIVE_NOTE.md guardrail #6). The single most
                  intuitive way to feel compounding. Hypothetical; the card's
                  disclaimer below covers "not guaranteed." */}
              {content.age !== null && content.age !== undefined && content.age <= 17 && (
                <p className="mt-2 text-sm text-muted-foreground">
                  Left invested, money tends to roughly double about every ten years. A gift today could double before you turn {content.age + 10}, and again by {content.age + 20}.
                </p>
              )}
              <div className="mt-4 space-y-3">
                <label className="block text-sm text-muted-foreground">
                  Estimate gifts each year
                  <input
                    type="number"
                    min={0}
                    step={50}
                    value={annualGiftEstimate}
                    onChange={(e) => setAnnualGiftEstimate(Math.max(0, Number(e.target.value || 0)))}
                    className="mt-2 h-11 w-full rounded-2xl border border-border bg-background px-4 text-sm text-foreground"
                  />
                </label>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="rounded-2xl bg-muted/30 p-4">
                    <p className="text-xs uppercase tracking-wide text-muted-foreground">By age {futureProjection.majorityAge}</p>
                    <p className="mt-1 font-heading text-2xl text-foreground">{fmtMoney(futureProjection.toMajority)}</p>
                  </div>
                  <div className="rounded-2xl bg-muted/30 p-4">
                    <p className="text-xs uppercase tracking-wide text-muted-foreground">By age 25</p>
                    <p className="mt-1 font-heading text-2xl text-foreground">{fmtMoney(futureProjection.to25)}</p>
                  </div>
                </div>
                <p className="text-xs text-muted-foreground/80">
                  Hypothetical estimate using 7% historical average annual return, net of Kiddo's annual fee ($1/yr per $1,000 invested). Real markets move up and down; returns are never guaranteed. Annual gifts assumed to stop at age {futureProjection.majorityAge} (when the fund legally becomes yours).
                </p>
              </div>
            </section>

            <section className="rounded-[28px] border border-border/60 bg-card p-6">
              <div className="flex items-center gap-2">
                <BookOpen className="h-4 w-4 text-primary" />
                <h2 className="font-heading text-2xl font-semibold text-foreground">
                  {companiesHeading}
                </h2>
              </div>
              <div className="mt-4 space-y-3">
                {/* Show ALL owned holdings with explainers, not just the first 3.
                    A kid owning 10 things and seeing only 3 explained is more
                    confusing than scrolling. The COMPANY_EXPLAINERS map covers
                    every ticker in the picker + ETF allowlist, with a generic
                    fallback for anything new. */}
                {content.holdings.map((holding) => {
                  const explainer = getCompanyExplainer(holding.ticker, holding.name);
                  return (
                    <div key={holding.id} className={`rounded-2xl bg-muted/30 p-4${isYoungerMode ? " card-bob" : ""}`}>
                      <p className="font-semibold text-foreground">
                        {explainer.emoji} {isYoungerMode ? explainer.youngOwner : friendlyHoldingName(holding.ticker, holding.name)}
                      </p>
                      {isYoungerMode ? (
                        <p className="mt-2 text-sm text-muted-foreground">{explainer.whatTheyDo}</p>
                      ) : (
                        <>
                          <p className="mt-2 text-sm text-muted-foreground">{explainer.whatTheyDo}</p>
                          <p className="mt-2 text-sm text-foreground/90">{explainer.whyItMatters}</p>
                        </>
                      )}
                    </div>
                  );
                })}
              </div>
            </section>

            {content.phase !== "teen" && content.allowTeenSuggestions && (
              <section className="rounded-[28px] border border-border/60 bg-card p-6">
                <div className="flex items-center gap-2">
                  <Lightbulb className="h-4 w-4 text-primary" />
                  <h2 className="font-heading text-2xl font-semibold text-foreground">Is there a company you love?</h2>
                </div>
                <p className="mt-3 text-sm text-muted-foreground">Tell your family. They can add it to your fund story.</p>
                <div className="mt-4 space-y-3">
                  <input value={suggestionTicker} onChange={(e) => setSuggestionTicker(e.target.value.toUpperCase())} placeholder="Company name or ticker, like DIS or AAPL" className="h-12 w-full rounded-2xl border border-border bg-background px-4 text-sm" />
                  <textarea value={suggestionReason} onChange={(e) => setSuggestionReason(e.target.value)} placeholder="Why do you love this company?" className="min-h-[80px] w-full rounded-2xl border border-border bg-background px-4 py-3 text-sm" />
                  <Button className="w-full" onClick={handleSuggestStock} disabled={savingSuggestion || !suggestionTicker.trim()}>
                    {savingSuggestion ? "Sending..." : "Tell my family"}
                  </Button>
                </div>
              </section>
            )}

            {content.phase === "teen" && (
              <>
                {content.age !== null && content.age < ((content.fund as any)?.majorityAge || 18) && (
                  <section className="rounded-[28px] border border-[hsl(var(--kiddo-gold)/0.30)] bg-[hsl(var(--kiddo-gold)/0.06)] p-6">
                    {/* The at-18 callout — the moment of legal handoff, framed as
                        the kid's agency moment, not a process detail. Order matters:
                        🔑 + specific date as the headline (the WHEN), then the
                        legal-control sentence (the WHAT), then the three reassurance
                        lines (the WHY it's safe), then the countdown (the HOW LONG).
                        "That's the whole point" is the closing punctuation — same
                        line as on the parent's Age18Plan page so the parent and the
                        kid feel the same conviction. */}
                    {(() => {
                      const eighteenthDateRaw = (content.fund as any)?.eighteenthBirthday as string | null | undefined;
                      const eighteenthLabel = eighteenthDateRaw
                        ? new Date(eighteenthDateRaw).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" })
                        : null;
                      // State-specific UTMA majority age (21 in most states; 18 in some,
                      // e.g. CA/KY; 19 in AL/NE). The countdown math + transfer copy
                      // both need to use this — was hardcoded "18" in both places,
                      // factually wrong for non-18 states. See
                      // project_state_majority_age_sweep.md.
                      const majorityAge = Number((content.fund as any)?.majorityAge) || 18;
                      const countdownLabel = (() => {
                        if (monthsUntil18 !== null && monthsUntil18 !== undefined) {
                          if (monthsUntil18 === 0) return "Today";
                          if (monthsUntil18 <= 12) return `~${monthsUntil18} month${monthsUntil18 === 1 ? "" : "s"} away`;
                          const years = Math.floor(monthsUntil18 / 12);
                          return `~${years} year${years === 1 ? "" : "s"} away`;
                        }
                        const yrs = majorityAge - (content.age ?? 0);
                        if (yrs === 0) return "Today";
                        if (yrs === 1) return "Less than a year away";
                        return `~${yrs} years away`;
                      })();
                      return (
                        <>
                          <div className="flex items-start gap-3">
                            <span className="text-2xl shrink-0" aria-hidden="true">🔑</span>
                            <div className="min-w-0 flex-1">
                              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[hsl(var(--kiddo-gold-ink))]/80 mb-1">Coming soon</p>
                              <h2 className="font-heading text-xl font-semibold text-foreground leading-tight">
                                {eighteenthLabel
                                  ? <>On {eighteenthLabel}. It&rsquo;s all yours.</>
                                  : <>The day this fund becomes fully yours.</>}
                              </h2>
                            </div>
                          </div>
                          <div className="mt-4 space-y-2 text-sm text-muted-foreground leading-relaxed">
                            <p>Full legal control transfers to you at {majorityAge}.</p>
                            <p>Nothing gets sold, and the investments stay where they are. You decide what happens next.</p>
                          </div>
                          <p className="mt-4 text-[11px] font-semibold uppercase tracking-[0.10em] text-[hsl(var(--kiddo-gold-ink))]/70">
                            {countdownLabel}
                          </p>
                        </>
                      );
                    })()}
                  </section>
                )}

                <section className="rounded-[28px] border border-border/60 bg-card p-6">
                  <div className="flex items-center gap-2">
                    <BadgeCheck className="h-4 w-4 text-primary" />
                    <h2 className="font-heading text-2xl font-semibold text-foreground">What you own</h2>
                  </div>
                  <div className="mt-4 space-y-3">
                    {content.holdings.map((holding) => {
                      // Suppress "Gain $0.00" — when there's no gain (test data
                      // with cost basis = 0, or genuinely flat positions), the
                      // line repeated 10× across holdings is uninformative noise.
                      // Show the gain only when it's meaningfully non-zero.
                      const gainNum = parseFloat(String(holding.gain || "0"));
                      const showGain = Math.abs(gainNum) >= 0.01;
                      return (
                      <div key={holding.id} className="rounded-2xl bg-muted/30 p-4">
                        <div className="flex items-center justify-between gap-3">
                          <div className="flex items-center gap-3">
                            <StockLogo ticker={holding.ticker} size={40} />
                            <div>
                              <p className="font-medium text-foreground">{friendlyHoldingName(holding.ticker, holding.name)}</p>
                            </div>
                          </div>
                          <div className="text-right">
                            <p className="font-medium text-foreground">{fmtMoney(holding.currentValue)}</p>
                            {showGain && (
                              // Honest framing: the word "growth" only attaches
                              // to positive moves. Calling a negative move
                              // "−$2.10 growth" greenwashes a loss, which the
                              // locked feedback_no_greenwashing_losses rule
                              // explicitly refuses. Losses render as the
                              // signed amount alone — calm, accurate, no
                              // editorial spin.
                              <p className={`text-xs ${gainNum >= 0 ? "text-green-600" : "text-amber-700"}`}>
                                {gainNum >= 0
                                  ? <>+{fmtMoney(gainNum)} growth</>
                                  : <>−{fmtMoney(Math.abs(gainNum))}</>}
                              </p>
                            )}
                          </div>
                        </div>
                      </div>
                      );
                    })}
                  </div>
                </section>

                {content.allowTeenSuggestions && (
                  <section className="rounded-[28px] border border-border/60 bg-card p-6">
                    <div className="flex items-center gap-2">
                      <Lightbulb className="h-4 w-4 text-primary" />
                      <h2 className="font-heading text-2xl font-semibold text-foreground">
                        {content.phase === "teen" ? "Suggest a stock" : "Is there a company you love?"}
                      </h2>
                    </div>
                    <p className="mt-3 text-sm text-muted-foreground">
                      {content.phase === "teen"
                        ? "Tell your parent what company you would want future gifts invested in and why."
                        : "Tell your family. They can add it to your fund story."}
                    </p>
                    <div className="mt-4 space-y-3">
                      <input
                        value={suggestionTicker}
                        onChange={(e) => setSuggestionTicker(e.target.value.toUpperCase())}
                        placeholder="Ticker, like DIS or AAPL"
                        className="h-12 w-full rounded-2xl border border-border bg-background px-4 text-sm"
                      />
                      <textarea
                        value={suggestionReason}
                        onChange={(e) => setSuggestionReason(e.target.value)}
                        placeholder="Why does this company matter to you?"
                        className="min-h-[110px] w-full rounded-2xl border border-border bg-background px-4 py-3 text-sm"
                      />
                      {/* Disabled-on-empty parity with the younger form's
                          button — previously a teen could tap Send with a
                          blank ticker and eat a server 400. */}
                      <Button className="w-full" onClick={handleSuggestStock} disabled={savingSuggestion || !suggestionTicker.trim()}>
                        {savingSuggestion ? "Saving..." : "Send suggestion"}
                      </Button>
                    </div>
                    {/* Newly-reviewed celebration — fires for any approved
                        or declined suggestion the kid hasn't acknowledged
                        yet. One-time per suggestion (localStorage flag).
                        Approved gets a warm green beat; declined gets a
                        soft amber acknowledgment with explicit "you can
                        suggest another anytime" anchoring so the moment
                        doesn't read as rejection. Per Tier-2 deferred #3. */}
                    {(() => {
                      const newlyReviewed = content.suggestions.filter((s) => {
                        const status = String((s as any)?.reviewedStatus || "pending").toLowerCase();
                        return (status === "approved" || status === "declined") && !seenSuggestionIds.has(s.id);
                      });
                      if (newlyReviewed.length === 0) return null;
                      return (
                        <motion.div
                          initial={{ opacity: 0, y: 10 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ duration: 0.35 }}
                          className="mt-5 space-y-2"
                          data-testid="kid-suggestion-reviewed-celebration"
                        >
                          {newlyReviewed.map((s) => {
                            const status = String((s as any)?.reviewedStatus || "pending").toLowerCase();
                            const isApproved = status === "approved";
                            const dismiss = () => markSuggestionSeen(s.id);
                            return (
                              <div
                                key={s.id}
                                className={`rounded-2xl border p-4 ${
                                  isApproved
                                    ? "border-green-300/60 bg-gradient-to-br from-green-50 to-white"
                                    : "border-amber-300/50 bg-gradient-to-br from-amber-50 to-white"
                                }`}
                              >
                                <div className="flex items-start justify-between gap-3">
                                  <div className="min-w-0 flex-1">
                                    <p
                                      className={`text-[10px] font-bold uppercase tracking-[0.14em] ${
                                        isApproved ? "text-green-700" : "text-amber-800"
                                      }`}
                                    >
                                      {isApproved ? "Your parent said yes" : "Your parent saw it"}
                                    </p>
                                    <p className="mt-1.5 font-heading text-base font-semibold text-foreground">
                                      {isApproved
                                        ? `${s.ticker} is on your parent's radar.`
                                        : `${s.ticker} got reviewed.`}
                                    </p>
                                    <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">
                                      {isApproved
                                        ? "They're looking at adding it to your fund. Pick another company anytime. It's how the fund starts feeling like yours."
                                        : "They went a different way this time. You can suggest another anytime. They're listening."}
                                    </p>
                                  </div>
                                  <button
                                    type="button"
                                    onClick={dismiss}
                                    className="shrink-0 text-xs text-muted-foreground hover:text-foreground transition-colors"
                                    data-testid={`kid-suggestion-reviewed-dismiss-${s.id}`}
                                    aria-label="Dismiss"
                                  >
                                    Got it
                                  </button>
                                </div>
                              </div>
                            );
                          })}
                        </motion.div>
                      );
                    })()}
                    {content.suggestions.length > 0 && (
                      <div className="mt-5 space-y-2">
                        <p className="text-[11px] font-bold uppercase tracking-[0.10em] text-muted-foreground/70">What you've suggested</p>
                        {content.suggestions.map((suggestion) => {
                          // Status drives layout: pending shows a withdraw link
                          // (your parent hasn't acted yet, take it back if you
                          // want). Approved/declined are immutable history —
                          // once parent has responded, the message is sent.
                          const status = String((suggestion as any)?.reviewedStatus || "pending").toLowerCase();
                          const isPending = status === "pending";
                          const isApproved = status === "approved";
                          const isDeclined = status === "declined";
                          const pillClass = isApproved
                            ? "bg-green-100 text-green-700"
                            : isDeclined
                              ? "bg-amber-100 text-amber-800"
                              : "bg-[hsl(var(--kiddo-evergreen)/0.12)] text-[hsl(var(--kiddo-evergreen))]";
                          const pillLabel = isApproved ? "Approved" : isDeclined ? "Declined" : "Waiting on your parent";
                          const isThisRowBusy = withdrawingId === suggestion.id;
                          return (
                            <div key={suggestion.id} className={`rounded-2xl bg-muted/30 p-3 text-sm transition-opacity ${isThisRowBusy ? "opacity-60" : ""}`}>
                              <div className="flex items-start justify-between gap-3">
                                <div className="min-w-0 flex-1">
                                  <p className="font-medium text-foreground">{suggestion.ticker}</p>
                                  {suggestion.reason && <p className="mt-1 text-muted-foreground">{suggestion.reason}</p>}
                                </div>
                                <span className={`shrink-0 inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-bold ${pillClass}`}>
                                  {pillLabel}
                                </span>
                              </div>
                              {isPending && !isThisRowBusy && (
                                <div className="mt-2 flex justify-end">
                                  <button
                                    type="button"
                                    onClick={() => void handleWithdrawSuggestion(suggestion.id)}
                                    className="text-[11px] text-muted-foreground hover:text-destructive transition-colors"
                                    data-testid={`button-withdraw-suggestion-${suggestion.id}`}
                                  >
                                    Take it back
                                  </button>
                                </div>
                              )}
                              {isApproved && (
                                <p className="mt-2 text-[11px] italic text-green-700/80">
                                  Your parent's looking at adding {suggestion.ticker} to your fund.
                                </p>
                              )}
                              {isDeclined && (
                                <p className="mt-2 text-[11px] italic text-amber-800/80">
                                  Your parent saw it but went a different way this time. You can suggest another anytime.
                                </p>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </section>
                )}

                <section className="rounded-[28px] border border-border/60 bg-card p-6">
                  <div className="flex items-center gap-2">
                    <Lightbulb className="h-4 w-4 text-primary" />
                    <h2 className="font-heading text-2xl font-semibold text-foreground">What moves a stock?</h2>
                  </div>
                  <p className="mt-3 text-sm text-muted-foreground">
                    Stock prices move when people change how confident they feel about a company. New products, earnings reports, leadership changes, and the economy can all shift that confidence.
                  </p>
                  <div className="mt-4 rounded-2xl bg-muted/30 p-4 text-sm text-foreground/90">
                    A stock going down for a while does not automatically mean the company is broken. A stock going up does not guarantee it will keep going up. Long-term investing is about learning to zoom out.
                  </div>
                </section>

              </>
            )}

            {/* Featured parent letter — the page's emotional capstone, visible
                in EVERY mode (child, teen, even unknown phase). Sits at the
                very bottom of the scroll so the kid's experience resolves on
                the most personal artifact in the product. Serif italic + soft
                cream-and-gold card + attribution = "this was written by a
                human, for you, intentionally." Only renders when the parent
                has actually written one (null otherwise — never show a
                placeholder; the absence is honest). The parent's intent
                ("she'll read this on her 18th birthday") still holds — Emma
                can read it earlier; the 18th birthday is when it becomes hers
                in full alongside the fund. Moved OUTSIDE the teen-only block
                because previously a 9-year-old Emma couldn't see Mom's letter
                at all — that's the wrong design call. The letter is THE moat,
                it should reach the kid at every age. */}
            {(content as any).parentLetter && (() => {
              const letter = (content as any).parentLetter as {
                id: string;
                content: string;
                authorName: string | null;
                createdAt: string | null;
                isSealedLetter?: boolean;
              };
              const fundCreatedRaw = (content.fund as any)?.createdAt as string | null | undefined;
              const fundCreatedLabel = fundCreatedRaw
                ? new Date(fundCreatedRaw).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" })
                : null;
              const author = (letter.authorName || "your parent").trim();
              // Sealed-letter ceremony — only renders when the parent
              // specifically reserved the letter for the at-18 reveal
              // (type='sealed_letter' on the server, surfaced via
              // isSealedLetter). The visibility filter on the API side
              // already gates this content behind the isAdult check, so
              // by the time it reaches the kid surface, the unseal
              // moment has arrived. Different copy + a wax-seal mark
              // that reads as "this was deliberately written for now"
              // rather than the always-readable letter version.
              if (letter.isSealedLetter) {
                return (
                  <section className="rounded-[28px] border border-[rgb(140,30,30)/0.32] bg-[linear-gradient(135deg,hsl(var(--kiddo-cream))_0%,#fff_60%,rgba(140,30,30,0.04)_100%)] p-6 shadow-[inset_0_1px_0_rgba(255,255,255,0.78)] mt-4 relative" data-testid="kid-view-sealed-letter">
                    <div className="absolute -top-4 right-6">
                      <div style={{
                        width: 56, height: 56,
                        borderRadius: "50%",
                        background: "radial-gradient(circle at 38% 32%, rgb(196,42,42) 0%, rgb(140,30,30) 55%, rgb(96,18,18) 100%)",
                        boxShadow: "inset -2px -3px 8px rgba(0,0,0,0.32), 0 4px 12px rgba(140,30,30,0.18)",
                        display: "flex", alignItems: "center", justifyContent: "center",
                        border: "2px solid rgba(255,255,255,0.18)",
                      }}>
                        <span style={{
                          fontSize: 22, fontWeight: 700,
                          color: "rgba(255,255,255,0.92)",
                          fontFamily: "Georgia, serif",
                          textShadow: "0 1px 2px rgba(0,0,0,0.32)",
                        }}>
                          {(author[0] || "P").toUpperCase()}
                        </span>
                      </div>
                    </div>
                    <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[rgb(140,30,30)]/80 mb-2">
                      Unsealed today
                    </p>
                    <p className="font-heading text-xl font-bold text-foreground leading-snug mb-4">
                      {author} wrote this knowing you would read it today.
                    </p>
                    <p className="font-serif text-lg leading-relaxed text-foreground italic">
                      &ldquo;{letter.content}&rdquo;
                    </p>
                    <p className="mt-5 text-xs text-muted-foreground">
                      With love, {author}
                      {fundCreatedLabel && (
                        <>
                          {" · "}Started {childName ? `${childName}'s` : "this"} fund {fundCreatedLabel}
                        </>
                      )}
                    </p>
                  </section>
                );
              }
              return (
                <section className="rounded-[28px] border border-[hsl(var(--kiddo-gold)/0.30)] bg-[linear-gradient(135deg,hsl(var(--kiddo-cream))_0%,#fff_60%,hsl(var(--kiddo-gold)/0.10)_100%)] p-6 shadow-[inset_0_1px_0_rgba(255,255,255,0.78)] mt-4" data-testid="kid-view-parent-letter">
                  <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[hsl(var(--kiddo-gold-ink))]/80 mb-3">
                    A note from {author}
                  </p>
                  <p className="font-serif text-lg leading-relaxed text-foreground italic">
                    &ldquo;{letter.content}&rdquo;
                  </p>
                  <p className="mt-4 text-xs text-muted-foreground">
                    With love, {author}
                    {fundCreatedLabel && (
                      <>
                        {" · "}Started {childName ? `${childName}'s` : "this"} fund {fundCreatedLabel}
                      </>
                    )}
                  </p>
                </section>
              );
            })()}
          </div>
        </div>
      </div>
      {(contentLoading) && <div className="fixed bottom-4 left-1/2 -translate-x-1/2 rounded-full bg-card px-4 py-2 text-sm shadow">Refreshing…</div>}
    </div>
  );
}
