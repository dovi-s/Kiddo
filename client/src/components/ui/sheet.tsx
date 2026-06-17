"use client"

import * as React from "react"
import * as SheetPrimitive from "@radix-ui/react-dialog"
import { cva, type VariantProps } from "class-variance-authority"
import { X } from "lucide-react"
import { cn } from "@/lib/utils"
import { haptic } from "@/lib/haptics"
import { useSheetDragDismiss } from "@/lib/use-sheet-drag-dismiss"

const Sheet = SheetPrimitive.Root

const SheetTrigger = SheetPrimitive.Trigger

const SheetClose = SheetPrimitive.Close

const SheetPortal = SheetPrimitive.Portal

const SheetOverlay = React.forwardRef<
  React.ElementRef<typeof SheetPrimitive.Overlay>,
  React.ComponentPropsWithoutRef<typeof SheetPrimitive.Overlay>
>(({ className, ...props }, ref) => (
  <SheetPrimitive.Overlay
    className={cn(
      "fixed inset-0 z-50 bg-black/60 backdrop-blur-sm data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 duration-200",
      className
    )}
    {...props}
    ref={ref}
  />
))
SheetOverlay.displayName = SheetPrimitive.Overlay.displayName

const sheetVariants = cva(
  "fixed z-50 gap-4 bg-background shadow-premium-lg transition-all data-[state=closed]:duration-200 data-[state=open]:duration-200 data-[state=open]:animate-in data-[state=closed]:animate-out",
  {
    variants: {
      side: {
        top: "inset-x-0 top-0 border-b rounded-b-3xl p-6 data-[state=closed]:slide-out-to-top data-[state=open]:slide-in-from-top",
        bottom:
          // max-h uses dvh (dynamic viewport) so the sheet doesn't extend
          // below the visible area on mobile Safari when the URL bar is
          // showing. Falls back to vh on browsers that don't support dvh.
          "inset-x-0 bottom-0 rounded-t-[28px] pt-3 px-6 pb-8 max-h-[92vh] max-h-[92dvh] data-[state=closed]:slide-out-to-bottom data-[state=open]:slide-in-from-bottom overflow-hidden",
        left: "inset-y-0 left-0 h-full w-3/4 border-r p-6 data-[state=closed]:slide-out-to-left data-[state=open]:slide-in-from-left sm:max-w-sm",
        right:
          "inset-y-0 right-0 h-full w-3/4 border-l p-6 data-[state=closed]:slide-out-to-right data-[state=open]:slide-in-from-right sm:max-w-sm",
      },
    },
    defaultVariants: {
      side: "right",
    },
  }
)

interface SheetContentProps
  extends React.ComponentPropsWithoutRef<typeof SheetPrimitive.Content>,
    VariantProps<typeof sheetVariants> {}

const SheetContent = React.forwardRef<
  React.ElementRef<typeof SheetPrimitive.Content>,
  SheetContentProps
>(({ side = "right", className, children, ...props }, ref) => {
  React.useEffect(() => {
    haptic('light')
  }, [])

  // Swipe-down-to-dismiss on the bottom sheet (founder ask 2026-06-14). The
  // existing handle row becomes the drag grab zone via the shared hook; it
  // never fights body scroll and triggers the real Radix close past a threshold.
  const { setContentRef, closeRef, handleProps } = useSheetDragDismiss<HTMLDivElement>(ref)
  const bottomRef = side === "bottom" ? setContentRef : ref

  return (
    <SheetPortal>
      <SheetOverlay />
      <SheetPrimitive.Content
        ref={bottomRef}
        className={cn(sheetVariants({ side }), className)}
        {...props}
      >
        {side === "bottom" ? (
          <>
            {/* Handle row = the drag grab zone (touch-none so it never scrolls
                the body); swipe it down past the threshold to dismiss. */}
            <div {...handleProps} className="flex justify-center mb-5 -mt-1 py-1.5 touch-none cursor-grab active:cursor-grabbing" data-testid="sheet-drag-handle">
              <div className="w-10 h-1 rounded-full bg-muted-foreground/25 transition-colors hover:bg-muted-foreground/40" />
            </div>
            <SheetPrimitive.Close ref={closeRef} aria-hidden="true" tabIndex={-1} className="sr-only">close</SheetPrimitive.Close>
            {children}
          </>
        ) : (
          <>
            <SheetPrimitive.Close 
              className="absolute right-4 top-4 rounded-xl p-2.5 bg-muted/50 opacity-80 ring-offset-background transition-all duration-150 hover:opacity-100 hover:bg-muted focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:pointer-events-none active:scale-95"
              onClick={() => haptic('light')}
            >
              <X className="h-5 w-5" />
              <span className="sr-only">Close</span>
            </SheetPrimitive.Close>
            {children}
          </>
        )}
      </SheetPrimitive.Content>
    </SheetPortal>
  )
})
SheetContent.displayName = SheetPrimitive.Content.displayName

const SheetHeader = ({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) => (
  <div
    className={cn(
      "flex flex-col space-y-2 text-center sm:text-left",
      className
    )}
    {...props}
  />
)
SheetHeader.displayName = "SheetHeader"

const SheetFooter = ({
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
SheetFooter.displayName = "SheetFooter"

const SheetTitle = React.forwardRef<
  React.ElementRef<typeof SheetPrimitive.Title>,
  React.ComponentPropsWithoutRef<typeof SheetPrimitive.Title>
>(({ className, ...props }, ref) => (
  <SheetPrimitive.Title
    ref={ref}
    className={cn("text-lg font-semibold text-foreground", className)}
    {...props}
  />
))
SheetTitle.displayName = SheetPrimitive.Title.displayName

const SheetDescription = React.forwardRef<
  React.ElementRef<typeof SheetPrimitive.Description>,
  React.ComponentPropsWithoutRef<typeof SheetPrimitive.Description>
>(({ className, ...props }, ref) => (
  <SheetPrimitive.Description
    ref={ref}
    className={cn("text-sm text-muted-foreground", className)}
    {...props}
  />
))
SheetDescription.displayName = SheetPrimitive.Description.displayName

export {
  Sheet,
  SheetPortal,
  SheetOverlay,
  SheetTrigger,
  SheetClose,
  SheetContent,
  SheetHeader,
  SheetFooter,
  SheetTitle,
  SheetDescription,
}
