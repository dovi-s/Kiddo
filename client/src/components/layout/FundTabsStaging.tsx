// FundTabsStaging — identity-forward kid switcher for the /staging rebuild.
//
// Replaces the stock text-pill FundTabs (which renders the children as
// interchangeable gray chips) with an IDENTITY switcher: each kid is a warm
// colored-initial avatar (or their photo) + name, and the active one is marked
// by an animated evergreen underline rather than a filled chip. These are the
// humans the whole product exists for — switching kids should feel like turning
// to look at a different child, not clicking tab 2. Restraint keeps it from
// fighting the hero: 26px avatars, a single quiet underline indicator, no
// shadows or fills. Staging-only; the shared FundTabs is unchanged.

import { useCallback, useEffect, useState } from "react";
import { motion } from "framer-motion";
import { capFirst } from "@/lib/format-name";
import { haptic } from "@/lib/haptics";
import { getActiveFundId, setActiveFundId, ACTIVE_FUND_CHANGE_EVENT } from "@/hooks/use-active-fund";
import type { Fund } from "@shared/schema";

// On-brand, heritage-muted identity tints (NOT a random rainbow — random hues
// are themselves an AI tell). Deterministic per kid by name hash, so a child
// keeps the same color everywhere.
const AVATAR_TINTS = [
  "hsl(152 30% 30%)", // evergreen
  "hsl(34 52% 44%)",  // ochre / gold
  "hsl(14 40% 48%)",  // terracotta
  "hsl(208 26% 44%)", // dusty blue
  "hsl(280 17% 46%)", // muted plum
  "hsl(174 26% 34%)", // teal-green
];

function tintFor(seed: string): string {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0;
  return AVATAR_TINTS[h % AVATAR_TINTS.length];
}

interface FundTabsStagingProps {
  funds: Fund[];
  activeFundId?: string;
  onSelect?: (fundId: string) => void;
}

export function FundTabsStaging({ funds, activeFundId: activeFundIdProp, onSelect }: FundTabsStagingProps) {
  const [activeFundIdState, setActiveFundIdState] = useState(() => activeFundIdProp || getActiveFundId() || "");

  useEffect(() => {
    if (activeFundIdProp !== undefined) setActiveFundIdState(activeFundIdProp);
  }, [activeFundIdProp]);

  useEffect(() => {
    if (activeFundIdProp !== undefined) return;
    const handler = () => setActiveFundIdState(getActiveFundId() || "");
    window.addEventListener(ACTIVE_FUND_CHANGE_EVENT, handler);
    return () => window.removeEventListener(ACTIVE_FUND_CHANGE_EVENT, handler);
  }, [activeFundIdProp]);

  const handleSelect = useCallback((fundId: string) => {
    if (fundId === activeFundIdState) return;
    haptic("selection");
    setActiveFundIdState(fundId);
    if (onSelect) { onSelect(fundId); return; }
    setActiveFundId(fundId);
  }, [activeFundIdState, onSelect]);

  if (!funds || funds.length < 2) return null;

  return (
    <div
      className="-mx-4 px-4 overflow-x-auto scrollbar-hide"
      role="tablist"
      aria-label="Switch between child funds"
      data-testid="fund-tabs"
    >
      <div className="flex items-stretch gap-1 min-w-max">
        {funds.map((fund) => {
          const isActive = fund.id === activeFundIdState;
          const name = fund.recipientFirstName ? capFirst(fund.recipientFirstName) : (fund.name || "Fund");
          const initial = (name.trim()[0] || "•").toUpperCase();
          const photo = (fund as any)?.childPhotoUrl as string | null | undefined;
          const tint = tintFor(fund.id || name);
          return (
            <button
              key={fund.id}
              type="button"
              role="tab"
              aria-selected={isActive}
              aria-controls="dashboard-main-content"
              onClick={() => handleSelect(fund.id)}
              className="relative shrink-0 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(var(--kiddo-evergreen)/0.55)] focus-visible:ring-offset-2 rounded-lg"
              data-testid={`fund-tab-${fund.id}`}
              style={{
                display: "inline-flex", alignItems: "center", gap: 8,
                padding: "8px 12px 11px",
                background: "transparent", border: "none",
              }}
            >
              {/* Identity avatar — photo if set, else the kid's colored initial.
                  Active gets a hair more presence (full color + soft ring);
                  inactive sits back at lower opacity so the strip reads calm. */}
              <span
                aria-hidden
                style={{
                  width: 26, height: 26, flexShrink: 0, borderRadius: "50%",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  overflow: "hidden",
                  background: photo ? "transparent" : tint,
                  color: "#fff", fontSize: 12, fontWeight: 700,
                  opacity: isActive ? 1 : 0.78,
                  boxShadow: isActive ? "0 0 0 2px hsl(var(--kiddo-cream)), 0 0 0 3.5px " + tint : "none",
                  transition: "opacity .25s ease, box-shadow .25s ease",
                }}
              >
                {photo ? (
                  <img src={photo} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                ) : initial}
              </span>
              <span
                style={{
                  fontSize: 14, fontWeight: isActive ? 700 : 600,
                  letterSpacing: "-0.01em",
                  color: isActive ? "hsl(var(--kiddo-ink))" : "rgba(26,23,16,0.5)",
                  transition: "color .25s ease",
                  whiteSpace: "nowrap",
                }}
              >
                {name}
              </span>
              {/* Active indicator: a single animated evergreen underline that
                  slides between kids (shared layoutId) — a Stripe/Material tab
                  indicator, not a filled chip. */}
              {isActive && (
                <motion.span
                  layoutId="fund-tab-staging-underline"
                  className="absolute left-3 right-3"
                  style={{ bottom: 2, height: 2.5, borderRadius: 2, background: "hsl(var(--kiddo-evergreen))" }}
                  transition={{ type: "spring", stiffness: 420, damping: 34 }}
                  aria-hidden="true"
                />
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
