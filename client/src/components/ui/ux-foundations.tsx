import { Button } from "@/components/ui/button";
import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
// Lightbulb replaces Sparkles 2026-05-12 for the SetupProgressNudge "Next
// step" prompt — Sparkles banned per feedback_no_ai_slop.md. Lightbulb is
// the locked canonical icon for the "gentle nudge" pattern per
// feedback_gentle_nudge_pattern.md, which is exactly what the setup-progress
// surface is.
import { CheckCircle2, ChevronDown, Circle, Lightbulb, Shield } from "lucide-react";

type SetupProgressNudgeProps = {
  title: string;
  subtitle: string;
  percent: number;
  ctaLabel?: string;
  onCta?: () => void;
  items?: Array<string | { label: string; done?: boolean }>;
  ctaTestId?: string;
  collapsible?: boolean;
  defaultExpanded?: boolean;
};

export function SetupProgressNudge({
  title,
  subtitle,
  percent,
  ctaLabel,
  onCta,
  items = [],
  ctaTestId,
  collapsible = false,
  defaultExpanded = true,
}: SetupProgressNudgeProps) {
  const normalized = Math.max(0, Math.min(100, Math.round(percent)));
  const [expanded, setExpanded] = useState(defaultExpanded);
  const isExpanded = collapsible ? expanded : true;
  const normalizedItems = items.map((item) =>
    typeof item === "string" ? { label: item, done: true } : { label: item.label, done: Boolean(item.done) },
  );
  const nextItem = normalizedItems.find((item) => !item.done);
  const completedCount = normalizedItems.filter((i) => i.done).length;
  const totalCount = normalizedItems.length;
  const showCount = totalCount > 0 && completedCount < totalCount;
  const subtitleWithCount = showCount
    ? `${completedCount} of ${totalCount} complete · ${subtitle}`
    : subtitle;

  return (
    <section
      className="kiddo-card overflow-hidden"
      data-testid="card-setup-progress-nudge"
    >
      <button
        type="button"
        className={`flex w-full items-start justify-between gap-3 p-5 text-left ${collapsible ? "cursor-pointer" : "cursor-default"}`}
        onClick={() => collapsible && setExpanded((value) => !value)}
        aria-expanded={isExpanded}
        data-testid="button-toggle-setup-progress"
      >
        <div className="flex min-w-0 gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[hsl(var(--kiddo-evergreen)/0.10)]">
            <Lightbulb size={16} className="text-[hsl(var(--kiddo-gold))]" />
          </div>
          <div className="min-w-0">
            <p className="kiddo-section-label">Next step</p>
            <h2 className="mt-1 text-[15px] font-bold leading-snug text-foreground">{title}</h2>
            {isExpanded ? (
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{subtitleWithCount}</p>
            ) : (
              <p className="mt-1 truncate text-sm text-muted-foreground">
                {nextItem ? nextItem.label : subtitle}
              </p>
            )}
          </div>
        </div>
        {collapsible && (
          <ChevronDown
            size={17}
            className={`mt-1 shrink-0 text-muted-foreground transition-transform ${isExpanded ? "rotate-180" : ""}`}
          />
        )}
      </button>

      <div className="mx-5 h-[3px] rounded-full bg-[hsl(var(--kiddo-cream-dark))]" aria-hidden>
        <div
          className="h-full rounded-full bg-[hsl(var(--kiddo-evergreen))] transition-all"
          style={{ width: `${normalized}%` }}
        />
      </div>

      <AnimatePresence initial={false}>
        {isExpanded && (
          <motion.div
            key="setup-progress-expanded"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
            className="overflow-hidden"
          >
            {normalizedItems.length > 0 && (
              <ul className="space-y-2 p-5 pt-4">
                {normalizedItems.map((item, index) => (
                  <li key={`${item.label}-${index}`} className="flex items-center gap-2 text-sm text-foreground/90">
                    {item.done ? (
                      <CheckCircle2 size={15} className="shrink-0 text-[hsl(var(--kiddo-evergreen))]" />
                    ) : (
                      <Circle size={15} className="shrink-0 text-[hsl(var(--kiddo-gold))]" />
                    )}
                    <span className={`min-w-0 flex-1 ${item.done ? "text-muted-foreground" : "font-semibold text-foreground"}`}>{item.label}</span>
                    {!item.done && (
                      <span className="shrink-0 rounded-full border border-[hsl(var(--kiddo-gold)/0.35)] bg-[hsl(var(--kiddo-gold)/0.12)] px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.08em] text-[hsl(var(--kiddo-evergreen))]">
                        Action needed
                      </span>
                    )}
                  </li>
                ))}
              </ul>
            )}

            {ctaLabel && onCta && (
              <Button onClick={onCta} className="mx-5 mb-5 w-[calc(100%-2.5rem)] rounded-xl sm:w-auto" data-testid={ctaTestId}>
                {ctaLabel}
              </Button>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </section>
  );
}

export function TrustMicroStrip() {
  // Single source for the three claims so the mobile (stacked) and desktop
  // (one inline row) layouts can't drift. Wording is locked custody-honesty /
  // brand copy: kept verbatim in BOTH layouts, never trimmed to fit.
  const sipc = "SIPC up to $500,000";
  const brokerDealer = "Our broker-dealer partner · Member FINRA/SIPC";
  const noFees = "No hidden charges. Ever.";
  return (
    <section
      className="kiddo-card px-4 py-3"
      data-testid="card-trust-micro-strip"
    >
      {/* Desktop (>=640px): the original single inline row with dot separators. */}
      <div className="hidden flex-wrap items-center justify-center gap-3 text-center text-xs text-muted-foreground sm:flex">
        <span className="inline-flex items-center gap-1.5">
          <Shield size={13} className="text-[hsl(var(--kiddo-evergreen))]" />
          {sipc}
        </span>
        <span className="h-1 w-1 rounded-full bg-muted-foreground/40" />
        <span>{brokerDealer}</span>
        <span className="h-1 w-1 rounded-full bg-muted-foreground/40" />
        <span>{noFees}</span>
      </div>

      {/* Mobile (<640px): the inline row used to wrap into THREE ragged lines
          with orphan dots floating at row edges. Now two deliberate centered
          rows and NO dots to orphan: the two short reassurances share the top
          row (and degrade to two clean centered lines on a 320px SE without
          ever breaking), and the long broker-dealer line gets its own row.
          All copy kept verbatim; only the layout changed. */}
      <div className="flex flex-col items-center gap-1 text-center text-[11px] leading-snug text-muted-foreground sm:hidden">
        <div className="flex flex-wrap items-center justify-center gap-x-3 gap-y-0.5">
          <span className="inline-flex items-center gap-1.5">
            <Shield size={12} className="text-[hsl(var(--kiddo-evergreen))]" />
            {sipc}
          </span>
          <span>{noFees}</span>
        </div>
        <span>{brokerDealer}</span>
      </div>

      <p className="mt-2 text-center text-[10px] leading-relaxed text-muted-foreground/55">
        Kiddo's only ongoing investment fee is $1/year per $1,000 invested, charged on invested assets only; on a paid plan your subscription covers it, so you never pay both. When investing is live, eligible securities are then protected up to $500,000 against broker-dealer failure. Not a protection against market losses.{" "}
        <a href="https://www.sipc.org" target="_blank" rel="noopener noreferrer" className="underline underline-offset-2 hover:text-muted-foreground">sipc.org</a>
        {" · "}Investing involves risk. But so does a gift card.
      </p>
    </section>
  );
}
