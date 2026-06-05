// DESIGN LAB — isolated sandbox for the dashboard redesign (2026-06-04).
//
// Route: /design-lab. Linked from nowhere, noindex. Renders a redesigned
// "hero dashboard" with the real Luke demo numbers HARDCODED so it is 100%
// self-contained — no auth, no API, no shared state. It cannot break or even
// touch anything in the live app. View it, we iterate here freely, and ONLY
// once it's loved do we port the pattern into the real Dashboard.
//
// What it demonstrates (the neobank discipline, in OUR warm/light register —
// never their dark luxury mood):
//   1. SYSTEM BEFORE SCREENS — a tiny local token scale (T) + a handful of
//      reusable "brick" components (Eyebrow, StatTile, PersonAvatar, …). The
//      screen is assembled from bricks, not hand-cut.
//   2. ONE HERO per screen — the balance roll + "what it's becoming" is the
//      undisputed star; everything else is demoted or behind a tap.
//   3. WARM DEPTH — the hero card FLOATS and OVERLAPS the header zone into the
//      content zone (the one neobank layout trick worth stealing), with soft
//      warm shadows and layered cream→white surfaces. No dark mode.
//   4. THE THINGS A BANK CAN'T HAVE as the emotional payload — the count-up
//      roll, "who loves Luke" faces promoted to a hero moment, and a Memory
//      Book beat. We lead with love compounding, never net worth.
//   5. 4-TIER WEIGHT HIERARCHY (hero / info / control / meta) so nothing
//      drifts to mid-weight and the eye always knows the king.

import { useEffect, useState } from "react";
import { useCountUp } from "@/hooks/use-count-up";
import { usePageSeo } from "@/lib/seo";

// ── T: the local token scale (the "system"). One spacing ramp, one type
// ramp (4 sizes, 2 weights), 2 shadow tiers, one radius, the warm palette. ──
const T = {
  // 8px spacing grid.
  space: { xs: 4, sm: 8, md: 16, lg: 24, xl: 32, xxl: 48 },
  radius: { card: 24, tile: 18, pill: 999 },
  // Warm palette — cream page, white cards, evergreen + gold accents. The
  // values mirror the app's --kiddo-* CSS vars; inlined here so the lab is
  // self-contained.
  c: {
    cream: "#F7F3EC",
    creamDeep: "#EFE7D8",
    card: "#FFFFFF",
    ink: "#1A1710",
    inkSoft: "rgba(26,23,16,0.55)",
    inkFaint: "rgba(26,23,16,0.38)",
    evergreen: "#1A3D2B",
    evergreenBright: "#2B7A4B",
    evergreenTint: "rgba(26,61,43,0.06)",
    gold: "#C79A3A",
    border: "rgba(26,23,16,0.08)",
  },
  // 2 shadow tiers — the warm depth. Tinted to the ink, never pure black.
  shadow: {
    soft: "0 1px 3px rgba(26,23,16,0.06), 0 8px 24px rgba(26,23,16,0.06)",
    hero: "0 2px 6px rgba(26,23,16,0.08), 0 24px 60px rgba(26,23,16,0.14)",
  },
  // 4-size type ramp + 2 weights.
  type: {
    hero: { fontSize: 56, fontWeight: 700, letterSpacing: "-0.02em", lineHeight: 1 },
    title: { fontSize: 22, fontWeight: 700, letterSpacing: "-0.01em" },
    body: { fontSize: 14, fontWeight: 500 },
    label: { fontSize: 11, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase" as const },
  },
};

// ── Real Luke demo data, hardcoded so the lab stands alone ──
const LUKE = {
  name: "Luke",
  balance: 22743.39,
  // seed slightly below so the roll plays on view (the demo under-seed trick)
  balanceSeed: 22743.39 * 0.992,
  projectionAt21: 49828,
  projectionAge: 21,
  giftsTotal: 4090,
  giftCount: 134,
  peopleCount: 12,
  strategy: { label: "Growth Mix", emoji: "📈" },
  // "Who loves Luke" — initials + warm tints + last touch
  loves: [
    { initials: "MD", name: "Manny", when: "Jun 2", tint: "#E4B7C7" },
    { initials: "CD", name: "Mom", when: "Dec 4", tint: "#B7C9E4" },
    { initials: "CT", name: "Cam", when: "Nov 20", tint: "#C7E4B7" },
    { initials: "GP", name: "Gloria", when: "Nov 12", tint: "#E4D3B7" },
    { initials: "MP", name: "Mitchell", when: "Nov 6", tint: "#D3B7E4", star: true },
    { initials: "JP", name: "Jay", when: "Dec 22", tint: "#B7E4DD" },
  ],
  memory: {
    quote: "Because magic is always a good investment.",
    author: "Cam",
  },
};

const fmtUSD0 = (n: number) =>
  n.toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });

