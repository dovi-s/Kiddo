// Per-event-type cover treatment for suggestion tiles, active event cards, and
// the EventCreate page's preview when no custom photo is uploaded yet. The
// goal is "feels designed, not a flat-tint placeholder" — each event type
// gets its own gradient + emoji at scale so a row of suggestions reads as a
// curated set rather than seven identical-looking templates.
//
// Why not stock photos: licensing, weight, and the design lens's "no AI slop"
// rule (no AI-generated imagery, no random Unsplash that drifts off-brand).
// A small palette of brand-aligned gradients + the canonical event emoji
// matches the Apple-Settings parent register without needing image rights.
// Parents who want a real photo can still upload one and override the
// preset — the upload always wins over the theme.
//
// Color philosophy: warm/saved tones for celebrations (gold, cream, soft
// blush), green for growth/savings/college, blue for water/travel, etc.
// Two-tone diagonal gradients for movement; never red, never alarm.

export type EventCoverTheme = {
  /** CSS background value (gradient or solid). Goes onto the cover area. */
  background: string;
  /** Hex/HSL color used for any overlay accents (corner ring, wash, etc.). */
  accent: string;
  /** The canonical event emoji shown at scale on the cover. */
  emoji: string;
  /** Font color for any text painted ON the cover (e.g., "Tap to create"). */
  inkColor: string;
  /** A subtle ink color for secondary text on the cover. */
  inkColorSoft: string;
};

const FALLBACK_THEME: EventCoverTheme = {
  background: "linear-gradient(135deg, hsl(var(--kiddo-cream)) 0%, hsl(43, 60%, 92%) 100%)",
  accent: "hsl(43, 75%, 52%)",
  emoji: "✨",
  inkColor: "rgb(120, 80, 20)",
  inkColorSoft: "rgba(120, 80, 20, 0.55)",
};

// Event-type covers (from CreateEventSheet's EVENT_TYPES list).
const EVENT_TYPE_THEMES: Record<string, EventCoverTheme> = {
  birthday: {
    background: "linear-gradient(135deg, hsl(28, 88%, 92%) 0%, hsl(15, 78%, 88%) 100%)",
    accent: "hsl(15, 65%, 50%)",
    emoji: "🎂",
    inkColor: "rgb(160, 70, 30)",
    inkColorSoft: "rgba(160, 70, 30, 0.55)",
  },
  holiday: {
    background: "linear-gradient(135deg, hsl(143, 38%, 90%) 0%, hsl(143, 28%, 82%) 100%)",
    accent: "hsl(143, 47%, 38%)",
    emoji: "🎄",
    inkColor: "rgb(26, 67, 50)",
    inkColorSoft: "rgba(26, 67, 50, 0.55)",
  },
  graduation: {
    background: "linear-gradient(135deg, hsl(252, 50%, 93%) 0%, hsl(265, 40%, 86%) 100%)",
    accent: "hsl(260, 45%, 45%)",
    emoji: "🎓",
    inkColor: "rgb(76, 51, 130)",
    inkColorSoft: "rgba(76, 51, 130, 0.55)",
  },
  baby_shower: {
    background: "linear-gradient(135deg, hsl(200, 70%, 93%) 0%, hsl(210, 55%, 85%) 100%)",
    accent: "hsl(210, 55%, 50%)",
    emoji: "🍼",
    inkColor: "rgb(40, 80, 130)",
    inkColorSoft: "rgba(40, 80, 130, 0.55)",
  },
  just_because: {
    background: "linear-gradient(135deg, hsl(143, 45%, 91%) 0%, hsl(143, 30%, 84%) 100%)",
    accent: "hsl(143, 47%, 38%)",
    emoji: "💚",
    inkColor: "rgb(26, 67, 50)",
    inkColorSoft: "rgba(26, 67, 50, 0.55)",
  },
  custom: FALLBACK_THEME,
};

