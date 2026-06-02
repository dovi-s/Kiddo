import React, { useState } from "react";
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { colors, semanticColors, radius, spacing } from "@kora/tokens";
import { apiLogin, apiRegister, type ApiUser } from "../api";
import { KText, KiddoCard, KInput, Button, haptic } from "../ui";

interface AuthScreenProps {
  onAuth: (user: ApiUser) => void;
}

type AuthMode = "login" | "register";

// Refactored onto the design-system kit (2026-06-02) — the first screen migrated
// off ad-hoc grey hardcodes to the brand tokens + primitives. Logic unchanged;
// only presentation. The proof surface for the native build (see DESIGN.md).
export function AuthScreen({ onAuth }: AuthScreenProps) {
  const insets = useSafeAreaInsets();
  const [mode, setMode] = useState<AuthMode>("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async () => {
    setError(null);
    if (!email.trim() || !password.trim()) {
      setError("Email and password are required.");
      return;
    }
    if (mode === "register" && !firstName.trim()) {
      setError("First name is required.");
      return;
    }
    setLoading(true);
    try {
      const user =
        mode === "login"
          ? await apiLogin(email.trim().toLowerCase(), password)
          : await apiRegister(email.trim().toLowerCase(), password, firstName.trim(), lastName.trim());
      onAuth(user);
    } catch (err: any) {
      setError(err?.message || "Something went wrong. Try again.");
    } finally {
      setLoading(false);
    }
  };

  const setModeReset = (m: AuthMode) => {
    haptic("selection");
    setMode(m);
    setError(null);
  };
  const toggle = () => setModeReset(mode === "login" ? "register" : "login");

  return (
    <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === "ios" ? "padding" : "height"}>
      <ScrollView
        style={{ flex: 1, backgroundColor: semanticColors.surface.app }}
        contentContainerStyle={[
          styles.content,
          { paddingTop: insets.top + spacing.lg, paddingBottom: insets.bottom + spacing.lg },
        ]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <KiddoCard padded={false} style={styles.card}>
          <View style={styles.logoRow}>
            <KText variant="display" color={colors.evergreen}>Kiddo</KText>
            <KText variant="caption">Investment gifting</KText>
          </View>

          {/* Segmented sign-in / register toggle */}
          <View style={styles.tabRow}>
            {(["login", "register"] as const).map((m) => {
              const active = mode === m;
              return (
                <Pressable
                  key={m}
                  style={[styles.tab, active && styles.tabActive]}
                  onPress={() => setModeReset(m)}
                  accessibilityRole="button"
                  accessibilityState={{ selected: active }}
                >
                  <KText variant="label" color={active ? semanticColors.text.primary : semanticColors.text.muted}>
                    {m === "login" ? "Sign in" : "Create account"}
                  </KText>
                </Pressable>
              );
            })}
          </View>

          {error ? (
            <View style={styles.errorBox}>
              <KText variant="caption" color={semanticColors.danger.text}>{error}</KText>
            </View>
          ) : null}

          <View style={styles.fields}>
            {mode === "register" ? (
              <View style={styles.row}>
                <KInput
                  containerStyle={styles.halfLeft}
                  label="First name"
                  value={firstName}
                  onChangeText={setFirstName}
                  placeholder="Jane"
                  autoCapitalize="words"
                  returnKeyType="next"
                />
                <KInput
                  containerStyle={styles.half}
                  label="Last name"
                  value={lastName}
                  onChangeText={setLastName}
                  placeholder="Doe"
                  autoCapitalize="words"
                  returnKeyType="next"
                />
              </View>
            ) : null}

            <KInput
              label="Email"
              value={email}
              onChangeText={setEmail}
              placeholder="you@example.com"
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
              returnKeyType="next"
            />
            <KInput
              label="Password"
              value={password}
              onChangeText={setPassword}
              placeholder={mode === "register" ? "Min 8 characters" : "Your password"}
              secureTextEntry
              returnKeyType="done"
              onSubmitEditing={handleSubmit}
            />
          </View>

          <Button
            label={mode === "login" ? "Sign in" : "Create account"}
            onPress={handleSubmit}
            loading={loading}
            fullWidth
            size="lg"
            hapticIntent="medium"
          />

          <Pressable onPress={toggle} style={styles.toggleRow} accessibilityRole="button">
            <KText variant="caption" center>
              {mode === "login" ? "No account? " : "Already have one? "}
              <KText variant="caption" color={colors.evergreen}>
                {mode === "login" ? "Create one" : "Sign in"}
              </KText>
            </KText>
          </Pressable>
        </KiddoCard>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  content: { paddingHorizontal: spacing.lg, flexGrow: 1, justifyContent: "center" },
  card: {
    maxWidth: 430,
    width: "100%",
    alignSelf: "center",
    padding: spacing.lg,
    gap: spacing.md,
  },
  logoRow: { alignItems: "center", gap: 2, marginBottom: spacing.xs },
  tabRow: {
    flexDirection: "row",
    backgroundColor: semanticColors.surface.muted,
    borderRadius: radius.control,
    padding: 3,
    gap: 3,
  },
  tab: { flex: 1, paddingVertical: spacing.sm, borderRadius: radius.control - 3, alignItems: "center" },
  tabActive: {
    backgroundColor: semanticColors.surface.card,
    shadowColor: colors.ink,
    shadowOpacity: 0.08,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 1 },
    elevation: 2,
  },
  errorBox: {
    backgroundColor: semanticColors.danger.background,
    borderRadius: radius.inner,
    borderWidth: 1,
    borderColor: semanticColors.danger.border,
    padding: spacing.sm,
  },
  fields: { gap: spacing.sm },
  row: { flexDirection: "row" },
  half: { flex: 1 },
  halfLeft: { flex: 1, marginRight: spacing.sm },
  toggleRow: { alignItems: "center", paddingTop: spacing.xs },
});
