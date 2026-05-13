// Compact, collapsible media trio (photo / video / voice) that sits next to a
// note textarea in any flow that writes a Memory Book entry. Solves the
// asymmetry where gifters get the full media menu (note + photo + video +
// voice) but parent contributions used to ship with note-only.
//
// Why collapsible: the parent contribution flows (one-time, recurring,
// contribute-now) are designed for SPEED. Inlining four full inputs would
// turn a 30-second action into a form. Three small "+ Add photo / + Add
// video / + Add voice" triggers preserve the fast path for parents who just
// want to deposit, while exposing the moat (voice notes especially) for
// parents who want to leave a richer artifact.
//
// Voice is the moat per the design lens: "Emma at 18 hearing her dad's voice
// from when she was 3 is the unrepeatable artifact nothing else in this
// category offers."
//
// Server contract: photoUrl / videoUrl / audioUrl all accepted by the
// existing /api/funds/:fundId/memory POST and by the gift checkout metadata
// path. No new endpoints needed — this just exposes existing capabilities to
// the parent flows.

import { useRef, useState, useEffect } from "react";
import { Link } from "wouter";
import { Lock, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { haptic } from "@/lib/haptics";
import { getPronouns } from "@/lib/pronouns";

type MediaKind = "photo" | "video" | "voice" | null;

export type MemoryMediaValue = {
  photoUrl: string;
  videoUrl: string;
  audioUrl: string;
  audioTranscript: string;
};

export const EMPTY_MEMORY_MEDIA: MemoryMediaValue = {
  photoUrl: "",
  videoUrl: "",
  audioUrl: "",
  audioTranscript: "",
};

export function MemoryMediaPicker({
  fundId,
  value,
  onChange,
  childName,
  pronoun,
  majorityAge,
  uploadEndpointPrefix = "/api/funds",
  className,
  requiresPlus = false,
}: {
  fundId: string;
  value: MemoryMediaValue;
  onChange: (v: MemoryMediaValue) => void;
  childName?: string | null;
  /** Fund's pronoun setting ("he" / "she" / "they"). Defaults to they/them when omitted. */
  pronoun?: string | null;
  /** State-specific UTMA majority age (18-21). Defaults to 18 when omitted. */
  majorityAge?: number;
  /** Override the upload endpoint family. Defaults to /api/funds/:id/memory/upload-* */
  uploadEndpointPrefix?: string;
  className?: string;
  /**
   * When true, this picker replaces the photo/video/voice trio with a
   * single Kiddo+ upgrade callout. Used in PARENT-authored Memory Book
   * contexts (NoteEditorSheet, Dashboard inline composers) when the
   * fund's parent is on Free. GIFTER-authored contexts (GiftCheckout,
   * GiftSuccess) always leave this false because gifter media is part
   * of the locked retention mechanic — a grandparent attaching a voice
   * memo to a gift should never hit a paywall. The differential is
   * "parent writing their own entry with media" = Plus feature; "gifter
   * attaching media to a gift" = always free.
   */
  requiresPlus?: boolean;
}) {
  // Pronouns + majority-age for the voice-note helper line below. Optional
  // props so existing callers don't break — gifter-facing callers
  // (GiftCheckout, GiftSuccess) typically don't have the fund's
  // pronoun/majorityAge in scope and fall through to the safe defaults
  // (they/them + 18). Parent-facing callers (NoteEditorSheet, Dashboard)
  // pass them through for full state-awareness.
  const fundPronouns = getPronouns(pronoun);
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
  const [openKind, setOpenKind] = useState<MediaKind>(null);
  const [photoUploading, setPhotoUploading] = useState(false);
  const [videoUploading, setVideoUploading] = useState(false);
  const [audioUploading, setAudioUploading] = useState(false);
  const [recording, setRecording] = useState(false);
  const [recordingSeconds, setRecordingSeconds] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const photoInputRef = useRef<HTMLInputElement | null>(null);
  const videoInputRef = useRef<HTMLInputElement | null>(null);
  const audioInputRef = useRef<HTMLInputElement | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const recorderChunksRef = useRef<Blob[]>([]);
  const recordingTickRef = useRef<number | null>(null);

  const hasPhoto = !!value.photoUrl.trim();
  const hasVideo = !!value.videoUrl.trim();
  const hasAudio = !!value.audioUrl.trim();

  // Auto-open the relevant section when a value already exists (e.g., editing
  // a draft) so the parent doesn't have to hunt for what they already added.
  useEffect(() => {
    if (openKind === null) {
      if (hasPhoto) setOpenKind("photo");
      else if (hasVideo) setOpenKind("video");
      else if (hasAudio) setOpenKind("voice");
    }
    // Only on mount — subsequent value changes shouldn't yank focus.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const uploadFile = async (kind: "photo" | "video" | "audio", file: File) => {
    const setUploading = kind === "photo" ? setPhotoUploading : kind === "video" ? setVideoUploading : setAudioUploading;
    // Server enforces these too — the client check just gives faster feedback.
    const sizeCapMb = kind === "photo" ? 3 : kind === "video" ? 25 : 10;
    if (file.size > sizeCapMb * 1024 * 1024) {
      setError(`${kind === "photo" ? "Image" : kind === "video" ? "Video" : "Audio"} too large. Cap is ${sizeCapMb}MB.`);
      return;
    }
    setUploading(true);
    setError(null);
    try {
      // Server contract is JSON { dataUrl: "data:..." } — NOT multipart.
      // Same shape the standalone Memory Book composer uses; matches the
      // existing /api/funds/:fundId/memory/upload-{kind} routes.
      const dataUrl = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result || ""));
        reader.onerror = () => reject(new Error("Could not read file"));
        reader.readAsDataURL(file);
      });
      const res = await fetch(`${uploadEndpointPrefix}/${fundId}/memory/upload-${kind}`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ dataUrl }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || "Upload failed");
      const url = data?.url || data?.photoUrl || data?.videoUrl || data?.audioUrl;
      if (!url) throw new Error("No URL returned");
      if (kind === "photo") onChange({ ...value, photoUrl: String(url) });
      if (kind === "video") onChange({ ...value, videoUrl: String(url) });
      if (kind === "audio") onChange({ ...value, audioUrl: String(url), audioTranscript: data?.transcript || "" });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Upload failed");
    } finally {
      setUploading(false);
    }
  };

  const startRecording = async () => {
    setError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mimeType = MediaRecorder.isTypeSupported("audio/webm") ? "audio/webm" : "audio/mp4";
      const recorder = new MediaRecorder(stream, { mimeType });
      recorderRef.current = recorder;
      recorderChunksRef.current = [];
      recorder.ondataavailable = (e) => { if (e.data.size > 0) recorderChunksRef.current.push(e.data); };
      recorder.onstop = async () => {
        stream.getTracks().forEach((t) => t.stop());
        const blob = new Blob(recorderChunksRef.current, { type: mimeType });
        const ext = mimeType.includes("webm") ? "webm" : "m4a";
        const file = new File([blob], `voice-${Date.now()}.${ext}`, { type: mimeType });
        await uploadFile("audio", file);
      };
      recorder.start();
      setRecording(true);
      setRecordingSeconds(0);
      recordingTickRef.current = window.setInterval(() => {
        setRecordingSeconds((s) => {
          // Soft 60s cap so a single note stays a moment, not an audiobook.
          if (s >= 59) {
            stopRecording();
            return 60;
          }
          return s + 1;
        });
      }, 1000);
      haptic("light");
    } catch {
      setError("Microphone access denied");
    }
  };

  const stopRecording = () => {
    if (recorderRef.current && recorderRef.current.state !== "inactive") {
      recorderRef.current.stop();
    }
    if (recordingTickRef.current) {
      window.clearInterval(recordingTickRef.current);
      recordingTickRef.current = null;
    }
    setRecording(false);
    haptic("light");
  };

  useEffect(() => {
    return () => {
      if (recordingTickRef.current) window.clearInterval(recordingTickRef.current);
      if (recorderRef.current && recorderRef.current.state !== "inactive") {
        recorderRef.current.stop();
      }
    };
  }, []);

  const triggers: { kind: Exclude<MediaKind, null>; label: string; emoji: string; has: boolean }[] = [
    { kind: "photo", label: "Photo", emoji: "📷", has: hasPhoto },
    { kind: "video", label: "Video", emoji: "🎬", has: hasVideo },
    { kind: "voice", label: "Voice", emoji: "🎙", has: hasAudio },
  ];

  // Plus-gate UI. When the parent's fund is on Free AND this picker is
  // mounted in a PARENT-authored context (NoteEditorSheet, Dashboard
  // composers), swap the photo/video/voice trio for a single Kiddo+
  // upgrade callout. The CTA routes to Settings membership tab so the
  // upgrade happens in-app, not on the public Pricing page. Voice gets
  // named explicitly in the body copy because per the design lens it's
  // the moat — "your voice from when she was 3, sealed for her 18th."
  if (requiresPlus) {
    return (
      <div className={className}>
        <div
          className="rounded-2xl border border-primary/20 bg-primary/5 p-4"
          data-testid="memory-media-picker-plus-gate"
        >
          <div className="flex items-start gap-3">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-primary/10">
              <Sparkles size={16} className="text-primary" strokeWidth={1.8} />
            </div>
            <div className="min-w-0 flex-1">
              <p className="flex items-center gap-1.5 text-sm font-semibold text-foreground">
                <Lock size={11} className="opacity-60" />
                <span>Add photos, videos, and voice memos with Kiddo+</span>
              </p>
              <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                {fundPronouns.subject.charAt(0).toUpperCase() + fundPronouns.subject.slice(1)} hearing your voice on {fundPronouns.possAdj} {majorityOrdinal} birthday is the kind of artifact nothing else gives {fundPronouns.object}. Text entries stay free; media unlocks with Kiddo+ ($4.99/month).
              </p>
              <div className="mt-3">
                <Link href="/settings?tab=membership&upgrade=plus">
                  <Button
                    size="sm"
                    className="rounded-xl"
                    onClick={() => haptic("selection")}
                    data-testid="memory-media-picker-upgrade-cta"
                  >
                    Upgrade to Kiddo+
                  </Button>
                </Link>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={className}>
      {/* Trigger row — three pill buttons. Emoji + label is the resting
          state; a small evergreen check appears on the right ONLY when
          something is attached. Earlier the pill carried THREE glyphs
          ("+" or "✓" + emoji + label) which read as visual stutter — the
          "+" was redundant because the pill itself is the affordance to
          add. Now: two glyphs in empty state, three only when filled (and
          the third is meaningful — confirms the add). */}
      <div className="flex flex-wrap gap-2">
        {triggers.map((t) => {
          const isOpen = openKind === t.kind;
          return (
            <button
              key={t.kind}
              type="button"
              onClick={() => { haptic("light"); setOpenKind(isOpen ? null : t.kind); }}
              className={`inline-flex items-center gap-1.5 rounded-full border px-3.5 py-1.5 text-xs font-semibold transition-all active:scale-[0.97] ${
                t.has
                  ? "border-[hsl(var(--kiddo-evergreen)/0.40)] bg-[hsl(var(--kiddo-evergreen)/0.08)] text-[hsl(var(--kiddo-evergreen))]"
                  : isOpen
                    ? "border-foreground/30 bg-muted text-foreground"
                    : "border-border bg-background text-muted-foreground hover:text-foreground hover:border-foreground/25"
              }`}
              data-testid={`media-trigger-${t.kind}`}
            >
              <span aria-hidden="true" className="text-sm leading-none">{t.emoji}</span>
              <span>{t.label}</span>
              {t.has && (
                <span
                  aria-hidden="true"
                  className="ml-0.5 text-[10px] font-bold text-[hsl(var(--kiddo-evergreen))]"
                >
                  ✓
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Expanded panel — only one open at a time to keep the surface compact.
          Each panel mirrors the standalone Memory Book composer's input shape
          (file upload + URL field) so the parent's mental model stays the
          same across surfaces. */}
      {openKind === "photo" && (
        <div className="mt-3 space-y-2 rounded-xl border border-border/60 bg-muted/20 p-3">
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="rounded-xl"
              onClick={() => photoInputRef.current?.click()}
              disabled={photoUploading}
              data-testid="media-photo-upload"
            >
              {photoUploading ? "Uploading..." : hasPhoto ? "Replace photo" : "Upload photo"}
            </Button>
            {hasPhoto && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="rounded-xl text-muted-foreground hover:text-destructive"
                onClick={() => onChange({ ...value, photoUrl: "" })}
                data-testid="media-photo-clear"
              >
                Remove
              </Button>
            )}
            <input
              ref={photoInputRef}
              type="file"
              accept="image/png,image/jpeg,image/jpg,image/webp,image/gif"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) uploadFile("photo", f);
                if (photoInputRef.current) photoInputRef.current.value = "";
              }}
            />
          </div>
          <label htmlFor="memory-photo-url" className="sr-only">Or paste an image URL</label>
          <input
            id="memory-photo-url"
            name="photoUrl"
            type="url"
            autoComplete="url"
            value={value.photoUrl}
            onChange={(e) => onChange({ ...value, photoUrl: e.target.value })}
            placeholder="Or paste an image URL"
            className="w-full rounded-xl border border-border bg-background px-3 py-2 text-xs"
            data-testid="media-photo-url"
          />
          {hasPhoto && (
            <img src={value.photoUrl} alt="" className="mt-1 max-h-32 rounded-lg object-cover" />
          )}
        </div>
      )}

      {openKind === "video" && (
        <div className="mt-3 space-y-2 rounded-xl border border-border/60 bg-muted/20 p-3">
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="rounded-xl"
              onClick={() => videoInputRef.current?.click()}
              disabled={videoUploading}
              data-testid="media-video-upload"
            >
              {videoUploading ? "Uploading..." : hasVideo ? "Replace video" : "Upload video"}
            </Button>
            {hasVideo && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="rounded-xl text-muted-foreground hover:text-destructive"
                onClick={() => onChange({ ...value, videoUrl: "" })}
                data-testid="media-video-clear"
              >
                Remove
              </Button>
            )}
            <input
              ref={videoInputRef}
              type="file"
              accept="video/mp4,video/webm,video/quicktime"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) uploadFile("video", f);
                if (videoInputRef.current) videoInputRef.current.value = "";
              }}
            />
          </div>
          <label htmlFor="memory-video-url" className="sr-only">Video URL — YouTube, Vimeo, or Loom</label>
          <input
            id="memory-video-url"
            name="videoUrl"
            type="url"
            autoComplete="url"
            value={value.videoUrl}
            onChange={(e) => onChange({ ...value, videoUrl: e.target.value })}
            placeholder="YouTube, Vimeo, or Loom URL"
            className="w-full rounded-xl border border-border bg-background px-3 py-2 text-xs"
            data-testid="media-video-url"
          />
        </div>
      )}

      {openKind === "voice" && (
        <div className="mt-3 space-y-2 rounded-xl border border-border/60 bg-muted/20 p-3">
          {hasAudio ? (
            <div className="space-y-2">
              <audio src={value.audioUrl} controls className="w-full h-9" data-testid="media-audio-preview" />
              {value.audioTranscript && (
                <p className="text-[12px] italic text-muted-foreground">&ldquo;{value.audioTranscript}&rdquo;</p>
              )}
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="rounded-xl text-muted-foreground hover:text-destructive"
                onClick={() => onChange({ ...value, audioUrl: "", audioTranscript: "" })}
                data-testid="media-audio-clear"
              >
                Remove voice note
              </Button>
            </div>
          ) : recording ? (
            <div className="flex items-center justify-between gap-3 rounded-xl border border-red-200 bg-red-50 p-3">
              <div className="flex items-center gap-2 min-w-0">
                <span className="h-2.5 w-2.5 rounded-full bg-red-500 animate-pulse shrink-0" aria-hidden="true" />
                <span className="text-sm font-semibold text-red-800 tabular-nums">
                  Recording · {String(Math.floor(recordingSeconds / 60)).padStart(2, "0")}:{String(recordingSeconds % 60).padStart(2, "0")}
                </span>
              </div>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="rounded-xl bg-white shrink-0"
                onClick={stopRecording}
                data-testid="media-audio-stop"
              >
                Stop
              </Button>
            </div>
          ) : (
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="rounded-xl"
                onClick={startRecording}
                disabled={audioUploading}
                data-testid="media-audio-record"
              >
                🎙 Record
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="rounded-xl"
                onClick={() => audioInputRef.current?.click()}
                disabled={audioUploading}
                data-testid="media-audio-upload"
              >
                {audioUploading ? "Uploading..." : "Upload audio"}
              </Button>
              <input
                ref={audioInputRef}
                type="file"
                accept="audio/webm,audio/mp4,audio/m4a,audio/mpeg,audio/mp3,audio/ogg,audio/wav"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) uploadFile("audio", f);
                  if (audioInputRef.current) audioInputRef.current.value = "";
                }}
              />
            </div>
          )}
          {!hasAudio && !recording && (
            <p className="text-[11px] text-muted-foreground">
              {/* Pronoun + majority-age aware. "Emma will hear" / "They'll
                  hear" with "her/his/their" + ordinal birthday — drops the
                  awkward "Emma'll" template that was the earlier pattern. */}
              Up to 60 seconds. {childName ? `${childName} will` : `${fundPronouns.subject.charAt(0).toUpperCase()}${fundPronouns.subject.slice(1)}'ll`} hear your voice on {fundPronouns.possAdj} {majorityOrdinal} birthday.
            </p>
          )}
        </div>
      )}

      {error && (
        <p className="mt-2 text-[11px] font-semibold text-destructive">{error}</p>
      )}
    </div>
  );
}
