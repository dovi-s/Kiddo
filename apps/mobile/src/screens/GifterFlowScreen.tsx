import React, { useMemo, useState } from "react";
import {
  ActivityIndicator,
  Image,
  Linking,
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
import type { PublicGiftDestination } from "@kora/types";
import { formatCurrencyWhole, onboardingStockChoices } from "@kora/utils";
import { apiCreateGiftCheckout } from "../api";

function StockLogo({ ticker, size = 32, active = false }: { ticker: string; size?: number; active?: boolean }) {
  const [failed, setFailed] = useState(false);
  const upper = ticker.toUpperCase();
  if (failed) {
    return (
      <View style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: active ? "rgba(255,255,255,0.2)" : colors.gold + "20", alignItems: "center", justifyContent: "center" }}>
        <Text style={{ fontSize: 9, fontWeight: "700", color: active ? "#F8D889" : colors.gold }}>{upper.slice(0, 4)}</Text>
      </View>
    );
  }
  return (
    <View style={{ width: size, height: size, borderRadius: size / 2, overflow: "hidden", backgroundColor: "#fff", borderWidth: 1, borderColor: active ? "rgba(255,255,255,0.3)" : "#E5E0D8" }}>
      <Image
        source={{ uri: `https://assets.parqet.com/logos/symbol/${upper}?format=jpg` }}
        style={{ width: size, height: size }}
        onError={() => setFailed(true)}
      />
    </View>
  );
}

const AMOUNTS = [25, 50, 100, 250] as const;

const STOCK_COPY: Record<string, string> = {
  DIS: "For the magic",
  AAPL: "For the future",
  NKE: "For the ones who go for it",
  SBUX: "For the everyday wins",
  NFLX: "For the storytellers",
  AMZN: "For the builders",
  GOOGL: "For the curious ones",
  TSLA: "For the bold",
  SPOT: "For the music lovers",
  RBLX: "For the gamers",
};

const ROUGH_PRICES: Record<string, number> = {
  DIS: 100,
  AAPL: 220,
  AMZN: 200,
  GOOGL: 180,
  MSFT: 420,
  TSLA: 250,
  NKE: 80,
  SBUX: 95,
  NFLX: 900,
  SPOT: 650,
  RBLX: 60,
};

type Step = "amount" | "personalize" | "payment" | "handoff";
type PaymentMethod = "apple_pay" | "card" | "bank";

interface GifterFlowScreenProps {
  destination: PublicGiftDestination;
  identifier: string;
  onBack: () => void;
  onStartFund: () => void;
}

function processingFee(amount: number, method: PaymentMethod) {
  if (method === "bank") return Math.min(5, amount * 0.008);
  return amount * 0.029 + 0.3;
}

function sharesFor(amount: number, ticker: string) {
  const price = ROUGH_PRICES[ticker] || 100;
  return (amount / price).toFixed(amount < price ? 3 : 2);
}

