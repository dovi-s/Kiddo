// DESIGN LAB — isolated dashboard-redesign sandbox (2026-06-04, v2).
//
// Route: /design-lab. Self-contained, hardcoded Luke demo numbers, noindex,
// linked from nowhere. Touches NOTHING live. We iterate here; only once it's
// loved does the pattern get ported into the real Dashboard.
//
// v2 craft pass (v1 read prototype-grade): real app fonts (Bricolage
// Grotesque display + DM Sans body), a monumental hero number, a hand-drawn
// growth curve for premium-fintech richness, layered warm depth, real icons,
// and sophisticated on-brand color (not random pastels). Neobank DISCIPLINE,
// our WARM register — never their dark luxury mood.

import { useEffect, useState } from "react";
import { ArrowUpRight, Plus, ChevronRight, Share2, BookOpen, Users, TrendingUp } from "lucide-react";
import { useCountUp } from "@/hooks/use-count-up";
import { usePageSeo } from "@/lib/seo";

// ── Fonts: the #1 fix. v1 used `inherit`; the display font is the brand. ──
const FONT_BODY = "'DM Sans', system-ui, -apple-system, sans-serif";
const FONT_DISPLAY = "'Bricolage Grotesque', 'DM Sans', system-ui, sans-serif";

// ── T: the token scale (the system) — exact --kiddo-* values. ──
const T = {
  space: { xs: 4, sm: 8, md: 16, lg: 24, xl: 32, xxl: 48 },
  radius: { card: 26, tile: 18, pill: 999 },
  c: {
    cream: "#F8F5F0",
    creamDark: "#EDE7DC",
    card: "#FFFFFF",
    ink: "#1A1710",
    inkSoft: "rgba(26,23,16,0.56)",
    inkFaint: "rgba(26,23,16,0.40)",
    evergreen: "#1B3A2D",
    evergreenDeep: "#0E2518",
    evergreenBright: "#2E6B4A",
    evergreenTint: "rgba(27,58,45,0.06)",
    gold: "#C5821E",
    goldLight: "#EDC164",
    goldInk: "#6F4611",
    border: "#E5DDD4",
    creamOnDark: "#F8F5F0",
  },
  // Layered warm depth — ambient + contact, tinted to ink, never pure black.
  shadow: {
    soft: "0 1px 2px rgba(26,23,16,0.04), 0 4px 16px rgba(26,23,16,0.05)",
    card: "0 1px 2px rgba(26,23,16,0.05), 0 10px 30px rgba(26,23,16,0.07)",
    hero: "0 2px 4px rgba(26,23,16,0.06), 0 30px 70px rgba(14,37,24,0.18)",
  },
};

const LUKE = {
  name: "Luke",
  balance: 22743.39,
  balanceSeed: 22743.39 * 0.991,
  monthPct: 2.1,
  projectionAt21: 49828,
  projectionAge: 21,
  giftsTotal: 4090,
  giftCount: 134,
  peopleCount: 12,
  strategy: { label: "Growth Mix", emoji: "📈" },
  loves: [
    { initials: "MD", name: "Manny", when: "Jun 2" },
    { initials: "CD", name: "Mom", when: "Dec 4" },
    { initials: "CT", name: "Cam", when: "Nov 20" },
    { initials: "GP", name: "Gloria", when: "Nov 12" },
    { initials: "MP", name: "Mitch", when: "Nov 6", star: true },
    { initials: "JP", name: "Jay", when: "Dec 22" },
  ],
  memory: { quote: "Because magic is always a good investment.", author: "Cam" },
};

const fmtUSD0 = (n: number) =>
  n.toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });

// On-brand avatar tints rotated from OUR palette (not random pastels).
const AVATAR_TINTS = [
  ["#E9F0EA", "#1B3A2D"],
  ["#F5E9D2", "#6F4611"],
  ["#EDE7DC", "#1A1710"],
  ["#E3EDE6", "#1B3A2D"],
] as const;

// ── BRICKS ──────────────────────────────────────────────────────────────────

function Eyebrow({ children, color = T.c.inkFaint }: { children: React.ReactNode; color?: string }) {
  return (
    <p style={{ fontFamily: FONT_BODY, fontSize: 11, fontWeight: 700, letterSpacing: "0.09em", textTransform: "uppercase", color, margin: 0 }}>
      {children}
    </p>
  );
}

