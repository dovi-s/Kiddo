// Shared "needs your attention" card. Used on the Activity page
// (sticky section at top) and on the Dashboard (alongside the
// setup-progress nudge). Each card represents one open todo derived
// server-side from current user + fund state.
//
// Visual register:
//   - Blocking severity → gold halo + filled gold CTA (Robinhood
//     primary-action treatment). Reads as "you can't move forward
//     without this."
//   - Advisory severity → calm border + outlined CTA. Reads as
//     "we'd like you to do this but it's not gating anything."
//
// Two affordances:
//   - Primary: "Fix [thing]" → routes to the right surface
//   - Secondary: "Remind tomorrow" → POSTs snooze, card disappears
//     locally, server re-surfaces it after 24h
//
// Snooze excluded for blocking-decision items (large_gift_hold) —
// see NON_SNOOZABLE_TYPES in shared/action-items.ts.

import { useState, useCallback } from "react";
import { useLocation } from "wouter";
import { ArrowRight, Clock } from "lucide-react";
import type { ActionItem } from "@shared/action-items";
import { useActionItems } from "@/hooks/use-action-items";
import { haptic } from "@/lib/haptics";
import { toast } from "@/hooks/use-toast";
import { toastDemoBlocked } from "@/lib/demo-block";

type Props = {
  item: ActionItem;
  // Compact variant for spaces with less horizontal room (e.g. the
  // Dashboard "needs attention" cluster which already shares
  // vertical real estate with the setup-progress card).
  compact?: boolean;
};

