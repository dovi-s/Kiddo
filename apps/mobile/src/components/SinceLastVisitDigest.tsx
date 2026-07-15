// SinceLastVisitDigest — the "while you were away" recap card, a native mirror
// of client/src/components/dashboard/SinceLastVisitDigest.tsx. Entirely
// client-side: it diffs the current balance against a stored last-seen marker
// (expo-secure-store, per fund) and splits the gain into gifts-from-others,
// your-own recurring, and market growth. The demo account uses a synthetic
// 6-day baseline so the recap shows without a prior session. Honest by
// construction: never shows a loss as a gain, suppresses incoherent recaps.
import React, { useEffect, useRef, useState } from "react";
import { Pressable, View } from "react-native";
import * as SecureStore from "expo-secure-store";
import { Ionicons } from "@expo/vector-icons";
import { colors, semanticColors, radius, spacing } from "@kora/tokens";
import { KText, Appear } from "../ui";
import type { DashboardGift } from "../api";

const MIN_AWAY_MS = 24 * 60 * 60 * 1000;
const DEMO_AWAY_MS = 6 * 24 * 60 * 60 * 1000;
const DEMO_GROWTH_RATE = 0.008;
const NOTEWORTHY_MOVE_FRAC = 0.005;
const KEY = (fundId: string) => `kiddo.fund.lastSeen.v1:${fundId}`;

type Digest = {
  sinceTs: number;
  delta: number;
  othersSum: number;
  ownSum: number;
  growth: number;
  otherGiftCount: number;
  otherGifterCount: number;
  singleOtherName: string;
};

function isAnonSender(name: string): boolean {
  const n = (name || "").trim().toLowerCase();
  return !n || n === "anonymous" || n.startsWith("someone who loves");
}

