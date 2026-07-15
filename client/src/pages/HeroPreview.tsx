import { useState } from "react";
import { HeroMoment } from "@/components/HeroMoment";

/**
 * TEMPORARY preview route (/hero-preview, public) for judging the full-bleed
 * evergreen hero (header on green, simplified to calm confidence) as the real
 * <HeroMoment> component, with the cream content lifting over it. Not linked
 * anywhere; delete once the treatment is approved + integrated.
 */
const ROWS = [
  { t: "Growth this year", s: "Real prices, simulated holdings", v: "+$3,140", up: true },
  { t: "Recurring", s: "$100/month · Managed mix", v: "Active" },
  { t: "Last gift", s: "Grandma · 2 days ago", v: "$250" },
];

export default function HeroPreview() {
  // Drive the gift-lands "moment" deterministically (no auth / demo-gift flow
  // needed) so the arc + balance breath can be judged and screenshot-verified.
  const [gift, setGift] = useState<{ amount: string; from?: string } | null>(null);
  return (
    <div className="min-h-screen bg-[hsl(var(--background))]">
      {/* No horizontal padding here — the hero is a clean full-width block
          (no negative-margin breakout), so it bleeds to both edges with no
          stray slivers. The content card below carries its own inner padding. */}
      <div className="mx-auto max-w-[440px] md:max-w-[760px]">
        <div>
          <HeroMoment
            header={
              <div className="flex items-center justify-between pt-2">
                <span className="font-heading text-[19px] font-extrabold tracking-[-0.02em] text-[hsl(var(--kiddo-cream))]">
                  Kiddo
                </span>
                <span className="flex h-[30px] w-[30px] items-center justify-center rounded-full bg-[hsl(var(--kiddo-cream)/0.14)] text-[12px] font-bold text-[hsl(var(--kiddo-cream))]">
                  E
                </span>
              </div>
            }
            fundLabel="Theo's Fund"
            futureLabel="Theo's future"
            balance={<>$23,577<span className="text-[0.46em] font-semibold opacity-55">.27</span></>}
            giftsCount={134}
            peopleCount={12}
            projectionLabel="~$51k by 21"
            shareLabel="Share Theo's link"
            giftMoment={gift}
            onGiftMomentEnd={() => setGift(null)}
          />

          {/* Content lifts over the hero's bottom edge — the "moment". */}
          <div className="relative -mt-7 rounded-t-[24px] bg-[hsl(var(--background))] px-5 pb-10 pt-6">
            <button
              type="button"
              data-testid="hero-preview-play-gift"
              onClick={() => setGift({ amount: "+$50", from: "Grandma" })}
              className="mb-5 inline-flex items-center gap-2 rounded-full bg-[hsl(var(--kiddo-gold))] px-4 py-2 text-[13px] font-bold text-[#2a1c06]"
            >
              ▶ Play gift moment
            </button>
            <p className="mb-1 text-[13px] font-semibold text-[hsl(var(--kiddo-ink)/0.55)]">
              Theo's fund so far
            </p>
            {ROWS.map((r) => (
              <div key={r.t} className="flex items-baseline justify-between border-b border-[hsl(var(--kiddo-border))] py-3.5 last:border-b-0">
                <div>
                  <div className="text-[14.5px] font-semibold text-[hsl(var(--kiddo-ink))]">{r.t}</div>
                  <div className="mt-0.5 text-[12px] text-[hsl(var(--kiddo-ink)/0.5)]">{r.s}</div>
                </div>
                <div className={`text-[14.5px] font-bold tabular-nums ${r.up ? "text-[#1f5a3b]" : "text-[hsl(var(--kiddo-ink))]"}`}>
                  {r.v}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
