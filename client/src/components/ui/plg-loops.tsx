import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Users, 
  Calendar, 
  Gift,
  Heart, 
  Share2, 
  ChevronRight,
  X, 
  UserPlus,
  Check
} from "lucide-react";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

function toFundLabel(name: string) {
  const trimmed = (name || "").trim();
  if (!trimmed) return "this fund";
  const lower = trimmed.toLowerCase();
  if (lower.endsWith(" fund")) return trimmed;
  return `${trimmed}'s fund`;
}

interface ReferralPromptProps {
  recipientName: string;
  onShare: () => void;
  onDismiss: () => void;
}

export function ReferralPrompt({ recipientName, onShare, onDismiss }: ReferralPromptProps) {
  const fundLabel = toFundLabel(recipientName);
  const shareLabel = "Share";
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      className="rounded-2xl border border-border/60 bg-card p-4 shadow-premium-sm"
    >
      <div className="flex items-start gap-3">
        <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
          <Heart className="w-5 h-5 text-primary" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-foreground mb-1">
            Let the next gift last, too
          </p>
          <p className="text-sm text-muted-foreground mb-3 leading-relaxed">
            Send {fundLabel} to the people who usually ask what to get. They can give in under a minute, no account needed.
          </p>
          <div className="flex flex-wrap gap-2">
            <button
              onClick={onShare}
              data-testid="button-referral-share"
              className="inline-flex min-h-10 items-center gap-1.5 rounded-full bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90"
            >
              <Share2 size={14} />
              {shareLabel}
            </button>
            <button
              onClick={onDismiss}
              data-testid="button-referral-dismiss"
              className="min-h-10 rounded-full px-4 py-2 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
            >
              Skip for now
            </button>
          </div>
        </div>
        <button 
          onClick={onDismiss}
          className="rounded-full p-1 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          aria-label="Dismiss sharing prompt"
        >
          <X size={16} />
        </button>
      </div>
    </motion.div>
  );
}

interface RecurringGiftNudgeProps {
  lastGiftDate: string;
  recipientName: string;
  occasionName?: string;
  onSetupRecurring: () => void;
  onDismiss: () => void;
}

// Renamed in spirit: this is a reminder nudge, not a recurring-charge nudge. The component
// name stays for backwards compatibility with the export; behavior and copy are now honest.
export function RecurringGiftNudge({
  lastGiftDate,
  recipientName,
  occasionName,
  onSetupRecurring,
  onDismiss
}: RecurringGiftNudgeProps) {
  const lastGift = lastGiftDate ? new Date(lastGiftDate) : null;
  const lastGiftLabel = lastGift && !Number.isNaN(lastGift.getTime())
    ? lastGift.toLocaleDateString("en-US", { month: "long", day: "numeric" })
    : null;
  const nudgeCopy = occasionName
    ? `Want a reminder when ${recipientName}'s ${occasionName} comes around again? We'll email you so you don't have to remember.`
    : lastGiftLabel
      ? `Want a reminder to gift ${recipientName} again? We'll email you when it's time. No bank connection, no auto-charge.`
      : `Want a reminder to gift ${recipientName} again? We'll email you when it's time. No bank connection, no auto-charge.`;
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      className="rounded-2xl border border-border/60 bg-card p-4 shadow-premium-sm"
    >
      <div className="flex items-start gap-3">
        <div className="w-10 h-10 rounded-xl bg-[hsl(var(--kiddo-gold)/0.16)] flex items-center justify-center shrink-0">
          <Calendar className="w-5 h-5 text-[hsl(var(--kiddo-ink))]" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-foreground mb-1">
            Set a reminder for next time
          </p>
          <p className="text-sm text-muted-foreground mb-3 leading-relaxed">
            {nudgeCopy}
          </p>
          <div className="flex flex-wrap gap-2">
            <button
              onClick={onSetupRecurring}
              data-testid="button-setup-reminder"
              className="kiddo-gold-button inline-flex min-h-10 items-center gap-1.5 rounded-full px-4 py-2 text-sm font-bold transition-colors"
            >
              <Calendar size={14} />
              Set a reminder
            </button>
            <button
              onClick={onDismiss}
              data-testid="button-reminder-dismiss"
              className="min-h-10 rounded-full px-4 py-2 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
            >
              No thanks
            </button>
          </div>
        </div>
        <button
          onClick={onDismiss}
          className="rounded-full p-1 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          aria-label="Dismiss reminder prompt"
        >
          <X size={16} />
        </button>
      </div>
    </motion.div>
  );
}

interface RecurringSetupModalProps {
  isOpen: boolean;
  onClose: () => void;
  recipientName: string;
  // Email pre-filled from the gifter's checkout session (Stripe) when available.
  // The user can edit it inside the modal — they may want reminders sent to a
  // different inbox than the receipt one.
  defaultEmail?: string;
  onConfirm: (amount: number, frequency: string, email: string) => void;
}

