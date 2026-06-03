// Investing settings — the live "How gifts get invested" editor for the Account
// tab. Replaces the static labels (Family default / Allowed when useful / …) with
// a real managed-mix selector + gifter preference toggles, wired to the strategy
// and investment-preferences endpoints. growth/balanced/conservative are free;
// custom is Plus-gated (the server 403s, which we surface inline).

import React, { useEffect, useState } from "react";
import { Pressable, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { colors, semanticColors, radius, spacing } from "@kora/tokens";
import { KText, KiddoCard, Pill, Skeleton, haptic } from "../ui";
import {
  apiGetFundStrategy,
  apiSetFundStrategy,
  apiGetInvestmentPreferences,
  apiUpdateInvestmentPreferences,
  type ApiFund,
  type ManagedStrategy,
  type InvestmentPreferences,
} from "../api";

function childNameOf(fund?: ApiFund | null): string {
  return fund?.recipientFirstName || fund?.name || "your child";
}

const PRESETS: Array<{ key: ManagedStrategy; label: string; blurb: string }> = [
  { key: "growth", label: "Growth", blurb: "Mostly stocks. Best for a long time horizon." },
  { key: "balanced", label: "Balanced", blurb: "A steadier mix of stocks and bonds." },
  { key: "conservative", label: "Conservative", blurb: "More bonds. Lower swings, slower growth." },
];

function Toggle({ on, onPress, busy }: { on: boolean; onPress: () => void; busy?: boolean }) {
  return (
    <Pressable
      onPress={onPress}
      disabled={busy}
      style={{
        width: 52,
        height: 30,
        borderRadius: 999,
        padding: 3,
        backgroundColor: on ? colors.evergreen : semanticColors.surface.muted,
        justifyContent: "center",
        opacity: busy ? 0.6 : 1,
      }}
    >
      <View
        style={{
          width: 24,
          height: 24,
          borderRadius: 12,
          backgroundColor: "#FFFFFF",
          alignSelf: on ? "flex-end" : "flex-start",
        }}
      />
    </Pressable>
  );
}

export function InvestingSection({ activeFund }: { activeFund: ApiFund | null }) {
  const [strategy, setStrategy] = useState<ManagedStrategy | null>(null);
  const [prefs, setPrefs] = useState<InvestmentPreferences | null>(null);
  const [loading, setLoading] = useState(true);
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    if (!activeFund) return;
    setLoading(true);
    Promise.all([apiGetFundStrategy(activeFund.id), apiGetInvestmentPreferences(activeFund.id)])
      .then(([s, p]) => {
        if (cancelled) return;
        setStrategy(s.strategy);
        setPrefs(p);
      })
      .catch(() => {})
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [activeFund?.id]);

  if (!activeFund) return null;
  const childName = childNameOf(activeFund);
  const isReadOnly =
    (activeFund as any)?.accessRole === "previous_owner" && Boolean((activeFund as any)?.transferredAt);

  const pickStrategy = async (key: ManagedStrategy) => {
    if (key === strategy || busyKey || isReadOnly) return;
    setBusyKey("strategy");
    setErr(null);
    const prev = strategy;
    setStrategy(key); // optimistic
    try {
      await apiSetFundStrategy(activeFund.id, key);
      haptic("success");
    } catch (e: any) {
      setStrategy(prev);
      haptic("error");
      setErr(e?.message || "Couldn't change the mix.");
    } finally {
      setBusyKey(null);
    }
  };

  const toggle = async (field: "allowGifterStockPick" | "allowGifterCashGift") => {
    if (!prefs || busyKey || isReadOnly) return;
    setBusyKey(field);
    setErr(null);
    const next = !prefs[field];
    setPrefs({ ...prefs, [field]: next }); // optimistic
    try {
      const saved = await apiUpdateInvestmentPreferences(activeFund.id, { [field]: next });
      setPrefs(saved);
      haptic("selection");
    } catch (e: any) {
      setPrefs({ ...prefs, [field]: !next });
      haptic("error");
      setErr(e?.message || "Couldn't update that setting.");
    } finally {
      setBusyKey(null);
    }
  };

  return (
    <View>
      <KText variant="sectionLabel" color={semanticColors.text.muted} style={{ marginBottom: spacing.xs }}>
        How gifts get invested
      </KText>

      {loading ? (
        <Skeleton height={150} rounded={radius.card} />
      ) : (
        <View style={{ gap: spacing.sm }}>
          {/* managed mix */}
          <KiddoCard>
            <KText variant="bodyStrong">{childName}'s mix</KText>
            <KText variant="caption" color={semanticColors.text.muted} style={{ marginTop: 2, marginBottom: spacing.sm }}>
              {PRESETS.find((p) => p.key === strategy)?.blurb ||
                (strategy === "custom" ? "A custom mix you set on the web." : "Choose how new gifts are invested.")}
            </KText>
            <View style={{ flexDirection: "row", gap: spacing.xs, flexWrap: "wrap" }}>
              {PRESETS.map((p) => (
                <Pill
                  key={p.key}
                  label={p.label}
                  active={strategy === p.key}
                  onPress={isReadOnly ? undefined : () => pickStrategy(p.key)}
                />
              ))}
            </View>
            {strategy === "custom" ? (
              <KText variant="caption" color={semanticColors.text.muted} style={{ marginTop: spacing.sm }}>
                Custom mix is active. Adjust the exact allocations on the web app.
              </KText>
            ) : null}
          </KiddoCard>

          {/* gifter preferences */}
          {prefs ? (
            <KiddoCard>
              <ToggleRow
                title="Gifters can pick a stock"
                body={`Let gifters choose a specific company for ${childName} (like Disney), not just the mix.`}
                on={prefs.allowGifterStockPick}
                busy={busyKey === "allowGifterStockPick"}
                disabled={isReadOnly}
                onToggle={() => toggle("allowGifterStockPick")}
              />
              <View style={{ height: 1, backgroundColor: semanticColors.surface.muted, marginVertical: spacing.sm }} />
              <ToggleRow
                title="Gifters can send cash"
                body="Allow cash gifts that stay as cash instead of being invested."
                on={prefs.allowGifterCashGift}
                busy={busyKey === "allowGifterCashGift"}
                disabled={isReadOnly}
                onToggle={() => toggle("allowGifterCashGift")}
              />
            </KiddoCard>
          ) : null}

          {err ? <KText variant="caption" color="#C0392B">{err}</KText> : null}
        </View>
      )}
    </View>
  );
}

function ToggleRow({
  title,
  body,
  on,
  busy,
  disabled,
  onToggle,
}: {
  title: string;
  body: string;
  on: boolean;
  busy?: boolean;
  disabled?: boolean;
  onToggle: () => void;
}) {
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.md }}>
      <View style={{ flex: 1 }}>
        <KText variant="bodyStrong">{title}</KText>
        <KText variant="caption" color={semanticColors.text.muted} style={{ marginTop: 2 }}>
          {body}
        </KText>
      </View>
      {disabled ? (
        <Ionicons name={on ? "checkmark-circle" : "ellipse-outline"} size={24} color={semanticColors.text.muted} />
      ) : (
        <Toggle on={on} busy={busy} onPress={onToggle} />
      )}
    </View>
  );
}
