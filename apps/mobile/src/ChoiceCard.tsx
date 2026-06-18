import React from "react";
import { Pressable, StyleSheet, Text } from "react-native";
import { colors, semanticColors, radius, spacing } from "@kora/tokens";

type ChoiceCardProps = {
  title: string;
  description: string;
  active?: boolean;
  onPress: () => void;
};

export function ChoiceCard({ title, description, active = false, onPress }: ChoiceCardProps) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="radio"
      accessibilityState={{ checked: active }}
      accessibilityLabel={title}
      style={[styles.card, active && styles.cardActive]}
    >
      <Text style={styles.title}>{title}</Text>
      <Text style={styles.description}>{description}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    padding: spacing.md,
    borderRadius: radius.card,
    backgroundColor: semanticColors.surface.card,
    borderWidth: 1,
    borderColor: colors.border,
    gap: spacing.xs,
  },
  cardActive: {
    borderColor: colors.gold,
    backgroundColor: semanticColors.gift.background,
  },
  title: {
    color: colors.ink,
    fontSize: 18,
    fontWeight: "700",
  },
  description: {
    color: colors.muted,
    lineHeight: 20,
  },
});
