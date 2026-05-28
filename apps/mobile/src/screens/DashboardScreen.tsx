import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Modal,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { colors, radius, spacing } from "@kora/tokens";
import { slugify } from "@kora/utils";
import {
  apiCreateEvent,
  apiGetAllEvents,
  apiGetFundGifts,
  apiGetFunds,
  apiGetMobilePushPreferences,
  apiLogout,
  apiQueueTestMobilePush,
  apiRegisterMobilePushToken,
  apiUpdateMobilePushPreferences,
  formatBalance,
  type ApiEvent,
  type ApiFund,
  type ApiGift,
  type ApiUser,
  WEB_BASE,
} from "../api";
import { registerForPushNotificationsAsync } from "../push";
import {
  authenticate as authenticateBiometric,
  getBiometricCapability,
  getOrCreateDeviceId,
  isBiometricEnabled,
  setBiometricEnabled,
  type BiometricCapability,
} from "../biometric";
import * as Device from "expo-device";
import {
  apiRegisterTrustedDevice,
  apiListTrustedDevices,
  apiRevokeTrustedDevice,
  type TrustedDeviceRow,
} from "../api";

type Tab = "home" | "memory" | "gift" | "growth" | "settings";

type GiftWithFund = ApiGift & {
  fundId: string;
  fundName: string;
  recipientName: string;
};

interface DashboardScreenProps {
  user: ApiUser;
  onLogout: () => void;
  onSelectFund: (fund: ApiFund) => void;
  onAddFund: () => void;
}

function getChildName(fund?: ApiFund | null) {
  return fund?.recipientFirstName || fund?.name || "your child";
}

function formatShortDate(value: string | null | undefined) {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function yearsUntil18(birthdate?: string | null) {
  if (!birthdate) return null;
  const birth = new Date(`${birthdate}T12:00:00.000Z`);
  if (Number.isNaN(birth.getTime())) return null;
  const eighteen = new Date(birth);
  eighteen.setFullYear(eighteen.getFullYear() + 18);
  const diffDays = Math.ceil((eighteen.getTime() - Date.now()) / (1000 * 60 * 60 * 24));
  if (diffDays <= 0) return "ready now";
  const years = Math.floor(diffDays / 365);
  const months = Math.max(0, Math.round((diffDays % 365) / 30));
  if (years <= 0) return `${months} month${months === 1 ? "" : "s"}`;
  if (months <= 0) return `${years} year${years === 1 ? "" : "s"}`;
  return `${years} year${years === 1 ? "" : "s"} and ${months} month${months === 1 ? "" : "s"}`;
}

function shareFund(fund: ApiFund) {
  const childName = getChildName(fund);
  const url = `${WEB_BASE}/${fund.slug}`;
  return Share.share({
    message: `Give ${childName} a gift that grows: ${url}`,
    url,
  });
}

// ─── Fund Switcher Modal ────────────────────────────────────────────────────

function FundSwitcherModal({
  visible,
  funds,
  activeFundId,
  onSelect,
  onClose,
  onAddFund,
}: {
  visible: boolean;
  funds: ApiFund[];
  activeFundId: string;
  onSelect: (fund: ApiFund) => void;
  onClose: () => void;
  onAddFund: () => void;
}) {
  const insets = useSafeAreaInsets();

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={switcher.overlay} onPress={onClose} />
      <View style={[switcher.sheet, { paddingBottom: Math.max(insets.bottom, 24) }]}>
        <View style={switcher.handle} />
        <Text style={switcher.heading}>Your funds</Text>
        {funds.map((fund) => {
          const isActive = fund.id === activeFundId;
          const bal = parseFloat(String(fund.balance || "0"));
          return (
            <Pressable
              key={fund.id}
              onPress={() => { onSelect(fund); onClose(); }}
              style={[switcher.row, isActive && switcher.rowActive]}
            >
              <View style={[switcher.dot, isActive && switcher.dotActive]} />
              <View style={switcher.rowInfo}>
                <Text style={[switcher.rowName, isActive && switcher.rowNameActive]}>
                  {getChildName(fund)}
                </Text>
                <Text style={switcher.rowBal}>{formatBalance(bal)}</Text>
              </View>
              {isActive && <Ionicons name="checkmark" size={18} color={colors.evergreen} />}
            </Pressable>
          );
        })}
        <Pressable
          onPress={() => { onClose(); onAddFund(); }}
          style={switcher.addRow}
        >
          <Ionicons name="add-circle-outline" size={20} color={colors.evergreen} />
          <Text style={switcher.addText}>Add another fund</Text>
        </Pressable>
      </View>
    </Modal>
  );
}

// ─── Tab Bar ────────────────────────────────────────────────────────────────

