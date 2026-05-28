import * as React from "react";
import { Check, Shield, ExternalLink, HelpCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";

export function TrustFooter() {
  return (
    <footer
      className="border-t border-border bg-muted/30 py-6 px-4"
      data-testid="trust-footer"
    >
      <div className="max-w-4xl mx-auto">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 text-xs text-muted-foreground">
          <div className="flex flex-col gap-2">
            <div className="flex items-center gap-2">
              <Shield className="h-4 w-4 text-[hsl(var(--kora-evergreen))]" />
              <span>When live, securities carry SIPC protection up to $500,000 (broker failure, not market loss)</span>
            </div>
            <div className="flex items-center gap-2">
              <Check className="h-4 w-4 text-[hsl(var(--kora-evergreen))]" />
              <span>Securities held at a regulated broker-dealer partner, not by Kiddo</span>
            </div>
          </div>
          <div className="flex items-center">
            <a
              href="/settings?tab=security"
              className="inline-flex items-center gap-1 text-primary hover:underline"
              data-testid="link-security-learn-more"
            >
              Learn more about security
              <ExternalLink className="h-3 w-3" />
            </a>
          </div>
        </div>
      </div>
    </footer>
  );
}

interface WhoControlsDrawerProps {
  variant?: "default" | "light";
}

export function WhoControlsDrawer({ variant = "default" }: WhoControlsDrawerProps) {
  return (
    <Sheet>
      <SheetTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          className={variant === "light" 
            ? "text-white/70 hover:text-white hover:bg-white/10 gap-1.5 h-auto py-1 px-2 text-xs"
            : "text-muted-foreground hover:text-foreground gap-1.5"
          }
          data-testid="button-who-controls"
        >
          <HelpCircle className="h-3 w-3" />
          Who controls this fund?
        </Button>
      </SheetTrigger>
      <SheetContent side="right" className="w-full sm:max-w-md">
        <SheetHeader>
          <SheetTitle className="text-lg font-semibold">
            Who controls this fund?
          </SheetTitle>
          <SheetDescription className="text-muted-foreground">
            Understanding your role as custodian
          </SheetDescription>
        </SheetHeader>
        <div className="mt-6 space-y-6">
          <div className="space-y-4">
            <div className="flex items-start gap-3">
              <div className="mt-0.5">
                <Check className="h-5 w-5 text-[hsl(var(--kora-evergreen))]" />
              </div>
              <div>
                <p className="font-medium text-foreground">
                  As the custodian, you have full control over this account
                </p>
                <p className="text-sm text-muted-foreground mt-1">
                  You manage all investment decisions and account settings until your child comes of age.
                </p>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <div className="mt-0.5">
                <Check className="h-5 w-5 text-[hsl(var(--kora-evergreen))]" />
              </div>
              <div>
                <p className="font-medium text-foreground">
                  All investments are made in your child's name
                </p>
                <p className="text-sm text-muted-foreground mt-1">
                  The assets belong to your child, but you manage them on their behalf.
                </p>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <div className="mt-0.5">
                <Check className="h-5 w-5 text-[hsl(var(--kora-evergreen))]" />
              </div>
              <div>
                <p className="font-medium text-foreground">
                  The account transfers to them at age 18-21
                </p>
                <p className="text-sm text-muted-foreground mt-1">
                  The exact age varies by state. At that point, your child gains full control.
                </p>
              </div>
            </div>
          </div>

          <div className="border-t border-border pt-4">
            <p className="text-sm font-medium text-foreground mb-3">
              What you can do as custodian:
            </p>
            <ul className="space-y-2 text-sm text-muted-foreground">
              <li className="flex items-center gap-2">
                <Check className="h-4 w-4 text-[hsl(var(--kora-evergreen))]" />
                Withdraw funds for your child's benefit
              </li>
              <li className="flex items-center gap-2">
                <Check className="h-4 w-4 text-[hsl(var(--kora-evergreen))]" />
                Make investment decisions
              </li>
              <li className="flex items-center gap-2">
                <Check className="h-4 w-4 text-[hsl(var(--kora-evergreen))]" />
                Add or change beneficiaries
              </li>
              <li className="flex items-center gap-2">
                <Check className="h-4 w-4 text-[hsl(var(--kora-evergreen))]" />
                Close the account if needed
              </li>
            </ul>
          </div>

          <div className="bg-muted/50 rounded-lg p-4 text-sm text-muted-foreground">
            <p>
              <span className="font-medium text-foreground">Note:</span> UTMA/UGMA accounts are irrevocable gifts. Once contributed, funds legally belong to the child.
            </p>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
