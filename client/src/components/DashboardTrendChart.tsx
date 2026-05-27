import { useState, useCallback, useRef } from "react";
import { Area, AreaChart, CartesianGrid, XAxis, YAxis } from "recharts";
import { ChartContainer, ChartTooltip } from "@/components/ui/chart";
import { trendYDomain } from "@/lib/trend-domain";

export type DashboardTrendPoint = {
  label: string;
  value: number;
  // Principal basis at this point — invested amount at the time of the
  // snapshot. Optional because the chart sometimes renders synthetic
  // "gift estimate" rows where principal == value. Consumers (the hero
  // scrub) compute gain = value - principal when present.
  principal?: number;
  event?: { label: string; detail: string };
};

function formatCurrency(value: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
}

type TooltipState = { x: number; y: number; label: string; detail: string } | null;

function HoverTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  const value = Number(payload[0]?.value ?? 0);
  const principal = Number(payload[0]?.payload?.principal ?? 0);
  const growth = value - principal;
  // Show the contributed/growth split whenever there's any contributed
  // money to split. Earlier this gated on `Math.abs(growth) >= 0.01` and
  // hid the breakdown on flat days — which read as "the tooltip is stuck"
  // when the parent hovered across a stretch of identical snapshots,
  // because the date kept moving but the number stayed put with no
  // explanation. Always-on breakdown lets the parent see "this is the
  // contribution, this is the market change" at every point — even when
  // the market change happens to be $0 today.
  const showBreakdown = principal > 0;

  return (
    <div style={{
      background: "hsl(var(--foreground))",
      color: "hsl(var(--background))",
      borderRadius: 10,
      padding: "7px 12px",
      boxShadow: "0 2px 14px rgba(0,0,0,0.18)",
      pointerEvents: "none",
      whiteSpace: "nowrap",
      minWidth: showBreakdown ? 152 : undefined,
    }}>
      {/* Date as the leading kicker — it ALWAYS changes per-hover-point,
          so leading with it (instead of the value) makes the tooltip feel
          alive even when consecutive snapshots happen to share the same
          dollar amount. */}
      <div style={{ fontSize: 9.5, opacity: 0.55, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 2 }}>
        {label}
      </div>
      <div style={{ fontSize: 13, fontWeight: 700, letterSpacing: "-0.01em", lineHeight: 1.2 }}>
        {formatCurrency(value)}
      </div>
      {showBreakdown && (
        <>
          <div style={{ height: 1, background: "currentColor", opacity: 0.1, margin: "6px 0 5px" }} />
          <div style={{ display: "flex", justifyContent: "space-between", gap: 14 }}>
            <span style={{ fontSize: 10, opacity: 0.52 }}>Contributed</span>
            <span style={{ fontSize: 10, fontWeight: 600 }}>{formatCurrency(principal)}</span>
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", gap: 14, marginTop: 3 }}>
            <span style={{ fontSize: 10, opacity: 0.52 }}>Market change</span>
            <span style={{ fontSize: 10, fontWeight: 600, color: Math.abs(growth) < 0.01 ? "currentColor" : (growth > 0 ? "hsl(143, 64%, 58%)" : "hsl(0, 70%, 62%)") }}>
              {Math.abs(growth) < 0.01 ? formatCurrency(0) : `${growth > 0 ? "+" : ""}${formatCurrency(growth)}`}
            </span>
          </div>
        </>
      )}
    </div>
  );
}

