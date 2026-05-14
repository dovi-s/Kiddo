// Cross-fund gifter sheet, surfaced from /funds via the
// "Across all funds" card. Answers the household-glance question that
// per-fund Memory Books can't: "Grandma gave to whom, and what did
// she give them?" without making the parent open each fund one by
// one to assemble the picture themselves.
//
// Design discipline (locked):
//   - Calm register. No avatars, no profile circles, no leaderboard
//     ranking. Sorted by most recent gift (a chronological feed, not
//     a "top contributors" board).
//   - Tap a row to expand inline. No second sheet, no route change.
//     Mental model is "see the household at a glance, then peek if
//     curious."
//   - Parent-private surface, so real gifter names display regardless
//     of the gift's is_anonymous flag. That flag is for PUBLIC
//     surfaces (social-proof carousel, kid view), per the locked rule
//     in feedback_anonymous_as_explicit_flag.md.
//   - Same kid-chip color palette the Notifications panel uses so the
//     household reads as one coherent design system.

import { useEffect, useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, ChevronDown } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/hooks/use-auth";
import { haptic } from "@/lib/haptics";
import { MOTION_DURATION } from "@/lib/motion";

// Same palette as NotificationsPanel.fundPillColors. Kept inline
// rather than exported because (a) it's tiny, (b) keeping it local
// to each consumer is the convention the codebase already follows
// (Activity, NotificationsPanel both inline the palette).
const fundPillColors = [
  { bg: "#EDF4EE", text: "#1A3D2B" },
  { bg: "#FDF5E4", text: "#B8791A" },
  { bg: "#EEF3FF", text: "#2D5AA0" },
  { bg: "#FFF0F5", text: "#9C2060" },
];

type FundChip = {
  fundId: string;
  recipientFirstName: string | null;
  fundColorIndex: number;
  giftCount: number;
};

type RecentGift = {
  id: string;
  fundId: string;
  recipientFirstName: string | null;
  amount: number;
  message: string | null;
  selectedTicker: string | null;
  createdAt: string;
  isAnonymous: boolean;
};

type GifterRow = {
  email: string;
  displayName: string;
  giftCount: number;
  totalAmount: number;
  mostRecentGiftAt: string;
  fundsGivenTo: FundChip[];
  recentGifts: RecentGift[];
};

type GiftersResponse = {
  gifters: GifterRow[];
  totalCount: number;
};

interface GiftersAcrossFundsSheetProps {
  open: boolean;
  onClose: () => void;
}

function formatMoney(value: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: value % 1 === 0 ? 0 : 2,
    maximumFractionDigits: 2,
  }).format(value);
}

function timeAgo(dateStr: string): string {
  const d = new Date(dateStr);
  const now = Date.now();
  const diff = now - d.getTime();
  if (!Number.isFinite(diff) || diff < 0) return "";
  if (diff < 60 * 60 * 1000) return `${Math.max(1, Math.round(diff / 60000))}m ago`;
  if (diff < 24 * 60 * 60 * 1000) return `${Math.round(diff / 3600000)}h ago`;
  if (diff < 48 * 60 * 60 * 1000) return "Yesterday";
  if (diff < 7 * 24 * 60 * 60 * 1000) return `${Math.round(diff / 86400000)} days ago`;
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

// Inline gift rows show a fixed-format date (Month Day, plus year if
// it's not the current year) rather than relative timeAgo. The
// outer row already shows relative timeAgo ("6 days ago") so the
// inline list reads as a chronological calendar instead of a second
// relative pass.
function fullDate(dateStr: string): string {
  const d = new Date(dateStr);
  if (!Number.isFinite(d.getTime())) return "";
  const now = new Date();
  const sameYear = d.getFullYear() === now.getFullYear();
  return d.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: sameYear ? undefined : "numeric",
  });
}

// Inline-gift descriptor when no gifter message exists. Surfaces the
// ticker when present ("Invested in AAPL"); falls back to a calm
// "Gift to {child}" line when neither message nor ticker is
// available. Never empty, never AI-slop.
function describeGiftInline(g: RecentGift): string {
  if (g.selectedTicker) return `Invested in ${g.selectedTicker}`;
  const child = g.recipientFirstName?.trim();
  return child ? `Gift to ${child}` : "Gift";
}

