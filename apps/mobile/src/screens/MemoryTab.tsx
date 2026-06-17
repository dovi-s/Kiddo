// MemoryTab — the native Memory Book, mirroring the web /memory/:fundId timeline.
//
// The web Memory Book is a chronological story of everyone who showed up: gift
// messages, milestones, parent notes, and photos, each color-coded by type. The
// old mobile tab showed a flat list of gift cards from the thin /gifts payload.
// This rebuild consumes the real GET /api/funds/:fundId/memory feed (the same
// entries the web renders) on the brand kit.

import React, { useEffect, useMemo, useState } from "react";
import { Alert, Image, Pressable, RefreshControl, ScrollView, Share, View } from "react-native";
import * as ImagePicker from "expo-image-picker";
import { Ionicons } from "@expo/vector-icons";
import { colors, semanticColors, radius, spacing } from "@kora/tokens";
import { KText, KiddoCard, KInput, Button, Skeleton, haptic, Appear } from "../ui";
import {
  API_BASE,
  WEB_BASE,
  apiGetMarketQuotes,
  formatBalance,
  type ApiFund,
  type MemoryEntry,
  type MemoryEntryType,
} from "../api";
import { isReadOnlyFund } from "../lib/fund";
import { looksLikeTestSender } from "../lib/gifters";

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

// Collapse consecutive "Recurring started" (parent_investment_start) entries into
// one summary row, so a fund with several recurring schedules doesn't flood the
// timeline (mirrors the web's recurring-cycle compression). A lone one stays as-is.
type Row = { kind: "entry"; entry: MemoryEntry } | { kind: "recurringGroup"; entries: MemoryEntry[] };
function collapseRecurring(entries: MemoryEntry[]): Row[] {
  const rows: Row[] = [];
  let i = 0;
  while (i < entries.length) {
    if (entries[i].type === "parent_investment_start") {
      const group: MemoryEntry[] = [];
      while (i < entries.length && entries[i].type === "parent_investment_start") {
        group.push(entries[i]);
        i++;
      }
      rows.push(group.length === 1 ? { kind: "entry", entry: group[0] } : { kind: "recurringGroup", entries: group });
    } else {
      rows.push({ kind: "entry", entry: entries[i] });
      i++;
    }
  }
  return rows;
}

// ─── "Who loves {name}" roster (web parity, the people-first centerpiece) ────
function initialsOf(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return "?";
  return ((parts[0][0] || "") + (parts.length > 1 ? parts[parts.length - 1][0] : "")).toUpperCase();
}
const AVATAR_TINTS = ["#1B3A2D", "#6F4611", "#24543F", "#7A4E00", "#3D5A4A"];
function tintFor(name: string): string {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) >>> 0;
  return AVATAR_TINTS[h % AVATAR_TINTS.length];
}
function wholeMoney(n: number): string {
  return "$" + Math.round(n).toLocaleString("en-US");
}

function WhoLovesRoster({
  childName,
  roster,
}: {
  childName: string;
  roster: { name: string; total: number; count: number }[];
}) {
  return (
    <Appear delay={60}>
      <KiddoCard>
        <KText variant="heading">Who loves {childName}</KText>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={{ marginTop: spacing.sm, marginHorizontal: -4 }}
          contentContainerStyle={{ gap: spacing.md, paddingHorizontal: 4 }}
        >
          {roster.map((p) => (
            <View key={p.name} style={{ width: 74, alignItems: "center", gap: 3 }}>
              <View
                style={{
                  width: 52,
                  height: 52,
                  borderRadius: 26,
                  backgroundColor: tintFor(p.name),
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <KText variant="label" color="#F8F5F0">
                  {initialsOf(p.name)}
                </KText>
              </View>
              <KText variant="caption" color={semanticColors.text.primary} style={{ textAlign: "center" }}>
                {p.name.split(/\s+/)[0]}
              </KText>
              <KText variant="caption" color={semanticColors.text.muted} style={{ textAlign: "center" }}>
                {wholeMoney(p.total)}
              </KText>
            </View>
          ))}
        </ScrollView>
      </KiddoCard>
    </Appear>
  );
}

// ─── "Capture a moment" prompts (web parity) ────────────────────────────────
const MOMENT_PROMPTS = ["First steps", "First word", "Lost a tooth", "Started a sport", "First sleepover", "Something they said"];

function CaptureMoment({ childName, onPick }: { childName: string; onPick: (text: string) => void }) {
  return (
    <Appear delay={70}>
      <KiddoCard>
        <KText variant="heading">Capture a moment</KText>
        <KText variant="caption" color={semanticColors.text.muted} style={{ marginTop: 2, marginBottom: spacing.sm }}>
          Tap one, then add a note or a photo. {childName} reads it later.
        </KText>
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: spacing.sm }}>
          {MOMENT_PROMPTS.map((p) => (
            <Pressable
              key={p}
              onPress={() => {
                haptic("selection");
                onPick(p);
              }}
              style={{
                paddingHorizontal: 14,
                paddingVertical: 8,
                borderRadius: 999,
                backgroundColor: "#F6EFE3",
                borderWidth: 1,
                borderColor: "#E8DEC9",
              }}
            >
              <KText variant="caption" color={colors.goldInk}>
                {p}
              </KText>
            </Pressable>
          ))}
        </View>
      </KiddoCard>
    </Appear>
  );
}

