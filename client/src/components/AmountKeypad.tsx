import { Delete } from "lucide-react";
import { haptic } from "@/lib/haptics";

// In-app numeric keypad for the money-entry flows (one-time / recurring / gifter).
// Replaces the OS keyboard so the projection + Continue never get covered, matching
// the Cash App / Venmo "the amount is the screen" feel while KEEPING our presets as
// the fast path. The amount is a plain string of what was typed ("1080", "25.50");
// callers format it for the big "register" display via formatAmountDisplay.
//
// Founder call 2026-07 (staging): trialed on /staging before promotion. One shared
// component so every amount surface behaves identically.

const KEYS = ["1", "2", "3", "4", "5", "6", "7", "8", "9", ".", "0", "back"] as const;

/** Group the integer part with commas, preserve a typed decimal (incl. a trailing dot). */
export function formatAmountDisplay(raw: string): string {
  if (!raw) return "";
  const [intPart, dec] = raw.split(".");
  const cleanInt = intPart.replace(/^0+(?=\d)/, "") || "0";
  const grouped = Number(cleanInt).toLocaleString("en-US");
  return raw.includes(".") ? `${grouped}.${dec ?? ""}` : grouped;
}

export function AmountKeypad({
  value,
  onChange,
  maxDigits = 6,
  className,
  ariaLabel = "Amount keypad",
}: {
  value: string;
  onChange: (next: string) => void;
  maxDigits?: number;
  className?: string;
  ariaLabel?: string;
}) {
  const press = (k: string) => {
    haptic("selection");
    let raw = value || "";
    if (k === "back") {
      raw = raw.slice(0, -1);
    } else if (k === ".") {
      if (raw.includes(".")) return; // one decimal point only
      raw = (raw === "" ? "0" : raw) + ".";
    } else {
      const [intPart, dec] = raw.split(".");
      if (dec !== undefined && dec.length >= 2) return; // cents cap
      if (dec === undefined && intPart.replace(/\D/g, "").length >= maxDigits) return; // sane ceiling
      raw = raw === "0" ? k : raw + k; // no leading zero
    }
    onChange(raw);
  };

  return (
    <div className={`grid grid-cols-3 gap-1.5 ${className ?? ""}`} role="group" aria-label={ariaLabel}>
      {KEYS.map((k) => (
        <button
          key={k}
          type="button"
          onClick={() => press(k)}
          aria-label={k === "back" ? "Delete last digit" : k === "." ? "Decimal point" : k}
          data-testid={`keypad-key-${k}`}
          className="kiddo-press flex items-center justify-center rounded-xl border border-[hsl(var(--kiddo-border))] bg-background py-2 text-xl font-semibold text-foreground tabular-nums transition-colors hover:bg-muted/40 active:bg-muted/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(var(--kiddo-evergreen)/0.35)]"
        >
          {k === "back"
            ? <Delete size={22} className="text-muted-foreground" aria-hidden="true" />
            : k === "."
              ? <span className="text-muted-foreground">.</span>
              : k}
        </button>
      ))}
    </div>
  );
}
