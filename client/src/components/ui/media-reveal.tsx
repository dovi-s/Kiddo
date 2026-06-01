// MediaReveal — the single, on-brand way to drop an image / video / ambient
// loop ("gif") onto a marketing surface. Built so the media you add later lands
// at "millions-spent" quality by default, without per-page reinvention:
//
//   • No layout shift. The aspect-ratio box reserves space before the asset
//     loads (Core Web Vitals / CLS is a real ranking + polish signal).
//   • Tasteful entrance. Reuses the approved fade-and-rise-on-scroll primitive
//     (matches Home's <FadeIn>); fires once; honors prefers-reduced-motion
//     (instant, no transform) per feedback_animation_primitives.md.
//   • Accessible motion. An ambient autoplay loop is replaced by its static
//     poster for reduced-motion users — never an unstoppable moving thing.
//   • Lazy + async-decoded images, muted/inline ambient video, optional
//     controls for a real watchable clip, optional caption.
//   • Empty state = a labeled placeholder slot, so a page reads as "media goes
//     here" during build instead of collapsing. Ship with a real `src`.
//
// Usage:
//   <MediaReveal src="/media/family-hero.mp4" ambient poster="/media/family-hero.jpg" aspectRatio="16 / 9" />
//   <MediaReveal src="/media/memory-book.png" alt="A child's Memory Book" aspectRatio="4 / 5" />
//   <MediaReveal aspectRatio="16 / 9" />   // placeholder slot, no asset yet

import { useState, type ReactNode } from "react";
import { motion, useReducedMotion } from "framer-motion";

type MediaRevealProps = {
  /** Image or video URL. Omit to render a labeled placeholder slot. */
  src?: string;
  /** Force the media kind. Auto-detected from the extension otherwise. */
  as?: "image" | "video";
  alt?: string;
  /** CSS aspect-ratio, e.g. "16 / 9", "1 / 1", "4 / 5". Reserves space (no CLS). */
  aspectRatio?: string;
  /** Poster frame for a video; also the static image shown to reduced-motion users. */
  poster?: string;
  /** Ambient silent loop (the tasteful gif replacement): autoplay, muted, loop, inline. */
  ambient?: boolean;
  /** Native controls, for a real watchable video rather than an ambient loop. */
  controls?: boolean;
  rounded?: boolean;
  delay?: number;
  className?: string;
  /** Short caption rendered beneath the media. */
  caption?: string;
  /** Overlay content (e.g. a label or play affordance) layered over the media. */
  children?: ReactNode;
};

function isVideoSrc(src?: string, as?: "image" | "video"): boolean {
  if (as) return as === "video";
  return /\.(mp4|webm|mov|m4v)(\?|$)/i.test(src || "");
}

export function MediaReveal({
  src,
  as,
  alt = "",
  aspectRatio = "16 / 9",
  poster,
  ambient = false,
  controls = false,
  rounded = true,
  delay = 0,
  className = "",
  caption,
  children,
}: MediaRevealProps) {
  const reduceMotion = useReducedMotion();
  const [loaded, setLoaded] = useState(false);
  const video = isVideoSrc(src, as);
  // Reduced-motion users never get an autoplaying loop; they see the poster.
  const ambientVideo = video && ambient && !controls && !reduceMotion;
  const showPosterInstead = video && ambient && !controls && reduceMotion && poster;

  return (
    <motion.figure
      initial={reduceMotion ? { opacity: 1 } : { opacity: 0, y: 20 }}
      whileInView={reduceMotion ? { opacity: 1 } : { opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-50px" }}
      transition={reduceMotion ? { duration: 0 } : { duration: 0.6, delay, ease: [0.22, 1, 0.36, 1] }}
      className={`m-0 ${className}`.trim()}
      data-testid="media-reveal"
    >
      <div
        className={`relative w-full overflow-hidden bg-muted ${rounded ? "rounded-2xl" : ""}`}
        style={{ aspectRatio }}
      >
        {!src ? (
          <div className="absolute inset-0 flex items-center justify-center border border-dashed border-border text-xs font-medium uppercase tracking-widest text-muted-foreground">
            Media
          </div>
        ) : showPosterInstead ? (
          <img
            src={poster}
            alt={alt}
            loading="lazy"
            decoding="async"
            className="absolute inset-0 h-full w-full object-cover"
          />
        ) : video ? (
          <video
            src={src}
            poster={poster}
            autoPlay={ambientVideo}
            muted={ambientVideo}
            loop={ambientVideo}
            playsInline
            controls={controls}
            preload={controls ? "metadata" : "auto"}
            onLoadedData={() => setLoaded(true)}
            className={`absolute inset-0 h-full w-full object-cover transition-opacity duration-500 ${loaded ? "opacity-100" : "opacity-0"}`}
          />
        ) : (
          <img
            src={src}
            alt={alt}
            loading="lazy"
            decoding="async"
            onLoad={() => setLoaded(true)}
            className={`absolute inset-0 h-full w-full object-cover transition-opacity duration-500 ${loaded ? "opacity-100" : "opacity-0"}`}
          />
        )}
        {children ? <div className="absolute inset-0">{children}</div> : null}
      </div>
      {caption ? (
        <figcaption className="mt-2 text-center text-sm text-muted-foreground">{caption}</figcaption>
      ) : null}
    </motion.figure>
  );
}
