import React, { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Image,
  Pressable,
  RefreshControl,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { colors, radius, spacing } from "@kora/tokens";
import { apiGetFundHoldings, apiGetFundGifts, formatBalance, type ApiFund, type ApiHolding, type ApiGift, WEB_BASE } from "../api";

function StockLogo({ ticker, size = 44 }: { ticker?: string | null; size?: number }) {
  const [failed, setFailed] = useState(false);
  const upper = String(ticker || "STK").trim().toUpperCase() || "STK";
  if (failed) {
    return (
      <View style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: colors.gold + "20", alignItems: "center", justifyContent: "center" }}>
        <Text style={{ fontSize: 10, fontWeight: "700", color: colors.gold }}>{upper.slice(0, 4)}</Text>
      </View>
    );
  }
  return (
    <View style={{ width: size, height: size, borderRadius: size / 2, overflow: "hidden", backgroundColor: "#fff", borderWidth: 1, borderColor: "#F0EDE8" }}>
      <Image
        source={{ uri: `https://assets.parqet.com/logos/symbol/${upper}?format=jpg` }}
        style={{ width: size, height: size }}
        onError={() => setFailed(true)}
      />
    </View>
  );
}

interface FundDetailScreenProps {
  fund: ApiFund;
  onBack: () => void;
}

