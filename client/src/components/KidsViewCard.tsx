// KidsViewCard — Kid View setup + PIN manager + share-link
// affordances for a fund.
//
// Extracted from Settings.tsx on 2026-05-14 as Phase 2 sheet-
// extraction chunk 8. Owns the kid-view query, the PIN editor
// state, and the share-link copy handler. The card is the one
// inline block in the Child tab whose state machine was densest
// (5 useState slots + 1 useQuery + 2 mutations + 1 auto-open
// effect) — making it a natural extraction target once the
// smaller cards landed.
//
// Per the locked Kid View tier policy: Kid View is FREE across
// all plans. Every kid, regardless of parent's plan, gets the
// full Kid View experience for their fund. The "Lite vs Full"
// framing in prior marketing copy was never implemented in
// code — server endpoints have zero plan checks. The card
// here is purely about PIN + share affordances; no tier gate.
//
// Server contract:
//   GET  /api/funds/:id/kid-view-settings → { enabled, hasPin, pinHint, shareLink }
//   PATCH /api/funds/:id/kid-view-settings { enabled, pin, pinHint }
//   POST /api/funds/:id/kid-view-link → { shareLink }
//
// Auto-open behavior: when the fetched settings show enabled=true
// but no PIN exists, the PIN manager auto-opens. This catches the
// edge case where a fund was upgraded to support Kid View but the
// parent hasn't yet set the PIN — opening the manager surfaces
// the missing piece without a separate banner.

import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { toast } from "@/hooks/use-toast";
import { haptic } from "@/lib/haptics";

