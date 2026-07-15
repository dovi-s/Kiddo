// Canonical "is this gifter effectively nameless / anonymous?" predicate — the
// ONE place this rule lives, shared by the client (dashboard roster, Memory Book
// roster + timeline + filters, Activity, holding sheet, since-last-visit digest,
// fund snapshot) AND the server (gifter notification + year-end workers,
// community chart bucketing). Every layer folds the SAME senders into Anonymous,
// so a placeholder like "Someone" can never render as a named contributor on one
// surface while being anonymous on another. Covers: blank, the "someone who loves
// …" share default, the literal "Anonymous" and "Someone" placeholders, and known
// dev test-sender names.
export const ANON_TEST_SENDER_NAMES = ["test", "testing", "qqqqq", "tstgin", "tstng", "tester"];

export function isAnonGifterName(name?: string | null): boolean {
  const n = String(name || "").trim();
  if (!n) return true;
  const lc = n.toLowerCase();
  return /^someone who loves/i.test(n) || lc === "anonymous" || lc === "someone" || ANON_TEST_SENDER_NAMES.includes(lc);
}
