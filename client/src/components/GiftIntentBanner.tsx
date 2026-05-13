// Gift Intent Banner — surfaces a pending gift intent at the top
// of /get-started when the parent arrived via a gifter's nudge.
// Per GIFTER_LED_ACQUISITION_SPEC.md.
//
// Flow:
//   1. Gifter creates intent at /give-a-gift → server emails parent
//   2. Parent clicks link in email → lands at /get-started?intent=<token>
//   3. This banner reads the token, fetches the intent, and renders
//      a calm header: "Sarah has $250 ready for Emma. Set up Emma's
//      fund and Sarah's gift flows automatically."
//
// Self-contained: takes no props, reads its own URL params, hides
// silently when no token or no matching intent. Safe to drop at
// the top of any page without breaking it.

import { useEffect, useState } from "react";
import { useSearch } from "wouter";
import { motion } from "framer-motion";
import { Gift, Heart } from "lucide-react";

type GiftIntent = {
  gifterName: string;
  kidFirstName: string;
  amount: string;
  message: string | null;
  status: string;
};

export function GiftIntentBanner() {
  const search = useSearch();
  const token = new URLSearchParams(search || "").get("intent");
  const [intent, setIntent] = useState<GiftIntent | null>(null);

  useEffect(() => {
    if (!token) return;
    let cancelled = false;
    void (async () => {
      try {
        const res = await fetch(`/api/gift-intents/${encodeURIComponent(token)}`);
        if (!res.ok || cancelled) return;
        const data = (await res.json()) as GiftIntent;
        // Only show for pending intents — once paired/completed/
        // cancelled, this banner shouldn't re-confuse the parent.
        if (data.status === "pending") setIntent(data);
      } catch {
        // Silent failure — banner is decorative, not load-bearing.
      }
    })();
    return () => { cancelled = true; };
  }, [token]);

  if (!intent) return null;

  const amount = parseFloat(String(intent.amount || "0"));

  return (
    <motion.div
      initial={{ opacity: 0, y: -8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      className="mb-6 rounded-3xl border-2 border-primary/30 bg-primary/5 p-5"
      data-testid="gift-intent-banner"
    >
      <div className="flex items-start gap-3">
        <div className="shrink-0 h-10 w-10 rounded-full bg-primary/15 text-primary flex items-center justify-center">
          <Gift size={18} />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-xs uppercase tracking-wide text-primary font-semibold">
            Gift waiting
          </p>
          <h2 className="mt-1 font-heading text-lg font-bold text-foreground leading-snug">
            {intent.gifterName} has ${amount.toFixed(0)} ready for {intent.kidFirstName}.
          </h2>
          <p className="mt-2 text-sm text-foreground/75 leading-relaxed">
            Set up {intent.kidFirstName}'s fund below and {intent.gifterName}'s gift flows automatically. They'll get a note once you're set up.
          </p>
          {intent.message && (
            <div className="mt-3 rounded-xl bg-card border border-border p-3">
              <p className="flex items-start gap-2 text-xs uppercase tracking-wide text-muted-foreground">
                <Heart size={12} className="mt-0.5 text-primary" />
                <span>{intent.gifterName}'s note</span>
              </p>
              <p className="mt-1.5 text-sm text-foreground/80 italic leading-relaxed">
                "{intent.message}"
              </p>
            </div>
          )}
        </div>
      </div>
    </motion.div>
  );
}
