// Time-derived settlement status for "moved to cash" (sell) activity.
//
// A sell row used to carry a STATIC line ("Cash will settle in 1 to 2 business
// days" / a "Cash (1-2 days)" chip). That's a point-in-time claim: look at the
// row a week later and it's lying, because the cash settled days ago. For a
// product about real money and honest numbers, a perpetually-pending line
// quietly erodes trust.
//
// Settlement is deterministic from the trade date (US equities settle T+1; we
// use T+2 business days as a conservative "definitely settled by", so we never
// falsely say "settled" while it might still be pending). So we can resolve the
// status purely from the date at render time. No custody webhook, no worker,
// no stored status field. Same pattern as the reverse-trial auto-revert: the
// state is a function of time, not a flag someone has to flip. When real
// custody is wired, a broker settlement event can confirm/override, but this
// estimate is correct in the meantime.

export type CashSettlement = { settled: boolean; settlesOn: Date | null };

// Add N business days (skip Sat/Sun) in UTC, so the calendar date is stable
// regardless of the viewer's timezone. Does not account for market holidays;
// the T+2 conservatism absorbs the occasional holiday slip.
export function addBusinessDays(start: Date, n: number): Date {
  const d = new Date(start.getTime());
  let added = 0;
  while (added < n) {
    d.setUTCDate(d.getUTCDate() + 1);
    const day = d.getUTCDay();
    if (day !== 0 && day !== 6) added++;
  }
  return d;
}

export function cashSettlement(
  tradeDate: Date | string | null | undefined,
  now: Date = new Date(),
): CashSettlement {
  if (!tradeDate) return { settled: false, settlesOn: null };
  const start = tradeDate instanceof Date ? tradeDate : new Date(tradeDate);
  if (Number.isNaN(start.getTime())) return { settled: false, settlesOn: null };
  const settlesOn = addBusinessDays(start, 2);
  return { settled: now.getTime() >= settlesOn.getTime(), settlesOn };
}

function fmtShort(d: Date): string {
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" });
}

// Chip label for the sell "What moved" panel: resolves from "settles {date}"
// to "settled" as the date passes.
export function cashAfterLabel(tradeDate: Date | string | null | undefined, now?: Date): string {
  const { settled, settlesOn } = cashSettlement(tradeDate, now);
  if (!settlesOn) return "Cash";
  return settled ? "Cash · settled" : `Cash · settles ${fmtShort(settlesOn)}`;
}

// Swap the baked-in static timing sentences in a stored description for
// date-aware ones. Covers both money movements the activity feed bakes a stale
// window into:
//   - Sell  -> "Cash will settle / Cash settles in 1 to 2 business days" (T+2).
//   - Withdrawal -> "Expect 1 to 3 business days" (T+3).
// No-op on any description that doesn't contain one of these (every other row),
// so it's safe to apply to the row description unconditionally.
export function rewriteSettlementSentence(
  desc: string | null | undefined,
  tradeDate: Date | string | null | undefined,
  now: Date = new Date(),
): string {
  let text = String(desc || "");
  const start = tradeDate instanceof Date ? tradeDate : tradeDate ? new Date(tradeDate) : null;
  if (!text || !start || Number.isNaN(start.getTime())) return text;

  // Sell cash settlement, T+2. Matches both "will settle in" and "settles in".
  const settles = addBusinessDays(start, 2);
  const settled = now.getTime() >= settles.getTime();
  text = text.replace(
    /Cash (?:will settle|settles) in 1[\s-]*(?:to[\s-]*)?2 business days\.?/i,
    settled ? `Cash settled ${fmtShort(settles)}.` : `Cash settles ${fmtShort(settles)}.`,
  );

  // Withdrawal bank transfer, ~T+3. Once past the window the "sent to {bank}"
  // clause stands on its own and we can't confirm bank-side arrival, so drop
  // the expectation rather than keep a stale "Expect 1 to 3 business days".
  const arrives = addBusinessDays(start, 3);
  const arrived = now.getTime() >= arrives.getTime();
  text = text.replace(
    /\s*Expect 1[\s-]*(?:to[\s-]*)?3 business days\.?/i,
    arrived ? "" : ` Arriving by ${fmtShort(arrives)}.`,
  );

  return text;
}
