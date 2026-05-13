// Public report affordance for any content surface (kid view, memory
// book, gifter share). Inline + intentionally small — a "Report" link
// rather than a prominent button, because the bar to report should
// be discoverable without being a noise source for the rest of the
// surface.
//
// Three-state ladder:
//   1. closed     — only the inline "Report" link is visible
//   2. open form  — small inline panel with reason textarea + optional
//                   email, submit + cancel
//   3. submitted  — calm acknowledgement, no thank-you theatre
//
// Server endpoint: POST /api/reports. See server/routes.ts. Rate-
// limited per IP. Anonymous reporters supported (no auth required).
//
// What happens on the other end: the report lands in the admin T&S
// queue. If the target is a memory entry, it's auto-flagged so it
// surfaces immediately in the queue's "Flagged" stack. The admin
// reviews and applies one of the four actions
// (approve/hide/remove/escalate).

import { useState } from "react";

const REASON_OPTIONS = [
  "Inappropriate for a child to see",
  "Looks like spam or scam",
  "Not who it says it's from",
  "Something else",
];

export function ReportContentButton({
  targetType,
  targetId,
  // Compact mode shrinks the button to a subtle text link. Default
  // mode renders with a small border for slightly more discoverability.
  compact = true,
  // Optional context the surface knows that the server doesn't (e.g.
  // "I'm viewing this from /kid-view"). Captured into content_reports.context.
  context,
}: {
  targetType: "memory_entry" | "gift";
  targetId: string;
  compact?: boolean;
  context?: Record<string, unknown>;
}) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState<string>("");
  const [customReason, setCustomReason] = useState("");
  const [email, setEmail] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e?: React.FormEvent) => {
    e?.preventDefault();
    setError(null);
    const finalReason = (reason === "Something else" || !reason) ? customReason.trim() : reason;
    if (finalReason.length < 3) {
      setError("Tell us briefly what's wrong.");
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch("/api/reports", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          targetType,
          targetId,
          reason: finalReason,
          email: email.trim() || undefined,
          context: context || undefined,
        }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body?.error || "Could not submit report.");
      }
      setSubmitted(true);
    } catch (err: any) {
      setError(err?.message || "Could not submit report.");
    } finally {
      setSubmitting(false);
    }
  };

  if (submitted) {
    return (
      <div className="mt-2 rounded-lg bg-muted/40 px-3 py-2 text-[11px] text-muted-foreground">
        Report sent. Thanks — an admin will review.
      </div>
    );
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={
          compact
            ? "text-[11px] text-muted-foreground/70 underline-offset-2 hover:text-foreground hover:underline"
            : "rounded-full border border-border bg-card px-2.5 py-1 text-[11px] font-medium text-muted-foreground hover:text-foreground"
        }
        data-testid={`button-report-${targetType}-${targetId}`}
      >
        Report
      </button>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="mt-2 rounded-xl border border-border bg-card p-3 space-y-2">
      <p className="text-xs font-semibold text-foreground">What's wrong with this?</p>
      <div className="space-y-1.5">
        {REASON_OPTIONS.map((opt) => (
          <label key={opt} className="flex items-center gap-2 text-xs text-foreground cursor-pointer">
            <input
              type="radio"
              name={`report-reason-${targetId}`}
              checked={reason === opt}
              onChange={() => setReason(opt)}
              className="accent-primary"
            />
            {opt}
          </label>
        ))}
      </div>
      {(reason === "Something else" || !reason) && (
        <textarea
          value={customReason}
          onChange={(e) => setCustomReason(e.target.value)}
          placeholder="Brief description"
          rows={2}
          className="w-full rounded-lg border border-border bg-background px-2.5 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-primary"
          maxLength={1000}
        />
      )}
      <input
        type="email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        placeholder="Your email (optional, only if you want a reply)"
        className="w-full rounded-lg border border-border bg-background px-2.5 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-primary"
        autoComplete="email"
        inputMode="email"
      />
      {error && <p className="text-[11px] text-red-700">{error}</p>}
      <div className="flex items-center gap-2">
        <button
          type="submit"
          disabled={submitting}
          className="rounded-full bg-foreground px-3 py-1.5 text-[11px] font-semibold text-background disabled:opacity-50"
          data-testid={`button-submit-report-${targetId}`}
        >
          {submitting ? "Sending…" : "Send report"}
        </button>
        <button
          type="button"
          onClick={() => { setOpen(false); setReason(""); setCustomReason(""); setError(null); }}
          className="text-[11px] text-muted-foreground hover:text-foreground"
        >
          Cancel
        </button>
      </div>
    </form>
  );
}
