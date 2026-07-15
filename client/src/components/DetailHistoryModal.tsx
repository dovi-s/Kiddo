// DetailHistoryModal — generic "show me everything about X" surface.
//
// Pattern lifted from Acorns' transaction detail flow but generalized so the
// same modal handles any scope: a single recurring schedule, all one-time
// contributions, a holding's lifetime, a gifter's history, an occasion's
// gifts. The caller passes pre-filtered rows + summary stats; the modal
// renders the hero, a (subset of) History/Pending/Scheduled tabs, and an
// optional bottom CTA.
//
// Why generic from day one: the second this exists for recurring cards, the
// holding detail sheet wants the same modal, the gifter detail wants the
// same modal, and the occasion detail wants the same modal. Building it
// shape-agnostic means each new entry point is ~20 lines of glue, not a
// new modal.
//
// Forward-compatible chips: the per-row chip array includes a "Trade
// confirmation" link that only renders when metadata.tradeConfirmationUrl
// is populated. Today nothing populates that field (DriveWealth not yet
// integrated). When the custodian lands, the webhook handlers stamp the
// URL into activity metadata and these chips light up automatically with
// no UI change required.

import { useEffect, useMemo, useState, type ReactNode } from "react";
import { motion, AnimatePresence, useDragControls } from "framer-motion";
import { X as XIcon, ChevronDown, Calendar, Repeat } from "lucide-react";
import { Button } from "@/components/ui/button";
import { haptic } from "@/lib/haptics";
import { toast } from "@/hooks/use-toast";
import { usePublicFlags } from "@/hooks/use-public-flags";
import { MOTION } from "@/lib/motion";
import {
  type FeedActivity,
  getTypeConfig,
  parseMetadata,
  parseSafeDate,
  parseAmount,
  formatMoneyFriendly,
  extractTicker,
  StatusPill,
  isParentPaidType,
  REPORTABLE_TYPES,
  buildReportIssueHref,
  GIFT_TYPES,
  normalizeActivityType,
  normalizeActivityTitle,
  rewriteLegacyDescription,
} from "@/lib/activity-helpers";

export type DetailStat = {
  label: string;
  value: string;
  tone?: "positive" | "negative" | "neutral";
  // Optional secondary line under the value (e.g., "12 cycles").
  meta?: string | null;
};

export type DetailSubToggleOption = {
  value: string;
  label: string;
  count?: number;
};

export type DetailScheduledRow = {
  id: string;
  title: string;
  subtitle?: string;
  status: "active" | "paused" | "cancelled";
  nextRunDate?: Date | null;
  amount?: number | null;
  paymentMethodLabel?: string | null;
};

export interface DetailHistoryModalProps {
  open: boolean;
  onClose: () => void;

  // Hero section
  title: string;
  subtitle?: string | null;
  // Optional visual identity rendered to the LEFT of the title (e.g. a stock
  // logo or strategy icon), so the detail hero matches the row it opened from.
  // Undefined → title sits flush-left as before (backward-compatible).
  leading?: ReactNode;
  summaryStats: DetailStat[];

  // Optional sub-toggle that the caller controls (e.g., for the
  // contributions modal: Recurring | One-time | All).
  subToggle?: {
    options: DetailSubToggleOption[];
    value: string;
    onChange: (next: string) => void;
  };

  // Pre-filtered rows for History/Pending. The modal classifies each row
  // into the appropriate tab via its `status` field — pending/processing
  // → Pending, everything else → History.
  rows: FeedActivity[];

  // Optional Scheduled tab content. When omitted, the Scheduled tab is
  // hidden entirely (e.g., one-time contributions can't have a schedule).
  scheduledRows?: DetailScheduledRow[];

  // Bottom CTA (e.g., "Manage recurring"). Optional. Schedule-level management
  // only — the missed-charge recovery is NOT a bottom button (see onAddMissed).
  bottomCta?: { label: string; onClick: () => void; testId?: string };

  // Row-level recovery for a failed charge. When set, the "Charge missed"
  // row renders a solid "Add it now" chip inline, directly under the
  // reason + reassurance copy — the button IS the invitation, so the prose
  // no longer restates it. The recovery lives where the explanation is,
  // identically in the schedule detail and the "What you've added"
  // contributions detail. One canonical affordance + label ("Add it now")
  // across the card, the feed, and this modal.
  onAddMissed?: (row: FeedActivity) => void;
}

type ModalTab = "history" | "pending" | "scheduled";

