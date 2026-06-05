import { useToast } from "@/hooks/use-toast"
import { Check } from "lucide-react"
import {
  Toast,
  ToastClose,
  ToastDescription,
  ToastProvider,
  ToastTitle,
  ToastViewport,
} from "@/components/ui/toast"

export function Toaster() {
  const { toasts } = useToast()

  // Best-in-class confirmation pattern (Linear / Vercel / Apple's checkmark
  // HUD): a SIMPLE confirmation is a quiet minimal PILL that auto-dismisses —
  // no heavy card, no close ✕. The full card is reserved for toasts that earn
  // it: an error, a two-line description, or an action button. We route by
  // SHAPE so this upgrades ~80% of confirmations ("Saved", "Photo updated",
  // "Link copied") to the premium-minimal treatment without editing 100+ call
  // sites. (2026-06-04 toast pass.) A title-only confirmation longer than ~30
  // chars stays a card — long copy reads awkwardly in a pill.
  const isMinimal = (t: typeof toasts[number]) =>
    t.variant !== "destructive" &&
    !t.description &&
    !t.action &&
    String(t.title ?? "").length <= 30

  const minimalToasts = toasts.filter(isMinimal)
  const cardToasts = toasts.filter((t) => !isMinimal(t))

  return (
    <ToastProvider>
      {cardToasts.map(function ({ id, title, description, action, ...props }) {
        // Drop the close ✕ on a plain auto-dismissing confirmation (no
        // description, no action) — it's clutter; the toast leaves on its own.
        // Keep it where dismissal is useful: errors and actionable toasts.
        const showClose = props.variant === "destructive" || Boolean(description) || Boolean(action)
        return (
          <Toast key={id} duration={props.variant === "destructive" ? 6000 : 4500} {...props}>
            <div className="grid gap-0.5">
              {title && <ToastTitle>{title}</ToastTitle>}
              {description && (
                <ToastDescription>{description}</ToastDescription>
              )}
            </div>
            {action}
            {showClose && <ToastClose />}
          </Toast>
        )
      })}
      {minimalToasts.map(function ({ id, title, ...props }) {
        return (
          <Toast key={id} {...props} variant="saved" duration={2000}>
            <Check size={12} strokeWidth={3} />
            <span>{title || "Saved"}</span>
          </Toast>
        )
      })}
      <ToastViewport />
    </ToastProvider>
  )
}
