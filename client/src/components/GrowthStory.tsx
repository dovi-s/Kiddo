import { useMemo } from "react";
import { motion } from "framer-motion";
import { useLocation } from "wouter";
import type { Gift as GiftType } from "@shared/schema";

interface Props {
  totalValue: number;
  gifts: GiftType[];
  recipientFirstName?: string;
  recipientBirthdate?: string | Date | null;
  fundId: string;
}

interface Milestone {
  amount: number;
  emoji: string;
  label: (name: string) => string;
}

const MILESTONES: Milestone[] = [
  { amount: 0,      emoji: "🌱", label: (n) => `${n}'s story started here.` },
  { amount: 100,    emoji: "🎁", label: () => "First real gift." },
  { amount: 500,    emoji: "🌟", label: () => "Growing strong." },
  { amount: 1000,   emoji: "🌿", label: () => "Four figures." },
  { amount: 5000,   emoji: "🌳", label: () => "The big tree." },
  { amount: 10000,  emoji: "🌲", label: () => "Compounding now." },
  { amount: 50000,  emoji: "🏆", label: () => "Life-changing." },
  { amount: 100000, emoji: "🎓", label: () => "The full future." },
];

const fmtShort = (v: number) => {
  if (v >= 1_000_000) return `$${(v / 1_000_000).toFixed(1)}M`;
  if (v >= 1_000)     return `$${(v / 1_000).toFixed(0)}K`;
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(v);
};

const CHART_H = 420;
const TOP_PAD  = 28;
const BOT_PAD  = 28;
const USABLE   = CHART_H - TOP_PAD - BOT_PAD;
const RULER_X  = 68; // px from left edge of card padding

