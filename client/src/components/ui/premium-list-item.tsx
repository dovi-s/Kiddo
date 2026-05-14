import * as React from "react"
import { motion } from "framer-motion"
import { ChevronDown } from "lucide-react"
import { cn } from "@/lib/utils"
import { haptic } from "@/lib/haptics"

interface PremiumListItemProps {
  children: React.ReactNode
  className?: string
  onClick?: () => void
  isExpanded?: boolean
  showChevron?: boolean
  variant?: 'default' | 'elevated' | 'ghost'
  "data-testid"?: string
}

export function PremiumListItem({
  children,
  className,
  onClick,
  isExpanded = false,
  showChevron = true,
  variant = 'default',
  "data-testid": testId
}: PremiumListItemProps) {
  const variants = {
    default: "bg-card border border-border/50 shadow-premium-sm hover:shadow-premium hover:border-border",
    elevated: "bg-card shadow-premium hover:shadow-premium-lg",
    ghost: "bg-transparent hover:bg-muted/50"
  }
  
  const handleClick = () => {
    haptic('selection')
    onClick?.()
  }
  
  return (
    <motion.div
      layout
      className={cn(
        "rounded-2xl overflow-hidden cursor-pointer touch-target transition-all duration-150",
        isExpanded && "border-primary/20 shadow-premium-lg",
        variants[variant],
        className
      )}
      onClick={handleClick}
      whileTap={{ scale: 0.98 }}
      data-testid={testId}
    >
      <div className="p-5 flex items-center justify-between">
        {children}
        {showChevron && (
          <motion.div
            animate={{ rotate: isExpanded ? 180 : 0 }}
            transition={{ duration: 0.2, ease: [0.25, 0.1, 0.25, 1] }}
            className="ml-3"
          >
            <ChevronDown size={18} className="text-muted-foreground" />
          </motion.div>
        )}
      </div>
    </motion.div>
  )
}

interface PremiumListItemAvatarProps {
  children?: React.ReactNode
  className?: string
  variant?: 'primary' | 'gold' | 'success' | 'muted'
}

export function PremiumListItemAvatar({
  children,
  className,
  variant = 'primary'
}: PremiumListItemAvatarProps) {
  const variants = {
    primary: "bg-primary/10 text-primary",
    gold: "bg-[hsl(var(--kora-gold)/0.15)] text-[hsl(var(--kora-gold-ink))]",
    success: "bg-success/15 text-success",
    muted: "bg-muted text-muted-foreground"
  }
  
  return (
    <div className={cn(
      "w-12 h-12 rounded-xl flex items-center justify-center text-base font-semibold shrink-0",
      variants[variant],
      className
    )}>
      {children}
    </div>
  )
}

export function PremiumListItemContent({
  children,
  className
}: {
  children: React.ReactNode
  className?: string
}) {
  return (
    <div className={cn("flex-1 min-w-0", className)}>
      {children}
    </div>
  )
}

export function PremiumListItemTitle({
  children,
  className
}: {
  children: React.ReactNode
  className?: string
}) {
  return (
    <p className={cn("text-base font-semibold text-foreground truncate", className)}>
      {children}
    </p>
  )
}

export function PremiumListItemSubtitle({
  children,
  className
}: {
  children: React.ReactNode
  className?: string
}) {
  return (
    <p className={cn("text-sm text-muted-foreground mt-0.5 truncate", className)}>
      {children}
    </p>
  )
}

export function PremiumListItemValue({
  children,
  className
}: {
  children: React.ReactNode
  className?: string
}) {
  return (
    <div className={cn("text-right shrink-0", className)}>
      {children}
    </div>
  )
}

export function PremiumBadge({
  children,
  variant = 'default',
  className
}: {
  children: React.ReactNode
  variant?: 'default' | 'success' | 'warning' | 'gold'
  className?: string
}) {
  const variants = {
    default: "bg-muted text-muted-foreground",
    success: "bg-success/15 text-success",
    warning: "bg-destructive/15 text-destructive",
    gold: "bg-[hsl(var(--kora-gold)/0.15)] text-[hsl(var(--kora-gold-ink))]"
  }

  return (
    <span className={cn(
      "text-xs font-medium px-2.5 py-1 rounded-full inline-block",
      variants[variant],
      className
    )}>
      {children}
    </span>
  )
}