// Renamed in spirit: a reminder picker, not a recurring-charge setup. Export name kept for
// backwards compatibility; copy and flow are now honest about what actually happens
// (we email a reminder; no bank, no auto-charge).
export function RecurringSetupModal({
  isOpen,
  onClose,
  recipientName,
  defaultEmail = "",
  onConfirm
}: RecurringSetupModalProps) {
  const [amount, setAmount] = useState(50);
  const [frequency, setFrequency] = useState("yearly");
  const [email, setEmail] = useState(defaultEmail);
  const [emailTouched, setEmailTouched] = useState(false);

  // When the modal opens, sync the email field with whatever the parent
  // knows (Stripe receipt email, prior updates email, etc). Don't override
  // if the user has already started typing.
  useEffect(() => {
    if (isOpen && !emailTouched) {
      setEmail(defaultEmail);
    }
    if (!isOpen) {
      // Reset touched state on close so a re-open syncs again.
      setEmailTouched(false);
    }
  }, [isOpen, defaultEmail, emailTouched]);

  const trimmedEmail = email.trim();
  const emailIsValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedEmail);

  const amounts = [10, 25, 50, 100];
  const frequencies = [
    { id: "yearly", label: "Once a year", description: "Right around the birthday or anniversary" },
    { id: "quarterly", label: "Every 3 months", description: "A steadier rhythm without being too much" },
    { id: "monthly", label: "Every month", description: "For the closest family or biggest fans" },
  ];

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-md bg-white p-0 gap-0 max-h-[92vh] max-h-[92dvh] overflow-y-auto" aria-describedby={undefined}>
        <div className="p-5 border-b border-stone-100">
          <DialogTitle className="font-semibold text-stone-900">Set a gift reminder</DialogTitle>
          <p className="text-sm text-stone-500 mt-0.5">
            We'll email you when it's time to gift {recipientName} again. No bank connection. No auto-charge. Just a nudge.
          </p>
        </div>

        <div className="p-5 space-y-6">
          <div>
            <label className="block text-sm font-medium text-stone-700 mb-2" htmlFor="reminder-email-input">
              Send reminder to
            </label>
            <input
              id="reminder-email-input"
              type="email"
              inputMode="email"
              autoComplete="email"
              value={email}
              onChange={(e) => { setEmail(e.target.value); setEmailTouched(true); }}
              placeholder="you@example.com"
              data-testid="input-reminder-email"
              className="w-full px-4 py-3 rounded-xl border border-stone-200 bg-white text-sm text-stone-900 placeholder:text-stone-400 focus:outline-none focus:ring-2 focus:ring-stone-900/20 focus:border-stone-400"
            />
            <p className="mt-2 text-2xs text-stone-500">
              {defaultEmail && !emailTouched
                ? "Pre-filled from your gift receipt. Change it if you want reminders sent to a different inbox."
                : "Where we'll send the reminder. One email per reminder, unsubscribe anytime."}
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium text-stone-700 mb-3">
              Suggested amount
            </label>
            <div className="grid grid-cols-4 gap-2">
              {amounts.map((a) => (
                <button
                  key={a}
                  onClick={() => setAmount(a)}
                  data-testid={`button-amount-${a}`}
                  className={`py-3 rounded-xl font-medium transition-all ${
                    amount === a
                      ? "bg-stone-900 text-white"
                      : "bg-stone-50 text-stone-700 hover:bg-stone-100"
                  }`}
                >
                  ${a}
                </button>
              ))}
            </div>
            <p className="mt-2 text-2xs text-stone-500">
              We'll suggest this amount in the reminder email. You can change it when you actually send the gift.
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium text-stone-700 mb-3">
              How often
            </label>
            <div className="space-y-2">
              {frequencies.map((f) => (
                <button
                  key={f.id}
                  onClick={() => setFrequency(f.id)}
                  data-testid={`button-frequency-${f.id}`}
                  className={`w-full p-4 rounded-xl text-left transition-all flex items-center justify-between ${
                    frequency === f.id
                      ? "bg-stone-900 text-white"
                      : "bg-stone-50 text-stone-700 hover:bg-stone-100"
                  }`}
                >
                  <div>
                    <p className="font-medium">{f.label}</p>
                    <p className={`text-sm ${frequency === f.id ? "text-stone-300" : "text-stone-500"}`}>
                      {f.description}
                    </p>
                  </div>
                  {frequency === f.id && <Check size={20} />}
                </button>
              ))}
            </div>
          </div>

          <div className="rounded-xl border border-[hsl(var(--kiddo-gold)/0.3)] bg-[hsl(var(--kiddo-cream))] p-4">
            <div className="flex items-start gap-3">
              <Heart className="w-5 h-5 text-[hsl(var(--kiddo-ink))] shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-medium text-stone-900 mb-1">
                  Just a reminder. Nothing automatic.
                </p>
                <p className="text-xs text-stone-600">
                  When the time comes, we'll email you a one-tap link back to {recipientName}'s gift page. You decide whether to send and how much. Unsubscribe from the email anytime.
                </p>
              </div>
            </div>
          </div>
        </div>

        <div className="p-5 border-t border-stone-100 space-y-3">
          <button
            onClick={() => emailIsValid && onConfirm(amount, frequency, trimmedEmail)}
            disabled={!emailIsValid}
            data-testid="button-confirm-reminder"
            className="kiddo-gold-button w-full py-3 font-bold rounded-xl transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Save reminder
          </button>
          {!emailIsValid && trimmedEmail.length > 0 && (
            <p className="text-xs text-red-500 text-center">
              Enter a valid email so we know where to send the reminder.
            </p>
          )}
          <p className="text-xs text-stone-400 text-center">
            No Kiddo account required. Unsubscribe anytime from the reminder email.
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
}

