// Proactive Plus upgrade prompts at high-engagement Free moments.
// Per project_pre_launch_strategic_frame.md upgrade-conversion plan
// (locked 2026-05-23) — Prong A: surface Plus value at the moments
// when a Free parent reveals commitment to the platform. The Plus
// features are sufficient for emotionally engaged parents; the gap
// is they don't ENCOUNTER the value at the right moment.
//
// Four committed proactive triggers (plus the existing reactive
// MemoryMediaPicker Plus wall at commit 67bed3c which is prompt #5):
//
//   1. "third-entry": parent created their 3rd parent-authored
//      Memory Book entry. Signals they're building something but
//      can't yet add media.
//   2. "fifth-gift": fund has received 5+ settled gifts. Signals
//      the gift loop is working; the operator features become
//      legible at this volume.
//   3. "projection-3rd-view": parent has loaded the Projection
//      page 3+ times. Signals they're emotionally engaged with
//      the long-horizon math; custom mix becomes relevant.
//   4. "thirty-day-anniversary": account is 30+ days old. Signals
//      sustained commitment; broad operator-tools pitch lands.
//
// Each prompt:
//   - One-time per moment (dismiss key stored per-user)
//   - Calm tone — invitational not transactional (per the locked
//     Plus-gate-softness audit 2026-05-19)
//   - Daily-framing on price ($3.99/mo or 13¢/day) per locked
//     behavioral framing discipline (updated 2026-05-23 pricing-v3)
//   - Emotional pitch tied to the moment, not generic upgrade ask
//   - Names CURRENTLY SHIPPED Plus features only (no promising
//     sealed letters / printing that are Prong B post-launch
//     engineering, per the locked "no features that don't exist"
//     refusal)
//
// Per-user dismissal keys are in PER_USER_PREFIXES_TO_CLEAR
// (use-auth.ts) so shared-browser users don't inherit each other's
// dismissals.