function TabBar({ active, onPress }: { active: Tab; onPress: (tab: Tab) => void }) {
  const insets = useSafeAreaInsets();
  const tabs: Array<{ id: Tab; label: string; icon: string; iconActive: string }> = [
    { id: "home", label: "Home", icon: "home-outline", iconActive: "home" },
    { id: "memory", label: "Memory", icon: "book-outline", iconActive: "book" },
    { id: "gift", label: "Gift", icon: "gift-outline", iconActive: "gift" },
    { id: "growth", label: "Growth", icon: "trending-up-outline", iconActive: "trending-up" },
    { id: "settings", label: "Settings", icon: "settings-outline", iconActive: "settings" },
  ];

  return (
    <View style={[tabStyles.bar, { paddingBottom: Math.max(insets.bottom, 14) }]}>
      {tabs.map((tab) => {
        const isActive = active === tab.id;
        const isGift = tab.id === "gift";
        return (
          <Pressable key={tab.id} onPress={() => onPress(tab.id)} style={[tabStyles.tabBtn, isGift && tabStyles.tabBtnCenter]}>
            <View style={[tabStyles.iconWrap, isGift && tabStyles.iconWrapGift, isActive && !isGift && tabStyles.iconWrapActive]}>
              <Ionicons
                name={(isActive ? tab.iconActive : tab.icon) as any}
                size={isGift ? 22 : 20}
                color={isGift ? "#3D2B09" : isActive ? colors.evergreen : "#8B948C"}
              />
            </View>
            <Text style={[tabStyles.tabLabel, isActive && tabStyles.tabLabelActive, isGift && tabStyles.tabLabelGift]}>
              {tab.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

// ─── Home Tab ───────────────────────────────────────────────────────────────

function HomeTab({
  activeFund,
  events,
  gifts,
  loading,
  refreshing,
  error,
  onRefresh,
  onSelectFund,
  onAddFund,
  onCreateEvent,
}: {
  activeFund: ApiFund | null;
  events: ApiEvent[];
  gifts: GiftWithFund[];
  loading: boolean;
  refreshing: boolean;
  error: string | null;
  onRefresh: () => void;
  onSelectFund: (fund: ApiFund) => void;
  onAddFund: () => void;
  onCreateEvent: () => void;
}) {
  const childName = getChildName(activeFund);
  const balance = activeFund ? parseFloat(String(activeFund.balance || "0")) : 0;
  const gain = activeFund ? parseFloat(String(activeFund.totalGain || "0")) : 0;
  const fundGifts = activeFund ? gifts.filter((g) => g.fundId === activeFund.id) : [];
  const activeEvents = events
    .filter((e) => e.status === "active" && (!activeFund || String(e.fundId) === String(activeFund?.id)))
    .slice(0, 2);
  const upcoming = activeFund ? yearsUntil18(activeFund.recipientBirthdate) : null;
  const hasStarted = balance > 0 || fundGifts.length > 0;

  const handleShare = async () => {
    if (!activeFund) return;
    try { await shareFund(activeFund); } catch {}
  };

  return (
    <ScrollView
      style={styles.scroll}
      contentContainerStyle={styles.scrollContent}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.evergreen} />}
      showsVerticalScrollIndicator={false}
    >
      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator color={colors.evergreen} />
          <Text style={styles.loadingText}>Opening your funds...</Text>
        </View>
      ) : error ? (
        <View style={styles.errorBox}>
          <Text style={styles.errorTitle}>Something did not load.</Text>
          <Text style={styles.errorText}>{error}</Text>
          <Pressable onPress={onRefresh} style={styles.primarySmallBtn}>
            <Text style={styles.primarySmallBtnText}>Try again</Text>
          </Pressable>
        </View>
      ) : !activeFund ? (
        <View style={styles.emptyHero}>
          <Text style={styles.emptyTitle}>Every great fund starts here.</Text>
          <Text style={styles.emptyBody}>Create one fund, share one link, and let the first gift change the screen.</Text>
          <Pressable onPress={onAddFund} style={styles.primaryBtn}>
            <Text style={styles.primaryBtnText}>Start a fund</Text>
          </Pressable>
        </View>
      ) : (
        <>
          <Pressable onPress={() => onSelectFund(activeFund)} style={styles.heroCard}>
            <Text style={styles.heroLabel}>{childName}'s Fund</Text>
            <Text style={styles.heroAmount}>{formatBalance(balance)}</Text>
            <Text style={styles.heroGain}>
              {!hasStarted
                ? "Every great fund starts here"
                : gain === 0
                  ? "Ready for the next gift"
                  : `${gain > 0 ? "+" : ""}${formatBalance(gain)} all time`}
            </Text>
            {upcoming ? (
              <Text style={styles.heroSubline}>{childName} turns 18 in {upcoming}</Text>
            ) : null}
          </Pressable>

          {!hasStarted ? (
            <View style={styles.nextStepCard}>
              <Text style={styles.nextStepEyebrow}>Next step</Text>
              <Text style={styles.nextStepTitle}>Share {childName}'s link.</Text>
              <Text style={styles.nextStepBody}>
                The first gift is the moment this becomes real. When it arrives, we will ask you to verify your identity so gifts can be invested.
              </Text>
              <Pressable onPress={handleShare} style={styles.primaryBtn}>
                <Text style={styles.primaryBtnText}>Share {childName}'s link</Text>
              </Pressable>
            </View>
          ) : null}

          <View style={styles.actionRow}>
            <Pressable onPress={handleShare} style={styles.primaryAction}>
              <Ionicons name="share-social-outline" size={16} color="#38290A" style={{ marginRight: 6 }} />
              <Text style={styles.primaryActionText}>Share link</Text>
            </Pressable>
            <Pressable onPress={() => onSelectFund(activeFund)} style={styles.secondaryAction}>
              <Text style={styles.secondaryActionText}>View fund</Text>
            </Pressable>
          </View>

          <Section title="What is happening" cta={fundGifts.length > 2 ? "Latest 2" : undefined}>
            {fundGifts.length === 0 ? (
              <SoftCard
                title="Share gift link"
                body={`Share ${childName}'s gift link to start receiving investments for their future.`}
              />
            ) : (
              fundGifts.slice(0, 2).map((gift) => (
                <ListRow
                  key={gift.id}
                  icon="gift-outline"
                  title={`${gift.senderName || "Someone"} gave ${formatBalance(gift.amount)}`}
                  body={`${gift.recipientName}'s fund${gift.message ? `: "${gift.message}"` : ""}`}
                  right={formatShortDate(gift.createdAt) || ""}
                />
              ))
            )}
          </Section>

          <Section title="Events">
            {activeEvents.length === 0 ? (
              <SoftCard title="No event live" body="Create one for a birthday, baby shower, holiday, or just because." />
            ) : (
              activeEvents.map((event) => (
                <EventPreview key={event.id} event={event} />
              ))
            )}
            <Pressable onPress={onCreateEvent} style={styles.textAction}>
              <Ionicons name="add" size={14} color={colors.evergreen} />
              <Text style={styles.textActionText}>New event</Text>
            </Pressable>
          </Section>

          <Section title="Coming up">
            <View style={styles.countdownCard}>
              <Text style={styles.countdownLabel}>{childName}'s 18th birthday</Text>
              <Text style={styles.countdownValue}>
                {upcoming ? `in ${upcoming}` : "Add a birthday to start the countdown"}
              </Text>
              <Text style={styles.countdownBody}>
                Memory Book first. Money second. This is what all of it is building toward.
              </Text>
            </View>
          </Section>
        </>
      )}
    </ScrollView>
  );
}

// ─── Memory Tab ─────────────────────────────────────────────────────────────

function MemoryTab({
  activeFund,
  gifts,
  loading,
  refreshing,
  onRefresh,
}: {
  activeFund: ApiFund | null;
  gifts: GiftWithFund[];
  loading: boolean;
  refreshing: boolean;
  onRefresh: () => void;
}) {
  const childName = getChildName(activeFund);
  const fundGifts = activeFund ? gifts.filter((g) => g.fundId === activeFund.id) : gifts;
  const contributorCount = useMemo(() => new Set(fundGifts.map((g) => g.senderName || "Anonymous")).size, [fundGifts]);

  return (
    <ScrollView
      style={[styles.scroll, styles.memoryScroll]}
      contentContainerStyle={styles.scrollContent}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.evergreen} />}
      showsVerticalScrollIndicator={false}
    >
      <View style={styles.memoryCover}>
        <Text style={styles.memoryEyebrow}>Memory Book</Text>
        <Text style={styles.memoryTitle}>{childName}'s story lives here.</Text>
        <Text style={styles.memoryBody}>
          Every gift. Every note. Every person who believed in {childName}'s future.
        </Text>
        {activeFund ? (
          <View style={styles.memoryStats}>
            <StatPill value={`${contributorCount}`} label="people" />
            <StatPill value={`${fundGifts.length}`} label="gifts" />
            <StatPill value={formatBalance(parseFloat(String(activeFund.balance || "0")))} label="fund" />
          </View>
        ) : null}
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator color={colors.evergreen} />
          <Text style={styles.loadingText}>Opening the Memory Book...</Text>
        </View>
      ) : fundGifts.length === 0 ? (
        <View style={styles.memoryEmpty}>
          <Text style={styles.memoryEmptyTitle}>It starts with you.</Text>
          <Text style={styles.memoryEmptyBody}>
            Write the first note, then every gift and every message will build the story automatically.
          </Text>
          <Pressable style={styles.memoryNoteBtn}>
            <Text style={styles.memoryNoteText}>Write the first note</Text>
          </Pressable>
        </View>
      ) : (
        <View style={styles.memoryList}>
          <Text style={styles.chapterTitle}>The Beginning</Text>
          {fundGifts.slice(0, 12).map((gift) => (
            <View key={gift.id} style={styles.memoryGiftCard}>
              <Text style={styles.memoryGiftFrom}>From {gift.senderName || "Anonymous"}</Text>
              <Text style={styles.memoryGiftDate}>{formatShortDate(gift.createdAt) || "A gift for the future"}</Text>
              {gift.message
                ? <Text style={styles.memoryQuote}>"{gift.message}"</Text>
                : <Text style={styles.memoryQuote}>No note. Still part of the story.</Text>}
              <Text style={styles.memoryGiftAmount}>{formatBalance(gift.amount)}</Text>
              <View style={styles.memoryProvenance}>
                <Text style={styles.memoryProvenanceText}>Invested in {gift.recipientName}'s future with Kiddo.</Text>
              </View>
            </View>
          ))}
        </View>
      )}
    </ScrollView>
  );
}

// ─── Gift Tab ────────────────────────────────────────────────────────────────

