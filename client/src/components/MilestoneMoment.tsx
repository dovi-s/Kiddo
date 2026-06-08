import { useEffect, useRef, useState } from "react";
import { safeLocalSet } from "@/lib/local-cache";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
// Sprout (brand mark) replaces Sparkles 2026-05-12 — sparkle iconography is
// banned per feedback_no_ai_slop.md (Robinhood-precedent territory for
// celebratory imagery tied to investment activity). The milestone moment IS
// a rare Mario-star surface where some celebratory mark earns its place,
// but the locked rule is the Kora brand sprout 🌱, not generic sparkles.
// Per feedback_iconography_consistency.md: "Sprout (brand) — reserved for the
// Kora brand mark + first-gift confirmation."
import { Share2, Sprout, Download, Loader2 } from "lucide-react";
import { ModalCloseButton } from "@/components/ui/modal-close-button";
import { haptic } from "@/lib/haptics";
import {
  MONEY_CROSS_COPY,
  formatMilestone,
  getMilestoneCrossed,
} from "@shared/milestones";
import { MilestoneShareCard } from "./MilestoneShareCard";
import {
  rasterizeElementToPng,
  shareOrDownloadImage,
} from "@/lib/rasterize-share-card";
import { getActiveFundId } from "@/hooks/use-active-fund";

// Per-fund "highest milestone already celebrated" persistence. Without this,
// the card re-fires on EVERY Dashboard mount: Dashboard seeds prevValueRef to
// 0 while funds load async (Dashboard.tsx:2059), so the first populated render
// compares 0 -> currentValue and getMilestoneCrossed returns the highest
// crossed threshold every single load. Storing the highest celebrated
// threshold per fund makes each milestone fire ONCE, then archive — matching
// the localStorage-dismiss pattern used by KidAt18WelcomeBanner /
// CoparentAcceptedBanner and the dismiss-tiering rule
// (project_dismiss_swipe_tiering). A genuine future crossing (a later gift
// pushes the fund past $2,500) still fires, because 2500 > the stored 1000.
const MILESTONE_CELEBRATED_PREFIX = "kiddo.milestone.celebrated.";
function getCelebratedThreshold(fundId: string): number {
  try {
    const raw = localStorage.getItem(`${MILESTONE_CELEBRATED_PREFIX}${fundId || "default"}`);
    const n = raw ? parseInt(raw, 10) : 0;
    return Number.isFinite(n) ? n : 0;
  } catch {
    return 0;
  }
}
function setCelebratedThreshold(fundId: string, threshold: number): void {
  try {
    safeLocalSet(`${MILESTONE_CELEBRATED_PREFIX}${fundId || "default"}`, String(threshold));
  } catch {
    // localStorage unavailable (private mode / quota). Non-fatal — worst case
    // the card may re-fire, which is just the pre-fix behavior, not a new bug.
  }
}

interface MilestoneMomentProps {
  currentValue: number;
  previousValue: number;
  recipientName?: string | null;
  // True when the viewer OWNS this fund post-handoff (the kid, now adult owner).
  // The ON-SCREEN moment is shown TO them, so it reads second-person ("Your fund
  // crossed"). NOTE: the shareable card stays third-person ("Haley's fund") on
  // purpose — it's an outbound image whose audience is other people.
  isOwnerMode?: boolean;
  // Social proof for the shareable card (optional). Threaded straight through
  // to MilestoneShareCard so the outbound image leads with the peopled story,
  // not just the dollar figure. The on-screen moment is unaffected.
  giftCount?: number;
  peopleCount?: number;
  onDismiss?: () => void;
}

