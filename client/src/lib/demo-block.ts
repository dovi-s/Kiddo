// Demo no-op detector for RAW-fetch mutation handlers.
//
// For demo accounts the server's blockDemoMutations middleware returns
// 200 { demo: true, saved: false, message } WITHOUT persisting. The global
// "not saved in the demo" toast only fires for apiRequest() calls — raw fetch()
// handlers bypass it and (checking only res.ok) would falsely claim success.
//
// Usage in a raw-fetch handler:
//   const res = await fetch(url, { method: "PATCH", ... });
//   if (!res.ok) throw new Error("...");
//   const data = await res.json().catch(() => null);
//   if (demoBlocked(data, toast)) return;   // <-- skip the success branch
//   ...optimistic UI / success toast...
export function demoBlocked(
  data: any,
  toast: (opts: { title: string; description?: string; variant?: "default" | "destructive" }) => void,
): boolean {
  if (isDemoNoop(data)) {
    toast({
      title: "Not saved in the demo",
      description: data.message || "Changes save in your own fund.",
    });
    return true;
  }
  return false;
}

// Bare predicate (no toast) — for non-fetch call sites (e.g. inside a
// react-query mutationFn) that need to detect the demo no-op and react
// without a toast in scope.
export function isDemoNoop(data: any): boolean {
  return !!(data && data.demo === true && data.saved === false);
}

// Error thrown by mutationFns (e.g. the use-events hooks) when the server
// returns a 200 demo no-op { demo:true, saved:false }. Lets the mutation's
// onError / the caller's catch surface the honest "not saved in the demo"
// toast instead of a false success — or a misleading "Could not save" error.
export class DemoBlockedError extends Error {
  readonly demoMessage?: string;
  constructor(message?: string) {
    super(message || "Not saved in the demo");
    this.name = "DemoBlockedError";
    this.demoMessage = message;
  }
}

export function isDemoBlockedError(err: unknown): err is DemoBlockedError {
  return err instanceof DemoBlockedError || (err as any)?.name === "DemoBlockedError";
}

// Toast helper for the DemoBlockedError path — same copy as demoBlocked().
export function toastDemoBlocked(
  err: unknown,
  toast: (opts: { title: string; description?: string; variant?: "default" | "destructive" }) => void,
): boolean {
  if (!isDemoBlockedError(err)) return false;
  toast({
    title: "Not saved in the demo",
    description: (err as DemoBlockedError).demoMessage || "Changes save in your own fund.",
  });
  return true;
}
