import { motion, useReducedMotion } from "framer-motion";
import { Link } from "wouter";
import { ArrowRight } from "lucide-react";

// A desktop screenshot in a clean browser-chrome frame. Kiddo is a full
// responsive web app, not only a phone app, so the marketing site shows it on
// the desktop too. Optional `href` makes it a doorway into the live demo.

type Props = {
  src: string;
  alt: string;
  caption?: string;
  className?: string;
  href?: string;
  liveLabel?: string;
};

const EASE = [0.22, 1, 0.36, 1] as const;

export function BrowserFrame({ src, alt, caption, className = "", href, liveLabel = "See it live" }: Props) {
  const reduce = useReducedMotion();

  const frame = (
    <div className={`group relative overflow-hidden rounded-2xl border border-black/10 bg-[#0c140f] shadow-[0_40px_80px_-24px_rgba(12,20,15,0.5)] transition-transform duration-300 ${href ? "hover:-translate-y-1" : ""}`}>
      <div className="flex items-center gap-2 px-4 py-3">
        <span className="h-3 w-3 rounded-full bg-[#ff5f57]" />
        <span className="h-3 w-3 rounded-full bg-[#febc2e]" />
        <span className="h-3 w-3 rounded-full bg-[#28c840]" />
        <div className="ml-3 flex-1">
          <div className="mx-auto w-2/3 max-w-[220px] rounded-md bg-white/10 py-1 text-center text-[11px] font-medium tracking-wide text-white/55">
            Kiddo
          </div>
        </div>
      </div>
      <img src={src} alt={alt} loading="lazy" decoding="async" className="block w-full" />
      {href ? (
        <div className="pointer-events-none absolute inset-x-0 bottom-0 flex justify-center pb-5 opacity-0 transition-opacity duration-300 group-hover:opacity-100">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-[#0c140f]/90 px-4 py-2 text-xs font-semibold text-white shadow-lg backdrop-blur-sm">
            {liveLabel}
            <ArrowRight className="h-3.5 w-3.5" />
          </span>
        </div>
      ) : null}
    </div>
  );

  return (
    <motion.figure
      initial={reduce ? { opacity: 1 } : { opacity: 0, y: 30 }}
      whileInView={reduce ? { opacity: 1 } : { opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-60px" }}
      transition={reduce ? { duration: 0 } : { duration: 0.7, ease: EASE }}
      className={`relative mx-auto w-full max-w-3xl ${className}`}
    >
      <div
        aria-hidden
        className="pointer-events-none absolute -inset-8 rounded-[2.5rem] bg-[radial-gradient(closest-side,hsl(var(--kiddo-gold)/0.12),transparent)] blur-2xl"
      />
      {href ? (
        <Link href={href} className="block cursor-pointer rounded-2xl outline-none focus-visible:ring-2 focus-visible:ring-[hsl(var(--kiddo-gold))]" aria-label={`${alt} ${liveLabel}`}>
          {frame}
        </Link>
      ) : (
        frame
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