// ── BRICKS ──────────────────────────────────────────────────────────────────

// META tier — the smallest text, an uppercase tracked label.
function Eyebrow({ children, color = T.c.inkFaint }: { children: React.ReactNode; color?: string }) {
  return <p style={{ ...T.type.label, color, margin: 0 }}>{children}</p>;
}

// INFO tier — a quiet stat tile.
function StatTile({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div style={{ background: T.c.card, borderRadius: T.radius.tile, padding: T.space.md, boxShadow: T.shadow.soft }}>
      <Eyebrow>{label}</Eyebrow>
      <p style={{ ...T.type.title, color: T.c.ink, margin: `${T.space.xs}px 0 0` }}>{value}</p>
      {sub && <p style={{ ...T.type.body, color: T.c.inkFaint, margin: `2px 0 0`, fontSize: 12 }}>{sub}</p>}
    </div>
  );
}

// INFO tier — a face. The emotional anchor a bank's "Send Again" can't match:
// these are the people who LOVE this child, not transfer shortcuts.
function PersonAvatar({ p }: { p: typeof LUKE.loves[number] }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: T.space.xs, width: 60 }}>
      <div style={{ position: "relative" }}>
        <div
          style={{
            width: 48, height: 48, borderRadius: T.radius.pill, background: p.tint,
            display: "flex", alignItems: "center", justifyContent: "center",
            color: T.c.ink, fontSize: 15, fontWeight: 700, boxShadow: T.shadow.soft,
            border: `2px solid ${T.c.card}`,
          }}
        >
          {p.initials}
        </div>
        {p.star && (
          <span style={{ position: "absolute", top: -2, right: -2, fontSize: 13 }}>⭐</span>
        )}
      </div>
      <span style={{ fontSize: 11.5, fontWeight: 600, color: T.c.ink }}>{p.name}</span>
      <span style={{ fontSize: 10, color: T.c.inkFaint, marginTop: -3 }}>{p.when}</span>
    </div>
  );
}

// CONTROL tier — the one primary action.
function PrimaryButton({ children }: { children: React.ReactNode }) {
  return (
    <button
      type="button"
      style={{
        height: 52, padding: `0 ${T.space.xl}px`, borderRadius: T.radius.tile,
        background: T.c.evergreen, color: "#FFF7E8", border: "none", cursor: "pointer",
        fontSize: 15, fontWeight: 700, boxShadow: T.shadow.soft,
      }}
    >
      {children}
    </button>
  );
}

// ── THE PAGE ─────────────────────────────────────────────────────────────────

