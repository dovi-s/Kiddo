// PlanScreen — native Plan & Billing, mirroring the web Account "Plan" tab.
// Shows the current plan, renewal, the plan-fit downgrade nudge, sponsored
// coverage, and the upgrade ladder. Stripe checkout + billing portal are web
// flows (PCI), so those buttons open the returned URL in the browser; cancel /
// reactivate / downgrade resolve server-side and we refetch. No present-tense
// custody claims; brand voice (no em-dashes, concise).
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
  apiGetSubscription,
  apiOpenBillingPortal,
  apiCancelSubscription,
  apiReactivateSubscription,
  apiDowngradeToPlus,
  apiCheckoutStarterPlan,
  apiCheckoutFamilyPlan,
  type SubscriptionInfo,
  type PlanTier,
} from "../api";

const PLAN_NAME: Record<PlanTier, string> = {
  free: "Free",
  starter: "Kiddo+",
  family: "Kiddo Family",
  legacy: "Kiddo Legacy",
};
// Canonical display prices (shared/monetization.ts). Hardcoded because @shared
// is not aliased into the mobile bundle; keep in sync if pricing changes.
const PLAN_PRICE: Record<PlanTier, string> = {
  free: "Free",
  starter: "$3.99/mo",
  family: "$6.99/mo",
  legacy: "$129/yr",
};
const RANK: Record<PlanTier, number> = { free: 0, starter: 1, family: 2, legacy: 3 };

const STARTER_BULLETS = [
  "One child fund",
  "Recurring investments",
  "Photo + video Memory Book",
  "Custom fund mix",
  "Co-parent access",
];
const FAMILY_BULLETS = [
  "Unlimited funds",
  "Memory Book for every child",
  "Unlimited occasions",
  "Kid View for every child",
  "One view per household",
];

function formatLongDate(value: string | null | undefined): string | null {
  if (!value) return null;
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });
}

