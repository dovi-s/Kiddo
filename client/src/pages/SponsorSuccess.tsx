// Sponsor-Plus success page — landing destination after Stripe Checkout
// completes for a gifter-sponsored year of Plus / Family.
//
// Per project_gifter_sponsors_plus_subscription.md (locked 2026-05-23).
// Stripe redirects here with ?fundId=X&tier=starter|family. The webhook
// handler (handleSponsorPlusPurchase) has done the database work; this
// page is the gifter-facing confirmation.

import { useEffect, useMemo, useState } from "react";
import { Link } from "wouter";
import { Check, Sparkles } from "lucide-react";
import { Nav } from "@/components/layout/Nav";
import { Footer } from "@/components/layout/Footer";
import { Button } from "@/components/ui/button";
import { GeminiHeroGradient } from "@/components/ui/gemini";

type FundPreview = {
  fund?: { recipientFirstName?: string | null; name?: string | null; slug?: string | null };
};

export default function SponsorSuccess() {
  const search = useMemo(() => new URLSearchParams(window.location.search), []);
  const fundId = search.get("fundId") || "";
  const tier = (search.get("tier") || "starter").toLowerCase() === "family" ? "family" : "starter";
  const isDemo = search.get("demo") === "1";

  const [fund, setFund] = useState<FundPreview["fund"]>(undefined);
  useEffect(() => {
    if (!fundId) return;
    // Best-effort fund name lookup so the success state can name the
    // kid. If the lookup fails the page still renders, just with
    // "the family" instead of "Emma's family."
    (async () => {
      try {
        const res = await fetch(`/api/public/funds/${encodeURIComponent(fundId)}`);
        if (res.ok) {
          const data: FundPreview = await res.json();
          setFund(data.fund || undefined);
        }
      } catch {
        // best-effort
      }
    })();
  }, [fundId]);

  const childName = (fund?.recipientFirstName || (fund?.name || "").replace(/\s*'s\s+Fund\s*$/i, "") || "the kid").trim();
  const tierLabel = tier === "family" ? "Family" : "Plus";
  const priceLabel = tier === "family" ? "$59" : "$29";
  const fundSlugLink = fund?.slug ? `/${fund.slug}` : "/";

  return (
    <div className="min-h-screen bg-background">
      <Nav />
      <section className="relative overflow-hidden pb-16 pt-20 md:pb-24 md:pt-32 gemini-warm-section">
        <GeminiHeroGradient />
        <div className="relative z-10 mx-auto max-w-2xl px-4 text-center">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-primary text-primary-foreground">
            <Check size={32} strokeWidth={2.5} />
          </div>
          <h1
            className="mt-6 font-heading text-4xl font-bold leading-tight text-foreground md:text-5xl"
            data-testid="text-sponsor-success-headline"
          >
            You just gave {childName} a year of Kiddo {tierLabel}.
          </h1>
          <p className="mx-auto mt-5 max-w-xl text-base leading-relaxed text-muted-foreground md:text-lg">
            {isDemo
              ? `Demo mode — no card was charged. In production this is where ${childName}'s family would see Kiddo ${tierLabel} active on their fund.`
              : `${childName}'s family was just emailed that it was you. Kiddo ${tierLabel} is now active on their fund for the next 12 months — unlocking recurring contributions for everyone, custom fund mix, photo and voice memos in the Memory Book, and co-parent access.`}
          </p>
          <div className="mx-auto mt-8 inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/5 px-4 py-2 text-sm font-medium text-foreground">
            <Sparkles size={14} className="text-primary" />
            <span>{priceLabel} · one-time · never auto-renews</span>
          </div>

          <div className="mt-10 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <Link href={fundSlugLink}>
              <Button size="lg" className="rounded-2xl">
                Back to {childName}'s fund
              </Button>
            </Link>
            <Link href="/get-started" className="text-sm font-medium text-muted-foreground underline-offset-4 hover:text-foreground hover:underline">
              Or start a fund for your own kid →
            </Link>
          </div>

          <p className="mt-10 text-xs leading-relaxed text-muted-foreground/80 max-w-md mx-auto">
            We sent you a receipt by email. Keep it for your records. {childName}'s family takes over the bill if they want to keep Plus going past the year — your card won't be charged again.
          </p>
        </div>
      </section>
      <Footer />
    </div>
  );
}
