import { useState, useRef } from "react";
import { useLocation, useSearch } from "wouter";
import { FeatureWallModal } from "@/components/FeatureWallModal";
import { motion, AnimatePresence } from "framer-motion";
import { CalendarIcon, Gift, PartyPopper, Baby, TreeDeciduous, GraduationCap, Heart, ArrowRight, ArrowLeft, Plus, TrendingUp, X, ChevronUp, ChevronDown, ChevronLeft, ChevronRight, ZoomIn, ZoomOut, Home, Car, Briefcase, Plane, Shield, Star, Target } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Logo } from "@/components/ui/logo";
import { haptic } from "@/lib/haptics";
import { capFirst } from "@/lib/format-name";
import { useScrollResetOnChange } from "@/lib/scroll-to-element";
import { GradientText, EnlighteningReveal, ThinkingOrb } from "@/components/ui/gemini";
import { useAuth } from "@/hooks/use-auth";
import { useSubscription } from "@/hooks/use-subscription";
import { useCreateEvent, useEvents } from "@/hooks/use-events";
import { useFunds } from "@/hooks/use-funds";
import { toast } from "@/hooks/use-toast";
import { isDemoBlockedError } from "@/lib/demo-block";
import { EventGateModal } from "@/components/EventGateModal";
import { ThemeSelector, themes } from "@/components/ui/premium-themes";
import { getEventCoverTheme } from "@/lib/event-cover-themes";
import { useQueryClient } from "@tanstack/react-query";
import { RichTextEditor, RichText } from "@/components/ui/rich-text-editor";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

const GIFTING_OCCASION_TYPES = [
  { value: "birthday", label: "Birthday", icon: PartyPopper, color: "text-pink-500 bg-pink-50 dark:bg-pink-950/30" },
  { value: "baby_shower", label: "Baby Shower", icon: Baby, color: "text-sky-500 bg-sky-50 dark:bg-sky-950/30" },
  { value: "graduation", label: "Graduation", icon: GraduationCap, color: "text-violet-500 bg-violet-50 dark:bg-violet-950/30" },
  { value: "holiday", label: "Holiday", icon: TreeDeciduous, color: "text-green-500 bg-green-50 dark:bg-green-950/30" },
  { value: "just_because", label: "Just because", icon: Heart, color: "text-rose-500 bg-rose-50 dark:bg-rose-950/30" },
] as const;

const SAVINGS_GOAL_TYPES = [
  { value: "college", label: "College", icon: GraduationCap, color: "text-violet-500 bg-violet-50 dark:bg-violet-950/30", description: "Tuition, housing, and everything it takes." },
  { value: "car", label: "First car", icon: Car, color: "text-sky-500 bg-sky-50 dark:bg-sky-950/30", description: "Toward their first car." },
  { value: "home", label: "First home", icon: Home, color: "text-emerald-500 bg-emerald-50 dark:bg-emerald-950/30", description: "A down payment starts here." },
  { value: "travel", label: "Gap year", icon: Plane, color: "text-amber-500 bg-amber-50 dark:bg-amber-950/30", description: "A gap year to explore." },
  { value: "business", label: "Business", icon: Briefcase, color: "text-blue-500 bg-blue-50 dark:bg-blue-950/30", description: "A start on their first venture." },
  { value: "emergency", label: "Emergency fund", icon: Shield, color: "text-red-500 bg-red-50 dark:bg-red-950/30", description: "A cushion for the unexpected." },
  { value: "custom", label: "Custom goal", icon: Star, color: "text-pink-500 bg-pink-50 dark:bg-pink-950/30", description: "Something specific to them." },
] as const;

function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
}

function hasStarterEntitlement(membership: any): boolean {
  if (!membership) return false;
  if (membership.status === "active") return true;
  if (membership.status === "canceled" && membership.currentPeriodEnd) {
    return new Date(membership.currentPeriodEnd).getTime() > Date.now();
  }
  return false;
}

