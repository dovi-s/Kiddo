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
  funds: Array<{ id: string; recipientFirstName: string | null; balance: number }>;
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
      <DialogContent className="max-w-md" aria-describedby={undefined}>
        <DialogTitle className="sr-only">Delete account</DialogTitle>

        {step === "review" && (
          <div className="space-y-4">
            <div className="flex items-start gap-3">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-amber-100">
                <AlertTriangle size={18} className="text-amber-700" />
              </div>
              <div className="min-w-0 flex-1">
                <h2 className="font-heading text-lg font-semibold text-foreground">Delete your account?</h2>
                <p className="mt-1 text-sm text-muted-foreground leading-relaxed">
                  This removes you from Kiddo. Some things stay — read this carefully.
                </p>
              </div>
            </div>

            <div className="space-y-3 rounded-2xl bg-muted/30 p-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">What gets deleted</p>
              <ul className="space-y-1.5 text-sm text-foreground">
                <li>· Your login, name, profile photo</li>
                <li>· Your active Plus or Family subscription (cancels immediately)</li>
                <li>· Your linked bank accounts</li>
                <li>· Your session — you'll be logged out</li>
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
                  <span>Any active fund stays. If there's a co-parent, they take over as primary custodian. If not, you'll need to close the fund first.</span>
                </li>
                <li className="flex items-start gap-2">
                  <FileText size={14} className="mt-0.5 shrink-0 text-[hsl(var(--kiddo-evergreen))]" />
                  <span>Tax records and transaction history stay (legal requirement).</span>
                </li>
              </ul>
            </div>

            <p className="text-xs text-muted-foreground leading-relaxed">
              If you change your mind within 30 days, email support@kiddofund.com and we can reverse the deletion. After 30 days your personal info is permanently scrubbed.
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
          <div className="space-y-4">
            <div className="flex items-start gap-3">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-amber-100">
                <AlertTriangle size={18} className="text-amber-700" />
              </div>
              <div className="min-w-0 flex-1">
                <h2 className="font-heading text-lg font-semibold text-foreground">A few things first</h2>
                <p className="mt-1 text-sm text-muted-foreground leading-relaxed">
                  You have active funds that need a successor custodian or to be closed before your account can be deleted. This is a UTMA legal requirement, not a Kiddo rule.
                </p>
              </div>
            </div>

            <div className="space-y-2 rounded-2xl bg-muted/30 p-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Funds with balances</p>
              {blockedInfo.funds.map((f) => (
                <div key={f.id} className="flex items-center justify-between text-sm">
                  <span className="text-foreground">{f.recipientFirstName ? `${f.recipientFirstName}'s fund` : `Fund ${f.id.slice(0, 8)}`}</span>
                  <span className="font-semibold tabular-nums text-foreground">${f.balance.toFixed(2)}</span>
                </div>
              ))}
            </div>

            <p className="text-xs text-muted-foreground leading-relaxed">
              To proceed: invite a co-parent (Family plan) so they can take over as primary custodian, OR close each fund first (returns money to the bank account you choose). For help, email support@kiddofund.com.
            </p>

            <div className="flex flex-col gap-2 pt-1">
              <Button onClick={handleClose} className="w-full rounded-xl">
                Got it
              </Button>
            </div>
          </div>
        )}

        {step === "confirm" && (
          <div className="space-y-4">
            <div>
              <h2 className="font-heading text-lg font-semibold text-foreground">Confirm deletion</h2>
              <p className="mt-1 text-sm text-muted-foreground leading-relaxed">
                Type your email to confirm. This cannot be undone except by emailing support within 30 days.
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
          <div className="flex flex-col items-center justify-center gap-4 py-10">
            <div className="h-8 w-8 animate-spin rounded-full border-2 border-muted-foreground/30 border-t-foreground" />
            <p className="text-sm text-muted-foreground">Deleting your account…</p>
          </div>
        )}

        {step === "done" && (
          <div className="flex flex-col items-center justify-center gap-4 py-10 text-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[hsl(var(--kiddo-evergreen)/0.10)]">
              <CheckCircle2 size={28} className="text-[hsl(var(--kiddo-evergreen))]" />
            </div>
            <div>
              <h2 className="font-heading text-lg font-semibold text-foreground">Account deleted</h2>
              <p className="mt-1 text-sm text-muted-foreground leading-relaxed max-w-xs">
                Logging you out. Email support@kiddofund.com within 30 days if you change your mind.
              </p>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
