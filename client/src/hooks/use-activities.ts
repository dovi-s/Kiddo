import { useQuery } from "@tanstack/react-query";
import type { Activity } from "@shared/schema";
import { LOCAL_CACHE_KEYS, readLocalCache, writeLocalCache } from "@/lib/local-cache";

async function fetchActivities(limit = 50, fundId?: string | null): Promise<Activity[]> {
  const params = new URLSearchParams();
  params.set("limit", String(limit));
  if (fundId) params.set("fundId", fundId);
  const response = await fetch(`/api/activities?${params.toString()}`, { credentials: "include" });
  if (response.status === 401) return [];
  if (!response.ok) throw new Error(`${response.status}: ${response.statusText}`);
  return response.json();
}

async function fetchFundActivities(fundId: string, limit = 50): Promise<Activity[]> {
  const response = await fetch(`/api/funds/${fundId}/activities?limit=${limit}`, { credentials: "include" });
  if (response.status === 401) return [];
  if (!response.ok) throw new Error(`${response.status}: ${response.statusText}`);
  return response.json();
}

export function useActivities(limit = 50, enabled = true, fundId?: string | null) {
  return useQuery<Activity[]>({
    // fundId is part of the cache key — switching funds gets a fresh query
    // rather than serving the previous fund's cached rows.
    queryKey: ["/api/activities", limit, fundId || "all"],
    queryFn: async () => {
      const activities = await fetchActivities(limit, fundId);
      const cacheKey = fundId
        ? `${LOCAL_CACHE_KEYS.activities}:${limit}:${fundId}`
        : `${LOCAL_CACHE_KEYS.activities}:${limit}`;
      writeLocalCache(cacheKey, activities);
      return activities;
    },
    enabled,
    initialData: () => {
      const cacheKey = fundId
        ? `${LOCAL_CACHE_KEYS.activities}:${limit}:${fundId}`
        : `${LOCAL_CACHE_KEYS.activities}:${limit}`;
      return readLocalCache<Activity[]>(cacheKey);
    },
    initialDataUpdatedAt: 0,
    retry: false,
    // Was `staleTime: Infinity` — that meant the activity feed +
    // notifications bell + mobile activity-tab dot only refetched on
    // mount and NEVER in the background. So when an async server event
    // fired (recurring contribution worker, webhook landing a gift,
    // milestone engine writing a celebration row), the client stayed
    // frozen until the user navigated away and back. 60s staleness gives
    // honest near-real-time without thrashing the network.
    staleTime: 60_000,
    refetchOnMount: "always",
    // Refetch when the user comes back to the tab. Catches the canonical
    // "I just contributed → switched tabs while Stripe processed → came
    // back" case without relying on URL-param hooks.
    refetchOnWindowFocus: true,
    // Light background polling so activity surfaces within ~2 minutes of
    // an async server event firing while the user has the page open.
    // 120s is the same cadence Dashboard's primary holdings query uses
    // (line 1198 in Dashboard.tsx).
    refetchInterval: 120_000,
    refetchIntervalInBackground: false,
  });
}

export function useFundActivities(fundId: string | undefined, limit = 50) {
  return useQuery<Activity[]>({
    queryKey: ["/api/funds", fundId, "activities", limit],
    queryFn: () => fundId ? fetchFundActivities(fundId, limit) : Promise.resolve([]),
    enabled: !!fundId,
    retry: false,
    staleTime: Infinity,
  });
}
