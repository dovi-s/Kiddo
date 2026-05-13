import React from "react";
import { StyleSheet, Text, View } from "react-native";
import { colors, spacing } from "@kora/tokens";

type ScreenLeadProps = {
  eyebrow: string;
  title: string;
  description: string;
};

export function ScreenLead({ eyebrow, title, description }: ScreenLeadProps) {
  return (
    <View style={styles.wrap}>
      <Text style={styles.eyebrow}>{eyebrow}</Text>
      <Text style={styles.title}>{title}</Text>
      <Text style={styles.description}>{description}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    gap: spacing.sm,
  },
  eyebrow: {
    color: colors.gold,
    fontWeight: "700",
    fontSize: 13,
  },
  title: {
    color: colors.ink,
    fontSize: 34,
    lineHeight: 38,
    fontWeight: "700",
  },
  description: {
    color: "#5E675F",
    fontSize: 16,
    lineHeight: 24,
  },
});
