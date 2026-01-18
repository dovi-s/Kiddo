import * as React from "react"
import { Slot } from "@radix-ui/react-slot"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "@/lib/utils"
import { haptic } from "@/lib/haptics"

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-xl text-sm font-semibold tracking-wide transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0 touch-target select-none active:scale-[0.97] duration-[var(--duration-fast)]",
  {
    variants: {
      variant: {
        default:
          "bg-primary text-primary-foreground shadow-premium hover:bg-[hsl(var(--kora-evergreen-hover))] active:bg-[hsl(var(--kora-evergreen-active))]",
        destructive:
          "bg-destructive text-destructive-foreground shadow-premium hover:bg-destructive/90 active:bg-destructive/80",
        outline:
          "border-2 border-border bg-transparent hover:bg-muted/50 active:bg-muted shadow-premium-sm",
        secondary:
          "bg-secondary text-secondary-foreground shadow-premium-sm hover:bg-secondary/80 active:bg-secondary/60",
        ghost: 
          "hover:bg-muted/50 active:bg-muted",
        link: 
          "text-primary underline-offset-4 hover:underline",
        premium:
          "btn-premium text-white shadow-premium-lg hover:shadow-premium active:shadow-premium-sm",
      },
      size: {
        default: "h-11 px-5 py-2.5",
        sm: "h-9 rounded-lg px-3.5 text-xs",
        lg: "h-14 rounded-2xl px-8 text-base",
        icon: "h-11 w-11 rounded-xl",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean
  hapticFeedback?: 'light' | 'medium' | 'heavy' | 'selection' | 'none'
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, hapticFeedback = 'light', onClick, ...props }, ref) => {
    const Comp = asChild ? Slot : "button"
    
    const handleClick = (e: React.MouseEvent<HTMLButtonElement>) => {
      if (hapticFeedback !== 'none') {
        haptic(hapticFeedback)
      }
      onClick?.(e)
    }
    
    return (
      <Comp
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        onClick={handleClick}
        {...props}
      />
    )
  }
)
Button.displayName = "Button"

export { Button, buttonVariants }
