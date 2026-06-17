// Birthday moment banner — the proactive sibling of the "while you were away"
// digest. When a child's birthday is today (or within the next week), it gives
// the parent a warm, dismissible nudge to SHARE the gift link — turning the #1
// gifting moment into the loop's strongest beat. Calm, not naggy: dismissible,
// once per birthday (re-appears next year), no fake urgency.
//
// v1 = birthday only. Occasions (graduation, etc.) can extend the same shape.
import { useState } from "react";
import { motion } from "framer-motion";
import { X } from "lucide-react";

const DISMISS_PREFIX = "kiddo.birthday-moment-dismissed.";

function dismissKey(fundId: string, bdayYear: number): string {
  return `${DISMISS_PREFIX}${fundId}.${bdayYear}`;
}

type Moment = { daysUntil: number; turningAge: number; bdayYear: number } | null;

// Days until the next birthday + the age being turned. 0 days = today.
function computeMoment(birthdate?: string | null): Moment {
  if (!birthdate) return null;
  const bd = new Date(birthdate);
  if (Number.isNaN(bd.getTime())) return null;
  const now = new Date();
  // Birthdate is stored at noon-UTC, so read month/day in UTC to avoid the
  // off-by-one a local-midnight read causes west of UTC (matches the dashboard).
  const bdMonth = bd.getUTCMonth();
  const bdDate = bd.getUTCDate();
  const isToday = now.getMonth() === bdMonth && now.getDate() === bdDate;
  const today0 = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  let next = new Date(now.getFullYear(), bdMonth, bdDate);
  if (next.getTime() < today0.getTime()) next = new Date(now.getFullYear() + 1, bdMonth, bdDate);
  const daysUntil = isToday ? 0 : Math.round((next.getTime() - today0.getTime()) / 86400000);
  const bdayYear = isToday ? now.getFullYear() : next.getFullYear();
  const turningAge = bdayYear - bd.getUTCFullYear();
  return { daysUntil, turningAge, bdayYear };
}

export function BirthdayMomentBanner({
  fundId,
  childFirstName,
  birthdate,
  onShare,
}: {
  fundId: string | null;
  childFirstName: string | null;
  birthdate?: string | null;
  onShare: () => void;
}) {
  const moment = computeMoment(birthdate);
  const [dismissed, setDismissed] = useState(() => {
    if (typeof window === "undefined" || !fundId || !moment) return false;
    try {
      return window.localStorage.getItem(dismissKey(fundId, moment.bdayYear)) === "1";
    } catch {
      return false;
    }
  });

  // Only fire today → 7 days out, with a sane age, and not yet dismissed.
  if (!fundId || !moment || moment.daysUntil > 7 || moment.turningAge <= 0 || dismissed) return null;

  const child = childFirstName || "your child";
  const isToday = moment.daysUntil === 0;
  const headline = isToday
    ? `🎂 It's ${child}'s birthday today!`
    : `🎂 ${child} turns ${moment.turningAge} in ${moment.daysUntil} day${moment.daysUntil === 1 ? "" : "s"}`;
  const sub = isToday
    ? `Share ${child}'s link so the people who love ${child} can gift today.`
    : `A good moment to share ${child}'s link, so family can plan a gift.`;

  const handleDismiss = () => {
    setDismissed(true);
    try {
      if (fundId) window.localStorage.setItem(dismissKey(fundId, moment.bdayYear), "1");
    } catch {
      /* localStorage blocked — banner just won't persist its dismissal */
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      data-testid="birthday-moment-banner"
      className="relative mb-3 rounded-2xl border border-[hsl(var(--kiddo-gold)/0.35)] bg-[hsl(var(--kiddo-gold)/0.07)] px-4 py-3"
    >
      <button
        type="button"
        onClick={handleDismiss}
        aria-label="Dismiss"
        className="absolute right-2.5 top-2.5 flex h-6 w-6 items-center justify-center rounded-full text-muted-foreground/60 hover:bg-black/5 hover:text-foreground transition-colors"
      >
        <X size={14} />
      </button>
      <p className="pr-7 text-sm font-semibold text-foreground">{headline}</p>
      <p className="mt-0.5 pr-7 text-xs text-muted-foreground leading-snug">{sub}</p>
      <button
        type="button"
        onClick={onShare}
        data-testid="birthday-moment-share"
        className="mt-2.5 inline-flex items-center rounded-full bg-[hsl(var(--kiddo-gold))] px-4 py-1.5 text-xs font-semibold text-white transition active:scale-95"
      >
        Share {child}'s link
      </button>
    </motion.div>
  );
}
