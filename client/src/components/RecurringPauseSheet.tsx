// RecurringPauseSheet — the "pause for a bit?" options sheet for a recurring
// investment: pause / pause / cancel-instead. Extracted so Activity can offer the
// same three-choice flow the dashboard has, instead of a bare toggle. The caller
// wires the actual mutations (pause, cancel) via callbacks, so this stays a dumb,
// shared surface both the dashboard and Activity can render.
//
// Note (matches the dashboard's existing flow): both "Pause for 1 month" and
// "Pause indefinitely" call the SAME onPause — the distinction is framing (a
// gentler "just a month" nudge vs. an open-ended pause), not a scheduled auto-
// resume. Kept identical to the dashboard so the two surfaces behave the same.

import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";

export function RecurringPauseSheet({
  open,
  onClose,
  onPause,
  onCancelInstead,
}: {
  open: boolean;
  onClose: () => void;
  onPause: () => void;
  onCancelInstead: () => void;
}) {
  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) onClose(); }}>
      <DialogContent sheet className="sm:max-w-sm p-0 overflow-hidden" aria-describedby={undefined}>
        <DialogTitle className="sr-only">Pause recurring investment</DialogTitle>
        <div className="p-6 space-y-5">
          <div>
            <p className="text-sm font-medium text-primary">Recurring investment</p>
            <h2 className="mt-1 font-heading text-xl font-semibold text-foreground">Pause for a bit?</h2>
            <p className="mt-2 text-sm text-muted-foreground">
              The fund keeps everything it has. Nothing is lost. Resume whenever you're ready.
            </p>
          </div>

          <div className="space-y-2">
            <button
              type="button"
              className="w-full text-left rounded-2xl border border-border/60 bg-muted/20 px-4 py-3.5 hover:bg-muted/40 transition-colors"
              onClick={onPause}
              data-testid="pause-option-month"
            >
              <p className="text-sm font-semibold text-foreground">Pause for 1 month</p>
              <p className="text-xs text-muted-foreground mt-0.5">Come back and resume when the month is up.</p>
            </button>

            <button
              type="button"
              className="w-full text-left rounded-2xl border border-border/60 bg-muted/20 px-4 py-3.5 hover:bg-muted/40 transition-colors"
              onClick={onPause}
              data-testid="pause-option-indefinite"
            >
              <p className="text-sm font-semibold text-foreground">Pause indefinitely</p>
              <p className="text-xs text-muted-foreground mt-0.5">Resume from this screen whenever you're ready.</p>
            </button>

            <button
              type="button"
              className="w-full text-left rounded-2xl border border-red-200/60 bg-red-50/40 px-4 py-3.5 hover:bg-red-50/80 transition-colors"
              onClick={onCancelInstead}
              data-testid="pause-option-cancel"
            >
              <p className="text-sm font-semibold text-red-600">Cancel instead</p>
              <p className="text-xs text-muted-foreground mt-0.5">Stop permanently. You can always set up a new one.</p>
            </button>
          </div>

          <button
            type="button"
            className="w-full text-center text-xs text-muted-foreground hover:text-foreground transition-colors pt-1"
            onClick={onClose}
          >
            Keep it running
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