function GiftTab({
  activeFund,
  gifts,
  onAddFund,
  onCreateEvent,
}: {
  activeFund: ApiFund | null;
  gifts: GiftWithFund[];
  onAddFund: () => void;
  onCreateEvent: () => void;
}) {
  const childName = getChildName(activeFund);
  const giftUrl = activeFund ? `${WEB_BASE}/${activeFund.slug}` : "";
  const recentGifts = activeFund ? gifts.filter((g) => g.fundId === activeFund.id).slice(0, 3) : [];

  const handleShare = async () => {
    if (!activeFund) return;
    try { await shareFund(activeFund); } catch {}
  };

  return (
    <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
      {!activeFund ? (
        <View style={styles.emptyHero}>
          <Text style={styles.emptyTitle}>Create the fund first.</Text>
          <Text style={styles.emptyBody}>Then Kiddo gives you one link people can use to give in under a minute.</Text>
          <Pressable onPress={onAddFund} style={styles.primaryBtn}>
            <Text style={styles.primaryBtnText}>Start a fund</Text>
          </Pressable>
        </View>
      ) : (
        <>
          <View style={styles.giftHero}>
            <Text style={styles.giftEyebrow}>Gift link</Text>
            <Text style={styles.giftTitle}>Share {childName}'s gift link.</Text>
            <Text style={styles.giftBody}>No account needed. Takes 60 seconds. Every gift can become part of the Memory Book.</Text>
            <View style={styles.giftUrlBox}>
              <Text style={styles.giftUrlText} numberOfLines={1}>{giftUrl}</Text>
            </View>
            <Pressable onPress={handleShare} style={styles.giftPrimaryBtn}>
              <Ionicons name="share-social" size={16} color="#3D2B09" style={{ marginRight: 6 }} />
              <Text style={styles.giftPrimaryBtnText}>Share gift link</Text>
            </Pressable>
            <Pressable onPress={onCreateEvent} style={styles.giftSecondaryBtn}>
              <Text style={styles.giftSecondaryBtnText}>Create birthday page</Text>
            </Pressable>
          </View>

          <View style={styles.giftTrustStrip}>
            <Ionicons name="shield-checkmark-outline" size={14} color="#5E675F" style={{ marginRight: 6 }} />
            <Text style={styles.giftTrustText}>Once invested, money is held through our broker-dealer partner. SIPC protects against brokerage failure, not market losses.</Text>
          </View>

          <Section title="Recent gifts">
            {recentGifts.length === 0 ? (
              <SoftCard
                title="The first gift is the hardest."
                body={`Share ${childName}'s gift link to start receiving investments. After that, it is just birthdays.`}
              />
            ) : (
              recentGifts.map((gift) => (
                <ListRow
                  key={gift.id}
                  icon="gift-outline"
                  title={`${formatBalance(gift.amount)} from ${gift.senderName || "someone who loves them"}`}
                  body={gift.message ? `"${gift.message}"` : `Invested in ${childName}'s future with Kiddo.`}
                  right={formatShortDate(gift.createdAt) || ""}
                />
              ))
            )}
          </Section>

          <View style={styles.giftLoopNudge}>
            <Text style={styles.giftLoopText}>
              The more you share, the more it grows.
            </Text>
          </View>
        </>
      )}
    </ScrollView>
  );
}

// ─── Growth Tab ──────────────────────────────────────────────────────────────

function GrowthTab({
  activeFund,
  gifts,
  onSelectFund,
  onAddFund,
}: {
  activeFund: ApiFund | null;
  gifts: GiftWithFund[];
  onSelectFund: (fund: ApiFund) => void;
  onAddFund: () => void;
}) {
  const childName = getChildName(activeFund);
  const balance = activeFund ? parseFloat(String(activeFund.balance || "0")) : 0;
  const fundGifts = activeFund ? gifts.filter((g) => g.fundId === activeFund.id) : [];
  const giftTotal = fundGifts.reduce((sum, g) => sum + parseFloat(String(g.amount || "0")), 0);
  const momentum = Math.min(100, Math.max(16, fundGifts.length * 18 + (balance > 0 ? 24 : 0)));

  return (
    <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
      {!activeFund ? (
        <View style={styles.emptyHero}>
          <Text style={styles.emptyTitle}>Growth starts with a gift.</Text>
          <Text style={styles.emptyBody}>Create a fund, share the link, and this screen becomes the living record of what is growing.</Text>
          <Pressable onPress={onAddFund} style={styles.primaryBtn}>
            <Text style={styles.primaryBtnText}>Start a fund</Text>
          </Pressable>
        </View>
      ) : (
        <>
          <View style={styles.growthHero}>
            <Text style={styles.growthLabel}>What the fund is worth</Text>
            <Text style={styles.growthAmount}>{formatBalance(balance)}</Text>
            <Text style={styles.growthBody}>
              {childName}'s gifts are held in one place and invested according to your family settings.
            </Text>
            <View style={styles.growthTrack}>
              <View style={[styles.growthFill, { width: `${momentum}%` }]} />
            </View>
            <Text style={styles.growthMeta}>
              {fundGifts.length} gift{fundGifts.length === 1 ? "" : "s"} received so far
            </Text>
          </View>

          <Section title="What happened recently">
            {fundGifts.length === 0 ? (
              <SoftCard title="Nothing yet." body={`Share ${childName}'s link and the first gift will appear here.`} />
            ) : (
              <>
                <ListRow
                  icon="trending-up-outline"
                  title={`${formatBalance(giftTotal)} received`}
                  body={`${fundGifts.length} gift${fundGifts.length === 1 ? "" : "s"} now part of ${childName}'s fund.`}
                />
                {fundGifts.slice(0, 2).map((gift) => (
                  <ListRow
                    key={gift.id}
                    icon="heart-outline"
                    title={`${gift.senderName || "Someone"} added ${formatBalance(gift.amount)}`}
                    body={gift.message ? `"${gift.message}"` : "Every gift has a story."}
                    right={formatShortDate(gift.createdAt) || ""}
                  />
                ))}
              </>
            )}
          </Section>

          <Section title="Where gifts go">
            <SoftCard
              title={`${childName}'s mix`}
              body="Gifts follow your family investing settings. Keep this plain, calm, and easy to explain before changing anything."
            />
            <View style={styles.growthTrustBox}>
              <Text style={styles.growthTrustText}>
                Once invested, held through our broker-dealer partner. SIPC protects against brokerage failure, not market losses.
              </Text>
            </View>
            <Pressable onPress={() => onSelectFund(activeFund)} style={styles.primaryBtn}>
              <Text style={styles.primaryBtnText}>View fund details</Text>
            </Pressable>
          </Section>
        </>
      )}
    </ScrollView>
  );
}

// ─── Account Tab ─────────────────────────────────────────────────────────────

