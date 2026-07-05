// FounderBadge — the Founding Member pill. Renders for users with
// `founderTier` set (the <=1,000 launch founders; stamped by
// completeFounderClaim). Gold accent — the brand's celebratory token
// (evergreen is the default chrome; gold marks the special). Two jobs:
//   - identity on the founder's OWN surfaces (Dashboard, Settings, KidView)
//   - advocacy on every gift link they share (GiftCheckout inviter section):
//     "Kiddo trusted this person to help build it" → social capital that
//     reinforces the gifter loop.
// Per project_founding_member_claim_flow_spec.md (component 6).

import { Crown } from "lucide-react";
import { cn } from "@/lib/utils";

export function FounderBadge({
  className,
  label = "Founder",
  tone = "default",
}: {
  className?: string;
  /** "Founder" (default, compact) or "Founding Member" for roomier surfaces. */
  label?: string;
  /** "default" = gold-on-light (cards/profile). "onDark" = legible on dark
   *  heroes (e.g. the GiftCheckout cover) where gold-ink text would vanish. */
  tone?: "default" | "onDark";
}) {
  const toneClasses =
    tone === "onDark"
      ? "border-[hsl(var(--kiddo-gold-light)/0.45)] bg-white/10 text-[hsl(var(--kiddo-gold-light))]"
      : "border-[hsl(var(--kiddo-gold)/0.35)] bg-[hsl(var(--kiddo-gold)/0.12)] text-[hsl(var(--kiddo-gold-ink))]";
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-2xs font-semibold leading-none",
        toneClasses,
        className,
      )}
      data-testid="founder-badge"
      title="Founding Member"
    >
      <Crown size={11} strokeWidth={2.4} className="shrink-0" />
      {label}
    </span>
  );
}
