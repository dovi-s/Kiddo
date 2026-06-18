// @kora/tokens — the single cross-platform design-token source the mobile app
// consumes (every screen imports it). These are the CANONICAL Kiddo brand values,
// translated faithfully from the web design system (client/src/index.css). Keep
// them in lockstep with that file — drift here is what made the native app read
// off-brand (wrong greens/gold/ink, Inter instead of the brand fonts, web
// box-shadow strings that don't render in RN). See apps/mobile/DESIGN.md for the
// full contract + native-translation rationale.
//
// Source of truth mapping (web HSL → hex):
//   --kiddo-evergreen 152 37% 17% → #1B3A2D    --kiddo-cream     38 36% 96% → #F8F5F0
//   --kiddo-evergreen-deep        → #0E2518     --kiddo-cream-dark 36 28% 90% → #EDE7DC
//   --kiddo-gold      34 74% 45%  → #C5821E     --kiddo-ink       40 23% 8%  → #1A1710
//   --kiddo-gold-light 40 78% 66% → #EDC164     --kiddo-muted     32 7% 38%  → #61615A
//   --kiddo-gold-ink  34 74% 25%  → #6F4611      (AA text on cream/gold)
//   --kiddo-border    33 24% 86%  → #E5DDD4      --card 38 38% 99% → #FEFDFB

export const colors = {
  // Canonical brand four (corrected from the drifted #1B4332/#D4A04A/#F8F4EE/#1A211C).
  evergreen: "#1B3A2D",
  evergreenDeep: "#0E2518", // hero gradient endpoint
  gold: "#C5821E",
  goldLight: "#EDC164", // warm highlight on light contexts
  goldInk: "#6F4611", // AA/AAA text on cream + gold tints (never #C5821E for text)
  cream: "#F8F5F0",
  creamDark: "#EDE7DC", // secondary surface (tab rows)
  ink: "#1A1710",
  muted: "#61615A", // secondary text (AA on cream)
  border: "#E5DDD4",
  card: "#FEFDFB", // near-white card surface (faintly warm, NOT pure white)
};

export const semanticColors = {
  surface: {
    app: "#F8F5F0", // cream — primary background
    card: "#FEFDFB", // card surface
    raised: "#FFFFFF",
    muted: "#EDE7DC", // cream-dark
  },
  text: {
    primary: "#1A1710", // ink (16.4:1 AAA)
    secondary: "#4F5A52",
    muted: "#61615A", // darkened for AA (5.6:1)
    inverse: "#F8F5F0", // cream on dark/evergreen
  },
  action: {
    primary: "#1B3A2D", // evergreen
    primaryHover: "#24543F",
    accent: "#C5821E", // gold (decorative/CTA fill only — not text)
    accentSoft: "#FFF4DC",
  },
  buttonIntent: {
    action: "#1B3A2D",
    actionHover: "#24543F",
    monetization: "#C5821E",
    monetizationHover: "#D89A33",
    destructive: "#B91C1C",
    destructiveHover: "#991B1B",
  },
  trust: {
    background: "#EFF7F2",
    border: "#CFE7D6",
    text: "#24543F",
  },
  gift: {
    background: "#FFF8EE",
    border: "#E8C783",
    text: "#6F4611", // gold-ink for AA
  },
  success: {
    background: "#ECFDF3",
    border: "#B7E4C7",
    text: "#166534",
  },
  warning: {
    background: "#FFF7E6",
    border: "#F2C36B",
    text: "#7A4E00",
  },
  danger: {
    background: "#FEF2F2",
    border: "#FECACA",
    text: "#991B1B",
  },
  focus: "#1B3A2D", // evergreen focus ring
  // Activity-ledger status colors (mobile Activity/Memory feeds). Distinct from
  // the `success`/`danger` alert groups above: these are the tints the
  // transaction rows + status chips were tuned to, kept as named tokens so the
  // feeds stop inlining raw hex without shifting their visual result.
  ledger: {
    positive: "#1A7F47", // money in / market growth / invested amounts
    positiveSoft: "#E7F0E9", // "Invested" chip background
    negative: "#C0392B", // withdrawals / fees (money out)
    pendingSoft: "#FBEFD6", // "Pending" chip background
    pendingText: "#6F4611", // "Pending" chip text (gold-ink)
  },
};

export const spacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
  xxl: 48,
  // Extended scale to match the web 4px rhythm exactly.
  s3: 12,
  s5: 20,
  s10: 40,
  s16: 64,
};

export const radius = {
  control: 10, // buttons, inputs
  inner: 14, // nested content
  card: 16, // CANONICAL .kiddo-card (was wrongly 20 here)
  hero: 20, // .kiddo-hero-card only
  container: 24,
  pill: 9999,
};

