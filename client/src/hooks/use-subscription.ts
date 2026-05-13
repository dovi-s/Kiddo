import { useQuery } from "@tanstack/react-query";

import type { FundCoverageState, RecommendationState } from "@shared/monetization";
import { LOCAL_CACHE_KEYS, readLocalCache, writeLocalCache } from "@/lib/local-cache";

interface StarterMembership {
  id: string;
  fundId: string;
  status: string;
  billingInterval?: string;
  currentPeriodStart?: string;
  currentPeriodEnd?: string;
  canceledAt?: string | null;
  stripeSubscriptionId?: string | null;
}

interface Subscription {
  id?: string;
  plan: string;
  effectivePlan?: "free" | "trial" | "starter" | "family" | "legacy";
  recommendationState?: RecommendationState;
  billingInterval?: string;
  status: string;
  currentPeriodStart?: string;
  currentPeriodEnd?: string;
  stripeSubscriptionId?: string;
  createdAt?: string;
  starterFundCount?: number;
  starterMemberships?: StarterMembership[];
  starterByFund?: Record<string, StarterMembership>;
  coverageByFund?: Record<string, FundCoverageState>;
  familyAnnualOptions?: number[];
  activeFamilyYearlyPrice?: number;
  activeLegacyYearlyPrice?: number;
  legacyIncludedOccasionCredits?: number;
}

async function fetchSubscription(): Promise<Subscription> {
  const response = await fetch("/api/subscription", { credentials: "include" });
  if (response.status === 401) return { plan: "free", status: "active" };
  if (!response.ok) throw new Error(`${response.status}: ${response.statusText}`);
  return response.json();
}

export function useSubscription() {
  return useQuery<Subscription>({
    queryKey: ["/api/subscription"],
    queryFn: async () => {
      const subscription = await fetchSubscription();
      writeLocalCache(LOCAL_CACHE_KEYS.subscription, subscription);
      return subscription;
    },
    initialData: () => readLocalCache<Subscription>(LOCAL_CACHE_KEYS.subscription),
    initialDataUpdatedAt: 0,
    retry: false,
    staleTime: 5 * 60_000,
    refetchOnMount: true,
    refetchOnWindowFocus: false,
  });
}