export default function DesignLab() {
  usePageSeo({
    title: "Design Lab | Kiddo",
    description: "Internal dashboard redesign sandbox.",
    robots: "noindex,nofollow",
    ogType: "website",
  });

  // Play the roll on view — seed slightly low, climb to the real balance.
  const [seed, setSeed] = useState(LUKE.balanceSeed);
  useEffect(() => {
    const t = setTimeout(() => setSeed(LUKE.balance), 60);
    return () => clearTimeout(t);
  }, []);
  const { value: rolled } = useCountUp({ from: LUKE.balanceSeed, to: seed, duration: 1200, precision: 0 });
  const { value: projRolled } = useCountUp({ from: 0, to: LUKE.projectionAt21, duration: 1400, precision: 0 });

  return (
    <div style={{ minHeight: "100vh", background: T.c.cream, fontFamily: "inherit" }}>
      {/* lab ribbon — so it's never mistaken for the real app */}
      <div style={{ background: T.c.evergreen, color: "#FFF7E8", textAlign: "center", fontSize: 11.5, fontWeight: 600, padding: "6px 12px", letterSpacing: "0.02em" }}>
        Design Lab · a sandbox with hardcoded demo numbers. Nothing here touches the real app.
      </div>

      <div style={{ maxWidth: 460, margin: "0 auto", padding: `0 ${T.space.md}px ${T.space.xxl}px` }}>

        {/* ── HEADER ZONE (warm tint) — the hero card will overlap DOWN out of
              this zone into the cream content below, the "bridge" effect. ── */}
        <div
          style={{
            margin: `0 -${T.space.md}px`,
            padding: `${T.space.xl}px ${T.space.md}px ${T.space.xxl + T.space.xl}px`,
            background: `linear-gradient(165deg, ${T.c.evergreen} 0%, ${T.c.evergreenBright} 120%)`,
            borderBottomLeftRadius: 32, borderBottomRightRadius: 32,
          }}
        >
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <div>
              <Eyebrow color="rgba(255,247,232,0.6)">Luke's fund</Eyebrow>
              <p style={{ ...T.type.title, color: "#FFF7E8", margin: `${T.space.xs}px 0 0` }}>
                Hey, Phil
              </p>
            </div>
            <div style={{ width: 40, height: 40, borderRadius: T.radius.pill, background: "rgba(255,247,232,0.18)", display: "flex", alignItems: "center", justifyContent: "center", color: "#FFF7E8", fontWeight: 700, fontSize: 15 }}>
              P
            </div>
          </div>
        </div>

        {/* ── THE FLOATING HERO CARD — the one star. Pulled UP with a negative
              margin so it overlaps the header/content boundary. ── */}
        <div
          style={{
            marginTop: -(T.space.xxl),
            background: T.c.card,
            borderRadius: T.radius.card,
            padding: `${T.space.lg}px ${T.space.lg}px ${T.space.xl}px`,
            boxShadow: T.shadow.hero,
            position: "relative",
          }}
        >
          <Eyebrow>{LUKE.strategy.emoji} {LUKE.strategy.label} · today</Eyebrow>

          {/* HERO tier — the roll. The undisputed king of the screen. */}
          <p style={{ ...T.type.hero, color: T.c.ink, margin: `${T.space.sm}px 0 0`, fontVariantNumeric: "tabular-nums" }}>
            {fmtUSD0(rolled)}
          </p>

          {/* The emotional duality — what it's BECOMING, not net worth. */}
          <div style={{ marginTop: T.space.md, padding: T.space.md, background: T.c.evergreenTint, borderRadius: T.radius.tile }}>
            <p style={{ ...T.type.body, color: T.c.evergreen, margin: 0, fontWeight: 600 }}>
              On track for{" "}
              <span style={{ fontWeight: 800, fontVariantNumeric: "tabular-nums" }}>{fmtUSD0(projRolled)}</span>{" "}
              when {LUKE.name} turns {LUKE.projectionAge} 🌱
            </p>
          </div>

          {/* CONTROL tier — one primary action, room to breathe. */}
          <div style={{ marginTop: T.space.lg, display: "flex", gap: T.space.sm }}>
            <PrimaryButton>Share {LUKE.name}'s link</PrimaryButton>
            <button
              type="button"
              style={{ height: 52, padding: `0 ${T.space.lg}px`, borderRadius: T.radius.tile, background: "transparent", border: `1.5px solid ${T.c.border}`, color: T.c.ink, fontSize: 15, fontWeight: 600, cursor: "pointer" }}
            >
              Add a gift
            </button>
          </div>
        </div>

        {/* ── WHO LOVES LUKE — promoted to a HERO MOMENT (the thing a bank can't
              have). Faces of the people building this, given real estate. ── */}
        <div style={{ marginTop: T.space.xl }}>
          <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between" }}>
            <p style={{ ...T.type.title, color: T.c.ink, margin: 0, fontSize: 18 }}>
              {LUKE.peopleCount} people are building this with you
            </p>
          </div>
          <p style={{ ...T.type.body, color: T.c.inkSoft, margin: `${T.space.xs}px 0 ${T.space.md}px` }}>
            {fmtUSD0(LUKE.giftsTotal)} gifted to {LUKE.name}, across {LUKE.giftCount} moments.
          </p>
          <div style={{ display: "flex", gap: T.space.sm, overflowX: "auto", paddingBottom: T.space.xs }}>
            {LUKE.loves.map((p) => <PersonAvatar key={p.initials} p={p} />)}
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: T.space.xs, width: 60 }}>
              <div style={{ width: 48, height: 48, borderRadius: T.radius.pill, background: T.c.creamDeep, display: "flex", alignItems: "center", justifyContent: "center", color: T.c.inkSoft, fontSize: 13, fontWeight: 700, border: `2px solid ${T.c.card}` }}>
                +6
              </div>
              <span style={{ fontSize: 11.5, fontWeight: 600, color: T.c.inkSoft }}>more</span>
            </div>
          </div>
        </div>

        {/* ── A MEMORY BOOK BEAT — our soul, surfaced (not three taps away). ── */}
        <div style={{ marginTop: T.space.xl, background: T.c.card, borderRadius: T.radius.card, padding: T.space.lg, boxShadow: T.shadow.soft, borderLeft: `3px solid ${T.c.gold}` }}>
          <Eyebrow color={T.c.gold}>From the Memory Book</Eyebrow>
          <p style={{ fontSize: 17, fontWeight: 600, color: T.c.ink, fontStyle: "italic", margin: `${T.space.sm}px 0 0`, lineHeight: 1.4 }}>
            "{LUKE.memory.quote}"
          </p>
          <p style={{ ...T.type.body, color: T.c.inkFaint, margin: `${T.space.sm}px 0 0` }}>
            {LUKE.memory.author} · {LUKE.name} reads this at {LUKE.projectionAge}
          </p>
        </div>

        {/* ── INFO tier — two quiet stat tiles. Everything ELSE (holdings,
              occasions, recurring, activity) is DEMOTED behind these taps
              instead of all rendered at once. That subtraction IS the
              redesign. ── */}
        <div style={{ marginTop: T.space.xl, display: "grid", gridTemplateColumns: "1fr 1fr", gap: T.space.md }}>
          <StatTile label="Your recurring" value="$100/mo" sub="next Jun 18" />
          <StatTile label="Market growth" value="+$9,603" sub="all-time" />
        </div>

        {/* DEMOTED entry points — quiet rows, not full sections. */}
        <div style={{ marginTop: T.space.md, background: T.c.card, borderRadius: T.radius.card, boxShadow: T.shadow.soft, overflow: "hidden" }}>
          {[
            { label: "What Luke owns", meta: "9 holdings" },
            { label: "Luke's occasions", meta: "Birthday Nov 4" },
            { label: "The day it becomes Luke's", meta: "Nov 4, 2033" },
          ].map((row, i) => (
            <div key={row.label} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: T.space.md, borderTop: i === 0 ? "none" : `1px solid ${T.c.border}` }}>
              <span style={{ ...T.type.body, color: T.c.ink, fontWeight: 600 }}>{row.label}</span>
              <span style={{ display: "flex", alignItems: "center", gap: T.space.sm }}>
                <span style={{ fontSize: 12.5, color: T.c.inkFaint }}>{row.meta}</span>
                <span style={{ color: T.c.inkFaint, fontSize: 18, lineHeight: 1 }}>›</span>
              </span>
            </div>
          ))}
        </div>

        <p style={{ textAlign: "center", marginTop: T.space.xl, fontSize: 11, color: T.c.inkFaint }}>
          Sandbox · warm depth + one hero + faces + memory, our register, not the bank's
        </p>
      </div>
    </div>
  );
}
