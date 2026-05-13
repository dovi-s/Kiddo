import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import type { Event, InsertEvent } from "@shared/schema";
import { LOCAL_CACHE_KEYS, readLocalCache, writeLocalCache } from "@/lib/local-cache";

async function fetchEvents(): Promise<Event[]> {
  const response = await fetch("/api/events", { credentials: "include" });
  if (response.status === 401) return [];
  if (!response.ok) throw new Error(`${response.status}: ${response.statusText}`);
  return response.json();
}

async function fetchEvent(id: string): Promise<Event | null> {
  const response = await fetch(`/api/events/${id}`, { credentials: "include" });
  if (response.status === 401 || response.status === 404) return null;
  if (!response.ok) throw new Error(`${response.status}: ${response.statusText}`);
  return response.json();
}

async function createEvent(data: Partial<InsertEvent>): Promise<Event> {
  const response = await fetch("/api/events", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify(data),
  });
  if (!response.ok) {
    const err = await response.json().catch(() => null);
    throw new Error(err?.message || err?.error || `${response.status}: ${response.statusText}`);
  }
  return response.json();
}

async function updateEvent(id: string, data: Partial<InsertEvent>): Promise<Event> {
  const response = await fetch(`/api/events/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify(data),
  });
  if (!response.ok) throw new Error(`${response.status}: ${response.statusText}`);
  return response.json();
}

async function deleteEvent(id: string): Promise<void> {
  const response = await fetch(`/api/events/${id}`, {
    method: "DELETE",
    credentials: "include",
  });
  if (!response.ok) throw new Error(`${response.status}: ${response.statusText}`);
}

export function useEvents() {
  return useQuery<Event[]>({
    queryKey: ["/api/events"],
    queryFn: async () => {
      const events = await fetchEvents();
      writeLocalCache(LOCAL_CACHE_KEYS.events, events);
      return events;
    },
    initialData: () => readLocalCache<Event[]>(LOCAL_CACHE_KEYS.events),
    initialDataUpdatedAt: 0,
    retry: false,
    staleTime: 2 * 60_000,
    refetchOnMount: true,
    refetchOnWindowFocus: false,
  });
}

export function useEvent(id: string | undefined) {
  return useQuery<Event | null>({
    queryKey: ["/api/events", id],
    queryFn: () => id ? fetchEvent(id) : Promise.resolve(null),
    enabled: !!id,
    retry: false,
    staleTime: 1000 * 60 * 5,
  });
}

// Dashboard.tsx renders events out of the per-fund dashboard-summary query
// (["/api/funds", fundId, "dashboard-summary"]) and seeds the per-fund events
// cache from it. The per-fund events query is gated on dashboard-summary FAILING
// (enabled: !!activeFundId && dashboardSummaryError), so under normal conditions
// it never refetches on its own — events come exclusively via the dashboard
// summary's events sub-field.
//
// Consequence: a plain `invalidateQueries(["/api/funds"])` is supposed to
// prefix-match the dashboard-summary key and trigger refetch — but in practice
// (with refetchInterval: 60s + staleTime: 30s on the summary) the user sees a
// long delay before edits appear. The fix: explicitly refetchQueries() to
// guarantee the network call fires immediately, and await all of them so the
// mutation resolves AFTER fresh data has landed in the cache. The closing
// modal toast then matches what the tile shows on next render — no perceived
// lag, no "did it save?" double-click.
async function invalidateEventCaches(queryClient: ReturnType<typeof useQueryClient>) {
  await Promise.all([
    queryClient.invalidateQueries({ queryKey: ["/api/events"] }),
    queryClient.invalidateQueries({ queryKey: ["/api/funds"] }),
    // Belt-and-suspenders: force the dashboard-summary to fetch RIGHT NOW
    // rather than waiting for the next 60s polling tick. Prefix-match also
    // catches per-fund events / holdings / gifts caches.
    queryClient.refetchQueries({ queryKey: ["/api/funds"], type: "active" }),
  ]);
}

export function useCreateEvent() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: createEvent,
    onSuccess: async () => { await invalidateEventCaches(queryClient); },
  });
}

export function useUpdateEvent() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<InsertEvent> }) => updateEvent(id, data),
    onSuccess: async () => { await invalidateEventCaches(queryClient); },
  });
}

export function useDeleteEvent() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: deleteEvent,
    onSuccess: async () => { await invalidateEventCaches(queryClient); },
  });
}
