// One EventSource per tab, many subscribers.
//
// Why a context: before this, each surface that cared about realtime
// (Dashboard, NotificationsPanel, future bell badges) had to manage its
// own EventSource. Opening two SSE connections per tab is wasteful, and
// at scale every reverse-proxy adds connection-count pressure. So we
// hoist a single EventSource into a provider near the top of the tree;
// surfaces register handlers via `useRealtimeEvents`.
//
// Auth coupling: the provider opens the stream only when the auth query
// resolves with a signed-in user. Signed-out tabs hold no connection.
// On logout the user query goes null and the effect closes the stream;
// on subsequent login it reopens.
//
// What the provider does NOT do:
//   - Show a "connection lost" banner. Polling fallback handles staleness.
//   - Cache events. Each new subscriber only sees events AFTER it
//     subscribes; nothing replays. Same model as DOM event listeners.
//   - Track per-fund interest. Subscribers filter on event type and
//     whichever ids they care about (Dashboard branches on fundId ===
//     activeFundId; NotificationsPanel listens to every gift.arrived
//     regardless of fund). This keeps the provider trivially simple.

import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { useAuth } from "@/hooks/use-auth";

export type RealtimeEvent =
  | { type: "gift.arrived"; fundId: string; giftId: string }
  | { type: "fund.updated"; fundId: string }
  | { type: "fund.activated"; fundId: string }
  | { type: "subscription.updated"; userId?: string };

type Handler = (event: RealtimeEvent) => void;

type RealtimeContextValue = {
  /**
   * Register an event handler. Returns an unsubscribe function — call it
   * on component unmount (the provided hook does this for you). The
   * handler identity is captured via ref so re-renders don't re-register.
   */
  subscribe: (handler: Handler) => () => void;
  /**
   * True when the provider believes the stream is open. Used by the
   * admin ops panel only; user-facing surfaces never branch on this.
   */
  connected: boolean;
};

const RealtimeContext = createContext<RealtimeContextValue | null>(null);

export function RealtimeProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const userId = user?.id ?? null;
  const handlersRef = useRef<Set<Handler>>(new Set());
  const [connected, setConnected] = useState(false);

  useEffect(() => {
    if (!userId) {
      setConnected(false);
      return;
    }
    if (typeof window === "undefined") return;
    if (typeof window.EventSource === "undefined") return;

    let es: EventSource | null = null;
    let closed = false;

    const dispatch = (event: RealtimeEvent) => {
      // Snapshot the handler set before iterating so a handler that
      // unsubscribes during dispatch doesn't mutate a live iterator.
      const snapshot = Array.from(handlersRef.current);
      for (const h of snapshot) {
        try {
          h(event);
        } catch (err) {
          // One handler shouldn't break delivery to others. Log and move on.
          console.warn("[realtime] handler threw:", err);
        }
      }
    };

    const open = () => {
      if (closed) return;
      try {
        es = new EventSource("/api/me/events", { withCredentials: true });
      } catch {
        return;
      }
      es.addEventListener("ready", () => setConnected(true));
      es.onopen = () => setConnected(true);
      es.onmessage = (ev: MessageEvent) => {
        try {
          const parsed = JSON.parse(ev.data) as RealtimeEvent;
          dispatch(parsed);
        } catch {
          // Malformed payloads dropped silently — heartbeats arrive as
          // SSE comments and never reach onmessage in the first place.
        }
      };
      es.onerror = () => {
        // Built-in retry handles transient drops. We only flip connected
        // to false so the admin panel can see the gap.
        setConnected(false);
      };
    };

    open();

    // Aggressive reopen on tab focus. EventSource sometimes holds a stale
    // connection after laptop sleep without firing onerror — explicit
    // close-and-reopen catches that.
    const onVisibility = () => {
      if (document.visibilityState !== "visible") return;
      if (es && es.readyState !== EventSource.OPEN) {
        try { es.close(); } catch { /* */ }
        es = null;
        setConnected(false);
        open();
      }
    };
    document.addEventListener("visibilitychange", onVisibility);

    return () => {
      closed = true;
      document.removeEventListener("visibilitychange", onVisibility);
      try { es?.close(); } catch { /* */ }
      es = null;
      setConnected(false);
    };
  }, [userId]);

  const subscribe = (handler: Handler) => {
    handlersRef.current.add(handler);
    return () => {
      handlersRef.current.delete(handler);
    };
  };

  return (
    <RealtimeContext.Provider value={{ subscribe, connected }}>
      {children}
    </RealtimeContext.Provider>
  );
}

/**
 * Subscribe to realtime events for the lifetime of the calling component.
 * The handler reference is stored in a ref so renders don't unsubscribe.
 *
 * Usage:
 *   useRealtimeEvents((event) => {
 *     if (event.type === "gift.arrived" && event.fundId === activeFundId) {
 *       queryClient.invalidateQueries(...);
 *     }
 *   });
 *
 * Safe to call when there's no provider in the tree — the hook becomes a
 * no-op, which keeps consumers from blowing up in places like the public
 * gift-checkout flow that mount outside the authenticated shell.
 */
export function useRealtimeEvents(handler: Handler): void {
  const ctx = useContext(RealtimeContext);
  const handlerRef = useRef(handler);
  useEffect(() => {
    handlerRef.current = handler;
  }, [handler]);
  useEffect(() => {
    if (!ctx) return;
    const wrapped = (event: RealtimeEvent) => handlerRef.current?.(event);
    return ctx.subscribe(wrapped);
  }, [ctx]);
}

/**
 * Connection-health flag for the admin ops panel. Returns false when
 * there's no provider in the tree.
 */
export function useRealtimeConnected(): boolean {
  const ctx = useContext(RealtimeContext);
  return ctx?.connected ?? false;
}
