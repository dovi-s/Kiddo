// LegalDocumentsCard — two-row links to Tax documents and Legal
// disclosures. Read-only navigation, no per-fund state.
//
// Extracted from Settings.tsx on 2026-05-14 as Phase 2 sheet-
// extraction chunk 6. Smallest extraction in the series — just
// two links — but moves the prefetch wiring along with the
// surface so Settings.tsx no longer needs to know about
// prefetchTaxDocuments or the active-fund id for that surface.
//
// The Tax-documents row prefetches the tax-documents query on
// hover/touch/focus so the eventual click feels instant. Same
// pattern used elsewhere for idle-time + intent-based prefetch.

import { Link } from "wouter";
import { useQueryClient } from "@tanstack/react-query";
import { getActiveFundId } from "@/hooks/use-active-fund";
import { prefetchTaxDocuments } from "@/lib/prefetch";

function SectionCard({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return (
    <section className={`rounded-2xl border border-[hsl(var(--kiddo-border))] bg-card ${className}`}>
      {children}
    </section>
  );
}

export function LegalDocumentsCard() {
  const queryClient = useQueryClient();

  return (
    <SectionCard>
      <div className="divide-y divide-[hsl(var(--kiddo-border))]">
        <Link
          href="/tax-documents"
          className="flex items-center justify-between gap-4 p-4 hover:bg-muted/30 transition-colors"
          onMouseEnter={() => prefetchTaxDocuments(queryClient, getActiveFundId())}
          onTouchStart={() => prefetchTaxDocuments(queryClient, getActiveFundId())}
          onFocus={() => prefetchTaxDocuments(queryClient, getActiveFundId())}
        >
          <span className="text-sm text-muted-foreground">Tax documents</span>
          <span className="text-sm font-semibold text-foreground">View</span>
        </Link>
        <Link href="/legal" className="flex items-center justify-between gap-4 p-4 hover:bg-muted/30 transition-colors">
          <span className="text-sm text-muted-foreground">Legal</span>
          <span className="text-sm font-semibold text-foreground">Disclosures</span>
        </Link>
      </div>
    </SectionCard>
  );
}