export function PlanScreen({ fundId, onBack }: { fundId?: string; onBack: () => void }) {
  const insets = useSafeAreaInsets();
  const [sub, setSub] = useState<SubscriptionInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    setError(null);
    try {
      setSub(await apiGetSubscription());
    } catch (err: any) {
      setError(err?.message || "Could not load your plan.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const openUrl = async (url?: string) => {
    if (!url) {
      setError("Could not start checkout. Try again.");
      return;
    }
    try {
      await Linking.openURL(url);
    } catch {
      setError("Could not open the browser.");
    }
  };

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

  const plan = sub?.effectivePlan ?? "free";
  const isPaid = plan !== "free";
  const renewal = formatLongDate(sub?.currentPeriodEnd);
  const isCanceling =
    sub?.status === "canceled" && !!sub?.currentPeriodEnd && new Date(sub.currentPeriodEnd).getTime() > Date.now();
  const sponsored = sub?.sponsoredByFund
    ? Object.values(sub.sponsoredByFund).filter(Boolean)
    : [];

  const handleManageBilling = () =>
    run("portal", async () => {
      const { url } = await apiOpenBillingPortal({ plan, fundId });
      await openUrl(url);
    });

  const handleCancel = () => {
    haptic("warning");
    Alert.alert(
      `Cancel ${PLAN_NAME[plan]}?`,
      renewal ? `Your plan stays active until ${renewal}.` : "Your plan will end at the period close.",
      [
        { text: "Keep plan", style: "cancel" },
        {
          text: "Cancel plan",
          style: "destructive",
          onPress: () =>
            run("cancel", async () => {
              await apiCancelSubscription({ plan, fundId });
              await load(true);
            }),
        },
      ],
    );
  };

  const handleReactivate = () =>
    run("reactivate", async () => {
      await apiReactivateSubscription({ plan, fundId });
      await load(true);
    });

  const handleDowngrade = () =>
    run("downgrade", async () => {
      await apiDowngradeToPlus();
      await load(true);
    });

  const handleUpgradeStarter = () => {
    if (!fundId) {
      setError("Open a fund first to start Kiddo+.");
      return;
    }
    run("starter", async () => {
      const { url } = await apiCheckoutStarterPlan(fundId);
      await openUrl(url);
    });
  };

  const handleUpgradeFamily = () =>
    run("family", async () => {
      const { url } = await apiCheckoutFamilyPlan();
      await openUrl(url);
    });

  return (
    <View style={styles.screen}>
      <View style={[styles.header, { paddingTop: insets.top + 10 }]}>
        <Pressable onPress={onBack} style={styles.back} hitSlop={10}>
          <Ionicons name="arrow-back" size={20} color={colors.evergreen} />
        </Pressable>
        <KText variant="title">Plan &amp; billing</KText>
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
          {/* Current plan */}
          <KiddoCard>
            <View style={styles.rowBetween}>
              <KText variant="eyebrow" color={semanticColors.text.muted}>
                Your plan
              </KText>
              <View style={[styles.badge, isCanceling ? styles.badgeWarn : styles.badgeOk]}>
                <KText variant="caption" color={isCanceling ? "#6F4611" : colors.evergreen}>
                  {isCanceling ? "Ending soon" : isPaid ? "Active" : "Free"}
                </KText>
              </View>
            </View>
            <KText variant="title" style={{ marginTop: 4 }}>
              {PLAN_NAME[plan]}
            </KText>
            {isPaid ? (
              <KText variant="body" color={semanticColors.text.muted} style={{ marginTop: 2 }}>
                {PLAN_PRICE[plan]}
                {isCanceling && renewal
                  ? ` · ends ${renewal}`
                  : renewal
                    ? ` · renews ${renewal}`
                    : ""}
              </KText>
            ) : (
              <KText variant="body" color={semanticColors.text.muted} style={{ marginTop: 2 }}>
                No platform fee on gifts. The full gift goes to the fund.
              </KText>
            )}

            {isCanceling ? (
              <View style={{ marginTop: spacing.md }}>
                <Button
                  label="Keep my plan"
                  onPress={handleReactivate}
                  loading={busy === "reactivate"}
                  fullWidth
                />
              </View>
            ) : isPaid ? (
              <View style={{ marginTop: spacing.md, gap: spacing.sm }}>
                <Button
                  label="Manage billing"
                  variant="outline"
                  onPress={handleManageBilling}
                  loading={busy === "portal"}
                  fullWidth
                />
                <Button
                  label="Cancel plan"
                  variant="ghost"
                  onPress={handleCancel}
                  loading={busy === "cancel"}
                  fullWidth
                />
              </View>
            ) : null}
          </KiddoCard>

          {/* Plan-fit nudge */}
          {sub?.planFit ? (
            <KiddoCard style={styles.nudge}>
              <KText variant="label" color="#6F4611">
                {sub.planFit.kind === "downgrade_to_plus"
                  ? "Your plan is bigger than your family needs"
                  : "You do not need a paid plan right now"}
              </KText>
              <KText variant="body" color={semanticColors.text.muted} style={{ marginTop: 4 }}>
                {sub.planFit.fund?.childName
                  ? `You have one active fund for ${sub.planFit.fund.childName}.`
                  : "You have no active funds that need a paid plan."}
              </KText>
              <View style={{ marginTop: spacing.md }}>
                <Button
                  label={sub.planFit.kind === "downgrade_to_plus" ? "Switch to Kiddo+" : "Stop the paid plan"}
                  variant="outline"
                  onPress={sub.planFit.kind === "downgrade_to_plus" ? handleDowngrade : handleCancel}
                  loading={busy === "downgrade" || busy === "cancel"}
                  fullWidth
                />
              </View>
            </KiddoCard>
          ) : null}

          {/* Sponsored coverage */}
          {sponsored.map((s, i) =>
            s ? (
              <KiddoCard key={i} style={styles.nudge}>
                <KText variant="label" color="#6F4611">
                  {PLAN_NAME[s.tier]} from {s.sponsorName}
                </KText>
                <KText variant="body" color={semanticColors.text.muted} style={{ marginTop: 4 }}>
                  Covered through {formatLongDate(s.expiresAt) || "your sponsor's term"}.
                </KText>
              </KiddoCard>
            ) : null,
          )}

          {/* Upgrade ladder — only plans above the current one */}
          {RANK[plan] < RANK.starter ? (
            <PlanCard
              name="Kiddo+"
              price="$3.99/mo"
              bullets={STARTER_BULLETS}
              cta="Start Kiddo+"
              onPress={handleUpgradeStarter}
              loading={busy === "starter"}
            />
          ) : null}
          {RANK[plan] < RANK.family ? (
            <PlanCard
              name="Kiddo Family"
              price="$6.99/mo"
              hero
              badge="Best for families"
              bullets={FAMILY_BULLETS}
              cta="Get Kiddo Family"
              onPress={handleUpgradeFamily}
              loading={busy === "family"}
            />
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

function PlanCard({
  name,
  price,
  bullets,
  cta,
  onPress,
  loading,
  hero,
  badge,
}: {
  name: string;
  price: string;
  bullets: string[];
  cta: string;
  onPress: () => void;
  loading?: boolean;
  hero?: boolean;
  badge?: string;
}) {
  const fg = hero ? semanticColors.text.inverse : semanticColors.text.primary;
  const sub = hero ? "rgba(248,245,240,0.82)" : semanticColors.text.muted;
  return (
    <KiddoCard variant={hero ? "hero" : "default"}>
      <View style={styles.rowBetween}>
        <KText variant="heading" color={fg}>
          {name}
        </KText>
        {badge ? (
          <View style={styles.heroBadge}>
            <KText variant="caption" color="#F8D889">
              {badge}
            </KText>
          </View>
        ) : null}
      </View>
      <KText variant="body" color={sub} style={{ marginTop: 2 }}>
        {price}
      </KText>
      <View style={{ marginTop: spacing.sm, gap: 6 }}>
        {bullets.map((b) => (
          <View key={b} style={styles.bulletRow}>
            <Ionicons name="checkmark-circle" size={16} color={hero ? "#F8D889" : colors.evergreen} />
            <KText variant="body" color={fg} style={{ flex: 1 }}>
              {b}
            </KText>
          </View>
        ))}
      </View>
      <View style={{ marginTop: spacing.md }}>
        <Button label={cta} variant="monetization" onPress={onPress} loading={loading} fullWidth />
      </View>
    </KiddoCard>
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
  badgeOk: { backgroundColor: "#E7F0E9" },
  badgeWarn: { backgroundColor: "#FBEFD6" },
  nudge: { backgroundColor: "#FFF8EE", borderColor: "#E8C783" },
  heroBadge: { backgroundColor: "rgba(197,130,30,0.22)", borderRadius: radius.pill, paddingHorizontal: 10, paddingVertical: 3 },
  bulletRow: { flexDirection: "row", alignItems: "center", gap: 8 },
});
