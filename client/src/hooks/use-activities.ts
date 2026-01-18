import { useQuery } from "@tanstack/react-query";
import type { Activity } from "@shared/schema";

async function fetchActivities(limit = 50): Promise<Activity[]> {
  const response = await fetch(`/api/activities?limit=${limit}`, { credentials: "include" });
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

export function useActivities(limit = 50) {
  return useQuery<Activity[]>({
    queryKey: ["/api/activities", limit],
    queryFn: () => fetchActivities(limit),
    retry: false,
    staleTime: 1000 * 60 * 5,
  });
}

export function useFundActivities(fundId: string | undefined, limit = 50) {
  return useQuery<Activity[]>({
    queryKey: ["/api/funds", fundId, "activities", limit],
    queryFn: () => fundId ? fetchFundActivities(fundId, limit) : Promise.resolve([]),
    enabled: !!fundId,
    retry: false,
    staleTime: 1000 * 60 * 5,
  });
}
