import * as React from "react"
import * as ToastPrimitives from "@radix-ui/react-toast"
import { cva, type VariantProps } from "class-variance-authority"
import { X } from "lucide-react"

import { cn } from "@/lib/utils"

const ToastProvider = ToastPrimitives.Provider

const ToastViewport = React.forwardRef<
  React.ElementRef<typeof ToastPrimitives.Viewport>,
  React.ComponentPropsWithoutRef<typeof ToastPrimitives.Viewport>
>(({ className, ...props }, ref) => (
  <ToastPrimitives.Viewport
    ref={ref}
    className={cn(
      // 420px desktop width (was 380): the two-line card toasts read cramped —
      // titles wrapped early and the description collided with the close ✕.
      // In range with the references: Material snackbars 344-672px, Sonner
      // (Vercel/Linear) 356px+, Apple banners wider still. 92vw on phones.
      // top offset includes --app-safe-top so toasts clear the iOS status bar /
      // Dynamic Island in a standalone PWA (was a bare top-4 = 16px from the
      // viewport top, which put them UNDER the clock/notch). Safari collapses
      // --app-safe-top to 0 with the URL bar showing, so it stays ~16px there.
      "fixed top-[calc(var(--app-safe-top)+16px)] left-1/2 -translate-x-1/2 z-[100] flex max-h-screen w-[min(92vw,420px)] flex-col items-stretch gap-2",
      className
    )}
    {...props}
  />
))
ToastViewport.displayName = ToastPrimitives.Viewport.displayName