export function FundDetailScreen({ fund, onBack }: FundDetailScreenProps) {
  const insets = useSafeAreaInsets();
  const [holdings, setHoldings] = useState<ApiHolding[]>([]);
  const [gifts, setGifts] = useState<ApiGift[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadData = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    setError(null);
    try {
      const [h, g] = await Promise.all([
        apiGetFundHoldings(fund.id),
        apiGetFundGifts(fund.id),
      ]);
      setHoldings(h);
      setGifts(g);
    } catch (err: any) {
      setError(err?.message || "Could not load fund details.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [fund.id]);

  useEffect(() => { loadData(); }, [loadData]);

  const handleRefresh = () => { setRefreshing(true); loadData(true); };

  const handleShare = async () => {
    const childName = fund.recipientFirstName || fund.name;
    const url = `${WEB_BASE}/${fund.slug}`;
    try {
      await Share.share({ message: `Give ${childName} a gift that grows: ${url}`, url });
    } catch {}
  };

  function giftStatusLabel(status: string) {
    switch ((status || "").toLowerCase()) {
      case "invested": return "Invested";
      case "settled": return "Invested";
      case "processing": return "Processing";
      case "pending": return "Pending";
      case "host_hold": return "Waiting";
      case "failed": return "Failed";
      default: return "Received";
    }
  }

  function giftStatusStyle(status: string) {
    switch ((status || "").toLowerCase()) {
      case "invested":
      case "settled": return styles.statusInvested;
      case "processing": return styles.statusProcessing;
      case "failed": return styles.statusFailed;
      default: return styles.statusDefault;
    }
  }

  const balance = parseFloat(String(fund.balance || "0"));
  const gain = parseFloat(String(fund.totalGain || "0"));
  const gainPercent = parseFloat(String(fund.gainPercent || "0"));
  const pending = parseFloat(String(fund.pendingBalance || "0"));
  // Settled cash that hasn't yet been invested. Distinct from
  // pending (Stripe in flight). Surfaced as its own card below
  // pending so the parent can see "$50 still waiting to invest"
  // without confusing it with the 1-3-day Stripe settle. Per
  // money-classification audit 2026-05-14. Optional on the API
  // (older responses may omit); defaults to 0.
  const cash = parseFloat(String((fund as any).cashBalance || "0"));
  const hasStarted = balance > 0 || pending > 0 || cash > 0 || gifts.length > 0;

  return (
    <View style={styles.screen}>
      {/* Header */}
      <View style={[styles.header, { paddingTop: insets.top + 14 }]}>
        <Pressable onPress={onBack} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={18} color={colors.evergreen} />
          <Text style={styles.backText}>Back</Text>
        </Pressable>
        <Text style={styles.headerTitle} numberOfLines={1}>{fund.recipientFirstName || fund.name}</Text>
        <Pressable onPress={handleShare} style={styles.shareBtn}>
          <Ionicons name="share-social-outline" size={14} color="#3D2B09" />
          <Text style={styles.shareText}>Share</Text>
        </Pressable>
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={colors.evergreen} />}
        showsVerticalScrollIndicator={false}
      >
        {/* Balance card */}
        <View style={styles.balanceCard}>
          <Text style={styles.balanceLabel}>{fund.recipientFirstName || fund.name}'s Fund</Text>
          <Text style={styles.balanceAmount}>{formatBalance(balance)}</Text>
          {gain === 0 ? (
            <Text style={styles.balanceSubcopy}>
              {hasStarted ? "Ready for the next gift" : "Every great fund starts here."}
            </Text>
          ) : (
            <View style={styles.gainRow}>
              <Text style={[styles.gainText, gain >= 0 ? styles.positive : styles.negative]}>
                {gain >= 0 ? "+" : ""}{formatBalance(gain)}
              </Text>
              <Text style={[styles.gainPct, gain >= 0 ? styles.positive : styles.negative]}>
                {" "}({gain >= 0 ? "+" : ""}{gainPercent.toFixed(2)}%)
              </Text>
            </View>
          )}
          <View style={styles.metaRow}>
            <Text style={styles.metaText}>
              {fund.contributorCount} gifter{fund.contributorCount !== 1 ? "s" : ""}. Private by gift link.
            </Text>
          </View>
        </View>

        {/* Pending balance */}
        {pending > 0 && (
          <View style={styles.pendingCard}>
            <Text style={styles.pendingLabel}>Pending</Text>
            <Text style={styles.pendingAmount}>{formatBalance(fund.pendingBalance)}</Text>
            <Text style={styles.pendingNote}>Gifts processing. Usually settles in 1-3 days.</Text>
          </View>
        )}

        {/* Cash settling into investments. Distinct from pending
            (Stripe in flight). This is money that has cleared
            Stripe + landed in DriveWealth but the auto-invest
            worker hasn't picked it up yet. Same card register as
            pending so the two states read as a related pair. Per
            money-classification audit 2026-05-14. */}
        {cash > 0 && (
          <View style={styles.pendingCard}>
            <Text style={styles.pendingLabel}>Waiting to invest</Text>
            <Text style={styles.pendingAmount}>{formatBalance(String(cash))}</Text>
            <Text style={styles.pendingNote}>Already in {fund.recipientFirstName || "the fund"}'s account. Investing on the next cycle.</Text>
          </View>
        )}

        {loading ? (
          <View style={styles.center}>
            <ActivityIndicator color={colors.evergreen} />
            <Text style={styles.loadingText}>Loading...</Text>
          </View>
        ) : error ? (
          <View style={styles.errorBox}>
            <Text style={styles.errorText}>{error}</Text>
            <Pressable onPress={() => loadData()} style={styles.retryBtn}>
              <Text style={styles.retryText}>Retry</Text>
            </Pressable>
          </View>
        ) : (
          <>
            {/* Holdings */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>What {fund.recipientFirstName || "they"} own{fund.recipientFirstName ? "s" : ""}</Text>
              {holdings.length === 0 ? (
                <View style={styles.emptySection}>
                  <Text style={styles.emptyTitle}>Gifts are on their way.</Text>
                  <Text style={styles.emptyText}>
                    Share the gift link. When the first gift arrives, we will help you verify so it can be invested.
                  </Text>
                  <Pressable onPress={handleShare} style={styles.shareCardBtn}>
                    <Text style={styles.shareCardBtnText}>Share gift link</Text>
                  </Pressable>
                </View>
              ) : (
                <View style={styles.list}>
                  {holdings.map((h) => {
                    const g = parseFloat(String(h.gain));
                    return (
                      <View key={h.id} style={styles.holdingRow}>
                        <StockLogo ticker={h.ticker} size={44} />
                        <View style={styles.holdingInfo}>
                          <Text style={styles.holdingName} numberOfLines={1}>{h.name}</Text>
                          <Text style={styles.holdingShares}>Part of {fund.recipientFirstName || "their"}'s future</Text>
                        </View>
                        <View style={styles.holdingRight}>
                          <Text style={styles.holdingValue}>{formatBalance(h.currentValue)}</Text>
                          {g !== 0 && (
                            <Text style={[styles.holdingGain, g >= 0 ? styles.positive : styles.negative]}>
                              {g >= 0 ? "+" : ""}{formatBalance(h.gain)}
                            </Text>
                          )}
                        </View>
                      </View>
                    );
                  })}
                </View>
              )}
            </View>

            {/* Recent gifts */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Every gift has a story</Text>
              {gifts.length === 0 ? (
                <View style={styles.emptySection}>
                  <Text style={styles.emptyTitle}>The first gift is the hardest.</Text>
                  <Text style={styles.emptyText}>After that, it is just birthdays.</Text>
                  <Pressable onPress={handleShare} style={styles.shareCardBtn}>
                    <Text style={styles.shareCardBtnText}>Share gift link</Text>
                  </Pressable>
                </View>
              ) : (
                <View style={styles.list}>
                  {gifts.slice(0, 10).map((g) => {
                    const date = new Date(g.createdAt);
                    const dateStr = date.toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" });
                    return (
                      <View key={g.id} style={styles.giftRow}>
                        <View style={styles.giftIcon}>
                          <Ionicons name="gift-outline" size={16} color={colors.evergreen} />
                        </View>
                        <View style={styles.giftInfo}>
                          <Text style={styles.giftSender}>{g.senderName || "A family gift"}</Text>
                          {g.message ? (
                            <Text style={styles.giftMessage} numberOfLines={2}>"{g.message}"</Text>
                          ) : null}
                          <Text style={styles.giftDate}>{dateStr}</Text>
                        </View>
                        <View style={styles.giftRight}>
                          <Text style={styles.giftAmount}>{formatBalance(g.amount)}</Text>
                          <View style={[styles.statusBadge, giftStatusStyle(g.status)]}>
                            <Text style={styles.statusText}>{giftStatusLabel(g.status)}</Text>
                          </View>
                        </View>
                      </View>
                    );
                  })}
                </View>
              )}
            </View>
          </>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
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
  backBtn: { flexDirection: "row", alignItems: "center", gap: 4, padding: 4 },
  backText: { fontSize: 15, color: colors.evergreen, fontWeight: "700" },
  headerTitle: { flex: 1, fontSize: 17, fontWeight: "800", color: colors.ink, textAlign: "center", marginHorizontal: spacing.sm },
  shareBtn: { flexDirection: "row", alignItems: "center", gap: 4, paddingVertical: 6, paddingHorizontal: 12, backgroundColor: colors.gold, borderRadius: 999 },
  shareText: { fontSize: 13, color: "#3D2B09", fontWeight: "700" },
  scroll: { flex: 1 },
  scrollContent: { padding: spacing.md, gap: spacing.md, paddingBottom: 40 },
  balanceCard: {
    backgroundColor: colors.evergreen,
    borderRadius: radius.card,
    padding: spacing.lg,
    gap: 4,
  },
  balanceLabel: { fontSize: 13, color: "rgba(255,255,255,0.7)" },
  balanceAmount: { fontSize: 38, fontWeight: "800", color: "#FFFFFF" },
  balanceSubcopy: { color: "#F8D889", fontSize: 15, fontWeight: "800" },
  gainRow: { flexDirection: "row", alignItems: "center" },
  gainText: { fontSize: 15, fontWeight: "600" },
  gainPct: { fontSize: 13 },
  positive: { color: "#86EFAC" },
  negative: { color: "#FCA5A5" },
  metaRow: { marginTop: 4 },
  metaText: { fontSize: 13, color: "rgba(255,255,255,0.6)" },
  pendingCard: {
    backgroundColor: "#FFFBEB",
    borderRadius: radius.card,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: "#FDE68A",
    gap: 2,
  },
  pendingLabel: { fontSize: 12, color: "#92400E", fontWeight: "600", textTransform: "uppercase", letterSpacing: 0.5 },
  pendingAmount: { fontSize: 22, fontWeight: "700", color: "#78350F" },
  pendingNote: { fontSize: 12, color: "#92400E" },
  center: { alignItems: "center", paddingVertical: 32, gap: 8 },
  loadingText: { color: "#6B7280", fontSize: 14 },
  errorBox: {
    backgroundColor: "#FEF2F2",
    borderRadius: radius.card,
    padding: spacing.md,
    alignItems: "center",
    gap: spacing.sm,
  },
  errorText: { color: "#DC2626", fontSize: 14, textAlign: "center" },
  retryBtn: { paddingVertical: 8, paddingHorizontal: 20, backgroundColor: "#DC2626", borderRadius: 8 },
  retryText: { color: "#FFFFFF", fontWeight: "600" },
  section: { gap: spacing.sm },
  sectionTitle: { fontSize: 16, fontWeight: "700", color: colors.ink },
  list: { gap: 8 },
  emptySection: {
    backgroundColor: "#FFFFFF",
    borderRadius: radius.card,
    padding: spacing.md,
    alignItems: "center",
    gap: spacing.sm,
    borderWidth: 1,
    borderColor: "#F0EDE8",
  },
  emptyTitle: { fontSize: 16, color: colors.ink, textAlign: "center", fontWeight: "800" },
  emptyText: { fontSize: 14, color: "#6B7280", textAlign: "center", lineHeight: 20 },
  shareCardBtn: { paddingVertical: 10, paddingHorizontal: 20, backgroundColor: colors.evergreen, borderRadius: 8 },
  shareCardBtnText: { color: "#FFFFFF", fontWeight: "600", fontSize: 14 },
  holdingRow: {
    backgroundColor: "#FFFFFF",
    borderRadius: radius.card,
    padding: spacing.md,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    borderWidth: 1,
    borderColor: "#F0EDE8",
  },
  tickerBadge: {
    width: 44,
    height: 44,
    borderRadius: radius.inner,
    backgroundColor: colors.gold + "20",
    alignItems: "center",
    justifyContent: "center",
  },
  tickerText: { fontSize: 12, fontWeight: "700", color: colors.gold },
  holdingInfo: { flex: 1 },
  holdingName: { fontSize: 14, fontWeight: "600", color: colors.ink },
  holdingShares: { fontSize: 12, color: "#9CA3AF", marginTop: 2 },
  holdingRight: { alignItems: "flex-end" },
  holdingValue: { fontSize: 15, fontWeight: "700", color: colors.ink },
  holdingGain: { fontSize: 12, fontWeight: "500", marginTop: 2 },
  giftRow: {
    backgroundColor: "#FFFFFF",
    borderRadius: radius.card,
    padding: spacing.md,
    flexDirection: "row",
    alignItems: "flex-start",
    gap: spacing.sm,
    borderWidth: 1,
    borderColor: "#F0EDE8",
  },
  giftIcon: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: "#F6EFE3",
    alignItems: "center",
    justifyContent: "center",
  },
  giftInfo: { flex: 1 },
  giftSender: { fontSize: 14, fontWeight: "800", color: colors.ink },
  giftMessage: { fontSize: 13, color: "#3F3A33", fontStyle: "italic", marginTop: 2, lineHeight: 18 },
  giftDate: { fontSize: 12, color: "#9CA3AF", marginTop: 2 },
  giftRight: { alignItems: "flex-end", gap: 4 },
  giftAmount: { fontSize: 15, fontWeight: "800", color: colors.ink },
  statusBadge: { paddingVertical: 2, paddingHorizontal: 7, borderRadius: 6, backgroundColor: "#F3F4F6" },
  statusInvested: { backgroundColor: "#DCFCE7" },
  statusProcessing: { backgroundColor: "#DBEAFE" },
  statusFailed: { backgroundColor: "#FEE2E2" },
  statusDefault: { backgroundColor: "#F3F4F6" },
  statusText: { fontSize: 11, fontWeight: "600", color: "#6B7280" },
});
