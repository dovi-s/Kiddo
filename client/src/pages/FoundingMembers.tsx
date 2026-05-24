// Founding Members capture page (pricing-v3, locked 2026-05-23).
// Per project_pricing_v3_pricing_levels.md + project_pre_launch_strategic_frame.md:
// pre-launch advocacy program for the first 1,000 signups. $19/yr Plus
// lifetime price lock + Founding Member badge + early access to all
// future Kiddo products (Roth IRA, banking, printing, P2P) + $25
// starter gift credit + founder-only product-input loop.
//
// Structured for ADVOCACY, not bargain-hunting. The deal framing is
// "$19/yr forever + you help shape the product" — the founders self-
// select into the "I want to help shape this product" identity. The
// price is the trade for advocacy commitment, not the trade for cold
// discount-seeking. Per the Target-not-Walmart positioning + the
// Glossier / Allbirds / Stripe pre-launch founder-myth playbook.
//
// Cap is hard at 1,000 — server enforces via line-count in
// .local/founding-members.jsonl. Past the cap, the deal converts to
// the regular Plus $3.99/mo for new signups.

import { useEffect, useState, useCallback } from "react";
import { Link } from "wouter";
import { motion } from "framer-motion";
import { ArrowRight, Check, Sparkles, Lock, Users, Gift } from "lucide-react";
import { Nav } from "@/components/layout/Nav";
import { Footer } from "@/components/layout/Footer";
import { Button } from "@/components/ui/button";
import { GeminiHeroGradient } from "@/components/ui/gemini";
import { haptic } from "@/lib/haptics";

type CountState = {
  count: number;
  cap: number;
  spotsRemaining: number;
};

type SubmissionResult = {
  position: number;
  spotsRemaining: number;
};

