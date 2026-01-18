import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import type { Fund, Event, Gift, Holding, InsertFund, InsertEvent } from "@shared/schema";

async function fetchFunds(): Promise<Fund[]> {
  const response = await fetch("/api/funds", { credentials: "include" });
  if (response.status === 401) return [];
  if (!response.ok) throw new Error(`${response.status}: ${response.statusText}`);
  return response.json();
}

async function fetchFund(id: string): Promise<Fund | null> {
  const response = await fetch(`/api/funds/${id}`, { credentials: "include" });
  if (response.status === 401 || response.status === 404) return null;
  if (!response.ok) throw new Error(`${response.status}: ${response.statusText}`);
  return response.json();
}

async function fetchFundEvents(fundId: string): Promise<Event[]> {
  const response = await fetch(`/api/funds/${fundId}/events`, { credentials: "include" });
  if (response.status === 401) return [];
  if (!response.ok) throw new Error(`${response.status}: ${response.statusText}`);
  return response.json();
}

async function fetchFundHoldings(fundId: string): Promise<Holding[]> {
  const response = await fetch(`/api/funds/${fundId}/holdings`, { credentials: "include" });
  if (response.status === 401) return [];
  if (!response.ok) throw new Error(`${response.status}: ${response.statusText}`);
  return response.json();
}

async function fetchFundGifts(fundId: string): Promise<Gift[]> {
  const response = await fetch(`/api/funds/${fundId}/gifts`, { credentials: "include" });
  if (response.status === 401) return [];
  if (!response.ok) throw new Error(`${response.status}: ${response.statusText}`);
  return response.json();
}

async function createFund(data: Partial<InsertFund>): Promise<Fund> {
  const response = await fetch("/api/funds", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify(data),
  });
  if (!response.ok) throw new Error(`${response.status}: ${response.statusText}`);
  return response.json();
}

async function updateFund(id: string, data: Partial<InsertFund>): Promise<Fund> {
  const response = await fetch(`/api/funds/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify(data),
  });
  if (!response.ok) throw new Error(`${response.status}: ${response.statusText}`);
  return response.json();
}

export function useFunds() {
  return useQuery<Fund[]>({
    queryKey: ["/api/funds"],
    queryFn: fetchFunds,
    retry: false,
    staleTime: 1000 * 60 * 5,
  });
}

export function useFund(id: string | undefined) {
  return useQuery<Fund | null>({
    queryKey: ["/api/funds", id],
    queryFn: () => id ? fetchFund(id) : Promise.resolve(null),
    enabled: !!id,
    retry: false,
    staleTime: 1000 * 60 * 5,
  });
}

export function useFundEvents(fundId: string | undefined) {
  return useQuery<Event[]>({
    queryKey: ["/api/funds", fundId, "events"],
    queryFn: () => fundId ? fetchFundEvents(fundId) : Promise.resolve([]),
    enabled: !!fundId,
    retry: false,
    staleTime: 1000 * 60 * 5,
  });
}

export function useFundHoldings(fundId: string | undefined) {
  return useQuery<Holding[]>({
    queryKey: ["/api/funds", fundId, "holdings"],
    queryFn: () => fundId ? fetchFundHoldings(fundId) : Promise.resolve([]),
    enabled: !!fundId,
    retry: false,
    staleTime: 1000 * 60 * 5,
  });
}

export function useFundGifts(fundId: string | undefined) {
  return useQuery<Gift[]>({
    queryKey: ["/api/funds", fundId, "gifts"],
    queryFn: () => fundId ? fetchFundGifts(fundId) : Promise.resolve([]),
    enabled: !!fundId,
    retry: false,
    staleTime: 1000 * 60 * 5,
  });
}

export function useCreateFund() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: createFund,
    onSuccess: () => {
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
