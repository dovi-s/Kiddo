// Shared gifter display-name helper. A naive first-word split mangles the warm,
// descriptive names families actually use on gift links: "Aunt Sarah" -> "Aunt",
// "The Johnsons" -> "The", "Phil's office" -> "Phil's", "Uncle Joe" -> "Uncle".
// Instead, show the first word that carries IDENTITY by skipping leading weak
// tokens (titles/relations/articles/possessives): "Coach Mike" -> "Mike",
// "Aunt Sarah" -> "Sarah", "The Johnsons" -> "Johnsons", "Phil's office" ->
// "office". A plain first name isn't weak, so "Gloria Pritchett" -> "Gloria"
// exactly as a person expects.
//
// Single source of truth: Dashboard (Who-loves roster) and Memory Book (the
// gifter list + filter labels) both import this so they can't drift — the
// Memory Book previously used `name.split(" ")[0]` and rendered the broken
// "Uncle / Aunt / The / Phil's" the Dashboard never showed.

export const WEAK_NAME_LEADERS = new Set([
  "the", "a", "an", "my", "our", "big", "little", "great", "old", "young",
  "aunt", "auntie", "uncle", "unc", "grandpa", "grandma", "granny", "gran", "nana",
  "papa", "gramps", "cousin", "cuz", "godmother", "godfather", "ninang", "ninong",
  "coach", "mr", "mrs", "ms", "miss", "mx", "dr", "doc", "sir", "prof", "professor",
  "pastor", "father", "fr", "sister", "rabbi", "reverend", "rev", "senor", "senora",
]);

export function gifterShortName(name?: string | null): string {
  const trimmed = String(name || "").trim();
  if (!trimmed) return trimmed;
  const words = trimmed.split(/\s+/);
  for (const w of words) {
    const lc = w.toLowerCase().replace(/[.,]/g, "");
    if (!WEAK_NAME_LEADERS.has(lc) && !/['’]s$/.test(w)) return w;
  }
  return words[0]; // all tokens were weak/possessive — fall back to the first
}
