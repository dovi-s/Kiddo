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

  const savedToasts = toasts.filter(t => t.variant === "saved")
  const regularToasts = toasts.filter(t => t.variant !== "saved")

  return (
    <ToastProvider>
      {regularToasts.map(function ({ id, title, description, action, ...props }) {
        return (
          <Toast key={id} duration={props.variant === "destructive" ? 6000 : 4500} {...props}>
            <div className="grid gap-0.5">
              {title && <ToastTitle>{title}</ToastTitle>}
              {description && (
                <ToastDescription>{description}</ToastDescription>
              )}
            </div>
            {action}
            <ToastClose />
          </Toast>
        )
      })}
      {savedToasts.map(function ({ id, title, ...props }) {
        return (
          <Toast key={id} {...props} duration={1200}>
            <Check size={12} strokeWidth={3} />
            <span>{title || "Saved"}</span>
          </Toast>
        )
      })}
      <ToastViewport />
    </ToastProvider>
  )
}
