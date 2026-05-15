// Display-time first-letter capitalization for names, pronouns, and
// sentence starts. The single canonical helper.
//
// Why one helper instead of several call-site definitions:
// Before 2026-05-15 the codebase had 3 different local `capFirst`
// helpers (Dashboard.tsx, Age18Plan.tsx, NoteEditorSheet.tsx) plus
// a `capitalizeFirst` in GetStarted.tsx. Three were the simple
// single-letter form (good for pronouns, OK for single-word names);
// the GetStarted one handled multi-segment names so a parent who
// typed "mary anne" or "mary-anne" lowercase didn't see it stay
// lowercase mid-segment. Same job, different implementations, drift
// over time. Consolidated to this file 2026-05-15.
//
// Behavior:
//   - undefined / null / empty / whitespace-only → "" (safe for ??)
//   - single-segment input ("lauren", "she", "they") → "Lauren",
//     "She", "They" (identical to the prior simple helpers)
//   - multi-segment input split on whitespace OR hyphens
//     ("mary anne", "mary-anne") → "Mary Anne", "Mary-Anne"
//   - intentional mid-segment capitalization preserved
//     ("McAdams", "DeAngelo") → unchanged. The helper only upper-
//     cases when the segment STARTS with lowercase.
//
// Display-only. Never mutates stored data — call sites pass the raw
// DB value, this returns the formatted display string. Parents who
// typed "lauren" lowercase keep their input as-typed in storage;
// the UI just renders it warmly.

const SEGMENT_DELIMITERS = /(\s|-)/;
const STARTS_WITH_LOWERCASE = /^[a-z]/;

export function capFirst(input: string | null | undefined): string {
  if (!input) return "";
  const trimmed = input.trim();
  if (!trimmed) return "";
  return trimmed
    .split(SEGMENT_DELIMITERS)
    .map((segment) => (segment.length > 0 && STARTS_WITH_LOWERCASE.test(segment) ? segment.charAt(0).toUpperCase() + segment.slice(1) : segment))
    .join("");
}
