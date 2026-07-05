import { Share2, ChevronDown, TrendingUp } from "lucide-react";
import type { ReactNode } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";

/**
 * HeroMoment — the full-bleed evergreen hero "moment" (refined variant 1).
 *
 * The dashboard's emotional anchor as ONE deliberate evergreen moment that owns
 * the top of the screen (the app header rides ON the green via `header`), with
 * the cream content flowing out below. Built for craft, not template:
 *   - depth: a top-lit evergreen gradient + a soft gold glow behind the number
 *   - the moat made VISUAL: a stack of gifter avatars, not a stat footnote
 *   - a faint growth arc; warm sentence-case copy (no uppercase-tracked eyebrow)
 *
 * Presentational + drop-in: `balance` is a ReactNode so the locked count-up
 * element slots in unchanged. Full-bleed on mobile; contained two-column on
 * desktop so a wide viewport neither bands green edge-to-edge nor leaves a dead
 * expanse beside the number.
 */
export interface GifterAvatar {
  /** 1–2 char initial (or "+8" for the overflow chip). */
  label: string;
  /** CSS color for the avatar background. */
  color: string;
}

export interface HeroMomentProps {
  /** App chrome (wordmark / menu / avatar) rendered ON the green at the top. */
  header?: ReactNode;
  /** Switcher chip label, e.g. "Theo's Fund". */
  fundLabel: string;
  /** Child initial shown in the chip's round avatar. */
  fundInitial?: string;
  /** Warm eyebrow above the balance, e.g. "Theo's future". */
  futureLabel: string;
  /** Formatted balance — pass the count-up element here to keep the locked roll. */
  balance: ReactNode;
  /** Overlapping gifter avatars (the peopled line). Last item can be a "+N" chip. */
  gifterAvatars?: GifterAvatar[];
  giftsCount: number;
  peopleCount: number;
  /** Forward-looking peek, e.g. "~$51k by 21". Omit to hide. */
  projectionLabel?: string;
  shareLabel: string;
  onShare?: () => void;
  onSwitchFund?: () => void;
  /** Hide the share CTA for read-only roles (viewer / previous owner). */
  readOnly?: boolean;
  /**
   * Gift-lands "moment" — the third + fourth limbs of the choreography
   * (the roll + the face bloom are the first two), completing Disney's
   * touch cluster for the conversion beat:
   *   • ARC (principle 7): a gold "+$amount" chip travels up a curved path
   *     FROM the peopled line INTO the balance — the loop made physical, the
   *     value visibly flowing from the person to the number.
   *   • SECONDARY ACTION (principle 8): as it merges, the balance gives ONE
   *     soft gold breath — a restrained acknowledgment, NOT confetti/sparkles
   *     (locked no-AI-slop) and never a loss dressed as a gain.
   * Set to play; `onGiftMomentEnd` fires when the arc finishes so the caller
   * can clear it. Honors prefers-reduced-motion (a quiet static fade, no flight).
   */
  giftMoment?: { amount: string; from?: string } | null;
  onGiftMomentEnd?: () => void;
}

// Top-lit evergreen gradient + a soft gold glow centered behind the number.
const HERO_BG =
  "radial-gradient(120% 80% at 50% 10%, hsl(var(--kiddo-gold-light) / 0.16) 0%, transparent 46%)," +
  "linear-gradient(168deg, hsl(158 45% 19%) 0%, hsl(var(--kiddo-evergreen)) 42%, hsl(var(--kiddo-evergreen-deep)) 100%)";

