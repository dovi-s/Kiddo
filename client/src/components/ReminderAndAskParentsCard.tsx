// Reminder + "ask parents to enable recurring" card for the gifter
// checkout on a FREE-plan fund.
//
// Per project_pricing_v3_recurring_at_plus.md (locked 2026-05-23):
// recurring is gated at the FUND tier. Free funds get a real reminder
// system instead of recurring auto-charges. Gifters never pay; the
// parent's plan determines what features the fund supports.
//
// This card surfaces TWO low-friction paths the gifter can take when
// they want to give again on a Free fund:
//
//   1. "Remind me to give again" — opt into the email reminder
//      cadence (monthly / quarterly / yearly). Uses the existing
//      POST /api/recurring-gifts endpoint which writes to the
//      gift-reminder table (despite the legacy column name; not a
//      charge, just an email).
//
//   2. "Ask the family to enable monthly contributions" — sends a
//      relationship signal to the parent via POST /api/funds/:fundId/
//      recurring-request, which creates a `recurring_request`
//      activity on the parent's dashboard. Parent discovers Plus
//      organically from their own settings; never weaponizes
//      "your fund's parents haven't paid" framing.
//
// Diplomatic framing per pricing-v3 design constraint #2: NEVER
// paywall, ALWAYS product-statement. The gifter's first impression
// is "this fund supports one-time + reminders" not "this fund is on
// the cheap plan." Locked copy direction.

