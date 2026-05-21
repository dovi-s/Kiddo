import { Sprout } from "lucide-react";
import { MONEY_CROSS_COPY, formatMilestone } from "@shared/milestones";

// Polished, screenshot-optimized share card. Designed at a 4:5 portrait
// aspect ratio (1080x1350 if rendered to image — Instagram story / phone
// vertical screenshot friendly). The in-app MilestoneMoment celebration
// is small and dismissable; this is the larger, full-fidelity rendering
// the parent intentionally lands on when they want to share the moment.
//
// No animations. Static composition. Optimized for "screenshot looks
// right on first try" — a moving card screenshots inconsistently.
//
// Phase 2: rasterize this component to PNG via html-to-image and share
// as a File via Web Share API. Today the integration point is "render
// this in a modal, parent screenshots manually." The visual is the same
// either way; the rasterizer just removes one tap.

export interface MilestoneShareCardProps {
  threshold: number;
  recipientName?: string | null;
}

export function MilestoneShareCard({ threshold, recipientName }: MilestoneShareCardProps) {
  const copy = MONEY_CROSS_COPY[threshold];
  const childName = (recipientName && recipientName.trim()) || "this fund";
  const emotionalLine = copy?.emotionalLine || "";
  const fullAmount = formatMilestone(threshold);

  return (
    <div
      className="relative mx-auto flex aspect-[4/5] w-full max-w-md flex-col justify-between overflow-hidden rounded-3xl p-7 text-foreground shadow-premium"
      style={{
        background:
          "linear-gradient(155deg, hsl(var(--kiddo-gold) / 0.18) 0%, hsl(var(--kiddo-gold) / 0.06) 38%, hsl(var(--kiddo-cream) / 1) 78%)",
        border: "1px solid hsl(var(--kiddo-gold) / 0.28)",
      }}
      data-testid="milestone-share-card"
    >
      {/* Header — Sparkles icon dropped 2026-05-21 per the codebase
          no-Sparkles rule (banned alongside generic celebratory
          iconography). Brand sprout already lives in the footer; the
          eyebrow alone carries the milestone label without doubling
          the visual celebration. */}
      <div className="flex items-start justify-between">
        <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[hsl(var(--kiddo-gold-ink))]">
          Milestone
        </p>
      </div>

      {/* Body retoned 2026-05-21 — formatMilestone now returns full
          $5,000 not $5K, so the previous compactAmount/fullAmount
          double-statement was reading as "$5K / Alex's fund just
          crossed $5,000." (the same number twice). Now: child name
          intro, hero number, emotional anchor. Three lines, each
          carrying distinct info. */}
      <div className="space-y-2">
        <p className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          {childName}'s fund crossed
        </p>
        <p className="font-heading text-7xl font-bold leading-none tabular-nums text-foreground sm:text-8xl">
          {fullAmount}
        </p>
        {emotionalLine && (
          <p className="text-sm leading-relaxed text-muted-foreground">{emotionalLine}</p>
        )}
      </div>

      {/* Footer — "Gifts that actually last" tagline dropped
          2026-05-21. Marketing-page copy on a product surface, same
          register the codebase audited out elsewhere (the home-page
          tagline lives on the home page; not on a per-event card a
          parent shares to family). Sprout + "Powered by Kiddo" is
          enough attribution. */}
      <div className="space-y-2 pt-2">
        <div className="h-px w-full bg-[hsl(var(--kiddo-gold)/0.30)]" />
        <div className="flex items-center gap-1.5">
          <Sprout size={14} className="text-[hsl(var(--kiddo-evergreen))]" />
          <p className="text-xs font-semibold text-foreground">
            Powered by Kiddo
          </p>
        </div>
      </div>
    </div>
  );
}
