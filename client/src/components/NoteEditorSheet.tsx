import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useFramerSheetDrag } from "@/lib/use-framer-sheet-drag";
import { X, ChevronDown, ChevronUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { haptic } from "@/lib/haptics";
import { MemoryMediaPicker, EMPTY_MEMORY_MEDIA, type MemoryMediaValue } from "./MemoryMediaPicker";
import { getPronouns, type Pronouns } from "@/lib/pronouns";
import { capFirst } from "@/lib/format-name";
import { toast } from "@/hooks/use-toast";
import { demoBlocked } from "@/lib/demo-block";

// Prompts factory — parameterized on fund pronouns so "What you hope she
// does with it" becomes "What you hope they do with it" for they/them
// kids, "What you hope he does with it" for he/him kids. Verb agreement
// pulled from pronouns.singular. Locked rule:
// feedback_no_marketing_teaser_quotes.md ("every user-visible pronoun
// must use getPronouns()").
function buildPrompts(p: Pronouns): string[] {
  const verb = (singularForm: string, pluralForm: string) =>
    p.singular ? singularForm : pluralForm;
  return [
    "Why you started this fund.",
    `What you hope ${p.subject} ${verb("does", "do")} with it.`,
    `What you want ${p.object} to know about money.`,
    `What you want ${p.object} to know about ${p.reflexive}.`,
    `What you were doing when ${p.subject} ${verb("was", "were")} born.`,
    `What you hope ${p.possAdj} life looks like at 30.`,
    "Who gifted the most, and why that matters.",
    "What the world looked like when you started.",
    "What you sacrificed to keep it growing.",
    `What you want ${p.object} to feel when ${p.subject} ${verb("reads", "read")} this.`,
  ];
}

interface MemoryEntry {
  id: string;
  content: string;
  type: string;
  authorName?: string;
  photoUrl?: string | null;
  videoUrl?: string | null;
  audioUrl?: string | null;
  audioTranscript?: string | null;
}

interface NoteEditorSheetProps {
  open: boolean;
  onClose: () => void;
  fundId: string;
  childName: string;
  parentName: string;
  /** Fund's pronoun setting ("he" / "she" / "they"). Defaults to they/them when omitted. */
  pronoun?: string | null;
  /** State-specific UTMA majority age (18-21). Defaults to 18 when omitted. */
  majorityAge?: number;
  /**
   * Kid's birthdate as an ISO string. Used by the post-save 'sealed'
   * celebration to compute the exact date the kid will be able to
   * read the letter (birthdate + majorityAge years). When omitted,
   * the celebration falls back to a generic "on their Nth birthday"
   * framing without a specific date.
   */
  recipientBirthdate?: string | null;
  existingEntry?: MemoryEntry | null;
  onSaved?: () => void;
  /**
   * Whether the fund's parent is on Free (gates the media picker
   * to Kiddo+). Caller computes this — most Dashboard usage threads
   * the fund-aware plan check (account-level Plus OR per-fund Plus
   * membership). Gifter-authored Memory Book entries via GiftCheckout
   * are unaffected; this gate applies only to PARENT-authored entries.
   */
  requiresPlus?: boolean;
}

export function NoteEditorSheet({
  open,
  onClose,
  fundId,
  childName,
  parentName,
  pronoun,
  majorityAge,
  recipientBirthdate,
  requiresPlus = false,
  existingEntry,
  onSaved,
}: NoteEditorSheetProps) {
  // Pronouns + majority-age, both state-aware. The PROMPTS list and the
  // "She'll read this on her 18th birthday" copy below both pull from
  // these. Defaults align with getPronouns() and the universal UTMA
  // default of 18.
  const fundPronouns = getPronouns(pronoun);
  const PROMPTS = buildPrompts(fundPronouns);
  const safeMajorityAge = majorityAge && majorityAge > 0 ? majorityAge : 18;
  const majorityOrdinal = (() => {
    const n = safeMajorityAge;
    const lastTwo = n % 100;
    if (lastTwo >= 11 && lastTwo <= 13) return `${n}th`;
    const lastOne = n % 10;
    if (lastOne === 1) return `${n}st`;
    if (lastOne === 2) return `${n}nd`;
    if (lastOne === 3) return `${n}rd`;
    return `${n}th`;
  })();
  // capFirst imported from shared format-name helper.
  const reads = fundPronouns.singular ? "reads" : "read";
  const [mode, setMode] = useState<"writing" | "preview">("writing");
  const [text, setText] = useState("");
  const [media, setMedia] = useState<MemoryMediaValue>(EMPTY_MEMORY_MEDIA);
  const [saving, setSaving] = useState(false);
  const [promptsOpen, setPromptsOpen] = useState(false);
  // Post-save 'sealed' celebration state. When true, the sheet
  // renders a calm wax-seal-style confirmation instead of the
  // form. Fires ONLY on first-time letter creation (not on edits)
  // because the emotional moment is the act of sealing, not the
  // act of revising. Added 2026-05-21 per the wow-factor audit:
  // the sealed letter is the single most emotionally heavy action
  // in the product and was previously passing as a silent toast.
  const [showSealedCelebration, setShowSealedCelebration] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (open) {
      setText(existingEntry?.content || "");
      // Load any existing media so the parent can update it without re-recording.
      // Voice especially — re-recording a 5-minute message you already left for
      // your kid would be cruel UX.
      setMedia({
        photoUrl: existingEntry?.photoUrl || "",
        videoUrl: existingEntry?.videoUrl || "",
        audioUrl: existingEntry?.audioUrl || "",
        audioTranscript: existingEntry?.audioTranscript || "",
      });
      setMode("writing");
      setPromptsOpen(false);
      setShowSealedCelebration(false);
    }
  }, [open, existingEntry?.id]);

  // Compute the exact date the kid will be able to read the letter,
  // for the post-save celebration. birthdate + majorityAge years.
  // Returns null when birthdate is missing; the celebration falls
  // back to a generic "on their Nth birthday" framing in that case.
  const readDateInfo = (() => {
    if (!recipientBirthdate) return null;
    const bd = new Date(recipientBirthdate);
    if (!Number.isFinite(bd.getTime())) return null;
    const reads = new Date(bd.getFullYear() + safeMajorityAge, bd.getMonth(), bd.getDate());
    const now = Date.now();
    const msUntil = reads.getTime() - now;
    const yearsUntil = Math.floor(msUntil / (365.25 * 24 * 60 * 60 * 1000));
    return {
      dateLabel: reads.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" }),
      yearsUntil,
      alreadyReadable: msUntil <= 0,
    };
  })();

  const wordCount = text.trim() ? text.trim().split(/\s+/).filter(Boolean).length : 0;
  const name = childName || "them";
  const hasMedia = !!(media.photoUrl || media.videoUrl || media.audioUrl);
  // Allow saving with media-only (a voice note alone is enough) — the
  // emotional artifact this surface is designed for is "Emma at 18 hearing
  // her parent's voice." Forcing text on top of voice is paternalistic.
  const canSave = (text.trim().length > 0 || hasMedia) && !saving;

  async function handleSave() {
    if (!canSave || !fundId) return;
    setSaving(true);
    haptic("medium");
    try {
      let res: Response;
      if (existingEntry?.id) {
        res = await fetch(`/api/memory/${existingEntry.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({
            content: text.trim(),
            photoUrl: media.photoUrl || null,
            videoUrl: media.videoUrl || null,
            audioUrl: media.audioUrl || null,
            audioTranscript: media.audioTranscript || null,
          }),
        });
      } else {
        res = await fetch(`/api/funds/${fundId}/memory`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({
            type: "parent_letter",
            content: text.trim(),
            authorName: parentName || "A parent",
            fundId,
            photoUrl: media.photoUrl || null,
            videoUrl: media.videoUrl || null,
            audioUrl: media.audioUrl || null,
            audioTranscript: media.audioTranscript || null,
            // Reserve for the 18th-birthday reveal — this is the canonical
            // sealed-letter use case. Other Memory Book entries default to
            // kid_now visibility, but the parent letter is THE artifact this
            // visibility column was designed for.
            kidVisibility: "kid_at_18",
          }),
        });
      }
      const data = await res.json().catch(() => null);
      if (demoBlocked(data, toast)) { setSaving(false); return; }
      haptic("success");
      onSaved?.();
      // First-time save fires the sealed celebration; edits just
      // close cleanly. The emotional moment IS the act of sealing
      // (committing to a letter the kid will read at majority);
      // subsequent edits are housekeeping and a quiet close is
      // the right register for those.
      if (!existingEntry?.id) {
        setShowSealedCelebration(true);
      } else {
        onClose();
      }
    } catch {
      haptic("error");
    } finally {
      setSaving(false);
    }
  }

  // Swipe-down-to-dismiss (mobile) — grab the handle at the top of the sheet.
  const { dragProps, handle } = useFramerSheetDrag(onClose);

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            key="note-scrim"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 bg-black/40 z-[70]"
            onClick={onClose}
          />
          <motion.div
            key="note-sheet"
            initial={{ y: "100%" }}
            animate={{ y: 0 }}
            exit={{ y: "100%" }}
            transition={{ type: "spring", damping: 32, stiffness: 300 }}
            {...dragProps}
            className="fixed bottom-0 left-0 right-0 z-[71] bg-background rounded-t-[28px] flex flex-col overflow-hidden"
            style={{ maxHeight: "92dvh" }}
            onClick={(e) => e.stopPropagation()}
          >
            {handle}
            {showSealedCelebration ? (
              <>
                {/* Post-save sealed-letter celebration. Renders ONLY
                    on first-time letter creation (handleSave gates
                    this on !existingEntry?.id). Calm-Apple-Settings
                    register: wax-seal emoji as the anchor, the
                    sealed-until-date as the load-bearing fact, the
                    years-remaining as the emotional weight, a
                    single Done button. No confetti, no marketing
                    rhythm. The moment IS the date. */}
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
                    Sealed for {capFirst(childName) || "your child"}.
                  </motion.h2>
                  <motion.p
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.32, duration: 0.35 }}
                    className="text-sm text-foreground leading-relaxed max-w-xs mb-2"
                  >
                    {readDateInfo
                      ? readDateInfo.alreadyReadable
                        ? `${capFirst(childName) || "Your child"} can read this now.`
                        : <>{capFirst(childName) || "Your child"} {reads} this on <span className="font-semibold">{readDateInfo.dateLabel}</span>, {fundPronouns.possAdj} {majorityOrdinal} birthday.</>
                      : <>{capFirst(childName) || "Your child"} {reads} this on {fundPronouns.possAdj} {majorityOrdinal} birthday.</>
                    }
                  </motion.p>
                  {readDateInfo && !readDateInfo.alreadyReadable && readDateInfo.yearsUntil > 0 && (
                    <motion.p
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.44, duration: 0.35 }}
                      className="text-xs text-muted-foreground mb-7"
                    >
                      That&apos;s {readDateInfo.yearsUntil} {readDateInfo.yearsUntil === 1 ? "year" : "years"} from today.
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
                      onClick={() => {
                        haptic("light");
                        onClose();
                      }}
                      data-testid="button-sealed-letter-done"
                    >
                      Done
                    </Button>
                  </motion.div>
                </div>
              </>
            ) : mode === "writing" ? (
              <>
                {/* Header */}
                <div className="flex items-start justify-between px-5 pt-5 pb-4 shrink-0">
                  <div className="flex-1 pr-4">
                    <p className="text-base font-bold text-foreground leading-snug">
                      Write something for {name}. ✉️
                    </p>
                    <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
                      {capFirst(fundPronouns.subject)}{fundPronouns.singular ? "'ll" : "'ll"} {reads} this on <span className="whitespace-nowrap">{fundPronouns.possAdj} {majorityOrdinal} birthday.</span>
                    </p>
                  </div>
                  <div className="flex items-center gap-3 shrink-0 mt-0.5">
                    {text.trim() && (
                      <button
                        type="button"
                        onClick={() => { haptic("selection"); setMode("preview"); }}
                        className="text-xs font-semibold text-[hsl(var(--kiddo-evergreen))] bg-transparent border-none p-0 cursor-pointer whitespace-nowrap"
                      >
                        Preview →
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={onClose}
                      className="w-8 h-8 rounded-full bg-muted flex items-center justify-center shrink-0"
                      aria-label="Close note editor"
                    >
                      <X className="w-4 h-4 text-muted-foreground" />
                    </button>
                  </div>
                </div>

                <div className="border-t border-border/40 mx-5 shrink-0" />

                {/* Letter area */}
                <div className="flex-1 overflow-y-auto px-5 pt-5 pb-4 min-h-0">
                  <p className="text-sm font-semibold text-muted-foreground mb-3 select-none">
                    Dear {name},
                  </p>
                  <textarea
                    ref={textareaRef}
                    autoFocus
                    value={text}
                    onChange={(e) => setText(e.target.value)}
                    placeholder={`What do you want ${name} to know?`}
                    className="w-full text-sm text-foreground leading-[1.75] bg-transparent resize-none outline-none placeholder:text-muted-foreground/40 min-h-[200px]"
                    style={{ fontFamily: "inherit" }}
                  />

                  {/* Voice / video / photo composer. Voice is the moat per
                      project_giving_flows_full_media.md — the parent letter
                      is the canonical surface for "Emma at 18 hearing her
                      parent's voice from when she was 3." Was previously
                      text-only, which violated the locked rule that all
                      giving flows expose the full media trio. */}
                  {fundId && (
                    <div className="mt-5 pt-4 border-t border-border/40">
                      <p className="text-xs font-semibold text-foreground mb-1">
                        Or leave a voice memory.
                      </p>
                      <p className="text-[11px] text-muted-foreground mb-2.5 leading-relaxed">
                        {name} hearing your voice on {fundPronouns.possAdj} {majorityOrdinal} birthday is the kind of artifact nothing else gives {fundPronouns.object}.
                      </p>
                      <MemoryMediaPicker
                        fundId={fundId}
                        value={media}
                        onChange={setMedia}
                        childName={childName}
                        pronoun={pronoun}
                        majorityAge={safeMajorityAge}
                        requiresPlus={requiresPlus}
                      />
                    </div>
                  )}
                </div>

                <div className="border-t border-border/40 mx-5 shrink-0" />

                {/* Footer: word count + prompts + save */}
                <div className="px-5 pt-3 pb-4 shrink-0">
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-xs text-muted-foreground">
                      {wordCount > 0 ? (
                        <>
                          <span className="font-medium">{wordCount} word{wordCount !== 1 ? "s" : ""}</span>
                          <span className="italic"> · Most parents write 200–300 words.</span>
                        </>
                      ) : (
                        <span className="italic">Most parents write 200–300 words.</span>
                      )}
                    </span>
                    <button
                      type="button"
                      onClick={() => { haptic("selection"); setPromptsOpen(!promptsOpen); }}
                      className="flex items-center gap-1 text-xs text-muted-foreground/60 hover:text-muted-foreground transition-colors"
                    >
                      {promptsOpen ? "Hide prompts" : "Need a prompt?"}
                      {promptsOpen ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                    </button>
                  </div>

                  <AnimatePresence>
                    {promptsOpen && (
                      <motion.div
                        key="prompts"
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: "auto", opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.2 }}
                        className="overflow-hidden"
                      >
                        <div className="bg-muted/50 rounded-2xl px-4 py-3.5 mb-3">
                          <p className="text-xs font-semibold text-foreground mb-2.5">
                            Not sure what to write? Here are some things other parents included:
                          </p>
                          <ul className="space-y-2">
                            {PROMPTS.map((p) => (
                              <li key={p} className="text-xs text-muted-foreground leading-relaxed flex items-start gap-1.5">
                                <span className="text-muted-foreground/50 mt-0.5 shrink-0">·</span>
                                {p}
                              </li>
                            ))}
                          </ul>
                          <p className="text-xs text-muted-foreground/50 italic mt-3">
                            These are just prompts. Write whatever feels right. She'll treasure it forever.
                          </p>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>

                  <Button
                    className="w-full rounded-full text-sm h-11"
                    disabled={!canSave}
                    onClick={handleSave}
                  >
                    {saving ? "Saving..." : existingEntry?.id ? "Update note" : "Save note"}
                  </Button>
                </div>

                <div style={{ paddingBottom: "env(safe-area-inset-bottom, 0px)" }} />
              </>
            ) : (
              /* Preview mode */
              <>
                <div className="flex items-center justify-between px-5 pt-5 pb-4 shrink-0">
                  <button
                    type="button"
                    onClick={() => { haptic("selection"); setMode("writing"); }}
                    className="text-xs font-semibold text-muted-foreground flex items-center gap-1 hover:text-foreground transition-colors"
                  >
                    ← Back to editing
                  </button>
                  <button
                    type="button"
                    onClick={onClose}
                    className="w-8 h-8 rounded-full bg-muted flex items-center justify-center"
                    aria-label="Close note preview"
                  >
                    <X className="w-4 h-4 text-muted-foreground" />
                  </button>
                </div>

                <div className="flex-1 overflow-y-auto px-5 pb-8 min-h-0">
                  <p className="text-xs text-muted-foreground text-center mb-6 leading-relaxed">
                    This is what {name} reads first.<br />
                    Before the balance. Before the Memory Book. Before anything.
                  </p>

                  <div
                    className="rounded-2xl px-6 py-8"
                    style={{ background: "rgb(254,252,243)" }}
                  >
                    <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-widest mb-0.5">
                      From {parentName || "your family"}.
                    </p>
                    <p className="text-xs text-muted-foreground mb-5">Written for you.</p>
                    <div className="border-t border-border/30 mb-6" />
                    <p className="text-sm font-semibold text-foreground mb-4 font-serif">
                      Dear {name},
                    </p>
                    <p className="text-sm text-foreground leading-[1.85] whitespace-pre-wrap break-words">
                      {text}
                    </p>
                  </div>

                  <p className="text-[11px] text-muted-foreground/50 text-center mt-5 italic">
                    {capFirst(fundPronouns.subject)}'ll {reads} it on {fundPronouns.possAdj} {majorityOrdinal} birthday.
                  </p>
                </div>

                <div className="px-5 pb-4 shrink-0">
                  <Button
                    className="w-full rounded-full text-sm h-11"
                    disabled={!canSave}
                    onClick={handleSave}
                  >
                    {saving ? "Saving..." : existingEntry?.id ? "Update note" : "Save note"}
                  </Button>
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
