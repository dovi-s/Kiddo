import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useParams, useSearch } from "wouter";
import { AnimatePresence, motion } from "framer-motion";
import { ArrowLeft, ArrowRight, Building2, Camera, ChevronDown, CreditCard, DollarSign, Gift, ImagePlus, Link as LinkIcon, Lock, Mic, MicOff, Repeat, Shield, Smartphone, TrendingUp, Video, Wallet } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Logo } from "@/components/ui/logo";
import { FounderBadge } from "@/components/ui/founder-badge";
import { StockLogo } from "@/components/ui/stock-logo";
import { GoalCard } from "@/components/ui/premium-themes";
// Import RichText from the lightweight view module (DOMPurify only) so this
// PUBLIC gift funnel does NOT bundle the ~130KB gzip tiptap editor. 2026-06-04.
import { RichText } from "@/components/ui/rich-text-view";
import { TrustMicroStrip } from "@/components/ui/ux-foundations";
import { usePageSeo } from "@/lib/seo";
import { ThinkingOrb } from "@/components/ui/gemini";
import { haptic } from "@/lib/haptics";
import { capFirst } from "@/lib/format-name";
import { useScrollResetOnChange } from "@/lib/scroll-to-element";
import { trackReferralEvent as trackAcquisitionEvent } from "@/lib/acquisition";
import { getPronouns } from "@/lib/pronouns";
import { buildGiftDraftKey, isMeaningfulGiftDraft, parseGiftDraft, serializeGiftDraft, type GiftDraftFields } from "@/lib/giftDraft";
import { KIDDO_GIFT_ADD_ONS, calculateKoraContributionFee, getGiftAddOn, type GiftAddOnId } from "@shared/monetization";
import { effectiveOccasionDate } from "@shared/occasions";
import { FEATURED_STOCK_PICKS as CANON_FEATURED_STOCK_PICKS, ADDITIONAL_STOCK_PICKS as CANON_ADDITIONAL_STOCK_PICKS } from "@shared/stock-picks";
import { projectFundValue } from "@shared/projection";
import { investingLiveCopy } from "@shared/legal-copy";
import { MemoryMediaPicker, EMPTY_MEMORY_MEDIA, type MemoryMediaValue } from "@/components/MemoryMediaPicker";
import { ReminderAndAskParentsCard } from "@/components/ReminderAndAskParentsCard";
import { SponsorPlusCard } from "@/components/SponsorPlusCard";

const AMOUNTS = [25, 50, 100, 250];
const PAGE_MAX = "kiddo-canvas px-4 sm:px-5";
// Two tiers added 2026-05-25 audit. The server-side ADMIN_ASSET_UNIVERSE
// at server/marketQuotes.ts marks 17 stocks as source='stock_pick' (the
// canonical approved gifter-picker list). The client picker had been
// showing only 9 of them since launch — 8 approved stocks (Adobe, Airbnb,
// Chewy, Comcast, Domino's, Duolingo, Nintendo, Target) were silently
// hidden. Several of the missing 8 are obviously kid-relevant (Nintendo,
// Duolingo, Domino's, Chewy) and should never have been excluded.
//
// Tier structure: FEATURED renders by default (the curated "obvious"
// picks at first glance — preserves the existing UX density of a
// ~2-column 5-row grid). ADDITIONAL renders behind a 'Show more
// options' expander, so the full approved universe is reachable
// without forcing 17 tiles on the initial render.
//
// Both tiers share the same shape: { symbol, name, price, tagline }.
// The live-quotes effect at line ~453 fetches quotes for EVERY symbol
// in both arrays via STOCK_PICKS (the union), so live prices keep
// flowing for both tiers without per-tier plumbing.
//
// Fallback prices are deliberately rough — they only render when the
// live-quotes API fails. Real prices come via /api/market/quotes.
// Derived from the canonical universe (shared/stock-picks.ts) — the single
// source of truth across the gift page, the parent picker, and onboarding.
// Mapped to this surface's {symbol,name,price,tagline} shape; the live-quotes
// effect still fetches every symbol in STOCK_PICKS, so prices flow as before.
const FEATURED_STOCK_PICKS = CANON_FEATURED_STOCK_PICKS.map((s) => ({ symbol: s.ticker, name: s.name, price: s.fallbackPrice, tagline: s.tagline }));
const ADDITIONAL_STOCK_PICKS = CANON_ADDITIONAL_STOCK_PICKS.map((s) => ({ symbol: s.ticker, name: s.name, price: s.fallbackPrice, tagline: s.tagline }));
const STOCK_PICKS = [...FEATURED_STOCK_PICKS, ...ADDITIONAL_STOCK_PICKS];
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
// Payment methods. Order: Apple Pay first (fastest when device supports
// it), card second (universal fallback), Cash App + PayPal in the
// digital-wallet middle (Cash App skews younger, PayPal skews older;
// together they cover demographics card alone misses), bank last
// (cheapest fee, slowest settlement). PayPal is load-bearing for the
// older grandparent demographic: many will refuse to type a card number
// on a website they have never heard of but will happily click "Pay
// with PayPal" because their info is already there. Stripe processes
// it natively (no new vendor relationship). PayPal's US fee via Stripe
// is 3.49% + $0.49, slightly higher than card, but the audience gap
// it covers more than justifies the spread.
//
// Honest-routing note (audit 2026-05-25): the "apple_pay" picker
// option and the "card" picker option both map to Stripe's `card`
// payment_method_type. Stripe automatically renders the Apple Pay /
// Google Pay / Link quick-pay buttons at the top of the page when
// the device supports them; otherwise the gifter sees a card form.
// The Apple Pay desc reflects this so the user is not surprised when
// a non-Apple-Pay device routes them to a card form. Other methods
// (Cash App, PayPal, ACH) lock to their respective rails on Stripe.
const PAYMENT_METHODS = [
  { id: "apple_pay", label: "Apple Pay / Google Pay", icon: Smartphone, desc: "Tap with Face ID or fingerprint (card form on unsupported devices)", feeLine: "~2.9% + $0.30" },
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
    // uniqueGifterCount mirrors the fund-level field on event responses
    // (the public event endpoint also surfaces aggregation). Optional —
    // fallback handled at usage sites.
    uniqueGifterCount?: number;
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
    creatorIsFounder?: boolean;
    childPhotoUrl?: string | null;
    pronoun?: string | null;
    // Public/gifter media uploads gated OFF at launch (server flag
    // PUBLIC_MEDIA_UPLOADS_ENABLED). When false we hide the media picker so a
    // gifter never hits a dead button; text notes stay. See publicMediaFlag.ts.
    gifterMediaEnabled?: boolean;
    // True once the fund has been handed off and the now-adult owns it
    // (server: Boolean(fund.transferredAt)). Flips the gift page to owner-aware
    // framing (no childhood "turns N" milestone; forward-arc projection).
    recipientIsOwner?: boolean;
    // Pricing-v3: gifter UI uses this to decide whether to show the
    // recurring toggle (true → Plus/Family fund) or the reminder-only
    // path with a "ask parents to enable" CTA (false → Free fund).
    // NEVER expose as "the parent's plan" to the gifter.
    recurringSupported?: boolean;
    // Magic-link gifter auth feature flag (locked 2026-05-25). When true,
    // we drop the password field on the recurring step and tell the
    // gifter we'll email them a sign-in link after Stripe success.
    magicLinkAuth?: boolean;
  };
  recentGifters?: Array<{
    name: string;
    // amount is the gifter's CUMULATIVE TOTAL across all their gifts to
    // this fund/event — not the latest gift's amount. Aggregation fix
    // 2026-05-25 (server-side).
    amount: number;
    // count = how many gifts this gifter has sent. count=1 displays as
    // "Uncle · $25 in Nike" (existing); count>1 shows "Uncle · $75 in
    // Nike · 3 gifts" with the destination dropped when gifts targeted
    // different tickers.
    count?: number;
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
  // uniqueGifterCount added 2026-05-25 — distinct from giftCount (total
  // gifts). Used by the "N people have gifted" copy and the avatar
  // carousel so a gifter who gave 3 times counts as ONE person, not 3.
  // Falls back to giftCount when the server hasn't backfilled this
  // field yet (cached responses pre-deploy).
  uniqueGifterCount?: number;
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
  projectFundValue({ startingValue: amount, monthlyContribution: 0, yearsAhead: years, annualReturnRate: rate });

const readFileAsDataUrl = (file: File) =>
  new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ""));
    reader.onerror = () => reject(new Error("Could not read that file."));
    reader.readAsDataURL(file);
  });

