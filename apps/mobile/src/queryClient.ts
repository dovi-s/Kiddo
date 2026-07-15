import { QueryClient } from "@tanstack/react-query";

// Single shared query client for the whole app. Tuned for a mobile,
// occasionally-connected client: short stale window so balances feel
// live, one retry (the api layer already surfaces auth/network errors),
// and no refetch-on-focus storm when the app foregrounds (the SSE
// realtime stream + pull-to-refresh own that job).
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      staleTime: 30_000,
      gcTime: 5 * 60_000,
      refetchOnReconnect: true,
    },
  },
});
