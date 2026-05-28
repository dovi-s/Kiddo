import { useEffect, useState, type ReactNode } from "react";
import { Link, useLocation } from "wouter";
import { motion, useReducedMotion } from "framer-motion";
// Eye replaces Sparkles 2026-05-12 for the "Kid View" feature card —
// Sparkles banned per feedback_no_ai_slop.md. Eye is the semantic match
// for a viewing surface (the Kid View IS what the kid VIEWs of the fund).
import { ArrowRight, BookOpen, Shield, TrendingUp, Users, Gift, Repeat, Sprout, Eye, Check } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/hooks/use-auth";
import { useFunds } from "@/hooks/use-funds";
import { Button } from "@/components/ui/button";
import { Mascot } from "@/components/ui/mascot";
import { Nav } from "@/components/layout/Nav";
import { Footer } from "@/components/layout/Footer";
import { TrustMicroStrip } from "@/components/ui/ux-foundations";
import { LockedRefusalsPanel } from "@/components/LockedRefusalsPanel";
import { Dialog, DialogContent, DialogTitle, DialogDescription, DialogHeader } from "@/components/ui/dialog";
import { haptic } from "@/lib/haptics";
import { websiteCopy } from "@kora/content";

type MarketingStats = {
  fundCount: number;
  totalGifted: number;
  uniqueGifters: number;
  earliestClaimYear: number | null;
};

const SECTION_MAX = "max-w-6xl mx-auto px-4";

