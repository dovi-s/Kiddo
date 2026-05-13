import { useRef, useState, useLayoutEffect } from "react";
import type { Holding } from "@shared/schema";
import { StockLogo } from "@/components/ui/stock-logo";
import { haptic } from "@/lib/haptics";

interface BubbleData {
  id: string;
  ticker?: string;
  name: string;
  value: number;
  costBasis: number;
  r: number;
  x: number;
  y: number;
  isCash: boolean;
  holding?: Holding;
}

export interface BubblePortfolioProps {
  holdings: Holding[];
  cashBalance: number;
  recipientFirstName?: string;
  onSelectHolding: (h: Holding) => void;
  onInvestCash: () => void;
}

const HEIGHT = 310;
const MIN_R = 20;
const MAX_R = 88;
const GAP = 7;
const EDGE_PAD = 12;

function findPosition(
  placed: { x: number; y: number; r: number }[],
  r: number,
  w: number,
  h: number,
): { x: number; y: number } {
  const cx = w / 2;
  const cy = h / 2;

  for (let dist = 0; dist <= Math.max(w, h); dist += 3) {
    const steps = dist === 0 ? 1 : Math.max(16, Math.round((2 * Math.PI * dist) / 5));
    for (let i = 0; i < steps; i++) {
      const angle = dist === 0 ? 0 : (i / steps) * 2 * Math.PI - Math.PI / 2;
      const x = cx + dist * Math.cos(angle);
      const y = cy + dist * Math.sin(angle);

      if (x - r < EDGE_PAD || x + r > w - EDGE_PAD || y - r < EDGE_PAD || y + r > h - EDGE_PAD) continue;

      const clear = placed.every((p) => {
        const dx = p.x - x;
        const dy = p.y - y;
        return Math.sqrt(dx * dx + dy * dy) >= p.r + r + GAP;
      });

      if (clear) return { x, y };
    }
  }
  return { x: cx, y: cy };
}

const fmt = (v: number) =>
  new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(v);

