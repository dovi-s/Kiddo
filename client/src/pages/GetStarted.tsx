import { useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Link, useLocation, useSearch } from "wouter";
// Sparkles import dropped 2026-05-12 — banned per feedback_no_ai_slop.md.
// Three usages removed: (1) Google button icon (replaced with no icon),
// (2) "The difference" gold-bg card rotating Sparkles (animation banned per
// feedback_animation_primitives.md — replace with static text-only), (3)
// two orbiting Sparkles around the success Check (the worst AI-slop
// pattern in the file — deleted entirely; the pulsing Check is enough).
import { Apple, ArrowLeft, ArrowRight, CalendarIcon, Check, Copy, Gift, Lock, Mail, MessageSquare, PiggyBank, QrCode, Search, Shield, TrendingUp, User, Users, X } from "lucide-react";
import { QRCodeSVG } from "qrcode.react";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Logo } from "@/components/ui/logo";
import { StockLogo } from "@/components/ui/stock-logo";
import { TrustMicroStrip } from "@/components/ui/ux-foundations";
import { haptic } from "@/lib/haptics";
import { extractUtmMetadata, isUserReferralCode } from "@/lib/acquisition";
import { USOnlyOffRamp } from "@/components/USOnlyOffRamp";
import { GiftIntentBanner } from "@/components/GiftIntentBanner";
import { useAuth } from "@/hooks/use-auth";
import type {
  AuthProvidersStatus,
  OnboardingAccountType,
  OnboardingAuthMode,
  OnboardingDraft,
  OnboardingInvestmentChoice,
  OnboardingStep,
} from "@kora/types";
import {
  createFund as createFundRequest,
  fetchAuthProviders,
  trackReferralEvent as trackReferralEventRequest,
  updateInvestmentPreferences,
  type InvestmentPreferencesUpdate,
} from "@kora/api";
import {
  childDobError,
  formatCurrencyWhole,
  getProjectionSnapshot,
  onboardingAnnualGiftOptions,
  onboardingStockChoices,
  projectContributionSeries,
  slugify,
  yearsTo18,
} from "@kora/utils";

const DRAFT_KEY = "kiddo:get-started-v2";
const PAGE = "mx-auto w-full max-w-lg";
const STEP_ORDER: OnboardingStep[] = ["welcome", "who", "details", "projection", "investment", "kyc", "live"];

function getOnboardingFlow(accountType: OnboardingAccountType): OnboardingStep[] {
  // Two-phase onboarding: fund creation first, KYC deferred to Activate Investing.
  //
  // The "projection" step is the load-bearing aha moment for child accounts:
  // it shows the parent what $X/yr in gifts could compound into by the kid's
  // 18th birthday, with a savings-account comparison that makes the
  // difference visceral. Skipping it (the previous behavior) meant parents
  // hit "create fund" without ever seeing the math — they signed up on
  // intent alone, with no anchor for what they were actually building.
  // Cross-category onboarding research (Speak, BitePal, Yindo, Brilliant)
  // shows the personalized-outcome-after-quiz pattern lifts conversion
  // 5-20%; for a custodial-investment product where the outcome is the
  // entire value prop, omitting this moment is leaving the conversion
  // lever on the floor. Personal accounts skip it because the math is
  // less load-bearing without an age-of-majority anchor.
  if (accountType === "personal") return ["details"];
  return ["who", "details", "projection"];
}

function ScreenLead({
  eyebrow,
  title,
  description,
}: {
  eyebrow?: string;
  title: string;
  description?: string;
}) {
  return (
    <div className="space-y-3">
      {eyebrow && <p className="text-sm font-medium text-primary">{eyebrow}</p>}
      <h1 className="font-heading text-[2rem] font-semibold leading-tight text-foreground sm:text-[2.2rem]">{title}</h1>
      {description && <p className="max-w-md text-base leading-relaxed text-muted-foreground">{description}</p>}
    </div>
  );
}

function Dock({
  primary,
  secondary,
}: {
  primary: React.ReactNode;
  secondary?: React.ReactNode;
}) {
  return (
    <div className="get-started-dock-wrap">
      <div className={`${PAGE} get-started-dock`}>
        <div className="space-y-3">
          {primary}
          {secondary}
        </div>
      </div>
    </div>
  );
}

function AnimatedBlock({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 16, scale: 0.985 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ duration: 0.28 }}
      className={className}
    >
      {children}
    </motion.div>
  );
}

function Shell({
  children,
  back,
  progress,
  direction,
}: {
  children: React.ReactNode;
  back?: () => void;
  progress?: { current: number; total: number };
  direction: number;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, x: direction >= 0 ? 28 : -28, scale: 0.985 }}
      animate={{ opacity: 1, x: 0, scale: 1 }}
      exit={{ opacity: 0, x: direction >= 0 ? -20 : 20, scale: 0.992 }}
      transition={{ duration: 0.32 }}
      className="get-started-screen"
    >
      <div className="get-started-screen__glow" />
      <header className="sticky top-0 z-40 mobile-topbar">
        <div className={`${PAGE} flex h-16 items-center justify-between px-4`}>
          {back ? (
            <button onClick={back} className="flex h-11 w-11 items-center justify-center rounded-full border border-border/60 bg-card/95 shadow-premium-sm press-effect" data-testid="button-onboarding-back">
              <ArrowLeft size={18} />
            </button>
          ) : <div className="w-11" />}
          {progress ? (
            <div className="flex flex-col items-center gap-2">
              <div className="flex gap-1.5">
                {Array.from({ length: progress.total }).map((_, i) => <span key={i} className={`h-1.5 rounded-full ${i < progress.current ? "w-7 bg-primary" : "w-3 bg-border"}`} />)}
              </div>
              <span className="text-[11px] uppercase tracking-[0.14em] text-muted-foreground">Step {progress.current} of {progress.total}</span>
            </div>
          ) : <Logo size="sm" className="text-primary" linkTo={null} />}
          <div className="w-11" />
        </div>
      </header>
      <main className={`${PAGE} relative flex min-h-[calc(100dvh-4rem)] flex-col px-4 pb-40 pt-5`}>{children}</main>
    </motion.div>
  );
}

