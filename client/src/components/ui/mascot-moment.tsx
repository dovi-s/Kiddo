import { Button } from "@/components/ui/button";
import { Mascot } from "@/components/ui/mascot";

type MascotMood = "empty" | "celebrate" | "guide";

interface MascotAction {
  label: string;
  onClick: () => void;
  testId?: string;
  variant?: "default" | "outline";
}

interface MascotMomentProps {
  mood?: MascotMood;
  title: string;
  description: string;
  context?: string;
  primaryAction?: MascotAction;
  secondaryAction?: MascotAction;
  className?: string;
}

const moodClasses: Record<MascotMood, string> = {
  empty: "bg-card border-border/50",
  celebrate: "bg-gradient-to-b from-[hsl(var(--kora-gold)/0.12)] to-card border-[hsl(var(--kora-gold)/0.25)]",
  guide: "bg-gradient-to-b from-[hsl(var(--kora-blue)/0.08)] to-card border-[hsl(var(--kora-blue)/0.25)]",
};

const moodSize: Record<MascotMood, "sm" | "md" | "lg" | "xl"> = {
  empty: "sm",
  celebrate: "md",
  guide: "md",
};

export function MascotMoment({
  mood = "empty",
  title,
  description,
  context,
  primaryAction,
  secondaryAction,
  className = "",
}: MascotMomentProps) {
  return (
    <div className={`rounded-2xl border p-6 text-center ${moodClasses[mood]} ${className}`} data-testid={context ? `mascot-moment-${context}` : "mascot-moment"}>
      <Mascot size={moodSize[mood]} className="mx-auto mb-3 drop-shadow-sm" context={context ? `${context}-hero` : "moment"} />
      <h3 className="font-heading text-lg font-semibold text-foreground">{title}</h3>
      <p className="text-sm text-muted-foreground mt-1 max-w-md mx-auto">{description}</p>
      {(primaryAction || secondaryAction) && (
        <div className="mt-5 flex flex-col sm:flex-row gap-2 justify-center">
          {primaryAction && (
            <Button
              onClick={primaryAction.onClick}
              variant={primaryAction.variant || "default"}
              data-testid={primaryAction.testId}
            >
              {primaryAction.label}
            </Button>
          )}
          {secondaryAction && (
            <Button
              onClick={secondaryAction.onClick}
              variant={secondaryAction.variant || "outline"}
              data-testid={secondaryAction.testId}
            >
              {secondaryAction.label}
            </Button>
          )}
        </div>
      )}
    </div>
  );
}

