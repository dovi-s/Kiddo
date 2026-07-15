import { useMemo } from "react";
import { useQuery, useMutation, useQueryClient, type QueryClient } from "@tanstack/react-query";
import type { Fund, Event, Gift, Holding, InsertFund } from "@shared/schema";
import {
  createFund,
  fetchFund,
  fetchFundEvents,
  fetchFundGifts,
  fetchFundHoldings,
  fetchFunds,
  updateFund,
} from "@kora/api";
import { LOCAL_CACHE_KEYS, readLocalCache, writeLocalCache } from "@/lib/local-cache";
import { useAuth } from "@/hooks/use-auth";
import { applyDemoLiveGiftsToFunds, useDemoOverlayVersion } from "@/lib/demo-live-gifts";

/**
 * Synchronous, best-effort fund lookup for FRAME-ONE render on a push-navigation.
 * `useFunds()` briefly returns [] on a freshly-mounted page (its query is gated on
 * an async auth re-check), and the raw query cache can be momentarily empty too —
 * so a page landing via a View Transition would freeze its loading skeleton. This
 * walks the durable caches in order: the raw ["/api/funds"] query cache, then the
 * localStorage snapshot useFunds persists (auth-independent, survives the flash).
 * Callers use it as the fallback: `funds.find(...) ?? findFundInCaches(qc, id)`.
 */
export function fundsFromCaches(queryClient: QueryClient): Fund[] {
  const fromQuery = queryClient.getQueryData<Fund[]>(["/api/funds"]);
  if (fromQuery && fromQuery.length) return fromQuery;
  return readLocalCache<Fund[]>(LOCAL_CACHE_KEYS.funds) || [];
}
export function findFundInCaches(queryClient: QueryClient, fundId: string): Fund | undefined {
  if (!fundId) return undefined;
  return fundsFromCaches(queryClient).find((f) => f.id === fundId);
}

export function useFunds() {
  // Gate the funds query on auth state. Logged-out visitors land on public
  // pages (Claim, marketing, /:fund gift checkout) where always-mounted
  // components like GlobalShareModal and Claim.tsx call useFunds() — without
  // the gate, every page-load fires /api/funds, gets a 401, and graceful-
  // returns []. Functionally fine but produces console noise on every public
  // page.
  //
  // Why both isAuthenticated AND isAuthChecked: useAuth hydrates from
  // localStorage initialData synchronously, so isAuthenticated can briefly
  // be true even when the actual server session has expired. Without the
  // isAuthChecked guard, the funds query would fire during that brief
  // window, hit the server, get 401, and produce the exact console noise
  // we're trying to eliminate. isAuthChecked flips true only after the
  // auth query has fetched from the server, so downstream queries wait
  // for ground truth before firing.
  const { isAuthenticated, isAuthChecked, user } = useAuth();
  const isDemoAccount = Boolean((user as any)?.isDemoAccount);
  // Re-derive the merge when a demo gift is recorded in-place (the ambient beat
  // fires while the prospect sits on the dashboard) so the useFunds-backed
  // surfaces (/funds total, header) update immediately instead of waiting for a
  // refetch/remount. (The Dashboard hero reads its own /api/funds query, so it's
  // reconciled separately in Stage 1b.)
  const overlayVersion = useDemoOverlayVersion();
  const query = useQuery<Fund[]>({
    queryKey: ["/api/funds"],
    queryFn: async () => {
      const funds = await fetchFunds();
      writeLocalCache(LOCAL_CACHE_KEYS.funds, funds);
      return funds;
    },
    enabled: isAuthChecked && isAuthenticated,
    initialData: () => (isAuthenticated ? readLocalCache<Fund[]>(LOCAL_CACHE_KEYS.funds) : []),
    initialDataUpdatedAt: 0,
    retry: false,
    staleTime: 2 * 60_000,
    refetchOnMount: true,
    refetchOnWindowFocus: false,
  });
  // Demo-only: merge the prospect's just-sent session gifts into the funds so a
  // sent gift VISIBLY lands on the dashboard (pendingBalance feeds the hero +
  // all-funds totals; contributorCount ticks up). Non-demo and no-gift cases
  // are a no-op, and it never mutates the query cache. The Memory Book consumes
  // the same session store (MemoryBook.tsx), so both sides of the loop land.
  const data = useMemo(
    () => applyDemoLiveGiftsToFunds(query.data ?? [], isDemoAccount),
    [query.data, isDemoAccount, overlayVersion],
  );
  return { ...query, data };
}

export function useFund(id: string | undefined) {
  return useQuery<Fund | null>({
    queryKey: ["/api/funds", id],
    queryFn: () => id ? fetchFund(id) : Promise.resolve(null),
    enabled: !!id,
    retry: false,
    staleTime: Infinity,
  });
}

export function useFundEvents(fundId: string | undefined) {
  return useQuery<Event[]>({
    queryKey: ["/api/funds", fundId, "events"],
    queryFn: () => fundId ? fetchFundEvents(fundId) : Promise.resolve([]),
    enabled: !!fundId,
    retry: false,
    staleTime: Infinity,
  });
}

export function useFundHoldings(fundId: string | undefined) {
  return useQuery<Holding[]>({
    queryKey: ["/api/funds", fundId, "holdings"],
    queryFn: () => fundId ? fetchFundHoldings(fundId) : Promise.resolve([]),
    enabled: !!fundId,
    retry: false,
    staleTime: Infinity,
  });
}

export function useFundGifts(fundId: string | undefined) {
  return useQuery<Gift[]>({
    queryKey: ["/api/funds", fundId, "gifts"],
    queryFn: () => fundId ? fetchFundGifts(fundId) : Promise.resolve([]),
    enabled: !!fundId,
    retry: false,
    staleTime: Infinity,
  });
}

export function useCreateFund() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: createFund,
    onSuccess: (newFund) => {
      // Optimistically inject the new fund into the funds list cache so the
      // dashboard switcher shows it instantly — without waiting for a refetch
      // round-trip. The invalidate still fires below to reconcile any
      // server-side fields we don't have locally.
      queryClient.setQueryData<Fund[] | undefined>(["/api/funds"], (prev) => {
        if (!newFund) return prev;
        const list = Array.isArray(prev) ? prev : [];
        if (list.some((f) => String(f?.id) === String(newFund.id))) return list;
        return [newFund as Fund, ...list];
      });
      try {
        writeLocalCache(LOCAL_CACHE_KEYS.funds, queryClient.getQueryData<Fund[]>(["/api/funds"]) || []);
      } catch {
        // best-effort local cache write
      }
      queryClient.invalidateQueries({ queryKey: ["/api/funds"] });
    },
  });
}

export function useUpdateFund() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<InsertFund> }) => updateFund(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/funds"] });
    },
  });
}
