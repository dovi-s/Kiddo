// Client-side hook for the action-item architecture. Fetches the
// derived "open + not snoozed" todos from the server and exposes
// helpers for Fix / Remind-tomorrow actions.
//
// Separate from the activities feed query because:
//   - Activities is a chronological ledger (append-only event log).
//     A 6-month-old kyc_action_required is still in the activities
//     feed — but the user has long since resolved it, so it's not
//     an open todo anymore. Server-side derivation in actionItems.ts
//     handles that filter.
//   - The query result drives the bell badge formula AND the
//     visible action-item cards AND the count on the badge. All
//     three need to update together when the parent fixes a thing
//     or snoozes one.

import { useCallback } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import type { ActionItem, ActionItemType } from "@shared/action-items";
import { useAuth } from "@/hooks/use-auth";
import { useRealtimeEvents } from "@/lib/realtime-context";
import { DemoBlockedError, isDemoNoop } from "@/lib/demo-block";

type ActionItemsResponse = {
  items: ActionItem[];
  count: number;
};

export function useActionItems() {
  const { isAuthenticated } = useAuth();
  const queryClient = useQueryClient();

  const query = useQuery<ActionItemsResponse>({
    queryKey: ["/api/me/action-items"],
    queryFn: async () => {
      const res = await fetch("/api/me/action-items", { credentials: "include" });
      if (!res.ok) return { items: [], count: 0 };
      return res.json();
    },
    enabled: isAuthenticated,
    staleTime: 60_000,
    refetchOnWindowFocus: true,
  });

  // The server derives action items from current user + fund state,
  // so anything that mutates funds, subscriptions, or user identity
  // could shift the open-todo list. We listen on the realtime bus
  // for the broad fund/subscription updates and re-fetch. Cheap —
  // a single GET that returns at most a handful of small objects.
  useRealtimeEvents((event) => {
    if (
      event.type === "fund.updated" ||
      event.type === "fund.activated" ||
      event.type === "subscription.updated" ||
      event.type === "gift.arrived"
    ) {
      void queryClient.invalidateQueries({ queryKey: ["/api/me/action-items"] });
    }
  });

  const snooze = useCallback(
    async (fundId: string, actionType: ActionItemType, hours?: number) => {
      const res = await fetch(`/api/funds/${fundId}/snooze-action`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ actionType, hours }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || "Could not snooze");
      }
      const data = await res.json().catch(() => null);
      // Demo accounts get a 200 { demo:true, saved:false } no-op. Throw so the
      // caller doesn't treat the snooze as persisted (and so we don't refetch
      // a cache that didn't change). Callers surface the honest demo toast.
      if (isDemoNoop(data)) throw new DemoBlockedError(data?.message);
      // Optimistic-ish — we just refetch instead of patching the
      // cache. Action-items list is small and refetch is fast.
      void queryClient.invalidateQueries({ queryKey: ["/api/me/action-items"] });
      return data;
    },
    [queryClient],
  );

  const unsnooze = useCallback(
    async (fundId: string, actionType: ActionItemType) => {
      const res = await fetch(`/api/funds/${fundId}/unsnooze-action`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ actionType }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || "Could not clear snooze");
      }
      const data = await res.json().catch(() => null);
      if (isDemoNoop(data)) throw new DemoBlockedError(data?.message);
      void queryClient.invalidateQueries({ queryKey: ["/api/me/action-items"] });
      return data;
    },
    [queryClient],
  );

  return {
    items: query.data?.items ?? [],
    count: query.data?.count ?? 0,
    isLoading: query.isLoading,
    snooze,
    unsnooze,
  };
}

// Lightweight variant — just returns the count, for the bell badge.
// Same query key + staleTime so the bell and the cards share cache.
export function useActionItemCount(): number {
  const { items } = useActionItems();
  return items.length;
}
