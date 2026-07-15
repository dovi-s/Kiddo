// Idle auto-logout for signed-in (non-demo) users.
//
// Most valuable on a SHARED FAMILY DEVICE: if the app is left untouched, we warn
// with a countdown, then sign out and destroy the server session (the logout
// endpoint clears it). An ACTIVE user never sees this — any input resets the
// timer — and the warning offers a one-click "Stay signed in", so it doesn't
// fight the relationship-product intent that active users stay logged in.
//
// This is an ADDITIVE shared-device-safety / UX layer, NOT the core security
// mechanism: dangerous actions (money movement, SSN/PII) are still gated by
// step-up re-auth at custody time. See SECURITY_SESSION_PLAN.md. Sessions stay
// rolling-30-day server-side; this just adds a client idle gate on top.
//
// Demo accounts are excluded (the demo is a sandbox; logging an explorer out
// mid-tour is pointless). Public/unauthenticated pages have no session to time
// out, so the component self-gates on isAuthenticated.
//
// Cross-tab: last-activity is mirrored to localStorage (throttled), so being
// active in one tab keeps every tab signed in, and extending in one tab closes
// the warning in the others.

import { useEffect, useRef, useState, useCallback } from "react";
import { useAuth } from "@/hooks/use-auth";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { ShieldCheck } from "lucide-react";

// Tunable: total idle before sign-out, and how long before that the warning
// shows. 20 min is a balance for a financial app on shared devices without
// being bank-aggressive; the warning + extend protect active users. Change here.
const IDLE_LIMIT_MS = 20 * 60 * 1000;
const WARNING_MS = 2 * 60 * 1000;

const ACTIVITY_KEY = "kiddo.lastActivity.v1";
const WRITE_THROTTLE_MS = 5000; // don't write localStorage on every mousemove
const ACTIVITY_EVENTS = ["mousedown", "keydown", "touchstart", "scroll", "wheel", "mousemove"] as const;

export function IdleLogout() {
  const { isAuthenticated, user, logout } = useAuth();
  const isDemo = Boolean((user as any)?.isDemoAccount);
  const enabled = isAuthenticated && !isDemo;

  const [warnOpen, setWarnOpen] = useState(false);
  const [secondsLeft, setSecondsLeft] = useState(0);

  const lastActivityRef = useRef(Date.now());
  const lastWriteRef = useRef(0);
  const warnOpenRef = useRef(false);
  const loggedOutRef = useRef(false);
  warnOpenRef.current = warnOpen;

  // Cross-tab last-activity = max(this tab's, any tab's stored stamp).
  const readLastActivity = useCallback(() => {
    try {
      const stored = Number(window.localStorage.getItem(ACTIVITY_KEY) || 0);
      return Math.max(lastActivityRef.current, Number.isFinite(stored) ? stored : 0);
    } catch {
      return lastActivityRef.current;
    }
  }, []);

  const markActivity = useCallback((force = false) => {
    const now = Date.now();
    lastActivityRef.current = now;
    if (force || now - lastWriteRef.current > WRITE_THROTTLE_MS) {
      lastWriteRef.current = now;
      try { window.localStorage.setItem(ACTIVITY_KEY, String(now)); } catch { /* ignore */ }
    }
  }, []);

  const extend = useCallback(() => {
    markActivity(true);
    setWarnOpen(false);
  }, [markActivity]);

  const signOutNow = useCallback(() => {
    if (loggedOutRef.current) return;
    loggedOutRef.current = true;
    setWarnOpen(false);
    try { window.localStorage.removeItem(ACTIVITY_KEY); } catch { /* ignore */ }
    logout();
  }, [logout]);

  // Activity listeners — only reset the timer while the warning is CLOSED. Once
  // the warning shows, presence must be confirmed explicitly so a stray
  // mousemove on an abandoned device can't silently keep the session alive.
  useEffect(() => {
    if (!enabled) return;
    markActivity(true);
    const onActivity = () => { if (!warnOpenRef.current) markActivity(); };
    for (const ev of ACTIVITY_EVENTS) window.addEventListener(ev, onActivity, { passive: true });
    return () => { for (const ev of ACTIVITY_EVENTS) window.removeEventListener(ev, onActivity); };
  }, [enabled, markActivity]);

  // The clock — one interval, timestamp-based so it survives tab throttling
  // (a backgrounded tab that wakes recomputes elapsed time correctly).
  useEffect(() => {
    if (!enabled) { setWarnOpen(false); return; }
    loggedOutRef.current = false;
    const tick = () => {
      const remaining = IDLE_LIMIT_MS - (Date.now() - readLastActivity());
      if (remaining <= 0) {
        signOutNow();
      } else if (remaining <= WARNING_MS) {
        setWarnOpen(true);
        setSecondsLeft(Math.ceil(remaining / 1000));
      } else if (warnOpenRef.current) {
        setWarnOpen(false); // another tab extended → close our warning
      }
    };
    tick();
    const id = window.setInterval(tick, 1000);
    return () => window.clearInterval(id);
  }, [enabled, readLastActivity, signOutNow]);

  if (!enabled || !warnOpen) return null;

  const mm = Math.floor(secondsLeft / 60);
  const ss = String(Math.max(0, secondsLeft % 60)).padStart(2, "0");

  return (
    <Dialog open={warnOpen} onOpenChange={(o) => { if (!o) extend(); }}>
      <DialogContent className="max-w-sm w-[95vw] max-h-[90dvh] overflow-y-auto rounded-2xl" data-testid="idle-logout-warning">
        <DialogHeader>
          <div className="mx-auto mb-1 flex h-11 w-11 items-center justify-center rounded-full bg-[hsl(var(--kiddo-evergreen)/0.10)]">
            <ShieldCheck className="h-5 w-5 text-[hsl(var(--kiddo-evergreen))]" />
          </div>
          <DialogTitle className="text-center">Still there?</DialogTitle>
          <DialogDescription className="text-center">
            For your security, you'll be signed out in {mm}:{ss}.
          </DialogDescription>
        </DialogHeader>
        <div className="mt-2 flex flex-col gap-2">
          <Button onClick={extend} className="w-full" data-testid="idle-stay-signed-in">
            Stay signed in
          </Button>
          <Button variant="ghost" onClick={signOutNow} className="w-full" data-testid="idle-sign-out-now">
            Sign out
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
