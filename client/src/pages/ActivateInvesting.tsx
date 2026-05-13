import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { motion, AnimatePresence } from "framer-motion";
import { useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/hooks/use-auth";
import { useSubscription } from "@/hooks/use-subscription";
import { useFunds } from "@/hooks/use-funds";
import { ArrowLeft, ArrowRight, Check, Shield, ShieldCheck, Lock, TrendingUp, Wallet, User, Gift, Calendar as CalendarIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Logo } from "@/components/ui/logo";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { haptic } from "@/lib/haptics";
import { ProcessingState, SuccessState } from "@/components/ui/gemini";
import { SetupProgressNudge, TrustMicroStrip } from "@/components/ui/ux-foundations";
import { toast } from "@/hooks/use-toast";
import { KORA_STARTER_MONTHLY } from "@shared/monetization";
import { prefetchDashboard } from "@/lib/prefetch";
import { getActiveFundId } from "@/hooks/use-active-fund";

type Step = "welcome" | "personal" | "identity" | "recipient" | "strategy" | "review" | "processing" | "success" | "pending" | "needs_attention" | "already_verified";

// Recipient step inserted between identity (parent SSN) and strategy.
// Per the parent-mental-model audit (project_age18_handoff_lifecycle_automatic),
// the kid SSN was previously collected only via a Dashboard nudge banner —
// a parent who finished Activate Investing thought the legal flow was
// complete and was confused when gifts piled up as cash. Putting it
// inline here closes the discoverability cliff. Auto-skips when no
// fund needs SSN (multi-fund + already-collected paths).
const STEPS: Step[] = ["welcome", "personal", "identity", "recipient", "strategy", "review"];
const MOTION_DUR = 0.2;
const PAGE_MAX = "max-w-lg md:max-w-2xl mx-auto px-4";
const PRIMARY_CTA = "w-full h-14 text-base font-semibold rounded-2xl";
const STEP_TITLES: Record<Step, string> = {
  welcome: "Welcome",
  personal: "Personal details",
  identity: "Identity verification",
  recipient: "Recipient identity",
  strategy: "Investment strategy",
  review: "Final review",
  processing: "Processing",
  success: "Completed",
  pending: "In review",
  needs_attention: "Needs attention",
  already_verified: "Already verified",
};

const stepIndex = (s: Step) => STEPS.indexOf(s);

export default function ActivateInvesting() {
  const [, setLocation] = useLocation();
  const { isLoading, isAuthenticated, user } = useAuth();
  const { data: subscription } = useSubscription();
  const { data: funds = [] } = useFunds();
  const queryClient = useQueryClient();
  const [step, setStep] = useState<Step>("welcome");
  const [upgradingPlan, setUpgradingPlan] = useState<"starter" | "family" | null>(null);
  const [starterFundId, setStarterFundId] = useState<string>("");

  const [personal, setPersonal] = useState({
    firstName: "",
    lastName: "",
    dob: "",
    street: "",
    city: "",
    state: "",
    zip: "",
    phone: "",
  });

  const [identity, setIdentity] = useState({
    ssn: "",
    citizenship: "us_citizen",
    employment: "employed",
  });

  const [strategy, setStrategy] = useState("growth");
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [identityLinking, setIdentityLinking] = useState(false);

  // Recipient SSN collection (kid's SSN). Sent to
  // /api/funds/:fundId/recipient-ssn for the first fund missing it.
  // Multi-fund parents: this step targets the most-recently-created
  // pending fund; remaining funds keep getting nudged via the
  // Dashboard banner. State stays self-contained so it doesn't
  // pollute the parent identity / personal blocks above.
  const [recipientSsn, setRecipientSsn] = useState("");
  const [recipientSubmitting, setRecipientSubmitting] = useState(false);
  const [recipientError, setRecipientError] = useState<string | null>(null);
  const [recipientSavedFundIds, setRecipientSavedFundIds] = useState<Set<string>>(new Set());

  // Successor custodian — soft prompt rendered inline in the review
  // step. Optional. PATCHes /api/funds/:id with the four
  // successorCustodian* fields when filled. Per UTMA legal context:
  // a named successor avoids a court process if the custodian dies
  // before the kid hits 18. Soft because most parents skip it; surface
  // again later via Dashboard banner once the fund crosses a milestone.
  const [successor, setSuccessor] = useState({ name: "", email: "", relation: "" });
  const [successorSubmitting, setSuccessorSubmitting] = useState(false);
  const [successorSaved, setSuccessorSaved] = useState(false);

  useEffect(() => {
    if (!starterFundId && funds.length > 0) {
      setStarterFundId(String(funds[0].id));
    }
  }, [funds, starterFundId]);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const requestedStep = params.get("step");
    if (requestedStep && (STEPS as string[]).includes(requestedStep)) {
      setStep(requestedStep as Step);
    }
  }, []);

  useEffect(() => {
    let canceledEffect = false;
    const params = new URLSearchParams(window.location.search);
    const success = params.get("success");
    const canceled = params.get("canceled");
    const fundId = params.get("fundId");
    if (!success && !canceled) return;

    const run = async () => {
      if (success === "starter" || success === "family") {
        try {
          await fetch("/api/subscription/sync-stripe", {
            method: "POST",
            credentials: "include",
          });
        } catch {
          // Best effort.
        }
      }

      if (canceledEffect) return;
      if (success === "starter") {
        const fundName = funds.find((f: any) => String(f.id) === String(fundId))?.name;
        toast({
          title: "Kiddo Plus activated",
          description: fundName
            ? `Custom strategy is now unlocked for ${fundName}.`
            : "Custom strategy is now unlocked for your selected fund.",
        });
        void queryClient.invalidateQueries({ queryKey: ["/api/subscription"] });
      } else if (success === "family") {
        toast({ title: "Kiddo Family activated", description: "Custom strategy is now unlocked for your account." });
        void queryClient.invalidateQueries({ queryKey: ["/api/subscription"] });
      } else if (canceled === "true") {
        toast({ title: "Upgrade canceled", description: "No changes were made." });
      }

      params.delete("success");
      params.delete("canceled");
      params.delete("fundId");
      const nextQuery = params.toString();
      const nextUrl = `${window.location.pathname}${nextQuery ? `?${nextQuery}` : ""}`;
      window.history.replaceState({}, "", nextUrl);
    };
    void run();

    return () => {
      canceledEffect = true;
    };
  }, [queryClient, funds]);

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      setLocation("/login");
    }
  }, [isLoading, isAuthenticated, setLocation]);

  useEffect(() => {
    if (isLoading || !user) return;
    if ((user as any).kycStatus !== "approved") return;
    setStep("already_verified");
    // Reconcile any draft funds in a single request, THEN invalidate so the
    // dashboard's setup-progress and per-fund tiles refresh with the new
    // active status. The previous version fired per-fund POSTs in parallel
    // and invalidated before they completed — so the cache refetch saw stale
    // draft data and the to-do never cleared. Server-side endpoint is
    // idempotent, so this is safe to call on every page load.
    let cancelled = false;
    void (async () => {
      try {
        const res = await fetch("/api/funds/activate-pending-drafts", {
          method: "POST",
          credentials: "include",
        });
        if (!res.ok || cancelled) return;
        const data = await res.json().catch(() => ({ activated: 0 }));
        if (data?.activated > 0) {
          await queryClient.invalidateQueries({ queryKey: ["/api/funds"] });
          await queryClient.refetchQueries({ queryKey: ["/api/funds"], type: "active" });
          const names = Array.isArray(data.funds) ? data.funds.map((f: any) => f.name).filter(Boolean) : [];
          const summary = names.length === 0
            ? `${data.activated} fund${data.activated === 1 ? "" : "s"}`
            : names.length === 1
              ? `${names[0]}'s fund`
              : names.length === 2
                ? `${names[0]} & ${names[1]}'s funds`
                : `${names.slice(0, -1).join(", ")} & ${names[names.length - 1]}'s funds`;
          toast({
            title: "All set",
            description: `${summary} now ${data.activated === 1 ? "is" : "are"} active and ready for gifts.`,
          });
        }
      } catch {
        // Non-blocking — the page still renders the "already verified" state.
      }
    })();
    return () => { cancelled = true; };
  }, [isLoading, user, queryClient]);

  // Submit handler for the recipient step. Posts kid SSN to the
  // existing /api/funds/:fundId/recipient-ssn endpoint (same one the
  // Dashboard nudge uses), tracks the saved fund in local state so
  // the picker advances, then auto-advances to the next step. Errors
  // surface inline; never throws past the user.
  const handleRecipientSubmit = async () => {
    if (!pendingRecipientFund || !canProceedRecipient || recipientSubmitting) return;
    setRecipientSubmitting(true);
    setRecipientError(null);
    try {
      const res = await fetch(`/api/funds/${pendingRecipientFund.id}/recipient-ssn`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ ssn: recipientSsn }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setRecipientError(data?.error || "Could not save. Try again.");
        return;
      }
      haptic("success");
      setRecipientSavedFundIds((prev) => new Set(prev).add(String(pendingRecipientFund.id)));
      setRecipientSsn("");
      // Refresh funds so the picker re-evaluates and the next render
      // either advances to another pending fund or auto-skips ahead.
      await queryClient.invalidateQueries({ queryKey: ["/api/funds"] });
      // Advance to the next step. If there are more pending funds,
      // we'll re-render this same step with the next pending fund
      // queued (no advance). If none, advance to strategy.
      const updatedSavedIds = new Set(recipientSavedFundIds);
      updatedSavedIds.add(String(pendingRecipientFund.id));
      const stillPending = (funds as any[])
        .filter((f) => String(f?.accountType || "").toUpperCase() === "UTMA")
        .filter((f) => !f?.recipientSsnCollectedAt)
        .filter((f) => !updatedSavedIds.has(String(f.id)));
      if (stillPending.length === 0) {
        const i = stepIndex(step);
        if (i < STEPS.length - 1) setStep(STEPS[i + 1]);
      }
    } catch {
      setRecipientError("Network problem. Please try again.");
    } finally {
      setRecipientSubmitting(false);
    }
  };

  const goNext = () => {
    haptic("selection");
    const i = stepIndex(step);
    if (i < STEPS.length - 1) {
      // Auto-skip recipient step when no fund needs SSN. Keeps the
      // multi-fund / already-collected paths from showing a useless
      // empty form.
      const next = STEPS[i + 1];
      if (next === "recipient" && !pendingRecipientFund) {
        if (i + 2 < STEPS.length) setStep(STEPS[i + 2]);
        return;
      }
      setStep(next);
    }
  };

  const goBack = () => {
    haptic("light");
    const i = stepIndex(step);
    if (i > 0) {
      // Same skip in reverse so back doesn't land on the empty step.
      const prev = STEPS[i - 1];
      if (prev === "recipient" && !pendingRecipientFund) {
        if (i - 2 >= 0) setStep(STEPS[i - 2]);
        return;
      }
      setStep(STEPS[i - 1]);
    }
  };

  const handleSubmit = async () => {
    haptic("medium");
    setStep("processing");

    try {
      const res = await fetch("/api/kyc/submit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ personal, identity, strategy }),
      });
      const payload = await res.json().catch(() => null);
      if (!res.ok) {
        console.error("KYC submission failed:", payload);
        toast({
          title: "We could not submit verification",
          description: payload?.error || "Please try again.",
          variant: "destructive",
        });
        setStep("review");
        return;
      }
      queryClient.invalidateQueries({ queryKey: ["/api/auth/user"] });
      queryClient.invalidateQueries({ queryKey: ["/api/funds"] });
      setTimeout(() => {
        if (payload?.status === "pending") {
          haptic("light");
          setStep("pending");
          return;
        }
        if (payload?.status === "failed") {
          haptic("light");
          setStep("needs_attention");
          return;
        }
        haptic("success");
        setStep("success");
        // Pre-warm the dashboard the user is about to land on. KYC just
        // flipped funds active; the new dashboard view needs fresh data
        // anyway. Firing now means by the time they tap "Continue to
        // dashboard" (likely 2-5 seconds later as they read the success
        // message) the data is already cached.
        prefetchDashboard(queryClient, getActiveFundId());
      }, 2000);
    } catch (e) {
      console.error(e);
      setStep("review");
    }
  };

  const phoneDigits = personal.phone.replace(/\D/g, "");
  const zipDigits = personal.zip.replace(/\D/g, "");
  const birthDate = personal.dob ? new Date(personal.dob) : null;
  const adultAge =
    birthDate && Number.isFinite(birthDate.getTime())
      ? (Date.now() - birthDate.getTime()) / (365.25 * 24 * 60 * 60 * 1000)
      : 0;
  const hasLegalName = (value: string) => /^[A-Za-z][A-Za-z '.-]{1,}$/.test(value.trim());

  const canProceedPersonal =
    hasLegalName(personal.firstName) &&
    hasLegalName(personal.lastName) &&
    personal.dob &&
    adultAge >= 18 &&
    personal.street.trim().length >= 4 &&
    personal.city.trim().length >= 2 &&
    /^[A-Z]{2}$/.test(personal.state) &&
    zipDigits.length === 5 &&
    phoneDigits.length === 10;

  const canProceedIdentity =
    identity.ssn.length === 9 &&
    !/^(\d)\1{8}$/.test(identity.ssn) &&
    ["us_citizen", "permanent_resident"].includes(identity.citizenship) &&
    identity.employment;

  // Fund whose recipient SSN we'll collect in the recipient step. Picks
  // the most-recently-created UTMA fund missing recipientSsnCollectedAt.
  // Multi-fund parents who haven't collected SSNs for all kids will
  // address them one at a time — first via this step, the rest via
  // the Dashboard nudge banner. The recipientSavedFundIds set tracks
  // funds completed THIS session so the picker advances if they
  // refill the form for a different fund (rare but defensive).
  const pendingRecipientFund = (() => {
    const candidates = (funds as any[])
      .filter((f) => String(f?.accountType || "").toUpperCase() === "UTMA")
      .filter((f) => !f?.recipientSsnCollectedAt)
      .filter((f) => !recipientSavedFundIds.has(String(f.id)));
    if (candidates.length === 0) return null;
    // Newest first — most recently created fund is most likely the one
    // the parent is in the middle of setting up.
    candidates.sort((a, b) => {
      const aTs = a?.createdAt ? new Date(a.createdAt).getTime() : 0;
      const bTs = b?.createdAt ? new Date(b.createdAt).getTime() : 0;
      return bTs - aTs;
    });
    return candidates[0];
  })();
  const recipientChildName = String(pendingRecipientFund?.recipientFirstName || "the child");
  const otherFundsPendingRecipient = (funds as any[])
    .filter((f) => String(f?.accountType || "").toUpperCase() === "UTMA")
    .filter((f) => !f?.recipientSsnCollectedAt)
    .filter((f) => pendingRecipientFund && String(f.id) !== String(pendingRecipientFund.id))
    .filter((f) => !recipientSavedFundIds.has(String(f.id)));

  const canProceedRecipient =
    !pendingRecipientFund ||
    (recipientSsn.length === 9 && !/^(\d)\1{8}$/.test(recipientSsn));

  // First fund missing a successor custodian — drives the optional
  // panel in the review step. Picks any UTMA fund without a
  // successorCustodianName set. Same multi-fund handling: prompt for
  // one, mention others can be added in Settings.
  const pendingSuccessorFund = (() => {
    const candidates = (funds as any[])
      .filter((f) => String(f?.accountType || "").toUpperCase() === "UTMA")
      .filter((f) => !String(f?.successorCustodianName || "").trim())
      .filter((f) => !successorSaved || String(f.id) !== String((funds as any[])[0]?.id));
    if (candidates.length === 0) return null;
    candidates.sort((a, b) => {
      const aTs = a?.createdAt ? new Date(a.createdAt).getTime() : 0;
      const bTs = b?.createdAt ? new Date(b.createdAt).getTime() : 0;
      return bTs - aTs;
    });
    return candidates[0];
  })();

  const userPlan: "free" | "starter" | "family" | "legacy" = (subscription?.effectivePlan || "free") as
    | "free"
    | "starter"
    | "family"
    | "legacy";
  const canUseCustom = userPlan === "starter" || userPlan === "family" || userPlan === "legacy";

  const handleUpgradePlan = async (plan: "starter" | "family") => {
    if (plan === "starter" && !starterFundId) {
      toast({
        title: "Choose a fund first",
        description: "Pick the fund you want to upgrade with Kiddo Plus.",
        variant: "destructive",
      });
      return;
    }
    const endpoint =
      plan === "family"
        ? "/api/stripe/checkout/family-plan"
        : "/api/stripe/checkout/starter-plan";
    setUpgradingPlan(plan);
    haptic("medium");
    try {
      const res = await fetch(endpoint, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...(plan === "starter" ? { fundId: starterFundId } : {}),
          returnTo:
            plan === "starter"
              ? `/activate?step=strategy&success=starter&fundId=${encodeURIComponent(starterFundId)}`
              : `/activate?step=strategy&success=family`,
          cancelTo: "/activate?step=strategy&canceled=true",
        }),
      });
      const raw = await res.text();
      let data: any = {};
      try {
        data = raw ? JSON.parse(raw) : {};
      } catch {
        data = { error: raw || `HTTP ${res.status}` };
      }
      if (data.url) {
        window.location.href = data.url;
        return;
      }
      const details = data?.details
        ? `\n${typeof data.details === "string" ? data.details : JSON.stringify(data.details)}`
        : "";
      const fallback = res.ok ? "Could not start checkout" : `HTTP ${res.status}`;
      toast({ title: "Could not start upgrade", description: `${data.error || fallback}${details}`, variant: "destructive" });
    } catch (error) {
      toast({
        title: "Could not start upgrade",
        description: error instanceof Error ? error.message : "Please try again",
        variant: "destructive",
      });
    } finally {
      setUpgradingPlan(null);
    }
  };

  const handleIdentityPlaidStart = async () => {
    setIdentityLinking(true);
    haptic("medium");
    try {
      const res = await fetch("/api/plaid/link-token", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || "Could not start Plaid verification.");
      if (!data?.configured) {
        toast({
          title: "Plaid is not configured here",
          description: data?.message || "Use manual identity entry for local testing.",
        });
        return;
      }
      toast({
        title: "Plaid session ready",
        description: "Connect Plaid Link with this token to prefill verified identity details.",
      });
    } catch (error) {
      toast({
        title: "Could not start Plaid",
        description: error instanceof Error ? error.message : "Please enter details manually.",
        variant: "destructive",
      });
    } finally {
      setIdentityLinking(false);
    }
  };

  const progress = step === "processing" || step === "success" ? 100 : ((stepIndex(step) + 1) / STEPS.length) * 100;
  const currentStep = stepIndex(step) + 1;

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <ProcessingState message="Loading..." />
      </div>
    );
  }

  const inputClass =
    "w-full px-4 py-3 bg-background border border-border rounded-xl text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/40 transition-all duration-150";

  return (
    <div className="min-h-screen gemini-warm-section overflow-hidden">
      <header className="sticky top-0 z-50 gemini-glass-nav">
        <div className={`${PAGE_MAX} h-14 flex items-center justify-between`}>
          {step !== "processing" && step !== "success" && step !== "pending" && step !== "needs_attention" && step !== "already_verified" ? (
            <button
              onClick={step === "welcome" ? () => setLocation("/dashboard") : goBack}
              data-testid={step === "welcome" ? "button-close" : "button-back"}
              className="w-10 h-10 rounded-full bg-card border border-border flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted transition-all duration-150"
            >
              <ArrowLeft size={18} />
            </button>
          ) : (
            <div className="w-10" />
          )}
          <Logo size="sm" className="text-primary" linkTo={null} />
          <div className="w-10" />
        </div>
        {step !== "processing" && step !== "success" && step !== "pending" && step !== "needs_attention" && step !== "already_verified" && (
          <div className={`${PAGE_MAX} pb-2`}>
            <div className="h-1 bg-muted rounded-full overflow-hidden">
              <motion.div
                className="h-full bg-primary rounded-full"
                initial={{ width: 0 }}
                animate={{ width: `${progress}%` }}
                transition={{ duration: 0.3, ease: "easeOut" }}
              />
            </div>
            <p className="mt-2 text-center text-xs text-muted-foreground">
              Step {currentStep} of {STEPS.length} - {STEP_TITLES[step]}
            </p>
          </div>
        )}
      </header>

      <main className={`${PAGE_MAX} py-8`}>
        <AnimatePresence mode="wait">
          {step === "welcome" && (
            <motion.div
              key="welcome"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              transition={{ duration: MOTION_DUR }}
              className="space-y-6"
            >
              <div className="text-center space-y-3">
                <motion.div
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={{ duration: MOTION_DUR }}
                  className="w-16 h-16 rounded-2xl bg-primary flex items-center justify-center mx-auto shadow-lg"
                >
                  <TrendingUp size={28} className="text-primary-foreground" />
                </motion.div>
                <h1 className="font-heading text-2xl md:text-3xl font-semibold text-foreground" data-testid="text-welcome-heading">
                  Activate your fund
                </h1>
                <p className="text-muted-foreground leading-relaxed text-sm" data-testid="text-welcome-description">
                  This takes about 3 minutes. Once you are verified, every gift your child receives can be automatically invested in real stocks. Identity verification is a legal requirement to open the investment account and make the fund real.
                </p>
                <p className="text-sm text-muted-foreground italic">
                  If you wait, gifts can still arrive, but they stay in cash until you come back and activate investing. Once verified, that cash starts investing automatically.
                </p>
              </div>

              <div className="space-y-3">
                <div className="bg-card rounded-2xl border border-border/50 p-4 flex items-start gap-3 shadow-sm" data-testid="card-benefit-auto-invest">
                  <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                    <TrendingUp size={20} className="text-primary" />
                  </div>
                  <div>
                    <p className="font-medium text-foreground text-sm">This is the moment the fund becomes real</p>
                    <p className="text-xs text-muted-foreground mt-0.5">Once verified, gifts can move straight into real stocks without extra steps</p>
                  </div>
                </div>
                <div className="bg-card rounded-2xl border border-border/50 p-4 flex items-start gap-3 shadow-sm" data-testid="card-benefit-real-stocks">
                  <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                    <Wallet size={20} className="text-primary" />
                  </div>
                  <div>
                    <p className="font-medium text-foreground text-sm">Real stocks, held in your name</p>
                    <p className="text-xs text-muted-foreground mt-0.5">You own every share directly</p>
                  </div>
                </div>
                <div className="bg-card rounded-2xl border border-border/50 p-4 flex items-start gap-3 shadow-sm" data-testid="card-benefit-protection">
                  <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                    <Shield size={20} className="text-primary" />
                  </div>
                  <div>
                    <p className="font-medium text-foreground text-sm">Protected by SIPC up to $500,000</p>
                    <p className="text-xs text-muted-foreground mt-0.5">Your investments are safeguarded</p>
                  </div>
                </div>
              </div>

              <SetupProgressNudge
                title="What happens if you activate now"
                subtitle="Verification opens the brokerage account that turns gifting into real investing."
                percent={20}
                items={[
                  "Collect gifts now, then invest them once verified",
                  "Turn this fund into a real investment account",
                  "Access brokerage protections and reporting",
                ]}
              />

              <Button
                onClick={goNext}
                data-testid="button-begin-verification"
                className={PRIMARY_CTA}
              >
                Begin Verification
                <ArrowRight size={18} className="ml-2" />
              </Button>

              <button
                onClick={() => setLocation("/dashboard")}
                data-testid="button-skip-activation"
                className="w-full py-3 text-sm text-muted-foreground hover:text-foreground transition-colors"
              >
                I&apos;ll activate later and keep gifts in cash for now
              </button>

              <div className="flex items-center gap-2 text-xs text-muted-foreground justify-center">
                <Lock size={12} />
                <span>Your information is encrypted and secure</span>
              </div>

              <TrustMicroStrip />
            </motion.div>
          )}

          {step === "personal" && (
            <motion.div
              key="personal"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              transition={{ duration: MOTION_DUR }}
              className="space-y-6"
            >
              <div>
                <h1 className="font-heading text-xl font-semibold text-foreground mb-1" data-testid="text-personal-heading">
                  Your personal information
                </h1>
                <p className="text-sm text-muted-foreground">This is your information, the account holder. <strong>Not your child's.</strong> The same details you would use to open any brokerage account.</p>
              </div>

              <div className="rounded-2xl border border-primary/20 bg-primary/5 p-4">
                <div className="flex items-start gap-3">
                  <Lock size={16} className="mt-0.5 text-primary" />
                  <div>
                    <p className="text-sm font-medium text-foreground">Your information is encrypted</p>
                    <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                      All personal details are transmitted over TLS and stored encrypted. This is the same process used by licensed broker-dealers to open investment accounts.
                    </p>
                  </div>
                </div>
              </div>

              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-sm font-medium text-foreground mb-1.5">Your first name</label>
                    <input
                      type="text"
                      value={personal.firstName}
                      onChange={(e) => setPersonal({ ...personal, firstName: e.target.value })}
                      placeholder="Jane"
                      data-testid="input-first-name"
                      className={inputClass}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-foreground mb-1.5">Your last name</label>
                    <input
                      type="text"
                      value={personal.lastName}
                      onChange={(e) => setPersonal({ ...personal, lastName: e.target.value })}
                      placeholder="Smith"
                      data-testid="input-last-name"
                      className={inputClass}
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-foreground mb-1.5">Your date of birth</label>
                  {/* Modern shadcn calendar in a popover. Replaces the
                      native <input type="date"> which renders as the
                      browser's stock picker (inconsistent across
                      Safari/Chrome/Firefox + jarring against the
                      kiddo design system). Same component AddFundSheet
                      and EventCreate use for the child birthdate.
                      Year bounds are 110 years ago → 18 years ago
                      (the account holder must be 18+); defaultMonth
                      lands on a typical-adult age (~30 years ago) so
                      the picker doesn't open at "today" and force the
                      user to scrub back through 30 years of months. */}
                  {(() => {
                    const today = new Date();
                    const minAdultDate = new Date(today.getFullYear() - 18, today.getMonth(), today.getDate());
                    const earliestDate = new Date(today.getFullYear() - 110, 0, 1);
                    const defaultFocusMonth = new Date(today.getFullYear() - 30, 0);
                    const dobDate = personal.dob ? new Date(personal.dob + "T12:00:00") : undefined;
                    return (
                      <Popover>
                        <PopoverTrigger asChild>
                          <button
                            type="button"
                            data-testid="input-dob"
                            className={`${inputClass} flex items-center justify-between text-left`}
                          >
                            <span className={dobDate ? "text-foreground" : "text-muted-foreground/50"}>
                              {dobDate
                                ? dobDate.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })
                                : "Select your date of birth"}
                            </span>
                            <CalendarIcon size={16} className="shrink-0 text-muted-foreground" />
                          </button>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0" align="start">
                          <Calendar
                            mode="single"
                            captionLayout="dropdown"
                            selected={dobDate}
                            onSelect={(date) => {
                              if (!date) return;
                              const y = date.getFullYear();
                              const m = String(date.getMonth() + 1).padStart(2, "0");
                              const d = String(date.getDate()).padStart(2, "0");
                              setPersonal({ ...personal, dob: `${y}-${m}-${d}` });
                            }}
                            fromYear={earliestDate.getFullYear()}
                            toYear={minAdultDate.getFullYear()}
                            defaultMonth={dobDate || defaultFocusMonth}
                            disabled={{ after: minAdultDate, before: earliestDate }}
                          />
                        </PopoverContent>
                      </Popover>
                    );
                  })()}
                  {personal.dob && adultAge < 18 && (
                    <p className="mt-1 text-xs text-destructive">The account holder must be at least 18.</p>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium text-foreground mb-1.5">Your home address</label>
                  <input
                    type="text"
                    value={personal.street}
                    onChange={(e) => setPersonal({ ...personal, street: e.target.value })}
                    placeholder="123 Main St"
                    data-testid="input-street"
                    className={inputClass}
                  />
                </div>

                <div className="grid grid-cols-6 gap-3">
                  <div className="col-span-3">
                    <label className="block text-sm font-medium text-foreground mb-1.5">City</label>
                    <input
                      type="text"
                      value={personal.city}
                      onChange={(e) => setPersonal({ ...personal, city: e.target.value })}
                      placeholder="San Francisco"
                      data-testid="input-city"
                      className={inputClass}
                    />
                  </div>
                  <div className="col-span-1">
                    <label className="block text-sm font-medium text-foreground mb-1.5">State</label>
                    <input
                      type="text"
                      value={personal.state}
                      onChange={(e) => setPersonal({ ...personal, state: e.target.value.toUpperCase().slice(0, 2) })}
                      placeholder="CA"
                      data-testid="input-state"
                      className={inputClass}
                    />
                  </div>
                  <div className="col-span-2">
                    <label className="block text-sm font-medium text-foreground mb-1.5">ZIP</label>
                    <input
                      type="text"
                      value={personal.zip}
                      onChange={(e) => setPersonal({ ...personal, zip: e.target.value.replace(/\D/g, "").slice(0, 5) })}
                      placeholder="94102"
                      data-testid="input-zip"
                      className={inputClass}
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-foreground mb-1.5">Your phone number</label>
                  <input
                    type="tel"
                    value={personal.phone}
                    onChange={(e) => setPersonal({ ...personal, phone: e.target.value.replace(/[^\d()\-\s.]/g, "").slice(0, 14) })}
                    placeholder="(555) 123-4567"
                    data-testid="input-phone"
                    className={inputClass}
                  />
                  {personal.phone && phoneDigits.length !== 10 && (
                    <p className="mt-1 text-xs text-muted-foreground">Use a 10 digit US phone number.</p>
                  )}
                </div>
              </div>

              <Button
                onClick={goNext}
                disabled={!canProceedPersonal}
                data-testid="button-continue-personal"
                className={PRIMARY_CTA}
              >
                Continue
                <ArrowRight size={18} className="ml-2" />
              </Button>
            </motion.div>
          )}

          {step === "identity" && (
            <motion.div
              key="identity"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              transition={{ duration: MOTION_DUR }}
              className="space-y-6"
            >
              <div>
                <h1 className="font-heading text-xl font-semibold text-foreground mb-1" data-testid="text-identity-heading">
                  Identity verification
                </h1>
                <p className="text-sm text-muted-foreground">Just a few more questions to confirm your identity. The account holder's. Not your child's.</p>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-foreground mb-1.5">Social Security Number</label>
                  <input
                    type="password"
                    value={identity.ssn}
                    onChange={(e) =>
                      setIdentity({ ...identity, ssn: e.target.value.replace(/\D/g, "").slice(0, 9) })
                    }
                    placeholder="*********"
                    maxLength={9}
                    data-testid="input-ssn"
                    className={inputClass}
                  />
                  <p className="text-xs text-muted-foreground mt-1">Required by law to open an investment account. Encrypted and never stored in plain text.</p>
                  {identity.ssn && /^(\d)\1{8}$/.test(identity.ssn) && (
                    <p className="mt-1 text-xs text-destructive">Enter the real account holder SSN or ITIN.</p>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium text-foreground mb-1.5">Citizenship</label>
                  <select
                    value={identity.citizenship}
                    onChange={(e) => setIdentity({ ...identity, citizenship: e.target.value })}
                    data-testid="select-citizenship"
                    className={inputClass}
                  >
                    <option value="us_citizen">US Citizen</option>
                    <option value="permanent_resident">Permanent Resident</option>
                    <option value="other">Other</option>
                  </select>
                  {identity.citizenship === "other" && (
                    <p className="mt-1 text-xs text-muted-foreground">
                      Investing is currently available for US citizens and permanent residents. We will support more eligibility paths later.
                    </p>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium text-foreground mb-1.5">Employment status</label>
                  <select
                    value={identity.employment}
                    onChange={(e) => setIdentity({ ...identity, employment: e.target.value })}
                    data-testid="select-employment"
                    className={inputClass}
                  >
                    <option value="employed">Employed</option>
                    <option value="self_employed">Self-employed</option>
                    <option value="student">Student</option>
                    <option value="retired">Retired</option>
                    <option value="not_employed">Not employed</option>
                  </select>
                </div>
              </div>

              <div className="bg-card rounded-2xl border border-border/50 p-4 flex items-start gap-3">
                <Lock size={16} className="text-muted-foreground shrink-0 mt-0.5" />
                <p className="text-xs text-muted-foreground">
                  We use this information to open a regulated brokerage account. Your data is encrypted and never shared.
                </p>
              </div>

              <Button
                onClick={goNext}
                disabled={!canProceedIdentity}
                data-testid="button-continue-identity"
                className={PRIMARY_CTA}
              >
                Continue
                <ArrowRight size={18} className="ml-2" />
              </Button>
            </motion.div>
          )}

          {/* Recipient identity step. Inserted between identity (parent
              SSN) and strategy. Closes the discoverability cliff where
              the kid SSN was collected only via a Dashboard nudge after
              activate-investing already finished. Auto-skipped when no
              fund needs recipient SSN (handled in goNext / goBack
              above). UI mirrors the existing parent-identity step's
              shape but with explanatory copy specific to the kid's
              role + the IRS 1099 requirement. */}
          {step === "recipient" && pendingRecipientFund && (
            <motion.div
              key="recipient"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              transition={{ duration: MOTION_DUR }}
              className="space-y-6"
            >
              <div>
                <h1 className="font-heading text-xl font-semibold text-foreground mb-1" data-testid="text-recipient-heading">
                  {recipientChildName}'s Social Security Number
                </h1>
                <p className="text-sm text-muted-foreground">
                  Required by the IRS for 1099-DIV / 1099-B forms tied to {recipientChildName}'s UTMA account. One-time. Encrypted in transit. Last 4 digits stored, not the full number.
                </p>
              </div>

              <div className="rounded-2xl bg-muted/30 border border-border p-4">
                <p className="text-xs font-semibold text-foreground mb-1">
                  This is {recipientChildName}'s SSN, not yours.
                </p>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  The brokerage account is {recipientChildName}'s under your custodianship. Tax forms go in {recipientChildName}'s name to the IRS. Your SSN was collected on the previous step.
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-foreground mb-1.5">
                  {recipientChildName}'s Social Security Number
                </label>
                <input
                  type="text"
                  inputMode="numeric"
                  autoComplete="off"
                  value={
                    recipientSsn.length >= 5
                      ? `${recipientSsn.slice(0, 3)}-${recipientSsn.slice(3, 5)}-${recipientSsn.slice(5)}`
                      : recipientSsn.length >= 3
                        ? `${recipientSsn.slice(0, 3)}-${recipientSsn.slice(3)}`
                        : recipientSsn
                  }
                  onChange={(e) => {
                    setRecipientSsn(e.target.value.replace(/\D/g, "").slice(0, 9));
                    setRecipientError(null);
                  }}
                  placeholder="123-45-6789"
                  data-testid="input-recipient-ssn"
                  className={inputClass}
                />
                {recipientError && (
                  <p className="mt-1 text-xs text-destructive">{recipientError}</p>
                )}
              </div>

              {otherFundsPendingRecipient.length > 0 && (
                <p className="text-xs text-muted-foreground leading-relaxed">
                  You have {otherFundsPendingRecipient.length} other {otherFundsPendingRecipient.length === 1 ? "fund" : "funds"} that still need a recipient SSN. Add {otherFundsPendingRecipient.length === 1 ? "it" : "them"} from the dashboard after this is complete.
                </p>
              )}

              <Button
                onClick={() => void handleRecipientSubmit()}
                disabled={!canProceedRecipient || recipientSubmitting}
                data-testid="button-continue-recipient"
                className={PRIMARY_CTA}
              >
                {recipientSubmitting ? "Saving..." : "Continue"}
                {!recipientSubmitting && <ArrowRight size={18} className="ml-2" />}
              </Button>
            </motion.div>
          )}

          {step === "strategy" && (
            <motion.div
              key="strategy"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              transition={{ duration: MOTION_DUR }}
              className="space-y-6"
            >
              <div>
                <h1 className="font-heading text-xl font-semibold text-foreground mb-1" data-testid="text-strategy-heading">
                  Set the managed strategy behind your fund default
                </h1>
                <p className="text-sm text-muted-foreground">This controls where gifts go when they follow your managed default. Specific stock picks and cash gifts follow their own path.</p>
                <p className="text-xs text-muted-foreground mt-1.5">Kiddo does not charge a normal platform fee on gifts. The person sending covers payment processing separately, and large gifts have no required Kiddo fee.</p>
              </div>

              <div className="space-y-3">
                {[
                  {
                    id: "growth",
                    label: "Growth Mix",
                    description: "Long-term growth with broad diversification",
                    icon: <TrendingUp size={20} />,
                    tag: "Most popular",
                    locked: false,
                  },
                  {
                    id: "balanced",
                    label: "Steady & Balanced",
                    description: "Lower risk with more bond allocation",
                    icon: <Shield size={20} />,
                    tag: null,
                    locked: false,
                  },
                  {
                    id: "conservative",
                    label: "Conservative Mix",
                    description: "Capital preservation tilt. Best for kids approaching 18",
                    icon: <ShieldCheck size={20} />,
                    tag: null,
                    locked: false,
                  },
                  {
                    id: "custom",
                    label: "Custom",
                    description: "Choose your own allocation",
                    icon: <User size={20} />,
                    tag: null,
                    locked: !canUseCustom,
                  },
                ].map((opt) => (
                  <div
                    key={opt.id}
                    role="button"
                    tabIndex={opt.locked ? -1 : 0}
                    onClick={() => {
                      if (opt.locked) return;
                      haptic("selection");
                      setStrategy(opt.id);
                    }}
                    onKeyDown={(e) => {
                      if (opt.locked) return;
                      if (e.key === "Enter" || e.key === " ") { e.preventDefault(); haptic("selection"); setStrategy(opt.id); }
                    }}
                    data-testid={`option-strategy-${opt.id}`}
                    aria-disabled={opt.locked}
                    aria-pressed={strategy === opt.id}
                    className={`w-full p-4 rounded-2xl border-2 text-left transition-all duration-150 active:scale-[0.99] ${
                      strategy === opt.id
                        ? "border-primary bg-primary/5"
                        : opt.locked
                        ? "border-border/40 bg-card opacity-60 cursor-not-allowed"
                        : "border-border bg-card hover:border-muted-foreground/30 cursor-pointer"
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      <div
                        className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
                          strategy === opt.id ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
                        }`}
                      >
                        {opt.icon}
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-0.5">
                          <p className="font-medium text-foreground">{opt.label}</p>
                          {opt.tag && (
                            <span className="text-xs px-2 py-0.5 bg-primary/10 text-primary rounded-full">{opt.tag}</span>
                          )}
                          {opt.id === "custom" && canUseCustom && (
                            <span className="text-xs px-2 py-0.5 bg-emerald-100 text-emerald-700 rounded-full">Included in your plan</span>
                          )}
                          {opt.id === "custom" && opt.locked && (
                            <span className="text-xs px-2 py-0.5 bg-muted text-muted-foreground rounded-full">Kiddo Plus, Family, or Legacy</span>
                          )}
                        </div>
                        <p className="text-sm text-muted-foreground">{opt.description}</p>
                        {opt.id === "custom" && opt.locked && (
                          <div className="mt-2.5 space-y-2">
                            <p className="text-xs text-muted-foreground">Unlock here, or continue and upgrade later in Settings.</p>
                            <div className="space-y-1.5">
                              <p className="text-[11px] text-muted-foreground">Choose which fund to cover now:</p>
                              <select
                                value={starterFundId}
                                onChange={(e) => setStarterFundId(e.target.value)}
                                className="w-full rounded-lg border border-border bg-background px-3 py-2 text-xs text-foreground"
                                data-testid="select-starter-fund-activate"
                              >
                                {funds.map((f: any) => (
                                  <option key={f.id} value={f.id}>
                                    {f.name}
                                  </option>
                                ))}
                              </select>
                            </div>
                            <div className="flex flex-wrap gap-2">
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  void handleUpgradePlan("starter");
                                }}
                                disabled={upgradingPlan !== null || !starterFundId}
                                className="text-xs px-3 py-1.5 rounded-lg border border-border bg-background text-foreground hover:bg-muted disabled:opacity-60"
                                data-testid="button-upgrade-starter-inline"
                              >
                                {upgradingPlan === "starter" ? "Opening..." : `Add Kiddo Plus for $${KORA_STARTER_MONTHLY.toFixed(2)}/mo`}
                              </button>
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  void handleUpgradePlan("family");
                                }}
                                disabled={upgradingPlan !== null}
                                className="text-xs px-3 py-1.5 rounded-lg border border-border bg-background text-foreground hover:bg-muted disabled:opacity-60"
                                data-testid="button-upgrade-family-inline"
                              >
                                {upgradingPlan === "family" ? "Opening..." : "Upgrade to Kiddo Family"}
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                      <div
                        className={`w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 mt-1 ${
                          strategy === opt.id ? "border-primary bg-primary" : "border-border"
                        }`}
                      >
                        {strategy === opt.id && <Check size={12} className="text-primary-foreground" />}
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              <div className="bg-card rounded-2xl border border-border/50 p-4 space-y-2.5">
                <p className="text-xs font-medium text-foreground">How does this work with gifts?</p>
                <div className="space-y-2 text-xs text-muted-foreground">
                  <div className="flex items-start gap-2">
                    <TrendingUp size={13} className="text-primary shrink-0 mt-0.5" />
                    <p><span className="font-medium text-foreground">Most gifts invest automatically</span> into your default strategy above. No action needed from you.</p>
                  </div>
                  <div className="flex items-start gap-2">
                    <Gift size={13} className="text-primary shrink-0 mt-0.5" />
                    <p><span className="font-medium text-foreground">If a giver picks a specific stock</span> (like $50 of Disney), that gift goes exactly where they chose. Your default isn't used.</p>
                  </div>
                  <div className="flex items-start gap-2">
                    <User size={13} className="text-primary shrink-0 mt-0.5" />
                    <p><span className="font-medium text-foreground">You can also hold gifts as cash</span> and decide later. Change this per-fund anytime in settings.</p>
                  </div>
                </div>
              </div>

              <p className="text-xs text-muted-foreground text-center">You can change this anytime from your settings.</p>

              <Button
                onClick={goNext}
                data-testid="button-continue-strategy"
                className={PRIMARY_CTA}
              >
                Continue
                <ArrowRight size={18} className="ml-2" />
              </Button>
            </motion.div>
          )}

          {step === "review" && (
            <motion.div
              key="review"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              transition={{ duration: MOTION_DUR }}
              className="space-y-6"
            >
              <div>
                <h1 className="font-heading text-xl font-semibold text-foreground mb-1" data-testid="text-review-heading">
                  Review your information
                </h1>
                <p className="text-sm text-muted-foreground">Make sure everything looks correct before submitting.</p>
              </div>

              <div className="bg-card rounded-2xl border border-border/50 p-5 space-y-4 shadow-sm">
                <div>
                  <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1">Name</p>
                  <p className="text-sm font-medium text-foreground" data-testid="text-review-name">
                    {personal.firstName} {personal.lastName}
                  </p>
                </div>
                <div className="border-t border-border/50" />
                <div>
                  <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1">Date of birth</p>
                  <p className="text-sm font-medium text-foreground" data-testid="text-review-dob">{personal.dob}</p>
                </div>
                <div className="border-t border-border/50" />
                <div>
                  <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1">Address</p>
                  <p className="text-sm font-medium text-foreground" data-testid="text-review-address">
                    {personal.street}, {personal.city}, {personal.state} {personal.zip}
                  </p>
                </div>
                <div className="border-t border-border/50" />
                <div>
                  <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1">Phone</p>
                  <p className="text-sm font-medium text-foreground" data-testid="text-review-phone">{personal.phone}</p>
                </div>
                <div className="border-t border-border/50" />
                <div>
                  <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1">Social Security Number</p>
                  <p className="text-sm font-medium text-foreground" data-testid="text-review-ssn">
                    ***-**-{identity.ssn.slice(-4)}
                  </p>
                </div>
                <div className="border-t border-border/50" />
                <div>
                  <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1">Investment approach</p>
                  <p className="text-sm font-medium text-foreground" data-testid="text-review-strategy">
                    {strategy === "growth"
                      ? "Growth Mix"
                      : strategy === "balanced"
                        ? "Steady & Balanced"
                        : strategy === "conservative"
                          ? "Conservative Mix"
                          : "Custom"}
                  </p>
                </div>
              </div>

              {/* Optional: name a successor custodian. UTMA legal context
                  — without one, if the parent dies before the kid hits
                  18, the fund's transfer to a new custodian goes
                  through state intestate rules instead of the parent's
                  named choice. Soft prompt because most parents skip
                  this initially; surfacing it here in the activate
                  flow catches the parents who would otherwise never
                  discover the Settings → Successor custodian section.
                  Skip-friendly. */}
              {pendingSuccessorFund && !successorSaved && (
                <div className="bg-muted/20 rounded-2xl border border-border/50 p-5 space-y-4">
                  <div>
                    <div className="flex items-start gap-2.5">
                      <ShieldCheck size={16} className="mt-0.5 shrink-0 text-[hsl(var(--kiddo-evergreen))]" />
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-semibold text-foreground">
                          Name a successor custodian <span className="font-normal text-muted-foreground">(optional)</span>
                        </p>
                        <p className="mt-1 text-xs text-muted-foreground leading-relaxed">
                          The person who steps in to manage {String(pendingSuccessorFund.recipientFirstName || "this fund")}'s fund if anything happens to you. UTMA law expects a named successor — without one, a court chooses.
                        </p>
                      </div>
                    </div>
                  </div>
                  <div className="space-y-3">
                    <input
                      type="text"
                      value={successor.name}
                      onChange={(e) => setSuccessor({ ...successor, name: e.target.value })}
                      placeholder="Successor's full name"
                      data-testid="input-successor-name"
                      className={inputClass}
                    />
                    <input
                      type="email"
                      value={successor.email}
                      onChange={(e) => setSuccessor({ ...successor, email: e.target.value })}
                      placeholder="Successor's email (so we can reach them)"
                      data-testid="input-successor-email"
                      className={inputClass}
                    />
                    <input
                      type="text"
                      value={successor.relation}
                      onChange={(e) => setSuccessor({ ...successor, relation: e.target.value })}
                      placeholder="Relationship (e.g., spouse, sibling, godparent)"
                      data-testid="input-successor-relation"
                      className={inputClass}
                    />
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={async () => {
                      const trimmedName = successor.name.trim();
                      if (!trimmedName) return;
                      setSuccessorSubmitting(true);
                      try {
                        const res = await fetch(`/api/funds/${pendingSuccessorFund.id}`, {
                          method: "PATCH",
                          headers: { "Content-Type": "application/json" },
                          credentials: "include",
                          body: JSON.stringify({
                            successorCustodianName: trimmedName,
                            successorCustodianEmail: successor.email.trim() || null,
                            successorCustodianRelation: successor.relation.trim() || null,
                            successorCustodianAddedAt: new Date().toISOString(),
                          }),
                        });
                        if (!res.ok) throw new Error("save failed");
                        haptic("success");
                        setSuccessorSaved(true);
                        toast({
                          title: "Successor saved",
                          description: `${trimmedName} will step in if anything happens to you.`,
                        });
                        await queryClient.invalidateQueries({ queryKey: ["/api/funds"] });
                      } catch {
                        haptic("error");
                        toast({
                          title: "Couldn't save successor",
                          description: "Try again from Settings if needed. Activation can continue.",
                          variant: "destructive",
                        });
                      } finally {
                        setSuccessorSubmitting(false);
                      }
                    }}
                    disabled={!successor.name.trim() || successorSubmitting}
                    className="rounded-xl"
                    data-testid="button-save-successor"
                  >
                    {successorSubmitting ? "Saving..." : "Save successor"}
                  </Button>
                  <p className="text-[11px] text-muted-foreground leading-relaxed">
                    Skip this and finish below if you'd rather add it later from Settings.
                  </p>
                </div>
              )}

              {pendingSuccessorFund && successorSaved && (
                <div className="bg-[hsl(var(--kiddo-evergreen)/0.05)] rounded-2xl border border-[hsl(var(--kiddo-evergreen)/0.30)] px-5 py-3 flex items-center gap-3">
                  <Check size={16} className="shrink-0 text-[hsl(var(--kiddo-evergreen))]" />
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-foreground">Successor custodian saved.</p>
                    <p className="text-xs text-muted-foreground">{successor.name} will step in if anything happens to you.</p>
                  </div>
                </div>
              )}

              <label className="flex items-start gap-3 cursor-pointer" data-testid="checkbox-terms-label">
                <input
                  type="checkbox"
                  checked={termsAccepted}
                  onChange={(e) => setTermsAccepted(e.target.checked)}
                  data-testid="checkbox-terms"
                  className="mt-1 w-5 h-5 rounded border-border text-primary focus:ring-primary/20"
                />
                <span className="text-sm text-muted-foreground leading-snug">
                  I agree to the {" "}<a href="/legal" target="_blank" rel="noopener noreferrer" className="text-foreground underline underline-offset-2 hover:text-primary" data-testid="link-account-agreement" onClick={(e) => e.stopPropagation()}>Account Agreement</a>{" "}and authorize Kiddo and its clearing partners to open an investment account.
                </span>
              </label>
              <p className="text-[11px] text-muted-foreground -mt-2">
                Investment accounts are SIPC protected up to $500,000 at the brokerage custodian. This does not protect against market losses.
              </p>

              <Button
                onClick={handleSubmit}
                disabled={!termsAccepted}
                data-testid="button-activate-investing"
                className={PRIMARY_CTA}
              >
                Activate Investing
                <Check size={18} className="ml-2" />
              </Button>

              <div className="flex items-center gap-2 text-xs text-muted-foreground justify-center">
                <Lock size={12} />
                <span>Your information is encrypted and secure</span>
              </div>

              <TrustMicroStrip />
            </motion.div>
          )}

          {step === "processing" && (
            <motion.div
              key="processing"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.3 }}
              className="py-16"
            >
              <ProcessingState
                message="Verifying your identity..."
                submessage="This will only take a moment"
              />
            </motion.div>
          )}

          {step === "success" && (
            <motion.div
              key="success"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.3 }}
              className="py-16 space-y-6"
            >
              <SuccessState
                message="You're all set!"
                submessage="Your gifts will now be automatically invested."
              />
              <div className="max-w-xs mx-auto">
                <Button
                  onClick={() => {
                    queryClient.invalidateQueries({ queryKey: ["/api/auth/user"] });
                    setLocation("/dashboard");
                  }}
                  data-testid="button-go-to-dashboard"
                  className={PRIMARY_CTA}
                >
                  Go to Dashboard
                  <ArrowRight size={18} className="ml-2" />
                </Button>
              </div>
            </motion.div>
          )}

          {step === "already_verified" && (
            <motion.div
              key="already_verified"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.3 }}
              className="py-16 space-y-6"
            >
              <SuccessState
                message="You're already verified"
                submessage="Your identity was confirmed when you set up your first fund. Any new funds have been activated automatically."
              />
              <div className="max-w-xs mx-auto">
                <Button
                  onClick={() => {
                    queryClient.invalidateQueries({ queryKey: ["/api/funds"] });
                    setLocation("/dashboard");
                  }}
                  data-testid="button-go-to-dashboard-verified"
                  className={PRIMARY_CTA}
                >
                  Go to Dashboard
                  <ArrowRight size={18} className="ml-2" />
                </Button>
              </div>
            </motion.div>
          )}

          {step === "pending" && (
            <motion.div
              key="pending"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.3 }}
              className="py-16 space-y-6"
            >
              <SuccessState
                message="Your identity check is in review"
                submessage="Gifts can still arrive in cash while we finish the manual review. We will email you as soon as investing is ready."
              />
              <div className="max-w-xs mx-auto">
                <Button
                  onClick={() => {
                    queryClient.invalidateQueries({ queryKey: ["/api/auth/user"] });
                    setLocation("/dashboard");
                  }}
                  className={PRIMARY_CTA}
                >
                  Go to Dashboard
                  <ArrowRight size={18} className="ml-2" />
                </Button>
              </div>
            </motion.div>
          )}

          {step === "needs_attention" && (
            <motion.div
              key="needs_attention"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.3 }}
              className="py-8 space-y-6"
            >
              <div className="rounded-3xl border border-amber-300 bg-amber-50 p-6 text-center">
                <h2 className="font-heading text-2xl font-semibold text-foreground">Your identity details need one more pass</h2>
                <p className="mt-3 text-sm text-muted-foreground">
                  We could not approve this submission yet. The most common issues are date of birth, address formatting, or a missing SSN digit.
                </p>
              </div>
              <div className="grid gap-3">
                <Button onClick={() => setStep("personal")} className={PRIMARY_CTA}>
                  Review my details
                </Button>
                <Button variant="outline" onClick={() => setLocation("/contact")}>
                  Get help
                </Button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </main>
    </div>
  );
}
