// PMF survey response surface. The recipient clicks one of three
// links in the Sean Ellis email (server/templates/seanEllisSurvey.ts);
// each link encodes a response value + the recipient's email in URL
// params. This page reads those params, immediately records the
// response, then surfaces an optional "tell us why" note field.
//
// Design discipline (locked 2026-05-26 alongside the launch wedge):
//   - The PRIMARY conversion (response recorded) happens on page
//     load. The recipient already chose in their inbox; the page's
//     job is to confirm + ask the optional follow-up. No second click
//     to submit a response.
//   - Optional note field is separate POST. Submitting empty is fine
//     and dismisses the form.
//   - No Nav, no Footer. This page is reached from an email click;
//     the recipient may not be signed in. We don't push them into the
//     marketing site — the survey is the goal, not pageviews.
//   - Three response values: 'vd' (very disappointed), 'sd' (somewhat
//     disappointed), 'nd' (not disappointed). Same vocabulary the
//     base Sean Ellis test uses since 2010.
//   - Missing email param OR missing response param → friendly error,
//     not a crash. We may eventually link to this page from places
//     other than the email, so it must degrade gracefully.

import { useEffect, useMemo, useState } from "react";
import { useSearch } from "wouter";
import { motion } from "framer-motion";
import { Check } from "lucide-react";

type ResponseCode = "vd" | "sd" | "nd";

const RESPONSE_LABELS: Record<ResponseCode, string> = {
  vd: "Very disappointed",
  sd: "Somewhat disappointed",
  nd: "Not disappointed",
};

export default function PmfSurvey() {
  const search = useSearch();
  const params = useMemo(() => new URLSearchParams(search || ""), [search]);
  const responseCode = params.get("r") as ResponseCode | null;
  const email = params.get("e") || "";

  const [recorded, setRecorded] = useState(false);
  const [recordError, setRecordError] = useState<string | null>(null);
  const [note, setNote] = useState("");
  const [noteSubmitting, setNoteSubmitting] = useState(false);
  const [noteSubmitted, setNoteSubmitted] = useState(false);

  const validResponse = responseCode === "vd" || responseCode === "sd" || responseCode === "nd";
  const hasEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);

  // Record the response on mount. Fire once; the server dedupes by
  // (email, response) so a refresh doesn't double-count.
  useEffect(() => {
    if (!validResponse || !hasEmail || recorded) return;
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/feedback/pmf-survey", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email, response: responseCode }),
        });
        if (!res.ok) {
          if (!cancelled) setRecordError("Couldn't save your response. Try the link in the email again.");
          return;
        }
        if (!cancelled) setRecorded(true);
      } catch {
        if (!cancelled) setRecordError("Network hiccup. Try the link in the email again.");
      }
    })();
    return () => { cancelled = true; };
  }, [validResponse, hasEmail, responseCode, email, recorded]);

  const handleNoteSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (noteSubmitting) return;
    setNoteSubmitting(true);
    try {
      await fetch("/api/feedback/pmf-survey", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, response: responseCode, note: note.trim() }),
      });
      setNoteSubmitted(true);
    } catch {
      // Best-effort. Even if the note fails to save, the response was already recorded.
      setNoteSubmitted(true);
    } finally {
      setNoteSubmitting(false);
    }
  };

  if (!validResponse || !hasEmail) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-6">
        <div className="max-w-md text-center">
          <h1 className="font-heading text-2xl font-semibold text-foreground mb-3">
            This link looks off.
          </h1>
          <p className="text-sm leading-relaxed text-muted-foreground">
            The PMF survey link from our email should include both a response and your email address. Try clicking the link in the email again, or reply to that email instead.
          </p>
        </div>
      </div>
    );
  }

  const responseLabel = RESPONSE_LABELS[responseCode!];

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-6">
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="w-full max-w-lg rounded-3xl border border-border bg-card p-8 shadow-premium-sm"
      >
        <div className="flex items-start gap-3 mb-6">
          <div className="mt-1 flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground">
            <Check size={18} strokeWidth={2.5} />
          </div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Got it
            </p>
            <h1 className="font-heading text-xl font-semibold text-foreground mt-1">
              {responseLabel}.
            </h1>
            <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
              That single tap tells us a lot.
            </p>
          </div>
        </div>

        {recordError && (
          <p className="mb-4 text-xs text-destructive" role="alert" aria-live="polite">
            {recordError}
          </p>
        )}

        {noteSubmitted ? (
          <div className="rounded-2xl border border-primary/20 bg-primary/5 p-5 text-center">
            <p className="text-sm leading-relaxed text-foreground">
              Thanks. We read every reply.
            </p>
          </div>
        ) : (
          <form onSubmit={handleNoteSubmit} className="space-y-3">
            <label htmlFor="pmf-note" className="block text-xs font-medium text-foreground">
              Want to tell us why? (optional)
            </label>
            <textarea
              id="pmf-note"
              rows={4}
              value={note}
              onChange={(e) => setNote(e.target.value)}
              className="w-full rounded-xl border border-border bg-background px-4 py-3 text-sm outline-none focus:border-primary resize-none"
              placeholder="The one thing Kiddo does that nothing else does. Or the thing that's still frustrating."
              data-testid="input-pmf-note"
              maxLength={2000}
            />
            <div className="flex gap-3">
              <button
                type="submit"
                disabled={noteSubmitting}
                className="flex-1 h-11 rounded-xl bg-primary text-primary-foreground text-sm font-semibold disabled:opacity-60"
                data-testid="button-pmf-submit-note"
              >
                {noteSubmitting ? "Sending..." : note.trim() ? "Send" : "Skip"}
              </button>
            </div>
          </form>
        )}
      </motion.div>
    </div>
  );
}
