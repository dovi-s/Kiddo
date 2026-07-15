// The fund's LIVE total value, published by whichever Dashboard computed it.
//
// Problem this solves (founder catch 2026-06-05): the sidebar derived its
// balance from server-side `fund.balance` — incremented on gift settlement,
// NOT price-synced — while the Dashboard hero sums live `holdings.currentValue`
// (+ cash + pending + the demo session overlays). Two formulas for the same
// fact = two numbers in the same viewport ($22,743 vs $22,793).
//
// Rather than re-deriving the hero math in the sidebar (a duplicated formula
// that would drift the next time the hero changes), the Dashboard PUBLISHES
// the exact number it rendered, and the sidebar SUBSCRIBES. One fact, one
// formula, one value — the sidebar can't disagree with a hero it's quoting.
//
// Staleness: the value persists in the query cache after leaving the
// Dashboard. That's correct — client-side prices only move when the Dashboard
// refetches anyway, and the sidebar-vs-hero agreement only matters on screens
// where both are visible (the Dashboard). Consumers fall back to the
// funds-list math (`balance + pending + cash`) when nothing was published yet
// (e.g. cold load straight onto /memory).

import { useCallback } from "react";
import { useSyncExternalStore } from "react";
import { useQueryClient, type QueryClient } from "@tanstack/react-query";

const KEY_ROOT = "fund-live-value";

export const fundLiveValueKey = (fundId: string) => [KEY_ROOT, fundId] as const;

/** Called by the Dashboard (lab + real) after it computes the hero total. */
export function publishFundLiveValue(queryClient: QueryClient, fundId: string, value: number): void {
  if (!fundId || !Number.isFinite(value)) return;
  // setQueryData no-ops structurally-equal values, so re-publishing the same
  // number every render/poll doesn't churn subscribers.
  queryClient.setQueryData(fundLiveValueKey(fundId), value);
}

/**
 * Non-reactive read for list/dropdown rows (can't call hooks in a map).
 * Fine for transient surfaces like the fund-switcher dropdown — it re-renders
 * on open anyway.
 */
export function readFundLiveValue(queryClient: QueryClient, fundId: string | null | undefined): number | undefined {
  return fundId ? queryClient.getQueryData<number>(fundLiveValueKey(fundId)) : undefined;
}

/**
 * The last hero-computed live total for a fund, or undefined if no Dashboard
 * has computed one this session. Reactive: re-renders when a new value is
 * published (e.g. the Dashboard's 30s poll lands while the sidebar is mounted).
 */
export function useFundLiveValue(fundId: string | null | undefined): number | undefined {
  const queryClient = useQueryClient();
  const subscribe = useCallback(
    (onChange: () => void) =>
      queryClient.getQueryCache().subscribe((event) => {
        if (event?.query?.queryKey?.[0] === KEY_ROOT) onChange();
      }),
    [queryClient],
  );
  return useSyncExternalStore(
    subscribe,
    () => (fundId ? queryClient.getQueryData<number>(fundLiveValueKey(fundId)) : undefined),
    () => undefined,
  );
}
