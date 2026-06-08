import { X } from "lucide-react";
import { haptic } from "@/lib/haptics";

/**
 * Canonical modal / sheet close button.
 *
 * One close, everywhere: a 44px tap target (the app's touch-target standard,
 * same as the mobile nav) with a 28px visible muted chip centered inside it, so
 * the dot looks restrained but the finger-target meets the bar. Always labeled
 * for screen readers (the bare `<X>` buttons it replaces had targets of 16–36px
 * and some had no accessible name at all). Fires a light haptic on tap to match
 * the rest of the app's controls.
 *
 * Use this for EVERY modal/sheet close so the affordance is identical and
 * accessible across the product, and can't drift back to a tiny bespoke X.
 * Pass `className` to position it (e.g. `absolute right-2 top-2` for overlay
 * cards) — it's applied to the 44px hit area.
 */
export function ModalCloseButton({
  onClick,
  label = "Close",
  className = "",
  testId,
}: {
  onClick: () => void;
  label?: string;
  className?: string;
  testId?: string;
}) {
  return (
    <button
      type="button"
      onClick={() => { haptic("selection"); onClick(); }}
      aria-label={label}
      data-testid={testId}
      className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-muted-foreground transition-colors hover:text-foreground ${className}`}
    >
      <span className="flex h-7 w-7 items-center justify-center rounded-full bg-muted">
        <X size={15} />
      </span>
    </button>
  );
}