export function GrowthStory({ totalValue, gifts, recipientFirstName, recipientBirthdate, fundId }: Props) {
  const [, setLocation] = useLocation();
  const name = recipientFirstName || "the fund";

  // Earliest gift
  const firstGift = useMemo(() => {
    if (!gifts.length) return null;
    return [...gifts]
      .filter(g => g.status !== "failed" && g.status !== "refunded")
      .sort((a, b) => new Date(a.createdAt ?? 0).getTime() - new Date(b.createdAt ?? 0).getTime())[0] ?? null;
  }, [gifts]);

  // Projection at 18
  const projectionValue = useMemo(() => {
    if (!recipientBirthdate || totalValue <= 0) return null;
    const bd = new Date(recipientBirthdate);
    const at18 = new Date(bd);
    at18.setFullYear(at18.getFullYear() + 18);
    const yearsLeft = (at18.getTime() - Date.now()) / (365.25 * 86_400_000);
    if (yearsLeft <= 0.25) return null;
    return totalValue * Math.pow(1.07, yearsLeft);
  }, [totalValue, recipientBirthdate]);

  // Scale: today dot sits ~50% up the chart; projection fits above it
  const maxDisplayValue = Math.max(
    projectionValue ? projectionValue * 1.12 : 0,
    totalValue > 0 ? totalValue * 4 : 1000,
    1000,
  );

  function getY(value: number): number {
    const normalized = Math.sqrt(Math.max(0, value) / maxDisplayValue);
    return TOP_PAD + USABLE * (1 - normalized);
  }

  // Which milestones to show: only ones within display range + not too crowded
  const visibleMilestones = useMemo(() => {
    const candidates = MILESTONES.filter(m => m.amount <= maxDisplayValue * 0.96);
    // Filter out marks that would be within 18px of another mark
    const kept: Milestone[] = [];
    for (const m of candidates) {
      const y = getY(m.amount);
      const tooClose = kept.some(k => Math.abs(getY(k.amount) - y) < 18);
      if (!tooClose) kept.push(m);
    }
    return kept;
  }, [maxDisplayValue]); // eslint-disable-line react-hooks/exhaustive-deps

  const hitMilestones = visibleMilestones.filter(m => totalValue >= m.amount);
  const nextMilestone = visibleMilestones.find(m => totalValue < m.amount && m.amount > 0);

  return (
    <div
      style={{
        background: "rgb(252,250,246)",
        borderRadius: 20,
        border: "1px solid rgba(26,23,16,0.08)",
        overflow: "hidden",
      }}
    >
      {/* Card header */}
      <div style={{ padding: "18px 20px 0" }}>
        <p className="font-heading" style={{
          fontSize: 18,
          fontWeight: 700,
          color: "hsl(var(--kiddo-ink))",
          lineHeight: 1.3,
          marginBottom: 4,
        }}>
          {totalValue > 0
            ? `${name} is ${fmtShort(totalValue)} into her future.`
            : `${name}'s story is ready to begin.`}
        </p>
        {projectionValue && (
          <p style={{ fontSize: 12.5, color: "rgba(26,23,16,0.45)", lineHeight: 1.4 }}>
            On track for {fmtShort(projectionValue)} by 18 at 7% annual growth.
          </p>
        )}
      </div>

      {/* Ruler chart */}
      <div style={{ position: "relative", height: CHART_H, margin: "14px 0 0" }}>

        {/* Vertical ruler line */}
        <div style={{
          position: "absolute",
          left: RULER_X + 1,
          top: TOP_PAD,
          height: USABLE,
          width: 1.5,
          background: "linear-gradient(to bottom, rgba(26,61,43,0.08) 0%, rgba(26,61,43,0.45) 30%, rgba(26,61,43,0.45) 70%, rgba(26,61,43,0.08) 100%)",
        }} />

        {/* Milestone marks */}
        {visibleMilestones.map((m) => {
          const y = getY(m.amount);
          const isHit = totalValue >= m.amount;
          const isFirstGiftMark = m.amount === 100 && firstGift && isHit;
          const labelText = isFirstGiftMark && firstGift?.senderName
            ? `First gift · ${firstGift.senderName}.`
            : m.label(name);

          return (
            <button
              key={m.amount}
              type="button"
              onClick={() => { if (isHit) setLocation(`/memory/${fundId}`); }}
              style={{
                position: "absolute",
                top: y,
                left: 0,
                right: 0,
                transform: "translateY(-50%)",
                display: "flex",
                alignItems: "center",
                background: "none",
                border: "none",
                padding: "0 16px 0 0",
                cursor: isHit ? "pointer" : "default",
                textAlign: "left",
              }}
            >
              {/* Dollar label */}
              <div style={{ width: RULER_X - 8, textAlign: "right", paddingRight: 6, flexShrink: 0 }}>
                {m.amount > 0 && (
                  <span style={{
                    fontVariantNumeric: "tabular-nums",
                    fontSize: 9,
                    fontWeight: 700,
                    color: isHit ? "rgba(26,23,16,0.4)" : "rgba(26,23,16,0.18)",
                    letterSpacing: "0.01em",
                  }}>
                    {fmtShort(m.amount)}
                  </span>
                )}
              </div>

              {/* Tick mark */}
              <div style={{
                width: 8,
                height: isHit ? 2 : 1,
                background: isHit ? "rgba(26,61,43,0.55)" : "rgba(26,23,16,0.14)",
                flexShrink: 0,
              }} />

              {/* Emoji + label */}
              <div style={{ paddingLeft: 9, display: "flex", alignItems: "center", gap: 6 }}>
                <span style={{ fontSize: 13, opacity: isHit ? 1 : 0.22, lineHeight: 1 }}>
                  {m.emoji}
                </span>
                <span style={{
                  fontFamily: "Georgia, Lora, serif",
                  fontSize: 11.5,
                  color: isHit ? "rgb(60,54,44)" : "rgba(26,23,16,0.22)",
                  lineHeight: 1.3,
                  fontStyle: isHit ? "normal" : "normal",
                }}>
                  {labelText}
                </span>
              </div>
            </button>
          );
        })}

        {/* TODAY - pulsing gold dot */}
        {totalValue > 0 && (() => {
          const todayY = getY(totalValue);
          return (
            <>
              {/* Pulse ring */}
              <motion.div
                animate={{ scale: [1, 1.9, 1], opacity: [0.45, 0, 0.45] }}
                transition={{ duration: 2.4, repeat: Infinity, ease: "easeInOut" }}
                style={{
                  position: "absolute",
                  top: todayY - 9,
                  left: RULER_X - 8,
                  width: 18,
                  height: 18,
                  borderRadius: "50%",
                  background: "rgb(184,121,26)",
                  pointerEvents: "none",
                }}
              />
              {/* Core dot */}
              <div style={{
                position: "absolute",
                top: todayY - 5,
                left: RULER_X - 4,
                width: 10,
                height: 10,
                borderRadius: "50%",
                background: "rgb(184,121,26)",
                boxShadow: "0 1px 6px rgba(184,121,26,0.55)",
                border: "2px solid rgb(252,250,246)",
                zIndex: 3,
              }} />
              {/* "Today" label */}
              <div style={{
                position: "absolute",
                top: todayY - 12,
                left: RULER_X + 12,
              }}>
                <div style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 5,
                  background: "rgb(184,121,26)",
                  borderRadius: 100,
                  padding: "3px 9px 3px 7px",
                }}>
                  <span style={{ fontSize: 8, color: "rgba(255,255,255,0.75)", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em" }}>Now</span>
                  <span style={{ fontSize: 11, fontWeight: 800, color: "white", letterSpacing: "-0.01em" }}>
                    {fmtShort(totalValue)}
                  </span>
                </div>
              </div>
            </>
          );
        })()}

        {/* Projection dashed line */}
        {projectionValue && (() => {
          const projY = getY(projectionValue);
          return (
            <>
              <div style={{
                position: "absolute",
                top: projY,
                left: RULER_X - 16,
                right: 16,
                height: 0,
                borderTop: "1.5px dashed rgba(26,61,43,0.22)",
                pointerEvents: "none",
              }} />
              <div style={{
                position: "absolute",
                top: projY - 16,
                left: RULER_X + 12,
              }}>
                <span style={{
                  fontFamily: "Georgia, Lora, serif",
                  fontSize: 11,
                  color: "rgba(26,61,43,0.5)",
                  fontStyle: "italic",
                }}>
                  🎓 At 18 · {fmtShort(projectionValue)}
                </span>
              </div>
            </>
          );
        })()}
      </div>

      {/* Footer: next milestone nudge */}
      {nextMilestone && totalValue > 0 && (
        <div style={{
          padding: "12px 20px 16px",
          borderTop: "1px solid rgba(26,23,16,0.07)",
          display: "flex",
          alignItems: "center",
          gap: 10,
        }}>
          <span style={{ fontSize: 18, lineHeight: 1 }}>{nextMilestone.emoji}</span>
          <div>
            <p style={{ fontSize: 12.5, color: "rgba(26,23,16,0.55)", lineHeight: 1.4 }}>
              Next milestone: <strong style={{ color: "rgb(26,23,16)" }}>{fmtShort(nextMilestone.amount)}</strong>
              {"  "}
              <span style={{ color: "rgba(26,23,16,0.38)" }}>· {fmtShort(nextMilestone.amount - totalValue)} away</span>
            </p>
          </div>
        </div>
      )}

      {/* Empty state footer */}
      {totalValue === 0 && (
        <div style={{ padding: "12px 20px 16px", borderTop: "1px solid rgba(26,23,16,0.07)" }}>
          <p style={{ fontFamily: "Georgia, serif", fontSize: 12.5, color: "rgba(26,23,16,0.42)", fontStyle: "italic", lineHeight: 1.5 }}>
            The first gift writes the first line of {name}'s story.
          </p>
        </div>
      )}
    </div>
  );
}
