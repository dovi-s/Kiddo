// Plan Benefits card. Per the 2026-05-13 "explore plan benefits"
// audit: pre-purchase Kiddo is excellent at "why you should pay";
// post-purchase it was nearly silent on "what you're paying for."
// This card fills that gap. Rendered on Account "Plan & billing"
// tab (primary location per the 2026-05-14 WHO/HOW IA Phase 1c-B)
// AND on the Settings membership tab (backward-compat target for
// in-flight Stripe sessions that pre-date the URL move).
//
// Three sections:
//   1. Your benefits — bullet list of features the user has access to
//   2. This year — usage stats pulled from the server (no invented metrics)
//   3. Haven't tried — ONE soft nudge for an unused feature, dismissable
//
// Render rules:
//   - Only shown to paying users (starter / family / legacy). Free
//     users skip the card; "Your Free benefits" reads weird.
//   - Calm-Apple-Settings register. No upsell language. No comparison
//     to other tiers (the plan cards below already do that).
//   - Nudge dismissal is per-nudge + per-device, localStorage Set
//     pattern (see feedback_dismissal_storage_pattern.md). Once
//     dismissed, that specific nudge never re-fires for this device.
//
// What this card is NOT:
//   - A gamification surface (no streaks, no badges, no XP)
//   - A push-style "EXPLORE YOUR BENEFITS!" CTA
//   - An upsell to higher tiers (that's the plan cards below)
//   - A retention modal popped on app-open (bad pattern)

import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  BookOpen,
  CalendarHeart,
  Check,
  Eye,
  Headphones,
  Home,
  Image,
  Repeat,
  SlidersHorizontal,
  Users,
  X,
} from "lucide-react";

type PlanBenefitsUsage = {
  recurringActiveCount: number;
  recurringMonthlyTotal: string;
  parentMemoryEntriesThisYear: number;
  coParentInvitedCount: number;
  activeOccasionsCount: number;
  customMixActive: boolean;
};

// Dismissal storage for the soft "haven't tried" nudge. Per
// feedback_dismissal_storage_pattern.md: must be a set, not a single
// value, with cross-tab resync via the native storage event.
const NUDGE_STORAGE_KEY = "kora:plan-benefit-nudge-dismissed";

function readDismissedNudges(): Set<string> {
  if (typeof window === "undefined") return new Set();
  try {
    const raw = window.localStorage.getItem(NUDGE_STORAGE_KEY);
    if (!raw) return new Set();
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return new Set();
    return new Set(parsed.filter((id) => typeof id === "string"));
  } catch {
    return new Set();
  }
}

function persistDismissedNudges(set: Set<string>): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(NUDGE_STORAGE_KEY, JSON.stringify(Array.from(set)));
  } catch {
    // localStorage quota / disabled — fail silently. Worst case the
    // nudge re-surfaces next visit.
  }
}

// Catalog. Each benefit is a row in section 1. Each nudge maps to a
// benefit. Keep the catalog in one place so it's easy to scan and
// edit when tier-feature decisions move.
const PLUS_BENEFITS = [
  { id: "recurring", icon: Repeat, title: "Recurring investments", body: "Your monthly investment auto-fires. Set it and watch it compound." },
  { id: "memory-media", icon: Image, title: "Memory Book photos, videos, voice", body: "Add your own media to your child's timeline." },
  { id: "custom-mix", icon: SlidersHorizontal, title: "Custom fund mix", body: "Pick the stocks yourself instead of the default basket." },
  { id: "co-parent", icon: Users, title: "Co-parent access", body: "Invite your partner or co-guardian to the fund." },
  // Display says "occasions" per the locked 2026-05-13 copy rule;
  // internal code still uses `events` (table name, types, etc.).
  { id: "occasions-3", icon: CalendarHeart, title: "3 active occasions at once", body: "Run up to three in parallel." },
  { id: "priority-support", icon: Headphones, title: "Priority support", body: "Fast-track help when you need it." },
] as const;

