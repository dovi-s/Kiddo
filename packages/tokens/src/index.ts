export const colors = {
  evergreen: "#1B4332",
  gold: "#D4A04A",
  cream: "#F8F4EE",
  ink: "#1A211C",
};

export const semanticColors = {
  surface: {
    app: "#F8F4EE",
    card: "#FFFDF8",
    raised: "#FFFFFF",
    muted: "#F3EDE3",
  },
  text: {
    primary: "#1A211C",
    secondary: "#4F5A52",
    muted: "#7A847C",
    inverse: "#FFFFFF",
  },
  action: {
    primary: "#1B4332",
    primaryHover: "#24543F",
    accent: "#D4A04A",
    accentSoft: "#FFF4DC",
  },
  buttonIntent: {
    action: "#1B4332",
    actionHover: "#24543F",
    monetization: "#D4A04A",
    monetizationHover: "#E1B15C",
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
    text: "#5B4317",
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
  focus: "#1B4332",
};

export const spacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
  xxl: 48,
};

export const radius = {
  control: 10,
  inner: 14,
  card: 20,
  container: 24,
};

export const typography = {
  family: {
    sans: "Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif",
    display: "Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif",
    mono: "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace",
  },
  weight: {
    regular: 400,
    medium: 500,
    semibold: 600,
    bold: 700,
  },
};

export const motion = {
  instant: 100,
  fast: 150,
  normal: 200,
  slow: 300,
};

export const elevation = {
  none: "none",
  raised: "0 8px 24px rgba(26, 33, 28, 0.08)",
  overlay: "0 18px 48px rgba(26, 33, 28, 0.16)",
};

export const iconSize = {
  xs: 12,
  sm: 16,
  md: 20,
  lg: 24,
  xl: 32,
};

export const touchTarget = {
  minimum: 44,
  comfortable: 52,
  primary: 56,
};

export const safeArea = {
  top: "env(safe-area-inset-top, 0px)",
  right: "env(safe-area-inset-right, 0px)",
  bottom: "env(safe-area-inset-bottom, 0px)",
  left: "env(safe-area-inset-left, 0px)",
};