function AccountTab({
  user,
  activeFund,
  onLogout,
}: {
  user: ApiUser;
  activeFund: ApiFund | null;
  onLogout: () => void;
}) {
  const [loggingOut, setLoggingOut] = useState(false);
  const [pushEnabled, setPushEnabled] = useState(false);
  const [pushDeviceCount, setPushDeviceCount] = useState(0);
  const [pushBusy, setPushBusy] = useState(false);
  const [pushMessage, setPushMessage] = useState<string | null>(null);

  // Face ID toggle. Per FACE_ID_SPEC.md. Three states surfaced:
  //   1. capability.supported = false → toggle disabled, reason shown
  //   2. capability.supported = true,  enabled = false → "Off"
  //   3. capability.supported = true,  enabled = true  → "On"
  const [bioCapability, setBioCapability] = useState<BiometricCapability>({ supported: false, enrolled: false });
  const [bioEnabled, setBioEnabled] = useState(false);
  const [bioBusy, setBioBusy] = useState(false);
  const [bioMessage, setBioMessage] = useState<string | null>(null);

  // Trusted devices panel state. Loaded when bio is enabled so the
  // user can see + revoke biometric on other devices. Per
  // FACE_ID_SPEC.md trusted-devices item.
  const [trustedDevices, setTrustedDevices] = useState<TrustedDeviceRow[]>([]);
  const [currentDeviceId, setCurrentDeviceId] = useState<string | null>(null);

  const loadBiometricState = useCallback(async () => {
    const [cap, on] = await Promise.all([getBiometricCapability(), isBiometricEnabled()]);
    setBioCapability(cap);
    setBioEnabled(on);
  }, []);

  const loadTrustedDevices = useCallback(async () => {
    try {
      const result = await apiListTrustedDevices();
      setTrustedDevices(result.devices.filter((d) => !d.revokedAt));
      setCurrentDeviceId(result.currentDeviceId);
    } catch {
      setTrustedDevices([]);
    }
  }, []);

  useEffect(() => { loadBiometricState(); }, [loadBiometricState]);
  useEffect(() => {
    if (bioEnabled) loadTrustedDevices();
  }, [bioEnabled, loadTrustedDevices]);

  const handleRevokeDevice = async (device: TrustedDeviceRow) => {
    try {
      await apiRevokeTrustedDevice(device.id);
      await loadTrustedDevices();
      // If user revoked their own current device, disable biometric
      // locally too. That's the consistent state — server says no
      // trust, client honors it.
      if (device.deviceId === currentDeviceId) {
        await setBiometricEnabled(false);
        setBioEnabled(false);
        setBioMessage("Face ID turned off on this device.");
      }
    } catch {
      // Non-fatal; toast would be nice but RN doesn't have native toast
    }
  };

  const handleToggleBiometric = async () => {
    if (bioBusy) return;
    setBioMessage(null);
    if (!bioCapability.supported && !bioEnabled) {
      // Trying to turn ON without device support — surface the reason.
      setBioMessage(bioCapability.reason || "Face ID isn't available on this device.");
      return;
    }
    setBioBusy(true);
    try {
      if (!bioEnabled) {
        // Turning ON requires a live biometric check — proves it works
        // AND lets the user feel the prompt before they live with it.
        const result = await authenticateBiometric("Enable Face ID for Kiddo");
        if (!result.success) {
          if (result.reason !== "cancelled") {
            setBioMessage(result.message || "Couldn't verify. Face ID stays off.");
          }
          return;
        }
        await setBiometricEnabled(true);
        setBioEnabled(true);
        setBioMessage("Face ID will be required next time you open Kiddo.");
        // Register this device for the trusted-devices panel. Best-
        // effort — if the server call fails the local Face ID still
        // works, it just won't appear in the user's device list.
        // Per FACE_ID_SPEC.md trusted-devices item.
        try {
          const deviceId = await getOrCreateDeviceId();
          const deviceName = Device.modelName || Device.deviceName || "Mobile device";
          await apiRegisterTrustedDevice({
            deviceId,
            deviceName,
            platform: Platform.OS === "ios" ? "ios" : Platform.OS === "android" ? "android" : "web",
          });
        } catch {
          // Non-fatal.
        }
      } else {
        // Turning OFF — no re-auth required; the user is already in.
        await setBiometricEnabled(false);
        setBioEnabled(false);
        setBioMessage("Face ID is off.");
      }
    } finally {
      setBioBusy(false);
    }
  };

  const loadPushPreferences = useCallback(async () => {
    try {
      const prefs = await apiGetMobilePushPreferences();
      setPushEnabled(Boolean(prefs.enabled));
      setPushDeviceCount(Number(prefs.deviceCount || 0));
    } catch {
      setPushEnabled(false);
      setPushDeviceCount(0);
    }
  }, []);

  useEffect(() => { loadPushPreferences(); }, [loadPushPreferences]);

  const handleLogout = async () => {
    setLoggingOut(true);
    try { await apiLogout(); } finally { onLogout(); }
  };

  const handleTogglePush = async () => {
    setPushBusy(true);
    setPushMessage(null);
    try {
      if (!pushEnabled) {
        const registration = await registerForPushNotificationsAsync();
        if (!registration.ok) { setPushMessage(registration.reason); return; }
        await apiRegisterMobilePushToken({
          token: registration.token,
          platform: registration.platform,
          deviceName: registration.deviceName,
          appOwnership: registration.appOwnership,
        });
      }
      await apiUpdateMobilePushPreferences(!pushEnabled);
      await loadPushPreferences();
      setPushMessage(!pushEnabled ? "Push is on for gifts, milestones, and birthdays." : "Push notifications are off.");
    } catch (err: any) {
      setPushMessage(err?.message || "Could not update push settings.");
    } finally {
      setPushBusy(false);
    }
  };

  const handleTestPush = async () => {
    setPushBusy(true);
    setPushMessage(null);
    try {
      await apiQueueTestMobilePush();
      setPushMessage("Test push queued. It should arrive shortly.");
    } catch (err: any) {
      setPushMessage(err?.message || "Could not send a test push.");
    } finally {
      setPushBusy(false);
    }
  };

  const displayName = [user.firstName, user.lastName].filter(Boolean).join(" ") || user.email;
  const childName = getChildName(activeFund);

  return (
    <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
      <Section title="How gifts get invested">
        <SettingsRow title={`${childName}'s mix`} value="Family default" />
        <SettingsRow title="Gifter choice" value="Allowed when useful" />
        <SettingsRow title="Hold as cash" value="Available before investing" />
      </Section>

      <Section title="Family">
        <SettingsRow title="Co-parent" value="Invite" />
        <SettingsRow title="Kid View" value="PIN protected" />
      </Section>

      <Section title={`When ${childName} turns 18`}>
        <View style={styles.planCard}>
          <Text style={styles.planTitle}>They get full control.</Text>
          <Text style={styles.planBody}>
            The money stays invested. Nothing gets sold automatically. They decide what to do with it. That is the whole point.
          </Text>
        </View>
      </Section>

      <Section title="Membership">
        <View style={styles.planCard}>
          <Text style={styles.planTitle}>Free</Text>
          <Text style={styles.planBody}>
            One active event. Platform fee: $2 on gifts up to $200, then 1% of the full gift amount over $200.
          </Text>
          <Pressable style={styles.primarySmallBtn}>
            <Text style={styles.primarySmallBtnText}>See Kiddo+</Text>
          </Pressable>
        </View>
      </Section>

      <Section title="Security">
        <View style={styles.pushCard}>
          <View style={styles.rowBetween}>
            <View style={styles.flexOne}>
              <Text style={styles.pushTitle}>Use Face ID to unlock Kiddo</Text>
              <Text style={styles.pushBody}>
                Required when you open the app and after 5 minutes in the background.
              </Text>
              {!bioCapability.supported ? (
                <Text style={styles.pushMeta}>{bioCapability.reason}</Text>
              ) : null}
            </View>
            <Pressable
              disabled={bioBusy || (!bioCapability.supported && !bioEnabled)}
              onPress={handleToggleBiometric}
              style={[styles.toggleBtn, bioEnabled && styles.toggleBtnOn]}
            >
              <Text style={[styles.toggleText, bioEnabled && styles.toggleTextOn]}>
                {bioBusy ? "..." : bioEnabled ? "On" : "Off"}
              </Text>
            </Pressable>
          </View>
          {bioMessage ? <Text style={styles.pushMessage}>{bioMessage}</Text> : null}
        </View>

        {/* Trusted devices list. Visible only when biometric is enabled
            on this device. Lets the user see + revoke biometric on
            other devices where they've enabled Face ID. Per
            FACE_ID_SPEC.md (trusted devices panel item). */}
        {bioEnabled && trustedDevices.length > 0 && (
          <View style={[styles.pushCard, { marginTop: spacing.sm }]}>
            <Text style={styles.pushTitle}>Devices using Face ID</Text>
            <Text style={[styles.pushBody, { marginBottom: spacing.sm }]}>
              Tap a device to turn Face ID off for it. Your password still works.
            </Text>
            {trustedDevices.map((d) => {
              const isCurrent = d.deviceId === currentDeviceId;
              const lastUnlockedLabel = d.lastUnlockedAt
                ? new Date(d.lastUnlockedAt).toLocaleDateString("en-US", { month: "short", day: "numeric" })
                : "Never";
              return (
                <Pressable
                  key={d.id}
                  onPress={() => handleRevokeDevice(d)}
                  style={({ pressed }) => [
                    styles.deviceRow,
                    pressed && styles.deviceRowPressed,
                  ]}
                >
                  <View style={styles.flexOne}>
                    <Text style={styles.deviceRowTitle}>
                      {d.deviceName || "Unknown device"}
                      {isCurrent ? "  ·  This device" : ""}
                    </Text>
                    <Text style={styles.deviceRowMeta}>
                      Last unlocked {lastUnlockedLabel}
                    </Text>
                  </View>
                  <Text style={styles.deviceRowRevoke}>Turn off</Text>
                </Pressable>
              );
            })}
          </View>
        )}
      </Section>

      <Section title="Notifications">
        <View style={styles.pushCard}>
          <View style={styles.rowBetween}>
            <View style={styles.flexOne}>
              <Text style={styles.pushTitle}>Mobile push</Text>
              <Text style={styles.pushBody}>Gift received, milestones, birthdays, and account updates.</Text>
              <Text style={styles.pushMeta}>{pushDeviceCount} device{pushDeviceCount === 1 ? "" : "s"} registered</Text>
            </View>
            <Pressable disabled={pushBusy} onPress={handleTogglePush} style={[styles.toggleBtn, pushEnabled && styles.toggleBtnOn]}>
              <Text style={[styles.toggleText, pushEnabled && styles.toggleTextOn]}>{pushBusy ? "..." : pushEnabled ? "On" : "Off"}</Text>
            </Pressable>
          </View>
          {pushMessage ? <Text style={styles.pushMessage}>{pushMessage}</Text> : null}
          <Pressable disabled={pushBusy || pushDeviceCount === 0} onPress={handleTestPush} style={styles.textAction}>
            <Text style={styles.textActionText}>Send test</Text>
          </Pressable>
        </View>
      </Section>

      <Section title="Account">
        <SettingsRow title="Name" value={displayName} />
        <SettingsRow title="Email" value={user.email} />
        <SettingsRow title="Privacy" value="Private" />
        <SettingsRow title="Tax documents" value="View" />
        <SettingsRow title="Legal" value="Disclosures" />
      </Section>

      <Pressable onPress={handleLogout} disabled={loggingOut} style={styles.signOutBtn}>
        <Text style={styles.signOutText}>{loggingOut ? "Signing out..." : "Sign out"}</Text>
      </Pressable>
    </ScrollView>
  );
}

