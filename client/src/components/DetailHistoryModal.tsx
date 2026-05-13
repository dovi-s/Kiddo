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

import { useEffect, useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X as XIcon, ChevronDown, Calendar, Repeat } from "lucide-react";
import { Button } from "@/components/ui/button";
import { haptic } from "@/lib/haptics";
import { MOTION } from "@/lib/motion";
import {
  type FeedActivity,
  getTypeConfig,
  parseMetadata,
  parseSafeDate,
  parseAmount,
  formatCurrency,
  extractTicker,
  StatusPill,
  isParentPaidType,
  REPORTABLE_TYPES,
  buildReportIssueHref,
  GIFT_TYPES,
  normalizeActivityType,
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

  // Bottom CTA (e.g., "Edit recurring →"). Optional.
  bottomCta?: { label: string; onClick: () => void; testId?: string };
}

type ModalTab = "history" | "pending" | "scheduled";

export function DetailHistoryModal({
  open,
  onClose,
  title,
  subtitle,
  summaryStats,
  subToggle,
  rows,
  scheduledRows,
  bottomCta,
}: DetailHistoryModalProps) {
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
              background: "rgba(26,23,16,0.45)",
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
              boxShadow: "0 -4px 24px rgba(26,23,16,0.18)",
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
              <div style={{ width: 40, height: 4, borderRadius: 2, background: "rgba(26,23,16,0.10)", margin: "0 auto" }} className="md:hidden" />
              <button
                type="button"
                onClick={onClose}
                aria-label="Close"
                data-testid="detail-history-modal-close"
                style={{
                  position: "absolute", right: 12, top: 10,
                  width: 32, height: 32, borderRadius: 999,
                  display: "inline-flex", alignItems: "center", justifyContent: "center",
                  background: "rgba(26,23,16,0.06)", border: "none",
                  cursor: "pointer",
                }}
              >
                <XIcon size={16} style={{ color: "rgb(60,52,42)" }} />
              </button>
            </div>

            {/* Hero */}
            <div style={{ padding: "16px 20px 14px" }}>
              <p className="font-heading" style={{ fontSize: 20, fontWeight: 700, color: "rgb(26,23,16)", lineHeight: 1.2 }}>
                {title}
              </p>
              {subtitle && (
                <p style={{ fontSize: 13, color: "rgba(26,23,16,0.62)", marginTop: 4 }}>
                  {subtitle}
                </p>
              )}
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
                          color: s.tone === "positive" ? "rgb(26,67,50)" : s.tone === "negative" ? "rgb(185,28,28)" : "rgb(26,23,16)",
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
                        border: active ? "none" : "1.5px solid rgba(26,23,16,0.12)",
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
                          background: active ? "rgba(255,255,255,0.18)" : "rgba(26,23,16,0.08)",
                          color: active ? "white" : "rgba(26,23,16,0.55)",
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
              background: "rgba(26,23,16,0.05)", borderRadius: 12, padding: 4,
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
                      boxShadow: active ? "0 1px 3px rgba(26,23,16,0.10)" : "none",
                      color: active ? "rgb(26,67,50)" : "rgba(26,23,16,0.55)",
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
                        background: active ? "rgb(26,67,50)" : "rgba(26,23,16,0.15)",
                        color: active ? "white" : "rgba(26,23,16,0.65)",
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
                  <EmptyState label="Nothing in history yet." sub="Activity for this view will appear here." />
                ) : (
                  <div style={{ display: "flex", flexDirection: "column" as const, gap: 12 }}>
                    {historyRows.map((row) => (
                      <DetailRow key={String(row.id || `${row.createdAt}-${row.title}`)} row={row} />
                    ))}
                  </div>
                )
              )}
              {tab === "pending" && (
                pendingRows.length === 0 ? (
                  <EmptyState
                    label="Nothing settling right now."
                    sub="Everything in this view is invested. ✅"
                  />
                ) : (
                  <div style={{ display: "flex", flexDirection: "column" as const, gap: 12 }}>
                    {pendingRows.map((row) => (
                      <DetailRow key={String(row.id || `${row.createdAt}-${row.title}`)} row={row} pendingMode />
                    ))}
                  </div>
                )
              )}
              {tab === "scheduled" && showScheduled && (
                scheduledRows!.length === 0 ? (
                  <EmptyState label="No upcoming runs scheduled." sub="" />
                ) : (
                  <div style={{ display: "flex", flexDirection: "column" as const, gap: 10 }}>
                    {scheduledRows!.map((s) => (
                      <ScheduledRow key={s.id} row={s} />
                    ))}
                  </div>
                )
              )}
            </div>

            {/* Bottom CTA */}
            {bottomCta && (
              <div style={{
                padding: "12px 20px",
                borderTop: "1px solid rgba(26,23,16,0.08)",
                background: "white",
              }}>
                <Button
                  // Solid evergreen primary, not brand gold. Gold is reserved
                  // for THE Share CTA (AppHeader / sidebar). This modal's
                  // bottom CTA is a parent-action ("Manage recurring →"),
                  // never a share — should never compete visually with the
                  // canonical share button.
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
      border: "1px dashed rgba(26,23,16,0.14)", borderRadius: 16,
    }}>
      <p className="font-heading" style={{ fontSize: 15, fontWeight: 700, color: "rgb(26,23,16)", marginBottom: 4 }}>
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
      border: "1px solid rgba(26,23,16,0.08)",
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
          <p style={{ fontSize: 13, fontWeight: 700, color: isPaused ? "rgb(140,130,122)" : "rgb(26,23,16)" }}>
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
          <p style={{ fontSize: 12, color: "rgba(26,23,16,0.55)", marginTop: 2 }}>
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
function DetailRow({ row, pendingMode }: { row: FeedActivity; pendingMode?: boolean }) {
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

  return (
    <div
      style={{
        background: "white",
        border: "1px solid rgba(26,23,16,0.08)",
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
            <p style={{ fontSize: 13, fontWeight: 700, color: "rgb(26,23,16)", lineHeight: 1.3, flex: 1, minWidth: 0 }}>
              {row.title || "Activity"}
            </p>
            {amtNum != null && (
              <p className="font-heading" style={{
                fontSize: 14.5, fontWeight: 700, lineHeight: 1.3,
                color: amtNum >= 0 ? "rgb(26,23,16)" : "rgb(185,28,28)",
              }}>
                {amtNum > 0 ? "+" : ""}{formatCurrency(amtNum)}
              </p>
            )}
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
            const shown = shouldSuppressMessage
              ? (row.description || null)
              : `"${message}"`;
            if (!shown) return null;
            return (
              <p style={{
                fontSize: 12, lineHeight: 1.45, marginTop: 3,
                color: "rgba(26,23,16,0.62)",
                fontStyle: shown.startsWith('"') ? "italic" : "normal",
              }}>
                {shown}
              </p>
            );
          })()}
          <div style={{ display: "flex", alignItems: "center", gap: 5, marginTop: 6, flexWrap: "wrap" as const }}>
            <StatusPill status={row.status} type={row.type} />
            {ticker && (
              <span style={{
                fontSize: 9.5, fontWeight: 800, borderRadius: 6, padding: "2px 7px",
                background: "rgb(26,61,43)", color: "white",
                letterSpacing: "0.04em",
              }}>
                {ticker}
              </span>
            )}
            <span style={{ fontSize: 10.5, color: "rgb(175,164,156)" }}>{config.label}</span>
            {createdAt && (
              <span style={{ fontSize: 10.5, color: "rgb(175,164,156)" }}>
                · {createdAt.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
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
              <p style={{ fontSize: 12, color: "rgb(26,23,16)", fontWeight: 600 }}>
                {reconcileBrand ? reconcileBrand.charAt(0).toUpperCase() + reconcileBrand.slice(1) : "Card"} ····{reconcileLast4}
              </p>
            </>
          )}
          {reconcileDescriptor && (
            <>
              <p style={{ fontSize: 11, color: "rgb(140,130,122)", fontWeight: 600 }}>On your statement</p>
              <p style={{ fontSize: 12, color: "rgb(26,23,16)", fontWeight: 600 }}>{reconcileDescriptor}</p>
            </>
          )}
          {nextRetryDate && Number.isFinite(nextRetryDate.getTime()) && (
            <>
              <p style={{ fontSize: 11, color: "rgb(140,130,122)", fontWeight: 600 }}>Next attempt</p>
              <p style={{ fontSize: 12, color: "rgb(26,23,16)", fontWeight: 600 }}>
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
        showReportIssue={REPORTABLE_TYPES.has(normalizedType)}
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
  rowId: string;
  fundId: string | null;
  type: string;
  title?: string | null;
  amount: number | null;
  createdAt: Date | null;
}) {
  const chips: { label: string; href: string; testId: string }[] = [];
  if (receiptUrl) {
    chips.push({ label: "View receipt ↗", href: receiptUrl, testId: `chip-receipt-${rowId}` });
  }
  if (tradeConfirmationUrl) {
    chips.push({ label: "Trade confirmation ↗", href: tradeConfirmationUrl, testId: `chip-trade-${rowId}` });
  }
  if (showReportIssue) {
    chips.push({
      label: "Report an issue →",
      href: buildReportIssueHref({ activityId: rowId, fundId, type, title, amount, createdAt }),
      testId: `chip-report-${rowId}`,
    });
  }
  if (chips.length === 0) return null;
  return (
    <div style={{ marginTop: 10, display: "flex", gap: 6, flexWrap: "wrap" as const }}>
      {chips.map((chip) => {
        const isMailto = chip.href.startsWith("mailto:");
        return (
          <a
            key={chip.testId}
            href={chip.href}
            target={isMailto ? undefined : "_blank"}
            rel={isMailto ? undefined : "noopener noreferrer"}
            data-testid={chip.testId}
            onClick={(e) => { e.stopPropagation(); haptic("selection"); }}
            style={{
              fontSize: 11, fontWeight: 700, color: "hsl(143,47%,22%)",
              background: "rgba(26,67,50,0.08)",
              border: "1px solid rgba(26,67,50,0.18)",
              borderRadius: 999, padding: "5px 11px",
              cursor: "pointer", fontFamily: "inherit",
              textDecoration: "none" as const,
              display: "inline-flex" as const, alignItems: "center" as const,
              transition: "background 0.12s",
            }}
            onMouseEnter={(e) => (e.currentTarget.style.background = "rgba(26,67,50,0.14)")}
            onMouseLeave={(e) => (e.currentTarget.style.background = "rgba(26,67,50,0.08)")}
          >
            {chip.label}
          </a>
        );
      })}
    </div>
  );
}
