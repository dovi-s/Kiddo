// SponsorPlusCard — gifter purchases a year of Plus or Family for the
// parent's fund. Renders on GiftCheckout for Free funds (alongside the
// existing ReminderAndAskParentsCard) as a third path the gifter can
// take to unlock recurring + operator features on the fund.
//
// Per project_gifter_sponsors_plus_subscription.md (locked 2026-05-23).
// One-time annual purchase; never auto-renews. Gifter never has an
// ongoing billing relationship with Kiddo — they pay once and walk
// away with a clean conscience.
//
// Diplomatic framing per pricing-v3 design constraint #2: this is a
// GIFT being given, not a paywall being bypassed. Copy frames it as
// "you're giving the family the Plus experience" rather than "the
// family hasn't paid for Plus and you're fixing it." Same calm tone
// as the reminder + ask-parents card.

import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { Sparkles, Check, ChevronRight, Lock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { haptic } from "@/lib/haptics";

export type SponsorPlusCardProps = {
  fundId: string;
  childName: string;
  defaultGifterEmail?: string;
  defaultGifterName?: string;
  className?: string;
};

type SponsorshipStatus = {
  sponsored: {
    tier: "starter" | "family";
    sponsorName: string | null;
    expiresAt: string;
  } | null;
  directlyCovered: boolean;
};

export function SponsorPlusCard({
  fundId,
  childName,
  defaultGifterEmail,
  defaultGifterName,
  className,
}: SponsorPlusCardProps) {
  const safeChildName = (childName || "the kid").trim() || "the kid";
  const [open, setOpen] = useState(false);
  const [tier, setTier] = useState<"starter" | "family">("starter");
  const [email, setEmail] = useState(defaultGifterEmail || "");
  const [name, setName] = useState(defaultGifterName || "");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Reset prefills when caller passes them later (e.g., gifter typed
  // their email/name on the gift-checkout step before reaching here).
  useEffect(() => {
    if (defaultGifterEmail) setEmail(defaultGifterEmail);
    if (defaultGifterName) setName(defaultGifterName);
  }, [defaultGifterEmail, defaultGifterName]);

  // Status check — has the fund already been sponsored? If yes, show
  // the "already covered" state instead of the CTA. Refreshes on mount
  // so a race-condition double-purchase is caught at the UI level
  // (server-side guard is the load-bearing defense).
  const { data: status } = useQuery<SponsorshipStatus>({
    queryKey: ["sponsor-plus-status", fundId],
    queryFn: async () => {
      const res = await fetch(`/api/funds/${encodeURIComponent(fundId)}/sponsor-plus/status`);
      if (!res.ok) return { sponsored: null, directlyCovered: false };
      return res.json();
    },
    enabled: !!fundId,
    staleTime: 60_000,
  });

  // If already covered (sponsored or direct), show a passive state
  // and suppress the CTA. Diplomatic framing — "already covered" is
  // a product statement, not a "someone beat you to it" comparison.
  if (status?.sponsored) {
    const expiresLabel = (() => {
      try {
        return new Date(status.sponsored!.expiresAt).toLocaleDateString("en-US", {
          month: "long", day: "numeric", year: "numeric",
        });
      } catch {
        return "later this year";
      }
    })();
    return (
      <div className={className}>
        <div
          className="rounded-2xl border border-border bg-card p-5 flex items-start gap-3"
          data-testid="sponsor-plus-already-covered"
        >
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
            <Sparkles size={16} strokeWidth={1.8} />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold text-foreground">
              {safeChildName}'s fund is already on Kiddo {status.sponsored.tier === "family" ? "Family" : "Plus"}.
            </p>
            <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
              {status.sponsored.sponsorName
                ? `${status.sponsored.sponsorName} already sponsored coverage through ${expiresLabel}.`
                : `Coverage is active through ${expiresLabel}.`}{" "}
              Want to give a one-time gift instead?
            </p>
          </div>
        </div>
      </div>
    );
  }
  if (status?.directlyCovered) {
    // Parent already has direct Plus — don't show the sponsor CTA at all.
    return null;
  }

  const priceLabel = tier === "family" ? "$59" : "$29";
  const tierLabel = tier === "family" ? "Family" : "Plus";

  async function handleSubmit() {
    if (submitting) return;
    setSubmitting(true);
    setError(null);
    haptic("medium");
    try {
      const res = await fetch("/api/stripe/checkout/sponsor-plus", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          fundId,
          tier,
          sponsorEmail: email.trim(),
          sponsorName: name.trim(),
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        const friendly = typeof data?.message === "string" ? data.message
          : typeof data?.error === "string" ? data.error
          : "Couldn't start the checkout. Try again.";
        setError(friendly);
        haptic("error");
        setSubmitting(false);
        return;
      }
      if (data?.url) {
        window.location.assign(String(data.url));
        return;
      }
      setError("Checkout link missing. Try again.");
      setSubmitting(false);
    } catch {
      setError("Network hiccup. Try again in a moment.");
      haptic("error");
      setSubmitting(false);
    }
  }

  return (
    <div className={className}>
      <div className="rounded-2xl border border-[hsl(var(--kiddo-gold))]/30 bg-[hsl(var(--kiddo-gold))]/8 p-5">
        <div className="flex items-start gap-3">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-[hsl(var(--kiddo-gold))] text-white">
            <Sparkles size={16} strokeWidth={1.8} />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold text-foreground">
              Or give {safeChildName} a year of Kiddo Plus.
            </p>
            <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
              Sponsor a year of Plus for {safeChildName}'s fund. Unlocks recurring contributions for everyone on the fund, custom fund mix, photo and voice memos in the Memory Book, and co-parent access. One-time payment; we never charge you again.
            </p>
            <p className="mt-1.5 text-[11px] text-muted-foreground/85">
              <span className="font-semibold text-foreground">$29 for a year of Plus</span>
              <span className="text-muted-foreground/70"> · {safeChildName}'s family takes over the bill next year if they want to keep it going.</span>
            </p>
            {!open ? (
              <div className="mt-3">
                <Button
                  size="sm"
                  className="rounded-xl"
                  onClick={() => { haptic("selection"); setOpen(true); }}
                  data-testid="button-open-sponsor-plus"
                >
                  Sponsor a year for {safeChildName}
                  <ChevronRight className="ml-1 h-3 w-3" />
                </Button>
              </div>
            ) : (
              <div className="mt-3 space-y-3">
                <div>
                  <label className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Tier</label>
                  <div className="mt-1.5 flex gap-2">
                    {([
                      { value: "starter", label: "Plus · $29/yr" },
                      { value: "family", label: "Family · $59/yr" },
                    ] as const).map((opt) => (
                      <button
                        key={opt.value}
                        type="button"
                        onClick={() => { haptic("selection"); setTier(opt.value); }}
                        className={`flex-1 rounded-xl border px-3 py-2 text-xs font-semibold transition-colors ${
                          tier === opt.value
                            ? "border-primary bg-primary/5 text-primary"
                            : "border-border text-muted-foreground"
                        }`}
                        data-testid={`button-sponsor-tier-${opt.value}`}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>
                  {tier === "family" && (
                    <p className="mt-1.5 text-[10px] leading-relaxed text-muted-foreground/80">
                      Family covers unlimited kids. On a single-fund household this is functionally Plus; you're being generous.
                    </p>
                  )}
                </div>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Your name"
                  autoComplete="name"
                  className="w-full rounded-xl border border-border bg-background px-3 py-2 text-sm"
                  data-testid="input-sponsor-name"
                />
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="your@email.com"
                  autoComplete="email"
                  className="w-full rounded-xl border border-border bg-background px-3 py-2 text-sm"
                  data-testid="input-sponsor-email"
                />
                {error && (
                  <p className="text-xs text-destructive" data-testid="sponsor-plus-error">{error}</p>
                )}
                <Button
                  type="button"
                  size="sm"
                  className="w-full rounded-xl"
                  disabled={!email.trim() || !name.trim() || submitting}
                  onClick={() => void handleSubmit()}
                  data-testid="button-submit-sponsor-plus"
                >
                  {submitting ? "Opening checkout..." : `Give ${safeChildName} ${tierLabel} for ${priceLabel}`}
                </Button>
                <p className="text-[10px] text-muted-foreground/70 leading-snug">
                  <Lock className="inline-block w-2.5 h-2.5 mr-0.5 -mt-0.5" />
                  One-time payment via Stripe. Never auto-renews. {safeChildName}'s parents will be emailed that it was you. You can still send a one-time gift below.
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