// ─── Event Composer ──────────────────────────────────────────────────────────

function EventComposer({
  activeFund,
  onCancel,
  onCreated,
  onAddFund,
}: {
  activeFund: ApiFund | null;
  onCancel: () => void;
  onCreated: () => void | Promise<void>;
  onAddFund: () => void;
}) {
  const [eventType, setEventType] = useState("birthday");
  const [name, setName] = useState(activeFund ? `${getChildName(activeFund)}'s Birthday` : "");
  const [date, setDate] = useState("");
  const [goal, setGoal] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const eventTypes = [
    { id: "birthday", label: "Birthday" },
    { id: "baby_shower", label: "Baby shower" },
    { id: "graduation", label: "Graduation" },
    { id: "holiday", label: "Holiday" },
    { id: "just_because", label: "Just because" },
  ];

  const handleCreate = async () => {
    setError(null);
    if (!activeFund) { setError("Create a fund first, then add an event."); return; }
    if (!name.trim()) { setError("Give the event a name."); return; }
    if (date.trim() && !/^\d{4}-\d{2}-\d{2}$/.test(date.trim())) { setError("Use YYYY-MM-DD for the date."); return; }
    const normalizedGoal = goal.trim().replace(/[^0-9.]/g, "");
    const goalValue = normalizedGoal ? Number(normalizedGoal) : 0;
    if (goal.trim() && (!Number.isFinite(goalValue) || goalValue < 10 || goalValue > 100000)) {
      setError("Use a realistic goal between $10 and $100,000.");
      return;
    }
    setBusy(true);
    try {
      const slug = `${slugify(name.trim())}-${Date.now().toString(36)}`;
      await apiCreateEvent({
        fundId: activeFund.id,
        name: name.trim(),
        slug,
        eventType,
        eventDate: date.trim() ? `${date.trim()}T12:00:00.000Z` : undefined,
        goalAmount: normalizedGoal ? String(goalValue) : undefined,
        description: `${getChildName(activeFund)} is growing a fund for the future. Anyone can give in under a minute.`,
        status: "active",
        isPermanent: false,
      });
      await onCreated();
    } catch (err: any) {
      setError(err?.message || "Could not create the event.");
    } finally {
      setBusy(false);
    }
  };

  if (!activeFund) {
    return (
      <View style={styles.composerWrap}>
        <View style={styles.emptyHero}>
          <Text style={styles.emptyTitle}>Start with the fund.</Text>
          <Text style={styles.emptyBody}>Events sit on top of a child's fund. Create the fund first, then the birthday or baby shower page is easy.</Text>
          <Pressable onPress={onAddFund} style={styles.primaryBtn}>
            <Text style={styles.primaryBtnText}>Start a fund</Text>
          </Pressable>
        </View>
      </View>
    );
  }

  return (
    <ScrollView style={styles.scroll} contentContainerStyle={styles.composerWrap} keyboardShouldPersistTaps="handled">
      <Text style={styles.composerLead}>What are we celebrating?</Text>
      <View style={styles.typeGrid}>
        {eventTypes.map((type) => {
          const active = eventType === type.id;
          return (
            <Pressable key={type.id} onPress={() => setEventType(type.id)} style={[styles.typeChip, active && styles.typeChipActive]}>
              <Text style={[styles.typeChipText, active && styles.typeChipTextActive]}>{type.label}</Text>
            </Pressable>
          );
        })}
      </View>

      <View style={styles.formCard}>
        <Text style={styles.inputLabel}>Event name</Text>
        <TextInput value={name} onChangeText={setName} placeholder="Emma's Birthday" placeholderTextColor="#8B948C" style={styles.input} />
        <Text style={styles.inputLabel}>Date</Text>
        <TextInput value={date} onChangeText={setDate} placeholder="YYYY-MM-DD" placeholderTextColor="#8B948C" keyboardType="numbers-and-punctuation" style={styles.input} />
        <Text style={styles.inputLabel}>Goal</Text>
        <TextInput value={goal} onChangeText={setGoal} placeholder="Optional" placeholderTextColor="#8B948C" keyboardType="decimal-pad" style={styles.input} />
        {error ? <Text style={styles.errorText}>{error}</Text> : null}
      </View>

      <Pressable onPress={handleCreate} disabled={busy} style={[styles.primaryBtn, busy && styles.disabled]}>
        {busy ? <ActivityIndicator color="#FFFFFF" /> : <Text style={styles.primaryBtnText}>Launch event</Text>}
      </Pressable>
      <Pressable onPress={onCancel} style={styles.secondaryFullBtn}>
        <Text style={styles.secondaryFullBtnText}>Cancel</Text>
      </Pressable>
    </ScrollView>
  );
}

// ─── Dashboard Screen ─────────────────────────────────────────────────────────