const getStrategyLabel = (strategy?: string | null) => {
  const normalized = String(strategy || "").toLowerCase();
  if (normalized === "balanced") return "Balanced Mix";
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

// ── Guestbook note (note-first occasion CTA, founder-locked 2026-06-04) ──
// "The occasion is a guestbook; the money sits under it." On DATED event
// pages only, a guest who isn't gifting money gets a zero-pressure way to
// put a note in the kid's Memory Book — the century-old guestbook norm a
// host will happily share, where "scan to give money" reads as fundraising.
// Note-leavers are also the warmest non-gifter pipeline (they showed up and
// wrote). v1 is TEXT ONLY (photos wait for the content scanner) and every
// note lands pending parent review (payment was the spam filter; approval
// replaces it — see the server endpoint's safety model). Placed at the END
// of the page so it's the graceful exit ramp, never competing with the gift
// flow above.
//
// MEDIA UPGRADE PATH (pre-wired server-side, 2026-06-04): the public fund
// payload carries `guestbookMediaEnabled` (true iff a real content scanner
// is configured), and the guestbook endpoint already accepts
// photoUrl/videoUrl/audioUrl when it is. When the scanner goes live, drop
// the shared <MemoryMediaPicker /> (the same component the GiftSuccess
// post-send recovery uses — "every giving flow exposes the full trio,
// voice is the moat") into this form behind that flag. Until then, no
// hidden dead UI ships.
function GuestbookNoteCard({ fundId, childName, onAddGiftToo }: { fundId?: string | null; childName: string; onAddGiftToo?: (name: string, email: string) => void }) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [note, setNote] = useState("");
  const [sending, setSending] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);
  if (!fundId) return null;

  const submit = async () => {
    if (sending) return;
    setError(null);
    if (!name.trim() || note.trim().length < 2) {
      setError("A name and a note are all it takes.");
      return;
    }
    setSending(true);
    try {
      const res = await fetch(`/api/public/funds/${encodeURIComponent(fundId)}/guestbook-note`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: name.trim(), note: note.trim(), email: email.trim() }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data?.error || "Could not save your note. Please try again.");
        return;
      }
      haptic("success");
      setDone(true);
    } catch {
      setError("Could not save your note. Please try again.");
    } finally {
      setSending(false);
    }
  };

  if (done) {
    return (
      <div className="rounded-2xl border border-[hsl(var(--kiddo-evergreen)/0.25)] bg-[hsl(var(--kiddo-evergreen)/0.05)] p-5 text-center" data-testid="guestbook-note-success">
        <p className="text-sm font-semibold text-foreground">Your note is on its way to {childName}'s Memory Book 🌱</p>
        <p className="mt-1 text-xs text-muted-foreground leading-relaxed">
          The family takes a look first, then it joins the story.
        </p>
        <button
          type="button"
          onClick={() => {
            haptic("selection");
            // Carry the guest's identity into the gift form — the warmest
            // convert in the funnel should never retype their own name.
            // (Their note is already in the pending tray; we deliberately
            // do NOT copy it into the gift message — that would hand the
            // family a duplicate to moderate.)
            onAddGiftToo?.(name.trim(), email.trim());
            window.scrollTo({ top: 0, behavior: "smooth" });
          }}
          className="mt-3 text-xs font-semibold text-[hsl(var(--kiddo-evergreen))] underline underline-offset-2"
          data-testid="guestbook-add-gift-too"
        >
          Want to add a gift with it? Takes a few seconds →
        </button>
      </div>
    );
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => { haptic("selection"); setOpen(true); }}
        className="w-full rounded-2xl border border-dashed border-[hsl(var(--kiddo-border))] bg-card px-5 py-4 text-center text-sm text-muted-foreground hover:text-foreground hover:border-[hsl(var(--kiddo-evergreen)/0.4)] transition-colors"
        data-testid="button-open-guestbook-note"
      >
        Just here to celebrate? <span className="font-semibold text-foreground">Leave {childName} a note</span> for the Memory Book. No payment, no account.
      </button>
    );
  }

  return (
    <div className="rounded-2xl border border-[hsl(var(--kiddo-border))] bg-card p-5 space-y-3" data-testid="guestbook-note-form">
      <div>
        <p className="text-sm font-semibold text-foreground">A note for {childName}'s Memory Book</p>
        <p className="mt-0.5 text-xs text-muted-foreground">
          {childName} reads these for years. The family reviews notes before they appear.
        </p>
      </div>
      {/* aria-labels: placeholder-only inputs lose their accessible name the
          moment the user types (and screen readers treat placeholders
          unevenly). autoComplete lets the browser fill name/email in one tap;
          this is a no-account guest form, so every keystroke saved matters. */}
      <input
        type="text"
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder="Your name"
        aria-label="Your name"
        autoComplete="name"
        maxLength={80}
        className="h-11 w-full rounded-xl border border-border bg-background px-3 text-base sm:text-sm outline-none focus:border-primary"
        data-testid="input-guestbook-name"
      />
      <textarea
        value={note}
        onChange={(e) => setNote(e.target.value)}
        placeholder={`From you to ${childName}...`}
        aria-label={`Your note for ${childName}`}
        rows={3}
        maxLength={500}
        className="w-full rounded-xl border border-border bg-background px-3 py-2 text-base sm:text-sm outline-none focus:border-primary resize-none"
        data-testid="textarea-guestbook-note"
      />
      <input
        type="email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        placeholder="Email (optional)"
        aria-label="Email (optional)"
        autoComplete="email"
        maxLength={254}
        className="h-11 w-full rounded-xl border border-border bg-background px-3 text-base sm:text-sm outline-none focus:border-primary"
        data-testid="input-guestbook-email"
      />
      {/* The email field's honest job — without a stated purpose an optional
          email field collects nothing. This promise is KEPT by the approval
          email (server templates/guestbookNoteApproved, sent on the real
          pending-to-published transition; silence on rejection by design). */}
      <p className="text-[11px] text-muted-foreground/70 -mt-1">
        Leave your email and we'll tell you when your note joins the story.
      </p>
      {error && <p className="text-xs text-red-600" data-testid="text-guestbook-error">{error}</p>}
      <div className="flex items-center gap-3">
        <Button size="sm" className="rounded-xl" onClick={submit} disabled={sending} data-testid="button-send-guestbook-note">
          {sending ? "Sending..." : "Add to the Memory Book"}
        </Button>
        <button
          type="button"
          onClick={() => { haptic("light"); setOpen(false); }}
          className="text-xs text-muted-foreground hover:text-foreground"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}

