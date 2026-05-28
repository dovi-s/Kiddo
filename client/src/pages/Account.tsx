import { useEffect, useRef, useState } from "react";
import { useLocation, Link } from "wouter";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { useAuth } from "@/hooks/use-auth";
import { useSubscription } from "@/hooks/use-subscription";
import { haptic } from "@/lib/haptics";
import { toast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { FounderBadge } from "@/components/ui/founder-badge";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Check, ChevronRight, LogOut, Shield, Camera, Eye, EyeOff, UserPlus, Loader2, Star } from "lucide-react";
import { TrustMicroStrip } from "@/components/ui/ux-foundations";
import { AppHeader } from "@/components/layout/AppHeader";
import { DeleteAccountModal } from "@/components/DeleteAccountModal";
import { PasskeyManager } from "@/components/PasskeyManager";
import { PlanBenefitsCard } from "@/components/PlanBenefitsCard";
import {
  KIDDO_LEGACY_YEARLY,
  KORA_FAMILY_MONTHLY,
  KORA_FAMILY_YEARLY,
  KORA_STARTER_MONTHLY,
  KORA_STARTER_YEARLY,
} from "@shared/monetization";

const PROFILE_IMAGE_MAX_BYTES = 5 * 1024 * 1024;

type AccountTab = "personal" | "plan" | "security";

function SectionCard({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={`kiddo-card ${className}`}>
      {children}
    </div>
  );
}

