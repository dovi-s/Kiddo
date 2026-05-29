// GlobalShareModal — singleton ShareModal mounted at the App level so the
// sidebar's "Share" quick link can open it from ANY page (Memory Book,
// Activity, Settings, etc.) without first navigating to Dashboard.
//
// Why this exists: previously the ShareModal was mounted only inside
// Dashboard.tsx. The sidebar's Share button worked by either:
//   1. Dispatching a `kiddo:open-share-modal` event (when on Dashboard), or
//   2. Navigating to `/dashboard?openShare=1` (from any other page) — which
//      forced a full page transition before the modal opened. The user
//      reported this as "Share takes me home first, that's wrong."
//
// This component listens for `kiddo:open-share-modal` globally. When fired,
// it queries the active fund's data on demand and renders the same
// ShareModal component the Dashboard already uses (zero visual divergence —
// it's literally the same component, just mounted higher in the tree).

import { useCallback, useEffect, useMemo, useState } from "react";
import { useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { useFunds, useFundEvents } from "@/hooks/use-funds";
import { useAuth } from "@/hooks/use-auth";
import { getActiveFundId } from "@/hooks/use-active-fund";
import { ShareModal, type SharePage } from "@/components/ui/share-modal";
import { capFirst } from "@/lib/format-name";

export function GlobalShareModal() {
  const { isAuthenticated } = useAuth();
  // Skip event handling when on the Dashboard route — Dashboard mounts
  // its own ShareModal and registers its own listener for the same
  // `kiddo:open-share-modal` event. Without this guard, both modals
  // open in parallel (double-modal bug). The locked architecture
  // (per AppHeader's behavior at line ~125) is: when on /dashboard,
  // Dashboard owns the share UX. Off-dashboard, this global instance
  // is the canonical handler.
  const [location] = useLocation();
  const isOnDashboard = location.startsWith("/dashboard");
  const [open, setOpen] = useState(false);
  // Re-resolve the active fund id every time the modal opens. Keeps the
  // share data accurate when the parent has switched funds via the sidebar
  // since the last time the modal was used.
  const [tick, setTick] = useState(0);
  const activeFundId = useMemo(() => getActiveFundId(), [tick]);

  const { data: funds = [] } = useFunds();
  const activeFund = useMemo(
    () => (activeFundId ? funds.find((f) => f.id === activeFundId) : null) ?? funds[0] ?? null,
    [activeFundId, funds],
  );

  // Pull events for the active fund so per-event share pages exist alongside
  // the always-on fund link. Only fetched while the modal is open + a fund
  // is resolved — no idle network cost.
  const { data: fundEvents = [] } = useFundEvents(open && activeFund?.id ? activeFund.id : undefined);

  // dashboard-summary carries the gift-code map that the modal needs
  // (fund-level code + per-event codes). Reusing the same query key as
  // Dashboard so they share cache — no extra round-trip when the user has
  // already loaded Dashboard recently.
  const { data: dashboardSummary } = useQuery<any>({
    queryKey: ["/api/funds", activeFund?.id, "dashboard-summary"],
    queryFn: async () => {
      const res = await fetch(`/api/funds/${activeFund!.id}/dashboard-summary`, { credentials: "include" });
      if (!res.ok) return null;
      return res.json();
    },
    enabled: open && !!activeFund?.id,
    staleTime: 30_000,
  });

  const giftCodeData = dashboardSummary?.giftCode as { code: string; lookupUrl: string } | undefined;

  const sharePages: SharePage[] = useMemo(() => {
    if (!activeFund?.slug) return [];
    const origin = typeof window !== "undefined" ? window.location.origin : "";
    const pages: SharePage[] = [{
      label: `${capFirst(activeFund.recipientFirstName) || activeFund.name}'s gift link`,
      description: "Always-on gift link",
      url: `${origin}/${activeFund.slug}`,
      giftCode: giftCodeData?.code,
      isPermanent: true,
    }];
    const eventCodes = (dashboardSummary?.eventGiftCodes ?? {}) as Record<string, { code: string }>;
    const activeEvents = fundEvents.filter(
      (event) => !(event as any).isPermanent && String((event as any).status || "active") === "active",
    );
    for (const event of activeEvents) {
      if (!event.slug) continue;
      pages.push({
        label: event.name,
        url: `${origin}/${activeFund.slug}/${event.slug}`,
        giftCode: eventCodes[event.id]?.code,
        themeId: (event as any).theme || undefined,
      });
    }
    return pages;
  }, [activeFund?.name, activeFund?.recipientFirstName, activeFund?.slug, fundEvents, giftCodeData?.code, dashboardSummary?.eventGiftCodes]);

  const handleOpen = useCallback(() => {
    setTick((t) => t + 1);
    setOpen(true);
  }, []);

  useEffect(() => {
    // Only register the listener when we're NOT on Dashboard. Dashboard
    // owns the event when mounted (its in-page ShareModal is richer with
    // event-specific share pages). Re-registers automatically when the
    // user navigates away from Dashboard, so off-dashboard surfaces
    // (Memory Book, Activity, Settings, sidebar Share, mobile Share)
    // continue working.
    if (isOnDashboard) return;
    window.addEventListener("kiddo:open-share-modal", handleOpen);
    return () => window.removeEventListener("kiddo:open-share-modal", handleOpen);
  }, [handleOpen, isOnDashboard]);

  // Don't mount when not authenticated — share has no meaning on public/auth
  // pages. Also skip render when there's no fund yet (brand-new accounts).
  // Also skip when on Dashboard (Dashboard's own ShareModal handles it).
  if (!isAuthenticated || sharePages.length === 0 || isOnDashboard) return null;

  return (
    <ShareModal
      open={open}
      onClose={() => setOpen(false)}
      pages={sharePages}
      recipientName={capFirst(activeFund?.recipientFirstName) || activeFund?.name || "your child"}
      giftCode={giftCodeData ?? undefined}
      snapshotHref={activeFund?.id ? `/fund/${activeFund.id}/snapshot` : undefined}
      recipientIsOwner={Boolean((activeFund as any)?.transferredAt)}
    />
  );
}