export default function DashboardTrendChart({
  data,
  onScrub,
}: {
  data: DashboardTrendPoint[];
  // Fires whenever the user is actively scrubbing the chart (hover on
  // desktop, finger drag on mobile). Hero consumes this to swap its
  // "Today / live balance" surface for the scrubbed date / scrubbed
  // value while the gesture is held, then snaps back when released
  // (callback fires with `null`). Keep the contract narrow — the chart
  // doesn't know what the hero does with the point, only that the
  // gesture is happening.
  onScrub?: (point: DashboardTrendPoint | null) => void;
}) {
  const [tooltip, setTooltip] = useState<TooltipState>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const dismissTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Holds the most recent point we've reported to the parent. Lets us
  // skip duplicate emissions (Recharts fires onMouseMove on every
  // sub-pixel mouse change, but the active point only changes at
  // category boundaries) which would cause unnecessary hero re-renders.
  const lastEmittedRef = useRef<string | null>(null);
  // Touch-release timer. Mobile users tap-and-drag, then lift. We hold
  // the scrub state for ~500ms after lift so they can read the value
  // before the hero snaps back to "Today". Desktop releases instantly
  // on mouse-leave because the cursor crossing the chart edge is an
  // unambiguous "I'm done" signal.
  const scrubReleaseTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const emitScrub = useCallback((point: DashboardTrendPoint | null) => {
    if (!onScrub) return;
    const key = point ? `${point.label}|${point.value}` : null;
    if (key === lastEmittedRef.current) return;
    lastEmittedRef.current = key;
    onScrub(point);
  }, [onScrub]);

  const releaseScrub = useCallback((delayMs: number = 0) => {
    if (scrubReleaseTimer.current) {
      clearTimeout(scrubReleaseTimer.current);
      scrubReleaseTimer.current = null;
    }
    if (delayMs <= 0) {
      emitScrub(null);
      return;
    }
    scrubReleaseTimer.current = setTimeout(() => {
      emitScrub(null);
      scrubReleaseTimer.current = null;
    }, delayMs);
  }, [emitScrub]);

  // Recharts' chart event payload shape: { activePayload?: [{ payload: T }], activeLabel?: string }.
  // We only care about the first activePayload's `payload` — that's the
  // full row from `data` at the cursor's category. Cancel any pending
  // release timer so a re-enter mid-debounce doesn't snap the hero back
  // mid-drag.
  const handleChartMove = useCallback((state: any) => {
    if (scrubReleaseTimer.current) {
      clearTimeout(scrubReleaseTimer.current);
      scrubReleaseTimer.current = null;
    }
    const payload = state?.activePayload?.[0]?.payload as DashboardTrendPoint | undefined;
    if (payload) emitScrub(payload);
  }, [emitScrub]);

  const getPos = (clientX: number, clientY: number) => {
    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) return { x: 0, y: 0 };
    return { x: clientX - rect.left, y: clientY - rect.top };
  };

  const renderDot = useCallback((props: any) => {
    const { cx, cy, payload, index } = props;
    if (!payload?.event) return <g key={`dot-empty-${index}`} />;
    const ev = payload.event as { label: string; detail: string };

    const show = (clientX: number, clientY: number) => {
      if (dismissTimer.current) clearTimeout(dismissTimer.current);
      const pos = getPos(clientX, clientY);
      setTooltip({ ...pos, label: ev.label, detail: ev.detail });
    };

    const hide = () => setTooltip(null);

    return (
      <g key={`dot-event-${index}`}>
        {/* visible dot */}
        <circle
          cx={cx} cy={cy} r={5}
          fill="white"
          stroke="hsl(143, 64%, 41%)"
          strokeWidth={2.5}
          style={{ pointerEvents: "none" }}
        />
        {/* large invisible hit area */}
        <circle
          cx={cx} cy={cy} r={18}
          fill="transparent"
          style={{ cursor: "default", pointerEvents: "all" }}
          onMouseEnter={(e) => show(e.clientX, e.clientY)}
          onMouseMove={(e) => show(e.clientX, e.clientY)}
          onMouseLeave={hide}
          onTouchStart={(e) => {
            e.preventDefault();
            const t = e.touches[0];
            show(t.clientX, t.clientY);
            dismissTimer.current = setTimeout(hide, 2200);
          }}
          onTouchEnd={() => {
            dismissTimer.current = setTimeout(hide, 2200);
          }}
        />
      </g>
    );
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div
      className="relative touch-pan-y"
      ref={containerRef}
      onMouseLeave={() => {
        setTooltip(null);
        // Desktop: cursor left the chart entirely. Release immediately.
        releaseScrub(0);
      }}
      // Touch end on the container is the definitive "finger lifted"
      // signal — Recharts' own onTouchEnd passes through here too. Hold
      // the scrub for half a second so the user can read the value at
      // the point they lifted, then snap back to live.
      onTouchEnd={() => releaseScrub(500)}
      onTouchCancel={() => releaseScrub(0)}
    >
      <ChartContainer
        className="h-[180px] w-full px-1"
        config={{
          value: { label: "Value", color: "hsl(143, 64%, 41%)" },
        }}
      >
        <AreaChart
          data={data}
          margin={{ top: 8, right: 4, left: 4, bottom: 0 }}
          onMouseMove={handleChartMove}
          onMouseLeave={() => releaseScrub(0)}
          onTouchMove={handleChartMove}
          onTouchStart={handleChartMove}
        >
          <defs>
            <linearGradient id="greenGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="hsl(143, 64%, 41%)" stopOpacity={0.2} />
              <stop offset="95%" stopColor="hsl(143, 64%, 41%)" stopOpacity={0.02} />
            </linearGradient>
          </defs>
          <CartesianGrid vertical={false} strokeDasharray="3 3" stroke="hsl(var(--border))" strokeOpacity={0.5} />
          <XAxis dataKey="label" tickLine={false} axisLine={false} minTickGap={28} tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} />
          <YAxis
            hide
            // Auto-scale per window so short, low-variance ranges (1W/1M/YTD)
            // fill the chart instead of pinning flat at the top of a zero-based
            // axis. Shared with the live-dot math so they can't drift.
            domain={trendYDomain}
          />
          <ChartTooltip
            content={<HoverTooltip />}
            cursor={{ stroke: "hsl(143, 64%, 41%)", strokeWidth: 1, strokeOpacity: 0.3, strokeDasharray: "4 3" }}
          />
          <Area
            type="monotone"
            dataKey="value"
            // Fill from the window's low (not 0) so the gradient fades within
            // the visible band on auto-scaled short windows instead of mapping
            // its 5%→95% fade over an off-screen $0 baseline (which renders as
            // a flat solid wash). For long windows dataMin ≈ 0, so unchanged.
            baseValue="dataMin"
            stroke="hsl(143, 64%, 41%)"
            fill="url(#greenGradient)"
            strokeWidth={2.5}
            dot={renderDot}
            activeDot={{ r: 4, fill: "hsl(143, 64%, 41%)" }}
          />
        </AreaChart>
      </ChartContainer>

      {tooltip && (
        <div
          style={{
            position: "absolute",
            left: tooltip.x,
            top: tooltip.y,
            transform: "translateX(-50%) translateY(calc(-100% - 14px))",
            zIndex: 20,
            pointerEvents: "none",
            transition: "left 0.05s linear, top 0.05s linear",
            willChange: "left, top",
          }}
        >
          <div
            style={{
              background: "hsl(var(--foreground))",
              color: "hsl(var(--background))",
              borderRadius: 12,
              padding: "5px 10px",
              whiteSpace: "nowrap",
              fontSize: "10.5px",
              lineHeight: "1.4",
              boxShadow: "0 2px 10px rgba(0,0,0,0.22)",
            }}
          >
            <div style={{ fontWeight: 700 }}>{tooltip.label}</div>
            {tooltip.detail && (
              <div style={{ opacity: 0.65, fontSize: 10 }}>{tooltip.detail}</div>
            )}
          </div>
          <div
            style={{
              position: "absolute",
              bottom: -4,
              left: "50%",
              transform: "translateX(-50%)",
              width: 8,
              height: 4,
              background: "hsl(var(--foreground))",
              clipPath: "polygon(0 0, 100% 0, 50% 100%)",
            }}
          />
        </div>
      )}
    </div>
  );
}