// Email row with inline change-email form. Triggers POST to
// /api/me/change-email which sends a confirmation pair (confirm
// link to NEW address; cancel link to OLD address). Closes Tier 0
// #3 of the email-strategy review: 'Email-change confirmation
// sent to old address.' Without this UI, the backend endpoint
// shipped on 2026-05-15 was theoretical.
function EmailRow({ currentEmail }: { currentEmail: string | null }) {
  const [editing, setEditing] = useState(false);
  const [newEmail, setNewEmail] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async () => {
    setError(null);
    const trimmed = newEmail.trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) {
      setError("Enter a valid email address.");
      return;
    }
    if (trimmed === (currentEmail || "").toLowerCase()) {
      setError("That's already your email.");
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch("/api/me/change-email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ newEmail: trimmed }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        setError(body?.error || "Could not request the change. Try again.");
        return;
      }
      setSubmitted(true);
      haptic("success");
    } catch (err: any) {
      setError(err?.message || "Could not request the change. Try again.");
    } finally {
      setSubmitting(false);
    }
  };

  if (submitted) {
    return (
      <div className="rounded-2xl border border-[hsl(var(--kiddo-evergreen)/0.18)] bg-[hsl(var(--kiddo-evergreen)/0.06)] p-4">
        <p className="text-sm font-semibold text-foreground">Check both inboxes.</p>
        <p className="mt-1.5 text-xs leading-relaxed text-muted-foreground">
          We sent a confirmation link to {newEmail.trim().toLowerCase()} and a cancel link to {currentEmail}. The change happens once the new address confirms. Either inbox can cancel for the next 24 hours.
        </p>
      </div>
    );
  }

  if (!editing) {
    return (
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs text-muted-foreground mb-1">Email</p>
          <p className="text-sm font-semibold text-foreground truncate" data-testid="text-profile-email">{currentEmail || "Not set"}</p>
        </div>
        {currentEmail && (
          <Button
            variant="ghost"
            size="sm"
            className="shrink-0 text-[hsl(var(--kiddo-evergreen))] hover:text-[hsl(var(--kiddo-evergreen))]"
            onClick={() => { setEditing(true); haptic("light"); }}
            data-testid="button-change-email"
          >
            Change
          </Button>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-2.5">
      <label htmlFor="input-new-email" className="text-xs text-muted-foreground block">New email</label>
      <input
        id="input-new-email"
        type="email"
        autoComplete="email"
        value={newEmail}
        onChange={(e) => setNewEmail(e.target.value)}
        placeholder="you@example.com"
        className="h-10 w-full rounded-xl border border-border bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
        data-testid="input-new-email"
      />
      <p className="text-[11px] leading-snug text-muted-foreground">
        We send a confirmation link to the new address and a heads-up to {currentEmail}. The change only happens once the new address confirms.
      </p>
      {error && <p className="text-xs text-red-700" data-testid="text-change-email-error">{error}</p>}
      <div className="flex gap-2">
        <Button
          size="sm"
          className="rounded-xl"
          disabled={submitting || !newEmail.trim()}
          onClick={handleSubmit}
          data-testid="button-submit-change-email"
        >
          {submitting ? "Sending…" : "Send confirmation"}
        </Button>
        <Button
          variant="ghost"
          size="sm"
          className="rounded-xl"
          onClick={() => { setEditing(false); setNewEmail(""); setError(null); }}
          data-testid="button-cancel-change-email"
        >
          Cancel
        </Button>
      </div>
    </div>
  );
}

// Email verification status row. Reads users.emailVerifiedAt via
// /api/auth/user (already loaded in Account context). For
// unverified accounts, surfaces a 'Resend verification' button
// that POSTs to /api/auth/resend-verification. Grandfathered
// accounts (signed up before 2026-05-15) have emailVerifiedAt
// NULL but aren't surfaced here because the createdAt check
// applied server-side at issue time means they never get
// nagged. Display gate is a heuristic: if the user is missing
// emailVerifiedAt AND was created after the cutoff, show the
// row.
function EmailVerificationStatusRow() {
  const { user } = useAuth();
  const [resending, setResending] = useState(false);
  const [resent, setResent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const verifiedAt = (user as any)?.emailVerifiedAt;
  const createdAt = (user as any)?.createdAt;
  // Grandfathering: accounts created before 2026-05-15 are
  // treated as verified for display purposes. Newer accounts that
  // haven't verified see the row.
  const CUTOFF = new Date("2026-05-15T00:00:00Z").getTime();
  const isPostCutoff = createdAt ? new Date(createdAt).getTime() > CUTOFF : false;
  // Demo accounts have no real inbox and can't action a verification
  // email, so the "Email not verified / Resend" nag is a dead end that
  // breaks the polished-demo illusion. Treat demo users as verified for
  // display. Same demo-awareness the Dashboard setup nudge already has.
  const isDemoUser = Boolean((user as any)?.isDemoAccount);
  const isUnverified = !verifiedAt && isPostCutoff && !isDemoUser;
  if (!isUnverified) return null;

  const handleResend = async () => {
    setError(null);
    setResending(true);
    try {
      const res = await fetch("/api/auth/resend-verification", {
        method: "POST",
        credentials: "include",
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        setError(body?.error || "Could not send.");
        return;
      }
      setResent(true);
      haptic("success");
    } catch (err: any) {
      setError(err?.message || "Could not send.");
    } finally {
      setResending(false);
    }
  };

  return (
    <div className="rounded-2xl border border-amber-200 bg-amber-50 p-3.5">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm font-semibold text-amber-900">Email not verified</p>
          <p className="mt-0.5 text-xs leading-relaxed text-amber-800">
            {resent
              ? "Verification email sent. Check your inbox."
              : "Open the verification email we sent at signup, or send a fresh one."}
          </p>
          {error && <p className="mt-1 text-xs text-red-700">{error}</p>}
        </div>
        {!resent && (
          <Button
            variant="ghost"
            size="sm"
            className="shrink-0 text-amber-900 hover:text-amber-900"
            disabled={resending}
            onClick={handleResend}
            data-testid="button-resend-verification"
          >
            {resending ? "Sending…" : "Resend"}
          </Button>
        )}
      </div>
    </div>
  );
}

export default function Account() {
  const [, navigate] = useLocation();
  const { user, logout } = useAuth();
  const { data: subscription, isLoading: subLoading } = useSubscription();
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [accountTab, setAccountTab] = useState<AccountTab>("personal");

  // Name editing
  const [editingName, setEditingName] = useState(false);
  const [nameValue, setNameValue] = useState("");

  // Preferred name
  const [preferredName, setPreferredName] = useState<string>(() => (user as any)?.preferredName || "");
  const [savingPreferredName, setSavingPreferredName] = useState(false);

  // Photo upload
  const [uploadingPhoto, setUploadingPhoto] = useState(false);

  // Password change
  const [changingPassword, setChangingPassword] = useState(false);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showCurrentPw, setShowCurrentPw] = useState(false);
  const [showNewPw, setShowNewPw] = useState(false);
  const [savingPassword, setSavingPassword] = useState(false);

  // Trusted contact (FINRA Rule 4512). Lives on the security tab
  // because semantically it IS a security/safety net for the account,
  // not a money-management surface. Locally tracked so the parent can
  // edit without an "edit mode" toggle round-trip; we save via PATCH
  // /api/user/profile when they hit Save. Empty strings clear fields.
  const trustedContactSaved = {
    name: ((user as any)?.trustedContactName as string) || "",
    email: ((user as any)?.trustedContactEmail as string) || "",
    phone: ((user as any)?.trustedContactPhone as string) || "",
    relation: ((user as any)?.trustedContactRelation as string) || "",
  };
  const [trustedContactName, setTrustedContactName] = useState(trustedContactSaved.name);
  const [trustedContactEmail, setTrustedContactEmail] = useState(trustedContactSaved.email);
  const [trustedContactPhone, setTrustedContactPhone] = useState(trustedContactSaved.phone);
  const [trustedContactRelation, setTrustedContactRelation] = useState(trustedContactSaved.relation);
  const [savingTrustedContact, setSavingTrustedContact] = useState(false);
  const trustedContactDirty =
    trustedContactName.trim() !== trustedContactSaved.name.trim() ||
    trustedContactEmail.trim() !== trustedContactSaved.email.trim() ||
    trustedContactPhone.trim() !== trustedContactSaved.phone.trim() ||
    trustedContactRelation.trim() !== trustedContactSaved.relation.trim();
  const trustedContactHasAny = Boolean(
    trustedContactSaved.name ||
    trustedContactSaved.email ||
    trustedContactSaved.phone ||
    trustedContactSaved.relation,
  );

  const userPlan = subLoading ? null : (subscription?.effectivePlan ?? "free");
  const planLabel =
    userPlan === "legacy"
      ? "Kiddo Legacy"
      : userPlan === "family"
        ? "Kiddo Family"
        : userPlan === "starter"
          ? "Kiddo+"
          : userPlan === "free"
            ? "Free"
            : "-";

  const displayName = `${user?.firstName || ""} ${user?.lastName || ""}`.trim() || "";
  const initial = (user?.firstName || user?.email || "U").slice(0, 1).toUpperCase();
  // Account-deletion modal state. Modal handles the multi-step flow
  // (review → confirm → submit → done) + the blocked-for-balance state.
  const [deleteAccountModalOpen, setDeleteAccountModalOpen] = useState(false);
  const profileNeedsName = !displayName;
  const profileNeedsPhoto = !user?.profileImageUrl;
  const profileNeedsCompletion = profileNeedsName || profileNeedsPhoto;

  // Stripe billing portal — inline action on the plan card so paid users
  // can manage their billing without bouncing to Settings. Per the
  // 2026-05-14 WHO/HOW IA principle (Account = user-as-identity, primary
  // home for plan + billing); the cancellation modal and multi-tier
  // upgrade ladder still live on the Settings membership tab because
  // they are complex multi-step surfaces, and Cancel from Account
  // routes there with ?action=cancel which auto-opens the cancel flow.
  const [openingPortal, setOpeningPortal] = useState(false);
  const handleOpenBillingPortal = async () => {
    setOpeningPortal(true);
    haptic("medium");
    try {
      const res = await fetch("/api/subscription/portal", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      const data = await res.json();
      if (data.url) {
        window.location.href = data.url;
      } else {
        toast({ title: "Could not open billing portal", description: data.error || "Please try again", variant: "destructive" });
      }
    } catch {
      toast({ title: "Could not open billing portal", description: "Please try again", variant: "destructive" });
    } finally {
      setOpeningPortal(false);
    }
  };

  // Cancel-plan flow inline on Account. Per the 2026-05-14 WHO/HOW IA
  // principle Phase 1b: Account is the primary home of plan management,
  // and the most common destructive action (cancel) should fire from
  // here without bouncing to Settings. This is a leaner cancel
  // experience than Settings — reassurance + two-step warn/confirm,
  // but no impact-preview itemization (parents who want the richer
  // preview can still get it on the Settings membership tab via the
  // ?action=cancel deep-link). The simpler shape is honest: 95% of
  // cancellations on this surface are intentional, the parent already
  // knows what pauses, and a calmer flow respects that. Settings
  // retains the rich preview for the edge cases where the parent is
  // wavering and would benefit from seeing what they're walking away
  // from before they commit.
  const [showCancelConfirm, setShowCancelConfirm] = useState(false);
  const [cancelStep, setCancelStep] = useState<"warn" | "confirm">("warn");
  const [canceling, setCanceling] = useState(false);
  // Reactivate flow — for users whose subscription is canceled but
  // still in the active-until-period-end window. The amber "your fund
  // stays safe" card surfaces this state with a one-tap reactivate
  // button. Mirrors the Settings membership-tab pattern.
  const [reactivating, setReactivating] = useState(false);
  const handleCancelSubscription = async () => {
    setCanceling(true);
    haptic("medium");
    try {
      const res = await fetch("/api/subscription/cancel", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      const data = await res.json();
      if (res.ok) {
        haptic("success");
        const until = data?.activeUntil ? new Date(data.activeUntil).toLocaleDateString() : null;
        const cancelPlanLabel = data?.plan === "starter" ? "Kiddo+" : data?.plan === "family" ? "Kiddo Family" : "Your plan";
        toast({
          title: data?.alreadyCanceled ? `${cancelPlanLabel} already canceling` : `${cancelPlanLabel} canceled`,
          description: until ? `${cancelPlanLabel} remains active until ${until}` : "Your cancellation has been scheduled.",
        });
        queryClient.invalidateQueries({ queryKey: ["/api/subscription"] });
        queryClient.invalidateQueries({ queryKey: ["/api/funds"] });
        setShowCancelConfirm(false);
        setCancelStep("warn");
      } else {
        toast({ title: "Could not cancel", description: data.error || "Please try again", variant: "destructive" });
      }
    } catch {
      toast({ title: "Could not cancel", description: "Please try again", variant: "destructive" });
    } finally {
      setCanceling(false);
    }
  };

  const handleReactivateSubscription = async (opts?: { plan?: "starter" | "family"; fundId?: string }) => {
    setReactivating(true);
    haptic("medium");
    try {
      const res = await fetch("/api/subscription/reactivate", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(opts || {}),
      });
      const data = await res.json();
      if (res.ok) {
        haptic("success");
        toast({ title: "Subscription reactivated", description: "Your plan is active again" });
        queryClient.invalidateQueries({ queryKey: ["/api/subscription"] });
      } else if (res.status === 410 && data.expired) {
        // Sub fully expired — start a new checkout instead. Mirrors
        // the Settings reactivate flow.
        toast({ title: "Subscription expired", description: "Starting a new checkout for you..." });
        if (opts?.plan === "starter" && opts?.fundId) {
          await handleUpgradeStarter(opts.fundId);
        } else {
          await handleUpgradeFamily();
        }
      } else {
        toast({ title: "Could not reactivate", description: data.error || "Please try again", variant: "destructive" });
      }
    } catch {
      toast({ title: "Could not reactivate", description: "Please try again", variant: "destructive" });
    } finally {
      setReactivating(false);
    }
  };

  // Upgrade-ladder state + handlers. Per the 2026-05-14 WHO/HOW IA
  // principle Phase 1b: Account is the primary surface for plan
  // management, including upgrade exploration. Each upgrade handler
  // POSTs to its Stripe checkout endpoint and redirects to the
  // returned URL. The Plus handler requires a fundId (Plus is single-
  // fund) and defaults to the user's first fund. The Family and Legacy
  // handlers are user-level and need no fund context. These are
  // duplicates of the Settings membership-tab handlers; Phase 1c will
  // extract to a shared component when the upgrade ladder is removed
  // from Settings entirely.
  const [upgrading, setUpgrading] = useState(false);
  const [selectedStarterFundId, setSelectedStarterFundId] = useState<string>("");

  // Lightweight funds query used only to default the Plus upgrade
  // selector to the user's first fund. Same data shape as elsewhere;
  // we only need .id from each row.
  const { data: funds = [] } = useQuery<Array<{ id: string; name?: string; recipientFirstName?: string | null }>>({
    queryKey: ["/api/funds"],
    enabled: !!user,
    staleTime: 60_000,
  });

  useEffect(() => {
    if (!selectedStarterFundId && funds.length > 0) {
      setSelectedStarterFundId(String(funds[0].id));
    }
  }, [funds, selectedStarterFundId]);

  const handleUpgradeStarter = async (fundId?: string) => {
    const targetFundId = String(fundId || selectedStarterFundId || "");
    if (!targetFundId) {
      toast({ title: "Choose a fund first", description: "Kiddo+ applies to one specific fund.", variant: "destructive" });
      return;
    }
    setUpgrading(true);
    haptic("medium");
    try {
      const res = await fetch("/api/stripe/checkout/starter-plan", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fundId: targetFundId }),
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
      } else {
        toast({ title: "Something went wrong", description: data.error || "Could not start checkout", variant: "destructive" });
      }
    } catch (error) {
      toast({
        title: "Something went wrong",
        description: error instanceof Error ? error.message : "Please try again",
        variant: "destructive",
      });
    } finally {
      setUpgrading(false);
    }
  };

  const handleUpgradeFamily = async () => {
    setUpgrading(true);
    haptic("medium");
    try {
      const res = await fetch("/api/stripe/checkout/family-plan", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
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
      } else {
        toast({ title: "Something went wrong", description: data.error || "Could not start checkout", variant: "destructive" });
      }
    } catch (error) {
      toast({
        title: "Something went wrong",
        description: error instanceof Error ? error.message : "Please try again",
        variant: "destructive",
      });
    } finally {
      setUpgrading(false);
    }
  };

  // Deep-link tab handler. URLs like /account?tab=plan should land
  // on the plan tab, not the default personal tab. Fires once on
  // mount and any time the URL changes. Validates the value against
  // the known AccountTab union before applying so a stray param
  // doesn't put the page into an undefined state.
  const VALID_TABS: readonly AccountTab[] = ["personal", "plan", "security"];
  useEffect(() => {
    const tab = new URLSearchParams(window.location.search || "").get("tab");
    if (tab && (VALID_TABS as readonly string[]).includes(tab)) {
      setAccountTab(tab as AccountTab);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Stripe-return handler. Fires when this page is reached with
  // ?success=starter / ?success=family / ?success=legacy / ?canceled=
  // (or the legacy ?success=true / ?canceled=true shapes). Surfaces
  // an activation toast and refreshes the subscription + funds queries
  // so the UI reflects the new plan state. Added 2026-05-14 per the
  // WHO/HOW IA Phase 1c-B: Stripe success URLs server-side now route
  // to /account?tab=plan, and Account needs its own handler for those
  // params so the toast fires here. The legacy Settings handler also
  // still works for any in-flight Stripe sessions that pre-date the
  // server-side URL update.
  const hasStripeReturnFired = useRef(false);
  useEffect(() => {
    if (hasStripeReturnFired.current) return;
    const params = new URLSearchParams(window.location.search || "");
    const success = params.get("success");
    const canceled = params.get("canceled");
    const fundIdFromSuccess = params.get("fundId");
    if (!success && !canceled) return;
    hasStripeReturnFired.current = true;

    const run = async () => {
      try {
        if (success === "starter" || success === "family" || success === "legacy") {
          try {
            await fetch("/api/subscription/sync-stripe", {
              method: "POST",
              credentials: "include",
            });
          } catch {
            // Best-effort sync; the invalidations below still fire and
            // the next page load will pick up the latest state.
          }
        }

        if (success === "starter") {
          const fundName = funds.find((f) => String(f.id) === String(fundIdFromSuccess))?.name;
          toast({
            title: "Kiddo+ activated",
            description: fundName ? `Kiddo+ is now active for ${fundName}.` : "Kiddo+ is now active for your selected fund.",
          });
        } else if (success === "family") {
          toast({ title: "Kiddo Family activated", description: "Your account is now on Kiddo Family." });
        } else if (success === "legacy") {
          toast({ title: "Kiddo Legacy activated", description: "Your account is now on Kiddo Legacy." });
        } else if (canceled === "true") {
          toast({ title: "Checkout canceled", description: "No changes were made to your plan." });
        }
      } finally {
        void queryClient.invalidateQueries({ queryKey: ["/api/subscription"] });
        void queryClient.invalidateQueries({ queryKey: ["/api/funds"] });
        void queryClient.invalidateQueries({ queryKey: ["/api/auth/user"] });

        params.delete("success");
        params.delete("canceled");
        params.delete("fundId");
        const nextQuery = params.toString();
        window.history.replaceState({}, "", `${window.location.pathname}${nextQuery ? `?${nextQuery}` : ""}`);
      }
    };
    void run();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [funds]);

  // Auto-trigger Stripe checkout when this page is reached with
  // ?upgrade=family or ?upgrade=starter&fundId=... (and the `plus`
  // alias). Mirrors the Settings deep-link handler so in-app upgrade
  // CTAs that route to Account also fire checkout correctly. Settings
  // retains its own handler for backward compatibility with deep-links
  // that still point at /settings?tab=membership.
  const hasAutoUpgradeTriggered = useRef(false);
  useEffect(() => {
    if (hasAutoUpgradeTriggered.current) return;
    if (!user) return;
    const params = new URLSearchParams(window.location.search || "");
    const upgrade = params.get("upgrade");
    if (!upgrade) return;
    hasAutoUpgradeTriggered.current = true;
    const fundIdParam = params.get("fundId") || "";
    params.delete("upgrade");
    params.delete("fundId");
    const nextQuery = params.toString();
    window.history.replaceState({}, "", `${window.location.pathname}${nextQuery ? `?${nextQuery}` : ""}`);
    setAccountTab("plan");
    if (upgrade === "family") {
      void handleUpgradeFamily();
    } else if ((upgrade === "starter" || upgrade === "plus") && fundIdParam) {
      void handleUpgradeStarter(fundIdParam);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  const selectTab = (tab: AccountTab) => {
    setAccountTab(tab);
    haptic("selection");
  };

  const handleLogout = () => {
    haptic("medium");
    logout();
  };

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      toast({ title: "Invalid file type", description: "Please choose an image file.", variant: "destructive" });
      return;
    }
    if (file.size > PROFILE_IMAGE_MAX_BYTES) {
      toast({ title: "Photo too large", description: "Please choose an image under 5MB.", variant: "destructive" });
      return;
    }
    setUploadingPhoto(true);
    try {
      const reader = new FileReader();
      reader.onload = async () => {
        const dataUrl = reader.result as string;
        const res = await fetch("/api/user/profile", {
          method: "PATCH",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ profileImageUrl: dataUrl }),
        });
        const payload = await res.json().catch(() => ({}));
        if (res.ok) {
          queryClient.setQueryData(["/api/auth/user"], payload);
          haptic("success");
          toast({ title: "Photo updated" });
        } else {
          toast({ title: "Could not update photo", description: payload?.error || "Please try a smaller image.", variant: "destructive" });
        }
        setUploadingPhoto(false);
      };
      reader.readAsDataURL(file);
    } catch {
      toast({ title: "Could not update photo", variant: "destructive" });
      setUploadingPhoto(false);
    }
  };

  const handleSaveName = async () => {
    const parts = nameValue.trim().split(/\s+/);
    const firstName = parts[0] || "";
    const lastName = parts.slice(1).join(" ") || "";
    try {
      const res = await fetch("/api/user/profile", {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ firstName, lastName }),
      });
      if (res.ok) {
        const updated = await res.json();
        queryClient.setQueryData(["/api/auth/user"], updated);
        haptic("success");
        toast({ title: "Name updated" });
      } else {
        toast({ title: "Could not update name", variant: "destructive" });
      }
    } catch {
      toast({ title: "Could not update name", variant: "destructive" });
    }
    setEditingName(false);
  };

  const handleSavePreferredName = async () => {
    setSavingPreferredName(true);
    haptic("medium");
    try {
      const res = await fetch("/api/user/profile", {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ preferredName: preferredName.trim() }),
      });
      if (res.ok) {
        const updated = await res.json();
        queryClient.setQueryData(["/api/auth/user"], updated);
        haptic("success");
        toast({ title: "Saved" });
      } else {
        let msg = `Status ${res.status}`;
        try { const d = await res.json(); msg = d.error || d.message || msg; } catch {}
        toast({ title: "Could not save", description: msg, variant: "destructive" });
      }
    } catch (err: any) {
      toast({ title: "Could not save", description: err?.message || "Network error", variant: "destructive" });
    }
    setSavingPreferredName(false);
  };

  const handleSaveTrustedContact = async () => {
    setSavingTrustedContact(true);
    haptic("medium");
    try {
      const res = await fetch("/api/user/profile", {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          trustedContactName: trustedContactName.trim(),
          trustedContactEmail: trustedContactEmail.trim(),
          trustedContactPhone: trustedContactPhone.trim(),
          trustedContactRelation: trustedContactRelation.trim(),
        }),
      });
      if (res.ok) {
        const updated = await res.json();
        queryClient.setQueryData(["/api/auth/user"], updated);
        haptic("success");
        toast({ title: "Trusted contact saved" });
      } else {
        let msg = `Status ${res.status}`;
        try { const d = await res.json(); msg = d.error || d.message || msg; } catch {}
        toast({ title: "Could not save", description: msg, variant: "destructive" });
      }
    } catch (err: any) {
      toast({ title: "Could not save", description: err?.message || "Network error", variant: "destructive" });
    }
    setSavingTrustedContact(false);
  };

  const handleClearTrustedContact = async () => {
    setSavingTrustedContact(true);
    haptic("medium");
    try {
      const res = await fetch("/api/user/profile", {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          trustedContactName: "",
          trustedContactEmail: "",
          trustedContactPhone: "",
          trustedContactRelation: "",
        }),
      });
      if (res.ok) {
        const updated = await res.json();
        queryClient.setQueryData(["/api/auth/user"], updated);
        setTrustedContactName("");
        setTrustedContactEmail("");
        setTrustedContactPhone("");
        setTrustedContactRelation("");
        haptic("success");
        toast({ title: "Trusted contact removed" });
      } else {
        toast({ title: "Could not remove", variant: "destructive" });
      }
    } catch (err: any) {
      toast({ title: "Could not remove", description: err?.message || "Network error", variant: "destructive" });
    }
    setSavingTrustedContact(false);
  };

  const handleChangePassword = async () => {
    if (newPassword !== confirmPassword) {
      toast({ title: "Passwords don't match", variant: "destructive" });
      return;
    }
    if (newPassword.length < 8) {
      toast({ title: "New password must be at least 8 characters", variant: "destructive" });
      return;
    }
    setSavingPassword(true);
    try {
      const res = await fetch("/api/user/change-password", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ currentPassword, newPassword }),
      });
      const payload = await res.json().catch(() => ({}));
      if (res.ok) {
        haptic("success");
        toast({ title: "Password updated" });
        setChangingPassword(false);
        setCurrentPassword("");
        setNewPassword("");
        setConfirmPassword("");
      } else {
        toast({ title: "Could not update password", description: payload?.error || "Please try again.", variant: "destructive" });
      }
    } catch {
      toast({ title: "Could not update password", variant: "destructive" });
    }
    setSavingPassword(false);
  };

  return (
    <div className="kiddo-app-page md:ml-[264px] pb-24 md:pb-8" data-testid="page-account">
      <AppHeader />

      <main className="kiddo-canvas px-4 py-6 space-y-6">
        {/* Account hero strip — added 2026-05-25 per
            project_secondary_page_polish_pattern.md. Account is the
            ACCOUNT-GLOBAL surface (vs Settings which is fund-scoped),
            so the inverse link points at /settings, and the headline
            uses the user's name (or email fallback) rather than a
            fund recipient. Same restrained register as Settings:
            quiet eyebrow + h1 + 1-line context, 400ms/6px/out-expo
            entrance, no count-ups, no gradient, no photo. */}
        <motion.div
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
          className="px-1"
          data-testid="account-hero"
        >
          <p className="text-[10.5px] font-bold uppercase tracking-[0.14em] text-muted-foreground/70">
            Account
          </p>
          <h1 className="mt-1 font-heading text-2xl md:text-3xl font-semibold text-foreground leading-tight">
            {((user as any)?.preferredName?.trim() || (user as any)?.firstName?.trim()) || "Your account"}
          </h1>
          {/* Cross-link to per-fund settings. From the Account
              context the user expects a fund picker, not a jump
              into whichever fund happens to be the active one
              (that drops them into a random child's settings page
              without picking — flagged in audit 2026-05-26).
              Single-fund parents skip the picker since there's
              only one destination; multi-fund parents land on
              /funds where they pick which child's settings to
              edit. Zero-funds parents shouldn't see this link at
              all (they have no per-fund settings yet). */}
          <p className="mt-1.5 text-xs text-muted-foreground leading-relaxed">
            Settings that apply to you across every fund.{funds.length > 0 && (
              <>
                {" "}
                <Link
                  href={funds.length === 1 ? "/settings" : "/funds?then=settings"}
                  className="underline underline-offset-2 hover:text-foreground"
                  data-testid="link-per-fund-settings"
                >
                  {funds.length === 1 ? "Per-fund settings →" : "Choose a fund to edit →"}
                </Link>
              </>
            )}
          </p>
        </motion.div>

        <div className="kiddo-tab-row max-w-full overflow-x-auto" data-testid="account-tabs" role="tablist" aria-label="Account sections">
          {[
            { id: "personal", label: "Personal info" },
            { id: "plan", label: "Plan & billing" },
            { id: "security", label: "Security" },
          ].map((tab) => (
            <button
              key={tab.id}
              type="button"
              role="tab"
              aria-selected={accountTab === tab.id}
              className="kiddo-tab-item whitespace-nowrap"
              data-active={accountTab === tab.id ? "true" : "false"}
              onClick={() => selectTab(tab.id as AccountTab)}
              data-testid={`account-tab-${tab.id}`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* ── Personal Info ── */}
        {/* Tab fade-ins added 2026-05-25 per the secondary-page polish
            pattern. 280ms/6px/out-expo per tab branch with unique key
            so React remounts on tab switch and the entrance animation
            fires. No exit animation — only one tab can be active. */}
        {accountTab === "personal" && (
          <motion.div
            key="account-tab-personal"
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.28, ease: [0.16, 1, 0.3, 1] }}
            className="space-y-4"
          >
            {profileNeedsCompletion && (
              <SectionCard className="border-primary/20 bg-primary/5">
                <div className="p-4">
                  <p className="text-sm font-semibold text-foreground">Complete your profile</p>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Add your {profileNeedsName && profileNeedsPhoto ? "name and photo" : profileNeedsName ? "name" : "photo"} so it appears in your child's Memory Book.
                  </p>
                </div>
              </SectionCard>
            )}

            {/* Avatar + name + email */}
            <SectionCard>
              <div className="p-5 space-y-5">
                {/* Avatar */}
                <div className="flex items-center gap-4">
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={uploadingPhoto}
                    className="relative h-16 w-16 shrink-0 rounded-full overflow-hidden border border-[hsl(var(--kiddo-border))] bg-[hsl(var(--kiddo-cream-dark))] group"
                    data-testid="button-change-profile-photo"
                  >
                    {user?.profileImageUrl ? (
                      <img src={user.profileImageUrl} alt="" className="h-full w-full object-cover" />
                    ) : (
                      <span className="flex h-full w-full items-center justify-center text-xl font-bold text-foreground">{initial}</span>
                    )}
                    <div className="absolute inset-0 flex items-center justify-center bg-black/40 opacity-0 transition-opacity group-hover:opacity-100">
                      {uploadingPhoto
                        ? <div className="h-4 w-4 animate-spin rounded-full border-2 border-white/60 border-t-white" />
                        : <Camera size={18} className="text-white" />}
                    </div>
                  </button>
                  <input
                    ref={fileInputRef}
                    id="account-profile-photo"
                    name="profilePhoto"
                    type="file"
                    accept="image/*"
                    onChange={handlePhotoUpload}
                    aria-label="Upload profile photo"
                    className="hidden"
                  />
                  <p className="text-xs text-muted-foreground">
                    {profileNeedsPhoto ? "Add a photo so your child's Memory Book has a real face behind it." : "Tap to change photo."}
                  </p>
                </div>

                {/* Name row */}
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    {/* `<p>` → `<label>` so the form-field gets a real
                        association. htmlFor matches the input's id
                        below — fixes Lighthouse "No label associated
                        with form field". */}
                    <label htmlFor="account-profile-name" className="block text-xs text-muted-foreground mb-1">Name</label>
                    {editingName ? (
                      <div className="flex items-center gap-2">
                        <input
                          id="account-profile-name"
                          name="firstName"
                          type="text"
                          autoComplete="given-name"
                          value={nameValue}
                          onChange={e => setNameValue(e.target.value)}
                          onKeyDown={e => { if (e.key === "Enter") handleSaveName(); if (e.key === "Escape") setEditingName(false); }}
                          className="h-9 flex-1 rounded-lg border border-border bg-background px-3 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20"
                          autoFocus
                          data-testid="input-profile-name"
                        />
                        <Button size="sm" onClick={handleSaveName} data-testid="button-save-profile-name">Save</Button>
                        <Button size="sm" variant="ghost" onClick={() => setEditingName(false)}>Cancel</Button>
                      </div>
                    ) : (
                      <>
                        <p className="text-sm font-semibold text-foreground" data-testid="text-profile-name">
                          {displayName || <span className="italic text-muted-foreground">Not set</span>}
                        </p>
                        {(user as any)?.founderTier && (
                          <FounderBadge label="Founding Member" className="mt-1.5" />
                        )}
                      </>
                    )}
                  </div>
                  {!editingName && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="shrink-0 text-[hsl(var(--kiddo-evergreen))] hover:text-[hsl(var(--kiddo-evergreen))]"
                      onClick={() => { setNameValue(displayName); setEditingName(true); haptic("light"); }}
                      data-testid="button-edit-profile-name"
                    >
                      Edit
                    </Button>
                  )}
                </div>

                {/* Email row. Read-only display + 'Change email'
                    trigger. The change flow goes through the
                    confirmation pair (to the OLD address with a
                    cancel link; to the NEW address with a confirm
                    link), per Tier 0 #3 of the email strategy.
                    The form inline-expands so we don't lose the
                    Account context to a modal. */}
                <EmailRow currentEmail={user?.email ?? null} />

                {/* Verification status surface. If the user signed up
                    pre-2026-05-15 they're grandfathered with
                    emailVerifiedAt = NULL but treated as verified
                    (no banner, no resend). For new accounts that
                    haven't yet verified, this row carries a 'Resend
                    verification' affordance so they can re-trigger
                    the post-signup email. Locked 2026-05-18. */}
                <EmailVerificationStatusRow />


                {/* Preferred name */}
                <div>
                  <label htmlFor="account-preferred-name" className="block text-xs font-semibold text-foreground mb-1.5">
                    What do your kids call you?
                  </label>
                  <input
                    id="account-preferred-name"
                    name="preferredName"
                    type="text"
                    autoComplete="nickname"
                    value={preferredName}
                    onChange={(e) => setPreferredName(e.target.value.slice(0, 50))}
                    placeholder="Dad, Mom, Papa, Mama…"
                    className="h-10 w-full rounded-xl border border-border bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
                    data-testid="input-preferred-name"
                  />
                  <p className="mt-1.5 text-[11px] text-muted-foreground">
                    Shows up in the Memory Book and Kid's View. Optional.
                  </p>
                  <Button
                    size="sm"
                    className="mt-3 rounded-xl"
                    disabled={savingPreferredName || preferredName === ((user as any)?.preferredName || "")}
                    onClick={handleSavePreferredName}
                    data-testid="button-save-preferred-name"
                  >
                    {savingPreferredName ? "Saving…" : "Save"}
                  </Button>
                </div>
              </div>
            </SectionCard>

            {/* Plan + legal */}
            <SectionCard>
              <div className="divide-y divide-[hsl(var(--kiddo-border))]">
                <div className="flex items-center justify-between gap-4 p-4">
                  <span className="text-sm text-muted-foreground">Current plan</span>
                  <span className="text-sm font-semibold text-foreground">{planLabel}</span>
                </div>
                <a href="/legal" target="_blank" rel="noopener noreferrer" className="flex items-center justify-between gap-4 p-4 transition-colors hover:bg-muted/30">
                  <span className="text-sm text-muted-foreground">Legal disclosures</span>
                  <ChevronRight size={16} className="text-muted-foreground" />
                </a>
              </div>
            </SectionCard>

            <button
              type="button"
              onClick={handleLogout}
              className="flex w-full items-center justify-center gap-2 rounded-2xl border border-border px-4 py-3 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted/30 hover:text-foreground"
            >
              <LogOut size={15} />
              Log out
            </button>
          </motion.div>
        )}

        {/* ── Plan & Billing ── */}
        {accountTab === "plan" && (
          <motion.div
            key="account-tab-plan"
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.28, ease: [0.16, 1, 0.3, 1] }}
            className="space-y-4"
          >
            {/* Plan & billing tab — the primary home of plan management
                per the 2026-05-14 WHO/HOW IA principle. Inline actions
                (Manage billing, Cancel plan) sit directly on the active-
                plan card for paid users so the most common operations
                don't require bouncing to Settings. The Settings
                membership tab still hosts the multi-tier upgrade ladder
                and the cancellation-impact preview modal; those are
                complex multi-step surfaces and live there until the
                Phase 1b refactor moves them. Both surfaces remain in
                sync — Account is the primary, Settings is the depth.

                See feedback_ia_who_vs_how_principle.md (locked
                memory) for the principle. See IN_APP_UPGRADE_FEATURE_
                WALL_SPEC.md for the parallel contextual-upgrade work
                (different problem, different solution; not conflated). */}

            {/* Sponsored-coverage attribution (Prong B of pricing-v3
                conversion, locked 2026-05-23). When a gifter sponsored
                a year of Plus/Family for one of the parent's funds,
                this card surfaces the source ("Plus from Grandma on
                Emma's fund") above the standard plan card. Diplomatic
                framing — relationship signal, not "your paywall was
                bypassed." Per
                project_gifter_sponsors_plus_subscription.md. */}
            {(() => {
              const sponsoredByFund = (subscription as any)?.sponsoredByFund || {};
              const entries = Object.entries(sponsoredByFund)
                .filter(([_, v]) => v != null)
                .map(([fundId, v]: [string, any]) => {
                  const fund = (funds as any[]).find((f) => String(f.id) === String(fundId));
                  const childName = String(fund?.recipientFirstName || fund?.name || "the kid").trim();
                  const expiresLabel = (() => {
                    try {
                      return new Date(v.expiresAt).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });
                    } catch {
                      return "later this year";
                    }
                  })();
                  const tierLabel = v.tier === "family" ? "Family" : "Plus";
                  return { fundId, childName, sponsorName: v.sponsorName || "Someone", expiresLabel, tierLabel };
                });
              if (entries.length === 0) return null;
              return (
                <SectionCard className="border-[hsl(var(--kiddo-gold))]/30 bg-[hsl(var(--kiddo-gold))]/8">
                  <div className="p-5">
                    <div className="flex items-start gap-3">
                      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[hsl(var(--kiddo-gold))] text-white">
                        <Star size={17} />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-bold text-foreground">
                          {entries.length === 1
                            ? `${entries[0].tierLabel} from ${entries[0].sponsorName}`
                            : `${entries.length} sponsored subscriptions active`}
                        </p>
                        <ul className="mt-2 space-y-1.5">
                          {entries.map((e) => (
                            <li key={e.fundId} className="text-xs leading-relaxed text-muted-foreground">
                              <span className="text-foreground font-medium">{e.tierLabel} on {e.childName}'s fund</span> · sponsored by {e.sponsorName} through {e.expiresLabel}
                            </li>
                          ))}
                        </ul>
                        <p className="mt-3 text-[11px] leading-relaxed text-muted-foreground/85">
                          We'll send you a renewal reminder before each one expires. Your card won't be charged automatically; you choose whether to take over the bill.
                        </p>
                      </div>
                    </div>
                  </div>
                </SectionCard>
              );
            })()}
            {subLoading ? (
              <div className="kiddo-card h-24 animate-pulse" />
            ) : subscription?.status === "canceled" && userPlan !== "free" && subscription?.currentPeriodEnd && new Date(subscription.currentPeriodEnd).getTime() > Date.now() ? (
              /* CANCELING STATE — sub is canceled but still active until
                 period end. Amber reassurance card with a one-tap
                 reactivate button. Showing 'Active' here would be
                 misleading; the parent is in a queued-cancel state and
                 needs to know the plan ends on a specific date AND that
                 their fund stays safe regardless. Per the same pattern
                 as Settings membership-tab canceling card. */
              <SectionCard className="border-amber-200 bg-amber-50">
                <div className="p-5 space-y-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <p className="font-heading text-base font-semibold text-amber-900">
                        Your fund stays safe. Always.
                      </p>
                      <p className="mt-1 text-xs text-amber-900/80 leading-relaxed">
                        {userPlan === "starter" ? "Kiddo+" : userPlan === "legacy" ? "Kiddo Legacy" : "Kiddo Family"} ends {new Date(subscription.currentPeriodEnd!).toLocaleDateString("en-US", { month: "long", day: "numeric" })}.
                        Gifts still work. You can change your mind right now.
                      </p>
                    </div>
                    <Button
                      size="sm"
                      className="shrink-0 rounded-xl"
                      disabled={reactivating}
                      onClick={() => handleReactivateSubscription({ plan: userPlan === "starter" ? "starter" : "family" })}
                      data-testid="button-account-reactivate-plan"
                    >
                      {reactivating ? "Reactivating..." : "Keep my plan"}
                    </Button>
                  </div>
                </div>
              </SectionCard>
            ) : (
              <SectionCard className="bg-[hsl(var(--kiddo-evergreen)/0.06)] border-[hsl(var(--kiddo-evergreen)/0.18)]">
                <div className="p-5 space-y-4">
                  <div className="flex items-start gap-3">
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[hsl(var(--kiddo-evergreen))] text-white">
                      <Check size={17} />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-bold text-[hsl(var(--kiddo-evergreen))]">{planLabel} · Active</p>
                      {/* Renewal date — only meaningful for paid users.
                          Pulled from the subscription record; the
                          presence of currentPeriodEnd is the signal
                          (free users have no subscription). */}
                      {userPlan !== "free" && subscription?.currentPeriodEnd && (
                        <p className="mt-0.5 text-xs text-[hsl(var(--kiddo-evergreen)/0.7)]">
                          Renews {new Date(subscription.currentPeriodEnd).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}
                        </p>
                      )}
                      <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
                        {userPlan === "starter"
                          ? "Recurring investments, photo and video Memory Book entries, custom fund mix, and co-parent access."
                          : userPlan === "family"
                            // "Family-wide occasions" → honest rename per
                            // 2026-05-12 pricing-page cleanup. The actual
                            // Family-plan event differential is unlimited
                            // events with premium features bundled, not
                            // cross-fund occasion tools.
                            ? "Unlimited funds, unlimited occasions, and Kid View across every child."
                            : userPlan === "legacy"
                              ? "Everything in Family, plus 2 Occasion credits per year."
                              : "One child fund, a gift link, the Memory Book basics, no platform fee on normal gifts."}
                      </p>
                    </div>
                  </div>
                  {/* Paid-tier inline actions. Manage billing fires the
                      Stripe portal redirect directly (one tap, no
                      intermediate page). Cancel opens the local cancel-
                      confirm modal in-place (no bounce to Settings). */}
                  {userPlan !== "free" && (
                    <div className="flex flex-wrap items-center gap-2 pt-1 border-t border-[hsl(var(--kiddo-evergreen)/0.15)]">
                      <Button
                        size="sm"
                        variant="outline"
                        className="rounded-lg text-xs h-8 px-3"
                        onClick={() => handleOpenBillingPortal()}
                        disabled={openingPortal}
                        data-testid="button-account-manage-billing"
                      >
                        {openingPortal ? "Opening..." : "Manage billing"}
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        className="rounded-lg text-xs h-8 px-3 text-destructive hover:text-destructive hover:bg-destructive/5 border-destructive/30"
                        onClick={() => { haptic("light"); setCancelStep("warn"); setShowCancelConfirm(true); }}
                        data-testid="button-account-cancel-plan"
                      >
                        Cancel plan
                      </Button>
                    </div>
                  )}
                </div>
              </SectionCard>
            )}

            {/* PlanBenefitsCard — paid users see "what you're paying
                for" + this-year usage stats + one soft "haven't tried"
                nudge. Per the 2026-05-13 plan-benefits audit. Was
                previously rendered only on Settings membership tab;
                added to Account 2026-05-14 per WHO/HOW IA Phase 1c-B
                so the post-purchase value reminder lives where the
                parent actually manages their plan. Free users skip
                this card per the component's own internal render-
                rule ("Your Free benefits" reads weird). */}
            {(userPlan === "starter" || userPlan === "family" || userPlan === "legacy") && (
              <PlanBenefitsCard plan={userPlan as "starter" | "family" | "legacy"} />
            )}

            {/* Inline upgrade ladder per the Phase 1b move (2026-05-14).
                Plus, Family, and Legacy (existing subscribers only)
                cards with badges, tier-aware CTA labels, and inline
                checkout firing. This replaces the previous "Explore
                plans" pass-through CTA that used to route to the
                Settings membership tab. Account is now the primary
                home for plan exploration too, not just plan status +
                cancel. Duplicated JSX with Settings.tsx membership
                tab — Phase 1c will extract to a shared component
                when the upgrade ladder is removed from Settings. */}
            {(() => {
              const isStarterCurrent = userPlan === "starter";
              const isFamilyCurrent = userPlan === "family";
              const isLegacyCurrent = userPlan === "legacy";
              const planRank = (p: typeof userPlan): number =>
                p === "legacy" ? 3 : p === "family" ? 2 : p === "starter" ? 1 : 0;
              const currentRank = planRank(userPlan);
              const ctaLabel = (cardPlan: "starter" | "family" | "legacy") => {
                if (cardPlan === userPlan) return "Current plan";
                const cardRank = planRank(cardPlan);
                const planLabel = cardPlan === "starter" ? "Plus" : cardPlan === "family" ? "Family" : "Legacy";
                if (cardRank > currentRank) return `Upgrade to ${planLabel}`;
                // Lower-rank card from a higher-rank current plan is a
                // DOWNGRADE. 'Switch to' was neutral and hid the
                // direction; honest matches the Apple-Settings
                // register (iOS App Store subscription management
                // also uses 'Downgrade'). Locked 2026-05-18.
                return `Downgrade to ${planLabel}`;
              };
              const includedHint = (cardPlan: "starter" | "family" | "legacy") => {
                if (cardPlan === userPlan) return "";
                if (planRank(cardPlan) >= currentRank) return "";
                const currentLabel = userPlan === "family" ? "Kiddo Family" : userPlan === "legacy" ? "Kiddo Legacy" : "your plan";
                return `Included in ${currentLabel}`;
              };
              const recommendedPlan: "starter" | "family" | null =
                userPlan === "free" ? "starter"
                : userPlan === "starter" ? "family"
                : null;
              const starterBadge =
                isStarterCurrent ? { label: "Current plan", tone: "current" as const }
                : recommendedPlan === "starter" ? { label: "Recommended", tone: "gold" as const }
                : null;
              const familyBadge =
                isFamilyCurrent ? { label: "Current plan", tone: "current" as const }
                : recommendedPlan === "family" ? { label: "Recommended", tone: "gold" as const }
                : { label: "Best for families", tone: "evergreen" as const };
              const legacyBadge = isLegacyCurrent
                ? { label: "Current plan", tone: "current" as const }
                : null;
              const badgeClass = (tone: "current" | "gold" | "evergreen") =>
                tone === "current"
                  ? "rounded-full bg-[hsl(var(--kiddo-evergreen))] px-3 py-1 text-[10px] font-bold uppercase tracking-[0.12em] text-white"
                  : tone === "gold"
                    ? "rounded-full bg-[hsl(var(--kiddo-gold))] px-3 py-1 text-[10px] font-bold uppercase tracking-[0.12em] text-white"
                    : "rounded-full bg-[hsl(var(--kiddo-evergreen))] px-3 py-1 text-[10px] font-bold uppercase tracking-[0.12em] text-white";
              return (
                <div className={`grid gap-4 ${isLegacyCurrent ? "xl:grid-cols-3" : "xl:grid-cols-2"}`}>
                  <SectionCard className={`relative border-2 ${isStarterCurrent ? "border-[hsl(var(--kiddo-evergreen))]" : "border-[hsl(var(--kiddo-gold))]"} shadow-[0_2px_8px_rgba(26,23,16,0.10),0_8px_24px_rgba(26,23,16,0.08)]`}>
                    {starterBadge && (
                      <div className={`absolute left-5 top-0 -translate-y-1/2 ${badgeClass(starterBadge.tone)}`}>
                        {starterBadge.label}
                      </div>
                    )}
                    <div className="p-5 pt-6">
                      <h2 className="font-heading text-xl font-bold text-foreground">Kiddo+</h2>
                      <p className="mt-3 text-2xl font-bold leading-none text-[hsl(var(--kiddo-gold-ink))]">
                        ${KORA_STARTER_MONTHLY.toFixed(2)}<span className="text-sm font-normal text-muted-foreground">/mo</span>
                      </p>
                      <p className="mt-1 text-xs text-muted-foreground">or ${KORA_STARTER_YEARLY}/year</p>
                      <p className="mt-4 text-sm leading-relaxed text-muted-foreground">For one child, done right. Make this feel real every month.</p>
                      <div className="mt-5 space-y-2 text-sm text-muted-foreground">
                        {["One child fund. Move to Family if you add a second.", "Recurring investments for one child fund", "Add your own photos, videos, and voice to Memory Book entries", "Custom fund mix (pick your own stocks)", "Co-parent access and priority support"].map((item) => (
                          <p key={item} className="flex items-start gap-2"><Check size={14} className="mt-0.5 shrink-0 text-[hsl(var(--kiddo-gold-ink))]" />{item}</p>
                        ))}
                      </div>
                      {includedHint("starter") && (
                        <p className="mt-3 inline-flex items-center gap-1.5 rounded-full bg-[hsl(var(--kiddo-evergreen)/0.08)] px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.10em] text-[hsl(var(--kiddo-evergreen))]">
                          <Check size={10} />
                          {includedHint("starter")}
                        </p>
                      )}
                      <Button
                        className="mt-5 w-full rounded-xl"
                        onClick={() => handleUpgradeStarter(selectedStarterFundId)}
                        disabled={upgrading || isStarterCurrent}
                        data-testid="button-account-upgrade-starter"
                      >
                        {ctaLabel("starter")}
                      </Button>
                    </div>
                  </SectionCard>

                  <div
                    className={`relative overflow-hidden rounded-2xl ${isFamilyCurrent ? "border-2 border-[hsl(var(--kiddo-evergreen))]" : "border border-[hsl(var(--kiddo-evergreen)/0.22)]"} bg-[linear-gradient(145deg,hsl(var(--kiddo-evergreen))_0%,hsl(153_48%_11%)_100%)] text-white shadow-[0_2px_8px_rgba(26,23,16,0.10),0_18px_38px_rgba(27,58,45,0.20)]`}
                    data-testid="card-account-kiddo-family"
                  >
                    {familyBadge && (
                      <div className={`absolute right-4 top-4 rounded-full ${familyBadge.tone === "current" ? "bg-white text-[hsl(var(--kiddo-evergreen))]" : "border border-white/12 bg-white/10 text-white/80"} px-3 py-1 text-[10px] font-bold uppercase tracking-[0.12em]`}>
                        {familyBadge.label}
                      </div>
                    )}
                    <div className="relative p-5 pt-8">
                      <h2 className="font-heading text-xl font-bold text-[hsl(var(--kiddo-cream))]">Kiddo Family</h2>
                      <p className="mt-3 text-2xl font-bold leading-none text-[hsl(var(--kiddo-gold-light))]">
                        ${KORA_FAMILY_MONTHLY.toFixed(2)}<span className="text-sm font-normal text-white/50">/mo</span>
                      </p>
                      <p className="mt-1 text-xs text-white/45">or ${KORA_FAMILY_YEARLY}/year</p>
                      <p className="mt-4 text-sm leading-relaxed text-[hsl(var(--kiddo-cream)/0.78)]">For your family, long term. Manage everything in one place.</p>
                      <div className="mt-5 space-y-2 text-sm text-[hsl(var(--kiddo-cream)/0.84)]">
                        {/* Bullet list aligned 2026-05-20 with the
                            Pricing page cross-plan clarity audit.
                            "Memory Book authoring for every child
                            (photos, videos, voice)" → "Memory Book
                            for every child" (parenthetical wrongly
                            suggested Family adds media features; it
                            only extends Plus's authoring across kids).
                            "Unlimited occasions with premium features
                            included" → "Unlimited occasions" (premium
                            occasion features gate on subscription, so
                            both Plus AND Family have them — the
                            suffix made it sound like Family adds
                            features Plus lacks). */}
                        {["Unlimited funds, every child", "Memory Book for every child", "Unlimited occasions", "Kid View for every child", "One view for every fund in your household"].map((item) => (
                          <p key={item} className="flex items-start gap-2"><Check size={14} className="mt-0.5 shrink-0 text-[hsl(var(--kiddo-gold-light))]" />{item}</p>
                        ))}
                      </div>
                      {includedHint("family") && (
                        <p className="mt-3 inline-flex items-center gap-1.5 rounded-full bg-white/12 px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.10em] text-[hsl(var(--kiddo-cream))]">
                          <Check size={10} />
                          {includedHint("family")}
                        </p>
                      )}
                      <Button
                        variant="outline"
                        className="mt-5 w-full rounded-xl border-white/25 bg-white/10 text-white hover:bg-white/15 hover:text-white disabled:opacity-50"
                        onClick={handleUpgradeFamily}
                        disabled={upgrading || isFamilyCurrent}
                        data-testid="button-account-upgrade-family"
                      >
                        {ctaLabel("family")}
                      </Button>
                    </div>
                  </div>

                  {/* Legacy tier card — only renders for existing Legacy
                      subscribers. Pulled from non-Legacy users
                      2026-05-12 because the previous bullet list
                      contained 3 features that don't exist in code.
                      Honest bullets shown here for those subscribers. */}
                  {isLegacyCurrent && (
                    <SectionCard className="relative border-2 border-[hsl(var(--kiddo-evergreen))]">
                      {legacyBadge && (
                        <div className={`absolute left-5 top-0 -translate-y-1/2 ${badgeClass(legacyBadge.tone)}`}>
                          {legacyBadge.label}
                        </div>
                      )}
                      <div className="p-5 pt-6">
                        <h2 className="font-heading text-xl font-bold text-foreground">Kiddo Legacy</h2>
                        <p className="mt-3 text-2xl font-bold leading-none text-[hsl(var(--kiddo-evergreen))]">
                          ${KIDDO_LEGACY_YEARLY}<span className="text-sm font-normal text-muted-foreground">/yr</span>
                        </p>
                        <p className="mt-1 text-xs text-muted-foreground">annual only</p>
                        <p className="mt-4 text-sm leading-relaxed text-muted-foreground">For families taking this seriously. Plan this properly, long term.</p>
                        <div className="mt-5 space-y-2 text-sm text-muted-foreground">
                          {["Everything in Family", "2 Occasion credits per year"].map((item) => (
                            <p key={item} className="flex items-start gap-2"><Check size={14} className="mt-0.5 shrink-0 text-[hsl(var(--kiddo-evergreen))]" />{item}</p>
                          ))}
                        </div>
                        <Button
                          variant="outline"
                          className="mt-5 w-full rounded-xl border-[hsl(var(--kiddo-evergreen)/0.30)] text-[hsl(var(--kiddo-evergreen))]"
                          disabled
                          data-testid="button-account-legacy-current"
                        >
                          Current plan
                        </Button>
                      </div>
                    </SectionCard>
                  )}
                </div>
              );
            })()}

          </motion.div>
        )}

        {/* ── Security ── */}
        {accountTab === "security" && (
          <motion.div
            key="account-tab-security"
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.28, ease: [0.16, 1, 0.3, 1] }}
            className="space-y-4"
          >
            <SectionCard>
              <div className="divide-y divide-[hsl(var(--kiddo-border))]">
                {/* Password row */}
                <div className="p-4">
                  {!changingPassword ? (
                    <div className="flex items-center justify-between gap-4">
                      <div>
                        <p className="text-sm font-semibold text-foreground">Password</p>
                        <p className="mt-0.5 text-xs text-muted-foreground">Change your login password</p>
                      </div>
                      <Button
                        variant="outline"
                        size="sm"
                        className="shrink-0 rounded-xl"
                        onClick={() => { setChangingPassword(true); haptic("light"); }}
                        data-testid="button-change-password"
                      >
                        Change
                      </Button>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      <p className="text-sm font-semibold text-foreground">Change password</p>
                      {/* sr-only labels on each password field — visible
                          placeholder reads as the field hint, screen
                          readers get the proper label association. The
                          autoComplete hints (current-password vs
                          new-password) help password managers pick the
                          right values + pass WCAG. */}
                      <div className="relative">
                        <label htmlFor="account-current-password" className="sr-only">Current password</label>
                        <input
                          id="account-current-password"
                          name="currentPassword"
                          type={showCurrentPw ? "text" : "password"}
                          autoComplete="current-password"
                          value={currentPassword}
                          onChange={e => setCurrentPassword(e.target.value)}
                          placeholder="Current password"
                          className="w-full rounded-xl border border-border bg-background px-3 py-2.5 pr-10 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/20"
                          data-testid="input-current-password"
                        />
                        <button type="button" onClick={() => setShowCurrentPw(v => !v)} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground" aria-label={showCurrentPw ? "Hide current password" : "Show current password"}>
                          {showCurrentPw ? <EyeOff size={15} /> : <Eye size={15} />}
                        </button>
                      </div>
                      <div className="relative">
                        <label htmlFor="account-new-password" className="sr-only">New password</label>
                        <input
                          id="account-new-password"
                          name="newPassword"
                          type={showNewPw ? "text" : "password"}
                          autoComplete="new-password"
                          value={newPassword}
                          onChange={e => setNewPassword(e.target.value)}
                          placeholder="New password (min 8 chars)"
                          className="w-full rounded-xl border border-border bg-background px-3 py-2.5 pr-10 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/20"
                          data-testid="input-new-password"
                        />
                        <button type="button" onClick={() => setShowNewPw(v => !v)} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground" aria-label={showNewPw ? "Hide new password" : "Show new password"}>
                          {showNewPw ? <EyeOff size={15} /> : <Eye size={15} />}
                        </button>
                      </div>
                      <label htmlFor="account-confirm-password" className="sr-only">Confirm new password</label>
                      <input
                        id="account-confirm-password"
                        name="confirmPassword"
                        type="password"
                        autoComplete="new-password"
                        value={confirmPassword}
                        onChange={e => setConfirmPassword(e.target.value)}
                        placeholder="Confirm new password"
                        className="w-full rounded-xl border border-border bg-background px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/20"
                        data-testid="input-confirm-password"
                      />
                      <div className="flex gap-2 pt-1">
                        <Button
                          size="sm"
                          onClick={handleChangePassword}
                          disabled={savingPassword || !currentPassword || !newPassword || !confirmPassword}
                          className="rounded-xl"
                          data-testid="button-save-password"
                        >
                          {savingPassword ? "Saving..." : "Update password"}
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => { setChangingPassword(false); setCurrentPassword(""); setNewPassword(""); setConfirmPassword(""); }}
                        >
                          Cancel
                        </Button>
                      </div>
                    </div>
                  )}
                </div>

                <div className="flex items-center justify-between gap-4 p-4">
                  <div>
                    <p className="text-sm font-semibold text-foreground">Two-factor authentication</p>
                    <p className="mt-0.5 text-xs text-muted-foreground">Coming soon</p>
                  </div>
                  <span className="rounded-full bg-muted px-2.5 py-1 text-xs text-muted-foreground">Soon</span>
                </div>
              </div>
            </SectionCard>

            {/* Trusted contact (FINRA Rule 4512). Required-ish field for
                the brokerage relationship via DriveWealth: someone we
                can reach if we can't reach the parent, if we suspect
                financial exploitation, or to confirm a legal-guardian
                identity. Doubles as the right safety net for the kid-
                at-18 handoff failure path (parent unreachable at the
                exact moment a transfer needs to land). Optional in
                practice today; if/when DriveWealth enforces it the
                gate can be promoted to a setup-progress step. */}
            <SectionCard>
              <div className="p-5">
                <div className="flex items-start gap-3">
                  <UserPlus size={18} className="mt-0.5 shrink-0 text-[hsl(var(--kiddo-evergreen))]" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-bold text-foreground">Trusted contact</p>
                    <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                      Someone we can reach if we can't reach you. Used only for account
                      safety, identity confirmation, or suspected financial exploitation.
                      Required for FINRA-regulated accounts via our broker DriveWealth.
                    </p>
                  </div>
                </div>

                <div className="mt-4 space-y-3">
                  <div>
                    <label htmlFor="account-trusted-name" className="block text-xs font-medium text-muted-foreground mb-1.5">
                      Name
                    </label>
                    <input
                      id="account-trusted-name"
                      name="trustedContactName"
                      type="text"
                      autoComplete="name"
                      value={trustedContactName}
                      onChange={(e) => setTrustedContactName(e.target.value)}
                      placeholder="Full name"
                      maxLength={200}
                      className="w-full rounded-xl border border-border bg-background px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground/60 focus:outline-none focus:ring-2 focus:ring-primary/20"
                      data-testid="input-trusted-contact-name"
                    />
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label htmlFor="account-trusted-email" className="block text-xs font-medium text-muted-foreground mb-1.5">
                        Email
                      </label>
                      <input
                        id="account-trusted-email"
                        name="trustedContactEmail"
                        type="email"
                        autoComplete="email"
                        value={trustedContactEmail}
                        onChange={(e) => setTrustedContactEmail(e.target.value)}
                        placeholder="name@example.com"
                        maxLength={254}
                        className="w-full rounded-xl border border-border bg-background px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground/60 focus:outline-none focus:ring-2 focus:ring-primary/20"
                        data-testid="input-trusted-contact-email"
                      />
                    </div>
                    <div>
                      <label htmlFor="account-trusted-phone" className="block text-xs font-medium text-muted-foreground mb-1.5">
                        Phone
                      </label>
                      <input
                        id="account-trusted-phone"
                        name="trustedContactPhone"
                        type="tel"
                        autoComplete="tel"
                        value={trustedContactPhone}
                        onChange={(e) => setTrustedContactPhone(e.target.value)}
                        placeholder="(555) 123-4567"
                        maxLength={32}
                        className="w-full rounded-xl border border-border bg-background px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground/60 focus:outline-none focus:ring-2 focus:ring-primary/20"
                        data-testid="input-trusted-contact-phone"
                      />
                    </div>
                  </div>

                  <div>
                    <label htmlFor="account-trusted-relation" className="block text-xs font-medium text-muted-foreground mb-1.5">
                      Relationship
                    </label>
                    <input
                      id="account-trusted-relation"
                      name="trustedContactRelation"
                      type="text"
                      autoComplete="off"
                      value={trustedContactRelation}
                      onChange={(e) => setTrustedContactRelation(e.target.value)}
                      placeholder="e.g. Spouse, Parent, Sibling, Adult child"
                      maxLength={50}
                      className="w-full rounded-xl border border-border bg-background px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground/60 focus:outline-none focus:ring-2 focus:ring-primary/20"
                      data-testid="input-trusted-contact-relation"
                    />
                  </div>

                  <div className="flex flex-wrap gap-2 pt-1">
                    <Button
                      size="sm"
                      onClick={handleSaveTrustedContact}
                      disabled={savingTrustedContact || !trustedContactDirty}
                      className="rounded-xl"
                      data-testid="button-save-trusted-contact"
                    >
                      {savingTrustedContact ? "Saving..." : trustedContactHasAny ? "Update" : "Save"}
                    </Button>
                    {trustedContactHasAny && (
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={handleClearTrustedContact}
                        disabled={savingTrustedContact}
                        className="rounded-xl"
                        data-testid="button-clear-trusted-contact"
                      >
                        Remove contact
                      </Button>
                    )}
                  </div>
                </div>
              </div>
            </SectionCard>

            <SectionCard>
              <div className="flex items-start gap-3 p-5">
                <Shield size={18} className="mt-0.5 shrink-0 text-[hsl(var(--kiddo-evergreen))]" />
                <div>
                  <p className="text-sm font-bold text-foreground">SIPC protection</p>
                  <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
                    DriveWealth, LLC is a registered broker-dealer and member of FINRA/SIPC. Once your investing account is open, eligible securities are protected up to $500,000 against brokerage failure. This does not protect against market losses.
                  </p>
                  <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1">
                    <a href="https://www.sipc.org" target="_blank" rel="noopener noreferrer" className="text-xs font-semibold text-[hsl(var(--kiddo-evergreen))] hover:underline">sipc.org</a>
                    <a href="https://brokercheck.finra.org" target="_blank" rel="noopener noreferrer" className="text-xs font-semibold text-[hsl(var(--kiddo-evergreen))] hover:underline">FINRA BrokerCheck</a>
                    <Link href="/security" className="text-xs font-semibold text-[hsl(var(--kiddo-evergreen))] hover:underline">How we protect you</Link>
                  </div>
                </div>
              </div>
            </SectionCard>

            {/* Passkey manager. Per FACE_ID_SPEC.md WebAuthn item.
                Self-contained — fetches its own list, runs the
                add/remove ceremonies, falls through silently when
                no passkeys are registered. */}
            <PasskeyManager />

            <button
              type="button"
              onClick={handleLogout}
              className="flex w-full items-center justify-center gap-2 rounded-2xl border border-border px-4 py-3 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted/30 hover:text-foreground"
            >
              <LogOut size={15} />
              Log out
            </button>

            {/* Account deletion — App Store 5.1.1(v) compliance. Quiet but
                findable at the bottom of Account settings, below logout.
                Apple-Settings register per project_cancellation_dark_pattern_avoidance.md:
                no "please stay" upsell, no guilt phrasing, no hidden cancel
                button. Confirmation modal is rendered separately so the
                destructive action requires a deliberate second step. */}
            <button
              type="button"
              onClick={() => setDeleteAccountModalOpen(true)}
              className="mt-3 flex w-full items-center justify-center gap-2 rounded-2xl px-4 py-2.5 text-xs font-medium text-muted-foreground/70 transition-colors hover:text-red-600"
              data-testid="button-delete-account"
            >
              Delete my account
            </button>
          </motion.div>
        )}

        <TrustMicroStrip />

        {/* Account deletion confirmation dialog. Renders the multi-step
            flow described in project_account_deletion_spec.md:
              1. Explain what gets deleted vs preserved (especially: kid's
                 Memory Book, tax records, and active funds are NOT deleted
                 by this action — UTMA legal mechanics)
              2. If funds need attention: surface guidance + close-fund link
              3. Type-to-confirm with the user's email
              4. POST /api/account/delete, show success state, log out
        */}
        <DeleteAccountModal
          open={deleteAccountModalOpen}
          onClose={() => setDeleteAccountModalOpen(false)}
          userEmail={user?.email ?? null}
          onDeleted={() => {
            setDeleteAccountModalOpen(false);
            logout();
          }}
        />

        {/* Cancel-plan modal. Two-step warn → confirm flow per the
            locked Apple-Settings register (cancel is a normal action,
            not a confession; no "I understand" prefix; "Keep my plan"
            is primary). Leaner than the Settings membership-tab modal:
            no impact-preview itemization, no parent-contribution
            enumeration. The richer preview is still on Settings for
            edge cases where the parent is wavering and would benefit
            from the breakdown. Account's flow is for parents who
            already know they want to cancel and want the action to
            fire without surface-bouncing. */}
        <Dialog open={showCancelConfirm} onOpenChange={(o) => { if (!o && !canceling) { setShowCancelConfirm(false); setCancelStep("warn"); } }}>
          <DialogContent className="max-w-md w-[95vw] max-h-[90dvh] p-0 gap-0 overflow-hidden rounded-2xl flex flex-col" aria-describedby={undefined}>
            <DialogTitle className="sr-only">Cancel plan</DialogTitle>
            {cancelStep === "warn" ? (
              <div className="flex-1 min-h-0 p-6 space-y-5 overflow-y-auto">
                <div className="space-y-2">
                  <h2 className="font-heading text-xl font-semibold text-foreground">
                    Your fund stays safe.
                  </h2>
                  <p className="text-sm text-foreground/80 leading-relaxed">
                    {planLabel} is paid through{" "}
                    {subscription?.currentPeriodEnd ? new Date(subscription.currentPeriodEnd).toLocaleDateString("en-US", { month: "long", day: "numeric" }) : "the end of your billing period"}.
                    After that, the plan moves to Free and your money keeps working. Still invested, still growing, gifts arriving the same way they always have.
                  </p>
                </div>
                <div className="space-y-3 text-sm text-foreground/80 leading-relaxed">
                  <p className="font-semibold text-foreground">A few things change when you cancel:</p>
                  {userPlan === "starter" ? (
                    <p>
                      Adding new photos, videos, and voice to Memory Book entries pauses. Every photo, voice memo, and parent-authored entry already there stays. Recurring investments and co-parent invites also pause.
                    </p>
                  ) : (
                    <p>
                      Adding new photos, videos, and voice to Memory Book entries pauses across every child's fund. Everything you've already added stays. Recurring investments and co-parent invites pause too. The household overview becomes read-only, and funds beyond your first become view-only.
                    </p>
                  )}
                </div>
                <div className="space-y-2">
                  <Button
                    className="w-full rounded-xl"
                    onClick={() => setShowCancelConfirm(false)}
                    data-testid="button-account-keep-plan"
                  >
                    Keep my plan
                  </Button>
                  <button
                    type="button"
                    className="w-full text-center text-xs text-muted-foreground hover:text-foreground transition-colors py-1"
                    onClick={() => setCancelStep("confirm")}
                    data-testid="button-account-proceed-to-cancel"
                  >
                    Continue to cancel
                  </button>
                </div>
              </div>
            ) : (
              <div className="flex-1 min-h-0 p-6 space-y-5 overflow-y-auto">
                <div className="space-y-1">
                  <h2 className="font-heading text-xl font-semibold text-foreground">Cancel {planLabel}?</h2>
                  <p className="text-sm text-muted-foreground leading-relaxed">
                    You'll move to Free
                    {subscription?.currentPeriodEnd ? ` on ${new Date(subscription.currentPeriodEnd).toLocaleDateString("en-US", { month: "long", day: "numeric" })}` : " at the end of your billing period"}.
                    Your fund stays safe.
                  </p>
                </div>
                <div className="flex gap-3">
                  <Button variant="outline" className="flex-1 rounded-xl" onClick={() => setCancelStep("warn")} disabled={canceling}>
                    Go back
                  </Button>
                  <Button
                    className="flex-1 rounded-xl bg-destructive hover:bg-destructive/90 text-white"
                    disabled={canceling}
                    onClick={() => handleCancelSubscription()}
                    data-testid="button-account-confirm-cancel"
                  >
                    {canceling ? <><Loader2 size={14} className="mr-1.5 animate-spin" />Canceling...</> : "Yes, cancel"}
                  </Button>
                </div>
              </div>
            )}
          </DialogContent>
        </Dialog>
      </main>
    </div>
  );
}