const FAMILY_BENEFITS = [
  { id: "everything-plus", icon: Check, title: "Everything in Plus", body: "All Plus features, across every child in your household." },
  { id: "unlimited-children", icon: Users, title: "Unlimited children", body: "One subscription covers every kid." },
  { id: "memory-every-kid", icon: BookOpen, title: "Memory Book for every child", body: "Each kid gets their own full timeline." },
  // Locked 2026-05-13 Kid View policy: Kid View is FREE across all
  // plans; the 'Lite vs Full' framing was retired. Family's
  // differentiator is multi-kid access, NOT fuller-Kid-View-per-kid.
  // Body says "their own fund" — multi-kid scaling — not "full
  // experience" which would leak the retired tier framing.
  { id: "kid-view-every-kid", icon: Eye, title: "Kid View for every child", body: "Each kid sees their own fund." },
  { id: "household-view", icon: Home, title: "Household view", body: "All your kids' funds in one place." },
  { id: "unlimited-occasions", icon: CalendarHeart, title: "Unlimited occasions", body: "Run as many as you want." },
] as const;

// Nudge candidates — ordered by impact. Picker walks the list and
// surfaces the first one that's both untried (per usage) AND not
// dismissed (per localStorage). ONE shown at a time; calm by design.
type Nudge = { id: string; title: string; body: string };

function pickNudge(usage: PlanBenefitsUsage, plan: "starter" | "family", dismissed: Set<string>): Nudge | null {
  // Recurring investments is the Plus headline. If they haven't set
  // one up, this is the most valuable nudge in the catalog.
  if (usage.recurringActiveCount === 0 && !dismissed.has("nudge:recurring")) {
    return {
      id: "nudge:recurring",
      title: "Try recurring investments",
      body: "Set a monthly amount that fires automatically. The headline feature you're paying for.",
    };
  }
  if (!usage.customMixActive && !dismissed.has("nudge:custom-mix")) {
    return {
      id: "nudge:custom-mix",
      title: "Pick your own stocks",
      body: `${plan === "family" ? "Family" : "Plus"} lets you customize the fund mix. Default is fine; custom is yours.`,
    };
  }
  if (usage.coParentInvitedCount === 0 && !dismissed.has("nudge:co-parent")) {
    return {
      id: "nudge:co-parent",
      title: "Invite a co-parent",
      body: "Share access with your partner. They can see, can't change billing.",
    };
  }
  if (usage.parentMemoryEntriesThisYear === 0 && !dismissed.has("nudge:memory-author")) {
    return {
      id: "nudge:memory-author",
      title: "Add a letter or photo",
      body: "The Memory Book is yours to author too. Photos, videos, voice memos.",
    };
  }
  return null;
}

interface Props {
  plan: "starter" | "family" | "legacy";
}

