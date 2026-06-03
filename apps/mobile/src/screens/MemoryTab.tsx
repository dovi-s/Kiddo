// MemoryTab — the native Memory Book, mirroring the web /memory/:fundId timeline.
//
// The web Memory Book is a chronological story of everyone who showed up: gift
// messages, milestones, parent notes, and photos, each color-coded by type. The
// old mobile tab showed a flat list of gift cards from the thin /gifts payload.
// This rebuild consumes the real GET /api/funds/:fundId/memory feed (the same
// entries the web renders) on the brand kit.

import React, { useMemo, useState } from "react";
import { Image, Pressable, RefreshControl, ScrollView, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { colors, semanticColors, radius, spacing } from "@kora/tokens";
import { KText, KiddoCard, KInput, Button, Skeleton, haptic } from "../ui";
import { formatBalance, type ApiFund, type MemoryEntry, type MemoryEntryType } from "../api";

function childNameOf(fund?: ApiFund | null): string {
  return fund?.recipientFirstName || fund?.name || "your child";
}

function fullDate(value?: string | null): string {
  if (!value) return "";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });
}

const NON_COUNTING = new Set(["pending", "failed", "refunded", "canceled", "cancelled", "host_hold"]);

// Per-type presentation — icon + tint, mirroring the web entry color-coding.
function presentation(type: MemoryEntryType): { icon: any; tint: string } {
  switch (type) {
    case "milestone":
      return { icon: "trophy", tint: colors.gold };
    case "photo":
      return { icon: "image", tint: colors.evergreen };
    case "note":
      return { icon: "chatbubble-ellipses", tint: colors.evergreen };
    case "parent_note":
      return { icon: "heart", tint: colors.gold };
    case "parent_investment_start":
      return { icon: "repeat", tint: colors.evergreen };
    case "gift_message":
    default:
      return { icon: "gift", tint: colors.evergreen };
  }
}

export interface MemoryTabProps {
  activeFund: ApiFund | null;
  entries: MemoryEntry[];
  loading: boolean;
  refreshing: boolean;
  onRefresh: () => void;
  /** Write a parent note to the timeline. Resolves once saved + the feed reloads. */
  onAddNote?: (content: string) => Promise<void>;
}

export function MemoryTab({ activeFund, entries, loading, refreshing, onRefresh, onAddNote }: MemoryTabProps) {
  const childName = childNameOf(activeFund);
  const isReadOnly =
    (activeFund as any)?.accessRole === "previous_owner" && Boolean((activeFund as any)?.transferredAt);

  const stats = useMemo(() => {
    const giftEntries = entries.filter((e) => e.gift && !NON_COUNTING.has(String(e.gift.status || "").toLowerCase()));
    const people = new Set(
      giftEntries
        .map((e) => (e.gift?.senderName || "").trim().toLowerCase())
        .filter(Boolean),
    ).size;
    return { gifts: giftEntries.length, people };
  }, [entries]);

  const refresh = <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.evergreen} />;

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: colors.creamDark }}
      contentContainerStyle={{ padding: spacing.md, gap: spacing.md, paddingBottom: 32 }}
      showsVerticalScrollIndicator={false}
      refreshControl={refresh}
    >
      {/* cover */}
      <KiddoCard variant="hero">
        <KText variant="eyebrow" color="#F8D889">Memory Book</KText>
        <KText variant="title" color="#FFF7E8" style={{ marginTop: 4 }}>
          {childName}'s story lives here.
        </KText>
        <KText variant="body" color="rgba(255,247,232,0.82)" style={{ marginTop: spacing.xs }}>
          Every gift, every note, every person who believed in {childName}'s future.
        </KText>
        {activeFund ? (
          <View style={{ flexDirection: "row", gap: spacing.sm, marginTop: spacing.md, flexWrap: "wrap" }}>
            <CoverStat value={`${stats.people}`} label={stats.people === 1 ? "person" : "people"} />
            <CoverStat value={`${stats.gifts}`} label={stats.gifts === 1 ? "gift" : "gifts"} />
            <CoverStat value={formatBalance(activeFund.balance)} label="fund" />
          </View>
        ) : null}
      </KiddoCard>

      {/* composer — write a note onto the timeline (owner / co-admin only) */}
      {activeFund && !isReadOnly && onAddNote ? (
        <NoteComposer childName={childName} onAddNote={onAddNote} />
      ) : null}

      {loading ? (
        <>
          <Skeleton height={110} rounded={radius.card} />
          <Skeleton height={110} rounded={radius.card} />
        </>
      ) : entries.length === 0 ? (
        <KiddoCard>
          <KText variant="heading">It starts with the first gift.</KText>
          <KText variant="caption" style={{ marginTop: spacing.xs }}>
            Once {childName}'s link is shared, every gift and message lands here automatically and
            builds the story over the years.
          </KText>
        </KiddoCard>
      ) : (
        <View style={{ gap: spacing.sm }}>
          {entries.map((entry) => (
            <MemoryCard key={entry.id} entry={entry} />
          ))}
        </View>
      )}
    </ScrollView>
  );
}

