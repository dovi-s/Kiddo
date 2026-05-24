// Parent-side list of scheduled sealed letters for a fund.
//
// Per project_sealed_letters_implementation_plan.md (locked 2026-05-23).
// Without a list, parents lose track of what they've sealed — a
// letter scheduled for the kid's 13th birthday written 8 years
// earlier is invisible to the parent unless we surface it.
//
// Renders on Age18Plan.tsx alongside the existing at-18 letter
// composer. Pure consumer of the existing GET /api/funds/:fundId/memory
// endpoint (no new server endpoint needed); filters client-side for
// kidVisibility === 'sealed' which is already in the response.
//
// Each list row shows:
//   - Delivery date (formatted long, e.g. "June 15, 2030")
//   - Years-from-today framing
//   - Preview snippet of the letter body (first 120 chars)
//   - Media indicators (photo / video / voice icons when present)
//   - Cancel button (DELETE the entry; will be a separate PATCH-to-
//     visibility=parent_only in the MVP since DELETE may not exist)
//
// Plus-gated by design: only Plus parents can create sealed entries,
// so a Free parent will see an empty list. Empty-state messaging
// nudges toward the composer (which is the Plus wall trigger).

import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Calendar, Image as ImageIcon, Video, Mic, Trash2, Pencil, ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { haptic } from "@/lib/haptics";

type MemoryEntryRow = {
  id: string;
  content?: string | null;
  authorName?: string | null;
  photoUrl?: string | null;
  videoUrl?: string | null;
  audioUrl?: string | null;
  createdAt?: string | null;
  kidVisibility?: string;
  visibility?: string;
  deliverAt?: string | null;
  parentSealedSeriesId?: string | null;
};

export type ScheduledLettersListProps = {
  fundId: string;
  childName: string;
  className?: string;
  /** When provided, an Edit button appears on single sealed letter cards
   *  that reopens the composer pre-filled with the entry. Series entries
   *  also get an edit button — per-year edits are scoped to that year
   *  only (series-level cadence edits are deferred per implementation
   *  plan). */
  onEdit?: (entry: MemoryEntryRow) => void;
};

function formatDeliveryDate(iso: string | null | undefined): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric" });
}

function yearsFromNow(iso: string | null | undefined): number | null {
  if (!iso) return null;
  const d = new Date(iso).getTime();
  if (Number.isNaN(d)) return null;
  const ms = d - Date.now();
  if (ms <= 0) return null;
  return Math.floor(ms / (365.25 * 24 * 60 * 60 * 1000));
}

