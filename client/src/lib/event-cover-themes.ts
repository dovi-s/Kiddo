// Cover treatment for occasion/goal tiles, active event cards, and the
// EventCreate preview when no custom photo is uploaded yet.
//
// ONE cohesive warm treatment for every type. We used to give each event type
// its own colored gradient (peach birthday, purple graduation, blue baby
// shower, green holiday...) so a row would "read as a curated set." In practice
// the hue variety fought Kiddo's restrained warm brand (cream / tan / gold /
// evergreen): the off-palette purples, blues, and pinks read as a rainbow, not
// a premium product. The EMOJI already differentiates each occasion (birthday
// vs graduation vs holiday), so identity survives without per-type color.
//
// So: one warm gold/cream gradient across the picker tiles, the Dashboard
// occasion cards, the EventCreate preview, and the gift page. It deliberately
// matches the Memory Book occasion strip's placeholder
// (hsl(--kiddo-gold)/0.18 -> hsl(--kiddo-cream)) so every occasion surface in
// the app looks like one designed system. Parents who upload a real photo
// still override the theme (the upload always wins).
//
// Why not stock photos: licensing, weight, and the "no AI slop" rule (no
// AI-generated imagery, no random Unsplash that drifts off-brand). A warm
// brand gradient + the canonical event emoji matches the Apple-Settings parent
// register without needing image rights.

export type EventCoverTheme = {
  /** CSS background value (gradient or solid). Goes onto the cover area. */
  background: string;
  /** Hex color used for any overlay accents (corner ring, faint border, etc.). */
  accent: string;
  /** The canonical event emoji shown at scale on the cover. */
  emoji: string;
  /** Font color for any text painted ON the cover (e.g., "Tap to create"). */
  inkColor: string;
  /** A subtle ink color for secondary text on the cover. */
  inkColorSoft: string;
};

// The single warm cover look. Background matches the Memory Book occasion-card
// placeholder verbatim so the two surfaces are identical. Accent is the brand
// gold as HEX (so consumers that append an alpha suffix like `${accent}33`
// resolve to a valid faint-gold hairline). Ink is a warm brown-gold that reads
// cleanly on cream.
const WARM_COVER: Omit<EventCoverTheme, "emoji"> = {
  background: "linear-gradient(135deg, hsl(var(--kiddo-gold)/0.18), hsl(var(--kiddo-cream)))",
  accent: "#b8791a",
  inkColor: "rgb(120, 80, 20)",
  inkColorSoft: "rgba(120, 80, 20, 0.55)",
};

// The emoji is the only per-type identity now. Keep every key that used to
// resolve to a theme so no occasion loses its emoji. (event types + savings
// goals + cultural traditions, all flattened into one lookup namespace.)
const FALLBACK_EMOJI = "✨";
const EVENT_EMOJI: Record<string, string> = {
  // Event types (CreateEventSheet's EVENT_TYPES).
  birthday: "🎂",
  holiday: "🎄",
  graduation: "🎓",
  baby_shower: "🍼",
  just_because: "💚",
  // Savings-goal types (CreateEventSheet's GOAL_TYPES).
  college: "🎓",
  car: "🚗",
  home: "🏡",
  travel: "✈️",
  business: "💼",
  emergency: "🛡️",
  // Cultural-tradition keys (suggestion-driven holidays).
  hanukkah: "🕎",
  passover: "🍷",
  rosh_hashanah: "🍯",
  bar_mitzvah: "✡️",
  bat_mitzvah: "✡️",
  christmas: "🎄",
  easter: "🐣",
  baptism: "🕊️",
  first_communion: "✝️",
  confirmation: "✝️",
  eid_al_fitr: "🌙",
  eid_al_adha: "🕌",
  ramadan: "🕌",
  diwali: "🪔",
  holi: "🎨",
  raksha_bandhan: "🎀",
  quinceanera: "👑",
  lunar_new_year: "🏮",
  juneteenth: "🕯️",
  kwanzaa: "🕯️",
  custom: FALLBACK_EMOJI,
};

// Emoji lookup priority (same specificity order as before the unify):
//   1. tradition / suggestion key (e.g., "hanukkah" beats "holiday")
//   2. savings-goal type (college / car / ...)
//   3. event type (birthday / holiday / ...)
//   4. fallback emoji
//
// The color is always the one warm treatment; only the emoji varies.
export function getEventCoverTheme({
  suggestionKey,
  eventType,
  savingsGoalType,
}: {
  suggestionKey?: string | null;
  eventType?: string | null;
  savingsGoalType?: string | null;
}): EventCoverTheme {
  const sKey = String(suggestionKey || "").toLowerCase();
  const goal = String(savingsGoalType || "").toLowerCase();
  const type = String(eventType || "").toLowerCase();

  const emoji =
    EVENT_EMOJI[sKey] || EVENT_EMOJI[goal] || EVENT_EMOJI[type] || FALLBACK_EMOJI;

  return { ...WARM_COVER, emoji };
}
