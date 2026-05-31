// ChildIdentityCard — the "Child" identity card at the top of
// Settings.tsx's Child tab. Photo + name + birthdate + "growing
// since {date}" + Edit-child-details trigger.
//
// Extracted on 2026-05-14 as Phase 2 sheet-extraction chunk 2.
// Owns its own photo-upload state and FileReader+POST plumbing;
// Settings.tsx passes the fund through and a callback for the
// Edit-child-details modal trigger (the modal itself stays in
// Settings since it's a wider surface than this single card).
//
// Server contract: POST /api/funds/:id/child-photo with body
// { dataUrl: "data:image/..." }. Server returns { url: string }.
// On success we optimistically mutate the /api/funds query
// cache so the new URL renders immediately without a refetch.

import { useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Camera } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { haptic } from "@/lib/haptics";
import { capFirst } from "@/lib/format-name";

function SectionCard({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return (
    <section className={`rounded-2xl border border-[hsl(var(--kiddo-border))] bg-card ${className}`}>
      {children}
    </section>
  );
}

type ChildIdentityFundShape = {
  id?: string;
  recipientFirstName?: string | null;
  recipientBirthdate?: string | null;
  createdAt?: string | null;
  childPhotoUrl?: string | null;
};

export function ChildIdentityCard({
  fund,
  onEditChild,
}: {
  fund: ChildIdentityFundShape;
  onEditChild: () => void;
}) {
  const queryClient = useQueryClient();
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file || !fund?.id) return;
    if (!file.type.startsWith("image/")) {
      toast({ title: "Invalid file type", description: "Please choose an image file.", variant: "destructive" });
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      toast({ title: "Photo too large", description: "Please choose an image under 5MB.", variant: "destructive" });
      return;
    }
    setUploading(true);
    try {
      const reader = new FileReader();
      reader.onload = async () => {
        const res = await fetch(`/api/funds/${fund.id}/child-photo`, {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ dataUrl: reader.result }),
        });
        const payload = await res.json().catch(() => ({}));
        if (res.ok) {
          queryClient.setQueryData(["/api/funds"], (old: any[]) =>
            (old || []).map((f: any) => f.id === fund.id ? { ...f, childPhotoUrl: payload.url } : f),
          );
          haptic("success");
          toast({ title: "Photo updated" });
        } else {
          toast({ title: "Could not update photo", description: payload?.error || "Please try a smaller image.", variant: "destructive" });
        }
        setUploading(false);
      };
      reader.readAsDataURL(file);
    } catch {
      toast({ title: "Could not update photo", variant: "destructive" });
      setUploading(false);
    }
  };

  // "Growing for [child] since [Month YYYY]" — the one warm
  // line in the Child identity card. Restrained, factual,
  // sprout-voice. Single line, no chrome around it. Renders
  // only when fund has a real createdAt; no fallback for funds
  // with no creation date (shouldn't happen in practice —
  // defensive).
  const growingSinceLine = (() => {
    const created = fund?.createdAt ? new Date(fund.createdAt) : null;
    if (!created || isNaN(created.getTime())) return null;
    const monthYear = created.toLocaleDateString("en-US", { month: "long", year: "numeric" });
    // Owner mode (the kid now owns the fund post-handoff): drop the third-person
    // "for {child}" — they're viewing their own fund.
    const isOwnerMode = (fund as any)?.accessRole === "owner" && !!(fund as any)?.transferredAt;
    const childName = capFirst(fund?.recipientFirstName);
    return (childName && !isOwnerMode) ? `Growing for ${childName} since ${monthYear}` : `Growing since ${monthYear}`;
  })();

  return (
    <SectionCard>
      <div className="p-5">
        <p className="kiddo-section-label mb-4">Child</p>
        <div className="flex items-center gap-4">
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            disabled={uploading}
            className="relative h-16 w-16 shrink-0 rounded-full overflow-hidden group"
            data-testid="button-change-child-photo"
          >
            {fund?.childPhotoUrl ? (
              <img
                src={fund.childPhotoUrl}
                alt=""
                loading="eager"
                decoding="async"
                fetchPriority="high"
                className="h-full w-full object-cover"
              />
            ) : (
              <div className="flex h-full w-full items-center justify-center bg-[hsl(var(--kiddo-evergreen))] text-2xl font-bold text-white shadow-[inset_0_-8px_16px_rgba(0,0,0,0.14)]">
                {(fund?.recipientFirstName || "?").slice(0, 1).toUpperCase()}
              </div>
            )}
            <div className="absolute inset-0 flex items-center justify-center bg-black/40 opacity-0 transition-opacity group-hover:opacity-100">
              {uploading
                ? <div className="h-4 w-4 animate-spin rounded-full border-2 border-white/60 border-t-white" />
                : <Camera size={18} className="text-white" />}
            </div>
          </button>
          <input ref={inputRef} type="file" accept="image/*" onChange={handleUpload} className="hidden" />
          <div className="min-w-0 flex-1">
            <p className="text-base font-bold text-foreground">
              {capFirst(fund?.recipientFirstName) || <span className="text-muted-foreground">No name added yet</span>}
            </p>
            <p className="mt-0.5 text-sm text-muted-foreground">
              {fund?.recipientBirthdate
                ? new Date(fund.recipientBirthdate).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })
                : "No birthdate added"}
            </p>
            {growingSinceLine && (
              <p className="mt-0.5 text-xs text-muted-foreground" data-testid="text-fund-growing-since">
                {growingSinceLine}
              </p>
            )}
            <button
              type="button"
              className="mt-2 text-sm font-semibold text-[hsl(var(--kiddo-evergreen))]"
              onClick={onEditChild}
              data-testid="button-edit-child-details"
            >
              Edit child details
            </button>
          </div>
        </div>
      </div>
    </SectionCard>
  );
}