interface CollaboratorInviteProps {
  fundName: string;
  onInvite: () => void;
  onDismiss: () => void;
}

export function CollaboratorInvite({ fundName, onInvite, onDismiss }: CollaboratorInviteProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      className="rounded-2xl border border-border/50 bg-card p-4 shadow-premium-sm"
    >
      <div className="flex items-start gap-3">
        <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
          <Users className="w-5 h-5 text-primary" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-foreground mb-1">
            Invite a co-parent or family admin
          </p>
          <p className="text-sm text-muted-foreground mb-3 leading-relaxed">
            Give a partner access to manage {fundName} together
          </p>
          <div className="flex gap-2">
            <Button
              onClick={onInvite}
              data-testid="button-invite-collaborator"
              size="sm"
              className="rounded-full"
            >
              <UserPlus size={14} />
              Invite someone
            </Button>
            <Button
              onClick={onDismiss}
              data-testid="button-collaborator-dismiss"
              variant="outline"
              size="sm"
              className="rounded-full"
            >
              Later
            </Button>
          </div>
        </div>
        <button 
          onClick={onDismiss}
          className="text-muted-foreground hover:text-foreground transition-colors"
        >
          <X size={16} />
        </button>
      </div>
    </motion.div>
  );
}

interface CollaboratorInviteModalProps {
  isOpen: boolean;
  onClose: () => void;
  fundName: string;
  onSendInvite: (email: string, role: string) => void;
}

