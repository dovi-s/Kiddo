import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useParams, useSearch } from "wouter";
import { AnimatePresence, motion } from "framer-motion";
import { ArrowLeft, ArrowRight, Building2, Camera, ChevronDown, CreditCard, DollarSign, Gift, ImagePlus, Link as LinkIcon, Lock, Mic, MicOff, Repeat, Shield, Smartphone, Trash2, TrendingUp, Video, Wallet } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Logo } from "@/components/ui/logo";
import { StockLogo } from "@/components/ui/stock-logo";
import { GoalCard } from "@/components/ui/premium-themes";
import { RichText } from "@/components/ui/rich-text-editor";
import { TrustMicroStrip } from "@/components/ui/ux-foundations";
import { ThinkingOrb } from "@/components/ui/gemini";
import { haptic } from "@/lib/haptics";
import { capFirst } from "@/lib/format-name";
import { useScrollResetOnChange } from "@/lib/scroll-to-element";
import { trackReferralEvent as trackAcquisitionEvent } from "@/lib/acquisition";
import { getPronouns } from "@/lib/pronouns";
import { KIDDO_GIFT_ADD_ONS, calculateKoraContributionFee, getGiftAddOn, type GiftAddOnId } from "@shared/monetization";
import { MemoryMediaPicker, EMPTY_MEMORY_MEDIA, type MemoryMediaValue } from "@/components/MemoryMediaPicker";
import { ReminderAndAskParentsCard } from "@/components/ReminderAndAskParentsCard";
import { SponsorPlusCard } from "@/components/SponsorPlusCard";

const AMOUNTS = [25, 50, 100, 250];
const PAGE_MAX = "kiddo-canvas px-4 sm:px-5";
const STOCK_PICKS = [
  { symbol: "DIS", name: "Disney", price: 106.42, tagline: "for the magic" },
  { symbol: "AAPL", name: "Apple", price: 214.38, tagline: "for the future" },
  { symbol: "NKE", name: "Nike", price: 92.14, tagline: "for the ones who go for it" },
  { symbol: "SBUX", name: "Starbucks", price: 89.63, tagline: "for the everyday wins" },
  { symbol: "NFLX", name: "Netflix", price: 612.9, tagline: "for the storytellers" },
  { symbol: "AMZN", name: "Amazon", price: 184.85, tagline: "for the builders" },
  { symbol: "GOOGL", name: "Google", price: 172.63, tagline: "for the curious ones" },
  { symbol: "SPOT", name: "Spotify", price: 618.92, tagline: "for the music lovers" },
  { symbol: "RBLX", name: "Roblox", price: 37.44, tagline: "for the gamers" },
] as const;
type StockPick = Omit<(typeof STOCK_PICKS)[number], "price"> & {
  price: number;
  quoteSource?: string;
  quoteAsOf?: string;
  isEstimate?: boolean;
};
type MarketQuoteResponse = {
  quotes: Array<{
    symbol: string;
    name?: string;
    price: number;
    source?: string;
    asOf?: string;
    isEstimate?: boolean;
  }>;
};
// Payment methods. Order matters — Apple Pay first (fastest, "Recommended"
// label below), card second (universal fallback), Cash App + PayPal in
// the digital-wallet middle (Cash App skews younger, PayPal skews older
// — together they cover the demographics card alone misses), bank last
// (cheapest fee, slowest settlement). The PayPal entry is load-bearing
// for the older grandparent demographic — many will refuse to type a
// card number on a website they've never heard of but will happily click
// "Pay with PayPal" because their info is already there. Stripe processes
// it natively (no new vendor relationship). PayPal's US fee via Stripe
// is 3.49% + $0.49 — slightly higher than card, but the audience gap it
// covers more than justifies the spread.
const PAYMENT_METHODS = [
  { id: "apple_pay", label: "Apple Pay / Google Pay", icon: Smartphone, desc: "Fastest way to gift", feeLine: "~2.9% + $0.30" },
  { id: "card", label: "Credit or debit card", icon: CreditCard, desc: "Visa, Mastercard, Amex, Discover", feeLine: "~2.9% + $0.30" },
  { id: "cashapp", label: "Cash App", icon: DollarSign, desc: "Pay with Cash App balance", feeLine: "~2.9% + $0.30" },
  { id: "paypal", label: "PayPal", icon: Wallet, desc: "Pay with your PayPal account", feeLine: "~3.49% + $0.49" },
  { id: "bank", label: "Bank transfer (ACH)", icon: Building2, desc: "Lower fees, slower settlement", feeLine: "0.8% (max $5)" },
] as const;

type GiftStep = "landing" | "amount" | "preview" | "payment";
type ExecutionModel = "auto" | "pick" | "family";
type PaymentMethod = (typeof PAYMENT_METHODS)[number]["id"];
type MemoryAttachmentMode = "none" | "photo" | "video" | "voice";

interface FeeData {
  processingFee: number;
  koraFee: number;
  koraBaseFee?: number;
  koraVariableFee?: number;
  koraLargeGiftFee?: number;
  totalCharge: number;
  netToFund: number;
  coverageLabel?: string;
  processingFeeRate?: string;
  stripeFeeExplanation?: string;
  koraFeeExplanation?: string;
  koraBaseFeeExplanation?: string;
  koraLargeGiftExplanation?: string;
  annualAumFeeExplanation?: string;
  giftAddOnFee?: number;
  giftAddOnId?: GiftAddOnId;
  giftAddOnName?: string;
}

interface PublicEventData {
  event: {
    id: string;
    slug?: string;
    name: string;
    description?: string;
    imageUrl?: string;
    eventType?: string;
    eventCategory?: string;
    theme?: string;
    eventDate?: string | null;
    goalAmount?: number;
    giftVolume?: number;
    giftCount?: number;
    isPermanent?: boolean;
    status?: string;
  };
  fund: {
    id: string;
    slug?: string;
    name: string;
    recipientFirstName?: string;
    investmentStrategy?: string;
    status?: string;
    defaultMode?: "managed" | "stock" | "cash";
    defaultTicker?: string;
    allowGifterStockPick?: boolean | string | number;
    allowGifterCashGift?: boolean | string | number;
    investmentPreferences?: {
      defaultMode?: "managed" | "stock" | "cash";
      managedStrategy?: string;
      defaultTicker?: string;
      allowGifterStockPick?: boolean | string | number;
      allowGifterCashGift?: boolean | string | number;
    };
    creatorFirstName?: string | null;
    childPhotoUrl?: string | null;
    pronoun?: string | null;
    // Pricing-v3: gifter UI uses this to decide whether to show the
    // recurring toggle (true → Plus/Family fund) or the reminder-only
    // path with a "ask parents to enable" CTA (false → Free fund).
    // NEVER expose as "the parent's plan" to the gifter.
    recurringSupported?: boolean;
  };
  recentGifters?: Array<{
    name: string;
    amount: number;
    ticker?: string | null;
    tickerName?: string | null;
    executionModel?: string | null;
  }>;
  availability?: {
    canCheckout: boolean;
    fund?: { state: string; canCheckout: boolean; title: string; message: string };
    event?: { state: string; canCheckout: boolean; title: string; message: string; goalReached?: boolean; eventDatePassed?: boolean } | null;
  };
  permanentEventSlug?: string | null;
  activeEvents?: Array<{ name: string; slug: string; eventType?: string | null }>;
  giftCount: number;
  yearsUntil18?: number;
}

const coerceBoolean = (value: unknown) => {
  if (typeof value === "boolean") return value;
  if (typeof value === "number") return value !== 0;
  if (typeof value === "string") {
    const normalized = value.trim().toLowerCase();
    if (normalized === "true") return true;
    if (normalized === "false") return false;
    if (normalized === "1" || normalized === "yes" || normalized === "on" || normalized === "t") return true;
    if (normalized === "0" || normalized === "no" || normalized === "off" || normalized === "f") return false;
  }
  return false;
};

const readBooleanFlag = (source: Record<string, unknown> | undefined, keys: string[]) => {
  if (!source) return false;
  for (const key of keys) {
    if (key in source) {
      return coerceBoolean(source[key]);
    }
  }
  return false;
};

const compoundGrowth = (amount: number, rate: number, years: number) =>
  Math.round(amount * Math.pow(1 + rate, years));

const readFileAsDataUrl = (file: File) =>
  new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ""));
    reader.onerror = () => reject(new Error("Could not read that file."));
    reader.readAsDataURL(file);
  });

const getStrategyLabel = (strategy?: string | null) => {
  const normalized = String(strategy || "").toLowerCase();
  if (normalized === "balanced") return "Steady & Balanced";
  if (normalized === "conservative") return "Conservative Mix";
  if (normalized === "custom") return "Custom ETF Mix";
  return "Growth Mix";
};

const getDefaultModeLabel = (mode?: string | null) => {
  const normalized = String(mode || "").toLowerCase();
  if (normalized === "stock") return "Specific stock";
  if (normalized === "cash") return "Cash until invested";
  return "Automatically invested in real stocks";
};

const getSuggestedStock = (eventType?: string, themeId?: string) => {
  const type = String(eventType || "").toLowerCase();
  const theme = String(themeId || "").toLowerCase();
  if (theme.includes("sport")) return STOCK_PICKS.find((s) => s.symbol === "NKE") || STOCK_PICKS[0];
  if (theme.includes("tech")) return STOCK_PICKS.find((s) => s.symbol === "AAPL") || STOCK_PICKS[0];
  if (type === "holiday" || type === "christmas") return STOCK_PICKS.find((s) => s.symbol === "AMZN") || STOCK_PICKS[0];
  return STOCK_PICKS.find((s) => s.symbol === "DIS") || STOCK_PICKS[0];
};

