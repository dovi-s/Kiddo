import React, { useState } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { colors, radius, spacing } from "@kora/tokens";
import { apiCreateFund, apiJoinInternationalWaitlist, type ApiFund } from "../api";

interface AddFundScreenProps {
  onBack: () => void;
  onCreated: (fund: ApiFund) => void;
}

export function AddFundScreen({ onBack, onCreated }: AddFundScreenProps) {
  const insets = useSafeAreaInsets();
  // Country gate. Kora is structurally US-only at launch — asking here
  // catches non-US users before they fill out child details that won't
  // pass KYC. Default empty so the user must choose explicitly.
  const [country, setCountry] = useState<"US" | "OTHER" | "">("");
  const [waitlistEmail, setWaitlistEmail] = useState("");
  const [waitlistCountry, setWaitlistCountry] = useState("");
  const [waitlistSubmitting, setWaitlistSubmitting] = useState(false);
  const [waitlistSubmitted, setWaitlistSubmitted] = useState(false);
  const [waitlistError, setWaitlistError] = useState<string | null>(null);
  const [childName, setChildName] = useState("");
  const [childLastName, setChildLastName] = useState("");
  const [birthdate, setBirthdate] = useState("");
  const [relationship, setRelationship] = useState("Parent");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleWaitlistSubmit = async () => {
    setWaitlistError(null);
    const email = waitlistEmail.trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setWaitlistError("Enter a valid email address.");
      return;
    }
    setWaitlistSubmitting(true);
    try {
      await apiJoinInternationalWaitlist({
        email,
        country: waitlistCountry,
        sourceSurface: "mobile-add-fund",
      });
      setWaitlistSubmitted(true);
    } catch (err: any) {
      setWaitlistError(err?.message || "Could not save your email.");
    } finally {
      setWaitlistSubmitting(false);
    }
  };

  // Date bounds: not in future, and child funds are for children under 18.
  const todayIso = new Date().toISOString().slice(0, 10);
  const minBirthdateIso = (() => {
    const d = new Date();
    d.setFullYear(d.getFullYear() - 18);
    d.setDate(d.getDate() + 1);
    return d.toISOString().slice(0, 10);
  })();
  const isValidDate =
    /^\d{4}-\d{2}-\d{2}$/.test(birthdate.trim()) &&
    birthdate.trim() <= todayIso &&
    birthdate.trim() >= minBirthdateIso;

  const handleCreate = async () => {
    setError(null);
    if (!childName.trim()) { setError("Child's first name is required."); return; }
    if (!isValidDate) {
      const d = birthdate.trim();
      if (d > todayIso) setError("Date of birth cannot be in the future.");
      else if (d < minBirthdateIso) setError("Child funds are for children under 18. This birthday would make the child 18 or older.");
      else setError("Enter a valid birthdate in YYYY-MM-DD format.");
      return;
    }

    setLoading(true);
    try {
      const suffix = Date.now().toString(36) + Math.random().toString(36).slice(2, 5);
      const slug = childName.trim().toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, "") + "-fund-" + suffix;
      const fund = await apiCreateFund({
        name: `${childName.trim()}'s Future`,
        slug,
        accountType: "UTMA",
        recipientFirstName: childName.trim(),
        recipientLastName: childLastName.trim() || undefined,
        recipientBirthdate: new Date(`${birthdate.trim()}T12:00:00.000Z`),
        recipientRelation: relationship,
      });
      onCreated(fund);
    } catch (err: any) {
      setError(err?.message || "Could not create fund. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const relationships = ["Parent", "Legal guardian", "Grandparent"];

  return (
    <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === "ios" ? "padding" : "height"}>
      <View style={styles.screen}>
        {/* Header */}
        <View style={[styles.header, { paddingTop: insets.top + 14 }]}>
          <Pressable onPress={onBack} style={styles.backBtn}>
            <Text style={styles.backText}>Back</Text>
          </Pressable>
          <Text style={styles.headerTitle}>Add a fund</Text>
          <View style={{ width: 60 }} />
        </View>

        <ScrollView
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Child's fund</Text>
            <Text style={styles.cardSubtitle}>Create a giftable fund for a child. The legal account details stay underneath.</Text>

            {/* Country gate. Kora is structurally US-only at launch
                (UTMA + DriveWealth + US tax docs). Asking before the
                rest of the form catches non-US users with one tap
                rather than letting them fill in name/birthdate and
                hit a wall at KYC. */}
            <View style={[styles.fieldWrap, { marginTop: 8 }]}>
              <Text style={styles.label}>Where do you live?</Text>
              <View style={styles.relRow}>
                <Pressable
                  onPress={() => setCountry("US")}
                  style={[styles.relChip, country === "US" && styles.relChipActive]}
                >
                  <Text style={[styles.relChipText, country === "US" && styles.relChipTextActive]}>United States</Text>
                </Pressable>
                <Pressable
                  onPress={() => setCountry("OTHER")}
                  style={[styles.relChip, country === "OTHER" && styles.relChipActive]}
                >
                  <Text style={[styles.relChipText, country === "OTHER" && styles.relChipTextActive]}>Outside the US</Text>
                </Pressable>
              </View>
            </View>

            {country === "OTHER" && (
              <View style={styles.waitlistBox}>
                {waitlistSubmitted ? (
                  <>
                    <Text style={styles.waitlistTitle}>You're on the list.</Text>
                    <Text style={styles.waitlistBody}>
                      We'll email you if Kora becomes available in your country. No concrete date today.
                    </Text>
                  </>
                ) : (
                  <>
                    <Text style={styles.waitlistTitle}>Kora is US-only at launch.</Text>
                    <Text style={styles.waitlistBody}>
                      Our investment accounts use the US UTMA structure and our brokerage partner serves US residents.
                      If you'd like a note when we open to other countries, leave your email.
                    </Text>
                    <TextInput
                      style={[styles.input, { marginTop: 12 }]}
                      value={waitlistEmail}
                      onChangeText={setWaitlistEmail}
                      placeholder="you@example.com"
                      placeholderTextColor="#9CA3AF"
                      keyboardType="email-address"
                      autoCapitalize="none"
                      autoComplete="email"
                    />
                    <TextInput
                      style={[styles.input, { marginTop: 8 }]}
                      value={waitlistCountry}
                      onChangeText={setWaitlistCountry}
                      placeholder="Country (optional)"
                      placeholderTextColor="#9CA3AF"
                    />
                    {waitlistError && (
                      <Text style={[styles.errorText, { marginTop: 8 }]}>{waitlistError}</Text>
                    )}
                    <Pressable
                      onPress={handleWaitlistSubmit}
                      disabled={waitlistSubmitting || !waitlistEmail.trim()}
                      style={[styles.btn, { marginTop: 12 }, (waitlistSubmitting || !waitlistEmail.trim()) && styles.btnDisabled]}
                    >
                      {waitlistSubmitting ? (
                        <ActivityIndicator color="#FFFFFF" />
                      ) : (
                        <Text style={styles.btnText}>Notify me when Kora launches</Text>
                      )}
                    </Pressable>
                  </>
                )}
              </View>
            )}

            {country === "US" && error && (
              <View style={styles.errorBox}>
                <Text style={styles.errorText}>{error}</Text>
              </View>
            )}

            {country === "US" && (
            <View style={styles.fields}>
              <View style={styles.nameRow}>
                <View style={[styles.fieldWrap, { flex: 1 }]}>
                  <Text style={styles.label}>First name</Text>
                  <TextInput
                    style={styles.input}
                    value={childName}
                    onChangeText={setChildName}
                    placeholder="Mila"
                    placeholderTextColor="#9CA3AF"
                    autoCapitalize="words"
                    autoFocus
                    returnKeyType="next"
                  />
                </View>
                <View style={[styles.fieldWrap, { flex: 1 }]}>
                  <Text style={styles.label}>Last name</Text>
                  <TextInput
                    style={styles.input}
                    value={childLastName}
                    onChangeText={setChildLastName}
                    placeholder="Smith"
                    placeholderTextColor="#9CA3AF"
                    autoCapitalize="words"
                    returnKeyType="next"
                  />
                </View>
              </View>
              <Text style={styles.hint}>Legal name required for the UTMA account.</Text>

              <View style={styles.fieldWrap}>
                <Text style={styles.label}>Birthday</Text>
                <TextInput
                  style={styles.input}
                  value={birthdate}
                  onChangeText={setBirthdate}
                  placeholder="YYYY-MM-DD"
                  placeholderTextColor="#9CA3AF"
                  keyboardType="numeric"
                  returnKeyType="next"
                />
                <Text style={styles.hint}>Use the full birthday. Child funds are for children under 18.</Text>
              </View>

              <View style={styles.fieldWrap}>
                <Text style={styles.label}>Your relationship</Text>
                <View style={styles.relRow}>
                  {relationships.map((rel) => (
                    <Pressable
                      key={rel}
                      onPress={() => setRelationship(rel)}
                      style={[styles.relChip, relationship === rel && styles.relChipActive]}
                    >
                      <Text style={[styles.relChipText, relationship === rel && styles.relChipTextActive]}>
                        {rel}
                      </Text>
                    </Pressable>
                  ))}
                </View>
              </View>
            </View>

            <View style={styles.infoBox}>
              <Text style={styles.infoText}>
                New funds start simple. Gifts invest automatically using your family default strategy.
              </Text>
            </View>
            )}
          </View>

          <Pressable
            onPress={handleCreate}
            disabled={loading || !childName.trim() || !isValidDate || country !== "US"}
            style={[styles.btn, (loading || !childName.trim() || !isValidDate || country !== "US") && styles.btnDisabled]}
          >
            {loading ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <Text style={styles.btnText}>
                Create {childName.trim() ? `${childName.trim()}'s fund` : "fund"}
              </Text>
            )}
          </Pressable>
        </ScrollView>
      </View>
    </KeyboardAvoidingView>
  backText: { fontSize: 15, color: colors.evergreen, fontWeight: "600" },
  headerTitle: { fontSize: 17, fontWeight: "700", color: colors.ink },
  content: { padding: spacing.md, gap: spacing.md, paddingBottom: 40 },
  card: {
    backgroundColor: "#FFFFFF",
    borderRadius: radius.card,
    padding: spacing.lg,
    gap: spacing.md,
    borderWidth: 1,
    borderColor: "#F0EDE8",
  },
  cardTitle: { fontSize: 18, fontWeight: "700", color: colors.ink },
  cardSubtitle: { fontSize: 14, color: "#6B7280" },
  errorBox: {
    backgroundColor: "#FEF2F2",
    borderRadius: radius.inner,
    borderWidth: 1,
    borderColor: "#FECACA",
    padding: spacing.sm,
  },
  errorText: { color: "#DC2626", fontSize: 13 },
  fields: { gap: spacing.md },
  fieldWrap: { gap: 4 },
  label: { fontSize: 13, fontWeight: "600", color: colors.ink },
  input: {
    height: 46,
    borderWidth: 1.5,
    borderColor: "#D1D5DB",
                    value={childName}
                    onChangeText={setChildName}
                    placeholder="Mila"
                    placeholderTextColor="#9CA3AF"
                    autoCapitalize="words"
                    autoFocus
                    returnKeyType="next"
                  />
                </View>
                <View style={[styles.fieldWrap, { flex: 1 }]}>
                  <Text style={styles.label}>Last name</Text>
                  <TextInput
                    style={styles.input}
                    value={childLastName}
                    onChangeText={setChildLastName}
                    placeholder="Smith"
                    placeholderTextColor="#9CA3AF"
                    autoCapitalize="words"
                    returnKeyType="next"
                  />
                </View>
              </View>
              <Text style={styles.hint}>Legal name required for the UTMA account.</Text>

              <View style={styles.fieldWrap}>
                <Text style={styles.label}>Birthday</Text>
                <TextInput
                  style={styles.input}
                  value={birthdate}
                  onChangeText={setBirthdate}
                  placeholder="YYYY-MM-DD"
                  placeholderTextColor="#9CA3AF"
                  keyboardType="numeric"
                  returnKeyType="next"
                />
  btnText: { color: "#FFFFFF", fontWeight: "700", fontSize: 16 },
});



                <View style={styles.relRow}>
                  {relationships.map((rel) => (
                    <Pressable
                      key={rel}
                      onPress={() => setRelationship(rel)}
                      style={[styles.relChip, relationship === rel && styles.relChipActive]}
                    >
                      <Text style={[styles.relChipText, relationship === rel && styles.relChipTextActive]}>
                        {rel}
                      </Text>
                    </Pressable>
                  ))}
                </View>
              </View>
            </View>

            <View style={styles.infoBox}>
              <Text style={styles.infoText}>
                New funds start simple. Gifts invest automatically using your family default strategy.
              </Text>
            </View>
          </View>

          <Pressable
            onPress={handleCreate}
            disabled={loading || !childName.trim() || !isValidDate}
            style={[styles.btn, (loading || !childName.trim() || !isValidDate) && styles.btnDisabled]}
          >
            {loading ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <Text style={styles.btnText}>
                Create {childName.trim() ? `${childName.trim()}'s fund` : "fund"}
              </Text>
            )}
          </Pressable>
        </ScrollView>
      </View>
    </KeyboardAvoidingView>
  );
}


