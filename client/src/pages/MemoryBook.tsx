import { useEffect, useMemo, useRef, useState } from "react";

function stripHtml(str: string | null | undefined): string {
  if (!str) return "";
  return str.replace(/<[^>]*>/g, "").trim();
}

// titleCaseName — single source of truth for capitalizing sender
// names at render time. Gifters who type their name lowercase
// ("grandpa", "ari") shouldn't show up that way in Emma's love-letter
// book at 18. Per-word capitalization, preserving internal whitespace.
// Used everywhere a senderName is rendered (list view, book view,
// gifter roster, thank-you composer) so no path can bypass it.
function titleCaseName(s: string | null | undefined): string {
  return String(s || "")
    .split(/\s+/)
    .map((w) => (w ? w.charAt(0).toUpperCase() + w.slice(1) : w))
    .join(" ");
}

// StaticWaveform — semantic indicator for voice notes. Looks like the
// shape of sound the way a play button looks like the act of playing.
// Static (not animated) by design: animated waveforms read as
// ornamental AI-slop and decorate without informing. A static
// silhouette communicates "voice lives here" with the same iconic
// register as an album cover. The bar heights are chosen to suggest
// organic speech (asymmetric, varying volume) rather than a perfect
// sine wave. Color via currentColor so callers can tint it gold,
// muted, etc. without extra props.
function StaticWaveform({ size = "sm" }: { size?: "sm" | "md" | "lg" }) {
  const heights = [0.40, 0.65, 0.50, 0.85, 0.42, 0.92, 0.58, 0.38, 0.72, 0.48, 0.88, 0.62, 0.34, 0.70, 0.55, 0.45, 0.78, 0.50];
  const barW = size === "lg" ? 3 : 2;
  const gap = size === "lg" ? 3 : 2;
  const maxH = size === "lg" ? 32 : size === "md" ? 22 : 16;
  const w = heights.length * (barW + gap);
  return (
    <svg width={w} height={maxH} viewBox={`0 0 ${w} ${maxH}`} aria-hidden style={{ flexShrink: 0 }}>
      {heights.map((h, i) => {
        const barH = Math.max(2, h * maxH);
        const y = (maxH - barH) / 2;
        return <rect key={i} x={i * (barW + gap)} y={y} width={barW} height={barH} fill="currentColor" rx={1} />;
      })}
    </svg>
  );
}
import { useLocation, useParams, useSearch } from "wouter";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import {
  DUR_FAST,
  DUR_NORMAL,
  DUR_SLOW,
  EASE_DECEL,
  EASE_STANDARD,
  SPRING_SHEET,
} from "@/lib/motion";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Plus, Gift, Camera, Star, MessageCircle, X, Calendar, Pencil, Trash2, Globe, Users, Lock, Pin, Send, Copy, BookOpen, Repeat, Heart, MoreVertical, Mic, Video, AlertCircle } from "lucide-react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { EnlighteningReveal } from "@/components/ui/gemini";
import { haptic } from "@/lib/haptics";
import { capFirst } from "@/lib/format-name";
import { prefetchDashboard, prefetchActivity, onIdle } from "@/lib/prefetch";
import { scrollToTestId } from "@/lib/scroll-to-element";
import { getDeepLinkHighlightStyle, getDeepLinkHighlightCardStyle, hasActiveDeepLink, HIGHLIGHT_HOLD_MS } from "@/lib/deep-link-highlight";
import { TrustMicroStrip } from "@/components/ui/ux-foundations";
import { StockLogo } from "@/components/ui/stock-logo";
import { toast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/use-auth";
import { readDemoLiveGiftsForFund } from "@/lib/demo-live-gifts";
import { useSubscription } from "@/hooks/use-subscription";
import { useCachedFirstNumber } from "@/hooks/use-cached-first-number";
import { getEmbedVideoUrl } from "@/lib/media";
import { getPronouns } from "@/lib/pronouns";
import { readLocalCache, writeLocalCache } from "@/lib/local-cache";
import { filterMemoryEntries, getVisibleMemoryEntries, validateMemoryMedia } from "./memoryBookUtils";
import { AppHeader } from "@/components/layout/AppHeader";
import { projectFundValue } from "@shared/projection";

const MEMORY_ACTIVE_STALE_MS = 5_000;
const MEMORY_LIVE_REFRESH_MS = 15_000;
const MEMORY_ENTRIES_CACHE_PREFIX = "kiddo.memory.entries.v1:";
const MEMORY_FUND_CACHE_PREFIX = "kiddo.memory.fund.v1:";
// Per-fund events cache (drives the "Emma's occasions" strip).
// Added 2026-05-20: previously the events query had a 30s staleTime
// and no initialData, so every Memory Book mount fired a fresh
// network request and the occasions strip rendered empty during
// the load. User-reported: "the emmas occasions part of the
// memory book is loading very slowly." Same anti-pattern as the
// CoParentAccessCard fix (commit f347fe2): the canonical caching
// trio (initialData + writeLocalCache + longer staleTime) makes
// returning Memory Book visits feel instant.
const MEMORY_EVENTS_CACHE_PREFIX = "kiddo.memory.events.v1:";
// Per-fund thank-yous cache. Same pattern; same fix; same reason.
const MEMORY_THANK_YOUS_CACHE_PREFIX = "kiddo.memory.thank-yous.v1:";
// Per-fund "last visited" timestamp for the Memory Book unread badge on
// the bottom-nav. Same shape as the Activity tab's lastReadAt: when the
// parent lands on the Memory Book page, we stamp Date.now() into this
// key, and the dot computation below filters entries created after that
// timestamp. Per-fund (not global) so a parent with multiple kids can
// tend to one fund's Memory Book without clearing the dot for the others.
const MEMORY_LAST_READ_PREFIX = "kiddo.memory.lastReadAt:";
// Custom event the MemoryBook page dispatches after stamping the last-
// read timestamp. The MobileNav listens for it so the dot disappears
// instantly on entering the page, instead of waiting for a re-render
// trigger from elsewhere.
const MEMORY_READ_EVENT = "kiddo:memory-read";

// useMemoryUnreadCount — dot indicator for the Memory tab. Reads the
// active fund's cached entries (populated whenever the parent visits
// the Memory Book) and counts new external-gift / milestone rows
// since the last visit. Scoped narrowly on purpose:
//
//   • Counted: gift_message (new gifts from gifters) + milestone
//     (auto-fired threshold celebrations) entries.
//   • NOT counted: parent-authored notes / photos / parent_note rows.
//     The parent wrote them; they already know. Surfacing them as
//     "unread" would create false alarm dots after every parent edit.
//
// Returns 0 when there's no fundId, no cached entries, or no new
// entries since lastReadAt. Reactive to localStorage writes from the
// Memory Book page (storage event fires on cross-tab + same-tab via
// the MEMORY_READ_EVENT custom event).
export function useMemoryUnreadCount(fundId: string | null | undefined): number {
  const [tick, setTick] = useState(0);
  useEffect(() => {
    if (!fundId) return;
    const handler = () => setTick((t) => t + 1);
    window.addEventListener("storage", handler);
    window.addEventListener(MEMORY_READ_EVENT, handler);
    return () => {
      window.removeEventListener("storage", handler);
      window.removeEventListener(MEMORY_READ_EVENT, handler);
    };
  }, [fundId]);
  return useMemo(() => {
    if (!fundId) return 0;
    const lastReadAt = parseInt(localStorage.getItem(`${MEMORY_LAST_READ_PREFIX}${fundId}`) || "0", 10);
    const cached = readLocalCache<MemoryEntry[]>(`${MEMORY_ENTRIES_CACHE_PREFIX}${fundId}`) || [];
    return cached.filter((e) => {
      if (e.type !== "gift_message" && e.type !== "milestone") return false;
      const ts = e.createdAt ? new Date(e.createdAt).getTime() : NaN;
      return Number.isFinite(ts) && ts > lastReadAt;
    }).length;
    // tick included so the storage / read-event listener forces a recompute
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fundId, tick]);
}

interface MemoryEntry {
  id: string;
  fundId: string;
  giftId: string | null;
  type: string;
  content: string | null;
  authorName: string | null;
  authorPhotoUrl: string | null;
  photoUrl: string | null;
  videoUrl: string | null;
  audioUrl?: string | null;
  visibility?: "public" | "family" | "private";
  isFeatured?: boolean;
  mediaStatus?: "ok" | "external" | "broken" | "none";
  createdAt: string;
  gift?: {
    // Authenticated /api/funds/:fundId/memory endpoint includes id +
    // senderEmail. Required by thankYouStateForGift to differentiate
    // anonymous (no email) vs unthanked (no thank-you record yet) vs
    // self (sender matches owner). Public memory endpoint omits both.
    id?: string;
    senderName: string;
    senderEmail?: string | null;
    amount: string;
    // netAmount + status surfaced 2026-05-15 to align the per-gifter
    // roster sum here with Dashboard's gifterRoster: exclude failed/
    // refunded gifts; prefer netAmount over gross amount (they're
    // equal for typical gifts under locked "no platform fee on gifts"
    // policy; the field exists as the safe fallback). Optional —
    // the public memory endpoint omits these for privacy.
    netAmount?: string | null;
    status?: string | null;
    message: string | null;
    photoUrl: string | null;
    createdAt: string;
    eventName?: string | null;
    eventId?: string | null;
    executionModel?: string | null;
    selectedTicker?: string | null;
    sharesAcquired?: string | null;
    priceAtPurchase?: string | null;
    // Gifter-recurring linkage. Truthy when this gift came from a
    // monthly subscription cycle (vs a one-time gift). Memory Book
    // renders compressed-by-default for these per Decision D
    // (project_gifter_recurring_restoration.md).
    recurringGiftId?: string | null;
    // Parent's recurring auto-invest linkage. Truthy when this gift is a
    // monthly parent auto-invest cycle (vs a gifter's recurring schedule or a
    // one-time gift). Drives compression + self-thank-you suppression.
    parentContributionId?: string | null;
  } | null;
}

const typeConfig: Record<string, { icon: typeof Gift; color: string; dotColor: string; label: string }> = {
  gift_message: { icon: Gift, color: "text-[hsl(var(--kiddo-evergreen))]", dotColor: "bg-[hsl(var(--kiddo-evergreen))]", label: "Gift" },
  milestone: { icon: Star, color: "text-[hsl(var(--kiddo-gold))]", dotColor: "bg-[hsl(var(--kiddo-gold))]", label: "Milestone" },
  photo: { icon: Camera, color: "text-[hsl(var(--kiddo-evergreen)/0.65)]", dotColor: "bg-[hsl(var(--kiddo-evergreen)/0.55)]", label: "Photo" },
  note: { icon: MessageCircle, color: "text-[hsl(var(--kiddo-evergreen))]", dotColor: "bg-[hsl(var(--kiddo-evergreen)/0.50)]", label: "Note" },
  parent_investment_start: { icon: Repeat, color: "text-[hsl(var(--kiddo-evergreen))]", dotColor: "bg-[hsl(var(--kiddo-evergreen))]", label: "Investment started" },
  parent_note: { icon: Heart, color: "text-[hsl(var(--kiddo-gold))]", dotColor: "bg-[hsl(var(--kiddo-gold)/0.75)]", label: "From a parent" },
};

// Gifter avatar rotation palette. Intentional 5-color diversity
// keyed by name hash so visually-similar gifters (e.g. two "Sarahs"
// in the same fund's Memory Book) get distinct avatar tones. These
// rgb literals are NOT brand-palette-aligned by design — they're
// deliberately diverse (evergreen-deep, ochre, deep-blue, plum, red)
// so a 4-up gifter strip reads as 4 distinct people, not a
// monochrome blur. Audit 2026-05-25: kept inline rather than
// migrated to CSS variables because adding 5 new --kiddo-gifter-N
// variables for a single-purpose rotation would be over-engineering.
// If the brand palette ever adds a "diverse avatar" token set, this
// is the migration target.
const GIFTER_COLORS = [
  { bg: "rgb(26,61,43)",   text: "white" },
  { bg: "rgb(161,88,0)",   text: "white" },
  { bg: "rgb(30,80,170)",  text: "white" },
  { bg: "rgb(124,58,130)", text: "white" },
  { bg: "rgb(185,28,28)",  text: "white" },
];
function gifterColor(name: string) {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) >>> 0;
  return GIFTER_COLORS[h % GIFTER_COLORS.length];
}

// ─── Boilerplate / test-pattern message detection ───
// Single source of truth for "is this message text the kind we suppress
// from rendering?" Used everywhere the Memory Book displays a message:
// list view, timeline, book pages. Without this unified helper, each
// surface had its own version (or no version), which let test patterns
// and "auto-invest contribution to..." boilerplate leak into Timeline
// view while being filtered out of Story view.
function isMemoryBookSuppressedMessage(raw: string | null | undefined): boolean {
  const trimmed = String(raw || "").trim();
  if (!trimmed) return true;
  if (/^auto-invest contribution to /i.test(trimmed)) return true;
  if (/^(test|testing|tstgin|tstng|qqqqq|tester)\b/i.test(trimmed)) return true;
  return false;
}

// ─── Unified entry identity ───
// Single source of truth for "who is this entry from + how should the
// avatar render?" Replaces the three drifted versions across Story
// view, Timeline view, and BookPage.
//
// Output guarantees:
//   - Parent entries always show the parent's profile photo (when
//     set) or a consistent evergreen letter avatar; never a random
//     deterministic color from the gifterColor palette
//   - Parent entries display name is "You" by default, "{First} (Dad)"
//     when preferredName is set
//   - Gifter entries get titleCased names + deterministic gifterColor
//   - Anonymous (incl. test-pattern senders) display as "Anonymous"
//     with a "?" avatar at the muted-gold treatment
//
// Test-pattern senders bucket as anonymous to match the rest of the
// surface (deriveMemoryHeaderStats, gifterRoster, thankYouStateForGift).
const TEST_SENDER_NAMES = ["test", "testing", "qqqqq", "tstgin", "tstng", "tester"];
type EntryIdentity = {
  kind: "owner" | "gifter" | "anonymous" | "system";
  displayName: string;
  profileImageUrl: string | null;
  avatarLetter: string;
  // Tailwind style for the avatar background. Owner = evergreen,
  // gifter = deterministic per-name color via gifterColor, anonymous
  // = muted gold, system = gold.
  avatarStyle: "owner" | "gifter" | "anonymous" | "system";
  gifterBg: string | null;
};
function getEntryIdentity(
  entry: { type?: string; gift?: { senderName?: string | null; senderEmail?: string | null } | null; authorName?: string | null },
  ownerCtx: {
    emailLower: string;
    profileImageUrl: string | null;
    preferredName: string | null;
    firstName: string | null;
  },
): EntryIdentity {
  // Milestones are system-authored; render as "Kiddo" with gold treatment.
  if (entry.type === "milestone") {
    return { kind: "system", displayName: "Kiddo", profileImageUrl: null, avatarLetter: "★", avatarStyle: "system", gifterBg: null };
  }
  const isGift = entry.type === "gift_message";
  const rawSender = isGift
    ? String(entry.gift?.senderName || "").trim()
    : String(entry.authorName || "").trim();
  const lcSender = rawSender.toLowerCase();
  const isTestSender = TEST_SENDER_NAMES.includes(lcSender);
  const isAnonSender = !rawSender || /^someone who loves/i.test(rawSender) || lcSender === "anonymous" || isTestSender;
  const senderEmailLower = String(entry.gift?.senderEmail || "").trim().toLowerCase();
  // Owner detection — gift entries match by senderEmail; parent
  // memories (type='note', 'parent_note', 'photo') match by treating
  // the parent as the implicit author when authorName is empty or
  // matches the owner's name shape.
  const isOwnerByEmail = !!ownerCtx.emailLower && senderEmailLower === ownerCtx.emailLower;
  const ownerNameLower = (ownerCtx.firstName || "").toLowerCase();
  const isOwnerByAuthor = !isGift && !!ownerNameLower && lcSender.includes(ownerNameLower);
  const isOwner = isOwnerByEmail || isOwnerByAuthor;

  if (isOwner) {
    const cased = titleCaseName(rawSender) || ownerCtx.firstName || "You";
    const displayName = ownerCtx.preferredName
      ? `${cased} (${ownerCtx.preferredName})`
      : cased;
    return {
      kind: "owner",
      displayName,
      profileImageUrl: ownerCtx.profileImageUrl || null,
      avatarLetter: (cased || "Y").slice(0, 1).toUpperCase(),
      avatarStyle: "owner",
      gifterBg: null,
    };
  }
  if (isAnonSender) {
    return {
      kind: "anonymous",
      displayName: "Anonymous",
      profileImageUrl: null,
      avatarLetter: "?",
      avatarStyle: "anonymous",
      gifterBg: null,
    };
  }
  const named = titleCaseName(rawSender) || "Someone";
  return {
    kind: "gifter",
    displayName: named,
    profileImageUrl: null,
    avatarLetter: named.slice(0, 1).toUpperCase(),
    avatarStyle: "gifter",
    gifterBg: gifterColor(rawSender).bg,
  };
}

function formatDate(dateStr: string) {
  const d = new Date(dateStr);
  // A gift that landed seconds ago reading "May 27, 2026" feels stale — it's
  // the moment, not a calendar fact. Show "Just now" for the first few minutes
  // so a brand-new entry feels brand-new. This is a genuine delight for any
  // real gift the moment it arrives, and it's what makes the demo's just-sent
  // gift read as truly live when the prospect taps through to watch it land.
  // Only fires for fresh past-dated entries (guards against clock-skew future
  // dates); every older entry keeps the exact calendar date.
  const sinceMs = Date.now() - d.getTime();
  if (sinceMs >= 0 && sinceMs < 5 * 60 * 1000) return "Just now";
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" });
}

function formatMoney(value: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(Number.isFinite(value) ? value : 0);
}

function displayAmount(value: string | number | null | undefined) {
  const amount = typeof value === "number" ? value : parseFloat(String(value || "0"));
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: amount >= 1000 ? 0 : 2,
    maximumFractionDigits: amount >= 1000 ? 0 : 2,
  }).format(Number.isFinite(amount) ? amount : 0);
}

function visibilityLabel(value?: "public" | "family" | "private") {
  if (value === "private") return "Private";
  if (value === "family") return "Family only";
  return "Anyone with link";
}

function deriveMemoryHeaderStats(
  entries: MemoryEntry[] | undefined,
  fundData: {
    balance?: string;
    pendingBalance?: string;
    cashBalance?: string;
  } | null | undefined,
) {
  let giftCount = 0;
  const people = new Set<string>();
  // Anonymous senders are distinct humans — each chose anonymity, but each
  // is still ONE person. Deduping them by their generic name ("Someone who
  // loves Emma") collapses 7 separate humans into 1, which under-counts the
  // people who showed up. So for anon gifts we use a per-entry key (the
  // entry id) to keep them as distinct contributors. Named senders still
  // dedup by lowercased name (Mom giving 5 times = 1 person).
  const isAnonName = (name: string) => {
    const n = String(name || "").trim();
    if (!n) return true;
    if (/^someone who loves/i.test(n)) return true;
    if (n.toLowerCase() === "anonymous") return true;
    // Known test-data sender names — patterns developers used while
    // testing the gift flow before isTestUser flagging existed. These
    // shouldn't render as named contributors in production-shaped UI.
    // Bucketing them with anonymous keeps the roster honest without
    // requiring a DB cleanup of historical test rows.
    const lc = n.toLowerCase();
    if (["test", "testing", "qqqqq", "tstgin", "tstng", "tester"].includes(lc)) return true;
    return false;
  };
  // A parent's recurring auto-invest (parentContributionId) shows up as one
  // gift_message per monthly cycle. Count the SCHEDULE once, not each cycle, so
  // the "N gifts" headline isn't inflated by ~36 identical contributions.
  const recurringScheduleIds = new Set<string>();
  for (const entry of entries || []) {
    if (entry.type === "gift_message") {
      const pcId = (entry.gift as any)?.parentContributionId;
      if (pcId) {
        recurringScheduleIds.add(String(pcId));
      } else {
        giftCount += 1;
      }
      const senderName = entry.gift?.senderName || "";
      if (isAnonName(senderName)) {
        people.add(`anon:${entry.id}`);
      } else {
        people.add(senderName.trim().toLowerCase());
      }
    } else if (entry.authorName) {
      people.add(entry.authorName.trim().toLowerCase());
    }
  }
  giftCount += recurringScheduleIds.size;
  const fundValue =
    parseFloat(fundData?.balance || "0") +
    parseFloat(fundData?.pendingBalance || "0") +
    parseFloat(fundData?.cashBalance || "0");
  return {
    people: people.size,
    giftCount,
    fundValue,
  };
}

interface FundEvent {
  id: string;
  name: string;
  description?: string | null;
  imageUrl?: string | null;
  eventType?: string | null;
  eventDate?: string | null;
  giftVolume?: string | null;
  giftCount?: number | null;
  status?: string | null;
  isPermanent?: boolean | null;
}

export default function MemoryBook() {
  const { fundId } = useParams<{ fundId: string }>();
  const [location, setLocation] = useLocation();
  const search = useSearch();
  const queryClient = useQueryClient();
  const { user, isAuthenticated, isLoading: authLoading } = useAuth();
  const isDemoAccount = Boolean((user as any)?.isDemoAccount);
  const { data: subscription } = useSubscription();
  // Honor OS reduced-motion. When set, the heavy slides + zooms in
  // this page become quiet opacity fades. Modal sheets stop sliding
  // 100px from below; the book-page swap stops translating 96px
  // sideways; lightbox stops scaling. Pure opacity remains because
  // it doesn't induce motion sickness.
  // Locked 2026-05-18 per motion audit (Memory Book is the most
  // motion-heavy page in the app and was missing this entirely).
  const prefersReducedMotion = useReducedMotion();

  // Idle-time prefetch of next-likely pages so taps from Memory Book →
  // Dashboard / Activity render from cache instead of triggering a fetch.
  // Mirrors the prefetch effect on Dashboard for symmetry: every primary
  // page pre-warms its likely neighbors during browser idle.
  useEffect(() => {
    if (!fundId || !isAuthenticated) return;
    const cancel = onIdle(() => {
      prefetchDashboard(queryClient, fundId);
      prefetchActivity(queryClient, 50);
    });
    return cancel;
  }, [fundId, isAuthenticated, queryClient]);

  const [eventFilter, setEventFilter] = useState<string | null>(() => {
    if (typeof window === "undefined") return null;
    return new URLSearchParams(search).get("event") || null;
  });
  const [gifterFilter, setGifterFilter] = useState<string | null>(() => {
    if (typeof window === "undefined") return null;
    return new URLSearchParams(search).get("gifter") || null;
  });
  const [showModal, setShowModal] = useState(false);
  // Rotates each modal open. Seeded by Date.now() at open so each session
  // gets a different prompt without re-shuffling mid-edit.
  const [milestonePromptSeed, setMilestonePromptSeed] = useState(0);
  const [editingEntry, setEditingEntry] = useState<MemoryEntry | null>(null);
  const [entryType, setEntryType] = useState<"milestone" | "photo" | "note">("milestone");
  // Rotating prompt for the milestone textarea — picked once per modal open
  // by useMemo seeded on showModal flip. Restrained set, no AI-tone fluff;
  // these are conversational nudges that mirror what real parents write.
  const milestonePrompts = useMemo(() => [
    "First steps!",
    "Lost their first tooth.",
    "First time on a bike.",
    "Said something I want to remember.",
    "Started kindergarten.",
    "Made me laugh today.",
    "Something they did for the first time.",
    "A day worth remembering.",
  ], []);
  const [content, setContent] = useState("");
  const [authorName, setAuthorName] = useState(user?.firstName || "");
  const [photoUrl, setPhotoUrl] = useState("");
  const [videoUrl, setVideoUrl] = useState("");
  const [audioUrl, setAudioUrl] = useState("");
  const [audioTranscript, setAudioTranscript] = useState("");
  // 'Or paste a URL' escape-hatch toggles. The composer's primary
  // photo + video paths are the Upload buttons; the URL paste
  // fields were always-visible escape hatches that doubled the
  // visual density. Hidden behind compact disclosures so the dev-y
  // 'Paste an image URL' field doesn't dominate the form by
  // default. Auto-opens when there's already a URL value (edit
  // flow) so the parent sees what's there. Locked 2026-05-18 per
  // the milestone-composer polish pass.
  const [showPhotoUrlInput, setShowPhotoUrlInput] = useState(false);
  const [showVideoUrlInput, setShowVideoUrlInput] = useState(false);
  // Auto-open the URL inputs when the entry already has a value
  // (e.g. editing an old entry that was created via URL paste).
  useEffect(() => {
    if (photoUrl) setShowPhotoUrlInput(true);
  }, [photoUrl]);
  useEffect(() => {
    if (videoUrl) setShowVideoUrlInput(true);
  }, [videoUrl]);
  const [uploadingAudio, setUploadingAudio] = useState(false);
  const [recordingAudio, setRecordingAudio] = useState(false);
  const [recordingSeconds, setRecordingSeconds] = useState(0);
  // Kid-reveal toggle: when on, this entry is hidden from KidView until the
  // child actually turns 18 (visibility="kid_at_18" on the column). Lets the
  // parent reserve specific entries as the 18th-birthday reveal moment
  // without losing the universal-visibility default for everything else.
  const [saveForBirthday, setSaveForBirthday] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [uploadingVideo, setUploadingVideo] = useState(false);
  const [activeFilter, setActiveFilter] = useState<"all" | "gift_message" | "milestone" | "photo" | "note">("all");
  // Thank-you status filter — only meaningful for gift entries. "all" means
  // no filter; "awaiting" matches both draft + missing; "thanked" matches sent.
  // Lets the parent quickly answer "who haven't I thanked?" without scanning.
  const [thankYouFilter, setThankYouFilter] = useState<"all" | "awaiting" | "thanked" | "drafted">("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedYear, setSelectedYear] = useState<"all" | string>("all");
  const [featuredOnly, setFeaturedOnly] = useState(false);
  // "More filters" disclosure — three primary chips (All / Pinned /
  // Awaiting) live at the surface. Gifts / Milestones / Photos / Notes
  // type filters and the full Drafted / Thanked thanks-status options
  // live behind this collapsed disclosure. Rule of Three at the
  // surface, full power on demand.
  const [moreFiltersOpen, setMoreFiltersOpen] = useState(false);
  const [visibleCount, setVisibleCount] = useState(10);
  const [viewMode, setViewMode] = useState<"story" | "timeline">("story");
  // Lightbox for full-resolution media viewing. List-view photo / video
  // entries render as compact previews (max ~220px tall) so they don't
  // dominate the surface — tapping the preview opens the asset at full
  // resolution in a fixed-position overlay. The Book View is the
  // primary "see this big" surface, but inside the list view this
  // gives parents a way to view the actual photo without leaving the
  // current scroll position.
  const [lightboxMedia, setLightboxMedia] = useState<{ kind: "image" | "video"; url: string } | null>(null);
  useEffect(() => {
    if (!lightboxMedia) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setLightboxMedia(null); };
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener("keydown", onKey);
    };
  }, [lightboxMedia]);

  // Book view — full-screen ceremony surface. Each entry becomes a single
  // page; navigation is swipe / arrow / dot. Distinct from the inline
  // list views because it owns the entire viewport — the parent (or
  // Emma at 18) reads cover-to-cover, not scans. Stored as a separate
  // state from viewMode because it's modal, not inline.
  const [bookOpen, setBookOpen] = useState(false);
  const [bookPageIndex, setBookPageIndex] = useState(0);
  const [bookSlideDirection, setBookSlideDirection] = useState(0);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [retryFile, setRetryFile] = useState<File | null>(null);
  const [visibility, setVisibility] = useState<"public" | "family" | "private">("public");
  const [isFeatured, setIsFeatured] = useState(false);
  // "More options" disclosure for the composer. Holds Pin-this-memory
  // (only real toggle inside today). The pin can also be flipped from
  // the entry's row menu after creation, so front-loading it on the
  // composer added a row most parents didn't touch on first capture.
  // Default collapsed; opens automatically when editing an already-
  // pinned entry so the existing state stays visible.
  const [showMoreOptions, setShowMoreOptions] = useState(false);
  const [shareOpen, setShareOpen] = useState(false);
  const [shareMessage, setShareMessage] = useState("");
  const [sharePhotoUrl, setSharePhotoUrl] = useState("");
  // Photo-upload state for the share-update composer. Previously the
  // composer had a raw text input asking for a photo URL — user-flagged
  // 2026-05-20: "most people are not using a photo url, no?" Real parents
  // have photos on their camera roll, not URLs handy. Replaced the URL
  // text input with a file picker that uploads to the existing
  // /api/funds/:fundId/memory/upload-photo endpoint and stores the
  // returned URL in sharePhotoUrl state. The submit handler already
  // accepts the URL, so no server-side change needed.
  const [sharePhotoUploading, setSharePhotoUploading] = useState(false);
  const [sharePhotoError, setSharePhotoError] = useState<string | null>(null);
  const sharePhotoInputRef = useRef<HTMLInputElement | null>(null);
  const [lastShareUrl, setLastShareUrl] = useState("");
  // Two-step share flow: compose the message, then confirm who it goes to
  // before firing. The mutation isn't called until the parent acks the
  // recipient list — emails to real grandparents shouldn't be one-click.
  const [shareStep, setShareStep] = useState<"compose" | "confirm">("compose");

  // Thank-you composer
  const [composerGiftId, setComposerGiftId] = useState<string | null>(null);
  const [composerTone, setComposerTone] = useState<"warm" | "brief" | "formal" | "custom">("warm");
  // Portfolio context for the thank-you draft — populated at
  // openComposer time so the draft can specialize: "Your $250 is
  // invested in Google and now worth $267.50." Without it the draft
  // falls back to the warm-but-generic version. Defaults to empty so
  // every existing call site still works without context.
  const [composerContext, setComposerContext] = useState<{
    ticker?: string | null;
    currentValue?: number | null;
  }>({});
  // Preview step — parent reviews how the gifter will receive the note
  // before sending. Compose → preview → send → toast. Reduces accidental
  // sends with a typo or wrong name baked in.
  const [composerStep, setComposerStep] = useState<"compose" | "preview">("compose");
  const [composerMessage, setComposerMessage] = useState("");
  const [sendingThankYou, setSendingThankYou] = useState(false);

  // Bulk thank-you composer — added 2026-05-25 to close the gifter-thanks
  // audit gap. When a gifter has multiple gifts awaiting thanks, the
  // existing per-gift composer forces N separate emails. The bulk
  // composer lets the parent send ONE consolidated thank-you covering
  // every pending gift from that gifter. Surfaces only when the
  // ?gifter=NAME filter is active AND the gifter has >= 2 awaiting
  // thanks; per-gift composer still works for one-off cases.
  const [bulkComposerOpen, setBulkComposerOpen] = useState(false);
  const [bulkComposerTone, setBulkComposerTone] = useState<"warm" | "brief" | "formal" | "custom">("warm");
  const [bulkComposerMessage, setBulkComposerMessage] = useState("");
  const [sendingBulkThankYou, setSendingBulkThankYou] = useState(false);
  const [coverageReturnNotice, setCoverageReturnNotice] = useState<{
    type: "success" | "canceled";
    title: string;
    description: string;
  } | null>(null);
  const photoInputRef = useRef<HTMLInputElement>(null);
  const videoInputRef = useRef<HTMLInputElement>(null);
  const audioInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      setLocation(`/login?redirect=${encodeURIComponent(location)}`);
    }
  }, [authLoading, isAuthenticated, location, setLocation]);

  const { data: rawMemoryEntries = [], isLoading } = useQuery<MemoryEntry[]>({
    queryKey: ["memory", fundId],
    queryFn: async () => {
      const res = await fetch(`/api/funds/${fundId}/memory`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch memories");
      const data = await res.json();
      writeLocalCache(`${MEMORY_ENTRIES_CACHE_PREFIX}${fundId}`, data);
      return data;
    },
    enabled: !!fundId && isAuthenticated && !authLoading,
    initialData: () => (fundId ? readLocalCache<MemoryEntry[]>(`${MEMORY_ENTRIES_CACHE_PREFIX}${fundId}`) : undefined),
    initialDataUpdatedAt: 0,
    staleTime: MEMORY_ACTIVE_STALE_MS,
    refetchInterval: MEMORY_LIVE_REFRESH_MS,
    refetchIntervalInBackground: false,
    refetchOnWindowFocus: true,
    refetchOnReconnect: true,
  });

  // Pending-review tray. Empty unless the parent has flipped the moderation
  // toggle in Settings. Surfaces gifter entries that need a thumbs-up before
  // they show up in the main Memory Book. Default off everywhere — most
  // funds will get an empty array and the tray won't render.
  const { data: pendingEntries = [] } = useQuery<MemoryEntry[]>({
    queryKey: ["memory", fundId, "pending"],
    queryFn: async () => {
      const res = await fetch(`/api/funds/${fundId}/memory/pending`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch pending memories");
      return res.json();
    },
    enabled: !!fundId && isAuthenticated && !authLoading,
    staleTime: MEMORY_ACTIVE_STALE_MS,
    refetchInterval: MEMORY_LIVE_REFRESH_MS,
    refetchIntervalInBackground: false,
    refetchOnWindowFocus: true,
    refetchOnReconnect: true,
  });

  const approvePendingEntry = useMutation({
    mutationFn: async (entryId: string) => {
      const res = await fetch(`/api/memory/${entryId}/approve`, {
        method: "POST",
        credentials: "include",
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data?.error || "Could not approve");
      }
      return res.json();
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["memory", fundId] });
      void queryClient.invalidateQueries({ queryKey: ["memory", fundId, "pending"] });
    },
    onError: (error: any) => {
      toast({ title: "Could not approve", description: error?.message || "Please try again.", variant: "destructive" });
    },
  });

  const rejectPendingEntry = useMutation({
    mutationFn: async (entryId: string) => {
      const res = await fetch(`/api/memory/${entryId}`, {
        method: "DELETE",
        credentials: "include",
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data?.error || "Could not delete");
      }
      return res.json().catch(() => ({}));
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["memory", fundId] });
      void queryClient.invalidateQueries({ queryKey: ["memory", fundId, "pending"] });
    },
    onError: (error: any) => {
      toast({ title: "Could not delete", description: error?.message || "Please try again.", variant: "destructive" });
    },
  });

  // Dedupe gift_message entries by giftId. The DB occasionally has two memory
  // entries for the same gift (race condition between the gift webhook's
  // ensureMemoryEntryForGift and other create paths, or webhook retries that
  // beat the dedup check). Was visible to users as the same gift showing
  // twice in the Memory Book Story view, AND as a 17-vs-16 mismatch between
  // the Memory Book header count and the hero's "16 gifts" count. Dedup
  // here keeps the FIRST entry per giftId; non-gift entries (parent letters,
  // milestones, sealed_letters, etc.) pass through unchanged. Conservative —
  // two real separate gifts with different giftIds aren't affected.
  const entries = useMemo(() => {
    // Defensive: if the /api/funds/:id/memory query errors out
    // (500, network drop), rawMemoryEntries is undefined. Returning
    // `undefined as MemoryEntry[]` here made every downstream
    // `for (const e of entries)` throw "entries is not iterable",
    // which crashed the MemoryBook page into AppErrorBoundary.
    // Always return an array — empty when there's no data. Caught
    // alongside the DesktopSidebar.tsx:93 hardening during the
    // 2026-05-14 schema-DB-drift incident, same shape: API
    // failure -> undefined data -> iteration crash -> ErrorBoundary.
    const seenGiftIds = new Set<string>();
    const base = (!Array.isArray(rawMemoryEntries) || rawMemoryEntries.length === 0)
      ? ([] as MemoryEntry[])
      : rawMemoryEntries.filter((e) => {
          const isGiftMessage = e?.type === "gift_message";
          const giftId = (e as any)?.giftId ? String((e as any).giftId) : null;
          if (isGiftMessage && giftId) {
            if (seenGiftIds.has(giftId)) return false;
            seenGiftIds.add(giftId);
          }
          return true;
        });
    // Demo-only: surface the gift the prospect just role-played SENDING as a
    // fresh "just now" entry so they watch it land (lib/demo-live-gifts.ts).
    // Session-scoped, never persisted to the shared demo. giftId stays null so
    // it skips the giftId-dedupe above and a now-dated createdAt floats it to
    // the top of the timeline.
    const liveDemo = readDemoLiveGiftsForFund(fundId, isDemoAccount).map((g, i): MemoryEntry => ({
      id: `demo-live-${i}-${g.createdAt}`,
      fundId: String(fundId),
      giftId: null,
      type: "gift_message",
      content: g.message ?? null,
      authorName: g.senderName,
      authorPhotoUrl: null,
      photoUrl: null,
      videoUrl: null,
      audioUrl: null,
      visibility: "public",
      createdAt: g.createdAt,
      gift: {
        senderName: g.senderName,
        amount: String(g.amount),
        message: g.message ?? null,
        photoUrl: null,
        createdAt: g.createdAt,
        selectedTicker: g.ticker || null,
        executionModel: g.ticker ? "pick" : "auto",
      },
    }));
    return liveDemo.length ? [...liveDemo, ...base] : base;
  }, [rawMemoryEntries, fundId, isDemoAccount]);

  const { data: fundData } = useQuery<{
    name: string;
    recipientFirstName?: string;
    balance?: string;
    pendingBalance?: string;
    cashBalance?: string;
    userId?: number | string;
    createdAt?: string;
    recipientBirthdate?: string | null;
    majorityAge?: number;
    childPhotoUrl?: string | null;
  }>({
    queryKey: ["fund", fundId],
    queryFn: async () => {
      const res = await fetch(`/api/funds/${fundId}`, { credentials: "include" });
      if (!res.ok) return { name: "Fund" };
      const data = await res.json();
      writeLocalCache(`${MEMORY_FUND_CACHE_PREFIX}${fundId}`, data);
      return data;
    },
    enabled: !!fundId && isAuthenticated && !authLoading,
    initialData: () => (fundId ? readLocalCache<any>(`${MEMORY_FUND_CACHE_PREFIX}${fundId}`) : undefined),
    initialDataUpdatedAt: 0,
    staleTime: MEMORY_ACTIVE_STALE_MS,
    refetchInterval: MEMORY_LIVE_REFRESH_MS * 2,
    refetchIntervalInBackground: false,
    refetchOnWindowFocus: true,
    refetchOnReconnect: true,
  });

  // Sealed letter — the parent's note to the kid, sealed until age of
  // majority. One row per fund (server-side upsert). The book view
  // renders this as a wax-seal page near the end with a countdown to
  // the kid's birthday. Parent can always click to read/edit. The kid
  // surface respects visibility='kid_at_18' so they only see the
  // letter after they turn 18 (or whatever majorityAge the fund locked
  // in at creation).
  const { data: sealedLetter } = useQuery<{
    id: string;
    content: string | null;
    authorName: string | null;
    authorPhotoUrl: string | null;
    createdAt: string;
  } | null>({
    queryKey: ["sealed-letter", fundId],
    queryFn: async () => {
      const res = await fetch(`/api/funds/${fundId}/sealed-letter`, { credentials: "include" });
      if (!res.ok) return null;
      return res.json();
    },
    enabled: !!fundId && isAuthenticated && !authLoading,
    staleTime: 30_000,
  });

  const upsertSealedLetterMutation = useMutation({
    mutationFn: async (content: string) => {
      const res = await fetch(`/api/funds/${fundId}/sealed-letter`, {
        method: "PUT",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content }),
      });
      if (!res.ok) throw new Error("Failed to save sealed letter");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["sealed-letter", fundId] });
    },
  });

  // Sealed letter editor modal state. Opens from the book view's
  // sealed page when the parent clicks "Write" / "Edit." Stores the
  // draft locally until save — server is source of truth on save.
  const [sealedEditorOpen, setSealedEditorOpen] = useState(false);
  const [sealedDraft, setSealedDraft] = useState("");
  const [sealedSaving, setSealedSaving] = useState(false);

  // Collect unique pick tickers so we can show share estimates on gift cards
  const giftTickerSymbols = useMemo(() => {
    const tickers = new Set<string>();
    for (const e of entries) {
      if (e.type === "gift_message" && e.gift?.selectedTicker) {
        tickers.add(e.gift.selectedTicker.toUpperCase());
      }
    }
    return Array.from(tickers).join(",");
  }, [entries]);

  const { data: giftQuoteData } = useQuery<{ quotes: Array<{ symbol: string; price: number }> }>({
    queryKey: ["memory-gift-quotes", giftTickerSymbols],
    queryFn: async () => {
      const res = await fetch(`/api/market/quotes?symbols=${encodeURIComponent(giftTickerSymbols)}`, { credentials: "include" });
      if (!res.ok) return { quotes: [] };
      return res.json();
    },
    enabled: !!giftTickerSymbols && isAuthenticated,
    staleTime: 5 * 60 * 1000,
  });

  const giftPriceByTicker = useMemo(() => {
    const map = new Map<string, number>();
    for (const q of giftQuoteData?.quotes ?? []) {
      if (q.symbol && q.price > 0) map.set(q.symbol.toUpperCase(), q.price);
    }
    return map;
  }, [giftQuoteData]);

  // fundEvents drives the "Emma's occasions" strip at the top of
  // the Memory Book. Returning users see their occasion tiles
  // instantly via initialData; the 5-minute staleTime prevents
  // a refetch on every component mount (occasions don't change
  // minute to minute, and any explicit mutation invalidates the
  // query). Without this trio the strip rendered empty during
  // load and then populated when the network resolved — visible
  // "popping in" the user flagged 2026-05-20.
  const { data: fundEvents = [] } = useQuery<FundEvent[]>({
    queryKey: ["fund-events", fundId],
    queryFn: async () => {
      const res = await fetch(`/api/funds/${fundId}/events`, { credentials: "include" });
      if (!res.ok) return [];
      const data = await res.json();
      const filtered = data.filter((e: FundEvent) => !e.status || e.status !== "permanent");
      if (fundId) {
        writeLocalCache(`${MEMORY_EVENTS_CACHE_PREFIX}${fundId}`, filtered);
      }
      return filtered;
    },
    enabled: !!fundId && isAuthenticated && !authLoading,
    initialData: () => (fundId ? readLocalCache<FundEvent[]>(`${MEMORY_EVENTS_CACHE_PREFIX}${fundId}`) : undefined),
    initialDataUpdatedAt: 0,
    staleTime: 5 * 60 * 1000,
  });

  // Per-fund thank-yous cache: same pattern. Thank-you state is
  // read-heavy and rarely changes inside a single session; mutations
  // (sending a thank-you, marking one as sent) invalidate the query
  // explicitly so the cache stays accurate for actionable events.
  const { data: thankYouList = [], refetch: refetchThankYous } = useQuery<any[]>({
    queryKey: ["thank-yous", fundId],
    queryFn: async () => {
      const res = await fetch(`/api/funds/${fundId}/thank-yous`, { credentials: "include" });
      if (!res.ok) return [];
      const data = await res.json();
      if (fundId) {
        writeLocalCache(`${MEMORY_THANK_YOUS_CACHE_PREFIX}${fundId}`, data);
      }
      return data;
    },
    enabled: !!fundId && isAuthenticated && !authLoading,
    initialData: () => (fundId ? readLocalCache<any[]>(`${MEMORY_THANK_YOUS_CACHE_PREFIX}${fundId}`) : undefined),
    initialDataUpdatedAt: 0,
    staleTime: 5 * 60 * 1000,
  });

  // Powers the share-update confirmation step: who actually receives this
  // (subscribers filtered to opted-in), how many they are, and how many
  // shares the parent has used out of the 4/year cap. Lives at fund scope
  // so each fund's gifter list + counter is independent.
  const { data: gifterNotificationsData, refetch: refetchGifterNotifications } = useQuery<{
    optedInCount: number;
    subscribers: Array<{ email: string; name?: string | null; unsubscribed?: boolean }>;
    settings?: { memoryBookSharesSentThisYear?: number };
  }>({
    queryKey: ["gifter-notifications", fundId],
    queryFn: async () => {
      const res = await fetch(`/api/funds/${fundId}/gifter-notifications`, { credentials: "include" });
      if (!res.ok) throw new Error("could not load");
      return res.json();
    },
    enabled: !!fundId && isAuthenticated && !authLoading,
    staleTime: 30_000,
  });

  const optedInGifters = useMemo(() => {
    return (gifterNotificationsData?.subscribers || [])
      .filter((s) => !s.unsubscribed)
      .map((s) => ({ name: (s.name || "").trim() || s.email.split("@")[0], email: s.email }));
  }, [gifterNotificationsData?.subscribers]);
  const optedInCount = gifterNotificationsData?.optedInCount ?? optedInGifters.length;
  const sharesUsedThisYear = Number(gifterNotificationsData?.settings?.memoryBookSharesSentThisYear ?? 0);
  const SHARES_PER_YEAR_CAP = 4;
  const sharesRemaining = Math.max(0, SHARES_PER_YEAR_CAP - sharesUsedThisYear);

  // Past Memory Book shares for this fund — what the parent sent before, when,
  // to how many. Surfaced in the share modal so they can see their history
  // and re-grab a share link if needed. Server returns newest-first.
  const { data: pastSharesData, refetch: refetchPastShares } = useQuery<{
    shares: Array<{
      token: string;
      message: string;
      photoUrl: string | null;
      recipientCount: number;
      createdAt: string;
      shareUrl: string;
    }>;
  }>({
    queryKey: ["gifter-memory-shares", fundId],
    queryFn: async () => {
      const res = await fetch(`/api/funds/${fundId}/gifter-notifications/memory-shares`, { credentials: "include" });
      if (!res.ok) return { shares: [] };
      return res.json();
    },
    // Always-on (when authenticated) so the count is available on the
    // Memory Book page itself — used by the "Share update · X sent" badge
    // — without needing the modal to be open. Cheap query (≤4 rows).
    enabled: !!fundId && isAuthenticated && !authLoading,
    staleTime: 60_000,
  });
  // Filter test-pattern updates from the past-shares list. Same
  // allowlist as the Memory Book entry filter, the server-side guard,
  // and the Activity feed filter — single rule across all four
  // surfaces. A parent who QA'd the composer with "aaaaaaa", "rrrrrr",
  // or "test test test" produced share rows that would otherwise sit
  // in the "Updates you've sent" history forever, and bias the "X of
  // 4 sent this year" cap counter against actual broadcasts.
  const pastShares = (pastSharesData?.shares || []).filter((share) => {
    const message = String(share.message || "").trim();
    if (!message) return false;
    if (/^(test|testing|tstgin|tstng|qqqqq|tester)\b/i.test(message)) return false;
    if (/^auto-invest contribution to /i.test(message)) return false;
    // Single-letter QA filler ("aaaaa", "rrrrrrr", "ggggg") — three or
    // more of the same character with nothing else.
    const compact = message.replace(/\s+/g, "");
    if (/^([a-z])\1{2,}$/i.test(compact)) return false;
    return true;
  });
  const [expandedPastShareToken, setExpandedPastShareToken] = useState<string | null>(null);
  const [copiedShareToken, setCopiedShareToken] = useState<string | null>(null);

  const thankYouByGiftId = useMemo(() => {
    const map = new Map<string, any>();
    for (const ty of thankYouList) {
      if (ty.giftId) map.set(String(ty.giftId), ty);
    }
    return map;
  }, [thankYouList]);

  // Per-gift thank-you state for gift cards: ✓ Thanked / ⏳ Awaiting / ✨ From you / etc.
  // Suppressed for anonymous (can't be reached) and senders without an email.
  const ownerEmailLowerForMemory = String(user?.email || "").trim().toLowerCase();
  const thankYouStateForGift = (gift: any): "sent" | "draft" | "missing" | "self" | "anonymous" => {
    const senderEmail = String(gift?.senderEmail || "").trim().toLowerCase();
    const senderName = String(gift?.senderName || "").trim();
    const lcSender = senderName.toLowerCase();
    // Test-pattern senders bucket into anonymous for the same reason
    // they do in the display layer: they're dev artifacts, not real
    // gifters who can be thanked. Without this, the row would render
    // as "Anonymous" (display override) but the filter would treat it
    // as "missing" — the parent would see an anonymous-looking entry
    // appear under Awaiting, which can't be acted on. Same predicate
    // shape as deriveMemoryHeaderStats and the gifterRoster aggregate.
    const isTestSender = ["test", "testing", "qqqqq", "tstgin", "tstng", "tester"].includes(lcSender);
    const isAnon = !senderName || /^someone who loves/i.test(senderName) || lcSender === "anonymous" || isTestSender;
    if (!!ownerEmailLowerForMemory && senderEmail === ownerEmailLowerForMemory) return "self";
    if (isAnon || !senderEmail) return "anonymous";
    const ty = gift?.id ? thankYouByGiftId.get(String(gift.id)) : null;
    if (ty?.status === "sent") return "sent";
    if (ty) return "draft";
    return "missing";
  };

  const ownerName = `${user?.firstName || ""} ${user?.lastName || ""}`.trim() || "The family";
  const myAuthorName = ((user as any)?.preferredName?.trim() || ownerName || "A parent").toLowerCase();
  const displayAuthor = (name: string | null | undefined, fallback = "Parent") => {
    if (!name) return fallback;
    return name.trim().toLowerCase() === myAuthorName ? `${name} (you)` : name;
  };

  function buildThankYouMessage(
    tone: "warm" | "brief" | "formal" | "custom",
    senderName: string,
    amount: string,
    ctx?: { ticker?: string | null; currentValue?: number | null }
  ): string {
    if (tone === "custom") return "";
    const fmt = `$${parseFloat(amount || "0").toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    const child = childName || "our child";
    // Capitalize at composition time — the gifter typing "grandpa"
    // shouldn't produce "Dear grandpa,". Defensive: every salutation
    // and inline reference uses the cased name.
    const name = titleCaseName(senderName) || senderName;
    // Portfolio specificity — when the gift has a ticker AND a
    // computed current value, weave it into the draft. This is the
    // "Memory Book energy applied to the thank-you" beat: not "thank
    // you for the money," but "thank you for the company name and the
    // dollar amount that grew to this dollar amount." Without ctx, the
    // draft falls back to the warm-but-generic copy. Never fabricate
    // numbers — the sentence only renders when both pieces are real.
    const tickerCo = ctx?.ticker ? ctx.ticker.toUpperCase() : null;
    const valueNow =
      typeof ctx?.currentValue === "number" && Number.isFinite(ctx.currentValue) && ctx.currentValue > 0
        ? `$${ctx.currentValue.toFixed(2)}`
        : null;
    const portfolioSentenceWarm = tickerCo && valueNow
      ? ` It's invested in ${tickerCo} and now worth ${valueNow}.`
      : "";
    const portfolioSentenceBrief = tickerCo && valueNow
      ? ` ${tickerCo} now worth ${valueNow}.`
      : "";
    const portfolioSentenceFormal = tickerCo && valueNow
      ? ` Your gift was allocated to ${tickerCo} and is currently valued at ${valueNow}.`
      : "";
    switch (tone) {
      case "warm":
        return `Dear ${name},\n\nThank you so much for your ${fmt} gift to ${child}'s fund.${portfolioSentenceWarm} It means more than you know: not just the investment itself, but the fact that you showed up for ${child}'s future.\n\n${child} will read this one day.\n\nWith love,\n${ownerName}`;
      case "brief":
        return `Hi ${name},\n\nThank you for the ${fmt} gift to ${child}'s fund.${portfolioSentenceBrief} We really appreciate it!\n\nWith gratitude,\n${ownerName}`;
      case "formal":
        return `Dear ${name},\n\nWe are writing to express our sincere gratitude for your generous gift of ${fmt} to ${child}'s fund.${portfolioSentenceFormal} Your thoughtfulness is deeply appreciated.\n\nSincerely,\n${ownerName}`;
    }
  }

  const openComposer = (
    giftId: string,
    ty: any | undefined,
    senderName: string,
    amount: string,
    ctx?: { ticker?: string | null; currentValue?: number | null }
  ) => {
    setComposerGiftId(giftId);
    setComposerTone("warm");
    setComposerContext(ctx ?? {});
    setComposerMessage(ty?.message || buildThankYouMessage("warm", senderName, amount, ctx));
    setComposerStep("compose");
    haptic("selection");
  };

  // Bulk thank-you message builder. Different shape than the per-gift
  // version — enumerates the gifts rather than referencing just one.
  // Example warm-tone output:
  //
  //   Dear Grandpa,
  //
  //   Thank you so much for the 6 gifts you sent to Emma's fund this
  //   year, $2,400 in total. Whether you knew it or not, each one of
  //   them added up to something real Emma will read about when she's
  //   18. It means more than you know — not just the money but the
  //   fact that you keep showing up for her.
  //
  //   With love,
  //   Sarah
  //
  // Tone selection mirrors the per-gift composer. The 'custom' tone
  // returns an empty string and the textarea is the parent's blank
  // canvas.
  function buildBulkThankYouMessage(
    tone: "warm" | "brief" | "formal" | "custom",
    senderName: string,
    pendingGifts: Array<{ amount: string; createdAt?: string | null }>,
  ): string {
    if (tone === "custom") return "";
    const count = pendingGifts.length;
    const totalAmount = pendingGifts.reduce((sum, g) => sum + (parseFloat(String(g.amount || "0")) || 0), 0);
    const fmtTotal = `$${totalAmount.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    const child = childName || "our child";
    const name = titleCaseName(senderName) || senderName;
    switch (tone) {
      case "warm":
        return `Dear ${name},\n\nThank you so much for the ${count} gifts you sent to ${child}'s fund, ${fmtTotal} in total. Each one of them is a real investment ${child} will read about one day. It means more than you know: not just the money but the fact that you keep showing up for ${child}.\n\nWith love,\n${ownerName}`;
      case "brief":
        return `Hi ${name},\n\nThank you for the ${count} gifts to ${child}'s fund (${fmtTotal} total). We really appreciate your generosity.\n\nWith gratitude,\n${ownerName}`;
      case "formal":
        return `Dear ${name},\n\nWe are writing to express our sincere gratitude for the ${count} gifts you have made to ${child}'s fund, totaling ${fmtTotal}. Your continued support is deeply appreciated.\n\nSincerely,\n${ownerName}`;
    }
  }

  // Send the bulk thank-you. Marks all the gifter's pending thank-you
  // rows on this fund as 'sent' in a single atomic request, sends ONE
  // consolidated email, and refreshes the local cache.
  const handleSendBulkThankYou = async (ids: string[]) => {
    if (sendingBulkThankYou || ids.length === 0 || !bulkComposerMessage.trim()) return;
    setSendingBulkThankYou(true);
    try {
      const res = await fetch(`/api/funds/${fundId}/thank-yous/bulk-send`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ thankYouIds: ids, message: bulkComposerMessage }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body?.error || `HTTP ${res.status}`);
      }
      const data = await res.json();
      if (data?.deliveryUrl) {
        window.open(data.deliveryUrl, "_blank");
      }
      await refetchThankYous();
      setBulkComposerOpen(false);
      setBulkComposerMessage("");
      setBulkComposerTone("warm");
      haptic("success");
      toast({
        title: `Thanked ${ids.length} gifts at once`,
        description: data?.totalGiftAmount
          ? `Single email sent covering $${Number(data.totalGiftAmount).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} of giving.`
          : "Single email sent covering every pending gift from this gifter.",
      });
    } catch (err) {
      haptic("error");
      toast({
        title: "Could not send bulk thank-you",
        description: err instanceof Error ? err.message : "Try again.",
        variant: "destructive",
      });
    }
    setSendingBulkThankYou(false);
  };

  const handleSendThankYou = async (ty: any) => {
    if (!ty || sendingThankYou) return;
    setSendingThankYou(true);
    try {
      await fetch(`/api/funds/${fundId}/thank-yous/${ty.id}`, {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: composerMessage }),
      });
      const res = await fetch(`/api/funds/${fundId}/thank-yous/${ty.id}/send`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
      });
      const data = await res.json();
      // Two outcome paths from the server:
      //   1. deliveryUrl present → backend sent (or queued an email
      //      delivery); we open it as a confirmation receipt or a
      //      mailto: backup. Toast says "sent."
      //   2. copiedText present → no email on file, server returned the
      //      message text for clipboard. Toast says "copied" so the
      //      parent knows to paste it somewhere themselves.
      // Was previously: unconditional "Thank-you sent" toast even when
      // the action was actually copy-to-clipboard. Misleading.
      let outcome: "sent" | "copied" | "unknown" = "unknown";
      if (data.deliveryUrl) {
        window.open(data.deliveryUrl, "_blank");
        outcome = "sent";
      } else if (data.copiedText) {
        await navigator.clipboard.writeText(data.copiedText).catch(() => {});
        outcome = "copied";
      }
      await refetchThankYous();
      setComposerGiftId(null);
      haptic("success");
      if (outcome === "copied") {
        toast({ title: "Copied to clipboard", description: "Paste it wherever you'd like to send it." });
      } else {
        toast({ title: "Thank-you sent" });
      }
    } catch {
      toast({ title: "Could not send thank-you", variant: "destructive" });
    }
    setSendingThankYou(false);
  };

  // Sync eventFilter when URL search param changes
  useEffect(() => {
    const param = new URLSearchParams(search).get("event");
    if (param) setEventFilter(param);
  }, [search]);

  // Scroll to and highlight a specific gift when ?gift= is in the URL.
  //
  // The hard constraints this effect juggles:
  //   1. Target may not be in the FIRST entries snapshot (cached data is
  //      stale; the freshly-made gift only arrives in the network response).
  //      So we MUST re-evaluate on every entries change.
  //   2. Once polling has started looking for the target, we must NOT cancel
  //      it just because entries got a new reference — otherwise the 15s
  //      refetch tick (or the cache→network swap) kills our own scroll
  //      mid-flight and the user lands at the top.
  //   3. After we successfully scrolled, we must NOT re-fire on subsequent
  //      entries refetches — otherwise the page tugs back to the highlighted
  //      row whenever the parent is browsing.
  //   4. Pagination ("Load more memories") slices entries by visibleCount.
  //      Target may be index 47 in a list defaulted to 10 visible — must
  //      bump visibleCount BEFORE polling so the row exists in the DOM.
  const [highlightedEntryId, setHighlightedEntryId] = useState<string | null>(null);
  const handledDeepLinkRef = useRef<string | null>(null);
  // Holds the cancel function of the polling currently in flight, tagged
  // with WHICH deep-link key it's hunting for. We do NOT return this from
  // the effect (which would cancel it on every re-run); we ONLY call it
  // on unmount or when the user clicks a DIFFERENT deep-link mid-poll.
  // This is the key trick — polling once started runs to completion across
  // re-renders, but a fresh deep-link supersedes an in-flight one.
  const inFlightScrollRef = useRef<{ key: string; cancel: () => void } | null>(null);
  useEffect(() => {
    return () => {
      inFlightScrollRef.current?.cancel();
      inFlightScrollRef.current = null;
    };
  }, []);
  useEffect(() => {
    if (entries.length === 0) return;
    const params = new URLSearchParams(search);
    const giftParam = params.get("gift");
    const gifterParam = params.get("gifter");
    // ?highlight= matches the entry's own id directly. Used for memory
    // entries that aren't tied to a gift (parent notes, milestones, photos)
    // — e.g., notifications about a milestone activity deep-link by entry id
    // since there's no gift to anchor on.
    const highlightParam = params.get("highlight");

    const deepLinkKey = giftParam
      ? `gift:${giftParam}`
      : gifterParam
        ? `gifter:${gifterParam}`
        : highlightParam
          ? `highlight:${highlightParam}`
          : null;
    if (!deepLinkKey) {
      handledDeepLinkRef.current = null;
      return;
    }
    if (handledDeepLinkRef.current === deepLinkKey) return;
    if (inFlightScrollRef.current) {
      if (inFlightScrollRef.current.key === deepLinkKey) return;
      inFlightScrollRef.current.cancel();
      inFlightScrollRef.current = null;
    }

    let target: typeof entries[number] | undefined;
    if (giftParam) {
      target = entries.find(e => String(e.giftId) === giftParam);
    } else if (gifterParam) {
      const needle = gifterParam.trim().toLowerCase();
      target = entries.find(e => (e.gift?.senderName || "").trim().toLowerCase() === needle);
    } else if (highlightParam) {
      target = entries.find(e => String(e.id) === highlightParam);
    }
    if (!target) return;

    // Reset filters that would hide the target. Without this, the row gets
    // filtered out of visibleEntries, the querySelector below returns null,
    // and the user lands on the page with nothing scrolled.
    if (giftParam || highlightParam) {
      setGifterFilter(null);
      setEventFilter(null);
      setFeaturedOnly(false);
      setSelectedYear("all");
      setActiveFilter("all");
      setSearchQuery("");
      setThankYouFilter("all");
    } else if (gifterParam) {
      setGifterFilter(gifterParam);
      setEventFilter(null);
      setFeaturedOnly(false);
      setSelectedYear("all");
      setActiveFilter("all");
      setSearchQuery("");
      setThankYouFilter("all");
    }

    setHighlightedEntryId(String(target.id));
    setVisibleCount(c => Math.max(c, entries.length));

    // If we navigated here to "finish thank-you" for a specific gift, also
    // auto-open the inline composer at that gift. Without this, the user
    // lands on the entry but has to spot and click "Say thanks" to actually
    // do the thing — that's the "lands in random place" complaint.
    if (giftParam && target.giftId && target.gift) {
      const tyState = thankYouStateForGift(target.gift);
      if (tyState === "draft" || tyState === "missing") {
        const tyForGift = thankYouByGiftId.get(String(target.giftId));
        const senderName = String(target.gift.senderName || "").trim() || "your gifter";
        const amount = String(target.gift.amount || "");
        // Portfolio context for the deep-link composer open — same
        // shape as the inline thank-you button. Lets the deep-link
        // version of the draft be just as specific as the in-feed one.
        const dlTicker = target.gift.selectedTicker?.toUpperCase() ?? null;
        const dlPrice = dlTicker ? giftPriceByTicker.get(dlTicker) : null;
        const dlShares = target.gift.sharesAcquired ? parseFloat(target.gift.sharesAcquired) : null;
        const dlValue = dlShares !== null && dlShares > 0 && dlPrice && dlPrice > 0 ? dlShares * dlPrice : null;
        const dlCtx = { ticker: dlTicker, currentValue: dlValue };
        // Defer one tick so the composer opens AFTER the row renders &
        // scrolls into view — opening immediately would cause the page to
        // scroll past the now-taller row.
        window.setTimeout(() => openComposer(String(target.giftId), tyForGift, senderName, amount, dlCtx), 50);
      }
    }

    const cancel = scrollToTestId(`memory-entry-${target.id}`, {
      onFound: () => {
        handledDeepLinkRef.current = deepLinkKey;
        inFlightScrollRef.current = null;
        window.setTimeout(() => setHighlightedEntryId(null), HIGHLIGHT_HOLD_MS);
      },
      onMissed: () => {
        inFlightScrollRef.current = null;
        setHighlightedEntryId(null);
      },
    });
    inFlightScrollRef.current = { key: deepLinkKey, cancel };
    // Deliberately no return → effect cleanup doesn't cancel polling.
  }, [search, entries]);

  useEffect(() => {
    if (!fundId || typeof window === "undefined") return;
    const refreshVisibleMemoryBook = () => {
      if (document.visibilityState && document.visibilityState !== "visible") return;
      void queryClient.invalidateQueries({ queryKey: ["memory", fundId] });
      void queryClient.invalidateQueries({ queryKey: ["fund", fundId] });
    };
    window.addEventListener("focus", refreshVisibleMemoryBook);
    document.addEventListener("visibilitychange", refreshVisibleMemoryBook);
    return () => {
      window.removeEventListener("focus", refreshVisibleMemoryBook);
      document.removeEventListener("visibilitychange", refreshVisibleMemoryBook);
    };
  }, [fundId, queryClient]);

  // Optimistic create — parent writes a Memory Book entry, it appears in
  // the list instantly (no spinner roundtrip), then reconciles with the
  // server-returned data when the request settles. Felt-quality polish
  // applied 2026-05-12 per the locked optimistic-UI pattern. Memory Book
  // is the highest-emotional-volume mutation in Kora; the parent writing
  // a note for Emma should feel instant, not "waiting for network."
  //
  // Pattern (canonical for future optimistic mutations):
  //   1. onMutate: cancel in-flight queries + snapshot previous data +
  //      optimistically write the new entry to the cache with a temp id +
  //      `__optimistic: true` flag. Return the snapshot in context.
  //   2. onError: rollback by setting cache back to the snapshot.
  //   3. onSuccess: UI cleanup (close modal, reset form, success haptic).
  //   4. onSettled: invalidate queries to reconcile with server truth
  //      (handles both the success-with-real-id case and the
  //      error-keep-the-snapshot case).
  //
  // The temp id format `__optimistic_${timestamp}__` is namespaced so any
  // rendering code that key-matches on id won't accidentally collide with
  // real server ids.
  const createMutation = useMutation({
    mutationFn: async (body: { type: string; content: string; authorName: string; photoUrl?: string; videoUrl?: string; audioUrl?: string; audioTranscript?: string; visibility?: string; kidVisibility?: string; isFeatured?: boolean }) => {
      const res = await fetch(`/api/funds/${fundId}/memory`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error("Failed to create entry");
      return res.json();
    },
    onMutate: async (body) => {
      // Cancel any in-flight refetch so it doesn't overwrite the
      // optimistic data before the mutation settles.
      await queryClient.cancelQueries({ queryKey: ["memory", fundId] });

      // Snapshot current cache for rollback on error.
      const previous = queryClient.getQueryData<MemoryEntry[]>(["memory", fundId]);

      // Optimistic entry shape — must match MemoryEntry interface so the
      // list renders without conditional branching. Server-returned data
      // will replace this on settle.
      const optimisticEntry: MemoryEntry & { __optimistic: true } = {
        id: `__optimistic_${Date.now()}__`,
        fundId: fundId ?? "",
        giftId: null,
        type: body.type,
        content: body.content,
        authorName: body.authorName,
        authorPhotoUrl: null,
        photoUrl: body.photoUrl ?? null,
        videoUrl: body.videoUrl ?? null,
        audioUrl: body.audioUrl ?? null,
        visibility: (body.visibility as "public" | "family" | "private" | undefined) ?? "public",
        isFeatured: body.isFeatured ?? false,
        mediaStatus: "ok",
        createdAt: new Date().toISOString(),
        gift: null,
        __optimistic: true,
      };

      // Optimistically prepend to the list (newest-first ordering is
      // canonical per the Memory Book sort order).
      queryClient.setQueryData<MemoryEntry[]>(["memory", fundId], (old) => {
        if (!old) return [optimisticEntry];
        return [optimisticEntry, ...old];
      });

      return { previous };
    },
    onError: (error: Error, _body, context) => {
      // Rollback to the snapshot. If snapshot is undefined, the cache had
      // no data and the invalidate in onSettled will refetch fresh.
      if (context?.previous !== undefined) {
        queryClient.setQueryData(["memory", fundId], context.previous);
      }
      setFormError(error.message || "Could not save this entry. Please try again.");
      haptic("error");
    },
    onSuccess: () => {
      // UI cleanup runs regardless of optimistic state — the modal closes,
      // form resets, success haptic fires. The cache reconciliation
      // happens in onSettled.
      setShowModal(false);
      setEditingEntry(null);
      setContent("");
      setPhotoUrl("");
      setVideoUrl("");
      setAudioUrl("");
      setFormError(null);
      setEntryType("milestone");
      setVisibility("public");
      setIsFeatured(false);
      setShowMoreOptions(false);
      haptic("success");
    },
    onSettled: () => {
      // Always reconcile with server truth — handles both the success
      // case (replace optimistic temp-id with real server data) and the
      // error case (refetch ensures the rolled-back snapshot matches the
      // server's actual state).
      queryClient.invalidateQueries({ queryKey: ["memory", fundId] });
      queryClient.invalidateQueries({ queryKey: ["fund", fundId] });
    },
  });

  // Optimistic update — same canonical pattern as createMutation above.
  // The edited entry shows the new content instantly; server reconciliation
  // on settle.
  const updateMutation = useMutation({
    mutationFn: async (body: { id: string; type: string; content: string; authorName: string; photoUrl?: string; videoUrl?: string; audioUrl?: string; audioTranscript?: string; visibility?: string; kidVisibility?: string; isFeatured?: boolean }) => {
      const res = await fetch(`/api/memory/${body.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          type: body.type,
          content: body.content,
          authorName: body.authorName,
          photoUrl: body.photoUrl,
          videoUrl: body.videoUrl,
          audioUrl: body.audioUrl,
          audioTranscript: body.audioTranscript,
          visibility: body.visibility,
          kidVisibility: body.kidVisibility,
          isFeatured: body.isFeatured,
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data?.error || "Failed to update entry");
      }
      return res.json();
    },
    onMutate: async (body) => {
      await queryClient.cancelQueries({ queryKey: ["memory", fundId] });
      const previous = queryClient.getQueryData<MemoryEntry[]>(["memory", fundId]);

      // Optimistically replace the edited entry in the cache. Preserve
      // immutable fields (id, fundId, createdAt, giftId, gift); overlay
      // the edited fields. The cache shape stays MemoryEntry[] so
      // rendering doesn't need any optimistic-state branching.
      queryClient.setQueryData<MemoryEntry[]>(["memory", fundId], (old) => {
        if (!old) return old;
        return old.map((entry) => {
          if (entry.id !== body.id) return entry;
          return {
            ...entry,
            type: body.type,
            content: body.content,
            authorName: body.authorName,
            photoUrl: body.photoUrl ?? entry.photoUrl,
            videoUrl: body.videoUrl ?? entry.videoUrl,
            audioUrl: body.audioUrl ?? entry.audioUrl,
            visibility: (body.visibility as "public" | "family" | "private" | undefined) ?? entry.visibility,
            isFeatured: body.isFeatured ?? entry.isFeatured,
          };
        });
      });

      return { previous };
    },
    onError: (error: Error, _body, context) => {
      if (context?.previous !== undefined) {
        queryClient.setQueryData(["memory", fundId], context.previous);
      }
      setFormError(error.message || "Could not update this entry. Please try again.");
      haptic("error");
    },
    onSuccess: () => {
      setShowModal(false);
      setEditingEntry(null);
      setContent("");
      setPhotoUrl("");
      setVideoUrl("");
      setFormError(null);
      setEntryType("milestone");
      setVisibility("public");
      setIsFeatured(false);
      setShowMoreOptions(false);
      haptic("success");
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ["memory", fundId] });
      queryClient.invalidateQueries({ queryKey: ["fund", fundId] });
    },
  });

  // Optimistic delete — entry disappears from the list instantly. If the
  // server fails, the entry reappears via the onError rollback. Toast
  // surfaces the failure honestly.
  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/memory/${id}`, {
        method: "DELETE",
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed to delete entry");
    },
    onMutate: async (id) => {
      await queryClient.cancelQueries({ queryKey: ["memory", fundId] });
      const previous = queryClient.getQueryData<MemoryEntry[]>(["memory", fundId]);

      // Optimistically filter out the deleted entry from the cache.
      queryClient.setQueryData<MemoryEntry[]>(["memory", fundId], (old) => {
        if (!old) return old;
        return old.filter((entry) => entry.id !== id);
      });

      return { previous };
    },
    onError: (_error, _id, context) => {
      if (context?.previous !== undefined) {
        queryClient.setQueryData(["memory", fundId], context.previous);
      }
      toast({ title: "Could not delete this entry", description: "Please try again.", variant: "destructive" });
      haptic("error");
    },
    onSuccess: () => {
      haptic("success");
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ["memory", fundId] });
      queryClient.invalidateQueries({ queryKey: ["fund", fundId] });
    },
  });

  const memoryShareMutation = useMutation({
    mutationFn: async (body: { message: string; photoUrl?: string }) => {
      const res = await fetch(`/api/funds/${fundId}/gifter-notifications/memory-share`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || "Could not queue this share.");
      return data;
    },
    onSuccess: async (data) => {
      const recipientCount = Number(data?.recipientCount ?? optedInCount ?? 0);
      setLastShareUrl(String(data?.shareUrl || ""));
      // Don't close the modal — keep it open so the user sees their new
      // share land in the "Updates you've sent" list immediately. Resets
      // the compose form so they can keep going if they have more to send.
      // The user closes manually when done, which makes the accumulating
      // history obvious instead of hiding it behind a toast + page refresh.
      setShareStep("compose");
      setShareMessage("");
      setSharePhotoUrl("");
      setSharePhotoError(null);
      haptic("success");
      toast({
        title: recipientCount > 0
          ? `Sent to ${recipientCount} ${recipientCount === 1 ? "gifter" : "gifters"}`
          : "Update queued",
        description: recipientCount > 0
          ? "They'll see it in their inbox within 15 minutes."
          : "We'll send it the moment a gifter opts in.",
      });
      // Refresh both queries — counter pill + past-shares list — so they
      // reflect the new state without waiting for the next modal open.
      // Awaited so the user sees populated data before they look down.
      await Promise.all([refetchGifterNotifications(), refetchPastShares()]);
    },
  });

  const openAddModal = () => {
    setEditingEntry(null);
    setEntryType("milestone");
    setContent("");
    setAuthorName(user?.firstName || "");
    setPhotoUrl("");
    setVideoUrl("");
    setAudioUrl("");
    setAudioTranscript("");
    setSaveForBirthday(false);
    setFormError(null);
    setUploadError(null);
    setRetryFile(null);
    setVisibility("public");
    setIsFeatured(false);
    setShowMoreOptions(false);
    setShowModal(true);
  };

  const openFirstStoryPrompt = () => {
    setEditingEntry(null);
    setEntryType("note");
    setContent("");
    setAuthorName(user?.firstName || "Parent");
    setPhotoUrl("");
    setVideoUrl("");
    setAudioUrl("");
    setAudioTranscript("");
    setSaveForBirthday(false);
    setFormError(null);
    setUploadError(null);
    setRetryFile(null);
    setVisibility("public");
    setIsFeatured(true);
    // First-parent-letter is pre-pinned, so reveal the More options
    // row so the parent sees the pinned-state and can toggle it off
    // if they don't want it pinned. Defaults to true for this entry.
    setShowMoreOptions(true);
    setMilestonePromptSeed(Date.now());
    setShowModal(true);
  };

  // Curated milestone library. Each preset opens the existing
  // composer prefilled with the milestone label as a starter
  // sentence and entryType='milestone' so the entry slots into
  // the existing milestone filter + visual treatment. The
  // composer already handles photo/video/audio + Plus-gating;
  // this is purely about giving the parent a guided entry point
  // rather than a blank "Add entry" button.
  //
  // Locked 2026-05-18 per the Target-vs-Walmart positioning
  // discussion: the Memory Book at 18 is the canonical Target
  // moat, and capturing the actual childhood milestones (not
  // just gifts) is what makes the book worth giving. The
  // EarlyBird teardown flagged this gap explicitly.
  //
  // Tone: conversational, parent-voiced. The label is a STARTER
  // sentence the parent finishes — never a label-followed-by-
  // colon. So "First steps." not "First steps:" — the parent
  // continues the thought naturally.
  // Child's current age, for age-appropriate moment prompts below.
  const kidAgeForMoments = useMemo(() => {
    const bd = fundData?.recipientBirthdate ? new Date(fundData.recipientBirthdate) : null;
    if (!bd || Number.isNaN(bd.getTime())) return null;
    return Math.floor((Date.now() - bd.getTime()) / (365.25 * 24 * 60 * 60 * 1000));
  }, [fundData?.recipientBirthdate]);

  // Age-aware moment prompts. Each is tagged with the typical age it happens; we
  // surface the moments relevant to the child's life stage (already happened,
  // most recent first) so a 20-year-old's parent sees "Graduation / First job,"
  // not "First tooth." Unknown birthdate falls back to the early-childhood set.
  const milestoneLibrary: Array<{ key: string; label: string; starter: string }> = useMemo(() => {
    const ALL: Array<{ key: string; label: string; starter: string; age: number }> = [
      { key: "first-steps",       label: "First steps",         starter: "First steps. ", age: 1 },
      { key: "first-word",        label: "First word",          starter: "First word. ", age: 1 },
      { key: "first-tooth",       label: "First tooth",         starter: "First tooth came in. ", age: 1 },
      { key: "first-haircut",     label: "First haircut",       starter: "First haircut. ", age: 2 },
      { key: "new-sibling",       label: "Got a sibling",       starter: "Became a big ", age: 4 },
      { key: "first-day-school",  label: "First day of school", starter: "First day of school. ", age: 5 },
      { key: "lost-tooth",        label: "Lost first tooth",    starter: "Lost their first tooth. ", age: 6 },
      { key: "moved-home",        label: "Moved homes",         starter: "We moved. ", age: 6 },
      { key: "started-sport",     label: "Started a sport",     starter: "Started playing ", age: 7 },
      { key: "first-sleepover",   label: "First sleepover",      starter: "First sleepover. ", age: 8 },
      { key: "learners-permit",   label: "Learner's permit",    starter: "Got their learner's permit. ", age: 15 },
      { key: "first-job",         label: "First job",           starter: "Started their first job. ", age: 16 },
      { key: "drivers-license",   label: "Driver's license",    starter: "Passed the driving test. ", age: 16 },
      { key: "graduation",        label: "Graduation",          starter: "Graduated. ", age: 18 },
      { key: "college-accept",    label: "College acceptance",  starter: "Got into ", age: 18 },
      { key: "moved-out",         label: "Moved out",           starter: "Moved out on their own. ", age: 18 },
    ];
    const strip = ({ age: _age, ...m }: { key: string; label: string; starter: string; age: number }) => m;
    if (kidAgeForMoments == null) return ALL.filter((m) => m.age <= 8).map(strip);
    return ALL
      .filter((m) => m.age <= kidAgeForMoments + 1)
      .sort((a, b) => b.age - a.age)
      .slice(0, 10)
      .map(strip);
  }, [kidAgeForMoments]);

  const openMilestoneComposer = (starter: string) => {
    setEditingEntry(null);
    setEntryType("milestone");
    setContent(starter);
    setAuthorName(user?.firstName || "Parent");
    setPhotoUrl("");
    setVideoUrl("");
    setAudioUrl("");
    setAudioTranscript("");
    setSaveForBirthday(false);
    setFormError(null);
    setUploadError(null);
    setRetryFile(null);
    // Default milestone visibility to 'family' — parents shouldn't
    // accidentally publish "Emma's first day of kindergarten" on
    // the gift page that strangers can land on. Family-only is the
    // safer default for parent-authored childhood moments; the
    // parent can flip to public if they want gifters to see it.
    // Locked 2026-05-18 per the milestone-composer polish pass.
    setVisibility("family");
    setIsFeatured(false);
    setShowMoreOptions(false);
    setMilestonePromptSeed(Date.now());
    setShowModal(true);
    haptic("selection");
  };

  const openEditModal = (entry: MemoryEntry) => {
    if (entry.type === "gift_message") return;
    setEditingEntry(entry);
    const t = (["milestone", "photo", "note"].includes(entry.type) ? entry.type : "note") as "milestone" | "photo" | "note";
    setEntryType(t);
    setContent(entry.content || "");
    setAuthorName(entry.authorName || user?.firstName || "");
    setPhotoUrl(entry.photoUrl || "");
    setVideoUrl(entry.videoUrl || "");
    setAudioUrl(entry.audioUrl || "");
    setAudioTranscript((entry as any).audioTranscript || "");
    setSaveForBirthday(((entry as any).kidVisibility || "kid_now") === "kid_at_18");
    setFormError(null);
    setUploadError(null);
    setRetryFile(null);
    setVisibility(entry.visibility || "public");
    setIsFeatured(Boolean(entry.isFeatured));
    // Reveal More options on edit when the entry is already pinned —
    // the user is opening a row they previously pinned and needs the
    // toggle visible in case they want to unpin.
    setShowMoreOptions(Boolean(entry.isFeatured));
    setShowModal(true);
  };

  const handleSubmit = () => {
    if (!content.trim()) return;
    const mediaError = validateMemoryMedia(photoUrl, videoUrl);
    if (mediaError) {
      setFormError(mediaError);
      return;
    }
    const trimmedPhoto = photoUrl.trim();
    const trimmedVideo = videoUrl.trim();
    const trimmedAudio = audioUrl.trim();
    setFormError(null);
    const payload = {
      type: entryType,
      content: content.trim(),
      authorName: authorName.trim() || "Parent",
      photoUrl: trimmedPhoto || undefined,
      videoUrl: trimmedVideo || undefined,
      audioUrl: trimmedAudio || undefined,
      audioTranscript: audioTranscript.trim() || undefined,
      visibility,
      // kidVisibility is the new memory_entries.visibility column — controls
      // when the kid sees this entry in KidView. "kid_at_18" reserves it for
      // the 18th-birthday reveal moment; "kid_now" (default) shows it any
      // time. Distinct from `visibility` above which controls audience on
      // the gift page (public/family/private).
      kidVisibility: saveForBirthday ? "kid_at_18" : "kid_now",
      isFeatured,
    };
    if (editingEntry) {
      updateMutation.mutate({ id: editingEntry.id, ...payload });
    } else {
      createMutation.mutate(payload);
    }
  };

  // Compose step → advance to confirm. The confirm screen shows the parent
  // exactly who will receive this and how many shares they have left for the
  // year, then the parent taps Send to actually fire. Two-tap pattern matches
  // the at-18 letter clear and the strategy-switch disclosure.
  const handleSubmitShare = () => {
    if (!shareMessage.trim()) return;
    haptic("selection");
    setShareStep("confirm");
  };

  const handleConfirmShare = () => {
    if (!shareMessage.trim()) return;
    haptic("medium");
    memoryShareMutation.mutate({
      message: shareMessage.trim(),
      photoUrl: sharePhotoUrl.trim() || undefined,
    });
  };

  const uploadPhotoFile = async (file: File) => {
    if (!file || !fundId) return;
    if (!file.type.startsWith("image/")) {
      setFormError("Please choose an image file.");
      return;
    }
    if (file.size > 3 * 1024 * 1024) {
      setFormError("Image too large. Please use an image under 3MB.");
      return;
    }
    setFormError(null);
    setUploadError(null);
    setUploadingPhoto(true);
    setRetryFile(file);
    try {
      const reader = new FileReader();
      reader.onload = async () => {
        try {
          const dataUrl = String(reader.result || "");
          const res = await fetch(`/api/funds/${fundId}/memory/upload-photo`, {
            method: "POST",
            credentials: "include",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ dataUrl }),
          });
          const data = await res.json().catch(() => ({}));
          if (!res.ok || !data?.url) {
            // Server returns { error: 'plus_required', message: '...' } on
            // the locked parent-media Plus gate. Prefer the friendly
            // message when present so the parent sees "Photos for parent-
            // authored Memory Book entries unlock with Kiddo+" instead of
            // the raw error code. Same pattern for any other server-side
            // friendly-error response.
            throw new Error(data?.message || data?.error || "Upload failed");
          }
          setPhotoUrl(data.url);
          setRetryFile(null);
          setUploadError(null);
          haptic("success");
        } catch (err: any) {
          const message = err?.message || "Upload failed";
          setFormError(message);
          setUploadError(message);
        } finally {
          setUploadingPhoto(false);
        }
      };
      reader.readAsDataURL(file);
    } catch {
      setUploadingPhoto(false);
      setFormError("Upload failed");
      setUploadError("Upload failed");
    }
  };

  const handlePhotoFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    await uploadPhotoFile(file);
  };

  const uploadVideoFile = async (file: File) => {
    if (!file || !fundId) return;
    if (!file.type.startsWith("video/")) {
      setFormError("Please choose a video file.");
      return;
    }
    if (file.size > 25 * 1024 * 1024) {
      setFormError("Video too large. Please use a video under 25MB.");
      return;
    }
    setFormError(null);
    setUploadError(null);
    setUploadingVideo(true);
    try {
      const dataUrl = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result || ""));
        reader.onerror = () => reject(new Error("Upload failed"));
        reader.readAsDataURL(file);
      });
      const res = await fetch(`/api/funds/${fundId}/memory/upload-video`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ dataUrl }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data?.url) {
        // Same friendly-message preference as photo upload above.
        throw new Error(data?.message || data?.error || "Upload failed");
      }
      setVideoUrl(data.url);
      haptic("success");
    } catch (err: any) {
      const message = err?.message || "Upload failed";
      setFormError(message);
      setUploadError(message);
    } finally {
      setUploadingVideo(false);
    }
  };

  // Voice note upload + in-app recorder. Voice is the moat — Emma at 18
  // hearing her dad's voice from when she was 3 is the unrepeatable
  // experience nothing else in the category offers. Two paths: upload an
  // existing file (recorded elsewhere) or record live in the browser via
  // the MediaRecorder API. 60s soft cap so the file stays small and the
  // moment stays focused. 10MB hard cap matches the server.
  const uploadAudioBlob = async (blob: Blob, ext: string) => {
    if (!fundId) return;
    if (blob.size > 10 * 1024 * 1024) {
      setFormError("Voice note too large. Max 10MB.");
      return;
    }
    setFormError(null);
    setUploadError(null);
    setUploadingAudio(true);
    try {
      const dataUrl = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result || ""));
        reader.onerror = () => reject(new Error("Upload failed"));
        reader.readAsDataURL(blob);
      });
      const res = await fetch(`/api/funds/${fundId}/memory/upload-audio`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ dataUrl }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data?.url) {
        // Same friendly-message preference as photo upload above.
        throw new Error(data?.message || data?.error || "Upload failed");
      }
      setAudioUrl(data.url);
      // Whisper transcript may be present (when OPENAI_API_KEY is set on the
      // server). When it's null, the audio still saves and plays — we just
      // don't show a transcript line. Best-effort behavior matches server.
      if (data.transcript && typeof data.transcript === "string") {
        setAudioTranscript(data.transcript);
      } else {
        setAudioTranscript("");
      }
      haptic("success");
    } catch (err: any) {
      const message = err?.message || "Upload failed";
      setFormError(message);
      setUploadError(message);
    } finally {
      setUploadingAudio(false);
    }
    // ext intentionally unused — server infers from data URL mime
    void ext;
  };

  const handleAudioFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("audio/")) {
      setFormError("Please choose an audio file.");
      return;
    }
    await uploadAudioBlob(file, file.name.split(".").pop() || "webm");
  };

  // Live in-app recorder using MediaRecorder. We grab a 1-shot mic stream,
  // collect chunks, stop on user-tap, upload the assembled blob. Browser
  // permission handled by the platform; no UI for grant — the OS does it.
  // 60s soft cap (auto-stops) so a single voice note doesn't sprawl into
  // an audiobook.
  const audioRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const audioTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const startAudioRecording = async () => {
    if (typeof window === "undefined" || !navigator?.mediaDevices?.getUserMedia) {
      setFormError("Voice recording isn't available in this browser. You can upload an audio file instead.");
      return;
    }
    setFormError(null);
    setUploadError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      audioRecorderRef.current = recorder;
      audioChunksRef.current = [];
      recorder.ondataavailable = (event) => {
        if (event.data && event.data.size > 0) audioChunksRef.current.push(event.data);
      };
      recorder.onstop = async () => {
        // Cleanup mic + timer first so the UI returns to idle even if
        // upload fails — never leave the green "recording" indicator on.
        stream.getTracks().forEach(track => track.stop());
        if (audioTimerRef.current) { clearInterval(audioTimerRef.current); audioTimerRef.current = null; }
        setRecordingAudio(false);
        setRecordingSeconds(0);
        const blob = new Blob(audioChunksRef.current, { type: recorder.mimeType || "audio/webm" });
        if (blob.size > 0) {
          await uploadAudioBlob(blob, "webm");
        }
      };
      recorder.start();
      setRecordingAudio(true);
      setRecordingSeconds(0);
      audioTimerRef.current = setInterval(() => {
        setRecordingSeconds(s => {
          const next = s + 1;
          // Auto-stop at 60s — the soft cap on length per recording.
          if (next >= 60 && audioRecorderRef.current && audioRecorderRef.current.state === "recording") {
            audioRecorderRef.current.stop();
          }
          return next;
        });
      }, 1000);
      haptic("medium");
    } catch (err: any) {
      setFormError(err?.message || "Could not access the microphone. Check permissions.");
    }
  };

  const stopAudioRecording = () => {
    if (audioRecorderRef.current && audioRecorderRef.current.state === "recording") {
      audioRecorderRef.current.stop();
    }
  };

  const handleVideoFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    await uploadVideoFile(file);
    e.currentTarget.value = "";
  };

  const updateEntryMeta = async (entryId: string, patch: { visibility?: "public" | "family" | "private"; isFeatured?: boolean }) => {
    const res = await fetch(`/api/memory/${entryId}/meta`, {
      method: "PATCH",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(patch),
    });
    if (!res.ok) throw new Error("Failed to update memory settings");
    await queryClient.invalidateQueries({ queryKey: ["memory", fundId] });
  };

  // Mark the Memory Book as visited — clears the bottom-nav unread dot.
  // Stamps Date.now() into the per-fund lastReadAt key once entries
  // have actually loaded for this fund. Dispatching the custom event
  // signals MobileNav (same-tab) to recompute the dot count without
  // waiting for a storage event (which only fires cross-tab). Re-runs
  // whenever the parent navigates to another fund's Memory Book or
  // when fresh entries arrive — both correct: we treat the moment of
  // viewing as the read marker, even on auto-refetched updates.
  useEffect(() => {
    if (!fundId || entries.length === 0) return;
    try {
      localStorage.setItem(`${MEMORY_LAST_READ_PREFIX}${fundId}`, String(Date.now()));
      window.dispatchEvent(new CustomEvent(MEMORY_READ_EVENT));
    } catch {
      // localStorage may throw in private-mode Safari; the dot just
      // stays — non-fatal.
    }
  }, [fundId, entries.length]);

  const sortedEntries = useMemo(
    () => [...entries]
      // Hide legacy `parent_investment_start` entries from the Memory
      // Book. These were auto-generated transaction-shaped rows
      // ("Dovi added $50 into ADBE to Emma's fund.") that violated the
      // `feedback_memory_book_inversion` rule — bank-statement lines
      // that read nothing like memories. The server code that wrote
      // them is dead-coded (behind `if (false)` guards in routes.ts at
      // 7987 and 9681), so no new ones get written. Existing rows in
      // the DB get filtered out at render time so they don't pollute
      // Emma's view at 18. We don't delete the DB rows — preserves
      // audit history without showing them to humans.
      .filter((e) => e.type !== "parent_investment_start")
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()),
    [entries]
  );
  const baseFilteredEntries = useMemo(
    () => filterMemoryEntries(sortedEntries, activeFilter, searchQuery),
    [sortedEntries, activeFilter, searchQuery]
  );
  const yearOptions = useMemo(() => {
    const years = Array.from(
      new Set(sortedEntries.map((e) => new Date(e.createdAt).getFullYear()).filter((y) => Number.isFinite(y)))
    ).sort((a, b) => b - a);
    return years.map(String);
  }, [sortedEntries]);
  const filteredEntries = useMemo(() => {
    return baseFilteredEntries.filter((entry) => {
      if (selectedYear !== "all" && String(new Date(entry.createdAt).getFullYear()) !== selectedYear) return false;
      if (featuredOnly && !entry.isFeatured) return false;
      if (eventFilter) {
        if (entry.type !== "gift_message") return false;
        if (entry.gift?.eventId !== eventFilter) return false;
      }
      if (gifterFilter) {
        if (entry.type !== "gift_message") return false;
        // Anonymous bucket filter — when the parent taps the "Anonymous"
        // tile in the roster (which collapses N anon gifts into one),
        // we want to show ALL anon entries, not just the ones whose
        // senderName literally equals "Anonymous". Match against the
        // same isAnonName predicate used to build the roster bucket.
        const filterIsAnon = gifterFilter.toLowerCase() === "anonymous";
        const senderName = String(entry.gift?.senderName || "").trim();
        if (filterIsAnon) {
          const isAnon = !senderName || /^someone who loves/i.test(senderName) || senderName.toLowerCase() === "anonymous";
          if (!isAnon) return false;
        } else {
          if (senderName.toLowerCase() !== gifterFilter.toLowerCase()) return false;
        }
      }
      // Thank-you filter — only narrows gift entries; other types pass
      // through unchanged (a milestone or note has no thank-you state).
      if (thankYouFilter !== "all") {
        if (entry.type !== "gift_message") return false;
        const tyState = thankYouStateForGift(entry.gift);
        if (thankYouFilter === "awaiting" && !(tyState === "missing" || tyState === "draft")) return false;
        if (thankYouFilter === "thanked" && tyState !== "sent") return false;
        if (thankYouFilter === "drafted" && tyState !== "draft") return false;
      }
      return true;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [baseFilteredEntries, selectedYear, featuredOnly, eventFilter, gifterFilter, thankYouFilter, thankYouByGiftId]);
  const visibleEntries = useMemo(
    () => getVisibleMemoryEntries(filteredEntries, visibleCount),
    [filteredEntries, visibleCount]
  );
  const groupedTimeline = useMemo(() => {
    const groups: Record<string, MemoryEntry[]> = {};
    const keys: string[] = [];
    for (const entry of visibleEntries) {
      const key = new Date(entry.createdAt).toLocaleDateString("en-US", { month: "long", year: "numeric", timeZone: "UTC" });
      if (!groups[key]) { groups[key] = []; keys.push(key); }
      groups[key].push(entry);
    }
    const pairs = keys.map((k) => [k, groups[k]] as [string, MemoryEntry[]]);
    // Label the earliest group "The Beginning" if entries span more than 6 months
    if (pairs.length > 1) {
      pairs[pairs.length - 1] = ["The Beginning", pairs[pairs.length - 1][1]];
    }
    return pairs;
  }, [visibleEntries]);

  const entryStats = useMemo(() => {
    let photos = 0;
    let videos = 0;
    let giftCount = 0;
    let giftTotal = 0;
    const people = new Set<string>();
    // Mirrors computeMemoryStats above — anon gifters are distinct humans,
    // so we key them by the entry id rather than the generic shared name.
    const isAnonName = (name: string) => {
      const n = String(name || "").trim();
      if (!n) return true;
      if (/^someone who loves/i.test(n)) return true;
      if (n.toLowerCase() === "anonymous") return true;
      return false;
    };
    const recurringScheduleIds = new Set<string>();
    for (const e of entries) {
      if (e.type === "gift_message") {
        // Count a parent's recurring auto-invest SCHEDULE once, not each cycle,
        // so "N gifts" isn't inflated by ~36 identical contributions. giftTotal
        // still sums every cycle's real dollars.
        const pcId = (e.gift as any)?.parentContributionId;
        if (pcId) {
          recurringScheduleIds.add(String(pcId));
        } else {
          giftCount += 1;
        }
        giftTotal += parseFloat(e.gift?.amount || "0");
        const senderName = e.gift?.senderName || "";
        if (isAnonName(senderName)) {
          people.add(`anon:${e.id}`);
        } else {
          people.add(senderName.trim().toLowerCase());
        }
      } else if (e.authorName) {
        people.add(e.authorName.trim().toLowerCase());
      }
      if (e.photoUrl || e.gift?.photoUrl) photos += 1;
      if (e.videoUrl) videos += 1;
    }
    giftCount += recurringScheduleIds.size;
    return {
      total: entries.length,
      people: people.size,
      giftCount,
      giftTotal,
      photos,
      videos,
    };
  }, [entries]);
  const giftMemoryEntries = useMemo(
    () => sortedEntries.filter((entry) => entry.type === "gift_message"),
    [sortedEntries],
  );
  const parentAuthoredEntries = useMemo(
    () => sortedEntries.filter((entry) => entry.type !== "gift_message"),
    [sortedEntries],
  );
  // First external gift — the chronologically-earliest gift from a real
  // gifter (not the parent, not a test-pattern sender). Mirrors the same
  // signal Activity uses to mark the moment "Emma's fund became real."
  // Memory Book gets a richer treatment: a ribbon above the card with
  // a sprout + "Where it began" label, then the gift card itself. Pure
  // celebration — visible only on this one entry, never on the rest.
  const firstExternalGiftEntryId = useMemo(() => {
    let earliest: { id: string; ts: number } | null = null;
    for (const e of sortedEntries) {
      if (e.type !== "gift_message" || !e.gift) continue;
      const senderName = String(e.gift.senderName || "").trim();
      const lcSender = senderName.toLowerCase();
      // Skip test-data senders (dev artifacts, not real humans). Real
      // anonymous gifters DO count — the locked rule is "each anonymous
      // gift = a distinct human," and the first time someone showed up
      // (named OR anonymous) is the moment the fund became real. If
      // every external gift in a fund is anonymous, the earliest
      // anonymous one IS where it began. Excluding them entirely meant
      // anonymous-only funds never got the ribbon at all.
      const isTestSender = ["test", "testing", "qqqqq", "tstgin", "tstng", "tester"].includes(lcSender);
      // Parent contributions don't count — those are "from you," not the
      // moment the community showed up. Stamped via server flag (new
      // rows) or detectable via senderEmail === owner email.
      const ownerEmail = String((user as any)?.email || "").trim().toLowerCase();
      const senderEmail = String((e.gift as any).senderEmail || "").trim().toLowerCase();
      const isOwn = !!ownerEmail && senderEmail === ownerEmail;
      if (isTestSender || isOwn) continue;
      const ts = e.createdAt ? new Date(e.createdAt).getTime() : NaN;
      if (!Number.isFinite(ts)) continue;
      if (!earliest || ts < earliest.ts) earliest = { id: String(e.id), ts };
    }
    return earliest?.id ?? null;
  }, [sortedEntries, user]);

  const gifterRoster = useMemo(() => {
    // Named senders dedup by lowercased name (Mom giving 5 times = 1 person).
    // Anonymous senders ALL collapse into a single "Anonymous" bucket avatar
    // rather than rendering 7 identical "?" tiles in a row — but the bucket
    // label surfaces the distinct-people count separately so the parent
    // sees "7 gifts · 7 people" instead of the misleading "7 gifts · 1
    // person." This matches the people-count rule in deriveMemoryHeaderStats
    // (each anon gift = a distinct human) without cluttering the roster.
    const isAnonName = (name: string) => {
      const n = String(name || "").trim();
      if (!n) return true;
      if (/^someone who loves/i.test(n)) return true;
      const lc = n.toLowerCase();
      if (lc === "anonymous") return true;
      // Test-data sender names — same list as deriveMemoryHeaderStats so
      // the roster and the people-count agree on what counts as a real
      // named contributor vs a dev test artifact.
      if (["test", "testing", "qqqqq", "tstgin", "tstng", "tester"].includes(lc)) return true;
      return false;
    };
    const map = new Map<string, { name: string; giftCount: number; totalAmount: number; lastGiftDate: string; anonPeople: number; isAnon: boolean; isOwnerRow: boolean }>();
    for (const e of sortedEntries) {
      if (e.type !== "gift_message" || !e.gift?.senderName) continue;
      // Status filter aligned with Dashboard's gifterRoster on 2026-05-15.
      // Failed or refunded gifts shouldn't pollute the per-gifter
      // total — the money never actually landed. Processing gifts
      // (still settling 1-2 business days) stay in because they WILL
      // settle and the kid's narrative shouldn't blink them out.
      // Same set of statuses Dashboard's "Total gifts" stat uses.
      const giftStatus = String(e.gift?.status || "").toLowerCase();
      if (giftStatus === "failed" || giftStatus === "refunded") continue;
      const senderName = e.gift.senderName.trim();
      const isAnon = isAnonName(senderName);
      // Owner detection per gift — when a gift's senderEmail matches
      // the fund owner's email, the row in this roster IS the parent.
      // The roster used to render the parent identically to a gifter
      // (deterministic letter avatar from gifterColor), so a parent
      // who'd uploaded a profile photo still saw a colored "D" tile
      // in the "Who loves [child]" strip — inconsistent with every
      // other surface in the app where the parent wears their own
      // face. Tracking this per-bucket lets the rendering pick the
      // owner treatment (profile photo + "(Dad)" suffix) without
      // having to re-derive it at render time.
      const senderEmailLower = String(e.gift.senderEmail || "").trim().toLowerCase();
      const isOwnerEntry = !!ownerEmailLowerForMemory && senderEmailLower === ownerEmailLowerForMemory;
      const key = isAnon ? "__anon__" : senderName.toLowerCase();
      const existing = map.get(key);
      // Prefer netAmount (after gift-processing fees) so this surface
      // matches what Dashboard's gifterRoster sums. Per locked policy
      // ("NO platform fee on gifts. Gift amount stays whole.") these
      // are usually equal, but the netAmount fallback keeps the two
      // surfaces in lockstep on the rare edge where fees weren't covered.
      const amount = parseFloat(e.gift.netAmount || e.gift.amount || "0");
      if (existing) {
        existing.giftCount += 1;
        existing.totalAmount += amount;
        if (isAnon) existing.anonPeople += 1; // each anon gift = a distinct human
        if (e.createdAt > existing.lastGiftDate) existing.lastGiftDate = e.createdAt;
        // A bucket counts as owner if ANY of its gifts came from the
        // owner email. In practice a name-keyed bucket should be
        // homogeneous, but defending against the case where a gifter
        // happens to share a first name with the parent.
        if (isOwnerEntry) existing.isOwnerRow = true;
      } else {
        map.set(key, {
          name: isAnon ? "Anonymous" : titleCaseName(senderName),
          giftCount: 1,
          totalAmount: amount,
          lastGiftDate: e.createdAt,
          anonPeople: isAnon ? 1 : 0,
          isAnon,
          isOwnerRow: isOwnerEntry && !isAnon,
        });
      }
    }
    return Array.from(map.values()).sort((a, b) => b.totalAmount - a.totalAmount);
  }, [sortedEntries, ownerEmailLowerForMemory]);

  const fundName = fundData?.name || "Fund";
  // Display-capitalize so "lauren" typed lowercase renders as "Lauren"
  // across every Memory Book surface that uses childName.
  const childName = capFirst(fundData?.recipientFirstName) || null;
  // Pronouns for kid-at-18 voice. Pulls from the fund's pronoun setting so
  // "her 18th birthday" / "his 18th birthday" / "their 18th birthday" all
  // come out of the same source. Default (no setting) → they/them. Per
  // feedback_no_marketing_teaser_quotes.md: every user-visible pronoun
  // must use getPronouns(), never hardcoded.
  const childPronouns = getPronouns((fundData as any)?.pronoun);
  // State-specific UTMA majority age. Same locked discipline as Projection /
  // Age18Plan / Dashboard — copy must derive from fund.majorityAge, not
  // hardcode "18". See project_state_majority_age_sweep.md.
  const fundMajorityAge = Number((fundData as any)?.majorityAge) || 18;
  const fundMajorityOrdinal = (() => {
    const n = fundMajorityAge;
    const lastTwo = n % 100;
    if (lastTwo >= 11 && lastTwo <= 13) return `${n}th`;
    const lastOne = n % 10;
    if (lastOne === 1) return `${n}st`;
    if (lastOne === 2) return `${n}nd`;
    if (lastOne === 3) return `${n}rd`;
    return `${n}th`;
  })();
  const isOwner = isAuthenticated && !!user && !!fundData && String(fundData.userId) === String(user.id);
  // Post-handoff adult OWNER (not a pre-handoff parent, not a previous-owner parent):
  // the fund was transferred and the current viewer holds the owner role. The Memory
  // Book is now THEIRS, so it reads "Your Memory Book / Your Story", not "Haley's".
  // Same isOwnerMode signal used across Dashboard/Projection/AppHeader. 2026-05-29.
  const isOwnerMode = (fundData as any)?.accessRole === "owner" && !!(fundData as any)?.transferredAt;
  const fundValue =
    parseFloat(fundData?.balance || "0") +
    parseFloat(fundData?.pendingBalance || "0") +
    parseFloat(fundData?.cashBalance || "0");
  const cachedHeaderStats = useMemo(() => {
    if (!fundId) return null;
    const cachedEntries = readLocalCache<MemoryEntry[]>(`${MEMORY_ENTRIES_CACHE_PREFIX}${fundId}`) || [];
    const cachedFund = readLocalCache<{
      balance?: string;
      pendingBalance?: string;
      cashBalance?: string;
    }>(`${MEMORY_FUND_CACHE_PREFIX}${fundId}`);
    return deriveMemoryHeaderStats(cachedEntries, cachedFund);
  }, [fundId]);
  const { displayValue: displayMemoryFundValue } = useCachedFirstNumber({
    seedValue: cachedHeaderStats?.fundValue ?? null,
    liveValue: fundValue,
  });
  const { displayValue: displayMemoryPeople } = useCachedFirstNumber({
    seedValue: cachedHeaderStats?.people ?? null,
    liveValue: entryStats.people,
    minDelta: 1,
  });
  const { displayValue: displayMemoryGiftCount } = useCachedFirstNumber({
    seedValue: cachedHeaderStats?.giftCount ?? null,
    liveValue: entryStats.giftCount,
    minDelta: 1,
  });
  const canSubmit = content.trim().length > 0 && !validateMemoryMedia(photoUrl, videoUrl);
  // Memory Book tier policy (locked 2026-05-13):
  //   - GIFTER-attached media (photos/videos/voice on gifts) is ALWAYS free.
  //     Locked retention mechanic — a grandparent attaching a voice memo to
  //     a gift should never hit a paywall. Gifter loop is the moat.
  //   - PARENT-authored Memory Book entries with media are Kiddo+ only.
  //     Implemented via the `requiresPlus` prop on MemoryMediaPicker — the
  //     Dashboard composer and the NoteEditorSheet (Age18Plan parent letter)
  //     pass it based on the parent's effective plan + fund-level Plus check.
  //     Free parents see an upgrade callout where the photo/video/voice trio
  //     would otherwise render; text entries stay unrestricted on all tiers.
  //   - Memory Book VIEWING (reading what gifters/parents already wrote) is
  //     never gated. Free parents see every entry their gifters posted with
  //     full media; the gate only blocks parent-authored media UPLOAD.
  const shouldPromptFirstParentEntry =
    giftMemoryEntries.length > 0 &&
    parentAuthoredEntries.length === 0;
  // biggestGiftEntry useMemo removed — was only used by the "$X largest gift"
  // tile that's now gone from the Memory Book story controls. If you ever want
  // to surface largest-gift trivia again, the computation is cheap to restore.

  useEffect(() => {
    let canceledEffect = false;
    const currentUrl = new URL(window.location.origin + location);
    const coverage = currentUrl.searchParams.get("coverage");
    if (!coverage) return;

    const run = async () => {
      try {
        if (coverage === "success") {
          try {
            await fetch("/api/subscription/sync-stripe", {
              method: "POST",
              credentials: "include",
            });
          } catch {
            // Best effort only.
          }
        }

        if (canceledEffect) return;
        if (coverage === "success") {
          setCoverageReturnNotice({
            type: "success",
            title: "Memory Book unlocked",
            description: "Kiddo+ is active for this fund. You can now add and view Memory Book moments.",
          });
          haptic("success");
        } else if (coverage === "canceled") {
          setCoverageReturnNotice({
            type: "canceled",
            title: "Checkout canceled",
            description: "No billing changes were made, so the Memory Book is still locked for now.",
          });
        }
      } finally {
        if (!canceledEffect) {
          void queryClient.invalidateQueries({ queryKey: ["/api/subscription"] });
          void queryClient.invalidateQueries({ queryKey: ["/api/funds"] });
          void queryClient.invalidateQueries({ queryKey: ["/api/auth/user"] });
          const nextUrl = new URL(window.location.origin + location);
          nextUrl.searchParams.delete("coverage");
          window.history.replaceState({}, "", `${nextUrl.pathname}${nextUrl.search}`);
        }
      }
    };

    void run();
    return () => {
      canceledEffect = true;
    };
  }, [location, queryClient]);

  useEffect(() => {
    // Skip the reset when a deep-link is active. The deep-link effect resets
    // all filters AND bumps visibleCount to entries.length so the target row
    // is in the DOM; if we then reset visibleCount back to 10 here, the target
    // disappears and the scroll never finds it. (This was a real, hard-to-spot
    // cascade — explicit guard rather than effect-ordering tricks.)
    if (hasActiveDeepLink()) return;
    setVisibleCount(10);
  }, [activeFilter, selectedYear, featuredOnly, searchQuery]);

  if (authLoading || !isAuthenticated) {
    return (
      <div className="kiddo-app-page md:ml-[264px] flex min-h-screen items-center justify-center">
        <div className="animate-pulse text-muted-foreground">Checking access...</div>
      </div>
    );
  }

  return (
    <div className="kiddo-app-page md:ml-[264px] pb-24 md:pb-8" data-testid="page-memory-book">
      <AppHeader />

      <main className="kiddo-canvas px-4 py-5 md:py-6">
        {pendingEntries.length > 0 && (
          // Pending-review tray. Only renders when the moderation toggle is
          // on AND there's something waiting. Each row gets one-tap Approve
          // or Delete — no extra confirmation modal because the parent
          // already chose to be the gatekeeper. Approve flips status to
          // 'published' and the entry slides into the main Memory Book on
          // the next refetch. Delete is the existing DELETE /api/memory/:id
          // path. Audit-logged on both sides.
          <div
            className="mb-5 rounded-2xl border border-amber-200 bg-amber-50 p-4 shadow-premium-sm"
            data-testid="card-memory-pending-tray"
          >
            <div className="mb-3 flex items-center justify-between gap-3">
              <div>
                <p className="text-sm font-bold text-amber-900">
                  {pendingEntries.length} {pendingEntries.length === 1 ? "entry" : "entries"} waiting for your approval
                </p>
                <p className="mt-0.5 text-xs text-amber-800">
                  Approval mode is on. Approve to add to the Memory Book, or delete to discard.
                </p>
              </div>
            </div>
            <div className="space-y-2">
              {pendingEntries.map((entry) => (
                <div
                  key={entry.id}
                  className="flex items-start gap-3 rounded-xl border border-amber-200 bg-white p-3"
                  data-testid={`row-memory-pending-${entry.id}`}
                >
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-semibold text-foreground">
                      {entry.gift?.senderName || entry.authorName || "Anonymous"}
                    </p>
                    {entry.content && (
                      <p className="mt-0.5 line-clamp-2 text-sm text-foreground">{entry.content}</p>
                    )}
                    <div className="mt-1 flex flex-wrap gap-1.5 text-[10px] uppercase tracking-wide text-amber-800">
                      {entry.photoUrl && <span className="rounded-full bg-amber-100 px-2 py-0.5">Photo</span>}
                      {entry.videoUrl && <span className="rounded-full bg-amber-100 px-2 py-0.5">Video</span>}
                      {entry.audioUrl && <span className="rounded-full bg-amber-100 px-2 py-0.5">Voice</span>}
                    </div>
                  </div>
                  <div className="flex shrink-0 gap-1.5">
                    <button
                      type="button"
                      className="rounded-lg bg-[hsl(var(--kiddo-evergreen))] px-3 py-1.5 text-xs font-semibold text-white hover:opacity-90 disabled:opacity-50"
                      onClick={() => approvePendingEntry.mutate(entry.id)}
                      disabled={approvePendingEntry.isPending || rejectPendingEntry.isPending}
                      data-testid={`button-memory-pending-approve-${entry.id}`}
                    >
                      Approve
                    </button>
                    <button
                      type="button"
                      className="rounded-lg border border-red-300 bg-white px-3 py-1.5 text-xs font-semibold text-red-700 hover:bg-red-50 disabled:opacity-50"
                      onClick={() => rejectPendingEntry.mutate(entry.id)}
                      disabled={approvePendingEntry.isPending || rejectPendingEntry.isPending}
                      data-testid={`button-memory-pending-delete-${entry.id}`}
                    >
                      Delete
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
        {coverageReturnNotice && (
          <div
            className={`mb-5 rounded-2xl border p-4 shadow-premium-sm ${
              coverageReturnNotice.type === "success"
                ? "border-green-200 bg-green-50"
                : "border-amber-200 bg-amber-50"
            }`}
            data-testid="card-memory-coverage-return-notice"
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className={`text-sm font-semibold ${coverageReturnNotice.type === "success" ? "text-green-800" : "text-amber-800"}`}>
                  {coverageReturnNotice.title}
                </p>
                <p className={`mt-1 text-sm ${coverageReturnNotice.type === "success" ? "text-green-700" : "text-amber-700"}`}>
                  {coverageReturnNotice.description}
                </p>
              </div>
              <button
                type="button"
                className="text-xs font-medium text-muted-foreground hover:text-foreground"
                onClick={() => setCoverageReturnNotice(null)}
                data-testid="button-dismiss-memory-coverage-notice"
              >
                Dismiss
              </button>
            </div>
          </div>
        )}

        <EnlighteningReveal>
          <div
            style={{
              background: "linear-gradient(140deg, hsl(var(--kiddo-evergreen)) 0%, hsl(var(--kiddo-evergreen-deep)) 100%)",
              borderRadius: 28,
              padding: "28px 28px 24px",
              position: "relative",
              overflow: "hidden",
              boxShadow: "0 4px 16px rgba(26,23,16,0.12), 0 16px 48px rgba(26,23,16,0.10)",
              marginBottom: 24,
            }}
            data-testid="memory-hero"
          >
            {/* Decorative orbs REMOVED 2026-05-19. They were vestigial
                "Acorns-style" hero-background bubbles that didn't add
                signal — pure visual noise on what should be a calm
                cinematic anchor. Per the locked Mubi-register design
                language for Memory Book, the hero earns its weight
                from the typography + the cinematic balance number,
                not from decorative shapes. Don't add them back. */}

            <div style={{ position: "relative", zIndex: 1 }}>
              {/* Hero stripped 2026-05-19 per the Memory Book register
                  audit. Was: eyebrow + slogan h2 ("Every gift has a
                  story.") + descriptive paragraph + balance + community
                  line + 🌱 emoji. The slogan + paragraph + emoji were
                  Hallmark-register — marketing-page copywriting bleeding
                  into a product surface — which made sophisticated users
                  hesitant to share the page. Now matches Dashboard's
                  Apple-Settings register: eyebrow names the surface,
                  balance IS the cinematic anchor, community line is
                  honest count signal. The emotion lives in the data,
                  not in declarations above it. Same locked principle
                  the Dashboard hero proved out: don't try, just be
                  the number. */}
              <div style={{ fontSize: 11, color: "rgba(255,255,255,0.48)", fontWeight: 600, letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: 14 }} data-testid="text-fund-name">
                {isOwnerMode ? "Your" : childName ? `${childName}'s` : "Fund"} Memory Book
              </div>

              <div style={{ marginBottom: 22 }} data-testid="memory-hero-number">
                <p className="font-heading" style={{ fontSize: 44, fontWeight: 700, color: "white", lineHeight: 1, letterSpacing: "-0.01em", marginBottom: 8, fontVariantNumeric: "tabular-nums" }}>
                  {formatMoney(displayMemoryFundValue)}
                </p>
                <p style={{ fontSize: 13, color: "rgba(255,255,255,0.62)", lineHeight: 1.45 }}>
                  {(() => {
                    const peopleN = Math.round(displayMemoryPeople);
                    const giftsN = Math.round(displayMemoryGiftCount);
                    if (peopleN === 0 && giftsN === 0) return `Built one moment at a time.`;
                    const peopleLabel = peopleN === 1 ? "1 person" : `${peopleN} people`;
                    const giftsLabel = giftsN === 1 ? "1 gift" : `${giftsN} gifts`;
                    // Sprout emoji removed 2026-05-19 — was wallpaper
                    // weight on a daily-view surface. Earned only at
                    // genuine celebration moments (milestone crossings,
                    // closing book page). The eyebrow already names
                    // {child}; trailing "for {child}" was redundant.
                    return `Built by ${peopleLabel} · ${giftsLabel}`;
                  })()}
                </p>
              </div>

              {/* Actions */}
              <div style={{ display: "flex", gap: 10, flexWrap: "wrap" as const }}>
                <button
                  type="button"
                  onClick={() => { haptic("selection"); setShareOpen(true); }}
                  className="kiddo-press"
                  style={{
                    padding: "9px 16px", fontSize: 13, fontWeight: 600,
                    background: "rgba(255,255,255,0.10)", color: "white",
                    border: "1px solid rgba(255,255,255,0.18)", borderRadius: 12,
                    cursor: "pointer", display: "inline-flex", alignItems: "center", gap: 8,
                  }}
                  data-testid="button-share-memory-update"
                  title={pastShares.length > 0 ? `${pastShares.length} update${pastShares.length === 1 ? "" : "s"} sent this year. Click to view.` : undefined}
                >
                  <Send size={14} />
                  Share update
                  {pastShares.length > 0 && (
                    <span style={{
                      fontSize: 10.5, fontWeight: 700,
                      background: "rgba(255,255,255,0.18)",
                      color: "white",
                      padding: "1.5px 7px",
                      borderRadius: 999,
                      lineHeight: 1.4,
                    }}>
                      {/* "4 sent" was ambiguous — sent how, to whom?
                          Switching to "4 shared" makes the action explicit
                          and matches the button verb ("Share update"). */}
                      {pastShares.length} shared
                    </span>
                  )}
                </button>
                <button
                  type="button"
                  onClick={() => { haptic("selection"); openAddModal(); }}
                  className="kiddo-press"
                  style={{
                    padding: "9px 16px", fontSize: 13, fontWeight: 700,
                    background: "hsl(var(--kiddo-gold))", color: "white",
                    border: "none", borderRadius: 12,
                    cursor: "pointer", display: "inline-flex", alignItems: "center", gap: 6,
                  }}
                  data-testid="button-add-entry"
                >
                  <Plus size={14} />
                  Add memory
                </button>
              </div>
            </div>
          </div>
        </EnlighteningReveal>

        {lastShareUrl ? (
          <div className="mb-6 rounded-2xl border border-primary/20 bg-primary/5 p-4 text-sm">
            <p className="font-medium text-foreground">Memory Book update queued</p>
            <p className="mt-1 text-muted-foreground">We queued this for opted-in people and created a private share page.</p>
            <Button
              variant="outline"
              size="sm"
              className="mt-3"
              onClick={async () => {
                await navigator.clipboard.writeText(lastShareUrl);
                haptic("success");
              }}
              data-testid="button-copy-memory-share-url"
            >
              <Copy size={14} className="mr-2" />
              Copy share URL
            </Button>
          </div>
        ) : null}

        {/* Skeleton ↔ content crossfade. AnimatePresence with mode="wait"
            so the skeleton fully fades out before the real timeline
            fades in — prevents the half-frame flash where both are
            absent. DUR_FAST on both sides keeps the swap neutral
            (neither side feels privileged). Locked 2026-05-18 per
            motion audit. */}
        <AnimatePresence mode="wait">
        {isLoading ? (
          // Skeleton placeholder — was a centered spinner + "Loading
          // memories..." text. Now renders 3 entry-shaped cards with a
          // soft shimmer so the parent sees the layout they're about to
          // get, not a generic spinner. Premium-app rule: skeletons
          // preview the post-load shape, not a "wait" abstraction. The
          // shimmer uses a slow opacity pulse (1.6s) so it feels like
          // breath, not a frantic loading state.
          <motion.div
            key="memory-skeleton"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: DUR_FAST }}
            className="space-y-4"
            role="status"
            aria-label="Loading memories"
            data-testid="memory-loading-skeleton"
          >
            {[0, 1, 2].map((i) => (
              <motion.div
                key={i}
                animate={{ opacity: [0.55, 0.85, 0.55] }}
                transition={{ duration: 1.6, repeat: Infinity, ease: "easeInOut", delay: i * 0.18 }}
                className="overflow-hidden rounded-3xl border border-[hsl(var(--kiddo-border)/0.6)] bg-card"
              >
                {/* Header band — mimics the entry's pinned/visibility row */}
                <div className="flex items-center justify-between gap-3 border-b border-border/50 bg-[hsl(var(--kiddo-cream)/0.42)] px-4 py-3">
                  <div className="h-3 w-16 rounded-full bg-[hsl(var(--kiddo-border)/0.55)]" />
                  <div className="h-7 w-7 rounded-full bg-[hsl(var(--kiddo-border)/0.55)]" />
                </div>
                {/* Inner cream card area — mimics note + metadata band */}
                <div className="p-4 sm:p-5">
                  <div className="rounded-[28px] border border-[hsl(var(--kiddo-border)/0.55)] bg-[hsl(var(--kiddo-cream)/0.5)] p-5">
                    {/* Note-shaped lines (only on i=1 to vary the stack) */}
                    {i === 1 && (
                      <div className="mb-4 space-y-2">
                        <div className="h-3 w-full rounded-full bg-[hsl(var(--kiddo-border)/0.55)]" />
                        <div className="h-3 w-3/4 rounded-full bg-[hsl(var(--kiddo-border)/0.55)]" />
                      </div>
                    )}
                    <div className="flex items-center gap-3">
                      <div className="h-9 w-9 shrink-0 rounded-full bg-[hsl(var(--kiddo-border)/0.55)]" />
                      <div className="min-w-0 flex-1 space-y-2">
                        <div className="h-3 w-24 rounded-full bg-[hsl(var(--kiddo-border)/0.55)]" />
                        <div className="h-2.5 w-16 rounded-full bg-[hsl(var(--kiddo-border)/0.4)]" />
                      </div>
                      <div className="h-4 w-14 rounded-full bg-[hsl(var(--kiddo-border)/0.55)]" />
                    </div>
                  </div>
                </div>
              </motion.div>
            ))}
          </motion.div>
        ) : sortedEntries.length === 0 ? (
          <motion.div
            key="memory-empty"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: DUR_FAST }}
          >
          <EnlighteningReveal delay={0.1}>
            <div className="space-y-7">
              {/* Empty state uses the unified <EmptyState> primitive
                  (built 2026-05-25 from the team-audit visual-system
                  recommendation). Same visual treatment + behavior as
                  before — kiddo-card wrapper, evergreen icon chip,
                  product-register title, two CTAs (Share + Write note).
                  Copy retoned 2026-05-19 per the Memory Book register
                  audit (was: "Story starts here" Hallmark-register;
                  now: literal heading, product-register, the emotion
                  comes when the first real gift lands not from the
                  empty state declaring there will be one). */}
              <EmptyState
                icon={BookOpen}
                title="Nothing here yet."
                description={
                  childName
                    ? `Gifts and notes for ${childName} land here as they arrive. Share the gift link to start.`
                    : `Gifts and notes land here as they arrive. Share the gift link to start.`
                }
                action={
                  <>
                    <Button
                      className="bg-[hsl(var(--kiddo-evergreen))] rounded-full text-white hover:bg-[hsl(var(--kiddo-evergreen)/0.92)]"
                      onClick={() => {
                        haptic("selection");
                        setLocation("/dashboard");
                      }}
                      data-testid="button-add-first-entry"
                    >
                      Share
                    </Button>
                    <Button
                      variant="outline"
                      className="rounded-full"
                      onClick={() => {
                        haptic("selection");
                        openFirstStoryPrompt();
                      }}
                      data-testid="button-add-first-note"
                    >
                      Write the first parent note
                    </Button>
                  </>
                }
                testId="memory-empty-state"
              />

              <section className="kiddo-card p-5">
                <p className="kiddo-section-label mb-4">What will appear</p>
                {/* Item list mirrors the filter row above the timeline
                    (All / Gifts / Milestones / Photos / Notes). If a
                    filter exists, an empty-state row for it should too
                    — otherwise the parent sees the filter chip with no
                    explanation of what it filters. Photos was the
                    missing one before 2026-05-18. */}
                <div className="grid gap-3 sm:grid-cols-2">
                  {[
                    { icon: Gift, title: "Every gift", body: "Who gave, how much, and when." },
                    { icon: MessageCircle, title: "Every note", body: "The message behind the money." },
                    { icon: Camera, title: "Photos & videos", body: "Captured moments and short clips." },
                    { icon: Star, title: "Growth milestones", body: "$100, $500, $1,000, and the moments after." },
                    { icon: Calendar, title: "Birthdays", body: "Annual snapshots of how the fund has grown." },
                  ].map((item) => {
                    const Icon = item.icon;
                    return (
                      <div key={item.title} className="flex gap-3 rounded-2xl border border-[hsl(var(--kiddo-border))] bg-white/75 p-3">
                        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[hsl(var(--kiddo-evergreen)/0.09)]">
                          <Icon size={18} className="text-[hsl(var(--kiddo-evergreen))]" />
                        </div>
                        <div>
                          <p className="text-sm font-bold text-foreground">{item.title}</p>
                          <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">{item.body}</p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </section>
            </div>
          </EnlighteningReveal>
          </motion.div>
        ) : (
          <motion.div
            key="memory-content"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: DUR_FAST }}
            className="relative"
            data-testid="timeline-container"
          >
            {/* Event Chapters — section header gates on the SAME filter
                used by the rail below so an empty filtered result hides
                the whole section (header included) instead of showing a
                lone label above an empty horizontal scroll. */}
            {fundEvents.some((e) => e.status === "active" && ((e.giftCount ?? 0) > 0 || e.imageUrl || e.description)) && (
              <div className="mb-6" data-testid="memory-event-chapters">
                <div className="flex items-center justify-between mb-3">
                  {/* Header renamed 2026-05-20 per the user-caught
                      taxonomy slip: "Emma's moments" → "Emma's
                      occasions". The 2026-05-13 occasions rename
                      ("event" → "occasion" across user-facing
                      surfaces) covered Pricing, Compare, FAQ,
                      EventCreate, Events, EventGateModal, Dashboard
                      event modal labels — but missed this Memory
                      Book event-strip header.

                      The conflation matters because the strip
                      directly below this header is "Capture a moment"
                      (milestone-capture chips: first steps, first
                      word, etc.). With both headers using "moment,"
                      the page read as "moments inside moments" —
                      two different concepts (gifting destinations
                      vs life events) sharing the same word.

                      Now: this header is "occasions" (locked
                      canonical product term for gifting events).
                      "Capture a moment" stays because "moment" is
                      the right warm word for milestone capture
                      once it's not competing with the occasions
                      header. Three distinct concepts, three
                      distinct words: occasions / moments / updates. */}
                  <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground/60">
                    {isOwnerMode ? "Your occasions" : childName ? `${childName}'s occasions` : "Occasions"}
                  </p>
                  {eventFilter && (
                    <button
                      type="button"
                      onClick={() => {
                        setEventFilter(null);
                        // Remove event param from URL without navigation
                        const next = new URL(window.location.href);
                        next.searchParams.delete("event");
                        window.history.replaceState({}, "", `${next.pathname}${next.search}`);
                      }}
                      className="text-[11px] font-semibold text-muted-foreground hover:text-foreground transition-colors flex items-center gap-1"
                    >
                      <X size={11} />
                      Show all
                    </button>
                  )}
                </div>
                <div className="flex gap-3 overflow-x-auto pb-2" style={{ scrollbarWidth: "none" }}>
                  {fundEvents
                    // Hide archived events from the default "occasions" strip —
                    // they pile up over years (every birthday, every grad,
                    // every "First car" rebrand) and clutter the surface a
                    // kid actually opens to read love letters. Active events
                    // (and the always-on "Gift anytime" with gifts) stay
                    // visible. If a parent really wants to revisit an
                    // archived event, the entry-type filter below + the
                    // sender filter still surface gifts attributed to it.
                    // Active events with no signals (no gifts, no image, no
                    // description) also stay hidden — empty cards are noise.
                    .filter((e) => e.status === "active" && ((e.giftCount ?? 0) > 0 || e.imageUrl || e.description))
                    .sort((a, b) => {
                      const ad = a.eventDate ? new Date(a.eventDate).getTime() : 0;
                      const bd = b.eventDate ? new Date(b.eventDate).getTime() : 0;
                      return bd - ad;
                    })
                    .map((evt) => {
                      const isActive = eventFilter === evt.id;
                      const raised = parseFloat(String(evt.giftVolume || "0"));
                      const giftCount = Number(evt.giftCount ?? 0);
                      const eventDateLabel = evt.eventDate
                        ? new Date(evt.eventDate).toLocaleDateString("en-US", { month: "short", year: "numeric", timeZone: "UTC" })
                        : null;
                      const typeEmoji: Record<string, string> = {
                        birthday: "🎂", graduation: "🎓", holiday: "🎄", baby_shower: "🍼", just_because: "💚", custom: "✨"
                      };
                      const emoji = typeEmoji[evt.eventType || ""] ?? "✨";
                      return (
                        <button
                          key={evt.id}
                          type="button"
                          onClick={() => {
                            haptic("selection");
                            setEventFilter(isActive ? null : evt.id);
                            if (!isActive) {
                              const next = new URL(window.location.href);
                              next.searchParams.set("event", evt.id);
                              window.history.replaceState({}, "", `${next.pathname}${next.search}`);
                            } else {
                              const next = new URL(window.location.href);
                              next.searchParams.delete("event");
                              window.history.replaceState({}, "", `${next.pathname}${next.search}`);
                            }
                          }}
                          style={{
                            flexShrink: 0,
                            width: 180,
                            borderRadius: 18,
                            overflow: "hidden",
                            border: isActive ? "2px solid hsl(var(--kiddo-evergreen))" : "1.5px solid hsl(var(--kiddo-border))",
                            background: "white",
                            cursor: "pointer",
                            textAlign: "left",
                            transition: "transform 0.12s, box-shadow 0.12s",
                            boxShadow: isActive
                              ? "0 0 0 3px hsl(var(--kiddo-evergreen)/0.18), 0 4px 16px rgba(26,23,16,0.10)"
                              : "0 1px 4px rgba(26,23,16,0.06)",
                          }}
                          onMouseDown={(e) => (e.currentTarget.style.transform = "scale(0.97)")}
                          onMouseUp={(e) => (e.currentTarget.style.transform = "scale(1)")}
                        >
                          {/* Cover image or gradient placeholder. object-position
                              honors the parent's pan/zoom framing intent saved
                              at upload time (event.imageFocalX / imageFocalY).
                              Defaults to center when focal point isn't set
                              (legacy events from before the focal-point ship). */}
                          <div style={{ height: 90, position: "relative", overflow: "hidden" }}>
                            {evt.imageUrl ? (() => {
                              const fx = (evt as any).imageFocalX != null ? Number((evt as any).imageFocalX) : 0.5;
                              const fy = (evt as any).imageFocalY != null ? Number((evt as any).imageFocalY) : 0.5;
                              const fxPct = Number.isFinite(fx) ? Math.max(0, Math.min(100, fx * 100)) : 50;
                              const fyPct = Number.isFinite(fy) ? Math.max(0, Math.min(100, fy * 100)) : 50;
                              return (
                                <img
                                  src={evt.imageUrl}
                                  // alt="" (decorative). The event name is already
                                  // rendered in the card body directly below this
                                  // image, so a meaningful alt attribute would
                                  // duplicate it for screen readers AND would
                                  // render as ghost text under the title when the
                                  // cover URL is broken/loading — visible as
                                  // "Emma's First Car / Emma's First Car" stacked
                                  // twice. Empty alt makes the image purely
                                  // decorative; broken images degrade to the
                                  // gradient placeholder cleanly.
                                  alt=""
                                  style={{
                                    width: "100%",
                                    height: "100%",
                                    objectFit: "cover",
                                    objectPosition: `${fxPct}% ${fyPct}%`,
                                  }}
                                />
                              );
                            })() : (
                              <div style={{
                                width: "100%", height: "100%",
                                background: isActive
                                  ? "linear-gradient(135deg, hsl(var(--kiddo-evergreen)/0.25), hsl(var(--kiddo-evergreen)/0.08))"
                                  : "linear-gradient(135deg, hsl(var(--kiddo-gold)/0.18), hsl(var(--kiddo-cream)))",
                                display: "flex", alignItems: "center", justifyContent: "center",
                                fontSize: 32,
                              }}>
                                {/* Permanent "Gift anytime" card renders the
                                    kid's identity (photo if set, first
                                    initial otherwise) instead of the
                                    generic ✨ fallback. Reason: every
                                    other card on this strip represents an
                                    OCCASION (birthday cake, grad cap,
                                    holiday tree). "Gift anytime" is the
                                    only card with no occasion — the
                                    "thing being celebrated" is just the
                                    kid existing. So the visual = the
                                    kid. Custom user-defined events keep
                                    the ✨ until they pick an icon. */}
                                {evt.isPermanent ? (
                                  fundData?.childPhotoUrl ? (
                                    <img
                                      src={fundData.childPhotoUrl}
                                      alt=""
                                      style={{
                                        width: 56, height: 56,
                                        borderRadius: "50%",
                                        objectFit: "cover",
                                        border: "2px solid white",
                                        boxShadow: "0 2px 8px rgba(26,23,16,0.18)",
                                      }}
                                    />
                                  ) : (
                                    <div style={{
                                      width: 56, height: 56,
                                      borderRadius: "50%",
                                      background: "hsl(var(--kora-gold))",
                                      color: "white",
                                      display: "flex", alignItems: "center", justifyContent: "center",
                                      fontSize: 26, fontWeight: 700,
                                      boxShadow: "0 2px 8px rgba(184,121,26,0.28)",
                                      letterSpacing: "-0.02em",
                                    }}>
                                      {(childName || "").charAt(0).toUpperCase() || "✨"}
                                    </div>
                                  )
                                ) : (
                                  emoji
                                )}
                              </div>
                            )}
                            <div style={{ position: "absolute", inset: 0, background: "linear-gradient(to top, rgba(26,23,16,0.5) 0%, transparent 55%)" }} />
                            {evt.status === "archived" && (
                              <div style={{
                                position: "absolute", top: 7, right: 7,
                                background: "rgba(26,23,16,0.55)", borderRadius: 6,
                                padding: "2px 6px", fontSize: 9, fontWeight: 700, color: "white", letterSpacing: "0.05em",
                              }}>
                                ARCHIVED
                              </div>
                            )}
                          </div>
                          {/* Card body */}
                          <div style={{ padding: "10px 12px 11px" }}>
                            <p style={{ fontSize: 12.5, fontWeight: 700, color: "hsl(var(--kiddo-ink))", lineHeight: 1.25, marginBottom: 2, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                              {evt.name}
                            </p>
                            {eventDateLabel && (
                              <p style={{ fontSize: 10.5, color: "rgba(26,23,16,0.45)", marginBottom: 5 }}>{eventDateLabel}</p>
                            )}
                            {evt.description && stripHtml(evt.description) && (
                              <p style={{ fontSize: 10.5, color: "rgba(26,23,16,0.55)", lineHeight: 1.4, marginBottom: 5, display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}>
                                {stripHtml(evt.description)}
                              </p>
                            )}
                            <p style={{ fontSize: 10.5, fontWeight: 600, color: "hsl(var(--kiddo-evergreen))" }}>
                              {giftCount > 0
                                ? `${giftCount} gift${giftCount === 1 ? "" : "s"} · $${raised.toLocaleString("en-US", { maximumFractionDigits: 0 })} raised`
                                : "No gifts yet"}
                            </p>
                          </div>
                        </button>
                      );
                    })}
                </div>
                {eventFilter && (
                  <div className="mt-3 rounded-2xl border border-[hsl(var(--kiddo-evergreen)/0.25)] bg-[hsl(var(--kiddo-evergreen)/0.05)] px-4 py-2.5">
                    {(() => {
                      const evt = fundEvents.find((e) => e.id === eventFilter);
                      if (!evt) return null;
                      return (
                        <div className="flex items-center justify-between gap-3">
                          <div className="min-w-0">
                            <p className="text-xs font-bold text-[hsl(var(--kiddo-evergreen))] truncate">{evt.name}</p>
                            {evt.description && stripHtml(evt.description) && (
                              <p className="text-[11px] text-muted-foreground mt-0.5 leading-relaxed line-clamp-2">{stripHtml(evt.description)}</p>
                            )}
                          </div>
                          <button
                            type="button"
                            onClick={() => {
                              setEventFilter(null);
                              const next = new URL(window.location.href);
                              next.searchParams.delete("event");
                              window.history.replaceState({}, "", `${next.pathname}${next.search}`);
                            }}
                            className="shrink-0 text-[11px] font-semibold text-muted-foreground hover:text-foreground whitespace-nowrap"
                          >
                            Clear filter
                          </button>
                        </div>
                      );
                    })()}
                  </div>
                )}
              </div>
            )}

            {shouldPromptFirstParentEntry && (
              <EnlighteningReveal delay={0.05}>
                <div className="mb-5 overflow-hidden rounded-3xl border border-[hsl(var(--kiddo-gold)/0.32)] bg-[linear-gradient(135deg,hsl(var(--kiddo-gold)/0.12),#fff_54%,hsl(var(--kiddo-evergreen)/0.06))] p-5 shadow-premium-sm" data-testid="memory-first-parent-prompt">
                  <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                    <div className="max-w-xl">
                      <p className="kiddo-section-label">First page</p>
                      <h3 className="mt-1 font-heading text-xl font-bold text-foreground">Add the first parent note</h3>
                      <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                        Gifts are already starting the story. Add the note you would want {childName || "them"} to read first, before this becomes just a list of transactions.
                      </p>
                    </div>
                    <Button
                      onClick={() => {
                        haptic("selection");
                        openFirstStoryPrompt();
                      }}
                      className="rounded-full"
                      data-testid="button-memory-first-parent-note"
                    >
                      Write first note
                    </Button>
                  </div>
                </div>
              </EnlighteningReveal>
            )}

            {/* Milestone capture quick-action strip. Owner-only
                (parent surface). Renders above the timeline so the
                parent sees the curated milestone library before
                they even hit the generic "+ Add entry" button. Each
                chip is a tappable starter that opens the composer
                pre-filled with the milestone label + entryType set
                to 'milestone' so the entry slots into the existing
                milestone filter. Photo/video/audio + Plus-gating
                handled by the composer's existing MemoryMediaPicker
                with requiresPlus=true.
                Locked 2026-05-18 per the Target-vs-Walmart
                positioning: the Memory Book at 18 is the canonical
                Target moat, and capturing actual childhood
                milestones (not just gifts) is what makes the book
                worth giving. The EarlyBird teardown flagged this
                gap explicitly. */}
            {isOwner && (
              <section className="kiddo-card mb-5 p-5" data-testid="memory-milestone-capture">
                <div className="flex items-baseline justify-between gap-3 mb-1">
                  <p className="kiddo-section-label">Capture a moment</p>
                  <span className="text-[10.5px] uppercase tracking-wide text-muted-foreground/60">
                    Saved for {childName || "them"} at {fundMajorityAge}
                  </span>
                </div>
                <p className="text-xs leading-relaxed text-muted-foreground mb-3">
                  Tap one. Add a date, a note, a photo. {childName || "They"}'ll read it later.
                </p>
                {/* Single-row horizontal scroll (was flex-wrap) —
                    locked 2026-05-19 per the chip-row layout audit.
                    10+ milestone-prompt chips wrapping into 3 rows of
                    unequal visual weight read as cluttered. One
                    scrollable row reads as Apple-keyboard-QuickType
                    suggestion bar: swipe through to pick. Each chip
                    gets shrink-0 so flex doesn't compress them.
                    Press feedback (active:scale-[0.97]) preserved
                    from 2026-05-18 polish — chips still squeeze on
                    tap before the composer sheet slides up. */}
                <div className="kiddo-h-scroll gap-2 -mx-1 px-1">
                  {milestoneLibrary.map((m) => (
                    <button
                      key={m.key}
                      type="button"
                      onClick={() => openMilestoneComposer(m.starter)}
                      className="inline-flex shrink-0 items-center gap-1 rounded-full border border-[hsl(var(--kiddo-evergreen)/0.18)] bg-[hsl(var(--kiddo-evergreen)/0.05)] px-3 py-1.5 text-[12px] font-medium text-foreground transition-[colors,transform] duration-150 hover:bg-[hsl(var(--kiddo-evergreen)/0.10)] hover:border-[hsl(var(--kiddo-evergreen)/0.35)] active:scale-[0.97]"
                      data-testid={`milestone-chip-${m.key}`}
                    >
                      {m.label}
                    </button>
                  ))}
                  <button
                    type="button"
                    onClick={() => openMilestoneComposer("")}
                    className="inline-flex shrink-0 items-center gap-1 rounded-full border border-dashed border-[hsl(var(--kiddo-border))] bg-card px-3 py-1.5 text-[12px] font-medium text-muted-foreground transition-[colors,transform] duration-150 hover:border-foreground/40 hover:text-foreground active:scale-[0.97]"
                    data-testid="milestone-chip-other"
                  >
                    + Other moment
                  </button>
                </div>
              </section>
            )}

            <section className="kiddo-card mb-5 overflow-hidden p-0" data-testid="memory-story-controls">
              {/* Stat tile grid removed — "$X total gifted" and "$X largest
                  gift" were admin-coded metrics on a surface that's supposed
                  to be the cinematic/emotional Memory Book (Mubi register
                  per the locked design lens). The total-gifted figure is
                  already carried by the Dashboard's lifetime stats row and
                  the Memory Book hero's "Built by N people · M gifts"
                  summary; the largest-gift number was trivia. Removing them
                  puts the entries themselves closer to the page top. */}

              {/* Gifter roster — owner-aware. Hidden from the parent's
                  Memory Book LIST view because the canonical parent
                  surface for community signal is the Dashboard's
                  "Who Loves [Child]" section (richer indicators: owner
                  badges, first-gifter ⭐, recent-gifter pulse, recurring
                  ↻, thanked ✓, per-gifter modal on tap). The Book View's
                  Village chapter still carries the full ceremonial
                  roster for the kid-at-18 read. Public viewers (gifters
                  visiting the shared Memory Book link) DO see this
                  strip — they have no dashboard access, so this is
                  their only path to the community context. Rule of
                  canonical surfaces: each piece of content has ONE
                  primary home; secondary surfaces show smaller versions
                  or are hidden for that audience. */}
              {gifterRoster.length > 0 && !isOwner && !authLoading && (!isAuthenticated || !!fundData) && (
                /* Ownership-resolved guard: `isOwner` (line ~2350) needs
                   fundData loaded to be correct — until then it's falsy, so
                   the owner briefly saw this "Who loves {child}" strip flash
                   in and then vanish once fundData resolved and it computed
                   `isOwner === true`. Only render once ownership is actually
                   known: a public/unauthenticated viewer is never the owner
                   (show immediately), but for an authenticated user we wait
                   for fundData (and for auth itself to settle) before
                   deciding. Eliminates the flash for the parent. */
                <div className="border-b border-border/70 px-4 py-4" data-testid="memory-gifter-roster">
                  <p className="kiddo-section-label mb-3">{isOwnerMode ? "Who loves you" : childName ? `Who loves ${childName}` : "Who gave"}</p>
                  <div className="flex gap-4 overflow-x-auto pb-1" style={{ scrollbarWidth: "none" }}>
                    {gifterRoster.map((gifter) => {
                      const isActive = gifterFilter?.toLowerCase() === gifter.name.toLowerCase();
                      // Owner treatment — same as every other surface
                      // (Dashboard sidebar, Memory Book list rows, book
                      // pages): profile photo when set, "(Dad)" suffix
                      // from preferredName, evergreen ring. Without this,
                      // the parent's tile in "Who loves Emma" looked like
                      // an external gifter's tile, which broke identity
                      // consistency the moment a parent contributed.
                      const ownerProfileImageUrl = gifter.isOwnerRow ? (user as any)?.profileImageUrl || null : null;
                      const ownerPreferredName = gifter.isOwnerRow ? (user as any)?.preferredName || null : null;
                      const firstName = gifter.name.split(" ")[0];
                      const labelName = gifter.isAnon
                        ? (gifter.anonPeople > 1 ? `${gifter.anonPeople} anon` : "Anon")
                        : (gifter.isOwnerRow && ownerPreferredName)
                          ? `${firstName} (${ownerPreferredName})`
                          : firstName;
                      return (
                        <button
                          key={gifter.name}
                          type="button"
                          onClick={() => setGifterFilter(isActive ? null : gifter.name)}
                          className="flex flex-col items-center gap-1.5 min-w-[64px] bg-transparent border-none p-0 cursor-pointer"
                        >
                          {ownerProfileImageUrl ? (
                            <div
                              className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full overflow-hidden transition-all"
                              style={{
                                boxShadow: isActive
                                  ? "0 0 0 2.5px hsl(var(--kiddo-evergreen))"
                                  : "0 0 0 2px hsl(var(--kiddo-evergreen)/0.55)",
                              }}
                            >
                              <img src={ownerProfileImageUrl} alt="" loading="lazy" className="h-full w-full object-cover" />
                            </div>
                          ) : (
                            <div
                              className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full text-base font-bold select-none transition-all"
                              style={{
                                background: isActive ? "hsl(var(--kiddo-evergreen))" : "hsl(var(--kiddo-evergreen)/0.10)",
                                color: isActive ? "white" : "hsl(var(--kiddo-evergreen))",
                                boxShadow: isActive ? "0 0 0 2.5px hsl(var(--kiddo-evergreen))" : "none",
                              }}
                            >
                              {gifter.name.slice(0, 1).toUpperCase()}
                            </div>
                          )}
                          <p className="text-[11px] font-semibold text-foreground text-center leading-tight w-[64px] truncate px-0.5">
                            {labelName}
                          </p>
                          <p className="text-[10px] font-bold text-[hsl(var(--kiddo-evergreen))] text-center">{displayAmount(gifter.totalAmount)}</p>
                          <p className="text-[9px] text-muted-foreground text-center">
                            {gifter.isAnon && gifter.anonPeople > 1
                              ? `${gifter.giftCount} gifts`
                              : gifter.giftCount === 1 ? "1 gift" : `${gifter.giftCount} gifts`}
                          </p>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* "Updates from {Owner}" promotional chapter removed from
                  the Memory Book list view. The quota indicator
                  ("4 of 4 this year · Cap reached · resets Jan 1") and the
                  send/view-all buttons read as SaaS dashboard chrome on a
                  surface that's supposed to be the kid's cinematic story.
                  The "Share update" CTA at the top of the page (in the
                  Memory Book hero block) still opens the same share modal,
                  preserving discoverability without putting quota tracking
                  above the entries. The share modal itself surfaces the
                  remaining-quota count contextually when it matters most
                  (composing a new update). */}

              <div className="space-y-3 p-4">
                {/* Three primary lenses — All / Pinned / Awaiting. Per
                    the Rule of Three at the surface: a parent should
                    answer "what am I looking at" in one glance. The
                    secondary type filters (Gifts / Milestones / Photos
                    / Notes) and full thanks-status options (Drafted /
                    Thanked) live behind "More filters" so they're not
                    competing for attention. Active state derives from
                    the underlying filter state — so a user toggling a
                    secondary filter still sees the right primary chip
                    light up.
                    NB: setting Pinned or Awaiting clears the other
                    primary lens; clicking All resets every filter so
                    the parent has a single "back to the whole story"
                    affordance. */}
                {(() => {
                  const isAwaiting = thankYouFilter === "awaiting";
                  const isPinned = featuredOnly && !isAwaiting;
                  const isAll = !isAwaiting && !isPinned && activeFilter === "all" && thankYouFilter === "all";
                  return (
                    <div className="flex flex-wrap gap-2" data-testid="memory-primary-filter-bar">
                      <button
                        onClick={() => {
                          setActiveFilter("all");
                          setThankYouFilter("all");
                          setFeaturedOnly(false);
                          setVisibleCount(10);
                        }}
                        className={`rounded-full px-4 py-1.5 text-xs font-semibold transition-[colors,transform] duration-150 active:scale-[0.97] ${
                          isAll
                            ? "bg-[hsl(var(--kiddo-evergreen))] text-white"
                            : "bg-[hsl(var(--kiddo-cream))] text-muted-foreground hover:bg-muted"
                        }`}
                        data-testid="button-memory-primary-all"
                      >
                        All
                      </button>
                      <button
                        onClick={() => {
                          if (isPinned) {
                            setFeaturedOnly(false);
                          } else {
                            setFeaturedOnly(true);
                            setThankYouFilter("all");
                          }
                          setVisibleCount(10);
                        }}
                        className={`rounded-full px-4 py-1.5 text-xs font-semibold transition-[colors,transform] duration-150 active:scale-[0.97] inline-flex items-center gap-1.5 ${
                          isPinned
                            ? "bg-amber-500 text-white"
                            : "bg-[hsl(var(--kiddo-cream))] text-muted-foreground hover:bg-muted"
                        }`}
                        data-testid="button-memory-primary-pinned"
                      >
                        <Pin size={12} /> Pinned
                      </button>
                      <button
                        onClick={() => {
                          if (isAwaiting) {
                            setThankYouFilter("all");
                          } else {
                            setThankYouFilter("awaiting");
                            setFeaturedOnly(false);
                            setActiveFilter("all");
                          }
                          setVisibleCount(10);
                        }}
                        className={`rounded-full px-4 py-1.5 text-xs font-semibold transition-[colors,transform] duration-150 active:scale-[0.97] ${
                          isAwaiting
                            ? "bg-[hsl(var(--kiddo-gold))] text-[hsl(var(--kiddo-ink))]"
                            : "bg-[hsl(var(--kiddo-cream))] text-muted-foreground hover:bg-muted"
                        }`}
                        data-testid="button-memory-primary-awaiting"
                      >
                        Awaiting thanks
                      </button>
                      <button
                        type="button"
                        onClick={() => setMoreFiltersOpen((v) => !v)}
                        className="ml-auto rounded-full px-3 py-1.5 text-[11px] font-semibold text-muted-foreground hover:text-foreground transition-colors inline-flex items-center gap-1"
                        data-testid="button-memory-more-filters"
                        aria-expanded={moreFiltersOpen}
                      >
                        {moreFiltersOpen ? "Hide filters" : "More filters"}
                        <span aria-hidden style={{ transform: moreFiltersOpen ? "rotate(180deg)" : "none", transition: "transform 0.18s" }}>↓</span>
                      </button>
                    </div>
                  );
                })()}

                {/* More filters disclosure — secondary type filter +
                    Drafted/Thanked thanks-status. Tucked behind a click
                    so the surface stays at three primary lenses unless
                    the parent opts in to power-user controls. */}
                {moreFiltersOpen && (
                  <div className="space-y-3 rounded-2xl border border-border/60 bg-background/40 px-3 py-3" data-testid="memory-more-filters">
                    <div className="flex flex-wrap gap-2" data-testid="memory-filter-bar">
                      <span className="text-[10.5px] font-bold uppercase tracking-wide text-muted-foreground self-center mr-1">Type:</span>
                      {[
                        { key: "all", label: "All" },
                        { key: "gift_message", label: "Gifts" },
                        { key: "milestone", label: "Milestones" },
                        { key: "photo", label: "Photos" },
                        { key: "note", label: "Notes" },
                      ].map((opt) => (
                        <button
                          key={opt.key}
                          onClick={() => setActiveFilter(opt.key as any)}
                          className={`rounded-full px-3 py-1 text-[11px] font-semibold transition-colors ${
                            activeFilter === opt.key
                              ? "bg-[hsl(var(--kiddo-evergreen))] text-white"
                              : "bg-[hsl(var(--kiddo-cream))] text-muted-foreground hover:bg-muted"
                          }`}
                          data-testid={`button-memory-filter-${opt.key}`}
                        >
                          {opt.label}
                        </button>
                      ))}
                    </div>
                    {(activeFilter === "all" || activeFilter === "gift_message") && (
                      <div className="flex flex-wrap gap-2" data-testid="memory-thankyou-filter-bar">
                        <span className="text-[10.5px] font-bold uppercase tracking-wide text-muted-foreground self-center mr-1">Thanks:</span>
                        {[
                          { key: "all", label: "All" },
                          { key: "awaiting", label: "Awaiting" },
                          { key: "drafted", label: "Drafted" },
                          { key: "thanked", label: "Thanked" },
                        ].map((opt) => (
                          <button
                            key={opt.key}
                            onClick={() => setThankYouFilter(opt.key as any)}
                            className={`rounded-full px-3 py-1 text-[11px] font-semibold transition-colors ${
                              thankYouFilter === opt.key
                                ? "bg-[hsl(var(--kiddo-gold))] text-[hsl(var(--kiddo-ink))]"
                                : "bg-[hsl(var(--kiddo-cream))] text-muted-foreground hover:bg-muted"
                            }`}
                            data-testid={`button-thankyou-filter-${opt.key}`}
                          >
                            {opt.label}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {/* Search on its own row (full width); year picker +
                    Story|Timeline + Read share a row below. Was a 4-column
                    grid that collapsed to 4 stacked rows on mobile (search,
                    year, segmented, read) — too much vertical chrome before
                    the entries. View-shaping affordances now group naturally
                    on a single row regardless of breakpoint, with flex-wrap
                    handling extreme-narrow widths gracefully. */}
                <div className="space-y-3">
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => {
                      setSearchQuery(e.target.value);
                      setVisibleCount(10);
                    }}
                    placeholder="Search names, notes, events..."
                    className="h-11 w-full rounded-2xl border border-border bg-background px-4 text-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
                    data-testid="input-memory-search"
                  />
                  <div className="flex flex-wrap items-center gap-2">
                    {/* Year picker hides when entries only span one year —
                        a brand-new fund doesn't need a year selector that
                        offers "All years" + "2026" as the only options. The
                        selector reappears automatically the moment the
                        Memory Book has entries from a second calendar year. */}
                    {yearOptions.length > 1 && (
                      <select
                        value={selectedYear}
                        onChange={(e) => setSelectedYear(e.target.value)}
                        className="h-11 rounded-2xl border border-border bg-background px-3 text-sm text-foreground"
                        data-testid="select-memory-year"
                      >
                        <option value="all">All years</option>
                        {yearOptions.map((year) => (
                          <option key={year} value={year}>{year}</option>
                        ))}
                      </select>
                    )}
                    {/* Story / Timeline segmented control — small polish
                        2026-05-25: added transition-colors so the bg + text
                        color swap on toggle reads as a soft transition not
                        an instant pop. Matches the considered-design register
                        of the rest of Memory Book. */}
                    <div className="flex h-11 rounded-2xl border border-border bg-background p-1">
                      <button
                        onClick={() => setViewMode("story")}
                        className={`rounded-xl px-3 text-sm font-semibold transition-colors duration-200 ${viewMode === "story" ? "bg-[hsl(var(--kiddo-evergreen))] text-white" : "text-muted-foreground hover:text-foreground"}`}
                      >
                        Story
                      </button>
                      <button
                        onClick={() => setViewMode("timeline")}
                        className={`rounded-xl px-3 text-sm font-semibold transition-colors duration-200 ${viewMode === "timeline" ? "bg-[hsl(var(--kiddo-evergreen))] text-white" : "text-muted-foreground hover:text-foreground"}`}
                      >
                        Timeline
                      </button>
                    </div>
                    {/* Book view entry — quietened 2026-05-19 per the
                        Memory Book register audit. Was a prominent gold
                        accent pill ("Read") that put the page-flip
                        reading experience front-and-center. The user
                        flagged Book View as feeling potentially
                        gimmicky; surfacing it as primary chrome made
                        every visitor wonder "what's this?" on cold
                        load. Now a small muted text link — still
                        discoverable, no longer demanding attention.
                        Power users who want the ceremony surface find
                        it; everyone else reads the timeline without
                        the side-eye. */}
                    <button
                      onClick={() => { haptic("medium"); setBookPageIndex(0); setBookSlideDirection(0); setBookOpen(true); }}
                      className="h-11 inline-flex items-center gap-1.5 px-2 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors"
                      data-testid="button-open-book-view"
                    >
                      <BookOpen size={12} />
                      Open as book
                    </button>
                  </div>
                </div>
              </div>
            </section>

            {gifterFilter && (
              <div className="mb-4 flex items-center gap-2 rounded-xl border border-[hsl(var(--kiddo-evergreen)/0.2)] bg-[hsl(var(--kiddo-evergreen)/0.06)] px-4 py-2.5">
                <span className="flex-1 text-sm font-semibold text-[hsl(var(--kiddo-evergreen))]">
                  Showing {gifterFilter.split(" ")[0]}'s gifts
                </span>
                <button
                  type="button"
                  onClick={() => setGifterFilter(null)}
                  className="text-xs font-semibold text-muted-foreground hover:text-foreground transition-colors"
                >
                  Clear
                </button>
              </div>
            )}

            {/* Bulk thank-you composer card — added 2026-05-25 to close
                the audit gap where a gifter who gave 6 gifts forced the
                parent to compose 6 separate thank-yous. Surfaces only
                when the parent filtered to a specific gifter AND that
                gifter has 2+ awaiting (unsent + non-anonymous + has
                email) thank-yous. Tapping unfolds the composer inline
                with the same warm/brief/formal/custom tone picker the
                per-gift composer uses, pre-populated with a multi-gift
                template that enumerates the count + total. Sends ONE
                consolidated email via POST /thank-yous/bulk-send. */}
            {(() => {
              if (!gifterFilter || gifterFilter.toLowerCase() === "anonymous") return null;
              // Find every thank-you row for this gifter that's unsent
              // AND has a reachable email. Anonymous + contactless are
              // excluded — they can't receive an email, so bulk-thanking
              // them is meaningless.
              const matchingRows = thankYouList.filter((ty: any) => {
                if (!ty?.senderName) return false;
                if (String(ty.status || "") === "sent") return false;
                const senderEmail = String(ty.senderEmail || "").trim();
                if (!senderEmail) return false;
                return String(ty.senderName || "").toLowerCase() === gifterFilter.toLowerCase();
              });
              if (matchingRows.length < 2) return null;
              const pendingGifts = matchingRows.map((ty: any) => ({
                amount: String(ty.giftAmount || ty.amount || "0"),
                createdAt: ty.createdAt ?? null,
              }));
              const totalAmount = pendingGifts.reduce((sum: number, g: any) => sum + (parseFloat(String(g.amount || "0")) || 0), 0);
              const senderFirst = gifterFilter.split(" ")[0];
              const ids = matchingRows.map((r: any) => r.id);
              return (
                <div
                  className="mb-4 rounded-2xl border border-[hsl(var(--kiddo-gold)/0.35)] bg-[hsl(var(--kiddo-gold)/0.06)] p-4"
                  data-testid="memory-bulk-thanks-card"
                >
                  {!bulkComposerOpen ? (
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-semibold text-foreground">
                          Thank {senderFirst} for all {matchingRows.length} gifts at once
                        </p>
                        <p className="mt-0.5 text-xs text-muted-foreground">
                          ${totalAmount.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} across {matchingRows.length} gifts. One email instead of {matchingRows.length}.
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          haptic("selection");
                          setBulkComposerOpen(true);
                          setBulkComposerTone("warm");
                          setBulkComposerMessage(buildBulkThankYouMessage("warm", gifterFilter, pendingGifts));
                        }}
                        className="shrink-0 rounded-full bg-[hsl(var(--kiddo-evergreen))] px-4 py-2 text-xs font-semibold text-white hover:opacity-90 transition-opacity"
                        data-testid="button-bulk-thanks-open"
                      >
                        Open bulk composer →
                      </button>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="text-sm font-semibold text-foreground">
                            Thanking {senderFirst} for {matchingRows.length} gifts (${totalAmount.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })})
                          </p>
                          <p className="mt-0.5 text-xs text-muted-foreground">
                            One consolidated email. Marks all {matchingRows.length} as thanked at once.
                          </p>
                        </div>
                        <button
                          type="button"
                          onClick={() => { setBulkComposerOpen(false); setBulkComposerMessage(""); }}
                          className="shrink-0 text-xs font-semibold text-muted-foreground hover:text-foreground transition-colors"
                        >
                          Cancel
                        </button>
                      </div>
                      <div className="flex flex-wrap gap-1.5">
                        {(["warm", "brief", "formal", "custom"] as const).map((tone) => (
                          <button
                            key={tone}
                            type="button"
                            onClick={() => {
                              setBulkComposerTone(tone);
                              setBulkComposerMessage(buildBulkThankYouMessage(tone, gifterFilter, pendingGifts));
                            }}
                            className={`rounded-full px-3 py-1 text-[11px] font-semibold capitalize transition-colors ${bulkComposerTone === tone ? "bg-[hsl(var(--kiddo-evergreen))] text-white" : "border border-border text-muted-foreground hover:text-foreground"}`}
                            data-testid={`button-bulk-thanks-tone-${tone}`}
                          >
                            {tone}
                          </button>
                        ))}
                      </div>
                      <textarea
                        value={bulkComposerMessage}
                        onChange={(e) => {
                          setBulkComposerMessage(e.target.value);
                          if (bulkComposerTone !== "custom") setBulkComposerTone("custom");
                        }}
                        rows={bulkComposerTone === "custom" ? 6 : 8}
                        placeholder={bulkComposerTone === "custom" ? `Write your own message to ${senderFirst}...` : undefined}
                        className="w-full rounded-xl border border-border bg-background px-3 py-2.5 text-sm leading-relaxed text-foreground outline-none focus:border-[hsl(var(--kiddo-evergreen))]"
                        data-testid="textarea-bulk-thanks-message"
                      />
                      <button
                        type="button"
                        onClick={() => handleSendBulkThankYou(ids)}
                        disabled={sendingBulkThankYou || !bulkComposerMessage.trim()}
                        className="w-full rounded-xl bg-[hsl(var(--kiddo-evergreen))] py-2.5 text-sm font-semibold text-white hover:opacity-90 transition-opacity disabled:opacity-50"
                        data-testid="button-bulk-thanks-send"
                      >
                        {sendingBulkThankYou ? "Sending..." : `Send to ${senderFirst}`}
                      </button>
                    </div>
                  )}
                </div>
              );
            })()}

            {filteredEntries.length === 0 ? (() => {
              // Context-aware empty state — the message changes based on
              // WHAT the parent filtered for, so they always read why this
              // is empty + whether emptiness is good or bad. The Awaiting=0
              // case is the most important: that's a CELEBRATION (every
              // reachable gifter thanked), not a "nothing here" failure
              // signal. Generic copy lost that distinction.
              type EmptyShape = { icon: string; title: string; subtitle: string; tone: "celebratory" | "neutral" };
              const empty: EmptyShape = (() => {
                if (searchQuery.trim()) {
                  return {
                    icon: "🔍",
                    title: `No matches for "${searchQuery.trim()}"`,
                    subtitle: "Try a shorter search, or clear it to see the full Memory Book.",
                    tone: "neutral",
                  };
                }
                if (gifterFilter) {
                  const name = gifterFilter.toLowerCase() === "anonymous" ? "anonymous gifters" : gifterFilter.split(" ")[0];
                  return {
                    icon: "🌱",
                    title: `Nothing from ${name} matches.`,
                    subtitle: "Try a different filter, or clear it to see every story.",
                    tone: "neutral",
                  };
                }
                if (thankYouFilter === "awaiting") {
                  return {
                    icon: "🌱",
                    title: childName ? `Caught up on thanks for ${childName}.` : "Caught up on thanks.",
                    subtitle: "Every reachable gifter has been thanked. (Anonymous gifters can't be reached, so they don't need to count.)",
                    tone: "celebratory",
                  };
                }
                if (thankYouFilter === "thanked") {
                  return {
                    icon: "💌",
                    title: "No thanks sent yet.",
                    subtitle: "When you send your first thank-you, it shows up here.",
                    tone: "neutral",
                  };
                }
                if (thankYouFilter === "drafted") {
                  return {
                    icon: "✏️",
                    title: "No drafts in progress.",
                    subtitle: "Thank-you drafts you save and come back to live here.",
                    tone: "neutral",
                  };
                }
                if (activeFilter === "photo") {
                  return {
                    icon: "📷",
                    title: isOwnerMode ? "No photos in your book yet." : childName ? `No photos in ${childName}'s book yet.` : "No photos yet.",
                    subtitle: "Add a photo memory or attach one when you invest.",
                    tone: "neutral",
                  };
                }
                if (activeFilter === "milestone") {
                  return {
                    icon: "🌟",
                    title: "First milestone is on its way.",
                    subtitle: isOwnerMode ? "Each $X crossing in your fund will celebrate here." : childName ? `Each $X crossing in ${childName}'s fund will celebrate here.` : "Each $X crossing in the fund will celebrate here.",
                    tone: "neutral",
                  };
                }
                if (activeFilter === "note") {
                  return {
                    icon: "✏️",
                    title: isOwnerMode ? "No memories written for you yet." : childName ? `No memories written for ${childName} yet.` : "No memories written yet.",
                    subtitle: "First steps. First words. First day of school. The moments that matter live here.",
                    tone: "neutral",
                  };
                }
                if (activeFilter === "gift_message") {
                  return {
                    icon: "🎁",
                    title: isOwnerMode ? "No gifts in your book yet." : childName ? `No gifts in ${childName}'s book yet.` : "No gifts yet.",
                    subtitle: "Share the gift link to get the first one in.",
                    tone: "neutral",
                  };
                }
                if (featuredOnly) {
                  return {
                    icon: "📌",
                    title: "Nothing pinned yet.",
                    subtitle: "Pin the moments you want at the top of the Memory Book.",
                    tone: "neutral",
                  };
                }
                if (selectedYear !== "all") {
                  return {
                    icon: "📅",
                    title: `Nothing in ${selectedYear} yet.`,
                    subtitle: "Try another year, or clear the filter to see the full story.",
                    tone: "neutral",
                  };
                }
                return {
                  icon: "🌱",
                  title: "Nothing here in this view.",
                  subtitle: isOwnerMode ? "Try a different filter, or clear them all to see your full story." : childName ? `Try a different filter, or clear them all to see ${childName}'s full story.` : "Try a different filter, or clear them all to see the full story.",
                  tone: "neutral",
                };
              })();
              const isCelebratory = empty.tone === "celebratory";
              return (
                <div
                  className={`mb-5 md:mb-6 rounded-2xl px-4 py-7 md:py-8 text-center ${isCelebratory ? "border border-[hsl(var(--kiddo-evergreen)/0.22)] bg-[hsl(var(--kiddo-evergreen)/0.05)]" : "border border-border/50 bg-card"}`}
                  data-testid="empty-filtered-memory"
                >
                  <div className="text-3xl leading-none mb-2.5" aria-hidden>{empty.icon}</div>
                  <p className={`text-sm font-semibold ${isCelebratory ? "text-[hsl(var(--kiddo-evergreen))]" : "text-foreground"}`}>
                    {empty.title}
                  </p>
                  <p className="mt-1.5 text-xs text-muted-foreground leading-relaxed max-w-sm mx-auto">
                    {empty.subtitle}
                  </p>
                </div>
              );
            })() : (
              <div className="mb-4 flex items-center gap-3">
                <p className="text-[11px] font-bold uppercase tracking-[0.10em] text-muted-foreground/50">
                  {viewMode === "timeline" ? "Timeline" : "Story"}
                </p>
                <div className="flex-1 h-px bg-border/40" />
                <p className="text-[11px] text-muted-foreground/40">{filteredEntries.length} {filteredEntries.length === 1 ? "entry" : "entries"}</p>
              </div>
            )}

            {viewMode === "timeline" ? (
              <div className="space-y-6">
                {groupedTimeline.map(([month, monthEntries]) => (
                  <div key={month}>
                    {/* Sticky month divider — stacks below AppHeader (58px)
                        and stays pinned while you scan that month's entries.
                        Standard iOS Mail / Photos pattern. The next month's
                        header pushes this one up and out as you scroll past.
                        Backdrop-blur so content doesn't bleed through. */}
                    <h4
                      className={`sticky top-[58px] z-20 -mx-4 px-4 py-2 mb-3 text-[11px] font-bold uppercase tracking-[0.10em] backdrop-blur-md bg-background/85 border-b border-border/30 ${
                        month === "The Beginning" ? "text-[hsl(var(--kiddo-gold-ink))]" : "text-muted-foreground/70"
                      }`}
                    >
                      {month}
                    </h4>
                    <div className="space-y-2">
                      {monthEntries.map((entry) => {
                        const isGift = entry.type === "gift_message";
                        const config = typeConfig[entry.type] || typeConfig.note;
                        const amount = isGift && entry.gift?.amount ? parseFloat(entry.gift.amount) : 0;
                        // Unified identity — same helper used by Story
                        // view list rows and BookPage. Owner gets profile
                        // photo + "(Dad)" suffix; gifters get titleCased
                        // names + deterministic gifterColor; anonymous +
                        // test-pattern senders bucket as "Anonymous". No
                        // surface gets to drift its own logic.
                        const ownerCtx = {
                          emailLower: ownerEmailLowerForMemory,
                          profileImageUrl: (user as any)?.profileImageUrl || null,
                          preferredName: (user as any)?.preferredName || null,
                          firstName: (user as any)?.firstName || null,
                        };
                        const ident = getEntryIdentity(entry, ownerCtx);
                        const rawNote = isGift ? entry.gift?.message : entry.content;
                        const noteText = isMemoryBookSuppressedMessage(rawNote) ? null : rawNote;
                        const ticker = isGift ? entry.gift?.selectedTicker : null;
                        const exec = isGift ? entry.gift?.executionModel : null;
                        const eventName = isGift ? entry.gift?.eventName : null;
                        const isCashExec = exec === "family" || exec === "cash";
                        const investLine = ticker ? ticker : isCashExec ? "Cash" : null;
                        // Media indicator — Gmail-paperclip pattern. Timeline
                        // is the scan view; Story is the see-it view. A small
                        // muted icon next to the date lets the parent (or
                        // Emma at 18) skim and know "this row has a voice
                        // note from grandma" without expanding everything.
                        // ONE icon per row by priority: voice (the moat per
                        // the design lens) → video → photo. Multi-icon soup
                        // would fight Timeline's whole job. Notes have their
                        // text already rendered via noteText so they don't
                        // need an indicator.
                        const giftPhotoUrl = isGift ? entry.gift?.photoUrl : null;
                        const photoUrl = (entry as any).photoUrl || giftPhotoUrl || null;
                        const audioUrl = (entry as any).audioUrl || null;
                        const videoUrl = (entry as any).videoUrl || null;
                        const mediaKind: "voice" | "video" | "photo" | null =
                          audioUrl ? "voice" : videoUrl ? "video" : photoUrl ? "photo" : null;
                        const avatarBgClass = ident.avatarStyle === "owner"
                          ? "bg-[hsl(var(--kiddo-evergreen))]"
                          : ident.avatarStyle === "anonymous"
                            ? "bg-[hsl(var(--kiddo-gold)/0.55)]"
                            : ident.avatarStyle === "system"
                              ? "bg-[hsl(var(--kiddo-gold))]"
                              : ""; // gifter uses inline gifterBg
                        return (
                          <div
                            key={entry.id}
                            data-testid={`memory-entry-${entry.id}`}
                            className="rounded-2xl border border-border/50 bg-card px-3 py-3 flex items-center gap-3"
                            style={getDeepLinkHighlightCardStyle(highlightedEntryId === String(entry.id))}
                          >
                            <div
                              className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-sm font-bold text-white overflow-hidden ${avatarBgClass}`}
                              style={ident.avatarStyle === "gifter" && ident.gifterBg ? { background: ident.gifterBg } : undefined}
                            >
                              {ident.profileImageUrl
                                ? <img src={ident.profileImageUrl} alt="" loading="lazy" className="h-full w-full object-cover" />
                                : ident.avatarLetter}
                            </div>
                            <div className="min-w-0 flex-1">
                              <div className="flex flex-wrap items-center gap-1.5">
                                <p className="text-sm font-semibold text-foreground truncate">{ident.displayName}</p>
                                <span className={`rounded-full px-2 py-0.5 text-[9px] font-bold uppercase tracking-[0.08em] ${isGift ? "bg-[hsl(var(--kiddo-evergreen)/0.10)] text-[hsl(var(--kiddo-evergreen))]" : "bg-muted text-muted-foreground"}`}>
                                  {config.label}
                                </span>
                                {investLine && (
                                  <span className="rounded-full bg-muted px-2 py-0.5 text-[9px] font-bold uppercase tracking-[0.08em] text-muted-foreground">
                                    {investLine}
                                  </span>
                                )}
                                {eventName && (
                                  <span className="rounded-full bg-[hsl(var(--kiddo-gold)/0.12)] px-2 py-0.5 text-[9px] font-bold text-[hsl(var(--kiddo-gold-ink))]">
                                    {eventName}
                                  </span>
                                )}
                              </div>
                              {noteText ? (
                                <p className="text-xs text-muted-foreground truncate mt-0.5">&ldquo;{noteText}&rdquo;</p>
                              ) : null}
                              <p className="text-[10px] text-muted-foreground/60 mt-0.5 flex items-center gap-1.5">
                                <span>{formatDate(entry.createdAt)}</span>
                                {/* Media indicator. Voice (the moat) gets a
                                    soft gold tint to honor its design-lens
                                    status; video + photo stay muted-gray
                                    so the icon reads as quiet metadata,
                                    not decoration. Title attribute carries
                                    the long-form name for accessibility. */}
                                {mediaKind === "voice" && (
                                  <span title="Voice note" aria-label="Voice note" style={{ color: "hsl(var(--kiddo-gold))", display: "inline-flex" }}>
                                    <Mic size={11} />
                                  </span>
                                )}
                                {mediaKind === "video" && (
                                  <span title="Video" aria-label="Video" style={{ color: "rgba(26,23,16,0.55)", display: "inline-flex" }}>
                                    <Video size={11} />
                                  </span>
                                )}
                                {mediaKind === "photo" && (
                                  <span title="Photo" aria-label="Photo" style={{ color: "rgba(26,23,16,0.55)", display: "inline-flex" }}>
                                    <Camera size={11} />
                                  </span>
                                )}
                              </p>
                            </div>
                            {isGift ? (
                              <span className="shrink-0 rounded-xl bg-[hsl(var(--kiddo-evergreen)/0.08)] px-2.5 py-1 text-sm font-bold text-[hsl(var(--kiddo-evergreen))]">
                                ${amount.toFixed(2)}
                              </span>
                            ) : null}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="relative">
            <div className="hidden sm:block absolute left-[19px] top-[12px] bottom-0 w-[2px] bg-[linear-gradient(to_bottom,hsl(var(--kiddo-gold)/0.35),hsl(var(--kiddo-evergreen)/0.18),transparent)]" />

            {visibleEntries.map((entry, index) => {
              const config = typeConfig[entry.type] || typeConfig.note;
              const IconComp = config.icon;
              const embeddedVideo = getEmbedVideoUrl(entry.videoUrl);
              // Unified identity for non-gift entries (parent_note,
              // note, parent_investment_start). Same helper as the
              // Timeline view + BookPage so a parent's "test for
              // recurring" or any real note ALWAYS renders with the
              // parent's profile photo + "(Dad)" suffix — never with
              // a colored letter avatar fallback. The gift_message
              // path still has its own iife further down because it
              // also needs ticker / shares / value data; that path
              // already uses the same identity rules.
              const memoryOwnerCtx = {
                emailLower: ownerEmailLowerForMemory,
                profileImageUrl: (user as any)?.profileImageUrl || null,
                preferredName: (user as any)?.preferredName || null,
                firstName: (user as any)?.firstName || null,
              };
              const memoryIdent = getEntryIdentity(entry, memoryOwnerCtx);
              const memoryNoteText = isMemoryBookSuppressedMessage(entry.content) ? null : entry.content;

              // Skip the staggered fade-in entirely when a deep-link is in
              // flight. Otherwise, deep-linking to row 20 makes the user wait
              // ~1s for that row's stagger to play out, AND watch rows 1-19
              // animate past on the way down — the page reads as "still
              // loading" when we want it to read as "you've arrived." The
              // shared `hasActiveDeepLink()` is read once per render so it's
              // consistent across rows in the same paint.
              const skipReveal = !!highlightedEntryId;
              const isHighlighted = highlightedEntryId === String(entry.id);
              const isFirstExternalGift = firstExternalGiftEntryId !== null && String(entry.id) === firstExternalGiftEntryId;
              return (
                <EnlighteningReveal key={entry.id} delay={skipReveal ? 0 : index * 0.05}>
                  {/* No highlight on this outer wrapper — it holds the
                      timeline-gutter padding (sm:pl-12), and washing that in
                      gold would highlight the gutter + dot too. The highlight
                      goes on the inner card (motion.div below).

                      layout prop (2026-05-18 motion audit) makes the entry
                      animate to its new Y when the filter chip changes
                      (e.g. "All" → "Pinned" removes intermediate rows,
                      remaining rows now slide up to fill the gap instead
                      of jump-cutting). DUR_FAST so the reflow doesn't
                      drag. Reduced-motion bails entirely via the layout
                      prop being false. */}
                  <motion.div
                    layout={prefersReducedMotion ? false : "position"}
                    transition={{ duration: DUR_FAST, ease: EASE_DECEL }}
                    className="relative pl-0 sm:pl-12 pb-6 md:pb-8"
                    data-testid={`memory-entry-${entry.id}`}
                  >
                    {/* "Where it began" ribbon — celebrates the chronologically
                        earliest external gift, the moment the fund became real.
                        Mirrors Activity's "first-gift" banner but with extra
                        emphasis since Memory Book is the long-term emotional
                        surface. Only renders on the one matching entry; every
                        other entry skips this entirely. */}
                    {isFirstExternalGift && (
                      <div
                        className="mb-3 sm:ml-12 rounded-2xl border border-[hsl(var(--kiddo-gold)/0.42)] bg-[linear-gradient(135deg,hsl(var(--kiddo-gold)/0.16)_0%,hsl(var(--kiddo-cream))_55%,hsl(var(--kiddo-gold)/0.10)_100%)] px-4 py-3"
                        data-testid={`first-gift-ribbon-${entry.id}`}
                      >
                        <div className="flex items-center gap-2.5">
                          <span className="text-lg leading-none" aria-hidden>🌱</span>
                          <div className="min-w-0 flex-1">
                            <p className="text-[10.5px] font-bold uppercase tracking-[0.10em] text-[hsl(var(--kiddo-gold-ink))] leading-tight">
                              Where it began
                            </p>
                            <p className="text-[12px] text-[rgb(95,85,72)] leading-snug mt-0.5">
                              The moment {isOwnerMode ? "your" : childName ? `${childName}'s` : "the"} fund became real.
                            </p>
                          </div>
                        </div>
                      </div>
                    )}
                    {(() => {
                      const dotStyle = entry.type === "gift_message" && entry.gift?.senderName
                        ? { background: gifterColor(entry.gift.senderName).bg }
                        : undefined;
                      return (
                        <div
                          className={`hidden sm:flex absolute left-[12px] top-1 w-[16px] h-[16px] rounded-full border-2 border-background z-10 items-center justify-center ${dotStyle ? "" : config.dotColor}`}
                          style={dotStyle}
                        >
                          <div className="w-[6px] h-[6px] rounded-full bg-white/80" />
                        </div>
                      );
                    })()}

                    {/* Per-type card treatment added 2026-05-25 Sprint 2.
                        Previously every Memory Book entry used the same
                        bg-card / kiddo-border combination regardless of
                        type. A scrolling list of mixed types (gifts,
                        milestones, photos, notes, parent letters) read
                        as a stack of identical rectangles with content
                        differentiating them. Now each type gets a
                        BARELY-THERE bg tint + a slightly heavier left-
                        edge accent in the type's palette so the eye
                        instantly identifies what each entry is before
                        reading the content.
                        Discipline: tints are <= 0.05 opacity so the
                        differentiation is felt not seen. No per-type
                        color borders (would compete with the existing
                        timeline-gutter dot); the accent goes on the
                        inside-left of the card via a 3px box-shadow
                        inset that respects the rounded corners. */}
                    <motion.div
                      className="relative overflow-hidden rounded-3xl border border-[hsl(var(--kiddo-border)/0.82)] bg-card"
                      style={(() => {
                        const baseStyle = getDeepLinkHighlightCardStyle(
                          isHighlighted,
                          "0 1px 3px rgba(26,23,16,0.06), 0 14px 34px rgba(26,23,16,0.07)",
                        );
                        // Per-type tint + left-rail accent. The rail is
                        // a 3px colored strip on the inside-left of the
                        // card; the bg tint is a soft wash. Both come
                        // from the brand palette (evergreen / gold)
                        // routed through the existing typeConfig.dotColor
                        // semantics for consistency.
                        const accent = (() => {
                          switch (entry.type) {
                            case "gift_message":
                              return { tint: "hsl(var(--kiddo-evergreen)/0.025)", rail: "hsl(var(--kiddo-evergreen)/0.55)" };
                            case "milestone":
                            case "memory_milestone_added":
                              return { tint: "hsl(var(--kiddo-gold)/0.05)", rail: "hsl(var(--kiddo-gold)/0.75)" };
                            case "parent_note":
                              return { tint: "hsl(var(--kiddo-gold)/0.035)", rail: "hsl(var(--kiddo-gold)/0.55)" };
                            case "parent_investment_start":
                              return { tint: "hsl(var(--kiddo-evergreen)/0.035)", rail: "hsl(var(--kiddo-evergreen)/0.55)" };
                            default:
                              return null;
                          }
                        })();
                        if (!accent) return baseStyle;
                        return {
                          ...baseStyle,
                          background: accent.tint,
                          boxShadow: `inset 3px 0 0 0 ${accent.rail}, ${(baseStyle as any).boxShadow ?? "0 1px 3px rgba(26,23,16,0.06), 0 14px 34px rgba(26,23,16,0.07)"}`,
                        };
                      })()}
                      // Hover lift bumped from y:-1 to y:-2 with a soft
                      // shadow build — matches Dashboard's card hover
                      // language. Subtle, not bouncy. Adds a "this is
                      // alive" feel on desktop without disturbing the
                      // mobile read.
                      whileHover={{ y: -2, boxShadow: "0 2px 6px rgba(26,23,16,0.07), 0 18px 42px rgba(26,23,16,0.10)" }}
                      transition={{ duration: DUR_FAST, ease: EASE_DECEL }}
                    >
                      <div className="flex flex-col gap-3 border-b border-border/50 bg-[hsl(var(--kiddo-cream)/0.42)] px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
                        <div className="flex flex-wrap items-center gap-1.5">
                          {entry.isFeatured ? (
                            <span className="rounded-full bg-amber-100 px-2.5 py-1 text-[10px] font-bold text-amber-800 inline-flex items-center gap-1">
                              <Pin size={10} /> Pinned
                            </span>
                          ) : null}
                          {/* Visibility chip removed — the action button below
                              shows the current state with its icon + label
                              (Globe / "Public", Users / "Family", Lock /
                              "Private"), so a separate read-only chip
                              ("Anyone with link") was duplicating the same
                              signal in two places. The owner button is the
                              source of truth; for non-owners the visibility
                              of an entry isn't actionable info anyway —
                              they're seeing it because they have access. */}
                          {entry.mediaStatus === "broken" ? (
                            <span className="rounded-full bg-red-100 px-2.5 py-1 text-[10px] font-bold text-red-700">Broken media</span>
                          ) : null}
                        </div>
                        {/* Owner controls collapsed into a single kebab.
                            Pin / Public-Family-Private cycle / Edit / Delete
                            previously rendered as four chips inline on every
                            entry — chrome that crowded out the entry's
                            actual content. The kebab keeps every control
                            one tap away (the standard iOS/web affordance
                            every user already knows) without painting it
                            on every single row. Memory Book per the design
                            lens is Mubi-emotional, not a control panel. */}
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <button
                              type="button"
                              aria-label="Memory entry actions"
                              data-testid={`button-actions-memory-${entry.id}`}
                              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-muted-foreground/65 hover:bg-muted hover:text-foreground transition-colors"
                            >
                              <MoreVertical size={16} />
                            </button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="w-52">
                            <DropdownMenuItem
                              onSelect={async (e) => {
                                e.preventDefault();
                                try {
                                  await updateEntryMeta(entry.id, { isFeatured: !entry.isFeatured });
                                  haptic("success");
                                  toast({ title: entry.isFeatured ? "Unpinned" : "Pinned to top" });
                                } catch {
                                  toast({ title: "Could not update", variant: "destructive" });
                                }
                              }}
                              data-testid={`menu-feature-memory-${entry.id}`}
                            >
                              <Pin size={14} className="mr-2" />
                              {entry.isFeatured ? "Unpin from top" : "Pin to top"}
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onSelect={async (e) => {
                                e.preventDefault();
                                const order: Array<"public" | "family" | "private"> = ["public", "family", "private"];
                                const current = (entry.visibility || "public") as "public" | "family" | "private";
                                const next = order[(order.indexOf(current) + 1) % order.length];
                                const labels: Record<string, string> = { public: "Anyone with link", family: "Family only", private: "Private" };
                                try {
                                  await updateEntryMeta(entry.id, { visibility: next });
                                  haptic("selection");
                                  toast({ title: `Visibility: ${labels[next]}` });
                                } catch {
                                  toast({ title: "Could not update", variant: "destructive" });
                                }
                              }}
                              data-testid={`menu-visibility-memory-${entry.id}`}
                            >
                              {entry.visibility === "private" ? <Lock size={14} className="mr-2" /> : entry.visibility === "family" ? <Users size={14} className="mr-2" /> : <Globe size={14} className="mr-2" />}
                              <span className="flex-1">Visibility</span>
                              <span className="text-xs text-muted-foreground">
                                {entry.visibility === "private" ? "Private" : entry.visibility === "family" ? "Family" : "Public"}
                              </span>
                            </DropdownMenuItem>
                            {entry.type !== "gift_message" ? (
                              <>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem
                                  onSelect={(e) => { e.preventDefault(); openEditModal(entry); }}
                                  data-testid={`menu-edit-memory-${entry.id}`}
                                >
                                  <Pencil size={14} className="mr-2" />
                                  Edit
                                </DropdownMenuItem>
                                <DropdownMenuItem
                                  onSelect={(e) => {
                                    e.preventDefault();
                                    if (!window.confirm("Delete this memory entry?")) return;
                                    deleteMutation.mutate(entry.id);
                                  }}
                                  className="text-red-600 focus:text-red-600"
                                  data-testid={`menu-delete-memory-${entry.id}`}
                                >
                                  <Trash2 size={14} className="mr-2" />
                                  Delete
                                </DropdownMenuItem>
                              </>
                            ) : (
                              <>
                                {/* Report-content affordance for gifter-submitted
                                    entries. Closes Apple App Store guideline 1.2
                                    requirement (UGC apps must have a report mechanism)
                                    and the "reporting OPEN" gap flagged in
                                    project_child_safety_architecture.md. Mailto pattern
                                    mirrors Activity.tsx's transaction-issue reports —
                                    uses the locked support@kiddofund.com escalation
                                    path. Server-side T&S queue work (POST /api/reports +
                                    admin moderation) exists per project_ts_queue_architecture.md;
                                    a future polish pass could wire this menu item to
                                    that structured endpoint instead of mailto. */}
                                <DropdownMenuSeparator />
                                <DropdownMenuItem
                                  onSelect={(e) => {
                                    e.preventDefault();
                                    const sender = entry.gift?.senderName || "anonymous gifter";
                                    const dateStr = entry.createdAt
                                      ? new Date(entry.createdAt).toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })
                                      : "(date unavailable)";
                                    const subject = `Report a Memory Book entry · from ${sender}`;
                                    const body = [
                                      `Hi Kiddo team,`,
                                      ``,
                                      `I want to report a Memory Book entry:`,
                                      ``,
                                      `From: ${sender}`,
                                      `Date: ${dateStr}`,
                                      `Entry ID: ${entry.id}`,
                                      fundId ? `Fund ID: ${fundId}` : "",
                                      ``,
                                      `What's wrong: `,
                                      ``,
                                    ].filter(Boolean).join("\n");
                                    window.location.href = `mailto:support@kiddofund.com?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
                                  }}
                                  data-testid={`menu-report-memory-${entry.id}`}
                                >
                                  <AlertCircle size={14} className="mr-2" />
                                  Report this content
                                </DropdownMenuItem>
                              </>
                            )}
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                      {entry.type === "gift_message" && entry.gift && (() => {
                        // Memory Book inversion (gift edition): when the gifter
                        // wrote a note, that note IS the entry — pulled to the
                        // top, large, italic, quoted. Sender + date + tags +
                        // amount become attribution metadata at the bottom of
                        // the card. When there's no note, the metadata IS the
                        // entry — single compact row, no fake-warm headline.
                        // The amount stays prominent in the metadata row because
                        // a gift's generosity is part of the story, but it no
                        // longer competes with the note for visual hierarchy.
                        const gc = gifterColor(entry.gift.senderName || "G");
                        // Boilerplate-message override: legacy parent
                        // contributions had `Auto-invest contribution to
                        // {fund}` baked into the gift's message field —
                        // a system-generated string, not a love letter.
                        // Today's server fix sends `undefined` for new
                        // rows, but historical rows still carry the
                        // string. Detect it at render time and treat as
                        // no-note so the row reads as quiet attribution
                        // (the way it should always have).
                        // Test-pattern messages ("test for recurring",
                        // "tstgin with recurring", "qqqqq…") get the same
                        // treatment — dev-test artifacts must never reach
                        // Emma's eye at 18. Same allowlist as isTestSender
                        // so the two filters stay in lockstep.
                        const rawMessage = (entry.gift.message || "").trim();
                        const isTestMessage = /^(test|testing|tstgin|tstng|qqqqq|tester)\b/i.test(rawMessage);
                        const isBoilerplate = /^auto-invest contribution to /i.test(rawMessage) || isTestMessage;
                        const hasNote = !!(rawMessage && !isBoilerplate);

                        // Decision D — recurring-cycle Memory Book entry
                        // compression (locked 2026-05-23 per
                        // project_gifter_recurring_restoration.md). Every
                        // monthly recurring charge creates a Memory Book
                        // entry, which would otherwise clutter the timeline
                        // (12 entries/year per gifter). Compressed rendering
                        // preserves the verticality of "every month grandma
                        // showed up" while removing the per-entry visual
                        // weight. Entries with attached content (message,
                        // photo, video, voice) escape compression — those
                        // months stand out within the stack as the moments
                        // grandma said something extra.
                        // A parent's recurring auto-invest (parentContributionId)
                        // is also a recurring cycle. Unlike a gifter's monthly
                        // note (a real per-month love letter that SHOULD escape
                        // compression), a parent auto-invest carries only a
                        // boilerplate "every month" note, so that note must NOT
                        // exempt it from compression — otherwise 36 identical
                        // cycles flood the timeline (the reported bug).
                        const isParentRecurring = !!(entry.gift as any)?.parentContributionId;
                        const isRecurringCycle = !!(entry.gift as any)?.recurringGiftId || isParentRecurring;
                        const hasAttachedContent =
                          (hasNote && !isParentRecurring) ||
                          !!entry.gift?.photoUrl ||
                          !!(entry.gift as any)?.videoUrl ||
                          !!(entry.gift as any)?.audioUrl;
                        const isCompressedRecurring = isRecurringCycle && !hasAttachedContent;
                        if (isCompressedRecurring) {
                          const compressedGc = gifterColor(entry.gift.senderName || "G");
                          const compressedSender = String(entry.gift.senderName || "").trim() || "Anonymous";
                          return (
                            <div
                              className="flex items-center gap-3 py-2 px-3 rounded-lg bg-card/40 border border-border/40"
                              data-testid={`memory-recurring-compressed-${entry.id}`}
                            >
                              <div
                                className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[10px] font-bold"
                                style={{ background: compressedGc.bg, color: compressedGc.text }}
                              >
                                {compressedSender.slice(0, 1).toUpperCase()}
                              </div>
                              <div className="min-w-0 flex-1 flex items-center gap-2 text-xs">
                                <Repeat size={11} className="shrink-0 text-muted-foreground/70" />
                                <span className="font-medium text-foreground truncate">{titleCaseName(compressedSender)}</span>
                                <span className="text-muted-foreground/60">·</span>
                                <span className="text-muted-foreground tabular-nums">{displayAmount(entry.gift.amount)}</span>
                              </div>
                              <p className="text-[10px] text-muted-foreground/70 shrink-0 tabular-nums">
                                {formatDate(entry.createdAt)}
                              </p>
                            </div>
                          );
                        }

                        // Display name override — test-pattern senders
                        // ("test", "qqqqq", "tstgin", etc.) render as
                        // "Anonymous" instead of their literal name. Real
                        // gifters won't be affected; only dev-test rows
                        // get cleaned up at render time.
                        const rawSender = String(entry.gift.senderName || "").trim();
                        const lcSender = rawSender.toLowerCase();
                        const isTestSender = ["test", "testing", "qqqqq", "tstgin", "tstng", "tester"].includes(lcSender);
                        const isAnonSender = !rawSender || /^someone who loves/i.test(rawSender) || lcSender === "anonymous" || isTestSender;
                        // Owner identity — when the entry is from the
                        // parent, surface the same identity treatment used
                        // by the Dashboard sidebar: profile photo + first
                        // name + "(Dad)" suffix from preferredName. This
                        // keeps the parent's identity consistent across
                        // surfaces — the same face and same role-tag they
                        // see in the sidebar shows up on their own gifts
                        // here. For external gifters, fall back to the
                        // existing letter avatar + titleCase'd name (via
                        // the shared titleCaseName utility at the top of
                        // the file — single source of truth).
                        const tyState = thankYouStateForGift(entry.gift);
                        const isOwnerEntry = tyState === "self";
                        const ownerProfileImageUrl = isOwnerEntry ? (user as any)?.profileImageUrl : null;
                        const ownerPreferredName = isOwnerEntry ? (user as any)?.preferredName : null;
                        const displaySenderName = isAnonSender
                          ? "Anonymous"
                          : isOwnerEntry && ownerPreferredName
                            ? `${titleCaseName(rawSender)} (${ownerPreferredName})`
                            : titleCaseName(rawSender);
                        const avatarLetter = isAnonSender ? "?" : (rawSender || "G").slice(0, 1).toUpperCase();
                        const ticker = entry.gift?.selectedTicker;
                        const exec = entry.gift?.executionModel;
                        const tagBlock = (
                          <div className="flex flex-wrap items-center gap-1.5">
                            {entry.gift.eventName && (
                              <span className="inline-flex items-center gap-1 rounded-full bg-[hsl(var(--kiddo-evergreen)/0.10)] px-2 py-0.5 text-[10px] font-semibold text-[hsl(var(--kiddo-evergreen))]">
                                <Calendar size={10} />
                                {entry.gift.eventName}
                              </span>
                            )}
                            {ticker ? (
                              // StockLogo + ticker letters — the brand
                              // mark gives the chip premium identity
                              // (Robinhood / Apple Stocks energy) while
                              // the letters keep it readable when the
                              // logo CDN can't resolve a brand. Closes
                              // the visual-richness gap with Dashboard's
                              // "Last contribution" card which already
                              // uses StockLogo.
                              <span className="inline-flex items-center gap-1 rounded-full bg-muted pl-1 pr-2 py-0.5 text-[10px] font-bold text-foreground">
                                <StockLogo ticker={ticker} size={14} />
                                {ticker}
                              </span>
                            ) : (exec === "family" || exec === "cash") ? (
                              <span className="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-[10px] font-medium text-muted-foreground">
                                Cash
                              </span>
                            ) : null}
                            {/* "✨ From you" pill removed — gifter name already
                                renders in the row, so the pill duplicated info
                                the parent could read directly. Thank-you state
                                pills (Thanked / Awaiting / Missing) carry signal
                                the row doesn't otherwise expose, so they stay. */}
                            {tyState === "sent" && <span className="inline-flex items-center rounded-full bg-[hsl(var(--kiddo-evergreen)/0.09)] px-2 py-0.5 text-[10px] font-bold text-[hsl(var(--kiddo-evergreen))]">✓ Thanked</span>}
                            {tyState === "draft" && <span className="inline-flex items-center rounded-full bg-[hsl(43,75%,92%)] px-2 py-0.5 text-[10px] font-bold text-[hsl(43,55%,28%)]">⏳ Awaiting thanks</span>}
                            {tyState === "missing" && <span className="inline-flex items-center rounded-full bg-[hsl(var(--kiddo-ink)/0.06)] px-2 py-0.5 text-[10px] font-bold text-[hsl(var(--kiddo-ink)/0.55)]">No thanks yet</span>}
                          </div>
                        );

                        // Compact treatment — silent parent contributions.
                        // When the parent contributed but didn't write a real
                        // note AND there's no photo/video/voice attached,
                        // there's nothing emotional in the entry. Rendering
                        // it as a full hero card alongside grandpa's "better
                        // than a bond" $250 GOOGL gift gives them equal
                        // visual weight. They aren't equal — one is a love
                        // letter, the other is a transaction the parent
                        // chose to leave silent. Compact row: avatar +
                        // amount + ticker + date. The big-card treatment
                        // is reserved for entries that have a story to
                        // tell (note OR media). Server-side: new silent
                        // parent contributions stop creating Memory Book
                        // entries entirely (per the locked
                        // feedback_memory_book_inversion rule); this is
                        // the render-time fix for historical rows that
                        // were created before that server change.
                        const photoUrl = entry.gift.photoUrl || entry.photoUrl;
                        const audioUrl = entry.audioUrl;
                        const isSilentSelf = tyState === "self" && !hasNote && !photoUrl && !embeddedVideo && !audioUrl;
                        if (isSilentSelf) {
                          return (
                            <div className="px-4 sm:px-5 py-2.5">
                              <div className="flex items-center gap-2.5 rounded-2xl bg-[hsl(var(--kiddo-cream)/0.5)] border border-[hsl(var(--kiddo-border)/0.55)] px-3 py-2">
                                {/* Avatar — parent's profile photo when set
                                    (same treatment as Dashboard sidebar +
                                    Who Loves Emma roster). Falls back to
                                    a sparkle glyph if no photo. The "You
                                    contributed" copy carries the
                                    from-you signal in either case. */}
                                {ownerProfileImageUrl ? (
                                  <div
                                    className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full overflow-hidden"
                                    style={{ boxShadow: "0 0 0 1.5px hsl(var(--kiddo-evergreen)/0.55)" }}
                                  >
                                    <img
                                      src={ownerProfileImageUrl}
                                      alt=""
                                      className="w-full h-full object-cover"
                                    />
                                  </div>
                                ) : (
                                  <div
                                    className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[10px] font-bold"
                                    style={{ background: "hsl(var(--kiddo-evergreen)/0.12)", color: "hsl(var(--kiddo-evergreen))" }}
                                  >
                                    ✨
                                  </div>
                                )}
                                <div className="min-w-0 flex-1 flex items-baseline gap-2 flex-wrap">
                                  <p className="text-[12.5px] font-semibold text-foreground tabular-nums">
                                    You added {displayAmount(entry.gift.amount)}
                                  </p>
                                  {/* Destination pill — never blank. When the contribution
                                      went into a specific ticker, show it (with logo). When
                                      it went into the managed mix or there's no ticker on
                                      record (auto-invest, cash hold), show "{child}'s mix"
                                      as the fallback so the row never reads as a
                                      destination-less amount. Same canonical label the
                                      per-gifter detail modal and Dashboard use. */}
                                  {ticker ? (
                                    <span className="inline-flex items-center gap-1 rounded-full bg-white/70 pl-1 pr-2 py-0.5 text-[10px] font-bold text-foreground">
                                      <StockLogo ticker={ticker} size={12} />
                                      {ticker}
                                    </span>
                                  ) : (
                                    <span className="inline-flex items-center rounded-full bg-white/70 px-2 py-0.5 text-[10px] font-bold text-foreground">
                                      {isOwnerMode ? "Your mix" : childName ? `${childName}'s mix` : "Diversified mix"}
                                    </span>
                                  )}
                                </div>
                                <p className="text-[10.5px] text-muted-foreground shrink-0">{formatDate(entry.createdAt)}</p>
                              </div>
                            </div>
                          );
                        }

                        // Photo as supporting context — capped at 220px so
                        // it doesn't dominate the entry, especially for
                        // portrait phone photos that previously got
                        // billboard-cropped into 16:10. Tap the photo →
                        // fullscreen lightbox for the full-resolution
                        // view. The Book View remains the primary "see
                        // this big" cinematic surface; this list-view
                        // treatment is "supporting evidence with quick
                        // expand" rather than "hero." Cream background
                        // fills negative space so portrait photos don't
                        // feel unframed.
                        const hasPhoto = !!photoUrl;
                        return (
                          <div className="p-4 sm:p-5">
                            <div className="rounded-[28px] border border-[hsl(var(--kiddo-border)/0.85)] overflow-hidden shadow-[inset_0_1px_0_rgba(255,255,255,0.78)]">
                            {hasPhoto && (
                              // Smart-aspect photo render — was forcing 16:10
                              // crop, which hurt portrait phone photos AND
                              // square shots. Now the image uses its
                              // natural aspect ratio (`objectFit: contain`)
                              // capped at 220px tall and 100% wide,
                              // centered in cream negative space. Portrait
                              // phone photos render tall-and-narrow with
                              // soft cream framing; landscape shots fill
                              // wide; squares stay square. Always tappable
                              // → lightbox for full-resolution.
                              <button
                                type="button"
                                onClick={() => { haptic("light"); setLightboxMedia({ kind: "image", url: photoUrl || "" }); }}
                                aria-label="Open photo at full size"
                                data-testid={`img-photo-hero-${entry.id}`}
                                style={{
                                  display: "flex", alignItems: "center", justifyContent: "center",
                                  width: "100%",
                                  background: "hsl(43,28%,92%)",
                                  border: "none", padding: 0, margin: 0,
                                  cursor: "zoom-in",
                                  position: "relative",
                                  overflow: "hidden",
                                  minHeight: 120,
                                }}
                              >
                                <img
                                  src={photoUrl || ""}
                                  alt=""
                                  style={{
                                    maxWidth: "100%",
                                    maxHeight: 220,
                                    width: "auto",
                                    height: "auto",
                                    objectFit: "contain",
                                    display: "block",
                                  }}
                                />
                                <span
                                  className="hidden md:inline-flex"
                                  style={{
                                    position: "absolute", right: 10, bottom: 10,
                                    padding: "4px 9px", borderRadius: 999,
                                    background: "rgba(26,23,16,0.62)", color: "white",
                                    fontSize: 10, fontWeight: 700, letterSpacing: "0.04em",
                                    textTransform: "uppercase",
                                    backdropFilter: "blur(4px)",
                                    pointerEvents: "none",
                                  }}
                                >
                                  Tap to expand
                                </span>
                              </button>
                            )}
                            <div className="bg-[linear-gradient(135deg,hsl(var(--kiddo-cream))_0%,#fff_58%,hsl(var(--kiddo-gold)/0.10)_100%)] p-5">
                              {hasNote && (
                                <p className="font-serif text-lg leading-relaxed text-foreground italic" data-testid={`text-message-${entry.id}`}>
                                  &ldquo;{entry.gift.message}&rdquo;
                                </p>
                              )}
                              <div className={`${hasNote ? "mt-4 pt-4 border-t border-[hsl(var(--kiddo-border)/0.5)]" : ""} flex items-center gap-3`}>
                                {(() => {
                                  // Avatar — when the entry is from the
                                  // parent and they have a profile photo
                                  // set, render the photo (same treatment
                                  // as Dashboard's "Who loves Emma"
                                  // roster + sidebar). Otherwise: letter
                                  // initial in the gifter's hash-derived
                                  // color tile. Recent gifts (<24h) pulse.
                                  const giftCreatedTs = entry.gift?.createdAt
                                    ? new Date(String(entry.gift.createdAt)).getTime()
                                    : entry.createdAt
                                      ? new Date(String(entry.createdAt)).getTime()
                                      : null;
                                  const isRecent = giftCreatedTs != null &&
                                    Number.isFinite(giftCreatedTs) &&
                                    (Date.now() - giftCreatedTs) < 24 * 60 * 60 * 1000;
                                  if (ownerProfileImageUrl) {
                                    return (
                                      <div
                                        className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full overflow-hidden${isRecent ? " kiddo-gifter-avatar-pulse" : ""}`}
                                        style={{ boxShadow: "0 0 0 2px hsl(var(--kiddo-evergreen)/0.65), 0 1px 4px rgba(26,23,16,0.08)" }}
                                      >
                                        <img
                                          src={ownerProfileImageUrl}
                                          alt=""
                                          className="w-full h-full object-cover"
                                        />
                                      </div>
                                    );
                                  }
                                  return (
                                    <div
                                      className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-xs font-bold shadow-[inset_0_-6px_12px_rgba(0,0,0,0.10)]${isRecent ? " kiddo-gifter-avatar-pulse" : ""}`}
                                      style={{ background: gc.bg, color: gc.text }}
                                    >
                                      {avatarLetter}
                                    </div>
                                  );
                                })()}
                                <div className="min-w-0 flex-1">
                                  <p className="text-sm font-semibold text-foreground truncate" data-testid={`text-sender-${entry.id}`}>
                                    {displaySenderName}
                                  </p>
                                  <p className="text-[11px] text-muted-foreground">{formatDate(entry.createdAt)}</p>
                                </div>
                                <div className="shrink-0 text-right">
                                  <p className="font-heading text-base font-bold leading-none tabular-nums text-[hsl(var(--kiddo-evergreen))]" data-testid={`text-amount-${entry.id}`}>
                                    {displayAmount(entry.gift.amount)}
                                  </p>
                                  {/* Per-gift compound visualization — added
                                      2026-05-25 per the first-principles audit.
                                      The compound number IS the moat. KidView
                                      already shows it; Memory Book should too
                                      because grandparents read THIS surface.
                                      Shows "now worth ~$Y" when the gift has
                                      been invested for long enough to have any
                                      visible growth + when there's a real
                                      createdAt. Skips silently otherwise — no
                                      misleading $X = $X line. Routes through
                                      the canonical projectFundValue (7% net of
                                      fee, monthly compounded) so the number
                                      matches every other surface. */}
                                  {(() => {
                                    const giftAmount = parseFloat(String(entry.gift.amount || "0"));
                                    if (!Number.isFinite(giftAmount) || giftAmount <= 0) return null;
                                    const giftDate = entry.gift.createdAt ? new Date(String(entry.gift.createdAt)) : null;
                                    if (!giftDate || !Number.isFinite(giftDate.getTime())) return null;
                                    const yearsInvested = (Date.now() - giftDate.getTime()) / (365.25 * 24 * 60 * 60 * 1000);
                                    if (yearsInvested < 0.08) return null; // < ~1 month, no meaningful growth yet
                                    const nowValue = projectFundValue({
                                      startingValue: giftAmount,
                                      monthlyContribution: 0,
                                      yearsAhead: yearsInvested,
                                    });
                                    const gain = nowValue - giftAmount;
                                    if (gain < 0.5) return null; // < 50 cents, not worth surfacing
                                    return (
                                      <p className="mt-1 text-[10.5px] text-green-600 tabular-nums leading-none" data-testid={`text-gift-now-worth-${entry.id}`}>
                                        now ~${nowValue.toFixed(2)}
                                      </p>
                                    );
                                  })()}
                                </div>
                              </div>
                              {(entry.gift.eventName || ticker || exec === "family" || exec === "cash" || (tyState && tyState !== "anonymous")) && (
                                <div className="mt-2.5 ml-12">
                                  {tagBlock}
                                </div>
                              )}
                            </div>
                            </div>
                          {/* (Removed: secondary photo render below the card.
                              The photo is now the cinematic hero at the top
                              of the card via the bleed-top render above —
                              one image, one position. No duplicate frame. */}
                          {embeddedVideo && (
                            // Video — capped at 220px tall (was 320px).
                            // Stays inline-playable so the parent doesn't
                            // need to leave the list view to play; the
                            // lightbox is for photos (where "see it big"
                            // is the primary use). For embedded videos
                            // (YouTube/Vimeo), the iframe's own controls
                            // expose fullscreen via the player's UI.
                            <div className="mt-3" style={{ background: "hsl(43,28%,95%)", borderRadius: 16, overflow: "hidden" }}>
                              <div
                                style={{
                                  position: "relative",
                                  width: "100%",
                                  maxWidth: 440,
                                  margin: "0 auto",
                                  aspectRatio: "16 / 9",
                                  maxHeight: 220,
                                  overflow: "hidden",
                                  background: "hsl(43,28%,92%)",
                                }}
                              >
                                <iframe
                                  src={embeddedVideo}
                                  title="Memory video"
                                  style={{ position: "absolute", inset: 0, width: "100%", height: "100%", border: 0 }}
                                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                                  allowFullScreen
                                  sandbox="allow-scripts allow-same-origin allow-popups allow-presentation"
                                  data-testid={`video-gift-${entry.id}`}
                                />
                              </div>
                            </div>
                          )}
                          {entry.videoUrl?.startsWith("/uploads/") && (
                            // Uploaded video — same compact 220px max-height
                            // treatment as embedded videos. The HTML5 video
                            // controls already include a fullscreen button
                            // (browser-native), so no separate lightbox
                            // needed. Lightbox is reserved for photos
                            // where the "see it big" use case is primary.
                            <div className="mt-3" style={{ background: "hsl(43,28%,95%)", borderRadius: 16, overflow: "hidden" }}>
                              <div
                                style={{
                                  position: "relative",
                                  width: "100%",
                                  maxWidth: 440,
                                  margin: "0 auto",
                                  aspectRatio: "16 / 9",
                                  maxHeight: 220,
                                  overflow: "hidden",
                                  background: "hsl(43,28%,92%)",
                                }}
                              >
                                <video
                                  src={entry.videoUrl}
                                  controls
                                  style={{ position: "absolute", inset: 0, width: "100%", height: "100%" }}
                                  data-testid={`video-upload-${entry.id}`}
                                />
                              </div>
                            </div>
                          )}
                          {entry.audioUrl && (
                            // Voice note — the moat per the locked design
                            // lens. Gold-tinted card with a microphone glyph,
                            // a one-line emotional caption ("They wanted you
                            // to hear this"), a static waveform silhouette
                            // (semantic, not animated — see StaticWaveform
                            // component), and the player itself. Sets voice
                            // apart from text/photo entries because hearing
                            // grandma's voice 18 years later is the single
                            // most ceremonial artifact in the product.
                            <div
                              className="mt-3 rounded-2xl border border-[hsl(var(--kiddo-gold)/0.32)] px-4 py-3"
                              style={{ background: "linear-gradient(135deg, hsl(var(--kiddo-gold)/0.10) 0%, hsl(var(--kiddo-cream)) 60%, #fff 100%)" }}
                              data-testid={`audio-${entry.id}`}
                            >
                              <div className="flex items-center gap-2 mb-2">
                                <span className="inline-flex items-center justify-center w-7 h-7 rounded-full bg-[hsl(var(--kiddo-gold)/0.18)] text-[hsl(var(--kiddo-gold))] text-[14px]" aria-hidden>🎙</span>
                                <div className="flex-1 min-w-0">
                                  <p className="text-[11px] font-bold uppercase tracking-[0.08em] text-[hsl(var(--kiddo-gold-ink))] leading-tight">Voice note</p>
                                  <p className="text-[11px] text-muted-foreground/80 leading-tight">They wanted {isOwnerMode ? "you" : childName ? childName : "her"} to hear this.</p>
                                </div>
                                <span className="text-[hsl(var(--kiddo-gold)/0.55)]" aria-hidden><StaticWaveform size="sm" /></span>
                              </div>
                              <audio src={entry.audioUrl} controls className="w-full h-9" />
                            </div>
                          )}
                          {(() => {
                            const exec = entry.gift?.executionModel;
                            const ticker = entry.gift?.selectedTicker?.toUpperCase() ?? null;
                            const giftAmt = parseFloat(String(entry.gift?.amount || "0"));
                            const currentPrice = ticker ? giftPriceByTicker.get(ticker) : null;

                            // Use real share/price data when available, fall back to estimate
                            const realShares = entry.gift?.sharesAcquired ? parseFloat(entry.gift.sharesAcquired) : null;
                            const purchasePrice = entry.gift?.priceAtPurchase ? parseFloat(entry.gift.priceAtPurchase) : null;
                            // Implied purchase price when we have shares but not priceAtPurchase (inferred data)
                            const impliedPurchasePrice = !purchasePrice && realShares && realShares > 0 && giftAmt > 0
                              ? giftAmt / realShares : null;
                            const effectivePurchasePrice = purchasePrice ?? impliedPurchasePrice;
                            const hasRealData = realShares !== null && realShares > 0 && effectivePurchasePrice !== null && effectivePurchasePrice > 0;
                            const hasExactData = realShares !== null && realShares > 0 && purchasePrice !== null && purchasePrice > 0;

                            const displayShares = hasRealData ? realShares! : (currentPrice && currentPrice > 0 && giftAmt > 0 ? giftAmt / currentPrice : null);
                            const sharesLabel = displayShares !== null
                              ? (displayShares >= 1 ? displayShares.toFixed(4).replace(/\.?0+$/, "") : displayShares.toFixed(6).replace(/\.?0+$/, ""))
                              : null;

                            // Price movement: purchase price → current price
                            const priceThen = hasRealData ? effectivePurchasePrice! : null;
                            const priceNow = currentPrice ?? null;
                            const currentValue = hasRealData && realShares && currentPrice ? realShares * currentPrice : null;
                            const gainDollars = currentValue !== null && giftAmt > 0 ? currentValue - giftAmt : null;
                            const gainPct = gainDollars !== null && giftAmt > 0 ? (gainDollars / giftAmt) * 100 : null;
                            const isUp = gainDollars !== null ? gainDollars >= 0 : null;

                            // Investment line — value-shaped, never share-shaped.
                            // Was: "1.4482 shares of GOOGL at $172.63/share" —
                            // brokerage Bloomberg-terminal language a kid at
                            // 18 doesn't read. Replaced with the actual
                            // investment story: company name, current
                            // value, growth delta. Per-share prices were
                            // confusing (parent saw "$172.63" and thought
                            // value, but it was the share price); now we
                            // show position value (shares × current price)
                            // which is the real "what is this worth now."
                            let investLine = "";
                            // "managed mix" → "diversified mix" 2026-05-20.
                            // Cross-surface unification with Pricing,
                            // Dashboard, GiftCheckout, Activity (all use
                            // "diversified mix"). "Managed" carried an
                            // active-management connotation that conflicts
                            // with the locked passive-ETF discipline.
                            // Unlike Activity's recurring-row labels
                            // (which preserve a "family mix" branch),
                            // Memory Book's entry investLine doesn't
                            // distinguish family-exec from default-exec —
                            // both end up in a diversified ETF mix and
                            // the parent reading their Memory Book entry
                            // is looking for "where did this gift go,"
                            // not the technical execution-model branch.
                            if (ticker) {
                              investLine = `Invested in ${ticker}`;
                            } else if (exec === "family" || exec === "cash") {
                              investLine = `Sent as cash · invested across the diversified mix`;
                            } else {
                              investLine = `Invested across the diversified mix`;
                            }
                            // Fresh-gift detection — under 7 days old. Used
                            // to OMIT the gain pill (a "+$0 (+0.0%)" delta
                            // for a 3-day-old gift reads to a kid as "didn't
                            // grow" when the real story is "no time to grow
                            // yet"). Earlier this also gated the entire
                            // value badge to show "Investing soon 🌱" — but
                            // that contradicted the "Invested in GOOGL" line
                            // immediately to its left, since the gift IS
                            // already invested at this point. Now: show the
                            // current value when we have it, drop just the
                            // gain pill when fresh; show "Just landed 🌱"
                            // only when we genuinely have no value yet
                            // (still settling, price quote not loaded).
                            const giftCreatedTs = entry.gift?.createdAt
                              ? new Date(String(entry.gift.createdAt)).getTime()
                              : entry.createdAt
                                ? new Date(String(entry.createdAt)).getTime()
                                : null;
                            const ageDays = giftCreatedTs && Number.isFinite(giftCreatedTs)
                              ? (Date.now() - giftCreatedTs) / (24 * 60 * 60 * 1000)
                              : null;
                            const isFreshGift = ageDays !== null && ageDays < 7;
                            const showGainPill = !isFreshGift && gainDollars !== null && Math.abs(gainDollars) > 0.01;
                            // Value differs from cost basis by more than a
                            // cent. When false, the "Now worth $X" line is
                            // pure duplication of the gift amount at the
                            // top of the row — hide it entirely. This
                            // unifies the visual shape of "fresh + flat"
                            // and "aged + flat" rows (both just show
                            // "Invested in AAPL" with no redundant value
                            // restatement). Locked 2026-05-19 per the
                            // gain-pill inconsistency audit: user flagged
                            // that some rows show "Now worth $X (+$Y)"
                            // and others show "Now worth $X" with no
                            // gain pill, looking like two different
                            // states even when they're both "no movement."
                            // The cost basis at the top of the row IS the
                            // value when they match — no need to restate
                            // it underneath. Canva-mode: less chrome
                            // when chrome adds no signal.
                            const valueDiffersFromCost = currentValue !== null && giftAmt > 0 && Math.abs(currentValue - giftAmt) > 0.01;
                            return (
                              <div className="mt-3 rounded-xl bg-[hsl(var(--kiddo-evergreen)/0.05)] px-3 py-2 text-[11px] text-[hsl(var(--kiddo-evergreen)/0.85)]">
                                <div className="flex items-center justify-between gap-2 flex-wrap">
                                  <span data-testid={`text-growth-${entry.id}`} className="font-medium">{investLine}</span>
                                  {/* Right-side value badge — three cases:
                                      1. Have a current value → show it.
                                         Append the gain pill ONLY when
                                         enough time has passed for movement
                                         to be meaningful (≥7 days).
                                      2. No value yet but the gift is fresh
                                         (just landed, may not be price-
                                         synced) → "Just landed 🌱". Honest:
                                         the gift IS invested; the brokerage
                                         layer hasn't surfaced a value yet.
                                      3. No value, not fresh → silent.
                                         Better than wrong. */}
                                  {currentValue !== null && valueDiffersFromCost ? (
                                    <span className="text-[10.5px] font-semibold flex items-center gap-1.5">
                                      <span className="text-foreground">Now worth ${currentValue.toFixed(2)}</span>
                                      {showGainPill && gainDollars !== null && (
                                        <span className={isUp ? "text-[hsl(var(--kiddo-evergreen))]" : "text-red-500"}>
                                          ({isUp ? "+" : "−"}${Math.abs(gainDollars).toFixed(2)})
                                        </span>
                                      )}
                                    </span>
                                  ) : currentValue === null && isFreshGift ? (
                                    <span className="text-[10px] font-medium text-[hsl(var(--kiddo-evergreen)/0.62)] italic">Just landed</span>
                                  ) : null}
                                </div>
                              </div>
                            );
                          })()}

                          {/* Thank-you section */}
                          {isOwner && entry.giftId && (() => {
                            const ty = thankYouByGiftId.get(String(entry.giftId));
                            // Never prompt the owner to thank their OWN
                            // contributions (e.g. a parent's recurring
                            // auto-invest). thankYouStateForGift returns "self"
                            // when the gift's sender IS the fund owner. You
                            // don't thank yourself.
                            if (entry.gift && thankYouStateForGift(entry.gift) === "self") return null;
                            // Capitalize at the top so every downstream
                            // reference (button label, preview header,
                            // composer placeholder, draft text) shows the
                            // gifter's name with proper case — even when
                            // the gifter typed their own name lowercase.
                            const senderName = titleCaseName(entry.gift?.senderName) || "them";
                            const amount = entry.gift?.amount || "0";
                            const isAnon = /someone who loves|anonymous/i.test(senderName);
                            // Portfolio context for the draft — same data
                            // shape as the value-badge above. Only passed
                            // when both ticker and a real (non-fresh)
                            // current value are computable, so the draft
                            // can say "It's invested in GOOGL and now
                            // worth $267.50." without ever fabricating
                            // numbers. Empty ctx falls back to the
                            // warm-but-generic copy.
                            const tcTicker = entry.gift?.selectedTicker?.toUpperCase() ?? null;
                            const tcCurrentPrice = tcTicker ? giftPriceByTicker.get(tcTicker) : null;
                            const tcRealShares = entry.gift?.sharesAcquired ? parseFloat(entry.gift.sharesAcquired) : null;
                            const tcCurrentValue =
                              tcRealShares !== null && tcRealShares > 0 && tcCurrentPrice && tcCurrentPrice > 0
                                ? tcRealShares * tcCurrentPrice
                                : null;
                            const tyCtx = { ticker: tcTicker, currentValue: tcCurrentValue };
                            // Source of truth for "can we email this gifter":
                            // the GIFT's senderEmail (captured at Stripe
                            // checkout). The thank-you record's senderEmail
                            // is a copy that may not be populated until the
                            // /send endpoint fires the first time. Without
                            // this combined check, fresh thank-you records
                            // showed "Copy message" on the button label
                            // even when the gift had a real email — the
                            // backend would still send (server reads from
                            // the gift), but the parent saw the wrong
                            // verb on the button. Now display + behavior
                            // agree.
                            const hasEmail = !!(entry.gift?.senderEmail || ty?.senderEmail);
                            const isSent = ty?.status === "sent";
                            const isOpen = composerGiftId === entry.giftId;

                            // Anonymous-without-email: no thank-you path
                            // exists, so render nothing. The absence of a
                            // button is self-explanatory; "no email on file"
                            // was operational metadata bleeding into the
                            // Memory Book's emotional surface.
                            if (isAnon && !hasEmail) {
                              return null;
                            }

                            return (
                              <div className="mt-2">
                                {isSent ? (
                                  <div className="flex items-center gap-1.5 px-1">
                                    <span className="inline-flex items-center gap-1 rounded-full bg-[hsl(var(--kiddo-evergreen)/0.08)] px-2.5 py-0.5 text-[10.5px] font-semibold text-[hsl(var(--kiddo-evergreen))]">
                                      ✓ Thanked{ty.sentAt ? ` · ${new Date(ty.sentAt).toLocaleDateString("en-US", { month: "short", day: "numeric" })}` : ""}
                                    </span>
                                  </div>
                                ) : (
                                  <>
                                    {!isOpen && (
                                      <button
                                        type="button"
                                        onClick={() => openComposer(entry.giftId!, ty, senderName, amount, tyCtx)}
                                        className="flex items-center gap-1 px-1 text-[11px] font-semibold text-[hsl(var(--kiddo-evergreen))] hover:opacity-75 transition-opacity"
                                        data-testid={`button-say-thanks-${entry.id}`}
                                      >
                                        <Send size={10} />
                                        Say thanks
                                      </button>
                                    )}

                                    {isOpen && (
                                      <div className="mt-2 rounded-2xl border border-[hsl(var(--kiddo-evergreen)/0.18)] bg-[hsl(var(--kiddo-evergreen)/0.03)] p-4 space-y-3">
                                        {composerStep === "compose" ? (
                                          <>
                                            {/* Tone picker — Warm / Brief / Formal / Custom.
                                                Custom = blank textarea for parents who want to write
                                                from scratch. Previously, editing any template silently
                                                reset the tone to "formal" which was confusing. */}
                                            <div className="flex flex-wrap gap-1.5">
                                              {(["warm", "brief", "formal", "custom"] as const).map((tone) => (
                                                <button
                                                  key={tone}
                                                  type="button"
                                                  onClick={() => {
                                                    setComposerTone(tone);
                                                    setComposerMessage(buildThankYouMessage(tone, senderName, amount, tyCtx));
                                                  }}
                                                  className={`rounded-full px-3 py-1 text-[11px] font-semibold capitalize transition-colors ${composerTone === tone ? "bg-[hsl(var(--kiddo-evergreen))] text-white" : "border border-border text-muted-foreground hover:text-foreground"}`}
                                                  data-testid={`button-thank-you-tone-${tone}`}
                                                >
                                                  {tone}
                                                </button>
                                              ))}
                                            </div>

                                            {/* Send-to context — answers "where does this go and
                                                whose name will it be from?" Removes ambiguity before
                                                send. Falls back to "saved as draft" copy when there's
                                                no email on file (will copy to clipboard instead). */}
                                            <div className="rounded-xl border border-border/60 bg-background/60 px-3 py-2.5">
                                              <p className="text-[11px] font-bold uppercase tracking-wide text-muted-foreground">
                                                {hasEmail ? "Send to" : "Will copy for"}
                                              </p>
                                              <p className="mt-0.5 text-sm font-semibold text-foreground">
                                                {senderName}
                                              </p>
                                              <p className="text-[11px] text-muted-foreground">
                                                {hasEmail
                                                  ? `Via email · from ${ownerName || "you"}`
                                                  : `Copies to your clipboard · paste it anywhere`}
                                              </p>
                                            </div>

                                            {/* Message */}
                                            <textarea
                                              value={composerMessage}
                                              onChange={(e) => {
                                                // Stop tagging the tone as "formal" on edit — once
                                                // the user types anything, treat it as custom.
                                                if (composerTone !== "custom") setComposerTone("custom");
                                                setComposerMessage(e.target.value);
                                              }}
                                              rows={composerTone === "custom" ? 6 : 8}
                                              placeholder={composerTone === "custom" ? `Write your own message to ${senderName}...` : undefined}
                                              className="w-full rounded-xl border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-[hsl(var(--kiddo-evergreen)/0.25)] resize-none"
                                              data-testid={`textarea-thank-you-${entry.id}`}
                                            />

                                            {/* Preview / Reset / Cancel */}
                                            <div className="flex flex-wrap items-center gap-2">
                                              <button
                                                type="button"
                                                disabled={!composerMessage.trim()}
                                                onClick={() => setComposerStep("preview")}
                                                className="flex items-center gap-1.5 rounded-xl bg-[hsl(var(--kiddo-evergreen))] px-4 py-2 text-sm font-semibold text-white disabled:opacity-50 hover:opacity-90 transition-opacity"
                                                data-testid={`button-preview-thank-you-${entry.id}`}
                                              >
                                                Preview →
                                              </button>
                                              {composerTone !== "custom" && (
                                                <button
                                                  type="button"
                                                  onClick={() => setComposerMessage(buildThankYouMessage(composerTone, senderName, amount, tyCtx))}
                                                  className="rounded-xl border border-border px-3 py-2 text-xs text-muted-foreground hover:text-foreground transition-colors"
                                                  data-testid={`button-reset-thank-you-${entry.id}`}
                                                >
                                                  Reset
                                                </button>
                                              )}
                                              <button
                                                type="button"
                                                onClick={() => setComposerGiftId(null)}
                                                className="rounded-xl px-3 py-2 text-xs text-muted-foreground hover:text-foreground transition-colors"
                                              >
                                                Cancel
                                              </button>
                                            </div>
                                          </>
                                        ) : (
                                          <>
                                            {/* Preview — show the message exactly as the gifter
                                                will receive it. Light styling (cream card +
                                                serif body) so it reads like a card, not a
                                                form. No fake email-client chrome. */}
                                            <div className="rounded-xl border border-[hsl(var(--kiddo-evergreen)/0.20)] bg-white px-4 py-4">
                                              <p className="text-[10.5px] font-bold uppercase tracking-wide text-muted-foreground">
                                                Preview · what {senderName} will read
                                              </p>
                                              <p className="mt-2 font-serif text-[14px] leading-[1.7] text-foreground italic whitespace-pre-line">
                                                {composerMessage}
                                              </p>
                                              <p className="mt-3 pt-2.5 border-t border-border/40 text-[10.5px] text-muted-foreground/70">
                                                {hasEmail
                                                  ? `Sent via email to ${senderName} from ${ownerName || "you"}. Also saved to ${childName || "the"} Memory Book.`
                                                  : `Message will copy to your clipboard for you to send.`}
                                              </p>
                                            </div>

                                            {/* Send / Edit */}
                                            <div className="flex flex-wrap items-center gap-2">
                                              <button
                                                type="button"
                                                disabled={sendingThankYou || !composerMessage.trim()}
                                                onClick={() => handleSendThankYou(ty)}
                                                className="flex items-center gap-1.5 rounded-xl bg-[hsl(var(--kiddo-evergreen))] px-4 py-2 text-sm font-semibold text-white disabled:opacity-50 hover:opacity-90 transition-opacity"
                                                data-testid={`button-send-thank-you-${entry.id}`}
                                              >
                                                <Send size={12} />
                                                {sendingThankYou ? "Sending..." : hasEmail ? `Send to ${senderName.split(" ")[0]}` : "Copy message"}
                                              </button>
                                              <button
                                                type="button"
                                                onClick={() => setComposerStep("compose")}
                                                className="rounded-xl border border-border px-3 py-2 text-xs text-muted-foreground hover:text-foreground transition-colors"
                                                data-testid={`button-edit-thank-you-${entry.id}`}
                                              >
                                                ← Edit
                                              </button>
                                            </div>
                                          </>
                                        )}
                                      </div>
                                    )}
                                  </>
                                )}
                              </div>
                            );
                          })()}
                        </div>
                        );
                      })()}

                      {entry.type === "milestone" && (() => {
                        // Fresh-milestone celebration — when a milestone
                        // entry was stamped within the last hour, the
                        // card breathes a gold ring once on first render
                        // and settles. Runs once per page-load (not
                        // every render) by piggybacking the entry id
                        // on the className. Restraint over sparkle —
                        // no particles, no stars bursting from a balance,
                        // no infinite pulse. Just the warm beat that
                        // says "your fund hit a number worth marking."
                        const ms = new Date(String(entry.createdAt)).getTime();
                        const isFreshMilestone = Number.isFinite(ms) && (Date.now() - ms) < 60 * 60 * 1000;
                        return (
                          <div className="p-4 sm:p-5">
                          <div className={`rounded-[28px] border border-[hsl(var(--kiddo-gold)/0.30)] bg-[linear-gradient(135deg,hsl(var(--kiddo-gold)/0.09)_0%,#fff_52%,hsl(var(--kiddo-cream))_100%)] p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.78)]${isFreshMilestone ? " kiddo-milestone-celebrate" : ""}`}>
                            <div className="flex items-start gap-3">
                              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-[hsl(var(--kiddo-gold)/0.16)] shadow-[inset_0_-4px_8px_rgba(0,0,0,0.04)]">
                                <Star size={18} className="text-[hsl(var(--kiddo-gold))]" />
                              </div>
                              <div className="min-w-0 flex-1">
                                <span className="rounded-full bg-white/80 px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.08em] text-[hsl(var(--kiddo-gold-ink))]">Milestone</span>
                                <h3 className="mt-1.5 font-heading text-base font-semibold leading-snug text-foreground" data-testid={`text-milestone-${entry.id}`}>
                                  {entry.content}
                                </h3>
                                <p className="mt-1 text-xs text-muted-foreground" data-testid={`text-author-${entry.id}`}>
                                  {formatDate(entry.createdAt)}{entry.authorName ? ` · ${displayAuthor(entry.authorName)}` : ""}
                                </p>
                              </div>
                            </div>
                          </div>
                          {entry.photoUrl && (
                            <div className="mt-3 overflow-hidden rounded-2xl border border-[hsl(var(--kiddo-border)/0.65)]">
                              <img
                                src={entry.photoUrl}
                                alt=""
                                className="w-full h-48 sm:h-52 object-cover"
                                data-testid={`img-milestone-${entry.id}`}
                              />
                            </div>
                          )}
                          {embeddedVideo && (
                            <div className="mt-3 overflow-hidden rounded-2xl border border-[hsl(var(--kiddo-border)/0.65)]">
                              <iframe
                                src={embeddedVideo}
                                title="Milestone video"
                                className="w-full h-52 sm:h-56"
                                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                                allowFullScreen
                                sandbox="allow-scripts allow-same-origin allow-popups allow-presentation"
                                data-testid={`video-milestone-${entry.id}`}
                              />
                            </div>
                          )}
                        </div>
                        );
                      })()}

                      {entry.type === "photo" && (
                        <div>
                          {entry.photoUrl && (
                            <img
                              src={entry.photoUrl}
                              alt=""
                              className="w-full h-56 sm:h-64 object-cover"
                              data-testid={`img-photo-entry-${entry.id}`}
                            />
                          )}
                          {embeddedVideo && (
                            <div className="overflow-hidden">
                              <iframe
                                src={embeddedVideo}
                                title="Photo memory video"
                                className="w-full h-56 sm:h-64"
                                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                                allowFullScreen
                                sandbox="allow-scripts allow-same-origin allow-popups allow-presentation"
                                data-testid={`video-photo-${entry.id}`}
                              />
                            </div>
                          )}
                          <div className="flex items-start gap-3 p-4">
                            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[hsl(var(--kiddo-evergreen)/0.10)] text-sm font-bold text-[hsl(var(--kiddo-evergreen))] overflow-hidden">
                              {entry.authorPhotoUrl
                                ? <img src={entry.authorPhotoUrl} alt="" loading="lazy" className="h-full w-full object-cover" />
                                : (entry.authorName || "P").slice(0, 1).toUpperCase()}
                            </div>
                            <div className="min-w-0 flex-1">
                              <div className="flex flex-wrap items-center gap-1.5">
                                <p className="text-sm font-bold text-foreground">{displayAuthor(entry.authorName)}</p>
                                <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.08em] text-muted-foreground">Photo</span>
                              </div>
                              {entry.content && (
                                <p className="mt-1 text-sm leading-relaxed text-foreground/85" data-testid={`text-caption-${entry.id}`}>{entry.content}</p>
                              )}
                              <p className="mt-0.5 text-[10px] text-muted-foreground">{formatDate(entry.createdAt)}</p>
                            </div>
                          </div>
                        </div>
                      )}

                      {(entry.type === "parent_investment_start" || entry.type === "parent_note") && (
                        <div className="p-4 sm:p-5">
                          <div className="rounded-[28px] border border-[hsl(var(--kiddo-border)/0.85)] bg-[linear-gradient(135deg,hsl(var(--kiddo-cream))_0%,#fff_58%,hsl(var(--kiddo-evergreen)/0.04)_100%)] p-5 shadow-[inset_0_1px_0_rgba(255,255,255,0.78)]">
                            {/* Memory Book inversion: when there's a real note, it
                                IS the entry — pulled to the top, large, italic,
                                quoted. Author + date + badge become small
                                attribution metadata underneath, not the headline.
                                Identity comes from the unified getEntryIdentity
                                helper: owner gets profile photo + "(Dad)" suffix,
                                external authors get a letter avatar. Same
                                treatment as the Story-view gift row, the
                                Timeline view, and the BookPage. */}
                            {memoryNoteText ? (
                              <>
                                <p className="font-serif text-lg leading-relaxed text-foreground italic" data-testid={`text-parent-entry-${entry.id}`}>
                                  &ldquo;{memoryNoteText}&rdquo;
                                </p>
                                <div className="mt-4 flex items-center gap-2.5 text-xs text-muted-foreground">
                                  <div
                                    className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[11px] font-bold overflow-hidden"
                                    style={{
                                      background: memoryIdent.avatarStyle === "owner"
                                        ? "hsl(var(--kiddo-evergreen)/0.12)"
                                        : memoryIdent.avatarStyle === "gifter" && memoryIdent.gifterBg
                                          ? memoryIdent.gifterBg
                                          : "hsl(var(--kiddo-gold)/0.18)",
                                      color: memoryIdent.avatarStyle === "owner"
                                        ? "hsl(var(--kiddo-evergreen))"
                                        : "white",
                                      boxShadow: memoryIdent.avatarStyle === "owner" ? "0 0 0 1.5px hsl(var(--kiddo-evergreen)/0.45)" : undefined,
                                    }}
                                  >
                                    {memoryIdent.profileImageUrl
                                      ? <img src={memoryIdent.profileImageUrl} alt="" loading="lazy" className="h-full w-full object-cover" />
                                      : memoryIdent.avatarLetter}
                                  </div>
                                  <span className="font-semibold text-foreground/80">{memoryIdent.displayName}</span>
                                  <span className="text-muted-foreground/55">·</span>
                                  <span>{formatDate(entry.createdAt)}</span>
                                  {entry.type === "parent_investment_start" && (
                                    <>
                                      <span className="text-muted-foreground/55">·</span>
                                      <span className="rounded-full bg-white/80 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-[0.06em] text-[hsl(var(--kiddo-evergreen))]">
                                        Investment
                                      </span>
                                    </>
                                  )}
                                </div>
                              </>
                            ) : (
                              <div className="flex items-center gap-2.5 text-xs text-muted-foreground">
                                <div
                                  className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[11px] font-bold overflow-hidden"
                                  style={{
                                    background: memoryIdent.avatarStyle === "owner"
                                      ? "hsl(var(--kiddo-evergreen)/0.12)"
                                      : memoryIdent.avatarStyle === "gifter" && memoryIdent.gifterBg
                                        ? memoryIdent.gifterBg
                                        : "hsl(var(--kiddo-gold)/0.18)",
                                    color: memoryIdent.avatarStyle === "owner"
                                      ? "hsl(var(--kiddo-evergreen))"
                                      : "white",
                                    boxShadow: memoryIdent.avatarStyle === "owner" ? "0 0 0 1.5px hsl(var(--kiddo-evergreen)/0.45)" : undefined,
                                  }}
                                >
                                  {memoryIdent.profileImageUrl
                                    ? <img src={memoryIdent.profileImageUrl} alt="" loading="lazy" className="h-full w-full object-cover" />
                                    : memoryIdent.avatarLetter}
                                </div>
                                <span className="font-semibold text-foreground/80">{memoryIdent.displayName}</span>
                                <span className="text-muted-foreground/55">·</span>
                                <span>{formatDate(entry.createdAt)}</span>
                                <span className="text-muted-foreground/55">·</span>
                                <span className="text-muted-foreground/65">{entry.type === "parent_investment_start" ? "Investment started" : "Quiet investment"}</span>
                              </div>
                            )}
                          </div>
                          {entry.audioUrl && (
                            <div className="mt-3 rounded-2xl border border-[hsl(var(--kiddo-border)/0.65)] bg-background px-4 py-3" data-testid={`audio-parent-${entry.id}`}>
                              <div className="mb-2 flex items-center gap-2">
                                <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide">🎙 Voice note</p>
                                <span className="text-muted-foreground/45 ml-auto" aria-hidden><StaticWaveform size="sm" /></span>
                              </div>
                              <audio src={entry.audioUrl} controls className="w-full h-9" />
                              {(entry as any).audioTranscript && (
                                <p className="mt-2 text-[12px] italic text-foreground/75 leading-relaxed">
                                  &ldquo;{(entry as any).audioTranscript}&rdquo;
                                </p>
                              )}
                            </div>
                          )}
                        </div>
                      )}

                      {entry.type === "note" && (
                        <div className="p-4 sm:p-5">
                          <div className="rounded-[28px] border border-[hsl(var(--kiddo-border)/0.85)] bg-[linear-gradient(135deg,hsl(var(--kiddo-cream))_0%,#fff_58%,hsl(var(--kiddo-evergreen)/0.04)_100%)] p-5 shadow-[inset_0_1px_0_rgba(255,255,255,0.78)]">
                            {/* Same Memory Book inversion as parent entries above:
                                note IS the entry. Identity via the unified
                                getEntryIdentity helper so the parent's profile
                                photo + "(Dad)" suffix render identically here. */}
                            {memoryNoteText ? (
                              <>
                                <p className="font-serif text-lg leading-relaxed text-foreground italic" data-testid={`text-note-${entry.id}`}>
                                  &ldquo;{memoryNoteText}&rdquo;
                                </p>
                                <div className="mt-4 flex items-center gap-2.5 text-xs text-muted-foreground">
                                  <div
                                    className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[11px] font-bold overflow-hidden"
                                    style={{
                                      background: memoryIdent.avatarStyle === "owner"
                                        ? "hsl(var(--kiddo-evergreen)/0.12)"
                                        : memoryIdent.avatarStyle === "gifter" && memoryIdent.gifterBg
                                          ? memoryIdent.gifterBg
                                          : "hsl(var(--kiddo-gold)/0.18)",
                                      color: memoryIdent.avatarStyle === "owner"
                                        ? "hsl(var(--kiddo-evergreen))"
                                        : "white",
                                      boxShadow: memoryIdent.avatarStyle === "owner" ? "0 0 0 1.5px hsl(var(--kiddo-evergreen)/0.45)" : undefined,
                                    }}
                                  >
                                    {memoryIdent.profileImageUrl
                                      ? <img src={memoryIdent.profileImageUrl} alt="" loading="lazy" className="h-full w-full object-cover" />
                                      : memoryIdent.avatarLetter}
                                  </div>
                                  <span className="font-semibold text-foreground/80">{memoryIdent.displayName}</span>
                                  <span className="text-muted-foreground/55">·</span>
                                  <span>{formatDate(entry.createdAt)}</span>
                                </div>
                              </>
                            ) : (
                              <div className="flex items-center gap-2.5 text-xs text-muted-foreground">
                                <div
                                  className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[11px] font-bold overflow-hidden"
                                  style={{
                                    background: memoryIdent.avatarStyle === "owner"
                                      ? "hsl(var(--kiddo-evergreen)/0.12)"
                                      : memoryIdent.avatarStyle === "gifter" && memoryIdent.gifterBg
                                        ? memoryIdent.gifterBg
                                        : "hsl(var(--kiddo-gold)/0.18)",
                                    color: memoryIdent.avatarStyle === "owner"
                                      ? "hsl(var(--kiddo-evergreen))"
                                      : "white",
                                    boxShadow: memoryIdent.avatarStyle === "owner" ? "0 0 0 1.5px hsl(var(--kiddo-evergreen)/0.45)" : undefined,
                                  }}
                                >
                                  {memoryIdent.profileImageUrl
                                    ? <img src={memoryIdent.profileImageUrl} alt="" loading="lazy" className="h-full w-full object-cover" />
                                    : memoryIdent.avatarLetter}
                                </div>
                                <span className="font-semibold text-foreground/80">{memoryIdent.displayName}</span>
                                <span className="text-muted-foreground/55">·</span>
                                <span>{formatDate(entry.createdAt)}</span>
                              </div>
                            )}
                          </div>
                          {entry.photoUrl && (
                            <div className="mt-3 overflow-hidden rounded-2xl border border-[hsl(var(--kiddo-border)/0.65)]">
                              <img
                                src={entry.photoUrl}
                                alt=""
                                className="w-full h-48 sm:h-52 object-cover"
                                data-testid={`img-note-${entry.id}`}
                              />
                            </div>
                          )}
                          {embeddedVideo && (
                            <div className="mt-3 overflow-hidden rounded-2xl border border-[hsl(var(--kiddo-border)/0.65)]">
                              <iframe
                                src={embeddedVideo}
                                title="Note video"
                                className="w-full h-52 sm:h-56"
                                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                                allowFullScreen
                                sandbox="allow-scripts allow-same-origin allow-popups allow-presentation"
                                data-testid={`video-note-${entry.id}`}
                              />
                            </div>
                          )}
                          {entry.audioUrl && (
                            <div className="mt-3 rounded-2xl border border-[hsl(var(--kiddo-border)/0.65)] bg-background px-4 py-3" data-testid={`audio-note-${entry.id}`}>
                              <div className="mb-2 flex items-center gap-2">
                                <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide">🎙 Voice note</p>
                                <span className="text-muted-foreground/45 ml-auto" aria-hidden><StaticWaveform size="sm" /></span>
                              </div>
                              <audio src={entry.audioUrl} controls className="w-full h-9" />
                              {(entry as any).audioTranscript && (
                                <p className="mt-2 text-[12px] italic text-foreground/75 leading-relaxed">
                                  &ldquo;{(entry as any).audioTranscript}&rdquo;
                                </p>
                              )}
                            </div>
                          )}
                        </div>
                      )}
                    </motion.div>
                  </motion.div>
                </EnlighteningReveal>
              );
            })}
            </div>
            )}
            {filteredEntries.length > visibleEntries.length && (
              <div className={viewMode === "story" ? "pl-10 sm:pl-12" : ""}>
                <Button
                  variant="outline"
                  onClick={() => setVisibleCount((v) => v + 10)}
                  className="rounded-xl"
                  data-testid="button-load-more-memories"
                >
                  Load more memories
                </Button>
              </div>
            )}
          </motion.div>
        )}
        </AnimatePresence>
      </main>

      <AnimatePresence>
        {shareOpen && (
          <motion.div
            className="fixed inset-0 z-[60] bg-black/45 flex items-end md:items-center justify-center p-0 md:p-4"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => { setShareOpen(false); setShareStep("compose"); }}
          >
            <motion.div
              className="w-full md:max-w-lg bg-card rounded-t-3xl md:rounded-3xl p-6 max-h-[90vh] overflow-y-auto"
              initial={prefersReducedMotion ? { opacity: 0 } : { y: 24, opacity: 0 }}
              animate={prefersReducedMotion ? { opacity: 1 } : { y: 0, opacity: 1 }}
              exit={prefersReducedMotion ? { opacity: 0 } : { y: 24, opacity: 0 }}
              transition={{ duration: DUR_NORMAL, ease: EASE_DECEL }}
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-sm font-medium text-primary">
                    {shareStep === "compose" ? "Share with opted-in people" : "Confirm and send"}
                  </p>
                  <h3 className="font-heading text-xl font-semibold text-foreground mt-1">Memory Book update</h3>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  {sharesRemaining < SHARES_PER_YEAR_CAP && (
                    <span
                      className={`rounded-full px-2.5 py-1 text-[11px] font-bold ${
                        sharesRemaining === 0
                          ? "bg-red-50 text-red-700"
                          : sharesRemaining === 1
                            ? "bg-[hsl(var(--kiddo-gold)/0.12)] text-[hsl(var(--kiddo-gold-ink))]"
                            : "bg-muted text-muted-foreground"
                      }`}
                      data-testid="text-share-counter"
                      title={`Up to ${SHARES_PER_YEAR_CAP} updates per year. Keeps each one rare and meaningful for gifters. Resets January 1.`}
                    >
                      {sharesUsedThisYear} of {SHARES_PER_YEAR_CAP} this year
                    </span>
                  )}
                  <button onClick={() => { setShareOpen(false); setShareStep("compose"); }} className="p-2 rounded-xl hover:bg-muted" data-testid="button-close-memory-share" aria-label="Close memory share">
                    <X size={18} />
                  </button>
                </div>
              </div>

              {shareStep === "compose" ? (
                <>
                  <p className="text-sm text-muted-foreground mt-3">
                    This sends a warm, parent-written update. No balances. No portfolio details. Just the moment you want to share.
                  </p>
                  <div className="space-y-4 mt-5">
                    <textarea
                      value={shareMessage}
                      onChange={(e) => setShareMessage(e.target.value)}
                      placeholder="Emma just started first grade. Thank you to everyone who has been part of her story."
                      className="min-h-[140px] w-full rounded-2xl border border-border bg-background px-4 py-3 text-sm"
                      data-testid="textarea-memory-share-message"
                    />
                    {/* Photo upload (replaced the raw URL text input
                        2026-05-20). Real parents have photos on their
                        camera roll, not photo URLs. The picker uploads
                        to /api/funds/:fundId/memory/upload-photo (same
                        endpoint the MemoryMediaPicker uses) and stores
                        the returned URL in sharePhotoUrl state. The
                        submit handler already reads sharePhotoUrl, so
                        no server-side change required. */}
                    {sharePhotoUrl ? (
                      <div className="relative rounded-2xl border border-border overflow-hidden bg-muted/30">
                        <img
                          src={sharePhotoUrl}
                          alt=""
                          className="w-full max-h-64 object-cover"
                        />
                        <button
                          type="button"
                          onClick={() => {
                            setSharePhotoUrl("");
                            setSharePhotoError(null);
                            haptic("light");
                          }}
                          className="absolute top-2 right-2 bg-black/60 text-white rounded-full p-1.5 hover:bg-black/80 transition-colors"
                          aria-label="Remove photo"
                          data-testid="button-memory-share-photo-remove"
                        >
                          <X size={14} />
                        </button>
                      </div>
                    ) : (
                      <>
                        <input
                          ref={sharePhotoInputRef}
                          type="file"
                          accept="image/png,image/jpeg,image/jpg,image/webp,image/heic"
                          className="hidden"
                          onChange={async (e) => {
                            const file = e.target.files?.[0];
                            if (!file) return;
                            setSharePhotoError(null);
                            if (file.size > 3 * 1024 * 1024) {
                              setSharePhotoError("Image too large. Cap is 3MB.");
                              if (sharePhotoInputRef.current) sharePhotoInputRef.current.value = "";
                              return;
                            }
                            setSharePhotoUploading(true);
                            try {
                              const dataUrl = await new Promise<string>((resolve, reject) => {
                                const reader = new FileReader();
                                reader.onload = () => resolve(String(reader.result || ""));
                                reader.onerror = () => reject(new Error("Could not read file"));
                                reader.readAsDataURL(file);
                              });
                              const res = await fetch(`/api/funds/${fundId}/memory/upload-photo`, {
                                method: "POST",
                                credentials: "include",
                                headers: { "Content-Type": "application/json" },
                                body: JSON.stringify({ dataUrl }),
                              });
                              const data = await res.json().catch(() => ({}));
                              if (!res.ok) throw new Error(data?.message || data?.error || "Upload failed");
                              const url = data?.url || data?.photoUrl;
                              if (!url) throw new Error("No URL returned");
                              setSharePhotoUrl(String(url));
                              haptic("success");
                            } catch (err) {
                              setSharePhotoError(err instanceof Error ? err.message : "Upload failed");
                              haptic("error");
                            } finally {
                              setSharePhotoUploading(false);
                              if (sharePhotoInputRef.current) sharePhotoInputRef.current.value = "";
                            }
                          }}
                          data-testid="input-memory-share-photo-file"
                        />
                        <button
                          type="button"
                          onClick={() => {
                            haptic("selection");
                            sharePhotoInputRef.current?.click();
                          }}
                          disabled={sharePhotoUploading}
                          className="flex h-12 w-full items-center justify-center gap-2 rounded-2xl border border-dashed border-border bg-background px-4 text-sm text-muted-foreground hover:bg-muted/30 hover:text-foreground transition-colors disabled:opacity-50"
                          data-testid="button-memory-share-photo-add"
                        >
                          <Camera size={16} />
                          {sharePhotoUploading ? "Uploading..." : "Add a photo (optional)"}
                        </button>
                      </>
                    )}
                    {sharePhotoError && (
                      <p className="text-xs text-destructive" data-testid="text-memory-share-photo-error">
                        {sharePhotoError}
                      </p>
                    )}
                    {sharesRemaining === 0 ? (
                      <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900 leading-relaxed">
                        <p className="font-semibold mb-1">All {SHARES_PER_YEAR_CAP} updates sent this year.</p>
                        <p className="text-amber-800/90">
                          We cap at {SHARES_PER_YEAR_CAP} so updates stay rare and meaningful. Gifters opted in for milestone moments, not a newsletter. The counter resets January 1.
                        </p>
                        {pastShares.length > 0 && (
                          <p className="text-xs text-amber-800/70 mt-2">
                            Scroll down to revisit, copy, or re-share the {pastShares.length} {pastShares.length === 1 ? "update" : "updates"} you've already sent.
                          </p>
                        )}
                      </div>
                    ) : sharesRemaining === 1 ? (
                      <div className="rounded-2xl border border-[hsl(var(--kiddo-gold)/0.30)] bg-[hsl(var(--kiddo-cream))] px-4 py-3 text-xs text-foreground/85 leading-relaxed">
                        Last update for this year. We cap at {SHARES_PER_YEAR_CAP} so updates stay rare and meaningful. Counter resets January 1.
                      </div>
                    ) : null}
                    <Button
                      className="w-full"
                      onClick={handleSubmitShare}
                      disabled={!shareMessage.trim() || sharesRemaining === 0}
                      data-testid="button-submit-memory-share"
                    >
                      Review who gets this →
                    </Button>
                  </div>

                  {/* Past updates — what the parent sent before. Each entry
                      expands to show the full message + photo + recipient
                      count + a "copy link" affordance to re-share the same
                      URL (e.g. paste into a text thread). Newest first. */}
                  {pastShares.length > 0 && (
                    <div className="mt-6 pt-5 border-t border-border">
                      <p className="text-[11px] font-bold uppercase tracking-wide text-muted-foreground mb-2">
                        Updates you've sent
                      </p>
                      <div className="space-y-2">
                        {pastShares.map((share) => {
                          const isExpanded = expandedPastShareToken === share.token;
                          const sentDate = share.createdAt
                            ? new Date(share.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
                            : "Recently";
                          const preview = share.message.length > 80 ? `${share.message.slice(0, 80)}…` : share.message;
                          return (
                            <div
                              key={share.token}
                              className="rounded-2xl border border-border bg-muted/30 overflow-hidden"
                              data-testid={`past-share-${share.token}`}
                            >
                              <button
                                type="button"
                                onClick={() => {
                                  haptic("selection");
                                  setExpandedPastShareToken(isExpanded ? null : share.token);
                                }}
                                className="w-full text-left px-4 py-3 hover:bg-muted/50 transition-colors"
                              >
                                <div className="flex items-baseline justify-between gap-3">
                                  <span className="text-[11px] font-semibold text-foreground">{sentDate}</span>
                                  <span className="text-[10px] text-muted-foreground">
                                    Sent to {share.recipientCount} {share.recipientCount === 1 ? "gifter" : "gifters"}
                                  </span>
                                </div>
                                {!isExpanded && (
                                  <p className="mt-1 text-xs text-muted-foreground leading-snug truncate">
                                    {preview}
                                  </p>
                                )}
                              </button>
                              {isExpanded && (
                                <div className="px-4 pb-3 space-y-2.5">
                                  {share.photoUrl && (
                                    <img
                                      src={share.photoUrl}
                                      alt="Update photo"
                                      className="w-full max-h-40 rounded-xl object-cover"
                                      onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = "none"; }}
                                    />
                                  )}
                                  <blockquote className="rounded-xl border border-border/60 bg-card px-3 py-2.5 text-xs text-foreground leading-relaxed whitespace-pre-wrap">
                                    {share.message}
                                  </blockquote>
                                  <div className="flex gap-2">
                                    <button
                                      type="button"
                                      onClick={async () => {
                                        haptic("selection");
                                        try {
                                          await navigator.clipboard.writeText(share.shareUrl);
                                          setCopiedShareToken(share.token);
                                          window.setTimeout(() => setCopiedShareToken((curr) => (curr === share.token ? null : curr)), 2000);
                                        } catch {
                                          toast({ title: "Couldn't copy", variant: "destructive" });
                                        }
                                      }}
                                      className="flex-1 text-[11px] font-semibold text-[hsl(var(--kiddo-evergreen))] hover:underline py-1"
                                      data-testid={`button-copy-past-share-${share.token}`}
                                    >
                                      {copiedShareToken === share.token ? "Copied" : "Copy share link"}
                                    </button>
                                    <a
                                      href={share.shareUrl}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className="flex-1 text-center text-[11px] font-semibold text-muted-foreground hover:text-foreground py-1"
                                      onClick={() => haptic("selection")}
                                    >
                                      Open in new tab
                                    </a>
                                  </div>
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </>
              ) : (
                <div className="space-y-5 mt-4">
                  {/* Recipient summary — names where we have them, fall back to
                      counts if the list is empty. Parent should see who they're
                      about to email before they tap Send. */}
                  <div className="rounded-2xl border border-[hsl(var(--kiddo-evergreen)/0.18)] bg-[hsl(var(--kiddo-evergreen)/0.06)] p-4">
                    <p className="text-[11px] font-bold uppercase tracking-wide text-[hsl(var(--kiddo-evergreen))]">
                      Going to {optedInCount === 0 ? "no one yet" : `${optedInCount} opted-in ${optedInCount === 1 ? "gifter" : "gifters"}`}
                    </p>
                    {optedInCount === 0 ? (
                      <p className="mt-2 text-sm text-foreground leading-relaxed">
                        No one's opted in to receive Memory Book updates yet. We'll save this share, and it'll send the moment a gifter opts in (and it counts toward your {SHARES_PER_YEAR_CAP}-per-year cap).
                      </p>
                    ) : (
                      <p className="mt-2 text-sm text-foreground leading-relaxed">
                        {optedInGifters.slice(0, 8).map((g, i) => (
                          <span key={g.email}>
                            <span className="font-semibold">{g.name}</span>
                            {i < Math.min(optedInGifters.length, 8) - 1 ? ", " : ""}
                          </span>
                        ))}
                        {optedInGifters.length > 8 && ` & ${optedInGifters.length - 8} more`}
                      </p>
                    )}
                  </div>

                  {/* Email preview — shows what the recipients will actually
                      see in their inbox. Same shape as the worker template:
                      subject + body + photo + the parent-written note. */}
                  <div className="rounded-2xl border border-border bg-muted/40 p-4 space-y-3">
                    <p className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground">Email preview</p>
                    <p className="text-sm font-semibold text-foreground">
                      An update from {isOwnerMode ? "your" : childName ? `${childName}'s` : "their"} Memory Book
                    </p>
                    {sharePhotoUrl.trim() && (
                      <img
                        src={sharePhotoUrl.trim()}
                        alt="Update preview"
                        className="w-full max-h-48 rounded-xl object-cover"
                        onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = "none"; }}
                      />
                    )}
                    <blockquote className="rounded-xl border border-border/60 bg-background px-3 py-2.5 text-sm text-foreground leading-relaxed whitespace-pre-wrap">
                      {shareMessage.trim()}
                    </blockquote>
                    <p className="text-[11px] text-muted-foreground/80 leading-relaxed">
                      They'll also see "Gift {childName || "again"}" and "Start my own fund" buttons, plus a one-click unsubscribe link.
                    </p>
                  </div>

                  {memoryShareMutation.isError && (
                    <p className="text-sm text-red-600">
                      {memoryShareMutation.error instanceof Error ? memoryShareMutation.error.message : "Could not queue this update."}
                    </p>
                  )}

                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      className="flex-1"
                      onClick={() => { haptic("light"); setShareStep("compose"); }}
                      disabled={memoryShareMutation.isPending}
                      data-testid="button-back-memory-share"
                    >
                      ← Edit
                    </Button>
                    <Button
                      className="flex-[2]"
                      onClick={handleConfirmShare}
                      disabled={memoryShareMutation.isPending}
                      data-testid="button-confirm-memory-share"
                    >
                      {memoryShareMutation.isPending
                        ? "Sending…"
                        : optedInCount > 0
                          ? `Send to ${optedInCount} ${optedInCount === 1 ? "gifter" : "gifters"}`
                          : "Queue this update"}
                    </Button>
                  </div>
                </div>
              )}
            </motion.div>
          </motion.div>
        )}
        {showModal && (
          <motion.div
            className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <motion.div
              className="absolute inset-0 bg-black/40 backdrop-blur-sm"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowModal(false)}
              data-testid="modal-overlay"
            />
            <motion.div
              className="relative w-full max-w-md bg-card rounded-t-3xl sm:rounded-2xl border border-border/50 shadow-premium-lg overflow-hidden flex flex-col max-h-[92vh] sm:max-h-[88vh]"
              initial={prefersReducedMotion ? { opacity: 0 } : { y: 100, opacity: 0 }}
              animate={prefersReducedMotion ? { opacity: 1 } : { y: 0, opacity: 1 }}
              exit={prefersReducedMotion ? { opacity: 0 } : { y: 100, opacity: 0 }}
              transition={prefersReducedMotion ? { duration: DUR_FAST } : SPRING_SHEET}
            >
              {/* Sticky header — stays visible while body scrolls so the
                  close button is always reachable. flex-shrink-0 prevents
                  it from collapsing under flex-col. */}
              <div className="flex items-center justify-between p-4 sm:p-5 border-b border-border/50 flex-shrink-0">
                  <h2 className="text-lg font-heading font-semibold text-foreground" data-testid="text-modal-title">
                    {editingEntry ? "Edit Memory" : "Add Memory"}
                  </h2>
                <button
                  onClick={() => setShowModal(false)}
                  className="p-1.5 rounded-lg hover:bg-muted transition-colors"
                  data-testid="button-close-modal"
                  aria-label={editingEntry ? "Close edit memory dialog" : "Close add memory dialog"}
                >
                  <X size={18} className="text-muted-foreground" />
                </button>
              </div>

                {/* Scrollable body — grows to fill, scrolls when content
                    exceeds available space. The submit button at the bottom
                    is part of this scroll so the user reaches it naturally. */}
                <div className="p-4 sm:p-5 space-y-4 sm:space-y-5 overflow-y-auto flex-1 min-h-0">
                  {(formError || uploadError) && (
                    <div className="rounded-lg border border-red-300 bg-red-50 px-3 py-2 text-xs text-red-700" data-testid="text-memory-form-error">
                      {formError || uploadError}
                    </div>
                  )}
                  <div>
                  <label className="text-sm font-normal text-foreground mb-2 block">Type</label>
                  <div className="flex gap-2">
                    {(["milestone", "photo", "note"] as const).map((t) => {
                      const cfg = typeConfig[t];
                      const Icon = cfg.icon;
                      const isActive = entryType === t;
                      return (
                        <button
                          key={t}
                          onClick={() => { haptic("selection"); setEntryType(t); }}
                          className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-sm font-medium transition-all ${
                            isActive
                              ? "bg-primary text-primary-foreground shadow-sm"
                              : "bg-muted text-muted-foreground hover:bg-muted/80"
                          }`}
                          data-testid={`button-type-${t}`}
                        >
                          <Icon size={14} />
                          {cfg.label}
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div>
                  <label className="text-sm font-normal text-foreground mb-2 block">
                    {entryType === "milestone" ? "What happened" : entryType === "photo" ? "Caption" : "Note"}
                  </label>
                  {/* Char limits per type:
                       - photo Caption: 120 (one-liner; discourages
                         paragraph-as-caption fighting the Memory
                         Book inversion in feedback_memory_book_inversion.md).
                       - milestone "What happened": 280. A real
                         milestone note ("First day of kindergarten.
                         She walked in holding the lunchbox we picked
                         out, didn't look back. I cried in the car.")
                         is ~150 chars; 120 was too tight and forced
                         truncation that defeated the whole capture
                         flow. Locked 2026-05-18 per the milestone
                         composer polish pass.
                       - note paragraph context: 600. Unchanged.
                      The counter + maxLength below both pull from
                      the same `contentMaxLength` constant. */}
                  {(() => {
                    const contentMaxLength = entryType === "note" ? 600 : entryType === "milestone" ? 280 : 120;
                    return (
                      <>
                        <textarea
                          value={content}
                          onChange={(e) => setContent(e.target.value)}
                          maxLength={contentMaxLength}
                          placeholder={
                            isFeatured && entryType === "note"
                              ? `Write something ${fundName.split("'s")[0] || "them"} will read when ${childPronouns.subject} ${childPronouns.singular ? "is" : "are"} 18. This goes at the beginning of ${childPronouns.possAdj} Memory Book. The first thing ${childPronouns.subject} ${childPronouns.singular ? "sees" : "see"}. Write it now. The best ones are written early.`
                              : entryType === "milestone"
                              ? milestonePrompts[milestonePromptSeed % milestonePrompts.length]
                              : entryType === "photo"
                              ? "A special moment..."
                              : `What was happening in ${fundName.split("'s")[0] || "their"}'s life when this gift arrived?`
                          }
                          rows={entryType === "note" ? 3 : 2}
                          className="w-full rounded-xl border border-border bg-background px-4 py-3 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all"
                          data-testid="input-content"
                        />
                        <p className="text-xs text-muted-foreground mt-1">{content.length}/{contentMaxLength}</p>
                      </>
                    );
                  })()}
                </div>

                <div>
                  <label className="text-sm font-normal text-foreground mb-2 block">Your name</label>
                  <input
                    type="text"
                    value={authorName}
                    onChange={(e) => setAuthorName(e.target.value)}
                    placeholder="Your name"
                    className="w-full rounded-xl border border-border bg-background px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all"
                    data-testid="input-author-name"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="text-sm font-normal text-foreground mb-2 block">Visibility</label>
                    <select
                      value={visibility}
                      onChange={(e) => setVisibility(e.target.value as "public" | "family" | "private")}
                      className="w-full rounded-xl border border-border bg-background px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all"
                      data-testid="select-memory-visibility"
                    >
                      <option value="public">Anyone with link (shown on gift page)</option>
                      <option value="family">Family only</option>
                      <option value="private">Private (admin view only)</option>
                    </select>
                  </div>
                  <div className="flex items-end">
                    <button
                      type="button"
                      onClick={() => { haptic("light"); setSaveForBirthday((v) => !v); }}
                      className={`w-full rounded-xl border px-4 py-3 text-sm font-medium transition-colors text-left ${
                        saveForBirthday ? "border-[hsl(var(--kiddo-gold-ink))] bg-[hsl(var(--kiddo-gold)/0.10)] text-[hsl(var(--kiddo-gold-ink))]" : "border-border bg-background text-foreground"
                      }`}
                      data-testid="button-save-for-birthday"
                      title={`When on, this entry stays hidden in Kid View until the child turns ${fundMajorityAge}. The reveal moment.`}
                    >
                      <span className="flex items-center gap-1.5">
                        <span aria-hidden="true">🔑</span>
                        <span className="text-[12px] leading-tight">{saveForBirthday ? `Saved for ${fundMajorityOrdinal} birthday` : `Save for ${fundMajorityOrdinal} birthday`}</span>
                      </span>
                    </button>
                  </div>
                </div>

                {/* "More options" disclosure — collapsed by default to
                    keep the composer at 5 visible sections (Type / What
                    happened / Your name / Visibility+Save-for-18 /
                    media). Pin lives inside because it's editable from
                    the entry's row menu after creation, so most parents
                    won't reach for it on first capture. If a pinned
                    entry is opened for editing, the disclosure expands
                    automatically so the active state isn't hidden. */}
                {showMoreOptions || isFeatured ? (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="flex items-end">
                      <button
                        type="button"
                        onClick={() => setIsFeatured((v) => !v)}
                        className={`w-full rounded-xl border px-4 py-3 text-sm font-medium transition-colors ${
                          isFeatured ? "border-amber-400 bg-amber-50 text-amber-900" : "border-border bg-background text-foreground"
                        }`}
                        data-testid="button-memory-featured"
                      >
                        <span className="inline-flex items-center gap-1.5"><Pin size={14} /> {isFeatured ? "Pinned" : "Pin this memory"}</span>
                      </button>
                    </div>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => setShowMoreOptions(true)}
                    className="text-xs text-muted-foreground hover:text-foreground underline"
                    data-testid="button-toggle-more-options"
                  >
                    More options
                  </button>
                )}

                {(entryType === "photo" || entryType === "milestone") && (
                  <div>
                    <label className="text-sm font-normal text-foreground mb-2 block">Photo (optional)</label>
                    <div className="flex gap-2 mb-2 flex-wrap">
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => photoInputRef.current?.click()}
                        disabled={uploadingPhoto}
                        className="rounded-xl"
                        data-testid="button-upload-memory-photo"
                      >
                        {uploadingPhoto ? "Uploading..." : "Upload Photo"}
                      </Button>
                      <input
                        ref={photoInputRef}
                        type="file"
                        accept="image/png,image/jpeg,image/jpg,image/webp,image/gif"
                        onChange={handlePhotoFileUpload}
                        className="hidden"
                        data-testid="input-upload-memory-photo"
                      />
                      {uploadError && retryFile && (
                        <Button
                          type="button"
                          variant="outline"
                          className="rounded-xl"
                          onClick={() => uploadPhotoFile(retryFile)}
                          disabled={uploadingPhoto}
                          data-testid="button-retry-memory-upload"
                        >
                          Retry Upload
                        </Button>
                      )}
                      {!showPhotoUrlInput && (
                        <button
                          type="button"
                          onClick={() => setShowPhotoUrlInput(true)}
                          className="text-xs text-muted-foreground hover:text-foreground underline self-center"
                          data-testid="button-toggle-photo-url"
                        >
                          Or paste a URL
                        </button>
                      )}
                    </div>
                    {showPhotoUrlInput && (
                      <input
                        type="url"
                        value={photoUrl}
                        onChange={(e) => setPhotoUrl(e.target.value)}
                        placeholder="Paste an image URL"
                        className="w-full rounded-xl border border-border bg-background px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all"
                        data-testid="input-photo-url"
                      />
                    )}
                  </div>
                )}

                <div>
                  <label className="text-sm font-normal text-foreground mb-2 block">Video link (optional)</label>
                  <div className="flex gap-2 mb-2 flex-wrap">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => videoInputRef.current?.click()}
                      disabled={uploadingVideo}
                      className="rounded-xl"
                      data-testid="button-upload-memory-video"
                    >
                      {uploadingVideo ? "Uploading..." : "Upload Video"}
                    </Button>
                    <input
                      ref={videoInputRef}
                      type="file"
                      accept="video/mp4,video/webm,video/quicktime"
                      onChange={handleVideoFileUpload}
                      className="hidden"
                      data-testid="input-upload-memory-video"
                    />
                    {!showVideoUrlInput && (
                      <button
                        type="button"
                        onClick={() => setShowVideoUrlInput(true)}
                        className="text-xs text-muted-foreground hover:text-foreground underline self-center"
                        data-testid="button-toggle-video-url"
                      >
                        Or paste a URL
                      </button>
                    )}
                  </div>
                  {/* Helper text below was dropped 2026-05-12 — the
                      placeholder ("YouTube, Vimeo, or Loom URL") already
                      carries the same information, and the duplicate
                      sentence added visual noise on a form that already
                      has 8+ fields. Less chrome, same comprehension. */}
                  {showVideoUrlInput && (
                    <input
                      type="url"
                      value={videoUrl}
                      onChange={(e) => setVideoUrl(e.target.value)}
                      placeholder="YouTube, Vimeo, or Loom URL"
                      className="w-full rounded-xl border border-border bg-background px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all"
                      data-testid="input-video-url"
                    />
                  )}
                </div>

                {/* Voice note — record live in-app or upload an existing file.
                    Voice is the moat: Emma at 18 hearing your voice from when
                    she was 3 is the unrepeatable artifact nothing else in this
                    category offers. Soft 60s cap so a single note stays a
                    moment, not an audiobook. Records via the MediaRecorder
                    browser API; the OS handles the mic-permission prompt. */}
                <div>
                  <label className="text-sm font-normal text-foreground mb-2 block">Voice note (optional) 🎙</label>
                  {audioUrl ? (
                    <div className="rounded-xl border border-[hsl(var(--kiddo-evergreen)/0.20)] bg-[hsl(var(--kiddo-evergreen)/0.04)] p-3 mb-2">
                      <audio src={audioUrl} controls className="w-full h-9" data-testid="audio-preview" />
                      {audioTranscript && (
                        <p className="mt-2 text-[12px] italic text-foreground/80 leading-relaxed" data-testid="text-audio-transcript">
                          &ldquo;{audioTranscript}&rdquo;
                        </p>
                      )}
                      <button
                        type="button"
                        onClick={() => { haptic("light"); setAudioUrl(""); setAudioTranscript(""); }}
                        className="mt-2 text-[11px] font-semibold text-muted-foreground hover:text-destructive transition-colors"
                        data-testid="button-clear-audio"
                      >
                        Remove voice note
                      </button>
                    </div>
                  ) : recordingAudio ? (
                    <div className="rounded-xl border border-red-200 bg-red-50 p-3 mb-2 flex items-center justify-between gap-3">
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="h-2.5 w-2.5 rounded-full bg-red-500 animate-pulse shrink-0" aria-hidden="true" />
                        <span className="text-sm font-semibold text-red-800 tabular-nums">
                          Recording · {String(Math.floor(recordingSeconds / 60)).padStart(2, "0")}:{String(recordingSeconds % 60).padStart(2, "0")}
                        </span>
                      </div>
                      <Button
                        type="button"
                        variant="outline"
                        onClick={stopAudioRecording}
                        className="rounded-xl bg-white shrink-0"
                        data-testid="button-stop-recording"
                      >
                        Stop
                      </Button>
                    </div>
                  ) : (
                    <div className="flex gap-2 mb-2">
                      <Button
                        type="button"
                        variant="outline"
                        onClick={startAudioRecording}
                        disabled={uploadingAudio}
                        className="rounded-xl"
                        data-testid="button-record-voice"
                      >
                        🎙 Record
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => audioInputRef.current?.click()}
                        disabled={uploadingAudio}
                        className="rounded-xl"
                        data-testid="button-upload-voice"
                      >
                        {uploadingAudio ? "Uploading..." : "Upload Audio"}
                      </Button>
                      <input
                        ref={audioInputRef}
                        type="file"
                        accept="audio/webm,audio/mp4,audio/m4a,audio/mpeg,audio/mp3,audio/ogg,audio/wav"
                        onChange={handleAudioFileUpload}
                        className="hidden"
                        data-testid="input-upload-memory-audio"
                      />
                    </div>
                  )}
                  {!audioUrl && !recordingAudio && (
                    <p className="text-xs text-muted-foreground mt-1">
                      {/* Natural-English contraction (was the awkward
                          "Emma'll" template). Uses getPronouns for the
                          possessive so the line respects the fund's
                          pronoun setting — "her" / "his" / "their"
                          18th birthday. */}
                      Up to 60 seconds. {childName ? `${childName} will` : "They'll"} hear your voice on {childPronouns.possAdj} {fundMajorityOrdinal} birthday.
                    </p>
                  )}
                </div>

                <Button
                  onClick={handleSubmit}
                  disabled={!canSubmit || createMutation.isPending || updateMutation.isPending}
                  className="w-full h-12 rounded-xl font-semibold text-base"
                  data-testid="button-submit-entry"
                >
                  {createMutation.isPending || updateMutation.isPending
                    ? (editingEntry ? "Saving..." : "Adding...")
                    : (editingEntry ? "Save Changes" : "Add to Memory Book")}
                </Button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
      {/* Lightbox — full-resolution photo viewer. Tapping a photo
          preview in the list view opens this overlay; tapping outside
          the image or the close button dismisses. Body scroll locked
          while open (handled in the useEffect that owns lightboxMedia).
          Animation: simple fade for the backdrop + zoom-in for the
          image so the viewer feels like a deliberate "expand," not a
          jump-cut. */}
      <AnimatePresence>
        {lightboxMedia && (
          <motion.div
            key="memory-lightbox"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: DUR_FAST }}
            role="dialog"
            aria-modal="true"
            aria-label="Full-size media"
            data-testid="memory-lightbox"
            onClick={() => setLightboxMedia(null)}
            style={{
              position: "fixed", inset: 0, zIndex: 95,
              background: "rgba(20,18,12,0.88)",
              backdropFilter: "blur(6px)",
              display: "flex", alignItems: "center", justifyContent: "center",
              padding: 24,
              cursor: "zoom-out",
            }}
          >
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); setLightboxMedia(null); }}
              aria-label="Close"
              data-testid="memory-lightbox-close"
              style={{
                position: "absolute", top: 16, right: 16,
                width: 36, height: 36, borderRadius: 999,
                background: "rgba(255,255,255,0.14)", border: "1px solid rgba(255,255,255,0.20)",
                color: "white",
                display: "inline-flex", alignItems: "center", justifyContent: "center",
                cursor: "pointer",
              }}
            >
              <X size={18} />
            </button>
            <motion.div
              initial={prefersReducedMotion ? { opacity: 0 } : { scale: 0.94, opacity: 0 }}
              animate={prefersReducedMotion ? { opacity: 1 } : { scale: 1, opacity: 1 }}
              exit={prefersReducedMotion ? { opacity: 0 } : { scale: 0.96, opacity: 0 }}
              transition={{ duration: DUR_NORMAL, ease: EASE_DECEL }}
              onClick={(e) => e.stopPropagation()}
              style={{
                maxWidth: "min(96vw, 1100px)",
                maxHeight: "92vh",
                display: "flex", alignItems: "center", justifyContent: "center",
                cursor: "default",
              }}
            >
              {lightboxMedia.kind === "image" && (
                <img
                  src={lightboxMedia.url}
                  alt=""
                  style={{
                    maxWidth: "100%",
                    maxHeight: "92vh",
                    width: "auto",
                    height: "auto",
                    display: "block",
                    borderRadius: 8,
                    boxShadow: "0 16px 48px rgba(0,0,0,0.40)",
                  }}
                  data-testid="memory-lightbox-image"
                />
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* TrustMicroStrip removed — the SIPC / DriveWealth / "investing
          involves risk" disclaimer footer ages badly here. Memory Book
          is the surface a kid reads at 18. The last line they should
          see in the closing margin of their love-letter book is NOT
          "investing involves risk." Trust signals belong on Dashboard,
          Activity, and gifter checkout — surfaces where the financial
          context is the point. Memory Book ends with story, not
          securities law. */}

      {/* ────────────────────────────────────────────────────────────
          BOOK VIEW — the ceremony surface.

          A full-screen reading experience. One entry per page. The
          parent (or the kid at 18) reads cover-to-cover, not scans.
          Distinct from Story/Timeline (inline list modes) because it
          owns the entire viewport.

          Content order:
            • Cover (index 0): child's name, Memory Book, started date,
              counts.
            • Entries (index 1..N): one entry per page, sorted oldest
              first so the book reads chronologically (the way an actual
              book does — the first gift IS where it began).

          Navigation: swipe (Framer Motion drag), arrow keys, dot
          indicators. Close returns to the inline list view.

          Note as hero. Financial data as footnote. Per the locked
          `feedback_memory_book_inversion` rule. ──────────────────── */}
      <AnimatePresence>
        {bookOpen && (() => {
          // Pages: cover first, then entries oldest-to-newest so the book
          // reads forward in time. Filter out broken/test entries the
          // same way the list view does (test-pattern senders bucket
          // into "Anonymous"). gift_message + parent_note + milestone
          // are the readable types — photo/note types render too if
          // they're parent-added.
          const bookEntries = sortedEntries
            .filter((e) => ["gift_message", "parent_note", "milestone", "photo", "note"].includes(e.type))
            .slice()
            .reverse(); // chronological forward (sortedEntries is newest first)
          // Pages: cover (0), entries (1..N), community (optional),
          // sealed letter (optional, parent-only), closing page (last).
          // The community page is the EarlyBird Nest restated — "These
          // N people built this." It only renders when the fund has at
          // least one named or anonymous gifter. The sealed letter
          // page renders the parent's at-18 note as a wax-sealed
          // ceremony slot — visible to the parent always (write/read),
          // hidden from kid view until age of majority. The closing
          // page is the celebratory book-end — a quiet "the story
          // continues" beat that gives the book a real ending instead
          // of just running out.
          const hasCommunityPage = gifterRoster.length > 0 && bookEntries.length > 0;
          const hasSealedSlot = isOwner && bookEntries.length > 0;
          const communityPageIdx = bookEntries.length + 1;
          const sealedPageIdx = communityPageIdx + (hasCommunityPage ? 1 : 0);
          const closingPageIdx = sealedPageIdx + (hasSealedSlot ? 1 : 0);
          const totalPages = 1 + bookEntries.length
            + (hasCommunityPage ? 1 : 0)
            + (hasSealedSlot ? 1 : 0)
            + (bookEntries.length > 0 ? 1 : 0);
          const safeIndex = Math.max(0, Math.min(bookPageIndex, totalPages - 1));
          const isCover = safeIndex === 0;
          const isCommunityPage = hasCommunityPage && safeIndex === communityPageIdx;
          const isSealedPage = hasSealedSlot && safeIndex === sealedPageIdx;
          const isClosingPage = safeIndex === closingPageIdx && bookEntries.length > 0;
          const currentEntry = (isCover || isClosingPage || isCommunityPage || isSealedPage) ? null : bookEntries[safeIndex - 1];
          // Story start = fund creation date, NOT the first gift's date.
          // The parent created the fund on day zero; that's when the
          // story began. Falls back to the first entry only if the fund
          // record is missing createdAt (defensive — should never trip
          // in production).
          const storyStart = fundData?.createdAt || bookEntries[0]?.createdAt;
          const fundCreated = storyStart
            ? new Date(storyStart).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric", timeZone: "UTC" })
            : null;
          const goPage = (delta: number) => {
            const next = safeIndex + delta;
            if (next < 0 || next >= totalPages) return;
            haptic(delta > 0 ? "selection" : "light");
            setBookSlideDirection(delta);
            setBookPageIndex(next);
          };
          return (
            <motion.div
              key="book-view-modal"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: DUR_SLOW, ease: EASE_STANDARD }}
              role="dialog"
              aria-modal="true"
              aria-label={`${isOwnerMode ? "Your" : childName ? `${childName}'s` : ""} Memory Book, book view`}
              data-testid="memory-book-view"
              style={{
                position: "fixed", inset: 0, zIndex: 90,
                background: "linear-gradient(135deg, #f5f0e8 0%, #ebe4d4 60%, #f5f0e8 100%)",
                display: "flex", flexDirection: "column",
                overflow: "hidden",
              }}
              onKeyDown={(e) => {
                if (e.key === "ArrowLeft") goPage(-1);
                else if (e.key === "ArrowRight") goPage(1);
                else if (e.key === "Escape") setBookOpen(false);
              }}
              tabIndex={-1}
              ref={(node) => { node?.focus(); }}
            >
              {/* Decorative spine shadow on the left edge — gives the
                  page a "stacked book" feel without trying to fake a
                  real 3D paper turn. Subtle; mostly suggestion. */}
              <div style={{ position: "absolute", left: 0, top: 0, bottom: 0, width: 24, background: "linear-gradient(to right, rgba(26,23,16,0.12) 0%, rgba(26,23,16,0.04) 60%, transparent 100%)", pointerEvents: "none", zIndex: 1 }} />

              {/* Top bar — close + share */}
              <div style={{ position: "relative", zIndex: 2, display: "flex", alignItems: "center", justifyContent: "space-between", padding: "16px 20px 0", flexShrink: 0 }}>
                <button
                  type="button"
                  onClick={() => { haptic("light"); setBookOpen(false); }}
                  data-testid="button-close-book-view"
                  style={{
                    display: "inline-flex", alignItems: "center", gap: 6,
                    padding: "8px 14px", borderRadius: 999,
                    background: "rgba(26,23,16,0.06)", border: "1px solid rgba(26,23,16,0.10)",
                    color: "rgba(26,23,16,0.65)", fontSize: 12.5, fontWeight: 600,
                    cursor: "pointer",
                  }}
                >
                  <X size={14} />
                  Close
                </button>
                {!isCover && currentEntry && (
                  <button
                    type="button"
                    onClick={() => { haptic("light"); setShareOpen(true); }}
                    data-testid="button-book-page-share"
                    style={{
                      display: "inline-flex", alignItems: "center", gap: 6,
                      padding: "8px 14px", borderRadius: 999,
                      background: "rgba(26,23,16,0.06)", border: "1px solid rgba(26,23,16,0.10)",
                      color: "rgba(26,23,16,0.65)", fontSize: 12.5, fontWeight: 600,
                      cursor: "pointer",
                    }}
                  >
                    <Send size={13} />
                    Share
                  </button>
                )}
              </div>

              {/* Page area — swipeable, animated. Each page carries
                  a directional drop-shadow that intensifies the felt
                  sense of "physical page being moved aside" without
                  trying to fake real 3D paper-curl physics. The shadow
                  shifts based on bookSlideDirection: forward (>= 0) =
                  shadow on the right edge of the OUTGOING page, so the
                  next page appears to come from underneath; backward
                  (< 0) = shadow on the left edge. Cubic ease-out is
                  the iOS-natural curve for "pages settling." Restraint
                  version of the page turn — the 3D physics version
                  waits until it can land perfectly. */}
              <div style={{ position: "relative", flex: 1, minHeight: 0, display: "flex", alignItems: "center", justifyContent: "center", padding: "12px 20px 8px" }}>
                {/* Book-page swap. popLayout (not "wait") so the new
                    page slides in while the old slides out — feels
                    like a real book turn, not a swap. Reduced-motion
                    bails out of the x-translate so the page just
                    crossfades. */}
                <AnimatePresence mode="popLayout">
                  <motion.div
                    key={safeIndex}
                    initial={prefersReducedMotion ? { opacity: 0 } : { x: bookSlideDirection >= 0 ? 96 : -96, opacity: 0 }}
                    animate={prefersReducedMotion ? { opacity: 1 } : { x: 0, opacity: 1 }}
                    exit={prefersReducedMotion ? { opacity: 0 } : { x: bookSlideDirection >= 0 ? -96 : 96, opacity: 0 }}
                    transition={{ duration: DUR_SLOW, ease: EASE_DECEL }}
                    drag="x"
                    dragConstraints={{ left: 0, right: 0 }}
                    dragElastic={0.32}
                    dragMomentum={false}
                    onDragEnd={(_, info) => {
                      const w = typeof window !== "undefined" ? window.innerWidth : 400;
                      if (info.offset.x < -Math.min(120, w * 0.18) || info.velocity.x < -480) goPage(1);
                      else if (info.offset.x > Math.min(120, w * 0.18) || info.velocity.x > 480) goPage(-1);
                    }}
                    style={{
                      width: "100%",
                      maxWidth: 560,
                      maxHeight: "100%",
                      cursor: "grab",
                      // Directional drop-shadow — depth cue that reads
                      // as "page over page." filter:drop-shadow respects
                      // the rounded corners of the page so the shadow
                      // hugs the silhouette, not the bounding box.
                      filter: bookSlideDirection >= 0
                        ? "drop-shadow(0 14px 28px rgba(26,23,16,0.10)) drop-shadow(8px 0 12px rgba(26,23,16,0.05))"
                        : "drop-shadow(0 14px 28px rgba(26,23,16,0.10)) drop-shadow(-8px 0 12px rgba(26,23,16,0.05))",
                    }}
                  >
                    {isCover ? (
                      // ─── Cover page ───
                      <div style={{
                        background: "linear-gradient(160deg, rgba(255,255,255,0.6) 0%, rgba(245,240,232,0.95) 100%)",
                        border: "1px solid rgba(26,23,16,0.10)",
                        borderRadius: 24,
                        padding: "44px 28px 36px",
                        boxShadow: "0 12px 40px rgba(26,23,16,0.10), 0 2px 6px rgba(26,23,16,0.06)",
                        textAlign: "center" as const,
                      }} data-testid="book-page-cover">
                        <p style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.10em", textTransform: "uppercase", color: "hsl(var(--kiddo-gold))", marginBottom: 18 }}>
                          A Memory Book
                        </p>
                        <h2 className="font-heading" style={{ fontSize: 36, fontWeight: 700, color: "hsl(var(--kiddo-ink))", lineHeight: 1.15, marginBottom: 14, letterSpacing: "-0.01em" }}>
                          {isOwnerMode ? "Your Story" : childName ? `${childName}'s Story` : "Their Story"}
                        </h2>
                        <p className="font-serif italic" style={{ fontSize: 16, color: "rgba(26,23,16,0.65)", lineHeight: 1.6, marginBottom: 28, maxWidth: 380, marginLeft: "auto", marginRight: "auto" }}>
                          Every gift has a story.
                          {fundCreated && <><br />This one began {fundCreated}.</>}
                        </p>
                        <div style={{ display: "flex", justifyContent: "center", gap: 22, marginBottom: 28 }}>
                          <div>
                            <p className="font-heading" style={{ fontSize: 22, fontWeight: 700, color: "hsl(var(--kiddo-ink))", lineHeight: 1 }}>{Math.round(displayMemoryGiftCount)}</p>
                            <p style={{ fontSize: 10.5, color: "rgba(26,23,16,0.50)", marginTop: 4 }}>gifts</p>
                          </div>
                          <div style={{ width: 1, background: "rgba(26,23,16,0.12)" }} />
                          <div>
                            <p className="font-heading" style={{ fontSize: 22, fontWeight: 700, color: "hsl(var(--kiddo-ink))", lineHeight: 1 }}>{Math.round(displayMemoryPeople)}</p>
                            <p style={{ fontSize: 10.5, color: "rgba(26,23,16,0.50)", marginTop: 4 }}>people</p>
                          </div>
                          <div style={{ width: 1, background: "rgba(26,23,16,0.12)" }} />
                          <div>
                            <p className="font-heading" style={{ fontSize: 22, fontWeight: 700, color: "hsl(var(--kiddo-evergreen))", lineHeight: 1 }}>{formatMoney(displayMemoryFundValue)}</p>
                            <p style={{ fontSize: 10.5, color: "rgba(26,23,16,0.50)", marginTop: 4 }}>so far</p>
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() => goPage(1)}
                          data-testid="button-book-cover-begin"
                          style={{
                            display: "inline-flex", alignItems: "center", gap: 8,
                            padding: "11px 20px", borderRadius: 999,
                            background: "hsl(var(--kiddo-evergreen))", color: "white",
                            border: "none", fontSize: 13.5, fontWeight: 700,
                            cursor: "pointer",
                            boxShadow: "0 4px 14px hsl(var(--kiddo-evergreen) / 0.18)",
                          }}
                        >
                          Begin reading
                          <span aria-hidden>→</span>
                        </button>
                      </div>
                    ) : isCommunityPage ? (
                      // ─── Community page ───
                      // The EarlyBird Nest restated as a chapter ending.
                      // After all the individual entries, this page is
                      // the wide-shot: every person who showed up for
                      // this kid, listed together. Anonymous gifters
                      // bucket as one ("8 anonymous"); named gifters
                      // each get a row with their gift count. No
                      // financial detail per person — that lives on the
                      // entries themselves. This page is for the kid at
                      // 18 to see the village, not the ledger.
                      <div style={{
                        background: "linear-gradient(160deg, rgba(255,255,255,0.92) 0%, hsl(var(--kiddo-cream)/0.78) 100%)",
                        border: "1px solid rgba(26,23,16,0.10)",
                        borderRadius: 24,
                        padding: "36px 28px 30px",
                        boxShadow: "0 12px 40px rgba(26,23,16,0.10), 0 2px 6px rgba(26,23,16,0.06)",
                      }} data-testid="book-page-community">
                        <p style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.10em", textTransform: "uppercase", color: "hsl(var(--kiddo-gold))", marginBottom: 14, textAlign: "center" }}>
                          The Village
                        </p>
                        <h3 className="font-heading" style={{ fontSize: 26, fontWeight: 700, color: "hsl(var(--kiddo-ink))", lineHeight: 1.2, marginBottom: 10, letterSpacing: "-0.01em", textAlign: "center" }}>
                          {(() => {
                            const total = gifterRoster.reduce((acc, g) => acc + (g.isAnon ? g.anonPeople : 1), 0);
                            return `${total} ${total === 1 ? "person" : "people"} built this.`;
                          })()}
                        </h3>
                        <p className="font-serif italic" style={{ fontSize: 14.5, color: "rgba(26,23,16,0.62)", lineHeight: 1.55, marginBottom: 22, textAlign: "center", maxWidth: 380, marginLeft: "auto", marginRight: "auto" }}>
                          {childName ? `Every gift in this book came from one of them. ${childName} got here because they showed up.` : `Every gift in this book came from one of them.`}
                        </p>
                        <div style={{ display: "flex", flexDirection: "column", gap: 6, maxWidth: 420, marginLeft: "auto", marginRight: "auto" }}>
                          {gifterRoster.map((g, idx) => {
                            const giftCountLabel = g.giftCount === 1 ? "1 gift" : `${g.giftCount} gifts`;
                            // Owner identity in the Village list — same
                            // treatment as elsewhere. The parent's row
                            // shows their preferredName suffix so kid at
                            // 18 reads "Dovi (Dad)" not just "Dovi" and
                            // can match the name to a face from the
                            // photos elsewhere in the book.
                            const ownerPrefName = g.isOwnerRow ? (user as any)?.preferredName || null : null;
                            const displayName = g.isAnon
                              ? (g.anonPeople > 1 ? `${g.anonPeople} anonymous` : "Anonymous")
                              : (g.isOwnerRow && ownerPrefName)
                                ? `${g.name} (${ownerPrefName})`
                                : g.name;
                            return (
                              <div
                                key={`${g.isAnon ? "anon" : g.name}-${idx}`}
                                style={{
                                  display: "flex", alignItems: "center", justifyContent: "space-between",
                                  padding: "10px 14px",
                                  borderRadius: 14,
                                  background: "rgba(255,255,255,0.62)",
                                  border: "1px solid rgba(26,23,16,0.06)",
                                }}
                                data-testid={`book-community-row-${idx}`}
                              >
                                <span style={{ fontSize: 14, fontWeight: 600, color: "hsl(var(--kiddo-ink))" }}>
                                  {displayName}
                                </span>
                                <span style={{ fontSize: 12, color: "rgba(26,23,16,0.55)" }}>
                                  {giftCountLabel}
                                </span>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    ) : isSealedPage ? (
                      // ─── Sealed letter page ───
                      // The parent's note to the kid, sealed until age
                      // of majority. Wax seal visual + countdown.
                      // Parent can always click to read or edit their
                      // own letter; the kid sees nothing here until they
                      // hit majorityAge (KidView surface respects the
                      // visibility='kid_at_18' column on this row).
                      // Restraint over fanfare: a deep-red wax circle,
                      // the parent's name pressed into it, a single
                      // sentence about when it opens. No animations, no
                      // particles — the gravity is in the silence.
                      (() => {
                        const birthdate = fundData?.recipientBirthdate ? new Date(fundData.recipientBirthdate) : null;
                        const ageOfMajority = fundData?.majorityAge ?? 18;
                        // Compute the unsealing date — the kid's
                        // majorityAge'th birthday. UTC normalized so
                        // timezone shifts don't move the date by one day.
                        const unsealDate = birthdate
                          ? new Date(Date.UTC(
                              birthdate.getUTCFullYear() + ageOfMajority,
                              birthdate.getUTCMonth(),
                              birthdate.getUTCDate(),
                            ))
                          : null;
                        const now = new Date();
                        const msUntilUnseal = unsealDate ? unsealDate.getTime() - now.getTime() : null;
                        const daysUntilUnseal = msUntilUnseal !== null
                          ? Math.max(0, Math.ceil(msUntilUnseal / (24 * 60 * 60 * 1000)))
                          : null;
                        const unsealDateLabel = unsealDate
                          ? unsealDate.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric", timeZone: "UTC" })
                          : null;
                        const isUnsealed = msUntilUnseal !== null && msUntilUnseal <= 0;
                        const ownerInitial = ((user as any)?.firstName || (user as any)?.preferredName || "P").trim().slice(0, 1).toUpperCase();
                        const hasLetter = !!(sealedLetter && sealedLetter.content);
                        return (
                          <div style={{
                            background: "linear-gradient(160deg, hsl(var(--kiddo-cream)) 0%, rgba(255,255,255,0.92) 60%, hsl(var(--kiddo-cream)/0.85) 100%)",
                            border: "1px solid rgba(26,23,16,0.10)",
                            borderRadius: 24,
                            padding: "44px 28px 36px",
                            boxShadow: "0 12px 40px rgba(26,23,16,0.10), 0 2px 6px rgba(26,23,16,0.06)",
                            textAlign: "center" as const,
                          }} data-testid="book-page-sealed">
                            <p style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.10em", textTransform: "uppercase", color: "rgb(140,30,30)", marginBottom: 24 }}>
                              {isUnsealed ? "Unsealed" : "Sealed letter"}
                            </p>
                            {/* Wax seal — deep-red disc with a pressed
                                initial. CSS gradient gives the slight
                                off-center highlight that reads as wax
                                without trying to be photoreal. Static
                                (no rotation, no shimmer) by design;
                                animations on a sealed-letter visual
                                cheapen the gravity. */}
                            <div style={{
                              width: 96, height: 96,
                              margin: "0 auto 26px",
                              borderRadius: "50%",
                              background: "radial-gradient(circle at 38% 32%, rgb(196,42,42) 0%, rgb(140,30,30) 55%, rgb(96,18,18) 100%)",
                              boxShadow: "inset -3px -4px 10px rgba(0,0,0,0.32), 0 4px 12px rgba(140,30,30,0.18)",
                              display: "flex", alignItems: "center", justifyContent: "center",
                              border: "2px solid rgba(255,255,255,0.18)",
                            }}>
                              <span style={{
                                fontSize: 36, fontWeight: 700,
                                color: "rgba(255,255,255,0.92)",
                                fontFamily: "Georgia, serif",
                                letterSpacing: "0.02em",
                                textShadow: "0 1px 2px rgba(0,0,0,0.32)",
                              }}>
                                {ownerInitial}
                              </span>
                            </div>
                            <h3 className="font-heading" style={{ fontSize: 24, fontWeight: 700, color: "hsl(var(--kiddo-ink))", lineHeight: 1.25, marginBottom: 14, letterSpacing: "-0.01em" }}>
                              {hasLetter
                                ? (childName ? `For ${childName}, when they turn ${ageOfMajority}.` : `For when they turn ${ageOfMajority}.`)
                                : (childName ? `Write ${childName} a letter for their ${ageOfMajority}th birthday.` : `Write a letter for their ${ageOfMajority}th birthday.`)}
                            </h3>
                            {hasLetter ? (
                              <p className="font-serif italic" style={{ fontSize: 14.5, color: "rgba(26,23,16,0.62)", lineHeight: 1.6, marginBottom: 22, maxWidth: 380, marginLeft: "auto", marginRight: "auto" }}>
                                {isUnsealed
                                  ? "This letter is unsealed."
                                  : unsealDateLabel
                                    ? `Opens ${unsealDateLabel}${daysUntilUnseal !== null ? ` · ${daysUntilUnseal.toLocaleString()} days` : ""}.`
                                    : "Sealed for the future."}
                              </p>
                            ) : (
                              <p className="font-serif italic" style={{ fontSize: 14.5, color: "rgba(26,23,16,0.62)", lineHeight: 1.6, marginBottom: 22, maxWidth: 380, marginLeft: "auto", marginRight: "auto" }}>
                                One sealed page. Whatever you want them to read on the day the fund becomes theirs.
                              </p>
                            )}
                            <button
                              type="button"
                              onClick={() => {
                                haptic("medium");
                                setSealedDraft(sealedLetter?.content || "");
                                setSealedEditorOpen(true);
                              }}
                              data-testid="button-book-sealed-open"
                              style={{
                                display: "inline-flex", alignItems: "center", gap: 8,
                                padding: "11px 20px", borderRadius: 999,
                                background: hasLetter ? "white" : "hsl(var(--kiddo-evergreen))",
                                color: hasLetter ? "hsl(var(--kiddo-evergreen))" : "white",
                                border: hasLetter ? "1px solid hsl(var(--kiddo-evergreen) / 0.30)" : "none",
                                fontSize: 13.5, fontWeight: 700,
                                cursor: "pointer",
                                boxShadow: hasLetter ? "none" : "0 4px 14px hsl(var(--kiddo-evergreen) / 0.18)",
                              }}
                            >
                              {hasLetter ? "Read or edit" : "Write your letter"}
                              <span aria-hidden>→</span>
                            </button>
                          </div>
                        );
                      })()
                    ) : isClosingPage ? (
                      // ─── Closing page ───
                      // The celebratory book-end after the last entry.
                      // Quiet "the story continues" beat. Sprout for the
                      // brand, child name as the emotional anchor, soft
                      // call-back to "Begin reading" with a "Back to
                      // start" affordance. Books need real endings.
                      <div style={{
                        background: "linear-gradient(160deg, hsl(var(--kiddo-cream)) 0%, rgba(255,255,255,0.85) 60%, hsl(var(--kiddo-gold)/0.10) 100%)",
                        border: "1px solid hsl(var(--kiddo-gold)/0.28)",
                        borderRadius: 24,
                        padding: "44px 28px 36px",
                        boxShadow: "0 12px 40px hsl(var(--kiddo-gold) / 0.10), 0 2px 6px rgba(26,23,16,0.06)",
                        textAlign: "center" as const,
                      }} data-testid="book-page-closing">
                        <div style={{ fontSize: 48, lineHeight: 1, marginBottom: 16 }} aria-hidden>🌱</div>
                        <p style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.10em", textTransform: "uppercase", color: "hsl(var(--kiddo-gold))", marginBottom: 12 }}>
                          To be continued
                        </p>
                        <h3 className="font-heading" style={{ fontSize: 24, fontWeight: 700, color: "hsl(var(--kiddo-ink))", lineHeight: 1.25, marginBottom: 14, letterSpacing: "-0.01em" }}>
                          {isOwnerMode ? "Your story is still being written." : childName ? `${childName}'s story is still being written.` : "This story is still being written."}
                        </h3>
                        <p className="font-serif italic" style={{ fontSize: 14.5, color: "rgba(26,23,16,0.62)", lineHeight: 1.6, marginBottom: 26, maxWidth: 380, marginLeft: "auto", marginRight: "auto" }}>
                          Every gift, every note, every milestone
                          becomes a page here. Come back any time.
                        </p>
                        <div style={{ display: "flex", justifyContent: "center", gap: 10, flexWrap: "wrap" }}>
                          <button
                            type="button"
                            onClick={() => { haptic("light"); setBookSlideDirection(-1); setBookPageIndex(0); }}
                            data-testid="button-book-closing-restart"
                            style={{
                              display: "inline-flex", alignItems: "center", gap: 6,
                              padding: "10px 16px", borderRadius: 999,
                              background: "white", color: "hsl(var(--kiddo-evergreen))",
                              border: "1px solid hsl(var(--kiddo-evergreen) / 0.22)",
                              fontSize: 12.5, fontWeight: 700,
                              cursor: "pointer",
                            }}
                          >
                            <span aria-hidden>←</span>
                            Back to the cover
                          </button>
                          <button
                            type="button"
                            onClick={() => { haptic("light"); setBookOpen(false); }}
                            data-testid="button-book-closing-close"
                            style={{
                              display: "inline-flex", alignItems: "center", gap: 6,
                              padding: "10px 16px", borderRadius: 999,
                              background: "hsl(var(--kiddo-evergreen))", color: "white",
                              border: "none",
                              fontSize: 12.5, fontWeight: 700,
                              cursor: "pointer",
                              boxShadow: "0 4px 14px hsl(var(--kiddo-evergreen) / 0.18)",
                            }}
                          >
                            Close the book
                          </button>
                        </div>
                      </div>
                    ) : currentEntry ? (
                      <BookPage
                        entry={currentEntry}
                        childName={childName}
                        getEmbedVideoUrl={getEmbedVideoUrl}
                        ownerEmail={String((user as any)?.email || "").trim().toLowerCase()}
                        ownerProfileImageUrl={(user as any)?.profileImageUrl || null}
                        ownerPreferredName={(user as any)?.preferredName || null}
                      />
                    ) : null}
                  </motion.div>
                </AnimatePresence>

                {/* Side arrows (desktop ergonomics) */}
                {safeIndex > 0 && (
                  <button
                    type="button"
                    onClick={() => goPage(-1)}
                    aria-label="Previous page"
                    style={{
                      position: "absolute", left: 18, top: "50%", transform: "translateY(-50%)",
                      width: 40, height: 40, borderRadius: 999,
                      background: "rgba(255,255,255,0.78)", border: "1px solid rgba(26,23,16,0.10)",
                      cursor: "pointer", display: "none",
                      alignItems: "center", justifyContent: "center",
                      color: "rgba(26,23,16,0.55)",
                      backdropFilter: "blur(6px)",
                    }}
                    className="md:!flex"
                  >
                    ←
                  </button>
                )}
                {safeIndex < totalPages - 1 && (
                  <button
                    type="button"
                    onClick={() => goPage(1)}
                    aria-label="Next page"
                    style={{
                      position: "absolute", right: 18, top: "50%", transform: "translateY(-50%)",
                      width: 40, height: 40, borderRadius: 999,
                      background: "rgba(255,255,255,0.78)", border: "1px solid rgba(26,23,16,0.10)",
                      cursor: "pointer", display: "none",
                      alignItems: "center", justifyContent: "center",
                      color: "rgba(26,23,16,0.55)",
                      backdropFilter: "blur(6px)",
                    }}
                    className="md:!flex"
                  >
                    →
                  </button>
                )}
              </div>

              {/* Bottom bar — page indicator + counter. Tap a dot to
                  jump (with reasonable cap so 200-entry books don't
                  produce a comb). */}
              <div style={{ position: "relative", zIndex: 2, padding: "12px 20px 22px", display: "flex", flexDirection: "column", alignItems: "center", gap: 10, flexShrink: 0 }}>
                {totalPages <= 30 ? (
                  <div style={{ display: "flex", gap: 6, flexWrap: "wrap", justifyContent: "center", maxWidth: 360 }}>
                    {Array.from({ length: totalPages }).map((_, i) => (
                      <button
                        key={i}
                        type="button"
                        onClick={() => { haptic("selection"); setBookSlideDirection(i > safeIndex ? 1 : -1); setBookPageIndex(i); }}
                        aria-label={`Go to page ${i + 1}`}
                        style={{
                          width: i === safeIndex ? 22 : 7,
                          height: 7, borderRadius: 99, border: "none",
                          background: i === safeIndex ? "hsl(var(--kiddo-evergreen))" : "hsl(var(--kiddo-ink) / 0.20)",
                          transition: "width 0.22s ease, background 0.22s ease",
                          cursor: "pointer",
                          padding: 0,
                        }}
                      />
                    ))}
                  </div>
                ) : (
                  <div style={{ display: "flex", gap: 4, alignItems: "center" }}>
                    <button
                      type="button"
                      onClick={() => goPage(-1)}
                      disabled={safeIndex === 0}
                      style={{
                        padding: "4px 8px", borderRadius: 6,
                        border: "1px solid rgba(26,23,16,0.10)", background: "rgba(255,255,255,0.6)",
                        color: "rgba(26,23,16,0.55)", fontSize: 11, fontWeight: 700, cursor: safeIndex === 0 ? "default" : "pointer",
                        opacity: safeIndex === 0 ? 0.4 : 1,
                      }}
                    >←</button>
                    <span style={{ fontSize: 11, color: "rgba(26,23,16,0.50)", padding: "0 6px" }}>
                      Page {safeIndex + 1} of {totalPages}
                    </span>
                    <button
                      type="button"
                      onClick={() => goPage(1)}
                      disabled={safeIndex === totalPages - 1}
                      style={{
                        padding: "4px 8px", borderRadius: 6,
                        border: "1px solid rgba(26,23,16,0.10)", background: "rgba(255,255,255,0.6)",
                        color: "rgba(26,23,16,0.55)", fontSize: 11, fontWeight: 700, cursor: safeIndex === totalPages - 1 ? "default" : "pointer",
                        opacity: safeIndex === totalPages - 1 ? 0.4 : 1,
                      }}
                    >→</button>
                  </div>
                )}
                <p style={{ fontSize: 10.5, color: "rgba(26,23,16,0.40)", letterSpacing: "0.04em" }}>
                  {isCover
                    ? "Cover"
                    : isClosingPage
                      ? "End"
                      : isCommunityPage
                        ? "The Village"
                        : isSealedPage
                          ? "Sealed"
                          : `Page ${safeIndex} of ${bookEntries.length}`}
                </p>
              </div>
            </motion.div>
          );
        })()}
      </AnimatePresence>

      {/* Sealed letter editor modal — opens from the sealed page in
          the book view. Parent writes once, edits any time. The
          textarea is the whole UI: no tone picker, no AI draft, no
          template. The locked-copy rule for this surface is "whatever
          you want them to read on the day the fund becomes theirs" —
          structure would intrude. Saves to PUT /api/funds/:id/sealed-
          letter (server upserts). On success, the sealed page below
          reflects the new content automatically via query invalidation. */}
      <AnimatePresence>
        {sealedEditorOpen && (
          <motion.div
            key="sealed-editor"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: DUR_NORMAL }}
            role="dialog"
            aria-modal="true"
            aria-label="Sealed letter editor"
            style={{
              position: "fixed", inset: 0, zIndex: 70,
              background: "rgba(26,23,16,0.62)",
              display: "flex", alignItems: "center", justifyContent: "center",
              padding: "20px",
              backdropFilter: "blur(3px)",
            }}
            onClick={() => !sealedSaving && setSealedEditorOpen(false)}
          >
            <motion.div
              initial={prefersReducedMotion ? { opacity: 0 } : { scale: 0.96, opacity: 0, y: 8 }}
              animate={prefersReducedMotion ? { opacity: 1 } : { scale: 1, opacity: 1, y: 0 }}
              exit={prefersReducedMotion ? { opacity: 0 } : { scale: 0.97, opacity: 0, y: 4 }}
              transition={{ duration: DUR_NORMAL, ease: EASE_DECEL }}
              onClick={(e) => e.stopPropagation()}
              style={{
                background: "linear-gradient(160deg, #fff 0%, hsl(var(--kiddo-cream)/0.65) 100%)",
                border: "1px solid rgba(26,23,16,0.10)",
                borderRadius: 24,
                padding: "28px 26px 24px",
                width: "100%",
                maxWidth: 540,
                maxHeight: "min(86vh, 720px)",
                display: "flex", flexDirection: "column",
                boxShadow: "0 24px 64px rgba(26,23,16,0.22)",
              }}
              data-testid="sealed-letter-editor"
            >
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
                <p style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.10em", textTransform: "uppercase", color: "rgb(140,30,30)" }}>
                  Sealed letter
                </p>
                <button
                  type="button"
                  onClick={() => !sealedSaving && setSealedEditorOpen(false)}
                  aria-label="Close"
                  style={{
                    background: "rgba(26,23,16,0.06)",
                    border: "1px solid rgba(26,23,16,0.10)",
                    borderRadius: 999,
                    padding: 6,
                    cursor: sealedSaving ? "not-allowed" : "pointer",
                    color: "rgba(26,23,16,0.55)",
                  }}
                  data-testid="button-sealed-editor-close"
                >
                  <X size={14} />
                </button>
              </div>
              <h3 className="font-heading" style={{ fontSize: 22, fontWeight: 700, color: "hsl(var(--kiddo-ink))", lineHeight: 1.25, marginBottom: 6, letterSpacing: "-0.01em" }}>
                {childName ? `For ${childName}, when they turn ${fundData?.majorityAge ?? 18}.` : `When they turn ${fundData?.majorityAge ?? 18}.`}
              </h3>
              <p className="font-serif italic" style={{ fontSize: 13.5, color: "rgba(26,23,16,0.62)", lineHeight: 1.6, marginBottom: 16 }}>
                Whatever you want them to read on the day the fund becomes theirs. You can edit this any time.
              </p>
              <textarea
                value={sealedDraft}
                onChange={(e) => setSealedDraft(e.target.value)}
                placeholder={childName ? `${childName},\n\nThe day you read this...` : "The day you read this..."}
                disabled={sealedSaving}
                style={{
                  flex: 1,
                  minHeight: 240,
                  width: "100%",
                  padding: "14px 16px",
                  borderRadius: 14,
                  border: "1px solid rgba(26,23,16,0.14)",
                  background: "rgba(255,255,255,0.85)",
                  fontSize: 15,
                  lineHeight: 1.6,
                  fontFamily: "Georgia, serif",
                  color: "hsl(var(--kiddo-ink))",
                  resize: "vertical",
                  outline: "none",
                }}
                data-testid="textarea-sealed-letter"
              />
              <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, marginTop: 16 }}>
                <button
                  type="button"
                  onClick={() => !sealedSaving && setSealedEditorOpen(false)}
                  disabled={sealedSaving}
                  style={{
                    padding: "10px 16px", borderRadius: 999,
                    background: "white", color: "rgba(26,23,16,0.65)",
                    border: "1px solid rgba(26,23,16,0.14)",
                    fontSize: 13, fontWeight: 600,
                    cursor: sealedSaving ? "not-allowed" : "pointer",
                  }}
                  data-testid="button-sealed-editor-cancel"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={async () => {
                    const trimmed = sealedDraft.trim();
                    if (!trimmed || sealedSaving) return;
                    setSealedSaving(true);
                    try {
                      await upsertSealedLetterMutation.mutateAsync(trimmed);
                      haptic("success");
                      toast({ title: "Sealed.", description: childName ? `${childName}'s letter is saved.` : "Your letter is saved." });
                      setSealedEditorOpen(false);
                    } catch {
                      toast({ title: "Couldn't save the letter", description: "Please try again.", variant: "destructive" });
                    } finally {
                      setSealedSaving(false);
                    }
                  }}
                  disabled={sealedSaving || !sealedDraft.trim()}
                  style={{
                    padding: "10px 18px", borderRadius: 999,
                    background: sealedSaving || !sealedDraft.trim() ? "hsl(var(--kiddo-evergreen) / 0.45)" : "hsl(var(--kiddo-evergreen))",
                    color: "white",
                    border: "none",
                    fontSize: 13, fontWeight: 700,
                    cursor: sealedSaving || !sealedDraft.trim() ? "not-allowed" : "pointer",
                    boxShadow: "0 4px 14px hsl(var(--kiddo-evergreen) / 0.18)",
                  }}
                  data-testid="button-sealed-editor-save"
                >
                  {sealedSaving ? "Sealing..." : sealedLetter ? "Save" : "Seal it"}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ─── BookPage — single-page rendering for the book view ───
// Note IS the hero. Financial detail is the footnote. Photo / video /
// audio render full-width when present. Milestone entries get gold
// treatment. Anonymous + test-pattern senders display as Anonymous.
function BookPage({ entry, childName, getEmbedVideoUrl, ownerEmail, ownerProfileImageUrl, ownerPreferredName }: {
  entry: any;
  childName: string | null;
  getEmbedVideoUrl: (url: string | null | undefined) => string | null;
  ownerEmail?: string;
  ownerProfileImageUrl?: string | null;
  ownerPreferredName?: string | null;
}) {
  const isMilestone = entry.type === "milestone";
  const isGift = entry.type === "gift_message";
  const isParentEntry = entry.type === "parent_note" || entry.type === "note" || entry.type === "photo";

  const senderName = String(entry.gift?.senderName || entry.authorName || "").trim();
  const lcSender = senderName.toLowerCase();
  const isTestSender = ["test", "testing", "qqqqq", "tstgin", "tstng", "tester"].includes(lcSender);
  const isAnonSender = !senderName || /^someone who loves/i.test(senderName) || lcSender === "anonymous" || isTestSender;
  // Owner detection — when this page is from the parent, use the
  // identity treatment from the rest of the app: profile photo + first
  // name + "(role)" suffix from preferredName. Same shape as Dashboard
  // sidebar and the Memory Book list view's owner avatar.
  const senderEmailLower = String(entry.gift?.senderEmail || "").trim().toLowerCase();
  const isOwnerEntry = !!ownerEmail && (senderEmailLower === ownerEmail);
  const displayName = isMilestone
    ? "Kiddo"
    : isAnonSender
      ? "Anonymous"
      : isOwnerEntry && ownerPreferredName
        ? `${titleCaseName(senderName)} (${ownerPreferredName})`
        : titleCaseName(senderName);

  const rawMessage = (isGift ? entry.gift?.message : entry.content) || "";
  const trimmedMessage = rawMessage.trim();
  // Test-pattern messages and legacy auto-invest boilerplate get the
  // same treatment as no-note: a warm fallback renders instead. The
  // book view is the surface Emma reads at 18 — dev-test artifacts and
  // system-generated boilerplate must never reach it.
  const isTestMessage = /^(test|testing|tstgin|tstng|qqqqq|tester)\b/i.test(trimmedMessage);
  const isBoilerplate = /^auto-invest contribution to /i.test(trimmedMessage) || isTestMessage;
  const noteText = (rawMessage && !isBoilerplate) ? rawMessage : null;

  const date = entry.createdAt
    ? new Date(entry.createdAt).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric", timeZone: "UTC" })
    : null;

  const photoUrl = entry.gift?.photoUrl || entry.photoUrl || null;
  const audioUrl = entry.audioUrl || null;
  const videoEmbedUrl = entry.videoUrl ? getEmbedVideoUrl(entry.videoUrl) : null;

  const ticker = isGift ? entry.gift?.selectedTicker : null;
  const giftAmt = isGift ? parseFloat(String(entry.gift?.amount || "0")) : 0;

  // Milestone — gold ceremonial treatment.
  if (isMilestone) {
    return (
      <div
        style={{
          background: "linear-gradient(135deg, hsl(var(--kiddo-gold)/0.18) 0%, #fff 55%, hsl(var(--kiddo-cream)) 100%)",
          border: "1px solid hsl(var(--kiddo-gold)/0.35)",
          borderRadius: 24,
          padding: "40px 28px 32px",
          boxShadow: "0 12px 40px hsl(var(--kiddo-gold) / 0.12), 0 2px 6px rgba(26,23,16,0.06)",
          textAlign: "center" as const,
        }}
        data-testid={`book-page-milestone-${entry.id}`}
      >
        <div style={{ fontSize: 56, lineHeight: 1, marginBottom: 18 }} aria-hidden>🌟</div>
        <p style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.10em", textTransform: "uppercase", color: "hsl(var(--kiddo-gold))", marginBottom: 12 }}>
          A Milestone
        </p>
        <h3 className="font-heading" style={{ fontSize: 26, fontWeight: 700, color: "hsl(var(--kiddo-ink))", lineHeight: 1.2, marginBottom: 14, letterSpacing: "-0.01em" }}>
          {entry.content}
        </h3>
        {date && (
          <p style={{ fontSize: 13, color: "rgba(26,23,16,0.55)" }}>{date}</p>
        )}
      </div>
    );
  }

  // Gift / parent entry — note as hero.
  return (
    <div
      style={{
        background: "linear-gradient(160deg, rgba(255,255,255,0.85) 0%, hsl(var(--kiddo-cream)/0.65) 100%)",
        border: "1px solid rgba(26,23,16,0.08)",
        borderRadius: 24,
        padding: "32px 28px 28px",
        boxShadow: "0 12px 40px rgba(26,23,16,0.08), 0 2px 6px rgba(26,23,16,0.05)",
      }}
      data-testid={`book-page-${entry.id}`}
    >
      {/* Attribution band */}
      <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 12, marginBottom: noteText ? 22 : 16 }}>
        <p className="font-heading" style={{ fontSize: 17, fontWeight: 700, color: "hsl(var(--kiddo-ink))", lineHeight: 1.2 }}>
          {displayName}
          {isParentEntry && <span style={{ fontSize: 12, fontWeight: 500, color: "rgba(26,23,16,0.50)", marginLeft: 8 }}>· memory</span>}
        </p>
        {date && (
          <p style={{ fontSize: 12.5, color: "rgba(26,23,16,0.50)", flexShrink: 0 }}>{date}</p>
        )}
      </div>

      {/* Note — the hero. Serif italic, large, breathing line height. */}
      {noteText && (
        <p
          className="font-serif italic"
          style={{
            fontSize: 22, fontWeight: 500, color: "hsl(var(--kiddo-ink))",
            lineHeight: 1.55, letterSpacing: "0.005em",
            marginBottom: 22,
            // Hanging-quote feel — the leading curly quote sits slightly
            // before the first letter so the note reads as something
            // someone wrote, not text in a box.
            textIndent: "-0.4em",
          }}
          data-testid={`book-note-${entry.id}`}
        >
          &ldquo;{noteText}&rdquo;
        </p>
      )}

      {/* Empty-note rescue — when a gift arrived with no note, no
          photo, no voice, no video, the page must still feel warm. The
          financial detail alone is the transaction-log register we are
          deliberately not in. This is the single sentence that holds
          the surface together when the gifter left no words. */}
      {!noteText && !photoUrl && !videoEmbedUrl && !audioUrl && isGift && (
        <p
          className="font-serif italic"
          style={{
            fontSize: 18, fontWeight: 500, color: "rgba(26,23,16,0.72)",
            lineHeight: 1.55, marginBottom: 22, textAlign: "center" as const,
          }}
          data-testid={`book-note-empty-${entry.id}`}
        >
          This gift arrived without a note.
        </p>
      )}

      {/* Photo — full-width inside the page. */}
      {photoUrl && (
        <div style={{ marginBottom: 18, borderRadius: 16, overflow: "hidden", background: "hsl(43,28%,92%)" }}>
          <img
            src={photoUrl}
            alt=""
            style={{ width: "100%", display: "block", maxHeight: 360, objectFit: "cover" }}
            data-testid={`book-photo-${entry.id}`}
          />
        </div>
      )}

      {/* Video — embedded iframe. */}
      {videoEmbedUrl && (
        <div style={{ marginBottom: 18, borderRadius: 16, overflow: "hidden", background: "hsl(43,28%,92%)" }}>
          <div style={{ position: "relative", paddingTop: "56.25%" }}>
            <iframe
              src={videoEmbedUrl}
              title="Memory video"
              style={{ position: "absolute", inset: 0, width: "100%", height: "100%", border: 0 }}
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
              sandbox="allow-scripts allow-same-origin allow-popups allow-presentation"
              data-testid={`book-video-${entry.id}`}
            />
          </div>
        </div>
      )}

      {/* Voice note — minimal player. */}
      {audioUrl && (
        <div style={{ marginBottom: 18, padding: "14px 16px", borderRadius: 14, border: "1px solid rgba(26,23,16,0.10)", background: "rgba(255,255,255,0.7)" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
            <p style={{ fontSize: 10.5, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: "rgba(26,23,16,0.55)" }}>
              Voice note
            </p>
            <span style={{ marginLeft: "auto", color: "rgba(26,23,16,0.32)" }} aria-hidden>
              <StaticWaveform size="md" />
            </span>
          </div>
          <audio src={audioUrl} controls style={{ width: "100%", height: 36 }} data-testid={`book-audio-${entry.id}`} />
        </div>
      )}

      {/* Financial detail — footnote. Always last. Always smallest. */}
      {isGift && giftAmt > 0 && (
        <div style={{ paddingTop: 16, borderTop: "1px solid rgba(26,23,16,0.10)" }}>
          <p style={{ fontSize: 12.5, color: "rgba(26,23,16,0.62)", lineHeight: 1.55 }}>
            {ticker
              ? <>$
{giftAmt.toFixed(2)} invested in <strong style={{ color: "hsl(var(--kiddo-ink))" }}>{ticker}</strong>{childName ? ` · for ${childName}` : ""}</>
              : <>$
{giftAmt.toFixed(2)} added to {childName ? `${childName}'s` : "the"} fund</>}
          </p>
        </div>
      )}
    </div>
  );
}
