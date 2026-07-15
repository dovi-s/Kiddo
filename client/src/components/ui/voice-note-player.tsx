// One on-brand voice-note player, used everywhere a recorded note plays: the
// Memory Book, the gift/gifter detail, the stories. Replaces the raw
// <audio controls> default bar (ugly, and different on every browser/OS) with a
// single, tuned control: a round play/pause, a title, elapsed time, and a
// scrubbable progress track. Two tones so it sits right on light surfaces (the
// Memory Book) and on the dark story cards.
//
// Deliberately additive: same <audio> element and src underneath, so behaviour
// (autoplay policies, formats, the transcript rendered beside it) is unchanged;
// only the chrome is upgraded.

import { useRef, useState } from "react";
import { Play, Pause } from "lucide-react";
import { haptic } from "@/lib/haptics";

function fmtTime(s: number): string {
  if (!Number.isFinite(s) || s < 0) return "0:00";
  const m = Math.floor(s / 60);
  const sec = Math.floor(s % 60);
  return `${m}:${sec.toString().padStart(2, "0")}`;
}

export function VoiceNotePlayer({
  src, label = "Voice note", variant = "light", className, testId,
}: {
  src: string;
  label?: string;
  variant?: "light" | "onDark";
  className?: string;
  testId?: string;
}) {
  const ref = useRef<HTMLAudioElement | null>(null);
  const [playing, setPlaying] = useState(false);
  const [frac, setFrac] = useState(0);
  const [dur, setDur] = useState(0);
  const [cur, setCur] = useState(0);
  const onDark = variant === "onDark";

  const toggle = (e: React.MouseEvent) => {
    e.stopPropagation();
    const a = ref.current;
    if (!a) return;
    if (playing) { a.pause(); setPlaying(false); }
    else { a.play().catch(() => {}); setPlaying(true); haptic("selection"); }
  };
  const seek = (e: React.MouseEvent<HTMLDivElement>) => {
    e.stopPropagation();
    const a = ref.current;
    if (!a || !dur) return;
    const r = e.currentTarget.getBoundingClientRect();
    const f = Math.min(1, Math.max(0, (e.clientX - r.left) / r.width));
    a.currentTime = f * dur;
    setFrac(f); setCur(f * dur);
  };

  return (
    <div
      data-testid={testId}
      className={`flex items-center gap-3 rounded-2xl px-3.5 py-2.5 ${onDark ? "" : "bg-muted/50"} ${className || ""}`}
      style={onDark ? { background: "rgba(255,255,255,0.13)" } : undefined}
    >
      <audio
        ref={ref}
        src={src}
        preload="metadata"
        onLoadedMetadata={(e) => setDur(e.currentTarget.duration || 0)}
        onEnded={() => { setPlaying(false); setFrac(0); setCur(0); }}
        onTimeUpdate={(e) => { const a = e.currentTarget; setCur(a.currentTime); setFrac(a.duration ? a.currentTime / a.duration : 0); }}
      />
      <button
        type="button"
        onClick={toggle}
        aria-label={playing ? "Pause" : `Play ${label}`}
        className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full active:scale-95 ${onDark ? "bg-white" : "bg-[hsl(var(--kiddo-evergreen))]"}`}
        style={{ transition: "transform 0.12s ease" }}
      >
        {playing
          ? <Pause size={16} className={onDark ? "text-[#1a1a1a]" : "text-white"} />
          : <Play size={16} className={`ml-0.5 ${onDark ? "text-[#1a1a1a]" : "text-white"}`} />}
      </button>
      <div className="min-w-0 flex-1">
        <div className="flex items-center justify-between gap-2">
          <p className={`text-[12px] font-semibold truncate ${onDark ? "text-white/90" : "text-foreground/80"}`}>{label}</p>
          <p className={`text-[11px] tabular-nums shrink-0 ${onDark ? "text-white/70" : "text-muted-foreground"}`}>
            {fmtTime(playing || cur ? cur : dur)}
          </p>
        </div>
        <div
          onClick={seek}
          className="mt-1.5 h-2 rounded-full overflow-hidden cursor-pointer"
          style={{ background: onDark ? "rgba(255,255,255,0.28)" : "hsl(var(--kiddo-ink) / 0.12)" }}
        >
          <div
            className="h-full rounded-full"
            style={{ width: `${Math.round(frac * 100)}%`, background: onDark ? "#fff" : "hsl(var(--kiddo-evergreen))", transition: "width 0.12s linear" }}
          />
        </div>
      </div>
    </div>
  );
}