export function ActionItemCard({ item, compact = false }: Props) {
  const [, setLocation] = useLocation();
  const { snooze } = useActionItems();
  const [snoozing, setSnoozing] = useState(false);

  const handleFix = useCallback(() => {
    haptic("selection");
    setLocation(item.ctaPath);
  }, [item.ctaPath, setLocation]);

  const handleSnooze = useCallback(async () => {
    if (!item.canSnooze || snoozing) return;
    setSnoozing(true);
    try {
      haptic("selection");
      await snooze(item.fundId, item.type, 24);
      toast({
        title: "Reminder set for tomorrow",
        description: `We'll bring "${item.title}" back in 24 hours.`,
      });
    } catch (err) {
      if (toastDemoBlocked(err, toast)) return;
      toast({
        title: "Couldn't snooze",
        description: (err as any)?.message || "Try again.",
      });
    } finally {
      setSnoozing(false);
    }
  }, [item, snooze, snoozing]);

  const isBlocking = item.severity === "blocking";

  return (
    <div
      className={`relative rounded-2xl border ${
        isBlocking
          ? "border-[hsl(var(--kora-gold)/0.30)] bg-[hsl(var(--kora-gold)/0.04)]"
          : "border-[hsl(var(--kiddo-border))] bg-card"
      } ${compact ? "p-3" : "p-4"}`}
      data-testid={`action-item-${item.type}`}
    >
      {/* Severity dot — small gold pip in the corner of blocking
          cards, omitted entirely from advisory cards. Reads as a
          status indicator, not a love-mark. */}
      {isBlocking && (
        <span
          aria-hidden
          className="absolute top-3 right-3 h-1.5 w-1.5 rounded-full"
          style={{ background: "hsl(var(--kora-gold))" }}
        />
      )}

      <div className="flex items-start gap-3">
        <div
          className={`shrink-0 h-9 w-9 rounded-full flex items-center justify-center ${
            isBlocking
              ? "bg-[hsl(var(--kora-gold)/0.10)] text-[hsl(var(--kora-gold))]"
              : "bg-[hsl(var(--kiddo-evergreen)/0.08)] text-[hsl(var(--kiddo-evergreen))]"
          }`}
        >
          {/* Inline icon — sized to match the avatar circles on the
              Funds Overview cards so cards in the same column feel
              like one family. */}
          <CategoryIcon category={item.category} />
        </div>

        <div className="min-w-0 flex-1">
          <p className={`font-heading font-semibold text-foreground ${compact ? "text-sm" : "text-[15px]"}`}>
            {item.title}
          </p>
          <p className={`mt-1 text-muted-foreground leading-snug ${compact ? "text-[12px]" : "text-[13px]"}`}>
            {item.description}
          </p>
          <p className="mt-1.5 text-[11px] text-muted-foreground/80">
            {item.fundLabel}
          </p>

          <div className="mt-3 flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={handleFix}
              className={`inline-flex items-center gap-1.5 rounded-full font-semibold transition-all active:scale-[0.98] ${
                isBlocking
                  ? "bg-[hsl(var(--kora-gold))] text-white"
                  : "bg-foreground text-background"
              } ${compact ? "px-3 py-1.5 text-[12px]" : "px-4 py-2 text-[13px]"}`}
              data-testid={`action-item-fix-${item.type}`}
            >
              {item.ctaLabel}
              <ArrowRight size={compact ? 12 : 14} />
            </button>

            {item.canSnooze && (
              <button
                type="button"
                onClick={handleSnooze}
                disabled={snoozing}
                className={`inline-flex items-center gap-1.5 rounded-full border border-[hsl(var(--kiddo-border))] font-medium text-muted-foreground transition-colors hover:text-foreground disabled:opacity-60 ${
                  compact ? "px-3 py-1.5 text-[12px]" : "px-3.5 py-2 text-[13px]"
                }`}
                data-testid={`action-item-snooze-${item.type}`}
              >
                <Clock size={compact ? 11 : 13} />
                {snoozing ? "Snoozing…" : "Remind tomorrow"}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// Tiny category-icon glyphs. Plain SVGs rather than lucide imports —
// keeps the icon scoped to this card without pulling in another
// component layer for what's effectively a status pip.
function CategoryIcon({ category }: { category: ActionItem["category"] }) {
  const props = {
    width: 18,
    height: 18,
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 1.8,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
  };
  if (category === "identity") {
    return (
      <svg {...props}>
        <circle cx="12" cy="8" r="4" />
        <path d="M4 21c0-4 4-7 8-7s8 3 8 7" />
      </svg>
    );
  }
  if (category === "payment") {
    return (
      <svg {...props}>
        <rect x="3" y="6" width="18" height="13" rx="2" />
        <line x1="3" y1="11" x2="21" y2="11" />
      </svg>
    );
  }
  if (category === "gift_hold") {
    return (
      <svg {...props}>
        <rect x="3" y="8" width="18" height="13" rx="2" />
        <path d="M12 8V21" />
        <path d="M3 12h18" />
        <path d="M8 8a2.5 2.5 0 1 1 4-2c2-1 4 0 4 2" />
      </svg>
    );
  }
  if (category === "lifecycle") {
    // Hourglass-ish shape. The stalled-handoff action item is the
    // only lifecycle-category item today; the glyph reads as "time
    // is passing" without being alarming.
    return (
      <svg {...props}>
        <circle cx="12" cy="12" r="9" />
        <path d="M12 7v5l3 2" />
      </svg>
    );
  }
  // fund_setup
  return (
    <svg {...props}>
      <path d="M12 2v6" />
      <path d="M12 22v-6" />
      <circle cx="12" cy="12" r="3" />
      <path d="M5 12H2" />
      <path d="M22 12h-3" />
    </svg>
  );
}

// Convenience list-renderer — Activity and Dashboard both want
// "render the array, with a heading, suppressed when empty."
//
// `maxVisible` caps the number of cards rendered before rolling into
// a "+ N more in your inbox" overflow row. Locked 2026-05-19 per the
// Activity action-items audit — an unbounded list of "verify identity
// + set up successor + thank gifter + 5 more" reads as todo-list spam
// on a feed surface. Hard cap of 2 by default; consumer can override
// (NotificationsPanel renders the full list inside its dedicated
// inbox so it passes a higher cap).
type ListProps = {
  items: ActionItem[];
  heading?: string;
  compact?: boolean;
  emptyState?: React.ReactNode;
  maxVisible?: number;
  overflowHref?: string;
};

export function ActionItemList({
  items,
  heading = "Needs your attention",
  compact = false,
  emptyState = null,
  maxVisible,
  overflowHref,
}: ListProps) {
  if (items.length === 0) return <>{emptyState}</>;
  const cap = typeof maxVisible === "number" && maxVisible > 0 ? maxVisible : items.length;
  const visible = items.slice(0, cap);
  const overflow = items.length - visible.length;
  return (
    <section className="space-y-2" data-testid="action-item-list">
      {heading && (
        <p className="kiddo-section-label">{heading}</p>
      )}
      <div className="space-y-2">
        {visible.map((item) => (
          <ActionItemCard key={item.id} item={item} compact={compact} />
        ))}
        {overflow > 0 && (
          <a
            // The notifications bell (and its panel) was removed 2026-06-13, so
            // the full "needs you" list now lives on Activity. Overflow routes
            // there by default; consumers can still pass a custom overflowHref.
            href={overflowHref ?? "/activity"}
            className="block rounded-2xl border border-dashed border-[hsl(var(--kiddo-border))] bg-card/40 px-4 py-2.5 text-center text-xs font-semibold text-muted-foreground hover:bg-muted/40"
            data-testid="action-item-overflow"
          >
            {overflow} more {overflow === 1 ? "item" : "items"} in Activity →
          </a>
        )}
      </div>
    </section>
  );
}
