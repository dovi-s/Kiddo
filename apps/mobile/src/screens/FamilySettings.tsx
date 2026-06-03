// Family settings — the interactive co-parent invite + Kid-View PIN sections for
// the Account tab. Replaces the old static "Invite" / "PIN protected" labels with
// real flows against the server (collaborators + kid-view-settings endpoints).

import React, { useEffect, useState } from "react";
import { View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { colors, semanticColors, radius, spacing } from "@kora/tokens";
import { KText, KiddoCard, KInput, Button, haptic } from "../ui";
import {
  apiGetCollaborators,
  apiInviteCollaborator,
  apiGetKidViewSettings,
  apiUpdateKidViewSettings,
  type ApiFund,
  type Collaborator,
  type KidViewSettings,
} from "../api";

function SettingsHeader({ children }: { children: React.ReactNode }) {
  return (
    <KText variant="sectionLabel" color={semanticColors.text.muted} style={{ marginBottom: spacing.xs }}>
      {children}
    </KText>
  );
}

function childNameOf(fund?: ApiFund | null): string {
  return fund?.recipientFirstName || fund?.name || "your child";
}

// ─── Co-parent invite ───────────────────────────────────────────────────────

export function CoParentSection({ activeFund }: { activeFund: ApiFund | null }) {
  const [rows, setRows] = useState<Collaborator[]>([]);
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    if (!activeFund) return;
    apiGetCollaborators(activeFund.id)
      .then((r) => !cancelled && setRows(r))
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [activeFund?.id]);

  if (!activeFund) return null;

  const invite = async () => {
    const e = email.trim().toLowerCase();
    if (!e || busy) return;
    setBusy(true);
    setMsg(null);
    setErr(null);
    try {
      const created = await apiInviteCollaborator(activeFund.id, e, "co-admin");
      haptic("success");
      setRows((prev) => {
        const without = prev.filter((r) => r.email.toLowerCase() !== e);
        return [...without, created];
      });
      setEmail("");
      setMsg(`Invite sent to ${e}.`);
    } catch (e2: any) {
      haptic("error");
      setErr(e2?.message || "Couldn't send the invite.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <View>
      <SettingsHeader>Co-parent</SettingsHeader>
      <KiddoCard>
        <KText variant="bodyStrong">Invite a co-parent</KText>
        <KText variant="caption" color={semanticColors.text.muted} style={{ marginTop: 2 }}>
          They'll see {childNameOf(activeFund)}'s fund alongside you and can add notes and gifts.
        </KText>

        {rows.length > 0 ? (
          <View style={{ gap: spacing.xs, marginTop: spacing.sm }}>
            {rows.map((r) => (
              <View
                key={r.id}
                style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: spacing.sm }}
              >
                <KText variant="body" numberOfLines={1} style={{ flex: 1 }}>{r.email}</KText>
                <View
                  style={{
                    backgroundColor: (r.status === "accepted" ? colors.evergreen : colors.gold) + "1F",
                    borderRadius: radius.pill,
                    paddingHorizontal: 10,
                    paddingVertical: 3,
                  }}
                >
                  <KText variant="caption" color={r.status === "accepted" ? colors.evergreen : colors.goldInk}>
                    {r.status === "accepted" ? "Accepted" : r.status === "declined" ? "Declined" : "Invited"}
                  </KText>
                </View>
              </View>
            ))}
          </View>
        ) : null}

        <View style={{ marginTop: spacing.sm, gap: spacing.sm }}>
          <KInput
            placeholder="co-parent@email.com"
            value={email}
            onChangeText={setEmail}
            autoCapitalize="none"
            keyboardType="email-address"
          />
          <Button label="Send invite" onPress={invite} loading={busy} disabled={!email.trim()} />
        </View>
        {msg ? (
          <KText variant="caption" color={colors.evergreen} style={{ marginTop: spacing.xs }}>{msg}</KText>
        ) : null}
        {err ? (
          <KText variant="caption" color="#C0392B" style={{ marginTop: spacing.xs }}>{err}</KText>
        ) : null}
      </KiddoCard>
    </View>
  );
}

// ─── Kid View PIN ───────────────────────────────────────────────────────────

export function KidViewSection({ activeFund }: { activeFund: ApiFund | null }) {
  const [settings, setSettings] = useState<KidViewSettings | null>(null);
  const [pin, setPin] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const load = () => {
    if (!activeFund) return;
    apiGetKidViewSettings(activeFund.id)
      .then(setSettings)
      .catch(() => {});
  };
  useEffect(load, [activeFund?.id]);

  if (!activeFund) return null;
  const childName = childNameOf(activeFund);

  const savePin = async () => {
    if (pin.length < 4 || busy) return;
    setBusy(true);
    setMsg(null);
    setErr(null);
    try {
      const next = await apiUpdateKidViewSettings(activeFund.id, { enabled: true, pin });
      haptic("success");
      setSettings(next);
      setPin("");
      setMsg(`Kid View is on. ${childName} unlocks it with this PIN.`);
    } catch (e: any) {
      haptic("error");
      setErr(e?.message || "Couldn't set the PIN.");
    } finally {
      setBusy(false);
    }
  };

  const on = settings?.enabled && settings?.hasPin;

  return (
    <View>
      <SettingsHeader>Kid View</SettingsHeader>
      <KiddoCard>
        <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
          <KText variant="bodyStrong">A PIN-protected view for {childName}</KText>
          {on ? (
            <View
              style={{
                backgroundColor: colors.evergreen + "1F",
                borderRadius: radius.pill,
                paddingHorizontal: 10,
                paddingVertical: 3,
              }}
            >
              <KText variant="caption" color={colors.evergreen}>On</KText>
            </View>
          ) : null}
        </View>
        <KText variant="caption" color={semanticColors.text.muted} style={{ marginTop: 2 }}>
          {on
            ? "A safe, simplified view of their fund that they unlock with a PIN."
            : `Set a PIN so ${childName} can peek at their fund in a safe, simplified view.`}
        </KText>

        <View style={{ flexDirection: "row", gap: spacing.sm, marginTop: spacing.sm, alignItems: "flex-end" }}>
          <View style={{ flex: 1 }}>
            <KInput
              placeholder={on ? "Enter a new PIN" : "Choose a 4+ digit PIN"}
              value={pin}
              onChangeText={(t) => setPin(t.replace(/[^0-9]/g, "").slice(0, 8))}
              keyboardType="number-pad"
              secureTextEntry
            />
          </View>
          <Button label={on ? "Update" : "Set PIN"} onPress={savePin} loading={busy} disabled={pin.length < 4} />
        </View>
        {on && settings?.shareLink ? (
          <View style={{ flexDirection: "row", alignItems: "center", gap: 6, marginTop: spacing.sm }}>
            <Ionicons name="link-outline" size={14} color={semanticColors.text.muted} />
            <KText variant="caption" color={semanticColors.text.muted} numberOfLines={1} style={{ flex: 1 }}>
              {settings.shareLink.replace(/^https?:\/\//, "")}
            </KText>
          </View>
        ) : null}
        {msg ? (
          <KText variant="caption" color={colors.evergreen} style={{ marginTop: spacing.xs }}>{msg}</KText>
        ) : null}
        {err ? (
          <KText variant="caption" color="#C0392B" style={{ marginTop: spacing.xs }}>{err}</KText>
        ) : null}
      </KiddoCard>
    </View>
  );
}
