import { useState, useRef, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Mic, Play, Pause, Lock, RotateCcw, Loader2 } from "lucide-react";

// ─────────────────────────────────────────────────────────────────────────────
// SealedVoiceNote — production recorder for the "voice they'll keep" feature.
// Records audio, lets you hear it back, then uploads it to the REAL memory-audio
// route and hands the caller a stored { audioUrl, transcript } to attach to a
// memory_entry (visibility 'kid_at_18' to seal until the child turns 18).
//
// Surface-agnostic on purpose: drop it into the gifter flow, the sealed letter,
// or the Memory Book. The branded record→review→seal UX is the one genuinely-new
// piece; storage / sealing / at-18 gating already exist server-side.
//
// Requires CSP `media-src 'self' blob:` (added to server/index.ts) so the <audio>
// element can play the recorded blob. Blob is typed from recorder.mimeType (not a
// hardcoded webm) and recorded with a timeslice so Safari/iOS and short clips work.
// ─────────────────────────────────────────────────────────────────────────────

type Stage = "intro" | "recording" | "review" | "uploading" | "sealed";

export type SealedVoiceResult = { audioUrl: string; transcript?: string | null; mime?: string };

interface Props {
  /** Fund the note belongs to. Drives the upload route. */
  fundId: string;
  /** Public (gifter, unauthenticated) vs authed (parent) upload path. */
  audience?: "gifter" | "parent";
  /** Child's first name for the framing copy. */
  childName?: string;
  /** State-specific UTMA majority age (18-21). Defaults to 18 when omitted. */
  majorityAge?: number;
  /** Called once the audio is stored and ready to attach to a memory entry. */
  onComplete: (result: SealedVoiceResult) => void;
  /** Optional eyebrow/headline overrides so each surface can phrase it. */
  eyebrow?: string;
  headline?: string;
}

const EVERGREEN = "#1B3A2D";
const GOLD = "#C5821E";
const SPRING = { type: "spring" as const, damping: 30, stiffness: 300 };

const PICK_MIME = () => {
  const c = ["audio/webm;codecs=opus", "audio/webm", "audio/mp4", "audio/ogg;codecs=opus"];
  return c.find((t) => { try { return (window as any).MediaRecorder?.isTypeSupported?.(t); } catch { return false; } });
};

