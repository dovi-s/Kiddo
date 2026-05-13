import React from "react";
import { Pressable, StyleSheet, Text } from "react-native";
import { colors, radius, spacing } from "@kora/tokens";

type ChoiceCardProps = {
  title: string;
  description: string;
  active?: boolean;
  onPress: () => void;
};

export function ChoiceCard({ title, description, active = false, onPress }: ChoiceCardProps) {
  return (
    <Pressable onPress={onPress} style={[styles.card, active && styles.cardActive]}>
      <Text style={styles.title}>{title}</Text>
      <Text style={styles.description}>{description}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    padding: spacing.md,
    borderRadius: radius.card,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#E6DDD0",
    gap: spacing.xs,
  },
  cardActive: {
    borderColor: colors.gold,
    backgroundColor: "#FFF8EE",
  },
  title: {
    color: colors.ink,
    fontSize: 18,
    fontWeight: "700",
  },
  description: {
    color: "#5E675F",
    lineHeight: 20,
  },
});
