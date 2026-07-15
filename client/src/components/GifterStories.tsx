// PROTOTYPE (2026-07): the people-stories surface. The dashboard "N people are
// building {child}'s future" roster gets the same Stories treatment as the
// holdings, but tuned for LOVE, not news:
//   - warm: the background is the gifter's OWN avatar colour, not a news gradient
//   - the NOTE is the hero (money is a quiet footnote), like the Memory Book
//   - media (photo, video, voice note) plays RIGHT HERE, never leaving the app
//   - the ring glows only for a REAL new moment from that person (honest, not a
//     nag): once opened, it goes quiet
// This is the per-person lens INTO the Memory Book, entered through the face, not
// a rival surface. Data-driven off the person's real gifts, so it works for
// whoever is actually in the fund.

import { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence, useMotionValue, useTransform, useReducedMotion, type PanInfo } from "framer-motion";
import { X as XIcon, Volume2, VolumeX } from "lucide-react";
import { haptic } from "@/lib/haptics";
import { VoiceNotePlayer } from "@/components/ui/voice-note-player";

export type GifterMoment = {
  id: string;
  note?: string | null;
  amount: string;
  dateLabel: string;
  occasion?: string | null;
  photoUrl?: string | null;
  videoUrl?: string | null;
  audioUrl?: string | null;
  ts: number;
};

const fmtMoney = (a: unknown) => `$${(Math.round(Number(a) || 0)).toLocaleString()}`;
const monthYear = (iso?: string | null) => {
  if (!iso) return "";
  const d = new Date(iso);
  return isNaN(d.getTime()) ? "" : d.toLocaleDateString(undefined, { month: "short", year: "numeric" });
};

// A gift row (schema: message / amount / photoUrl / videoUrl / audioUrl / createdAt)
// becomes one moment. Newest first, capped so a prolific gifter is a story, not a scroll.
// The occasion label isn't a column on the gift row — the gift carries an `eventId`
// and the name lives on the event — so callers pass an id->name map (built from the
// dashboard's events) to light up the "Birthday · Dec 2025" eyebrow. Without it, the
// moment falls back to just the date (still honest, just less rich).
export function gifterMomentsFromGifts(gifts: any[], eventNameById?: Map<string, string>): GifterMoment[] {
  return (gifts || [])
    .map((g, idx) => {
      const ts = g?.createdAt ? new Date(String(g.createdAt)).getTime() : 0;
      const occasion = g?.occasion ?? g?.eventLabel
        ?? (g?.eventId && eventNameById ? eventNameById.get(String(g.eventId)) : null)
        ?? null;
      return {
        id: String(g?.id ?? idx),
        note: (g?.message ?? g?.note ?? "") || null,
        amount: fmtMoney(g?.amount ?? g?.netAmount ?? 0),
        dateLabel: monthYear(g?.createdAt),
        occasion,
        photoUrl: g?.photoUrl ?? null,
        videoUrl: g?.videoUrl ?? null,
        audioUrl: g?.audioUrl ?? null,
        ts: Number.isFinite(ts) ? ts : 0,
      } as GifterMoment;
    })
    .sort((a, b) => b.ts - a.ts)
    .slice(0, 20);
}

// A gifter's stories are meant to be the per-person lens INTO the Memory Book, so
// their authored NOTES + photo/video/voice memories (not just their gifts) become
// moments too — otherwise a parent's "you're getting so big" photo note is invisible
// here even though it's the most personal thing they added. Gift rows are handled by
// gifterMomentsFromGifts; we EXCLUDE gift_message entries here to avoid double-counting.
// Matched to the person by author name (case-insensitive) — memory entries don't carry
// an email in the client, so name is the available signal.
export function gifterMomentsFromMemory(entries: any[], authorNames: (string | null | undefined)[]): GifterMoment[] {
  const keys = new Set(
    (authorNames || []).map((n) => String(n || "").trim().toLowerCase()).filter(Boolean),
  );
  if (keys.size === 0) return [];
  return (entries || [])
    .filter((e) => {
      if (!e || e.type === "gift_message") return false;
      if (!keys.has(String(e.authorName || "").trim().toLowerCase())) return false;
      const text = String(e.content || "").trim();
      const hasMedia = Boolean(e.photoUrl || e.videoUrl || e.audioUrl);
      // Real moments only: a note or a piece of media. Skip dev-test / boilerplate
      // text with nothing attached (mirrors the Memory Book's own suppression).
      if (!hasMedia && (!text || /^(test|testing|tstgin|tstng|qqqqq|tester)\b/i.test(text) || /^auto-invest contribution to /i.test(text))) return false;
      return true;
    })
    .map((e, idx) => {
      const ts = e?.createdAt ? new Date(String(e.createdAt)).getTime() : 0;
      return {
        id: `mem-${String(e?.id ?? idx)}`,
        note: (e?.content ?? "") || null,
        amount: "", // a memory note isn't a gift — no "set aside" footnote
        dateLabel: monthYear(e?.createdAt),
        occasion: null,
        photoUrl: e?.photoUrl ?? null,
        videoUrl: e?.videoUrl ?? null,
        audioUrl: e?.audioUrl ?? null,
        ts: Number.isFinite(ts) ? ts : 0,
      } as GifterMoment;
    });
}