export function MilestoneMoment({ currentValue, previousValue, recipientName, isOwnerMode = false, giftCount, peopleCount, onDismiss }: MilestoneMomentProps) {
  const [milestone, setMilestone] = useState<number | null>(null);
  const [visible, setVisible] = useState(false);
  const [shareOpen, setShareOpen] = useState(false);
  const [busy, setBusy] = useState<"idle" | "rendering">("idle");
  // Mirrors the on-screen MilestoneShareCard so html-to-image can rasterize
  // exactly what the parent sees. The ref points at the wrapper around the
  // share card; the close button is a sibling so it's not captured.
  const shareCardRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const hit = getMilestoneCrossed(previousValue, currentValue);
    if (!hit) return;
    // Fire each threshold at most once per fund. See the persistence helpers
    // above for why the unguarded version re-fired on every Dashboard mount.
    const fundId = getActiveFundId();
    if (hit <= getCelebratedThreshold(fundId)) return;
    setCelebratedThreshold(fundId, hit);
    setMilestone(hit);
    const timer = setTimeout(() => {
      setVisible(true);
      haptic("milestone");
    }, 400);
    return () => clearTimeout(timer);
  }, [currentValue, previousValue]);

  const dismiss = () => {
    setVisible(false);
    onDismiss?.();
  };

  // Pull the threshold-specific emotional anchor from shared/milestones.ts so
  // the share text matches what the activity log and parent email say (e.g.
  // "$5,000. A year of community college, paid in full.") — not a generic
  // "a gift that lasts is becoming something real" tagline that's the same
  // at every threshold.
  const milestoneCopy = milestone !== null ? MONEY_CROSS_COPY[milestone] : null;

  const openShare = () => {
    if (!milestone) return;
    haptic("medium");
    setShareOpen(true);
  };

  // Rasterize the MilestoneShareCard to PNG and share it as a File via the
  // Web Share Files API. On unsupported browsers (older desktop Safari /
  // Firefox) this falls back to a download anchor, then to text-only share
  // as a last resort. Phase-2 of the original Phase-1 manual-screenshot
  // path — see MilestoneShareCard.tsx for the design contract.
  const shareImage = async () => {
    if (!milestone) return;
    const child = recipientName || "This fund";
    const anchor = milestoneCopy?.emotionalLine ?? "";
    const text = anchor
      ? `${child} just crossed ${formatMilestone(milestone)} on Kiddo. ${anchor}`
      : `${child} just crossed ${formatMilestone(milestone)} on Kiddo.`;
    const node = shareCardRef.current;
    const slug = (recipientName || "kiddo").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "") || "kiddo";
    const filename = `${slug}-${formatMilestone(milestone).replace(/[^a-z0-9]+/gi, "")}-milestone.png`;

    // Without a mounted card we can't rasterize. Quietly fall through to the
    // text-only share so the button never silently no-ops.
    if (!node) {
      await shareTextFallback(text);
      return;
    }

    setBusy("rendering");
    try {
      const file = await rasterizeElementToPng(node, { filename });
      if (!file) {
        await shareTextFallback(text);
        return;
      }
      const outcome = await shareOrDownloadImage(file, {
        title: "Kiddo milestone",
        text,
      });
      if (outcome.kind === "shared" || outcome.kind === "downloaded") {
        haptic("success");
      }
      // "cancelled" or "failed" → silent, no error toast. User can re-tap.
    } catch {
      // Rasterizer threw — likely a CORS / canvas-tainted edge case. Fall
      // back to text-only share so the path still completes.
      await shareTextFallback(text);
    } finally {
      setBusy("idle");
    }
  };

  // Last-resort path: no rasterizer, no Web Share. Used only if the image
  // path fails. Same behavior as the pre-Phase-2 implementation.
  const shareTextFallback = async (text: string) => {
    try {
      if (navigator.share) {
        await navigator.share({ title: "Kiddo milestone", text, url: window.location.href });
      } else if (navigator.clipboard) {
        await navigator.clipboard.writeText(`${text} ${window.location.href}`);
      }
      haptic("success");
    } catch {
      // Browser share dismissed.
    }
  };

  const reduceMotion = useReducedMotion();

  if (!milestone) return null;

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          initial={reduceMotion ? { opacity: 0 } : { opacity: 0, y: 20, scale: 0.94 }}
          animate={reduceMotion ? { opacity: 1 } : { opacity: 1, y: 0, scale: 1 }}
          exit={reduceMotion ? { opacity: 0 } : { opacity: 0, y: -12, scale: 0.96 }}
          transition={reduceMotion ? { duration: 0.15 } : { duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
          className="relative overflow-hidden rounded-2xl border border-[hsl(var(--kiddo-gold)/0.30)] bg-gradient-to-br from-[hsl(var(--kiddo-gold)/0.08)] to-[hsl(var(--kiddo-gold)/0.04)] p-5 shadow-premium"
          data-testid="card-milestone-moment"
        >
          {/* 8 confetti particles is the CEILING, not the floor. The animation-
              primitives memory (feedback_animation_primitives.md) bans "confetti spam";
              this restrained count fires only at a real $-threshold crossed (not a
              fake achievement / badge / streak — those are banned at the milestone
              architecture level). Don't scale this up on bigger milestones. A bigger
              dollar crossed doesn't mean more particles; it means the same restraint
              on a larger emotional anchor. The MilestoneShareCard does the gravity. */}
          {!reduceMotion && (
            <div className="pointer-events-none absolute inset-0 overflow-hidden">
              {Array.from({ length: 8 }).map((_, i) => (
                <div
                  key={i}
                  className="confetti-particle"
                  style={{
                    left: `${10 + i * 11}%`,
                    top: "60%",
                    backgroundColor: i % 2 === 0
                      ? "hsl(var(--kiddo-gold))"
                      : "hsl(var(--kiddo-evergreen))",
                    transform: `rotate(${i * 45}deg)`,
                  }}
                />
              ))}
            </div>
          )}

          <ModalCloseButton onClick={dismiss} label="Dismiss milestone" className="absolute right-3 top-3" />

          <div className="flex items-start gap-3">
            <div className="relative flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-[hsl(var(--kiddo-gold)/0.15)]">
              <div className="milestone-ring rounded-xl" />
              <Sprout size={22} className="text-[hsl(var(--kiddo-gold))]" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[hsl(var(--kiddo-gold-ink))]">
                Milestone
              </p>
              <h3 className="number-build mt-1 font-heading text-2xl font-bold text-foreground" data-testid="text-milestone-value">
                {formatMilestone(milestone)}
              </h3>
              <p className="mt-1 text-sm text-muted-foreground">
                {recipientName && !isOwnerMode
                  ? `${recipientName}'s fund crossed ${formatMilestone(milestone)}.`
                  : `Your fund crossed ${formatMilestone(milestone)}.`}
                {milestoneCopy?.emotionalLine ? ` ${milestoneCopy.emotionalLine}` : ""}
              </p>
              <button
                type="button"
                onClick={openShare}
                className="mt-4 inline-flex h-10 items-center gap-2 rounded-full bg-[hsl(var(--kiddo-gold))] px-4 text-sm font-semibold text-[hsl(var(--kiddo-ink))] shadow-sm transition-transform hover:scale-[1.01] active:scale-[0.98]"
                data-testid="button-share-milestone-moment"
              >
                <Share2 size={15} />
                Share
              </button>
            </div>
          </div>
        </motion.div>
      )}

      {/* Share modal — full-fidelity rendering of the milestone for screenshot
          + system share sheet. Decoupled from the in-app celebration card so
          the parent intentionally lands on a polished, branded surface when
          they want to share. */}
      {shareOpen && milestone !== null && (
        <motion.div
          key="milestone-share-modal"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
          className="fixed inset-0 z-[60] flex items-end justify-center bg-black/60 p-4 sm:items-center"
          data-testid="milestone-share-modal"
          onClick={() => setShareOpen(false)}
        >
          <motion.div
            initial={{ y: 30, scale: 0.96, opacity: 0 }}
            animate={{ y: 0, scale: 1, opacity: 1 }}
            exit={{ y: 30, scale: 0.96, opacity: 0 }}
            transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
            onClick={(e) => e.stopPropagation()}
            className="relative w-full max-w-md rounded-3xl bg-background p-4 shadow-2xl"
          >
            <ModalCloseButton onClick={() => setShareOpen(false)} label="Close share view" className="absolute right-3 top-3 z-10" />

            <div ref={shareCardRef}>
              <MilestoneShareCard threshold={milestone} recipientName={recipientName} giftCount={giftCount} peopleCount={peopleCount} />
            </div>

            <div className="mt-4 space-y-2">
              <button
                type="button"
                onClick={shareImage}
                disabled={busy === "rendering"}
                className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-full bg-[hsl(var(--kiddo-gold))] text-sm font-semibold text-[hsl(var(--kiddo-ink))] shadow-sm transition-transform hover:scale-[1.01] active:scale-[0.98] disabled:cursor-wait disabled:opacity-80"
                data-testid="button-share-milestone-image"
              >
                {busy === "rendering" ? (
                  <>
                    <Loader2 size={15} className="animate-spin" />
                    Saving image…
                  </>
                ) : (
                  <>
                    <Share2 size={15} />
                    Share image
                  </>
                )}
              </button>
              <p className="text-center text-[11px] text-muted-foreground">
                <Download size={11} className="mr-1 inline align-text-bottom" />
                Opens your share menu, or saves the image if sharing isn't supported.
              </p>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