function fmt0(n: number): string {
  return "$" + Math.round(n).toLocaleString("en-US");
}
function shortDate(ts: number): string {
  return new Date(ts).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function compute(opts: {
  currentValue: number;
  gifts: DashboardGift[];
  sinceTs: number;
  baselineValue: number | null;
  isDemo: boolean;
}): Digest | null {
  const { currentValue, gifts, sinceTs, baselineValue, isDemo } = opts;
  if (!sinceTs) return null;
  if (!isDemo && Date.now() - sinceTs < MIN_AWAY_MS) return null;

  const giftsSince = gifts.filter((g) => {
    const s = String(g.status || "").toLowerCase();
    if (s !== "settled" && s !== "invested") return false;
    const ts = new Date(g.settledAt || g.createdAt || 0).getTime();
    return Number.isFinite(ts) && ts > sinceTs;
  });

  let othersSum = 0;
  let ownSum = 0;
  let otherGiftCount = 0;
  let otherAnon = 0;
  const otherNamed = new Set<string>();
  let singleOtherName = "";
  for (const g of giftsSince) {
    const amt = parseFloat(String(g.netAmount ?? g.amount ?? "0")) || 0;
    if (g.parentContributionId) {
      ownSum += amt;
      continue;
    }
    othersSum += amt;
    otherGiftCount += 1;
    const name = (g.senderName || "").trim();
    if (isAnonSender(name)) otherAnon += 1;
    else {
      otherNamed.add(name.toLowerCase());
      singleOtherName = name;
    }
  }

  let delta: number;
  let growth: number;
  if (isDemo) {
    growth = currentValue * DEMO_GROWTH_RATE;
    delta = othersSum + ownSum + growth;
  } else {
    delta = currentValue - (baselineValue ?? currentValue);
    if (delta < 1) return null;
    if (othersSum + ownSum > delta + 1) return null; // incoherent recap
    const noteworthy = giftsSince.length > 0 || delta >= currentValue * NOTEWORTHY_MOVE_FRAC;
    if (!noteworthy) return null;
    growth = Math.max(0, delta - othersSum - ownSum);
  }
  if (giftsSince.length === 0 && growth < 1) return null;

  const otherGifterCount = otherNamed.size + otherAnon;
  const finalSingleName = otherNamed.size === 1 ? singleOtherName : otherAnon === 1 ? "someone" : "";
  return {
    sinceTs,
    delta,
    othersSum,
    ownSum,
    growth,
    otherGiftCount,
    otherGifterCount,
    singleOtherName: finalSingleName,
  };
}

function joinParts(parts: string[]): string {
  if (!parts.length) return "";
  if (parts.length === 1) return parts[0] + ".";
  return parts.slice(0, -1).join(", ") + ", plus " + parts[parts.length - 1] + ".";
}

function buildBody(d: Digest, viewerIsContributor: boolean): string {
  const parts: string[] = [];
  if (d.otherGiftCount > 0) {
    if (d.otherGifterCount === 1 && d.singleOtherName) {
      parts.push(
        d.otherGiftCount === 1
          ? `a ${fmt0(d.othersSum)} gift from ${d.singleOtherName}`
          : `${fmt0(d.othersSum)} from ${d.singleOtherName} (${d.otherGiftCount} gifts)`,
      );
    } else {
      parts.push(
        `${d.otherGiftCount} gift${d.otherGiftCount === 1 ? "" : "s"} (${fmt0(d.othersSum)}) from ${d.otherGifterCount} ${d.otherGifterCount === 1 ? "person" : "people"}`,
      );
    }
  }
  if (d.ownSum >= 1) {
    parts.push(viewerIsContributor ? `${fmt0(d.ownSum)} from you` : `${fmt0(d.ownSum)} in recurring investments`);
  }
  if (d.growth >= 1) parts.push(`${fmt0(d.growth)} in market growth`);
  return joinParts(parts);
}

export function SinceLastVisitDigest({
  subject,
  currentValue,
  gifts,
  fundId,
  isDemoAccount,
  viewerIsContributor = true,
  revealDelayMs = 900,
}: {
  subject: string;
  currentValue: number;
  gifts: DashboardGift[];
  fundId: string;
  isDemoAccount?: boolean;
  viewerIsContributor?: boolean;
  revealDelayMs?: number;
}) {
  const [digest, setDigest] = useState<Digest | null>(null);
  const [dismissed, setDismissed] = useState(false);
  const computedFor = useRef<string>("");

  useEffect(() => {
    // Compute once per fund (don't re-run as the balance streams in).
    if (computedFor.current === fundId) return;
    computedFor.current = fundId;
    let active = true;
    void (async () => {
      if (isDemoAccount) {
        const d = compute({
          currentValue,
          gifts,
          sinceTs: Date.now() - DEMO_AWAY_MS,
          baselineValue: null,
          isDemo: true,
        });
        if (active) setDigest(d);
        return;
      }
      try {
        const raw = await SecureStore.getItemAsync(KEY(fundId));
        if (!raw) {
          // First time we see this fund: store the baseline, show nothing yet.
          await SecureStore.setItemAsync(KEY(fundId), JSON.stringify({ value: currentValue, ts: Date.now() }));
          return;
        }
        const base = JSON.parse(raw) as { value: number; ts: number };
        const d = compute({ currentValue, gifts, sinceTs: base.ts, baselineValue: base.value, isDemo: false });
        if (active) setDigest(d);
        // Advance the marker so the next session diffs from now.
        await SecureStore.setItemAsync(KEY(fundId), JSON.stringify({ value: currentValue, ts: Date.now() }));
      } catch {
        // SecureStore unavailable — skip the recap rather than fail the screen.
      }
    })();
    return () => {
      active = false;
    };
  }, [fundId, currentValue, gifts, isDemoAccount]);

  if (!digest || dismissed) return null;

  const headline = `${subject} is up ${fmt0(digest.delta)} since ${shortDate(digest.sinceTs)}`;
  const body = buildBody(digest, viewerIsContributor);

  return (
    <Appear delay={revealDelayMs}>
      <View
        style={{
          borderRadius: radius.card,
          borderWidth: 1,
          borderColor: "rgba(27,58,45,0.28)",
          backgroundColor: "#F3F6F1",
          padding: spacing.md,
          flexDirection: "row",
          alignItems: "flex-start",
          gap: spacing.sm,
        }}
      >
        <View style={{ flex: 1 }}>
          <KText variant="eyebrow" color={colors.evergreen} style={{ marginBottom: 4 }}>
            While you were away
          </KText>
          <KText variant="heading">{headline}</KText>
          {body ? (
            <KText variant="body" color={semanticColors.text.muted} style={{ marginTop: 4 }}>
              {body}
            </KText>
          ) : null}
        </View>
        <Pressable
          onPress={() => setDismissed(true)}
          hitSlop={10}
          style={{ padding: 2 }}
          accessibilityRole="button"
          accessibilityLabel="Dismiss"
        >
          <Ionicons name="close" size={18} color={semanticColors.text.muted} />
        </Pressable>
      </View>
    </Appear>
  );
}
