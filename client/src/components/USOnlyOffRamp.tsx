// US-only off-ramp panel.
//
// Kora is structurally US-only at launch — UTMA is a US legal construct,
// DriveWealth is a US-resident broker, and 1099 tax reporting assumes
// US filers. A non-US visitor who lands on signup would otherwise hit
// the silent-break failure mode: their state isn't in the picker and
// they get stuck mid-onboarding with no explanation.
//
// This component is the honest catch. Apple-Settings register: no
// guilt-trip, no "we're working hard for you," no promise we can't
// keep. Just: "We're US-only today. If you'd like a note when that
// changes, leave your email." The waitlist is captured as an opt-in
// signal of demand — there is NO concrete international expansion
// plan today (memory `project_growth_deferrals.md` files this under
// landmines to refuse).
//
// Used by:
//   - GetStarted.tsx country step
//   - AddFundSheet.tsx country picker (non-US branch)
//   - Mobile AddFundScreen (RN equivalent lives there inline)

import { useState } from "react";
import { Button } from "@/components/ui/button";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function USOnlyOffRamp({
  sourceSurface,
  // Optional pre-filled country if the parent component already collected
  // it (the AddFundSheet path may know the country was "OTHER" but not
  // which one). The user can edit before submitting.
  initialCountry = "",
  // Compact rendering for places where the off-ramp sits inside a tight
  // card (e.g. AddFundSheet). Full mode is used for full-screen steps.
  compact = false,
}: {
  sourceSurface: string;
  initialCountry?: string;
  compact?: boolean;
}) {
  const [email, setEmail] = useState("");
  const [country, setCountry] = useState(initialCountry);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e?: React.FormEvent) => {
    e?.preventDefault();
    setError(null);
    const trimmed = email.trim().toLowerCase();
    if (!EMAIL_RE.test(trimmed)) {
      setError("Enter a valid email address.");
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch("/api/waitlist/international", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: trimmed,
          country: country.trim(),
          sourceSurface,
        }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body?.error || "Could not save your email.");
      }
      setSubmitted(true);
    } catch (err: any) {
      setError(err?.message || "Could not save your email.");
    } finally {
      setSubmitting(false);
    }
  };

  if (submitted) {
    // Honest success state — no celebration, no "we'll be in touch
    // soon!" promise. Just an acknowledgement and the truth about
    // current scope. The kid-at-18 lens applies here too: if Kora
    // ever does launch internationally, this is the email it'll
    // arrive at. Don't overstate.
    return (
      <div className={`rounded-2xl border border-[hsl(var(--kiddo-evergreen)/0.18)] bg-[hsl(var(--kiddo-evergreen)/0.06)] ${compact ? "p-4" : "p-5"}`}>
        <p className="text-sm font-semibold text-foreground">You're on the list.</p>
        <p className="mt-1 text-xs text-muted-foreground leading-relaxed">
          We'll email you if Kora becomes available in your country. No concrete date today.
        </p>
      </div>
    );
  }

  return (
    <div className={`rounded-2xl border border-border bg-card ${compact ? "p-4" : "p-5"}`} data-testid="us-only-offramp">
      <p className="text-sm font-semibold text-foreground">Kora is US-only at launch.</p>
      <p className="mt-1.5 text-xs text-muted-foreground leading-relaxed">
        Our investment accounts use the US UTMA structure and our brokerage partner serves US residents.
        If you'd like a note when we open to other countries, leave your email.
      </p>
      <form onSubmit={handleSubmit} className={`${compact ? "mt-3" : "mt-4"} space-y-2`}>
        <label htmlFor="offramp-email" className="sr-only">Email address</label>
        <input
          id="offramp-email"
          name="email"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="you@example.com"
          className="h-10 w-full rounded-xl border border-border bg-background px-3 text-sm focus:outline-none focus:ring-1 focus:ring-primary"
          autoComplete="email"
          inputMode="email"
          data-testid="input-offramp-email"
        />
        <label htmlFor="offramp-country" className="sr-only">Country (optional)</label>
        <input
          id="offramp-country"
          name="country"
          type="text"
          autoComplete="country-name"
          value={country}
          onChange={(e) => setCountry(e.target.value)}
          placeholder="Country (optional)"
          className="h-10 w-full rounded-xl border border-border bg-background px-3 text-sm focus:outline-none focus:ring-1 focus:ring-primary"
          maxLength={100}
          data-testid="input-offramp-country"
        />
        {error && (
          <p className="text-xs text-red-700" data-testid="text-offramp-error">{error}</p>
        )}
        <Button
          type="submit"
          disabled={submitting || !email.trim()}
          className="w-full rounded-full h-10 text-sm font-semibold"
          data-testid="button-offramp-submit"
        >
          {submitting ? "Saving…" : "Notify me when Kora launches in my country"}
        </Button>
      </form>
    </div>
  );
}
