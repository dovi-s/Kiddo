import * as React from "react"
import { cn } from "@/lib/utils"
import { haptic } from "@/lib/haptics"

// Single source of truth for form text inputs across the app. Class string
// is intentionally identical to the inline pattern AddFundSheet established
// — adopting the primitive doesn't shift any existing visual:
//   • h-11 (44px) — matches the rest of the form ergonomics
//   • border-2 border-border — solid, not 60% opacity (more confident)
//   • bg-card — white-ish surface, not transparent
//   • focus:ring-4 focus:ring-primary/10 — the wide, soft brand focus ring
//   • text-sm placeholder:text-muted-foreground/50 — clear hierarchy
//   • haptic on focus — small but meaningful "the app heard you"
//
// className override is supported for the rare case (compact inputs in
// dense rows, e.g., the recurring schedule editor) — but defaults are
// what every standard form should use.
const Input = React.forwardRef<HTMLInputElement, React.ComponentProps<"input">>(
  ({ className, type, onFocus, ...props }, ref) => {
    const handleFocus = (e: React.FocusEvent<HTMLInputElement>) => {
      haptic("selection")
      onFocus?.(e)
    }

    return (
      <input
        type={type}
        className={cn(
          // text-base on mobile (16px) prevents iOS Safari auto-zoom on
          // focus; sm:text-sm restores the 14px visual on tablets+. Without
          // 16px on mobile, focusing any input zooms the page in. With it,
          // the page stays put and the input visual is unchanged on desktop.
          "w-full h-11 px-3 border-2 border-border rounded-xl text-foreground text-base sm:text-sm placeholder:text-muted-foreground/50 focus:outline-none focus:border-primary focus:ring-4 focus:ring-primary/10 bg-card transition-all disabled:cursor-not-allowed disabled:opacity-50",
          className
        )}
        ref={ref}
        onFocus={handleFocus}
        {...props}
      />
    )
  }
)
Input.displayName = "Input"

export { Input }
