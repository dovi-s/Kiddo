// RecurringScreen — manage the parent's recurring auto-invest (parent
// contributions) and gifters' recurring gifts for one fund. Pause / resume /
// cancel resolve in-app and refetch; "contribute now" opens a Stripe one-time
// checkout (web/PCI). Creating a brand-new recurring investment needs a linked
// bank (Plaid), which lives on the web, so that is a handoff link for now.
import React, { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Linking,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { colors, semanticColors, radius, spacing } from "@kora/tokens";
import { KText, KiddoCard, Button, haptic } from "../ui";
import {
  apiGetParentContributions,
  apiUpdateParentContribution,
  apiDeleteParentContribution,
  apiContributeNow,
  apiGetRecurringGifts,
  apiUpdateRecurringGift,
  formatBalance,
  WEB_BASE,
  type ParentContribution,
  type RecurringGift,
} from "../api";

const FREQ_SUFFIX: Record<string, string> = {
  daily: "/day",
  weekly: "/wk",
  monthly: "/mo",
  yearly: "/yr",
};

function freqSuffix(f?: string | null): string {
  return FREQ_SUFFIX[String(f || "monthly").toLowerCase()] || "/mo";
}

function shortDate(value?: string | null): string | null {
  if (!value) return null;
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function isActive(status?: string | null): boolean {
  return String(status || "").toLowerCase() === "active";
}
function isPaused(status?: string | null): boolean {
  return String(status || "").toLowerCase() === "paused";
}

function StatusBadge({ status }: { status?: string | null }) {
  const active = isActive(status);
  const paused = isPaused(status);
  const bg = active ? "#E7F0E9" : paused ? "#FBEFD6" : "#EDE7DC";
  const fg = active ? colors.evergreen : paused ? "#6F4611" : semanticColors.text.muted;
  const label = active ? "Active" : paused ? "Paused" : "Canceled";
  return (
    <View style={[styles.badge, { backgroundColor: bg }]}>
      <KText variant="caption" color={fg}>
        {label}
      </KText>
    </View>
  );
}

export function RecurringScreen({
  fundId,
  fundName,
  onBack,
}: {
  fundId: string;
  fundName?: string;
  onBack: () => void;
}) {
  const insets = useSafeAreaInsets();
  const [contribs, setContribs] = useState<ParentContribution[]>([]);
  const [gifts, setGifts] = useState<RecurringGift[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(
    async (silent = false) => {
      if (!silent) setLoading(true);
      setError(null);
      try {
        const [c, g] = await Promise.all([
          apiGetParentContributions(fundId).catch(() => [] as ParentContribution[]),
          apiGetRecurringGifts(fundId).catch(() => [] as RecurringGift[]),
        ]);
        // Hide already-canceled rows; they are just noise here.
        setContribs(c.filter((x) => String(x.status).toLowerCase() !== "cancelled"));
        setGifts(g.filter((x) => String(x.status).toLowerCase() !== "cancelled"));
      } catch (err: any) {
        setError(err?.message || "Could not load your recurring plans.");
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [fundId],
  );

  useEffect(() => {
    load();
  }, [load]);

  const run = async (key: string, fn: () => Promise<void>) => {
    setBusy(key);
    setError(null);
    try {
      await fn();
    } catch (err: any) {
      setError(err?.message || "Something went wrong. Try again.");
    } finally {
      setBusy(null);
    }
  };

  const toggleContrib = (c: ParentContribution) =>
    run(`c:${c.id}`, async () => {
      haptic("selection");
      await apiUpdateParentContribution(c.id, { status: isActive(c.status) ? "paused" : "active" });
      await load(true);
    });

  const contributeNow = (c: ParentContribution) =>
    run(`now:${c.id}`, async () => {
      const { url } = await apiContributeNow(c.id);
      if (url) await Linking.openURL(url).catch(() => setError("Could not open the browser."));
      else setError("Could not start the contribution.");
    });

  const cancelContrib = (c: ParentContribution) => {
    haptic("warning");
    Alert.alert("Stop this recurring investment?", "You can set up a new one anytime.", [
      { text: "Keep it", style: "cancel" },
      {
        text: "Stop it",
        style: "destructive",
        onPress: () =>
          run(`del:${c.id}`, async () => {
            await apiDeleteParentContribution(c.id);
            await load(true);
          }),
      },
    ]);
  };

  const toggleGift = (g: RecurringGift) =>
    run(`g:${g.id}`, async () => {
      haptic("selection");
      await apiUpdateRecurringGift(g.id, isActive(g.status) ? "paused" : "active");
      await load(true);
    });

  const cancelGift = (g: RecurringGift) => {
    haptic("warning");
    Alert.alert(`Stop ${g.senderName}'s recurring gift?`, "They will not be charged again.", [
      { text: "Keep it", style: "cancel" },
      {
        text: "Stop it",
        style: "destructive",
        onPress: () =>
          run(`gdel:${g.id}`, async () => {
            await apiUpdateRecurringGift(g.id, "cancelled");
            await load(true);
          }),
      },
    ]);
  };

  const hasNothing = contribs.length === 0 && gifts.length === 0;

  return (
    <View style={styles.screen}>
      <View style={[styles.header, { paddingTop: insets.top + 10 }]}>
        <Pressable onPress={onBack} style={styles.back} hitSlop={10}>
          <Ionicons name="arrow-back" size={20} color={colors.evergreen} />
        </Pressable>
        <KText variant="title">Recurring</KText>
        <View style={{ width: 20 }} />
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator color={colors.evergreen} />
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={{ padding: spacing.md, paddingBottom: insets.bottom + spacing.xl, gap: spacing.md }}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => {
                setRefreshing(true);
                load(true);
              }}
              tintColor={colors.evergreen}
            />
          }
        >
          {/* Parent contributions */}
          {contribs.length > 0 ? (
            <View style={{ gap: spacing.sm }}>
              <KText variant="sectionLabel">Your recurring investments</KText>
              {contribs.map((c) => (
                <KiddoCard key={c.id}>
                  <View style={styles.rowBetween}>
                    <KText variant="heading">
                      {formatBalance(parseFloat(String(c.amount || "0")))}
                      <KText variant="body" color={semanticColors.text.muted}>
                        {freqSuffix(c.frequency)}
                      </KText>
                    </KText>
                    <StatusBadge status={c.status} />
                  </View>
                  <KText variant="caption" color={semanticColors.text.muted} style={{ marginTop: 2 }}>
                    {isPaused(c.status)
                      ? "Paused"
                      : shortDate(c.nextRunDate)
                        ? `Next on ${shortDate(c.nextRunDate)}`
                        : "Scheduled"}
                    {c.executionModel === "pick" && c.selectedTicker ? ` · ${c.selectedTicker}` : ""}
                  </KText>
                  <View style={styles.actions}>
                    <Button
                      label={isActive(c.status) ? "Pause" : "Resume"}
                      variant="outline"
                      size="sm"
                      onPress={() => toggleContrib(c)}
                      loading={busy === `c:${c.id}`}
                    />
                    <Button
                      label="Add now"
                      variant="ghost"
                      size="sm"
                      onPress={() => contributeNow(c)}
                      loading={busy === `now:${c.id}`}
                    />
                    <Button
                      label="Stop"
                      variant="ghost"
                      size="sm"
                      onPress={() => cancelContrib(c)}
                      loading={busy === `del:${c.id}`}
                    />
                  </View>
                </KiddoCard>
              ))}
            </View>
          ) : null}

          {/* Gifter recurring */}
          {gifts.length > 0 ? (
            <View style={{ gap: spacing.sm }}>
              <KText variant="sectionLabel">Recurring gifts</KText>
              {gifts.map((g) => (
                <KiddoCard key={g.id}>
                  <View style={styles.rowBetween}>
                    <View style={{ flex: 1 }}>
                      <KText variant="heading">{g.senderName}</KText>
                      <KText variant="caption" color={semanticColors.text.muted} style={{ marginTop: 2 }}>
                        {formatBalance(parseFloat(String(g.amount || "0")))}
                        {freqSuffix(g.frequency)}
                        {isActive(g.status) && shortDate(g.nextChargeDate)
                          ? ` · next ${shortDate(g.nextChargeDate)}`
                          : ""}
                      </KText>
                    </View>
                    <StatusBadge status={g.status} />
                  </View>
                  <View style={styles.actions}>
                    <Button
                      label={isActive(g.status) ? "Pause" : "Resume"}
                      variant="outline"
                      size="sm"
                      onPress={() => toggleGift(g)}
                      loading={busy === `g:${g.id}`}
                    />
                    <Button
                      label="Stop"
                      variant="ghost"
                      size="sm"
                      onPress={() => cancelGift(g)}
                      loading={busy === `gdel:${g.id}`}
                    />
                  </View>
                </KiddoCard>
              ))}
            </View>
          ) : null}

          {hasNothing ? (
            <KiddoCard>
              <KText variant="heading">No recurring plans yet</KText>
              <KText variant="caption" color={semanticColors.text.muted} style={{ marginTop: 4, marginBottom: spacing.md }}>
                A small amount every month is how {fundName || "this fund"} grows the most. Set one up on the web, then manage it here.
              </KText>
              <Button
                label="Set up recurring"
                variant="outline"
                onPress={() => Linking.openURL(`${WEB_BASE}/dashboard`).catch(() => {})}
                fullWidth
              />
            </KiddoCard>
          ) : null}

          {error ? (
            <KText variant="caption" color={semanticColors.danger.text} style={{ textAlign: "center" }}>
              {error}
            </KText>
          ) : null}
        </ScrollView>
      )}
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
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  rowBetween: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  badge: { borderRadius: radius.pill, paddingHorizontal: 10, paddingVertical: 3 },
  actions: { flexDirection: "row", alignItems: "center", gap: spacing.sm, marginTop: spacing.md, flexWrap: "wrap" },
});
