// SuccessorCustodianCard — UTMA's "what happens if you die before
// the kid turns 18" slot.
//
// Extracted from Settings.tsx's Child tab (was lines ~4384-4578) on
// 2026-05-14 as Phase 2 chunk 1. Five useState slots that previously
// lived in the giant Settings() function now live on this self-
// contained component instead. Settings.tsx mounts this directly
// inside the Child tab. (The chunk 10 FundSettingsSheet that
// originally would have also mounted this from Dashboard was
// removed 2026-05-15 — the per-fund settings entry now lives only
// on /settings, per the WHO/HOW IA principle.)
//
// Schema + PATCH endpoint + activity logging all already exist (the
// AddFundSheet flow at fund creation populates these). Was missing
// the post-creation edit surface in Settings — a parent whose
// chosen successor moves away, divorces, or dies needed a way to
// update. This is that surface.
//
// Server contract: PATCH /api/funds/:id with fields
// successorCustodianName / successorCustodianEmail /
// successorCustodianRelation. successorCustodianAddedAt stamped
// only on FIRST set; subsequent edits preserve the original stamp
// so the legal trail tracks first-set, not most-recent-edit.

import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { toast } from "@/hooks/use-toast";
import { haptic } from "@/lib/haptics";

// Local SectionCard mirroring the one Settings.tsx defines. Keeping a
// local copy avoids exporting Settings's internal helper from a 5900-
// line file; the styling is small enough that duplication beats the
// cross-module coupling. If multiple extracted cards eventually need
// this, move it into components/ui/section-card.tsx.
function SectionCard({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return (
    <section className={`rounded-2xl border border-[hsl(var(--kiddo-border))] bg-card ${className}`}>
      {children}
    </section>
  );
}

type SuccessorFundShape = {
  id?: string;
  recipientFirstName?: string | null;
  majorityAge?: number | null;
  successorCustodianName?: string | null;
  successorCustodianEmail?: string | null;
  successorCustodianRelation?: string | null;
};

export function SuccessorCustodianCard({ fund }: { fund: SuccessorFundShape }) {
  const queryClient = useQueryClient();

  const currentName = String(fund.successorCustodianName || "").trim();
  const currentEmail = String(fund.successorCustodianEmail || "").trim();
  const currentRelation = String(fund.successorCustodianRelation || "").trim();
  const childFirst = fund.recipientFirstName || "your child";
  // State-specific majority age for "before {child} turns {N}" copy.
  const primaryMajorityAge = Number(fund.majorityAge) || 18;

  const [editOpen, setEditOpen] = useState(false);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [relation, setRelation] = useState("");
  const [saving, setSaving] = useState(false);

  const openEditor = () => {
    haptic("light");
    setName(currentName);
    setEmail(currentEmail);
    setRelation(currentRelation);
    setEditOpen(true);
  };

  const handleSave = async () => {
    if (!fund.id) return;
    const trimmedName = name.trim();
    if (!trimmedName) {
      toast({ title: "Name required", description: "Add a name for the successor custodian.", variant: "destructive" });
      return;
    }
    setSaving(true);
    try {
      const res = await fetch(`/api/funds/${fund.id}`, {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          successorCustodianName: trimmedName,
          successorCustodianEmail: email.trim() || null,
          successorCustodianRelation: relation.trim() || null,
          // Stamp the added-at on a NEW designation; preserve the
          // original stamp on edits so the legal trail tracks
          // first-set, not most-recent-edit.
          ...(currentName ? {} : { successorCustodianAddedAt: new Date().toISOString() }),
        }),
      });
      if (!res.ok) throw new Error("save failed");
      haptic("success");
      toast({ title: currentName ? "Successor updated" : "Successor saved", description: `${trimmedName} will step in if anything happens to you.` });
      setEditOpen(false);
      await queryClient.invalidateQueries({ queryKey: ["/api/funds"] });
    } catch {
      haptic("error");
      toast({ title: "Couldn't save", description: "Try again in a moment.", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const handleRemove = async () => {
    if (!fund.id) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/funds/${fund.id}`, {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          successorCustodianName: null,
          successorCustodianEmail: null,
          successorCustodianRelation: null,
        }),
      });
      if (!res.ok) throw new Error("remove failed");
      haptic("success");
      toast({ title: "Successor removed" });
      setEditOpen(false);
      await queryClient.invalidateQueries({ queryKey: ["/api/funds"] });
    } catch {
      haptic("error");
      toast({ title: "Couldn't remove", description: "Try again in a moment.", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  return (
    <SectionCard>
      <div className="p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold text-foreground">Successor custodian</p>
            {currentName ? (
              <>
                <p className="mt-1 text-sm text-muted-foreground leading-relaxed">
                  {currentName} will step in if anything happens to you before {childFirst} turns {primaryMajorityAge}.
                </p>
                {(currentEmail || currentRelation) && (
                  <p className="mt-0.5 text-xs text-muted-foreground/70">
                    {[currentRelation, currentEmail].filter(Boolean).join(" · ")}
                  </p>
                )}
              </>
            ) : (
              <p className="mt-1 text-sm text-muted-foreground leading-relaxed">
                Name someone to manage {childFirst}'s fund if anything happens to you before {childFirst} turns {primaryMajorityAge}.
              </p>
            )}
          </div>
          {!editOpen && (
            <button
              type="button"
              onClick={openEditor}
              className="shrink-0 rounded-lg border border-[hsl(var(--kiddo-border))] px-3 py-1.5 text-xs font-semibold text-foreground hover:bg-muted/40"
              data-testid="button-edit-successor"
            >
              {currentName ? "Edit" : "Add"}
            </button>
          )}
        </div>

        {editOpen && (
          <div className="mt-4 space-y-3 rounded-xl bg-muted/30 p-4">
            <div>
              <label htmlFor="successor-name" className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Name</label>
              <input
                id="successor-name"
                name="successorName"
                type="text"
                autoComplete="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Full name"
                className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
                data-testid="input-successor-name"
              />
            </div>
            <div>
              <label htmlFor="successor-email" className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Email <span className="font-normal normal-case text-muted-foreground/60">(optional)</span></label>
              <input
                id="successor-email"
                name="successorEmail"
                type="email"
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="name@example.com"
                className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
                data-testid="input-successor-email"
              />
            </div>
            <div>
              <label htmlFor="successor-relation" className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Relationship <span className="font-normal normal-case text-muted-foreground/60">(optional)</span></label>
              <input
                id="successor-relation"
                name="successorRelation"
                type="text"
                autoComplete="off"
                value={relation}
                onChange={(e) => setRelation(e.target.value)}
                placeholder="e.g. Sibling, parent, godparent"
                className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
                data-testid="input-successor-relation"
              />
            </div>
            <p className="text-[11px] leading-relaxed text-muted-foreground/70">
              This designation lives in your account record. It does not replace your will. Update your will to formally name this person as successor custodian under your state's UTMA statute.
            </p>
            <div className="flex flex-wrap items-center gap-2 pt-1">
              <Button
                size="sm"
                className="rounded-full"
                onClick={handleSave}
                disabled={saving || !name.trim()}
                data-testid="button-save-successor"
              >
                {saving ? "Saving..." : currentName ? "Update" : "Save"}
              </Button>
              <Button
                size="sm"
                variant="outline"
                className="rounded-full"
                onClick={() => setEditOpen(false)}
                disabled={saving}
              >
                Cancel
              </Button>
              {currentName && (
                <Button
                  size="sm"
                  variant="ghost"
                  className="ml-auto rounded-full text-muted-foreground hover:text-red-600"
                  onClick={handleRemove}
                  disabled={saving}
                  data-testid="button-remove-successor"
                >
                  Remove
                </Button>
              )}
            </div>
          </div>
        )}
      </div>
    </SectionCard>
  );
}
