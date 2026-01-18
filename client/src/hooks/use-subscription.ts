import { useQuery } from "@tanstack/react-query";

interface Subscription {
  id?: string;
  plan: string;
  status: string;
  currentPeriodEnd?: string;
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
    queryFn: fetchSubscription,
    retry: false,
    staleTime: 1000 * 60 * 5,
  });
}