export function GiftersAcrossFundsSheet({ open, onClose }: GiftersAcrossFundsSheetProps) {
  const { isAuthenticated } = useAuth();
  const [expandedEmail, setExpandedEmail] = useState<string | null>(null);

  // Reset expanded state when the sheet closes so reopening lands on
  // the collapsed default view, not whatever the user last peeked at.
  useEffect(() => {
    if (!open) setExpandedEmail(null);
  }, [open]);

  const { data, isLoading, isError } = useQuery<GiftersResponse>({
    queryKey: ["/api/funds-overview/gifters"],
    queryFn: async () => {
      const res = await fetch("/api/funds-overview/gifters", {
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed to load gifters");
      return res.json();
    },
    // Load lazily. Only fetch when the sheet actually opens. Saves a
    // round trip for the (likely majority) case where the parent
    // doesn't peek at the list this session.
    enabled: open && isAuthenticated,
    staleTime: 60_000,
  });

  const gifters = data?.gifters ?? [];

  // Stable kid-chip color mapping: same fund color index per email
  // across the whole sheet, so Emma always reads as the same chip
  // color whether she's row 1 or row 8.
  const fundChipStyle = useMemo(() => {
    return (colorIndex: number) => fundPillColors[colorIndex % fundPillColors.length];
  }, []);

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: MOTION_DURATION.fast }}
            className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50"
            onClick={onClose}
            data-testid="gifters-sheet-backdrop"
          />
          <motion.div
            initial={{ opacity: 0, y: 40 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 40 }}
            transition={{ type: "spring", damping: 25, stiffness: 300 }}
            className="fixed inset-x-0 bottom-0 z-50 max-h-[85vh] max-h-[85dvh] overflow-y-auto bg-background rounded-t-3xl shadow-2xl md:inset-auto md:top-1/2 md:left-1/2 md:-translate-x-1/2 md:-translate-y-1/2 md:rounded-3xl md:max-w-lg md:w-full"
            data-testid="gifters-sheet"
          >
            <div className="sticky top-0 bg-background/85 backdrop-blur-lg rounded-t-3xl z-10">
              <div className="flex items-center justify-between p-5 pb-3">
                <div>
                  <p className="kiddo-section-label">Across all funds</p>
                  <h2 className="text-lg font-semibold text-foreground mt-0.5">
                    {data?.totalCount === 1 ? "1 gifter" : `${data?.totalCount ?? "..."} gifters`}
                  </h2>
                </div>
                <button
                  onClick={onClose}
                  className="w-8 h-8 rounded-full bg-muted flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors"
                  data-testid="button-close-gifters-sheet"
                  aria-label="Close gifters sheet"
                >
                  <X size={16} />
                </button>
              </div>
              <div className="h-px bg-border/50 mx-5" />
            </div>

            <div className="p-2 pb-[calc(60px+env(safe-area-inset-bottom,0px))] md:pb-2">
              {isLoading && (
                <div className="space-y-2 px-3 py-2">
                  {[0, 1, 2].map((i) => (
                    <div
                      key={i}
                      className="h-16 rounded-2xl bg-muted/40 animate-pulse"
                      style={{ animationDelay: `${i * 80}ms` }}
                    />
                  ))}
                </div>
              )}

              {isError && (
                <div className="px-5 py-8 text-center text-sm text-muted-foreground">
                  Could not load gifters. Pull to refresh or try again in a moment.
                </div>
              )}

              {!isLoading && !isError && gifters.length === 0 && (
                <div className="px-5 py-10 text-center">
                  <p className="text-sm font-semibold text-foreground">No gifts yet</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    Once your family starts gifting, every gifter shows up here.
                  </p>
                </div>
              )}

              {!isLoading && !isError && gifters.length > 0 && (
                <div className="space-y-1">
                  {gifters.map((gifter, index) => {
                    const isExpanded = expandedEmail === gifter.email;
                    return (
                      <motion.div
                        key={gifter.email}
                        initial={{ opacity: 0, y: 4 }}
                        animate={{
                          opacity: 1,
                          y: 0,
                          transition: {
                            duration: 0.32,
                            ease: [0.16, 1, 0.3, 1],
                            delay: Math.min(index, 8) * 0.04,
                          },
                        }}
                      >
                        <button
                          type="button"
                          onClick={() => {
                            haptic("selection");
                            setExpandedEmail(isExpanded ? null : gifter.email);
                          }}
                          className="w-full text-left rounded-2xl px-4 py-3 transition-colors hover:bg-[hsl(var(--kiddo-cream))] focus-visible:bg-[hsl(var(--kiddo-cream))] focus-visible:outline-none"
                          aria-expanded={isExpanded}
                          data-testid={`gifter-row-${gifter.email}`}
                        >
                          <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0 flex-1">
                              <div className="flex items-baseline gap-2">
                                <p className="text-sm font-semibold text-foreground truncate">
                                  {gifter.displayName}
                                </p>
                                <span className="text-[11px] text-muted-foreground tabular-nums">
                                  {gifter.giftCount === 1 ? "1 gift" : `${gifter.giftCount} gifts`}
                                </span>
                              </div>
                              <div className="flex flex-wrap items-center gap-1.5 mt-1.5">
                                {gifter.fundsGivenTo.map((chip) => {
                                  const style = fundChipStyle(chip.fundColorIndex);
                                  // Per-chip count only when the gifter has
                                  // given to more than one fund. For a
                                  // single-fund gifter the count is already
                                  // shown in the row header ("6 gifts"), so a
                                  // duplicate "Emma 6" badge reads as noise.
                                  // Multi-fund gifters genuinely need the per-
                                  // kid count to make sense of the split.
                                  const showCount =
                                    gifter.fundsGivenTo.length > 1 && chip.giftCount > 1;
                                  return (
                                    <span
                                      key={chip.fundId}
                                      className="inline-flex items-center rounded-full px-2 py-0.5 text-[10.5px] font-semibold tracking-[0.01em]"
                                      style={{ background: style.bg, color: style.text }}
                                      data-testid={`gifter-fund-chip-${gifter.email}-${chip.fundId}`}
                                    >
                                      {chip.recipientFirstName || "Fund"}
                                      {showCount && (
                                        <span className="ml-1 opacity-70 tabular-nums">
                                          · {chip.giftCount}
                                        </span>
                                      )}
                                    </span>
                                  );
                                })}
                                <span className="text-[10.5px] text-muted-foreground tabular-nums">
                                  {timeAgo(gifter.mostRecentGiftAt)}
                                </span>
                              </div>
                            </div>
                            <motion.span
                              animate={{ rotate: isExpanded ? 180 : 0 }}
                              transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
                              className="shrink-0 mt-1 text-muted-foreground"
                              aria-hidden
                            >
                              <ChevronDown size={14} strokeWidth={2.2} />
                            </motion.span>
                          </div>
                        </button>

                        <AnimatePresence initial={false}>
                          {isExpanded && (
                            <motion.div
                              key={`expanded-${gifter.email}`}
                              initial={{ opacity: 0, height: 0 }}
                              animate={{
                                opacity: 1,
                                height: "auto",
                                transition: { duration: 0.3, ease: [0.16, 1, 0.3, 1] },
                              }}
                              exit={{
                                opacity: 0,
                                height: 0,
                                transition: { duration: 0.2, ease: [0.16, 1, 0.3, 1] },
                              }}
                              style={{ overflow: "hidden" }}
                            >
                              <div className="px-4 pb-3 pt-1 space-y-1">
                                {gifter.recentGifts.map((g) => {
                                  const style = fundChipStyle(
                                    gifter.fundsGivenTo.find((f) => f.fundId === g.fundId)
                                      ?.fundColorIndex ?? 0,
                                  );
                                  // Descriptor under the chip row. When the
                                  // gifter wrote a real message we show it
                                  // (clamped to 2 lines). When they didn't,
                                  // surface ticker context if it exists
                                  // (Invested in AAPL) or a calm "Gift to
                                  // Emma" fallback. The row never reads
                                  // barren.
                                  const inlineDescriptor = g.message?.trim()
                                    ? { kind: "message" as const, text: g.message.trim() }
                                    : { kind: "fallback" as const, text: describeGiftInline(g) };
                                  return (
                                    <div
                                      key={g.id}
                                      className="flex items-start justify-between gap-3 rounded-xl border border-border/50 bg-card/60 px-3 py-2"
                                      data-testid={`gifter-recent-gift-${g.id}`}
                                    >
                                      <div className="min-w-0 flex-1">
                                        <div className="flex items-center gap-2">
                                          <span
                                            className="inline-flex items-center rounded-full px-1.5 py-0 text-[9.5px] font-bold tracking-[0.02em]"
                                            style={{ background: style.bg, color: style.text }}
                                          >
                                            {g.recipientFirstName || "Fund"}
                                          </span>
                                          <span className="text-[10.5px] text-muted-foreground tabular-nums">
                                            {fullDate(g.createdAt)}
                                          </span>
                                        </div>
                                        <p
                                          className={`mt-1 text-[12px] leading-snug ${
                                            inlineDescriptor.kind === "message"
                                              ? "text-muted-foreground line-clamp-2"
                                              : "text-muted-foreground/75 italic"
                                          }`}
                                        >
                                          {inlineDescriptor.text}
                                        </p>
                                      </div>
                                      <p className="shrink-0 text-sm font-semibold text-foreground tabular-nums">
                                        {formatMoney(g.amount)}
                                      </p>
                                    </div>
                                  );
                                })}
                                {gifter.giftCount > gifter.recentGifts.length && (
                                  <p className="text-[11px] text-muted-foreground/80 text-center pt-1">
                                    Showing {gifter.recentGifts.length} of {gifter.giftCount} gifts.
                                    Open each fund to see the full Memory Book.
                                  </p>
                                )}
                              </div>
                            </motion.div>
                          )}
                        </AnimatePresence>
                      </motion.div>
                    );
                  })}
                </div>
              )}
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