// The premium-fintech richness move: a soft growth curve. Hand-drawn smooth
// path, evergreen area fading to nothing, a gold node at today.
function GrowthCurve() {
  return (
    <svg viewBox="0 0 320 86" width="100%" height="64" preserveAspectRatio="none" style={{ display: "block" }} aria-hidden>
      <defs>
        <linearGradient id="lab-area" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={T.c.evergreenBright} stopOpacity="0.22" />
          <stop offset="100%" stopColor={T.c.evergreenBright} stopOpacity="0" />
        </linearGradient>
      </defs>
      <path
        d="M0,72 C40,68 64,60 96,54 C128,48 150,46 184,36 C216,27 248,26 288,12 L288,12"
        fill="none" stroke={T.c.evergreen} strokeWidth="2.5" strokeLinecap="round"
      />
      <path
        d="M0,72 C40,68 64,60 96,54 C128,48 150,46 184,36 C216,27 248,26 288,12 L320,86 L0,86 Z"
        fill="url(#lab-area)"
      />
      <circle cx="288" cy="12" r="4.5" fill={T.c.gold} stroke={T.c.card} strokeWidth="2" />
    </svg>
  );
}

function StatTile({ label, value, sub, accent }: { label: string; value: string; sub?: string; accent?: string }) {
  return (
    <div style={{ background: T.c.card, borderRadius: T.radius.tile, padding: T.space.md, boxShadow: T.shadow.soft, border: `1px solid ${T.c.border}` }}>
      <Eyebrow>{label}</Eyebrow>
      <p style={{ fontFamily: FONT_DISPLAY, fontSize: 22, fontWeight: 700, letterSpacing: "-0.01em", color: accent || T.c.ink, margin: `${T.space.xs}px 0 0`, fontVariantNumeric: "tabular-nums" }}>{value}</p>
      {sub && <p style={{ fontFamily: FONT_BODY, fontSize: 12, color: T.c.inkFaint, margin: "2px 0 0" }}>{sub}</p>}
    </div>
  );
}

function PersonAvatar({ p, i }: { p: typeof LUKE.loves[number]; i: number }) {
  const [bg, fg] = AVATAR_TINTS[i % AVATAR_TINTS.length];
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 5, width: 58 }}>
      <div style={{ position: "relative" }}>
        <div
          style={{
            width: 50, height: 50, borderRadius: T.radius.pill,
            background: `linear-gradient(160deg, ${bg} 0%, #FFFFFF 130%)`,
            display: "flex", alignItems: "center", justifyContent: "center",
            color: fg, fontFamily: FONT_DISPLAY, fontSize: 15, fontWeight: 700,
            boxShadow: T.shadow.soft, border: `2px solid ${T.c.card}`,
          }}
        >
          {p.initials}
        </div>
        {p.star && <span style={{ position: "absolute", top: -3, right: -3, fontSize: 13 }}>⭐</span>}
      </div>
      <span style={{ fontFamily: FONT_BODY, fontSize: 11.5, fontWeight: 600, color: T.c.ink }}>{p.name}</span>
    </div>
  );
}

// ── THE PAGE ─────────────────────────────────────────────────────────────────