export function DashboardScreen({ user, onLogout, onSelectFund, onAddFund }: DashboardScreenProps) {
  const insets = useSafeAreaInsets();
  const [tab, setTab] = useState<Tab>("home");
  const [funds, setFunds] = useState<ApiFund[]>([]);
  const [selectedFundId, setSelectedFundId] = useState<string>("");
  const [fundSwitcherOpen, setFundSwitcherOpen] = useState(false);
  const [events, setEvents] = useState<ApiEvent[]>([]);
  const [gifts, setGifts] = useState<GiftWithFund[]>([]);
  const [creatingEvent, setCreatingEvent] = useState(false);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const activeFund = useMemo(
    () => (selectedFundId ? funds.find((f) => f.id === selectedFundId) : null) ?? funds[0] ?? null,
    [selectedFundId, funds],
  );

  const loadDashboard = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    setError(null);
    try {
      const nextFunds = await apiGetFunds();
      setFunds(nextFunds);

      const [nextEvents, giftGroups] = await Promise.all([
        apiGetAllEvents().catch(() => [] as ApiEvent[]),
        Promise.all(
          nextFunds.map(async (fund) => {
            const fundGifts = await apiGetFundGifts(fund.id).catch(() => [] as ApiGift[]);
            return fundGifts.map((gift) => ({
              ...gift,
              fundId: fund.id,
              fundName: fund.name,
              recipientName: getChildName(fund),
            }));
          }),
        ),
      ]);

      setEvents(nextEvents);
      setGifts(giftGroups.flat().sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()));
    } catch (err: any) {
      setError(err?.message || "Could not load Kiddo.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { loadDashboard(); }, [loadDashboard]);

  const handleRefresh = () => { setRefreshing(true); loadDashboard(true); };

  const childName = getChildName(activeFund);

  const headerTitle: Record<Tab, string> = {
    home: "Home",
    memory: "Memory Book",
    gift: "Gift Link",
    growth: "Growth",
    settings: "Settings",
  };

  if (creatingEvent) {
    return (
      <View style={styles.screen}>
        <View style={[styles.header, { paddingTop: insets.top + 14 }]}>
          <Pressable onPress={() => setCreatingEvent(false)} style={styles.backTap}>
            <Ionicons name="arrow-back" size={18} color={colors.evergreen} />
            <Text style={styles.backTapText}>Back</Text>
          </Pressable>
          <Text style={styles.headerTitle}>New event</Text>
        </View>
        <EventComposer
          activeFund={activeFund}
          onCancel={() => setCreatingEvent(false)}
          onCreated={async () => { setCreatingEvent(false); await loadDashboard(true); }}
          onAddFund={onAddFund}
        />
      </View>
    );
  }

  return (
    <View style={styles.screen}>
      {/* Header */}
      <View style={[styles.header, { paddingTop: insets.top + 10 }]}>
        <View style={styles.headerRow}>
          <View style={styles.headerLeft}>
            <Text style={styles.headerKiddo}>Kiddo</Text>
            {activeFund ? (
              <Pressable
                onPress={() => funds.length > 1 && setFundSwitcherOpen(true)}
                style={styles.fundSwitcherBtn}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <Text style={styles.fundSwitcherName}>{childName}</Text>
                {funds.length > 1 && (
                  <Ionicons name="chevron-down" size={14} color={colors.evergreen} style={{ marginTop: 1 }} />
                )}
              </Pressable>
            ) : null}
          </View>
          <Text style={styles.headerTabLabel}>{headerTitle[tab]}</Text>
        </View>
      </View>

      {/* Tabs */}
      {tab === "home" && (
        <HomeTab
          activeFund={activeFund}
          events={events}
          gifts={gifts}
          loading={loading}
          refreshing={refreshing}
          error={error}
          onRefresh={handleRefresh}
          onSelectFund={onSelectFund}
          onAddFund={onAddFund}
          onCreateEvent={() => setCreatingEvent(true)}
        />
      )}
      {tab === "memory" && (
        <MemoryTab
          activeFund={activeFund}
          gifts={gifts}
          loading={loading}
          refreshing={refreshing}
          onRefresh={handleRefresh}
        />
      )}
      {tab === "gift" && (
        <GiftTab
          activeFund={activeFund}
          gifts={gifts}
          onAddFund={onAddFund}
          onCreateEvent={() => setCreatingEvent(true)}
        />
      )}
      {tab === "growth" && (
        <GrowthTab
          activeFund={activeFund}
          gifts={gifts}
          onSelectFund={onSelectFund}
          onAddFund={onAddFund}
        />
      )}
      {tab === "settings" && (
        <AccountTab user={user} activeFund={activeFund} onLogout={onLogout} />
      )}

      <TabBar active={tab} onPress={setTab} />

      <FundSwitcherModal
        visible={fundSwitcherOpen}
        funds={funds}
        activeFundId={activeFund?.id ?? ""}
        onSelect={(fund) => setSelectedFundId(fund.id)}
        onClose={() => setFundSwitcherOpen(false)}
        onAddFund={onAddFund}
      />
    </View>
  );
}

// ─── Shared UI Components ────────────────────────────────────────────────────

function Section({ title, cta, children }: { title: string; cta?: string; children: React.ReactNode }) {
  return (
    <View style={styles.section}>
      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>{title}</Text>
        {cta ? <Text style={styles.sectionCta}>{cta}</Text> : null}
      </View>
      {children}
    </View>
  );
}

function SoftCard({ title, body }: { title: string; body: string }) {
  return (
    <View style={styles.softCard}>
      <Text style={styles.softTitle}>{title}</Text>
      <Text style={styles.softBody}>{body}</Text>
    </View>
  );
}

function ListRow({ icon, title, body, right }: { icon: string; title: string; body: string; right?: string }) {
  return (
    <View style={styles.listRow}>
      <View style={styles.rowMark}>
        <Ionicons name={icon as any} size={16} color={colors.evergreen} />
      </View>
      <View style={styles.flexOne}>
        <Text style={styles.rowTitle}>{title}</Text>
        <Text style={styles.rowBody} numberOfLines={2}>{body}</Text>
      </View>
      {right ? <Text style={styles.rowRight}>{right}</Text> : null}
    </View>
  );
}

function EventPreview({ event }: { event: ApiEvent }) {
  const raised = parseFloat(String(event.totalRaised || "0"));
  const date = formatShortDate(event.eventDate) || "Always open";
  return (
    <View style={styles.eventPreview}>
      <View style={styles.rowBetween}>
        <Text style={styles.eventName} numberOfLines={1}>{event.name}</Text>
        <View style={styles.liveBadge}>
          <Text style={styles.liveBadgeText}>Live</Text>
        </View>
      </View>
      <Text style={styles.eventMeta}>{formatBalance(raised)} raised from {event.giftCount} gift{event.giftCount === 1 ? "" : "s"}</Text>
      <Text style={styles.eventDate}>{date}</Text>
    </View>
  );
}

function StatPill({ value, label }: { value: string; label: string }) {
  return (
    <View style={styles.statPill}>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

function SettingsRow({ title, value }: { title: string; value: string }) {
  return (
    <View style={styles.settingsRow}>
      <Text style={styles.settingsTitle}>{title}</Text>
      <Text style={styles.settingsValue} numberOfLines={1}>{value}</Text>
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const switcher = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.35)" },
  sheet: {
    backgroundColor: "#FFFFFF",
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    gap: 4,
    shadowColor: colors.ink,
    shadowOpacity: 0.14,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: -8 },
    elevation: 10,
  },
  handle: { width: 36, height: 4, borderRadius: 2, backgroundColor: "#DDD8D0", alignSelf: "center", marginBottom: spacing.sm },
  heading: { color: colors.ink, fontSize: 17, fontWeight: "800", marginBottom: spacing.sm },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: "#F0EDE8",
  },
  rowActive: { backgroundColor: "#F8F4EE", marginHorizontal: -spacing.lg, paddingHorizontal: spacing.lg, borderRadius: 0 },
  dot: { width: 10, height: 10, borderRadius: 5, borderWidth: 2, borderColor: "#DDD8D0", backgroundColor: "transparent" },
  dotActive: { borderColor: colors.evergreen, backgroundColor: colors.evergreen },
  rowInfo: { flex: 1, gap: 2 },
  rowName: { color: colors.ink, fontSize: 16, fontWeight: "700" },
  rowNameActive: { color: colors.evergreen, fontWeight: "800" },
  rowBal: { color: "#6B7280", fontSize: 13, fontWeight: "600" },
  addRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    paddingVertical: 16,
  },
  addText: { color: colors.evergreen, fontSize: 15, fontWeight: "700" },
});