export default function FoundingMembers() {
  const [email, setEmail] = useState("");
  const [firstName, setFirstName] = useState("");
  const [message, setMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState<SubmissionResult | null>(null);
  const [countState, setCountState] = useState<CountState | null>(null);

  // Fetch the current count on mount so the cap counter renders with
  // a real number. The fetch failure is non-blocking — without the
  // count, the page still works as a capture form; only the "X spots
  // remaining" line is suppressed.
  const refreshCount = useCallback(async () => {
    try {
      const res = await fetch("/api/waitlist/founding-members/count", {
        credentials: "include",
      });
      if (!res.ok) return;
      const data = await res.json();
      setCountState({
        count: Number(data?.count || 0),
        cap: Number(data?.cap || 1000),
        spotsRemaining: Number(data?.spotsRemaining || 0),
      });
    } catch {
      // best-effort
    }
  }, []);

  useEffect(() => {
    void refreshCount();
  }, [refreshCount]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (submitting) return;
    setSubmitting(true);
    setSubmitError(null);

    try {
      const res = await fetch("/api/waitlist/founding-members", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          email: email.trim(),
          firstName: firstName.trim(),
          message: message.trim(),
          sourceSurface: "founding-members-page",
        }),
      });
      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        setSubmitError(typeof data?.error === "string" ? data.error : "Couldn't save your spot. Try again.");
        haptic("error");
        // Refresh count in case the cap was hit since page load
        void refreshCount();
        return;
      }

      setSubmitted({
        position: Number(data?.position || 0),
        spotsRemaining: Number(data?.spotsRemaining || 0),
      });
      haptic("success");
    } catch (err) {
      setSubmitError("Network hiccup. Try again in a moment.");
      haptic("error");
    } finally {
      setSubmitting(false);
    }
  };

  const capFilled = countState ? countState.spotsRemaining <= 0 : false;
  const showCount = countState !== null && !capFilled;

  return (
    <div className="min-h-screen bg-background">
      <Nav />

      <section className="relative overflow-hidden pb-16 pt-20 md:pb-24 md:pt-32 gemini-warm-section">
        <GeminiHeroGradient />
        <div className="relative z-10 mx-auto max-w-3xl px-4 text-center">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
          >
            <p className="mb-4 text-sm font-semibold uppercase tracking-[0.18em] text-[hsl(var(--kiddo-evergreen))]">
              Founding Members · Pre-launch · Cap 1,000
            </p>
            <h1
              className="mb-5 font-heading text-4xl font-bold leading-tight text-foreground md:text-6xl"
              data-testid="text-founding-headline"
            >
              Help build the platform your kid opens at 18.
            </h1>
            <p className="mx-auto max-w-2xl text-lg leading-relaxed text-muted-foreground md:text-xl">
              The first 1,000 families shape what Kiddo becomes. In exchange: lifetime $19/year Plus price lock, a Founding Member badge, early access to every future product, and a $25 starter gift credit when your fund goes live.
            </p>
            {showCount && (
              <p
                className="mx-auto mt-6 inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/5 px-4 py-2 text-sm font-medium text-foreground"
                data-testid="text-founding-spots-remaining"
              >
                <Sparkles size={14} className="text-primary" />
                <span>
                  <span className="tabular-nums font-semibold">{countState!.spotsRemaining.toLocaleString()}</span> of {countState!.cap.toLocaleString()} spots remaining
                </span>
              </p>
            )}
            {capFilled && (
              <p className="mx-auto mt-6 inline-flex items-center gap-2 rounded-full border border-border bg-muted/40 px-4 py-2 text-sm font-medium text-muted-foreground">
                <Lock size={14} />
                All founding member spots are taken. Regular Plus is $3.99/mo at launch.
              </p>
            )}
          </motion.div>
        </div>
      </section>

      <section className="px-4 pb-20">
        <div className="mx-auto grid max-w-5xl gap-10 md:grid-cols-2">
          {/* Left column: the deal — what founders get and what we ask back */}
          <div className="space-y-6">
            <div className="rounded-3xl border border-border bg-card p-6 shadow-premium-sm">
              <p className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">What you get</p>
              <ul className="mt-4 space-y-3 text-sm leading-relaxed text-foreground">
                <li className="flex items-start gap-3">
                  <Check size={16} className="mt-1 shrink-0 text-primary" />
                  <span>
                    <span className="font-semibold">$19/year Plus, lifetime.</span> Regular Plus is $29/yr at launch. Your rate never changes, even as we add features or raise prices for new signups.
                  </span>
                </li>
                <li className="flex items-start gap-3">
                  <Check size={16} className="mt-1 shrink-0 text-primary" />
                  <span>
                    <span className="font-semibold">$25 starter gift credit.</span> When your fund goes live, $25 lands in it from Kiddo to seed the first gift moment.
                  </span>
                </li>
                <li className="flex items-start gap-3">
                  <Check size={16} className="mt-1 shrink-0 text-primary" />
                  <span>
                    <span className="font-semibold">Founding Member badge.</span> Visible on your profile and on every gift link you share. A signal you were here first.
                  </span>
                </li>
                <li className="flex items-start gap-3">
                  <Check size={16} className="mt-1 shrink-0 text-primary" />
                  <span>
                    <span className="font-semibold">Early access to every future Kiddo product.</span> Roth IRA at 18, banking, Memory Book printing, peer-to-peer stock payments. You see it first.
                  </span>
                </li>
                <li className="flex items-start gap-3">
                  <Check size={16} className="mt-1 shrink-0 text-primary" />
                  <span>
                    <span className="font-semibold">Founder community channel.</span> Direct line to the team for product input, beta invites, and a quarterly founder-only survey we actually read.
                  </span>
                </li>
              </ul>
            </div>

            <div className="rounded-3xl border border-border bg-muted/30 p-6">
              <p className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">What we ask back</p>
              <ul className="mt-4 space-y-3 text-sm leading-relaxed text-foreground">
                <li className="flex items-start gap-3">
                  <Users size={16} className="mt-1 shrink-0 text-primary" />
                  <span>
                    Tell people about Kiddo when it makes sense. The product is built on the gift loop. Founders are the seed.
                  </span>
                </li>
                <li className="flex items-start gap-3">
                  <Gift size={16} className="mt-1 shrink-0 text-primary" />
                  <span>
                    Share what's missing. The quarterly survey is short; your replies shape the next quarter.
                  </span>
                </li>
                <li className="flex items-start gap-3">
                  <Sparkles size={16} className="mt-1 shrink-0 text-primary" />
                  <span>
                    Try the beta features when we send them. We won't ship things to you we wouldn't ship to our own kids' funds.
                  </span>
                </li>
              </ul>
              <p className="mt-4 text-xs leading-relaxed text-muted-foreground">
                The deal is structured as advocacy, not discount. If you want a cheap subscription, the regular Plus at $3.99/mo is the right choice. If you want to help shape what Kiddo becomes for every kid that comes after, this is the deal.
              </p>
            </div>
          </div>

          {/* Right column: the capture form / success state */}
          <div>
            {submitted ? (
              <div
                className="rounded-3xl border border-primary/30 bg-primary/5 p-8 text-center"
                data-testid="founding-success-state"
              >
                <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-primary text-primary-foreground">
                  <Check size={32} strokeWidth={2.5} />
                </div>
                <h2 className="mt-5 font-heading text-2xl font-semibold text-foreground">
                  You're in, Founder.
                </h2>
                <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
                  You're founding member #{submitted.position.toLocaleString()} of {countState?.cap.toLocaleString() || "1,000"}. We'll email you when launch is close with the founder-only signup link that locks in your $19/year price.
                </p>
                {submitted.spotsRemaining > 0 && submitted.spotsRemaining <= 100 && (
                  <p className="mt-4 text-xs text-muted-foreground">
                    Only {submitted.spotsRemaining} spots left after you. Forward this link to anyone who'd want one.
                  </p>
                )}
                <Link href="/">
                  <Button variant="outline" className="mt-6 rounded-2xl" data-testid="button-founding-back-home">
                    Back to home
                  </Button>
                </Link>
              </div>
            ) : (
              <form
                onSubmit={handleSubmit}
                className="rounded-3xl border border-border bg-card p-6 shadow-premium-sm space-y-4"
                data-testid="founding-capture-form"
              >
                <p className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">Reserve your spot</p>
                <h2 className="font-heading text-2xl font-semibold text-foreground">
                  Founding Member access
                </h2>
                <div className="space-y-1">
                  <label htmlFor="founding-firstname" className="text-xs font-medium text-foreground">
                    First name
                  </label>
                  <input
                    id="founding-firstname"
                    type="text"
                    autoComplete="given-name"
                    required
                    value={firstName}
                    onChange={(e) => setFirstName(e.target.value)}
                    className="h-11 w-full rounded-xl border border-border bg-background px-4 text-sm outline-none focus:border-primary"
                    placeholder="Lauren"
                    data-testid="input-founding-firstname"
                    disabled={capFilled}
                  />
                </div>
                <div className="space-y-1">
                  <label htmlFor="founding-email" className="text-xs font-medium text-foreground">
                    Email
                  </label>
                  <input
                    id="founding-email"
                    type="email"
                    autoComplete="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="h-11 w-full rounded-xl border border-border bg-background px-4 text-sm outline-none focus:border-primary"
                    placeholder="lauren@example.com"
                    data-testid="input-founding-email"
                    disabled={capFilled}
                  />
                </div>
                <div className="space-y-1">
                  <label htmlFor="founding-message" className="text-xs font-medium text-foreground">
                    Anything you want us to know? (optional)
                  </label>
                  <textarea
                    id="founding-message"
                    rows={3}
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    className="w-full rounded-xl border border-border bg-background px-4 py-3 text-sm outline-none focus:border-primary resize-none"
                    placeholder="Whose kid are you building this for? What's missing in everything else you've tried?"
                    data-testid="input-founding-message"
                    disabled={capFilled}
                  />
                </div>
                {submitError && (
                  <p className="text-xs text-destructive" data-testid="founding-error">
                    {submitError}
                  </p>
                )}
                <Button
                  type="submit"
                  className="h-12 w-full rounded-xl text-base btn-premium"
                  disabled={submitting || capFilled}
                  data-testid="button-founding-submit"
                  onClick={() => haptic("medium")}
                >
                  {capFilled ? "All spots taken" : submitting ? "Reserving..." : "Reserve my Founder spot"}
                  {!submitting && !capFilled && <ArrowRight className="ml-2 h-4 w-4" />}
                </Button>
                <p className="text-[11px] leading-relaxed text-muted-foreground">
                  We'll only email you about launch, founder-exclusive previews, and the quarterly survey. No marketing list, no third parties. Unsubscribe at any time.
                </p>
              </form>
            )}
          </div>
        </div>
      </section>

      <Footer />
    </div>
  );
}