import { useState } from "react";
import { Bell, Heart, Check, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { haptic } from "@/lib/haptics";

export type ReminderAndAskParentsCardProps = {
  fundId: string;
  childName: string;
  defaultAmount?: number;
};

type ReminderState = "idle" | "submitting" | "submitted" | "error";
type AskState = "idle" | "open" | "submitting" | "submitted" | "error";

export function ReminderAndAskParentsCard({
  fundId,
  childName,
  defaultAmount,
}: ReminderAndAskParentsCardProps) {
  const safeChildName = (childName || "the kid").trim() || "the kid";

  // Reminder form state
  const [reminderEmail, setReminderEmail] = useState("");
  const [reminderName, setReminderName] = useState("");
  const [reminderFrequency, setReminderFrequency] = useState<"monthly" | "quarterly" | "yearly">("monthly");
  const [reminderState, setReminderState] = useState<ReminderState>("idle");
  const [reminderError, setReminderError] = useState<string | null>(null);
  const [reminderOpen, setReminderOpen] = useState(false);

  // Ask-parents form state
  const [askOpen, setAskOpen] = useState<AskState>("idle");
  const [askEmail, setAskEmail] = useState("");
  const [askName, setAskName] = useState("");
  const [askMessage, setAskMessage] = useState("");
  const [askError, setAskError] = useState<string | null>(null);

  const handleReminderSubmit = async () => {
    if (reminderState === "submitting") return;
    setReminderState("submitting");
    setReminderError(null);
    try {
      const res = await fetch("/api/recurring-gifts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          fundId,
          senderName: reminderName.trim() || "A gifter",
          senderEmail: reminderEmail.trim(),
          amount: defaultAmount && defaultAmount > 0 ? defaultAmount : 25,
          frequency: reminderFrequency,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setReminderError(typeof data?.error === "string" ? data.error : "Couldn't set the reminder. Try again.");
        setReminderState("error");
        haptic("error");
        return;
      }
      setReminderState("submitted");
      haptic("success");
    } catch {
      setReminderError("Network hiccup. Try again in a moment.");
      setReminderState("error");
      haptic("error");
    }
  };

  const handleAskSubmit = async () => {
    if (askOpen === "submitting") return;
    setAskOpen("submitting");
    setAskError(null);
    try {
      const res = await fetch(`/api/funds/${encodeURIComponent(fundId)}/recurring-request`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          gifterEmail: askEmail.trim(),
          gifterName: askName.trim(),
          message: askMessage.trim(),
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setAskError(typeof data?.error === "string" ? data.error : "Couldn't send the request. Try again.");
        setAskOpen("error");
        haptic("error");
        return;
      }
      setAskOpen("submitted");
      haptic("success");
    } catch {
      setAskError("Network hiccup. Try again in a moment.");
      setAskOpen("error");
      haptic("error");
    }
  };

  return (
    <div className="kiddo-card p-5 space-y-4" data-testid="reminder-and-ask-parents-card">
      <div>
        <p className="text-sm font-semibold text-foreground">
          Want to give again later?
        </p>
        <p className="mt-0.5 text-xs text-muted-foreground leading-relaxed">
          This fund supports one-time gifts and reminders. We can email you when it's time to give to {safeChildName} again.
        </p>
      </div>

      {/* Reminder path — opt-in email cadence using existing endpoint */}
      {reminderState === "submitted" ? (
        <div
          className="rounded-2xl border border-primary/30 bg-primary/5 p-4 flex items-start gap-3"
          data-testid="reminder-success"
        >
          <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground">
            <Check size={14} strokeWidth={2.5} />
          </div>
          <div className="flex-1 text-xs text-foreground leading-relaxed">
            We'll email you {reminderFrequency} when it's a good time to give {safeChildName} another gift. No charges. Unsubscribe any time.
          </div>
        </div>
      ) : !reminderOpen ? (
        <button
          type="button"
          onClick={() => { haptic("selection"); setReminderOpen(true); }}
          className="w-full rounded-2xl border border-border bg-card hover:border-primary/40 px-4 py-3 text-left transition-colors"
          data-testid="button-open-reminder"
        >
          <div className="flex items-start gap-3">
            <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <Bell size={14} strokeWidth={1.8} />
            </div>
            <div className="flex-1">
              <p className="text-sm font-semibold text-foreground">Remind me to give again</p>
              <p className="mt-0.5 text-xs text-muted-foreground">Email me {safeChildName}'s birthday and other moments.</p>
            </div>
          </div>
        </button>
      ) : (
        <div className="rounded-2xl border border-border bg-card p-4 space-y-3">
          <div className="flex items-center gap-2">
            <Bell size={14} className="text-primary" />
            <p className="text-sm font-semibold text-foreground">Email reminders</p>
          </div>
          <div>
            <label className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">How often</label>
            <div className="mt-1.5 flex gap-2">
              {(["monthly", "quarterly", "yearly"] as const).map((f) => (
                <button
                  key={f}
                  type="button"
                  onClick={() => { haptic("selection"); setReminderFrequency(f); }}
                  className={`flex-1 rounded-xl border px-3 py-2 text-xs font-semibold capitalize transition-colors ${
                    reminderFrequency === f
                      ? "border-primary bg-primary/5 text-primary"
                      : "border-border text-muted-foreground"
                  }`}
                  data-testid={`button-reminder-freq-${f}`}
                >
                  {f}
                </button>
              ))}
            </div>
          </div>
          <input
            type="text"
            value={reminderName}
            onChange={(e) => setReminderName(e.target.value)}
            placeholder="Your first name"
            autoComplete="given-name"
            className="w-full rounded-xl border border-border bg-background px-3 py-2 text-sm"
            data-testid="input-reminder-name"
          />
          <input
            type="email"
            value={reminderEmail}
            onChange={(e) => setReminderEmail(e.target.value)}
            placeholder="your@email.com"
            autoComplete="email"
            className="w-full rounded-xl border border-border bg-background px-3 py-2 text-sm"
            data-testid="input-reminder-email"
          />
          {reminderError && (
            <p className="text-xs text-destructive">{reminderError}</p>
          )}
          <Button
            type="button"
            size="sm"
            className="w-full rounded-xl"
            disabled={!reminderEmail.trim() || reminderState === "submitting"}
            onClick={() => void handleReminderSubmit()}
            data-testid="button-submit-reminder"
          >
            {reminderState === "submitting" ? "Setting reminder..." : "Set the reminder"}
          </Button>
        </div>
      )}

      {/* Ask-parents path — feature-request flow */}
      <div className="border-t border-border/60 pt-4">
        {askOpen === "submitted" ? (
          <div
            className="rounded-2xl border border-primary/30 bg-primary/5 p-4 flex items-start gap-3"
            data-testid="ask-parents-success"
          >
            <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground">
              <Check size={14} strokeWidth={2.5} />
            </div>
            <div className="flex-1 text-xs text-foreground leading-relaxed">
              {/* "we'll email you" is a REAL promise: the recurring-request
                  fulfillment pass in recurringContributionWorker emails this
                  gifter when the fund's coverage flips recurring on. Added
                  2026-06-03 with that worker — don't soften one without the
                  other. */}
              We let {safeChildName}'s family know you'd love to give monthly. The decision is theirs; we'll never pressure them. If they turn it on, we'll email you.
            </div>
          </div>
        ) : askOpen === "idle" ? (
          <button
            type="button"
            onClick={() => { haptic("selection"); setAskOpen("open"); }}
            className="w-full text-left text-xs text-muted-foreground hover:text-foreground underline underline-offset-2"
            data-testid="button-open-ask-parents"
          >
            Or ask {safeChildName}'s family if they'd like to enable monthly contributions →
          </button>
        ) : (
          <div className="rounded-2xl border border-border bg-card p-4 space-y-3">
            <div className="flex items-center gap-2">
              <Heart size={14} className="text-primary" />
              <p className="text-sm font-semibold text-foreground">
                Let {safeChildName}'s family know
              </p>
            </div>
            <p className="text-xs text-muted-foreground leading-relaxed">
              We'll send a note to {safeChildName}'s parents that you'd love to set up monthly contributions. They can decide whether to enable it. We won't pressure them; this is just a relationship signal.
            </p>
            <input
              type="text"
              value={askName}
              onChange={(e) => setAskName(e.target.value)}
              placeholder="Your name"
              autoComplete="name"
              className="w-full rounded-xl border border-border bg-background px-3 py-2 text-sm"
              data-testid="input-ask-name"
            />
            <input
              type="email"
              value={askEmail}
              onChange={(e) => setAskEmail(e.target.value)}
              placeholder="your@email.com"
              autoComplete="email"
              className="w-full rounded-xl border border-border bg-background px-3 py-2 text-sm"
              data-testid="input-ask-email"
            />
            <textarea
              value={askMessage}
              onChange={(e) => setAskMessage(e.target.value)}
              rows={3}
              placeholder={`Tell ${safeChildName}'s family why this matters to you (optional)`}
              className="w-full rounded-xl border border-border bg-background px-3 py-2 text-sm resize-none"
              data-testid="input-ask-message"
            />
            {askError && (
              <p className="text-xs text-destructive">{askError}</p>
            )}
            <Button
              type="button"
              size="sm"
              className="w-full rounded-xl"
              disabled={!askEmail.trim() || !askName.trim() || askOpen === "submitting"}
              onClick={() => void handleAskSubmit()}
              data-testid="button-submit-ask-parents"
            >
              {askOpen === "submitting" ? "Sending..." : "Send the note"}
              {askOpen !== "submitting" && <ArrowRight className="ml-2 h-3 w-3" />}
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
