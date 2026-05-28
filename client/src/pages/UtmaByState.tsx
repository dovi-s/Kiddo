import { useEffect } from "react";
import { motion } from "framer-motion";
import { Link, useRoute, useLocation } from "wouter";
import { ArrowRight, ShieldCheck } from "lucide-react";
import { Nav } from "@/components/layout/Nav";
import { Footer } from "@/components/layout/Footer";
import { Button } from "@/components/ui/button";
import { Mascot } from "@/components/ui/mascot";
import { US_STATES, getMajorityAgeForState } from "@shared/utma";

export default function UtmaByState() {
  const [, params] = useRoute("/tools/utma-by-state/:stateCode");
  const [, setLocation] = useLocation();

  const stateCodeRaw = params?.stateCode || "";
  const stateCode = stateCodeRaw.toUpperCase();
  const state = US_STATES.find((s) => s.code === stateCode);

  // Redirect to index if the URL has an unknown state code rather than 404'ing
  // — most malformed links are typos, and the index gives the visitor the
  // canonical list to pick from.
  useEffect(() => {
    if (stateCodeRaw && !state) {
      setLocation("/tools/utma-by-state");
    }
  }, [stateCodeRaw, state, setLocation]);

  // Update document.title per state for SEO. App.tsx's metaForPath returns a
  // generic title for the dynamic route; we set the state-specific one here so
  // each state's page is independently indexable.
  useEffect(() => {
    if (state) {
      const age = getMajorityAgeForState(state.code);
      document.title = `${state.name} UTMA age of majority: ${age} | Kiddo`;
    }
  }, [state]);

  if (!state) {
    return null;
  }

  const age = getMajorityAgeForState(state.code);
  const isExtended = age > 18;

  return (
    <div className="kiddo-app-page">
      <Nav />

      <section className="relative pb-12 pt-20 md:pb-16 md:pt-28">
        <div className="mx-auto max-w-3xl px-4 text-center">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
          >
            <Mascot size="md" variant="planting" className="mx-auto mb-5 drop-shadow-sm" context={`utma-${state.code.toLowerCase()}`} />
            <p className="mb-3 text-xs font-bold uppercase tracking-[0.18em] text-[hsl(var(--kiddo-evergreen))]">
              {state.name}
            </p>
            <h1 className="mb-4 font-heading text-4xl font-bold tracking-normal text-foreground md:text-5xl">
              In {state.name}, a UTMA fund transfers to the child at age {age}.
            </h1>
            <p className="mx-auto max-w-xl text-lg leading-relaxed text-muted-foreground">
              {isExtended ? (
                <>
                  That's {age - 18} {age - 18 === 1 ? "year" : "years"} longer than the federal default of 18, which means more time for the fund to compound before the child takes legal control.
                </>
              ) : (
                <>That's the federal default. The custodian (usually a parent) manages the account until the child turns 18; on that birthday, control transfers and the kid decides what to do.</>
              )}
            </p>
          </motion.div>
        </div>
      </section>

      <section className="pb-12 md:pb-20">
        <div className="mx-auto max-w-3xl px-4">
          <div className="rounded-3xl border border-border bg-card p-6 shadow-premium-sm md:p-10">
            <h2 className="mb-4 font-heading text-2xl font-bold text-foreground md:text-3xl">
              What this means for your child's fund.
            </h2>
            <div className="space-y-4 text-base leading-relaxed text-muted-foreground">
              <p>
                A UTMA (Uniform Transfers to Minors Act) account is a custodial investment account a parent or guardian opens for a child. The child legally owns the assets the moment they're added to the fund; the custodian manages them until the kid reaches the state's age of majority. In {state.name}, that age is {age}.
              </p>
              <p>
                On the child's {age}th birthday, a few things change. The custodian stops acting on the account. The child gains full legal control. The investments themselves stay where they are. They're not automatically sold just because that birthday arrives. What changes is who decides what happens next.
              </p>
              <p>
                Some states allow the custodian to elect a higher age (often 21 or 25) at account opening, which can extend the time horizon. Talk to a financial advisor or estate attorney about your state's specific UTMA statute if you want a longer custodianship than the default.
              </p>
            </div>
          </div>
        </div>
      </section>

      <section className="py-12 md:py-16">
        <div className="mx-auto max-w-3xl px-4">
          <div className="rounded-2xl border border-[hsl(var(--kiddo-evergreen)/0.20)] bg-[hsl(var(--kiddo-evergreen)/0.04)] p-6 md:p-8">
            <div className="flex items-start gap-4">
              <div className="flex-shrink-0 rounded-xl bg-[hsl(var(--kiddo-evergreen)/0.10)] p-3">
                <ShieldCheck className="h-6 w-6 text-[hsl(var(--kiddo-evergreen))]" />
              </div>
              <div>
                <p className="font-heading text-lg font-bold text-foreground">Real brokerage. Real protection.</p>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                  When investing is live, Kiddo funds are held by our broker-dealer partner (Member FINRA/SIPC). Eligible accounts are then SIPC-protected up to $500,000 against broker-dealer failure, not market loss. Investments may lose value. Not FDIC insured.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="py-16 md:py-24">
        <div className="mx-auto max-w-3xl px-4 text-center">
          <h2 className="mb-4 font-heading text-3xl font-bold text-foreground md:text-4xl">
            See what investing for your child could grow into.
          </h2>
          <p className="mx-auto mb-8 max-w-xl text-muted-foreground">
            The at-18 calculator runs the math for any monthly amount and time horizon. Kiddo's annual fee ($1/yr per $1,000 invested) is already netted out of the projection.
          </p>
          <div className="flex flex-col justify-center gap-3 sm:flex-row">
            <Link href="/tools/at-18-calculator">
              <Button size="lg" className="h-14 px-10 text-base" data-testid="button-utma-state-calculator">
                Try the calculator
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </Link>
            <Link href="/get-started">
              <Button
                size="lg"
                variant="outline"
                className="h-14 px-10 text-base"
                data-testid="button-utma-state-start"
              >
                Start a child's fund
              </Button>
            </Link>
          </div>
          <p className="mt-6 text-sm">
            <Link href="/tools/utma-by-state" className="text-primary hover:underline">
              View all 50 states + DC →
            </Link>
          </p>
        </div>
      </section>

      <Footer />
    </div>
  );
}
