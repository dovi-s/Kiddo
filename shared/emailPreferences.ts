// Email preference categories + helpers. Shared between server
// (workers checking before send + API endpoint) and client (Settings
// UI toggles). One source of truth for the category list.

// Optional categories — every key here renders a toggle in the
// Settings UI and gets a preference check in the matching worker
// before send.
//
// The order in this array drives the order in the Settings UI.
// Keep them grouped: celebratory first, reflective middle,
// seasonal last.
export const EMAIL_PREFERENCE_CATEGORIES = [
  {
    key: "birthday",
    label: "Birthday from the fund",
    description: "A once-a-year note from the fund itself on your child's birthday.",
  },
  {
    key: "anniversary",
    label: "Fund anniversary",
    description: "A once-a-year note on the calendar anniversary of starting the fund.",
  },
  {
    key: "milestones",
    label: "Kid-age milestones",
    description: "Reflective notes at ages 5, 10, 13, and 16.",
  },
  {
    key: "monthlyPulse",
    label: "Monthly fund pulse",
    description: "A short monthly summary of how the fund changed.",
  },
  {
    key: "volatility",
    label: "Volatility reassurance",
    description: "A calming note when markets move sharply.",
  },
  {
    key: "motherFathersDay",
    label: "Mother's Day and Father's Day",
    description: "Warmth-only notes on the two holidays. No upgrade push.",
  },
  {
    key: "taxPrep",
    label: "Tax-season prep",
    description: "A January reminder about your child's UTMA tax documents.",
  },
  {
    key: "gifterReturn",
    label: "Gifter return-year reminder",
    description: "When a gifter hasn't given in a year, a soft prompt to remind them.",
  },
  {
    key: "wrapped",
    label: "Year-end Wrapped",
    description: "December year-in-review with growth and notable moments.",
  },
  // Parent engagement drip (server: parentLifecycleWorker). These fire
  // only for a parent-held child fund and are opt-out like the rest.
  // Kept distinct from the warmth notes above: "Fund milestones" tracks
  // gift-total thresholds (not kid ages), and "Birthday reminders" is the
  // pre-birthday heads-up (not the fund's on-the-day birthday note).
  {
    key: "activationNudges",
    label: "Getting-started nudges",
    description: "Setup follow-ups on days 1, 3, and 7 after you start the fund.",
  },
  {
    key: "fundMilestones",
    label: "Fund milestones",
    description: "When the first gift lands and each time the fund passes $100, $500, and $1,000.",
  },
  {
    key: "birthdayDormant",
    label: "Birthday reminders and check-ins",
    description: "A heads-up before a birthday, and a gentle nudge after a long quiet stretch.",
  },
] as const;

export type EmailPreferenceKey = typeof EMAIL_PREFERENCE_CATEGORIES[number]["key"];

export type EmailPreferences = Partial<Record<EmailPreferenceKey, boolean>>;

// Check whether a category is opted in. Missing key = opted in
// (default behavior); explicit false = opted out.
export function isCategoryEnabled(prefs: EmailPreferences | null | undefined, key: EmailPreferenceKey): boolean {
  if (!prefs) return true;
  if (prefs[key] === false) return false;
  return true;
}

// Sanitize incoming preference write payloads. Drops keys that
// aren't in the known category list so a malformed client request
// can't store arbitrary JSON.
export function sanitizeEmailPreferences(raw: unknown): EmailPreferences {
  if (!raw || typeof raw !== "object") return {};
  const sanitized: EmailPreferences = {};
  for (const cat of EMAIL_PREFERENCE_CATEGORIES) {
    const val = (raw as any)[cat.key];
    if (val === true || val === false) {
      sanitized[cat.key] = val;
    }
  }
  return sanitized;
}
