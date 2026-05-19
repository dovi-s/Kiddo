// GiftSourceChip — answers "where did this gift come from" for a single
// gift row. Renders only when the gift came via a specific occasion page
// (eventName populated). Absence-of-chip means the implicit-default main
// gift page path — by design we don't label that case, because it's the
// 80%+ path and labeling every row "via main gift page" adds chrome to
// surfaces that are already information-dense.
//
// Locked design (2026-05-19):
//   - Small metadata chip, NOT a colored callout pill. Apple-Settings
//     register. Reads as "context" not "look at me."
//   - 📅 calendar glyph because every "where" answer in this product is
//     "an occasion / event." If a non-event source path ever appears
//     (e.g. a kid stock-suggestion page in the future), this component
//     can fork on `source` kind; for now there's only one non-default
//     source.
//   - Truncates long event names with title attribute carrying the full
//     value. Birthdays / bar mitzvahs typically fit; longer custom
//     event names (e.g. "Grandpa's 80th + Emma's 7th joint celebration")
//     get truncated visually but preserved on hover/screen-reader.
//
// Consumers (one today, sweep planned for later):
//   - GiftersAcrossFundsSheet recent-gift rows  ✓ live
//   - Memory Book gift entries                  ☐ next sweep
//   - Activity feed gift-received rows          ☐ next sweep
//   - HoldingDetailSheet contributor rows       ☐ next sweep
//
// The sweep is deliberately deferred — land the chip pattern in the
// sheet first, iterate styling there if needed, then roll out cleanly.

import { Calendar } from "lucide-react";

interface GiftSourceChipProps {
  eventName?: string | null;
  // Optional className passthrough for callers that need to tweak
  // alignment in a row. The chip's own visual styling is fixed.
  className?: string;
}

export function GiftSourceChip({ eventName, className = "" }: GiftSourceChipProps) {
  const name = String(eventName || "").trim();
  if (!name) return null;
  return (
    <span
      className={`inline-flex items-center gap-1 max-w-full rounded-full bg-[hsl(var(--kiddo-cream-dark)/0.55)] px-2 py-0.5 text-[10.5px] font-semibold text-foreground/75 ${className}`}
      title={name}
      data-testid="gift-source-chip"
    >
      <Calendar size={10} className="flex-shrink-0 opacity-70" aria-hidden />
      <span className="truncate">{name}</span>
    </span>
  );
}