export function ScheduledLettersList({ fundId, childName, className, onEdit }: ScheduledLettersListProps) {
  const queryClient = useQueryClient();
  const [expanded, setExpanded] = useState(false);
  const [cancellingId, setCancellingId] = useState<string | null>(null);

  const { data: entries = [] } = useQuery<MemoryEntryRow[]>({
    queryKey: ["memory", fundId],
    queryFn: async () => {
      const res = await fetch(`/api/funds/${encodeURIComponent(fundId)}/memory`, {
        credentials: "include",
      });
      if (!res.ok) return [];
      return res.json();
    },
    enabled: !!fundId,
    staleTime: 30_000,
  });

  // Filter to sealed entries that haven't yet been delivered (deliverAt
  // in the future). Sealed entries that already fired are essentially
  // "delivered to the kid" and don't need parent management.
  const scheduledRaw = (entries || [])
    .filter((e) => (e.kidVisibility || e.visibility) === "sealed")
    .filter((e) => {
      if (!e.deliverAt) return false;
      const d = new Date(e.deliverAt).getTime();
      return !Number.isNaN(d) && d > Date.now();
    });

  // Group by parent_sealed_series_id for Phase 5 yearly series. Each
  // series renders as a single card showing the count, the next
  // delivery date, and a "cancel series" button. One-shot sealed
  // letters (no series_id) render as individual cards.
  type Grouped =
    | { kind: "single"; entry: MemoryEntryRow }
    | { kind: "series"; seriesId: string; entries: MemoryEntryRow[] };
  const groups: Grouped[] = (() => {
    const seriesMap = new Map<string, MemoryEntryRow[]>();
    const singles: MemoryEntryRow[] = [];
    for (const e of scheduledRaw) {
      const sid = e.parentSealedSeriesId;
      if (sid) {
        const list = seriesMap.get(sid) || [];
        list.push(e);
        seriesMap.set(sid, list);
      } else {
        singles.push(e);
      }
    }
    const out: Grouped[] = [];
    seriesMap.forEach((list, seriesId) => {
      list.sort((a: MemoryEntryRow, b: MemoryEntryRow) => {
        const ad = a.deliverAt ? new Date(a.deliverAt).getTime() : 0;
        const bd = b.deliverAt ? new Date(b.deliverAt).getTime() : 0;
        return ad - bd;
      });
      out.push({ kind: "series", seriesId, entries: list });
    });
    for (const single of singles) {
      out.push({ kind: "single", entry: single });
    }
    // Sort grouped list by earliest delivery date so the soonest
    // upcoming surface is at the top regardless of series vs single.
    out.sort((a, b) => {
      const aDate = a.kind === "series" ? a.entries[0]?.deliverAt : a.entry.deliverAt;
      const bDate = b.kind === "series" ? b.entries[0]?.deliverAt : b.entry.deliverAt;
      const ad = aDate ? new Date(aDate).getTime() : 0;
      const bd = bDate ? new Date(bDate).getTime() : 0;
      return ad - bd;
    });
    return out;
  })();
  const scheduled = groups; // keeps the variable name reference below intact

  const safeChildName = (childName || "your kid").trim() || "your kid";

  if (scheduled.length === 0) return null;

  const previewItems = expanded ? scheduled : scheduled.slice(0, 3);

  async function handleCancel(entryId: string) {
    if (cancellingId) return;
    if (!window.confirm("Cancel this sealed letter? You can write a new one any time, but this one will not be delivered.")) {
      return;
    }
    setCancellingId(entryId);
    haptic("medium");
    try {
      // PATCH the entry to parent_only visibility. The entry stays in
      // the DB (audit trail) but is invisible to the kid surface and
      // is filtered out of the scheduled list above (kidVisibility !==
      // 'sealed' after the patch). Cleaner than a hard DELETE — keeps
      // the parent's authorship history intact even after cancellation.
      await fetch(`/api/memory/${encodeURIComponent(entryId)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ kidVisibility: "parent_only" }),
      });
      haptic("success");
      void queryClient.invalidateQueries({ queryKey: ["memory", fundId] });
    } catch {
      haptic("error");
    } finally {
      setCancellingId(null);
    }
  }

  async function handleCancelSeries(seriesId: string, count: number) {
    if (cancellingId) return;
    const msg = count === 1
      ? "Cancel this sealed letter series? You can write new letters any time, but the remaining year of deliveries will not happen."
      : `Cancel this sealed letter series? You can write new letters any time, but the remaining ${count} years of deliveries will not happen.`;
    if (!window.confirm(msg)) return;
    setCancellingId(seriesId);
    haptic("medium");
    try {
      await fetch(`/api/funds/${encodeURIComponent(fundId)}/sealed-series/${encodeURIComponent(seriesId)}`, {
        method: "DELETE",
        credentials: "include",
      });
      haptic("success");
      void queryClient.invalidateQueries({ queryKey: ["memory", fundId] });
    } catch {
      haptic("error");
    } finally {
      setCancellingId(null);
    }
  }

  return (
    <div className={className}>
      <div className="rounded-2xl border border-border bg-card p-5">
        <div className="flex items-start justify-between gap-3 mb-3">
          <div>
            <p className="text-sm font-semibold text-foreground">
              Sealed letters waiting for {safeChildName}
            </p>
            <p className="text-xs text-muted-foreground mt-0.5">
              {scheduled.length === 1
                ? "1 letter scheduled."
                : `${scheduled.length} letters scheduled.`}{" "}
              {safeChildName} sees each one on the date you picked.
            </p>
          </div>
        </div>

        <ul className="space-y-2.5">
          {previewItems.map((group) => {
            // Series card — groups N years of the same letter under
            // one row with a "next delivery" date + cancel-series CTA.
            if (group.kind === "series") {
              const first = group.entries[0];
              const last = group.entries[group.entries.length - 1];
              const dateLabel = formatDeliveryDate(first?.deliverAt);
              const lastLabel = formatDeliveryDate(last?.deliverAt);
              const years = yearsFromNow(first?.deliverAt);
              const preview = String(first?.content || "").trim().slice(0, 120);
              const hasPhoto = !!first?.photoUrl;
              const hasVideo = !!first?.videoUrl;
              const hasAudio = !!first?.audioUrl;
              const count = group.entries.length;
              return (
                <li
                  key={`series-${group.seriesId}`}
                  className="rounded-xl border border-primary/30 bg-primary/5 p-3"
                  data-testid={`scheduled-series-${group.seriesId}`}
                >
                  <div className="flex items-start gap-3">
                    <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-primary text-primary-foreground mt-0.5">
                      <Calendar size={14} strokeWidth={1.8} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-semibold text-foreground">
                        Yearly series · {count} {count === 1 ? "delivery" : "deliveries"}
                      </p>
                      <p className="text-[11px] text-muted-foreground mt-0.5">
                        Next: <span className="text-foreground font-medium">{dateLabel || "scheduled"}</span>
                        {years !== null && years > 0 ? (
                          <> ({years} {years === 1 ? "year" : "years"} away)</>
                        ) : null}
                        {lastLabel && lastLabel !== dateLabel ? (
                          <> · last in {lastLabel}</>
                        ) : null}
                      </p>
                      {preview && (
                        <p className="mt-1 text-xs text-muted-foreground leading-relaxed line-clamp-2">
                          "{preview}{preview.length === 120 ? "..." : ""}"
                        </p>
                      )}
                      {(hasPhoto || hasVideo || hasAudio) && (
                        <div className="mt-1.5 flex items-center gap-1.5 text-[10px] text-muted-foreground/80">
                          {hasPhoto && (
                            <span className="inline-flex items-center gap-0.5"><ImageIcon size={10} /> photo</span>
                          )}
                          {hasVideo && (
                            <span className="inline-flex items-center gap-0.5"><Video size={10} /> video</span>
                          )}
                          {hasAudio && (
                            <span className="inline-flex items-center gap-0.5"><Mic size={10} /> voice</span>
                          )}
                        </div>
                      )}
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      {onEdit && first && (
                        <button
                          type="button"
                          onClick={() => { haptic("selection"); onEdit(first); }}
                          className="text-muted-foreground hover:text-foreground transition-colors p-1"
                          aria-label="Edit next year's entry in this series"
                          data-testid={`edit-scheduled-series-${group.seriesId}`}
                        >
                          <Pencil size={13} />
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => void handleCancelSeries(group.seriesId, count)}
                        disabled={cancellingId === group.seriesId}
                        className="text-muted-foreground hover:text-destructive transition-colors p-1"
                        aria-label="Cancel entire scheduled series"
                        data-testid={`cancel-scheduled-series-${group.seriesId}`}
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>
                </li>
              );
            }
            // Single sealed letter card
            const entry = group.entry;
            const dateLabel = formatDeliveryDate(entry.deliverAt);
            const years = yearsFromNow(entry.deliverAt);
            const preview = String(entry.content || "").trim().slice(0, 120);
            const hasPhoto = !!entry.photoUrl;
            const hasVideo = !!entry.videoUrl;
            const hasAudio = !!entry.audioUrl;
            return (
              <li
                key={entry.id}
                className="rounded-xl border border-border/60 bg-background p-3"
                data-testid={`scheduled-letter-${entry.id}`}
              >
                <div className="flex items-start gap-3">
                  <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary mt-0.5">
                    <Calendar size={14} strokeWidth={1.8} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-semibold text-foreground">
                      {dateLabel || "Scheduled"}
                      {years !== null && years > 0 ? (
                        <span className="ml-1.5 font-normal text-muted-foreground">
                          ({years} {years === 1 ? "year" : "years"} away)
                        </span>
                      ) : null}
                    </p>
                    {preview && (
                      <p className="mt-1 text-xs text-muted-foreground leading-relaxed line-clamp-2">
                        "{preview}{preview.length === 120 ? "..." : ""}"
                      </p>
                    )}
                    {(hasPhoto || hasVideo || hasAudio) && (
                      <div className="mt-1.5 flex items-center gap-1.5 text-[10px] text-muted-foreground/80">
                        {hasPhoto && (
                          <span className="inline-flex items-center gap-0.5"><ImageIcon size={10} /> photo</span>
                        )}
                        {hasVideo && (
                          <span className="inline-flex items-center gap-0.5"><Video size={10} /> video</span>
                        )}
                        {hasAudio && (
                          <span className="inline-flex items-center gap-0.5"><Mic size={10} /> voice</span>
                        )}
                      </div>
                    )}
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    {onEdit && (
                      <button
                        type="button"
                        onClick={() => { haptic("selection"); onEdit(entry); }}
                        className="text-muted-foreground hover:text-foreground transition-colors p-1"
                        aria-label="Edit scheduled letter"
                        data-testid={`edit-scheduled-${entry.id}`}
                      >
                        <Pencil size={13} />
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => void handleCancel(entry.id)}
                      disabled={cancellingId === entry.id}
                      className="text-muted-foreground hover:text-destructive transition-colors p-1"
                      aria-label="Cancel scheduled letter"
                      data-testid={`cancel-scheduled-${entry.id}`}
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
              </li>
            );
          })}
        </ul>

        {scheduled.length > 3 && !expanded && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="mt-3 w-full text-xs text-muted-foreground"
            onClick={() => setExpanded(true)}
            data-testid="button-expand-scheduled-letters"
          >
            Show {scheduled.length - 3} more <ChevronDown className="ml-1 h-3 w-3" />
          </Button>
        )}
      </div>
    </div>
  );
}
