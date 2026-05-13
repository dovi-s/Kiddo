import { getEmbedVideoUrl, isSafeImageUrl } from "@/lib/media";

export type MemoryFilter = "all" | "gift_message" | "milestone" | "photo" | "note";

export interface MemoryEntryLike {
  type: string;
  content: string | null;
  authorName: string | null;
  photoUrl: string | null;
  videoUrl: string | null;
  audioUrl?: string | null;
  gift?: {
    senderName?: string | null;
    message?: string | null;
    photoUrl?: string | null;
  } | null;
}

// Test-pattern + boilerplate text the Memory Book must never render.
// Same allowlist as the server-side guard in webhookHandlers.ts and
// the client-side render filter in MemoryBook.tsx. Single source of
// truth so all three layers stay in lockstep.
function isSuppressedText(raw: string | null | undefined): boolean {
  const trimmed = String(raw || "").trim();
  if (!trimmed) return true;
  if (/^auto-invest contribution to /i.test(trimmed)) return true;
  if (/^(test|testing|tstgin|tstng|qqqqq|tester)\b/i.test(trimmed)) return true;
  return false;
}

export function filterMemoryEntries<T extends MemoryEntryLike>(
  entries: T[],
  filter: MemoryFilter,
  query: string,
): T[] {
  const trimmed = query.trim().toLowerCase();
  return entries.filter((entry) => {
    // Letter types have their OWN dedicated surfaces and must never
    // appear inline in the Memory Book list:
    //   - sealed_letter renders ONLY as the final ceremonial page in
    //     the book view (wax seal + countdown + parent's note for
    //     the kid at 18). Showing it inline would reveal sealed
    //     content prematurely.
    //   - parent_letter (always-readable, written from the Dashboard
    //     "Emma's letter" card) renders as the emotional capstone on
    //     Kid View AND on the at-18 claim page. The Dashboard card
    //     itself (`{Child}'s letter is ready · N words · tap to edit`)
    //     IS the parent's view of it. Letting it ALSO render here
    //     makes a malformed card with no title/no media (the only
    //     content is the long letter body, which the grid layout
    //     wasn't designed for).
    if (entry.type === "sealed_letter" || entry.type === "parent_letter") return false;
    // Test-content notes — when a parent typed "test for recurring"
    // or similar dev-test text into a note (no photo/video/audio
    // attached), suppress the entry entirely. The kid at 18 must
    // never read these. Same allowlist as the gift-message render
    // filter and the server-side guard. Notes WITH real media survive
    // (we trust the photo/voice as the actual memory).
    if ((entry.type === "note" || entry.type === "parent_note" || entry.type === "parent_investment_start")
        && isSuppressedText(entry.content)
        && !entry.photoUrl
        && !entry.videoUrl
        && !entry.audioUrl) {
      return false;
    }
    if (filter !== "all" && entry.type !== filter) return false;
    if (!trimmed) return true;
    const haystack = [
      entry.content || "",
      entry.authorName || "",
      entry.gift?.senderName || "",
      entry.gift?.message || "",
    ]
      .join(" ")
      .toLowerCase();
    return haystack.includes(trimmed);
  });
}

export function validateMemoryMedia(photoUrl: string, videoUrl: string): string | null {
  const trimmedPhoto = photoUrl.trim();
  const trimmedVideo = videoUrl.trim();
  if (trimmedPhoto && !isSafeImageUrl(trimmedPhoto)) {
    return "Photo URL must be a valid http(s) link.";
  }
  if (trimmedVideo && !getEmbedVideoUrl(trimmedVideo)) {
    return "Video link must be a valid YouTube, Vimeo, or Loom URL.";
  }
  return null;
}

export function getVisibleMemoryEntries<T>(
  entries: T[],
  visibleCount: number,
): T[] {
  return entries.slice(0, Math.max(0, visibleCount));
}