// Write-a-note composer. Collapsed to a single prompt row until tapped, then
// expands to a multiline field + save. Mirrors the web Memory composer's plainest
// path (a text note); photos/sealed letters are a later build-out.
function NoteComposer({
  childName,
  onAddNote,
}: {
  childName: string;
  onAddNote: (content: string) => Promise<void>;
}) {
  const [open, setOpen] = useState(false);
  const [text, setText] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    const content = text.trim();
    if (!content || saving) return;
    setSaving(true);
    setError(null);
    try {
      await onAddNote(content);
      haptic("success");
      setText("");
      setOpen(false);
    } catch (e: any) {
      haptic("error");
      setError(e?.message || "Couldn't save your note. Try again.");
    } finally {
      setSaving(false);
    }
  };

  if (!open) {
    return (
      <Pressable
        onPress={() => {
          haptic("selection");
          setOpen(true);
        }}
        style={{
          flexDirection: "row",
          alignItems: "center",
          gap: spacing.sm,
          backgroundColor: semanticColors.surface.card,
          borderRadius: radius.card,
          borderWidth: 1,
          borderColor: semanticColors.surface.muted,
          padding: spacing.md,
        }}
      >
        <View
          style={{
            width: 36,
            height: 36,
            borderRadius: 12,
            backgroundColor: colors.gold + "1F",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <Ionicons name="create-outline" size={18} color={colors.goldInk} />
        </View>
        <KText variant="body" color={semanticColors.text.muted} style={{ flex: 1 }}>
          Write something for {childName}…
        </KText>
      </Pressable>
    );
  }

  return (
    <KiddoCard>
      <KText variant="sectionLabel" color={semanticColors.text.muted}>Add to the book</KText>
      <KInput
        placeholder={`A note for ${childName} to read one day…`}
        value={text}
        onChangeText={setText}
        multiline
        autoFocus
        style={{ minHeight: 96, textAlignVertical: "top", marginTop: spacing.xs }}
      />
      {error ? (
        <KText variant="caption" color="#C0392B" style={{ marginTop: spacing.xs }}>{error}</KText>
      ) : null}
      <View style={{ flexDirection: "row", gap: spacing.sm, marginTop: spacing.sm }}>
        <Button label="Add to the book" onPress={submit} loading={saving} disabled={!text.trim()} style={{ flex: 1 }} />
        <Button
          label="Cancel"
          variant="ghost"
          onPress={() => {
            setOpen(false);
            setText("");
            setError(null);
          }}
        />
      </View>
    </KiddoCard>
  );
}

function CoverStat({ value, label }: { value: string; label: string }) {
  return (
    <View
      style={{
        backgroundColor: "rgba(255,255,255,0.12)",
        borderRadius: radius.pill,
        paddingHorizontal: 14,
        paddingVertical: 8,
      }}
    >
      <KText variant="bodyStrong" color="#FFFFFF" tabular>
        {value}
      </KText>
      <KText variant="caption" color="rgba(255,255,255,0.72)">
        {label}
      </KText>
    </View>
  );
}

function MemoryCard({ entry }: { entry: MemoryEntry }) {
  const { icon, tint } = presentation(entry.type);
  const gift = entry.gift;
  const isGift = entry.type === "gift_message" && gift;
  const who = isGift
    ? gift!.senderName?.trim() || "Someone"
    : entry.authorName?.trim() || (entry.type.startsWith("parent") ? "You" : "Kiddo");
  const showPhoto =
    entry.photoUrl && (entry.mediaStatus === "external" || entry.mediaStatus === "stored" || !entry.mediaStatus);

  return (
    <KiddoCard>
      <View style={{ flexDirection: "row", gap: spacing.sm }}>
        <View
          style={{
            width: 36,
            height: 36,
            borderRadius: 12,
            backgroundColor: tint + "18",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <Ionicons name={icon} size={18} color={tint} />
        </View>
        <View style={{ flex: 1, minWidth: 0 }}>
          {/* header row */}
          <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
            <KText variant="bodyStrong" numberOfLines={1} style={{ flex: 1, marginRight: spacing.sm }}>
              {entry.type === "milestone"
                ? "Milestone"
                : entry.type === "parent_investment_start"
                  ? "Recurring started"
                  : who}
            </KText>
            {isGift ? (
              <KText variant="bodyStrong" tabular>
                {formatBalance(gift!.netAmount ?? gift!.amount)}
              </KText>
            ) : null}
          </View>

          <KText variant="caption" color={semanticColors.text.muted} style={{ marginTop: 1 }}>
            {fullDate(entry.createdAt)}
            {isGift && gift!.eventName ? ` · ${gift!.eventName}` : ""}
          </KText>

          {/* body */}
          {entry.content || gift?.message ? (
            <KText
              variant="body"
              style={{ marginTop: spacing.sm, fontStyle: entry.type === "milestone" ? "normal" : "italic" }}
            >
              {entry.type === "milestone" ? entry.content : `“${entry.content || gift?.message}”`}
            </KText>
          ) : isGift ? (
            <KText variant="caption" color={semanticColors.text.muted} style={{ marginTop: spacing.sm }}>
              No note. Still part of the story.
            </KText>
          ) : null}

          {/* photo */}
          {showPhoto ? (
            <Image
              source={{ uri: entry.photoUrl! }}
              style={{
                width: "100%",
                height: 180,
                borderRadius: radius.inner,
                marginTop: spacing.sm,
                backgroundColor: semanticColors.surface.muted,
              }}
              resizeMode="cover"
            />
          ) : null}

          {/* invested-into line for gifts */}
          {isGift && gift!.selectedTicker ? (
            <View
              style={{
                marginTop: spacing.sm,
                paddingTop: spacing.sm,
                borderTopWidth: 1,
                borderTopColor: semanticColors.surface.muted,
              }}
            >
              <KText variant="caption" color={colors.evergreen}>
                Invested in {gift!.selectedTicker}
                {gift!.sharesAcquired ? ` · ${parseFloat(gift!.sharesAcquired).toFixed(4)} shares` : ""}
              </KText>
            </View>
          ) : null}
        </View>
      </View>
    </KiddoCard>
  );
}