export function HeroMoment({
  header,
  fundLabel,
  fundInitial,
  futureLabel,
  balance,
  gifterAvatars,
  giftsCount,
  peopleCount,
  projectionLabel,
  shareLabel,
  onShare,
  onSwitchFund,
  readOnly = false,
  giftMoment = null,
  onGiftMomentEnd,
}: HeroMomentProps) {
  const reduce = useReducedMotion();
  const playingGift = !!giftMoment;
  const peopledText =
    giftsCount > 0
      ? peopleCount > 0
        ? `${giftsCount} gifts from ${peopleCount} ${peopleCount === 1 ? "person" : "people"}`
        : `${giftsCount} ${giftsCount === 1 ? "gift" : "gifts"}`
      : null;

  return (
    <section
      className="relative w-full overflow-hidden px-6 pb-12 pt-2 text-[hsl(var(--kiddo-cream))] md:rounded-[28px] md:px-8"
      style={{ background: HERO_BG }}
      data-testid="hero-moment"
    >
      {/* Secondary-action (principle 8) balance breath — one soft gold swell as
          the gift merges. Single iteration + reduced-motion guard: a looping
          glow would read as an alarm, not an acknowledgment. Delay ~0.55s so it
          peaks the instant the arc chip arrives (arc lands at ~0.9s). */}
      <style>{`
        @keyframes hero-balance-bloom {
          0%   { text-shadow: 0 2px 30px hsl(var(--kiddo-gold-light)/0.18); transform: scale(1); }
          45%  { text-shadow: 0 2px 30px hsl(var(--kiddo-gold-light)/0.18), 0 0 26px hsl(var(--kiddo-gold-light)/0.55); transform: scale(1.04); }
          100% { text-shadow: 0 2px 30px hsl(var(--kiddo-gold-light)/0.18); transform: scale(1); }
        }
        .hero-balance-bloom { animation: hero-balance-bloom 1.05s cubic-bezier(0.16,1,0.3,1) 0.8s 1; }
        @media (prefers-reduced-motion: reduce) { .hero-balance-bloom { animation: none; } }
      `}</style>
      {header && <div className="relative z-[2]">{header}</div>}

      <div className="relative z-[2] pt-3">
        <button
          type="button"
          onClick={onSwitchFund}
          className="mb-5 inline-flex items-center gap-2 rounded-full border border-[hsl(var(--kiddo-cream)/0.16)] bg-[hsl(var(--kiddo-cream)/0.10)] py-1 pl-1 pr-3 text-[13px] font-bold text-[hsl(var(--kiddo-cream))] transition-colors hover:bg-[hsl(var(--kiddo-cream)/0.16)]"
          data-testid="hero-moment-fund-switch"
        >
          {fundInitial && (
            <span className="flex h-[22px] w-[22px] items-center justify-center rounded-full bg-[linear-gradient(150deg,#3c6b53,#1f4435)] text-3xs font-extrabold text-[hsl(var(--kiddo-cream))]">
              {fundInitial}
            </span>
          )}
          {fundLabel}
          <ChevronDown size={13} className="opacity-65" />
        </button>

        {/* Mobile: stacked. Desktop: balance block left, action block right. */}
        <div className="md:flex md:items-end md:justify-between md:gap-10">
          <div className="md:min-w-0">
            <p className="text-[13px] font-medium text-[hsl(var(--kiddo-cream)/0.6)]">
              {futureLabel}
            </p>

            <div className="relative">
              <div
                className={`font-heading mt-1 inline-block origin-left text-[52px] font-bold leading-[1.02] tracking-[-0.03em] text-white [text-shadow:0_2px_30px_hsl(var(--kiddo-gold-light)/0.18)] md:text-[60px] ${playingGift && !reduce ? "hero-balance-bloom" : ""}`}
                data-testid="hero-moment-balance"
              >
                {balance}
              </div>

              {/* The gift ARC (principle 7) + reduced-motion fallback. The chip
                  starts low (at the peopled line, where the gifter is) and curves
                  up into the number; onAnimationComplete clears it via the caller. */}
              <AnimatePresence>
                {giftMoment && (
                  <motion.div
                    key="gift-arc"
                    aria-hidden
                    data-testid="hero-moment-gift-arc"
                    className="pointer-events-none absolute left-0 top-0 z-[3] inline-flex items-center gap-1.5 whitespace-nowrap rounded-full bg-[linear-gradient(180deg,#e7a93a,hsl(var(--kiddo-gold)))] px-3 py-1 text-[13px] font-extrabold text-[#2a1c06] shadow-[0_6px_16px_hsl(var(--kiddo-evergreen-deep)/0.45)]"
                    initial={reduce ? { opacity: 0, y: 54, scale: 0.96 } : { opacity: 0, x: 0, y: 72, scale: 0.72 }}
                    animate={
                      reduce
                        ? { opacity: [0, 1, 1, 0] }
                        : {
                            // Appear LOW at the peopled line and hold a beat (the
                            // "+$X from a person" read) before lifting + dissolving
                            // into the number. x bows out then back = the arc curve.
                            opacity: [0, 1, 1, 1, 0],
                            x: [0, 20, 26, 12, 6],
                            y: [72, 54, 50, -2, -10],
                            scale: [0.72, 1.06, 1.0, 0.96, 0.9],
                          }
                    }
                    transition={
                      reduce
                        ? { duration: 1.4, times: [0, 0.18, 0.72, 1] }
                        : { duration: 1.45, ease: [0.22, 1, 0.36, 1], times: [0, 0.16, 0.4, 0.84, 1] }
                    }
                    onAnimationComplete={() => onGiftMomentEnd?.()}
                  >
                    {giftMoment.amount}
                    {giftMoment.from && <span className="font-semibold opacity-80">· {giftMoment.from}</span>}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {peopledText && (
              <div className="mt-4 flex items-center gap-3" data-testid="hero-moment-peopled">
                {gifterAvatars && gifterAvatars.length > 0 && (
                  <span className="flex">
                    {gifterAvatars.map((g, i) => (
                      <span
                        key={i}
                        className="flex h-[26px] w-[26px] items-center justify-center rounded-full border-2 border-[hsl(var(--kiddo-evergreen))] text-3xs font-bold text-white first:ml-0 [margin-left:-8px]"
                        style={{ background: g.color }}
                      >
                        {g.label}
                      </span>
                    ))}
                  </span>
                )}
                <span className="text-[13px] font-medium text-[hsl(var(--kiddo-cream)/0.78)]">
                  {peopledText}
                </span>
              </div>
            )}
          </div>

          <div className="md:flex md:shrink-0 md:flex-col md:items-end">
            {!readOnly && (
              <button
                type="button"
                onClick={onShare}
                className="kiddo-press lab-tap mt-6 flex w-full items-center justify-center gap-2.5 rounded-2xl bg-[linear-gradient(180deg,#d28f24,hsl(var(--kiddo-gold)))] px-6 py-4 text-[15.5px] font-bold tracking-[-0.01em] text-[#2a1c06] shadow-[0_8px_22px_hsl(var(--kiddo-evergreen-deep)/0.40),inset_0_1px_0_rgba(255,255,255,0.25)] md:mt-0 md:w-auto md:px-7"
                data-testid="hero-moment-share"
              >
                <Share2 size={16} />
                {shareLabel}
              </button>
            )}

            {projectionLabel && (
              <p className="mt-4 flex items-center justify-center gap-2 text-[13px] text-[hsl(var(--kiddo-cream)/0.7)] md:mt-3 md:justify-end" data-testid="hero-moment-projection">
                <TrendingUp size={13} className="text-[hsl(var(--kiddo-gold-light))]" />
                On track for <b className="font-bold text-[hsl(var(--kiddo-gold-light))]">{projectionLabel}</b>
              </p>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
