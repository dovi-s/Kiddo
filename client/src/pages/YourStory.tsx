// Year-by-year retrospective for the kid at the at-18 reveal moment.
// Linked from the at-18 welcome banner on Dashboard. Owner-gated route
// (kid IS the owner post-claim). Renders a vertical scroll of year cards
// from year 1 → current age, with gifts + memories aggregated per year.
//
// Empty years are skipped server-side, so a fund created when the kid was
// 12 won't pad the timeline with 11 empty year cards. The sealed letter
// (when present and the kid is at majority) renders as the final emotional
// capstone — same treatment as the claim page and Kid View.

import { useMemo } from "react";
import { Link, useParams } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { ArrowLeft, BookOpen, Gift, Users } from "lucide-react";
import { Logo } from "@/components/ui/logo";
import { capFirst } from "@/lib/format-name";

type YourStoryYear = {
  year: number;
  ageLabel: string;
  totalReceived: string;
  giftCount: number;
  contributorCount: number;
  firstGift: {
    senderName: string;
    amount: number;
    message: string | null;
    eventName: string | null;
    createdAt: string;
  } | null;
  largestGift: {
    senderName: string;
    amount: number;
    message: string | null;
    eventName: string | null;
    createdAt: string;
  } | null;
  memories: Array<{
    id: string;
    content: string | null;
    authorName: string | null;
    createdAt: string;
    visibility: string;
  }>;
};

type YourStoryPayload = {
  fund: {
    id: string;
    recipientFirstName: string | null;
    recipientBirthdate: string;
    balance: string;
  };
  majorityAge: number;
  currentAge: number;
  currentPhase: "child" | "teen" | "adult" | "unknown";
  years: YourStoryYear[];
  sealedLetter: {
    content: string | null;
    authorName: string | null;
    createdAt: string;
  } | null;
};

function formatMoney(value: string | number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(Number(value || 0));
}

function formatMonth(date: string | Date) {
  const d = date instanceof Date ? date : new Date(date);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleDateString("en-US", { month: "short", year: "numeric" });
}

function SkeletonBar({ className = "" }: { className?: string }) {
  return <div className={`rounded-md bg-muted ${className}`} />;
}

