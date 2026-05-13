import { useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

type PersonalFundWaitlistModalProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  sourceSurface: string;
};

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function PersonalFundWaitlistModal({
  open,
  onOpenChange,
  sourceSurface,
}: PersonalFundWaitlistModalProps) {
  const [email, setEmail] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [submitted, setSubmitted] = useState(false);

  const reset = () => {
    setEmail("");
    setIsSubmitting(false);
    setError("");
    setSubmitted(false);
  };

  const handleOpenChange = (nextOpen: boolean) => {
    if (!nextOpen) reset();
    onOpenChange(nextOpen);
  };

  const handleSubmit = async () => {
    const normalizedEmail = email.trim().toLowerCase();
    if (!EMAIL_RE.test(normalizedEmail)) {
      setError("Enter a valid email address.");
      return;
    }

    setIsSubmitting(true);
    setError("");

    try {
      const response = await fetch("/api/waitlist/personal-funds", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: normalizedEmail,
          sourceSurface,
        }),
      });

      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        setError(data?.error || "Could not join the waitlist. Please try again.");
        setIsSubmitting(false);
        return;
      }

      setSubmitted(true);
      setIsSubmitting(false);
    } catch {
      setError("Could not join the waitlist. Please try again.");
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-md w-[95vw] rounded-2xl p-0 overflow-hidden" aria-describedby={undefined}>
        <div className="p-6 md:p-7">
          {submitted ? (
            <div className="space-y-4 text-center">
              <DialogTitle className="font-heading text-2xl text-foreground">You&apos;re on the list.</DialogTitle>
              <p className="text-sm leading-relaxed text-muted-foreground">
                We&apos;ll send one email when personal funds launch.
              </p>
              <Button className="w-full h-12 rounded-2xl" onClick={() => handleOpenChange(false)}>
                Done
              </Button>
            </div>
          ) : (
            <>
              <DialogHeader className="space-y-3 text-left">
                <DialogTitle className="font-heading text-2xl text-foreground">
                  Personal funds are coming.
                </DialogTitle>
                <DialogDescription className="text-sm leading-relaxed text-muted-foreground">
                  Be the first to know when you can create your own investment fund and receive gifts that grow.
                </DialogDescription>
              </DialogHeader>

              <div className="mt-6 space-y-4">
                <div className="space-y-2">
                  <label htmlFor="personal-fund-waitlist-email" className="text-sm font-medium text-foreground">
                    Your email
                  </label>
                  <input
                    id="personal-fund-waitlist-email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="you@example.com"
                    className="w-full h-12 rounded-2xl border border-border bg-card px-4 text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/40 transition-all"
                    data-testid="input-personal-waitlist-email"
                  />
                </div>

                {error ? (
                  <p className="text-sm text-destructive" data-testid="text-personal-waitlist-error">
                    {error}
                  </p>
                ) : null}

                <Button
                  className="w-full h-12 rounded-2xl"
                  onClick={handleSubmit}
                  disabled={isSubmitting}
                  data-testid="button-personal-waitlist-submit"
                >
                  {isSubmitting ? "Saving..." : "Notify me"}
                </Button>

                <p className="text-center text-xs text-muted-foreground">
                  No spam. One email when it launches.
                </p>
              </div>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