function SectionCard({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return (
    <section className={`rounded-2xl border border-[hsl(var(--kiddo-border))] bg-card ${className}`}>
      {children}
    </section>
  );
}

type FundShape = {
  id?: string;
  recipientFirstName?: string | null;
  name?: string | null;
};

type KidViewSettings = {
  enabled?: boolean;
  hasPin?: boolean;
  pinHint?: string | null;
  shareLink?: string | null;
};

export function KidsViewCard({
  fund,
  enabled = true,
}: {
  fund: FundShape;
  /** When false, the underlying query is skipped — useful for sheet
      mounts that want to defer the network call until visible. */
  enabled?: boolean;
}) {
  const { data: kidViewSettings, refetch } = useQuery<KidViewSettings | null>({
    queryKey: ["/api/funds", fund?.id, "kid-view-settings"],
    queryFn: async () => {
      if (!fund?.id) return null;
      const res = await fetch(`/api/funds/${fund.id}/kid-view-settings`, { credentials: "include" });
      if (!res.ok) return null;
      return res.json();
    },
    enabled: enabled && !!fund?.id,
    staleTime: 30_000,
  });

  const [copyingKidLink, setCopyingKidLink] = useState(false);
  const [showPinManager, setShowPinManager] = useState(false);
  const [newPin, setNewPin] = useState("");
  const [newPinHint, setNewPinHint] = useState("");
  const [savingPin, setSavingPin] = useState(false);

  // Auto-open the PIN manager when settings load with enabled but no
  // PIN. Surfaces the missing piece without a separate banner.
  useEffect(() => {
    if (kidViewSettings && !kidViewSettings.hasPin) {
      setShowPinManager(true);
    }
  }, [kidViewSettings]);

  const handleSavePin = async () => {
    if (!fund?.id) return;
    if (newPin.length !== 4 || !/^\d{4}$/.test(newPin)) {
      toast({ title: "PIN must be exactly 4 digits", variant: "destructive" });
      return;
    }
    setSavingPin(true);
    try {
      const res = await fetch(`/api/funds/${fund.id}/kid-view-settings`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ enabled: true, pin: newPin, pinHint: newPinHint }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || "Could not save PIN.");
      haptic("success");
      toast({ title: "PIN saved", description: "Kid's View is active with the new PIN." });
      setNewPin("");
      setNewPinHint("");
      setShowPinManager(false);
      void refetch();
    } catch (err: any) {
      haptic("error");
      toast({ title: "Could not save PIN", description: err.message || "Please try again.", variant: "destructive" });
    } finally {
      setSavingPin(false);
    }
  };

  const handleCopyKidViewLink = async () => {
    if (!fund?.id) return;
    setCopyingKidLink(true);
    try {
      const res = await fetch(`/api/funds/${fund.id}/kid-view-link`, { method: "POST", credentials: "include" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || "Kid View is not set up yet.");
      await navigator.clipboard.writeText(data.shareLink);
      haptic("success");
      toast({ title: "Kid View link copied!", description: "Share this link and PIN with your child." });
      void refetch();
    } catch (err: any) {
      haptic("error");
      toast({ title: "Could not copy link", description: err.message || "Please try again.", variant: "destructive" });
    } finally {
      setCopyingKidLink(false);
    }
  };

  const isActive = !!(kidViewSettings?.enabled && kidViewSettings?.hasPin);

  return (
    <SectionCard>
      <div className="p-4 flex items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm font-semibold text-foreground">
            {fund?.recipientFirstName ? `${fund.recipientFirstName}'s View` : "Kid's View"}
          </p>
          <p className="text-xs text-muted-foreground mt-0.5">
            {isActive ? "Active · PIN protected" : "Not set up yet"}
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {isActive ? (
            <>
              <button
                type="button"
                disabled={copyingKidLink}
                onClick={handleCopyKidViewLink}
                className="text-xs font-semibold text-[hsl(var(--kiddo-evergreen))] hover:opacity-75 transition-opacity px-3 py-1.5 rounded-lg border border-[hsl(var(--kiddo-evergreen)/0.3)] bg-[hsl(var(--kiddo-evergreen)/0.06)]"
              >
                {copyingKidLink ? "Copying..." : "Copy link"}
              </button>
              {kidViewSettings?.shareLink && (
                <>
                  <a
                    href={`mailto:?subject=${encodeURIComponent(`${fund?.recipientFirstName || "Your child"}'s Kiddo fund`)}&body=${encodeURIComponent(`Here's your fund link: ${kidViewSettings.shareLink}\n\nYou'll need the PIN to get in.`)}`}
                    className="text-xs font-semibold text-muted-foreground hover:text-foreground transition-colors px-3 py-1.5 rounded-lg border border-border"
                  >
                    Email
                  </a>
                  <a
                    href={kidViewSettings.shareLink}
                    target="_blank"
                    rel="noreferrer"
                    className="text-xs font-semibold text-muted-foreground hover:text-foreground transition-colors px-3 py-1.5 rounded-lg border border-border"
                  >
                    Open
                  </a>
                </>
              )}
              <button
                type="button"
                onClick={() => { setShowPinManager((v) => !v); setNewPin(""); setNewPinHint(""); haptic("selection"); }}
                className="text-xs font-semibold text-muted-foreground hover:text-foreground transition-colors px-3 py-1.5 rounded-lg border border-border"
              >
                {showPinManager ? "Cancel" : "Edit PIN"}
              </button>
            </>
          ) : (
            <button
              type="button"
              onClick={() => { setShowPinManager(true); haptic("selection"); }}
              className="text-xs font-semibold text-muted-foreground hover:text-foreground transition-colors"
            >
              Set up →
            </button>
          )}
        </div>
      </div>

      {showPinManager && (
        <div className="border-t border-[hsl(var(--kiddo-border))] px-4 py-4 space-y-3">
          {isActive && kidViewSettings?.pinHint && (
            <p className="text-xs text-muted-foreground">
              Current hint: <span className="font-semibold text-foreground">{kidViewSettings.pinHint}</span>
            </p>
          )}
          <div>
            <label htmlFor="kid-view-pin" className="block text-xs font-semibold text-foreground mb-1.5">
              {kidViewSettings?.hasPin ? "New PIN (4 digits)" : "Set a PIN (4 digits)"}
            </label>
            <input
              id="kid-view-pin"
              name="kidViewPin"
              type="text"
              inputMode="numeric"
              pattern="[0-9]*"
              autoComplete="off"
              maxLength={4}
              value={newPin}
              onChange={(e) => setNewPin(e.target.value.replace(/\D/g, "").slice(0, 4))}
              placeholder="e.g. 1234"
              className="h-10 w-full rounded-xl border border-border bg-background px-3 text-sm font-mono tracking-widest"
            />
          </div>
          <div>
            <label htmlFor="kid-view-pin-hint" className="block text-xs font-semibold text-foreground mb-1.5">Hint (optional)</label>
            <input
              id="kid-view-pin-hint"
              name="kidViewPinHint"
              type="text"
              autoComplete="off"
              value={newPinHint}
              onChange={(e) => setNewPinHint(e.target.value.slice(0, 60))}
              placeholder="e.g. your birthday month and day"
              className="h-10 w-full rounded-xl border border-border bg-background px-3 text-sm"
            />
          </div>
          <Button
            className="w-full rounded-xl"
            disabled={savingPin || newPin.length !== 4}
            onClick={handleSavePin}
          >
            {savingPin ? "Saving..." : kidViewSettings?.hasPin ? "Update PIN" : "Enable Kid's View"}
          </Button>
        </div>
      )}
    </SectionCard>
  );
}