export function GifterFlowScreen({ destination, identifier, onBack, onStartFund }: GifterFlowScreenProps) {
  const insets = useSafeAreaInsets();
  const [step, setStep] = useState<Step>("amount");
  const [amount, setAmount] = useState<(typeof AMOUNTS)[number]>(50);
  const [selectedTicker, setSelectedTicker] = useState(
    destination.fund.investmentPreferences?.defaultTicker ||
      destination.fund.defaultTicker ||
      "DIS",
  );
  const [senderName, setSenderName] = useState("");
  const [senderEmail, setSenderEmail] = useState("");
  const [message, setMessage] = useState("");
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>(Platform.OS === "ios" ? "apple_pay" : "card");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const childName = destination.fund.recipientFirstName || destination.fund.name || "this child";
  const heroImage = destination.event.imageUrl;
  const stock = onboardingStockChoices.find((choice) => choice.ticker === selectedTicker) || onboardingStockChoices[0];
  const shareCount = useMemo(() => sharesFor(amount, stock.ticker), [amount, stock.ticker]);
  const fee = processingFee(amount, paymentMethod);
  // Kiddo does NOT charge a platform fee on gifts. Per the locked
  // "gift amount stays whole" rule in MEMORY.md: $50 from grandma
  // is $50 to the fund. The gifter pays Stripe processing only.
  // Mobile gifter flow previously carried a stale $9.99 large-gift
  // fee for gifts >= $1,000 that contradicted this policy; removed
  // 2026-05-14 as part of the mobile parity audit. Keeping the
  // const at 0 (rather than deleting it) so the UI's fee-row
  // rendering stays structurally identical for future additions if
  // any Kiddo fees are ever re-introduced.
  const kiddoFee = 0;
  const total = amount + fee + kiddoFee;
  const childReceives = amount;

  const handleOpenCheckout = async () => {
    setLoading(true);
    setError(null);
    try {
      const checkout = await apiCreateGiftCheckout({
        fundId: destination.fund.id,
        eventId: destination.event.id || undefined,
        amount,
        senderName: senderName.trim() || undefined,
        senderEmail: senderEmail.trim() || undefined,
        message: message.trim() || undefined,
        paymentMethod,
        coverFees: true,
        executionModel: "pick",
        selectedTicker: stock.ticker,
      });
      if (!checkout.url) throw new Error("Checkout link did not come back.");
      await Linking.openURL(checkout.url);
      setStep("handoff");
    } catch (err: any) {
      setError(err?.message || "Could not open secure checkout.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={[
        styles.content,
        { paddingTop: insets.top + spacing.lg, paddingBottom: Math.max(insets.bottom, spacing.xxl) },
      ]}
      showsVerticalScrollIndicator={false}
      keyboardShouldPersistTaps="handled"
    >
      <View style={styles.heroCard}>
        {heroImage ? <Image source={{ uri: heroImage }} style={styles.heroImage} /> : <View style={styles.heroArt} />}
        <View style={styles.heroContent}>
          <Text style={styles.eyebrow}>No account needed</Text>
          <Text style={styles.title}>
            {step === "handoff" ? `You gave ${childName} something that grows.` : `Give ${childName} a gift that grows.`}
          </Text>
          <Text style={styles.body}>
            {step === "handoff"
              ? `${formatCurrencyWhole(amount)} in ${stock.name} is on its way. Your note is in the Memory Book.`
              : "Real stock. In the fund. In seconds."}
          </Text>
          <Text style={styles.meta}>{destination.event.name || identifier}</Text>
        </View>
      </View>

      {step === "amount" ? (
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>How much?</Text>
          <View style={styles.amountGrid}>
            {AMOUNTS.map((value) => (
              <Pressable
                key={value}
                onPress={() => setAmount(value)}
                accessibilityRole="radio"
                accessibilityState={{ checked: amount === value }}
                style={[styles.amountBtn, amount === value && styles.amountBtnActive]}
              >
                <Text style={[styles.amountValue, amount === value && styles.amountValueActive]}>{formatCurrencyWhole(value)}</Text>
                <Text style={[styles.amountShares, amount === value && styles.amountSharesActive]}>
                  about {sharesFor(value, selectedTicker)} shares
                </Text>
              </Pressable>
            ))}
          </View>
          <Text style={styles.hint}>Most people give $50 or $100.</Text>
          <Pressable onPress={() => setStep("personalize")} style={styles.primaryBtn}>
            <Text style={styles.primaryBtnText}>Continue</Text>
          </Pressable>
          <Pressable onPress={onBack} style={styles.secondaryBtn}>
            <Text style={styles.secondaryBtnText}>Open another gift page</Text>
          </Pressable>
        </View>
      ) : null}

      {step === "personalize" ? (
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Make it personal.</Text>
          <Text style={styles.sectionBody}>Pick a stock and leave a note. Both go in {childName}'s Memory Book.</Text>

          <View style={styles.stockGrid}>
            {onboardingStockChoices.map((choice) => {
              const active = choice.ticker === selectedTicker;
              return (
                <Pressable
                  key={choice.ticker}
                  onPress={() => setSelectedTicker(choice.ticker)}
                  accessibilityRole="radio"
                  accessibilityState={{ checked: active }}
                  style={[styles.stockCard, active && styles.stockCardActive]}
                >
                  <StockLogo ticker={choice.ticker} size={32} active={active} />
                  <Text style={[styles.stockTicker, active && styles.stockTickerActive]}>{choice.ticker}</Text>
                  <Text style={[styles.stockName, active && styles.stockNameActive]}>{choice.name}</Text>
                  <Text style={[styles.stockReason, active && styles.stockReasonActive]}>{STOCK_COPY[choice.ticker] || "For the future"}</Text>
                </Pressable>
              );
            })}
          </View>

          <View style={styles.previewCard}>
            <Text style={styles.previewText}>
              Your {formatCurrencyWhole(amount)} buys about {shareCount} shares of {stock.name}.
            </Text>
            <Text style={styles.previewFine}>Approximate only. Prices move. Investing involves risk.</Text>
          </View>

          <TextInput value={senderName} onChangeText={setSenderName} placeholder="Your name (optional)" placeholderTextColor={colors.muted} accessibilityLabel="Your name (optional)" style={styles.input} />
          <TextInput value={message} onChangeText={setMessage} placeholder={`Write something ${childName} will read later`} placeholderTextColor={colors.muted} accessibilityLabel={`A message for ${childName}`} style={[styles.input, styles.messageInput]} multiline />
          <TextInput value={senderEmail} onChangeText={setSenderEmail} placeholder="Email for receipt (optional)" placeholderTextColor={colors.muted} accessibilityLabel="Email for receipt (optional)" autoCapitalize="none" keyboardType="email-address" style={styles.input} />

          <Pressable onPress={() => setStep("payment")} style={styles.primaryBtn}>
            <Text style={styles.primaryBtnText}>Review gift</Text>
          </Pressable>
          <Pressable onPress={() => setStep("amount")} style={styles.secondaryBtn}>
            <Text style={styles.secondaryBtnText}>Change amount</Text>
          </Pressable>
        </View>
      ) : null}

      {step === "payment" ? (
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Almost done.</Text>
          <View style={styles.methodList}>
            <PaymentChoice id="apple_pay" active={paymentMethod === "apple_pay"} title="Apple Pay / Google Pay" body="Fastest" onPress={setPaymentMethod} />
            <PaymentChoice id="card" active={paymentMethod === "card"} title="Card" body="2.9% + $0.30" onPress={setPaymentMethod} />
            <PaymentChoice id="bank" active={paymentMethod === "bank"} title="Bank transfer" body="0.8%, max $5" onPress={setPaymentMethod} />
          </View>

          <View style={styles.feeBox}>
            <FeeRow label="Your gift" value={formatCurrencyWhole(amount)} />
            <FeeRow label="Processing" value={`$${fee.toFixed(2)}`} />
            <FeeRow label="Kiddo fee" value={kiddoFee > 0 ? `$${kiddoFee.toFixed(2)}` : "$0.00"} />
            <View style={styles.feeDivider} />
            <FeeRow label="You pay" value={`$${total.toFixed(2)}`} strong />
            <FeeRow label={`${childName} gets`} value={`$${childReceives.toFixed(2)}`} strong />
            <Text style={styles.feeNote}>Final fees are confirmed at secure checkout. Kiddo does not charge a platform fee on gifts. The full amount goes to {childName}'s fund.</Text>
          </View>

          {error ? <Text style={styles.error}>{error}</Text> : null}

          <Pressable onPress={handleOpenCheckout} disabled={loading} style={[styles.primaryBtn, loading && styles.primaryBtnDisabled]}>
            {loading ? <ActivityIndicator color="#FFFFFF" /> : <Text style={styles.primaryBtnText}>Send {childName}'s gift</Text>}
          </Pressable>
          <Text style={styles.legalLine}>
            Gifts are permanent once sent. When investing is live, assets will be held by our broker-dealer partner, SIPC-protected up to $500,000 (broker failure, not market loss). Values can go up or down.
          </Text>
          <Pressable onPress={() => setStep("personalize")} style={styles.secondaryBtn}>
            <Text style={styles.secondaryBtnText}>Back</Text>
          </Pressable>
        </View>
      ) : null}

      {step === "handoff" ? (
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>What happens next</Text>
          <Text style={styles.confirmTitle}>Your note is in the Memory Book.</Text>
          <Text style={styles.sectionBody}>
            A gift from today can become a story {childName} reads years from now.
          </Text>
          {/* Settling-window note. Matches the web GiftSuccess fix
              shipped earlier today. Tells the gifter the gift
              takes 1 to 2 business days to land in {child}'s
              investments. Without this, a gifter who checks the
              kid's balance on day 1 sees a mismatch and wonders
              where their money went. Per money-classification
              audit 2026-05-14. */}
          <Text style={styles.settlingNote}>
            Settles into {childName}'s investments over the next 1 to 2 business days.
          </Text>
          <Pressable onPress={onStartFund} style={styles.primaryBtn}>
            <Text style={styles.primaryBtnText}>Start a fund for my child</Text>
          </Pressable>
          <Pressable onPress={onBack} style={styles.secondaryBtn}>
            <Text style={styles.secondaryBtnText}>Done</Text>
          </Pressable>
        </View>
      ) : null}
    </ScrollView>
  );
}

function PaymentChoice({
  id,
  title,
  body,
  active,
  onPress,
}: {
  id: PaymentMethod;
  title: string;
  body: string;
  active: boolean;
  onPress: (id: PaymentMethod) => void;
}) {
  return (
    <Pressable
      onPress={() => onPress(id)}
      accessibilityRole="radio"
      accessibilityState={{ checked: active }}
      style={[styles.methodCard, active && styles.methodCardActive]}
    >
      <Text style={[styles.methodTitle, active && styles.methodTitleActive]}>{title}</Text>
      <Text style={[styles.methodBody, active && styles.methodBodyActive]}>{body}</Text>
    </Pressable>
  );
}

function FeeRow({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <View style={styles.feeRow}>
      <Text style={[styles.feeLabel, strong && styles.feeStrong]}>{label}</Text>
      <Text style={[styles.feeValue, strong && styles.feeStrong]}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: "#FAF8F4" },
  content: { padding: spacing.lg, gap: spacing.md, paddingBottom: spacing.xxl },
  heroCard: { borderRadius: 28, overflow: "hidden", backgroundColor: "#FFFFFF", borderWidth: 1, borderColor: "#EEE8DD" },
  heroImage: { width: "100%", height: 190 },
  heroArt: { width: "100%", height: 160, backgroundColor: "#F6EFE3" },
  heroContent: { padding: spacing.lg, gap: spacing.sm },
  eyebrow: { color: colors.evergreen, textTransform: "uppercase", letterSpacing: 1.4, fontSize: 12, fontWeight: "900" },
  title: { fontSize: 30, lineHeight: 36, fontWeight: "900", color: colors.ink },
  body: { fontSize: 16, lineHeight: 24, color: "#5E675F" },
  meta: { color: "#7C847D", fontSize: 13, fontWeight: "800" },
  card: { backgroundColor: "#FFFFFF", borderRadius: 28, padding: spacing.lg, gap: spacing.md, borderWidth: 1, borderColor: "#EEE8DD" },
  sectionTitle: { color: colors.ink, fontSize: 24, lineHeight: 30, fontWeight: "900" },
  sectionBody: { color: "#5E675F", fontSize: 15, lineHeight: 23 },
  settlingNote: { color: colors.muted, fontSize: 12, lineHeight: 17, marginTop: 8 },
  amountGrid: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm },
  amountBtn: { width: "47%", borderWidth: 1, borderColor: "#DED7CA", borderRadius: 20, paddingVertical: 18, paddingHorizontal: 12, backgroundColor: "#FAF7F1", gap: 4 },
  amountBtnActive: { backgroundColor: colors.evergreen, borderColor: colors.evergreen },
  amountValue: { color: colors.ink, fontWeight: "900", fontSize: 22 },
  amountValueActive: { color: "#FFFFFF" },
  amountShares: { color: "#6B7280", fontSize: 12, fontWeight: "700" },
  amountSharesActive: { color: "rgba(255,255,255,0.78)" },
  hint: { color: "#6B7280", fontSize: 13, fontWeight: "700" },
  primaryBtn: { borderRadius: 999, backgroundColor: colors.evergreen, paddingVertical: 16, alignItems: "center" },
  primaryBtnDisabled: { opacity: 0.7 },
  primaryBtnText: { color: "#FFFFFF", fontWeight: "900", fontSize: 16 },
  secondaryBtn: { alignItems: "center", paddingVertical: 8 },
  secondaryBtnText: { color: colors.ink, fontWeight: "800" },
  stockGrid: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm },
  stockCard: { width: "47%", backgroundColor: "#FAF7F1", borderRadius: 18, borderWidth: 1, borderColor: "#DED7CA", padding: spacing.md, gap: 3 },
  stockCardActive: { backgroundColor: colors.evergreen, borderColor: colors.evergreen },
  stockTicker: { color: colors.evergreen, fontSize: 13, fontWeight: "900" },
  stockTickerActive: { color: "#F8D889" },
  stockName: { color: colors.ink, fontSize: 15, fontWeight: "900" },
  stockNameActive: { color: "#FFFFFF" },
  stockReason: { color: "#6B7280", fontSize: 12, lineHeight: 16 },
  stockReasonActive: { color: "rgba(255,255,255,0.78)" },
  previewCard: { backgroundColor: "#F6EFE3", borderRadius: 18, padding: spacing.md, gap: 4 },
  previewText: { color: colors.ink, fontSize: 15, fontWeight: "900" },
  previewFine: { color: "#6B7280", fontSize: 12, lineHeight: 17 },
  input: { borderWidth: 1.5, borderColor: "#DED7CA", borderRadius: 18, paddingHorizontal: spacing.md, paddingVertical: 14, fontSize: 15, color: colors.ink, backgroundColor: "#FAF7F1" },
  messageInput: { minHeight: 96, textAlignVertical: "top" },
  methodList: { gap: spacing.sm },
  methodCard: { backgroundColor: "#FAF7F1", borderRadius: 18, padding: spacing.md, borderWidth: 1, borderColor: "#DED7CA" },
  methodCardActive: { backgroundColor: colors.evergreen, borderColor: colors.evergreen },
  methodTitle: { color: colors.ink, fontSize: 15, fontWeight: "900" },
  methodTitleActive: { color: "#FFFFFF" },
  methodBody: { color: "#6B7280", fontSize: 12, fontWeight: "700", marginTop: 2 },
  methodBodyActive: { color: "rgba(255,255,255,0.78)" },
  feeBox: { backgroundColor: "#F8F3EA", borderRadius: 20, padding: spacing.md, gap: spacing.sm },
  feeRow: { flexDirection: "row", justifyContent: "space-between", gap: spacing.md },
  feeLabel: { color: "#5E675F", fontSize: 14, fontWeight: "700" },
  feeValue: { color: colors.ink, fontSize: 14, fontWeight: "800" },
  feeStrong: { color: colors.ink, fontSize: 16, fontWeight: "900" },
  coverRow: { flexDirection: "row", alignItems: "flex-start", gap: spacing.sm },
  checkbox: { width: 22, height: 22, borderRadius: 7, borderWidth: 1.5, borderColor: "#C9BFAE", alignItems: "center", justifyContent: "center", backgroundColor: "#FFFFFF" },
  checkboxOn: { backgroundColor: colors.evergreen, borderColor: colors.evergreen },
  checkboxText: { color: "#FFFFFF", fontSize: 13, fontWeight: "900" },
  coverText: { flex: 1, color: "#5E675F", fontSize: 13, lineHeight: 19, fontWeight: "700" },
  feeDivider: { height: 1, backgroundColor: "#E5DDD0" },
  feeNote: { color: "#6B7280", fontSize: 11, lineHeight: 16 },
  error: { color: "#B42318", fontSize: 13 },
  legalLine: { color: "#6B7280", fontSize: 11, lineHeight: 17, textAlign: "center" },
  confirmTitle: { color: colors.ink, fontSize: 22, lineHeight: 28, fontWeight: "900" },
});
