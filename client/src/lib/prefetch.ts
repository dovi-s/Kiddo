import type { QueryClient } from "@tanstack/react-query";

// Web-side data prefetch — pulls the data the next-likely page will need so
// the click → render is instant instead of click → spinner → render. Pairs
// with the code-chunk preload in App.tsx (which already runs on idle).
//
// Convention: every prefetch helper takes the queryClient + relevant params,
// and SILENTLY no-ops on failure. Prefetch is a hint, not a contract — if
// the network is slow or the user navigates away, that's fine.
//
// All these mirror the queryKey shape and queryFn used by the page hooks
// they target — keep in sync if those change.

const NEIGHBOR_STALE = 60_000; // 1 min — long enough to absorb tab-switch latency

async function safeFetchJson(url: string): Promise<unknown> {
  try {
    const res = await fetch(url, { credentials: "include" });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

// Dashboard's hero query is the per-fund dashboard-summary — pre-warm it so
// tapping Home from any other page lands on a hydrated hero instead of a
// loading skeleton. Also hits the funds list which the AppHeader needs.
export function prefetchDashboard(queryClient: QueryClient, fundId: string | null | undefined): void {
  void queryClient.prefetchQuery({
    queryKey: ["/api/funds"],
    queryFn: () => safeFetchJson(`/api/funds`),
    staleTime: NEIGHBOR_STALE,
  });
  if (!fundId) return;
  void queryClient.prefetchQuery({
    queryKey: ["/api/funds", fundId, "dashboard-summary"],
    queryFn: () => safeFetchJson(`/api/funds/${fundId}/dashboard-summary`),
    staleTime: NEIGHBOR_STALE,
  });
}

export function prefetchMemoryBook(queryClient: QueryClient, fundId: string | null | undefined): void {
  if (!fundId) return;
  // Warm the fund itself (["fund", fundId]) — the Memory Book hero + ~47 childName
  // spots read recipientFirstName from it. Without this it cold-flashes GENERIC
  // ("diversified mix", "Their book") before the async fund query lands. MUST mirror
  // the page's key + endpoint exactly (MemoryBook.tsx ~883: useQuery(["fund", fundId])).
  void queryClient.prefetchQuery({
    queryKey: ["fund", fundId],
    queryFn: () => safeFetchJson(`/api/funds/${fundId}`),
    staleTime: NEIGHBOR_STALE,
  });
  void queryClient.prefetchQuery({
    queryKey: ["memory", fundId],
    queryFn: () => safeFetchJson(`/api/funds/${fundId}/memory`),
    staleTime: NEIGHBOR_STALE,
  });
  void queryClient.prefetchQuery({
    queryKey: ["thank-yous", fundId],
    queryFn: () => safeFetchJson(`/api/funds/${fundId}/thank-yous`),
    staleTime: NEIGHBOR_STALE,
  });
}

export function prefetchActivity(queryClient: QueryClient, fundId: string | null | undefined, limit: number = 60): void {
  // MUST mirror useActivities' key EXACTLY: ["/api/activities", limit, fundId || "all"].
  // The limit MUST equal the page's (useActivities now fetches 60 — cut from 200 for perf
  // 2026-06-25). A mismatched limit warms a key the Activity page never reads, so the
  // prefetch is wasted and the page still fetches cold (skeleton-flash on the slowest tab).
  void queryClient.prefetchQuery({
    queryKey: ["/api/activities", limit, fundId || "all"],
    queryFn: () => safeFetchJson(`/api/activities?limit=${limit}${fundId ? `&fundId=${fundId}` : ""}`),
    staleTime: NEIGHBOR_STALE,
  });
  // Activity also fetches /api/me/scheduled for the Pending/Scheduled tabs —
  // pre-warming this means even the secondary tabs feel instant.
  void queryClient.prefetchQuery({
    queryKey: ["/api/me/scheduled"],
    queryFn: () => safeFetchJson(`/api/me/scheduled`),
    staleTime: NEIGHBOR_STALE,
  });
}

// Public gift page (/:fund or /:fund/:event) — the conversion-funnel page
// that gifters land on cold from email/SMS/share. Its hero render is gated
// by the public-event/fund endpoint. Firing this prefetch the moment we
// detect a gift-route URL means the data is in flight in parallel with the
// lazy-loaded GiftCheckout chunk; by the time the component mounts, the
// query is either resolved or near-resolved. Cuts perceived load time on
// the highest-leverage page in the product.
export function prefetchPublicGiftPage(
  queryClient: QueryClient,
  fundSlug: string | null | undefined,
  eventSlug?: string | null,
): void {
  if (!fundSlug && !eventSlug) return;
  // Mirror exactly what GiftCheckout's useQuery does (queryKey + queryFn
  // shape). If the shapes drift, the prefetch becomes a no-op cache miss.
  void queryClient.prefetchQuery({
    queryKey: ["public-event", eventSlug ?? undefined, fundSlug ?? undefined],
    queryFn: async () => {
      if (eventSlug) {
        const res = await fetch(`/api/public/events/${eventSlug}`);
        if (!res.ok) throw new Error("Event not found");
        return res.json();
      }
      const res = await fetch(`/api/public/funds/${fundSlug}`);
      if (!res.ok) throw new Error("Fund not found");
      const fundData = await res.json();
      return {
        event: { id: fundData.permanentEventId || "", name: "Gift anytime", giftCount: fundData.giftCount ?? 0 },
        fund: fundData.fund,
        giftCount: fundData.giftCount ?? 0,
        recentGifters: fundData.recentGifters ?? [],
        activeEvents: fundData.activeEvents || [],
        permanentEventSlug: fundData.permanentEventSlug || null,
      };
    },
    staleTime: NEIGHBOR_STALE,
  });
}

// Tax Documents fetches holdings for the active fund. Pre-warming saves the
// 200-400ms holdings round-trip when the parent navigates from Settings.
export function prefetchTaxDocuments(queryClient: QueryClient, fundId: string | null | undefined): void {
  if (!fundId) return;
  void queryClient.prefetchQuery({
    queryKey: ["/api/funds", fundId, "holdings"],
    queryFn: () => safeFetchJson(`/api/funds/${fundId}/holdings`),
    staleTime: NEIGHBOR_STALE,
  });
}

export function prefetchSettings(queryClient: QueryClient): void {
  void queryClient.prefetchQuery({
    queryKey: ["/api/user/kyc-status"],
    queryFn: () => safeFetchJson(`/api/user/kyc-status`),
    staleTime: NEIGHBOR_STALE,
  });
  void queryClient.prefetchQuery({
    queryKey: ["/api/bank-accounts"],
    queryFn: () => safeFetchJson(`/api/bank-accounts`),
    staleTime: NEIGHBOR_STALE,
  });
}

// Schedule a prefetch on browser idle so it never competes with critical
// in-flight fetches. Returns a cancel function so callers (typically a
// useEffect cleanup) can drop the pending callback if they unmount or the
// dependency changes before idle fires. Falls back to a short setTimeout
// where requestIdleCallback isn't available (Safari pre-17, some embedded
// webviews).
export function onIdle(fn: () => void): () => void {
  if (typeof window === "undefined") return () => undefined;
  const w = window as any;
  if (typeof w.requestIdleCallback === "function") {
    const id = w.requestIdleCallback(fn, { timeout: 1500 });
    return () => {
      try {
        w.cancelIdleCallback?.(id);
      } catch {
        // best-effort cleanup
      }
    };
  }
  const id = window.setTimeout(fn, 200);
  return () => window.clearTimeout(id);
}