// Savings-goal covers (from CreateEventSheet's GOAL_TYPES list).
const SAVINGS_GOAL_THEMES: Record<string, EventCoverTheme> = {
  college: {
    background: "linear-gradient(135deg, hsl(215, 45%, 92%) 0%, hsl(225, 38%, 84%) 100%)",
    accent: "hsl(220, 50%, 38%)",
    emoji: "🎓",
    inkColor: "rgb(38, 60, 110)",
    inkColorSoft: "rgba(38, 60, 110, 0.55)",
  },
  car: {
    background: "linear-gradient(135deg, hsl(35, 60%, 92%) 0%, hsl(20, 55%, 85%) 100%)",
    accent: "hsl(25, 60%, 45%)",
    emoji: "🚗",
    inkColor: "rgb(140, 75, 30)",
    inkColorSoft: "rgba(140, 75, 30, 0.55)",
  },
  home: {
    background: "linear-gradient(135deg, hsl(143, 32%, 90%) 0%, hsl(143, 22%, 82%) 100%)",
    accent: "hsl(143, 47%, 38%)",
    emoji: "🏡",
    inkColor: "rgb(26, 67, 50)",
    inkColorSoft: "rgba(26, 67, 50, 0.55)",
  },
  travel: {
    background: "linear-gradient(135deg, hsl(195, 55%, 92%) 0%, hsl(200, 45%, 84%) 100%)",
    accent: "hsl(200, 55%, 42%)",
    emoji: "✈️",
    inkColor: "rgb(30, 80, 110)",
    inkColorSoft: "rgba(30, 80, 110, 0.55)",
  },
  business: {
    background: "linear-gradient(135deg, hsl(36, 35%, 90%) 0%, hsl(36, 28%, 82%) 100%)",
    accent: "hsl(36, 50%, 38%)",
    emoji: "💼",
    inkColor: "rgb(95, 70, 35)",
    inkColorSoft: "rgba(95, 70, 35, 0.55)",
  },
  emergency: {
    background: "linear-gradient(135deg, hsl(160, 30%, 91%) 0%, hsl(170, 25%, 83%) 100%)",
    accent: "hsl(165, 40%, 38%)",
    emoji: "🛡️",
    inkColor: "rgb(35, 80, 70)",
    inkColorSoft: "rgba(35, 80, 70, 0.55)",
  },
  custom: FALLBACK_THEME,
};

