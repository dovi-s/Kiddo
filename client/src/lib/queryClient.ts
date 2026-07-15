import { QueryClient, QueryFunction } from "@tanstack/react-query";
import { toast } from "@/hooks/use-toast";

async function throwIfResNotOk(res: Response) {
  if (!res.ok) {
    const text = (await res.text()) || res.statusText;
    throw new Error(`${res.status}: ${text}`);
  }
}

// Demo write-guard surfacing. The server blocks persisting edits from demo-
// account visitors and returns { demo: true, saved: false, message }. Without
// this, a blocked edit would silently no-op and read as "broken." Instead, show
// a SUBTLE toast so the visitor learns the feature works — it just doesn't
// persist in the shared demo, and WOULD in their own fund. Fires only for demo
// accounts (only they get this response shape); real users never see it. Clones
// the response so the caller can still read the body.
async function maybeNotifyDemoBlocked(res: Response): Promise<void> {
  try {
    if (!(res.headers.get("content-type") || "").includes("application/json")) return;
    const body = await res.clone().json();
    if (body && body.demo === true && body.saved === false) {
      toast({
        title: "You're in the demo",
        description:
          body.message || "Changes aren't saved here, but they will be in your own fund.",
      });
    }
  } catch {
    /* non-JSON / already-consumed body — nothing to surface */
  }
}

export async function apiRequest(
  method: string,
  url: string,
  data?: unknown | undefined,
): Promise<Response> {
  const res = await fetch(url, {
    method,
    headers: data ? { "Content-Type": "application/json" } : {},
    body: data ? JSON.stringify(data) : undefined,
    credentials: "include",
  });

  await throwIfResNotOk(res);
  void maybeNotifyDemoBlocked(res);
  return res;
}

type UnauthorizedBehavior = "returnNull" | "throw";
export const getQueryFn: <T>(options: {
  on401: UnauthorizedBehavior;
}) => QueryFunction<T> =
  ({ on401: unauthorizedBehavior }) =>
  async ({ queryKey }) => {
    const res = await fetch(queryKey.join("/") as string, {
      credentials: "include",
    });

    if (unauthorizedBehavior === "returnNull" && res.status === 401) {
      return null;
    }

    await throwIfResNotOk(res);
    return await res.json();
  };

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      queryFn: getQueryFn({ on401: "throw" }),
      refetchInterval: false,
      refetchOnWindowFocus: false,
      staleTime: Infinity,
      retry: false,
    },
    mutations: {
      retry: false,
    },
  },
});
