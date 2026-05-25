import { type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

// Unified empty-state primitive. Built 2026-05-25 per the team-audit
// visual-system recommendation: previously Activity / MemoryBook /
// Dashboard / Settings each rendered their own bespoke empty states
// with different visual languages. A parent scanning across tabs saw
// 4 different "nothing-here-yet" treatments — visual continuity broke.
//
// This component is for LIST empty states ("you have no activity yet",
// "no entries in your Memory Book yet") — NOT for value-prop hero
// empty states (Dashboard's hero card stays custom because it carries
// the fund's value-prop messaging in addition to the empty-balance
// state, which is a different kind of surface).
//
// API design:
//   - icon: optional LucideIcon. Renders in an evergreen-tinted chip.
//     Skip when the empty state is purely informational and the icon
//     would add chrome without meaning.
//   - title: single-line headline. font-heading, bold.
//   - description: optional supporting prose. ReactNode (string or
//     JSX) so consumers can interpolate child names + emphasis.
//   - action: optional ReactNode (typically <Button> or <><Button/><Button/></>
//     for multi-CTA cases like MemoryBook's "Share" + "Write first note").
//     Multi-action cases render side-by-side on sm+ and stacked on mobile.
//   - variant:
//       "card"   — kiddo-card wrapper with full padding (the default;
//                  matches MemoryBook + most product surfaces)
//       "inline" — rounded border-card; lighter weight (matches Activity's
//                  filtered-empty state — narrower visual presence)
//   - align: "left" (default, matches Activity + MemoryBook patterns)
//     or "center" (matches Settings empty-section pattern when used).

export type EmptyStateProps = {
  icon?: LucideIcon;
  title: string;
  description?: React.ReactNode;
  action?: React.ReactNode;
  variant?: "card" | "inline";
  align?: "left" | "center";
  className?: string;
  testId?: string;
};

export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
  variant = "card",
  align = "left",
  className,
  testId,
}: EmptyStateProps) {
  return (
    <div
      className={cn(
        variant === "card" && "kiddo-card p-8 md:p-10",
        variant === "inline" && "rounded-2xl border border-border bg-card px-6 py-10",
        align === "center" && "text-center",
        align === "left" && "text-left",
        className,
      )}
      data-testid={testId}
    >
      {Icon && (
        <div
          className={cn(
            "mb-5 flex h-14 w-14 items-center justify-center rounded-2xl bg-[hsl(var(--kiddo-evergreen)/0.10)]",
            align === "center" && "mx-auto",
          )}
          aria-hidden="true"
        >
          <Icon size={24} className="text-[hsl(var(--kiddo-evergreen))]" />
        </div>
      )}
      <h3 className="font-heading text-xl font-bold leading-tight text-foreground">
        {title}
      </h3>
      {description && (
        <p
          className={cn(
            "mt-2 text-sm leading-relaxed text-muted-foreground",
            // max-width caps the line length for readability on wide
            // viewports. center-aligned variant centers the prose block.
            "max-w-md",
            align === "center" && "mx-auto",
          )}
        >
          {description}
        </p>
      )}
      {action && (
        <div
          className={cn(
            "mt-6 flex flex-col gap-2 sm:flex-row sm:flex-wrap",
            align === "center" && "justify-center",
          )}
        >
          {action}
        </div>
      )}
    </div>
  );
}
