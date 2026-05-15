// CloseFundCard — the per-fund "close this fund" entry point.
// Relocated 2026-05-14 from the Settings membership tab to the
// Child tab per the WHO/HOW IA principle: close-this-fund is a
// per-fund action (changes one fund's state, not the user's
// identity or billing), so it belongs in a fund-scoped tab.
//
// Extracted into its own component on 2026-05-14 as Phase 2
// sheet-extraction chunk 5. Pure presentation + one onClose
// callback for the in-page close-fund confirmation dialog
// (the dialog stays in Settings — it's a wider surface with
// its own state and submission flow).
//
// Per locked memory (project_cancellation_dark_pattern_avoidance.md
// + project_close_fund_design_lens.md): the close action is
// reversible. Memory Book + audit logs stay intact. Cash stays
// in the fund (separate withdrawal flow). Recurring investments
// cancel. No guilt copy. The card lives at the bottom of the
// Child tab per the standard UX convention that destructive
// actions live at the bottom — out of accidental-tap reach but
// findable when the parent goes looking.

import { Button } from "@/components/ui/button";
import { haptic } from "@/lib/haptics";

function SectionCard({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return (
    <section className={`rounded-2xl border border-[hsl(var(--kiddo-border))] bg-card ${className}`}>
      {children}
    </section>
  );
}

type CloseFundShape = {
  status?: string | null;
  recipientFirstName?: string | null;
};

export function CloseFundCard({
  fund,
  onOpenCloseDialog,
}: {
  fund: CloseFundShape;
  onOpenCloseDialog: () => void;
}) {
  // Don't render at all for already-closed funds. The reopen
  // affordance lives elsewhere (the closed-fund hero on the
  // parent's funds-overview page).
  const isClosed = String(fund?.status || "").toLowerCase() === "closed";
  if (isClosed) return null;

  return (
    <SectionCard className="border-border/60">
      <div className="p-5">
        <h2 className="text-base font-bold text-foreground">Close this fund</h2>
        <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
          Stop accepting gifts to {fund?.recipientFirstName ? `${fund.recipientFirstName}'s` : "this"} fund. The Memory Book and history stay intact, and you can reopen anytime.
        </p>
        <Button
          variant="outline"
          size="sm"
          className="mt-4 rounded-xl"
          onClick={() => { haptic("light"); onOpenCloseDialog(); }}
          data-testid="button-open-close-fund"
        >
          Close fund
        </Button>
      </div>
    </SectionCard>
  );
}