export default function GiftCheckout() {
  const { fund: fundSlug, event: eventSlug } = useParams<{ fund: string; event?: string }>();
  const searchString = useSearch();
  const [step, setStep] = useState<GiftStep>("landing");
  useScrollResetOnChange(step);
  const [selectedAmount, setSelectedAmount] = useState(50);
  const [showCustom, setShowCustom] = useState(false);
  const [customAmount, setCustomAmount] = useState("");
  const [executionModel, setExecutionModel] = useState<ExecutionModel>("auto");
  const [selectedStock, setSelectedStock] = useState<string | null>(null);
  const [senderName, setSenderName] = useState("");
  // Explicit anonymous flag — replaces the previous infer-from-blank
  // pattern. When true, sender name is hidden from every public surface
  // (the social-proof carousel especially) and from the family Memory
  // Book name byline. See feedback_anonymous_as_explicit_flag.md.
  const [isAnonymous, setIsAnonymous] = useState(false);
  const [senderEmail, setSenderEmail] = useState("");
  const [message, setMessage] = useState("");
  const [memoryAttachmentMode, setMemoryAttachmentMode] = useState<MemoryAttachmentMode>("none");
  const [photoUrl, setPhotoUrl] = useState("");
  const [videoUrl, setVideoUrl] = useState("");
  const [audioUrl, setAudioUrl] = useState("");
  const [isRecording, setIsRecording] = useState(false);
  const [recordingSeconds, setRecordingSeconds] = useState(0);
  const [uploadingMemoryMedia, setUploadingMemoryMedia] = useState<MemoryAttachmentMode | null>(null);
  const [memoryMediaError, setMemoryMediaError] = useState<string | null>(null);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>("apple_pay");
  const [giftAddOn, setGiftAddOn] = useState<GiftAddOnId>("none");
  const coverFees = true;
  const [showFeeDetails, setShowFeeDetails] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [payError, setPayError] = useState<string | null>(null);
  // Recurring gift state — Tier-1 deferred work, restored 2026-05-21 per
  // project_gifter_recurring_restoration.md. Three new fields:
  //   isRecurring         — toggle on the amount step
  //   recurringFrequency  — "monthly" default (only frequency v1 ships)
  //   recurringPassword   — inline account creation per locked Decision A
  // The senderEmail field already exists; we reuse it as the account
  // email so the gifter doesn't enter their address twice.
  const [isRecurring, setIsRecurring] = useState(false);
  const [recurringFrequency, setRecurringFrequency] = useState<"weekly" | "monthly" | "yearly">("monthly");
  const [recurringPassword, setRecurringPassword] = useState("");
  const viewTrackedRef = useRef(false);
  const trackedStepViewsRef = useRef<Set<GiftStep>>(new Set());
  const photoInputRef = useRef<HTMLInputElement>(null);
  const videoInputRef = useRef<HTMLInputElement>(null);
  const audioRecorderRef = useRef<MediaRecorder | null>(null);
  const audioTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const activeAmount = showCustom && customAmount ? parseFloat(customAmount) : selectedAmount;
  const isValidAmount = Number.isFinite(activeAmount) && activeAmount >= 5;

  const { data: eventData, isLoading: eventLoading } = useQuery<PublicEventData>({
    queryKey: ["public-event", eventSlug, fundSlug],
    queryFn: async () => {
      if (eventSlug) {
        const res = await fetch(`/api/public/events/${eventSlug}`);
        if (!res.ok) throw new Error("Event not found");
        return res.json();
      }
      const res = await fetch(`/api/public/funds/${fundSlug}`);
      if (!res.ok) throw new Error("Fund not found");
      const fundData = await res.json();
      return { event: { id: fundData.permanentEventId || "", name: "Gift anytime", giftCount: fundData.giftCount ?? 0 }, fund: fundData.fund, giftCount: fundData.giftCount ?? 0, recentGifters: (fundData.recentGifters ?? []) as Array<{ name: string; amount: number; ticker?: string | null; tickerName?: string | null; executionModel?: string | null }>, activeEvents: fundData.activeEvents || [], permanentEventSlug: fundData.permanentEventSlug || null };
    },
    enabled: !!(eventSlug || fundSlug),
  });

  // If URL was UUID-based (from old share links), self-correct to slug URL
  useEffect(() => {
    if (!eventData) return;
    const uuidRe = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    const realFundSlug = eventData?.fund?.slug;
    const realEventSlug = eventData?.event?.slug || null;
    if (!realFundSlug) return;
    if (uuidRe.test(fundSlug || "") || (eventSlug && uuidRe.test(eventSlug))) {
      const corrected = realEventSlug ? `/${realFundSlug}/${realEventSlug}` : `/${realFundSlug}`;
      window.history.replaceState(null, "", corrected);
    }
  }, [eventData]);

  const [countdown, setCountdown] = useState<{ days: number; hours: number; mins: number } | null>(null);
  useEffect(() => {
    const dateStr = eventData?.event?.eventDate;
    if (!dateStr) { setCountdown(null); return; }
    const compute = () => {
      // Parse robustly. Server may return a plain "YYYY-MM-DD" date OR a
      // full ISO timestamp like "2026-05-29T12:00:00.000Z". Splitting on
      // "-" used to leave the day-segment as "29T12:00..." which parsed
      // to NaN and propagated into "NaN Days : NaN Hours : NaN Mins" on
      // the gifter checkout page. Date constructor handles both.
      const target = new Date(String(dateStr));
      const targetMs = target.getTime();
      // Bail to a null countdown (hides the strip cleanly) on any of:
      // 1) unparseable date (NaN), 2) date in the past — "the event already
      // happened" should never count down or count up; the gifter still
      // sees the page, just without an urgency timer.
      if (!Number.isFinite(targetMs)) { setCountdown(null); return; }
      const diff = targetMs - Date.now();
      if (diff <= 0) { setCountdown(null); return; }
      setCountdown({
        days: Math.max(0, Math.floor(diff / 86400000)),
        hours: Math.max(0, Math.floor((diff % 86400000) / 3600000)),
        mins: Math.max(0, Math.floor((diff % 3600000) / 60000)),
      });
    };
    compute();
    const t = setInterval(compute, 60000);
    return () => clearInterval(t);
  }, [eventData?.event?.eventDate]);

  const recipientName = capFirst(eventData?.fund?.recipientFirstName) || eventData?.fund?.name || "Recipient";
  const recipientLooksLikeFund = /\bfund\b/i.test(recipientName);
  const destinationFundLabel = recipientLooksLikeFund ? recipientName : `${recipientName}'s fund`;

  // Echo the projection from a "Share Emma's potential" link. When the parent shared from
  // the Projection page, the URL carries ?potential=&age=(&monthly=&rate=), and we surface
  // a warm banner at the top so the gift flow tells the SAME story the parent texted —
  // not a generic "send a gift" landing.
  const potentialFromShare = useMemo(() => {
    const params = new URLSearchParams(searchString || "");
    const potentialNum = Number(params.get("potential"));
    const ageNum = Number(params.get("age"));
    if (!Number.isFinite(potentialNum) || potentialNum <= 0) return null;
    if (!Number.isFinite(ageNum) || ageNum <= 0) return null;
    const monthlyNum = Number(params.get("monthly"));
    const rateNum = Number(params.get("rate"));
    return {
      potential: Math.round(potentialNum),
      age: Math.round(ageNum),
      monthly: Number.isFinite(monthlyNum) && monthlyNum > 0 ? Math.round(monthlyNum) : 0,
      ratePct: Number.isFinite(rateNum) && rateNum > 0 ? Math.round(rateNum * 100) : null,
    };
  }, [searchString]);
  const eventThemeId = eventData?.event?.theme || "classic";
  const themeHeroBg: Record<string, string> = {
    midnight: "bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900",
    warm:     "bg-gradient-to-br from-amber-800 via-orange-700 to-rose-800",
    ocean:    "bg-gradient-to-br from-sky-800 via-cyan-700 to-teal-800",
    sunset:   "bg-gradient-to-br from-rose-800 via-orange-700 to-amber-700",
    forest:   "bg-gradient-to-br from-emerald-800 via-green-700 to-teal-800",
    classic:  "bg-[hsl(var(--kiddo-evergreen))]",
  };
  const heroBg = themeHeroBg[eventThemeId] ?? "bg-[hsl(var(--kiddo-evergreen))]";
  const giftCount = eventData?.event?.giftCount ?? eventData?.giftCount ?? 0;
  const recentGifters: Array<{
    name: string;
    amount: number;
    ticker?: string | null;
    tickerName?: string | null;
    executionModel?: string | null;
  }> = eventData?.recentGifters ?? [];
  const childPhotoUrl = eventData?.fund?.childPhotoUrl ?? null;
  const goalAmount = eventData?.event?.goalAmount ? parseFloat(String(eventData.event.goalAmount)) : undefined;
  const giftVolume = parseFloat(String(eventData?.event?.giftVolume ?? 0));
  const fundId = eventData?.fund?.id;
  const eventId = eventData?.event?.id;
  const publicAvailability = eventData?.availability;
  const fundAvailability = publicAvailability?.fund;
  const eventAvailability = publicAvailability?.event;
  const canCheckoutOnThisPage = publicAvailability?.canCheckout !== false;
  const fallbackGiftPath = eventSlug && fundSlug ? `/${fundSlug}` : null;
  const quoteSymbols = useMemo(() => STOCK_PICKS.map((stock) => stock.symbol).join(","), []);
  const { data: marketQuoteData, isError: quotesError, isSuccess: quotesLoaded } = useQuery<MarketQuoteResponse>({
    queryKey: ["market-quotes", quoteSymbols],
    queryFn: async () => {
      const res = await fetch(`/api/market/quotes?symbols=${encodeURIComponent(quoteSymbols)}`);
      if (!res.ok) throw new Error("Could not load quote estimates");
      return res.json();
    },
    staleTime: 60_000,
    retry: 1,
  });
  const usingFallbackPrices = quotesError || (!quotesLoaded && !marketQuoteData);
  const quoteBySymbol = useMemo(() => {
    const rows = new Map<string, MarketQuoteResponse["quotes"][number]>();
    for (const quote of marketQuoteData?.quotes || []) {
      rows.set(quote.symbol.toUpperCase(), quote);
    }
    return rows;
  }, [marketQuoteData]);
  const stockPicks = useMemo<StockPick[]>(() => (
    STOCK_PICKS.map((stock) => {
      const quote = quoteBySymbol.get(stock.symbol);
      return {
        ...stock,
        price: quote?.price || stock.price,
        quoteSource: quote?.source,
        quoteAsOf: quote?.asOf,
        isEstimate: quote?.isEstimate ?? true,
      };
    })
  ), [quoteBySymbol]);
  const suggestedStockSeed = useMemo(() => getSuggestedStock(eventData?.event?.eventType, eventThemeId), [eventData?.event?.eventType, eventThemeId]);
  const suggestedStock = stockPicks.find((stock) => stock.symbol === suggestedStockSeed.symbol) || suggestedStockSeed;
  const preferenceBag = eventData?.fund?.investmentPreferences;
  const familyDefaultMode =
    preferenceBag?.defaultMode ||
    eventData?.fund?.defaultMode ||
    "managed";
  const familyManagedStrategy = eventData?.fund?.investmentPreferences?.managedStrategy || eventData?.fund?.investmentStrategy || "growth";
  const familyDefaultTicker =
    preferenceBag?.defaultTicker ||
    eventData?.fund?.defaultTicker ||
    suggestedStock.symbol;
  const familyDefaultStock = stockPicks.find((stock) => stock.symbol === familyDefaultTicker) || suggestedStock;
  const allowGifterStockPick =
    readBooleanFlag(preferenceBag as Record<string, unknown> | undefined, [
      "allowGifterStockPick",
      "allow_gifter_stock_pick",
      "gifterStockPick",
      "allowStockPick",
    ]) ||
    readBooleanFlag(eventData?.fund as Record<string, unknown> | undefined, [
      "allowGifterStockPick",
      "allow_gifter_stock_pick",
      "gifterStockPick",
      "allowStockPick",
    ]);
  const allowGifterCashGift =
    readBooleanFlag(preferenceBag as Record<string, unknown> | undefined, [
      "allowGifterCashGift",
      "allow_gifter_cash_gift",
      "gifterCashGift",
      "allowCashGift",
    ]) ||
    readBooleanFlag(eventData?.fund as Record<string, unknown> | undefined, [
      "allowGifterCashGift",
      "allow_gifter_cash_gift",
      "gifterCashGift",
      "allowCashGift",
    ]);
  const hasExecutionOverrides = allowGifterStockPick || allowGifterCashGift;
  const previewStock = executionModel === "pick"
    ? (stockPicks.find((stock) => stock.symbol === selectedStock) || suggestedStock)
    : familyDefaultMode === "stock"
      ? familyDefaultStock
      : suggestedStock;
  const yearsUntil18 = eventData?.yearsUntil18 ?? 18;
  const fundPronouns = getPronouns(eventData?.fund?.pronoun);
  // State-specific UTMA majority age (18 default, 21 in CA/KY/IN, etc).
  // The gifter-facing projection copy below uses this for "when {child}
  // turns {N}" framing. The variable name `yearsUntil18` stays for
  // stability — its VALUE is already majority-aware (server computes from
  // fund.majorityAge).
  const fundMajorityAge = Number((eventData?.fund as any)?.majorityAge) || 18;
  const strategyLabel = getStrategyLabel(familyManagedStrategy);
  const defaultModeLabel = getDefaultModeLabel(familyDefaultMode);
  const availableExecutionOptions = [
    "auto",
    ...(allowGifterStockPick ? (["pick"] as const) : []),
    ...(allowGifterCashGift ? (["family"] as const) : []),
  ];

  useEffect(() => {
    if (executionModel === "pick" && !selectedStock) setSelectedStock(suggestedStock.symbol);
  }, [executionModel, selectedStock, suggestedStock.symbol]);

  const canUseStockPicker = familyDefaultMode === "stock" || allowGifterStockPick;

  useEffect(() => {
    if (executionModel === "pick" && !canUseStockPicker) setExecutionModel("auto");
    if (executionModel === "family" && !allowGifterCashGift) setExecutionModel("auto");
  }, [allowGifterCashGift, canUseStockPicker, executionModel]);

  const { data: feeData } = useQuery<FeeData>({
    queryKey: ["fees", fundSlug, eventSlug, activeAmount, coverFees, paymentMethod, giftAddOn],
    queryFn: async () => {
      const res = await fetch("/api/stripe/calculate-fees", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ amount: activeAmount, coverFees, eventSlug, fundSlug, paymentMethod, giftAddOn }),
      });
      if (!res.ok) throw new Error("Failed to calculate fees");
      return res.json();
    },
    enabled: isValidAmount,
    staleTime: 5000,
  });

  const fallbackPlan = feeData?.coverageLabel?.toLowerCase().includes("legacy")
    ? "legacy"
    : feeData?.coverageLabel?.toLowerCase().includes("family")
    ? "family"
    : feeData?.coverageLabel?.toLowerCase().includes("kiddo plus") || feeData?.coverageLabel?.toLowerCase().includes("kiddo+")
      ? "starter"
      : feeData?.coverageLabel?.toLowerCase().includes("trial")
        ? "trial"
        : "free";
  const fallbackKoraFee = calculateKoraContributionFee(activeAmount, fallbackPlan);
  // Local fee fallback used while the server fee-estimate query is
  // in-flight. Mirrors stripeService.calculateFees server-side: bank gets
  // ACH (0.8% capped at $5), PayPal gets PayPal's higher-rail rate
  // (3.49% + $0.49), everything else (card / Apple Pay / Cash App) shares
  // the standard 2.9% + $0.30 Stripe card pricing.
  const processingFee = feeData?.processingFee ?? (
    paymentMethod === "bank"
      ? Math.min(5, activeAmount * 0.008)
      : paymentMethod === "paypal"
        ? activeAmount * 0.0349 + 0.49
        : activeAmount * 0.029 + 0.3
  );
  const platformBaseFee = feeData?.koraBaseFee ?? fallbackKoraFee.flatComponent;
  const variableKoraFee = feeData?.koraVariableFee ?? fallbackKoraFee.variableComponent;
  const totalKoraFee = feeData?.koraFee ?? fallbackKoraFee.total;
  const selectedGiftAddOn = getGiftAddOn(giftAddOn);
  const giftAddOnFee = feeData?.giftAddOnFee ?? selectedGiftAddOn.price;
  const totalFees = processingFee + totalKoraFee + giftAddOnFee;
  const totalCharge = feeData?.totalCharge ?? (activeAmount + totalFees);
  const netToFund = feeData?.netToFund ?? activeAmount;
  const achSavings = Math.max(0, activeAmount * 0.029 + 0.3 - Math.min(5, activeAmount * 0.008));
  const hasValidExecutionChoice = executionModel !== "pick" || !!selectedStock;
  const isEmailValid = !senderEmail.trim() || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(senderEmail.trim());
  // Recurring gifts MUST have an email: the server creates a gifter
  // account for cancellation, and the recurring worker emails the
  // gifter on each charge. Without email the server returns 400 and
  // the user sees a confusing post-submit error. Block the Pay button
  // instead so the requirement is enforced at the UI level. User
  // flagged this 2026-05-23 after hitting the 400.
  const hasRecurringEmail = !isRecurring || (senderEmail.trim().length > 0 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(senderEmail.trim()));
  const canSubmit = isValidAmount && hasValidExecutionChoice && isEmailValid && hasRecurringEmail;
  const hasMemoryAttachment = Boolean(photoUrl.trim() || videoUrl.trim() || audioUrl.trim());
  const referralCode = fundId
    ? `gift:${fundId}${eventId ? `:${eventId}` : ""}`
    : `gift:${fundSlug}${eventSlug ? `:${eventSlug}` : ""}`;

  const trackGiftEvent = (
    action: "visit" | "cta_click" | "checkout_start" | "gift_link_opened" | "gift_amount_selected" | "gift_payment_started",
    channel: string,
    metadata?: Record<string, unknown>,
  ) => {
    trackAcquisitionEvent({
      refCode: referralCode,
      fundId: fundId || null,
      eventId: eventId || null,
      action,
      channel,
      metadata: {
        fundSlug,
        eventSlug: eventSlug || null,
        ...metadata,
      },
    });
  };

  // Derived execution model - hoisted above useEffect hooks to satisfy TS block-scoping rules
  const effectiveExecutionModel: ExecutionModel =
    executionModel === "auto"
      ? familyDefaultMode === "stock"
        ? "pick"
        : familyDefaultMode === "cash"
          ? "family"
          : "auto"
      : executionModel;
  const effectiveSelectedTicker = effectiveExecutionModel === "pick"
    ? executionModel === "pick"
      ? selectedStock
      : familyDefaultStock.symbol
    : null;
  const isFamilyDefaultStockSelected =
    familyDefaultMode === "stock" &&
    effectiveExecutionModel === "pick" &&
    effectiveSelectedTicker === familyDefaultStock.symbol;

  const uploadMemoryMedia = async (file: File, mode: Exclude<MemoryAttachmentMode, "none">) => {
    if (!fundId) return;
    setMemoryMediaError(null);
    if (mode === "photo" && !file.type.startsWith("image/")) {
      setMemoryMediaError("Choose a photo file.");
      return;
    }
    if (mode === "video" && !file.type.startsWith("video/")) {
      setMemoryMediaError("Choose a video file.");
      return;
    }
    const maxBytes = mode === "photo" ? 3 * 1024 * 1024 : 25 * 1024 * 1024;
    if (file.size > maxBytes) {
      setMemoryMediaError(mode === "photo" ? "Photo too large. Use one under 3MB." : "Video too large. Use one under 25MB.");
      return;
    }

    setMemoryAttachmentMode(mode);
    setUploadingMemoryMedia(mode);
    try {
      const dataUrl = await readFileAsDataUrl(file);
      const res = await fetch(`/api/public/funds/${fundId}/memory/upload-${mode}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ dataUrl }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || `Could not upload ${mode}.`);
      if (mode === "photo") setPhotoUrl(data.url || "");
      if (mode === "video") setVideoUrl(data.url || "");
      haptic("success");
    } catch (error) {
      setMemoryMediaError(error instanceof Error ? error.message : `Could not upload ${mode}.`);
    } finally {
      setUploadingMemoryMedia(null);
    }
  };

  const clearMemoryAttachment = () => {
    setPhotoUrl("");
    setVideoUrl("");
    setAudioUrl("");
    if (isRecording) stopVoiceRecording();
    setMemoryAttachmentMode("none");
    setMemoryMediaError(null);
    if (photoInputRef.current) photoInputRef.current.value = "";
    if (videoInputRef.current) videoInputRef.current.value = "";
  };

  const stopVoiceRecording = () => {
    audioRecorderRef.current?.stop();
    if (audioTimerRef.current) clearInterval(audioTimerRef.current);
    setIsRecording(false);
  };

  const startVoiceRecording = async () => {
    if (!fundId) return;
    setMemoryMediaError(null);
    setAudioUrl("");
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mimeType = MediaRecorder.isTypeSupported("audio/webm") ? "audio/webm" : "audio/mp4";
      const recorder = new MediaRecorder(stream, { mimeType });
      const chunks: BlobPart[] = [];
      recorder.ondataavailable = (e) => { if (e.data.size > 0) chunks.push(e.data); };
      recorder.onstop = async () => {
        stream.getTracks().forEach((t) => t.stop());
        const blob = new Blob(chunks, { type: mimeType });
        if (blob.size > 10 * 1024 * 1024) {
          setMemoryMediaError("Voice note too long. Keep it under a couple of minutes.");
          return;
        }
        setUploadingMemoryMedia("voice");
        try {
          const reader = new FileReader();
          reader.onload = async () => {
            const dataUrl = reader.result as string;
            const res = await fetch(`/api/public/funds/${fundId}/memory/upload-audio`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ dataUrl }),
            });
            const data = await res.json().catch(() => ({}));
            if (!res.ok) throw new Error(data?.error || "Could not upload voice note.");
            setAudioUrl(data.url || "");
            haptic("success");
          };
          reader.onerror = () => setMemoryMediaError("Could not read recording.");
          reader.readAsDataURL(blob);
        } catch (err) {
          setMemoryMediaError(err instanceof Error ? err.message : "Could not upload voice note.");
        } finally {
          setUploadingMemoryMedia(null);
        }
      };
      audioRecorderRef.current = recorder;
      recorder.start();
      setIsRecording(true);
      setRecordingSeconds(0);
      audioTimerRef.current = setInterval(() => setRecordingSeconds((s) => s + 1), 1000);
      setMemoryAttachmentMode("voice");
      haptic("selection");
    } catch {
      setMemoryMediaError("Microphone access denied. Allow mic access to record a voice note.");
    }
  };

  useEffect(() => {
    return () => {
      if (audioTimerRef.current) clearInterval(audioTimerRef.current);
      audioRecorderRef.current?.stop();
    };
  }, []);

  useEffect(() => {
    if (!fundId || viewTrackedRef.current) return;
    viewTrackedRef.current = true;
    trackGiftEvent("visit", "gift_page", {
      step: "landing",
      giftCount,
      theme: eventThemeId,
    });
    trackGiftEvent("gift_link_opened", "gift_link_opened_to_amount_selected", {
      baselineEvent: "gift_link_opened",
      step: "landing",
      giftCount,
      theme: eventThemeId,
    });
  }, [eventThemeId, fundId, giftCount]);

  useEffect(() => {
    if (!fundId || trackedStepViewsRef.current.has(step)) return;
    trackedStepViewsRef.current.add(step);
    trackGiftEvent("visit", "gift_step_view", {
      stepViewed: step,
      amount: isValidAmount ? activeAmount : null,
      paymentMethod: step === "payment" ? paymentMethod : null,
      executionModel: step === "preview" || step === "payment" ? effectiveExecutionModel : null,
      selectedStock: step === "preview" || step === "payment" ? effectiveSelectedTicker : null,
    });
  }, [activeAmount, effectiveExecutionModel, effectiveSelectedTicker, fundId, isValidAmount, paymentMethod, step]);

  useEffect(() => {
    const handlePageHide = () => {
      if (!fundId || isSubmitting) return;
      trackGiftEvent("visit", "gift_checkout_exit", {
        stepViewed: step,
        amount: isValidAmount ? activeAmount : null,
        hasEmail: Boolean(senderEmail.trim()),
        hasMessage: Boolean(message.trim()),
        hasMemoryAttachment,
        paymentMethod,
        executionModel: effectiveExecutionModel,
        selectedStock: effectiveSelectedTicker,
      });
    };

    window.addEventListener("pagehide", handlePageHide);
    return () => window.removeEventListener("pagehide", handlePageHide);
  }, [
    activeAmount,
    effectiveExecutionModel,
    effectiveSelectedTicker,
    fundId,
    isSubmitting,
    isValidAmount,
    message,
    hasMemoryAttachment,
    paymentMethod,
    senderEmail,
    step,
  ]);

  const handlePay = async () => {
    if (!canSubmit || !fundId) return;
    haptic("medium");
    setIsSubmitting(true);
    setPayError(null);
    try {
      const paymentMetadata = {
        amount: activeAmount,
        paymentMethod,
        executionModel: effectiveExecutionModel,
        selectedStock: effectiveSelectedTicker,
        giftAddOn,
        coverFees,
      };
      trackGiftEvent("checkout_start", "gift_checkout", paymentMetadata);
      trackGiftEvent("gift_payment_started", "amount_selected_to_payment_started", {
        ...paymentMetadata,
        baselineEvent: "gift_payment_started",
      });
      // Branch on isRecurring: one-time uses the existing
      // /api/stripe/checkout/gift PaymentIntent flow; recurring uses
      // the new /api/stripe/checkout/gift-recurring Subscription flow.
      // Server endpoint contract for recurring includes the account
      // creation fields (email + password) per locked Decision A:
      // the gifter ends with both a Stripe subscription AND a Kiddo
      // gifter account, so they have a stable cancellation surface
      // in the gifter dashboard.
      const endpoint = isRecurring
        ? "/api/stripe/checkout/gift-recurring"
        : "/api/stripe/checkout/gift";
      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fundId,
          eventId: eventId || undefined,
          amount: activeAmount,
          // When the gifter chose anonymous, NEVER send their name even
          // if it's typed (the toggle hides the field but doesn't clear
          // it — defensive belt-and-suspenders here).
          senderName: isAnonymous ? undefined : (senderName.trim() || undefined),
          senderEmail: senderEmail.trim() || undefined,
          isAnonymous,
          message: message.trim() || undefined,
          photoUrl: photoUrl.trim() || undefined,
          videoUrl: videoUrl.trim() || undefined,
          audioUrl: audioUrl.trim() || undefined,
          coverFees,
          paymentMethod,
          executionModel: effectiveExecutionModel,
          selectedTicker: effectiveExecutionModel === "pick" ? effectiveSelectedTicker : undefined,
          giftAddOn,
          // Recurring-only fields. Server ignores when isRecurring is false
          // (i.e., when the endpoint above is the one-time variant).
          isRecurring,
          recurringFrequency: isRecurring ? recurringFrequency : undefined,
          accountPassword: isRecurring ? recurringPassword : undefined,
        }),
      });
      if (!res.ok) {
        const payload = await res.json().catch(() => ({}));
        throw new Error(payload?.message || payload?.error || `Checkout failed (HTTP ${res.status})`);
      }
      const data = await res.json();
      if (data.url) window.location.href = data.url;
    } catch (err: any) {
      console.error("Payment error:", err);
      setPayError(err.message || "Something went wrong. Please try again.");
      trackGiftEvent("cta_click", "gift_payment_error", {
        stepViewed: step,
        amount: activeAmount,
        paymentMethod,
        executionModel: effectiveExecutionModel,
        selectedStock: effectiveSelectedTicker,
        hasMemoryAttachment,
        error: err?.message || "unknown",
      });
      setIsSubmitting(false);
    }
  };

  if (eventLoading) return <div className="kiddo-app-page flex items-center justify-center"><ThinkingOrb size={48} variant="processing" /></div>;

  if (!eventData?.fund?.id) {
    return (
      <div className="kiddo-app-page flex items-center justify-center px-4 py-16">
        <div className="kiddo-card max-w-md w-full p-8 text-center">
          <Logo className="mx-auto text-[hsl(var(--kiddo-evergreen))]" size="sm" />
          <h2 className="mt-5 font-heading text-xl font-semibold text-foreground">This gift link is outdated</h2>
          <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
            This link no longer works. Ask the parent or family member for the updated gift link, or use the fund code to find the page.
          </p>
          <Link href="/gift">
            <Button className="mt-6 w-full h-12 text-base" data-testid="button-find-fund-not-found">
              Find the fund by code
            </Button>
          </Link>
          <Link href="/">
            <Button variant="ghost" className="mt-2 w-full text-sm text-muted-foreground" data-testid="button-home-not-found">
              Back to home
            </Button>
          </Link>
        </div>
      </div>
    );
  }
  if (!canCheckoutOnThisPage) {
    const eventState = eventAvailability?.state;
    const isPausedEvent = eventSlug && eventState === "paused";
    const isClosedEvent = eventSlug && eventState === "closed";
    const fundIsLive = fundAvailability?.canCheckout !== false;
    const eventDisplayName = eventData?.event?.name && eventData.event.name !== "Gift anytime"
      ? eventData.event.name
      : "This event";
    return (
      <div className="kiddo-app-page px-4 py-10">
        <div className="kiddo-card mx-auto max-w-lg p-6 text-center">
          <Logo className="mx-auto text-[hsl(var(--kiddo-evergreen))]" size="sm" />
          {isPausedEvent ? (
            <>
              <p className="mt-5 text-sm font-medium text-muted-foreground">Temporarily paused</p>
              <h1 className="mt-2 font-heading text-2xl font-semibold text-foreground">
                {eventDisplayName} is temporarily offline.
              </h1>
              {fundIsLive && fallbackGiftPath ? (
                <>
                  <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
                    {recipientName}&apos;s fund is still open. Gifts go to the same place: the same investments, the same Memory Book.
                  </p>
                  <Link href={fallbackGiftPath}>
                    <Button className="mt-6 h-12 w-full rounded-2xl text-base font-semibold" data-testid="button-open-fallback-gift-page">
                      <Gift size={16} className="mr-2" />
                      Give to {recipientName}&apos;s fund
                    </Button>
                  </Link>
                  <p className="mt-3 text-xs text-muted-foreground">No occasion needed. The fund is always open.</p>
                </>
              ) : (
                <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
                  {eventAvailability?.message || "Check back soon."}
                </p>
              )}
            </>
          ) : isClosedEvent ? (
            <>
              <p className="mt-5 text-sm font-medium text-muted-foreground">This event has ended</p>
              <h1 className="mt-2 font-heading text-2xl font-semibold text-foreground">
                {eventDisplayName} is no longer accepting gifts.
              </h1>
              {fundIsLive && fallbackGiftPath ? (
                <>
                  <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
                    But {recipientName}&apos;s fund is always open. Gifts go to the same place: the same investments, the same Memory Book.
                  </p>
                  <Link href={fallbackGiftPath}>
                    <Button className="mt-6 h-12 w-full rounded-2xl text-base font-semibold" data-testid="button-open-fallback-gift-page">
                      <Gift size={16} className="mr-2" />
                      Give to {recipientName}&apos;s fund
                    </Button>
                  </Link>
                  <p className="mt-3 text-xs text-muted-foreground">No occasion needed. The fund is permanent.</p>
                </>
              ) : (
                <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
                  {fundAvailability?.message || "The family's gift page is not accepting new gifts right now."}
                </p>
              )}
            </>
          ) : (
            <>
              <p className="mt-5 text-sm font-medium text-[hsl(var(--kiddo-evergreen))]">Gifting unavailable</p>
              <h1 className="mt-2 font-heading text-2xl font-semibold text-foreground">
                {fundAvailability?.title || "This gift page is not taking new gifts right now."}
              </h1>
              <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
                {fundAvailability?.message || "Please ask the family for an updated link."}
              </p>
            </>
          )}
        </div>
      </div>
    );
  }

  const isSavingsGoalEarly = eventData?.event?.eventCategory === 'savings_goal';
  const isOccasionEvent = !isSavingsGoalEarly && !eventData?.event?.isPermanent && !!eventData?.event?.eventType && eventData?.event?.name !== "Gift anytime";

  const allSteps: GiftStep[] = ["landing", "amount", "preview", "payment"];
  const progressSteps: Array<{ key: GiftStep; label: string }> = [
    { key: "amount", label: "Amount" },
    { key: "preview", label: "Preview" },
    { key: "payment", label: "Payment" },
  ];
  // Occasion events skip the amount step: landing → preview → payment (2-step visible flow)
  const occasionProgressSteps: Array<{ key: GiftStep; label: string }> = [
    { key: "preview", label: "Your details" },
    { key: "payment", label: "Payment" },
  ];
  const activeProgressSteps = isOccasionEvent ? occasionProgressSteps : progressSteps;
  const progressIndex = activeProgressSteps.findIndex((entry) => entry.key === step);
  const currentVisibleStepNumber = progressIndex >= 0 ? progressIndex + 1 : 0;
  const shareTitle = eventData.event.name && eventData.event.name !== "Gift anytime" ? eventData.event.name : recipientLooksLikeFund ? recipientName : `${recipientName}'s fund`;
  const shareDescription = eventData.event.description?.trim() || `Turn a thoughtful gift into a real investment for ${recipientName}.`;
  const previewShares = activeAmount > 0 ? activeAmount / previewStock.price : 0;
  const amountStepAnchorStock = familyDefaultMode === "stock" ? familyDefaultStock : suggestedStock;
  const amountStepChildLabel = recipientLooksLikeFund ? "this child" : recipientName;
  const selectedExecutionLabel =
    executionModel === "pick"
      ? `Choosing ${previewStock.name}`
      : executionModel === "family"
        ? "Sending to cash for the family to invest later"
        : familyDefaultMode === "managed"
          ? `Goes into real stocks using the family's ${strategyLabel} mix`
          : familyDefaultMode === "stock"
            ? `Following the family's default stock: ${familyDefaultStock.name}`
            : "Following the family's cash default";
  const provenanceName = recipientLooksLikeFund ? "this child's" : `${recipientName}'s`;
  const giftProvenance = `Invested in ${provenanceName} future with Kiddo.`;
  const checkoutTrustLine = "DriveWealth, LLC is a registered broker-dealer, Member FINRA/SIPC. Securities protected up to $500,000 against brokerage failure. Not a protection against market losses. sipc.org";
  // Trust-line JSX variant with inline anchor links. Used in the
  // payment-step trust card + order-summary "Where the money goes"
  // card. Sophisticated gifters (Five Towns persona) verify custody
  // gravitas by opening the broker's site directly — making the
  // links clickable closes that loop without forcing them to type
  // the URL. Both anchors open in a new tab so the gifter doesn't
  // lose checkout state. Locked 2026-05-19 per the gifter trust-signal
  // audit. The string variant above stays for any non-JSX surface
  // (logs, copy reference, etc).
  const checkoutTrustLineJsx = (
    <>
      <a
        href="https://drivewealth.com"
        target="_blank"
        rel="noopener noreferrer"
        className="font-semibold text-[hsl(var(--kiddo-evergreen))] underline underline-offset-2 hover:text-[hsl(var(--kiddo-evergreen-deep))]"
      >
        DriveWealth, LLC
      </a>
      {" is a registered broker-dealer, Member FINRA/SIPC. Securities protected up to $500,000 against brokerage failure. Not a protection against market losses. "}
      <a
        href="https://www.sipc.org"
        target="_blank"
        rel="noopener noreferrer"
        className="font-semibold text-[hsl(var(--kiddo-evergreen))] underline underline-offset-2 hover:text-[hsl(var(--kiddo-evergreen-deep))]"
      >
        sipc.org
      </a>
    </>
  );
  const checkoutPreviewStock =
    effectiveExecutionModel === "pick"
      ? (stockPicks.find((stock) => stock.symbol === effectiveSelectedTicker) || previewStock)
      : familyDefaultMode === "stock"
        ? familyDefaultStock
        : null;
  const checkoutEstimatedShares = checkoutPreviewStock?.price ? netToFund / checkoutPreviewStock.price : 0;
  const checkoutEstimatedSharesLabel =
    checkoutEstimatedShares >= 1
      ? checkoutEstimatedShares.toFixed(3)
      : checkoutEstimatedShares > 0
        ? checkoutEstimatedShares.toFixed(5)
        : "0";
  const checkoutInvestmentTitle = checkoutPreviewStock
    ? `${checkoutPreviewStock.name} (${checkoutPreviewStock.symbol})`
    : effectiveExecutionModel === "family"
      ? "Cash for the family to invest"
      : `${strategyLabel} auto-invest`;
  const isSavingsGoal = isSavingsGoalEarly;
  const savingsGoalTypeHeadlines: Record<string, string> = {
    college: `Help ${recipientLooksLikeFund ? "them" : recipientName} get to college.`,
    car: `Help ${recipientLooksLikeFund ? "them" : recipientName} get their first car.`,
    home: `Help ${recipientLooksLikeFund ? "them" : recipientName} buy their first home.`,
    travel: `Help ${recipientLooksLikeFund ? "them" : recipientName} take on the world.`,
    business: `Help ${recipientLooksLikeFund ? "them" : recipientName} start something real.`,
    emergency: `Help ${recipientLooksLikeFund ? "them" : recipientName} build a safety net.`,
  };
  const savingsGoalHeadline = savingsGoalTypeHeadlines[eventData?.event?.eventType || ""] || (recipientLooksLikeFund ? "Help them reach their goal." : `Help ${recipientName} reach their goal.`);
  const landingHeadline = isSavingsGoal ? savingsGoalHeadline : (recipientLooksLikeFund ? "Their future is growing. Add to it." : `${recipientName}'s future is growing. Add to it.`);
  const amountProjection = (() => {
    const amount = activeAmount || 0;
    if (amount < 1) return null;
    const child = amountStepChildLabel;
    const fmt = (n: number) => `$${Math.round(n).toLocaleString()}`;
    const src = fmt(amount);
    const g = (yrs: number) => compoundGrowth(amount, 0.07, yrs);
    // Years from today to milestone ages
    const yTo25 = Math.max(0, yearsUntil18 + 7);
    const yTo30 = Math.max(0, yearsUntil18 + 12);

    if (yearsUntil18 >= 10) {
      // Young child - 18-year projection is exciting enough on its own. The math
      // is the comparison (a $50 gift card stays $50; this $50 becomes ~$X);
      // jamming "More meaningful than a gift card" onto the disclaimer line was
      // mixing honesty with marketing-feel and dulled both. The line-1757 jab
      // below the conversion CTA does the gift-card neutralization work where
      // it's actually load-bearing.
      return {
        headline: `${src} today → ~${fmt(g(yearsUntil18))} when ${child} turns ${fundMajorityAge}.`,
        tagline: "Based on 7% historical returns. Not guaranteed.",
      };
    }
    if (yearsUntil18 >= 4) {
      // Middle - show majority-age value, then nudge toward the bigger number at 25
      const atMajority = fmt(g(yearsUntil18));
      const at25 = yTo25 >= 3 ? fmt(g(yTo25)) : null;
      return {
        headline: `${src} today → ~${atMajority} when ${child} turns ${fundMajorityAge}.${at25 ? ` And if ${fundPronouns.subject} let${fundPronouns.singular ? "s" : ""} it grow to 25? → ~${at25}. 🌱` : ""}`,
        tagline: "Based on 7% historical returns. Not guaranteed.",
      };
    }
    if (yearsUntil18 > 0) {
      // Older child - majority-age number is small; anchor on the post-transfer story
      const atMajority = fmt(g(yearsUntil18));
      const at30 = yTo30 >= 3 ? fmt(g(yTo30)) : null;
      return {
        headline: `${src} today → ~${atMajority} when ${child} turns ${fundMajorityAge}. But at 30? → ~${at30}.`,
        tagline: `Gifts that last don't stop at ${fundMajorityAge}. 🌱 Based on 7% historical returns. Not guaranteed.`,
      };
    }
    // Already 18+ - no "turns 18" framing, just show the long arc
    const at25 = yTo25 >= 3 ? fmt(g(yTo25)) : null;
    const at30 = yTo30 >= 3 ? fmt(g(yTo30)) : null;
    if (!at25 && !at30) return null;
    return {
      headline: at25 && at30
        ? `${src} today → ~${at25} at 25. ~${at30} at 30.`
        : `${src} today → ~${at25 ?? at30} and growing.`,
      tagline: "The best gifts keep compounding. Based on 7% historical returns. Not guaranteed.",
    };
  })();

  const currentOccasion = (() => {
    type OccasionMeta = { emoji: string; headline: string; sub: string; notePlaceholder: string };
    const nm = recipientName;
    const n = String(eventData?.event?.name || "").toLowerCase();
    const cultural: [RegExp, OccasionMeta][] = [
      [/mitzvah/i,                  { emoji: "✡️", headline: `Celebrate ${nm}'s B'nai Mitzvah!`, sub: `A once-in-a-lifetime milestone. These shares grow with ${nm} from today.`, notePlaceholder: `Mazel tov! Leave ${nm} a message...` }],
      [/hanukkah|chanukah/i,        { emoji: "🕎", headline: `Happy Hanukkah, ${nm}!`, sub: `Eight nights of celebration. A lifetime of growth.`, notePlaceholder: `Chag Sameach! Leave ${nm} a message...` }],
      [/quincea/i,                  { emoji: "🌺", headline: `Feliz Quinceañera, ${nm}!`, sub: `Turning 15 is a milestone worth celebrating.`, notePlaceholder: `Leave ${nm} a Quinceañera message...` }],
      [/first communion|communion/i,{ emoji: "✝️", headline: `${nm}'s First Communion`, sub: `A meaningful milestone. A gift that grows.`, notePlaceholder: `Leave ${nm} a blessing...` }],
      [/confirmation/i,             { emoji: "✝️", headline: `${nm}'s Confirmation`, sub: `A step of faith. A gift that keeps growing with them.`, notePlaceholder: `Leave ${nm} a message of faith...` }],
      [/diwali|deepavali/i,         { emoji: "🪔", headline: `Happy Diwali, ${nm}!`, sub: `Light, prosperity, and a gift that compounds for years.`, notePlaceholder: `Happy Diwali! Leave ${nm} a message...` }],
      [/eid/i,                      { emoji: "☪️", headline: `Eid Mubarak, ${nm}!`, sub: `A blessed celebration and a future full of growth.`, notePlaceholder: `Eid Mubarak! Leave ${nm} a message...` }],
      [/lunar new year|chinese new year/i, { emoji: "🏮", headline: `Happy New Year, ${nm}!`, sub: `A new year, a new gift for ${nm}'s future.`, notePlaceholder: `Leave ${nm} a new year message...` }],
      [/kwanzaa/i,                  { emoji: "🕯️", headline: `Happy Kwanzaa, ${nm}!`, sub: `Celebrate the harvest. Give ${nm} something that lasts.`, notePlaceholder: `Leave ${nm} a Kwanzaa message...` }],
    ];
    for (const [re, meta] of cultural) {
      if (re.test(n)) return meta;
    }
    const byType: Record<string, OccasionMeta> = {
      birthday:    { emoji: "🎂", headline: `It's ${nm}'s Birthday!`, sub: `Give ${nm} a gift that actually grows. Real stocks, invested in their name.`, notePlaceholder: `Leave ${nm} a birthday message...` },
      baby_shower: { emoji: "🍼", headline: `Welcome ${nm} to the world!`, sub: `Start them off right with a real investment in their name.`, notePlaceholder: `Leave a warm welcome note...` },
      graduation:  { emoji: "🎓", headline: `Congrats, ${nm}!`, sub: `The best graduation gift grows over time. Start it now.`, notePlaceholder: `Leave ${nm} a congratulations message...` },
      holiday:     { emoji: "🎁", headline: `A Gift for ${nm}'s Future!`, sub: `This season, give something that keeps growing.`, notePlaceholder: `Season's greetings to ${nm}...` },
      just_because:{ emoji: "💚", headline: `Surprise ${nm}!`, sub: `The best kind of gift: one they'll thank you for in 15 years.`, notePlaceholder: `Leave ${nm} a note...` },
    };
    return byType[eventData?.event?.eventType || ""] || { emoji: "🎁", headline: `A gift for ${nm}'s future`, sub: `Give a gift that actually grows. Real stocks, invested in their name.`, notePlaceholder: `Leave ${nm} a note...` };
  })();

  return (
    <div className="kiddo-app-page">
      <header className="sticky top-0 z-50 border-b border-[hsl(var(--kiddo-border))] bg-[hsl(var(--kiddo-cream)/0.94)] backdrop-blur-lg">
        <div className={`${PAGE_MAX} h-14 flex items-center justify-between`}>
          <div className="flex items-center gap-3">
            <Logo size="sm" className="text-[hsl(var(--kiddo-evergreen))]" />
            {step !== "landing" && (
              <button
                type="button"
                className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors"
                onClick={() => {
                  if (isOccasionEvent && step === "preview") { setStep("landing"); return; }
                  setStep((allSteps[Math.max(0, allSteps.indexOf(step) - 1)] || "landing") as GiftStep);
                }}
                data-testid="button-step-back"
              >
                <ArrowLeft size={14} />
                <span>Back</span>
              </button>
            )}
          </div>
          <div className="flex items-center gap-1.5 rounded-full border border-[hsl(var(--kiddo-border))] bg-white/70 px-2.5 py-1.5">
            <Lock size={12} className="text-muted-foreground" />
            <span className="text-xs font-medium text-muted-foreground">Secure checkout</span>
          </div>
        </div>
      </header>

      <main className={`${PAGE_MAX} py-6 md:py-8`}>
        {/* Echoes the "Share Emma's potential" message the parent sent. When the URL
            carries ?potential=&age= params, we lead the gift flow with the same number
            framing instead of dumping the recipient onto a generic checkout. Tells the
            same story they were promised in the text.

            Scoped to step === "landing" only. Once the gifter is on the amount step,
            the per-amount projection ("$50 today → ~$169 when Emma turns 18.") takes
            over — it's gifter-specific and decision-relevant. Showing both at once
            stacks two big projection numbers on the same screen, which reads as
            redundant and dilutes which one the gifter should anchor on. */}
        {potentialFromShare && step === "landing" && (
          <div
            className="mb-6 rounded-2xl p-5 text-white"
            data-testid="banner-from-projection"
            style={{
              background: "linear-gradient(135deg, rgb(26,67,50) 0%, rgb(34,80,60) 50%, rgb(46,94,72) 100%)",
              boxShadow: "0 6px 20px rgba(26,67,50,0.18)",
            }}
          >
            <p className="text-[10px] font-bold uppercase tracking-wide text-white/55 mb-1">
              {recipientName}'s potential
            </p>
            <p className="font-heading text-3xl sm:text-4xl font-bold tabular-nums leading-none" style={{ letterSpacing: "-0.02em" }}>
              {new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(potentialFromShare.potential)}
            </p>
            <p className="mt-1.5 text-sm text-white/85 leading-relaxed">
              by the time {recipientName} is {potentialFromShare.age}
              {potentialFromShare.monthly > 0 ? ` · with ${new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(potentialFromShare.monthly)}/mo` : ""}
              {potentialFromShare.ratePct != null ? ` · ${potentialFromShare.ratePct}%/yr` : ""}
            </p>
            {/* No italic. Italic on product surfaces reads as marketing-voice (per
                feedback_no_marketing_teaser_quotes.md the adjacent rule). The line itself
                still earns its place: it grounds the gift-into-bigger-pool framing. */}
            <p className="mt-3 text-[12.5px] text-white/85 leading-relaxed">
              Your gift compounds with the rest. Every dollar helps {recipientName} get there. 🌱
            </p>
            {/* Disclaimer is intentionally higher-contrast than typical UI fineprint
                (white/75 not white/45) and bumped to 11px. Forward-axis projection rule
                from project_dashboard_chart_scrub.md: the projection number is the
                headline, the "not guaranteed" caveat must read at the same glance, or
                the disclaimer is theater. */}
            <p className="mt-2 text-[11px] text-white/75 leading-relaxed">
              Hypothetical. Based on long-term market averages, not guaranteed.
            </p>
          </div>
        )}
        {step !== "landing" && (
          <div className="kiddo-card mb-6 p-3">
            <div className="flex items-center justify-between text-xs font-semibold text-muted-foreground">
              <span>Step {currentVisibleStepNumber} of {activeProgressSteps.length}</span>
              <span>{activeProgressSteps[progressIndex]?.label}</span>
            </div>
            <div className="mt-3 h-2 overflow-hidden rounded-full bg-muted">
              <motion.div
                className="h-full rounded-full bg-[hsl(var(--kiddo-evergreen))]"
                initial={false}
                animate={{ width: `${Math.max(1, currentVisibleStepNumber) / activeProgressSteps.length * 100}%` }}
                transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
              />
            </div>
          </div>
        )}

        {(fundAvailability?.state === "cash_only" || eventAvailability?.state === "goal_reached" || eventAvailability?.state === "date_passed") && (
          <div className="mb-6 space-y-3">
            {fundAvailability?.state === "cash_only" && (
              <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900" data-testid="banner-fund-cash-only">
                <p className="font-medium">{fundAvailability.title}</p>
                <p className="mt-1 text-amber-800">{fundAvailability.message}</p>
              </div>
            )}
            {(eventAvailability?.state === "goal_reached" || eventAvailability?.state === "date_passed") && (
              <div className="rounded-2xl border border-border/60 bg-card px-4 py-3 text-sm text-foreground" data-testid="banner-event-lifecycle-state">
                <p className="font-medium">{eventAvailability.title}</p>
                <p className="mt-1 text-muted-foreground">{eventAvailability.message}</p>
              </div>
            )}
          </div>
        )}

        <AnimatePresence mode="wait">
          {step === "landing" && (
            <motion.section key="landing" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -12 }} className="space-y-5">

              {/* Event / fund tab switcher REMOVED. The gift checkout is a single-purpose
                  destination — the gifter was sent to a specific link (a fund's "anytime"
                  pool, or a specific event), and switching mid-checkout to a different
                  occasion turns a gift into a navigation puzzle. The gift link IS the
                  context. If a parent wants gifters discovering other occasions, they
                  share the relevant link directly. */}

              {isOccasionEvent ? (
                <>
                  {/* Hero - compact for occasion events */}
                  <div className="kiddo-hero-card overflow-hidden">
                    <div className="relative" style={{ minHeight: 220 }}>
                      {eventData.event.imageUrl ? (
                        <>
                          {(() => {
                            // Apply the parent's saved focal point so the hero
                            // crops to keep their chosen subject in frame at this
                            // surface's specific aspect ratio (~1.7:1). Defaults
                            // to center for legacy events that pre-date focal-
                            // point persistence.
                            const fx = (eventData.event as any).imageFocalX != null ? Number((eventData.event as any).imageFocalX) : 0.5;
                            const fy = (eventData.event as any).imageFocalY != null ? Number((eventData.event as any).imageFocalY) : 0.5;
                            const fxPct = Number.isFinite(fx) ? Math.max(0, Math.min(100, fx * 100)) : 50;
                            const fyPct = Number.isFinite(fy) ? Math.max(0, Math.min(100, fy * 100)) : 50;
                            return (
                              <img
                                src={eventData.event.imageUrl}
                                alt={shareTitle}
                                className="absolute inset-0 h-full w-full object-cover"
                                style={{ objectPosition: `${fxPct}% ${fyPct}%` }}
                              />
                            );
                          })()}
                          <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/30 to-black/10" />
                        </>
                      ) : (
                        <div className={`absolute inset-0 ${heroBg}`} />
                      )}
                      <div className="relative z-10 flex flex-col p-6 text-white" style={{ minHeight: 220 }}>
                        {childPhotoUrl && (
                          <img src={childPhotoUrl} alt={recipientName} className="h-14 w-14 rounded-full border-2 border-white/50 object-cover shadow-xl" />
                        )}
                        <div className="flex-1" />
                        <div>
                          <p className="text-sm font-semibold text-white/80">{eventData.event.name}</p>
                          <h1 className="mt-1 font-heading text-3xl md:text-4xl font-bold leading-tight" data-testid="text-heading">{currentOccasion.headline}</h1>
                          <p className="mt-2 text-sm font-medium text-white/80">{currentOccasion.sub}</p>
                          {giftCount > 0 && (
                            <div className="mt-3 flex items-center gap-2" data-testid="social-proof-gifters">
                              <div className="flex -space-x-1.5">
                                {Array.from({ length: Math.min(giftCount, 5) }).map((_, i) => (
                                  <div key={i} className="flex h-6 w-6 items-center justify-center rounded-full border-2 border-white/30 bg-white/20 backdrop-blur-sm" style={{ zIndex: 5 - i }}>
                                    {recentGifters[i] ? <span className="text-[9px] font-bold text-white">{recentGifters[i].name[0].toUpperCase()}</span> : <span className="text-[9px] text-white/80">♥</span>}
                                  </div>
                                ))}
                                {giftCount > 5 && <div className="flex h-6 w-6 items-center justify-center rounded-full border-2 border-white/30 bg-white/20 backdrop-blur-sm" style={{ zIndex: 0 }}><span className="text-[9px] font-bold text-white">+{giftCount - 5}</span></div>}
                              </div>
                              <span className="text-xs font-medium text-white/75">
                                {giftCount} {giftCount === 1 ? "person has" : "people have"} already given.{goalAmount && goalAmount > giftVolume ? ` $${(goalAmount - giftVolume).toLocaleString()} to go.` : ""}
                              </span>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Countdown — visible only when the event date is in the future */}
                  {countdown && (
                    <div className="kiddo-card p-4 flex items-center justify-center gap-0 text-center">
                      {[{ label: "Days", val: countdown.days }, { label: "Hours", val: countdown.hours }, { label: "Mins", val: countdown.mins }].map(({ label, val }, i) => (
                        <div key={label} className="flex items-center">
                          <div className="px-4">
                            <p className="font-heading text-3xl font-bold text-foreground tabular-nums">{String(val).padStart(2, "0")}</p>
                            <p className="mt-0.5 text-[11px] font-medium text-muted-foreground">{label}</p>
                          </div>
                          {i < 2 && <span className="text-2xl font-bold text-muted-foreground/50 -mt-3">:</span>}
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Past-event reassurance — replaces the countdown when the
                      event date has passed. Without this, a late gifter (someone
                      who got the link last week and just opened it) sees no time
                      context and may quietly assume they're too late. The
                      reassurance reframes: the moment passed, the relationship
                      didn't. The fund is bigger than the date. */}
                  {!countdown && eventData?.event?.eventDate && (() => {
                    const target = new Date(String(eventData.event.eventDate));
                    const targetMs = target.getTime();
                    if (!Number.isFinite(targetMs)) return null;
                    if (targetMs > Date.now()) return null; // future, but countdown was null for some other reason — don't render
                    const passedLabel = target.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
                    // Compute locally — goalAmount + giftVolume are always
                    // present in scope; the server's separate goalReached flag
                    // lives on a different sub-object that isn't typed here.
                    const goalHit = !!(goalAmount && goalAmount > 0 && giftVolume >= goalAmount);
                    return (
                      <div className="kiddo-card p-4 flex items-start gap-3 bg-[hsl(var(--kiddo-cream)/0.6)] border-[hsl(var(--kiddo-gold)/0.30)]">
                        <span className="text-xl shrink-0" aria-hidden="true">{goalHit ? "🌟" : "🌱"}</span>
                        <div className="min-w-0 flex-1">
                          {goalHit ? (
                            <>
                              <p className="text-sm font-semibold text-foreground">
                                {recipientName}&apos;s {shareTitle.toLowerCase().includes(recipientName.toLowerCase()) ? shareTitle : shareTitle} hit its goal.
                              </p>
                              <p className="mt-0.5 text-xs text-muted-foreground leading-relaxed">
                                Still open — every gift keeps growing. The {passedLabel} date passed, the fund didn&apos;t.
                              </p>
                            </>
                          ) : (
                            <>
                              <p className="text-sm font-semibold text-foreground">
                                The {passedLabel} date passed.
                              </p>
                              <p className="mt-0.5 text-xs text-muted-foreground leading-relaxed">
                                Your gift still goes straight to {recipientName}&apos;s fund. Anytime is the right time.
                              </p>
                            </>
                          )}
                        </div>
                      </div>
                    );
                  })()}

                  {/* Goal progress */}
                  {goalAmount && goalAmount > 0 && (
                    <div className="kiddo-card p-4 space-y-2">
                      <div className="flex items-center justify-between text-sm">
                        <span className="font-semibold text-foreground">{shareTitle} goal</span>
                        <span className="font-bold text-[hsl(var(--kiddo-evergreen))]">${giftVolume.toLocaleString()} of ${goalAmount.toLocaleString()}</span>
                      </div>
                      <div className="w-full h-2.5 bg-muted rounded-full overflow-hidden">
                        <motion.div className="h-full rounded-full bg-[hsl(var(--kiddo-evergreen))]" initial={{ width: 0 }} animate={{ width: `${Math.min((giftVolume / goalAmount) * 100, 100).toFixed(1)}%` }} transition={{ duration: 1, ease: [0.34, 1.56, 0.64, 1] }} />
                      </div>
                      <p className="text-xs text-muted-foreground">{giftCount} {giftCount === 1 ? "person" : "people"} gifted · ${(goalAmount - giftVolume).toLocaleString()} to go</p>
                    </div>
                  )}

                  {/* Amount + note + CTA */}
                  <div className="kiddo-card p-5 space-y-4">
                    <p className="font-semibold text-foreground">Gift {recipientName}</p>
                    <div className="grid grid-cols-4 gap-2">
                      {AMOUNTS.map((amt) => (
                        <button
                          key={amt}
                          type="button"
                          className={`tap-bounce rounded-xl border py-3 text-sm font-bold transition-colors ${!showCustom && selectedAmount === amt ? "border-[hsl(var(--kiddo-evergreen))] bg-[hsl(var(--kiddo-evergreen))] text-white" : "border-border bg-muted/60 text-foreground hover:bg-muted"}`}
                          onClick={() => { haptic("selection"); setSelectedAmount(amt); setShowCustom(false); setCustomAmount(""); }}
                        >
                          ${amt}
                        </button>
                      ))}
                    </div>
                    <button type="button" className={`w-full rounded-xl border px-4 py-2.5 text-sm text-left transition-colors ${showCustom ? "border-[hsl(var(--kiddo-evergreen))] bg-[hsl(var(--kiddo-evergreen)/0.06)]" : "border-border bg-background text-muted-foreground"}`} onClick={() => { haptic("selection"); setShowCustom(true); }}>
                      {showCustom ? (
                        <input inputMode="decimal" value={customAmount} onChange={(e) => setCustomAmount(e.target.value.replace(/[^\d.]/g, ""))} placeholder="Other amount (min $5)" className="w-full bg-transparent text-foreground outline-none" autoFocus />
                      ) : "Other amount"}
                    </button>
                    <textarea
                      value={message}
                      onChange={(e) => setMessage(e.target.value)}
                      placeholder={currentOccasion.notePlaceholder}
                      rows={2}
                      className="w-full rounded-xl border border-border bg-background px-3 py-2.5 text-sm resize-none outline-none focus:border-[hsl(var(--kiddo-evergreen))] placeholder:text-muted-foreground"
                    />
                    <Button size="lg" className="kiddo-gold-button h-14 w-full rounded-2xl text-base font-bold" disabled={!isValidAmount} onClick={() => { haptic("selection"); trackGiftEvent("cta_click", "gift_occasion_start", { destination: "preview_step", amount: activeAmount }); setStep("preview"); }} data-testid="button-start-gift">
                      {currentOccasion.emoji} Give ${isValidAmount ? activeAmount.toFixed(2) : "..."} to {recipientName}
                      <ArrowRight size={16} className="ml-2" />
                    </Button>
                    <p className="text-center text-xs text-muted-foreground">No account needed. Takes 60 seconds.</p>
                    {isOccasionEvent && (
                      <p className="text-center text-xs text-muted-foreground/70 leading-relaxed">
                        Your gift goes directly into {recipientName}&apos;s fund. The {eventData?.event?.name?.toLowerCase() || "occasion"} is just how we&apos;re celebrating it. 🌱
                      </p>
                    )}
                  </div>

                  {/* Who's already given — each row shows the destination ticker when
                      the gift was a pick ("Someone · $50 in Amazon"), or "in {child}'s
                      mix" for managed/auto gifts. Real social proof: the next gifter
                      sees that others are picking actual companies for this child, not
                      just abstract "$50 invested". */}
                  {recentGifters.length > 0 && (
                    <div className="kiddo-card p-4">
                      <p className="text-sm font-semibold text-foreground mb-3">Who's already given</p>
                      <div className="space-y-2.5">
                        {recentGifters.map((gifter, i) => {
                          const amountLabel = gifter.amount > 0
                            ? `$${gifter.amount % 1 === 0 ? gifter.amount.toFixed(0) : gifter.amount.toFixed(2)}`
                            : null;
                          const destinationLabel = (() => {
                            if (gifter.ticker && gifter.tickerName) return gifter.tickerName;
                            if (gifter.ticker) return gifter.ticker;
                            const exec = String(gifter.executionModel || "").toLowerCase();
                            if (exec === "auto" || exec === "family" || exec === "auto_invest") {
                              return recipientName && !recipientLooksLikeFund
                                ? `${recipientName}'s mix`
                                : "the mix";
                            }
                            return null;
                          })();
                          return (
                            <div key={i} className="flex items-center gap-3">
                              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[hsl(var(--kiddo-evergreen)/0.10)]">
                                <span className="text-xs font-bold text-[hsl(var(--kiddo-evergreen))]">{gifter.name[0]?.toUpperCase()}</span>
                              </div>
                              <div className="flex-1 min-w-0">
                                <p className="text-sm font-medium text-foreground truncate">
                                  {gifter.name}
                                  {amountLabel && (
                                    <span className="font-semibold text-foreground"> · {amountLabel}</span>
                                  )}
                                  {destinationLabel && (
                                    <span className="text-muted-foreground"> in {destinationLabel}</span>
                                  )}
                                </p>
                              </div>
                              <span className="shrink-0 text-[11px] font-semibold rounded-full bg-[hsl(var(--kiddo-evergreen)/0.08)] px-2.5 py-0.5 text-[hsl(var(--kiddo-evergreen))]">
                                Invested
                              </span>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {/* Trust badges */}
                  <div className="grid grid-cols-3 gap-2 text-center">
                    {[{ icon: "🛡", label: "SIPC protected" }, { icon: "⚡", label: "60 seconds" }, { icon: "🎁", label: "Memory Book" }].map(({ icon, label }) => (
                      <div key={label} className="rounded-2xl border border-border bg-card px-2 py-3">
                        <p className="text-lg leading-none">{icon}</p>
                        <p className="mt-1 text-[11px] font-semibold text-muted-foreground">{label}</p>
                      </div>
                    ))}
                  </div>

                  {eventData.event.description && (
                    <RichText html={eventData.event.description} className="text-sm text-muted-foreground leading-relaxed px-1" />
                  )}

                  <footer className="pb-8 pt-2 text-center space-y-3">
                    <TrustMicroStrip />
                    <p className="text-xs text-muted-foreground">{giftProvenance} This page is private and only available through the link, QR code, or fund code the family shared.</p>
                    <div className="flex flex-wrap justify-center gap-4 text-xs text-muted-foreground">
                      <Link href="/faq" className="hover:text-foreground transition-colors">FAQ</Link>
                      <Link href="/security" className="hover:text-foreground transition-colors">Security</Link>
                    </div>
                  </footer>
                </>
              ) : (
                <>
                  {/* Non-occasion: dark hero layout (permanent / gift anytime / savings goal) */}
                  <p className="text-center text-sm text-muted-foreground">
                    Someone who loves {recipientLooksLikeFund ? "this child" : recipientName} shared this with you. 🎁
                  </p>

                  <div className="kiddo-hero-card overflow-hidden">
                    <div className="relative min-h-[320px] md:min-h-[420px]">
                      {eventData.event.imageUrl ? (
                        <>
                          {(() => {
                            // Same focal-point honor as the compact occasion
                            // hero above. Surface's tall aspect (~1.1:1 mobile,
                            // ~0.9:1 desktop) is the one most at risk of cropping
                            // a subject out without the focal-point hint.
                            const fx = (eventData.event as any).imageFocalX != null ? Number((eventData.event as any).imageFocalX) : 0.5;
                            const fy = (eventData.event as any).imageFocalY != null ? Number((eventData.event as any).imageFocalY) : 0.5;
                            const fxPct = Number.isFinite(fx) ? Math.max(0, Math.min(100, fx * 100)) : 50;
                            const fyPct = Number.isFinite(fy) ? Math.max(0, Math.min(100, fy * 100)) : 50;
                            return (
                              <img
                                src={eventData.event.imageUrl}
                                alt={shareTitle}
                                className="absolute inset-0 h-full w-full object-cover"
                                style={{ objectPosition: `${fxPct}% ${fyPct}%` }}
                              />
                            );
                          })()}
                          <div className="absolute inset-0 bg-gradient-to-t from-black/65 via-black/25 to-black/15" />
                        </>
                      ) : (
                        <div className={`absolute inset-0 ${heroBg}`} />
                      )}
                      <div className="relative z-10 flex min-h-[320px] md:min-h-[420px] flex-col p-6 md:p-8 text-white">
                        {childPhotoUrl && (
                          <div className="flex justify-center sm:justify-start">
                            <img src={childPhotoUrl} alt={recipientName} className="h-20 w-20 rounded-full border-[3px] border-white/50 object-cover shadow-2xl" />
                          </div>
                        )}
                        <div className="flex-1 min-h-[24px]" />
                        <div>
                          {eventData.event.name && eventData.event.name !== "Gift anytime" ? (
                            <p className="font-heading text-base font-semibold text-white/90 tracking-tight">{eventData.event.name}</p>
                          ) : (
                            <p className="kiddo-section-label text-white/70">Private gift link</p>
                          )}
                          <h1 className="mt-3 font-heading text-4xl md:text-5xl font-bold leading-tight" data-testid="text-heading">{landingHeadline}</h1>
                          <p className="mt-3 max-w-2xl text-base font-semibold text-white/90">No account needed. Takes 60 seconds.</p>
                          <div className="mt-4 grid grid-cols-3 gap-2 text-xs text-white" data-testid="grid-gift-first-answers">
                            <div className="rounded-2xl bg-white/15 px-3 py-2.5 backdrop-blur-sm text-center"><span className="text-lg leading-none">🌱</span><p className="mt-1 font-semibold">Invested</p></div>
                            <div className="rounded-2xl bg-white/15 px-3 py-2.5 backdrop-blur-sm text-center"><span className="text-lg leading-none">🔒</span><p className="mt-1 font-semibold">Protected</p></div>
                            <div className="rounded-2xl bg-white/15 px-3 py-2.5 backdrop-blur-sm text-center"><span className="text-lg leading-none">⚡</span><p className="mt-1 font-semibold">60 seconds</p></div>
                          </div>
                          {eventData.event.name && eventData.event.name !== "Gift anytime" && !eventData.event.isPermanent && (
                            <div className="mt-3 hidden items-center gap-1.5 rounded-full bg-white/15 backdrop-blur-sm px-3 py-1.5 md:inline-flex">
                              <TrendingUp size={12} className="text-white/90" />
                              <span className="text-xs text-white/90 font-medium">Gifts go into {recipientLooksLikeFund ? "this" : `${recipientName}'s`} fund</span>
                            </div>
                          )}
                          <div className="mt-4 hidden flex-wrap items-center gap-3 text-xs md:flex md:text-sm text-white/85">
                            <span>{eventData.fund.creatorFirstName ? `Created by ${eventData.fund.creatorFirstName}` : `Created for ${recipientLooksLikeFund ? "this fund" : recipientName}`}</span>
                            <span className="hidden md:inline">|</span>
                            <span>{giftCount > 0 ? `${giftCount} ${giftCount === 1 ? "person has" : "people have"} gifted so far` : "Be the one who starts it."}</span>
                          </div>
                          <div className="mt-6">
                            <Button size="lg" className="kiddo-gold-button h-16 w-full rounded-2xl px-6 text-lg font-bold" onClick={() => { haptic("selection"); trackGiftEvent("cta_click", "gift_page_start", { destination: "amount_step" }); setStep("amount"); }} data-testid="button-start-gift">
                              {isSavingsGoal ? "Gift to this goal" : `Gift ${amountStepChildLabel}`}
                              <ArrowRight size={18} className="ml-2" />
                            </Button>
                          </div>
                          {giftCount > 0 && (
                            <div className="mt-4 flex items-center gap-2.5" data-testid="social-proof-gifters">
                              <div className="flex -space-x-2">
                                {Array.from({ length: Math.min(giftCount, 5) }).map((_, i) => (
                                  <div key={i} className="flex h-7 w-7 items-center justify-center rounded-full border-2 border-white/30 bg-white/20 backdrop-blur-sm" style={{ zIndex: 5 - i }}>
                                    {recentGifters[i] ? <span className="text-[10px] font-bold text-white">{recentGifters[i].name[0].toUpperCase()}</span> : <span className="text-[10px] text-white/80">♥</span>}
                                  </div>
                                ))}
                                {giftCount > 5 && <div className="flex h-7 w-7 items-center justify-center rounded-full border-2 border-white/30 bg-white/20 backdrop-blur-sm" style={{ zIndex: 0 }}><span className="text-[10px] font-bold text-white">+{giftCount - 5}</span></div>}
                              </div>
                              {/* Caption deliberately omits the recipient's name. "X people
                                  have gifted Emma." puts the kid as object-of-community-love
                                  which edges toward the love-mark framing locked-refused in
                                  project_seth_godin_kora_alignment.md (Acorns landmines list).
                                  The fund hero above already names her; the count is purely
                                  transactional social proof. Brings this line into consistency
                                  with the sibling phrasings at lines 1199 + 1442. */}
                              <span className="text-xs font-medium text-white/75">
                                {giftCount === 1 ? "1 person has gifted" : `${giftCount} people have gifted`}.{goalAmount && goalAmount > giftVolume ? ` $${(goalAmount - giftVolume).toLocaleString()} to go.` : ""}
                              </span>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>

                  {eventData.event.description && (
                    <RichText html={eventData.event.description} className="md:hidden text-sm text-muted-foreground leading-relaxed px-1" />
                  )}

                  {isSavingsGoal && goalAmount && goalAmount > 0 && (
                    <div className="kiddo-card p-5 space-y-3" data-testid="savings-goal-progress-landing">
                      <div className="flex items-center justify-between">
                        <p className="text-sm font-semibold text-foreground">{giftVolume > 0 ? `${((giftVolume / goalAmount) * 100).toFixed(0)}% of the way there` : "Be the first to give"}</p>
                        <p className="text-sm font-bold text-[hsl(var(--kiddo-evergreen))]">${giftVolume.toLocaleString()} raised</p>
                      </div>
                      <div className="w-full h-3 bg-muted rounded-full overflow-hidden">
                        <motion.div className="h-full rounded-full bg-[hsl(var(--kiddo-evergreen))]" initial={{ width: 0 }} animate={{ width: `${Math.min((giftVolume / goalAmount) * 100, 100).toFixed(1)}%` }} transition={{ duration: 1, ease: [0.34, 1.56, 0.64, 1] }} />
                      </div>
                      <p className="text-xs text-muted-foreground">Goal: ${goalAmount.toLocaleString()} · {giftCount} {giftCount === 1 ? "person" : "people"} so far</p>
                    </div>
                  )}
                  {!isSavingsGoal && goalAmount && goalAmount > 0 && (
                    <GoalCard goalAmount={goalAmount} currentAmount={giftVolume} recipientName={recipientName} eventTitle={shareTitle} contributorCount={giftCount} />
                  )}

                  {/* Who's already given — each row shows the destination ticker when
                      the gift was a pick ("Someone · $50 in Amazon"), or "in {child}'s
                      mix" for managed/auto gifts. Real social proof: the next gifter
                      sees that others are picking actual companies for this child, not
                      just abstract "$50 invested". */}
                  {recentGifters.length > 0 && (
                    <div className="kiddo-card p-4">
                      <p className="text-sm font-semibold text-foreground mb-3">Who's already given</p>
                      <div className="space-y-2.5">
                        {recentGifters.map((gifter, i) => {
                          const amountLabel = gifter.amount > 0
                            ? `$${gifter.amount % 1 === 0 ? gifter.amount.toFixed(0) : gifter.amount.toFixed(2)}`
                            : null;
                          const destinationLabel = (() => {
                            if (gifter.ticker && gifter.tickerName) return gifter.tickerName;
                            if (gifter.ticker) return gifter.ticker;
                            const exec = String(gifter.executionModel || "").toLowerCase();
                            if (exec === "auto" || exec === "family" || exec === "auto_invest") {
                              return recipientName && !recipientLooksLikeFund
                                ? `${recipientName}'s mix`
                                : "the mix";
                            }
                            return null;
                          })();
                          return (
                            <div key={i} className="flex items-center gap-3">
                              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[hsl(var(--kiddo-evergreen)/0.10)]">
                                <span className="text-xs font-bold text-[hsl(var(--kiddo-evergreen))]">{gifter.name[0]?.toUpperCase()}</span>
                              </div>
                              <div className="flex-1 min-w-0">
                                <p className="text-sm font-medium text-foreground truncate">
                                  {gifter.name}
                                  {amountLabel && (
                                    <span className="font-semibold text-foreground"> · {amountLabel}</span>
                                  )}
                                  {destinationLabel && (
                                    <span className="text-muted-foreground"> in {destinationLabel}</span>
                                  )}
                                </p>
                              </div>
                              <span className="shrink-0 text-[11px] font-semibold rounded-full bg-[hsl(var(--kiddo-evergreen)/0.08)] px-2.5 py-0.5 text-[hsl(var(--kiddo-evergreen))]">
                                Invested
                              </span>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {amountProjection && (
                    <div className="kiddo-card p-4 bg-[hsl(var(--kiddo-gold)/0.10)] border-[hsl(var(--kiddo-gold)/0.30)]">
                      <p className="text-sm font-semibold text-foreground">{amountProjection.headline}</p>
                      <p className="mt-1 text-xs text-muted-foreground">{amountProjection.tagline}</p>
                    </div>
                  )}

                  <p className="kiddo-card hidden px-4 py-3 text-xs leading-relaxed text-muted-foreground md:block">{checkoutTrustLineJsx}</p>

                  <footer className="pb-8 pt-2 text-center space-y-3">
                    <TrustMicroStrip />
                    <p className="text-xs text-muted-foreground">{giftProvenance} This page is private and only available through the link, QR code, or fund code the family shared.</p>
                    <div className="flex flex-wrap justify-center gap-4 text-xs text-muted-foreground">
                      <Link href="/faq" className="hover:text-foreground transition-colors">FAQ</Link>
                      <Link href="/security" className="hover:text-foreground transition-colors">Security</Link>
                    </div>
                  </footer>
                </>
              )}
            </motion.section>
          )}

          {step === "amount" && (
            <motion.section key="amount" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -12 }} className="space-y-5">
              <div className="kiddo-card p-5 md:p-6">
                <p className="text-sm font-semibold text-[hsl(var(--kiddo-evergreen))]">Most people give $50 or $100</p>
                <h1 className="mt-2 font-heading text-2xl md:text-3xl font-semibold text-foreground">How much do you want to give {recipientLooksLikeFund ? "this child" : recipientName}?</h1>
                <p className="mt-2 text-sm text-muted-foreground">Choose a quick amount, or enter your own. The gift can become part of their story today.</p>
                <div className="mt-6 grid grid-cols-2 gap-3 md:grid-cols-4">
                  {AMOUNTS.map((amt) => (
                    <button
                      key={amt}
                      type="button"
                      className={`tap-bounce rounded-2xl border px-4 py-4 text-left transition-colors ${!showCustom && selectedAmount === amt ? "border-[hsl(var(--kiddo-evergreen))] bg-[hsl(var(--kiddo-evergreen))] text-white shadow-premium-sm" : "border-border bg-muted/70 text-foreground hover:bg-muted"}`}
                      onClick={() => {
                        haptic("selection");
                        setSelectedAmount(amt);
                        setShowCustom(false);
                        setCustomAmount("");
                        trackGiftEvent("gift_amount_selected", "gift_link_opened_to_amount_selected", {
                          baselineEvent: "gift_amount_selected",
                          amount: amt,
                          amountSource: "preset",
                        });
                      }}
                      data-testid={`button-amount-${amt}`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <p className="text-lg font-bold">${amt}</p>
                        {amt === 50 && <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${!showCustom && selectedAmount === amt ? "bg-white/20 text-white" : "bg-[hsl(var(--kiddo-evergreen)/0.10)] text-[hsl(var(--kiddo-evergreen))]"}`}>Most common</span>}
                      </div>
                      <p className={`mt-2 text-[11px] ${!showCustom && selectedAmount === amt ? "text-white/85" : "text-muted-foreground"}`}>
                        {amt === 25 ? "A small gift, a real start" : amt === 50 ? "Grows more than a toy ever would" : amt === 100 ? "More than a card. More than cash." : "A head start on their future"}
                      </p>
                    </button>
                  ))}
                </div>
                <button type="button" className={`mt-3 w-full rounded-2xl border px-4 py-3 text-left transition-colors ${showCustom ? "border-[hsl(var(--kiddo-evergreen))] bg-[hsl(var(--kiddo-evergreen)/0.06)]" : "border-border bg-background"}`} onClick={() => { haptic("selection"); setShowCustom(true); trackGiftEvent("gift_amount_selected", "gift_link_opened_to_amount_selected", { baselineEvent: "gift_amount_selected", amount: null, amountSource: "custom_opened" }); }} data-testid="button-custom-amount">
                  <span className="text-sm font-medium text-foreground">Enter your own amount</span>
                </button>
                {showCustom && (
                  <div className="mt-3">
                    <input inputMode="decimal" value={customAmount} onChange={(e) => setCustomAmount(e.target.value.replace(/[^\d.]/g, ""))} placeholder="50" className="h-14 w-full rounded-2xl border border-border bg-background px-4 text-lg font-medium outline-none focus:border-[hsl(var(--kiddo-evergreen))]" data-testid="input-custom-amount" />
                    <p className="mt-2 text-xs text-muted-foreground">Minimum gift is $5.</p>
                    {/* Large-gift reassurance — locked 2026-05-19 per the
                        Five Towns gifter persona audit. Conservative gifters
                        (grandparents giving $1k-5k for bar mitzvah / sweet 16)
                        sometimes self-cap below their intention assuming a
                        hidden limit. There's no upper limit; gifts ≥$1000
                        carry a brief processing window for fraud review
                        but otherwise settle the same way. Threshold gated
                        at $500 so common-gift flows don't see legal copy. */}
                    {Number.isFinite(activeAmount) && activeAmount >= 500 && (
                      <div className="mt-3 rounded-xl border border-[hsl(var(--kiddo-evergreen)/0.25)] bg-[hsl(var(--kiddo-evergreen)/0.05)] p-3">
                        <p className="text-[12px] leading-relaxed text-foreground">
                          <span className="font-semibold">Large gifts welcome.</span> {activeAmount >= 1000 ? "Gifts ≥ $1,000 settle the same way as smaller gifts, with a brief verification window. " : ""}No hidden maximum. Assets are held by DriveWealth, LLC (Member FINRA / SIPC) in {recipientLooksLikeFund ? "the child" : recipientName}'s UTMA custodial account.
                        </p>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {amountProjection && (
                <div className="kiddo-card p-5 bg-[hsl(var(--kiddo-gold)/0.10)] border-[hsl(var(--kiddo-gold)/0.30)]">
                  <p className="text-sm font-semibold text-foreground">{amountProjection.headline}</p>
                  <p className="mt-1 text-xs text-muted-foreground">{amountProjection.tagline}</p>
                </div>
              )}

              {/* Recurring gift block — pricing-v3 (locked 2026-05-23,
                  see project_pricing_v3_recurring_at_plus.md).
                  Recurring is gated at the FUND tier; gifters never pay
                  but inherit the fund's tier.
                    - Plus/Family fund (recurringSupported=true): show
                      the recurring toggle as before (gifter sets up
                      a real Stripe subscription, free to them, with
                      inline account creation per locked Decision A
                      from project_gifter_recurring_restoration.md).
                    - Free fund (recurringSupported=false): show the
                      reminder-only path + "Ask Emma's parents to
                      enable monthly" feature-request CTA (POSTs to
                      /api/funds/:fundId/recurring-request which
                      creates a relationship-signal activity on the
                      parent's dashboard). Diplomatic framing per
                      pricing-v3 design constraint #2 — product
                      statement, never paywall.
                  Server-side defense in depth at
                  /api/stripe/checkout/gift-recurring also enforces
                  the fund-tier check. */}
              {eventData?.fund?.recurringSupported === false ? (
                <>
                  <ReminderAndAskParentsCard
                    fundId={eventData.fund.id}
                    childName={eventData.fund.recipientFirstName || eventData.fund.name || "the kid"}
                    defaultAmount={activeAmount}
                  />
                  {/* Sponsor-a-year-of-Plus (Prong B of pricing-v3 conversion,
                      locked 2026-05-23). Third path on Free funds: gifter
                      buys a year of Plus/Family for the parent's fund as a
                      one-time gift. Removes the parent's payment-decision
                      bottleneck that the recurring-request flow leaves
                      open. Per project_gifter_sponsors_plus_subscription.md. */}
                  <SponsorPlusCard
                    fundId={eventData.fund.id}
                    childName={eventData.fund.recipientFirstName || eventData.fund.name || "the kid"}
                  />
                </>
              ) : (
              <div className="kiddo-card p-5">
                <label className="flex items-start gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={isRecurring}
                    onChange={(e) => { haptic("selection"); setIsRecurring(e.target.checked); }}
                    className="mt-1 h-4 w-4 rounded border-border accent-[hsl(var(--kiddo-evergreen))]"
                    data-testid="checkbox-recurring-gift"
                  />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-foreground">Make this recurring</p>
                    <p className="mt-0.5 text-xs text-muted-foreground leading-relaxed">
                      Send the same amount on a regular schedule. Cancel any time. Free. No Kiddo subscription.
                    </p>
                  </div>
                </label>
                {isRecurring && (
                  <div className="mt-4 space-y-3 pt-4 border-t border-border/60">
                    <div>
                      <label className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">How often</label>
                      <div className="mt-1.5 flex gap-2">
                        {(["weekly", "monthly", "yearly"] as const).map((f) => (
                          <button
                            key={f}
                            type="button"
                            onClick={() => { haptic("selection"); setRecurringFrequency(f); }}
                            className={`flex-1 rounded-xl border px-3 py-2 text-xs font-semibold transition-colors ${
                              recurringFrequency === f
                                ? "border-[hsl(var(--kiddo-evergreen))] bg-[hsl(var(--kiddo-evergreen)/0.08)] text-[hsl(var(--kiddo-evergreen))]"
                                : "border-border text-muted-foreground hover:text-foreground"
                            }`}
                            data-testid={`button-recurring-freq-${f}`}
                          >
                            {f.charAt(0).toUpperCase() + f.slice(1)}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Daily-equivalent display — per
                        project_behavioral_framing_discipline.md.
                        Benartzi/Hershfield/Shu Acorns research showed
                        same dollar amount framed as daily vs monthly
                        produced 4× enrollment lift on recurring (30%
                        vs 7%) AND eliminated the income-bracket gap.
                        Mechanism: "$5/day" triggers latte mental
                        accounting (skippable); "$150/month" triggers
                        car-payment mental accounting (committed).
                        Shipped 2026-05-23 as the first behavioral-
                        framing experiment on a conversion-critical
                        surface. */}
                    {isValidAmount && activeAmount > 0 && (() => {
                      const daysPerCycle = recurringFrequency === "weekly"
                        ? 7
                        : recurringFrequency === "monthly"
                          ? 30
                          : 365;
                      const dailyAmt = activeAmount / daysPerCycle;
                      // Formatting: <$1 shows two decimals ("$0.33"),
                      // >=$1 shows two decimals for consistency
                      // ("$5.00", "$12.50"). Tabular-nums prevents
                      // layout shift as the user changes amounts.
                      return (
                        <div
                          className="rounded-2xl bg-[hsl(var(--kiddo-gold)/0.10)] border border-[hsl(var(--kiddo-gold)/0.30)] px-4 py-3 text-center"
                          data-testid="recurring-daily-equivalent"
                        >
                          <p className="text-[10px] uppercase tracking-[0.14em] font-bold text-muted-foreground/80">
                            That's about
                          </p>
                          <p className="mt-0.5 text-2xl font-bold text-foreground tabular-nums leading-tight">
                            ${dailyAmt.toFixed(2)}
                            <span className="text-base font-medium text-muted-foreground"> / day</span>
                          </p>
                        </div>
                      );
                    })()}

                    <div>
                      <label className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground" htmlFor="recurring-password">
                        Set a password
                      </label>
                      <p className="text-[11px] text-muted-foreground/80 mt-0.5 mb-2 leading-relaxed">
                        We'll create your free gifter account at the same time so you can manage or cancel any time. Uses the email you enter on the next step.
                      </p>
                      <input
                        id="recurring-password"
                        type="password"
                        value={recurringPassword}
                        onChange={(e) => setRecurringPassword(e.target.value)}
                        placeholder="At least 8 characters"
                        minLength={8}
                        autoComplete="new-password"
                        className="w-full rounded-xl border border-border bg-background px-3 py-2 text-sm"
                        data-testid="input-recurring-password"
                      />
                    </div>
                    <p className="text-[10px] text-muted-foreground/70 leading-snug">
                      Recurring gifts count toward the IRS annual gift exclusion ($18,000 per recipient per year). Most family contributions are well under this.
                    </p>
                  </div>
                )}
              </div>
              )}

                <Button size="lg" className="kiddo-gold-button h-14 w-full rounded-2xl text-base font-bold" disabled={!isValidAmount || (isRecurring && recurringPassword.length < 8)} onClick={() => { haptic("selection"); trackGiftEvent("gift_amount_selected", "gift_link_opened_to_amount_selected", { baselineEvent: "gift_amount_selected", amount: activeAmount, amountSource: showCustom ? "custom_confirmed" : "confirmed", isRecurring, recurringFrequency: isRecurring ? recurringFrequency : null }); trackGiftEvent("cta_click", "gift_amount_continue", { amount: activeAmount }); setStep("preview"); }} data-testid="button-continue-to-preview">
                Continue
                <ArrowRight size={16} className="ml-2" />
              </Button>
            </motion.section>
          )}

          {step === "preview" && (
            <motion.section key="preview" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -12 }} className="space-y-5">
              {/* Personalization keeps the gift feeling like a card, not a trade ticket. */}
              <div className="kiddo-card p-5 md:p-6">
                <p className="text-sm font-medium text-[hsl(var(--kiddo-evergreen))]">
                  {recipientLooksLikeFund ? "Their Memory Book will remember this" : `${recipientName}'s Memory Book will remember this`}
                </p>
                {familyDefaultMode === "managed" ? (
                  <>
                    <h1 className="mt-1 font-heading text-2xl md:text-3xl font-semibold text-foreground">Make it personal.</h1>
                    <p className="mt-3 text-sm text-muted-foreground">
                      {eventData.fund.creatorFirstName ? `${eventData.fund.creatorFirstName} chose a simple investing path for ${amountStepChildLabel}.` : "The family chose a simple investing path."} Your gift follows it automatically.
                    </p>
                  </>
                ) : familyDefaultMode === "cash" ? (
                  <>
                    <h1 className="mt-1 font-heading text-2xl md:text-3xl font-semibold text-foreground">Make it personal.</h1>
                    <p className="mt-3 text-sm text-muted-foreground">
                      Your ${activeAmount.toFixed(0)} gift will land in {destinationFundLabel}. The family can invest it when they are ready.
                    </p>
                  </>
                ) : (
                  <>
                    <h1 className="mt-1 font-heading text-2xl md:text-3xl font-semibold text-foreground">Make it personal.</h1>
                    <p className="mt-3 text-sm text-muted-foreground">
                      Pick a company that means something, or use the family's choice. The Memory Book keeps the story with the gift.
                    </p>
                    {(executionModel !== "pick" || isFamilyDefaultStockSelected) && (
                      <div
                        className="mt-4 flex items-center gap-3 rounded-3xl border border-[hsl(var(--kiddo-evergreen)/0.12)] bg-[linear-gradient(135deg,hsl(var(--kiddo-evergreen)/0.06),hsl(var(--kiddo-gold)/0.10))] p-4 shadow-[0_12px_30px_rgba(26,23,16,0.06)]"
                        data-testid="card-family-default-stock"
                      >
                        <StockLogo ticker={familyDefaultStock.symbol} size={40} className="shadow-[0_8px_18px_rgba(26,23,16,0.08)]" />
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <p className="text-sm font-semibold text-foreground">{familyDefaultStock.name}</p>
                            <span className="rounded-full border border-[hsl(var(--kiddo-evergreen)/0.14)] bg-white/80 px-2 py-0.5 text-[10px] font-bold tracking-[0.06em] text-[hsl(var(--kiddo-evergreen))]">
                              {familyDefaultStock.symbol}
                            </span>
                          </div>
                          <p className="text-xs text-muted-foreground" data-testid="text-family-default-stock-note">{eventData.fund.creatorFirstName ? `${eventData.fund.creatorFirstName} chose this one for the fund.` : "The family's current choice."}</p>
                        </div>
                        <p className="hidden text-xs font-semibold text-muted-foreground sm:block">${familyDefaultStock.price.toLocaleString()}</p>
                      </div>
                    )}
                  </>
                )}
                <div className="mt-4 rounded-2xl border border-border/60 bg-muted/30 p-4">
                  <p className="text-xs font-semibold uppercase text-muted-foreground">Where this gift goes</p>
                  <p className="mt-2 text-sm text-foreground">
                    {effectiveExecutionModel === "pick"
                      ? `Your ${effectiveSelectedTicker || "stock"} choice belongs to this gift. It becomes part of the Memory Book story.`
                      : effectiveExecutionModel === "family"
                        ? "This gift lands in the fund for the family to invest later."
                        : familyDefaultMode === "stock"
                          ? `This gift follows the family's current choice: ${familyDefaultStock.name}.`
                          : `This gift gets invested in real stocks automatically. The family set it up. Your gift follows their path.`}
                  </p>
                  {activeAmount > 0 && (effectiveExecutionModel === "pick" || familyDefaultMode === "stock") && (() => {
                    const stock = effectiveExecutionModel === "pick"
                      ? stockPicks.find(s => s.symbol === effectiveSelectedTicker)
                      : familyDefaultStock;
                    if (!stock) return null;
                    const shares = activeAmount / stock.price;
                    const sharesStr = shares >= 1 ? shares.toFixed(2) : shares.toFixed(4);
                    return (
                      <p className="mt-2 text-xs text-muted-foreground" data-testid="text-preview-share-estimate">
                        ${activeAmount.toFixed(0)} buys approximately <span className="font-semibold text-foreground">{sharesStr} shares</span> of {stock.name} at an estimated price of ${stock.price.toLocaleString()}/share. Final shares are confirmed when the trade executes.{usingFallbackPrices ? " Prices shown are reference estimates." : ""}
                      </p>
                    );
                  })()}
                </div>
              </div>

              {/* Stock override - always visible for stock-mode funds, or if flag allows */}
              {canUseStockPicker && (
                <div className={`kiddo-card p-5 transition-opacity duration-200 ${executionModel === "family" ? "opacity-40 pointer-events-none select-none" : ""}`}>
                  <p className="text-sm font-semibold text-foreground">Pick a company that means something.</p>
                  <p className="mt-1 text-xs text-muted-foreground">This is the personal part of the gift.</p>
                  <div className="mt-3 grid grid-cols-2 gap-2">
                    {stockPicks.map((stock) => {
                      const active = executionModel !== "family" && (executionModel === "pick" ? selectedStock : familyDefaultStock.symbol) === stock.symbol;
                      return (
                        <button
                          key={stock.symbol}
                          type="button"
                          className={`rounded-xl border p-3 text-left transition-colors ${active ? "border-[hsl(var(--kiddo-evergreen))] bg-[hsl(var(--kiddo-evergreen)/0.06)]" : "border-border hover:border-[hsl(var(--kiddo-evergreen)/0.4)]"}`}
                          onClick={() => { haptic("selection"); setExecutionModel("pick"); setSelectedStock(stock.symbol); }}
                          data-testid={`button-stock-${stock.symbol}`}
                        >
                          <StockLogo ticker={stock.symbol} size={32} className="mb-1.5" />
                          <p className="text-sm font-semibold text-foreground leading-tight">{stock.name}</p>
                          <p className="text-[11px] text-muted-foreground mt-0.5 leading-tight">{stock.tagline}</p>
                        </button>
                      );
                    })}
                  </div>
                  {executionModel === "pick" && selectedStock && (
                    <button type="button" className="mt-3 text-xs text-muted-foreground underline" onClick={() => { setExecutionModel("auto"); setSelectedStock(null); }}>
                      Use family default instead
                    </button>
                  )}
                </div>
              )}

              {allowGifterCashGift && (
                <button type="button" className={`w-full kiddo-card p-4 text-left transition-colors ${executionModel === "family" ? "border-[hsl(var(--kiddo-evergreen))] bg-[hsl(var(--kiddo-evergreen)/0.06)]" : "border-border hover:border-[hsl(var(--kiddo-evergreen)/0.35)]"}`} onClick={() => { haptic("selection"); setExecutionModel(executionModel === "family" ? "auto" : "family"); }} data-testid="option-execution-family">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold text-foreground">Let the family decide later</p>
                      <p className="mt-1 text-xs text-muted-foreground">Send as cash. The family invests it when they're ready.</p>
                    </div>
                    <div className={`h-4 w-4 shrink-0 rounded-full border-2 transition-colors ${executionModel === "family" ? "border-[hsl(var(--kiddo-evergreen))] bg-[hsl(var(--kiddo-evergreen))]" : "border-border"}`} />
                  </div>
                </button>
              )}

              <Button size="lg" className="kiddo-gold-button h-14 w-full rounded-2xl text-base font-bold" disabled={!hasValidExecutionChoice} onClick={() => { haptic("selection"); trackGiftEvent("cta_click", "gift_preview_continue", { executionModel: effectiveExecutionModel, selectedStock: effectiveSelectedTicker }); setStep("payment"); }} data-testid="button-continue-to-payment">
                Gift ${activeAmount.toFixed(0)} to {amountStepChildLabel}
                <ArrowRight size={16} className="ml-2" />
              </Button>
              <p className="text-center text-[11px] text-muted-foreground">Prices vary. Investing involves risk. A gift card does too.</p>
            </motion.section>
          )}

          {step === "payment" && (
            <motion.section key="payment" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -12 }} className="space-y-5">
              {/* Recurring-mode confirmation banner. Without this, the
                  Step 3 payment surface looked identical to one-time
                  checkout, so a gifter who set up recurring on Step 1
                  had no visual confirmation that the schedule was
                  carrying through to the actual charge. User flagged
                  this 2026-05-23 ("is it clear i set recurring and is
                  all perfect?"). Renders only when isRecurring. */}
              {isRecurring && (
                <div
                  className="kiddo-card p-4 md:p-5 border-[hsl(var(--kiddo-evergreen))]/30 bg-[hsl(var(--kiddo-evergreen))]/8"
                  data-testid="checkout-recurring-banner"
                >
                  <div className="flex items-start gap-3">
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[hsl(var(--kiddo-evergreen))] text-white">
                      <Repeat size={16} strokeWidth={1.8} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-foreground">
                        Recurring {recurringFrequency} gift, ${activeAmount.toFixed(2)} each time.
                      </p>
                      <p className="mt-0.5 text-xs text-muted-foreground leading-relaxed">
                        Today's charge is ${totalCharge.toFixed(2)} (gift plus processing). Future charges run on the same {recurringFrequency} schedule. Cancel any time from your gifter dashboard.
                      </p>
                    </div>
                  </div>
                </div>
              )}
              <div className="kiddo-card p-5 md:p-6">
                <p className="text-sm font-medium text-[hsl(var(--kiddo-evergreen))]">Almost there.</p>
                <h1 className="mt-1 font-heading text-2xl md:text-3xl font-semibold text-foreground">The note is what they will read. The investment is what keeps growing.</h1>
                {/* Investment preview compressed: was a big 3-stat block
                    (Gift amount / Invested / Est. shares or Destination)
                    plus a paragraph plus a logo. The Order Summary card
                    below already shows the dollar breakdown. The unique
                    info this surface adds is WHERE the gift lands — the
                    strategy, the stock, the destination. So the preview
                    is now a single inline line carrying just that load-
                    bearing fact, with the destination logo for trust.
                    Cuts ~6 visual elements without losing the signal. */}
                <div
                  className="mt-4 flex items-center gap-3 rounded-2xl border border-[hsl(var(--kiddo-evergreen)/0.16)] bg-[hsl(var(--kiddo-evergreen)/0.055)] px-4 py-3"
                  data-testid="checkout-investment-preview"
                >
                  {checkoutPreviewStock ? (
                    <StockLogo ticker={checkoutPreviewStock.symbol} size={36} className="shrink-0" />
                  ) : (
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-white/80 text-[hsl(var(--kiddo-evergreen))]">
                      <TrendingUp size={16} />
                    </div>
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="text-[10.5px] font-bold uppercase tracking-[0.12em] text-[hsl(var(--kiddo-evergreen))]">
                      Where it lands
                    </p>
                    <p className="mt-0.5 text-sm font-semibold leading-snug text-foreground" data-testid="text-checkout-estimated-shares">
                      {checkoutPreviewStock
                        ? <>{checkoutPreviewStock.symbol} · ~{checkoutEstimatedSharesLabel} shares</>
                        : effectiveExecutionModel === "family"
                          ? <>Fund cash &mdash; the family invests it when ready</>
                          : <>{strategyLabel} mix &mdash; auto-invested</>}
                    </p>
                  </div>
                </div>
                <div className="mt-6 grid gap-4">
                  <div>
                    <label className="text-sm font-medium text-foreground">
                      Leave a note for {recipientLooksLikeFund ? "their" : `${recipientName}'s`} Memory Book
                    </label>
                    <p className="mt-1 text-xs text-muted-foreground">They'll read it when they're 18. Optional, but the ones who write something always say they're glad they did.</p>
                    <div className="mt-2 rounded-2xl border border-amber-200/60 bg-amber-50/40 p-3">
                      <textarea
                        value={message}
                        onChange={(e) => setMessage(e.target.value)}
                        placeholder={recipientLooksLikeFund ? "Write something they will read when they're older..." : `Write something ${recipientName} will read someday...`}
                        className="min-h-[100px] w-full bg-transparent px-1 py-1 text-sm text-foreground placeholder:text-amber-700/50 outline-none resize-none"
                        data-testid="input-message"
                      />
                    </div>
                    {/* Light note prompts — replaces the previous 8-tag
                        lesson picker. Reddit research showed gifters
                        write curriculum-themed NOTES; the earlier
                        structured-tag system mistook the artifact for
                        the behavior. Three prose ideas inspire the
                        thoughtful gifter without taxing grandma with
                        another decision. See
                        feedback_structure_vs_behavior.md (locked memory). */}
                    {!message.trim() ? (
                      <p className="mt-2 text-[11px] text-muted-foreground/80 leading-relaxed">
                        Some ideas: why you picked this company · what you want {recipientLooksLikeFund ? "them" : recipientName} to learn · the story of this gift
                      </p>
                    ) : (
                      <p className="kiddo-note-seal mt-2 text-xs font-semibold text-[hsl(var(--kiddo-evergreen))]">
                        Sealed for {amountStepChildLabel}. Saved for the Memory Book.
                      </p>
                    )}
                  </div>
                  {/* Memory media — UNIFIED via shared MemoryMediaPicker.
                      Earlier the gifter checkout had its own bespoke card-grid
                      implementation that drifted from the parent flows: it
                      gated by plan tier (free=none, starter=photo-only,
                      family=full trio), it set capture="environment" /
                      capture="user" on the file inputs (which on many mobile
                      browsers REMOVES the "Choose from library" option even
                      though the subtitle promised it), and it added two
                      different visual systems for the same job (cards here,
                      pills in parent flows).
                      Per the locked memory `project_giving_flows_full_media`,
                      gifters always get the full note + photo + video + voice
                      trio via the shared component. The plan-tier gating is
                      preserved at the outer level (free-plan parents still
                      don't expose media to gifters — that's a real revenue
                      lever) but within the paid tiers all media types show. */}
                  {fallbackPlan !== "free" && fundId && !isAnonymous && (
                    <div className="rounded-2xl border border-[hsl(var(--kiddo-border))] bg-[hsl(var(--kiddo-cream-dark)/0.42)] p-4" data-testid="section-memory-attachment">
                      <label className="text-sm font-semibold text-foreground">
                        Add a photo, video, or voice note <span className="font-normal text-muted-foreground">(optional)</span>
                      </label>
                      <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                        A quick face, wave, or moment can sit beside the note in the Memory Book.
                      </p>
                      <MemoryMediaPicker
                        fundId={fundId}
                        // Public upload endpoint family — gifters aren't logged in,
                        // so we point at the public memory-upload routes (which
                        // have rate-limit + audit-log middleware on the server).
                        uploadEndpointPrefix="/api/public/funds"
                        value={{
                          photoUrl,
                          videoUrl,
                          audioUrl,
                          // No transcript wiring on the gift path yet — server
                          // can fill if/when STT lands. Defaults to empty.
                          audioTranscript: "",
                        } as MemoryMediaValue}
                        onChange={(next) => {
                          // Fan out to the existing state vars so downstream
                          // submit-gift metadata writes (lines 668/685/745)
                          // don't have to change shape. Single source of truth
                          // remains photoUrl/videoUrl/audioUrl in this file.
                          setPhotoUrl(next.photoUrl || "");
                          setVideoUrl(next.videoUrl || "");
                          setAudioUrl(next.audioUrl || "");
                          setMemoryMediaError(null);
                        }}
                        childName={recipientName || null}
                        className="mt-3"
                      />
                      {memoryMediaError && (
                        <p className="mt-3 text-xs font-medium text-red-600" data-testid="text-memory-media-error">
                          {memoryMediaError}
                        </p>
                      )}
                    </div>
                  )}
                  {/* Anonymous + media is a hard ban. Photo / video /
                      voice all identify the gifter (face, voice print,
                      handwriting, environment), so allowing them with
                      "Anonymous" turned on would make the toggle a lie
                      Emma at 18 sees through immediately. The note IS
                      allowed because text is the gifter's character-by-
                      character authorship — they choose what to reveal.
                      Per feedback_anonymous_as_explicit_flag.md. */}
                  {fallbackPlan !== "free" && fundId && isAnonymous && (
                    <div className="rounded-2xl border border-[hsl(var(--kiddo-border))] bg-muted/40 p-4" data-testid="section-memory-attachment-anonymous-note">
                      <p className="text-sm font-semibold text-foreground">Note only for anonymous gifts</p>
                      <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                        Photos, videos, and voice memos identify you (face, voice, handwriting). Anonymous gifts are note-only so the privacy promise holds.
                      </p>
                    </div>
                  )}

                  <div>
                    <div className="flex items-center justify-between gap-3">
                      <label className="text-sm font-medium text-foreground">Who&apos;s this from? <span className="text-muted-foreground font-normal">(optional)</span></label>
                      {/* Explicit anonymous toggle — replaces the previous
                          infer-from-blank pattern. When checked, the name
                          field is hidden and the gift is marked
                          isAnonymous=true on the server. The microcopy
                          below is the affirmative confirmation. See
                          feedback_anonymous_as_explicit_flag.md. */}
                      <button
                        type="button"
                        onClick={() => {
                          haptic("selection");
                          setIsAnonymous((v) => {
                            const next = !v;
                            // When flipping anonymous ON, clear any
                            // media the gifter already added. The
                            // toggle's privacy promise is binding;
                            // letting orphan media URLs survive in
                            // state would land them in the submit
                            // body and undermine the promise. The
                            // server enforcement below is the
                            // belt-and-suspenders; this is the
                            // suspenders.
                            if (next) {
                              setPhotoUrl("");
                              setVideoUrl("");
                              setAudioUrl("");
                              setMemoryAttachmentMode("none");
                            }
                            return next;
                          });
                        }}
                        className={`text-[11px] font-semibold rounded-full px-3 py-1 transition-colors ${
                          isAnonymous
                            ? "bg-[hsl(var(--kiddo-evergreen))] text-white"
                            : "bg-muted text-muted-foreground hover:bg-muted/80"
                        }`}
                        data-testid="toggle-gift-anonymously"
                        aria-pressed={isAnonymous}
                      >
                        {isAnonymous ? "✓ Anonymous" : "Gift anonymously"}
                      </button>
                    </div>
                    {!isAnonymous ? (
                      <>
                        <input
                          value={senderName}
                          onChange={(e) => setSenderName(e.target.value)}
                          placeholder="Grandma, Uncle Marcus, Sarah..."
                          className="mt-2 h-12 w-full rounded-2xl border border-border bg-background px-4 text-sm outline-none focus:border-[hsl(var(--kiddo-evergreen))]"
                          data-testid="input-sender-name"
                        />
                        {/* Honest disclosure: the previous copy claimed
                            names were "only" in the Memory Book, but
                            first names also surface on this fund's
                            public gift page (the social-proof "who's
                            already given" list). */}
                        <p className="mt-1.5 text-xs text-muted-foreground leading-relaxed">
                          {senderName.trim()
                            ? <>Your first name will show on {recipientName !== "Recipient" ? `${recipientName}'s` : "this child's"} family Memory Book and as a "who's already given" name on this gift page (so other family members see who's given). Full name stays private.</>
                            : <>If you add a name, the first name will show in the family Memory Book and on the gift page as a "who's already given" name. Or tap "Gift anonymously" above.</>}
                        </p>
                      </>
                    ) : (
                      <div className="mt-2 rounded-2xl border border-[hsl(var(--kiddo-evergreen)/0.30)] bg-[hsl(var(--kiddo-evergreen)/0.05)] px-4 py-3">
                        <p className="text-sm font-semibold text-foreground">Sending as anonymous.</p>
                        <p className="mt-1 text-xs text-muted-foreground leading-relaxed">
                          {recipientName !== "Recipient" ? `${recipientName}'s` : "The"} family will see this gift came in but won&apos;t see your name. You won&apos;t appear in the public &quot;who&apos;s already given&quot; list either.
                        </p>
                      </div>
                    )}
                  </div>
                  <div>
                    <label className="text-sm font-medium text-foreground">
                      Email {isRecurring ? (
                        <span className="text-[hsl(var(--kiddo-evergreen))] font-semibold">(required for recurring)</span>
                      ) : (
                        <span className="text-muted-foreground font-normal">(optional)</span>
                      )}
                    </label>
                    <input
                      value={senderEmail}
                      onChange={(e) => setSenderEmail(e.target.value)}
                      placeholder="you@example.com"
                      type="email"
                      required={isRecurring}
                      className="mt-2 h-12 w-full rounded-2xl border border-border bg-background px-4 text-sm outline-none focus:border-[hsl(var(--kiddo-evergreen))]"
                      data-testid="input-sender-email"
                    />
                    {isRecurring && (
                      <p className="mt-1.5 text-xs text-muted-foreground leading-relaxed">
                        We create a free gifter account at this email so you can manage or cancel the recurring schedule any time.
                      </p>
                    )}
                  </div>
                </div>
              </div>

              <div className="kiddo-card p-5 md:p-6">
                <h2 className="font-heading text-lg font-semibold text-foreground">How would you like to pay?</h2>
                <div className="mt-4 space-y-2">
                  {PAYMENT_METHODS.map((method) => {
                    const Icon = method.icon;
                    const active = paymentMethod === method.id;
                    return (
                      <button key={method.id} type="button" className={`w-full rounded-2xl border p-3.5 text-left transition-all ${active ? "border-[hsl(var(--kiddo-evergreen))] bg-[hsl(var(--kiddo-evergreen)/0.06)] shadow-sm" : "border-[hsl(var(--kiddo-border))] hover:border-[hsl(var(--kiddo-evergreen)/0.35)]"}`} onClick={() => { haptic("selection"); setPaymentMethod(method.id); }} data-testid={`button-payment-${method.id}`}>
                        <div className="flex items-center gap-3">
                          <div className={`flex h-10 w-10 items-center justify-center rounded-xl ${active ? "bg-[hsl(var(--kiddo-evergreen)/0.10)]" : "bg-muted"}`}><Icon size={18} className={active ? "text-[hsl(var(--kiddo-evergreen))]" : "text-muted-foreground"} /></div>
                          <div className="min-w-0 flex-1">
                            <div className="flex flex-wrap items-center gap-2">
                              <p className="text-sm font-medium text-foreground">{method.label}</p>
                              {method.id === "apple_pay" && (
                                <span className="rounded-full bg-[hsl(var(--kiddo-evergreen)/0.10)] px-2 py-0.5 text-[10px] font-medium text-[hsl(var(--kiddo-evergreen))]">Recommended</span>
                              )}
                            </div>
                            <p className="text-xs text-muted-foreground">{method.desc}</p>
                          </div>
                          <div className="text-right"><p className={`text-xs font-medium ${method.id === "bank" ? "text-green-600" : "text-muted-foreground"}`}>{method.feeLine}</p>{method.id === "bank" && achSavings > 0 && <p className="mt-0.5 text-[10px] text-green-600">Save about ${achSavings.toFixed(2)}</p>}</div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="kiddo-card overflow-hidden" data-testid="section-fee-breakdown">
                <div className="p-5 md:p-6">
                  <div className="flex items-center justify-between gap-3"><h2 className="font-heading text-lg font-semibold text-foreground">Order summary</h2><div className="flex items-center gap-1 text-xs text-muted-foreground"><Shield size={11} /><span>Transparent pricing</span></div></div>
                  <div className="mt-4 rounded-2xl border border-[hsl(var(--kiddo-evergreen)/0.10)] bg-[hsl(var(--kiddo-evergreen)/0.06)] p-4">
                    <div className="flex items-center justify-between gap-3"><span className="text-sm font-semibold text-foreground flex items-center gap-1.5"><Gift size={14} className="text-[hsl(var(--kiddo-evergreen))]" />{recipientLooksLikeFund ? "This fund receives" : `${recipientName} receives`}</span><span className="text-lg font-bold text-[hsl(var(--kiddo-evergreen))]" data-testid="text-recipient-receives">${netToFund.toFixed(2)}</span></div>
                    <p className="mt-1 text-xs text-muted-foreground">Your full ${activeAmount.toFixed(2)} gift goes into {destinationFundLabel}. Fees are shown separately before checkout.</p>
                    <p className="mt-2 text-xs font-medium text-[hsl(var(--kiddo-evergreen))]" data-testid="text-payment-provenance">{giftProvenance}</p>
                  </div>

                  <div className="mt-4 space-y-2.5 text-sm">
                    <div className="flex justify-between gap-3"><span className="text-foreground font-medium">Gift amount</span><span className="shrink-0 text-foreground font-medium">${activeAmount.toFixed(2)}</span></div>
                    <div className="flex justify-between gap-3"><span className="text-foreground font-medium">Processing fee ({feeData?.processingFeeRate || (paymentMethod === "bank" ? "0.8%, max $5" : paymentMethod === "paypal" ? "3.49% + $0.49" : "2.9% + $0.30")})</span><span className="shrink-0 text-foreground">${processingFee.toFixed(2)}</span></div>
                    <div className="flex justify-between gap-3">
                      <span className="text-foreground font-medium">Kiddo fee</span>
                      {totalKoraFee > 0 ? <span className="shrink-0 text-foreground">${totalKoraFee.toFixed(2)}</span> : <span className="shrink-0 font-semibold text-green-600">No fee</span>}
                    </div>
                    {platformBaseFee > 0 && <div className="flex justify-between gap-3"><span className="text-muted-foreground">Kiddo flat fee</span><span className="shrink-0 text-foreground">${platformBaseFee.toFixed(2)}</span></div>}
                    {variableKoraFee > 0 && <div className="flex justify-between gap-3"><span className="text-muted-foreground">Kiddo gift fee</span><span className="shrink-0 text-foreground">${variableKoraFee.toFixed(2)}</span></div>}
                    {giftAddOnFee > 0 && (
                      <div className="flex justify-between gap-3" data-testid="line-premium-gift-upgrade"><span className="text-muted-foreground">Premium gift upgrade</span><span className="shrink-0 text-foreground">${giftAddOnFee.toFixed(2)}</span></div>
                    )}
                  </div>

                  <div className="mt-4 border-t border-border pt-4">
                    <div className="flex items-center justify-between gap-3">
                      <span className="text-foreground font-semibold">{isRecurring ? "You pay today" : "You pay"}</span>
                      <span className="text-lg font-bold text-foreground" data-testid="text-total-charge">${totalCharge.toFixed(2)}</span>
                    </div>
                    {isRecurring && (
                      <p className="mt-2 text-xs text-muted-foreground leading-relaxed">
                        Then ${totalCharge.toFixed(2)} every {recurringFrequency === "weekly" ? "week" : recurringFrequency === "yearly" ? "year" : "month"}. Cancel any time from your gifter dashboard.
                      </p>
                    )}
                  </div>
                  <div className="mt-4 rounded-2xl border border-[hsl(var(--kiddo-evergreen)/0.15)] bg-[hsl(var(--kiddo-evergreen)/0.06)] px-4 py-3">
                    <p className="text-xs font-semibold text-[hsl(var(--kiddo-evergreen))]">Where the money goes</p>
                    <p className="mt-1 text-xs text-muted-foreground">{checkoutTrustLineJsx}</p>
                  </div>

                  {totalKoraFee === 0 && (
                    <div className="mt-4 rounded-2xl border border-green-200 bg-green-50 px-4 py-3">
                      <p className="text-sm font-semibold text-green-800">100% of your gift reaches {destinationFundLabel}. You only pay payment processing.</p>
                    </div>
                  )}
                  {giftAddOn !== "none" && (
                    <div className="mt-4 rounded-2xl border border-[hsl(var(--kiddo-evergreen)/0.15)] bg-[hsl(var(--kiddo-evergreen)/0.06)] px-4 py-3">
                      <p className="text-sm font-semibold text-foreground">Memory Book upgrade included.</p>
                      <p className="mt-0.5 text-xs text-muted-foreground">The entry upgrade is charged separately. Your full ${activeAmount.toFixed(2)} gift reaches {destinationFundLabel}.</p>
                    </div>
                  )}

                  <button type="button" className="mt-3 text-left text-xs text-[hsl(var(--kiddo-evergreen))] hover:underline" onClick={() => { haptic("light"); setShowFeeDetails((value) => !value); }} data-testid="button-toggle-fee-details">{showFeeDetails ? "Hide fee details" : "View fee details"}</button>

                  <AnimatePresence initial={false}>
                    {showFeeDetails && (
                      <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.2 }} className="overflow-hidden">
                        <div className="mt-4 space-y-2 text-xs text-muted-foreground">
                          <p>{feeData?.stripeFeeExplanation || (paymentMethod === "bank" ? "ACH processing is charged by Stripe." : paymentMethod === "paypal" ? "PayPal processing is charged by Stripe." : "Card and wallet processing is charged by Stripe.")}</p>
                          <p>{feeData?.koraBaseFeeExplanation || feeData?.koraFeeExplanation || "Kiddo does not charge a normal platform fee on gifts."}</p>
                          <p>{feeData?.koraLargeGiftExplanation || "Kiddo does not add a large-gift fee. For large gifts, ACH usually has the lowest payment-processing cost."}</p>
                          <p>{feeData?.annualAumFeeExplanation || "Kiddo charges a small annual fee on invested assets only. Cash and pending gifts are not charged."}</p>
                          <div className="rounded-2xl bg-muted/60 p-3"><p className="font-medium text-foreground">How Kiddo fees work</p><p className="mt-1">{feeData?.coverageLabel ? `${feeData.coverageLabel} plan. ` : ""}Kiddo does not take a normal platform fee from gifts. Payment processing is passed through. Optional gift upgrades are separate. The invested-assets fee applies later only to money already invested in the fund.</p></div>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              </div>

              {/* "Before you send" warning was a separate amber SectionCard
                  with a header + body. Compressed to a single inline line
                  directly above the CTA — the locked copy ("The best gifts
                  never are") is what's load-bearing, the chrome around it
                  was over-formal for what is essentially a one-sentence
                  reassurance. Keeping it inline keeps the warmth without
                  adding another card to a page that's already content-dense. */}
              <p className="px-1 text-center text-xs leading-relaxed text-muted-foreground" data-testid="text-before-you-send">
                Once sent, gifts are invested for {amountStepChildLabel} and can't be reversed. The best gifts never are.
              </p>

              <Button size="lg" className="kiddo-gold-button h-14 w-full rounded-2xl text-base font-bold" disabled={!canSubmit || isSubmitting} onClick={handlePay} data-testid="button-pay">
                {isSubmitting ? <span className="flex items-center gap-2"><ThinkingOrb size={18} variant="processing" />Opening secure checkout...</span> : <>{paymentMethod === "apple_pay" ? <Smartphone size={16} className="mr-2" /> : paymentMethod === "bank" ? <Building2 size={16} className="mr-2" /> : paymentMethod === "cashapp" ? <DollarSign size={16} className="mr-2" /> : paymentMethod === "paypal" ? <Wallet size={16} className="mr-2" /> : <Lock size={16} className="mr-2" />}Send {recipientLooksLikeFund ? "this" : `${recipientName}'s`} gift</>}
              </Button>

              {!isEmailValid && <p className="text-center text-xs text-red-500">Enter a valid email address or leave it blank.</p>}
              {isRecurring && !hasRecurringEmail && <p className="text-center text-xs text-[hsl(var(--kiddo-evergreen))]" data-testid="text-recurring-email-required">Recurring gifts need an email so you can manage the schedule.</p>}
              {executionModel === "pick" && !selectedStock && <p className="text-center text-xs text-muted-foreground">Choose a company to continue.</p>}
              {payError && <p className="text-center text-sm text-red-500" data-testid="text-pay-error">{payError}</p>}

              <footer className="pb-8 pt-2 text-center space-y-3">
                <TrustMicroStrip />
                {/* SIPC + DriveWealth disclosure lives in the order summary's
                    "Where the money goes" block above. Repeating the same
                    sentence here was making the page read as anxious rather
                    than confident — three identical disclosures on one screen
                    is the tell, not a feature. Keeping just the FAQ /
                    Security / sipc.org links so the legal trail is still
                    one tap away. */}
                <div className="flex flex-wrap justify-center gap-4 text-xs text-muted-foreground">
                  <Link href="/faq" className="hover:text-foreground transition-colors">FAQ</Link>
                  <Link href="/security" className="hover:text-foreground transition-colors">Security</Link>
                  <a href="https://www.sipc.org" target="_blank" rel="noopener noreferrer" className="hover:text-foreground transition-colors">sipc.org</a>
                </div>
              </footer>
            </motion.section>
          )}
        </AnimatePresence>
      </main>
    </div>
  );
}
