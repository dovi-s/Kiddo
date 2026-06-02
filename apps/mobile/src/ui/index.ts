// Kiddo Mobile UI kit — the design-system primitives every screen builds from.
// All read from @kora/tokens (the single brand source). See apps/mobile/DESIGN.md.
//
// Usage: import { Screen, KText, KiddoCard, Button, Pill, Skeleton } from "@/ui";
// (or a relative "../ui" path). Never use raw <Text>/<View> styling in screens —
// compose these so the brand stays consistent and drift-free.

export { Screen } from "./Screen";
export type { ScreenProps } from "./Screen";

export { KText } from "./Text";
export type { KTextProps, TextVariant } from "./Text";

export { KiddoCard } from "./KiddoCard";
export type { KiddoCardProps } from "./KiddoCard";

export { Button } from "./Button";
export type { ButtonProps } from "./Button";

export { Pill } from "./Pill";
export type { PillProps } from "./Pill";

export { Skeleton } from "./Skeleton";
export type { SkeletonProps } from "./Skeleton";

export { haptic, markFontsLoaded, areFontsLoaded } from "./native";
export type { HapticIntent } from "./native";
