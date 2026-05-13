import { cn } from "@/lib/utils"

function Skeleton({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn("animate-pulse rounded-md bg-primary/10", className)}
      {...props}
    />
  )
}

// Named variant skeletons that match the post-load layouts of the most
// common surfaces. Using these instead of inline `<div className="h-48
// bg-muted animate-pulse" />` keeps loading states recognizable as the
// thing about to appear — premium-app polish ("the page is preparing your
// content"), not "something will eventually go here."
type SkeletonVariant = "hero" | "stat-row" | "list-row" | "text-line" | "card-block"
function KiddoSkeleton({
  variant,
  className,
  ...props
}: { variant: SkeletonVariant } & React.HTMLAttributes<HTMLDivElement>) {
  const presets: Record<SkeletonVariant, string> = {
    // Tall hero card — matches Dashboard hero pre-load
    hero: "h-48 w-full rounded-3xl",
    // Three-up stat strip row
    "stat-row": "h-10 w-full rounded-xl",
    // Single list item (gift, event, contributor)
    "list-row": "h-14 w-full rounded-2xl",
    // Single text line — for placeholder copy
    "text-line": "h-4 w-3/4 rounded-md",
    // Generic card-shaped block
    "card-block": "h-32 w-full rounded-2xl",
  }
  return (
    <div
      className={cn("animate-pulse bg-primary/10", presets[variant], className)}
      role="status"
      aria-label="Loading…"
      {...props}
    />
  )
}

export { Skeleton, KiddoSkeleton }