export const typography = {
  family: {
    // Brand fonts. These render once loaded via expo-font + @expo-google-fonts
    // (DM Sans, Bricolage Grotesque); until then RN falls back to the system
    // font, which is clean. See apps/mobile/DESIGN.md "Fonts".
    body: "DMSans_400Regular",
    bodyMedium: "DMSans_500Medium",
    bodySemiBold: "DMSans_600SemiBold",
    bodyBold: "DMSans_700Bold",
    heading: "BricolageGrotesque_700Bold",
    mono: "ui-monospace",
    // Back-compat aliases (older screens reference sans/display). Kept so nothing
    // breaks; new code should use body/heading above.
    sans: "DMSans_400Regular",
    display: "BricolageGrotesque_700Bold",
  },
  // Type scale (px) — mirrors the web text-xs … text-4xl ladder.
  size: {
    xs: 12,
    sm: 14,
    base: 16, // also the iOS no-zoom input minimum
    lg: 18,
    xl: 20,
    "2xl": 24,
    "3xl": 30,
    "4xl": 36,
  },
  lineHeight: {
    none: 1,
    tight: 1.25,
    snug: 1.375,
    normal: 1.5,
    relaxed: 1.625,
  },
  // Headings tighten slightly; body/labels are neutral.
  letterSpacing: {
    heading: -0.2,
    label: -0.1,
    normal: 0,
  },
  weight: {
    regular: 400,
    medium: 500,
    semibold: 600,
    bold: 700,
  },
} as const;

// Motion — durations in MS, easings as cubic-bezier control points (for
// reanimated/Easing.bezier). Mirrors client/src/lib/motion.ts exactly.
export const motion = {
  instant: 100,
  fast: 150,
  normal: 200,
  slow: 300,
  routeEnter: 180,
  cardEnter: 450, // LOCKED (motion audit 2026-05-25) — list-item arrival
  countUp: 700, // LOCKED — ticker midpoint
};

export const easing = {
  outExpo: [0.16, 1, 0.3, 1] as const, // entrances (Apple default)
  inQuad: [0.4, 0, 1, 1] as const, // exits
  outBack: [0.34, 1.56, 0.64, 1] as const, // playful overshoot (celebrations)
  spring: [0.175, 0.885, 0.32, 1.275] as const, // dopamine moments
  decel: [0.32, 0.72, 0, 1] as const, // sheets / lightboxes
  standard: [0.4, 0, 0.2, 1] as const, // height shifts
};

// Haptic patterns BY INTENT (ms pulse arrays), mirroring client/src/lib/haptics.ts.
// On native, prefer mapping these intents to expo-haptics (e.g. selection →
// Haptics.selectionAsync(), success → notificationAsync(Success)); the raw arrays
// are the cross-platform fallback via RN Vibration. Semantic, never random.
export const haptics = {
  light: [10],
  medium: [20],
  heavy: [30],
  success: [10, 50, 20], // something arrived
  warning: [30, 50, 30],
  error: [50, 30, 50, 30, 50],
  selection: [5], // taps, focus
  gift: [15, 80, 25], // a gift landed
  milestone: [80, 60, 120], // applause through the floor
} as const;

// React-Native shadow objects (iOS shadow* + Android elevation). The web card is
// a 3-layer compound (inset glass edge + near + depth) that RN can't express in
// one shadow — the inset highlight is faked separately via a 1px top hairline in
// the KiddoCard primitive (see DESIGN.md). These approximate the visual weight.
// Shadow color is the warm ink (#1A1710), not black — matches the brand.
export const shadows = {
  card: {
    shadowColor: "#1A1710",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 3,
  },
  cardHover: {
    shadowColor: "#1A1710",
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.12,
    shadowRadius: 24,
    elevation: 8,
  },
  hero: {
    shadowColor: "#0E2518",
    shadowOffset: { width: 0, height: 16 },
    shadowOpacity: 0.18,
    shadowRadius: 30,
    elevation: 12,
  },
  overlay: {
    shadowColor: "#1A1710",
    shadowOffset: { width: 0, height: 18 },
    shadowOpacity: 0.16,
    shadowRadius: 40,
    elevation: 16,
  },
} as const;

// The faint top highlight that fakes the web card's inset "glass" edge — render
// as a 1px-tall View at the top inner edge of a card (the single biggest detail
// separating premium cards from flat ones on web).
export const glassEdge = "rgba(255,255,255,0.6)";

// DEPRECATED: web box-shadow strings — do NOT use in React Native (they don't
// render). Kept only so any old consumer doesn't break; migrate to `shadows`.
export const elevation = {
  none: "none",
  raised: "0 8px 24px rgba(26, 23, 16, 0.08)",
  overlay: "0 18px 48px rgba(26, 23, 16, 0.16)",
};

export const iconSize = {
  xs: 12,
  sm: 16,
  md: 20,
  lg: 24,
  xl: 32,
};

export const touchTarget = {
  minimum: 44, // WCAG / HIG
  comfortable: 52,
  primary: 56,
};

// DEPRECATED for native: CSS env() strings only work on web. On native use
// react-native-safe-area-context's useSafeAreaInsets(). Kept for any web consumer.
export const safeArea = {
  top: "env(safe-area-inset-top, 0px)",
  right: "env(safe-area-inset-right, 0px)",
  bottom: "env(safe-area-inset-bottom, 0px)",
  left: "env(safe-area-inset-left, 0px)",
};
