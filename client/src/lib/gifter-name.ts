// Shared gifter display-name helper. A naive first-word split mangles the warm,
// descriptive names families actually use on gift links: "Aunt Sarah" -> "Aunt",
// "The Johnsons" -> "The", "Phil's office" -> "Phil's", "Uncle Joe" -> "Uncle".
//
// Two passes:
//   1. The first real NAME wins. Skip leading weak tokens (titles / relations /
//      articles) and possessives, and return the first capitalized identity
//      word: "Coach Mike" -> "Mike", "Aunt Sarah" -> "Sarah", "The Johnsons" ->
//      "Johnsons", "Grandpa's friend Earl" -> "Earl", "Gloria Pritchett" ->
//      "Gloria".
//   2. No real name means a DESCRIPTIVE group ("The book club", "A friend",
//      "Phil's office"). Drop only leading weak LEADERS and keep the rest whole,
//      so the identity survives ("book club", "friend", "Phil's office") instead
//      of collapsing to a bare noun ("book", "office") that reads wrong in
//      "office's story". A possessive is NOT a weak leader, so "Phil's office"
//      keeps its "Phil's".
//
// Single source of truth: Dashboard (Who-loves roster) and Memory Book (the
// gifter list + filter labels) both import this so they can't drift; the
// Memory Book previously used `name.split(" ")[0]` and rendered the broken
// "Uncle / Aunt / The / Phil's" the Dashboard never showed.

export const WEAK_NAME_LEADERS = new Set([
  "the", "a", "an", "my", "our", "big", "little", "great", "old", "young",
  "aunt", "auntie", "uncle", "unc", "grandpa", "grandma", "granny", "gran", "nana",
  "papa", "gramps", "cousin", "cuz", "godmother", "godfather", "ninang", "ninong",
  "coach", "mr", "mrs", "ms", "miss", "mx", "dr", "doc", "sir", "prof", "professor",
  "pastor", "father", "fr", "sister", "rabbi", "reverend", "rev", "senor", "senora",
]);

const cleanToken = (w: string): string => w.toLowerCase().replace(/[.,]/g, "");

export function gifterShortName(name?: string | null): string {
  const trimmed = String(name || "").trim();
  if (!trimmed) return trimmed;
  const words = trimmed.split(/\s+/);

  // Pass 1: first capitalized name that isn't a weak leader or a possessive.
  for (const w of words) {
    if (WEAK_NAME_LEADERS.has(cleanToken(w))) continue;
    if (/['’]s$/.test(w)) continue;
    if (/^[A-Z]/.test(w)) return w;
  }

  // Pass 2: descriptive phrase. Drop leading weak leaders, keep the rest whole.
  let start = 0;
  while (start < words.length && WEAK_NAME_LEADERS.has(cleanToken(words[start]))) start++;
  return words.slice(start).join(" ") || words[0];
}
