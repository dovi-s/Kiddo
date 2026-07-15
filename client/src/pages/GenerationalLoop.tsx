import { motion } from "framer-motion";
import { Nav } from "@/components/layout/Nav";
import { Footer } from "@/components/layout/Footer";
import GenerationalLoopDiagram from "@/components/GenerationalLoopDiagram";

/**
 * Investor / business-plan surface for the generational loop. Unlisted (no nav
 * link), reachable at /generational-loop — same posture as /demo and
 * /p2p-preview. Public so it can be shared into a deck or a conversation.
 */
export default function GenerationalLoop() {
  return (
    <div className="kiddo-app-page">
      <Nav />

      <section className="relative overflow-hidden pb-20 pt-20 md:pb-28 md:pt-28">
        <div className="relative z-10 mx-auto max-w-4xl px-4 text-center">
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6 }}>
            <p className="mb-4 text-xs uppercase tracking-[0.22em] text-muted-foreground">The generational loop</p>
            <h1 className="mb-5 font-heading text-4xl font-bold tracking-normal text-foreground md:text-6xl">
              Most kids&apos; apps end at eighteen. This one starts over.
            </h1>
            <p className="mx-auto max-w-2xl text-lg leading-relaxed text-muted-foreground md:text-xl">
              A parent starts a fund. The kid grows up watching it. At eighteen it becomes theirs, and one day they
              start one for their own child. The market doesn&apos;t age out. It loops back into itself.
            </p>
          </motion.div>

          {/* the diagram */}
          <div className="mx-auto mt-12 max-w-lg rounded-3xl bg-card/70 p-6 shadow-premium-sm md:mt-16 md:p-10">
            <GenerationalLoopDiagram className="w-full" />
          </div>

          {/* the thesis line */}
          <motion.p
            className="mx-auto mt-10 max-w-xl font-heading text-2xl font-semibold tracking-normal text-foreground md:text-3xl"
            initial={{ opacity: 0, y: 12 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: false, amount: 0.6 }}
            transition={{ duration: 0.5 }}
          >
            The fund changes hands. The relationship doesn&apos;t.
          </motion.p>

          {/* honesty note: traction vs. vision — the brand is honesty, so we
              draw this as structure, never as a proven loop. */}
          <p className="mx-auto mt-6 max-w-xl text-sm leading-relaxed text-muted-foreground">
            This is the structure, not a claim. The fast loop, a gifter who starts their own fund, is what we measure
            today. This is what it compounds into: a customer acquired once, at the most expensive moment in consumer
            finance, for free.
          </p>
        </div>
      </section>

      <Footer />
    </div>
  );
}
