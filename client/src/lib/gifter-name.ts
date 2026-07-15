// Shared gifter display-name helper. A naive first-word split mangles the warm,
// descriptive names families actually use on gift links: "Aunt Sarah" -> "Aunt",
// "The Johnsons" -> "The", "Marcus's office" -> "Marcus's", "Uncle Joe" -> "Uncle".
//
// Two passes:
//   1. The first real NAME wins. Skip leading weak tokens (titles / relations /
//      articles) and possessives, and return the first capitalized identity
//      word: "Coach Mike" -> "Mike", "Aunt Sarah" -> "Sarah", "The Johnsons" ->
//      "Johnsons", "Grandpa's friend Earl" -> "Earl", "Sofia Rivera" ->
//      "Sofia".
//   2. No real name means a DESCRIPTIVE group ("The book club", "A friend",
//      "Marcus's office"). Drop only leading weak LEADERS and keep the rest whole,
//      so the identity survives ("book club", "friend", "Marcus's office") instead
//      of collapsing to a bare noun ("book", "office") that reads wrong in
//      "office's story". A possessive is NOT a weak leader, so "Marcus's office"
//      keeps its "Marcus's".
//
// Single source of truth: Dashboard (Who-loves roster) and Memory Book (the
// gifter list + filter labels) both import this so they can't drift; the
// Memory Book previously used `name.split(" ")[0]` and rendered the broken
// "Uncle / Aunt / The / Marcus's" the Dashboard never showed.

export const WEAK_NAME_LEADERS = new Set([
  "the", "a", "an", "my", "our", "big", "little", "great", "old", "young",
  "aunt", "auntie", "uncle", "unc", "grandpa", "grandma", "granny", "gran", "nana",
  "papa", "gramps", "cousin", "cuz", "godmother", "godfather", "ninang", "ninong",
  "coach", "mr", "mrs", "ms", "miss", "mx", "dr", "doc", "sir", "prof", "professor",
  "pastor", "father", "fr", "sister", "rabbi", "reverend", "rev", "senor", "senora",
]);

const cleanToken = (w: string): string => w.toLowerCase().replace(/[.,]/g, "");

/**
 * Stable IDENTITY key for grouping a gifter across surfaces (the "who loves
 * {kid}" roster, the holding-detail contributor list). Keyed by EMAIL when we
 * have one, so the same person signing different names ("Sofia Rivera" once,
 * "Grandma" the next) collapses to ONE gifter — and two different people who
 * happen to share a name (different emails) stay separate. Before this, those
 * surfaces grouped by NAME, which fragmented one person into several rows and
 * over-counted "N people gave" (founder catch 2026-06-08).
 *
 * Rules, chosen to preserve every existing grouping EXCEPT the two bugs above:
 *  - Anonymous (flag / empty / "Anonymous" / "Someone who loves…") → one shared
 *    "anon" bucket, matching the roster's prior behavior (a kid sees "Anonymous",
 *    not N variants). Anonymous is NEVER email-keyed even if an email exists.
 *  - Named + email → "e:<lowercased email>" (the dedup fix; also case/whitespace
 *    robust, which is why gifts should store a normalized email — see
 *    storage.createGift).
 *  - Named, no email (manual/cash gifts) → "n:<lowercased name>" (UNCHANGED
 *    grouping — same as the old name key, just prefixed).
 *
 * This decides IDENTITY only. The DISPLAYED name is the caller's job (resolve to
 * the most-recent gift's name, with the account's preferredName overriding).
 */
// The canonical anon-gifter predicate lives in shared/ so client AND server use
// one source (shared/gifter-anon.ts). Imported for local use below + re-exported
// so existing `@/lib/gifter-name` importers keep working unchanged.
import { isAnonGifterName } from "@shared/gifter-anon";
export { isAnonGifterName };

export function gifterIdentityKey(
  senderName?: string | null,
  senderEmail?: string | null,
  isAnonymous?: boolean,
): string {
  const n = String(senderName || "").trim();
  const isAnon = isAnonymous === true || isAnonGifterName(senderName);
  if (isAnon) return "anon";
  const email = String(senderEmail || "").trim().toLowerCase();
  return email ? `e:${email}` : `n:${n.toLowerCase()}`;
}

export function gifterShortName(name?: string | null): string {
  const trimmed = String(name || "").trim();
  if (!trimmed) return trimmed;
  const words = trimmed.split(/\s+/);

  // Pass 1: first capitalized name that isn't a weak leader or a possessive.
  // If that capitalized word IMMEDIATELY follows a possessive, keep the owner
  // ("Marcus's Office" -> "Marcus's Office", not a bare "Office") — but only when the
  // possessive is the directly-preceding word, so "Grandpa's friend Earl" still
  // yields "Earl" (the name follows "friend", not the possessive). A possessive
  // whose BASE is itself a weak leader never counts as an owner: "Grandpa's
  // Marcus" -> "Marcus", not "Grandpa's Marcus" (code-review catch 2026-06-04 —
  // relationship possessives are descriptors, not identities).
  const possessiveBase = (w: string): string => cleanToken(w).replace(/['’]s$/, "");
  for (let i = 0; i < words.length; i++) {
    const w = words[i];
    if (WEAK_NAME_LEADERS.has(cleanToken(w))) continue;
    if (/['’]s$/.test(w)) continue;
    if (/^[A-Z]/.test(w)) {
      const prev = i > 0 ? words[i - 1] : "";
      const prevIsOwnerPossessive = /['’]s$/.test(prev) && !WEAK_NAME_LEADERS.has(possessiveBase(prev));
      return prevIsOwnerPossessive ? `${prev} ${w}` : w;
    }
  }

  // Pass 2: descriptive phrase. Drop leading weak leaders, keep the rest whole.
  let start = 0;
  while (start < words.length && WEAK_NAME_LEADERS.has(cleanToken(words[start]))) start++;
  return words.slice(start).join(" ") || words[0];
}
