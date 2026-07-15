// Gift status timeline — a calm, honest "where is my gift right now" beat.
//
// Why it exists: the most-cited principle across the fintech-UX canon (Wise's
// money-in-motion animation, per the WANDR / Eleken talks) is that the IN-FLIGHT
// moment is where a money product earns or loses trust. Kiddo nails the ARRIVAL
// (the dashboard count-up roll) but the 1-2 day settle was a line of static
// text. This visualizes the gift's real journey so the gifter feels it is safe
// and on its way, not vanished into a void.
//
// HONEST by construction: the three states mirror the already-approved settling
// copy ("settles into their investments over the next 1 to 2 business days").
// No claim beyond what the page already says, and no faked instant settlement.
// Structure + restrained motion are built here; the final tone is a founder call.
import { Fragment } from "react";
import { motion } from "framer-motion";
import { Check } from "lucide-react";

export type GiftStatusStep = "received" | "settling" | "invested";
const ORDER: GiftStatusStep[] = ["received", "settling", "invested"];
const LABELS: Record<GiftStatusStep, string> = {
  received: "Received",
  settling: "Settling",
  invested: "Invested",
};

export function GiftStatusTimeline({
  current = "settling",
  caption,
  className,
}: {
  current?: GiftStatusStep;
  caption?: string;
  className?: string;
}) {
  const currentIdx = Math.max(0, ORDER.indexOf(current));
  return (
    <div className={className} data-testid="gift-status-timeline">
      {/* pb makes room for the absolutely-positioned labels under each node */}
      <div className="flex items-center pb-5">
        {ORDER.map((step, i) => {
          const done = i < currentIdx;
          const active = i === currentIdx;
          const lit = i <= currentIdx;
          return (
            <Fragment key={step}>
              <div className="relative flex flex-col items-center">
                <motion.div
                  className="flex h-[18px] w-[18px] items-center justify-center rounded-full"
                  style={{
                    background: lit
                      ? "hsl(var(--kiddo-evergreen))"
                      : "hsl(var(--kiddo-evergreen) / 0.15)",
                  }}
                  initial={false}
                  animate={active ? { scale: [1, 1.14, 1] } : { scale: 1 }}
                  transition={
                    active
                      ? { duration: 1.9, repeat: Infinity, ease: "easeInOut" }
                      : { duration: 0.3 }
                  }
                >
                  {done ? (
                    <Check size={11} strokeWidth={3} className="text-white" />
                  ) : active ? (
                    <span className="h-[6px] w-[6px] rounded-full bg-white" />
                  ) : null}
                </motion.div>
                <span
                  className="absolute top-[23px] whitespace-nowrap text-3xs font-semibold"
                  style={{
                    color: lit
                      ? "hsl(var(--kiddo-evergreen))"
                      : "hsl(var(--muted-foreground) / 0.55)",
                  }}
                >
                  {LABELS[step]}
                </span>
              </div>
              {i < ORDER.length - 1 && (
                <div
                  className="mx-1.5 h-[2px] flex-1 overflow-hidden rounded-full"
                  style={{ background: "hsl(var(--kiddo-evergreen) / 0.15)" }}
                >
                  <motion.div
                    className="h-full rounded-full"
                    style={{ background: "hsl(var(--kiddo-evergreen))" }}
                    initial={{ width: 0 }}
                    animate={{ width: i < currentIdx ? "100%" : i === currentIdx ? "55%" : "0%" }}
                    transition={{ duration: 0.7, ease: "easeOut", delay: 0.15 + i * 0.15 }}
                  />
                </div>
              )}
            </Fragment>
          );
        })}
      </div>
      {caption && (
        <p className="mx-auto max-w-md text-center text-xs text-muted-foreground/80">{caption}</p>
      )}
    </div>
  );
}