export function CollaboratorInviteModal({ 
  isOpen, 
  onClose, 
  fundName,
  onSendInvite 
}: CollaboratorInviteModalProps) {
  const [email, setEmail] = useState("");
  const [role, setRole] = useState("viewer");
  const [isSending, setIsSending] = useState(false);

  const roles = [
    { 
      id: "viewer", 
      label: "Viewer", 
      description: "Can view fund activity and growth",
      permissions: ["View balance", "See contributors", "View activity"]
    },
    { 
      id: "co-admin", 
      label: "Co-Admin", 
      description: "Can manage events and thank-yous",
      // Co-admin is enforced server-side for exactly these: create/edit events
      // (routes.ts ~11017/11167) + send thank-yous (~15645). Fund SETTINGS
      // (profile, strategy, kid-view, gifter-notifications) are OWNER-ONLY on
      // the server — they touch custodian/SSN/state/majority-age fields — so
      // "Edit fund settings" was dropped: the modal must not promise a power a
      // co-admin gets a silent 403 on. (Audit 2026-07.)
      permissions: ["All viewer permissions", "Create and edit events", "Send thank-yous"]
    },
  ];

  const handleSend = () => {
    setIsSending(true);
    setTimeout(() => {
      onSendInvite(email, role);
      setIsSending(false);
      setEmail("");
      onClose();
    }, 1000);
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-md bg-card p-0 gap-0 border border-border/50 shadow-premium-lg max-h-[90dvh] overflow-y-auto" aria-describedby={undefined}>
        <div className="p-5 border-b border-border/50">
          <DialogTitle className="font-heading font-semibold text-foreground">Invite to {fundName}</DialogTitle>
          <p className="text-sm text-muted-foreground mt-0.5">
            Add a family member to help manage this fund
          </p>
        </div>

        <div className="p-5 space-y-6">
          <div>
            <label className="block text-sm font-medium text-foreground mb-2">
              Email address
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="partner@example.com"
              data-testid="input-collaborator-email"
              className="w-full px-4 py-3 border border-border rounded-xl text-foreground bg-background placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/40"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-foreground mb-3">
              Role
            </label>
            <div className="space-y-2">
              {roles.map((r) => (
                <button
                  key={r.id}
                  onClick={() => setRole(r.id)}
                  data-testid={`button-role-${r.id}`}
                  className={`w-full p-4 rounded-xl text-left transition-all ${
                    role === r.id
                      ? "bg-primary/5 border-2 border-primary"
                      : "bg-muted/30 border-2 border-transparent hover:bg-muted/50"
                  }`}
                >
                  <div className="flex items-center justify-between mb-2">
                    <p className="font-medium text-foreground">{r.label}</p>
                    {role === r.id && <Check size={18} className="text-primary" />}
                  </div>
                  <p className="text-sm text-muted-foreground mb-2">{r.description}</p>
                  <div className="flex flex-wrap gap-1">
                    {r.permissions.map((p) => (
                      <span key={p} className="text-3xs bg-background text-muted-foreground px-2 py-0.5 rounded-full border border-border/50">
                        {p}
                      </span>
                    ))}
                  </div>
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="p-5 border-t border-border/50">
          <Button
            onClick={handleSend}
            disabled={!email || isSending}
            data-testid="button-send-invite"
            className="w-full rounded-xl disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isSending ? (
              <>
                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                Sending...
              </>
            ) : (
              <>
                <UserPlus size={18} />
                Send invite
              </>
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

interface GiftReceivedToastProps {
  giverName: string;
  amount: number;
  recipientName: string;
  onViewActivity: () => void;
  onDismiss: () => void;
}

export function GiftReceivedToast({
  giverName,
  amount,
  recipientName,
  onViewActivity,
  onDismiss
}: GiftReceivedToastProps) {
  const fundLabel = toFundLabel(recipientName);
  const childFirst = (recipientName || "").split(" ")[0].trim();
  const displayName = (giverName || "").trim() || (childFirst ? `Someone who loves ${childFirst}` : "Someone");
  const formattedAmount = `$${Number.isFinite(amount) ? amount.toFixed(2).replace(/\.00$/, "") : "0"}`;

  // Auto-dismiss after 7s. Uses a ref to capture the latest onDismiss
  // without re-running the timer effect on every parent re-render.
  //
  // Previously the dep array was [onDismiss]. onDismiss is an inline
  // arrow function in Dashboard.tsx, so its identity changes on every
  // Dashboard render (useQuery refetch, fund switch, time tick, etc.).
  // The effect re-ran on every identity change, clearing the timer and
  // starting a fresh 7s one. With Dashboard re-rendering more often
  // than every 7s in practice, the timer almost never reached zero, so
  // the auto-dismiss never actually fired. That left the dismissal
  // persistence broken for users who closed the tab without clicking
  // the X or View activity button.
  //
  // Ref-based capture: effect runs once on mount, timer fires once at
  // 7s, calling whatever onDismiss is current at that moment. Robust
  // against parent re-renders. Locked 2026-05-20.
  const onDismissRef = useRef(onDismiss);
  useEffect(() => {
    onDismissRef.current = onDismiss;
  }, [onDismiss]);
  useEffect(() => {
    const timer = setTimeout(() => onDismissRef.current(), 7000);
    return () => clearTimeout(timer);
  }, []);

  return (
    <motion.div
      initial={{ opacity: 0, y: 50, scale: 0.9 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: 20, scale: 0.9 }}
      className="fixed bottom-24 left-4 right-4 md:left-auto md:right-6 md:w-96 bg-background rounded-2xl shadow-2xl border border-border p-4 z-50"
    >
      <div className="flex items-start gap-3">
        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ delay: 0.2, type: "spring", stiffness: 200 }}
          className="w-11 h-11 rounded-full bg-[hsl(var(--kiddo-evergreen))] flex items-center justify-center shrink-0"
        >
          <Gift className="w-5 h-5 text-white" />
        </motion.div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-foreground leading-snug">
            {displayName} just gifted {formattedAmount}
          </p>
          <p className="text-xs text-muted-foreground mt-0.5">
            {fundLabel} is growing.
          </p>
          <button
            onClick={onViewActivity}
            data-testid="button-view-gift-activity"
            className="mt-2 text-xs text-[hsl(var(--kiddo-evergreen))] font-medium hover:opacity-80 transition-opacity flex items-center gap-1"
          >
            View activity
            <ChevronRight size={12} />
          </button>
        </div>
        <button
          onClick={onDismiss}
          className="text-muted-foreground hover:text-foreground transition-colors mt-0.5"
          aria-label="Dismiss"
        >
          <X size={16} />
        </button>
      </div>
    </motion.div>
  );
}
