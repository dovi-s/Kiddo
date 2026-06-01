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
    why: "$50 from grandma is $50 to the fund. We never take a cut of a gift.",
  },
  {
    refusal: "No paywall on the kid's view.",
    why: "Kid View is free on every plan. A child on a free fund should never get a lesser experience than one on a paid plan. The kid didn't choose the tier.",
  },
  {
    refusal: "No streaks, no badges, no confetti for putting money in.",
    why: "This money is meant to grow for years, until your child is an adult. Turning it into a game would cheapen what it's for.",
  },
  {
    refusal: "No subscription for the kid after handoff.",
    why: "When your child takes ownership as an adult, the parent subscription ends. After that, the only fee is the annual $1 per $1,000 invested.",
  },
  {
    refusal: "No selling kids' data, no targeted ads, no dark patterns in the gift flow.",
    why: "A child's data is never the product. We don't sell it, and we never will.",
  },
  {
    refusal: "No \"Always free\" claim that hides the invested-assets fee.",
    why: "We won't bury a fee in fine print. We say \"$0 per month,\" and the annual $1 per $1,000 invested is stated plainly, never a footnote.",
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
