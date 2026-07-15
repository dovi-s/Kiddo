// Account deletion confirmation modal. App Store 5.1.1(v) compliance —
// every app that creates accounts must provide in-app account deletion.
// Spec at project_account_deletion_spec.md.
//
// Decisions locked 2026-05-12 (from the spec's "open decisions" section):
//   1. 30-day grace period via support@kiddofund.com (don't expose
//      a self-serve "undo" — too easy to accidentally re-toggle;
//      support email is the deliberate channel)
//   2. Block deletion when fund has no co-parent + positive balance
//      (point at close-fund flow first)
//   3. Co-parent notification on inherit: email + in-app banner on
//      next login (handled by server on POST /api/account/delete)
//   4. PII anonymization: immediate session invalidation, 30-day
//      delayed PII scrub (matches grace period; worker handles)
//   5. Gifter-attribution on Memory Book entries: server anonymizes
//      sender-name to "Former gifter", preserves note content
//
// Locked-discipline anti-patterns refused (project_cancellation_dark_pattern_avoidance.md):
//   - No "please stay" upsell discount
//   - No "are you sure" guilt phrasing
//   - No hidden cancel button — Cancel and Delete are equally weighted
//   - Apple-Settings register
//   - kid-at-18 lens: copy emphasizes that the kid's fund + Memory Book
//     are preserved, not deleted with the parent's account

import { useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { toast } from "@/hooks/use-toast";
import { haptic } from "@/lib/haptics";
import { capFirst } from "@/lib/format-name";
import { AlertTriangle, Lock, BookOpen, FileText, CheckCircle2 } from "lucide-react";

type DeleteAccountModalProps = {
  open: boolean;
  onClose: () => void;
  userEmail: string | null;
  onDeleted: () => void;
};

type Step = "review" | "confirm" | "blocked" | "submitting" | "done";

type BlockedReason = {
  reason: "active_funds_with_balance";
  funds: Array<{
    id: string;
    recipientFirstName: string | null;
    // Total funds at risk (invested + cash + pending). Sub-totals
    // surface in the UI so the parent knows what action each slice
    // needs (liquidate invested, withdraw cash, wait/refund pending).
    balance: number;
    investedBalance: number;
    cashBalance: number;
    pendingBalance: number;
  }>;
};

export function DeleteAccountModal({ open, onClose, userEmail, onDeleted }: DeleteAccountModalProps) {
  const [step, setStep] = useState<Step>("review");
  const [confirmEmail, setConfirmEmail] = useState("");
  const [reason, setReason] = useState("");
  const [blockedInfo, setBlockedInfo] = useState<BlockedReason | null>(null);
  const [error, setError] = useState<string | null>(null);

  const resetState = () => {
    setStep("review");
    setConfirmEmail("");
    setReason("");
    setBlockedInfo(null);
    setError(null);
  };

  const handleClose = () => {
    resetState();
    onClose();
  };

  const handleProceedToConfirm = async () => {
    haptic("selection");
    setError(null);
    // Pre-flight: ask server if any funds block deletion. Server returns
    // either {ok: true} (proceed) or {blocked: true, ...} (show guidance).
    try {
      const res = await fetch("/api/account/delete/preflight", {
        method: "GET",
        credentials: "include",
      });
      if (!res.ok) {
        // Preflight endpoint not deployed yet — fall through to confirm.
        // Server will re-check on POST /delete and block there if needed.
        setStep("confirm");
        return;
      }
      const data = await res.json();
      if (data?.blocked) {
        setBlockedInfo(data as BlockedReason);
        setStep("blocked");
        return;
      }
      setStep("confirm");
    } catch {
      // Network failure on preflight — let user proceed; the POST will
      // block server-side if needed.
      setStep("confirm");
    }
  };

  const handleDelete = async () => {
    if (confirmEmail.trim().toLowerCase() !== (userEmail || "").trim().toLowerCase()) {
      setError("Email doesn't match. Type your account email exactly.");
      return;
    }
    haptic("medium");
    setStep("submitting");
    setError(null);
    try {
      const res = await fetch("/api/account/delete", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          confirmedEmail: confirmEmail.trim(),
          reason: reason.trim() || undefined,
        }),
      });
      if (res.status === 409) {
        // Server-side block: positive-balance funds without co-parent.
        const data = await res.json();
        setBlockedInfo(data as BlockedReason);
        setStep("blocked");
        return;
      }
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        throw new Error(data?.error || "Could not delete account. Try again or email support@kiddofund.com.");
      }
      // Demo accounts can't actually delete — the server returns {saved:false}.
      // NEVER show the "deleted" success state + force logout on a demo.
      const okData = await res.json().catch(() => null);
      if (okData && okData.demo === true && okData.saved === false) {
        setError(okData.message || "This is the demo. Your account isn't actually deleted.");
        setStep("confirm");
        return;
      }
      setStep("done");
      haptic("success");
      // Give the success state ~2.5s to read, then trigger logout + redirect.
      setTimeout(() => {
        onDeleted();
      }, 2500);
    } catch (err: any) {
      setError(err?.message || "Could not delete account.");
      setStep("confirm");
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) handleClose(); }}>
      {/* Scroll-shell pattern: outer DialogContent constrains height to
          90dvh and clips overflow; each step's inner div owns its own
          padding + scrolls vertically. Same shape Account.tsx:1430
          uses. Without this, the review-step's three info cards
          overflow the viewport on shorter screens and there's no way
          to reach the Continue / Cancel buttons. Reported 2026-05-15
          with a screenshot showing exactly this state. */}
      <DialogContent
        className="max-w-md w-[95vw] max-h-[90dvh] p-0 gap-0 overflow-hidden rounded-2xl flex flex-col"
        aria-describedby={undefined}
      >
        <DialogTitle className="sr-only">Delete account</DialogTitle>

        {step === "review" && (
          // flex-1 min-h-0 is load-bearing: without min-h-0, the flex
          // child's default min-height:auto keeps it at content size, so
          // overflow-y-auto never triggers and the parent's
          // overflow-hidden just clips the bottom of the modal. With
          // min-h-0 the child can shrink to fit the parent's max-h
          // (90dvh) and the scrollbar appears as expected. Same fix
          // applied to every step branch below; their content can
          // independently overflow if the viewport is short.
          <div className="flex-1 min-h-0 p-6 space-y-4 overflow-y-auto">
            <div className="flex items-start gap-3">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-amber-100">
                <AlertTriangle size={18} className="text-amber-700" />
              </div>
              <div className="min-w-0 flex-1">
                <h2 className="font-heading text-lg font-semibold text-foreground">Delete your account?</h2>
                <p className="mt-1 text-sm text-muted-foreground leading-relaxed">
                  This removes you from Kiddo. Some things stay. Read this carefully.
                </p>
              </div>
            </div>

            <div className="space-y-3 rounded-2xl bg-muted/30 p-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">What gets deleted</p>
              <ul className="space-y-1.5 text-sm text-foreground">
                <li>· Your login, name, profile photo</li>
                <li>· Your active Plus or Family subscription (cancels at period end)</li>
                <li>· Your linked bank accounts</li>
                <li>· Your session. You'll be logged out everywhere.</li>
              </ul>
            </div>

            <div className="space-y-3 rounded-2xl bg-[hsl(var(--kiddo-evergreen)/0.06)] p-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-[hsl(var(--kiddo-evergreen))]">What stays (the kid-at-18 lens)</p>
              <ul className="space-y-2 text-sm text-foreground">
                <li className="flex items-start gap-2">
                  <BookOpen size={14} className="mt-0.5 shrink-0 text-[hsl(var(--kiddo-evergreen))]" />
                  <span>The Memory Book stays. It belongs to the kid, not to your account.</span>
                </li>
                <li className="flex items-start gap-2">
                  <Lock size={14} className="mt-0.5 shrink-0 text-[hsl(var(--kiddo-evergreen))]" />
                  <span>Any active fund stays. If you've named an accepted co-parent (Co-Admin role), they take over as primary custodian. If not, you'll need to withdraw the money and close each fund first.</span>
                </li>
                <li className="flex items-start gap-2">
                  <FileText size={14} className="mt-0.5 shrink-0 text-[hsl(var(--kiddo-evergreen))]" />
                  <span>Tax records and transaction history stay (legal requirement).</span>
                </li>
              </ul>
            </div>

            <p className="text-xs text-muted-foreground leading-relaxed">
              You'll get a confirmation email with a one-tap link to restore your account. The link works for 30 days. After that your personal info is permanently scrubbed and restoration is no longer possible.
            </p>

            <div className="flex flex-col gap-2 pt-1">
              <Button
                onClick={handleProceedToConfirm}
                variant="outline"
                className="w-full rounded-xl border-red-200 text-red-700 hover:bg-red-50 hover:text-red-700"
                data-testid="button-delete-account-continue"
              >
                Continue
              </Button>
              <Button onClick={handleClose} variant="ghost" className="w-full rounded-xl">
                Cancel
              </Button>
            </div>
          </div>
        )}

        {step === "blocked" && blockedInfo && (
          <div className="flex-1 min-h-0 p-6 space-y-4 overflow-y-auto">
            <div className="flex items-start gap-3">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-amber-100">
                <AlertTriangle size={18} className="text-amber-700" />
              </div>
              <div className="min-w-0 flex-1">
                <h2 className="font-heading text-lg font-semibold text-foreground">A few things first</h2>
                <p className="mt-1 text-sm text-muted-foreground leading-relaxed">
                  You're still the custodian on {blockedInfo.funds.length === 1 ? "a fund" : `${blockedInfo.funds.length} funds`} that hold money. UTMA law says that money belongs to the kid, not to your account, so the money has to land somewhere safe before your account can close.
                </p>
              </div>
            </div>

            <div className="space-y-3 rounded-2xl bg-muted/30 p-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">What needs handling</p>
              {blockedInfo.funds.map((f) => {
                // Per-slice guidance. Each slice has a different next step
                // because each one is at a different point in the money's
                // journey from gifter → invested-at-broker.
                const slices: Array<{ label: string; amount: number; hint: string }> = [];
                if (f.investedBalance > 0.01) {
                  slices.push({
                    label: "Invested",
                    amount: f.investedBalance,
                    hint: "Sell holdings, then withdraw.",
                  });
                }
                if (f.cashBalance > 0.01) {
                  slices.push({
                    label: "Cash",
                    amount: f.cashBalance,
                    hint: "Withdraw to your linked bank.",
                  });
                }
                if (f.pendingBalance > 0.01) {
                  slices.push({
                    label: "Pending gifts",
                    amount: f.pendingBalance,
                    hint: "Wait for settlement (1–2 business days), then withdraw.",
                  });
                }
                return (
                  <div key={f.id} className="space-y-1.5">
                    <div className="flex items-center justify-between text-sm">
                      <span className="font-semibold text-foreground">
                        {f.recipientFirstName ? `${capFirst(f.recipientFirstName)}'s fund` : `Fund ${f.id.slice(0, 8)}`}
                      </span>
                      <span className="font-semibold tabular-nums text-foreground">${f.balance.toFixed(2)}</span>
                    </div>
                    {slices.length > 0 && (
                      <ul className="space-y-1 pl-3 border-l-2 border-amber-200">
                        {slices.map((s) => (
                          <li key={s.label} className="text-xs text-muted-foreground leading-relaxed">
                            <span className="font-semibold text-foreground">${s.amount.toFixed(2)} {s.label}.</span>{" "}
                            {s.hint}
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                );
              })}
            </div>

            <div className="space-y-2 rounded-2xl bg-[hsl(var(--kiddo-evergreen)/0.06)] p-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-[hsl(var(--kiddo-evergreen))]">Two ways to unblock</p>
              <ul className="space-y-1.5 text-sm text-foreground">
                <li>
                  <span className="font-semibold">Hand it off.</span> Invite a co-parent and grant them the Co-Admin role. Once they accept, they become primary custodian and the fund stays in their care.
                </li>
                <li>
                  <span className="font-semibold">Withdraw and close.</span> Sell any holdings, wait for pending gifts to settle, withdraw the cash to your bank, then close the fund. The Memory Book stays either way.
                </li>
              </ul>
            </div>

            <p className="text-xs text-muted-foreground leading-relaxed">
              Need help walking through it? Email support@kiddofund.com.
            </p>

            <div className="flex flex-col gap-2 pt-1">
              <Button onClick={handleClose} className="w-full rounded-xl">
                Got it
              </Button>
            </div>
          </div>
        )}

        {step === "confirm" && (
          <div className="flex-1 min-h-0 p-6 space-y-4 overflow-y-auto">
            <div>
              <h2 className="font-heading text-lg font-semibold text-foreground">Confirm deletion</h2>
              <p className="mt-1 text-sm text-muted-foreground leading-relaxed">
                Type your email to confirm. Within 30 days, the restore link in your confirmation email brings your account back. After that, the deletion is final.
              </p>
            </div>

            <div className="space-y-2">
              <label htmlFor="delete-account-confirm-email" className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Your account email
              </label>
              <input
                id="delete-account-confirm-email"
                name="confirm-email"
                type="email"
                value={confirmEmail}
                onChange={(e) => { setConfirmEmail(e.target.value); setError(null); }}
                placeholder={userEmail || "your email"}
                autoComplete="off"
                className="w-full rounded-xl border border-border bg-background px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                data-testid="input-delete-account-confirm-email"
              />
            </div>

            <div className="space-y-2">
              <label htmlFor="delete-account-reason" className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Anything you'd like us to know? (optional)
              </label>
              <textarea
                id="delete-account-reason"
                name="reason"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                rows={2}
                maxLength={500}
                placeholder="Helps us improve. Skip if you'd rather not."
                className="w-full rounded-xl border border-border bg-background px-4 py-3 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                data-testid="input-delete-account-reason"
              />
            </div>

            {error && (
              <p className="rounded-xl bg-red-50 px-3 py-2 text-xs text-red-700" role="alert">
                {error}
              </p>
            )}

            <div className="flex flex-col gap-2 pt-1">
              <Button
                onClick={handleDelete}
                className="w-full rounded-xl bg-red-600 text-white hover:bg-red-700"
                data-testid="button-delete-account-confirm"
              >
                Delete my account
              </Button>
              <Button onClick={() => setStep("review")} variant="ghost" className="w-full rounded-xl">
                Back
              </Button>
            </div>
          </div>
        )}

        {step === "submitting" && (
          <div className="flex-1 min-h-0 p-6 flex flex-col items-center justify-center gap-4 py-10">
            <div className="h-8 w-8 animate-spin rounded-full border-2 border-muted-foreground/30 border-t-foreground" />
            <p className="text-sm text-muted-foreground">Deleting your account…</p>
          </div>
        )}

        {step === "done" && (
          <div className="flex-1 min-h-0 p-6 flex flex-col items-center justify-center gap-4 py-10 text-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[hsl(var(--kiddo-evergreen)/0.10)]">
              <CheckCircle2 size={28} className="text-[hsl(var(--kiddo-evergreen))]" />
            </div>
            <div>
              <h2 className="font-heading text-lg font-semibold text-foreground">Account deleted</h2>
              <p className="mt-1 text-sm text-muted-foreground leading-relaxed max-w-xs">
                Logging you out. Check your email. The restore link works for 30 days if you change your mind.
              </p>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