import { useMemo, useState } from "react";
import { safeLocalSet } from "@/lib/local-cache";
import { Camera, Gift, TrendingUp, Crown, Lock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { FeatureWallModal } from "@/components/FeatureWallModal";
import { haptic } from "@/lib/haptics";
import { CollapseDismissSection } from "@/components/dashboard/CollapseDismissSection";

const DISMISS_KEY_PREFIX = "kora:dismissed:plus-prompt:";

export type PlusUpgradePromptKind =
  | "third-entry"
  | "fifth-gift"
  | "projection-3rd-view"
  | "thirty-day-anniversary";

type PromptCopy = {
  headline: string;
  body: string;
  icon: React.ComponentType<{ size?: number; className?: string; strokeWidth?: number }>;
  modalTitle: (childName: string) => string;
  modalBody: (childName: string) => string;
};

const PROMPT_COPY: Record<PlusUpgradePromptKind, PromptCopy> = {
  "third-entry": {
    headline: "You're building something.",
    body: "Plus lets you add your own photos, voice memos, and video so the Memory Book feels like yours, not just a list of gifts.",
    icon: Camera,
    modalTitle: (childName) => `Make ${childName}'s Memory Book yours.`,
    modalBody: (childName) =>
      `Plus parents add their own photos, voice memos, and video to entries they write. ${childName} hearing your voice from years ago is the artifact nothing else gives them. Gifter-attached media stays free on every plan; this unlocks YOUR media on the entries you write.`,
  },
  "fifth-gift": {
    headline: "The fund is becoming a story.",
    body: "Plus parents design the mix that gifts flow into, write their own Memory Book entries with photos and voice, and invite a co-parent. The operator tools for the parent who shows up every month.",
    icon: Gift,
    modalTitle: (childName) => `${childName}'s gift loop is working.`,
    modalBody: (childName) =>
      `Five gifts in is the moment Plus starts to make sense. Pick your own ETF mix so the money grows where you want it to. Add your own photos and voice memos to ${childName}'s Memory Book. Invite a co-parent to share the work. The operator features for the parent who shows up every month.`,
  },
  "projection-3rd-view": {
    headline: "Want to customize the mix?",
    body: "Plus lets you pick your own ETFs and switch strategies between conservative, balanced, and growth. Free uses the diversified default. Same projection math; different allocations.",
    icon: TrendingUp,
    modalTitle: (childName) => `Design what ${childName}'s fund grows into.`,
    modalBody: (childName) =>
      // Viewer-agnostic ("you", not "parents") + no "approaching majority" clause:
      // this prompt fires on the projection page, which BOTH parents (minor's fund)
      // and post-handoff adult owners see. "Plus lets you..." is correct for either.
      `Free funds invest in the diversified default mix that drives the projection above. Plus lets you pick your own ETFs and weights, and switch strategies (conservative, balanced, growth). Same long-horizon math; your call on the allocation.`,
  },
  "thirty-day-anniversary": {
    headline: "You've committed for a month.",
    body: "Plus gives you the operator tools: custom fund mix, your own photos and voice memos in the Memory Book, co-parent access, and a tax summary at year-end. The features for the parent who's in it for the long run.",
    icon: Crown,
    modalTitle: (childName) => `30 days into ${childName}'s fund.`,
    modalBody: (childName) =>
      `A month in is the moment Plus pays for itself. Custom fund mix so the money grows where you choose. Your own photos and voice memos in the Memory Book (the kid hearing your voice from years ago is the artifact nothing else gives them). Co-parent invite to share the work. Annual tax summary so January is easy. The features for the parent who's in this for ${childName}'s long run.`,
  },
};

export type PlusUpgradePromptCardProps = {
  kind: PlusUpgradePromptKind;
  childName?: string | null;
  fundId: string;
  className?: string;
};

export function PlusUpgradePromptCard({
  kind,
  childName,
  fundId,
  className,
}: PlusUpgradePromptCardProps) {
  const dismissKey = `${DISMISS_KEY_PREFIX}${kind}`;

  // Already dismissed on a prior visit → render nothing (no flash, no animation).
  // Read once; the live dismiss below is driven by `open` so it can collapse out.
  const initiallyDismissed = useMemo(() => {
    if (typeof window === "undefined") return false;
    try {
      return !!window.localStorage.getItem(dismissKey);
    } catch {
      return false;
    }
  }, [dismissKey]);

  const [open, setOpen] = useState(true);
  // FeatureWallModal state lives next to the trigger that opens it.
  const [wallOpen, setWallOpen] = useState(false);

  if (initiallyDismissed) return null;

  const copy = PROMPT_COPY[kind];
  const Icon = copy.icon;
  const displayChild = (childName || "your kid").trim() || "your kid";

  // Persist AFTER the collapse exit so the card glides closed (was an instant
  // unmount → snap). The "Not now" button just flips `open`.
  const persistDismiss = () => {
    try {
      safeLocalSet(dismissKey, new Date().toISOString());
    } catch {
      // best-effort
    }
  };

  return (
    <div className={className}>
      <CollapseDismissSection
        open={open}
        onExitComplete={persistDismiss}
        // Swipe-to-dismiss, same as every other dashboard banner. This is a
        // conversion card, so "should an upgrade nudge resist dismissal?" is a
        // fair question — but a card that won't swipe when everything else does
        // reads as a friction-trap, and this trust-anchor brand avoids
        // manipulative monetization. Wired to the SAME persisted dismiss as the
        // "Not now" button (setOpen(false) -> onExitComplete persists it).
        onRequestDismiss={() => setOpen(false)}
        className="rounded-2xl border border-primary/20 bg-primary/5 p-4"
        data-testid={`plus-upgrade-prompt-${kind}`}
      >
        <div className="flex items-start gap-3">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-primary/10">
            <Icon size={16} className="text-primary" strokeWidth={2} />
          </div>
          <div className="min-w-0 flex-1">
            <p className="flex items-center gap-1.5 text-sm font-semibold text-foreground">
              <Lock size={11} className="opacity-60" />
              <span>{copy.headline}</span>
            </p>
            <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
              {copy.body}
            </p>
            {/* Price callout — per project_behavioral_framing_discipline.md,
                daily framing on subscription price at every upgrade-intent
                surface. Foreground-weight on the monthly price (canonical
                disclosure), muted on the daily equivalent (cognitive
                reframe). Same pattern as MemoryMediaPicker Plus wall
                (commit 67bed3c). */}
            <p className="mt-1.5 text-[11px] text-muted-foreground/85">
              <span className="font-semibold text-foreground">$3.99/month</span>
              <span className="text-muted-foreground/70">, about 13¢ a day.</span>
            </p>
            <div className="mt-3 flex gap-2">
              <Button
                size="sm"
                variant="outline"
                className="rounded-xl"
                onClick={() => { haptic("selection"); setWallOpen(true); }}
                data-testid={`plus-prompt-cta-${kind}`}
              >
                Learn more
              </Button>
              <Button
                size="sm"
                variant="ghost"
                className="rounded-xl text-muted-foreground"
                onClick={() => { haptic("light"); setOpen(false); }}
                data-testid={`plus-prompt-dismiss-${kind}`}
              >
                Not now
              </Button>
            </div>
          </div>
        </div>
      </CollapseDismissSection>
      <FeatureWallModal
        open={wallOpen}
        onClose={() => setWallOpen(false)}
        featureId={`plus_prompt_${kind}`}
        requiredTier="plus"
        title={copy.modalTitle(displayChild)}
        body={copy.modalBody(displayChild)}
        upgradePath={`/account?tab=plan&upgrade=starter&fundId=${encodeURIComponent(fundId)}`}
      />
    </div>
  );
}

// Candidate-picker helper for the Dashboard surface. Returns the
// highest-priority prompt that should be shown given the user's
// state, or null if no prompt belongs. Priority order: most
// emotional moment wins (30-day anniversary > 5 gifts > 3 entries).
//
// This logic lives here (next to the prompt component) so the
// trigger thresholds and the prompt copy stay in lockstep — change
// one without the other and the prompt won't match the moment.
//
// Returns null when:
//   - User is already on a paid plan (Plus or Family)
//   - No trigger threshold is crossed
//   - All applicable prompts are dismissed
export function pickDashboardPlusPrompt(input: {
  effectivePlan: string | undefined | null;
  fundId: string;
  parentAuthoredEntryCount: number;
  settledGiftCount: number;
  accountAgeDays: number;
}): PlusUpgradePromptKind | null {
  const plan = String(input.effectivePlan || "").toLowerCase();
  // Any non-Free plan suppresses the prompt: starter (Plus) and family
  // cover the gated features; trial gives Plus features for 14 days;
  // legacy is grandfathered Kiddo Legacy (also above Plus).
  if (plan === "starter" || plan === "family" || plan === "trial" || plan === "legacy") return null;

  // Each candidate is suppressed if already dismissed in localStorage.
  // Priority order: 30-day > 5-gift > 3-entry. The earliest dismissed
  // gets out of the way and the next candidate takes the slot.
  const isDismissed = (kind: PlusUpgradePromptKind): boolean => {
    if (typeof window === "undefined") return false;
    try {
      return !!window.localStorage.getItem(`${DISMISS_KEY_PREFIX}${kind}`);
    } catch {
      return false;
    }
  };

  if (input.accountAgeDays >= 30 && !isDismissed("thirty-day-anniversary")) {
    return "thirty-day-anniversary";
  }
  if (input.settledGiftCount >= 5 && !isDismissed("fifth-gift")) {
    return "fifth-gift";
  }
  if (input.parentAuthoredEntryCount >= 3 && !isDismissed("third-entry")) {
    return "third-entry";
  }
  return null;
}