const toastVariants = cva(
  // Explicit, smooth timing on the open/close animations (2026-06-05; brand-eased
  // 2026-06-25): a 200ms entrance on --ease-out-expo (lands gently) and a 300ms
  // exit on --ease-in-quad (accelerates away). This puts toasts on the SAME motion
  // curves as every sheet/modal (DESIGN_SYSTEM §9: one motion language) — the
  // gift-landing/saved beats now move like the rest of the app, not a system default.
  "group pointer-events-auto relative flex items-center overflow-hidden transition-all data-[swipe=cancel]:translate-x-0 data-[swipe=end]:translate-x-[var(--radix-toast-swipe-end-x)] data-[swipe=move]:translate-x-[var(--radix-toast-swipe-move-x)] data-[swipe=move]:transition-none data-[state=open]:animate-in data-[state=closed]:animate-out data-[swipe=end]:animate-out data-[state=closed]:fade-out-80 data-[state=open]:duration-200 data-[state=open]:[animation-timing-function:var(--ease-out-expo)] data-[state=closed]:duration-300 data-[state=closed]:[animation-timing-function:var(--ease-in-quad)]",
  {
    variants: {
      variant: {
        // Card geometry (2026-06-05 de-cram pass): px-5/py-4 breathing room
        // (was px-4/py-3 — founder: "kinda crammed"), rounded-2xl to match the
        // kiddo card language (the gift variant + app cards already are).
        // Right padding for the close ✕ is applied by the Toaster only on
        // toasts that actually SHOW it, so closeless cards stay symmetric.
        default: "w-full justify-between space-x-3 rounded-2xl border px-5 py-4 shadow-lg bg-background text-foreground data-[state=closed]:slide-out-to-top-full data-[state=open]:slide-in-from-top-full",
        destructive:
          "w-full justify-between space-x-3 rounded-2xl border px-5 py-4 shadow-lg destructive group border-destructive bg-destructive text-destructive-foreground data-[state=closed]:slide-out-to-top-full data-[state=open]:slide-in-from-top-full",
        saved:
          "justify-center gap-1.5 px-3 py-1.5 rounded-full bg-foreground/90 text-background text-xs font-medium shadow-lg backdrop-blur-sm data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=open]:zoom-in-95",
        // The gift-arrival delight beat — the product's emotional peak ("watch
        // it land"). Deliberately NOT the neutral system card: a warm cream
        // surface, an evergreen sprout badge (added in the Toaster), and a soft
        // GOLD glow that echoes the hero count-up's gold-glow language, so a
        // landing gift feels like a moment, not a notification. 2026-06-04.
        gift:
          "w-full items-start gap-3 rounded-2xl border border-[hsl(var(--kiddo-evergreen)/0.16)] bg-[hsl(var(--kiddo-cream))] px-4 py-3.5 text-[hsl(var(--kiddo-ink))] shadow-[0_12px_36px_-8px_hsl(var(--kiddo-gold)/0.45)] data-[state=closed]:slide-out-to-top-full data-[state=open]:slide-in-from-top-full data-[state=open]:fade-in-0",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
)

const Toast = React.forwardRef<
  React.ElementRef<typeof ToastPrimitives.Root>,
  React.ComponentPropsWithoutRef<typeof ToastPrimitives.Root> &
    VariantProps<typeof toastVariants>
>(({ className, variant, ...props }, ref) => {
  return (
    <ToastPrimitives.Root
      ref={ref}
      className={cn(toastVariants({ variant }), className)}
      {...props}
    />
  )
})
Toast.displayName = ToastPrimitives.Root.displayName

const ToastAction = React.forwardRef<
  React.ElementRef<typeof ToastPrimitives.Action>,
  React.ComponentPropsWithoutRef<typeof ToastPrimitives.Action>
>(({ className, ...props }, ref) => (
  <ToastPrimitives.Action
    ref={ref}
    className={cn(
      "inline-flex h-8 shrink-0 items-center justify-center rounded-md border bg-transparent px-3 text-sm font-medium ring-offset-background transition-colors hover:bg-secondary focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 group-[.destructive]:border-muted/40 group-[.destructive]:hover:border-destructive/30 group-[.destructive]:hover:bg-destructive group-[.destructive]:hover:text-destructive-foreground group-[.destructive]:focus:ring-destructive",
      className
    )}
    {...props}
  />
))
ToastAction.displayName = ToastPrimitives.Action.displayName

const ToastClose = React.forwardRef<
  React.ElementRef<typeof ToastPrimitives.Close>,
  React.ComponentPropsWithoutRef<typeof ToastPrimitives.Close>
>(({ className, ...props }, ref) => (
  <ToastPrimitives.Close
    ref={ref}
    className={cn(
      "absolute right-3 top-3 rounded-md p-1 text-foreground/40 transition-colors hover:text-foreground focus:outline-none focus:ring-2 focus:ring-ring group-[.destructive]:text-red-300 group-[.destructive]:hover:text-red-50 group-[.destructive]:focus:ring-red-400 group-[.destructive]:focus:ring-offset-red-600",
      className
    )}
    toast-close=""
    {...props}
  >
    <X className="h-3.5 w-3.5" />
  </ToastPrimitives.Close>
))
ToastClose.displayName = ToastPrimitives.Close.displayName

const ToastTitle = React.forwardRef<
  React.ElementRef<typeof ToastPrimitives.Title>,
  React.ComponentPropsWithoutRef<typeof ToastPrimitives.Title>
>(({ className, ...props }, ref) => (
  <ToastPrimitives.Title
    ref={ref}
    className={cn("text-sm font-semibold leading-snug", className)}
    {...props}
  />
))
ToastTitle.displayName = ToastPrimitives.Title.displayName

const ToastDescription = React.forwardRef<
  React.ElementRef<typeof ToastPrimitives.Description>,
  React.ComponentPropsWithoutRef<typeof ToastPrimitives.Description>
>(({ className, ...props }, ref) => (
  <ToastPrimitives.Description
    ref={ref}
    // One step smaller + muted vs the title (was same-size text-sm at 90%
    // opacity — title and body read as one undifferentiated block, the core
    // of the "crammed" feel). The hierarchy every reference uses: iOS banner
    // subtitle, Material supporting text, Sonner's muted description. On the
    // destructive (red) card, muted-foreground would vanish — keep the light
    // foreground there via the group override.
    className={cn(
      "text-[13px] leading-relaxed text-muted-foreground group-[.destructive]:text-destructive-foreground/90",
      className
    )}
    {...props}
  />
))
ToastDescription.displayName = ToastPrimitives.Description.displayName

// Draining progress bar — a thin line at the toast's bottom edge that empties
// over the toast's own auto-dismiss duration, so "this is temporary, and about
// this long" reads at a glance (Sonner/Linear pattern). Only for the CARD toasts
// (default / destructive / gift); the 2s "saved" pill is too quick to perceive
// one, so the Toaster omits it there. Paused on hover/focus to mirror Radix's own
// timer pause (so it never drains out from under someone mid-read), and HIDDEN
// under reduced-motion (the toast still auto-dismisses on Radix's timer; we just
// don't animate). Clipped to the rounded corners by the Root's overflow-hidden.
const TOAST_PROGRESS_KEYFRAME =
  "@keyframes kiddo-toast-progress{from{transform:scaleX(1)}to{transform:scaleX(0)}}"

function ToastProgress({
  durationMs,
  variant = "default",
}: {
  durationMs: number
  variant?: "default" | "destructive" | "gift"
}) {
  const color =
    variant === "destructive"
      ? "rgba(255,255,255,0.5)" // light on the red card
      : variant === "gift"
        ? "hsl(var(--kiddo-gold) / 0.55)" // echoes the gift card's gold glow
        : "hsl(var(--kiddo-evergreen) / 0.35)" // calm on the white card
  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: TOAST_PROGRESS_KEYFRAME }} />
      <span
        aria-hidden="true"
        data-testid="toast-progress"
        className="pointer-events-none absolute inset-x-0 bottom-0 h-[3px] origin-left group-hover:[animation-play-state:paused] group-focus-within:[animation-play-state:paused] motion-reduce:hidden"
        style={{
          background: color,
          animation: `kiddo-toast-progress ${durationMs}ms linear forwards`,
        }}
      />
    </>
  )
}

type ToastProps = React.ComponentPropsWithoutRef<typeof Toast>

type ToastActionElement = React.ReactElement<typeof ToastAction>

export {
  type ToastProps,
  type ToastActionElement,
  ToastProvider,
  ToastViewport,
  Toast,
  ToastTitle,
  ToastDescription,
  ToastClose,
  ToastAction,
  ToastProgress,
}
