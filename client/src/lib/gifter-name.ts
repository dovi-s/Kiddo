// Shared gifter display-name helper. A naive first-word split mangles the warm,
// descriptive names families actually use on gift links: "Aunt Sarah" -> "Aunt",
// "The Johnsons" -> "The", "Phil's office" -> "Phil's", "Uncle Joe" -> "Uncle".
// Instead, show the first word that carries IDENTITY by skipping leading weak
// tokens (titles/relations/articles): "Coach Mike" -> "Mike", "Aunt Sarah" ->
// "Sarah", "The Johnsons" -> "Johnsons". A possessive that owns a common noun
// stays whole ("Phil's office" -> "Phil's office", not the bare "office" that
// reads wrong in "office's story"); a possessive leading a real name is
// stripped ("Phil's Sarah" -> "Sarah"). A plain first name isn't weak, so
// "Gloria Pritchett" -> "Gloria" exactly as a person expects.
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

export function gifterShortName(name?: string | null): string {
  const trimmed = String(name || "").trim();
  if (!trimmed) return trimmed;
  const words = trimmed.split(/\s+/);
  for (let i = 0; i < words.length; i++) {
    const w = words[i];
    const lc = w.toLowerCase().replace(/[.,]/g, "");
    if (WEAK_NAME_LEADERS.has(lc)) continue;
    if (/['’]s$/.test(w)) {
      // A possessive ("Phil's") is only a weak LEADER when a real name follows
      // it ("Phil's Sarah" -> "Sarah"). When it owns a common noun ("Phil's
      // office", "Mom's book club"), the possessive phrase IS the identity;
      // stripping it leaves a bare noun ("office") that reads wrong in
      // "office's story". Keep the whole phrase unless a proper name follows.
      const properFollows = words.slice(i + 1).some(
        (x) => /^[A-Z]/.test(x) && !WEAK_NAME_LEADERS.has(x.toLowerCase().replace(/[.,]/g, "")),
      );
      if (!properFollows) return words.slice(i).join(" ");
      continue;
    }
    return w;
  }
  return words[0]; // all tokens were weak/possessive; fall back to the first
}
