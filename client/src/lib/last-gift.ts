// "Give again" memory — a returning gifter's LAST gift to a given fund, so the
// next visit can pre-fill the amount + stock instead of making grandma re-decide
// from scratch. The friction-shaver for the repeat gift, which is the loop.
//
// GUARDRAILS (deliberate, mirrors lib/last-auth-method):
//   • LOCAL ONLY — never sent to the server; a device-side convenience.
//   • NO PII — stores only amount / stock / how, NEVER the gifter's name, email,
//     message, or any recipient identity beyond the public fund slug in the key.
//   • PER-FUND — keyed by fund slug, so it only pre-fills for the same child.
//   • PRE-FILL, NEVER PRE-CHARGE — callers must still show the normal confirm +
//     payment step. This only seeds the form; it never moves money.

export type LastGift = {
  amount: number;
  /** true if the amount came from the custom field (not a quick-pick preset). */
  isCustom: boolean;
  /** ticker when they picked a single stock; null for the diversified/auto mix. */
  stock: string | null;
  /** "pick" | "auto" — which execution model they chose. */
  executionModel: string;
  ts: number;
};

const keyFor = (fundSlug: string) => `kiddo:last-gift:${fundSlug}`;

export function setLastGift(fundSlug: string, gift: Omit<LastGift, "ts">): void {
  if (!fundSlug) return;
  try {
    localStorage.setItem(keyFor(fundSlug), JSON.stringify({ ...gift, ts: Date.now() }));
  } catch {
    /* private mode / storage blocked — no memory, no worse than before */
  }
}

export function getLastGift(fundSlug: string): LastGift | null {
  if (!fundSlug) return null;
  try {
    const raw = localStorage.getItem(keyFor(fundSlug));
    if (!raw) return null;
    const d = JSON.parse(raw);
    if (typeof d?.amount !== "number" || !(d.amount > 0)) return null;
    return {
      amount: d.amount,
      isCustom: Boolean(d.isCustom),
      stock: typeof d.stock === "string" ? d.stock : null,
      executionModel: d.executionModel === "pick" ? "pick" : "auto",
      ts: typeof d.ts === "number" ? d.ts : 0,
    };
  } catch {
    return null;
  }
}