export default function GetStarted() {
  const [, setLocation] = useLocation();
  const search = useSearch();
  const refCode = new URLSearchParams(search).get("ref");
  const refSource = new URLSearchParams(search).get("src") || "unknown";
  const loopTouchpoint = new URLSearchParams(search).get("loop_touchpoint") || null;
  const loopChannel = new URLSearchParams(search).get("loop_channel") || null;
  const giftSessionId = new URLSearchParams(search).get("gift_session_id") || null;
  const utm = extractUtmMetadata(search);
  const registerReferralCode = isUserReferralCode(refCode) ? refCode?.trim().toUpperCase() : undefined;
  const { register, isAuthenticated, isRegistering } = useAuth();
  const [step, setStep] = useState<OnboardingStep>("welcome");
  const [authMode, setAuthMode] = useState<OnboardingAuthMode>("none");
  const [oauth, setOauth] = useState<AuthProvidersStatus>({ google: false, apple: false });
  const [accountType, setAccountType] = useState<OnboardingAccountType>(null);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  // Country gate. Defaults empty so the user makes an explicit choice
  // before the rest of the details step renders. "US" continues the
  // normal flow; "OTHER" swaps the form for the international off-ramp.
  // Asking here (start of details, post-auth) rather than in the welcome
  // step avoids hurting the 99% US conversion path; the parent is
  // already invested enough to make the choice meaningful.
  const [country, setCountry] = useState<"US" | "OTHER" | "">("");
  const [name, setName] = useState("");
  const [birthdate, setBirthdate] = useState("");
  const [occasion, setOccasion] = useState("");
  const [gifterAudience, setGifterAudience] = useState("");
  const [annualGift, setAnnualGift] = useState(500);
  const [investment, setInvestment] = useState<OnboardingInvestmentChoice>("sp500");
  const [ticker, setTicker] = useState("DIS");
  const [authError, setAuthError] = useState("");
  const [submitError, setSubmitError] = useState("");
  const [creating, setCreating] = useState(false);
  // recipientFirstName captured separately from name. UTMA funds
  // auto-generate fund.name as "[Child]'s Fund" — appending "'s fund
  // is live" against that string produces duplicates ("Solomon's
  // Fund's fund is live"). Capturing the first name lets the
  // celebration headline + share button + QR header all use the
  // clean child-name possessive.
  const [created, setCreated] = useState<{ id: string; slug: string; name: string; recipientFirstName: string }
    | null>(null);
  const [direction, setDirection] = useState(1);
  const [projectionMilestone, setProjectionMilestone] = useState(18);
  const [stockSearch, setStockSearch] = useState("");
  const [showSkipWarning, setShowSkipWarning] = useState(false);
  const [linkCopied, setLinkCopied] = useState(false);
  const [showQR, setShowQR] = useState(false);
  const trackedStepViewsRef = useRef<Set<string>>(new Set());

  const dobIssue = accountType === "child" ? childDobError(birthdate) : "";
  const years = accountType === "child" ? yearsTo18(birthdate) : 15;
  const projection = getProjectionSnapshot(annualGift, years);
  const savings = projection.savings;
  const invested = projection.invested;
  const diff = projection.difference;

  const milestoneInvested = useMemo(() => {
    const series = projectContributionSeries(annualGift, projectionMilestone, 0.07);
    return series[series.length - 1]?.projectedValue ?? 0;
  }, [annualGift, projectionMilestone]);

  const milestoneSavings = useMemo(() => {
    const series = projectContributionSeries(annualGift, projectionMilestone, 0.005);
    return series[series.length - 1]?.projectedValue ?? 0;
  }, [annualGift, projectionMilestone]);

  const milestoneDiff = milestoneInvested - milestoneSavings;
  const displayName = name.trim() || (accountType === "child" ? "your child" : "you");
  const shareUrl = created ? `${window.location.origin}/${created.slug}` : "";
  const onboardingFlow = useMemo(() => getOnboardingFlow(accountType), [accountType]);
  const projectionOptions = accountType === "personal" ? [10, 20, 30, 40] : [18, 30, 40, 65];
  const personalFundTitle = name.trim() || "your fund";

  const isLastStep = useMemo(
    () => onboardingFlow.length > 0 && onboardingFlow.indexOf(step) === onboardingFlow.length - 1,
    [onboardingFlow, step],
  );

  const canContinue = useMemo(() => {
    if (step === "welcome") return isAuthenticated || authMode === "none" || (authMode === "email" && email.trim().length > 3 && password.length >= 8);
    if (step === "who") return Boolean(accountType);
    if (step === "details") return country === "US" && (accountType === "child" ? name.trim().length > 0 && birthdate.trim().length > 0 && !dobIssue && Boolean(occasion) && Boolean(gifterAudience) : name.trim().length > 0);
    if (step === "investment") return investment !== "stock" || Boolean(ticker);
    return true;
  }, [accountType, authMode, birthdate, dobIssue, email, gifterAudience, investment, isAuthenticated, name, occasion, password.length, step, ticker]);

  const progress = useMemo(() => {
    const i = onboardingFlow.indexOf(step);
    return i === -1 ? undefined : { current: i + 1, total: onboardingFlow.length };
  }, [onboardingFlow, step]);

  const moveToStep = (next: OnboardingStep) => {
    const currentIndex = STEP_ORDER.indexOf(step);
    const nextIndex = STEP_ORDER.indexOf(next);
    setDirection(nextIndex >= currentIndex ? 1 : -1);
    setStep(next);
  };

  const trackReferralEvent = async (action: "visit" | "signup", metadata?: Record<string, unknown>) => {
    if (!refCode) return;
    try {
      await trackReferralEventRequest({
        refCode,
        action,
        refSource,
        metadata: {
          ...(metadata || {}),
          ...utm,
          loopTouchpoint,
          loopChannel,
          giftSessionId,
        },
      });
    } catch {}
  };

  const trackOnboardingSignal = async (
    action: "visit" | "signup" | "cta_click" | "fund_created" | "fund_link_shared",
    channel: string,
    metadata?: Record<string, unknown>,
  ) => {
    try {
      await fetch("/api/referrals/events", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          refCode: refCode || `onboarding:${accountType || "unknown"}`,
          fundId: created?.id || null,
          eventId: null,
          action,
          channel,
          metadata: {
            step,
            accountType,
            authMode,
            investment,
            ticker: investment === "stock" ? ticker : null,
            onboardingSource: refSource,
            loopTouchpoint,
            loopChannel,
            ...(metadata || {}),
          },
        }),
      });
    } catch {
      // non-blocking analytics signal
    }
  };

  useEffect(() => {
    void trackReferralEvent("visit");
    void trackOnboardingSignal("visit", "onboarding_visit");
  }, []);

  useEffect(() => {
    const key = `${accountType || "unknown"}:${step}`;
    if (trackedStepViewsRef.current.has(key)) return;
    trackedStepViewsRef.current.add(key);
    void trackOnboardingSignal("visit", "onboarding_step_view", {
      stepViewed: step,
      progressCurrent: progress?.current || null,
      progressTotal: progress?.total || null,
    });
  }, [accountType, progress?.current, progress?.total, step]);

  useEffect(() => {
    const handlePageHide = () => {
      if (step === "live") return;
      void trackOnboardingSignal("visit", "onboarding_exit", {
        stepViewed: step,
        progressCurrent: progress?.current || null,
        progressTotal: progress?.total || null,
        hasName: Boolean(name.trim()),
        hasBirthdate: Boolean(birthdate),
        hasEmail: Boolean(email.trim()),
        hasAccountType: Boolean(accountType),
        investmentChoice: investment,
      });
    };

    window.addEventListener("pagehide", handlePageHide);
    return () => window.removeEventListener("pagehide", handlePageHide);
  }, [accountType, birthdate, email, investment, name, progress?.current, progress?.total, step]);

  useEffect(() => {
    void fetchAuthProviders().then(setOauth).catch(() => undefined);
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const raw = window.sessionStorage.getItem(DRAFT_KEY);
    if (!raw) return;
    try {
      const d = JSON.parse(raw);
      if (d.step) setStep(d.step);
      if (d.authMode) setAuthMode(d.authMode);
      if (d.accountType) setAccountType(d.accountType);
      if (d.email) setEmail(d.email);
      if (d.name) setName(d.name);
      if (d.birthdate) setBirthdate(d.birthdate);
      if (typeof d.annualGift === "number") setAnnualGift(d.annualGift);
      if (d.investment) setInvestment(d.investment);
      if (d.ticker) setTicker(d.ticker);
    } catch {
      window.sessionStorage.removeItem(DRAFT_KEY);
    }
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (step === "live") {
      window.sessionStorage.removeItem(DRAFT_KEY);
      return;
    }
    const draft: OnboardingDraft = { step, authMode, accountType, email, name, birthdate, annualGift, investment, ticker };
    window.sessionStorage.setItem(DRAFT_KEY, JSON.stringify(draft));
  }, [accountType, annualGift, authMode, birthdate, email, investment, name, step, ticker]);

  useEffect(() => {
    if (!projectionOptions.includes(projectionMilestone)) {
      setProjectionMilestone(projectionOptions[0]);
    }
  }, [projectionMilestone, projectionOptions]);

  const goBack = () => {
    haptic("light");
    if (step === "who") {
      moveToStep("welcome");
      return;
    }
    // kyc is no longer in the main flow - treat it as if on the last real step
    if (step === "kyc") {
      moveToStep("investment");
      return;
    }

    const currentIndex = onboardingFlow.indexOf(step);
    if (currentIndex > 0) {
      moveToStep(onboardingFlow[currentIndex - 1]);
      return;
    }

    if (step === "details") moveToStep("who");
  };

  const startOAuth = (provider: "google" | "apple") => {
    haptic("medium");
    const draft: OnboardingDraft = {
      step: "who",
      authMode,
      accountType,
      email,
      name,
      birthdate,
      annualGift,
      investment,
      ticker,
    };
    window.sessionStorage.setItem(DRAFT_KEY, JSON.stringify(draft));
    const returnTo = search ? `/get-started?${search}` : "/get-started";
    window.location.assign(`/api/auth/oauth/${provider}?returnTo=${encodeURIComponent(returnTo)}`);
  };

  const applyPreferences = async (fundId: string) => {
    if (investment === "sp500") return;
    const body: InvestmentPreferencesUpdate = investment === "stock"
      ? { defaultMode: "stock", defaultTicker: ticker, allowGifterStockPick: false, allowGifterCashGift: false }
      : { defaultMode: "cash", allowGifterStockPick: false, allowGifterCashGift: true };
    await updateInvestmentPreferences(fundId, body);
  };

  const createFund = async () => {
    setSubmitError("");
    setCreating(true);
    haptic("medium");
    try {
      const trimmedName = name.trim();
      const fundName = accountType === "personal" ? trimmedName : `${trimmedName}'s Fund`;
      const fund = await createFundRequest({
        name: fundName,
        slug: `${slugify(name)}-${Date.now().toString(36)}`,
        accountType: accountType === "child" ? "UTMA" : "Personal",
        status: "draft",
        recipientFirstName: trimmedName,
        recipientRelation: accountType === "child" ? "Parent" : "self",
        recipientBirthdate: accountType === "child" ? new Date(`${birthdate}T12:00:00.000Z`) : undefined,
        investmentStrategy: "growth",
        yearsUntilMaturity: years,
        projectedValue: String(invested),
      });
      await applyPreferences(fund.id);
      await trackReferralEvent("signup", {
        accountType: accountType || "child",
        investment,
        ticker: investment === "stock" ? ticker : null,
        occasion,
        gifterAudience,
        onboardingSource: refSource,
        convertedFromGiftLoop: Boolean(loopTouchpoint),
      });
      await trackOnboardingSignal("signup", "onboarding_fund_created", {
        fundId: fund.id,
        projectedValue: invested,
        yearsUntilMaturity: years,
        occasion,
        gifterAudience,
      });
      await trackOnboardingSignal("fund_created", "fund_created_to_link_shared", {
        baselineEvent: "fund_created",
        fundId: fund.id,
        projectedValue: invested,
        yearsUntilMaturity: years,
        occasion,
        gifterAudience,
      });
      setCreated({
        id: fund.id,
        slug: String(fund.slug),
        name: String(fund.name || fund.recipientFirstName || name),
        recipientFirstName: String(fund.recipientFirstName || name || ""),
      });
      setStep("live");
      haptic("success");
    } catch (error) {
      setSubmitError(error instanceof Error ? error.message : "Could not create the fund right now.");
      haptic("error");
    } finally {
      setCreating(false);
    }
  };

  const handleContinue = async () => {
    if (!canContinue) return;
    if (step === "welcome") {
      void trackOnboardingSignal("cta_click", "onboarding_continue", { step: "welcome" });
      setAuthError("");
      if (isAuthenticated) {
        moveToStep("who");
        return;
      }
      if (authMode !== "email") {
        setAuthMode("email");
        return;
      }
      try {
        await register({ email: email.trim(), password, referralCode: registerReferralCode });
        moveToStep("who");
      } catch (error) {
        setAuthError(error instanceof Error ? error.message : "Could not create your account.");
        haptic("error");
      }
      return;
    }
    void trackOnboardingSignal("cta_click", "onboarding_continue", { step });
    haptic("selection");
    if (step === "who") {
      moveToStep("details");
      return;
    }
    const currentIndex = onboardingFlow.indexOf(step);
    if (currentIndex !== -1 && currentIndex < onboardingFlow.length - 1) {
      moveToStep(onboardingFlow[currentIndex + 1]);
      return;
    }
    // Last step in the flow (or kyc fallback) - create the fund now.
    // KYC is phase 2: deferred to Activate Investing after the parent sees the fund.
    if (!created) await createFund();
  };

  const shareFund = async () => {
    if (!shareUrl) return;
    try {
      const title = accountType === "personal" ? created?.name || personalFundTitle : `${displayName}'s Kiddo fund`;
      const text = accountType === "personal"
        ? `I just started ${created?.name || personalFundTitle}.`
        : `I just started ${displayName}'s Kiddo fund.`;
      const usedNativeShare = Boolean(navigator.share);
      if (usedNativeShare) await navigator.share!({ title, text, url: shareUrl });
      else await navigator.clipboard.writeText(shareUrl);
      void trackOnboardingSignal("cta_click", "onboarding_live_share", {
        destination: usedNativeShare ? "native_share" : "clipboard",
      });
      void trackOnboardingSignal("fund_link_shared", "fund_created_to_link_shared", {
        baselineEvent: "fund_link_shared",
        fundId: created?.id || null,
        destination: usedNativeShare ? "native_share" : "clipboard",
      });
      haptic("success");
    } catch {
      window.prompt("Copy this fund link:", shareUrl);
      void trackOnboardingSignal("cta_click", "onboarding_live_share", {
        destination: "prompt_fallback",
      });
      void trackOnboardingSignal("fund_link_shared", "fund_created_to_link_shared", {
        baselineEvent: "fund_link_shared",
        fundId: created?.id || null,
        destination: "prompt_fallback",
      });
      haptic("light");
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <AnimatePresence mode="wait">
        {step === "welcome" && (
          <Shell key="welcome" direction={direction}>
            <div className="flex min-h-[calc(100dvh-10rem)] flex-col justify-center">
              {/* Gift-intent banner. Renders when arriving via the
                  gifter-led nudge email (?intent=<token>). Self-
                  contained — silent when no intent. Per
                  GIFTER_LED_ACQUISITION_SPEC.md. */}
              <GiftIntentBanner />
              <AnimatedBlock className="text-center">
                <Logo size="lg" className="mx-auto text-primary" linkTo={null} />
                {/* Headline: emotional brand promise condensed. The contrast
                    structure ("X disappear. Y last.") names the alternative
                    (cash) and the upgrade (a permanent record of investments)
                    in 6 words. Functional headlines like "Set up the gift
                    link first" don't make that case — they describe a task. */}
                <h1 className="mt-8 font-heading text-[2.5rem] font-semibold leading-[1.02] text-foreground">
                  Cash gifts disappear.
                  <br />
                  Kiddo gifts last.
                </h1>
                <p className="mx-auto mt-4 max-w-sm text-base leading-relaxed text-muted-foreground">Set up a fund once. Share one link. Anyone in your family can gift real stock in under a minute. No app, no account, nothing to download.</p>
              </AnimatedBlock>
              <AnimatedBlock className="mt-8 grid grid-cols-3 gap-3">
                {[
                  // "to set up" beats "to start" — concrete (the parent
                  // imagines the actual setup) vs. vague (start what?).
                  { label: "2 min", copy: "to set up" },
                  { label: "1 link", copy: "to share" },
                  // "No app for gifters" answers the actual friction concern
                  // ("will Grandma have to install something?") more directly
                  // than "Real stocks from day one" (which lives elsewhere on
                  // the page, e.g. trust microstrip + investment step).
                  { label: "No app", copy: "for gifters" },
                ].map((item) => (
                  <div key={item.label} className="get-started-mini-card">
                    <p className="text-sm font-semibold text-foreground">{item.label}</p>
                    <p className="mt-1 text-[11px] uppercase tracking-[0.12em] text-muted-foreground">{item.copy}</p>
                  </div>
                ))}
              </AnimatedBlock>
              <AnimatedBlock className="mt-10 space-y-3">
                {oauth.apple && <button onClick={() => startOAuth("apple")} className="get-started-auth-button" data-testid="button-signup-apple"><Apple size={18} />Continue with Apple</button>}
                {oauth.google && <button onClick={() => startOAuth("google")} className="get-started-auth-button" data-testid="button-signup-google">Continue with Google</button>}
                {(oauth.apple || oauth.google) && <div className="flex items-center gap-3 py-1 text-xs uppercase tracking-[0.18em] text-muted-foreground"><div className="h-px flex-1 bg-border" /><span>or</span><div className="h-px flex-1 bg-border" /></div>}
                {authMode === "email" && (
                  <div className="get-started-panel space-y-3">
                    {/* sr-only labels — the placeholders give a visible hint
                        but screen readers need the explicit association.
                        autoComplete pairs (email + new-password) feed
                        password managers correctly. */}
                    <label htmlFor="get-started-email" className="sr-only">Email address</label>
                    <input
                      id="get-started-email"
                      name="email"
                      autoComplete="email"
                      inputMode="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="get-started-input"
                      placeholder="you@example.com"
                      type="email"
                      data-testid="input-email"
                    />
                    <label htmlFor="get-started-password" className="sr-only">Password</label>
                    <input
                      id="get-started-password"
                      name="password"
                      autoComplete="new-password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="get-started-input"
                      placeholder="At least 8 characters"
                      type="password"
                      data-testid="input-password"
                    />
                    {authError && <div className="rounded-2xl border border-destructive/20 bg-destructive/10 px-4 py-3 text-sm text-destructive">{authError}</div>}
                  </div>
                )}
              </AnimatedBlock>
              <Dock
                primary={
                  <Button onClick={() => void handleContinue()} disabled={!canContinue || isRegistering} className="h-14 w-full rounded-2xl text-base btn-action" data-testid="button-welcome-continue">
                  {isAuthenticated ? "Continue" : authMode === "email" ? (isRegistering ? "Creating account..." : "Continue with email") : "Continue with email"}
                  {!isRegistering && <ArrowRight className="ml-2 h-5 w-5" />}
                  </Button>
                }
                secondary={
                  <>
                    <TrustMicroStrip />
                    <p className="text-center text-sm text-muted-foreground">Already have an account? <Link href="/login"><span className="font-medium text-foreground underline">Sign in</span></Link></p>
                  </>
                }
              />
            </div>
          </Shell>
        )}

        {step === "who" && (
          <Shell key="who" back={goBack} progress={progress} direction={direction}>
            <div className="flex flex-1 flex-col">
              <AnimatedBlock><ScreenLead title="Who is this fund for?" /></AnimatedBlock>
              <AnimatedBlock className="mt-8 space-y-4">
                <button
                  onClick={() => { haptic("medium"); setAccountType("child"); moveToStep("details"); }}
                  className="get-started-choice"
                  data-testid="option-child-fund"
                >
                  <div className="flex items-center gap-4">
                    <div className="get-started-choice__icon text-xl">🧒</div>
                    <p className="text-lg font-semibold text-foreground">For my child.</p>
                  </div>
                </button>
                <button
                  disabled
                  className="get-started-choice opacity-50 cursor-not-allowed"
                  data-testid="option-personal-fund"
                >
                  <div className="flex items-center gap-4">
                    <div className="get-started-choice__icon text-xl">🙋</div>
                    <div className="flex items-center gap-3">
                      <p className="text-lg font-semibold text-foreground">For myself.</p>
                      <span className="text-xs font-medium text-muted-foreground bg-muted px-2.5 py-1 rounded-full">Coming soon</span>
                    </div>
                  </div>
                </button>
              </AnimatedBlock>
            </div>
          </Shell>
        )}

        {step === "details" && (
          <Shell key="details" back={goBack} progress={progress} direction={direction}>
            <div className="flex flex-1 flex-col">
              <AnimatedBlock>
                <ScreenLead
                  title={accountType === "child" ? "Who's this fund for?" : "What should we call your fund?"}
                  description={accountType === "personal" ? "This is what people will see when they land on your page." : "One thing at a time. Name, occasion, then who should get the link."}
                />
              </AnimatedBlock>
              {/* Country gate — the silent-break catch. Kora is structurally
                  US-only at launch; asking here (post-auth, pre-details)
                  catches non-US visitors before they invest time naming
                  the child, picking occasion, etc. only to hit the state
                  picker later and find their country isn't an option. */}
              <AnimatedBlock className="mt-8">
                <p className="text-sm font-semibold text-foreground mb-3">Where do you live?</p>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => { haptic("selection"); setCountry("US"); }}
                    className={`rounded-2xl border px-4 py-3 text-left text-sm font-medium ${country === "US" ? "border-primary bg-primary/5 text-primary" : "border-border bg-background text-foreground"}`}
                    data-testid="option-country-us"
                  >
                    United States
                  </button>
                  <button
                    type="button"
                    onClick={() => { haptic("selection"); setCountry("OTHER"); }}
                    className={`rounded-2xl border px-4 py-3 text-left text-sm font-medium ${country === "OTHER" ? "border-primary bg-primary/5 text-primary" : "border-border bg-background text-foreground"}`}
                    data-testid="option-country-other"
                  >
                    Outside the US
                  </button>
                </div>
              </AnimatedBlock>
              {country === "OTHER" && (
                <AnimatedBlock className="mt-4">
                  <USOnlyOffRamp sourceSurface="get-started-details" />
                </AnimatedBlock>
              )}
              {country === "US" && (
              <AnimatedBlock className="get-started-panel mt-8 space-y-5">
                <label htmlFor="get-started-recipient" className="sr-only">
                  {accountType === "child" ? "Child's first name" : "Fund name"}
                </label>
                <input
                  id="get-started-recipient"
                  name={accountType === "child" ? "recipientFirstName" : "fundName"}
                  autoComplete="off"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder={accountType === "child" ? "Emma" : "Sarah's Fund"}
                  className="get-started-input"
                  data-testid="input-recipient-name"
                />
                {accountType === "child" && (
                  <div className="space-y-3">
                    <Popover>
                      <PopoverTrigger asChild>
                        <button
                          type="button"
                          data-testid="input-recipient-birthdate"
                          className="get-started-input flex w-full items-center justify-between text-left"
                        >
                          <span className={birthdate ? "text-foreground" : "text-muted-foreground"}>
                            {birthdate
                              ? new Date(birthdate + "T12:00:00").toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })
                              : "Date of birth"}
                          </span>
                          <CalendarIcon size={16} className="shrink-0 text-muted-foreground" />
                        </button>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0" align="start">
                        <Calendar
                          mode="single"
                          captionLayout="dropdown"
                          selected={birthdate ? new Date(birthdate + "T12:00:00") : undefined}
                          onSelect={(date) => {
                            if (!date) return;
                            const y = date.getFullYear();
                            const m = String(date.getMonth() + 1).padStart(2, "0");
                            const d = String(date.getDate()).padStart(2, "0");
                            setBirthdate(`${y}-${m}-${d}`);
                          }}
                          fromYear={new Date().getFullYear() - 18}
                          toYear={new Date().getFullYear()}
                          defaultMonth={birthdate ? new Date(birthdate + "T12:00:00") : new Date(new Date().getFullYear() - 5, 0)}
                          disabled={{ after: new Date() }}
                        />
                      </PopoverContent>
                    </Popover>
                    {dobIssue && <div className="rounded-2xl border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900">{dobIssue}</div>}
                  </div>
                )}
                {accountType === "child" && name.trim().length > 0 && birthdate && !dobIssue && (
                  <div className="space-y-3" data-testid="section-onboarding-occasion">
                    <p className="text-sm font-semibold text-foreground">What's the occasion?</p>
                    <div className="grid grid-cols-2 gap-2">
                      {["Birthday", "Holiday", "Just because", "Other"].map((value) => (
                        <button
                          key={value}
                          type="button"
                          onClick={() => { haptic("selection"); setOccasion(value); }}
                          className={`rounded-2xl border px-3 py-3 text-left text-sm font-medium ${occasion === value ? "border-primary bg-primary/5 text-primary" : "border-border bg-background text-foreground"}`}
                          data-testid={`option-occasion-${value.toLowerCase().replace(/\s+/g, "-")}`}
                        >
                          {value}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
                {accountType === "child" && occasion && (
                  <div className="space-y-3" data-testid="section-onboarding-gifters">
                    <p className="text-sm font-semibold text-foreground">Who'll be gifting?</p>
                    <div className="space-y-2">
                      {["Family only", "Friends too", "Everyone"].map((value) => (
                        <button
                          key={value}
                          type="button"
                          onClick={() => { haptic("selection"); setGifterAudience(value); }}
                          className={`w-full rounded-2xl border px-4 py-3 text-left text-sm font-medium ${gifterAudience === value ? "border-primary bg-primary/5 text-primary" : "border-border bg-background text-foreground"}`}
                          data-testid={`option-gifters-${value.toLowerCase().replace(/\s+/g, "-")}`}
                        >
                          {value}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </AnimatedBlock>
              )}
              {country === "US" && accountType === "child" && name.trim().length >= 2 && birthdate && !dobIssue && (
                <AnimatedBlock className="rounded-2xl border border-primary/20 bg-primary/5 px-5 py-4 mt-4">
                  <p className="font-heading text-lg font-semibold text-foreground">
                    {name}. Born {new Date(birthdate + "T12:00:00").toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}.
                  </p>
                  <p className="mt-1 text-sm text-muted-foreground">Let's build something incredible for {name}.</p>
                </AnimatedBlock>
              )}
              <Dock primary={<Button onClick={() => void handleContinue()} disabled={!canContinue || creating} className="h-14 w-full rounded-2xl text-base btn-action" data-testid="button-details-continue">{isLastStep ? (creating ? "Creating fund..." : "Create fund and get gift link") : "Continue"}{!creating && <ArrowRight className="ml-2 h-5 w-5" />}</Button>} />
            </div>
          </Shell>
        )}

        {step === "projection" && (
          <Shell key="projection" back={goBack} progress={progress} direction={direction}>
            <div className="flex flex-1 flex-col">
              <AnimatedBlock>
                <ScreenLead title={accountType === "personal" ? "Here is what your gifts could become." : `Here is what starting today looks like for ${displayName}.`} />
              </AnimatedBlock>
              <AnimatedBlock className="mt-6 space-y-3">
                <div className="flex flex-wrap gap-2">{onboardingAnnualGiftOptions.map((amount) => <button key={amount} onClick={() => { haptic("selection"); setAnnualGift(amount); }} className={`rounded-full px-4 py-2 text-sm font-medium transition-all ${annualGift === amount ? "bg-primary text-primary-foreground shadow-premium-sm" : "bg-card text-foreground"}`} data-testid={`projection-amount-${amount}`}>${amount}/yr</button>)}</div>
              </AnimatedBlock>
              <AnimatedBlock className="get-started-panel relative mt-6 overflow-hidden">
                <div className="pointer-events-none absolute inset-x-10 top-3 h-20 rounded-full bg-[hsl(var(--kora-gold))]/10 blur-3xl" />
                <p className="text-xs text-muted-foreground mb-4">
                  {accountType === "child" && birthdate
                    ? `If ${displayName}'s family gifts $${annualGift}/yr. By the time ${displayName} is 18:`
                    : `If you receive $${annualGift}/yr in gifts:`}
                </p>
                <div className="grid gap-4">
                  <motion.div layout className="grid grid-cols-[1fr_auto] items-end gap-4 rounded-2xl border border-border/60 bg-background p-4">
                    <div>
                      <div className="flex items-center gap-2 text-muted-foreground"><PiggyBank size={16} /><span className="text-sm font-medium">Savings account</span></div>
                      <motion.p key={`savings-${savings}`} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="mt-2 text-2xl font-semibold text-foreground">{formatCurrencyWhole(savings)}</motion.p>
                    </div>
                    <div className="flex h-20 items-end gap-2">
                      <motion.span className="w-3 rounded-full bg-border/80" animate={{ height: ["24%", "32%"] }} transition={{ duration: 0.45, ease: "easeOut" }} />
                      <motion.span className="w-3 rounded-full bg-primary/25" animate={{ height: ["68%", "84%"] }} transition={{ duration: 0.55, ease: "easeOut" }} />
                    </div>
                  </motion.div>
                  <motion.div layout className="grid grid-cols-[1fr_auto] items-end gap-4 rounded-2xl border border-primary/20 bg-primary/5 p-4">
                    <div>
                      <div className="flex items-center gap-2 text-primary"><TrendingUp size={16} /><span className="text-sm font-medium">Kiddo estimate</span></div>
                      <motion.p key={`invested-${invested}`} initial={{ opacity: 0, y: 10, scale: 0.98 }} animate={{ opacity: 1, y: 0, scale: 1 }} className="mt-2 text-2xl font-semibold text-foreground">{formatCurrencyWhole(invested)}</motion.p>
                    </div>
                    <div className="flex h-20 items-end gap-2">
                      <motion.span className="w-3 rounded-full bg-border/80" animate={{ height: ["24%", "32%"] }} transition={{ duration: 0.45, ease: "easeOut" }} />
                      <motion.span className="w-3 rounded-full bg-primary" animate={{ height: ["64%", "84%"] }} transition={{ duration: 0.6, ease: "easeOut" }} />
                    </div>
                  </motion.div>
                  <motion.div key={`diff-${diff}`} initial={{ opacity: 0, scale: 0.96 }} animate={{ opacity: 1, scale: 1 }} className="rounded-2xl bg-[hsl(var(--kora-gold))]/10 px-4 py-3">
                    {/* Rotating-sparkles icon removed 2026-05-12 — the gold-bg
                        + label + value is enough. Per feedback_animation_primitives.md
                        rotate+scale animation on a celebratory icon is the AI-slop
                        pattern banned. */}
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-medium text-foreground">The difference: {formatCurrencyWhole(diff)}</p>
                    </div>
                    <p className="mt-1 text-xs leading-relaxed text-muted-foreground">The difference? Time. And you just gave {displayName === "your child" || displayName === "you" ? "them" : displayName} that. Estimated at 7% hypothetical annual growth. Not guaranteed.</p>
                  </motion.div>
                </div>
              </AnimatedBlock>
              {isLastStep && submitError && <div className="mt-4 rounded-2xl border border-destructive/20 bg-destructive/10 px-4 py-3 text-sm text-destructive">{submitError}</div>}
              <Dock primary={<Button onClick={() => void handleContinue()} disabled={creating} className="h-14 w-full rounded-2xl text-base btn-premium" data-testid="button-projection-continue">{isLastStep ? (creating ? "Creating fund..." : "Create my fund") : "This is why I'm starting"}{!creating && <ArrowRight className="ml-2 h-5 w-5" />}</Button>} />
            </div>
          </Shell>
        )}

        {step === "investment" && (
          <Shell key="investment" back={goBack} progress={progress} direction={direction}>
            <div className="flex flex-1 flex-col">
              <AnimatedBlock><ScreenLead title="What should gifts do by default?" description="Pick the family default for new gifts. Gifter overrides only appear later if you allow them in settings." /></AnimatedBlock>
              <AnimatedBlock className="mt-8 space-y-4">
                <button onClick={() => { haptic("selection"); setInvestment("sp500"); }} className={`get-started-choice ${investment === "sp500" ? "get-started-choice--active" : ""}`} data-testid="option-investment-sp500"><div className="flex items-center gap-3"><span className="text-xl">📈</span><p className="text-lg font-semibold text-foreground">Managed auto-invest</p></div><p className="mt-2 text-sm leading-relaxed text-muted-foreground">Recommended for most families. You can refine the investment mix any time in settings.</p></button>
                <button onClick={() => { haptic("selection"); setInvestment("stock"); }} className={`get-started-choice ${investment === "stock" ? "get-started-choice--active" : ""}`} data-testid="option-investment-stock"><div className="flex items-center gap-3"><span className="text-xl">⭐</span><p className="text-lg font-semibold text-foreground">One default stock</p></div><p className="mt-2 text-sm leading-relaxed text-muted-foreground">Every gift follows one stock unless you later allow a gifter override.</p></button>
                {investment === "stock" && (
                  <div className="get-started-panel space-y-4">
                    <div className="relative">
                      <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
                      <label htmlFor="get-started-stock-search" className="sr-only">Search any company</label>
                      <input
                        id="get-started-stock-search"
                        name="stockSearch"
                        type="search"
                        autoComplete="off"
                        value={stockSearch}
                        onChange={(e) => setStockSearch(e.target.value)}
                        placeholder="Search any company..."
                        className="h-11 w-full rounded-2xl border border-border bg-background pl-9 pr-4 text-sm outline-none focus:border-primary"
                        data-testid="input-stock-search"
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      {onboardingStockChoices
                        .filter((s) => !stockSearch || s.name.toLowerCase().includes(stockSearch.toLowerCase()) || s.ticker.toLowerCase().includes(stockSearch.toLowerCase()))
                        .map((stock) => (
                          <button key={stock.ticker} onClick={() => { haptic("selection"); setTicker(stock.ticker); }} className={`flex items-center gap-3 rounded-2xl border px-4 py-3 text-left ${ticker === stock.ticker ? "border-primary bg-primary/5 shadow-premium-sm" : "border-border bg-background"}`} data-testid={`option-stock-${stock.ticker}`}>
                            <StockLogo ticker={stock.ticker} size={28} />
                            <div><p className="text-sm font-semibold text-foreground">{stock.name}</p><p className="text-xs text-muted-foreground">{stock.ticker}</p></div>
                          </button>
                        ))}
                    </div>
                    {stockSearch && onboardingStockChoices.filter((s) => s.name.toLowerCase().includes(stockSearch.toLowerCase()) || s.ticker.toLowerCase().includes(stockSearch.toLowerCase())).length === 0 && (
                      <p className="text-center text-sm text-muted-foreground">No match in popular picks. Full search coming soon.</p>
                    )}
                  </div>
                )}
                <button onClick={() => { haptic("selection"); setInvestment("cash"); }} className={`get-started-choice ${investment === "cash" ? "get-started-choice--active" : ""}`} data-testid="option-investment-cash"><div className="flex items-center gap-3"><span className="text-xl">💵</span><p className="text-lg font-semibold text-foreground">Hold as cash</p></div><p className="mt-2 text-sm leading-relaxed text-muted-foreground">Gifts land as cash until you decide when to invest them.</p></button>
              </AnimatedBlock>
              <AnimatedBlock className="mt-4"><p className="text-center text-sm text-muted-foreground">This sets the default for new gifts. You can change it any time in settings.</p></AnimatedBlock>
              {submitError && <div className="mt-4 rounded-2xl border border-destructive/20 bg-destructive/10 px-4 py-3 text-sm text-destructive">{submitError}</div>}
              <Dock primary={<Button onClick={() => void handleContinue()} disabled={!canContinue || creating} className="h-14 w-full rounded-2xl text-base btn-premium" data-testid="button-investment-continue">{isLastStep ? (creating ? "Creating fund..." : accountType === "personal" ? "Create my fund" : `Create ${displayName}'s fund`) : "Continue"}{!creating && <ArrowRight className="ml-2 h-5 w-5" />}</Button>} />
            </div>
          </Shell>
        )}

        {step === "kyc" && (
          <Shell key="kyc" back={goBack} progress={progress} direction={direction}>
            <div className="flex flex-1 flex-col">
              <AnimatedBlock className="get-started-panel bg-primary/5"><div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10 text-primary"><Shield size={24} /></div><p className="mt-5 text-sm font-medium text-primary">One more thing.</p><h1 className="mt-2 font-heading text-[2rem] font-semibold leading-tight text-foreground">{accountType === "personal" ? "To open your investment account, we need to verify your identity." : `To open ${displayName}'s investment account, we need to verify your identity.`}</h1>{accountType !== "personal" && <p className="mt-2 text-sm font-medium text-primary">Your identity, the account holder. Not {displayName}'s.</p>}<p className="mt-3 text-base leading-relaxed text-muted-foreground">Required by law for all investment accounts. Takes about 2 minutes.</p></AnimatedBlock>
              <AnimatedBlock className="get-started-panel mt-6"><p className="text-sm font-semibold text-foreground">You will need</p><div className="mt-4 space-y-3 text-sm text-muted-foreground"><div className="flex items-start gap-3"><Mail size={16} className="mt-0.5 text-primary" /><span>Your full legal name</span></div><div className="flex items-start gap-3"><Check size={16} className="mt-0.5 text-primary" /><span>Your date of birth</span></div><div className="flex items-start gap-3"><Lock size={16} className="mt-0.5 text-primary" /><span>Your Social Security Number</span></div><div className="flex items-start gap-3"><Gift size={16} className="mt-0.5 text-primary" /><span>Your home address</span></div></div></AnimatedBlock>
              <AnimatedBlock className="get-started-panel mt-6 space-y-3"><p className="text-sm leading-relaxed text-foreground">This is the same identity check you would see at Fidelity, Vanguard, or any regulated investment account.</p><p className="text-sm leading-relaxed text-muted-foreground">Asking for your Social Security Number can feel like a big ask. It is required by federal law for all investment accounts. Not optional. Not a Kiddo rule.</p><p className="text-sm leading-relaxed text-muted-foreground">256-bit encryption. Always. We never store your SSN in plain text. Ever.</p></AnimatedBlock>
              {submitError && <div className="mt-4 rounded-2xl border border-destructive/20 bg-destructive/10 px-4 py-3 text-sm text-destructive">{submitError}</div>}
              <Dock primary={<Button onClick={() => void handleContinue()} disabled={creating} className="h-14 w-full rounded-2xl text-base btn-premium" data-testid="button-kyc-ready">{creating ? "Creating fund..." : "I'm ready"}{!creating && <ArrowRight className="ml-2 h-5 w-5" />}</Button>} />
            </div>
          </Shell>
        )}

        {step === "live" && created && (() => {
          // Single source of truth for the child-name possessive used
          // across this celebration screen (headline, copy button, SMS
          // template, QR header). UTMA funds auto-generate name as
          // "[Child]'s Fund," so reading from name directly produces
          // "Solomon's Fund's fund is live." Use recipientFirstName
          // when present; fall back to stripping "'s Fund" / " Fund"
          // suffix from name for legacy rows.
          const firstName = created.recipientFirstName.trim();
          const childDisplayName = firstName
            || String(created.name || "")
                .replace(/\s*'s\s+Fund\s*$/i, "")
                .replace(/\s+Fund\s*$/i, "")
                .trim()
            || "Your child";
          return (
          <Shell key="live" direction={direction}>
            <div className="flex min-h-[calc(100dvh-10rem)] flex-col justify-center">
              <AnimatedBlock className="text-center">
                <div className="relative mx-auto flex h-28 w-28 items-center justify-center">
                  <motion.div className="absolute inset-0 rounded-[34px] bg-[hsl(var(--kora-gold))]/10 blur-2xl" animate={{ scale: [0.9, 1.08, 1], opacity: [0.4, 0.7, 0.45] }} transition={{ duration: 1.8, repeat: Infinity, repeatType: "mirror" }} />
                  <div className="relative mx-auto flex h-20 w-20 items-center justify-center rounded-[28px] bg-primary/10 text-primary shadow-premium-sm pulse-success"><Check size={34} /></div>
                  {/* Two orbiting Sparkles deleted 2026-05-12 — the worst
                      AI-slop pattern in the file. Pulsing gold halo behind +
                      pulse-success Check icon already carries the success
                      moment without celebration-particle decoration. Per
                      feedback_no_ai_slop.md and Robinhood-precedent ban on
                      celebratory imagery tied to investment activity. */}
                </div>
                <h1 className="mt-8 font-heading text-[2.4rem] font-semibold leading-tight text-foreground">{accountType === "personal" ? `${created.name} is live.` : `${childDisplayName}'s fund is live.`}</h1>
                <p className="mx-auto mt-4 max-w-sm text-base leading-relaxed text-muted-foreground">Share the link and the first gift can happen today. When you are ready to open the real investment account, tap Activate Investing. It takes 2 minutes.</p>
              </AnimatedBlock>
              <AnimatedBlock className="get-started-panel mt-8"><p className="text-sm font-semibold text-foreground">Your private fund link</p><div className="mt-3 rounded-2xl border border-border bg-background px-4 py-3 text-sm text-muted-foreground break-all">{shareUrl}</div><p className="mt-3 text-sm leading-relaxed text-muted-foreground">Text it, email it, or drop it into an invitation. The moment someone gifts through this link, the story begins.</p></AnimatedBlock>
              <AnimatedBlock className="mt-8 grid grid-cols-3 gap-3">
                {[
                  { label: "Fund live", copy: "ready for its first gift" },
                  { label: "Memory Book", copy: "starts with the first note" },
                  { label: "Investing", copy: "activate when ready" },
                ].map((item) => (
                  <div key={item.label} className="get-started-mini-card">
                    <p className="text-sm font-semibold text-foreground">{item.label}</p>
                    <p className="mt-1 text-[11px] uppercase tracking-[0.12em] text-muted-foreground">{item.copy}</p>
                  </div>
                ))}
              </AnimatedBlock>
              <Dock
                primary={
                  <div className="space-y-2">
                    <button
                      onClick={async () => {
                        try { await navigator.clipboard.writeText(shareUrl); } catch {}
                        setLinkCopied(true);
                        setTimeout(() => setLinkCopied(false), 2000);
                        void trackOnboardingSignal("cta_click", "onboarding_live_share", { destination: "clipboard" });
                        void trackOnboardingSignal("fund_link_shared", "fund_created_to_link_shared", { baselineEvent: "fund_link_shared", fundId: created.id, destination: "clipboard" });
                        haptic("success");
                      }}
                      className="flex h-14 w-full items-center justify-center gap-2.5 rounded-2xl bg-primary text-primary-foreground text-base font-semibold shadow-premium-sm press-effect"
                      data-testid="button-copy-fund-link"
                    >
                      {linkCopied ? <Check size={20} /> : <Copy size={18} />}
                      {linkCopied ? "Copied!" : `Copy ${accountType === "personal" ? "your" : `${childDisplayName}'s`} gifting link`}
                    </button>
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        onClick={() => {
                          const text = accountType === "personal"
                            ? `Gift ${created.name}: ${shareUrl}`
                            : `Gift ${childDisplayName}: ${shareUrl}`;
                          window.open(`sms:?body=${encodeURIComponent(text)}`, "_self");
                          void trackOnboardingSignal("cta_click", "onboarding_live_share", { destination: "sms" });
                          void trackOnboardingSignal("fund_link_shared", "fund_created_to_link_shared", { baselineEvent: "fund_link_shared", fundId: created.id, destination: "sms" });
                          haptic("medium");
                        }}
                        className="flex h-12 items-center justify-center gap-2 rounded-2xl border border-border bg-card text-sm font-medium text-foreground press-effect"
                        data-testid="button-share-via-text"
                      >
                        <MessageSquare size={16} />
                        Share via text
                      </button>
                      <button
                        onClick={() => { setShowQR(true); haptic("medium"); }}
                        className="flex h-12 items-center justify-center gap-2 rounded-2xl border border-border bg-card text-sm font-medium text-foreground press-effect"
                        data-testid="button-download-qr"
                      >
                        <QrCode size={16} />
                        QR code
                      </button>
                    </div>
                  </div>
                }
                secondary={
                  <div className="space-y-3">
                    <Button variant="outline" onClick={() => { void trackOnboardingSignal("cta_click", "onboarding_activate_investing", { fundId: created.id }); setLocation(`/activate?fundId=${encodeURIComponent(created.id)}`); }} className="h-12 w-full rounded-2xl text-base" data-testid="button-activate-investing">Activate investing</Button>
                    {showSkipWarning ? (
                      <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 space-y-3">
                        <p className="text-sm font-semibold text-amber-900">Before you go. Send yourself the link first.</p>
                        <p className="text-sm text-amber-800">You worked too hard to lose the moment.</p>
                        <div className="flex flex-col gap-2">
                          <Button variant="outline" className="w-full rounded-2xl" onClick={async () => { try { await navigator.clipboard.writeText(shareUrl); } catch {} void trackOnboardingSignal("cta_click", "onboarding_send_self_link", { fundId: created.id }); setLocation("/dashboard"); }} data-testid="button-send-self-link">Send to myself</Button>
                          <button onClick={() => { void trackOnboardingSignal("cta_click", "onboarding_skip_to_dashboard", { fundId: created.id }); setLocation("/dashboard"); }} className="w-full py-2 text-sm font-medium text-muted-foreground" data-testid="button-go-dashboard-later">I will do this later</button>
                        </div>
                      </div>
                    ) : (
                      <button onClick={() => setShowSkipWarning(true)} className="w-full py-3 text-sm font-medium text-muted-foreground" data-testid="button-show-skip-warning">I'll share it later</button>
                    )}
                  </div>
                }
              />

              {/* QR code modal */}
              <AnimatePresence>
                {showQR && (
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4"
                    onClick={() => setShowQR(false)}
                  >
                    <motion.div
                      initial={{ scale: 0.9, y: 20 }}
                      animate={{ scale: 1, y: 0 }}
                      exit={{ scale: 0.9, y: 20 }}
                      transition={{ type: "spring", stiffness: 400, damping: 30 }}
                      className="bg-card rounded-3xl p-8 shadow-2xl w-full max-w-sm"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <div className="flex items-center justify-between mb-6">
                        <p className="font-heading text-lg font-semibold text-foreground">
                          {accountType === "personal" ? "Your gifting QR" : `${childDisplayName}'s gifting QR`}
                        </p>
                        <button onClick={() => setShowQR(false)} className="p-1.5 rounded-full hover:bg-muted transition-colors"><X size={18} /></button>
                      </div>
                      <div className="flex justify-center bg-white rounded-2xl p-5">
                        <QRCodeSVG value={shareUrl} size={200} level="M" />
                      </div>
                      <p className="mt-4 text-center text-sm text-muted-foreground">Screenshot this and share it anywhere. Anyone who scans it can gift directly.</p>
                    </motion.div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </Shell>
          );
        })()}
      </AnimatePresence>
    </div>
  );
}
