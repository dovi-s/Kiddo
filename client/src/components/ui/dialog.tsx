import * as React from "react"
import * as DialogPrimitive from "@radix-ui/react-dialog"
import { cn } from "@/lib/utils"
import { haptic } from "@/lib/haptics"

const Dialog = DialogPrimitive.Root

const DialogTrigger = DialogPrimitive.Trigger

const DialogPortal = DialogPrimitive.Portal

const DialogClose = DialogPrimitive.Close

const DialogOverlay = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Overlay>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Overlay>
>(({ className, style, ...props }, ref) => (
  <DialogPrimitive.Overlay
    ref={ref}
    // Easing aligned to lib/motion (outExpo, the same curve as the count-up +
    // chevron) via INLINE animation-timing-function — reliably overrides
    // tailwindcss-animate's default (the per-state Tailwind utility didn't take).
    // Merged so a consumer's style still wins.
    style={{ animationTimingFunction: "cubic-bezier(0.16,1,0.3,1)", ...style }}
    className={cn(
      "fixed inset-0 z-50 bg-black/60 backdrop-blur-sm data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 duration-200",
      className
    )}
    {...props}
  />
))
DialogOverlay.displayName = DialogPrimitive.Overlay.displayName

// A11y rule for every DialogContent usage in the codebase:
//   - If you render a <DialogDescription> inside the dialog, pass NO aria-describedby
//     prop. Radix's context-binding will auto-associate the Description's id for you.
//   - If you do NOT render a DialogDescription, pass `aria-describedby={undefined}`
//     explicitly. This signals "I considered this and chose not to provide a
//     description" and suppresses Radix's dev warning.
//   - NEVER pass `aria-describedby={undefined}` AND render a DialogDescription.
//     The explicit undefined wins and breaks the Description's a11y association —
//     the visible Description text renders but screen readers don't see it as the
//     dialog's description. 2026-05-12 audit fixed three sites where the wrong
//     pattern was in place: share-modal.tsx + share-kit.tsx (missing opt-out) and
//     PersonalFundWaitlistModal.tsx (had both — the bug).
const DialogContent = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Content> & { sheet?: boolean }
>(({ className, children, style, sheet = false, ...props }, ref) => {
  React.useEffect(() => {
    haptic('light')
  }, [])

  return (
    <DialogPortal>
      <DialogOverlay />
      <DialogPrimitive.Content
        ref={ref}
        // Easing via INLINE animation-timing-function (reliably overrides
        // tailwindcss-animate): outExpo on open + close — the same curve as the
        // count-up/chevron — so the subtle zoom-95 scale-in settles on our system
        // curve. Merged so a consumer's style still wins.
        style={{ animationTimingFunction: "cubic-bezier(0.16,1,0.3,1)", ...style }}
        className={cn(
          sheet
            // Sheet variant — FLEX-COL so the consumer's body can be flex-1 + scroll
            // (the fix for the earlier regression: a fixed-height body broke scroll
            // under the bottom anchor). Bottom-anchored slide-up on mobile, centered
            // zoom on desktop. Inline outExpo easing above drives the motion.
            ? "fixed inset-x-0 bottom-0 z-50 flex flex-col w-full max-h-[92vh] gap-5 border-0 bg-background p-6 shadow-premium-lg rounded-t-2xl duration-300 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=open]:slide-in-from-bottom-[100%] data-[state=closed]:slide-out-to-bottom-[100%] sm:inset-x-auto sm:bottom-auto sm:left-1/2 sm:top-1/2 sm:max-h-[88vh] sm:w-[calc(100%-2rem)] sm:max-w-lg sm:-translate-x-1/2 sm:-translate-y-1/2 sm:rounded-2xl sm:duration-200 sm:data-[state=open]:slide-in-from-bottom-0 sm:data-[state=closed]:slide-out-to-bottom-0 sm:data-[state=open]:zoom-in-95 sm:data-[state=closed]:zoom-out-95"
            : "fixed left-1/2 top-1/2 z-50 grid w-[calc(100%-2rem)] max-w-lg -translate-x-1/2 -translate-y-1/2 gap-5 border-0 bg-background p-6 shadow-premium-lg duration-200 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 rounded-2xl",
          className
        )}
        {...props}
      >
        {children}
      </DialogPrimitive.Content>
    </DialogPortal>
  )
})
DialogContent.displayName = DialogPrimitive.Content.displayName

const DialogHeader = ({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) => (
  <div
    className={cn(
      "flex flex-col space-y-1.5 text-center sm:text-left",
      className
    )}
    {...props}
  />
)
DialogHeader.displayName = "DialogHeader"

const DialogFooter = ({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) => (
  <div
    className={cn(
      "flex flex-col-reverse sm:flex-row sm:justify-end sm:space-x-2",
      className
    )}
    {...props}
  />
)
DialogFooter.displayName = "DialogFooter"

const DialogTitle = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Title>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Title>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Title
    ref={ref}
    className={cn(
      "text-lg font-semibold leading-none tracking-tight",
      className
    )}
    {...props}
  />
))
DialogTitle.displayName = DialogPrimitive.Title.displayName

const DialogDescription = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Description>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Description>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Description
    ref={ref}
    className={cn("text-sm text-muted-foreground", className)}
    {...props}
  />
))
DialogDescription.displayName = DialogPrimitive.Description.displayName

export {
  Dialog,
  DialogPortal,
  DialogOverlay,
  DialogTrigger,
  DialogClose,
  DialogContent,
  DialogHeader,
  DialogFooter,
  DialogTitle,
  DialogDescription,
}
