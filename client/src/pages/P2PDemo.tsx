// Concept preview: the "cash or stock" P2P dinner mechanic.
//
// PITCH / DEMO ONLY. This page is a fully client-side mock with NO backend,
// NO real money movement, and NO real accounts. It exists to SHOW the vision
// of the gifter loop escaping childhood into everyday adult life (the dinner
// debt settle), per ACCOUNT_MODEL.md section 6. The real thing is gated on
// live custody (the stock leg) and money transmission licensing (the cash
// leg); nothing here touches production money or data. Route: /p2p-preview.
//
// Copy rules honored: no em-dashes (locked Kiddo voice rule), no hard-named
// custodian, projections labeled illustrative (not a guarantee).

import { useState } from "react";
import { useLocation } from "wouter";
import { motion, AnimatePresence } from "framer-motion";
import { Nav } from "@/components/layout/Nav";
import { Footer } from "@/components/layout/Footer";
import { Button } from "@/components/ui/button";
import { usePageSeo } from "@/lib/seo";
import { haptic } from "@/lib/haptics";
import { ArrowRight, Check, Wallet, TrendingUp, Eye, RotateCcw } from "lucide-react";
import { StockLogo } from "@/components/ui/stock-logo";
import { FEATURED_STOCK_PICKS } from "@shared/stock-picks";

type Step = "intro" | "send" | "sent" | "claim" | "grow" | "convert";
type SendMode = "cash" | "stock";

// The pickable companies come from the CANONICAL pick list
// (shared/stock-picks.ts) — the same featured tier every real "choose a stock"
// surface uses (gift checkout, parent auto-invest, onboarding, mobile) — so this
// concept preview stays in sync with the product instead of drifting as its own
// hardcoded island (it used to show a stale 6 that omitted Tesla/Microsoft/
// Amazon/Google/Starbucks). Logos via <StockLogo>, which carries its own
// letter-circle fallback.
const STOCKS = FEATURED_STOCK_PICKS.map((s) => ({ ticker: s.ticker, name: s.name }));

const AMOUNT = 30;
const GROW_YEARS = 30;

function grow(amount: number, years: number, rate = 0.07): number {
  return amount * Math.pow(1 + rate, years);
}
const usd0 = (n: number) =>
  n.toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });

const fade = {
  initial: { opacity: 0, y: 12 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -12 },
  transition: { duration: 0.28 },
};

function PreviewRibbon() {
  return (
    <div className="mx-auto mb-6 flex max-w-xl items-center justify-center gap-2 rounded-full border border-[hsl(var(--kiddo-gold)/0.4)] bg-[hsl(var(--kiddo-gold)/0.12)] px-4 py-2 text-center">
      <Eye className="h-3.5 w-3.5 shrink-0 text-[hsl(var(--kiddo-gold-ink))]" />
      <span className="text-xs font-semibold text-[hsl(var(--kiddo-gold-ink))]">
        Concept preview. Not a live feature, and no real money moves here.
      </span>
    </div>
  );
}

