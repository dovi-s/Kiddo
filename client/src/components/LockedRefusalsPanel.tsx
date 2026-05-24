// Locked refusals panel — the "trust by saying no" surface.
//
// Lists what Kiddo deliberately doesn't do. In a category full of
// gamified consumer-fintech (streaks, badges, "$259 will value"
// bundle inflation, kid-data brokers), an explicit list of REFUSALS
// is itself the differentiator. Every line maps to a real product
// decision documented in MEMORY.md — not aspirational marketing copy.
//
// Surfaces:
//   /demo  → loaded above "How the demo works" (trust frame before
//            operating-rules frame). Lives there as the visitor's
//            first read of category positioning.
//   /      → home page (this component is what the marketing site
//            renders). Highest viral leverage per the wow-factor
//            analysis: most "Kiddo is what?" link-shares are to
//            the home page, and a refusals panel is the most
//            screenshotable artifact on the surface.
//
// Locked 2026-05-21. Edit copy here; both surfaces inherit.

import { ShieldCheck, X as XMark } from "lucide-react";

export type LockedRefusalsVariant = "demo" | "marketing";

interface LockedRefusalsPanelProps {
  /**
   * Visual treatment.
   * - "demo": tight, single-column intro frame (what /demo uses today).
   * - "marketing": larger headline + spacing for the home page.
   *   Same content, more breathing room.
   */
  variant?: LockedRefusalsVariant;
  className?: string;
}

const REFUSALS = [
  {
    refusal: "No platform fee on gifts.",
    why: "$50 from grandma is $50 to the fund. The gifter loop is the moat; we don't tax it.",
  },
  {
    refusal: "No paywall on the kid's view.",
    why: "Kid View is free across every plan. Mila on Free shouldn't see a worse version than Emma on Plus — the kid didn't choose the tier.",
  },
  {
    refusal: "No streaks, no badges, no confetti for putting money in.",
    why: "This is a 16-year compounding instrument. Gamifying it would turn it into something we don't want it to be.",
  },
  {
    refusal: "No subscription for the kid after handoff.",
    why: "When the kid takes legal ownership at majority, the parent paywall retires. The only post-handoff revenue is the annual fee on invested assets ($1/yr per $1,000 invested).",
  },
  {
    refusal: "No selling kid data, no targeted ads, no growth hacking the gift flow.",
    why: "Sold kid data would have ended this product before it started.",
  },
  {
    refusal: "No \"Always free\" claim that ignores the invested-assets fee.",
    why: "Acorns-style fine-print isn't the register we want. We say \"$0 per month\" and the $1-per-$1,000-invested annual fee is a feature, not a footnote.",
  },
];

export function LockedRefusalsPanel({
  variant = "demo",
  className = "",
}: LockedRefusalsPanelProps) {
  const isMarketing = variant === "marketing";
  return (
    <section
      className={`mx-auto rounded-2xl border border-[hsl(var(--kiddo-evergreen)/0.25)] bg-[hsl(var(--kiddo-evergreen)/0.04)] ${
        isMarketing ? "max-w-4xl p-8 sm:p-10" : "max-w-3xl p-6"
      } ${className}`.trim()}
      data-testid="locked-refusals-panel"
    >
      <div className="flex items-start gap-2">
        <ShieldCheck
          size={isMarketing ? 20 : 16}
          className="mt-0.5 shrink-0 text-[hsl(var(--kiddo-evergreen))]"
        />
        <p
          className={`font-semibold text-foreground ${
            isMarketing ? "font-heading text-xl sm:text-2xl" : ""
          }`}
        >
          What Kiddo refuses to do
        </p>
      </div>
      <p
        className={`mt-2 leading-relaxed text-muted-foreground ${
          isMarketing ? "text-base" : "text-sm"
        }`}
      >
        The category is full of gamified investing apps with hidden incentives. We're not building one. These are deliberate.
      </p>
      <ul
        className={`mt-4 space-y-2.5 leading-relaxed text-foreground/85 ${
          isMarketing ? "text-base sm:space-y-3" : "text-sm"
        }`}
      >
        {REFUSALS.map((row, i) => (
          <li key={i} className="flex items-start gap-2.5">
            <XMark
              size={isMarketing ? 16 : 14}
              className="mt-0.5 shrink-0 text-[hsl(var(--kiddo-evergreen))]"
            />
            <span>
              <span className="font-semibold text-foreground">{row.refusal}</span>{" "}
              <span className="text-muted-foreground">{row.why}</span>
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}