export default function GiftCheckout() {
  const { fund: fundSlug, event: eventSlug } = useParams<{ fund: string; event?: string }>();
  const searchString = useSearch();
  const [step, setStep] = useState<GiftStep>("landing");
  useScrollResetOnChange(step);
  // A child's gift page is private — keep it OUT of search indexes (it carries
  // the child's name). Shared via a private link, never crawled. Mirrors the
  // X-Robots-Tag + meta the og middleware sets for the scraper-facing variant.
  usePageSeo({
    title: "Send a gift that grows | Kiddo",
    description: "Give a child a real investment gift in a few seconds. No account needed.",
    robots: "noindex, nofollow",
  });
  const [selectedAmount, setSelectedAmount] = useState(50);
  const [showCustom, setShowCustom] = useState(false);
  const [customAmount, setCustomAmount] = useState("");
  const [executionModel, setExecutionModel] = useState<ExecutionModel>("auto");
  const [selectedStock, setSelectedStock] = useState<string | null>(null);
  // "Request a company" escape hatch — the bounded picker is never a hard wall.
  const [stockRequestOpen, setStockRequestOpen] = useState(false);
  const [stockRequestText, setStockRequestText] = useState("");
  const [stockRequestSent, setStockRequestSent] = useState(false);
  const [stockRequestSending, setStockRequestSending] = useState(false);
  const [stockRequestError, setStockRequestError] = useState(false);
  // Stock-picker expansion state. The picker shows FEATURED 9 by default
  // (curated landing-density); tapping "Show more options" expands to
  // include the ADDITIONAL 8 approved stocks. Re-collapses when the
  // gifter switches to family-default mode (no point keeping 17 tiles
  // visible if the picker is disabled). Per 2026-05-25 audit closing
  // the gap between the server's 17 approved picker stocks and the
  // client's hardcoded 9.
  const [showMoreStocks, setShowMoreStocks] = useState(false);
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
  // Apple Pay default — gated to iOS / macOS user agents 2026-05-25 audit.
  // The 'Recommended' pill + the default selection used to apply on ALL
  // devices, but Apple Pay only actually surfaces in Stripe Checkout on
  // Safari / iOS / macOS. On Chrome on Windows or any Android device,
  // tapping Apple Pay falls back to Card silently — mislead-then-fallback.
  // Now: detect the platform once at mount, default to "card" on non-
  // Apple devices, and gate the 'Recommended' pill behind the same flag.
  const isAppleDevice = useMemo(() => {
    if (typeof navigator === "undefined") return false;
    return /iPhone|iPad|iPod|Mac/.test(navigator.userAgent) && !/Windows/.test(navigator.userAgent);
  }, []);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>(isAppleDevice ? "apple_pay" : "card");
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

  // ── Gift draft persistence ─────────────────────────────────────────────
  // Survives refresh + the Stripe-hosted-checkout cancel path (cancel_url
  // remounts this page) so the gifter's composed message/media/amount is
  // never wiped at the moment of maximum intent. All logic (allowlist
  // serialization that can never persist a credential, validating parse,
  // TTL) lives in lib/giftDraft.ts — tested by script/test-gift-draft.ts.
  // GiftSuccess clears all drafts once a payment completes.
  const draftKey = buildGiftDraftKey(fundSlug, eventSlug);
  useEffect(() => {
    // Restore FIRST (declared before the save effect below so the empty
    // first-mount save pass can't clobber an existing draft before it's
    // been read).
    try {
      const raw = sessionStorage.getItem(draftKey);
      const d = parseGiftDraft(raw, Date.now());
      if (!d) {
        if (raw) sessionStorage.removeItem(draftKey); // stale/garbage cleanup
        return;
      }
      if (d.selectedAmount !== undefined) setSelectedAmount(d.selectedAmount);
      if (d.showCustom !== undefined) setShowCustom(d.showCustom);
      if (d.customAmount !== undefined) setCustomAmount(d.customAmount);
      if (d.executionModel !== undefined) setExecutionModel(d.executionModel);
      if (d.selectedStock !== undefined) setSelectedStock(d.selectedStock);
      if (d.senderName !== undefined) setSenderName(d.senderName);
      if (d.senderEmail !== undefined) setSenderEmail(d.senderEmail);
      if (d.isAnonymous !== undefined) setIsAnonymous(d.isAnonymous);
      if (d.message !== undefined) setMessage(d.message);
      if (d.memoryAttachmentMode !== undefined) setMemoryAttachmentMode(d.memoryAttachmentMode);
      if (d.photoUrl !== undefined) setPhotoUrl(d.photoUrl);
      if (d.videoUrl !== undefined) setVideoUrl(d.videoUrl);
      if (d.audioUrl !== undefined) setAudioUrl(d.audioUrl);
      if (d.giftAddOn !== undefined) setGiftAddOn(d.giftAddOn as GiftAddOnId);
      if (d.isRecurring !== undefined) setIsRecurring(d.isRecurring);
      if (d.recurringFrequency !== undefined) setRecurringFrequency(d.recurringFrequency);
      if (d.step !== undefined) setStep(d.step);
    } catch {
      // Blocked storage — start clean, never break checkout.
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [draftKey]);
  useEffect(() => {
    const fields: GiftDraftFields = {
      step, selectedAmount, showCustom, customAmount,
      executionModel, selectedStock,
      senderName, senderEmail, isAnonymous,
      message, memoryAttachmentMode, photoUrl, videoUrl, audioUrl,
      giftAddOn, isRecurring, recurringFrequency,
    };
    try {
      if (!isMeaningfulGiftDraft(fields)) {
        // The gifter consciously emptied the form — drop the draft instead
        // of resurrecting it on refresh. Safe unconditionally: the restore
        // effect above is declared first, so on mount it has already READ
        // any existing draft before this empty-state pass removes it; the
        // post-restore re-render writes it straight back.
        sessionStorage.removeItem(draftKey);
        return;
      }
      sessionStorage.setItem(draftKey, serializeGiftDraft(fields, Date.now()));
    } catch {
      // Storage full/blocked — degrade silently to pre-draft behavior.
    }
  }, [
    draftKey, step, selectedAmount, showCustom, customAmount, executionModel,
    selectedStock, senderName, senderEmail, isAnonymous, message,
    memoryAttachmentMode, photoUrl, videoUrl, audioUrl, giftAddOn,
    isRecurring, recurringFrequency,
  ]);

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
      return { event: { id: fundData.permanentEventId || "", name: "Gift anytime", giftCount: fundData.giftCount ?? 0, uniqueGifterCount: fundData.uniqueGifterCount ?? fundData.giftCount ?? 0 }, fund: fundData.fund, giftCount: fundData.giftCount ?? 0, uniqueGifterCount: fundData.uniqueGifterCount ?? fundData.giftCount ?? 0, recentGifters: (fundData.recentGifters ?? []) as Array<{ name: string; amount: number; count?: number; ticker?: string | null; tickerName?: string | null; executionModel?: string | null }>, activeEvents: fundData.activeEvents || [], permanentEventSlug: fundData.permanentEventSlug || null, yearsUntil18: fundData.yearsUntil18 };
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
    // Effective date rolls a birthday to its next occurrence (@shared/occasions)
    // so a recurring birthday counts down to the upcoming one and never reads as
    // past. effectiveOccasionDate parses plain "YYYY-MM-DD" and full ISO alike.
    const effDate = effectiveOccasionDate(eventData?.event);
    if (!effDate) { setCountdown(null); return; }
    const compute = () => {
      const target = effDate;
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
  }, [eventData?.event?.eventDate, eventData?.event?.eventType]);

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

  // ?sponsor=1 deep-link auto-scroll. When the gifter lands via the
  // gifter-dashboard 'Cover Plus' pill or the gift-receipt email's
  // Sponsor-Plus CTA, surface the SponsorPlusCard sidebar immediately
  // rather than making them hunt for it on the page. Runs after the
  // page has had time to mount + the SponsorPlusCard's eligibility
  // query resolves. Honors prefers-reduced-motion via the smooth
  // scroll fallback. No-op when the fund isn't Free-tier eligible
  // (the card itself doesn't render in that case, so #sponsor-plus-card
  // resolves to nothing and the scroll is silently skipped).
  const sponsorAnchorActive = useMemo(() => {
    const params = new URLSearchParams(searchString || "");
    return params.get("sponsor") === "1";
  }, [searchString]);
  useEffect(() => {
    if (!sponsorAnchorActive || !eventData?.fund) return;
    const timer = window.setTimeout(() => {
      const el = document.getElementById("sponsor-plus-card");
      if (el) {
        el.scrollIntoView({ behavior: "smooth", block: "start" });
      }
    }, 800);
    return () => window.clearTimeout(timer);
  }, [sponsorAnchorActive, eventData?.fund]);

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
  // uniqueGifterCount used by every "N people have gifted" copy site +
  // the avatar carousel. Falls back to giftCount when the server hasn't
  // backfilled the field (older deployments / cached responses), but
  // the canonical truth is: this is the count of UNIQUE people, never
  // the total gift count. Fix shipped 2026-05-25 after the user-flagged
  // "uncle gave many times — is the total right?" bug audit.
  const uniqueGifterCount = eventData?.event?.uniqueGifterCount ?? eventData?.uniqueGifterCount ?? giftCount;
  const recentGifters: Array<{
    name: string;
    amount: number;
    count?: number;
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
  // Fallback to 0, NOT 18: a missing value must NOT silently project 18 years of
  // growth mislabeled "when {child} turns {majority}" (that over-stated the gift —
  // founder caught a transient "$50 → $166 at 21" when the field briefly didn't
  // arrive). 0 routes to the honest forward-arc ("in 10/20 years") instead.
  const yearsUntil18 = eventData?.yearsUntil18 ?? 0;
  // Explicit owner-fund signal (server sets Boolean(fund.transferredAt)). Drives
  // the gift page's owner framing + the forward-arc projection DIRECTLY, so it
  // never depends on yearsUntil18 reaching 0 through the server+wrapper layers —
  // an owner fund can't fall back to the childhood "turns N" framing.
  const recipientIsOwner = Boolean((eventData?.fund as any)?.recipientIsOwner);
  const fundPronouns = getPronouns(eventData?.fund?.pronoun);
  // State-specific UTMA majority age (21 in most states; 18 in some, e.g. CA/KY; 19 in AL/NE).
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
          // Password is sent only when the magic-link flag is OFF for the
          // fund. When ON, the server expects NO password and dispatches
          // a magic-link welcome email after the Stripe success webhook.
          // Per project_recurring_gifting_without_password_spec.md.
          accountPassword: isRecurring && eventData?.fund?.magicLinkAuth !== true ? recurringPassword : undefined,
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
                    {recipientName}&apos;s fund is still open. Gifts go to the same fund, get invested the same way, and land in the same Memory Book.
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
                    {recipientName}&apos;s fund is always open. Gifts go to the same fund, get invested the same way, and land in the same Memory Book.
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
  const checkoutTrustLine = "When investing is live, assets are held by our broker-dealer partner (Member FINRA/SIPC). Eligible accounts are then protected up to $500,000 against broker-dealer failure. This does not cover market losses. sipc.org";
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
      {"When investing is live, assets are held by our broker-dealer partner (Member FINRA/SIPC). Eligible accounts are then protected up to $500,000 against broker-dealer failure. This does not cover market losses. "}
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
      : `${strategyLabel} mix`;
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
    // Owner-held fund (the now-adult owns it post-handoff): there is no majority
    // milestone, and a fixed age can already be in the past ("turns 21" for a
    // 22-year-old). A FORWARD arc reads true at any age. Gated on the explicit
    // recipientIsOwner flag so it short-circuits BEFORE the yearsUntil18 branches
    // and can never render a childhood horizon, regardless of data plumbing.
    if (recipientIsOwner) {
      return {
        headline: `${src} today → ~${fmt(g(10))} in 10 years. ~${fmt(g(20))} in 20 years. 🌱`,
        tagline: "This gift keeps compounding over time. Based on 7% historical returns, not guaranteed.",
      };
    }
    // Years from today to a milestone age, RELATIVE to this fund's majority age
    // (UTMA majority is 18–21 by state). Previously hardcoded as +7/+12 from 18,
    // which mislabeled the math on a 21 fund ("grow to 25" actually computed age
    // 28). yearsUntil18 is years-to-majority despite the legacy name.
    const yToAge = (age: number) => Math.max(0, yearsUntil18 + (age - fundMajorityAge));
    const yTo25 = yToAge(25);
    const yTo30 = yToAge(30);
    const yTo40 = yToAge(40);

    if (yearsUntil18 >= 10) {
      // Young child — the majority arc is already big, but the gift's real power is
      // the lifetime runway, so show a far "keep growing" horizon too (founder ask
      // 2026-06-16: show higher/further ages, not just majority). 40 is a meaningful
      // jump for a young kid; the gift-card comparison still does its work below.
      const atMajority = fmt(g(yearsUntil18));
      const at40 = yTo40 >= 3 ? fmt(g(yTo40)) : null;
      return {
        headline: `${src} today → ~${atMajority} when ${child} turns ${fundMajorityAge}.${at40 ? ` And ~${at40} by 40 if ${fundPronouns.subject} keep${fundPronouns.singular ? "s" : ""} it growing. 🌱` : ""}`,
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
        tagline: `It keeps growing well past ${fundMajorityAge}. 🌱 Based on 7% historical returns. Not guaranteed.`,
      };
    }
    // At/past majority (an owner-held fund, or an adult's personal account):
    // there's no "turns N" milestone, and fixed ages like 25/30 can already be
    // in the past. Project a FORWARD arc from today so it's true at ANY age —
    // dynamic regardless of account type. Minors get the majority arc above;
    // adults/owners get this. (Server reports yearsUntil18=0 for owner funds.)
    const in10 = fmt(g(10));
    const in20 = fmt(g(20));
    return {
      headline: `${src} today → ~${in10} in 10 years. ~${in20} in 20 years. 🌱`,
      tagline: "This gift keeps compounding over time. Based on 7% historical returns. Not guaranteed.",
    };
  })();

  const currentOccasion = (() => {
    type OccasionMeta = { emoji: string; headline: string; sub: string; notePlaceholder: string };
    const nm = recipientName;
    const n = String(eventData?.event?.name || "").toLowerCase();
    const cultural: [RegExp, OccasionMeta][] = [
      [/mitzvah/i,                  { emoji: "✡️", headline: `Celebrate ${nm}'s B'nai Mitzvah!`, sub: `A once-in-a-lifetime milestone. These shares grow with ${nm} from today.`, notePlaceholder: `Mazel tov! Leave ${nm} a message...` }],
      [/hanukkah|chanukah/i,        { emoji: "🕎", headline: `Happy Hanukkah, ${nm}!`, sub: `Eight nights of celebration, and a gift that grows for a lifetime.`, notePlaceholder: `Chag Sameach! Leave ${nm} a message...` }],
      [/quincea/i,                  { emoji: "🌺", headline: `Feliz Quinceañera, ${nm}!`, sub: `Turning 15 is a milestone worth celebrating.`, notePlaceholder: `Leave ${nm} a Quinceañera message...` }],
      [/first communion|communion/i,{ emoji: "✝️", headline: `${nm}'s First Communion`, sub: `A meaningful milestone, marked with a gift that grows.`, notePlaceholder: `Leave ${nm} a blessing...` }],
      [/confirmation/i,             { emoji: "✝️", headline: `${nm}'s Confirmation`, sub: `A step of faith, marked with a gift that keeps growing with them.`, notePlaceholder: `Leave ${nm} a message of faith...` }],
      [/diwali|deepavali/i,         { emoji: "🪔", headline: `Happy Diwali, ${nm}!`, sub: `Light, prosperity, and a gift that compounds for years.`, notePlaceholder: `Happy Diwali! Leave ${nm} a message...` }],
      [/eid/i,                      { emoji: "☪️", headline: `Eid Mubarak, ${nm}!`, sub: `A blessed celebration and a future full of growth.`, notePlaceholder: `Eid Mubarak! Leave ${nm} a message...` }],
      [/lunar new year|chinese new year/i, { emoji: "🏮", headline: `Happy New Year, ${nm}!`, sub: `A new year, a new gift for ${nm}'s future.`, notePlaceholder: `Leave ${nm} a new year message...` }],
      [/kwanzaa/i,                  { emoji: "🕯️", headline: `Happy Kwanzaa, ${nm}!`, sub: `Celebrate the harvest. Give ${nm} something that lasts.`, notePlaceholder: `Leave ${nm} a Kwanzaa message...` }],
    ];
    for (const [re, meta] of cultural) {
      if (re.test(n)) return meta;
    }
    const byType: Record<string, OccasionMeta> = {
      birthday:    { emoji: "🎂", headline: `It's ${nm}'s Birthday!`, sub: investingLiveCopy(`Give ${nm} a gift that actually grows, in real stocks invested in their name.`, `Give ${nm} a gift that grows for their future, invested in their name once investing is live.`), notePlaceholder: `Leave ${nm} a birthday message...` },
      baby_shower: { emoji: "🍼", headline: `Welcome ${nm} to the world!`, sub: investingLiveCopy(`Start them off right with a real investment in their name.`, `Start them off right with a fund in their name, invested once investing is live.`), notePlaceholder: `Leave a warm welcome note...` },
      graduation:  { emoji: "🎓", headline: `Congrats, ${nm}!`, sub: `A graduation gift that grows over time. Start it now.`, notePlaceholder: `Leave ${nm} a congratulations message...` },
      holiday:     { emoji: "🎁", headline: `A Gift for ${nm}'s Future!`, sub: `This season, give something that keeps growing.`, notePlaceholder: `Season's greetings to ${nm}...` },
      just_because:{ emoji: "💚", headline: `Surprise ${nm}!`, sub: `A gift they'll thank you for in 15 years.`, notePlaceholder: `Leave ${nm} a note...` },
    };
    return byType[eventData?.event?.eventType || ""] || { emoji: "🎁", headline: `A gift for ${nm}'s future`, sub: investingLiveCopy(`Give a gift that actually grows, in real stocks invested in their name.`, `Give a gift that grows for their future, invested in their name once investing is live.`), notePlaceholder: `Leave ${nm} a note...` };
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
            {/* Cash-only banner color sweep 2026-05-25 audit. Was
                amber (border-amber-200 / bg-amber-50 / text-amber-900)
                which by color convention reads as 'warning, caution
                required.' But the actual message is reassuring info
                ("this fund is in cash-only mode; the family invests
                it when ready"). Color/copy mismatch made the gifter
                anxious about an action that isn't risky. Now uses the
                kiddo-evergreen tint family that the rest of the
                checkout's informational callouts use. */}
            {fundAvailability?.state === "cash_only" && (
              <div className="rounded-2xl border border-[hsl(var(--kiddo-evergreen)/0.25)] bg-[hsl(var(--kiddo-evergreen)/0.06)] px-4 py-3 text-sm" data-testid="banner-fund-cash-only">
                <p className="font-medium text-foreground">{fundAvailability.title}</p>
                <p className="mt-1 text-muted-foreground">{fundAvailability.message}</p>
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
                              {/* Avatar carousel sized to uniqueGifterCount
                                  2026-05-25. Was sized to giftCount which
                                  inflated when any gifter gave more than
                                  once (uncle giving 3 times appeared as
                                  "+2" badge despite only 1 unique person).
                                  Now: one avatar per unique gifter, capped
                                  at 5. The "+N" badge reflects unique
                                  people beyond the visible set. */}
                              <div className="flex -space-x-1.5">
                                {Array.from({ length: Math.min(uniqueGifterCount, 5) }).map((_, i) => (
                                  <div key={i} className="flex h-6 w-6 items-center justify-center rounded-full border-2 border-white/30 bg-white/20 backdrop-blur-sm" style={{ zIndex: 5 - i }}>
                                    {recentGifters[i] ? <span className="text-[9px] font-bold text-white">{recentGifters[i].name[0].toUpperCase()}</span> : <span className="text-[9px] text-white/80">♥</span>}
                                  </div>
                                ))}
                                {uniqueGifterCount > 5 && <div className="flex h-6 w-6 items-center justify-center rounded-full border-2 border-white/30 bg-white/20 backdrop-blur-sm" style={{ zIndex: 0 }}><span className="text-[9px] font-bold text-white">+{uniqueGifterCount - 5}</span></div>}
                              </div>
                              <span className="text-xs font-medium text-white/75">
                                {/* Scoped to the FUND, not this occasion. uniqueGifterCount
                                    and recentGifters are fund-LIFETIME (the server sends the
                                    fund-level field on event responses), so on a birthday
                                    page months away, a bare "have already given" reads as
                                    "given to the birthday" — false (nobody has, the date is
                                    in the future). Per the one-pot model ("the birthday is
                                    just how we're celebrating it; money goes to the fund"),
                                    the honest framing names the fund: these people back the
                                    fund this birthday gift will join. */}
                                {uniqueGifterCount} {uniqueGifterCount === 1 ? "person has" : "people have"} already given to {recipientName}&apos;s fund.{goalAmount && goalAmount > giftVolume ? ` $${(goalAmount - giftVolume).toLocaleString()} to go.` : ""}
                              </span>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Countdown — visible only when the event date is in the future */}
                  {countdown && (
                    countdown.days >= 90 ? (() => {
                      // Far-future event (a graduation years out, etc.): a ticking
                      // days:hours:mins countdown is absurd at this range ("1458
                      // Days : 13 Hours : 57 Mins"). Show the date + how far away the
                      // occasion is. NOTE: this is the countdown to the EVENT, not the
                      // growth horizon — the gift grows until majority (~18), which the
                      // projection line states. Labeling it "to grow" read as "the gift
                      // only grows for 5 months," contradicting the page's own
                      // "$50 → $82 at 18" pitch. Fixed 2026-06-09.
                      const evDate = effectiveOccasionDate(eventData?.event) ?? new Date(NaN);
                      const dateLabel = Number.isFinite(evDate.getTime())
                        ? evDate.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric", timeZone: "UTC" })
                        : null;
                      const yrs = Math.round(countdown.days / 365);
                      const countdownLabel = countdown.days >= 365
                        ? `about ${yrs} year${yrs === 1 ? "" : "s"} away`
                        : `about ${Math.round(countdown.days / 30)} months away`;
                      return (
                        <div className="kiddo-card p-4 flex items-center justify-center gap-3 text-center">
                          <span className="text-xl shrink-0" aria-hidden="true">🌱</span>
                          <div>
                            {dateLabel && <p className="font-heading text-lg font-bold text-foreground">{dateLabel}</p>}
                            <p className="mt-0.5 text-[11px] font-medium text-muted-foreground">{countdownLabel}</p>
                          </div>
                        </div>
                      );
                    })() : (
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
                    )
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
                                Still open, and every gift keeps growing. The {passedLabel} date has passed, but the fund stays open.
                              </p>
                            </>
                          ) : (
                            <>
                              <p className="text-sm font-semibold text-foreground">
                                The {passedLabel} date passed.
                              </p>
                              <p className="mt-0.5 text-xs text-muted-foreground leading-relaxed">
                                Your gift still goes straight to {recipientName}&apos;s fund. You can give whenever you like.
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
                        <input inputMode="decimal" value={customAmount} onChange={(e) => setCustomAmount(e.target.value.replace(/[^\d.]/g, ""))} placeholder="Enter your own amount" className="w-full bg-transparent text-foreground outline-none" autoFocus />
                      ) : "Other amount"}
                    </button>

                    {/* Feature parity 2026-05-25 audit: the occasion-event
                        landing is a fast-path (amount + note + Give in one
                        screen). The fund-anytime path goes through a
                        separate amount step at line 1709 that shows the
                        per-amount projection AND a large-gift reassurance
                        for $500+ gifts; occasion-event gifters were
                        bypassing both. Adding the two affordances inline
                        here preserves the fast-path while closing the
                        feature gap. Recurring is intentionally NOT added —
                        a "recurring Hanukkah gift" is semantically odd
                        (the occasion is the one-time moment); recurring
                        belongs on the fund-anytime amount step where the
                        gifter is committing to the relationship, not the
                        moment. */}
                    {amountProjection && (
                      <div className="rounded-xl bg-[hsl(var(--kiddo-gold)/0.10)] border border-[hsl(var(--kiddo-gold)/0.30)] px-4 py-3">
                        <p className="text-sm font-semibold text-foreground">{amountProjection.headline}</p>
                        <p className="mt-0.5 text-xs text-muted-foreground">{amountProjection.tagline}</p>
                      </div>
                    )}
                    {Number.isFinite(activeAmount) && activeAmount >= 500 && (
                      <div className="rounded-xl border border-[hsl(var(--kiddo-evergreen)/0.25)] bg-[hsl(var(--kiddo-evergreen)/0.05)] px-4 py-3">
                        <p className="text-[12px] leading-relaxed text-foreground">
                          <span className="font-semibold">Large gifts welcome.</span> {activeAmount >= 1000 ? "Gifts of $1,000 or more settle the same way as smaller gifts; some get a short verification hold, up to 24 hours. " : ""}No hidden maximum. When investing is live, assets are held by our broker-dealer partner (Member FINRA / SIPC) in {recipientLooksLikeFund ? "the child" : recipientName}'s UTMA custodial account.
                        </p>
                      </div>
                    )}

                    <textarea
                      value={message}
                      onChange={(e) => setMessage(e.target.value)}
                      placeholder={currentOccasion.notePlaceholder}
                      rows={2}
                      className="w-full rounded-xl border border-border bg-background px-3 py-2.5 text-base sm:text-sm resize-none outline-none focus:border-[hsl(var(--kiddo-evergreen))] placeholder:text-muted-foreground"
                    />
                    <Button size="lg" className="kiddo-gold-button h-14 w-full rounded-2xl text-base font-bold" disabled={!isValidAmount} onClick={() => { haptic("selection"); trackGiftEvent("cta_click", "gift_occasion_start", { destination: "preview_step", amount: activeAmount }); setStep("preview"); }} data-testid="button-start-gift">
                      {currentOccasion.emoji} Give ${isValidAmount ? activeAmount.toFixed(2) : "..."} to {recipientName}
                      <ArrowRight size={16} className="ml-2" />
                    </Button>
                    <p className="text-center text-xs text-muted-foreground">No account needed. Takes seconds.</p>
                    {isOccasionEvent && (
                      <p className="text-center text-xs text-muted-foreground/70 leading-relaxed">
                        Your gift goes directly into {recipientName}&apos;s fund. The {(eventData?.event?.name || "occasion").replace(/^\S+['’]s?\s+/, "").toLowerCase().trim() || "occasion"} is just how we&apos;re celebrating it. 🌱
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
                          // gifter.amount is the CUMULATIVE TOTAL across
                          // all their gifts (server aggregation fix
                          // 2026-05-25). count > 1 signals a multi-gift
                          // gifter — appends "· N gifts" so "Uncle · $75
                          // in Nike · 3 gifts" replaces the prior
                          // bug where Uncle's three rows said $25 each.
                          const giftRepeatCount = gifter.count ?? 1;
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
                                  {giftRepeatCount > 1 && (
                                    <span className="text-muted-foreground"> · {giftRepeatCount} gifts</span>
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
                    {[{ icon: "🛡", label: "Regulated broker" }, { icon: "⚡", label: "Seconds" }, { icon: "🎁", label: "Memory Book" }].map(({ icon, label }) => (
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
                    {recipientIsOwner
                      ? <>{recipientLooksLikeFund ? "A private gift link to this fund" : `${recipientName} shared their fund with you`}. 🎁</>
                      : <>Someone who loves {recipientLooksLikeFund ? "this child" : recipientName} shared this with you. 🎁</>}
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
                          <p className="mt-3 max-w-2xl text-base font-semibold text-white/90">No account needed. Takes seconds.</p>
                          <div className="mt-4 grid grid-cols-3 gap-2 text-xs text-white" data-testid="grid-gift-first-answers">
                            <div className="rounded-2xl bg-white/15 px-3 py-2.5 backdrop-blur-sm text-center"><span className="text-lg leading-none">🌱</span><p className="mt-1 font-semibold">Invested</p></div>
                            <div className="rounded-2xl bg-white/15 px-3 py-2.5 backdrop-blur-sm text-center"><span className="text-lg leading-none">🔒</span><p className="mt-1 font-semibold">Secure</p></div>
                            <div className="rounded-2xl bg-white/15 px-3 py-2.5 backdrop-blur-sm text-center"><span className="text-lg leading-none">⚡</span><p className="mt-1 font-semibold">Seconds</p></div>
                          </div>
                          {eventData.event.name && eventData.event.name !== "Gift anytime" && !eventData.event.isPermanent && (
                            <div className="mt-3 hidden items-center gap-1.5 rounded-full bg-white/15 backdrop-blur-sm px-3 py-1.5 md:inline-flex">
                              <TrendingUp size={12} className="text-white/90" />
                              <span className="text-xs text-white/90 font-medium">Gifts go into {recipientLooksLikeFund ? "this" : `${recipientName}'s`} fund</span>
                            </div>
                          )}
                          <div className="mt-4 hidden flex-wrap items-center gap-3 text-xs md:flex md:text-sm text-white/85">
                            <span className="inline-flex items-center gap-2">
                              <span>{eventData.fund.creatorFirstName ? `Created by ${eventData.fund.creatorFirstName}` : `Created for ${recipientLooksLikeFund ? "this fund" : recipientName}`}</span>
                              {eventData.fund.creatorIsFounder && <FounderBadge tone="onDark" />}
                            </span>
                            <span className="hidden md:inline">|</span>
                            <span>{uniqueGifterCount > 0 ? `${uniqueGifterCount} ${uniqueGifterCount === 1 ? "person has" : "people have"} gifted so far` : "Be the one who starts it."}</span>
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
                                {Array.from({ length: Math.min(uniqueGifterCount, 5) }).map((_, i) => (
                                  <div key={i} className="flex h-7 w-7 items-center justify-center rounded-full border-2 border-white/30 bg-white/20 backdrop-blur-sm" style={{ zIndex: 5 - i }}>
                                    {recentGifters[i] ? <span className="text-[10px] font-bold text-white">{recentGifters[i].name[0].toUpperCase()}</span> : <span className="text-[10px] text-white/80">♥</span>}
                                  </div>
                                ))}
                                {uniqueGifterCount > 5 && <div className="flex h-7 w-7 items-center justify-center rounded-full border-2 border-white/30 bg-white/20 backdrop-blur-sm" style={{ zIndex: 0 }}><span className="text-[10px] font-bold text-white">+{uniqueGifterCount - 5}</span></div>}
                              </div>
                              {/* Caption deliberately omits the recipient's name. "X people
                                  have gifted Emma." puts the kid as object-of-community-love
                                  which edges toward the love-mark framing locked-refused in
                                  project_seth_godin_kora_alignment.md (Acorns landmines list).
                                  The fund hero above already names her; the count is purely
                                  transactional social proof. Brings this line into consistency
                                  with the sibling phrasings at lines 1199 + 1442.
                                  Count source 2026-05-25: uniqueGifterCount (true unique
                                  people), not giftCount (total gifts including duplicates
                                  from the same person). */}
                              <span className="text-xs font-medium text-white/75">
                                {uniqueGifterCount === 1 ? "1 person has gifted" : `${uniqueGifterCount} people have gifted`}.{goalAmount && goalAmount > giftVolume ? ` $${(goalAmount - giftVolume).toLocaleString()} to go.` : ""}
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
                          // gifter.amount is the CUMULATIVE TOTAL across
                          // all their gifts (server aggregation fix
                          // 2026-05-25). count > 1 signals a multi-gift
                          // gifter — appends "· N gifts" so "Uncle · $75
                          // in Nike · 3 gifts" replaces the prior
                          // bug where Uncle's three rows said $25 each.
                          const giftRepeatCount = gifter.count ?? 1;
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
                                  {giftRepeatCount > 1 && (
                                    <span className="text-muted-foreground"> · {giftRepeatCount} gifts</span>
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
                {/* Per-tile consequence preview added 2026-05-25 per the
                    first-principles audit. Pre-this-commit, each amount
                    tile showed amount + tagline; the projection of "what
                    this becomes at 18" only appeared AFTER the user
                    clicked (via amountProjection card below the grid).
                    Now each tile carries its own micro-projection so the
                    user sees the consequence INSIDE the choice — every
                    amount option visually anchors to "this is what your
                    gift compounds to" before commitment. The conversion
                    moment is the gifter's gift moment; making the
                    consequence legible at choice-time is the highest-
                    ROI polish on the gift flow.

                    Routes through the same compoundGrowth helper as the
                    main amountProjection card; same 7% rate, same
                    yearsUntil18 horizon. Single source of truth.

                    Only renders when yearsUntil18 > 0 (a kid past
                    majority is shown the existing projection-less tile)
                    and when the projected value would be meaningfully
                    different from the input (gain > $1; for kids ~3
                    months pre-majority the compound add is sub-dollar
                    and the line would read as wallpaper). */}
                <div className="mt-6 grid grid-cols-2 gap-3 md:grid-cols-4">
                  {AMOUNTS.map((amt) => {
                    const isActive = !showCustom && selectedAmount === amt;
                    const projected = yearsUntil18 > 0 ? compoundGrowth(amt, 0.07, yearsUntil18) : null;
                    const showProjection = projected !== null && projected - amt > 1;
                    return (
                      <button
                        key={amt}
                        type="button"
                        className={`tap-bounce rounded-2xl border px-4 py-4 text-left transition-colors ${isActive ? "border-[hsl(var(--kiddo-evergreen))] bg-[hsl(var(--kiddo-evergreen))] text-white shadow-premium-sm" : "border-border bg-muted/70 text-foreground hover:bg-muted"}`}
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
                          {amt === 50 && <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${isActive ? "bg-white/20 text-white" : "bg-[hsl(var(--kiddo-evergreen)/0.10)] text-[hsl(var(--kiddo-evergreen))]"}`}>Most common</span>}
                        </div>
                        <p className={`mt-2 text-[11px] ${isActive ? "text-white/85" : "text-muted-foreground"}`}>
                          {amt === 25 ? "A small gift that gives them a real start" : amt === 50 ? "Grows more than a toy ever would" : amt === 100 ? "Grows into more than a card or cash ever could" : "A head start on their future"}
                        </p>
                        {showProjection && (
                          <p className={`mt-1.5 text-[10.5px] font-semibold tabular-nums ${isActive ? "text-white/90" : "text-[hsl(var(--kiddo-evergreen))]"}`} data-testid={`amount-projection-${amt}`}>
                            → ~${Math.round(projected!).toLocaleString()} at {fundMajorityAge}
                          </p>
                        )}
                      </button>
                    );
                  })}
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
                          <span className="font-semibold">Large gifts welcome.</span> {activeAmount >= 1000 ? "Gifts of $1,000 or more settle the same way as smaller gifts; some get a short verification hold, up to 24 hours. " : ""}No hidden maximum. When investing is live, assets are held by our broker-dealer partner (Member FINRA / SIPC) in {recipientLooksLikeFund ? "the child" : recipientName}'s UTMA custodial account.
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
                  the fund-tier check.

                  Defensive null-check: when the field is undefined
                  (older fund cache, schema-migration edge case, or
                  any server response that drops the field), fall
                  through to the reminder/sponsor path rather than
                  showing the toggle. The toggle showing on a fund
                  that doesn't actually support recurring lets the
                  gifter fill out everything and fail at the 403 at
                  submit — bad UX. Defaulting to no-toggle is the
                  safer behavior. Audit 2026-05-25 caught. */}
              {eventData?.fund?.recurringSupported !== true ? (
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
                      open. Per project_gifter_sponsors_plus_subscription.md.
                      Deep-link surface 2026-05-25: the gifter-dashboard pill
                      ("Cover Plus for $29") + the gift-receipt-email CTA
                      both link here with ?sponsor=1; the wrapper id below
                      lets that anchor scroll into view. */}
                  <div id="sponsor-plus-card">
                    <SponsorPlusCard
                      fundId={eventData.fund.id}
                      childName={eventData.fund.recipientFirstName || eventData.fund.name || "the kid"}
                    />
                  </div>
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
                    <p className="text-sm font-semibold text-foreground">Keep this gift going</p>
                    <p className="mt-0.5 text-xs text-muted-foreground leading-relaxed">
                      Send the same gift on the schedule you pick. We email you before each charge. Cancel anytime. Free, no Kiddo subscription.
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

                    {eventData?.fund?.magicLinkAuth === true ? (
                      // Magic-link gifter auth (locked 2026-05-25). No
                      // password field; we email a sign-in link after
                      // Stripe success. The conversion-bet rationale +
                      // 25-40% expected lift live in the spec memory
                      // file. Copy is product-statement: tells the
                      // gifter what happens; never frames the absence
                      // of a password as a downgrade.
                      <div
                        className="rounded-2xl bg-[hsl(var(--kiddo-evergreen)/0.08)] border border-[hsl(var(--kiddo-evergreen)/0.20)] px-4 py-3"
                        data-testid="recurring-magic-link-callout"
                      >
                        <p className="text-[11px] font-semibold uppercase tracking-wide text-[hsl(var(--kiddo-evergreen))]">
                          No password needed
                        </p>
                        <p className="text-[12px] text-foreground/80 mt-1 leading-relaxed">
                          After you finish, we'll email a one-tap sign-in link to manage or cancel any time. Uses the email you enter on the next step.
                        </p>
                      </div>
                    ) : (
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
                          className="w-full rounded-xl border border-border bg-background px-3 py-2 text-base sm:text-sm"
                          data-testid="input-recurring-password"
                        />
                      </div>
                    )}
                    <p className="text-[10px] text-muted-foreground/70 leading-snug">
                      Recurring gifts count toward the IRS annual gift exclusion ($19,000 per recipient per year). Most family contributions are well under this.
                    </p>
                  </div>
                )}
              </div>
              )}

                <Button size="lg" className="kiddo-gold-button h-14 w-full rounded-2xl text-base font-bold" disabled={!isValidAmount || (isRecurring && eventData?.fund?.magicLinkAuth !== true && recurringPassword.length < 8)} onClick={() => { haptic("selection"); trackGiftEvent("gift_amount_selected", "gift_link_opened_to_amount_selected", { baselineEvent: "gift_amount_selected", amount: activeAmount, amountSource: showCustom ? "custom_confirmed" : "confirmed", isRecurring, recurringFrequency: isRecurring ? recurringFrequency : null }); trackGiftEvent("cta_click", "gift_amount_continue", { amount: activeAmount }); setStep("preview"); }} data-testid="button-continue-to-preview">
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
                          ? investingLiveCopy(
                              `This gift follows the family's current choice: ${familyDefaultStock.name}. It buys real shares in the child's name.`,
                              `This gift follows the family's current choice: ${familyDefaultStock.name}. Once investing is live, it buys real shares in the child's name.`,
                            )
                          : investingLiveCopy(
                              "This gift follows the family's plan. It buys real stocks in the child's name.",
                              "This gift follows the family's plan. Once investing is live, it buys real stocks in the child's name.",
                            )}
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
                        ${activeAmount.toFixed(0)} buys approximately <span className="font-semibold text-foreground">{sharesStr} shares</span> of {stock.name} at an estimated price of ${stock.price.toLocaleString()}/share. {investingLiveCopy("Final shares are confirmed when the trade executes.", "Once investing is live, final shares are confirmed when the trade executes.")}{usingFallbackPrices ? " Prices shown are reference estimates." : ""}
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
                  {/* 17-stock picker with default-9 + expander 2026-05-25.
                      Computes visible tiles = FEATURED ++ (showMore ?
                      ADDITIONAL : []). One special case: when the
                      currently-selected ticker is in ADDITIONAL (e.g.,
                      gifter picked Nintendo, then collapsed, then opens
                      this card again), auto-expand so the selection stays
                      visible — otherwise the collapsed view would show
                      Disney as 'active' while the actual selection is
                      Nintendo hidden under the expander. */}
                  {(() => {
                    const additionalSymbols = new Set(ADDITIONAL_STOCK_PICKS.map((s) => s.symbol as string));
                    const selectedIsInAdditional = !!selectedStock && additionalSymbols.has(selectedStock);
                    const expanded = showMoreStocks || selectedIsInAdditional;
                    const visibleStocks = expanded ? stockPicks : stockPicks.filter((s) => !additionalSymbols.has(s.symbol));
                    return (
                      <>
                        <div className="mt-3 grid grid-cols-2 gap-2">
                          {visibleStocks.map((stock) => {
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
                        {!expanded && (
                          <button
                            type="button"
                            onClick={() => { haptic("selection"); setShowMoreStocks(true); }}
                            className="mt-3 w-full rounded-xl border border-dashed border-border bg-background py-2 text-xs font-semibold text-[hsl(var(--kiddo-evergreen))] hover:bg-[hsl(var(--kiddo-evergreen)/0.04)] transition-colors"
                            data-testid="button-show-more-stocks"
                          >
                            Show {ADDITIONAL_STOCK_PICKS.length} more options
                          </button>
                        )}
                        {showMoreStocks && !selectedIsInAdditional && (
                          <button
                            type="button"
                            onClick={() => { haptic("selection"); setShowMoreStocks(false); }}
                            className="mt-3 w-full text-xs text-muted-foreground hover:text-foreground transition-colors"
                            data-testid="button-show-fewer-stocks"
                          >
                            Show fewer
                          </button>
                        )}
                      </>
                    );
                  })()}
                  {executionModel === "pick" && selectedStock && (
                    <button type="button" className="mt-3 text-xs text-muted-foreground underline" onClick={() => { setExecutionModel("auto"); setSelectedStock(null); }}>
                      Use family default instead
                    </button>
                  )}
                  {/* Escape hatch — request a brand not in the curated set. The
                      menu is bounded on purpose, but a gifter is never stuck
                      with it. Manually reviewed (status escape_hatch_requested),
                      never auto-added. See project_stock_curation_liability. */}
                  <div className="mt-4 border-t border-border/60 pt-3">
                    {stockRequestSent ? (
                      <p className="text-xs text-muted-foreground" data-testid="stock-request-sent">Thanks. We&apos;ll take a look at adding it.</p>
                    ) : stockRequestOpen ? (
                      <div>
                        <div className="flex items-center gap-2">
                          <input
                            type="text"
                            value={stockRequestText}
                            onChange={(e) => { setStockRequestText(e.target.value); setStockRequestError(false); }}
                            placeholder="Company name"
                            maxLength={120}
                            className="flex-1 rounded-xl border border-border bg-background px-3 py-2 text-sm text-foreground"
                            data-testid="input-stock-request"
                          />
                          <button
                            type="button"
                            disabled={stockRequestText.trim().length < 2 || stockRequestSending}
                            onClick={async () => {
                              const company = stockRequestText.trim();
                              if (company.length < 2 || stockRequestSending) return;
                              setStockRequestSending(true);
                              setStockRequestError(false);
                              try {
                                const res = await fetch("/api/stock-requests", {
                                  method: "POST",
                                  headers: { "Content-Type": "application/json" },
                                  body: JSON.stringify({ company, fundId: (eventData?.fund as any)?.id, eventId: (eventData?.event as any)?.id, email: senderEmail.trim() || undefined }),
                                });
                                if (res.ok) { setStockRequestSent(true); setStockRequestText(""); haptic("success"); }
                                else { setStockRequestError(true); }
                              } catch {
                                setStockRequestError(true);
                              } finally {
                                setStockRequestSending(false);
                              }
                            }}
                            className="shrink-0 rounded-xl bg-[hsl(var(--kiddo-evergreen))] px-3 py-2 text-xs font-semibold text-white disabled:opacity-40"
                            data-testid="button-stock-request-send"
                          >
                            {stockRequestSending ? "Sending" : "Request"}
                          </button>
                        </div>
                        {stockRequestError && (
                          <p className="mt-2 text-xs text-destructive" data-testid="stock-request-error">Couldn&apos;t send that. Please try again.</p>
                        )}
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={() => { haptic("light"); setStockRequestOpen(true); }}
                        className="text-xs text-muted-foreground hover:text-foreground transition-colors"
                        data-testid="button-stock-request-open"
                      >
                        Don&apos;t see the company you want? Request it.
                      </button>
                    )}
                  </div>
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
              <p className="text-center text-[11px] text-muted-foreground">Prices vary and investing involves risk, the same way a gift card loses value over time.</p>
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
                      <Repeat size={16} strokeWidth={2} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-foreground">
                        {recurringFrequency.charAt(0).toUpperCase() + recurringFrequency.slice(1)} gift, ${activeAmount.toFixed(2)} each time.
                      </p>
                      {/* Specificity-is-trust: name the actual NEXT charge date, not a
                          vague "same schedule" (conversion research: "delivery in 23
                          min" beats "fast"). Reframes recurring from "will I get
                          surprise-charged?" into a known, cancelable plan. The
                          "we'll email you before each charge" line gets added here
                          once the pre-charge heads-up email ships. */}
                      <p className="mt-0.5 text-xs text-muted-foreground leading-relaxed">
                        Today: ${totalCharge.toFixed(2)} (gift plus processing). Next: ${activeAmount.toFixed(2)} on {(() => {
                          const d = new Date();
                          if (recurringFrequency === "weekly") d.setDate(d.getDate() + 7);
                          else if (recurringFrequency === "yearly") d.setFullYear(d.getFullYear() + 1);
                          else d.setMonth(d.getMonth() + 1);
                          return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
                        })()}, then {recurringFrequency}. We'll email you before each charge, and you can cancel anytime from your gifter dashboard.
                      </p>
                    </div>
                  </div>
                </div>
              )}
              <div className="kiddo-card p-5 md:p-6">
                <p className="text-sm font-medium text-[hsl(var(--kiddo-evergreen))]">Almost there.</p>
                <h1 className="mt-1 font-heading text-2xl md:text-3xl font-semibold text-foreground">{investingLiveCopy("They will read your note, and the investment keeps growing alongside it.", "They will read your note, and once investing is live the gift grows alongside it.")}</h1>
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
                          ? <>Fund cash · the family invests it when ready</>
                          : <>{strategyLabel} mix · invested automatically</>}
                    </p>
                  </div>
                </div>
                <div className="mt-6 grid gap-4">
                  <div>
                    {/* Adaptive label: if a note was already written on the occasion
                        landing step (same `message` state), ACKNOWLEDGE it here ("Your
                        note…") rather than re-prompting ("Leave a note…") as if it's
                        new — which read as redundant. Keeps the emotional-peak capture
                        on the landing AND a review at payment, without "asked twice."
                        Empty (skipped on landing) still gets the full prompt. */}
                    <label className="text-sm font-medium text-foreground">
                      {message.trim() ? "Your note for " : "Leave a note for "}{recipientLooksLikeFund ? "their" : `${recipientName}'s`} Memory Book
                    </label>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {message.trim()
                        ? "Looks good? Edit it here if you like. They'll read it when they're 18."
                        : "They'll read it when they're 18. Optional, but a note now becomes something they keep for life."}
                    </p>
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
                      // 2026-05-25 audit copy fix: was "Sealed for X. Saved
                      // for the Memory Book." while the gift hasn't been
                      // submitted yet — pre-action claim of post-action
                      // state. The note is captured in state, not yet
                      // sealed in any database. Now: "Saved as you type"
                      // accurately reflects pre-submit; the actual sealing
                      // happens on submit + Stripe success.
                      <p className="kiddo-note-seal mt-2 text-xs font-semibold text-[hsl(var(--kiddo-evergreen))]">
                        Saved as you type. Sealed in {amountStepChildLabel}'s Memory Book when you finish.
                      </p>
                    )}
                  </div>
                  {/* Memory media — UNIFIED via shared MemoryMediaPicker.
                      Locked Memory Book tier policy (LOCKED 2026-05-13, see
                      MEMORY.md): GIFTER-attached media (photo / video /
                      voice on gifts) is ALWAYS FREE on all parent tiers.
                      The retention mechanic depends on it: a grandparent
                      attaching a voice memo to a gift should never hit a
                      paywall regardless of whether the parent is on Free
                      or Plus. The gifter loop is the moat.
                      Older revision of this file gated the picker on
                      `fallbackPlan !== "free"` (with a "revenue lever"
                      comment) which contradicted the locked policy and
                      degraded the gifter loop on the funds that need it
                      most. 2026-05-25 audit caught + reconciled to match
                      MEMORY.md. The `requiresPlus` prop on the picker
                      stays unset (false) here — same as GiftSuccess —
                      to keep gifter media unrestricted. Parent-authored
                      media on Dashboard + Age18Plan still pass
                      requiresPlus={true} based on parent's effective
                      plan; that's the actual Plus differential, NOT
                      this surface. */}
                  {fundId && !isAnonymous && eventData?.fund?.gifterMediaEnabled && (
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
                  {/* Anonymous companion block — same locked-policy
                      sweep 2026-05-25. Was gated on `fallbackPlan !==
                      "free"`; now mirrors the picker above and renders
                      for all tiers when the gifter explicitly chose to
                      send anonymously. The privacy promise (face / voice
                      / handwriting identify the gifter) still binds —
                      the note-only fallback is the right behavior on
                      ALL parent tiers, not just paid ones. */}
                  {fundId && isAnonymous && (
                    <div className="rounded-2xl border border-[hsl(var(--kiddo-border))] bg-muted/40 p-4" data-testid="section-memory-attachment-anonymous-note">
                      <p className="text-sm font-semibold text-foreground">Note only for anonymous gifts</p>
                      <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                        Photos, videos, and voice memos identify you (face, voice, handwriting). Anonymous gifts are note-only so the privacy promise holds.
                      </p>
                    </div>
                  )}

                  <div>
                    <div className="flex items-center justify-between gap-3">
                      <label htmlFor="input-sender-name" className="text-sm font-medium text-foreground">Who&apos;s this from? <span className="text-muted-foreground font-normal">(optional)</span></label>
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
                          id="input-sender-name"
                          value={senderName}
                          onChange={(e) => setSenderName(e.target.value)}
                          placeholder="Grandma, Uncle Marcus, Sarah..."
                          className="mt-2 h-12 w-full rounded-2xl border border-border bg-background px-4 text-base sm:text-sm outline-none focus:border-[hsl(var(--kiddo-evergreen))]"
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
                    <label htmlFor="input-sender-email" className="text-sm font-medium text-foreground">
                      Email {isRecurring ? (
                        <span className="text-[hsl(var(--kiddo-evergreen))] font-semibold">(required for recurring)</span>
                      ) : (
                        <span className="text-muted-foreground font-normal">(optional)</span>
                      )}
                    </label>
                    <input
                      id="input-sender-email"
                      value={senderEmail}
                      onChange={(e) => setSenderEmail(e.target.value)}
                      placeholder="you@example.com"
                      type="email"
                      required={isRecurring}
                      className="mt-2 h-12 w-full rounded-2xl border border-border bg-background px-4 text-base sm:text-sm outline-none focus:border-[hsl(var(--kiddo-evergreen))]"
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
                              {method.id === "apple_pay" && isAppleDevice && (
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
                    {/* Recurring previews show TODAY + NEXT as two equally-
                        weighted lines (matches Apple/Spotify/Netflix
                        subscription confirmation pattern). The concrete
                        next-charge date anchors the commitment to a
                        calendar moment instead of the abstract "every
                        month" — the gifter knows exactly when the second
                        charge fires, which is the single most useful fact
                        for them to retain post-purchase. */}
                    {isRecurring ? (() => {
                      const nextChargeDate = (() => {
                        const d = new Date();
                        if (recurringFrequency === "weekly") d.setDate(d.getDate() + 7);
                        else if (recurringFrequency === "yearly") d.setFullYear(d.getFullYear() + 1);
                        else d.setMonth(d.getMonth() + 1);
                        return d;
                      })();
                      const nextChargeLabel = nextChargeDate.toLocaleDateString("en-US", { month: "short", day: "numeric" });
                      const cadenceWord = recurringFrequency === "weekly" ? "week" : recurringFrequency === "yearly" ? "year" : "month";
                      return (
                        <>
                          <div className="flex items-center justify-between gap-3">
                            <span className="text-foreground font-semibold">You pay today</span>
                            <span className="text-lg font-bold text-foreground" data-testid="text-total-charge">${totalCharge.toFixed(2)}</span>
                          </div>
                          <div className="mt-2 flex items-center justify-between gap-3">
                            <span className="text-foreground font-semibold">Next charge ({nextChargeLabel})</span>
                            <span className="text-lg font-bold text-foreground" data-testid="text-next-charge">${totalCharge.toFixed(2)}</span>
                          </div>
                          <p className="mt-3 text-xs text-muted-foreground leading-relaxed">
                            And every {cadenceWord} after that, until you cancel. Cancel any time from your gifter dashboard.
                          </p>
                        </>
                      );
                    })() : (
                      <div className="flex items-center justify-between gap-3">
                        <span className="text-foreground font-semibold">You pay</span>
                        <span className="text-lg font-bold text-foreground" data-testid="text-total-charge">${totalCharge.toFixed(2)}</span>
                      </div>
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
                          <p>{feeData?.annualAumFeeExplanation || "Kiddo charges 0.10% per year ($1 per $1,000) on invested assets only. Cash and pending gifts are not charged."}</p>
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
                Once sent, gifts are invested for {amountStepChildLabel} and can't be reversed, which is part of what makes them meaningful.
              </p>

              <Button size="lg" className="kiddo-gold-button h-14 w-full rounded-2xl text-base font-bold" disabled={!canSubmit || isSubmitting} onClick={handlePay} data-testid="button-pay">
                {isSubmitting ? <span className="flex items-center gap-2"><ThinkingOrb size={18} variant="processing" />Opening secure checkout...</span> : <>{paymentMethod === "apple_pay" ? <Smartphone size={16} className="mr-2" /> : paymentMethod === "bank" ? <Building2 size={16} className="mr-2" /> : paymentMethod === "cashapp" ? <DollarSign size={16} className="mr-2" /> : paymentMethod === "paypal" ? <Wallet size={16} className="mr-2" /> : <Lock size={16} className="mr-2" />}Send {recipientLooksLikeFund ? "this" : `${recipientName}'s`} gift</>}
              </Button>

              {!isEmailValid && <p className="text-center text-xs text-red-500">Enter a valid email address or leave it blank.</p>}
              {isRecurring && !hasRecurringEmail && <p className="text-center text-xs text-[hsl(var(--kiddo-evergreen))]" data-testid="text-recurring-email-required">Recurring gifts need an email so you can manage the schedule.</p>}
              {executionModel === "pick" && !selectedStock && <p className="text-center text-xs text-muted-foreground">Choose a company to continue.</p>}
              {payError && <p className="text-center text-sm text-red-500" data-testid="text-pay-error">{payError}</p>}

              {/* Guestbook exit ramp — DATED occasion pages only (a real
                  event has guests who came to celebrate, not to transact;
                  the anytime page keeps its single-purpose gift focus). */}
              {eventData?.event && !eventData.event.isPermanent && (
                <GuestbookNoteCard
                  fundId={eventData?.fund?.id}
                  childName={recipientName}
                  // Second-beat prefill: the guest already typed who they are;
                  // the gift form opens with name + email filled (only filling
                  // empty fields would be over-caution — it's the same person
                  // seconds later).
                  onAddGiftToo={(name, email) => {
                    if (name) setSenderName(name);
                    if (email) setSenderEmail(email);
                  }}
                />
              )}

              <footer className="pb-8 pt-2 text-center space-y-3">
                <TrustMicroStrip />
                {/* SIPC + DriveWealth disclosure lives in the order summary's
                    "Where the money goes" block above. Repeating the same
                    sentence here was making the page read as anxious rather
                    than confident — three identical disclosures on one screen
                    is the tell, not a feature. Keeping just the FAQ /
                    Security / sipc.org links so the legal trail is still
                    one tap away. */}
                {/* FAQ + Security open in a NEW TAB 2026-05-25 audit.
                    Wouter's <Link> does client-side navigation, which
                    REPLACES the current page; gift state (amount,
                    ticker, note, photo upload, sender info) lives in
                    component state, not URL, so a tap was destroying
                    the in-progress gift. Now uses native <a target=
                    "_blank"> so the gifter can verify trust without
                    losing their work. Matches the sipc.org pattern
                    directly below. */}
                <div className="flex flex-wrap justify-center gap-4 text-xs text-muted-foreground">
                  <a href="/faq" target="_blank" rel="noopener noreferrer" className="hover:text-foreground transition-colors">FAQ</a>
                  <a href="/security" target="_blank" rel="noopener noreferrer" className="hover:text-foreground transition-colors">Security</a>
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
