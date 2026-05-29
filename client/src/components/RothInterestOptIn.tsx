// Roth IRA waitlist opt-in surface for the parent signup flow.
//
// Per project_kid_2.0_handoff_funnel.md (locked 2026-05-23): the
// 18-handoff is the only product-transition window Kiddo has, and the
// kid-2.0 funnel (Roth IRA → banking → adult brokerage → P2P stock
// payments) is the linchpin of the entire long-term unit economics
// thesis. Validating that thesis pre-launch is the cheapest possible
// signal on the most expensive bet the company is making.
//
// This component captures parent intent at signup — 18 years before
// the actual Roth IRA product needs to exist. If 60-70% of new parents
// opt in, the kid-2.0 funnel is real and the Year 2-3 build is
// justified. If it's 15%, the long-term revenue model needs a rebuild
// BEFORE the company spends $2-5M acquiring customers on a thesis that
// won't compound.
//
// Behavioral design:
//   - Unchecked default. Active opt-in is the harder signal but the
//     honest one. Pre-checked-with-opt-out measures indifference,
//     not enthusiasm. For an investment decision this size, indifference
//     is the wrong signal.
//   - Calm tone, not transactional. This is a quiet check-in moment
//     between the celebration above (the kid's fund is live) and the
//     practical sharing below (the gift link). Not a sales pitch.
//   - Names a specific future moment ("when [Emma] is 18 and has
//     earned income") to make the abstract product tangible. The
//     earned-income mention is honest about the IRA requirement and
//     pre-trains the parent on the eventual flow.
//   - Single click to opt in. State persists immediately. No "submit"
//     button — the toggle IS the action.

import { useState } from "react";
import { Check, Bell } from "lucide-react";
import { haptic } from "@/lib/haptics";

export type RothInterestOptInProps = {
  childName: string;
  className?: string;
};

export function RothInterestOptIn({ childName, className }: RothInterestOptInProps) {
  const [optedIn, setOptedIn] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const displayName = (childName || "your kid").trim() || "your kid";

  const handleToggle = async () => {
    if (submitting) return;
    const next = !optedIn;
    // Optimistic flip — the UI is the source of truth for the user's
    // experience; the server call is best-effort. If it fails we revert
    // and show an error, but we don't block the click on the network.
    setOptedIn(next);
    setSubmitting(true);
    setError(null);
    haptic(next ? "success" : "light");

    try {
      const response = await fetch("/api/users/me/roth-interest", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ interested: next }),
      });
      if (!response.ok) {
        throw new Error(`${response.status}`);
      }
    } catch (e) {
      // Revert on failure; let the parent retry by tapping again.
      setOptedIn(!next);
      setError("Couldn't save right now. Tap to try again.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className={className}>
      <button
        type="button"
        onClick={() => void handleToggle()}
        className={`w-full rounded-2xl border p-4 text-left transition-colors ${
          optedIn
            ? "border-primary/40 bg-primary/5"
            : "border-border bg-card hover:border-primary/30"
        }`}
        data-testid="roth-interest-opt-in"
        aria-pressed={optedIn}
      >
        <div className="flex items-start gap-3">
          <div
            className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-xl transition-colors ${
              optedIn ? "bg-primary text-primary-foreground" : "bg-primary/10 text-primary"
            }`}
          >
            {optedIn ? <Check size={16} strokeWidth={2.5} /> : <Bell size={16} strokeWidth={1.8} />}
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold text-foreground">
              {optedIn
                ? `We'll let you know about Roth IRA for ${displayName}.`
                : `When ${displayName} is 18, the fund becomes ${displayName === "your kid" ? "theirs" : (displayName.endsWith("s") ? `${displayName}'` : `${displayName}'s`)}.`}
            </p>
            <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
              {optedIn
                ? `When ${displayName} has earned income at 18, a Roth IRA lets the money keep compounding tax-free for life. Tap to opt out.`
                : `Once ${displayName} has earned income, a Roth IRA lets the money keep compounding tax-free for life. Tap if you want us to let you know when we offer it.`}
            </p>
            {error && (
              <p className="mt-2 text-xs text-destructive">{error}</p>
            )}
          </div>
        </div>
      </button>
    </div>
  );
}