export function PlanBenefitsCard({ plan }: Props) {
  // Legacy carries Family benefits + an honest "2 occasion credits/yr"
  // (per the 2026-05-12 Legacy pull decision). For the benefits card,
  // we render Family-shape since the in-app feature surface is
  // functionally Family.
  const effectivePlan: "starter" | "family" = plan === "starter" ? "starter" : "family";
  const benefits = effectivePlan === "family" ? FAMILY_BENEFITS : PLUS_BENEFITS;
  const planLabel = plan === "starter" ? "Kiddo+" : plan === "legacy" ? "Kiddo Legacy" : "Kiddo Family";

  const { data: usage } = useQuery<PlanBenefitsUsage>({
    queryKey: ["/api/me/plan-benefits-usage"],
    queryFn: async () => {
      const res = await fetch("/api/me/plan-benefits-usage", { credentials: "include" });
      if (!res.ok) throw new Error("Failed to load usage");
      return res.json();
    },
  });

  // Local cache of dismissed nudges. Hydrated lazily; cross-tab
  // resync via the storage event so dismissing in tab A clears
  // tab B without a refresh.
  const [dismissed, setDismissed] = useState<Set<string>>(() => readDismissedNudges());
  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key === NUDGE_STORAGE_KEY) setDismissed(readDismissedNudges());
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  const handleDismissNudge = (nudgeId: string) => {
    const next = new Set(dismissed);
    next.add(nudgeId);
    setDismissed(next);
    persistDismissedNudges(next);
  };

  const nudge = useMemo(() => {
    if (!usage) return null;
    return pickNudge(usage, effectivePlan, dismissed);
  }, [usage, effectivePlan, dismissed]);

  // The "This year" section only renders when at least one stat is
  // non-zero — empty stats would read as "you haven't done anything
  // with your subscription" which is hostile. Better to hide.
  const hasAnyUsage = usage && (
    usage.recurringActiveCount > 0 ||
    usage.parentMemoryEntriesThisYear > 0 ||
    usage.coParentInvitedCount > 0 ||
    usage.activeOccasionsCount > 0 ||
    usage.customMixActive
  );

  return (
    <div className="kiddo-card">
      <div className="p-5 space-y-5">
        {/* Header. Earlier version had a "WHAT YOU'RE PAYING FOR"
            eyebrow — pulled because it read as defensive/transactional
            ("are you sure you're getting value?") right when the user
            opens Settings. Apple Settings register: just name the
            section, let the contents speak. Plan name + Active state
            already lives in the card directly above this one; the
            title doesn't need to re-state it. */}
        <h2 className="font-heading text-lg font-semibold text-foreground">
          What&apos;s included
        </h2>

        {/* Benefits list — always visible */}
        <ul className="space-y-2.5">
          {benefits.map((b) => {
            const Icon = b.icon;
            return (
              <li key={b.id} className="flex items-start gap-3">
                <span className="shrink-0 mt-0.5 h-7 w-7 rounded-full bg-primary/10 text-primary flex items-center justify-center">
                  <Icon size={14} />
                </span>
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-foreground">{b.title}</p>
                  <p className="text-xs text-muted-foreground leading-relaxed">{b.body}</p>
                </div>
              </li>
            );
          })}
        </ul>

        {/* This year — usage stats. Only renders when there's real
            data to show. Each stat is a calm fact, not a celebration. */}
        {hasAnyUsage && usage && (
          <div className="rounded-2xl border border-border bg-muted/30 p-4 space-y-1.5">
            <p className="text-xs uppercase tracking-wide text-muted-foreground mb-1">This year</p>
            {usage.recurringActiveCount > 0 && (
              <Stat label="Recurring investments">
                {usage.recurringActiveCount} active, ${parseFloat(usage.recurringMonthlyTotal).toFixed(0)}/mo
              </Stat>
            )}
            {usage.parentMemoryEntriesThisYear > 0 && (
              <Stat label="Memory Book entries (by you)">
                {usage.parentMemoryEntriesThisYear} this year
              </Stat>
            )}
            {usage.coParentInvitedCount > 0 && (
              <Stat label="Co-parents">
                {usage.coParentInvitedCount} invited
              </Stat>
            )}
            {usage.activeOccasionsCount > 0 && (
              <Stat label="Active occasions">
                {usage.activeOccasionsCount}
                {effectivePlan === "starter" ? " of 3" : ""}
              </Stat>
            )}
            {usage.customMixActive && (
              <Stat label="Custom fund mix">
                Active
              </Stat>
            )}
          </div>
        )}

        {/* Haven't tried — ONE soft nudge, dismissable. No-op when
            nothing's untried OR everything's been dismissed. */}
        {nudge && (
          <div className="rounded-2xl border border-primary/20 bg-primary/5 p-4">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-sm font-semibold text-foreground">{nudge.title}</p>
                <p className="mt-0.5 text-xs text-foreground/70 leading-relaxed">{nudge.body}</p>
              </div>
              <button
                type="button"
                onClick={() => handleDismissNudge(nudge.id)}
                className="shrink-0 -mr-1 -mt-1 h-7 w-7 rounded-full text-muted-foreground hover:text-foreground hover:bg-foreground/5 flex items-center justify-center transition-colors"
                aria-label="Dismiss this suggestion"
                data-testid={`dismiss-${nudge.id}`}
              >
                <X size={14} />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function Stat({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-3 text-sm">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-semibold text-foreground tabular-nums">{children}</span>
    </div>
  );
}
