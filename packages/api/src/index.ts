import type { Event, Fund, Gift, Holding, InsertFund } from "@shared/schema";
import type { AuthProvidersStatus } from "@kora/types";

export type ApiMethod = "GET" | "POST" | "PATCH" | "DELETE";

export type ReferralAction = "visit" | "signup";

export type InvestmentPreferencesUpdate = {
  defaultMode: "stock" | "cash";
  defaultTicker?: string;
  allowGifterStockPick: boolean;
  allowGifterCashGift: boolean;
};

export async function apiRequest<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(path, {
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers || {}),
    },
    ...init,
  });

  if (!response.ok) {
    let message = `Request failed (${response.status})`;
    try {
      const body = await response.json();
      if (typeof body?.message === "string" && body.message) message = body.message;
      else if (typeof body?.error === "string" && body.error) message = body.error;
    } catch {
      // ignore parse error, use default message
    }
    throw new Error(message);
  }

  return response.json() as Promise<T>;
}

export async function fetchAuthProviders(): Promise<AuthProvidersStatus> {
  try {
    return await apiRequest<AuthProvidersStatus>("/api/auth/providers");
  } catch {
    return { google: false, apple: false };
  }
}

export async function trackReferralEvent(input: {
  refCode: string;
  action: ReferralAction;
  refSource: string;
  metadata?: Record<string, unknown>;
}) {
  return apiRequest<void>("/api/referrals/events", {
    method: "POST",
    body: JSON.stringify({
      refCode: input.refCode,
      action: input.action,
      channel: `get_started:${input.refSource}`,
      metadata: input.metadata || {},
    }),
  });
}

export async function fetchFunds(): Promise<Fund[]> {
  const response = await fetch("/api/funds", { credentials: "include" });
  if (response.status === 401) return [];
  if (!response.ok) throw new Error(`${response.status}: ${response.statusText}`);
  return response.json();
}

export async function fetchFund(id: string): Promise<Fund | null> {
  const response = await fetch(`/api/funds/${id}`, { credentials: "include" });
  if (response.status === 401 || response.status === 404) return null;
  if (!response.ok) throw new Error(`${response.status}: ${response.statusText}`);
  return response.json();
}

export async function fetchFundEvents(fundId: string): Promise<Event[]> {
  const response = await fetch(`/api/funds/${fundId}/events`, { credentials: "include" });
  if (response.status === 401) return [];
  if (!response.ok) throw new Error(`${response.status}: ${response.statusText}`);
  return response.json();
}

export async function fetchFundHoldings(fundId: string): Promise<Holding[]> {
  const response = await fetch(`/api/funds/${fundId}/holdings`, { credentials: "include" });
  if (response.status === 401) return [];
  if (!response.ok) throw new Error(`${response.status}: ${response.statusText}`);
  return response.json();
}

export async function fetchFundGifts(fundId: string): Promise<Gift[]> {
  const response = await fetch(`/api/funds/${fundId}/gifts`, { credentials: "include" });
  if (response.status === 401) return [];
  if (!response.ok) throw new Error(`${response.status}: ${response.statusText}`);
  return response.json();
}

export async function createFund(data: Partial<InsertFund>): Promise<Fund> {
  return apiRequest<Fund>("/api/funds", {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export async function updateFund(id: string, data: Partial<InsertFund>): Promise<Fund> {
  return apiRequest<Fund>(`/api/funds/${id}`, {
    method: "PATCH",
    body: JSON.stringify(data),
  });
}

export async function updateInvestmentPreferences(fundId: string, data: InvestmentPreferencesUpdate) {
  return apiRequest(`/api/funds/${fundId}/investment-preferences`, {
    method: "PATCH",
    body: JSON.stringify(data),
  });
}