// Cultural-tradition cover overrides — used when the suggestion key is a
// tradition-driven holiday (Hanukkah, Diwali, etc.) rather than a generic
// "holiday" event type. Lets us paint Hanukkah blue+gold instead of
// generic green.
const TRADITION_KEY_THEMES: Record<string, EventCoverTheme> = {
  hanukkah: {
    background: "linear-gradient(135deg, hsl(220, 60%, 92%) 0%, hsl(220, 55%, 78%) 100%)",
    accent: "hsl(43, 75%, 52%)",
    emoji: "🕎",
    inkColor: "rgb(28, 50, 110)",
    inkColorSoft: "rgba(28, 50, 110, 0.55)",
  },
  passover: {
    background: "linear-gradient(135deg, hsl(220, 55%, 92%) 0%, hsl(43, 60%, 88%) 100%)",
    accent: "hsl(220, 50%, 40%)",
    emoji: "🍷",
    inkColor: "rgb(28, 50, 110)",
    inkColorSoft: "rgba(28, 50, 110, 0.55)",
  },
  rosh_hashanah: {
    background: "linear-gradient(135deg, hsl(43, 70%, 90%) 0%, hsl(36, 55%, 82%) 100%)",
    accent: "hsl(43, 75%, 38%)",
    emoji: "🍯",
    inkColor: "rgb(120, 80, 20)",
    inkColorSoft: "rgba(120, 80, 20, 0.55)",
  },
  bar_mitzvah: {
    background: "linear-gradient(135deg, hsl(220, 60%, 92%) 0%, hsl(43, 65%, 88%) 100%)",
    accent: "hsl(220, 50%, 40%)",
    emoji: "✡️",
    inkColor: "rgb(28, 50, 110)",
    inkColorSoft: "rgba(28, 50, 110, 0.55)",
  },
  bat_mitzvah: {
    background: "linear-gradient(135deg, hsl(220, 60%, 92%) 0%, hsl(43, 65%, 88%) 100%)",
    accent: "hsl(220, 50%, 40%)",
    emoji: "✡️",
    inkColor: "rgb(28, 50, 110)",
    inkColorSoft: "rgba(28, 50, 110, 0.55)",
  },
  christmas: {
    background: "linear-gradient(135deg, hsl(143, 35%, 88%) 0%, hsl(0, 35%, 85%) 100%)",
    accent: "hsl(0, 50%, 45%)",
    emoji: "🎄",
    inkColor: "rgb(120, 35, 35)",
    inkColorSoft: "rgba(120, 35, 35, 0.55)",
  },
  easter: {
    background: "linear-gradient(135deg, hsl(60, 50%, 92%) 0%, hsl(140, 35%, 88%) 100%)",
    accent: "hsl(143, 42%, 42%)",
    emoji: "🐣",
    inkColor: "rgb(40, 80, 50)",
    inkColorSoft: "rgba(40, 80, 50, 0.55)",
  },
  baptism: {
    background: "linear-gradient(135deg, hsl(195, 55%, 92%) 0%, hsl(195, 40%, 84%) 100%)",
    accent: "hsl(200, 55%, 42%)",
    emoji: "🕊️",
    inkColor: "rgb(30, 80, 110)",
    inkColorSoft: "rgba(30, 80, 110, 0.55)",
  },
  first_communion: {
    background: "linear-gradient(135deg, hsl(40, 60%, 94%) 0%, hsl(50, 50%, 88%) 100%)",
    accent: "hsl(43, 60%, 42%)",
    emoji: "✝️",
    inkColor: "rgb(120, 90, 30)",
    inkColorSoft: "rgba(120, 90, 30, 0.55)",
  },
  confirmation: {
    background: "linear-gradient(135deg, hsl(40, 60%, 94%) 0%, hsl(50, 50%, 88%) 100%)",
    accent: "hsl(43, 60%, 42%)",
    emoji: "✝️",
    inkColor: "rgb(120, 90, 30)",
    inkColorSoft: "rgba(120, 90, 30, 0.55)",
  },
  eid_al_fitr: {
    background: "linear-gradient(135deg, hsl(165, 35%, 90%) 0%, hsl(43, 60%, 90%) 100%)",
    accent: "hsl(165, 50%, 38%)",
    emoji: "🌙",
    inkColor: "rgb(35, 80, 70)",
    inkColorSoft: "rgba(35, 80, 70, 0.55)",
  },
  eid_al_adha: {
    background: "linear-gradient(135deg, hsl(165, 35%, 90%) 0%, hsl(43, 60%, 90%) 100%)",
    accent: "hsl(165, 50%, 38%)",
    emoji: "🕌",
    inkColor: "rgb(35, 80, 70)",
    inkColorSoft: "rgba(35, 80, 70, 0.55)",
  },
  ramadan: {
    background: "linear-gradient(135deg, hsl(245, 35%, 88%) 0%, hsl(43, 55%, 90%) 100%)",
    accent: "hsl(245, 40%, 42%)",
    emoji: "🕌",
    inkColor: "rgb(60, 60, 130)",
    inkColorSoft: "rgba(60, 60, 130, 0.55)",
  },
  diwali: {
    background: "linear-gradient(135deg, hsl(15, 70%, 88%) 0%, hsl(43, 75%, 88%) 100%)",
    accent: "hsl(15, 70%, 45%)",
    emoji: "🪔",
    inkColor: "rgb(150, 60, 30)",
    inkColorSoft: "rgba(150, 60, 30, 0.55)",
  },
  holi: {
    background: "linear-gradient(135deg, hsl(330, 55%, 90%) 0%, hsl(45, 60%, 88%) 100%)",
    accent: "hsl(330, 50%, 50%)",
    emoji: "🎨",
    inkColor: "rgb(140, 50, 100)",
    inkColorSoft: "rgba(140, 50, 100, 0.55)",
  },
  raksha_bandhan: {
    background: "linear-gradient(135deg, hsl(15, 60%, 90%) 0%, hsl(45, 55%, 88%) 100%)",
    accent: "hsl(15, 60%, 45%)",
    emoji: "🎀",
    inkColor: "rgb(150, 70, 40)",
    inkColorSoft: "rgba(150, 70, 40, 0.55)",
  },
  quinceanera: {
    background: "linear-gradient(135deg, hsl(330, 55%, 92%) 0%, hsl(345, 45%, 86%) 100%)",
    accent: "hsl(330, 50%, 50%)",
    emoji: "👑",
    inkColor: "rgb(140, 50, 100)",
    inkColorSoft: "rgba(140, 50, 100, 0.55)",
  },
  lunar_new_year: {
    background: "linear-gradient(135deg, hsl(0, 65%, 88%) 0%, hsl(43, 70%, 88%) 100%)",
    accent: "hsl(0, 60%, 45%)",
    emoji: "🏮",
    inkColor: "rgb(150, 35, 35)",
    inkColorSoft: "rgba(150, 35, 35, 0.55)",
  },
  juneteenth: {
    background: "linear-gradient(135deg, hsl(0, 50%, 88%) 0%, hsl(143, 30%, 84%) 100%)",
    accent: "hsl(0, 50%, 42%)",
    emoji: "🕯️",
    inkColor: "rgb(120, 40, 40)",
    inkColorSoft: "rgba(120, 40, 40, 0.55)",
  },
  kwanzaa: {
    background: "linear-gradient(135deg, hsl(0, 50%, 88%) 0%, hsl(143, 35%, 84%) 100%)",
    accent: "hsl(143, 47%, 38%)",
    emoji: "🕯️",
    inkColor: "rgb(120, 40, 40)",
    inkColorSoft: "rgba(120, 40, 40, 0.55)",
  },
};

// Lookup priority:
//   1. tradition-key match (e.g., "hanukkah" wins over "holiday")
//   2. savings-goal-type match
//   3. event-type match
//   4. fallback (custom theme)
//
// Pass whatever you have — suggestionKey is the preferred input since it's
// the most specific (matches "hanukkah" exactly), eventType is the broader
// fallback (matches "holiday" generically). For savings goals, pass the goal
// key (college / car / etc.) as suggestionKey OR eventType.
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
  if (sKey && TRADITION_KEY_THEMES[sKey]) return TRADITION_KEY_THEMES[sKey];

  const goal = String(savingsGoalType || "").toLowerCase();
  if (goal && SAVINGS_GOAL_THEMES[goal]) return SAVINGS_GOAL_THEMES[goal];

  const type = String(eventType || "").toLowerCase();
  if (type && EVENT_TYPE_THEMES[type]) return EVENT_TYPE_THEMES[type];
  if (type && SAVINGS_GOAL_THEMES[type]) return SAVINGS_GOAL_THEMES[type];

  return FALLBACK_THEME;
}