function FadeIn({ children, delay = 0, className = "" }: { children: ReactNode; delay?: number; className?: string }) {
  const reduceMotion = useReducedMotion();
  return (
    <motion.div
      initial={reduceMotion ? { opacity: 1 } : { opacity: 0, y: 20 }}
      whileInView={reduceMotion ? { opacity: 1 } : { opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-50px" }}
      transition={reduceMotion ? { duration: 0 } : { duration: 0.6, delay, ease: [0.22, 1, 0.36, 1] }}
      className={className}
    >
      {children}
    </motion.div>
  );
}

// Signature trust counter — pulls aggregate-only data from the public
// /api/public/marketing-stats endpoint. Renders honestly at any scale:
// if real numbers are small today, the framing leans on durability
// ("growing toward their 18th birthday") not vanity scale. Failure
// mode is silent (returns nothing rather than "Error" or "0 funds")
// so a marketing surface never breaks on a temporary backend hiccup.
function SignatureTrustCounter() {
  const { data, isError } = useQuery<MarketingStats>({
    queryKey: ["/api/public/marketing-stats"],
    queryFn: async () => {
      const res = await fetch("/api/public/marketing-stats");
      if (!res.ok) throw new Error(String(res.status));
      return res.json();
    },
    staleTime: 5 * 60 * 1000,
    retry: 1,
  });

  if (isError || !data) return null;

  const { fundCount, totalGifted, uniqueGifters, earliestClaimYear } = data;

  const formatMoney = (n: number) => {
    if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`;
    if (n >= 1_000) return `$${(n / 1_000).toFixed(1)}K`;
    return `$${Math.round(n).toLocaleString()}`;
  };

  return (
    <section className="py-12 md:py-16">
      <div className={SECTION_MAX}>
        <FadeIn className="mx-auto max-w-5xl">
          <div className="rounded-3xl border border-border bg-card/60 p-8 md:p-12 shadow-premium-sm">
            <p className="text-center text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
              Real funds, real horizons
            </p>
            <div className="mt-6 grid gap-6 md:grid-cols-4">
              <div className="text-center">
                <div className="font-heading text-3xl font-bold text-foreground md:text-4xl">{fundCount.toLocaleString()}</div>
                <p className="mt-1 text-xs text-muted-foreground">funds growing toward their owner&apos;s 18th birthday</p>
              </div>
              <div className="text-center">
                <div className="font-heading text-3xl font-bold text-foreground md:text-4xl">{formatMoney(totalGifted)}</div>
                <p className="mt-1 text-xs text-muted-foreground">gifted by family and friends, fully invested</p>
              </div>
              <div className="text-center">
                <div className="font-heading text-3xl font-bold text-foreground md:text-4xl">{uniqueGifters.toLocaleString()}</div>
                <p className="mt-1 text-xs text-muted-foreground">grandparents, aunts, uncles, friends</p>
              </div>
              <div className="text-center">
                <div className="font-heading text-3xl font-bold text-foreground md:text-4xl">
                  {earliestClaimYear || "—"}
                </div>
                <p className="mt-1 text-xs text-muted-foreground">earliest year a Kiddo fund unlocks for the kid who owns it</p>
              </div>
            </div>
            <p className="mt-6 text-center text-xs text-muted-foreground">
              Numbers update daily. Aggregated across all Kiddo families. No individual fund detail shown.
            </p>
          </div>
        </FadeIn>
      </div>
    </section>
  );
}

// Tile data — each entry has the brief surface the tile shows on the
// grid AND the deeper content the modal renders on click. Modal content
// is intentionally compact: one body paragraph, 3-5 detail bullets,
// optional "see live surface" link. Stripe pattern: don't leap the
// visitor off the page; show enough to satisfy curiosity without
// committing them to a full sub-page navigation.
type BentoTile = {
  icon: typeof Gift;
  eyebrow: string;
  title: string;
  body: string;
  modalLead: string;
  modalDetails: string[];
  modalCallout?: { label: string; value: string };
  deepLink?: { href: string; label: string; external?: boolean };
};

const BENTO_TILES: BentoTile[] = [
  {
    icon: Gift,
    eyebrow: "For grandma",
    title: "Gift page",
    body: "One link. Three taps. No account. Anyone can become a gifter in under a minute.",
    modalLead:
      "Family lands on a clean page, picks an amount, leaves a note or voice memo, and becomes the person who gave something that lasts. No Kiddo account, no app to install. The whole flow is designed for grandma's first try at 9pm on a Tuesday.",
    modalDetails: [
      "Stripe Checkout handles payment. Bank transfer option for larger gifts.",
      "Optional message + photo + video + voice note travels with the gift into the Memory Book.",
      "The gifter sees a confirmation that reads as a gift, not a receipt.",
      "Per-fund private link. Not searchable, not public-indexed.",
    ],
    modalCallout: {
      label: "Median time from landing to checkout",
      value: "under 60 seconds",
    },
    deepLink: { href: "/how-it-works", label: "See the gifter flow" },
  },
  {
    icon: BookOpen,
    eyebrow: "For the kid at 18",
    title: "Memory Book",
    body: "Every gift, every note, every photo and voice message, saved in the order they arrived.",
    modalLead:
      "Every gift becomes a Memory Book entry. Gifters can attach a note, photo, video, or voice message. Parents can add their own letters, milestones, and a sealed letter the kid only sees on their 18th birthday. The note IS the entry; the transaction is metadata.",
    modalDetails: [
      "Three visibility tiers: kid_now (right now), kid_at_18 (sealed until majority), parent_only (private to the parent).",
      "Voice memos and videos are first-class, not afterthoughts. The moat is the texture you can't fake.",
      "Sealed letter renders only when the kid claims at 18. Auto-fired milestones (every $500, every 25 contributors) write Memory Book entries too.",
      "Survives the at-18 handoff intact. The kid inherits both the brokerage account and the years of love attached to it.",
    ],
    modalCallout: { label: "Lives", value: "for the life of the fund and beyond" },
    deepLink: { href: "/how-it-works#memory", label: "See how the Memory Book works" },
  },
  {
    icon: Eye,
    eyebrow: "For the kid right now",
    title: "Kid View",
    body: "What they own, who gave it, what the company actually does. Wonder first; understanding over time.",
    modalLead:
      "PIN-protected window for the child. Shows what the fund owns (Disney shares, Apple shares, Spotify shares) with age-appropriate explanations. The 5-year-old sees wonder; the 13-year-old sees what a stock actually is; the 17-year-old can suggest stocks for the parent to review.",
    modalDetails: [
      "Phase 5-8 (wonder): \"You own a piece of Disney. Disney makes the movies you love.\"",
      "Phase 9-13 (explanations): \"A stock is a tiny slice of a company. When the company grows, your slice grows.\"",
      "Phase 14-17 (real participation): the kid can suggest tickers; the parent reviews and approves.",
      "PIN-gated. The parent decides who has access. Not searchable, not shareable to strangers.",
    ],
    deepLink: { href: "/how-it-works#kid-view", label: "See the Kid View phases" },
  },
  {
    icon: Repeat,
    eyebrow: "For the parent who operates the fund",
    title: "Custom mix and strategy switching",
    body: "Design the portfolio your child grows up holding. Pick the ETF allocation, switch between conservative / balanced / growth as the years change.",
    modalLead:
      "Plus is for the parent who operates the fund. Recurring contributions on the fund unlock for you AND any gifter (the baby shower's six relatives can each set $25/mo, free, because the fund is Plus). Custom ETF allocation (40% VTI / 30% VXUS / 20% BND / 10% AAPL, or whatever fits). Switch the strategy as the kid ages. Rebalance when your view changes. Invite a co-parent.",
    modalDetails: [
      "Recurring contributions on the fund (parent + any gifter); Free funds get a reminder system for gifters instead.",
      "Custom mix: pick from VTI, VXUS, BND, VGT, VUG, VYM, SCHD, QQQ. Set your own weights.",
      "Strategy switching: move between conservative, balanced, and growth as the kid grows up.",
      "Auto-rebalancing keeps the mix on target as prices drift.",
      "Annual contribution summary for tax records.",
    ],
    modalCallout: { label: "Plan tier", value: "Kiddo+ and above" },
  },
  {
    icon: TrendingUp,
    eyebrow: "For the parent who chooses",
    title: "Customize the mix",
    body: "Pick the holdings the fund follows. Conservative, balanced, growth, or your own. Not a black box.",
    modalLead:
      "Choose a strategy that reflects the parent you want to be: Conservative ⚖️, Balanced 🌿, Growth 📈, or your own 🎯 Custom. Your pick shapes your child's financial foundation for years. The fund's holdings rebalance toward the target on every gift, and every allocation decision is shown with the percentages and the reason. Not a black box.",
    modalDetails: [
      "Conservative ⚖️. Bond-weighted, lower volatility, suited to short horizons.",
      "Balanced 🌿. Vanguard total stock + total international + bonds. Default for most parents.",
      "Growth 📈. Equity-heavy, longer horizon, fits the 0-10 age bracket.",
      "Custom 🎯. Pick your own tickers and weights. Plus-tier feature.",
    ],
    modalCallout: { label: "Rebalancing", value: "contribution-based, no drift selling" },
    deepLink: { href: "/how-it-works#mix", label: "Read the strategy details" },
  },
  {
    icon: Sprout,
    eyebrow: "For the day it all matters",
    title: "At-18 handoff",
    body: "On the kid's 18th birthday, ownership transfers. The Memory Book transfers with it. Designed for the moment.",
    modalLead:
      "The most consequential moment in the product. The architecture is designed so the kid receives the fund automatically on their 18th birthday regardless of parent attentiveness. T-30 days the parent gets a prep email; T-1 day a reminder; T-0 the kid is auto-emailed the claim link if their email is verified.",
    modalDetails: [
      "Verification gate. The at-18 invite is NOT auto-sent unless the kid's email has been verified by them clicking a link beforehand.",
      "Kid creates their own Kiddo account at claim. Never the parent's credentials.",
      "On claim: ownership transfers, Memory Book + sealed letter unlock, year-by-year retrospective becomes available, parent loses the parent-managed view.",
      "Worker is idempotent and runs every 6 hours. Parent attentiveness is not a single point of failure.",
    ],
    modalCallout: { label: "Designed for", value: "what the kid sees on their 18th birthday" },
    deepLink: { href: "/age-18", label: "See the at-18 lifecycle" },
  },
];

// Product bento — replaces the inline 3-card preview in the hero with
// a 6-tile grid covering the primary surfaces. Each tile opens a modal
// that previews the surface in detail without leaving the home page —
// Stripe's "don't leap them off the page" pattern. The 6 tiles map to
// the three-surfaces philosophy:
//   gifter:  Gift page
//   parent:  Recurring Investments + Custom Mix
//   kid:     Memory Book + Kid View + At-18 Handoff
function ProductBento() {
  const [openTile, setOpenTile] = useState<BentoTile | null>(null);

  return (
    <section className="py-16 md:py-24">
      <div className={SECTION_MAX}>
        <FadeIn className="mx-auto mb-10 max-w-3xl text-center md:mb-14">
          <h2 className="font-heading text-2xl font-bold tracking-normal text-foreground md:text-4xl">
            Six surfaces. One promise.
          </h2>
          <p className="mt-3 text-base leading-relaxed text-muted-foreground">
            Every part of Kiddo is built for one of three people: the family member sending a gift, the parent stewarding the fund, or the kid who one day owns it.
          </p>
        </FadeIn>
        <div className="mx-auto grid max-w-6xl gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {BENTO_TILES.map((tile, i) => (
            <FadeIn key={tile.title} delay={i * 0.05}>
              <button
                type="button"
                onClick={() => { haptic("selection"); setOpenTile(tile); }}
                className="group h-full w-full rounded-2xl border border-border/60 bg-card p-6 text-left shadow-premium-sm transition-all hover:border-primary/40 hover:shadow-md cursor-pointer"
                data-testid={`bento-tile-${tile.title.toLowerCase().replace(/\s+/g, "-")}`}
              >
                <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10">
                  <tile.icon className="h-5 w-5 text-primary" strokeWidth={1.8} />
                </div>
                <p className="text-[10.5px] font-semibold uppercase tracking-[0.14em] text-primary/70">{tile.eyebrow}</p>
                <h3 className="mt-1 font-heading text-lg font-semibold text-foreground">{tile.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{tile.body}</p>
                <p className="mt-4 text-xs font-medium text-primary/80 opacity-70 transition-opacity group-hover:opacity-100">
                  See how →
                </p>
              </button>
            </FadeIn>
          ))}
        </div>
      </div>

      {/* Single shared dialog — opens with whichever tile was clicked.
          Stripe pattern: keep the visitor on the home page; show enough
          to satisfy curiosity without committing them to a full sub-page
          load. Closes on overlay click, ESC, or X (shadcn defaults). */}
      <Dialog open={!!openTile} onOpenChange={(open) => { if (!open) setOpenTile(null); }}>
        <DialogContent className="max-w-xl">
          {openTile ? (
            <>
              <DialogHeader>
                <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10">
                  <openTile.icon className="h-6 w-6 text-primary" strokeWidth={1.8} />
                </div>
                <p className="text-[10.5px] font-semibold uppercase tracking-[0.14em] text-primary/70">{openTile.eyebrow}</p>
                <DialogTitle className="font-heading text-2xl font-bold tracking-normal text-foreground">
                  {openTile.title}
                </DialogTitle>
                <DialogDescription className="text-sm leading-relaxed text-muted-foreground">
                  {openTile.modalLead}
                </DialogDescription>
              </DialogHeader>
              <ul className="mt-2 space-y-2.5">
                {openTile.modalDetails.map((detail, i) => (
                  <li key={i} className="flex items-start gap-2.5 text-sm text-foreground">
                    <Check className="mt-0.5 h-4 w-4 shrink-0 text-primary" strokeWidth={2.4} />
                    <span className="leading-relaxed">{detail}</span>
                  </li>
                ))}
              </ul>
              {openTile.modalCallout ? (
                <div className="mt-3 rounded-xl border border-primary/20 bg-primary/5 px-4 py-3">
                  <p className="text-[10.5px] font-semibold uppercase tracking-[0.14em] text-primary/80">
                    {openTile.modalCallout.label}
                  </p>
                  <p className="mt-1 font-heading text-base font-semibold text-foreground">
                    {openTile.modalCallout.value}
                  </p>
                </div>
              ) : null}
              {openTile.deepLink ? (
                <div className="mt-2 flex justify-end">
                  <Link href={openTile.deepLink.href}>
                    <Button variant="outline" size="sm" onClick={() => setOpenTile(null)}>
                      {openTile.deepLink.label}
                      <ArrowRight className="ml-2 h-3.5 w-3.5" />
                    </Button>
                  </Link>
                </div>
              ) : null}
            </>
          ) : null}
        </DialogContent>
      </Dialog>
    </section>
  );
}

const testimonials = [
  {
    quote:
      "I sent the link to our family group chat before Emma's birthday. By the end of the week, 14 people had gifted. Every single one of them is now invested in her future.",
    attribution: "Illustrative: the family group-chat effect",
  },
  {
    quote:
      "My parents are in their 70s and not great with technology. They gifted my son through Kiddo in under a minute. I could not believe it.",
    attribution: "Illustrative: why grandparents find it easy",
  },
  {
    quote:
      "I used to give checks that I knew would just get deposited and forgotten. Now I give Disney stock. It feels completely different.",
    attribution: "Illustrative: from forgettable checks to real stock",
  },
];


const comparisonRows = [
  { label: "Anyone can gift in 60 seconds", savings: "No", plan529: "No", kora: "Yes" },
  { label: "Invests automatically", savings: "No", plan529: "Sometimes", kora: "Yes" },
  { label: "No restrictions on how money is used", savings: "Yes", plan529: "No", kora: "Yes" },
  { label: "Helps children learn how investing works", savings: "No", plan529: "No", kora: "Yes" },
  { label: "Memory Book of every gift", savings: "No", plan529: "No", kora: "Yes" },
  { label: "No account needed to give", savings: "No", plan529: "No", kora: "Yes" },
  { label: "Free to start", savings: "Yes", plan529: "Yes", kora: "Yes" },
];

export default function Home() {
  const reduceMotion = useReducedMotion();
  const { isAuthenticated, isLoading } = useAuth();
  const [, setLocation] = useLocation();
  // Fetch funds when authenticated so the redirect below can route
  // multi-fund parents to the household overview at /funds (Tier 2 scope per
  // project_chrome_scope_tiers.md) instead of one specific kid's Dashboard.
  // Single-fund parents still go straight to /dashboard. useFunds()
  // self-gates on auth — when unauthenticated, returns [] without hitting
  // the network (per the hook's locked behavior).
  const { data: funds = [], isLoading: fundsLoading } = useFunds();

  useEffect(() => {
    if (!isLoading && isAuthenticated) {
      // Wait for funds to load before deciding destination — otherwise
      // multi-fund parents briefly land on /dashboard before the funds list
      // resolves, causing a double-navigation. The fundsLoading gate avoids
      // that flicker. (Single-fund parents still pay the wait cost but it's
      // a single React-Query cycle; cached on subsequent visits.)
      if (fundsLoading) return;
      const search = typeof window !== "undefined" ? window.location.search : "";
      // Route to /funds for multi-fund households (the universal "home" for
      // Family-plan parents — see project_funds_overview_rules.md). For
      // single-fund parents, /dashboard IS their home so go there directly
      // (and avoid the /funds → "unlocks at 2 funds" redirect that would
      // otherwise fire and create a confusing double-navigation).
      const destination = funds.length >= 2 ? "/funds" : "/dashboard";
      setLocation(`${destination}${search || ""}`);
    }
  }, [isAuthenticated, isLoading, fundsLoading, funds.length, setLocation]);

  if (isAuthenticated) return null;

  return (
    <div className="kiddo-app-page">
      <Nav />
      <main>
        {/* Hero — disciplined to 5 elements: mascot, eyebrow, H1, subhead,
            CTA pair. The earlier hero stacked 9 distinct content blocks
            (mascot + eyebrow + H1 + subhead + 2 CTAs + 2 redundant
            taglines + 3 chips + 3 preview cards). Hera / Stripe register
            says one promise, one button, then trust + proof BELOW the
            hero, not stuffed inside it. The chips moved to the trust
            strip section; the preview cards moved to the bento. Result:
            the parent's eye lands on the headline + CTA without hopping. */}
        <section className="relative overflow-hidden pb-16 pt-20 md:pb-20 md:pt-32">
          <div className={`${SECTION_MAX} relative z-10`}>
            <motion.div
              initial={reduceMotion ? { opacity: 1 } : { opacity: 0, y: 24 }}
              animate={reduceMotion ? { opacity: 1 } : { opacity: 1, y: 0 }}
              transition={reduceMotion ? { duration: 0 } : { duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
              className="mx-auto max-w-4xl text-center"
            >
              <Mascot size="lg" variant="planting" className="mx-auto mb-5 drop-shadow-sm" context="home-hero" />
              <p className="mb-4 text-sm font-semibold uppercase tracking-[0.18em] text-[hsl(var(--kiddo-evergreen))]">
                Cash gifts disappear. Kiddo gifts last.
              </p>
              {/* Hero repositioned 2026-05-23 per the pricing-v3 strategic
                  session: Memory Book moves into the H1 alongside the fund
                  metaphor. Every UTMA platform says "invest in your child's
                  future"; only Kiddo can credibly say "the book." Leading
                  with the soul (Memory Book) + the body (fund) is the
                  Target-not-Walmart positioning move. See
                  project_pre_launch_strategic_frame.md repositioning beats. */}
              <h1 className="mb-6 font-heading text-4xl font-bold leading-tight tracking-normal text-foreground md:text-6xl" data-testid="text-hero-headline">
                The fund and the book your kid opens at 18.
              </h1>
              <p className="mx-auto mb-8 max-w-3xl text-lg leading-relaxed text-muted-foreground md:text-xl" data-testid="text-hero-subheading">
                A real investment account that grows with them, holding the letters, photos, and voice memos from everyone who shows up for them. Set up in 2 minutes. Anyone can gift, no account needed.
              </p>
              <div className="flex flex-col items-center justify-center gap-4 sm:flex-row">
                <Link href="/get-started">
                  <Button size="lg" className="kiddo-gold-button h-14 w-full px-10 text-base sm:w-64" data-testid="button-start-fund" onClick={() => haptic("medium")}>
                    {websiteCopy.hero.cta}
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </Button>
                </Link>
                <Link href="/how-it-works" className="text-sm font-medium text-muted-foreground underline-offset-4 hover:text-foreground hover:underline" data-testid="button-how-it-works">
                  {websiteCopy.hero.secondaryCta}
                </Link>
              </div>
              {/* AUM honesty in hero — per pricing-v3 + behavioral framing
                  discipline (cents-on-dollar legibility): the 0.10% AUM
                  appears as "10¢ per $100 invested" so the genuinely tiny
                  fee reads as genuinely tiny. Acorns hides fees; Kiddo
                  flaunts them. Trust is a moat with parents specifically. */}
              <p className="mt-5 text-sm text-muted-foreground">Free to start. 10¢ per $100 invested per year, or $1 a year per $1,000. No platform fee on gifts.</p>
              {/* Honest geographic scope. Kora is structurally US-only at
                  launch (UTMA + DriveWealth + 1099s). Surfacing this
                  before signup catches non-US visitors before they
                  invest time. Settings-app register — no apology, no
                  promise. */}
              <p className="mt-1.5 text-xs text-muted-foreground/80">Available to US families today.</p>
            </motion.div>
          </div>
        </section>

        {/* Trust strip — hoisted up from the bottom of the page. The
            brokerage layer is locked-memory load-bearing per
            project_brokerage_as_trust_feature.md ("DriveWealth/SIPC
            celebrated, not buried"). Same logic Hera/Stripe apply: the
            credibility markers earn hero proximity, not footer fine
            print. The MicroStrip carries the FINRA + SIPC + DriveWealth
            language; the chips below add the no-app + private-link
            differentiators that aren't broker-related. */}
        <section className="border-y border-border/40 bg-card/40 py-6 md:py-8">
          <div className={SECTION_MAX}>
            <TrustMicroStrip />
            <div className="mx-auto mt-4 flex max-w-4xl flex-wrap justify-center gap-2 text-xs text-muted-foreground">
              <span className="rounded-full border border-border bg-card px-3 py-1">No app needed to give a gift</span>
              <span className="rounded-full border border-border bg-card px-3 py-1">Private fund link · not searchable</span>
              <span className="rounded-full border border-border bg-card px-3 py-1">Fees shown in full before checkout</span>
            </div>
          </div>
        </section>

        {/* Signature trust counter — the "only Kora could show this"
            stat. Kid-at-18 framing makes scale legible without vanity:
            "X funds growing toward their owner's 18th birthday" reads
            as durability, not user-count theater. Earliest-claim-year is
            the moat surface — nobody else holds custodial UTMA funds
            with this 18-year horizon. Numbers stay honest at every
            scale; if real numbers are small today, the framing leans on
            durability ("growing toward their 18th birthday") not size.
            Stripe's GDP counter is the precedent (only-Stripe data,
            hero placement, accumulates weight over time). */}
        <SignatureTrustCounter />

        {/* Memory Book emotional section — RELOCATED 2026-05-25 from
            its previous position deep in the page (was position 9 in
            the section flow). The copy specialist audit caught that
            the load-bearing emotional beat ("proof that people loved
            them") lived at paragraph 15 — buried behind feature
            breadth (ProductBento) + the problem section + the 3-step
            flow + the gifter card + the Kid View card. A parent
            scanning the page for 20 seconds would never reach it.

            The relocated section now lands immediately after the
            SignatureTrustCounter (trust → scale) and before the
            ProductBento (feature breadth). Narrative becomes:
              1. Hero: "the fund and the book your kid opens at 18"
              2. Trust strip: brokerage credibility
              3. Trust counter: durability proof
              4. Memory Book: WHY this matters (proof of love)
              5. ProductBento: HOW it's built (feature exploration)
              6. Rest of the page: problem → flow → gifter → kid → ...

            The emotional payoff lands at the moment of highest
            attention (post-hero, pre-feature-fatigue) instead of
            being buried 9 sections deep. Per the team-audit copy
            specialist's #1 recommendation. */}
        <section className="py-20 md:py-28">
          <div className={SECTION_MAX}>
            <FadeIn className="mx-auto max-w-3xl text-center">
              <div className="mb-6 inline-flex items-center gap-2 rounded-full bg-primary/10 px-3 py-1 text-xs font-medium text-primary">
                <BookOpen className="h-3.5 w-3.5" />
                Memory Book
              </div>
              <h2 className="mb-6 font-heading text-3xl font-bold tracking-normal text-foreground md:text-5xl">
                The whole story, in the order it happened.
              </h2>
              <p className="mx-auto mb-4 max-w-2xl text-lg leading-relaxed text-muted-foreground">
                Every gift, every note, every person who showed up for your child. Captured, in order, forever.
              </p>
              <p className="mx-auto max-w-2xl text-lg leading-relaxed text-muted-foreground">
                Grandma&apos;s Disney gift from the first birthday. The note from a college friend you hadn&apos;t spoken to in years. The $20 from someone who just wanted to be part of it.
              </p>
              <p className="mt-6 text-lg font-semibold text-foreground">
                At 18, they don&apos;t just get a brokerage balance. They get proof of everyone who showed up for them.
              </p>
            </FadeIn>

            <div className="mx-auto mt-14 max-w-4xl grid gap-5 md:grid-cols-3">
              {[
                {
                  eyebrow: "Emma's 1st birthday",
                  note: "\"For my Emma, with all my love. May this grow as fast as you do.\"",
                  detail: "Grandma gifted $100 - invested in Disney - Jan 14, 2023",
                },
                {
                  eyebrow: "Baby shower",
                  note: "\"We can't wait to watch you grow up. This is the start of something big.\"",
                  detail: "Aunt Sarah gifted $50 - invested in Apple - Aug 2, 2022",
                },
                {
                  eyebrow: "Just because",
                  note: "\"Saw your link in the group chat. Had to be part of it.\"",
                  detail: "Michael gifted $25 - invested in Nike - Mar 8, 2024",
                },
              ].map((entry, i) => (
                <FadeIn key={entry.eyebrow} delay={i * 0.08}>
                  <div className="h-full rounded-2xl bg-card p-6 shadow-premium-sm">
                    <p className="mb-3 text-xs font-semibold uppercase tracking-[0.14em] text-primary/80">{entry.eyebrow}</p>
                    <p className="mb-4 text-sm italic leading-relaxed text-foreground">{entry.note}</p>
                    <p className="text-xs text-muted-foreground">{entry.detail}</p>
                  </div>
                </FadeIn>
              ))}
            </div>
          </div>
        </section>

        {/* Product surfaces — bento grid replacing the 3 inline preview
            cards that previously crowded the hero. Stripe's pattern:
            light visual + 1-line outcome + click-to-expand modal that
            doesn't leave the page. For now each tile is a static
            expanded card; the modal interaction is a follow-up. The 6
            surfaces map cleanly to the locked-memory three-surfaces
            model (gifter / parent / kid) with one tile per primary
            surface plus the recurring + at-18 lifecycle anchors. */}
        <ProductBento />

        <section className="py-20 md:py-24">
          <div className={SECTION_MAX}>
            <FadeIn className="mx-auto max-w-3xl text-center">
              <h2 className="mb-6 font-heading text-2xl font-bold tracking-normal text-foreground md:text-4xl">
                Well-intentioned gifts disappear.
              </h2>
              <div className="space-y-2 text-lg leading-relaxed text-muted-foreground">
                <p>The birthday check that sat on the counter for two weeks.</p>
                <p>The savings bond nobody knew how to redeem.</p>
                <p>The $50 that got spent on something forgotten by Tuesday.</p>
              </div>
              <p className="mt-6 text-lg leading-relaxed text-muted-foreground">
                The people who love your child want to do something meaningful. They just do not have an easy way to do it.
              </p>
              <p className="mt-4 font-medium text-foreground">Kiddo is that way.</p>
            </FadeIn>
          </div>
        </section>

        <section className="py-20 md:py-28">
          <div className={SECTION_MAX}>
            <FadeIn className="mb-16 text-center">
              <h2 className="mb-4 font-heading text-2xl font-bold tracking-normal text-foreground md:text-4xl">
                From gift link to invested stock in under 60 seconds.
              </h2>
            </FadeIn>
            <div className="mx-auto grid max-w-5xl gap-6 md:grid-cols-3">
              {[
                {
                  icon: Users,
                  title: "1. You create a fund.",
                  desc: "Set up a fund for your child in 2 minutes. Choose the stocks you want their gifts invested in. Get a private shareable link, QR code, and fund code instantly.",
                },
                {
                  icon: TrendingUp,
                  title: "2. You share the link.",
                  desc: "Send it in a text, an email, or a group chat. Put the QR code on a birthday invitation. Or share the fund code verbally. Anyone can gift in 60 seconds. No account required.",
                },
                {
                  icon: Shield,
                  title: "3. Every gift goes to their fund.",
                  desc: "Every gift follows the path you choose for your child's fund. Kiddo keeps the money movement clear and the gift experience simple.",
                },
              ].map((item, index) => (
                <FadeIn key={item.title} delay={index * 0.08}>
                  <div className="h-full rounded-2xl bg-card p-7 shadow-premium-sm">
                    <div className="mb-5 flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10">
                      <item.icon className="h-6 w-6 text-primary" />
                    </div>
                    <h3 className="mb-2 font-heading text-lg font-semibold text-foreground">{item.title}</h3>
                    <p className="text-sm leading-relaxed text-muted-foreground">{item.desc}</p>
                  </div>
                </FadeIn>
              ))}
            </div>
            <FadeIn delay={0.18} className="mt-10 text-center">
              <Link href="/get-started">
                <Button size="lg" className="h-14 px-10 text-base" onClick={() => haptic("medium")}>
                  Start your child&apos;s fund
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              </Link>
            </FadeIn>
          </div>
        </section>

        <section className="py-20 md:py-28">
          <div className={SECTION_MAX}>
            <FadeIn className="mx-auto max-w-5xl rounded-2xl bg-card p-8 shadow-premium-sm md:p-12">
              <div className="grid items-center gap-8 md:grid-cols-2">
                <div>
                  <h2 className="mb-4 font-heading text-2xl font-bold tracking-normal text-foreground md:text-4xl">
                    Your family can send a gift that lasts in 60 seconds.
                  </h2>
                  <p className="mb-4 leading-relaxed text-muted-foreground">
                    No app. No account. No knowledge of investing required.
                  </p>
                  <p className="leading-relaxed text-muted-foreground">
                    Just a tap, a payment, and a gift that actually grows.
                  </p>
                </div>
                <div className="rounded-2xl border border-border bg-muted/30 p-6">
                  <p className="mb-2 text-sm font-medium text-foreground">Gift preview</p>
                  <p className="text-lg font-semibold text-foreground">Your $50 is now invested in Emma&apos;s future with Kiddo.</p>
                  <p className="mt-2 text-sm text-muted-foreground">
                    Gift page. Amount. Note. Apple Pay. A confirmation that feels like a real gift.
                  </p>
                  <p className="mt-4 text-xs text-muted-foreground">Invested in Emma&apos;s future with Kiddo.</p>
                </div>
              </div>
            </FadeIn>
          </div>
        </section>

        <section className="py-20 md:py-28">
          <div className={SECTION_MAX}>
            <FadeIn className="mx-auto max-w-5xl rounded-2xl bg-card p-8 shadow-premium-sm md:p-12">
              <div className="grid items-center gap-8 md:grid-cols-2">
                <div>
                  <div className="mb-4 inline-flex items-center gap-2 rounded-full bg-primary/10 px-3 py-1 text-xs font-medium text-primary">
                    <BookOpen className="h-3.5 w-3.5" />
                    Kid View
                  </div>
                  <h2 className="mb-4 font-heading text-2xl font-bold tracking-normal text-foreground md:text-4xl">
                    The lesson no classroom teaches.
                  </h2>
                  <p className="mb-4 leading-relaxed text-muted-foreground">
                    When a child watches their own Disney or Apple shares grow, investing stops being abstract. It becomes personal.
                  </p>
                  <p className="mb-4 leading-relaxed text-muted-foreground">
                    Kiddo shows children what they own, explains the companies behind it in plain language, and helps parents turn gifts into real money conversations over time.
                  </p>
                  <p className="font-medium text-foreground">
                    The child who grows up watching a fund grow does not start adulthood from zero.
                  </p>
                  <div className="mt-6">
                    <Link href="/how-it-works">
                      <Button variant="outline">
                        See how the kid view works
                        <ArrowRight className="ml-2 h-4 w-4" />
                      </Button>
                    </Link>
                  </div>
                </div>
                <div className="rounded-2xl border border-border bg-muted/30 p-6">
                  <p className="mb-2 text-sm font-medium text-primary">Kiddo explains</p>
                  <h3 className="font-heading text-xl font-semibold text-foreground">You own a piece of Disney.</h3>
                  <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
                    Disney makes movies, parks, and shows. When Disney does well, your fund can grow too. That is what owning a stock means.
                  </p>
                  <div className="mt-5 space-y-2 text-sm text-muted-foreground">
                    <p>Ages 5 to 8: wonder and recognition</p>
                    <p>Ages 9 to 13: simple investing explanations</p>
                    <p>Ages 14 to 17: real participation and stock suggestions</p>
                  </div>
                </div>
              </div>
            </FadeIn>
          </div>
        </section>

        {/* The Memory Book emotional section moved 2026-05-25 from
            position 9 (deep in the page) to position 4 (right after
            SignatureTrustCounter, before ProductBento). Per the copy
            specialist audit: the load-bearing emotional beat ("proof
            that people loved them") was buried at paragraph 15 — a
            parent scanning for 20 seconds would never reach it. The
            relocated section now lands the emotional promise BEFORE
            asking the parent to evaluate features. See the new
            section in this file for the actual implementation. */}

        <section className="py-20 md:py-28">
          <div className={SECTION_MAX}>
            <FadeIn className="mb-14 text-center">
              <h2 className="mb-4 font-heading text-2xl font-bold tracking-normal text-foreground md:text-4xl">
                What parents say after the first few gifts arrive.
              </h2>
              <p className="mx-auto max-w-2xl text-muted-foreground">
                The pattern is the same: once family sees the link, the product clicks immediately.
              </p>
            </FadeIn>
            <div className="mx-auto grid max-w-5xl gap-6 md:grid-cols-3">
              {testimonials.map((item, index) => (
                <FadeIn key={item.attribution} delay={index * 0.08}>
                  <div className="h-full rounded-2xl bg-card p-7 shadow-premium-sm">
                    <p className="mb-4 leading-relaxed text-foreground">&quot;{item.quote}&quot;</p>
                    <p className="text-sm text-muted-foreground">{item.attribution}</p>
                  </div>
                </FadeIn>
              ))}
            </div>
          </div>
        </section>

        <section className="py-20 md:py-28">
          <div className={SECTION_MAX}>
            <FadeIn className="mx-auto max-w-5xl rounded-2xl bg-card p-8 shadow-premium-sm md:p-12">
              <div className="grid items-center gap-8 md:grid-cols-2">
                <div>
                  <h2 className="mt-4 font-heading text-2xl font-bold tracking-normal text-foreground md:text-4xl">
                    One day they open the account and see who showed up for them.
                  </h2>
                  <p className="mt-4 leading-relaxed text-muted-foreground">
                    The gifts matter. The investing matters. But the story matters too.
                  </p>
                  <p className="mt-4 leading-relaxed text-muted-foreground">
                    At 16, you start the conversation. At 17, you can preview the Memory Book together. At 18, the fund becomes theirs with context, not confusion.
                  </p>
                  <p className="mt-4 font-medium text-foreground">
                    Kiddo is built so the transfer feels like an inheritance of love, not a surprise paperwork event.
                  </p>
                  <div className="mt-6">
                    <Link href="/age-18">
                      <Button variant="outline">
                        See how the age-18 transition works
                        <ArrowRight className="ml-2 h-4 w-4" />
                      </Button>
                    </Link>
                  </div>
                </div>
                <div className="rounded-2xl border border-border bg-muted/30 p-6">
                  <p className="text-sm font-medium text-primary">Age-18 moment</p>
                  <h3 className="mt-2 font-heading text-xl font-semibold text-foreground">
                    Not just &quot;here&apos;s your balance.&quot;
                  </h3>
                  <div className="mt-4 space-y-3 text-sm leading-7 text-muted-foreground">
                    <p>Every gift note is still there.</p>
                    <p>Every family milestone still means something.</p>
                    <p>The account arrives with a story, not just a statement.</p>
                  </div>
                </div>
              </div>
            </FadeIn>
          </div>
        </section>

        <section className="py-20 md:py-28">
          <div className={SECTION_MAX}>
            <FadeIn className="mb-14 text-center">
              <h2 className="mb-4 font-heading text-2xl font-bold tracking-normal text-foreground md:text-4xl">
                Why not just use a savings account?
              </h2>
            </FadeIn>
            <FadeIn delay={0.08} className="mx-auto max-w-5xl overflow-hidden rounded-2xl border border-border bg-card shadow-premium-sm">
              <div className="grid grid-cols-4 border-b border-border bg-muted/20 text-sm font-medium text-foreground">
                <div className="p-4"></div>
                <div className="p-4">Savings account</div>
                <div className="p-4">529 plan</div>
                <div className="p-4">Kiddo</div>
              </div>
              {comparisonRows.map((row) => (
                <div key={row.label} className="grid grid-cols-4 border-b border-border text-sm last:border-b-0">
                  <div className="p-4 font-medium text-foreground">{row.label}</div>
                  <div className="p-4 text-muted-foreground">{row.savings}</div>
                  <div className="p-4 text-muted-foreground">{row.plan529}</div>
                  <div className="p-4 text-muted-foreground">{row.kora}</div>
                </div>
              ))}
            </FadeIn>
            <FadeIn delay={0.12} className="mt-6 text-center">
              <Link href="/compare" className="text-sm font-medium text-primary hover:underline">
                See how Kiddo compares to EarlyBird, Greenlight, 529s, and more
              </Link>
            </FadeIn>
          </div>
        </section>

        <section className="py-20 md:py-28">
          <div className={SECTION_MAX}>
            <FadeIn className="mx-auto max-w-3xl text-center">
              <h2 className="mb-4 font-heading text-2xl font-bold tracking-normal text-foreground md:text-4xl">
                Your child&apos;s money is in safe hands.
              </h2>
              <div className="space-y-2 text-muted-foreground">
                <p>When investing is live, securities are held by our broker-dealer partner (Member FINRA/SIPC), not by Kiddo.</p>
                <p>Once accounts are open, eligible securities carry SIPC protection up to $500,000 against broker-dealer failure, not market loss.</p>
                <p>Encrypted in transit and at rest.</p>
                <p>Private fund links. Not searchable. Not public.</p>
                <p>Fees shown in full before every checkout.</p>
              </div>
              <div className="mt-8">
                <TrustMicroStrip />
              </div>
              <div className="mt-5 flex flex-wrap justify-center gap-4 text-sm text-muted-foreground">
                <Link href="/security" className="transition-colors hover:text-foreground">How we protect your child&apos;s fund</Link>
              </div>
            </FadeIn>
          </div>
        </section>

        {/* Locked refusals — the trust-by-saying-no panel, sitting
            between the operational-trust section above ("safe hands /
            SIPC / encryption") and the final conversion CTA below.
            The visitor reads: PROTECTION → CATEGORY POSITIONING →
            ACTION. The refusals are what separates Kiddo from the
            broader gamified-fintech category in the visitor's head
            BEFORE they hit "Start your child's fund." Locked
            2026-05-21; copy lives in LockedRefusalsPanel.tsx so
            /demo and / stay in lockstep. */}
        <section className="py-12 md:py-16">
          <div className={SECTION_MAX}>
            <FadeIn>
              <LockedRefusalsPanel variant="marketing" />
            </FadeIn>
          </div>
        </section>

        <section className="py-20 md:py-28">
          <div className={SECTION_MAX}>
            <FadeIn className="mx-auto max-w-2xl text-center">
              <h2 className="mb-6 font-heading text-2xl font-bold tracking-normal text-foreground md:text-4xl">
                Start your child&apos;s fund today.
              </h2>
              <p className="mb-8 text-muted-foreground">
                Free to start. Takes 2 minutes. Your family and friends can begin gifting immediately.
              </p>
              <div className="flex flex-col justify-center gap-4 sm:flex-row">
                <Link href="/get-started">
                  <Button size="lg" className="h-14 px-10 text-base" data-testid="button-cta-get-started" onClick={() => haptic("medium")}>
                    Start your child&apos;s fund
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </Button>
                </Link>
                <Link href="/faq">
                  <Button variant="outline" size="lg" className="h-14 px-10 text-base" data-testid="button-cta-read-faq">
                    Read our FAQ
                  </Button>
                </Link>
              </div>
            </FadeIn>
          </div>
        </section>

        <Footer />
      </main>
    </div>
  );
}
