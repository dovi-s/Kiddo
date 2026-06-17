import { useState } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { ArrowRight, Loader2 } from "lucide-react";

// A genuinely LIVE product embed: the real (public, sandboxed) demo running
// inside the phone frame, so the visitor actually uses it — picks a gift amount,
// taps around — without leaving the page.
//
// Design decisions:
//   - PROGRESSIVE: shows the static screenshot first (zero cost on page load);
//     the real app iframe mounts only when the visitor taps "Try it live".
//   - SMOOTH HANDOFF: on tap, the poster stays as a dimmed backdrop with a
//     "Waking the live demo…" spinner; when the iframe finishes loading it
//     crossfades in. No blank-white flash.
//   - PUBLIC surface only (e.g. the demo fund's gift page): no login, so no
//     session-cookie bleed into the marketing site. Same-origin framing is
//     allowed by CSP (frame-ancestors 'self').
//   - A real 393px app viewport is scaled down into the bezel, so the app
//     renders its true mobile layout, crisp.

type Props = {
  src: string; // public demo URL to embed live (e.g. "/theo-rivera")
  poster: string; // screenshot shown until activated
  alt: string;
  caption?: string;
  title?: string;
  tilt?: "left" | "right" | "none";
  className?: string;
};

const EASE = [0.22, 1, 0.36, 1] as const;
const SCREEN_W = 240;
const SCALE = SCREEN_W / 393;
const SCREEN_H = Math.round(852 * SCALE);

export function EmbeddedDemo({ src, poster, alt, caption, title = "Kiddo live demo", tilt = "none", className = "" }: Props) {
  const reduce = useReducedMotion();
  const [live, setLive] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const rotate = tilt === "left" ? -2.2 : tilt === "right" ? 2.2 : 0;

  // The iframe document's onLoad fires before the React app inside has rendered
  // its content (it boots + fetches after, briefly showing its own spinner). So
  // we hold the branded "Waking the live demo…" overlay for a short settle after
  // onLoad, then crossfade — the visitor never sees a bare spinner or blank flash.
  const handleFrameLoad = () => { window.setTimeout(() => setLoaded(true), 1300); };

  return (
    <motion.figure
      initial={reduce ? { opacity: 1 } : { opacity: 0, y: 28, scale: 0.96 }}
      whileInView={reduce ? { opacity: 1 } : { opacity: 1, y: 0, scale: 1, rotate }}
      viewport={{ once: true, margin: "-60px" }}
      transition={reduce ? { duration: 0 } : { duration: 0.7, ease: EASE }}
      className={`relative mx-auto ${className}`}
      style={{ width: SCREEN_W + 20 }}
    >
      <div aria-hidden className="pointer-events-none absolute -inset-6 rounded-[3rem] bg-[radial-gradient(closest-side,hsl(var(--kiddo-gold)/0.18),transparent)] blur-2xl" />
      <div className="group relative rounded-[2.6rem] bg-[#0c140f] p-2.5 shadow-[0_30px_60px_-18px_rgba(12,20,15,0.45)] ring-1 ring-black/5">
        <div className="relative overflow-hidden rounded-[2.05rem] bg-white" style={{ width: SCREEN_W, height: SCREEN_H }}>
          {live ? (
            <>
              <iframe
                src={src}
                title={title}
                onLoad={handleFrameLoad}
                className="absolute left-0 top-0 border-0 bg-white transition-opacity duration-500"
                style={{ width: 393, height: 852, transform: `scale(${SCALE})`, transformOrigin: "0 0", opacity: loaded ? 1 : 0 }}
              />
              {/* loading backdrop: dimmed poster + spinner, crossfades out when ready */}
              <div
                aria-hidden
                className="pointer-events-none absolute inset-0 transition-opacity duration-500"
                style={{ opacity: loaded ? 0 : 1 }}
              >
                <img src={poster} alt="" className="absolute inset-0 h-full w-full object-cover object-top blur-[2px] brightness-90" />
                <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-[#0c140f]/35">
                  <Loader2 className="h-6 w-6 animate-spin text-white" />
                  <span className="text-[11px] font-semibold text-white/95">Waking the live demo…</span>
                </div>
              </div>
            </>
          ) : (
            <button type="button" onClick={() => setLive(true)} className="absolute inset-0 block outline-none focus-visible:ring-2 focus-visible:ring-[hsl(var(--kiddo-gold))]" aria-label={`Start the live demo: ${alt}`}>
              <img src={poster} alt={alt} className="absolute inset-0 h-full w-full object-cover object-top" loading="lazy" decoding="async" />
              <span className="absolute inset-0 flex flex-col items-center justify-end gap-1.5 bg-gradient-to-t from-black/45 via-transparent to-transparent pb-7">
                <span className="inline-flex items-center gap-1.5 rounded-full bg-white/95 px-4 py-2 text-sm font-semibold text-[#0c140f] shadow-lg transition-transform duration-300 group-hover:scale-105">
                  Try it live <ArrowRight className="h-4 w-4" />
                </span>
                <span className="text-[11px] font-medium text-white/90">the real product, right here</span>
              </span>
            </button>
          )}
        </div>
        {live ? (
          <span className="pointer-events-none absolute right-4 top-4 inline-flex items-center gap-1 rounded-full bg-emerald-500 px-2 py-0.5 text-[10px] font-bold text-white shadow transition-opacity duration-500" style={{ opacity: loaded ? 1 : 0 }}>
            <span className="h-1.5 w-1.5 rounded-full bg-white" /> LIVE
          </span>
        ) : null}
      </div>
      {caption ? (
        <figcaption className="mt-4 text-center text-xs text-muted-foreground">
          {live ? "You're using the real demo." : caption}
        </figcaption>
      ) : null}
    </motion.figure>
  );
}