const styles = StyleSheet.create({
  flex: { flex: 1 },
  screen: { flex: 1, backgroundColor: "#F9F7F3" },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "#FFFFFF",
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: "#F0EDE8",
  },
  backBtn: { padding: 4 },
  backText: { fontSize: 15, color: colors.evergreen, fontWeight: "600" },
  headerTitle: { fontSize: 17, fontWeight: "700", color: colors.ink },
  content: { padding: spacing.md, gap: spacing.md, paddingBottom: 40 },
  card: {
    backgroundColor: "#FFFFFF",
    borderRadius: radius.card,
    padding: spacing.lg,
    gap: spacing.md,
    borderWidth: 1,
    borderColor: "#F0EDE8",
  },
  cardTitle: { fontSize: 18, fontWeight: "700", color: colors.ink },
  cardSubtitle: { fontSize: 14, color: "#6B7280" },
  errorBox: {
    backgroundColor: "#FEF2F2",
    borderRadius: radius.inner,
    borderWidth: 1,
    borderColor: "#FECACA",
    padding: spacing.sm,
  },
  errorText: { color: "#DC2626", fontSize: 13 },
  fields: { gap: spacing.md },
  fieldWrap: { gap: 4 },
  label: { fontSize: 13, fontWeight: "600", color: colors.ink },
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
  nameRow: { flexDirection: "row", gap: spacing.sm },
  hint: { fontSize: 11, color: "#9CA3AF", marginTop: 2 },
  relRow: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 4 },
  relChip: {
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 20,
    backgroundColor: "#F3F4F6",
    borderWidth: 1.5,
    borderColor: "#F3F4F6",
  },
  relChipActive: { borderColor: colors.evergreen, backgroundColor: colors.evergreen + "12" },
  relChipText: { fontSize: 14, color: "#6B7280", fontWeight: "500" },
  relChipTextActive: { color: colors.evergreen, fontWeight: "600" },
  infoBox: {
    backgroundColor: "#F9F7F3",
    borderRadius: radius.inner,
    padding: spacing.sm,
    borderWidth: 1,
    borderColor: "#E5E7EB",
  },
  infoText: { fontSize: 12, color: "#6B7280", lineHeight: 18 },
  waitlistBox: {
    backgroundColor: "#FAFAF7",
    borderRadius: radius.inner,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: "#E5E7EB",
    marginTop: spacing.sm,
  },
  waitlistTitle: { fontSize: 14, fontWeight: "700", color: colors.ink },
  waitlistBody: { fontSize: 12.5, color: "#6B7280", lineHeight: 18, marginTop: 4 },
  btn: {
    height: 52,
    backgroundColor: colors.evergreen,
    borderRadius: radius.control,
    alignItems: "center",
    justifyContent: "center",
  },
  btnDisabled: { opacity: 0.5 },
  btnText: { color: "#FFFFFF", fontWeight: "700", fontSize: 16 },
});
