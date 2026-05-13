import React, { useState } from "react";
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  ActivityIndicator,
} from "react-native";
import { colors, radius, spacing } from "@kora/tokens";
import { apiLogin, apiRegister, type ApiUser } from "../api";

interface AuthScreenProps {
  onAuth: (user: ApiUser) => void;
}

type AuthMode = "login" | "register";

export function AuthScreen({ onAuth }: AuthScreenProps) {
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

  const toggle = () => {
    setMode((m) => (m === "login" ? "register" : "login"));
    setError(null);
  };

  return (
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
    >
      <ScrollView
        style={styles.screen}
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.card}>
          {/* Logo / wordmark */}
          <View style={styles.logoRow}>
            <Text style={styles.logoText}>Kora</Text>
            <Text style={styles.logoSub}>Investment gifting</Text>
          </View>

          {/* Tab toggle */}
          <View style={styles.tabRow}>
            <Pressable
              style={[styles.tab, mode === "login" && styles.tabActive]}
              onPress={() => { setMode("login"); setError(null); }}
            >
              <Text style={[styles.tabText, mode === "login" && styles.tabTextActive]}>Sign in</Text>
            </Pressable>
            <Pressable
              style={[styles.tab, mode === "register" && styles.tabActive]}
              onPress={() => { setMode("register"); setError(null); }}
            >
              <Text style={[styles.tabText, mode === "register" && styles.tabTextActive]}>Create account</Text>
            </Pressable>
          </View>

          {/* Error */}
          {error && (
            <View style={styles.errorBox}>
              <Text style={styles.errorText}>{error}</Text>
            </View>
          )}

          {/* Fields */}
          <View style={styles.fields}>
            {mode === "register" && (
              <View style={styles.row}>
                <View style={[styles.fieldWrap, { flex: 1, marginRight: spacing.xs }]}>
                  <Text style={styles.label}>First name</Text>
                  <TextInput
                    style={styles.input}
                    value={firstName}
                    onChangeText={setFirstName}
                    placeholder="Jane"
                    placeholderTextColor="#9CA3AF"
                    autoCapitalize="words"
                    returnKeyType="next"
                  />
                </View>
                <View style={[styles.fieldWrap, { flex: 1 }]}>
                  <Text style={styles.label}>Last name</Text>
                  <TextInput
                    style={styles.input}
                    value={lastName}
                    onChangeText={setLastName}
                    placeholder="Doe"
                    placeholderTextColor="#9CA3AF"
                    autoCapitalize="words"
                    returnKeyType="next"
                  />
                </View>
              </View>
            )}

            <View style={styles.fieldWrap}>
              <Text style={styles.label}>Email</Text>
              <TextInput
                style={styles.input}
                value={email}
                onChangeText={setEmail}
                placeholder="you@example.com"
                placeholderTextColor="#9CA3AF"
                keyboardType="email-address"
                autoCapitalize="none"
                autoCorrect={false}
                returnKeyType="next"
              />
            </View>

            <View style={styles.fieldWrap}>
              <Text style={styles.label}>Password</Text>
              <TextInput
                style={styles.input}
                value={password}
                onChangeText={setPassword}
                placeholder={mode === "register" ? "Min 8 characters" : "Your password"}
                placeholderTextColor="#9CA3AF"
                secureTextEntry
                returnKeyType="done"
                onSubmitEditing={handleSubmit}
              />
            </View>
          </View>

          {/* Submit */}
          <Pressable
            style={[styles.btn, loading && styles.btnDisabled]}
            onPress={handleSubmit}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <Text style={styles.btnText}>
                {mode === "login" ? "Sign in" : "Create account"}
              </Text>
            )}
          </Pressable>

          {/* Toggle */}
          <Pressable onPress={toggle} style={styles.toggleRow}>
            <Text style={styles.toggleText}>
              {mode === "login" ? "No account? " : "Already have one? "}
              <Text style={styles.toggleLink}>
                {mode === "login" ? "Create one" : "Sign in"}
              </Text>
            </Text>
          </Pressable>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  screen: { flex: 1, backgroundColor: colors.cream },
  content: { padding: spacing.lg, minHeight: "100%", justifyContent: "center" },
  card: {
    backgroundColor: "#FFFFFF",
    borderRadius: radius.container,
    padding: spacing.lg,
    gap: spacing.md,
    shadowColor: colors.ink,
    shadowOpacity: 0.08,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: 10 },
    elevation: 4,
    maxWidth: 430,
    width: "100%",
    alignSelf: "center",
  },
  logoRow: { alignItems: "center", gap: 2 },
  logoText: { fontSize: 28, fontWeight: "700", color: colors.evergreen },
  logoSub: { fontSize: 13, color: "#6B7280" },
  tabRow: {
    flexDirection: "row",
    backgroundColor: "#F3F4F6",
    borderRadius: radius.control,
    padding: 3,
  },
  tab: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: radius.control - 2,
    alignItems: "center",
  },
  tabActive: { backgroundColor: "#FFFFFF", shadowColor: "#000", shadowOpacity: 0.08, shadowRadius: 4, elevation: 2 },
  tabText: { fontSize: 14, fontWeight: "500", color: "#6B7280" },
  tabTextActive: { color: colors.ink },
  errorBox: {
    backgroundColor: "#FEF2F2",
    borderRadius: radius.inner,
    borderWidth: 1,
    borderColor: "#FECACA",
    padding: spacing.sm,
  },
  errorText: { color: "#DC2626", fontSize: 13 },
  fields: { gap: spacing.sm },
  row: { flexDirection: "row" },
  fieldWrap: { gap: 4 },
  label: { fontSize: 13, fontWeight: "500", color: colors.ink },
  input: {
    height: 46,
    borderWidth: 1.5,
    borderColor: "#D1D5DB",
    borderRadius: radius.control,
    paddingHorizontal: spacing.md,
    fontSize: 15,
    color: colors.ink,
    backgroundColor: "#FAFAFA",
  },
  btn: {
    height: 50,
    backgroundColor: colors.evergreen,
    borderRadius: radius.control,
    alignItems: "center",
    justifyContent: "center",
  },
  btnDisabled: { opacity: 0.6 },
  btnText: { color: "#FFFFFF", fontWeight: "700", fontSize: 16 },
  toggleRow: { alignItems: "center" },
  toggleText: { fontSize: 14, color: "#6B7280" },
  toggleLink: { color: colors.evergreen, fontWeight: "600" },
});
