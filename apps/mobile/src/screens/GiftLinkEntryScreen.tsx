import React, { useState } from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { colors, radius, spacing } from "@kora/tokens";

interface GiftLinkEntryScreenProps {
  onOpen: (identifier: string) => Promise<void>;
  onBack: () => void;
}

function normalizeGiftIdentifier(raw: string) {
  const value = raw.trim();
  if (!value) return "";
  if (/^https?:\/\//i.test(value)) {
    try {
      const url = new URL(value);
      const parts = url.pathname.split("/").filter(Boolean);
      return parts[parts.length - 1] || "";
    } catch {
      return value;
    }
  }
  return value.replace(/^\/+|\/+$/g, "").split("/").filter(Boolean).pop() || "";
}

export function GiftLinkEntryScreen({ onOpen, onBack }: GiftLinkEntryScreenProps) {
  const [value, setValue] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleOpen = async () => {
    const identifier = normalizeGiftIdentifier(value);
    if (!identifier) {
      setError("Paste a gift link or enter a gift slug.");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      await onOpen(identifier);
    } catch (err: any) {
      setError(err?.message || "Could not open that gift page.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.screen}>
      <View style={styles.card}>
        <Text style={styles.eyebrow}>Gifter flow</Text>
        <Text style={styles.title}>Open a gift page.</Text>
        <Text style={styles.body}>
          Paste the gift link a parent shared with you, or enter the last slug from that link.
        </Text>

        <TextInput
          value={value}
          onChangeText={setValue}
          autoCapitalize="none"
          autoCorrect={false}
          placeholder="kiddofund.com/emma-birthday or emma-birthday"
          placeholderTextColor="#8B948C"
          style={styles.input}
        />

        {error ? <Text style={styles.error}>{error}</Text> : null}

        <Pressable onPress={handleOpen} disabled={loading} style={[styles.primaryBtn, loading && styles.primaryBtnDisabled]}>
          {loading ? <ActivityIndicator color="#FFFFFF" /> : <Text style={styles.primaryBtnText}>Open gift page</Text>}
        </Pressable>
        <Pressable onPress={onBack} style={styles.secondaryBtn}>
          <Text style={styles.secondaryBtnText}>Back</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.cream,
    padding: spacing.lg,
    justifyContent: "center",
  },
  card: {
    backgroundColor: "#FFFFFF",
    borderRadius: radius.container,
    padding: spacing.lg,
    gap: spacing.md,
  },
  eyebrow: {
    color: colors.evergreen,
    textTransform: "uppercase",
    letterSpacing: 1.5,
    fontSize: 12,
    fontWeight: "700",
  },
  title: {
    fontSize: 30,
    lineHeight: 34,
    fontWeight: "800",
    color: colors.ink,
  },
  body: {
    fontSize: 15,
    lineHeight: 24,
    color: "#5E675F",
  },
  input: {
    borderWidth: 1,
    borderColor: "#DED7CA",
    borderRadius: radius.inner,
    paddingHorizontal: spacing.md,
    paddingVertical: 14,
    fontSize: 15,
    color: colors.ink,
    backgroundColor: "#FAF7F1",
  },
  error: {
    color: "#B42318",
    fontSize: 13,
  },
  primaryBtn: {
    borderRadius: radius.inner,
    backgroundColor: colors.evergreen,
    paddingVertical: 14,
    alignItems: "center",
  },
  primaryBtnDisabled: {
    opacity: 0.7,
  },
  primaryBtnText: {
    color: "#FFFFFF",
    fontWeight: "700",
    fontSize: 15,
  },
  secondaryBtn: {
    alignItems: "center",
    paddingVertical: 10,
  },
  secondaryBtnText: {
    color: colors.ink,
    fontWeight: "600",
  },
});
