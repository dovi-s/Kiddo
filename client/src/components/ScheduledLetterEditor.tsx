// ScheduledLetterEditor — composer for Prong B sealed letters with
// arbitrary future-delivery dates.
//
// Per project_sealed_letters_implementation_plan.md (locked 2026-05-23),
// Phase 3. The existing NoteEditorSheet handles the canonical at-18
// sealed letter (visibility='kid_at_18', delivered at the kid's
// majority birthday). This component handles the NEW Plus-only case:
// sealed-with-specific-date letters that surface to the kid on the
// exact date the parent picks.
//
// Examples of the intended use:
//   - "Open this on your 13th birthday."
//   - "Open this on graduation day."
//   - "Open this when you get your first job."
//   - "Open this every Mother's Day for the next 18 years." (Phase 5
//     extension; not in MVP — composer creates one letter per save
//     for now)
//
// Design constraints from the implementation plan + the locked
// pricing-v3 design:
//   - Plus-gated: 'sealed' visibility requires Plus/Family/trial on
//     the fund. Free parents get the FeatureWallModal instead of the
//     composer. The Free fallback is the existing at-18 NoteEditorSheet
//     which stays free for text-only entries.
//   - Date picker: native HTML date input for MVP. Minimum date is
//     tomorrow (server validates "future + at least 1 minute out");
//     maximum date is the kid's 100th birthday because beyond that
//     the kid likely won't be around to read it (honest constraint
//     without being morbid in the UI).
//   - Media optional. Text or photo or video or voice — any one is
//     sufficient (matches NoteEditorSheet's media-only-is-fine
//     discipline).
//   - Post-save celebration: warm confirmation showing the exact
//     date the letter will surface to the kid + the years-from-today
//     framing (mirrors NoteEditorSheet's sealed celebration).

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useFramerSheetDrag } from "@/lib/use-framer-sheet-drag";
import { X, CalendarIcon, Lock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { haptic } from "@/lib/haptics";
import { MemoryMediaPicker, EMPTY_MEMORY_MEDIA, type MemoryMediaValue } from "./MemoryMediaPicker";
import { FeatureWallModal } from "@/components/FeatureWallModal";
import { capFirst } from "@/lib/format-name";
import { toast } from "@/hooks/use-toast";
import { demoBlocked } from "@/lib/demo-block";

export type ScheduledLetterEntry = {
  id: string;
  content?: string | null;
  photoUrl?: string | null;
  videoUrl?: string | null;
  audioUrl?: string | null;
  audioTranscript?: string | null;
  deliverAt?: string | null;
  parentSealedSeriesId?: string | null;
};

export type ScheduledLetterEditorProps = {
  open: boolean;
  onClose: () => void;
  fundId: string;
  childName: string;
  parentName: string;
  pronoun?: string | null;
  recipientBirthdate?: string | null;
  /** Whether the parent's fund coverage allows sealed letters (Plus/Family/trial).
   *  When false, the composer renders the FeatureWallModal instead of the form.
   *  Caller should compute this from the fund's coverage state. */
  isPlusOnFund: boolean;
  /** When present, composer reschedules / edits this existing entry instead
   *  of creating a new one. Body + media + deliverAt all pre-populate.
   *  Repeat picker is hidden in edit mode — series-level edits are out
   *  of scope for MVP (cancel-series + write-new is the recommended
   *  pattern). Per project_sealed_letters_implementation_plan.md
   *  follow-on note 2026-05-23. */
  existingEntry?: ScheduledLetterEntry | null;
  onSaved?: () => void;
};

function formatDateForInput(date: Date): string {
  // YYYY-MM-DD — the native date input's expected value format.
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function tomorrowIso(): string {
  const t = new Date();
  t.setDate(t.getDate() + 1);
  return formatDateForInput(t);
}

function maxDateIso(birthdate?: string | null): string {
  // 100 years from the kid's birthdate, or 100 years from today if
  // birthdate is missing. Honest constraint that doesn't read morbid
  // in the UI; just stops the date picker at a sensible far horizon.
  const start = birthdate ? new Date(birthdate) : new Date();
  if (Number.isNaN(start.getTime())) return formatDateForInput(new Date(Date.now() + 100 * 365 * 24 * 60 * 60 * 1000));
  return formatDateForInput(new Date(start.getFullYear() + 100, start.getMonth(), start.getDate()));
}

export function ScheduledLetterEditor({
  open,
  onClose,
  fundId,
  childName,
  parentName,
  pronoun: _pronoun,
  recipientBirthdate,
  isPlusOnFund,
  existingEntry,
  onSaved,
}: ScheduledLetterEditorProps) {
  const isEditMode = !!existingEntry?.id;
  // When editing a series entry, series-level operations (changing the
  // repeat cadence, regenerating future entries) are out of MVP scope.
  // Edit mode only adjusts THIS specific entry's content/media/date.
  // The series stays intact; cancel-series remains the way to wipe
  // and start over with a different cadence.
  const isSeriesEntry = !!existingEntry?.parentSealedSeriesId;
  const [text, setText] = useState("");
  const [media, setMedia] = useState<MemoryMediaValue>(EMPTY_MEMORY_MEDIA);
  const [deliverDate, setDeliverDate] = useState<string>(() => tomorrowIso());
  // Repeat cadence for Prong B Phase 5 yearly-series (locked 2026-05-23).
  // "none" = one-shot letter on the chosen date; "yearly" = server
  // generates one entry per year from the chosen date through the
  // kid's 18th birthday. Future cadences (Mother's Day specifically,
  // every birthday, etc.) extend this enum + the server's series
  // generator.
  const [repeat, setRepeat] = useState<"none" | "yearly">("none");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showCelebration, setShowCelebration] = useState(false);
  const [wallOpen, setWallOpen] = useState(false);

  // Reset state on open. Mirrors NoteEditorSheet's lifecycle pattern.
  // In edit mode, pre-populate from the existing entry.
  useEffect(() => {
    if (open) {
      if (existingEntry) {
        setText(existingEntry.content || "");
        setMedia({
          photoUrl: existingEntry.photoUrl || "",
          videoUrl: existingEntry.videoUrl || "",
          audioUrl: existingEntry.audioUrl || "",
          audioTranscript: existingEntry.audioTranscript || "",
        });
        // Convert ISO timestamp back to YYYY-MM-DD for the date input.
        if (existingEntry.deliverAt) {
          const d = new Date(existingEntry.deliverAt);
          if (!Number.isNaN(d.getTime())) {
            const y = d.getFullYear();
            const m = String(d.getMonth() + 1).padStart(2, "0");
            const day = String(d.getDate()).padStart(2, "0");
            setDeliverDate(`${y}-${m}-${day}`);
          } else {
            setDeliverDate(tomorrowIso());
          }
        } else {
          setDeliverDate(tomorrowIso());
        }
      } else {
        setText("");
        setMedia(EMPTY_MEMORY_MEDIA);
        setDeliverDate(tomorrowIso());
      }
      setRepeat("none");
      setShowCelebration(false);
      setError(null);
      setSaving(false);
      // If Free, surface the wall instead of the form.
      if (!isPlusOnFund) {
        setWallOpen(true);
      }
    }
  }, [open, isPlusOnFund, existingEntry]);

  const safeChildName = (childName || "your kid").trim() || "your kid";
  const displayName = capFirst(safeChildName);
  const hasMedia = !!(media.photoUrl || media.videoUrl || media.audioUrl);
  const canSave = !saving && (text.trim().length > 0 || hasMedia) && deliverDate;

  const formattedDeliveryDate = (() => {
    if (!deliverDate) return null;
    const d = new Date(`${deliverDate}T00:00:00`);
    if (Number.isNaN(d.getTime())) return null;
    return d.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric" });
  })();

  const yearsUntil = (() => {
    if (!deliverDate) return null;
    const d = new Date(`${deliverDate}T00:00:00`).getTime();
    if (Number.isNaN(d)) return null;
    const ms = d - Date.now();
    if (ms <= 0) return null;
    return Math.floor(ms / (365.25 * 24 * 60 * 60 * 1000));
  })();

  async function handleSave() {
    if (!canSave) return;
    setSaving(true);
    setError(null);
    haptic("medium");
    try {
      // Construct the deliverAt as the start of the chosen day in
      // local time, then convert to ISO. The server validates that
      // it's future + at least 1 minute out — both safely satisfied
      // by a tomorrow-or-later date at local-midnight.
      const deliverAtIso = new Date(`${deliverDate}T00:00:00`).toISOString();
      // Edit mode: PATCH the existing entry with new content/media/date.
      // Server's PATCH handler accepts deliverAt rescheduling when the
      // entry is already sealed (per pricing-v3 Phase 2 update endpoint).
      const res = isEditMode
        ? await fetch(`/api/memory/${encodeURIComponent(existingEntry!.id)}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            credentials: "include",
            body: JSON.stringify({
              content: text.trim(),
              photoUrl: media.photoUrl || null,
              videoUrl: media.videoUrl || null,
              audioUrl: media.audioUrl || null,
              audioTranscript: media.audioTranscript || null,
              deliverAt: deliverAtIso,
            }),
          })
        : await fetch(`/api/funds/${fundId}/memory`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            credentials: "include",
            body: JSON.stringify({
              type: "sealed_letter",
              content: text.trim(),
              authorName: parentName || "A parent",
              fundId,
              photoUrl: media.photoUrl || null,
              videoUrl: media.videoUrl || null,
              audioUrl: media.audioUrl || null,
              audioTranscript: media.audioTranscript || null,
              kidVisibility: "sealed",
              deliverAt: deliverAtIso,
              // Server generates the yearly series when repeat='yearly'.
              // None = one-shot. See routes.ts createMemoryEntry handler.
              repeat,
            }),
          });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(typeof data?.error === "string" ? data.error : "Couldn't save the letter. Try again.");
        haptic("error");
        setSaving(false);
        return;
      }
      const data = await res.json().catch(() => null);
      if (demoBlocked(data, toast)) { setSaving(false); return; }
      haptic("success");
      onSaved?.();
      // Edit mode: skip the celebration sheet and close cleanly. The
      // emotional moment IS the act of sealing; rescheduling is
      // housekeeping. Mirrors NoteEditorSheet's pattern of suppressing
      // the celebration on edit-mode saves.
      if (isEditMode) {
        onClose();
      } else {
        setShowCelebration(true);
      }
    } catch {
      setError("Network hiccup. Try again in a moment.");
      haptic("error");
    } finally {
      setSaving(false);
    }
  }

  // If the wall is open (Free parent tried to access the composer),
  // render only the wall — no underlying sheet. When wall closes,
  // also close the sheet so the parent isn't left staring at an
  // empty composer they can't use.
  if (open && !isPlusOnFund) {
    return (
      <FeatureWallModal
        open={wallOpen}
        onClose={() => { setWallOpen(false); onClose(); }}
        featureId="scheduled_sealed_letter"
        requiredTier="plus"
        title={`Schedule a sealed letter for ${displayName}.`}
        body={`Write a letter today and pick the exact date ${displayName} reads it. ${displayName}'s 13th birthday. Graduation. The day they leave for college. Whatever moment you want to be there for. Kiddo+ on the fund unlocks this and unlocks recurring contributions, custom mix, parent-authored media, co-parent access, and unlimited occasions.`}
        upgradePath={`/account?tab=plan&upgrade=starter&fundId=${encodeURIComponent(fundId)}`}
      />
    );
  }

  // Swipe-down-to-dismiss (mobile) — grab the handle at the top of the sheet.
  const { dragProps, handle } = useFramerSheetDrag(onClose);

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            key="sched-scrim"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 bg-black/40 z-[70]"
            onClick={onClose}
          />
          <motion.div
            key="sched-sheet"
            initial={{ y: "100%" }}
            animate={{ y: 0 }}
            exit={{ y: "100%" }}
            transition={{ type: "spring", damping: 32, stiffness: 300 }}
            {...dragProps}
            className="fixed bottom-0 left-0 right-0 z-[71] bg-background rounded-t-[28px] flex flex-col overflow-hidden"
            style={{ maxHeight: "92dvh" }}
            onClick={(e) => e.stopPropagation()}
            data-testid="scheduled-letter-editor"
          >
            {handle}
            {showCelebration ? (
              <div className="flex flex-col items-center text-center px-8 pt-12 pb-10">
                <motion.div
                  initial={{ scale: 0, rotate: -8 }}
                  animate={{ scale: 1, rotate: 0 }}
                  transition={{ type: "spring", stiffness: 220, damping: 14, delay: 0.05 }}
                  className="text-5xl mb-5"
                  aria-hidden
                >
                  🕯️
                </motion.div>
                <motion.h2
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.2, duration: 0.35 }}
                  className="font-heading text-2xl font-bold text-foreground mb-3"
                >
                  Sealed for {displayName}.
                </motion.h2>
                <motion.p
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.32, duration: 0.35 }}
                  className="text-sm text-foreground leading-relaxed max-w-xs mb-2"
                >
                  {displayName} will read this on <span className="font-semibold">{formattedDeliveryDate}</span>.
                </motion.p>
                {yearsUntil !== null && yearsUntil > 0 && (
                  <motion.p
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.44, duration: 0.35 }}
                    className="text-xs text-muted-foreground mb-7"
                  >
                    That's {yearsUntil} {yearsUntil === 1 ? "year" : "years"} from today.
                  </motion.p>
                )}
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 0.56, duration: 0.3 }}
                  className="w-full"
                >
                  <Button
                    className="w-full"
                    onClick={() => { haptic("light"); onClose(); }}
                    data-testid="button-scheduled-letter-done"
                  >
                    Done
                  </Button>
                </motion.div>
              </div>
            ) : (
              <>
                {/* Header */}
                <div className="flex items-start justify-between px-5 pt-5 pb-4 shrink-0">
                  <div className="flex-1 pr-4">
                    <p className="text-base font-bold text-foreground leading-snug">
                      {isEditMode ? `Reschedule letter for ${displayName}.` : `Schedule a letter for ${displayName}.`} 🕯️
                    </p>
                    <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
                      {isEditMode
                        ? `Update the date, content, or media. ${isSeriesEntry ? "This change applies only to this year's letter in the series." : `${displayName} will read it on the date you pick, not before.`}`
                        : `Pick a future date. ${displayName} will read it on that day, not before.`}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={onClose}
                    className="w-8 h-8 rounded-full bg-muted flex items-center justify-center shrink-0"
                    aria-label="Close scheduled letter editor"
                    data-testid="button-close-scheduled-letter"
                  >
                    <X className="w-4 h-4 text-muted-foreground" />
                  </button>
                </div>

                <div className="border-t border-border/40 mx-5 shrink-0" />

                {/* Body */}
                <div className="flex-1 overflow-y-auto px-5 pt-5 pb-4 min-h-0 space-y-5">
                  {/* Date picker — load-bearing for this composer */}
                  <div>
                    <label
                      htmlFor="scheduled-deliver-date"
                      className="flex items-center gap-1.5 text-xs font-semibold text-foreground mb-2"
                    >
                      <CalendarIcon className="w-3.5 h-3.5 text-primary" />
                      When should {displayName} read this?
                    </label>
                    <input
                      id="scheduled-deliver-date"
                      type="date"
                      value={deliverDate}
                      min={tomorrowIso()}
                      max={maxDateIso(recipientBirthdate)}
                      onChange={(e) => setDeliverDate(e.target.value)}
                      className="w-full h-11 rounded-xl border border-border bg-background px-3 text-sm"
                      data-testid="input-scheduled-deliver-date"
                    />
                    {formattedDeliveryDate && (
                      <p className="mt-2 text-xs text-muted-foreground leading-relaxed">
                        Sealed until <span className="font-semibold text-foreground">{formattedDeliveryDate}</span>
                        {yearsUntil !== null && yearsUntil > 0 ? (
                          <> ({yearsUntil} {yearsUntil === 1 ? "year" : "years"} from today)</>
                        ) : null}
                        .
                      </p>
                    )}
                  </div>

                  {/* Repeat picker (Prong B Phase 5, locked 2026-05-23).
                      "Yearly" lets one composer interaction generate
                      one letter per year from the chosen date through
                      the kid's 18th birthday. Use case: "Write this
                      once, deliver every Mother's Day for the next 15
                      years." Cap at 18 entries server-side to bound
                      the worst case. Per
                      project_sealed_letters_implementation_plan.md
                      Phase 5.
                      Hidden in edit mode: changing repeat on an
                      existing entry would imply regenerating the
                      series, which is series-level scope deferred
                      to a future session. */}
                  {!isEditMode && (
                  <div>
                    <label className="text-xs font-semibold text-foreground mb-2 block">
                      Deliver it once, or every year?
                    </label>
                    <div className="flex gap-2">
                      {([
                        { value: "none", label: "Once" },
                        { value: "yearly", label: "Yearly" },
                      ] as const).map((opt) => (
                        <button
                          key={opt.value}
                          type="button"
                          onClick={() => { haptic("selection"); setRepeat(opt.value); }}
                          className={`flex-1 rounded-xl border px-3 py-2 text-xs font-semibold transition-colors ${
                            repeat === opt.value
                              ? "border-primary bg-primary/5 text-primary"
                              : "border-border text-muted-foreground"
                          }`}
                          data-testid={`button-scheduled-repeat-${opt.value}`}
                        >
                          {opt.label}
                        </button>
                      ))}
                    </div>
                    {repeat === "yearly" && (
                      <p className="mt-2 text-xs text-muted-foreground leading-relaxed">
                        We'll generate one sealed letter per year from {formattedDeliveryDate || "the chosen date"} through {displayName}'s 18th birthday. Same content each year. Edit or cancel any individual year, or cancel the whole series.
                      </p>
                    )}
                  </div>
                  )}

                  {/* Letter body */}
                  <div>
                    <label
                      htmlFor="scheduled-letter-text"
                      className="text-xs font-semibold text-foreground mb-2 block"
                    >
                      Write something for {displayName}
                    </label>
                    <textarea
                      id="scheduled-letter-text"
                      value={text}
                      onChange={(e) => setText(e.target.value)}
                      placeholder={`What do you want ${displayName} to know on ${formattedDeliveryDate || "that day"}?`}
                      className="w-full text-sm text-foreground leading-[1.75] bg-transparent resize-none outline-none placeholder:text-muted-foreground/40 min-h-[160px] border border-border rounded-xl px-3 py-2"
                      style={{ fontFamily: "inherit" }}
                      data-testid="textarea-scheduled-letter"
                    />
                  </div>

                  {/* Media composer */}
                  {fundId && (
                    <div className="pt-2 border-t border-border/40">
                      <p className="text-xs font-semibold text-foreground mb-1">
                        Or leave a photo, video, or voice memo.
                      </p>
                      <p className="text-[11px] text-muted-foreground mb-2.5 leading-relaxed">
                        {displayName} hearing your voice or seeing your face on the exact day you picked is the kind of moment nothing else gives them.
                      </p>
                      <MemoryMediaPicker
                        fundId={fundId}
                        value={media}
                        onChange={setMedia}
                        childName={childName}
                        requiresPlus={false}
                      />
                    </div>
                  )}

                  {error && (
                    <p className="text-xs text-destructive" data-testid="scheduled-letter-error">{error}</p>
                  )}
                </div>

                <div className="border-t border-border/40 mx-5 shrink-0" />

                {/* Footer */}
                <div className="px-5 pt-3 pb-4 shrink-0">
                  <Button
                    className="w-full rounded-full text-sm h-11"
                    disabled={!canSave}
                    onClick={handleSave}
                    data-testid="button-save-scheduled-letter"
                  >
                    {saving
                      ? (isEditMode ? "Saving..." : "Sealing...")
                      : (isEditMode ? "Save changes" : "Seal until that day")}
                  </Button>
                  <p className="mt-2 text-[10px] text-muted-foreground/70 text-center leading-snug">
                    <Lock className="inline-block w-2.5 h-2.5 mr-0.5 -mt-0.5" />
                    Hidden from {displayName}'s Kid View until {formattedDeliveryDate || "the chosen day"}. You can edit or reschedule any time before then.
                  </p>
                </div>

                <div style={{ paddingBottom: "env(safe-area-inset-bottom, 0px)" }} />
              </>
            )}
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