export default function SealedVoiceNote({ fundId, audience = "parent", childName, majorityAge, onComplete, eyebrow, headline }: Props) {
  const [stage, setStage] = useState<Stage>("intro");
  const [seconds, setSeconds] = useState(0);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [blob, setBlob] = useState<Blob | null>(null);
  const [playing, setPlaying] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const recorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<BlobPart[]>([]);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const clearTimer = () => { if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; } };
  useEffect(() => () => { clearTimer(); streamRef.current?.getTracks().forEach((t) => t.stop()); }, []);
  useEffect(() => { setPlaying(false); }, [stage]);

  const name = (childName || "them").trim();
  // State-specific majority age (UTMA is 18-21 depending on state). Ordinal for
  // the "on their Nth birthday" framing so a 21-state fund doesn't say "18th".
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

  const startRecording = useCallback(async () => {
    setError(null); setSeconds(0);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      const picked = PICK_MIME();
      const mr = picked ? new MediaRecorder(stream, { mimeType: picked }) : new MediaRecorder(stream);
      chunksRef.current = [];
      mr.ondataavailable = (e) => { if (e.data && e.data.size > 0) chunksRef.current.push(e.data); };
      mr.onstop = () => {
        const b = new Blob(chunksRef.current, { type: mr.mimeType || picked || "audio/webm" });
        setBlob(b);
        setAudioUrl(URL.createObjectURL(b));
        stream.getTracks().forEach((t) => t.stop());
        setStage("review");
      };
      mr.start(200);
      recorderRef.current = mr;
      setStage("recording");
      timerRef.current = setInterval(() => setSeconds((s) => s + 1), 1000);
    } catch {
      setError("We couldn't reach your microphone. Check the browser's mic permission and try again.");
    }
  }, []);

  const stopRecording = useCallback(() => {
    clearTimer();
    const mr = recorderRef.current;
    if (mr && mr.state !== "inactive") mr.stop();
  }, []);

  const togglePlay = () => {
    const a = audioRef.current; if (!a) return;
    if (playing) { a.pause(); return; }
    a.play().catch(() => setError("Couldn't play that back on this browser."));
  };

  const seal = useCallback(async () => {
    if (!blob) return;
    setStage("uploading"); setError(null);
    try {
      const dataUrl: string = await new Promise((res, rej) => {
        const r = new FileReader();
        r.onload = () => res(String(r.result));
        r.onerror = () => rej(new Error("read failed"));
        r.readAsDataURL(blob);
      });
      const base = audience === "gifter" ? `/api/public/funds/${fundId}` : `/api/funds/${fundId}`;
      const resp = await fetch(`${base}/memory/upload-audio`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ dataUrl }),
      });
      if (!resp.ok) throw new Error(`upload ${resp.status}`);
      const data = await resp.json();
      if (!data?.url) throw new Error("no url");
      onComplete({ audioUrl: data.url, transcript: data.transcript ?? null, mime: data.mime });
      setStage("sealed");
    } catch {
      setError("That didn't save. Your recording is still here. Try sealing again.");
      setStage("review");
    }
  }, [blob, fundId, audience, onComplete]);

  const reRecord = () => { setBlob(null); setAudioUrl(null); startRecording(); };
  const mmss = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;

  return (
    <div className="flex flex-col items-center text-center">
      <AnimatePresence mode="wait">
        {stage === "intro" && (
          <motion.div key="intro" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={SPRING} className="flex flex-col items-center">
            <p className="text-xs font-semibold uppercase tracking-wider" style={{ color: GOLD }}>
              {eyebrow ?? `Sealed until ${name === "them" ? "they're" : name + " is"} 18`}
            </p>
            <h3 className="mt-2 font-heading text-xl font-bold" style={{ color: EVERGREEN }}>
              {headline ?? `Say something to ${name}`}
            </h3>
            <p className="mt-2 max-w-xs text-sm leading-relaxed" style={{ color: `${EVERGREEN}b3` }}>
              They'll hear your actual voice on their {majorityOrdinal} birthday.
            </p>
            <motion.button onClick={startRecording} whileTap={{ scale: 0.94 }} aria-label="Start recording"
              className="mt-7 flex h-20 w-20 items-center justify-center rounded-full text-white shadow-lg" style={{ background: GOLD }}>
              <Mic size={30} />
            </motion.button>
            <p className="mt-3 text-sm" style={{ color: `${EVERGREEN}80` }}>Tap to record</p>
          </motion.div>
        )}

        {stage === "recording" && (
          <motion.div key="rec" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="flex flex-col items-center">
            <div className="flex items-center gap-2">
              <motion.span animate={{ opacity: [1, 0.3, 1] }} transition={{ duration: 1.4, repeat: Infinity }} className="h-2.5 w-2.5 rounded-full" style={{ background: "#c0392b" }} />
              <span className="text-sm font-medium" style={{ color: `${EVERGREEN}b3` }}>Recording</span>
            </div>
            <p className="mt-4 font-heading text-4xl font-bold tabular-nums" style={{ color: EVERGREEN }}>{mmss(seconds)}</p>
            <div className="mt-6 flex h-12 items-center justify-center gap-1.5">
              {Array.from({ length: 11 }).map((_, i) => (
                <motion.span key={i} className="w-1.5 rounded-full" style={{ background: GOLD }}
                  animate={{ height: [6, 10 + ((i * 7) % 30), 6] }} transition={{ duration: 0.7 + (i % 4) * 0.18, repeat: Infinity, ease: "easeInOut" }} />
              ))}
            </div>
            <motion.button onClick={stopRecording} whileTap={{ scale: 0.94 }} aria-label="Stop recording"
              className="mt-7 flex h-16 w-16 items-center justify-center rounded-full shadow-lg" style={{ background: EVERGREEN }}>
              <span className="h-5 w-5 rounded-[4px] bg-white" />
            </motion.button>
            <p className="mt-3 text-sm" style={{ color: `${EVERGREEN}80` }}>Tap to finish</p>
          </motion.div>
        )}

        {stage === "review" && (
          <motion.div key="rev" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={SPRING} className="flex w-full flex-col items-center">
            <p className="text-xs font-semibold uppercase tracking-wider" style={{ color: GOLD }}>Hear it back</p>
            <p className="mt-1 font-heading text-lg font-bold" style={{ color: EVERGREEN }}>{mmss(seconds)} message</p>
            {audioUrl && <audio ref={audioRef} src={audioUrl} preload="auto" onPlay={() => setPlaying(true)} onPause={() => setPlaying(false)} onEnded={() => setPlaying(false)} />}
            <motion.button onClick={togglePlay} whileTap={{ scale: 0.94 }} aria-label={playing ? "Pause" : "Play message"}
              className="mt-5 flex h-16 w-16 items-center justify-center rounded-full text-white shadow-md" style={{ background: EVERGREEN }}>
              {playing ? <Pause size={24} /> : <Play size={24} className="ml-0.5" />}
            </motion.button>
            <div className="mt-7 flex w-full max-w-xs flex-col gap-2.5">
              <motion.button onClick={seal} whileTap={{ scale: 0.97 }}
                className="flex w-full items-center justify-center gap-2 rounded-full py-3 text-[15px] font-semibold text-white shadow-md" style={{ background: GOLD }}>
                <Lock size={16} /> Seal it until they're {safeMajorityAge}
              </motion.button>
              <button onClick={reRecord} className="flex w-full items-center justify-center gap-2 py-1.5 text-sm font-medium" style={{ color: `${EVERGREEN}99` }}>
                <RotateCcw size={14} /> Record again
              </button>
            </div>
          </motion.div>
        )}

        {stage === "uploading" && (
          <motion.div key="up" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex flex-col items-center py-6">
            <Loader2 size={34} className="animate-spin" style={{ color: GOLD }} />
            <p className="mt-4 text-sm" style={{ color: `${EVERGREEN}b3` }}>Sealing it…</p>
          </motion.div>
        )}

        {stage === "sealed" && (
          <motion.div key="done" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex flex-col items-center">
            <motion.div initial={{ scale: 0.5, rotate: -10 }} animate={{ scale: 1, rotate: 0 }} transition={SPRING}
              className="flex h-20 w-20 items-center justify-center rounded-full" style={{ background: `${GOLD}1a`, border: `2px solid ${GOLD}` }}>
              <Lock size={30} style={{ color: GOLD }} />
            </motion.div>
            <h3 className="mt-5 font-heading text-xl font-bold" style={{ color: EVERGREEN }}>Sealed.</h3>
            <p className="mt-2 max-w-xs text-sm leading-relaxed" style={{ color: `${EVERGREEN}b3` }}>
              {name === "them" ? "They" : name} will hear your voice on their {majorityOrdinal} birthday. Not a day before.
            </p>
          </motion.div>
        )}
      </AnimatePresence>

      {error && <p className="mt-4 max-w-xs text-xs leading-relaxed" style={{ color: "#c0392b" }}>{error}</p>}
    </div>
  );
}
