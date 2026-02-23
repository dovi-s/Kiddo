import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import type { Event, InsertEvent } from "@shared/schema";

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
    queryFn: fetchEvents,
    retry: false,
    staleTime: 1000 * 60 * 5,
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

export function useCreateEvent() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: createEvent,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/events"] });
      queryClient.invalidateQueries({ queryKey: ["/api/funds"] });
    },
  });
}

export function useUpdateEvent() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<InsertEvent> }) => updateEvent(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/events"] });
    },
  });
}

export function useDeleteEvent() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: deleteEvent,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/events"] });
    },
  });
}