export function DetailHistoryModal({
  open,
  onClose,
  title,
  subtitle,
  leading,
  summaryStats,
  subToggle,
  rows,
  scheduledRows,
  bottomCta,
  onAddMissed,
}: DetailHistoryModalProps) {
  // "Update card" recovery on a Charge-missed row is flag-gated (default OFF). When
  // on, and the caller allowed recovery (onAddMissed present), a failed row can open
  // the Stripe billing portal to fix the card the plan charges going forward. See the
  // /api/parent-contributions/:id/update-card endpoint for why this is the portal.
  const { recurring_card_update: cardUpdateEnabled } = usePublicFlags();

  // Swipe-down-to-dismiss, matching every other bottom sheet in the app. Drag is
  // started ONLY from the handle (dragListener=false + dragControls) so it never
  // fights the scrollable History/Pending content. Framer owns the transform here
  // (this is a motion sheet, not a Radix one), so we use its drag, not the shared
  // useSheetDragDismiss hook.
  const dragControls = useDragControls();

  // Lock body scroll while open. Prevents the underlying Activity page from
  // scrolling under the modal on iOS (the canonical sheet-modal bug).
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  // Esc closes — keyboard parity with other modals on the platform.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  const { historyRows, pendingRows } = useMemo(() => {
    const hist: FeedActivity[] = [];
    const pend: FeedActivity[] = [];
    for (const r of rows) {
      const status = String(r.status || "").toLowerCase();
      if (status === "pending" || status === "processing") pend.push(r);
      else hist.push(r);
    }
    // History reads newest-first to match the main Activity feed.
    hist.sort((a, b) => {
      const ta = parseSafeDate(a.createdAt)?.getTime() ?? 0;
      const tb = parseSafeDate(b.createdAt)?.getTime() ?? 0;
      return tb - ta;
    });
    return { historyRows: hist, pendingRows: pend };
  }, [rows]);

  const showScheduled = !!scheduledRows && scheduledRows.length > 0;
  const initialTab: ModalTab =
    historyRows.length > 0 ? "history"
      : pendingRows.length > 0 ? "pending"
      : showScheduled ? "scheduled"
      : "history";
  const [tab, setTab] = useState<ModalTab>(initialTab);

  // Reset to default tab whenever the modal opens with new content. Without
  // this, a parent who left the previous instance on Pending would land on
  // Pending the next time even if the new scope has no pending rows.
  useEffect(() => {
    if (open) setTab(initialTab);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  if (!open) return null;

  const tabs: { id: ModalTab; label: string; count: number }[] = [
    { id: "history", label: "History", count: historyRows.length },
    { id: "pending", label: "Pending", count: pendingRows.length },
    ...(showScheduled ? [{ id: "scheduled" as const, label: "Scheduled", count: scheduledRows!.length }] : []),
  ];

  return (
    <AnimatePresence>
      {open && (
        <>
          {/* Backdrop. Click to close. */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={MOTION.fast}
            onClick={onClose}
            data-testid="detail-history-modal-backdrop"
            style={{
              position: "fixed", inset: 0, zIndex: 70,
              background: "hsl(var(--kiddo-ink) / 0.45)",
              backdropFilter: "blur(2px)",
            }}
          />
          {/* Sheet positioning wrapper. Was previously using inline
              left/right/bottom on the motion.div directly, which won over
              the Tailwind md: overrides (inline styles beat utilities) AND
              fought framer-motion's transform — net effect on desktop was
              the modal jumping off the left edge of the viewport. Cleaner
              architecture: a flex-positioning wrapper anchors the sheet
              (bottom on mobile, center on desktop) and the inner
              motion.div sizes itself naturally. framer-motion's transform
              applies only to the inner element with nothing to fight. The
              wrapper sets pointer-events: none so backdrop clicks pass
              through to the actual backdrop element above. */}
          <div
            style={{
              position: "fixed", inset: 0, zIndex: 71,
              display: "flex",
              justifyContent: "center",
              alignItems: "flex-end",
              pointerEvents: "none",
            }}
            className="md:items-center"
          >
          <motion.div
            initial={{ y: "100%", opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: "100%", opacity: 0 }}
            transition={MOTION.modal}
            drag="y"
            dragControls={dragControls}
            dragListener={false}
            dragConstraints={{ top: 0, bottom: 0 }}
            dragElastic={{ top: 0, bottom: 0.6 }}
            dragSnapToOrigin
            onDragEnd={(_, info) => {
              // Past the pull threshold OR a fast downward flick → dismiss;
              // otherwise dragSnapToOrigin springs it back to rest.
              if (info.offset.y > 110 || info.velocity.y > 600) onClose();
            }}
            role="dialog"
            aria-modal="true"
            aria-label={title}
            data-testid="detail-history-modal"
            style={{
              position: "relative",
              pointerEvents: "auto",
              maxHeight: "92vh",
              width: "100%",
              display: "flex", flexDirection: "column" as const,
              background: "white",
              borderTopLeftRadius: 24, borderTopRightRadius: 24,
              boxShadow: "0 -4px 24px hsl(var(--kiddo-ink) / 0.18)",
            }}
            // Desktop: bounded width + rounded all corners + centered max
            // height. The wrapper's flex-center handles the actual
            // centering — this just sizes the box.
            className="md:w-[640px] md:max-h-[85vh] md:rounded-3xl"
          >
            {/* Drag handle / header */}
            <div style={{
              display: "flex", alignItems: "center", justifyContent: "space-between",
              padding: "14px 18px 0 18px",
            }}>
              {/* Grab handle — the drag initiator. Padded hit area + touch-none so
                  dragging it starts the sheet drag (not a body scroll). Desktop is
                  centered (no swipe), so the handle is mobile-only. */}
              <div
                onPointerDown={(e) => dragControls.start(e)}
                data-testid="sheet-drag-handle"
                className="md:hidden"
                style={{ margin: "0 auto", padding: "4px 44px", touchAction: "none", cursor: "grab" }}
              >
                <div style={{ width: 40, height: 4, borderRadius: 2, background: "hsl(var(--kiddo-ink) / 0.14)" }} />
              </div>
              <button
                type="button"
                onClick={onClose}
                aria-label="Close"
                data-testid="detail-history-modal-close"
                style={{
                  position: "absolute", right: 12, top: 10,
                  width: 32, height: 32, borderRadius: 999,
                  display: "inline-flex", alignItems: "center", justifyContent: "center",
                  background: "hsl(var(--kiddo-ink) / 0.06)", border: "none",
                  cursor: "pointer",
                }}
              >
                <XIcon size={16} style={{ color: "rgb(60,52,42)" }} />
              </button>
            </div>

            {/* Hero */}
            <div style={{ padding: "16px 20px 14px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                {leading && <div style={{ flexShrink: 0, lineHeight: 0 }}>{leading}</div>}
                <div style={{ minWidth: 0 }}>
                  <p className="font-heading" style={{ fontSize: 20, fontWeight: 700, color: "hsl(var(--kiddo-ink))", lineHeight: 1.2 }}>
                    {title}
                  </p>
                  {subtitle && (
                    <p style={{ fontSize: 13, color: "hsl(var(--kiddo-ink) / 0.62)", marginTop: 4 }}>
                      {subtitle}
                    </p>
                  )}
                </div>
              </div>
              {summaryStats.length > 0 && (
                <div style={{
                  marginTop: 14,
                  display: "grid",
                  gridTemplateColumns: summaryStats.length >= 4 ? "repeat(2, 1fr)" : `repeat(${Math.min(summaryStats.length, 2)}, 1fr)`,
                  gap: "10px 16px",
                }}>
                  {summaryStats.map((s, i) => (
                    <div key={`${s.label}-${i}`} data-testid={`detail-stat-${s.label.toLowerCase().replace(/\s+/g, "-")}`}>
                      <p style={{ fontSize: 10.5, fontWeight: 600, color: "rgb(140,130,122)", marginBottom: 2 }}>{s.label}</p>
                      <p
                        className="font-heading"
                        style={{
                          fontSize: 16, fontWeight: 700, lineHeight: 1.2,
                          color: s.tone === "positive" ? "rgb(26,67,50)" : s.tone === "negative" ? "rgb(185,28,28)" : "hsl(var(--kiddo-ink))",
                        }}
                      >
                        {s.value}
                      </p>
                      {s.meta && (
                        <p style={{ fontSize: 10.5, color: "rgb(155,144,136)", marginTop: 3, lineHeight: 1.3 }}>
                          {s.meta}
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Optional sub-toggle (e.g., Recurring | One-time | All) */}
            {subToggle && subToggle.options.length > 1 && (
              <div style={{ padding: "0 20px 12px", display: "flex", gap: 6, flexWrap: "wrap" as const }}>
                {subToggle.options.map((opt) => {
                  const active = subToggle.value === opt.value;
                  return (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() => { haptic("selection"); subToggle.onChange(opt.value); }}
                      data-testid={`detail-subtoggle-${opt.value}`}
                      style={{
                        padding: "6px 13px", borderRadius: 999, flexShrink: 0,
                        border: active ? "none" : "1.5px solid hsl(var(--kiddo-ink) / 0.12)",
                        background: active ? "rgb(26,61,43)" : "white",
                        color: active ? "white" : "rgb(100,92,86)",
                        fontSize: 12, fontWeight: active ? 700 : 600,
                        cursor: "pointer", fontFamily: "inherit",
                        display: "inline-flex", alignItems: "center", gap: 5,
                      }}
                    >
                      {opt.label}
                      {opt.count != null && opt.count > 0 && (
                        <span style={{
                          fontSize: 10, fontWeight: 800,
                          padding: "1px 6px", borderRadius: 999,
                          background: active ? "rgba(255,255,255,0.18)" : "hsl(var(--kiddo-ink) / 0.08)",
                          color: active ? "white" : "hsl(var(--kiddo-ink) / 0.55)",
                        }}>
                          {opt.count}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            )}

            {/* Tabs */}
            <div style={{
              display: "grid", gridTemplateColumns: `repeat(${tabs.length}, 1fr)`, gap: 4,
              margin: "0 20px",
              background: "hsl(var(--kiddo-ink) / 0.05)", borderRadius: 12, padding: 4,
            }}>
              {tabs.map((t) => {
                const active = tab === t.id;
                return (
                  <button
                    key={t.id}
                    type="button"
                    role="tab"
                    aria-selected={active}
                    onClick={() => { haptic("selection"); setTab(t.id); }}
                    data-testid={`detail-tab-${t.id}`}
                    style={{
                      display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 6,
                      height: 32, borderRadius: 9, border: "none",
                      background: active ? "white" : "transparent",
                      boxShadow: active ? "0 1px 3px hsl(var(--kiddo-ink) / 0.10)" : "none",
                      color: active ? "rgb(26,67,50)" : "hsl(var(--kiddo-ink) / 0.55)",
                      fontSize: 12, fontWeight: active ? 700 : 600,
                      cursor: "pointer", fontFamily: "inherit",
                    }}
                  >
                    {t.label}
                    {t.count > 0 && (
                      <span style={{
                        display: "inline-flex", alignItems: "center", justifyContent: "center",
                        minWidth: 16, height: 16, borderRadius: 8,
                        padding: "0 4px", fontSize: 9.5, fontWeight: 800,
                        background: active ? "rgb(26,67,50)" : "hsl(var(--kiddo-ink) / 0.15)",
                        color: active ? "white" : "hsl(var(--kiddo-ink) / 0.65)",
                      }}>
                        {t.count}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>

            {/* Tab content — scrollable. */}
            <div style={{
              flex: 1, minHeight: 0, overflowY: "auto" as const,
              padding: "14px 20px 20px",
            }}>
              {tab === "history" && (
                historyRows.length === 0 ? (
                  <EmptyState label="Nothing here yet." sub="Contributions will show up here." />
                ) : (
                  <div style={{ display: "flex", flexDirection: "column" as const, gap: 12 }}>
                    {foldRecurringHistory(historyRows).map((entry) =>
                      entry.kind === "run" ? (
                        <RecurringRunGroup key={entry.id} items={entry.items} />
                      ) : (
                        <DetailRow key={String(entry.row.id || `${entry.row.createdAt}-${entry.row.title}`)} row={entry.row} onAddMissed={onAddMissed} cardUpdateEnabled={cardUpdateEnabled} />
                      )
                    )}
                  </div>
                )
              )}
              {tab === "pending" && (
                pendingRows.length === 0 ? (
                  <EmptyState
                    label="Nothing in transit right now."
                    sub="Money on its way to the market shows up here."
                  />
                ) : (
                  <div style={{ display: "flex", flexDirection: "column" as const, gap: 12 }}>
                    {pendingRows.map((row) => (
                      <DetailRow key={String(row.id || `${row.createdAt}-${row.title}`)} row={row} pendingMode onAddMissed={onAddMissed} cardUpdateEnabled={cardUpdateEnabled} />
                    ))}
                  </div>
                )
              )}
              {tab === "scheduled" && showScheduled && (
                scheduledRows!.length === 0 ? (
                  <EmptyState label="No upcoming charges." sub="" />
                ) : (
                  <div style={{ display: "flex", flexDirection: "column" as const, gap: 10 }}>
                    {scheduledRows!.map((s) => (
                      <ScheduledRow key={s.id} row={s} />
                    ))}
                  </div>
                )
              )}
            </div>

            {/* Bottom CTA. Recovery ("Add it now") is NOT here — it lives inline on
                the failed row (see onAddMissed → RowChips) so the action sits with the
                copy that invites it. This slot is for schedule-level management only. */}
            {bottomCta && (
              <div style={{
                padding: "12px 20px",
                borderTop: "1px solid hsl(var(--kiddo-ink) / 0.08)",
                background: "white",
                display: "flex", flexDirection: "column" as const, gap: 8,
              }}>
                <Button
                  // Solid evergreen primary, not brand gold. Gold is reserved
                  // for THE Share CTA (AppHeader / sidebar). This modal's
                  // bottom CTA is a parent-action ("Manage recurring →"),
                  // never a share — should never compete visually with the
                  // canonical share button.
                  variant="default"
                  className="w-full rounded-full"
                  onClick={() => { haptic("medium"); bottomCta.onClick(); }}
                  data-testid={bottomCta.testId || "detail-modal-bottom-cta"}
                >
                  {bottomCta.label}
                </Button>
              </div>
            )}
          </motion.div>
          </div>
        </>
      )}
    </AnimatePresence>
  );
}

function EmptyState({ label, sub }: { label: string; sub: string }) {
  return (
    <div style={{
      padding: "40px 20px", textAlign: "center" as const,
      border: "1px dashed hsl(var(--kiddo-ink) / 0.14)", borderRadius: 16,
    }}>
      <p className="font-heading" style={{ fontSize: 15, fontWeight: 700, color: "hsl(var(--kiddo-ink))", marginBottom: 4 }}>
        {label}
      </p>
      {sub && (
        <p style={{ fontSize: 12.5, color: "rgb(140,130,122)", lineHeight: 1.5 }}>
          {sub}
        </p>
      )}
    </div>
  );
}

function ScheduledRow({ row }: { row: DetailScheduledRow }) {
  const next = row.nextRunDate ?? null;
  const isPaused = row.status === "paused";
  return (
    <div style={{
      display: "flex", alignItems: "flex-start", gap: 12,
      padding: "12px 14px",
      background: "white",
      border: "1px solid hsl(var(--kiddo-ink) / 0.08)",
      borderRadius: 14,
    }} data-testid={`detail-scheduled-${row.id}`}>
      <div style={{
        width: 34, height: 34, borderRadius: 10, flexShrink: 0,
        background: isPaused ? "rgb(254,243,199)" : "rgb(237,244,238)",
        display: "flex", alignItems: "center", justifyContent: "center",
        border: `1px solid ${isPaused ? "rgba(184,121,26,0.18)" : "rgba(26,67,50,0.15)"}`,
      }}>
        <Repeat size={15} style={{ color: isPaused ? "rgb(184,121,26)" : "rgb(26,67,50)" }} />
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: "flex", justifyContent: "space-between", gap: 8, alignItems: "flex-start" }}>
          <p style={{ fontSize: 13, fontWeight: 700, color: isPaused ? "rgb(140,130,122)" : "hsl(var(--kiddo-ink))" }}>
            {row.title}
          </p>
          <span style={{
            fontSize: 9.5, fontWeight: 700, borderRadius: 999, padding: "2px 7px",
            background: isPaused ? "rgb(254,243,199)" : "rgb(220,247,228)",
            color: isPaused ? "rgb(146,64,14)" : "rgb(15,82,42)",
          }}>
            {isPaused ? "Paused" : "Active"}
          </span>
        </div>
        {row.subtitle && (
          <p style={{ fontSize: 12, color: "hsl(var(--kiddo-ink) / 0.55)", marginTop: 2 }}>
            {row.subtitle}
          </p>
        )}
        {(next || row.paymentMethodLabel) && (
          <p style={{ fontSize: 11.5, color: "rgb(140,130,122)", marginTop: 4 }}>
            {next && !isPaused && <>Next {next.toLocaleDateString("en-US", { month: "short", day: "numeric" })}</>}
            {next && row.paymentMethodLabel && " · "}
            {row.paymentMethodLabel}
          </p>
        )}
      </div>
    </div>
  );
}

// Row layout used inside the modal. Flatter than the main Activity row
// (no expand toggle — the modal IS the focused view, no need to nest
// another expand). Always shows reconcile box + chips inline when present.
// ── Recurring-cycle collapse (History tab) ───────────────────────────────────
// A schedule that fired $100/mo for years renders as a wall of identical rows.
// Fold consecutive TRUE recurring cycles into one expandable "Monthly
// contributions · N · $X each" summary, mirroring the Activity feed. Only pure
// recurring cycles fold (parent_contribution + a parentContributionId); one-time
// additions, stock buys, gifts, and failed charges have a different type or no
// parentContributionId, so they stay their own rows with their own icons.
const MIN_RECURRING_RUN = 3;

function isRecurringCycleRow(row: FeedActivity): boolean {
  if (normalizeActivityType((row as any).type) !== "parent_contribution") return false;
  const pcId = (parseMetadata((row as any).metadata) as any)?.parentContributionId;
  return typeof pcId === "string" && pcId.length > 0;
}

type HistoryEntry =
  | { kind: "row"; row: FeedActivity }
  | { kind: "run"; id: string; items: FeedActivity[] };

function foldRecurringHistory(rows: FeedActivity[]): HistoryEntry[] {
  const out: HistoryEntry[] = [];
  let run: FeedActivity[] = [];
  const flush = () => {
    if (run.length >= MIN_RECURRING_RUN) {
      out.push({ kind: "run", id: `run-${String((run[0] as any).id || (run[0] as any).createdAt)}`, items: run.slice() });
    } else {
      run.forEach((r) => out.push({ kind: "row", row: r }));
    }
    run = [];
  };
  for (const row of rows) {
    if (isRecurringCycleRow(row)) run.push(row);
    else { flush(); out.push({ kind: "row", row }); }
  }
  flush();
  return out;
}

function RecurringRunGroup({ items }: { items: FeedActivity[] }) {
  const [expanded, setExpanded] = useState(false);
  const count = items.length;
  const total = items.reduce((s, r) => s + (parseAmount((r as any).amount) || 0), 0);
  const amounts = items.map((r) => parseAmount((r as any).amount) || 0);
  const uniform = amounts.length > 0 && amounts.every((a) => a === amounts[0]);
  const newest = parseSafeDate((items[0] as any).createdAt);
  const oldest = parseSafeDate((items[items.length - 1] as any).createdAt);
  const my = (d: Date | null) => (d ? d.toLocaleDateString("en-US", { month: "short", year: "numeric" }) : "");
  const range = oldest && newest ? `${my(oldest)} – ${my(newest)}` : "";
  return (
    <div style={{ background: "white", border: "1px solid hsl(var(--kiddo-ink) / 0.08)", borderRadius: 14, overflow: "hidden" }} data-testid="detail-recurring-run">
      <button type="button" onClick={() => setExpanded((v) => !v)} style={{ width: "100%", textAlign: "left", background: "transparent", border: "none", cursor: "pointer", padding: "12px 14px", display: "flex", alignItems: "flex-start", gap: 12 }}>
        <div style={{ width: 34, height: 34, borderRadius: 10, flexShrink: 0, background: "rgb(234,239,233)", display: "flex", alignItems: "center", justifyContent: "center", border: "1px solid rgba(96,124,104,0.16)" }}>
          <Repeat size={16} style={{ color: "rgb(96,124,104)" }} />
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 8 }}>
            <p style={{ fontSize: 13, fontWeight: 700, color: "hsl(var(--kiddo-ink))", lineHeight: 1.3 }}>Monthly contributions</p>
            <p className="font-heading" style={{ fontSize: 14.5, fontWeight: 700, color: "hsl(var(--kiddo-ink))", whiteSpace: "nowrap" }}>+{formatMoneyFriendly(total)}</p>
          </div>
          <p style={{ fontSize: 12, color: "rgb(120,110,102)", marginTop: 2 }}>
            {count} contributions{range ? ` · ${range}` : ""}{uniform ? ` · ${formatMoneyFriendly(amounts[0])} each` : ""}
          </p>
          <p style={{ fontSize: 11.5, fontWeight: 600, color: "rgb(96,124,104)", marginTop: 6, display: "inline-flex", alignItems: "center", gap: 4 }}>
            {expanded ? "Hide" : "Show all"} {count}
            <ChevronDown size={12} style={{ transform: expanded ? "rotate(180deg)" : "none", transition: "transform .15s" }} />
          </p>
        </div>
      </button>
      {expanded && (
        <div style={{ padding: "0 14px 12px 60px", display: "flex", flexDirection: "column" as const }}>
          {items.map((it, idx) => {
            const d = parseSafeDate((it as any).createdAt);
            const amt = parseAmount((it as any).amount) || 0;
            return (
              <div key={String((it as any).id || idx)} style={{ display: "flex", justifyContent: "space-between", gap: 8, padding: "6px 0", fontSize: 12.5, color: "rgb(90,82,74)", borderTop: idx > 0 ? "1px solid hsl(var(--kiddo-ink) / 0.05)" : "none" }}>
                <span>{d ? d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) : ""}</span>
                <span style={{ fontWeight: 600, color: "hsl(var(--kiddo-ink))" }}>+{formatMoneyFriendly(amt)}</span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function DetailRow({ row, pendingMode, onAddMissed, cardUpdateEnabled }: { row: FeedActivity; pendingMode?: boolean; onAddMissed?: (row: FeedActivity) => void; cardUpdateEnabled?: boolean }) {
  const meta = parseMetadata((row as any).metadata);
  const config = getTypeConfig(row.type);
  const createdAt = parseSafeDate(row.createdAt);
  const amtNum = parseAmount(row.amount);
  const normalizedType = normalizeActivityType(row.type);
  const isGiftOrContrib = GIFT_TYPES.includes(normalizedType) || normalizedType === "parent_contribution";
  const ticker = isGiftOrContrib ? extractTicker(meta, row.title) : null;
  const giftMessage = typeof meta.message === "string" && meta.message ? meta.message : null;
  const reconcileBrand = typeof (meta as any).paymentMethodBrand === "string" ? (meta as any).paymentMethodBrand : null;
  const reconcileLast4 = typeof (meta as any).paymentMethodLast4 === "string" ? (meta as any).paymentMethodLast4 : null;
  const reconcileDescriptor = typeof (meta as any).descriptor === "string" ? (meta as any).descriptor : null;
  const reconcileReceiptUrl = typeof (meta as any).stripeReceiptUrl === "string" ? (meta as any).stripeReceiptUrl : null;
  const tradeConfirmationUrl = typeof (meta as any).tradeConfirmationUrl === "string" ? (meta as any).tradeConfirmationUrl : null;
  const nextRetryRaw = (meta as any).nextRetryDate;
  const nextRetryDate = typeof nextRetryRaw === "string" ? new Date(nextRetryRaw) : null;
  const hasReconcile = !!(reconcileLast4 || reconcileDescriptor || reconcileReceiptUrl);
  const showReconcile = isParentPaidType(row.type) && hasReconcile;
  // A failed charge (schedule detail OR contributions detail) gets an inline
  // "Add it now" recovery chip when the caller wired onAddMissed. This is the
  // clickable action the "Add the missed one if you'd like" copy points at.
  const isFailedContrib = row.type === "parent_contribution_failed" || row.type === "payment_failed";
  const onAddNow = isFailedContrib && onAddMissed ? () => onAddMissed(row) : undefined;
  // Root-cause recovery: "Add it now" fixes THIS charge; "Update card" fixes the card
  // the plan charges going forward (opens the Stripe billing portal). Same permission
  // as "Add it now" (only shows when the caller allowed recovery), flag-gated, and only
  // when we can tie the row back to its plan (parentContributionId in metadata).
  const failedPlanId = typeof (meta as any).parentContributionId === "string" ? (meta as any).parentContributionId : null;
  const onUpdateCard = onAddNow && cardUpdateEnabled && failedPlanId
    ? async () => {
        try {
          const res = await fetch(`/api/parent-contributions/${failedPlanId}/update-card`, { method: "POST", credentials: "include" });
          const data = await res.json().catch(() => ({}));
          if (!res.ok || !data?.url) throw new Error(data?.message || data?.error || "Could not open card update.");
          window.location.href = data.url as string;
        } catch (err: any) {
          toast({ title: "Couldn't open card update", description: err?.message || "Try again in a moment.", variant: "destructive" });
        }
      }
    : undefined;

  return (
    <div
      style={{
        background: "white",
        border: "1px solid hsl(var(--kiddo-ink) / 0.08)",
        borderRadius: 14,
        padding: "12px 14px",
      }}
      data-testid={`detail-row-${row.id}`}
    >
      <div style={{ display: "flex", alignItems: "flex-start", gap: 12 }}>
        <div style={{
          width: 34, height: 34, borderRadius: 10, flexShrink: 0,
          background: config.bg,
          display: "flex", alignItems: "center", justifyContent: "center",
          border: `1px solid ${config.color}18`,
        }}>
          <span style={{ color: config.color, display: "flex" }}>{config.icon}</span>
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 8 }}>
            <p style={{ fontSize: 13, fontWeight: 700, color: "hsl(var(--kiddo-ink))", lineHeight: 1.3, flex: 1, minWidth: 0 }}>
              {/* Normalize the legacy "Recurring investment failed" title to
                  "Automatic charge didn't go through" here too — this modal was
                  the one surface still rendering the raw title, so it stacked
                  with the "Charge missed" pill + "Recurring investment" eyebrow
                  (the triple-label the main feed + detail page already fix). */}
              {normalizeActivityTitle(row.title) || "Activity"}
            </p>
            {amtNum != null && (() => {
              // A failed charge moved $0, so never render it as money-in. Drop
              // the "+" and use muted ink (the row already carries a red
              // "Charge failed" pill). Mirrors the main Activity feed.
              const isFailed = row.type === "parent_contribution_failed" || row.type === "payment_failed";
              return (
              <p className="font-heading" style={{
                fontSize: 14.5, fontWeight: 700, lineHeight: 1.3,
                color: isFailed ? "hsl(var(--kiddo-ink) / 0.45)" : amtNum >= 0 ? "hsl(var(--kiddo-ink))" : "rgb(185,28,28)",
              }}>
                {!isFailed && amtNum > 0 ? "+" : ""}{formatMoneyFriendly(amtNum)}
              </p>
              );
            })()}
          </div>
          {/* Note rendering. Suppress the legacy "Auto-invest contribution
              to {fund}" boilerplate — that's a system-generated string from
              early recurring-investment rows, not a parent's love letter.
              The word "auto-invest" is also explicitly banned from
              user-facing UI copy per the locked Recurring Investments
              naming rule (project memory: section header = "Growing
              automatically"; settings = "Recurring investments"; never
              "auto-invest"). Same suppression already applied to Dashboard
              recent-gifts feed, Memory Book, and the inline Activity feed
              — DetailHistoryModal was the missed surface (showed up in the
              "Your investments" → One-time tab as a stray "Auto-invest
              contribution to Emma's Fund" quote on legacy rows). Test
              pattern messages also suppressed for parity with the other
              filters. Real parent notes still render. */}
          {(() => {
            const message = giftMessage ? giftMessage.trim() : "";
            const isBoilerplateRecurring = /^auto-invest contribution to /i.test(message);
            const isTestPattern = /^(test|testing|tstgin|tstng|qqqqq|tester)\b/i.test(message);
            const shouldSuppressMessage = !message || isBoilerplateRecurring || isTestPattern;
            // Run the feed's legacy-copy cleanup so this modal shows the SAME
            // honest text (e.g. the tightened failed-charge line), not raw seed copy.
            // EXCEPTION — a declined charge whose reconcile card is showing: the card
            // (Charged to ····4242), the next-charge date, AND the "Add it now" chip
            // all render as structured rows just below. So the prose keeps only what
            // they don't say — the reason (declined) and the reassurance (plan's on) —
            // and drops the CTA sentence the button already carries. Two short lines
            // read calm on mobile instead of crammed.
            const shown = shouldSuppressMessage
              ? (isFailedContrib && reconcileLast4
                  ? "That card was declined. Your plan is still on."
                  : rewriteLegacyDescription(row.description))
              : `"${message}"`;
            if (!shown) return null;
            return (
              <p style={{
                fontSize: 12, lineHeight: 1.45, marginTop: 3,
                color: "hsl(var(--kiddo-ink) / 0.62)",
                fontStyle: shown.startsWith('"') ? "italic" : "normal",
              }}>
                {shown}
              </p>
            );
          })()}
          <div style={{ display: "flex", alignItems: "center", gap: 5, marginTop: 6, flexWrap: "wrap" as const }}>
            {/* A failed charge already says "failed" twice above — the bold title
                ("Automatic charge didn't go through") and the amber icon carry the
                state, and the prose gives the reason + reassurance. The "Charge
                missed" pill was a THIRD restatement of the same fact on the same
                row. Show the failure once: suppress the pill for failed rows and
                let the title own it. (Non-failed rows keep their pill.) */}
            {!isFailedContrib && <StatusPill status={row.status} type={row.type} />}
            {ticker && (
              <span style={{
                fontSize: 9.5, fontWeight: 800, borderRadius: 6, padding: "2px 7px",
                background: "rgb(26,61,43)", color: "white",
                letterSpacing: "0.04em",
              }}>
                {ticker}
              </span>
            )}
            {/* Distinguish a recurring cycle from a one-time addition — both are
                "Contribution" by type, so name the sub-kind in the label slot the
                generic "Contribution" used to fill. Everything else (gifts, growth,
                schedule edits) keeps its own label. */}
            <span style={{ fontSize: 10.5, color: "rgb(175,164,156)" }}>
              {normalizedType === "parent_contribution"
                ? (isRecurringCycleRow(row) ? "Recurring" : "One-time")
                : config.label}
            </span>
            {createdAt && (
              <span style={{ fontSize: 10.5, color: "rgb(175,164,156)" }}>
                {/* Drop the year for current-year rows, like the main Activity
                    feed — "Nov 5" reads cleaner than "Nov 5, 2026"; prior years
                    keep the year so the ledger stays unambiguous on scroll. */}
                · {createdAt.toLocaleDateString("en-US", createdAt.getFullYear() === new Date().getFullYear()
                    ? { month: "short", day: "numeric" }
                    : { month: "short", day: "numeric", year: "numeric" })}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Reconcile mini-card — same data shape as Activity main feed. */}
      {showReconcile && (
        <div
          style={{
            marginTop: 10,
            background: "rgba(15,82,42,0.04)",
            border: "1px solid rgba(15,82,42,0.10)",
            borderRadius: 10,
            padding: "9px 11px",
            display: "grid",
            gridTemplateColumns: "auto 1fr",
            gap: "5px 12px",
          }}
        >
          {reconcileLast4 && (
            <>
              <p style={{ fontSize: 11, color: "rgb(140,130,122)", fontWeight: 600 }}>Charged to</p>
              <p style={{ fontSize: 12, color: "hsl(var(--kiddo-ink))", fontWeight: 600 }}>
                {reconcileBrand ? reconcileBrand.charAt(0).toUpperCase() + reconcileBrand.slice(1) : "Card"} ····{reconcileLast4}
              </p>
            </>
          )}
          {reconcileDescriptor && (
            <>
              <p style={{ fontSize: 11, color: "rgb(140,130,122)", fontWeight: 600 }}>On your statement</p>
              <p style={{ fontSize: 12, color: "hsl(var(--kiddo-ink))", fontWeight: 600 }}>{reconcileDescriptor}</p>
            </>
          )}
          {/* No "Next charge" on a FAILED row's reconcile card. It belongs to the
              schedule, not to this one declined event — and the schedule-detail
              header already shows "Next charge", so repeating it here (with a
              different date format, no less) was pure duplication. The reconcile on
              a failed charge answers one question: which card got declined. The
              "Your plan is still on" prose already carries the reassurance that a
              next charge is coming. Non-failed rows still show it if present. */}
          {!isFailedContrib && nextRetryDate && Number.isFinite(nextRetryDate.getTime()) && (
            <>
              {/* "Next charge", NOT "Next attempt": the worker does not re-run the
                  missed charge — it advances to the next normal cycle. */}
              <p style={{ fontSize: 11, color: "rgb(140,130,122)", fontWeight: 600 }}>Next charge</p>
              <p style={{ fontSize: 12, color: "hsl(var(--kiddo-ink))", fontWeight: 600 }}>
                {nextRetryDate.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}
              </p>
            </>
          )}
        </div>
      )}

      {/* Per-row chips: View receipt, Trade confirmation, Report issue.
          Always anchor links — never SPA-navigate from within the modal
          (would unmount the modal mid-flow). Trade confirmation only
          renders when the metadata field is populated; until DriveWealth
          is wired this stays invisible by design. */}
      <RowChips
        receiptUrl={reconcileReceiptUrl}
        tradeConfirmationUrl={tradeConfirmationUrl}
        showReportIssue={REPORTABLE_TYPES.has(normalizedType) && (row as any).__suppressReport !== true}
        onAddNow={onAddNow}
        onUpdateCard={onUpdateCard}
        rowId={String(row.id || "")}
        fundId={(row as any).fundId || null}
        type={normalizedType}
        title={row.title}
        amount={amtNum}
        createdAt={createdAt}
      />
    </div>
  );
}

function RowChips({
  receiptUrl,
  tradeConfirmationUrl,
  showReportIssue,
  onAddNow,
  onUpdateCard,
  rowId,
  fundId,
  type,
  title,
  amount,
  createdAt,
}: {
  receiptUrl: string | null;
  tradeConfirmationUrl: string | null;
  showReportIssue: boolean;
  onAddNow?: () => void;
  onUpdateCard?: () => void;
  rowId: string;
  fundId: string | null;
  type: string;
  title?: string | null;
  amount: number | null;
  createdAt: Date | null;
}) {
  const chips: { label: string; href?: string; onClick?: () => void; testId: string; solid?: boolean }[] = [];
  if (onAddNow) {
    // Solid green pill, first in line, so the recovery reads as the primary
    // action on a "Charge missed" row (not a footnote among the quiet chips).
    chips.push({ label: "Add it now", onClick: onAddNow, testId: `chip-addnow-${rowId}`, solid: true });
  }
  if (onUpdateCard) {
    // Secondary (tinted, not solid): fixes the card going forward. Sits next to
    // "Add it now" so catch-up and root-fix are both one tap from the failed row.
    chips.push({ label: "Update card", onClick: onUpdateCard, testId: `chip-updatecard-${rowId}` });
  }
  if (receiptUrl) {
    chips.push({ label: "View receipt ↗", href: receiptUrl, testId: `chip-receipt-${rowId}` });
  }
  if (tradeConfirmationUrl) {
    chips.push({ label: "Trade confirmation ↗", href: tradeConfirmationUrl, testId: `chip-trade-${rowId}` });
  }
  if (showReportIssue) {
    chips.push({
      // No arrow — arrows are for primary navigation; this is a quiet fallback.
      label: "Report an issue",
      href: buildReportIssueHref({ activityId: rowId, fundId, type, title, amount, createdAt }),
      testId: `chip-report-${rowId}`,
    });
  }
  if (chips.length === 0) return null;
  return (
    <div style={{ marginTop: 10, display: "flex", gap: 6, flexWrap: "wrap" as const }}>
      {chips.map((chip) => {
        const isMailto = !!chip.href && chip.href.startsWith("mailto:");
        // Report-issue renders as a quiet muted link, not a green action pill, so
        // it recedes behind the useful chips (receipt, trade confirmation) —
        // matching the feed's treatment.
        const isReport = chip.testId.startsWith("chip-report-");
        const solidStyle = {
          fontSize: 11, fontWeight: 700, color: "white",
          background: "hsl(143,47%,22%)",
          border: "1px solid hsl(143,47%,22%)",
          borderRadius: 999, padding: "5px 12px",
          cursor: "pointer", fontFamily: "inherit",
          textDecoration: "none" as const,
          display: "inline-flex" as const, alignItems: "center" as const,
          transition: "background 0.12s",
        };
        const pillStyle = {
          fontSize: 11, fontWeight: 700, color: "hsl(143,47%,22%)",
          background: "rgba(26,67,50,0.08)",
          border: "1px solid rgba(26,67,50,0.18)",
          borderRadius: 999, padding: "5px 11px",
          cursor: "pointer", fontFamily: "inherit",
          textDecoration: "none" as const,
          display: "inline-flex" as const, alignItems: "center" as const,
          transition: "background 0.12s",
        };
        const subtleStyle = {
          fontSize: 11, fontWeight: 600, color: "hsl(var(--kiddo-ink) / 0.42)",
          background: "transparent", border: "none",
          borderRadius: 999, padding: "5px 6px",
          cursor: "pointer", fontFamily: "inherit",
          textDecoration: "none" as const,
          display: "inline-flex" as const, alignItems: "center" as const,
          transition: "color 0.12s",
        };
        const style = chip.solid ? solidStyle : isReport ? subtleStyle : pillStyle;
        const onEnter = (el: HTMLElement) => {
          if (chip.solid) el.style.background = "hsl(143,47%,18%)";
          else if (isReport) el.style.color = "hsl(var(--kiddo-ink) / 0.7)";
          else el.style.background = "rgba(26,67,50,0.14)";
        };
        const onLeave = (el: HTMLElement) => {
          if (chip.solid) el.style.background = "hsl(143,47%,22%)";
          else if (isReport) el.style.color = "hsl(var(--kiddo-ink) / 0.42)";
          else el.style.background = "rgba(26,67,50,0.08)";
        };
        // Recovery chip is a real button (runs a handler); links stay anchors so
        // receipts/trade confirmations open in a new tab without unmounting the modal.
        if (chip.onClick) {
          return (
            <button
              key={chip.testId}
              type="button"
              data-testid={chip.testId}
              onClick={(e) => { e.stopPropagation(); haptic("medium"); chip.onClick!(); }}
              style={style}
              onMouseEnter={(e) => onEnter(e.currentTarget)}
              onMouseLeave={(e) => onLeave(e.currentTarget)}
            >
              {chip.label}
            </button>
          );
        }
        return (
          <a
            key={chip.testId}
            href={chip.href}
            target={isMailto ? undefined : "_blank"}
            rel={isMailto ? undefined : "noopener noreferrer"}
            data-testid={chip.testId}
            onClick={(e) => { e.stopPropagation(); haptic("selection"); }}
            style={style}
            onMouseEnter={(e) => onEnter(e.currentTarget)}
            onMouseLeave={(e) => onLeave(e.currentTarget)}
          >
            {chip.label}
          </a>
        );
      })}
    </div>
  );
}