export default function EventCreate() {
  const { isAuthenticated, isLoading: authLoading } = useAuth();
  const { data: subscription, isLoading: subLoading } = useSubscription();
  const { data: events = [], isLoading: eventsLoading } = useEvents();
  const { data: funds = [], isLoading: fundsLoading } = useFunds();
  const createEvent = useCreateEvent();
  const [, setLocation] = useLocation();
  const search = useSearch();
  const searchParams = new URLSearchParams(search);
  const preselectedFundId = searchParams.get("fundId") || "";

  // Category fork
  const [eventCategory, setEventCategory] = useState<"gifting_occasion" | "savings_goal" | null>(null);
  const isSavingsGoal = eventCategory === "savings_goal";

  const [step, setStep] = useState(1);
  useScrollResetOnChange(step);
  const [eventType, setEventType] = useState("");
  const [eventName, setEventName] = useState("");
  const [description, setDescription] = useState("");
  const [eventDate, setEventDate] = useState("");
  const [coverImageDataUrl, setCoverImageDataUrl] = useState("");
  const [imagePosX, setImagePosX] = useState(0);
  const [imagePosY, setImagePosY] = useState(0);
  const [imageZoom, setImageZoom] = useState(1);
  const [coverDims, setCoverDims] = useState<{ w: number; h: number } | null>(null);
  // Drag-to-reposition. Direct manipulation on the cover preview — no extra
  // UI, no "Reposition" button, no tooltip. The arrow d-pad and zoom buttons
  // stay (a11y + keyboard users); drag is just an additional input on the
  // same imagePosX/imagePosY state. Pointer events unify mouse + touch + pen
  // so iOS Safari, Chrome Android, and desktop all use the same path.
  const [isDraggingCover, setIsDraggingCover] = useState(false);
  const coverDragStartRef = useRef<{ clientX: number; clientY: number; posX: number; posY: number } | null>(null);
  const [imageUploading, setImageUploading] = useState(false);
  const imagePreviewRef = useRef<HTMLDivElement>(null);
  const [selectedTheme, setSelectedTheme] = useState("classic");
  // Controls the FeatureWallModal that gates premium occasion themes
  // for free users. Per IN_APP_UPGRADE_FEATURE_WALL_SPEC.md the gated
  // feature gets a calm, named, single-CTA modal — not a bare
  // redirect to /account?tab=plan. Modal renders below alongside
  // the main EventCreate JSX (outside the AnimatePresence step so
  // it sits over whichever step is active).
  const [themeUpgradeWallOpen, setThemeUpgradeWallOpen] = useState(false);
  const [fundId, setFundId] = useState(preselectedFundId);
  const [goalAmount, setGoalAmount] = useState("");
  const queryClient = useQueryClient();

  const isFamily = subscription?.effectivePlan === "family" || subscription?.effectivePlan === "legacy";
  const starterByFund = (subscription?.starterByFund || {}) as Record<string, any>;
  const hasAnyStarter = Object.values(starterByFund).some((membership) => hasStarterEntitlement(membership));
  // FUND-keyed coverage for the selected fund (2026-06-04). A co-admin
  // creating an occasion on a covered fund has her OWN plan "free" — the
  // fund's coverage (the owner's plan, via coverageByFund which includes
  // collaborated funds since 0fb4f3c) is what gates limits and themes here,
  // or we'd upsell a household that already pays. Viewer-plan flags remain
  // as the no-fund-selected fallback. The event COUNT below is still the
  // viewer's list (a co-admin's count can differ from the fund's); the
  // server's /api/events gate is fund-keyed and authoritative.
  const coverageByFund = (subscription?.coverageByFund || {}) as Record<string, string>;
  const selectedFundCoverage = fundId ? coverageByFund[fundId] : undefined;
  const selectedFundFamilyCovered = selectedFundCoverage === "covered_family";
  const selectedFundCovered =
    selectedFundFamilyCovered ||
    selectedFundCoverage === "covered_starter" ||
    selectedFundCoverage === "trial_active";
  const activeCustomEventCount = events.filter((event: any) => !event.isPermanent && event.status === "active").length;
  const activeEventLimit = (isFamily || selectedFundFamilyCovered)
    ? Number.POSITIVE_INFINITY
    : (hasAnyStarter || selectedFundCovered) ? 3 : 1;
  const canCreateAnotherEvent = activeCustomEventCount < activeEventLimit;
  const hasPremiumEventAccess = isFamily || hasAnyStarter || selectedFundCovered;

  const maxSteps = isSavingsGoal ? 3 : 5;

  const normalizedGoalAmount = goalAmount.trim().replace(/[^0-9.]/g, "");
  const parsedGoalAmount = normalizedGoalAmount ? Number(normalizedGoalAmount) : 0;

  const giftingGoalError =
    goalAmount.trim() && (!Number.isFinite(parsedGoalAmount) || parsedGoalAmount < 10 || parsedGoalAmount > 100000)
      ? "Use a realistic goal between $10 and $100,000."
      : "";

  const savingsGoalAmountError =
    !normalizedGoalAmount
      ? "A target amount is required."
      : !Number.isFinite(parsedGoalAmount) || parsedGoalAmount < 100 || parsedGoalAmount > 1000000
      ? "Use a target between $100 and $1,000,000."
      : "";

  const canProceedStep1 = eventType !== "";
  const canProceedStep2Gifting = eventName.trim() !== "";
  const canProceedStep2Savings = eventName.trim() !== "" && normalizedGoalAmount !== "" && !savingsGoalAmountError;
  const canProceedStep3Savings = fundId !== "";
  const canProceedStep4Gifting = fundId !== "";

  const handleImageSelect = (file: File) => {
    // File-size validation added 2026-05-25 audit. The UI label below the
    // upload control promises "JPG, PNG, WebP up to 10 MB" but previously
    // no enforcement existed — a 50MB upload would silently fail at the
    // canvas resize step. Now: reject anything over 10MB with a friendly
    // toast at the moment of selection.
    const MAX_BYTES = 10 * 1024 * 1024;
    if (file.size > MAX_BYTES) {
      toast({
        title: "Image too large",
        description: "Cover photos must be 10 MB or smaller.",
        variant: "destructive",
      });
      return;
    }
    if (!file.type.startsWith("image/")) {
      toast({
        title: "Image file required",
        description: "Pick a JPG, PNG, or WebP image.",
        variant: "destructive",
      });
      return;
    }
    const reader = new FileReader();
    reader.onload = (ev) => {
      const dataUrl = ev.target?.result as string;
      const img = new Image();
      img.onload = () => {
        const cW = imagePreviewRef.current?.offsetWidth || 400;
        const cH = 160;
        const scale = Math.max(cW / img.naturalWidth, cH / img.naturalHeight);
        setCoverDims({ w: img.naturalWidth * scale, h: img.naturalHeight * scale });
        setCoverImageDataUrl(dataUrl);
        setImagePosX(0);
        setImagePosY(0);
        setImageZoom(1);
      };
      img.src = dataUrl;
    };
    reader.readAsDataURL(file);
  };

  const MOVE_STEP = 15;
  const ZOOM_STEP = 0.15;
  const MAX_ZOOM = 3;
  const cW = imagePreviewRef.current?.offsetWidth || 400;
  const MIN_ZOOM = coverDims
    ? parseFloat(Math.min(cW / coverDims.w, 160 / coverDims.h).toFixed(2))
    : 0.25;

  // Resize-only export. Was a bake-with-crop that flattened the user's
  // pan/zoom into a fixed 2.13:1 cover image — which threw away framing
  // intent the moment a destination needed a different aspect ratio
  // (Memory Book tile = 2:1, gifter occasion hero = 1.7:1, main hero =
  // 0.9-1.1:1; each one would re-crop with object-fit: cover and lose
  // whatever the parent had centered). New shape: keep the SOURCE
  // image (resized to a sane max dimension for storage), and ship the
  // focal point alongside as normalized coords. Each destination then
  // applies object-position based on the focal point and gets the
  // optimal crop for ITS aspect ratio. The user's framing intent is
  // preserved across every surface the cover image renders on.
  const resizeCoverImage = (maxDim = 1600, quality = 0.88): Promise<string> => {
    return new Promise((resolve) => {
      if (!coverImageDataUrl) { resolve(coverImageDataUrl); return; }
      const img = new Image();
      img.onload = () => {
        const sw = img.naturalWidth;
        const sh = img.naturalHeight;
        const scale = Math.min(1, maxDim / Math.max(sw, sh));
        const tw = Math.round(sw * scale);
        const th = Math.round(sh * scale);
        const canvas = document.createElement("canvas");
        canvas.width = tw;
        canvas.height = th;
        const ctx = canvas.getContext("2d");
        if (!ctx) { resolve(coverImageDataUrl); return; }
        ctx.drawImage(img, 0, 0, tw, th);
        resolve(canvas.toDataURL("image/jpeg", quality));
      };
      img.onerror = () => resolve(coverImageDataUrl);
      img.src = coverImageDataUrl;
    });
  };

  // Convert the editor's pan/zoom state into a normalized focal point
  // (0..1) on the source image. Math: the canvas-center pixel maps to
  // image-pixel (sourceCenter - panOffset/displayScale), where
  // displayScale = coverFitScale × imageZoom (and coverDims.w already
  // bakes coverFitScale into the source width). Clamped [0,1] so a
  // user who pans aggressively past the edge of the image still
  // produces a valid focal point. Default of 0.5/0.5 fires when no
  // pan/zoom has been touched (safe centered default).
  const computeFocalPoint = (): { x: number; y: number } => {
    if (!coverDims) return { x: 0.5, y: 0.5 };
    const denomX = coverDims.w * imageZoom;
    const denomY = coverDims.h * imageZoom;
    if (!denomX || !denomY) return { x: 0.5, y: 0.5 };
    const fx = 0.5 - imagePosX / denomX;
    const fy = 0.5 - imagePosY / denomY;
    return {
      x: Math.max(0, Math.min(1, fx)),
      y: Math.max(0, Math.min(1, fy)),
    };
  };

  const handleSubmit = async () => {
    haptic("medium");
    const slug = slugify(eventName) || (isSavingsGoal ? "goal" : "event");
    try {
      const payload: any = {
        name: eventName.trim(),
        description: description.trim() || undefined,
        eventDate: eventDate ? `${eventDate}T12:00:00.000Z` : undefined,
        fundId,
        eventType,
        eventCategory: eventCategory || "gifting_occasion",
        goalAmount: normalizedGoalAmount ? String(parsedGoalAmount) : undefined,
        slug,
        status: "active",
      };
      if (!isSavingsGoal) {
        payload.theme = selectedTheme;
      }
      const newEvent: any = await createEvent.mutateAsync(payload);

      if (!isSavingsGoal && coverImageDataUrl && newEvent?.id) {
        setImageUploading(true);
        try {
          const resizedDataUrl = await resizeCoverImage();
          const focal = computeFocalPoint();
          await fetch(`/api/events/${newEvent.id}/upload-image`, {
            method: "POST",
            credentials: "include",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              dataUrl: resizedDataUrl || coverImageDataUrl,
              focalX: focal.x,
              focalY: focal.y,
            }),
          });
          // Drop the dashboard-summary cache for this fund so when the user
          // navigates back to /dashboard they see the new cover immediately
          // instead of waiting for the 20s HTTP cache + staleTime to expire.
          // Same race-condition fix used by CreateEventSheet on Dashboard.
          if (fundId) {
            queryClient.invalidateQueries({ queryKey: ["/api/funds", fundId, "dashboard-summary"] });
            queryClient.invalidateQueries({ queryKey: ["/api/funds", fundId, "events"] });
          }
        } catch {
          toast({ title: "Cover photo could not be saved", description: "Your event was created, but the cover image did not upload.", variant: "destructive" });
        }
        setImageUploading(false);
      }

      haptic("success");
      toast({
        title: isSavingsGoal ? "Goal created!" : "Occasion created!",
        description: isSavingsGoal
          ? "Your savings goal is live. Share it with family to let them give."
          : "Your new event is ready to share.",
      });
      setLocation("/events");
    } catch (err: any) {
      if (isDemoBlockedError(err)) {
        toast({ title: "Not saved in the demo", description: err.demoMessage || "Changes save in your own fund." });
        return;
      }
      console.error('[event create] error:', err);
      toast({ title: isSavingsGoal ? "Could not create goal" : "Could not create event", description: err.message || "Please try again", variant: "destructive" });
    }
  };

  const goNext = () => {
    haptic("selection");
    setStep(prev => Math.min(prev + 1, maxSteps));
  };

  const goBack = () => {
    haptic("selection");
    if (step === 1) {
      setEventCategory(null);
      setStep(1);
    } else {
      setStep(prev => Math.max(prev - 1, 1));
    }
  };

  const EVENT_TYPES = GIFTING_OCCASION_TYPES;

  const previewData = (() => {
    const selectedFund = funds.find(f => f.id === fundId);
    const giftingTypeMeta = EVENT_TYPES.find(t => t.value === eventType);
    const savingsTypeMeta = SAVINGS_GOAL_TYPES.find(t => t.value === eventType);
    const typeMeta = isSavingsGoal ? savingsTypeMeta : giftingTypeMeta;
    const themeMeta = themes.find(t => t.id === selectedTheme);
    const Icon = typeMeta?.icon || (isSavingsGoal ? Target : Gift);
    const iconColor = typeMeta?.color || "text-primary bg-primary/10";
    const previewGoal = isSavingsGoal
      ? (parsedGoalAmount >= 100 ? parsedGoalAmount : 0)
      : (!giftingGoalError && parsedGoalAmount >= 10 ? parsedGoalAmount : 0);
    const displayDate = eventDate
      ? (() => {
          const [y, m, d] = eventDate.split("-").map(Number);
          return new Date(y, m - 1, d).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
        })()
      : null;
    return { selectedFund, typeMeta, themeMeta, Icon, iconColor, previewGoal, displayDate };
  })();

  const LivePreviewCard = () => {
    const { selectedFund, typeMeta, Icon, previewGoal, displayDate } = previewData;
    const hasAnyContent = eventName || eventType || eventDate || description || coverImageDataUrl || fundId || selectedTheme !== "classic";

    if (!hasAnyContent) {
      return (
        <div className="rounded-2xl border border-border bg-card p-6 text-center">
          <p className="text-xs text-muted-foreground">Your {isSavingsGoal ? "goal" : "occasion"} preview will appear here as you build it.</p>
        </div>
      );
    }

    if (isSavingsGoal) {
      const textSecondary = "text-muted-foreground";
      const textPrimary = "text-foreground";
      return (
        <div className="rounded-2xl border border-[hsl(var(--kiddo-gold)/0.25)] bg-[hsl(var(--kiddo-cream)/0.6)] shadow-premium-sm overflow-hidden">
          <div className="p-4">
            <div className="flex items-start gap-3">
              <div className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0 text-primary bg-primary/10">
                <Icon size={18} />
              </div>
              <div className="flex-1 min-w-0">
                <p className={`font-heading font-semibold text-sm break-all line-clamp-2 ${textPrimary}`}>
                  {eventName || <span className={`italic ${textSecondary}`}>Untitled goal</span>}
                </p>
                <div className={`flex flex-wrap items-center gap-x-1.5 gap-y-0.5 mt-0.5 text-[11px] ${textSecondary}`}>
                  {typeMeta && <span>{typeMeta.label}</span>}
                  <span className="rounded-full bg-[hsl(var(--kiddo-gold)/0.15)] px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-[0.08em] text-[hsl(var(--kiddo-gold-ink))]">Savings goal</span>
                  {displayDate && (
                    <>
                      <span>·</span>
                      <span className="flex items-center gap-1"><CalendarIcon size={10} />{displayDate}</span>
                    </>
                  )}
                </div>
              </div>
            </div>
            {description && <RichText html={description} className={`mt-2.5 text-xs line-clamp-3 break-words ${textSecondary}`} />}
            {previewGoal > 0 && (
              <div className="mt-3">
                <div className={`flex items-center justify-between text-[11px] mb-1 ${textSecondary}`}>
                  <span>Target</span>
                  <span className={`font-medium ${textPrimary}`}>${previewGoal.toLocaleString()}</span>
                </div>
                <div className="w-full h-1.5 rounded-full overflow-hidden bg-muted">
                  <div className="h-full w-0 rounded-full bg-[hsl(var(--kiddo-gold))]" />
                </div>
                <p className={`mt-1 text-[10px] ${textSecondary}`}>0% saved · $0 of ${previewGoal.toLocaleString()}</p>
              </div>
            )}
            <div className="mt-3 pt-3 border-t border-border/50 flex items-center gap-1.5">
              {selectedFund && (
                <span className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium bg-primary/8 text-primary">
                  <TrendingUp size={10} />{selectedFund.name}
                </span>
              )}
              <button className="ml-auto inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-semibold shrink-0 bg-[hsl(var(--kiddo-gold))] text-white">
                <Target size={10} />Save now
              </button>
            </div>
          </div>
        </div>
      );
    }

    // Gifting occasion - mirrors GiftCheckout hero layout
    const themeHeroBg: Record<string, string> = {
      midnight: "bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900",
      warm:     "bg-gradient-to-br from-amber-800 via-orange-700 to-rose-800",
      ocean:    "bg-gradient-to-br from-sky-800 via-cyan-700 to-teal-800",
      sunset:   "bg-gradient-to-br from-rose-800 via-orange-700 to-amber-700",
      forest:   "bg-gradient-to-br from-emerald-800 via-green-700 to-teal-800",
      classic:  "bg-[hsl(var(--kiddo-evergreen))]",
    };
    const heroBgClass = themeHeroBg[selectedTheme] ?? "bg-[hsl(var(--kiddo-evergreen))]";
    // When the parent landed here from a suggestion tap (eventType known) AND
    // they haven't picked a custom theme yet (still on "classic"), paint the
    // hero with the suggestion's themed gradient — same as the suggestion
    // tile they tapped. Maintains visual continuity from tile → create flow.
    // The user can still pick a theme from the picker; non-classic selections
    // win because heroInlineStyle is only applied when "classic" is active.
    const eventTheme = getEventCoverTheme({ eventType, savingsGoalType: eventType });
    const useEventThemeHero = selectedTheme === "classic" && !!eventType;
    const heroInlineStyle = useEventThemeHero
      ? { background: eventTheme.background }
      : undefined;
    const headline = eventName
      ? `Gift${selectedFund ? ` ${selectedFund.name.split("'")[0].trim()}` : ""} for ${eventName}`
      : typeMeta
      ? `Gift for ${typeMeta.label}`
      : "A gift that grows.";

    return (
      <div className="rounded-2xl overflow-hidden shadow-premium border border-transparent">
        <div className="relative" style={{ minHeight: 260 }}>
          {coverImageDataUrl ? (
            <>
              <div className="absolute inset-0 overflow-hidden">
                <img
                  src={coverImageDataUrl}
                  alt="Cover"
                  draggable={false}
                  style={{
                    position: "absolute",
                    left: "50%",
                    top: "50%",
                    width: coverDims ? coverDims.w : "100%",
                    height: coverDims ? coverDims.h : "100%",
                    maxWidth: "none",
                    objectFit: coverDims ? "fill" : "cover",
                    transform: `translate(calc(-50% + ${imagePosX}px), calc(-50% + ${imagePosY}px)) scale(${imageZoom})`,
                    transformOrigin: "center",
                    pointerEvents: "none",
                    userSelect: "none",
                  }}
                />
              </div>
              <div className="absolute inset-0 bg-gradient-to-t from-black/65 via-black/25 to-black/15" />
            </>
          ) : (
            <div
              className={`absolute inset-0 ${useEventThemeHero ? "" : heroBgClass}`}
              style={heroInlineStyle}
            />
          )}

          <div className="relative z-10 flex flex-col p-5 text-white" style={{ minHeight: 260 }}>
            <div className="flex-1" />
            <div>
              {eventName ? (
                <p className="font-heading text-sm font-semibold text-white/90 tracking-tight">{eventName}</p>
              ) : typeMeta ? (
                <p className="text-xs font-medium text-white/70 uppercase tracking-wider">{typeMeta.label}</p>
              ) : null}
              <h2 className="mt-2 font-heading text-2xl font-bold leading-tight">{headline}</h2>
              <p className="mt-1.5 text-xs font-semibold text-white/85">No account needed. Takes seconds.</p>
              <div className="mt-3 grid grid-cols-3 gap-1.5 text-[10px] text-white">
                <div className="rounded-xl bg-white/15 px-2 py-2 backdrop-blur-sm text-center"><span className="text-base leading-none">🌱</span><p className="mt-0.5 font-semibold">Invested</p></div>
                <div className="rounded-xl bg-white/15 px-2 py-2 backdrop-blur-sm text-center"><span className="text-base leading-none">🔒</span><p className="mt-0.5 font-semibold">Protected</p></div>
                <div className="rounded-xl bg-white/15 px-2 py-2 backdrop-blur-sm text-center"><span className="text-base leading-none">⚡</span><p className="mt-0.5 font-semibold">Seconds</p></div>
              </div>
              {displayDate && (
                <div className="mt-2 inline-flex items-center gap-1 rounded-full bg-white/15 backdrop-blur-sm px-2.5 py-1">
                  <CalendarIcon size={10} className="text-white/80" />
                  <span className="text-[10px] text-white/90 font-medium">{displayDate}</span>
                </div>
              )}
              <div className="mt-4">
                <button className="kiddo-gold-button w-full rounded-xl py-3 text-sm font-bold text-white flex items-center justify-center gap-2">
                  <Gift size={14} />
                  {selectedFund ? `Gift ${selectedFund.name.split("'")[0].trim()}` : "Gift now"}
                </button>
              </div>
            </div>
          </div>
        </div>

        {(description || (previewGoal > 0)) && (
          <div className="bg-card p-4 space-y-3">
            {description && <RichText html={description} className="text-xs text-muted-foreground line-clamp-2 break-words" />}
            {previewGoal > 0 && (
              <div>
                <div className="flex items-center justify-between text-[11px] text-muted-foreground mb-1">
                  <span>Goal</span>
                  <span className="font-medium text-foreground">${previewGoal.toLocaleString()}</span>
                </div>
                <div className="w-full h-1.5 rounded-full overflow-hidden bg-muted">
                  <div className="h-full w-0 rounded-full bg-[hsl(var(--kiddo-evergreen))]" />
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    );
  };

  if (authLoading || fundsLoading || subLoading || eventsLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center md:ml-[264px]">
        <ThinkingOrb size={40} variant="default" />
      </div>
    );
  }

  if (!isAuthenticated) {
    window.location.href = "/login";
    return null;
  }

  if (!canCreateAnotherEvent) {
    return (
      <div className="min-h-screen bg-background md:ml-[264px]">
        <EventGateModal
          open={true}
          onClose={() => setLocation("/events")}
          showKiddoPlusOption={!hasAnyStarter}
        />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background pb-28 md:ml-[264px]">
      <motion.header
        className="sticky top-0 z-50 gemini-glass-nav"
        initial={{ y: -20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ duration: 0.2 }}
      >
        <div className="max-w-5xl mx-auto px-4 h-14 flex items-center gap-3">
          <button
            onClick={() => setLocation("/events")}
            className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors shrink-0"
            data-testid="button-back-to-events"
          >
            <ArrowLeft size={16} />
            Events
          </button>
          <div className="flex-1" />
          {/* Sticky-header label demoted from h1 to p 2026-05-25 — the
              sticky bar is chrome (back button + page label), not page
              content. The wizard step heading inside main IS the page
              content's h1. Having both was a WCAG h1-uniqueness issue. */}
          <p className="text-base font-semibold font-heading text-foreground">
            {eventCategory === null ? "New occasion" : isSavingsGoal ? "New savings goal" : "New occasion"}
          </p>
          <div className="flex-1" />
        </div>
      </motion.header>

      <main className="max-w-5xl mx-auto px-4 py-8">
        {/* Category picker - shown before any steps */}
        {eventCategory === null ? (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3 }}
          >
            <div className="mb-8">
              <h1 className="font-heading text-2xl font-bold text-foreground">What are you creating?</h1>
              <p className="mt-1 text-sm text-muted-foreground">A gifting occasion or a savings goal, both inside the same fund.</p>
            </div>

            <div className="grid gap-4 sm:grid-cols-2 max-w-2xl">
              <motion.button
                whileTap={{ scale: 0.97 }}
                onClick={() => { haptic("selection"); setEventCategory("gifting_occasion"); setStep(1); }}
                className="group text-left rounded-3xl border-2 border-border bg-card p-6 transition-all hover:border-primary/40 hover:shadow-premium-sm"
                data-testid="button-category-gifting-occasion"
              >
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-pink-50 text-pink-500 mb-4">
                  <PartyPopper size={22} />
                </div>
                <p className="font-heading text-base font-bold text-foreground">Gifting occasion</p>
                <p className="mt-1 text-sm text-muted-foreground leading-relaxed">Let your people show up for the big moments.</p>
                <div className="mt-4 flex flex-wrap gap-1.5">
                  {["Birthday", "Holiday", "Graduation", "Baby shower"].map(t => (
                    <span key={t} className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-medium text-muted-foreground">{t}</span>
                  ))}
                </div>
                <div className="mt-4 flex items-center gap-1 text-xs font-semibold text-primary">
                  Create occasion
                  <ArrowRight size={12} />
                </div>
              </motion.button>

              <motion.button
                whileTap={{ scale: 0.97 }}
                onClick={() => { haptic("selection"); setEventCategory("savings_goal"); setStep(1); }}
                className="group text-left rounded-3xl border-2 border-[hsl(var(--kiddo-gold)/0.35)] bg-[hsl(var(--kiddo-gold)/0.04)] p-6 transition-all hover:border-[hsl(var(--kiddo-gold)/0.60)] hover:shadow-premium-sm"
                data-testid="button-category-savings-goal"
              >
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[hsl(var(--kiddo-gold)/0.15)] text-[hsl(var(--kiddo-gold))] mb-4">
                  <Target size={22} />
                </div>
                <p className="font-heading text-base font-bold text-foreground">Savings goal</p>
                <p className="mt-1 text-sm text-muted-foreground leading-relaxed">College, first car, first home, business. Save toward something real.</p>
                <div className="mt-4 flex flex-wrap gap-1.5">
                  {["College", "First car", "First home", "Custom"].map(t => (
                    <span key={t} className="rounded-full bg-[hsl(var(--kiddo-gold)/0.12)] px-2 py-0.5 text-[10px] font-medium text-[hsl(var(--kiddo-gold-ink))]">{t}</span>
                  ))}
                </div>
                <div className="mt-4 flex items-center gap-1 text-xs font-semibold text-[hsl(var(--kiddo-gold-ink))]">
                  Set a goal
                  <ArrowRight size={12} />
                </div>
              </motion.button>
            </div>

            <p className="mt-6 text-xs text-muted-foreground max-w-lg">
              Both types live under the same fund. Savings goals can also be shared with gifters so family can give directly toward the target.
            </p>
          </motion.div>
        ) : (
          <div className="md:grid md:grid-cols-[1fr_300px] md:gap-10 lg:gap-14">
            {/* Left: wizard */}
            <div>
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3 }}
                className="mb-8"
              >
                <h1 className="font-heading text-2xl font-bold text-foreground">
                  {isSavingsGoal ? "Create savings goal" : "Create occasion"}
                </h1>
                <p className="mt-1 text-sm text-muted-foreground">
                  {Number.isFinite(activeEventLimit)
                    ? activeCustomEventCount >= activeEventLimit
                      ? `${activeEventLimit} of ${activeEventLimit} slots in use. Close an occasion first.`
                      : `${activeEventLimit - activeCustomEventCount} of ${activeEventLimit} slots still available.`
                    : "Unlimited concurrent active occasions."}
                </p>
              </motion.div>

              {/* Step indicator */}
              <div className="flex items-center gap-2 mb-8" data-testid="step-indicator">
                {Array.from({ length: maxSteps }, (_, i) => i + 1).map(s => (
                  <div key={s} className="flex items-center gap-2">
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium transition-colors ${
                      s === step ? "bg-primary text-primary-foreground" :
                      s < step ? "bg-primary/20 text-primary" :
                      "bg-muted text-muted-foreground"
                    }`}>
                      {s}
                    </div>
                    {s < maxSteps && <div className={`w-6 h-0.5 rounded ${s < step ? "bg-primary/40" : "bg-muted"}`} />}
                  </div>
                ))}
              </div>

              <AnimatePresence mode="wait">
                {/* ─── STEP 1: Type picker ─── */}
                {step === 1 && (
                  <motion.div
                    key="step1"
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -20 }}
                    transition={{ duration: 0.25 }}
                  >
                    {isSavingsGoal ? (
                      <>
                        <h2 className="font-heading text-lg font-semibold text-foreground mb-2">What is the goal?</h2>
                        <p className="text-sm text-muted-foreground mb-5">Pick the type of goal. You can customize the name in the next step.</p>
                        <div className="grid grid-cols-2 gap-3">
                          {SAVINGS_GOAL_TYPES.map(type => {
                            const Icon = type.icon;
                            const isSelected = eventType === type.value;
                            return (
                              <motion.button
                                key={type.value}
                                whileTap={{ scale: 0.97 }}
                                onClick={() => {
                                  haptic("selection");
                                  setEventType(type.value);
                                  if (!eventName) {
                                    const child = funds.find(f => f.id === fundId || f.id === preselectedFundId);
                                    const childName = capFirst(child?.recipientFirstName);
                                    const childIsOwned = Boolean((child as any)?.transferredAt && (child as any)?.accessRole === "owner");
                                    setEventName((childName && !childIsOwned) ? `${childName}'s ${type.label} fund` : `${type.label} fund`);
                                  }
                                }}
                                className={`p-4 rounded-2xl border-2 transition-all text-left ${
                                  isSelected
                                    ? "border-[hsl(var(--kiddo-gold))] bg-[hsl(var(--kiddo-gold)/0.06)] shadow-premium-sm"
                                    : "border-border bg-card hover:border-[hsl(var(--kiddo-gold)/0.40)]"
                                }`}
                                data-testid={`button-goal-type-${type.value}`}
                              >
                                <div className={`w-10 h-10 rounded-xl flex items-center justify-center mb-2 ${type.color}`}>
                                  <Icon size={20} />
                                </div>
                                <span className="font-semibold text-foreground text-sm block">{type.label}</span>
                                <span className="text-xs text-muted-foreground leading-relaxed block mt-0.5">{type.description}</span>
                              </motion.button>
                            );
                          })}
                        </div>
                      </>
                    ) : (
                      <>
                        <h2 className="font-heading text-lg font-semibold text-foreground mb-4">What are we celebrating?</h2>
                        <p className="text-sm text-muted-foreground mb-4">Each type gets a pre-written gifting page you can customize. Takes two minutes to set up.</p>
                        <div className="grid grid-cols-2 gap-3">
                          {GIFTING_OCCASION_TYPES.map(type => {
                            const Icon = type.icon;
                            const isSelected = eventType === type.value;
                            return (
                              <motion.button
                                key={type.value}
                                whileTap={{ scale: 0.97 }}
                                onClick={() => { haptic("selection"); setEventType(type.value); }}
                                className={`p-4 rounded-2xl border-2 transition-all text-left ${
                                  isSelected
                                    ? "border-primary bg-primary/5 shadow-premium-sm"
                                    : "border-border bg-card hover:border-primary/30"
                                }`}
                                data-testid={`button-type-${type.value}`}
                              >
                                <div className={`w-10 h-10 rounded-xl flex items-center justify-center mb-2 ${type.color}`}>
                                  <Icon size={20} />
                                </div>
                                <span className="font-medium text-foreground text-sm">{type.label}</span>
                              </motion.button>
                            );
                          })}
                        </div>
                      </>
                    )}

                    <div className="mt-6 flex justify-between">
                      <Button variant="outline" onClick={goBack} className="gap-2" data-testid="button-back-step-1">
                        <ArrowLeft size={16} />
                        Back
                      </Button>
                      <Button
                        disabled={!canProceedStep1}
                        onClick={goNext}
                        className="gap-2 rounded-xl"
                        data-testid="button-next-step-1"
                      >
                        Next
                        <ArrowRight size={16} />
                      </Button>
                    </div>
                  </motion.div>
                )}

                {/* ─── STEP 2: Details ─── */}
                {step === 2 && (
                  <motion.div
                    key="step2"
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -20 }}
                    transition={{ duration: 0.25 }}
                  >
                    {isSavingsGoal ? (
                      <>
                        <h2 className="font-heading text-lg font-semibold text-foreground mb-4">Goal details</h2>
                        <div className="space-y-4">
                          <div>
                            <label className="text-sm font-medium text-foreground block mb-1.5">Goal name</label>
                            <input
                              type="text"
                              value={eventName}
                              onChange={e => setEventName(e.target.value)}
                              placeholder="e.g. Emma's College Fund"
                              className="w-full px-4 py-3 rounded-xl border border-border bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-all"
                              data-testid="input-event-name"
                            />
                          </div>
                          <div>
                            <label className="text-sm font-medium text-foreground block mb-1.5">Target amount</label>
                            <div className="relative">
                              <span className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">$</span>
                              <input
                                type="number"
                                min="100"
                                max="1000000"
                                step="100"
                                value={goalAmount}
                                onChange={e => setGoalAmount(e.target.value)}
                                placeholder="e.g. 50000"
                                className="w-full pl-8 pr-4 py-3 rounded-xl border border-border bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-all"
                                data-testid="input-goal-amount"
                              />
                            </div>
                            {savingsGoalAmountError && normalizedGoalAmount && (
                              <p className="mt-1.5 text-xs text-destructive">{savingsGoalAmountError}</p>
                            )}
                            {parsedGoalAmount >= 100 && !savingsGoalAmountError && (
                              <p className="mt-1.5 text-xs text-muted-foreground">
                                ${parsedGoalAmount.toLocaleString()} target set.
                              </p>
                            )}
                          </div>
                          <div>
                            <label className="text-sm font-medium text-foreground block mb-1.5">Description (optional)</label>
                            <RichTextEditor
                              value={description}
                              onChange={setDescription}
                              placeholder="What is this goal for? Why does it matter?"
                            />
                          </div>
                          <div>
                            <label className="text-sm font-medium text-foreground block mb-1.5">Target date (optional)</label>
                            <Popover>
                              <PopoverTrigger asChild>
                                <button
                                  type="button"
                                  className="flex w-full items-center justify-between rounded-xl border border-border bg-background px-4 py-3 text-left transition-all focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary hover:border-primary/40"
                                >
                                  <span className={eventDate ? "text-foreground text-sm" : "text-muted-foreground text-sm"}>
                                    {eventDate
                                      ? (() => {
                                          const [y, m, d] = eventDate.split("-").map(Number);
                                          return new Date(y, m - 1, d).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });
                                        })()
                                      : "Pick a target date"}
                                  </span>
                                  <CalendarIcon size={16} className="shrink-0 text-muted-foreground" />
                                </button>
                              </PopoverTrigger>
                              <PopoverContent className="w-auto p-0" align="start">
                                <Calendar
                                  mode="single"
                                  captionLayout="dropdown"
                                  selected={eventDate ? new Date(eventDate + "T12:00:00") : undefined}
                                  onSelect={(date) => {
                                    if (!date) { setEventDate(""); return; }
                                    const y = date.getFullYear();
                                    const m = String(date.getMonth() + 1).padStart(2, "0");
                                    const d = String(date.getDate()).padStart(2, "0");
                                    setEventDate(`${y}-${m}-${d}`);
                                  }}
                                  fromYear={new Date().getFullYear()}
                                  toYear={new Date().getFullYear() + 25}
                                  // Disable past dates. Audit 2026-05-25
                                  // caught that the picker let users pick
                                  // birthdates/event dates that already
                                  // happened (e.g. click into Jan 2025
                                  // via the month dropdown). Setting
                                  // disabled.before to today blocks all
                                  // past selections.
                                  disabled={{ before: new Date(new Date().setHours(0,0,0,0)) }}
                                  defaultMonth={eventDate ? new Date(eventDate + "T12:00:00") : new Date()}
                                />
                              </PopoverContent>
                            </Popover>
                          </div>
                        </div>
                      </>
                    ) : (
                      <>
                        <h2 className="font-heading text-lg font-semibold text-foreground mb-4">Occasion details</h2>
                        <div className="space-y-4">
                          <div>
                            <label className="text-sm font-medium text-foreground block mb-1.5">Occasion name</label>
                            <input
                              type="text"
                              value={eventName}
                              onChange={e => setEventName(e.target.value)}
                              placeholder="e.g. Emma's 5th Birthday"
                              className="w-full px-4 py-3 rounded-xl border border-border bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-all"
                              data-testid="input-event-name"
                            />
                          </div>
                          <div>
                            <label className="text-sm font-medium text-foreground block mb-1.5">Description (optional)</label>
                            <RichTextEditor
                              value={description}
                              onChange={setDescription}
                              placeholder="Instead of toys this year, we're asking family to give to their future."
                            />
                          </div>
                          <div>
                            <label className="text-sm font-medium text-foreground block mb-1.5">Occasion date (optional)</label>
                            <Popover>
                              <PopoverTrigger asChild>
                                <button
                                  type="button"
                                  className="flex w-full items-center justify-between rounded-xl border border-border bg-background px-4 py-3 text-left transition-all focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary hover:border-primary/40"
                                  data-testid="input-event-date"
                                >
                                  <span className={eventDate ? "text-foreground text-sm" : "text-muted-foreground text-sm"}>
                                    {eventDate
                                      ? (() => {
                                          const [y, m, d] = eventDate.split("-").map(Number);
                                          return new Date(y, m - 1, d).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });
                                        })()
                                      : "Pick a date"}
                                  </span>
                                  <CalendarIcon size={16} className="shrink-0 text-muted-foreground" />
                                </button>
                              </PopoverTrigger>
                              <PopoverContent className="w-auto p-0" align="start">
                                <Calendar
                                  mode="single"
                                  captionLayout="dropdown"
                                  selected={eventDate ? new Date(eventDate + "T12:00:00") : undefined}
                                  onSelect={(date) => {
                                    if (!date) { setEventDate(""); return; }
                                    const y = date.getFullYear();
                                    const m = String(date.getMonth() + 1).padStart(2, "0");
                                    const d = String(date.getDate()).padStart(2, "0");
                                    setEventDate(`${y}-${m}-${d}`);
                                  }}
                                  fromYear={new Date().getFullYear()}
                                  toYear={new Date().getFullYear() + 10}
                                  // Past-date guard — same reasoning as
                                  // the gifting-occasion picker above.
                                  disabled={{ before: new Date(new Date().setHours(0,0,0,0)) }}
                                  defaultMonth={eventDate ? new Date(eventDate + "T12:00:00") : new Date()}
                                />
                              </PopoverContent>
                            </Popover>
                          </div>
                          <div>
                            <label className="text-sm font-medium text-foreground block mb-1.5">Cover Photo (optional)</label>
                            {coverImageDataUrl ? (
                              <div>
                                <div
                                  ref={imagePreviewRef}
                                  className="relative rounded-xl overflow-hidden border border-border bg-muted"
                                  style={{
                                    height: 160,
                                    cursor: isDraggingCover ? "grabbing" : "grab",
                                    // Prevent native scroll/zoom while the parent is dragging
                                    // the cover on touch devices. Without this, a vertical
                                    // drag would scroll the page mid-reposition.
                                    touchAction: "none",
                                  }}
                                  onPointerDown={(e) => {
                                    // Don't initiate a drag if the parent tapped the
                                    // remove (X) button — let that click through.
                                    if ((e.target as HTMLElement).closest("button")) return;
                                    e.preventDefault();
                                    e.currentTarget.setPointerCapture(e.pointerId);
                                    coverDragStartRef.current = {
                                      clientX: e.clientX,
                                      clientY: e.clientY,
                                      posX: imagePosX,
                                      posY: imagePosY,
                                    };
                                    setIsDraggingCover(true);
                                  }}
                                  onPointerMove={(e) => {
                                    const start = coverDragStartRef.current;
                                    if (!start) return;
                                    setImagePosX(start.posX + (e.clientX - start.clientX));
                                    setImagePosY(start.posY + (e.clientY - start.clientY));
                                  }}
                                  onPointerUp={(e) => {
                                    if (coverDragStartRef.current) {
                                      try { e.currentTarget.releasePointerCapture(e.pointerId); } catch { /* already released */ }
                                      coverDragStartRef.current = null;
                                      setIsDraggingCover(false);
                                    }
                                  }}
                                  onPointerCancel={(e) => {
                                    if (coverDragStartRef.current) {
                                      try { e.currentTarget.releasePointerCapture(e.pointerId); } catch { /* already released */ }
                                      coverDragStartRef.current = null;
                                      setIsDraggingCover(false);
                                    }
                                  }}
                                >
                                  <img
                                    src={coverImageDataUrl}
                                    alt="Cover preview"
                                    draggable={false}
                                    style={{
                                      position: "absolute",
                                      left: "50%",
                                      top: "50%",
                                      width: coverDims ? coverDims.w : "100%",
                                      height: coverDims ? coverDims.h : "100%",
                                      maxWidth: "none",
                                      objectFit: coverDims ? "fill" : "cover",
                                      transform: `translate(calc(-50% + ${imagePosX}px), calc(-50% + ${imagePosY}px)) scale(${imageZoom})`,
                                      transformOrigin: "center",
                                      // Smooth tween for arrow-button presses, no tween
                                      // mid-drag — direct manipulation needs to feel
                                      // pinned to the finger, not lagging behind.
                                      transition: isDraggingCover ? "none" : "transform 0.12s ease",
                                      userSelect: "none",
                                      pointerEvents: "none",
                                    }}
                                  />
                                  <button
                                    type="button"
                                    onClick={() => { setCoverImageDataUrl(""); setImagePosX(0); setImagePosY(0); setImageZoom(1); }}
                                    className="absolute top-2 right-2 w-7 h-7 rounded-full bg-black/50 flex items-center justify-center hover:bg-black/70 transition-colors"
                                    aria-label="Remove cover image"
                                  >
                                    <X size={14} className="text-white" />
                                  </button>
                                </div>
                                {/* aria-label added 2026-05-25 audit on all
                                    icon-only buttons (pan up/down/left/right
                                    + reset + zoom in/out). Screen readers
                                    previously announced these as unlabeled
                                    buttons; the visible icons carry no
                                    accessible name. */}
                                <div className="mt-2 flex items-center justify-between gap-3 rounded-xl border border-border bg-muted/30 px-3 py-2">
                                  <div className="grid grid-cols-3 gap-0.5" style={{ width: 72 }}>
                                    <div />
                                    <button type="button" aria-label="Move image up" onClick={() => setImagePosY(y => y - MOVE_STEP)} className="flex items-center justify-center w-6 h-6 rounded hover:bg-muted transition-colors"><ChevronUp size={14} /></button>
                                    <div />
                                    <button type="button" aria-label="Move image left" onClick={() => setImagePosX(x => x - MOVE_STEP)} className="flex items-center justify-center w-6 h-6 rounded hover:bg-muted transition-colors"><ChevronLeft size={14} /></button>
                                    <button type="button" aria-label="Reset image position and zoom" onClick={() => { setImagePosX(0); setImagePosY(0); setImageZoom(1); }} className="flex items-center justify-center w-6 h-6 rounded hover:bg-muted transition-colors text-[9px] font-bold text-muted-foreground leading-none">✕</button>
                                    <button type="button" aria-label="Move image right" onClick={() => setImagePosX(x => x + MOVE_STEP)} className="flex items-center justify-center w-6 h-6 rounded hover:bg-muted transition-colors"><ChevronRight size={14} /></button>
                                    <div />
                                    <button type="button" aria-label="Move image down" onClick={() => setImagePosY(y => y + MOVE_STEP)} className="flex items-center justify-center w-6 h-6 rounded hover:bg-muted transition-colors"><ChevronDown size={14} /></button>
                                    <div />
                                  </div>
                                  <div className="flex items-center gap-1.5">
                                    <button type="button" aria-label="Zoom out" onClick={() => setImageZoom(z => Math.max(MIN_ZOOM, parseFloat((z - ZOOM_STEP).toFixed(2))))} className="flex items-center justify-center w-7 h-7 rounded-lg border border-border hover:bg-muted transition-colors disabled:opacity-40" disabled={imageZoom <= MIN_ZOOM}><ZoomOut size={13} /></button>
                                    <span className="text-xs text-muted-foreground tabular-nums w-10 text-center">{Math.round(imageZoom * 100)}%</span>
                                    <button type="button" aria-label="Zoom in" onClick={() => setImageZoom(z => Math.min(MAX_ZOOM, parseFloat((z + ZOOM_STEP).toFixed(2))))} className="flex items-center justify-center w-7 h-7 rounded-lg border border-border hover:bg-muted transition-colors disabled:opacity-40" disabled={imageZoom >= MAX_ZOOM}><ZoomIn size={13} /></button>
                                  </div>
                                  <label className="cursor-pointer text-xs text-muted-foreground hover:text-foreground transition-colors">
                                    Replace
                                    <input type="file" accept="image/*" className="sr-only" onChange={(e) => { const f = e.target.files?.[0]; if (f) handleImageSelect(f); e.target.value = ""; }} />
                                  </label>
                                </div>

                                {/* Multi-preview — same image, three
                                    aspect ratios, live focal-point. Shows
                                    the parent how their pan/zoom framing
                                    will actually crop at each destination
                                    surface (Memory Book strip, gifter
                                    occasion hero, gifter main hero).
                                    The previews use object-fit: cover +
                                    object-position which is the SAME
                                    rendering primitive every destination
                                    uses, so what's shown here is
                                    pixel-accurate to the live result. As
                                    the parent pans/zooms above, the
                                    focal point recomputes and all three
                                    previews update simultaneously —
                                    WYSIWYG across the multi-aspect
                                    reality. */}
                                {(() => {
                                  const f = computeFocalPoint();
                                  const fxPct = f.x * 100;
                                  const fyPct = f.y * 100;
                                  const surfaces: Array<{ label: string; ratio: number }> = [
                                    { label: "Memory Book", ratio: 2 / 1 },
                                    { label: "Gifter page", ratio: 1.7 / 1 },
                                    { label: "Hero", ratio: 1.05 / 1 },
                                  ];
                                  return (
                                    <div className="mt-3">
                                      <p className="text-[10.5px] font-bold uppercase tracking-[0.07em] text-muted-foreground/65 mb-1.5">
                                        Where it appears
                                      </p>
                                      <div className="grid grid-cols-3 gap-2">
                                        {surfaces.map(({ label, ratio }) => (
                                          <div key={label} className="flex flex-col">
                                            <div
                                              className="relative rounded-lg overflow-hidden border border-border bg-muted"
                                              style={{ aspectRatio: ratio.toString() }}
                                            >
                                              <img
                                                src={coverImageDataUrl}
                                                alt=""
                                                draggable={false}
                                                className="absolute inset-0 h-full w-full"
                                                style={{
                                                  objectFit: "cover",
                                                  objectPosition: `${fxPct}% ${fyPct}%`,
                                                  userSelect: "none",
                                                  pointerEvents: "none",
                                                }}
                                              />
                                            </div>
                                            <p className="mt-1 text-[10px] text-muted-foreground text-center truncate">
                                              {label}
                                            </p>
                                          </div>
                                        ))}
                                      </div>
                                    </div>
                                  );
                                })()}
                              </div>
                            ) : (
                              <label className="flex flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-border bg-muted/30 px-4 py-5 text-center cursor-pointer hover:border-primary/40 hover:bg-muted/50 transition-colors">
                                <input type="file" accept="image/*" className="sr-only" onChange={(e) => { const file = e.target.files?.[0]; if (file) handleImageSelect(file); e.target.value = ""; }} />
                                <span className="text-sm font-medium text-foreground">Upload cover photo</span>
                                <span className="text-xs text-muted-foreground">JPG, PNG, WebP up to 10 MB</span>
                              </label>
                            )}
                          </div>
                        </div>
                      </>
                    )}

                    <div className="mt-6 flex justify-between">
                      <Button variant="outline" onClick={goBack} className="gap-2" data-testid="button-back-step-2">
                        <ArrowLeft size={16} />
                        Back
                      </Button>
                      <Button
                        disabled={isSavingsGoal ? !canProceedStep2Savings : !canProceedStep2Gifting}
                        onClick={goNext}
                        className="gap-2 rounded-xl"
                        data-testid="button-next-step-2"
                      >
                        Next
                        <ArrowRight size={16} />
                      </Button>
                    </div>
                  </motion.div>
                )}

                {/* ─── STEP 3 (savings goal): Fund + Launch ─── */}
                {step === 3 && isSavingsGoal && (
                  <motion.div
                    key="step3-savings"
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -20 }}
                    transition={{ duration: 0.25 }}
                  >
                    <h2 className="font-heading text-lg font-semibold text-foreground mb-2">Link to a fund</h2>
                    <p className="text-sm text-muted-foreground mb-5">Gifts and recurring investments toward this goal flow into the fund you choose.</p>

                    {/* Goal summary */}
                    {eventName && parsedGoalAmount >= 100 && (
                      <div className="mb-5 rounded-2xl border border-[hsl(var(--kiddo-gold)/0.30)] bg-[hsl(var(--kiddo-gold)/0.06)] p-4">
                        <p className="text-[10px] font-bold uppercase tracking-[0.10em] text-[hsl(var(--kiddo-gold-ink)/0.60)]">Your goal</p>
                        <p className="mt-1 font-heading text-base font-bold text-foreground">{eventName}</p>
                        <p className="text-sm text-muted-foreground">Target: <span className="font-semibold text-foreground">${parsedGoalAmount.toLocaleString()}</span></p>
                        {eventDate && (
                          <p className="text-xs text-muted-foreground mt-0.5">
                            By {(() => {
                              const [y, m, d] = eventDate.split("-").map(Number);
                              return new Date(y, m - 1, d).toLocaleDateString("en-US", { month: "long", year: "numeric" });
                            })()}
                          </p>
                        )}
                      </div>
                    )}

                    {funds.length === 0 ? (
                      <div className="bg-card rounded-2xl border border-border p-6 text-center">
                        <p className="text-muted-foreground">No funds found. Please create a fund first.</p>
                      </div>
                    ) : (
                      <div className="space-y-3">
                        {funds.map(fund => {
                          const isSelected = fundId === fund.id;
                          return (
                            <motion.button
                              key={fund.id}
                              whileTap={{ scale: 0.98 }}
                              onClick={() => { haptic("selection"); setFundId(fund.id); }}
                              className={`w-full p-4 rounded-2xl border-2 text-left transition-all flex items-center gap-4 ${
                                isSelected
                                  ? "border-[hsl(var(--kiddo-gold))] bg-[hsl(var(--kiddo-gold)/0.06)] shadow-premium-sm"
                                  : "border-border bg-card hover:border-[hsl(var(--kiddo-gold)/0.40)]"
                              }`}
                              data-testid={`button-fund-${fund.id}`}
                            >
                              <div className="w-10 h-10 rounded-full bg-[hsl(var(--kiddo-evergreen)/0.10)] flex items-center justify-center text-[hsl(var(--kiddo-evergreen))] font-semibold">
                                {fund.name.charAt(0)}
                              </div>
                              <div className="flex-1 min-w-0">
                                <p className="font-medium text-foreground truncate">{fund.name}</p>
                                <p className="text-xs text-muted-foreground">
                                  {fund.accountType === "UTMA" ? "Custodial" : fund.accountType === "Personal" ? "Personal" : fund.accountType}
                                  {isSelected && <span className="ml-1.5 text-[hsl(var(--kiddo-gold-ink))] font-medium">· Goal goes here</span>}
                                </p>
                              </div>
                            </motion.button>
                          );
                        })}
                      </div>
                    )}

                    <div className="mt-6 flex justify-between">
                      <Button variant="outline" onClick={goBack} className="gap-2" data-testid="button-back-step-3">
                        <ArrowLeft size={16} />
                        Back
                      </Button>
                      <Button
                        onClick={handleSubmit}
                        disabled={!canProceedStep3Savings || createEvent.isPending}
                        className="gap-2 rounded-xl"
                        data-testid="button-create-goal-submit"
                      >
                        {createEvent.isPending ? <ThinkingOrb size={16} variant="default" /> : <Target size={16} />}
                        {createEvent.isPending ? "Creating..." : "Create goal"}
                      </Button>
                    </div>
                  </motion.div>
                )}

                {/* ─── STEP 3 (gifting occasion): Theme ─── */}
                {step === 3 && !isSavingsGoal && (
                  <motion.div
                    key="step3-gifting"
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -20 }}
                    transition={{ duration: 0.25 }}
                  >
                    <h2 className="font-heading text-lg font-semibold text-foreground mb-4">Choose a theme</h2>
                    <p className="text-sm text-muted-foreground mb-4">Pick a visual theme for your occasion's gift page</p>
                    <ThemeSelector
                      selectedTheme={selectedTheme}
                      onSelectTheme={(themeId) => { haptic("selection"); setSelectedTheme(themeId); }}
                      hasEventPass={hasPremiumEventAccess}
                      // Replaced 2026-05-14: was a bare setLocation to
                      // /account?tab=plan with zero explainer. Now opens
                      // the FeatureWallModal which names the feature,
                      // shows the price, and offers a single primary CTA.
                      // First-time encounter shows the rich body; repeat
                      // encounters skip the body per the spec's calmer
                      // second-touch pattern. The variant logic is
                      // internal to the component and reads from
                      // users.dismissedFeatureWalls.
                      onUpgrade={() => setThemeUpgradeWallOpen(true)}
                    />
                    <div className="mt-6 flex justify-between">
                      <Button variant="outline" onClick={goBack} className="gap-2" data-testid="button-back-step-3">
                        <ArrowLeft size={16} />
                        Back
                      </Button>
                      <Button onClick={goNext} className="gap-2" data-testid="button-next-step-3">
                        Next
                        <ArrowRight size={16} />
                      </Button>
                    </div>
                  </motion.div>
                )}

                {/* ─── STEP 4 (gifting occasion): Fund ─── */}
                {step === 4 && !isSavingsGoal && (
                  <motion.div
                    key="step4"
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -20 }}
                    transition={{ duration: 0.25 }}
                  >
                    <h2 className="font-heading text-lg font-semibold text-foreground mb-4">Link to a fund</h2>
                    <p className="text-sm text-muted-foreground mb-4">Every gift on this occasion page goes directly into the fund you choose here.</p>
                    {funds.length === 0 ? (
                      <div className="bg-card rounded-2xl border border-border p-6 text-center">
                        <p className="text-muted-foreground">No funds found. Please create a fund first.</p>
                      </div>
                    ) : (
                      <div className="space-y-3">
                        {funds.map(fund => {
                          const isSelected = fundId === fund.id;
                          return (
                            <motion.button
                              key={fund.id}
                              whileTap={{ scale: 0.98 }}
                              onClick={() => { haptic("selection"); setFundId(fund.id); }}
                              className={`w-full p-4 rounded-2xl border-2 text-left transition-all flex items-center gap-4 ${
                                isSelected
                                  ? "border-primary bg-primary/5 shadow-premium-sm"
                                  : "border-border bg-card hover:border-primary/30"
                              }`}
                              data-testid={`button-fund-${fund.id}`}
                            >
                              <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center text-primary font-semibold">
                                {fund.name.charAt(0)}
                              </div>
                              <div className="flex-1 min-w-0">
                                <p className="font-medium text-foreground truncate">{fund.name}</p>
                                <p className="text-xs text-muted-foreground">
                                  {fund.accountType === "UTMA" ? "Custodial" : fund.accountType === "Personal" ? "Personal" : fund.accountType}
                                  {isSelected && <span className="ml-1.5 text-primary font-medium">· Gifts invest here</span>}
                                </p>
                              </div>
                            </motion.button>
                          );
                        })}
                      </div>
                    )}
                    <div className="mt-6 flex justify-between">
                      <Button variant="outline" onClick={goBack} className="gap-2" data-testid="button-back-step-4">
                        <ArrowLeft size={16} />
                        Back
                      </Button>
                      <Button disabled={!canProceedStep4Gifting} onClick={goNext} className="gap-2" data-testid="button-next-step-4">
                        Next
                        <ArrowRight size={16} />
                      </Button>
                    </div>
                  </motion.div>
                )}

                {/* ─── STEP 5 (gifting occasion): Goal + Launch ─── */}
                {step === 5 && !isSavingsGoal && (
                  <motion.div
                    key="step5"
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -20 }}
                    transition={{ duration: 0.25 }}
                  >
                    <h2 className="font-heading text-lg font-semibold text-foreground mb-1">Almost there.</h2>
                    <p className="text-sm text-muted-foreground mb-5">Set an optional fundraising goal, then launch your occasion.</p>

                    <div className="mb-6">
                      <label className="text-sm font-medium text-foreground block mb-1.5">Goal Amount (optional)</label>
                      <div className="relative">
                        <span className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">$</span>
                        <input
                          type="number"
                          min="10"
                          max="100000"
                          step="1"
                          value={goalAmount}
                          onChange={e => setGoalAmount(e.target.value)}
                          placeholder="e.g. 500"
                          className="w-full pl-8 pr-4 py-3 rounded-xl border border-border bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-all"
                          data-testid="input-goal-amount"
                        />
                      </div>
                      <p className="mt-1.5 text-xs text-muted-foreground">Shows a progress bar on your gift page. Skip it if you prefer no target.</p>
                      {giftingGoalError && (
                        <p className="mt-2 text-sm text-destructive bg-destructive/10 border border-destructive/20 rounded-xl px-3 py-2">
                          {giftingGoalError}
                        </p>
                      )}
                    </div>

                    <div className="flex justify-between">
                      <Button variant="outline" onClick={goBack} className="gap-2" data-testid="button-back-step-5">
                        <ArrowLeft size={16} />
                        Back
                      </Button>
                      <Button
                        onClick={handleSubmit}
                        disabled={createEvent.isPending || imageUploading || Boolean(giftingGoalError)}
                        className="gap-2 rounded-xl"
                        data-testid="button-create-event-submit"
                      >
                        {createEvent.isPending || imageUploading ? <ThinkingOrb size={16} variant="default" /> : <Plus size={16} />}
                        {imageUploading ? "Uploading photo..." : createEvent.isPending ? "Creating..." : "Launch event"}
                      </Button>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>{/* end left column */}

            {/* Right: sticky live preview - desktop only */}
            <div className="hidden md:block">
              <div className="sticky top-20">
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-3">Live preview</p>
                <LivePreviewCard />
              </div>
            </div>
          </div>
        )}

        {/* Mobile: preview below steps (only when in wizard) */}
        {eventCategory !== null && (
          <div className="md:hidden mt-8">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-3">Preview</p>
            <LivePreviewCard />
          </div>
        )}
      </main>

      {/* Premium-themes upgrade wall. Opens when a free user taps the
          theme selector's "Upgrade to unlock" affordance or a locked
          theme tile. Per IN_APP_UPGRADE_FEATURE_WALL_SPEC.md and the
          locked WHO/HOW IA: primary CTA goes to /account?tab=plan
          with the upgrade auto-trigger; secondary "See all Plus
          features" goes to /pricing. Dismissal is recorded so the
          parent's second encounter shows the softer repeat-copy. */}
      <FeatureWallModal
        open={themeUpgradeWallOpen}
        onClose={() => setThemeUpgradeWallOpen(false)}
        featureId="premium_occasion_themes"
        requiredTier="plus"
        title="Custom occasion themes are a Kiddo+ feature."
        body="Choose from premium themes that make every birthday, graduation, or milestone feel like its own moment. Plus also unlocks recurring investments and your own photos / videos / voice in the Memory Book."
        upgradePath="/account?tab=plan"
      />
    </div>
  );
}
