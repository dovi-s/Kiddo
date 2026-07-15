import { useQuery } from "@tanstack/react-query";

// Client-readable feature flags (server whitelist at GET /api/feature-flags/public).
// Display-gating ONLY — never a security boundary; the server re-checks the flag on
// every gated endpoint. Defaults every flag OFF so a flag-gated surface stays hidden
// until the server says otherwise (a stale-off is the safe direction). Cached a few
// minutes since flags change rarely.
export type PublicFlags = {
  recurring_card_update: boolean;
};

const DEFAULTS: PublicFlags = {
  recurring_card_update: false,
};

export function usePublicFlags(): PublicFlags {
  const { data } = useQuery<PublicFlags>({
    queryKey: ["/api/feature-flags/public"],
    staleTime: 5 * 60 * 1000,
  });
  return { ...DEFAULTS, ...(data || {}) };
}
