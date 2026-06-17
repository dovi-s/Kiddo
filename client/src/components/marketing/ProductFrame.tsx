import { motion, useReducedMotion } from "framer-motion";
import { Link } from "wouter";
import { ArrowRight } from "lucide-react";

// A real product screenshot in a clean CSS phone bezel, revealed on scroll.
// Two modes:
//   - static (default): a single viewport screenshot fills the phone window.
//   - scroll: a TALL full-page screenshot auto-pans inside the window (a
//     seamless "the page being scrolled" loop, done in CSS/motion so it works
//     on iOS with no video). Pass imgHeight = the full image's logical px height.
//
// Optional `href` turns the frame into a doorway to the LIVE demo — clicking it
// takes the visitor into the real product where they can actually tap a stock,
// tap a gifter, send a thank-you. A "See it live" hint surfaces on hover.
//
// Motion matches the page idiom ([0.22,1,0.36,1], once-in-view) and respects
// prefers-reduced-motion. IP-safe Rivera screens live in client/public/product/.

type Props = {
  src: string;
  alt: string;
  caption?: string;
  tilt?: "left" | "right" | "none";
  className?: string;
  mode?: "static" | "scroll";
  /** full-page image logical height (px). Required for mode="scroll". */
  imgHeight?: number;
  /** make the frame a clickable doorway (e.g. "/demo") */
  href?: string;
  /** hover/affordance label when href is set */
  liveLabel?: string;
};

const EASE = [0.22, 1, 0.36, 1] as const;
const WINDOW_H = 852;

export function ProductFrame({ src, alt, caption, tilt = "none", className = "", mode = "static", imgHeight, href, liveLabel = "See it live" }: Props) {
  const reduce = useReducedMotion();
  const rotate = tilt === "left" ? -2.2 : tilt === "right" ? 2.2 : 0;
  const isScroll = mode === "scroll" && !!imgHeight && imgHeight > WINDOW_H;
  const pan = isScroll ? (1 - WINDOW_H / imgHeight!) * 100 : 0;
  const dur = isScroll ? Math.max(11, (imgHeight! - WINDOW_H) / 175) : 0;

  const phone = (
    <div className={`group relative rounded-[2.6rem] bg-[#0c140f] p-2.5 shadow-[0_30px_60px_-18px_rgba(12,20,15,0.45)] ring-1 ring-black/5 transition-transform duration-300 will-change-transform ${href ? "hover:-translate-y-1" : ""}`}>
      <div className="relative overflow-hidden rounded-[2.05rem] bg-white" style={{ aspectRatio: "393 / 852" }}>
        {isScroll && !reduce ? (
          <motion.img
            src={src}
            alt={alt}
            loading="lazy"
            decoding="async"
            className="absolute left-0 top-0 block w-full"
            initial={{ y: "0%" }}
            whileInView={{ y: ["0%", `-${pan}%`] }}
            viewport={{ once: false, margin: "-10%" }}
            transition={{ duration: dur, ease: "easeInOut", repeat: Infinity, repeatType: "reverse", repeatDelay: 1.3 }}
          />
        ) : (
          <img src={src} alt={alt} loading="lazy" decoding="async" className="absolute left-0 top-0 block w-full" />
        )}
        {isScroll ? (
          <>
            <div aria-hidden className="pointer-events-none absolute inset-x-0 top-0 h-8 bg-gradient-to-b from-black/10 to-transparent" />
            <div aria-hidden className="pointer-events-none absolute inset-x-0 bottom-0 h-8 bg-gradient-to-t from-black/10 to-transparent" />
          </>
        ) : null}
        {href ? (
          <div className="pointer-events-none absolute inset-x-0 bottom-0 flex justify-center pb-4 opacity-0 transition-opacity duration-300 group-hover:opacity-100">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-[#0c140f]/90 px-3.5 py-1.5 text-xs font-semibold text-white shadow-lg backdrop-blur-sm">
              {liveLabel}
              <ArrowRight className="h-3.5 w-3.5" />
            </span>
          </div>
        ) : null}
      </div>
    </div>
  );

  return (
    <motion.figure
      initial={reduce ? { opacity: 1 } : { opacity: 0, y: 28, scale: 0.96 }}
      whileInView={reduce ? { opacity: 1 } : { opacity: 1, y: 0, scale: 1, rotate }}
      viewport={{ once: true, margin: "-60px" }}
      transition={reduce ? { duration: 0 } : { duration: 0.7, ease: EASE }}
      className={`relative mx-auto w-full max-w-[260px] ${className}`}
    >
      <div
        aria-hidden
        className="pointer-events-none absolute -inset-6 rounded-[3rem] bg-[radial-gradient(closest-side,hsl(var(--kiddo-gold)/0.16),transparent)] blur-2xl"
      />
      {href ? (
        <Link href={href} className="block cursor-pointer rounded-[2.6rem] outline-none focus-visible:ring-2 focus-visible:ring-[hsl(var(--kiddo-gold))]" aria-label={`${alt} ${liveLabel}`}>
          {phone}
        </Link>
      ) : (
        phone
      )}
      {caption ? (
        <figcaption className="mt-4 text-center text-xs text-muted-foreground">
          {caption}
          {href ? <span className="ml-1 font-medium text-primary">{liveLabel} &rarr;</span> : null}
        </figcaption>
      ) : null}
    </motion.figure>
  );
}