export interface MemoryTabProps {
  activeFund: ApiFund | null;
  entries: MemoryEntry[];
  loading: boolean;
  refreshing: boolean;
  onRefresh: () => void;
  /** Write a parent note to the timeline. Resolves once saved + the feed reloads. */
  onAddNote?: (content: string) => Promise<void>;
  /** Upload + attach a photo (data URL) with an optional caption. */
  onAddPhoto?: (dataUrl: string, caption: string) => Promise<void>;
  /** Edit a parent-authored entry's text. */
  onEditEntry?: (id: string, content: string) => Promise<void>;
  /** Delete a parent-authored entry. */
  onDeleteEntry?: (id: string) => Promise<void>;
}

export function MemoryTab({
  activeFund,
  entries,
  loading,
  refreshing,
  onRefresh,
  onAddNote,
  onAddPhoto,
  onEditEntry,
  onDeleteEntry,
}: MemoryTabProps) {
  const childName = childNameOf(activeFund);
  const isReadOnly = isReadOnlyFund(activeFund);
  // A tapped "Capture a moment" prompt; bumping .n re-opens the composer.
  const [seed, setSeed] = useState<{ text: string; n: number }>({ text: "", n: 0 });

  // Hide test/seed-sender gift entries (the "test" gift) so the timeline + cover
  // counts match Home, which already filters them.
  const visibleEntries = useMemo(
    () => entries.filter((e) => !(e.gift && looksLikeTestSender(e.gift.senderName, e.gift.senderEmail))),
    [entries],
  );

  const stats = useMemo(() => {
    const giftEntries = visibleEntries.filter(
      (e) => e.gift && !NON_COUNTING.has(String(e.gift.status || "").toLowerCase()),
    );
    // Unique named people, excluding the anonymous "Someone" fallback (matches Home).
    const people = new Set(
      giftEntries
        .map((e) => (e.gift?.senderName || "").trim().toLowerCase())
        .filter((n) => n && !/^someone\b/.test(n)),
    ).size;
    return { gifts: giftEntries.length, people };
  }, [visibleEntries]);

  const rows = useMemo(() => collapseRecurring(visibleEntries), [visibleEntries]);

  // Live prices for the gift tickers, so entries can show "now worth $X" (web
  // parity) instead of just a raw share count.
  const [quotes, setQuotes] = useState<Record<string, number>>({});
  useEffect(() => {
    const tickers = Array.from(
      new Set(
        visibleEntries
          .map((e) => (e.gift?.selectedTicker || "").trim().toUpperCase())
          .filter(Boolean),
      ),
    );
    if (tickers.length === 0) return;
    let active = true;
    apiGetMarketQuotes(tickers)
      .then((qs) => {
        if (!active) return;
        const map: Record<string, number> = {};
        for (const q of qs) if (q.symbol && q.price) map[q.symbol.toUpperCase()] = q.price;
        setQuotes(map);
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, [visibleEntries]);

  // "Who loves {name}" — aggregate counting gifts by named sender (sum + count).
  const roster = useMemo(() => {
    const map = new Map<string, { name: string; total: number; count: number }>();
    for (const e of visibleEntries) {
      const g = e.gift;
      if (!g) continue;
      if (NON_COUNTING.has(String(g.status || "").toLowerCase())) continue;
      const name = (g.senderName || "").trim();
      if (!name || /^someone\b/i.test(name)) continue;
      const key = name.toLowerCase();
      const amt = parseFloat(String(g.netAmount ?? g.amount ?? "0")) || 0;
      const cur = map.get(key) || { name, total: 0, count: 0 };
      cur.total += amt;
      cur.count += 1;
      map.set(key, cur);
    }
    return Array.from(map.values())
      .sort((a, b) => b.total - a.total)
      .slice(0, 14);
  }, [visibleEntries]);

  const refresh = <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.evergreen} />;

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: colors.creamDark }}
      contentContainerStyle={{ padding: spacing.md, gap: spacing.md, paddingBottom: 32 }}
      showsVerticalScrollIndicator={false}
      refreshControl={refresh}
    >
      {/* cover */}
      <Appear delay={0}>
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
            <CoverStat
              value={formatBalance(
                parseFloat(activeFund.balance || "0") +
                  parseFloat((activeFund as any).cashBalance || "0") +
                  parseFloat(activeFund.pendingBalance || "0"),
              )}
              label="fund"
            />
          </View>
        ) : null}

        {/* hero action buttons (web parity: Share update + Add memory) */}
        {activeFund && !isReadOnly ? (
          <View style={{ flexDirection: "row", gap: spacing.sm, marginTop: spacing.md }}>
            <Pressable
              onPress={() => {
                haptic("selection");
                Share.share({
                  message: `Follow ${childName}'s fund: ${WEB_BASE}/${activeFund.slug}`,
                  url: `${WEB_BASE}/${activeFund.slug}`,
                }).catch(() => {});
              }}
              style={{
                flex: 1,
                flexDirection: "row",
                alignItems: "center",
                justifyContent: "center",
                gap: 6,
                backgroundColor: "rgba(14,37,24,0.55)",
                borderRadius: radius.control,
                paddingVertical: 12,
              }}
            >
              <Ionicons name="share-social-outline" size={16} color="#F8F5F0" />
              <KText variant="label" color="#F8F5F0">
                Share update
              </KText>
            </Pressable>
            {onAddNote ? (
              <Pressable
                onPress={() => {
                  haptic("selection");
                  setSeed((s) => ({ text: "", n: s.n + 1 }));
                }}
                style={{
                  flex: 1,
                  flexDirection: "row",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 6,
                  backgroundColor: colors.gold,
                  borderRadius: radius.control,
                  paddingVertical: 12,
                }}
              >
                <Ionicons name="add" size={18} color="#38290A" />
                <KText variant="label" color="#38290A">
                  Add memory
                </KText>
              </Pressable>
            ) : null}
          </View>
        ) : null}
      </KiddoCard>
      </Appear>

      {/* who loves {name} — the people-first roster (web parity) */}
      {roster.length > 0 ? <WhoLovesRoster childName={childName} roster={roster} /> : null}

      {/* composer + capture-a-moment prompts (owner / co-admin only) */}
      {activeFund && !isReadOnly && onAddNote ? (
        <>
          <CaptureMoment
            childName={childName}
            onPick={(t) => setSeed((s) => ({ text: t, n: s.n + 1 }))}
          />
          <NoteComposer childName={childName} onAddNote={onAddNote} onAddPhoto={onAddPhoto} seed={seed} />
        </>
      ) : null}

      {loading ? (
        <>
          <Skeleton height={110} rounded={radius.card} />
          <Skeleton height={110} rounded={radius.card} />
        </>
      ) : visibleEntries.length === 0 ? (
        <KiddoCard>
          <KText variant="heading">It starts with the first gift.</KText>
          <KText variant="caption" style={{ marginTop: spacing.xs }}>
            Once {childName}'s link is shared, every gift and message lands here automatically and
            builds the story over the years.
          </KText>
        </KiddoCard>
      ) : (
        <View style={{ gap: spacing.sm }}>
          {rows.map((row, i) =>
            row.kind === "recurringGroup" ? (
              <RecurringGroupCard key={`rg-${i}`} entries={row.entries} />
            ) : (
              <MemoryCard
                key={row.entry.id}
                entry={row.entry}
                quotes={quotes}
                onEdit={!isReadOnly ? onEditEntry : undefined}
                onDelete={!isReadOnly ? onDeleteEntry : undefined}
              />
            ),
          )}
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
  onAddPhoto,
  seed,
}: {
  childName: string;
  onAddNote: (content: string) => Promise<void>;
  onAddPhoto?: (dataUrl: string, caption: string) => Promise<void>;
  /** A "Capture a moment" prompt; bumping seed.n opens the composer pre-filled. */
  seed?: { text: string; n: number };
}) {
  const [open, setOpen] = useState(false);
  const [text, setText] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Apply a tapped capture-moment prompt: open + pre-fill with the starter.
  useEffect(() => {
    if (seed && seed.n > 0) {
      setOpen(true);
      setText(seed.text);
    }
  }, [seed?.n]);

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

  const addPhoto = async () => {
    if (!onAddPhoto || saving) return;
    setError(null);
    try {
      const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!perm.granted) {
        setError("Photo access is needed to add a picture.");
        return;
      }
      const r = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        base64: true,
        quality: 0.6,
      });
      if (r.canceled || !r.assets?.[0]?.base64) return;
      const a = r.assets[0];
      const dataUrl = `data:${a.mimeType || "image/jpeg"};base64,${a.base64}`;
      setSaving(true);
      await onAddPhoto(dataUrl, text);
      haptic("success");
      setText("");
      setOpen(false);
    } catch (e: any) {
      haptic("error");
      setError(e?.message || "Couldn't add the photo.");
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
      <View style={{ flexDirection: "row", gap: spacing.sm, marginTop: spacing.sm, alignItems: "center" }}>
        <Button label="Add to the book" onPress={submit} loading={saving} disabled={!text.trim()} style={{ flex: 1 }} />
        {onAddPhoto ? (
          <Pressable
            onPress={addPhoto}
            disabled={saving}
            accessibilityLabel="Add a photo"
            style={{
              width: 48,
              height: 48,
              borderRadius: radius.control,
              borderWidth: 1.5,
              borderColor: semanticColors.surface.muted,
              alignItems: "center",
              justifyContent: "center",
              opacity: saving ? 0.5 : 1,
            }}
          >
            <Ionicons name="image-outline" size={20} color={colors.evergreen} />
          </Pressable>
        ) : null}
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

// Summary card for a run of collapsed "Recurring started" entries.
function RecurringGroupCard({ entries }: { entries: MemoryEntry[] }) {
  const [expanded, setExpanded] = useState(false);
  const dates = entries
    .map((e) => new Date(e.createdAt))
    .filter((d) => !Number.isNaN(d.getTime()))
    .sort((a, b) => b.getTime() - a.getTime());
  const when = dates.length
    ? dates[0].toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })
    : "";
  return (
    <KiddoCard onPress={() => setExpanded((v) => !v)}>
      <View style={{ flexDirection: "row", gap: spacing.sm, alignItems: "center" }}>
        <View
          style={{
            width: 36,
            height: 36,
            borderRadius: 12,
            backgroundColor: colors.evergreen + "18",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <Ionicons name="repeat" size={18} color={colors.evergreen} />
        </View>
        <View style={{ flex: 1, minWidth: 0 }}>
          <KText variant="bodyStrong">{entries.length} recurring investments set up</KText>
          <KText variant="caption" color={semanticColors.text.muted}>
            {when} · tap to {expanded ? "hide" : "see each"}
          </KText>
        </View>
      </View>
      {expanded ? (
        <View style={{ marginTop: spacing.sm, gap: 6, paddingTop: spacing.sm, borderTopWidth: 1, borderTopColor: semanticColors.surface.muted }}>
          {entries.map((e) => (
            <KText key={e.id} variant="caption" color={semanticColors.text.muted}>
              • {e.content || "Recurring investment"}
            </KText>
          ))}
        </View>
      ) : null}
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

function MemoryCard({
  entry,
  quotes,
  onEdit,
  onDelete,
}: {
  entry: MemoryEntry;
  quotes?: Record<string, number>;
  onEdit?: (id: string, content: string) => Promise<void>;
  onDelete?: (id: string) => Promise<void>;
}) {
  const { icon, tint } = presentation(entry.type);
  const gift = entry.gift;
  const isGift = entry.type === "gift_message" && gift;
  // Parent-authored, non-gift entries are editable/deletable (matches the
  // server: gift-linked entries reject edits). Backfilled gift rows have a giftId.
  const canManage = !entry.giftId && (entry.type === "note" || entry.type === "photo" || entry.type === "parent_note");
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(entry.content || "");
  const [busy, setBusy] = useState(false);

  const saveEdit = async () => {
    if (!onEdit || busy) return;
    setBusy(true);
    try {
      await onEdit(entry.id, draft);
      haptic("success");
      setEditing(false);
    } catch {
      haptic("error");
    } finally {
      setBusy(false);
    }
  };

  const confirmDelete = () => {
    if (!onDelete) return;
    Alert.alert("Delete this entry?", "This removes it from the Memory Book. This can't be undone.", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: async () => {
          try {
            await onDelete(entry.id);
            haptic("success");
          } catch {
            haptic("error");
          }
        },
      },
    ]);
  };
  const who = isGift
    ? gift!.senderName?.trim() || "Someone"
    : entry.authorName?.trim() || (entry.type.startsWith("parent") ? "You" : "Kiddo");
  // Resolve relative /uploads paths to absolute so RN's <Image> can load them
  // (the web serves them same-origin; the native app has no implicit base).
  const photoUri = entry.photoUrl
    ? entry.photoUrl.startsWith("/")
      ? `${API_BASE}${entry.photoUrl}`
      : entry.photoUrl
    : null;
  const showPhoto = Boolean(photoUri) && entry.mediaStatus !== "broken";

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

          {/* body (or inline editor) */}
          {editing ? (
            <View style={{ marginTop: spacing.sm }}>
              <KInput value={draft} onChangeText={setDraft} multiline style={{ minHeight: 72, textAlignVertical: "top" }} />
              <View style={{ flexDirection: "row", gap: spacing.sm, marginTop: spacing.sm }}>
                <Button label="Save" onPress={saveEdit} loading={busy} disabled={!draft.trim()} style={{ flex: 1 }} />
                <Button label="Cancel" variant="ghost" onPress={() => { setEditing(false); setDraft(entry.content || ""); }} />
              </View>
            </View>
          ) : entry.content || gift?.message ? (
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
              source={{ uri: photoUri! }}
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

          {/* invested-into line for gifts: ticker chip + "now worth $X" (web parity) */}
          {isGift && gift!.selectedTicker ? (
            (() => {
              const ticker = String(gift!.selectedTicker).toUpperCase();
              const shares = gift!.sharesAcquired ? parseFloat(gift!.sharesAcquired) : 0;
              const price = quotes?.[ticker];
              const nowWorth = shares > 0 && price ? shares * price : null;
              return (
                <View
                  style={{
                    marginTop: spacing.sm,
                    paddingTop: spacing.sm,
                    borderTopWidth: 1,
                    borderTopColor: semanticColors.surface.muted,
                    flexDirection: "row",
                    alignItems: "center",
                    gap: 6,
                  }}
                >
                  <View
                    style={{
                      backgroundColor: colors.evergreen + "14",
                      borderRadius: radius.pill,
                      paddingHorizontal: 8,
                      paddingVertical: 2,
                    }}
                  >
                    <KText variant="caption" color={colors.evergreen}>
                      {ticker}
                    </KText>
                  </View>
                  <KText variant="caption" color={semanticColors.text.muted} style={{ flex: 1 }}>
                    {nowWorth != null
                      ? `Invested · now worth ${formatBalance(nowWorth)}`
                      : `Invested${shares > 0 ? ` · ${shares.toFixed(4)} shares` : ""}`}
                  </KText>
                </View>
              );
            })()
          ) : null}

          {/* manage (parent-authored entries only) */}
          {canManage && !editing && (onEdit || onDelete) ? (
            <View style={{ flexDirection: "row", gap: spacing.lg, marginTop: spacing.sm }}>
              {onEdit ? (
                <Pressable onPress={() => { setDraft(entry.content || ""); setEditing(true); }} hitSlop={8}>
                  <KText variant="caption" color={colors.evergreen}>Edit</KText>
                </Pressable>
              ) : null}
              {onDelete ? (
                <Pressable onPress={confirmDelete} hitSlop={8}>
                  <KText variant="caption" color="#C0392B">Delete</KText>
                </Pressable>
              ) : null}
            </View>
          ) : null}
        </View>
      </View>
    </KiddoCard>
  );
}