export function BubblePortfolio({
  holdings,
  cashBalance,
  recipientFirstName,
  onSelectHolding,
  onInvestCash,
}: BubblePortfolioProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [bubbles, setBubbles] = useState<BubbleData[]>([]);
  const [containerW, setContainerW] = useState(0);
  const [hovered, setHovered] = useState<string | null>(null);

  useLayoutEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    function compute() {
      const w = el!.clientWidth;
      if (w < 20) return;
      setContainerW(w);

      const items: Omit<BubbleData, "r" | "x" | "y">[] = [
        ...holdings.map((h) => ({
          id: h.id,
          ticker: h.ticker,
          name: h.name || h.ticker || "ETF",
          value: parseFloat(h.currentValue || "0"),
          costBasis: parseFloat(h.costBasis || "0"),
          isCash: false,
          holding: h,
        })),
      ];

      if (cashBalance > 0.5) {
        items.push({
          id: "cash",
          name: "Cash",
          value: cashBalance,
          costBasis: cashBalance,
          isCash: true,
        });
      }

      // Sort largest first so biggest gets prime center position
      items.sort((a, b) => b.value - a.value);

      const total = items.reduce((s, i) => s + i.value, 0);
      if (total === 0) { setBubbles([]); return; }

      const maxR = Math.min(MAX_R, w * 0.33);
      const maxRawSqrt = Math.sqrt(items[0].value / total);

      const placed: { x: number; y: number; r: number }[] = [];
      const result: BubbleData[] = [];

      for (const item of items) {
        const rawSqrt = Math.sqrt(item.value / total);
        const r = Math.max(MIN_R, (rawSqrt / maxRawSqrt) * maxR);
        const pos = findPosition(placed, r, w, HEIGHT);
        placed.push({ x: pos.x, y: pos.y, r });
        result.push({ ...item, r, x: pos.x, y: pos.y });
      }

      setBubbles(result);
    }

    compute();
    const ro = new ResizeObserver(compute);
    ro.observe(el);
    return () => ro.disconnect();
  }, [holdings, cashBalance]);

  if (holdings.length === 0 && cashBalance < 0.5) return null;

  return (
    <div
      ref={containerRef}
      style={{ position: "relative", height: HEIGHT, overflow: "visible", userSelect: "none" }}
    >
      {/* SVG layer: pointer lines for small outside-label bubbles */}
      {containerW > 0 && (
        <svg
          style={{
            position: "absolute",
            inset: 0,
            width: containerW,
            height: HEIGHT,
            pointerEvents: "none",
            overflow: "visible",
          }}
          viewBox={`0 0 ${containerW} ${HEIGHT}`}
        >
          {bubbles.map((b) => {
            if (b.r >= 36) return null;
            const isRight = b.x >= containerW / 2;
            const x1 = isRight ? b.x + b.r * 0.75 : b.x - b.r * 0.75;
            const x2 = isRight ? b.x + b.r + 6 : b.x - b.r - 6;
            return (
              <line
                key={b.id + "-line"}
                x1={x1}
                y1={b.y}
                x2={x2}
                y2={b.y}
                stroke="rgba(26,23,16,0.18)"
                strokeWidth={1.2}
                strokeDasharray="2.5 2"
              />
            );
          })}
        </svg>
      )}

      {/* Bubble buttons */}
      {bubbles.map((b) => {
        const isHovered = hovered === b.id;
        const isLarge = b.r >= 52;
        const isMed = b.r >= 36 && b.r < 52;
        const logoSize = isLarge
          ? Math.round(b.r * 0.52)
          : isMed
          ? Math.round(b.r * 0.58)
          : Math.round(b.r * 0.72);

        const gain = b.value - b.costBasis;
        const gainPct = b.costBasis > 0 && !b.isCash ? (gain / b.costBasis) * 100 : 0;
        const gainPositive = gain >= 0;

        return (
          <button
            key={b.id}
            type="button"
            onMouseEnter={() => setHovered(b.id)}
            onMouseLeave={() => setHovered(null)}
            onClick={() => {
              haptic("selection");
              if (b.isCash) onInvestCash();
              else if (b.holding) onSelectHolding(b.holding);
            }}
            aria-label={b.name}
            style={{
              position: "absolute",
              left: b.x - b.r,
              top: b.y - b.r,
              width: b.r * 2,
              height: b.r * 2,
              borderRadius: "50%",
              border: b.isCash
                ? "2px dashed rgba(184,121,26,0.55)"
                : `1.5px solid ${isHovered ? "rgba(26,61,43,0.35)" : "rgba(26,61,43,0.14)"}`,
              background: b.isCash
                ? isHovered
                  ? "rgb(255,244,218)"
                  : "rgb(255,249,234)"
                : isHovered
                ? "linear-gradient(140deg, rgb(228,244,232) 0%, rgb(205,236,212) 100%)"
                : "linear-gradient(140deg, rgb(238,248,241) 0%, rgb(218,240,224) 100%)",
              cursor: "pointer",
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              gap: isLarge ? 3 : 1,
              padding: 4,
              transform: isHovered ? "scale(1.07)" : "scale(1)",
              transition: "transform 0.16s ease, box-shadow 0.16s ease, background 0.16s ease",
              boxShadow: isHovered
                ? b.isCash
                  ? "0 10px 28px rgba(184,121,26,0.22)"
                  : "0 10px 28px rgba(26,61,43,0.18)"
                : b.isCash
                ? "0 2px 10px rgba(184,121,26,0.1)"
                : "0 2px 10px rgba(26,61,43,0.07)",
              zIndex: isHovered ? 10 : 1,
            }}
          >
            {/* Large bubble: logo + ticker + value */}
            {isLarge && (
              <>
                <StockLogo ticker={b.isCash ? undefined : b.ticker} size={logoSize} />
                <span
                  style={{
                    fontSize: Math.max(9, b.r * 0.155),
                    fontWeight: 800,
                    color: b.isCash ? "rgb(140,80,10)" : "rgb(26,61,43)",
                    lineHeight: 1,
                    marginTop: 3,
                    letterSpacing: "-0.01em",
                  }}
                >
                  {b.isCash ? "CASH" : b.ticker}
                </span>
                <span
                  style={{
                    fontSize: Math.max(8, b.r * 0.125),
                    fontWeight: 700,
                    color: b.isCash ? "rgba(184,121,26,0.9)" : "rgba(43,88,64,0.85)",
                    lineHeight: 1,
                  }}
                >
                  {fmt(b.value)}
                </span>
                {!b.isCash && b.costBasis > 0 && (
                  <span
                    style={{
                      fontSize: Math.max(7, b.r * 0.1),
                      fontWeight: 600,
                      color: gainPositive ? "rgb(22,130,64)" : "rgb(200,50,50)",
                      lineHeight: 1,
                      marginTop: 1,
                    }}
                  >
                    {gainPositive ? "+" : ""}
                    {gainPct.toFixed(1)}%
                  </span>
                )}
              </>
            )}

            {/* Medium bubble: logo + ticker only */}
            {isMed && (
              <>
                <StockLogo ticker={b.isCash ? undefined : b.ticker} size={logoSize} />
                <span
                  style={{
                    fontSize: Math.max(8, b.r * 0.17),
                    fontWeight: 800,
                    color: b.isCash ? "rgb(140,80,10)" : "rgb(26,61,43)",
                    lineHeight: 1,
                    marginTop: 2,
                  }}
                >
                  {b.isCash ? "CASH" : b.ticker}
                </span>
              </>
            )}

            {/* Small bubble: logo or $ sign */}
            {b.r < 36 && (
              b.isCash ? (
                <span style={{ fontSize: Math.max(10, b.r * 0.5), fontWeight: 800, color: "rgb(184,121,26)" }}>
                  $
                </span>
              ) : (
                <StockLogo ticker={b.ticker} size={Math.min(logoSize, Math.round(b.r * 1.5))} />
              )
            )}
          </button>
        );
      })}

      {/* Outside labels for small bubbles */}
      {bubbles.map((b) => {
        if (b.r >= 36) return null;
        const isRight = b.x >= containerW / 2;
        return (
          <div
            key={b.id + "-label"}
            style={{
              position: "absolute",
              left: isRight ? b.x + b.r + 10 : b.x - b.r - 10,
              top: b.y - 13,
              transform: isRight ? "none" : "translateX(-100%)",
              pointerEvents: "none",
              textAlign: isRight ? "left" : "right",
              whiteSpace: "nowrap",
            }}
          >
            <p
              style={{
                fontSize: 11,
                fontWeight: 800,
                color: b.isCash ? "rgb(140,80,10)" : "rgb(26,23,16)",
                lineHeight: 1.25,
              }}
            >
              {b.isCash ? "Cash" : b.ticker}
            </p>
            <p
              style={{
                fontSize: 10,
                fontWeight: 600,
                color: "rgba(26,23,16,0.48)",
                lineHeight: 1.25,
              }}
            >
              {fmt(b.value)}
            </p>
          </div>
        );
      })}
    </div>
  );
}
