// ProfileScreen — edit your name, change your password, change your email.
// Mirrors the web Account profile section. Reached from the Account tab.
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
import { Ionicons } from "@expo/vector-icons";
import { colors, semanticColors, spacing } from "@kora/tokens";
import { KText, KiddoCard, KInput, Button, haptic } from "../ui";
import { apiUpdateProfile, apiChangePassword, apiChangeEmail, type ApiUser } from "../api";

type Note = { kind: "ok" | "err"; text: string } | null;

function NoteLine({ note }: { note: Note }) {
  if (!note) return null;
  return (
    <KText
      variant="caption"
      color={note.kind === "ok" ? semanticColors.success.text : semanticColors.danger.text}
      style={{ marginTop: spacing.xs }}
    >
      {note.text}
    </KText>
  );
}

export function ProfileScreen({
  user,
  onBack,
  onUpdated,
}: {
  user: ApiUser;
  onBack: () => void;
  onUpdated?: (u: ApiUser) => void;
}) {
  const insets = useSafeAreaInsets();

  const [firstName, setFirstName] = useState(user.firstName || "");
  const [lastName, setLastName] = useState(user.lastName || "");
  const [nameBusy, setNameBusy] = useState(false);
  const [nameNote, setNameNote] = useState<Note>(null);

  const [newEmail, setNewEmail] = useState("");
  const [emailBusy, setEmailBusy] = useState(false);
  const [emailNote, setEmailNote] = useState<Note>(null);

  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [pwBusy, setPwBusy] = useState(false);
  const [pwNote, setPwNote] = useState<Note>(null);

  const saveName = async () => {
    setNameBusy(true);
    setNameNote(null);
    try {
      const updated = await apiUpdateProfile({ firstName: firstName.trim(), lastName: lastName.trim() });
      haptic("success");
      onUpdated?.(updated);
      setNameNote({ kind: "ok", text: "Saved." });
    } catch (e: any) {
      haptic("error");
      setNameNote({ kind: "err", text: e?.message || "Could not save your name." });
    } finally {
      setNameBusy(false);
    }
  };

  const saveEmail = async () => {
    const email = newEmail.trim();
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
      setEmailNote({ kind: "err", text: "Enter a valid email." });
      return;
    }
    setEmailBusy(true);
    setEmailNote(null);
    try {
      await apiChangeEmail(email);
      haptic("success");
      setEmailNote({ kind: "ok", text: `Check ${email} for a link to confirm the change.` });
      setNewEmail("");
    } catch (e: any) {
      haptic("error");
      setEmailNote({ kind: "err", text: e?.message || "Could not start the email change." });
    } finally {
      setEmailBusy(false);
    }
  };

  const savePassword = async () => {
    if (newPassword.length < 8) {
      setPwNote({ kind: "err", text: "New password must be at least 8 characters." });
      return;
    }
    setPwBusy(true);
    setPwNote(null);
    try {
      await apiChangePassword({ currentPassword, newPassword });
      haptic("success");
      setPwNote({ kind: "ok", text: "Password changed." });
      setCurrentPassword("");
      setNewPassword("");
    } catch (e: any) {
      haptic("error");
      setPwNote({ kind: "err", text: e?.message || "Could not change your password." });
    } finally {
      setPwBusy(false);
    }
  };

  return (
    <View style={styles.screen}>
      <View style={[styles.header, { paddingTop: insets.top + 10 }]}>
        <Pressable onPress={onBack} style={styles.back} hitSlop={10}>
          <Ionicons name="arrow-back" size={20} color={colors.evergreen} />
        </Pressable>
        <KText variant="title">Profile</KText>
        <View style={{ width: 20 }} />
      </View>

      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <ScrollView
          contentContainerStyle={{ padding: spacing.md, paddingBottom: insets.bottom + spacing.xl, gap: spacing.md }}
          keyboardShouldPersistTaps="handled"
        >
          {/* Name */}
          <KiddoCard>
            <KText variant="heading">Your name</KText>
            <View style={{ gap: spacing.sm, marginTop: spacing.sm }}>
              <KInput label="First name" value={firstName} onChangeText={setFirstName} placeholder="Jane" />
              <KInput label="Last name" value={lastName} onChangeText={setLastName} placeholder="Doe" />
              <Button label="Save name" onPress={saveName} loading={nameBusy} />
              <NoteLine note={nameNote} />
            </View>
          </KiddoCard>

          {/* Email */}
          <KiddoCard>
            <KText variant="heading">Email</KText>
            <KText variant="caption" color={semanticColors.text.muted} style={{ marginTop: 2 }}>
              Signed in as {user.email}
            </KText>
            <View style={{ gap: spacing.sm, marginTop: spacing.sm }}>
              <KInput
                label="New email"
                value={newEmail}
                onChangeText={setNewEmail}
                placeholder="you@example.com"
                autoCapitalize="none"
                keyboardType="email-address"
                autoCorrect={false}
              />
              <Button label="Send confirmation link" variant="outline" onPress={saveEmail} loading={emailBusy} />
              <NoteLine note={emailNote} />
            </View>
          </KiddoCard>

          {/* Password */}
          <KiddoCard>
            <KText variant="heading">Password</KText>
            <View style={{ gap: spacing.sm, marginTop: spacing.sm }}>
              <KInput
                label="Current password"
                value={currentPassword}
                onChangeText={setCurrentPassword}
                placeholder="Your current password"
                secureTextEntry
                autoCapitalize="none"
              />
              <KInput
                label="New password"
                value={newPassword}
                onChangeText={setNewPassword}
                placeholder="At least 8 characters"
                secureTextEntry
                autoCapitalize="none"
              />
              <Button label="Change password" variant="outline" onPress={savePassword} loading={pwBusy} />
              <NoteLine note={pwNote} />
            </View>
          </KiddoCard>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.cream },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: "#E5DDD4",
  },
  back: { width: 20 },
});
