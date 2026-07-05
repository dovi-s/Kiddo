// Single source of truth for gifter initials-avatar colors.
//
// Used by every surface that draws a gifter's letter tile — the dashboard
// "building {child}'s future" roster, the Memory Book "Who loves {child}" strip,
// and the Memory Book timeline/book-page entries — so the SAME person is the
// SAME color on every screen. Before this, the dashboard and the Memory Book
// each defined their own palette + hash (and the Memory Book strip had been made
// a flat evergreen with no per-person color at all), so Marcus was, say, teal on
// the dashboard and evergreen in the Memory Book. That cross-surface mismatch is
// the bug this module exists to kill.
//
// Color is a PURE function of the gifter's identity (their resolved name,
// normalized) — no position/order/neighbor-dependent adjustment. That purity is
// exactly what guarantees consistency: an order-dependent "de-collision" pass
// (which we used to run on the dashboard to avoid two adjacent same-colored
// faces) gives the SAME person a DIFFERENT color on two lists whose membership
// or sort order differs, which is precisely the surfaces we're trying to align.
// The trade is deliberate and unavoidable: you can have "always distinct within
// one list" OR "always identical across lists," not both, once a roster can
// exceed the palette. The founder's report was about the cross-surface case, so
// consistency wins; the larger palette below keeps accidental repeats rare.
//
// WARM EARTH TONES ONLY — greens, golds, clays, browns (no blue / purple / cool
// teal). The set reads as ONE cohesive on-brand constellation, calm enough for the
// Memory Book's quieter register, with white text for contrast. Replaced the old
// indigo / plum / slate / steel — cool hues that read as a random color-generator
// against the cream/evergreen brand, not a designed roster of the people who love a kid.
export const GIFTER_AVATAR_COLORS = [
  { bg: "rgb(26,61,43)",   text: "white" }, // 0  Evergreen (brand primary)
  { bg: "rgb(46,84,60)",   text: "white" }, // 1  Forest
  { bg: "rgb(78,103,82)",  text: "white" }, // 2  Sage
  { bg: "rgb(96,104,54)",  text: "white" }, // 3  Olive
  { bg: "rgb(140,104,42)", text: "white" }, // 4  Brass
  { bg: "rgb(146,92,42)",  text: "white" }, // 5  Amber
  { bg: "rgb(178,90,58)",  text: "white" }, // 6  Terracotta
  { bg: "rgb(158,74,48)",  text: "white" }, // 7  Rust
  { bg: "rgb(142,84,62)",  text: "white" }, // 8  Clay
  { bg: "rgb(96,68,48)",   text: "white" }, // 9  Coffee
  { bg: "rgb(116,86,58)",  text: "white" }, // 10 Walnut
  { bg: "rgb(124,80,74)",  text: "white" }, // 11 Rosewood
];

export type GifterAvatarColor = (typeof GIFTER_AVATAR_COLORS)[number];

// Demo-cast color pins. The Rivera demo is the conversion surface, so its named
// gifters should each read as a DISTINCT color (no two-people-same-color), which
// pure hashing can't guarantee once a roster approaches the palette size. These
// pins give the live demo fund (Theo) 11 distinct colors and spread the deeper
// long-tail (older demo funds) across the rest. Keyed by the gifter's FULL name
// — exactly what every surface hashes — normalized. Applied globally, which is
// harmless: these are demo-specific names, and even an exact real-world match
// just yields a different-but-still-valid deterministic color. Real gifters (no
// pin) keep the robust per-identity hash below, so this never reintroduces the
// cross-surface drift — a pinned person is the same color everywhere too.
// Indices map into GIFTER_AVATAR_COLORS above.
const DEMO_CAST_COLOR_OVERRIDES: Record<string, number> = {
  // Theo's fund (the live demo). Pinned to ALTERNATE green ↔ warm down the roster's
  // fixed recency order (You, Leo, Marcus, Chris, Sofia, David, Robert, office) so no
  // two adjacent faces read as the same family — a considered constellation, not a run
  // of look-alike oranges. All 11 distinct. Elena (owner) stays off-green so her face
  // reads against the evergreen ring.
  "elena rivera": 5,        // amber  (You)
  "leo rivera": 2,          // sage   (green)
  "marcus rivera": 7,       // rust   (warm)
  "chris bennett": 1,       // forest (green)
  "sofia rivera": 6,        // terracotta (warm)
  "david rivera": 3,        // olive  (green)
  "robert rivera": 8,       // clay   (warm)
  "marcus's office": 9,     // coffee (deep brown)
  "auntie sarah": 10,       // walnut
  "the johnsons": 4,        // brass
  "aunt pam": 11,           // rosewood
  // Deeper long-tail (older demo funds; best-effort spread, may reuse past 11):
  "the nguyens next door": 0,
  "uncle joe": 9,
  "helen park": 4,
  "grandpa's friend earl": 2,
  "the book club": 7,
  "coach mike": 6,
};

// Stable hash → palette index. Normalizes case + surrounding whitespace so the
// same person resolves identically no matter which surface's copy of their name
// reaches here. Demo-cast pins (above) win when present.
export function gifterAvatarColorIdx(key: string): number {
  const k = (key || "").trim().toLowerCase();
  if (Object.prototype.hasOwnProperty.call(DEMO_CAST_COLOR_OVERRIDES, k)) {
    return DEMO_CAST_COLOR_OVERRIDES[k];
  }
  let h = 0;
  for (let i = 0; i < k.length; i++) h = (h * 31 + k.charCodeAt(i)) >>> 0;
  return GIFTER_AVATAR_COLORS.length ? h % GIFTER_AVATAR_COLORS.length : 0;
}

export function gifterAvatarColor(key: string): GifterAvatarColor {
  return GIFTER_AVATAR_COLORS[gifterAvatarColorIdx(key)];
}