// Structure-matching skeleton so the (data-fetched) page feels like it's
// loading content, not hanging. Pure CSS pulse — no framer-motion, to keep
// the load cheap. Mirrors the hero + first few year cards.
function StorySkeleton() {
  return (
    <div role="status" aria-busy="true">
      <span className="sr-only">Loading your story…</span>
      <div className="space-y-6 animate-pulse" aria-hidden="true">
        <div className="rounded-3xl border border-border/50 p-8">
          <SkeletonBar className="h-2.5 w-20" />
          <SkeletonBar className="mt-4 h-8 w-3/4" />
          <SkeletonBar className="mt-2 h-8 w-1/2" />
          <SkeletonBar className="mt-5 h-4 w-full max-w-xl" />
          <SkeletonBar className="mt-2 h-4 w-2/3 max-w-xl" />
        </div>
        <div className="space-y-5">
          {[0, 1, 2].map((i) => (
            <div key={i} className="rounded-3xl border border-border/50 bg-card p-6">
              <div className="flex items-center justify-between border-b border-border/40 pb-3">
                <SkeletonBar className="h-2.5 w-24" />
                <SkeletonBar className="h-2.5 w-32" />
              </div>
              <div className="mt-4 flex items-start gap-3">
                <SkeletonBar className="mt-0.5 h-4 w-4 shrink-0 rounded-full" />
                <SkeletonBar className="h-4 w-1/2" />
              </div>
              <div className="mt-3 rounded-2xl bg-muted/30 p-3">
                <SkeletonBar className="h-3 w-3/4" />
                <SkeletonBar className="mt-2 h-2.5 w-1/3" />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export default function YourStory() {
  const { fundId } = useParams<{ fundId: string }>();

  const { data, isLoading, isError } = useQuery<YourStoryPayload>({
    queryKey: ["your-story", fundId],
    queryFn: async () => {
      const res = await fetch(`/api/funds/${fundId}/your-story`, { credentials: "include" });
      if (!res.ok) throw new Error("Could not load your story");
      return res.json();
    },
    enabled: !!fundId,
  });

  const childFirst = capFirst(data?.fund.recipientFirstName) || "";
  const ownerName = useMemo(() => childFirst || "you", [childFirst]);

  return (
    <div className="min-h-screen bg-background gemini-warm-section">
      <header className="sticky top-0 z-40 border-b border-border/40 bg-background/85 backdrop-blur-lg">
        <div className="mx-auto flex h-14 max-w-4xl items-center justify-between px-4">
          <Link href="/dashboard">
            <button className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors">
              <ArrowLeft size={14} />
              Back to dashboard
            </button>
          </Link>
          <Logo size="md" className="text-foreground" />
        </div>
      </header>

      <main className="mx-auto max-w-4xl space-y-6 px-4 py-8 md:py-12">
        {isLoading && <StorySkeleton />}

        {isError && (
          <p className="text-center text-sm text-destructive">
            Could not load this story. Try again in a moment.
          </p>
        )}

        {data && (
          <>
            <motion.section
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              className="rounded-3xl border p-8 shadow-premium-sm"
              style={{
                borderColor: "hsl(var(--kiddo-gold) / 0.40)",
                background:
                  "linear-gradient(135deg, hsl(var(--kiddo-cream)) 0%, #fff 60%, hsl(var(--kiddo-gold) / 0.10) 100%)",
              }}
            >
              <p
                className="text-[10px] font-bold uppercase mb-2"
                style={{ color: "hsl(var(--kiddo-gold-ink) / 0.85)", letterSpacing: "0.14em" }}
              >
                Your story
              </p>
              <h1 className="font-heading text-3xl font-semibold text-foreground md:text-4xl">
                {childFirst ? <>This is what they built for you, {childFirst}.</> : <>This is what they built for you.</>}
              </h1>
              <p className="mt-4 max-w-xl text-sm leading-relaxed text-muted-foreground">
                Every gift. Every note. Year by year. Scroll through to see the people who showed up over time — and what they wrote when they did.
              </p>
            </motion.section>

            {data.years.length === 0 && (
              <p className="rounded-2xl border border-border/50 bg-card p-6 text-center text-sm text-muted-foreground">
                The fund hasn't received any gifts yet. As they come in, they'll show up here grouped by year.
              </p>
            )}

            <div className="space-y-5">
              {data.years.map((year) => (
                <section
                  key={year.year}
                  className="rounded-3xl border border-border/50 bg-card p-6 shadow-premium-sm"
                >
                  {/* Year kicker — anchors the timeline visually so the scroll
                      reads as "ah, year 4 was a big year" at a glance. */}
                  <div className="flex items-baseline justify-between gap-3 border-b border-border/40 pb-3">
                    <p
                      className="text-[10px] font-bold uppercase"
                      style={{ color: "hsl(var(--kiddo-gold-ink) / 0.85)", letterSpacing: "0.14em" }}
                    >
                      {year.ageLabel}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {formatMoney(year.totalReceived)} · {year.giftCount} {year.giftCount === 1 ? "gift" : "gifts"} · {year.contributorCount} {year.contributorCount === 1 ? "person" : "people"}
                    </p>
                  </div>

                  {/* First gift of the year — the warm "this is when N showed up" moment */}
                  {year.firstGift && (
                    <div className="mt-4 flex items-start gap-3">
                      <Gift size={16} className="mt-1 shrink-0 text-primary" />
                      <div className="min-w-0 flex-1">
                        <p className="text-sm text-foreground">
                          <span className="font-semibold">{year.firstGift.senderName}</span> gave{" "}
                          <span className="font-semibold">{formatMoney(year.firstGift.amount)}</span>
                          <span className="text-muted-foreground"> · {formatMonth(year.firstGift.createdAt)}</span>
                        </p>
                        {year.firstGift.message && (
                          <p className="mt-1 font-serif text-sm italic text-foreground/85">
                            &ldquo;{year.firstGift.message}&rdquo;
                          </p>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Largest gift of the year — only when distinct from the first
                      gift, so we don't repeat the same row twice. */}
                  {year.largestGift &&
                    year.firstGift &&
                    year.largestGift.createdAt !== year.firstGift.createdAt && (
                      <div className="mt-3 flex items-start gap-3">
                        <Users size={16} className="mt-1 shrink-0 text-primary" />
                        <div className="min-w-0 flex-1">
                          <p className="text-sm text-foreground">
                            Biggest gift this year: <span className="font-semibold">{year.largestGift.senderName}</span>{" "}
                            · <span className="font-semibold">{formatMoney(year.largestGift.amount)}</span>
                            <span className="text-muted-foreground"> · {formatMonth(year.largestGift.createdAt)}</span>
                          </p>
                          {year.largestGift.message && (
                            <p className="mt-1 font-serif text-sm italic text-foreground/85">
                              &ldquo;{year.largestGift.message}&rdquo;
                            </p>
                          )}
                        </div>
                      </div>
                    )}

                  {/* Memory entries from this year — surfaced because they're
                      what the kid actually wants to read. Capped at first 4
                      to keep the year card scannable; the full Memory Book
                      link below carries the rest. */}
                  {year.memories.length > 0 && (
                    <div className="mt-4 space-y-2">
                      <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                        Notes from this year
                      </p>
                      {year.memories.slice(0, 4).map((m) => (
                        <div key={m.id} className="rounded-2xl bg-muted/30 p-3">
                          <div className="flex items-start gap-2">
                            <BookOpen size={12} className="mt-1 shrink-0 text-muted-foreground" />
                            <div className="min-w-0 flex-1">
                              {m.content ? (
                                <p className="font-serif text-sm italic text-foreground">
                                  &ldquo;{m.content}&rdquo;
                                </p>
                              ) : (
                                <p className="text-xs text-muted-foreground">A memory was added.</p>
                              )}
                              <p className="mt-1 text-[11px] text-muted-foreground">
                                {m.authorName || "Someone"} · {formatMonth(m.createdAt)}
                              </p>
                            </div>
                          </div>
                        </div>
                      ))}
                      {year.memories.length > 4 && (
                        <Link
                          href={`/memory/${data.fund.id}`}
                          className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
                        >
                          + {year.memories.length - 4} more in the Memory Book
                        </Link>
                      )}
                    </div>
                  )}
                </section>
              ))}
            </div>

            {/* Sealed letter as the final emotional capstone — only when the
                kid is at majority age (server gates this). Wax-seal styling
                consistent with the claim page and Kid View ceremony. */}
            {data.sealedLetter && (
              <motion.section
                initial={{ opacity: 0, y: 14 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.18, duration: 0.45 }}
                className="relative rounded-3xl border p-8 shadow-premium-sm"
                style={{
                  borderColor: "rgba(140,30,30,0.32)",
                  background:
                    "linear-gradient(135deg, hsl(var(--kiddo-cream)) 0%, #fff 60%, rgba(140,30,30,0.04) 100%)",
                }}
              >
                <p
                  className="text-xs font-semibold uppercase mb-2"
                  style={{ color: "rgba(140,30,30,0.85)", letterSpacing: "0.14em" }}
                >
                  And finally
                </p>
                <p className="font-heading text-xl font-bold text-foreground leading-snug mb-5">
                  {data.sealedLetter.authorName || "Your parent"} wrote this for you to read.
                </p>
                <p className="font-serif text-lg leading-relaxed text-foreground italic">
                  &ldquo;{data.sealedLetter.content}&rdquo;
                </p>
                <p className="mt-6 text-xs text-muted-foreground">
                  With love, {data.sealedLetter.authorName || "your parent"}
                </p>
              </motion.section>
            )}

            <p className="pt-4 text-center font-serif italic text-foreground/85">
              That's {ownerName === "you" ? "the whole story" : `${ownerName}'s story`} so far.
            </p>

            {/* Agency forward-beat for the post-handoff ADULT OWNER only
                (currentPhase === "adult"). Deliberately NOT a price pitch: the
                parent-letter climax above stays pure (selling on grief is the
                trap). This is a calm "this is yours to keep building" that echoes
                the generational seed from the Age18Welcome handoff close, with a
                quiet link to the dashboard, where the real build-mode + Plus
                prompts live. Hidden for child/teen viewers (they don't own it
                yet) and for the kid-at-18 preview. */}
            {data.currentPhase === "adult" && (
              <div className="pt-8 text-center">
                <p className="mx-auto max-w-md font-serif italic leading-relaxed text-foreground/70">
                  And it doesn't have to end here. This is yours now: keep adding to it, and one day start one for someone whose future you want to show up for.
                </p>
                <Link
                  href={`/dashboard?fund=${data.fund.id}`}
                  className="mt-4 inline-flex items-center gap-1.5 text-sm font-semibold text-[hsl(var(--kiddo-evergreen))] hover:opacity-75"
                  data-testid="link-your-story-keep-building"
                >
                  Keep building it →
                </Link>
              </div>
            )}
          </>
        )}
      </main>
    </div>
  );
}