// ── warm seen-state: a new moment from someone glows until opened ──
const seenKey = (name: string) => `kiddo.gifter-story-seen.${name.toLowerCase().trim()}`;
function latestTs(gifts: any[]): number {
  let m = 0;
  for (const g of gifts || []) {
    const t = g?.createdAt ? new Date(String(g.createdAt)).getTime() : 0;
    if (Number.isFinite(t) && t > m) m = t;
  }
  return m;
}
export function gifterHasNew(name: string, gifts: any[]): boolean {
  if (typeof window === "undefined") return false;
  const latest = latestTs(gifts);
  if (!latest) return false;
  const seen = parseInt(window.localStorage.getItem(seenKey(name)) || "0", 10) || 0;
  return latest > seen;
}
export function markGifterSeen(name: string, gifts: any[]): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(seenKey(name), String(latestTs(gifts)));
}

// Warm gradient derived from the gifter's own avatar colour (rgb string).
export function gifterWarmGradient(rgb?: string): string {
  const m = (rgb || "").match(/(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/);
  if (!m) return "linear-gradient(165deg, rgb(58,42,26) 0%, rgb(24,18,12) 100%)";
  const r = +m[1], g = +m[2], b = +m[3];
  const d = (x: number) => Math.round(x * 0.4);
  return `linear-gradient(165deg, rgb(${r},${g},${b}) 0%, rgb(${d(r)},${d(g)},${d(b)}) 100%)`;
}

// Video moment: autoplays muted + loops the moment you land on it (social-media
// behaviour), with a speaker toggle to bring sound in. Tapping the card still
// advances the story; only the speaker button captures its own tap.
function StoryVideo({ src }: { src: string }) {
  const ref = useRef<HTMLVideoElement | null>(null);
  const [muted, setMuted] = useState(true);
  useEffect(() => {
    const v = ref.current;
    if (v) { v.muted = true; v.play().catch(() => {}); }
  }, []);
  return (
    <div className="relative w-full overflow-hidden rounded-2xl" style={{ maxWidth: 420 }}>
      <video ref={ref} src={src} autoPlay loop playsInline muted
        className="w-full object-cover" style={{ maxHeight: "46vh", pointerEvents: "none" }} />
      <button
        type="button"
        onClick={(e) => { e.stopPropagation(); const v = ref.current; if (!v) return; v.muted = !v.muted; setMuted(v.muted); if (!v.muted) v.play().catch(() => {}); }}
        aria-label={muted ? "Unmute" : "Mute"}
        className="absolute bottom-2 right-2 z-10 flex h-8 w-8 items-center justify-center rounded-full bg-black/50 text-white active:scale-90"
        style={{ pointerEvents: "auto", transition: "transform 0.12s ease" }}
      >
        {muted ? <VolumeX size={15} /> : <Volume2 size={15} />}
      </button>
    </div>
  );
}

export function GifterStoriesViewer({
  open, name, initials, avatarUrl, colorRgb, childName, moments, onClose,
}: {
  open: boolean;
  name: string;
  initials: string;
  avatarUrl?: string | null;
  colorRgb?: string;
  childName?: string | null;
  moments: GifterMoment[];
  onClose: () => void;
}) {
  const reduce = useReducedMotion();
  const [[i, dir], setPage] = useState<[number, number]>([0, 0]);
  const y = useMotionValue(0);
  const backdrop = useTransform(y, [0, 320], [1, 0]);
  const scale = useTransform(y, [0, 380], [1, 0.93]);
  const radius = useTransform(y, [0, 120], [0, 22]);

  useEffect(() => { if (open) { setPage([0, 0]); y.set(0); } }, [open, name, y]);

  if (!open || moments.length === 0) return null;
  const m = moments[Math.min(i, moments.length - 1)];
  const grad = gifterWarmGradient(colorRgb);
  const who = childName ? `${childName}` : "their future";

  const paginate = (d: number) => {
    const ni = i + d;
    if (ni < 0) return;
    if (ni >= moments.length) { haptic("light"); onClose(); return; }
    haptic("selection");
    setPage([ni, d]);
  };
  const onDragEnd = (_e: unknown, info: PanInfo) => {
    if (info.offset.y > 120 || info.velocity.y > 650) { haptic("light"); onClose(); }
  };
  const slideX = reduce ? 0 : 44;
  const variants = {
    enter: (d: number) => ({ x: d >= 0 ? slideX : -slideX, opacity: 0 }),
    center: { x: 0, opacity: 1 },
    exit: (d: number) => ({ x: d >= 0 ? -slideX : slideX, opacity: 0 }),
  };

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-[80] overflow-hidden select-none"
          initial={reduce ? { opacity: 0 } : { opacity: 0, scale: 0.94 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={reduce ? { opacity: 0 } : { opacity: 0, scale: 0.96 }}
          transition={{ duration: 0.26, ease: [0.16, 1, 0.3, 1] }}
          style={{ pointerEvents: "auto" }}
        >
          <motion.div className="absolute inset-0 bg-black" style={{ opacity: backdrop }} />
          <motion.div
            className="absolute inset-0 overflow-hidden"
            drag={reduce ? false : "y"}
            dragDirectionLock
            dragConstraints={{ top: 0, bottom: 0 }}
            dragElastic={{ top: 0.06, bottom: 0.7 }}
            onDragEnd={onDragEnd}
            style={{ y, borderRadius: radius, scale }}
          >
            <AnimatePresence initial={false}>
              <motion.div key={`bg-${name}`} className="absolute inset-0" style={{ background: grad }}
                initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.4 }} />
            </AnimatePresence>

            {/* Tap zones: left third back, rest forward. Sits BELOW the content so
                interactive media (voice, video) captures its own taps; the pointer-
                transparent text and empty areas fall through to here. */}
            <motion.div className="absolute inset-0 z-[1]" onTap={(_e, info) => {
              const w = typeof window !== "undefined" ? window.innerWidth : 400;
              if (info.point.x < w * 0.32) paginate(-1); else paginate(1);
            }} />

            {/* Progress + who */}
            <div className="absolute top-0 left-0 right-0 z-20 px-3" style={{ paddingTop: "calc(env(safe-area-inset-top, 0px) + 10px)", color: "#fff" }}>
              <div className="flex gap-1">
                {moments.map((_, idx) => (
                  <div key={idx} className="h-[3px] flex-1 rounded-full overflow-hidden" style={{ background: "rgba(255,255,255,0.3)" }}>
                    <motion.div style={{ height: "100%", borderRadius: 999, background: "#fff" }} initial={false}
                      animate={{ width: idx <= i ? "100%" : "0%" }} transition={{ duration: reduce ? 0 : 0.4, ease: [0.16, 1, 0.3, 1] }} />
                  </div>
                ))}
              </div>
              <div className="mt-3 flex items-center justify-between">
                <div className="flex items-center gap-2 min-w-0" style={{ pointerEvents: "none" }}>
                  <div className="flex items-center justify-center rounded-full overflow-hidden shrink-0" style={{ width: 28, height: 28, background: "rgba(255,255,255,0.22)" }}>
                    {avatarUrl ? <img src={avatarUrl} alt="" className="w-full h-full object-cover" /> : <span className="text-[11px] font-bold text-white">{initials}</span>}
                  </div>
                  <div className="min-w-0">
                    <p className="text-[13px] font-bold leading-tight truncate">{name}</p>
                    <p className="text-[10.5px] leading-tight" style={{ opacity: 0.75 }}>for {who}</p>
                  </div>
                </div>
                <button type="button" onClick={(e) => { e.stopPropagation(); onClose(); }} aria-label="Close"
                  className="z-30 -mr-1 flex h-9 w-9 items-center justify-center rounded-full active:scale-90" style={{ color: "#fff", transition: "transform 0.12s ease" }}>
                  <XIcon size={20} />
                </button>
              </div>
            </div>

            {/* The moment: media leads (the hook), the note underneath, quiet
                metadata at the bottom. Bottom-anchored (no flex squish). */}
            {/* The moment, Instagram-style: media leads at the TOP, a flexible
                spacer, then the note + quiet metadata pinned to the BOTTOM.
                Full-height flex column. Media carries shrink-0 so it can never
                collapse (the earlier top-anchor bug); the ONLY flex-1 is the
                empty spacer, which is safe to shrink to zero. */}
            <div
              className="absolute inset-0 z-[5] flex flex-col px-6"
              style={{
                color: "#fff",
                pointerEvents: "none",
                paddingTop: "calc(env(safe-area-inset-top, 0px) + 78px)",
                paddingBottom: "calc(env(safe-area-inset-bottom, 0px) + 40px)",
              }}
            >
              <AnimatePresence initial={false} custom={dir} mode="popLayout">
                <motion.div key={`m-${m.id}`} custom={dir} variants={variants} initial="enter" animate="center" exit="exit"
                  transition={{ duration: reduce ? 0 : 0.42, ease: [0.16, 1, 0.3, 1] }}
                  className="flex flex-1 flex-col min-h-0" style={{ pointerEvents: "none" }}>
                  {/* LEAD SPACER — pushes the moment LOWER: media + note sit as one
                      intimate cluster (a memory rising into view), not a feed image
                      pinned to the top. Larger than the tail spacer below, so the
                      cluster lands lower-CENTER — low + spotlit, not bottom-heavy.
                      Keeps the NOTE the hero. */}
                  <div className="flex-[2] min-h-0" />

                  {/* MEDIA — clustered with its note, lower on the screen */}
                  {(m.photoUrl || m.videoUrl || m.audioUrl) ? (
                    <div className="shrink-0 space-y-3">
                      {m.photoUrl ? (
                        <div className="overflow-hidden rounded-2xl" style={{ maxWidth: 420 }}>
                          <img src={m.photoUrl} alt="" className="w-full object-cover" style={{ maxHeight: "42vh" }} />
                        </div>
                      ) : null}
                      {m.videoUrl ? <StoryVideo src={m.videoUrl} /> : null}
                      {m.audioUrl ? (
                        <div style={{ maxWidth: 420, pointerEvents: "auto" }} onClick={(e) => e.stopPropagation()}>
                          <VoiceNotePlayer src={m.audioUrl} variant="onDark" />
                        </div>
                      ) : null}
                    </div>
                  ) : null}

                  {/* NOTE + DATE — directly under the media, one cluster */}
                  <div className="shrink-0 mt-4">
                    {m.note ? (
                      <p className="font-heading font-semibold" style={{ fontSize: 22, lineHeight: 1.34, letterSpacing: "-0.01em", maxWidth: 480 }}>
                        {m.note}
                      </p>
                    ) : (!m.photoUrl && !m.videoUrl && !m.audioUrl) ? (
                      <p className="font-heading font-semibold" style={{ fontSize: 21, opacity: 0.92, maxWidth: 480 }}>
                        {m.occasion ? `A gift for ${m.occasion}.` : "A gift toward the future."}
                      </p>
                    ) : null}

                    {(m.occasion || m.dateLabel || m.amount) ? (
                      <p className="mt-3 text-[12px] font-medium" style={{ opacity: 0.66 }}>
                        {[m.occasion, m.dateLabel, m.amount ? `${m.amount} set aside` : null].filter(Boolean).join("  ·  ")}
                      </p>
                    ) : null}
                  </div>

                  {/* TAIL SPACER — lifts the cluster off the very bottom so it reads
                      lower-CENTER, not pinned to the floor. Smaller than the lead
                      spacer, so the moment still sits low. */}
                  <div className="flex-[1] min-h-0" />
                </motion.div>
              </AnimatePresence>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
