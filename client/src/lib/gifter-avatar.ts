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
// Deep, desaturated tones with white text so the set stays calm and on-brand
// even in the Memory Book's quieter register (no neon).
export const GIFTER_AVATAR_COLORS = [
  { bg: "rgb(26,61,43)",   text: "white" }, // Evergreen (brand primary)
  { bg: "rgb(180,90,60)",  text: "white" }, // Terracotta
  { bg: "rgb(67,101,82)",  text: "white" }, // Sage green
  { bg: "rgb(90,65,45)",   text: "white" }, // Coffee brown
  { bg: "rgb(58,55,92)",   text: "white" }, // Indigo
  { bg: "rgb(110,70,95)",  text: "white" }, // Plum
  { bg: "rgb(70,95,120)",  text: "white" }, // Slate blue
  { bg: "rgb(40,95,100)",  text: "white" }, // Deep teal
  { bg: "rgb(122,80,40)",  text: "white" }, // Amber-brown
  { bg: "rgb(85,100,55)",  text: "white" }, // Olive
  { bg: "rgb(95,70,70)",   text: "white" }, // Rosewood
  { bg: "rgb(55,80,95)",   text: "white" }, // Deep steel
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
  // Theo's fund (the live demo) — all distinct:
  "elena rivera": 8,        // amber-brown (owner; also carries the evergreen ring)
  "marcus rivera": 10,      // rosewood
  "sofia rivera": 2,        // sage green
  "chris bennett": 9,       // olive
  "david rivera": 5,        // plum
  "robert rivera": 7,       // deep teal
  "leo rivera": 11,         // deep steel
  "auntie sarah": 3,        // coffee brown
  "the johnsons": 4,        // indigo
  "aunt pam": 6,            // slate blue
  "marcus's office": 1,     // terracotta
  // Deeper long-tail (older demo funds; best-effort spread, may reuse past 12):
  "the nguyens next door": 0,
  "uncle joe": 3,
  "helen park": 6,
  "grandpa's friend earl": 2,
  "the book club": 5,
  "coach mike": 1,
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