export default function DesignLab() {
  usePageSeo({ title: "Design Lab | Kiddo", description: "Internal redesign sandbox.", robots: "noindex,nofollow", ogType: "website" });

  const [seed, setSeed] = useState(LUKE.balanceSeed);
  useEffect(() => { const t = setTimeout(() => setSeed(LUKE.balance), 80); return () => clearTimeout(t); }, []);
  const { value: rolled } = useCountUp({ from: LUKE.balanceSeed, to: seed, duration: 1300, precision: 0 });
  const { value: projRolled } = useCountUp({ from: 0, to: LUKE.projectionAt21, duration: 1500, precision: 0 });

  return (
    <div style={{ minHeight: "100vh", background: T.c.cream, fontFamily: FONT_BODY, color: T.c.ink }}>
      <div style={{ background: T.c.evergreenDeep, color: T.c.creamOnDark, textAlign: "center", fontSize: 11, fontWeight: 600, padding: "6px 12px", opacity: 0.92 }}>
        Design Lab · sandbox with hardcoded demo numbers. Nothing here touches the real app.
      </div>

      <div style={{ maxWidth: 440, margin: "0 auto", padding: `0 ${T.space.md}px ${T.space.xxl}px` }}>

        {/* ── HEADER ZONE — deep evergreen with a warm radial glow, rounded
              bottom. The hero card will float UP out of it (the bridge). ── */}
        <div
          style={{
            margin: `0 -${T.space.md}px`,
            padding: `${T.space.xl}px ${T.space.lg}px ${T.space.xxl + 28}px`,
            background: `radial-gradient(120% 120% at 85% -10%, rgba(237,193,100,0.18) 0%, rgba(237,193,100,0) 45%), linear-gradient(168deg, ${T.c.evergreen} 0%, ${T.c.evergreenDeep} 115%)`,
            borderBottomLeftRadius: 34, borderBottomRightRadius: 34,
          }}
        >
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <div>
              <Eyebrow color="rgba(248,245,240,0.55)">{LUKE.name}'s fund</Eyebrow>
              <p style={{ fontFamily: FONT_DISPLAY, fontSize: 21, fontWeight: 700, letterSpacing: "-0.01em", color: T.c.creamOnDark, margin: "5px 0 0" }}>Hey, Phil</p>
            </div>
            <div style={{ width: 42, height: 42, borderRadius: T.radius.pill, background: "rgba(248,245,240,0.16)", border: "1.5px solid rgba(248,245,240,0.25)", display: "flex", alignItems: "center", justifyContent: "center", color: T.c.creamOnDark, fontFamily: FONT_DISPLAY, fontWeight: 700, fontSize: 16 }}>P</div>
          </div>
        </div>

        {/* ── FLOATING HERO CARD — the one star. Overlaps up into the header. ── */}
        <div
          style={{
            marginTop: -56, background: T.c.card, borderRadius: T.radius.card,
            padding: `${T.space.lg}px ${T.space.lg}px ${T.space.lg}px`,
            boxShadow: T.shadow.hero, border: "1px solid rgba(255,255,255,0.8)", position: "relative",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <Eyebrow>{LUKE.strategy.emoji} {LUKE.strategy.label}</Eyebrow>
            <span style={{ display: "inline-flex", alignItems: "center", gap: 3, background: T.c.evergreenTint, color: T.c.evergreen, fontFamily: FONT_BODY, fontSize: 12, fontWeight: 700, padding: "3px 9px", borderRadius: T.radius.pill }}>
              <TrendingUp size={12} strokeWidth={2.5} /> {LUKE.monthPct}% this month
            </span>
          </div>

          {/* HERO tier — monumental, display font, tabular. The king. */}
          <p style={{ fontFamily: FONT_DISPLAY, fontSize: 60, fontWeight: 700, letterSpacing: "-0.025em", lineHeight: 1.02, color: T.c.ink, margin: `${T.space.sm}px 0 0`, fontVariantNumeric: "tabular-nums" }}>
            {fmtUSD0(rolled)}
          </p>

          {/* premium richness — the growth curve */}
          <div style={{ margin: `${T.space.sm}px -${T.space.xs}px ${T.space.sm}px` }}><GrowthCurve /></div>

          {/* the emotional duality — what it's BECOMING, not net worth */}
          <div style={{ display: "flex", alignItems: "center", gap: T.space.sm, padding: `${T.space.sm}px ${T.space.md}px`, background: T.c.evergreenTint, borderRadius: T.radius.tile }}>
            <span style={{ fontSize: 17 }}>🌱</span>
            <p style={{ fontFamily: FONT_BODY, fontSize: 13.5, color: T.c.evergreen, margin: 0, fontWeight: 500 }}>
              On track for <span style={{ fontFamily: FONT_DISPLAY, fontWeight: 700, fontVariantNumeric: "tabular-nums" }}>{fmtUSD0(projRolled)}</span> when {LUKE.name} turns {LUKE.projectionAge}
            </p>
          </div>

          {/* CONTROL tier — one primary, one quiet secondary */}
          <div style={{ marginTop: T.space.lg, display: "flex", gap: T.space.sm }}>
            <button type="button" style={{ flex: 1, height: 52, borderRadius: T.radius.tile, background: T.c.evergreen, color: T.c.creamOnDark, border: "none", cursor: "pointer", fontFamily: FONT_BODY, fontSize: 14.5, fontWeight: 700, display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 7, boxShadow: T.shadow.soft }}>
              <Share2 size={16} strokeWidth={2.4} /> Share {LUKE.name}'s link
            </button>
            <button type="button" style={{ width: 52, height: 52, borderRadius: T.radius.tile, background: T.c.cream, border: `1px solid ${T.c.border}`, cursor: "pointer", color: T.c.ink, display: "inline-flex", alignItems: "center", justifyContent: "center" }} aria-label="Add a gift">
              <Plus size={20} strokeWidth={2.4} />
            </button>
          </div>
        </div>

        {/* ── WHO LOVES — promoted to a HERO MOMENT. Faces a bank can't have. ── */}
        <div style={{ marginTop: T.space.xl }}>
          <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
            <Users size={17} strokeWidth={2.2} color={T.c.evergreen} />
            <p style={{ fontFamily: FONT_DISPLAY, fontSize: 18, fontWeight: 700, letterSpacing: "-0.01em", color: T.c.ink, margin: 0 }}>
              {LUKE.peopleCount} people are building this with you
            </p>
          </div>
          <p style={{ fontFamily: FONT_BODY, fontSize: 13.5, color: T.c.inkSoft, margin: `6px 0 ${T.space.md}px` }}>
            {fmtUSD0(LUKE.giftsTotal)} gifted to {LUKE.name}, across {LUKE.giftCount} moments.
          </p>
          <div style={{ display: "flex", gap: T.space.sm, overflowX: "auto", paddingBottom: 4 }}>
            {LUKE.loves.map((p, i) => <PersonAvatar key={p.initials} p={p} i={i} />)}
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 5, width: 58 }}>
              <div style={{ width: 50, height: 50, borderRadius: T.radius.pill, background: T.c.creamDark, display: "flex", alignItems: "center", justifyContent: "center", color: T.c.inkSoft, fontFamily: FONT_DISPLAY, fontSize: 13, fontWeight: 700, border: `2px solid ${T.c.card}` }}>+6</div>
              <span style={{ fontFamily: FONT_BODY, fontSize: 11.5, fontWeight: 600, color: T.c.inkSoft }}>more</span>
            </div>
          </div>
        </div>

        {/* ── MEMORY BOOK beat — our soul, surfaced. ── */}
        <div style={{ marginTop: T.space.xl, background: T.c.card, borderRadius: T.radius.card, padding: `${T.space.lg}px`, boxShadow: T.shadow.card, border: `1px solid ${T.c.border}`, position: "relative", overflow: "hidden" }}>
          <div style={{ position: "absolute", left: 0, top: 0, bottom: 0, width: 3, background: T.c.gold }} />
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <BookOpen size={14} strokeWidth={2.2} color={T.c.gold} />
            <Eyebrow color={T.c.goldInk}>From the Memory Book</Eyebrow>
          </div>
          <p style={{ fontFamily: FONT_DISPLAY, fontSize: 19, fontWeight: 600, color: T.c.ink, fontStyle: "italic", margin: `${T.space.sm}px 0 0`, lineHeight: 1.4, letterSpacing: "-0.01em" }}>
            "{LUKE.memory.quote}"
          </p>
          <p style={{ fontFamily: FONT_BODY, fontSize: 13, color: T.c.inkFaint, margin: `${T.space.sm}px 0 0` }}>
            {LUKE.memory.author} · {LUKE.name} reads this at {LUKE.projectionAge}
          </p>
        </div>

        {/* ── INFO tier — two quiet tiles. ── */}
        <div style={{ marginTop: T.space.xl, display: "grid", gridTemplateColumns: "1fr 1fr", gap: T.space.md }}>
          <StatTile label="Your recurring" value="$100/mo" sub="next Jun 18" />
          <StatTile label="Market growth" value="+$9,603" sub="all-time" accent={T.c.evergreen} />
        </div>

        {/* ── DEMOTED entry points — quiet rows, not full sections. The cull. ── */}
        <div style={{ marginTop: T.space.md, background: T.c.card, borderRadius: T.radius.card, boxShadow: T.shadow.soft, border: `1px solid ${T.c.border}`, overflow: "hidden" }}>
          {[
            { label: `What ${LUKE.name} owns`, meta: "9 holdings" },
            { label: `${LUKE.name}'s occasions`, meta: "Birthday Nov 4" },
            { label: `The day it becomes ${LUKE.name}'s`, meta: "Nov 4, 2033" },
          ].map((row, i) => (
            <div key={row.label} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: `15px ${T.space.md}px`, borderTop: i === 0 ? "none" : `1px solid ${T.c.border}`, cursor: "pointer" }}>
              <span style={{ fontFamily: FONT_BODY, fontSize: 14.5, color: T.c.ink, fontWeight: 600 }}>{row.label}</span>
              <span style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <span style={{ fontFamily: FONT_BODY, fontSize: 12.5, color: T.c.inkFaint }}>{row.meta}</span>
                <ChevronRight size={17} color={T.c.inkFaint} />
              </span>
            </div>
          ))}
        </div>

        <p style={{ textAlign: "center", marginTop: T.space.xl, fontFamily: FONT_BODY, fontSize: 11, color: T.c.inkFaint, display: "inline-flex", width: "100%", justifyContent: "center", alignItems: "center", gap: 5 }}>
          <ArrowUpRight size={12} /> warm depth · one hero · faces · memory. Our register, not the bank's.
        </p>
      </div>
    </div>
  );
}
