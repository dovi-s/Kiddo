// FundTabs — fast-switch pill row at the top of multi-fund Dashboards.
//
// Locked 2026-05-26 per the Acorns "You / Kid" tab pattern audit.
// Coexists with the existing AppHeader fund dropdown (which keeps the
// FundsOverview entry + Add-child-fund affordance). The tabs are the
// FAST-SWITCH surface for the 90% case (Family-tier parents with
// 2-4 kids); the dropdown stays for everything else.
//
// Design discipline:
//   - Hidden entirely with fewer than 2 funds. Single-fund parents
//     see no tab strip; the dropdown's "+ Add child fund" affordance
//     is their path to start a second fund. Removing tabs when not
//     needed keeps the Dashboard hero anchored at the top.
//   - Text-only pills with kid first name. The locked register
//     rejects social-proof visual language (per FundsOverview
//     comments: no avatars on the gifters list). Kid-switching is
//     not social proof, and the existing dropdown DOES use kid
//     avatars in its rows, but the tab strip is intentionally
//     minimal because it sits as ambient chrome above the hero
//     rather than a focal list. A row of small kid faces above the
//     hero would compete with the hero balance number for attention.
//   - Active pill: evergreen background + white text. Inactive:
//     subtle border + foreground text. Single visual primary, no
//     ambiguity about which fund's Dashboard the parent is viewing.
//   - Horizontal scroll for 5+ funds. Mobile-first; scroll
//     gracefully degrades with no scrollbar visible (kiddo-tab-item
//     pattern). Foster parents / large families / blended-household
//     edge cases (8+ kids) still get the same experience; the
//     existing dropdown is the jump-to-any-fund escape hatch.
//   - Uses the existing setActiveFundId hook + ACTIVE_FUND_CHANGE_EVENT
//     so a tab click triggers the same fund-switch behavior as the
//     dropdown. No duplicate state management.
//
// Why no balance/sub on each pill: a sub-line ("$1,240") on each
// pill would force two lines of text per kid, doubling the strip's
// vertical real estate and pulling focus from the hero balance
// number below. The user can tap to switch and see the balance
// on the hero. One source of truth for the balance, ambient
// switching above it.

import { useCallback, useEffect, useState } from "react";
import { motion } from "framer-motion";
import { capFirst } from "@/lib/format-name";
import { haptic } from "@/lib/haptics";
import { getActiveFundId, setActiveFundId, ACTIVE_FUND_CHANGE_EVENT } from "@/hooks/use-active-fund";
import type { Fund } from "@shared/schema";

interface FundTabsProps {
  funds: Fund[];
  // Optional override; when omitted the component reads the active
  // fund from the shared hook (matches AppHeader/sidebar source of
  // truth). Override is useful for Dashboard which already has
  // selectedFundId state derived through its own validation logic.
  activeFundId?: string;
}

export function FundTabs({ funds, activeFundId: activeFundIdProp }: FundTabsProps) {
  // Mirror the AppHeader pattern: read from the hook, re-sync on
  // ACTIVE_FUND_CHANGE_EVENT so a switch from anywhere (dropdown,
  // sidebar, tab) keeps the highlighted tab in sync.
  const [activeFundIdState, setActiveFundIdState] = useState(() => activeFundIdProp || getActiveFundId() || "");

  useEffect(() => {
    if (activeFundIdProp !== undefined) {
      setActiveFundIdState(activeFundIdProp);
    }
  }, [activeFundIdProp]);

  useEffect(() => {
    if (activeFundIdProp !== undefined) return; // controlled mode; skip global listener
    const handler = () => setActiveFundIdState(getActiveFundId() || "");
    window.addEventListener(ACTIVE_FUND_CHANGE_EVENT, handler);
    return () => window.removeEventListener(ACTIVE_FUND_CHANGE_EVENT, handler);
  }, [activeFundIdProp]);

  const handleSelect = useCallback((fundId: string) => {
    if (fundId === activeFundIdState) return;
    haptic("selection");
    setActiveFundId(fundId);
    setActiveFundIdState(fundId);
    // Dispatch the same event the AppHeader dispatches so any other
    // listener (sidebar, page-scope hooks, prefetch) wakes up.
    window.dispatchEvent(new CustomEvent(ACTIVE_FUND_CHANGE_EVENT));
  }, [activeFundIdState]);

  // Single-fund parents see no strip. The Dashboard hero is the
  // canonical anchor; with one fund there's nothing to switch.
  if (!funds || funds.length < 2) return null;

  return (
    <div
      className="-mx-4 px-4 overflow-x-auto scrollbar-hide"
      role="tablist"
      aria-label="Switch between child funds"
      data-testid="fund-tabs"
    >
      <div className="flex items-center gap-2 min-w-max pb-1">
        {funds.map((fund) => {
          const isActive = fund.id === activeFundIdState;
          const name = fund.recipientFirstName ? capFirst(fund.recipientFirstName) : (fund.name || "Fund");
          return (
            <button
              key={fund.id}
              type="button"
              role="tab"
              aria-selected={isActive}
              aria-controls="dashboard-main-content"
              onClick={() => handleSelect(fund.id)}
              className={`relative shrink-0 rounded-full px-4 py-2 text-sm font-semibold transition-colors kiddo-tab-item ${
                isActive
                  ? "text-white"
                  : "border border-[hsl(var(--kiddo-border))] bg-card text-foreground hover:bg-[hsl(var(--kiddo-cream))]"
              }`}
              data-testid={`fund-tab-${fund.id}`}
            >
              {/* Shared-layoutId pill renders ONLY on the active tab.
                  The motion.span supplies the evergreen background;
                  the button itself has no bg in the active state.
                  This is the canonical Framer-Motion animated-tab
                  pattern — one bg layer, one text layer. The
                  previous version painted the bg twice (button base
                  + motion overlay) AND rendered the label twice (one
                  in the button's natural text flow, one absolutely
                  positioned), which produced a subpixel-offset
                  chromatic shimmer that read as "shiny silver" on
                  the active tab text. Fixed 2026-05-26. */}
              {isActive && (
                <motion.span
                  layoutId="fund-tab-active-glow"
                  className="absolute inset-0 rounded-full bg-[hsl(var(--kiddo-evergreen))]"
                  transition={{ type: "spring", stiffness: 380, damping: 32 }}
                  aria-hidden="true"
                />
              )}
              <span className="relative z-10">{name}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