export default function P2PDemo() {
  const [, setLocation] = useLocation();
  usePageSeo({
    title: "Cash or stock? | Kiddo concept preview",
    description:
      "A concept preview of how Kiddo could turn an everyday payment into a gift that compounds. Not a live feature.",
  });

  const [step, setStep] = useState<Step>("intro");
  const [mode, setMode] = useState<SendMode>("stock");
  const [stock, setStock] = useState(STOCKS[0]);
  const [note, setNote] = useState("For dinner the other night. Next one's on me.");
  // Tracks Maya's claim choice so the payoff reads as celebration (she kept it)
  // vs the road not taken (she cashed out), instead of always assuming she kept.
  const [kept, setKept] = useState(true);

  const go = (next: Step) => {
    haptic("light");
    setStep(next);
  };
  const restart = () => {
    haptic("selection");
    setMode("stock");
    setStock(STOCKS[0]);
    setKept(true);
    setStep("intro");
  };

  const futureVal = grow(AMOUNT, GROW_YEARS);

  return (
    <div className="min-h-screen bg-background">
      <Nav />

      <section className="px-4 pb-24 pt-24 md:pt-28">
        <div className="mx-auto max-w-xl">
          <PreviewRibbon />

          <AnimatePresence mode="wait">
            {/* 1. INTRO ----------------------------------------------------- */}
            {step === "intro" && (
              <motion.div key="intro" {...fade} className="text-center">
                <p className="text-sm font-semibold uppercase tracking-[0.18em] text-primary">
                  The dinner
                </p>
                <h1 className="mt-4 font-heading text-3xl font-bold tracking-tight text-foreground md:text-5xl">
                  You owe Maya $30 for dinner.
                </h1>
                <p className="mx-auto mt-5 max-w-md text-lg leading-relaxed text-muted-foreground">
                  Everyone reaches for Venmo. What if the $30 you send could become
                  something that grows for the rest of her life, and she still gets
                  to choose?
                </p>
                <div className="mt-8">
                  <Button size="lg" onClick={() => go("send")} data-testid="button-p2p-start">
                    Send Maya $30
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </Button>
                </div>
              </motion.div>
            )}

            {/* 2. SEND (your side) ------------------------------------------ */}
            {step === "send" && (
              <motion.div key="send" {...fade}>
                <div className="rounded-[28px] border border-border bg-card p-6 shadow-premium-sm md:p-8">
                  <p className="text-sm font-semibold text-muted-foreground">Sending to Maya</p>
                  <p className="mt-1 font-heading text-4xl font-bold text-foreground">{usd0(AMOUNT)}</p>

                  <p className="mt-7 text-sm font-semibold text-foreground">Send it as</p>
                  <div className="mt-3 grid grid-cols-2 gap-3">
                    <button
                      type="button"
                      onClick={() => { haptic("selection"); setMode("cash"); }}
                      data-testid="button-mode-cash"
                      className={`rounded-2xl border p-4 text-left transition-all ${
                        mode === "cash"
                          ? "border-primary bg-primary/5 ring-2 ring-primary/30"
                          : "border-border hover:border-primary/40"
                      }`}
                    >
                      <Wallet className="h-5 w-5 text-foreground" />
                      <p className="mt-2 font-semibold text-foreground">Cash</p>
                      <p className="text-xs text-muted-foreground">She gets $30. Spent by Friday.</p>
                    </button>
                    <button
                      type="button"
                      onClick={() => { haptic("selection"); setMode("stock"); }}
                      data-testid="button-mode-stock"
                      className={`rounded-2xl border p-4 text-left transition-all ${
                        mode === "stock"
                          ? "border-primary bg-primary/5 ring-2 ring-primary/30"
                          : "border-border hover:border-primary/40"
                      }`}
                    >
                      <TrendingUp className="h-5 w-5 text-[hsl(var(--kiddo-evergreen))]" />
                      <p className="mt-2 font-semibold text-foreground">Stock</p>
                      <p className="text-xs text-muted-foreground">$30 that can grow for decades.</p>
                    </button>
                  </div>

                  <AnimatePresence>
                    {mode === "stock" && (
                      <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: "auto" }}
                        exit={{ opacity: 0, height: 0 }}
                        className="overflow-hidden"
                      >
                        <p className="mt-7 text-sm font-semibold text-foreground">Pick a company she will smile at</p>
                        <div className="mt-3 grid grid-cols-3 gap-2.5">
                          {STOCKS.map((s) => (
                            <button
                              key={s.ticker}
                              type="button"
                              onClick={() => { haptic("selection"); setStock(s); }}
                              data-testid={`button-stock-${s.ticker}`}
                              className={`flex flex-col items-center rounded-2xl border p-3 transition-all ${
                                stock.ticker === s.ticker
                                  ? "border-primary bg-primary/5 ring-2 ring-primary/30"
                                  : "border-border hover:border-primary/40"
                              }`}
                            >
                              <StockLogo ticker={s.ticker} size={28} />
                              <span className="mt-1 text-xs font-medium text-foreground">{s.name}</span>
                            </button>
                          ))}
                        </div>

                        <p className="mt-6 text-sm font-semibold text-foreground">Add a note</p>
                        <textarea
                          value={note}
                          onChange={(e) => setNote(e.target.value.slice(0, 140))}
                          rows={2}
                          data-testid="input-p2p-note"
                          className="mt-2 w-full resize-none rounded-2xl border border-border bg-background p-3 text-sm text-foreground outline-none focus:border-primary/50"
                        />
                      </motion.div>
                    )}
                  </AnimatePresence>

                  <Button
                    className="mt-7 w-full"
                    size="lg"
                    onClick={() => go("sent")}
                    data-testid="button-p2p-send"
                  >
                    {mode === "stock" ? `Send $30 of ${stock.name}` : "Send $30 cash"}
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </Button>
                </div>
              </motion.div>
            )}

            {/* 3. SENT (transition) ----------------------------------------- */}
            {step === "sent" && (
              <motion.div key="sent" {...fade} className="text-center">
                <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-[hsl(var(--kiddo-evergreen)/0.12)]">
                  <Check className="h-8 w-8 text-[hsl(var(--kiddo-evergreen))]" />
                </div>
                <h2 className="mt-6 font-heading text-3xl font-bold text-foreground">On its way to Maya.</h2>
                <p className="mx-auto mt-4 max-w-md text-lg leading-relaxed text-muted-foreground">
                  She just got a text with a link. Here is what she sees when she taps it.
                </p>
                <div className="mt-8">
                  <Button size="lg" variant="outline" onClick={() => go("claim")} data-testid="button-p2p-see-maya">
                    See what Maya sees
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </Button>
                </div>
              </motion.div>
            )}

            {/* 4. CLAIM (Maya's side) --------------------------------------- */}
            {step === "claim" && (
              <motion.div key="claim" {...fade}>
                <div className="rounded-[28px] border border-border bg-card p-7 text-center shadow-premium-sm md:p-9">
                  <div className="flex justify-center">{mode === "stock" ? <StockLogo ticker={stock.ticker} size={56} /> : <Wallet className="h-12 w-12 text-foreground" />}</div>
                  <h2 className="mt-5 font-heading text-2xl font-bold text-foreground md:text-3xl">
                    {mode === "stock"
                      ? `Your friend sent you $30 of ${stock.name} stock.`
                      : "Your friend sent you $30."}
                  </h2>
                  {mode === "stock" && (
                    <p className="mx-auto mt-4 max-w-sm rounded-2xl bg-muted/40 p-4 text-sm italic leading-relaxed text-muted-foreground">
                      &ldquo;{note}&rdquo;
                    </p>
                  )}

                  <p className="mt-6 text-sm font-semibold text-foreground">It is yours. Your choice:</p>
                  <div className="mt-3 flex flex-col gap-3">
                    <Button
                      size="lg"
                      onClick={() => { setKept(true); go("grow"); }}
                      data-testid="button-p2p-keep"
                    >
                      {mode === "stock" ? `Keep it as ${stock.name} and watch it grow` : "Invest it and watch it grow"}
                    </Button>
                    <button
                      type="button"
                      onClick={() => { setKept(false); go("grow"); }}
                      data-testid="button-p2p-cashout"
                      className="text-sm text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
                    >
                      {mode === "stock" ? "Take the $30 in cash instead" : "Keep the $30 as cash"}
                    </button>
                  </div>
                  <p className="mt-5 text-xs text-muted-foreground/70">
                    The cash option is what makes this a real choice. It is also the part that
                    needs a money license, so it lands after the stock version.
                  </p>
                </div>
              </motion.div>
            )}

            {/* 5. GROW (the payoff) ----------------------------------------- */}
            {step === "grow" && (
              <motion.div key="grow" {...fade} className="text-center">
                <p className="text-sm font-semibold uppercase tracking-[0.18em] text-primary">
                  {kept ? "If she keeps it" : "The road not taken"}
                </p>
                <h2 className="mt-4 font-heading text-3xl font-bold text-foreground md:text-4xl">
                  That $30 dinner could {kept ? "become" : "have become"} {usd0(futureVal)}.
                </h2>
                <p className="mx-auto mt-5 max-w-md text-lg leading-relaxed text-muted-foreground">
                  {kept ? (
                    <>Left alone for {GROW_YEARS} years at about 7 percent a year. The dinner is forgotten by next week. This is still growing on her birthday in {GROW_YEARS} years.</>
                  ) : (
                    <>Cash is spent by Friday. Kept instead, at about 7 percent a year, that $30 would still be growing on her birthday in {GROW_YEARS} years.</>
                  )}
                </p>
                <p className="mx-auto mt-4 max-w-md text-xs text-muted-foreground/70">
                  Illustrative only, not a guarantee. Investments can lose value as well as gain.
                </p>
                <div className="mt-8">
                  <Button size="lg" onClick={() => go("convert")} data-testid="button-p2p-convert-cta">
                    Now do it for someone smaller
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </Button>
                </div>
              </motion.div>
            )}

            {/* 6. CONVERT (loop closure) ------------------------------------ */}
            {step === "convert" && (
              <motion.div key="convert" {...fade} className="text-center">
                <div className="text-5xl">🌱</div>
                <h2 className="mt-5 font-heading text-3xl font-bold text-foreground md:text-4xl">
                  You just felt the whole idea.
                </h2>
                <p className="mx-auto mt-5 max-w-md text-lg leading-relaxed text-muted-foreground">
                  A gift that outlives the moment. Start it on day one for a kid you love,
                  and let everyone who loves them add to it for the next eighteen years.
                </p>
                <div className="mt-8 flex flex-col items-center gap-3">
                  <Button size="lg" onClick={() => { haptic("medium"); setLocation("/get-started"); }} data-testid="button-p2p-start-fund">
                    Start a fund
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </Button>
                  <button
                    type="button"
                    onClick={restart}
                    data-testid="button-p2p-replay"
                    className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
                  >
                    <RotateCcw className="h-3.5 w-3.5" />
                    Replay the dinner
                  </button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </section>

      <Footer />
    </div>
  );
}
