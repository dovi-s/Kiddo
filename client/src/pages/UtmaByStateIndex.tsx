import { motion } from "framer-motion";
import { Link } from "wouter";
import { ArrowRight } from "lucide-react";
import { Nav } from "@/components/layout/Nav";
import { Footer } from "@/components/layout/Footer";
import { Button } from "@/components/ui/button";
import { Mascot } from "@/components/ui/mascot";
import { US_STATES, getMajorityAgeForState } from "@shared/utma";

export default function UtmaByStateIndex() {
  const stateRows = US_STATES.map((s) => ({
    ...s,
    age: getMajorityAgeForState(s.code),
  }));

  return (
    <div className="kiddo-app-page">
      <Nav />

      <section className="relative pb-12 pt-20 md:pb-16 md:pt-28">
        <div className="mx-auto max-w-4xl px-4 text-center">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
          >
            <Mascot size="md" variant="planting" className="mx-auto mb-5 drop-shadow-sm" context="utma-by-state-index" />
            <p className="mb-3 text-xs font-bold uppercase tracking-[0.18em] text-[hsl(var(--kiddo-evergreen))]">
              State-by-state lookup
            </p>
            <h1 className="mb-4 font-heading text-4xl font-bold tracking-normal text-foreground md:text-5xl">
              At what age does a UTMA fund transfer to the child?
            </h1>
            <p className="mx-auto max-w-2xl text-lg leading-relaxed text-muted-foreground">
              UTMA (Uniform Transfers to Minors Act) is set by state law. Most states transfer custody at 18; some extend to 21, and a few allow the custodian to elect a later age. Pick your state to see the rule.
            </p>
          </motion.div>
        </div>
      </section>

      <section className="pb-12 md:pb-20">
        <div className="mx-auto max-w-4xl px-4">
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 md:grid-cols-3">
            {stateRows.map((state) => (
              <Link
                key={state.code}
                href={`/tools/utma-by-state/${state.code.toLowerCase()}`}
                className="flex items-center justify-between rounded-xl border border-border bg-card px-4 py-3 transition-colors hover:bg-card/80"
                data-testid={`state-link-${state.code.toLowerCase()}`}
              >
                <span className="font-medium text-foreground">{state.name}</span>
                <span className="flex items-center gap-2 text-sm tabular-nums text-muted-foreground">
                  Age {state.age}
                  <ArrowRight size={14} />
                </span>
              </Link>
            ))}
          </div>
        </div>
      </section>

      <section className="py-16 md:py-24">
        <div className="mx-auto max-w-3xl px-4 text-center">
          <h2 className="mb-4 font-heading text-3xl font-bold text-foreground md:text-4xl">
            Want to see what consistent investing could grow into?
          </h2>
          <p className="mx-auto mb-8 max-w-xl text-muted-foreground">
            The at-18 calculator runs the math for any monthly amount and time horizon, with Kiddo's 0.10% annual fee already netted out.
          </p>
          <Link href="/tools/at-18-calculator">
            <Button size="lg" className="h-14 px-10 text-base" data-testid="button-utma-index-calculator">
              Try the calculator
              <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          </Link>
        </div>
      </section>

      <Footer />
    </div>
  );
}