const tabStyles = StyleSheet.create({
  bar: {
    flexDirection: "row",
    backgroundColor: "#FFFFFF",
    borderTopWidth: 1,
    borderTopColor: "#EEE8DD",
    paddingTop: 8,
  },
  tabBtn: { flex: 1, alignItems: "center", gap: 3, paddingTop: 2 },
  tabBtnCenter: { marginTop: -10 },
  iconWrap: {
    width: 32,
    height: 32,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  iconWrapActive: {
    backgroundColor: colors.evergreen + "14",
  },
  iconWrapGift: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: colors.gold,
    shadowColor: "#3D2B09",
    shadowOpacity: 0.2,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 5 },
    elevation: 4,
  },
  tabLabel: { fontSize: 10, fontWeight: "600", color: "#8B948C" },
  tabLabelActive: { color: colors.evergreen, fontWeight: "800" },
  tabLabelGift: { color: "#3D2B09", fontWeight: "800" },
});

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: "#FAF8F4" },
  scroll: { flex: 1 },
  memoryScroll: { backgroundColor: "#F5F0E8" },
  scrollContent: { padding: spacing.md, gap: spacing.md, paddingBottom: 28 },

  // Header
  header: {
    backgroundColor: "#FAF8F4",
    paddingHorizontal: spacing.lg,
    paddingBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: "#EEE8DD",
  },
  headerRow: { flexDirection: "row", alignItems: "flex-end", justifyContent: "space-between" },
  headerLeft: { gap: 1 },
  headerKiddo: { color: colors.evergreen, fontSize: 12, fontWeight: "900", letterSpacing: 1.2, textTransform: "uppercase" },
  fundSwitcherBtn: { flexDirection: "row", alignItems: "center", gap: 4 },
  fundSwitcherName: { color: colors.ink, fontSize: 22, fontWeight: "900", lineHeight: 26 },
  headerTabLabel: { color: "#8B948C", fontSize: 13, fontWeight: "700" },

  // Back nav
  backTap: { flexDirection: "row", alignItems: "center", gap: 4, alignSelf: "flex-start", paddingVertical: 4 },
  backTapText: { color: colors.evergreen, fontSize: 14, fontWeight: "900" },
  headerTitle: { color: colors.ink, fontSize: 20, fontWeight: "900", marginTop: 6 },

  // Loading / error
  center: { alignItems: "center", justifyContent: "center", paddingVertical: 48, gap: 10 },
  loadingText: { color: "#6B7280", fontSize: 14 },
  errorBox: { backgroundColor: "#FEF2F2", borderRadius: 22, padding: spacing.lg, gap: spacing.sm },
  errorTitle: { color: "#991B1B", fontSize: 18, fontWeight: "900" },
  errorText: { color: "#B91C1C", fontSize: 14, lineHeight: 20 },

  // Hero card
  heroCard: {
    backgroundColor: colors.evergreen,
    borderRadius: 28,
    padding: spacing.xl,
    gap: 6,
    shadowColor: colors.ink,
    shadowOpacity: 0.12,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: 14 },
    elevation: 5,
  },
  heroLabel: { color: "rgba(255,255,255,0.7)", fontSize: 13, fontWeight: "700" },
  heroAmount: { color: "#FFFFFF", fontSize: 44, lineHeight: 50, fontWeight: "900" },
  heroGain: { color: "#F8D889", fontSize: 15, fontWeight: "800" },
  heroSubline: { color: "rgba(255,255,255,0.72)", fontSize: 14, lineHeight: 20, fontWeight: "600", marginTop: 4 },

  // Action row
  actionRow: { flexDirection: "row", gap: spacing.sm },
  primaryAction: { flex: 1.35, flexDirection: "row", backgroundColor: colors.gold, borderRadius: 999, paddingVertical: 15, alignItems: "center", justifyContent: "center" },
  primaryActionText: { color: "#38290A", fontSize: 15, fontWeight: "900" },
  secondaryAction: { flex: 1, backgroundColor: "#FFFFFF", borderRadius: 999, paddingVertical: 15, alignItems: "center", borderWidth: 1, borderColor: "#EEE8DD" },
  secondaryActionText: { color: colors.ink, fontSize: 15, fontWeight: "800" },

  // Section
  section: { gap: spacing.sm },
  sectionHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  sectionTitle: { color: colors.ink, fontSize: 17, fontWeight: "900" },
  sectionCta: { color: "#8B948C", fontSize: 12, fontWeight: "700" },

  // Soft card
  softCard: { backgroundColor: "#FFFFFF", borderRadius: 18, padding: spacing.md, gap: 4, borderWidth: 1, borderColor: "#EEE8DD" },
  softTitle: { color: colors.ink, fontSize: 15, fontWeight: "800" },
  softBody: { color: "#6B7280", fontSize: 14, lineHeight: 20 },

  // List row
  listRow: { flexDirection: "row", alignItems: "flex-start", gap: spacing.sm, backgroundColor: "#FFFFFF", borderRadius: 18, padding: spacing.md, borderWidth: 1, borderColor: "#EEE8DD" },
  rowMark: { width: 34, height: 34, borderRadius: 10, backgroundColor: "#F6EFE3", alignItems: "center", justifyContent: "center" },
  flexOne: { flex: 1, minWidth: 0 },
  rowTitle: { color: colors.ink, fontSize: 15, fontWeight: "800" },
  rowBody: { color: "#6B7280", fontSize: 13, lineHeight: 18, marginTop: 2 },
  rowRight: { color: "#8B948C", fontSize: 12, fontWeight: "700" },

  // Event preview
  eventPreview: { backgroundColor: "#FFFFFF", borderRadius: 18, padding: spacing.md, gap: 4, borderWidth: 1, borderColor: colors.evergreen + "30" },
  rowBetween: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: spacing.sm },
  eventName: { flex: 1, color: colors.ink, fontSize: 15, fontWeight: "900" },
  liveBadge: { backgroundColor: colors.evergreen + "18", borderRadius: 999, paddingHorizontal: 10, paddingVertical: 4 },
  liveBadgeText: { color: colors.evergreen, fontSize: 11, fontWeight: "900" },
  eventMeta: { color: "#5E675F", fontSize: 13, fontWeight: "700" },
  eventDate: { color: "#8B948C", fontSize: 12, fontWeight: "600" },

  textAction: { flexDirection: "row", alignItems: "center", gap: 4, alignSelf: "flex-start", paddingVertical: 8, paddingHorizontal: 2 },
  textActionText: { color: colors.evergreen, fontSize: 14, fontWeight: "800" },

  // Countdown
  countdownCard: { backgroundColor: "#FFFFFF", borderRadius: 22, padding: spacing.lg, gap: 4, borderWidth: 1, borderColor: "#EEE8DD" },
  countdownLabel: { color: "#6B7280", fontSize: 13, fontWeight: "800" },
  countdownValue: { color: colors.ink, fontSize: 22, fontWeight: "900" },
  countdownBody: { color: "#6B7280", fontSize: 14, lineHeight: 20 },

  // Next step card
  nextStepCard: { backgroundColor: "#FFFFFF", borderRadius: 24, padding: spacing.lg, gap: spacing.sm, borderWidth: 1, borderColor: colors.gold + "55" },
  nextStepEyebrow: { color: colors.gold, fontSize: 12, fontWeight: "900", letterSpacing: 1.2, textTransform: "uppercase" },
  nextStepTitle: { color: colors.ink, fontSize: 24, lineHeight: 29, fontWeight: "900" },
  nextStepBody: { color: "#5E675F", fontSize: 15, lineHeight: 23 },

  // Empty hero
  emptyHero: { backgroundColor: "#FFFFFF", borderRadius: 28, padding: spacing.xl, gap: spacing.md, borderWidth: 1, borderColor: "#EEE8DD" },
  emptyTitle: { color: colors.ink, fontSize: 28, lineHeight: 32, fontWeight: "900" },
  emptyBody: { color: "#6B7280", fontSize: 16, lineHeight: 24 },

  // Buttons
  primaryBtn: { backgroundColor: colors.evergreen, borderRadius: 999, paddingVertical: 16, alignItems: "center" },
  primaryBtnText: { color: "#FFFFFF", fontSize: 16, fontWeight: "900" },
  primarySmallBtn: { alignSelf: "flex-start", backgroundColor: colors.evergreen, borderRadius: 999, paddingVertical: 10, paddingHorizontal: 16 },
  primarySmallBtnText: { color: "#FFFFFF", fontSize: 13, fontWeight: "900" },

  // Memory
  memoryCover: { backgroundColor: "#2F3B34", borderRadius: 28, padding: spacing.xl, gap: spacing.md },
  memoryEyebrow: { color: "#F8D889", fontSize: 12, fontWeight: "900", letterSpacing: 1.4, textTransform: "uppercase" },
  memoryTitle: { color: "#FFF7E8", fontSize: 30, lineHeight: 34, fontWeight: "900" },
  memoryBody: { color: "rgba(255,247,232,0.8)", fontSize: 16, lineHeight: 24 },
  memoryStats: { flexDirection: "row", gap: spacing.sm, flexWrap: "wrap" },
  statPill: { backgroundColor: "rgba(255,255,255,0.12)", borderRadius: 999, paddingHorizontal: 14, paddingVertical: 9 },
  statValue: { color: "#FFFFFF", fontSize: 14, fontWeight: "900" },
  statLabel: { color: "rgba(255,255,255,0.72)", fontSize: 11, fontWeight: "700" },
  memoryEmpty: { backgroundColor: "#FFFDF8", borderRadius: 24, padding: spacing.xl, gap: spacing.md, borderWidth: 1, borderColor: "#E7D9C5" },
  memoryEmptyTitle: { color: colors.ink, fontSize: 24, fontWeight: "900" },
  memoryEmptyBody: { color: "#6B7280", fontSize: 15, lineHeight: 23 },
  memoryNoteBtn: { alignSelf: "flex-start", backgroundColor: colors.gold, borderRadius: 999, paddingVertical: 12, paddingHorizontal: 18 },
  memoryNoteText: { color: "#3D2B09", fontWeight: "900" },
  memoryList: { gap: spacing.sm },
  chapterTitle: { color: colors.ink, fontSize: 18, fontWeight: "900", marginTop: spacing.xs },
  memoryGiftCard: { backgroundColor: "#FFFDF8", borderRadius: 22, padding: spacing.lg, gap: spacing.sm, borderWidth: 1, borderColor: "#E7D9C5" },
  memoryGiftFrom: { color: colors.ink, fontSize: 17, fontWeight: "900" },
  memoryGiftDate: { color: "#8B948C", fontSize: 12, fontWeight: "700" },
  memoryQuote: { color: "#3F3A33", fontSize: 16, lineHeight: 25, fontStyle: "italic" },
  memoryGiftAmount: { color: colors.ink, fontSize: 22, fontWeight: "900" },
  memoryProvenance: { borderTopWidth: 1, borderTopColor: "#E7D9C5", paddingTop: spacing.sm },
  memoryProvenanceText: { color: "#5E675F", fontSize: 13, lineHeight: 19, fontWeight: "800" },

  // Gift tab
  giftHero: {
    backgroundColor: "#2F3B34",
    borderRadius: 30,
    padding: spacing.xl,
    gap: spacing.md,
    shadowColor: colors.ink,
    shadowOpacity: 0.12,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: 14 },
    elevation: 5,
  },
  giftEyebrow: { color: "#F8D889", fontSize: 12, fontWeight: "900", textTransform: "uppercase" },
  giftTitle: { color: "#FFF7E8", fontSize: 28, lineHeight: 33, fontWeight: "900" },
  giftBody: { color: "rgba(255,247,232,0.8)", fontSize: 15, lineHeight: 23 },
  giftUrlBox: { backgroundColor: "rgba(255,255,255,0.1)", borderRadius: 14, paddingHorizontal: spacing.md, paddingVertical: 13 },
  giftUrlText: { color: "#FFF7E8", fontSize: 13, fontWeight: "800" },
  giftPrimaryBtn: { flexDirection: "row", backgroundColor: colors.gold, borderRadius: 999, paddingVertical: 16, alignItems: "center", justifyContent: "center" },
  giftPrimaryBtnText: { color: "#3D2B09", fontSize: 16, fontWeight: "900" },
  giftSecondaryBtn: { alignItems: "center", paddingVertical: 4 },
  giftSecondaryBtnText: { color: "#FFF7E8", fontSize: 14, fontWeight: "800" },
  giftTrustStrip: { flexDirection: "row", alignItems: "flex-start", backgroundColor: "#FFFFFF", borderRadius: 18, padding: spacing.md, borderWidth: 1, borderColor: "#EEE8DD" },
  giftTrustText: { flex: 1, color: "#5E675F", fontSize: 13, lineHeight: 19, fontWeight: "600" },
  giftLoopNudge: { backgroundColor: colors.evergreen + "0E", borderRadius: 18, padding: spacing.md, borderWidth: 1, borderColor: colors.evergreen + "22", alignItems: "center" },
  giftLoopText: { color: colors.evergreen, fontSize: 15, fontWeight: "800", textAlign: "center" },

  // Growth tab
  growthHero: { backgroundColor: "#FFFFFF", borderRadius: 28, padding: spacing.xl, gap: spacing.sm, borderWidth: 1, borderColor: "#EEE8DD" },
  growthLabel: { color: "#6B7280", fontSize: 12, fontWeight: "900", textTransform: "uppercase", letterSpacing: 0.8 },
  growthAmount: { color: colors.ink, fontSize: 42, lineHeight: 48, fontWeight: "900" },
  growthBody: { color: "#5E675F", fontSize: 15, lineHeight: 23 },
  growthTrack: { height: 8, borderRadius: 999, backgroundColor: "#EFE7DA", overflow: "hidden", marginTop: 4 },
  growthFill: { height: "100%", borderRadius: 999, backgroundColor: colors.evergreen },
  growthMeta: { color: "#8B948C", fontSize: 12, fontWeight: "800" },
  growthTrustBox: { backgroundColor: "#F8F4EC", borderRadius: 16, padding: spacing.md, borderWidth: 1, borderColor: "#E7D9C5" },
  growthTrustText: { color: "#5E675F", fontSize: 13, lineHeight: 19, fontWeight: "600" },

  // Settings / Account
  settingsRow: { backgroundColor: "#FFFFFF", borderRadius: 16, padding: spacing.md, flexDirection: "row", justifyContent: "space-between", gap: spacing.sm, borderWidth: 1, borderColor: "#EEE8DD" },
  settingsTitle: { color: colors.ink, fontSize: 15, fontWeight: "800" },
  settingsValue: { color: "#6B7280", fontSize: 14, fontWeight: "700", maxWidth: "52%" },
  planCard: { backgroundColor: "#FFFFFF", borderRadius: 20, padding: spacing.lg, gap: spacing.sm, borderWidth: 1, borderColor: "#EEE8DD" },
  planTitle: { color: colors.ink, fontSize: 20, fontWeight: "900" },
  planBody: { color: "#6B7280", fontSize: 14, lineHeight: 21 },
  pushCard: { backgroundColor: "#FFFFFF", borderRadius: 20, padding: spacing.lg, gap: spacing.sm, borderWidth: 1, borderColor: "#EEE8DD" },
  pushTitle: { color: colors.ink, fontSize: 15, fontWeight: "900" },
  pushBody: { color: "#6B7280", fontSize: 13, lineHeight: 19 },
  pushMeta: { color: "#8B948C", fontSize: 12, fontWeight: "700", marginTop: 4 },
  pushMessage: { color: colors.ink, fontSize: 12, lineHeight: 18 },
  deviceRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 10,
    borderTopWidth: 1,
    borderTopColor: "#EEE8DC",
  },
  deviceRowPressed: { opacity: 0.6 },
  deviceRowTitle: { color: colors.ink, fontSize: 14, fontWeight: "600" },
  deviceRowMeta: { color: "#8B948C", fontSize: 11, marginTop: 2 },
  deviceRowRevoke: { color: "#9A4A2C", fontSize: 12, fontWeight: "700" },
  toggleBtn: { borderRadius: 999, backgroundColor: "#F3F4F6", paddingVertical: 8, paddingHorizontal: 14 },
  toggleBtnOn: { backgroundColor: colors.evergreen },
  toggleText: { color: "#6B7280", fontSize: 12, fontWeight: "900" },
  toggleTextOn: { color: "#FFFFFF" },
  signOutBtn: { backgroundColor: "#FFFFFF", borderRadius: 18, padding: spacing.md, alignItems: "center", borderWidth: 1, borderColor: "#FECACA" },
  signOutText: { color: "#DC2626", fontSize: 15, fontWeight: "800" },

  // Event composer
  composerWrap: { padding: spacing.md, gap: spacing.md, paddingBottom: 32 },
  composerLead: { color: colors.ink, fontSize: 24, lineHeight: 30, fontWeight: "900" },
  typeGrid: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm },
  typeChip: { backgroundColor: "#FFFFFF", borderRadius: 999, paddingHorizontal: 15, paddingVertical: 12, borderWidth: 1, borderColor: "#EEE8DD" },
  typeChipActive: { backgroundColor: colors.evergreen, borderColor: colors.evergreen },
  typeChipText: { color: colors.ink, fontSize: 14, fontWeight: "800" },
  typeChipTextActive: { color: "#FFFFFF" },
  formCard: { backgroundColor: "#FFFFFF", borderRadius: 22, padding: spacing.lg, gap: spacing.sm, borderWidth: 1, borderColor: "#EEE8DD" },
  inputLabel: { color: colors.ink, fontSize: 13, fontWeight: "900", marginTop: 4 },
  input: { minHeight: 52, borderRadius: 14, borderWidth: 1.5, borderColor: "#E5DDD0", paddingHorizontal: spacing.md, color: colors.ink, fontSize: 16, backgroundColor: "#FFFDF8" },
  secondaryFullBtn: { alignItems: "center", paddingVertical: 12 },
  secondaryFullBtnText: { color: colors.ink, fontSize: 15, fontWeight: "800" },
  disabled: { opacity: 0.6 },
});
