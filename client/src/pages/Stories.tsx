import { useSearch } from "wouter";
import { motion } from "framer-motion";
import { Link } from "wouter";
import { ArrowRight, Quote } from "lucide-react";
import { ProductFrame } from "@/components/marketing/ProductFrame";
import { Nav } from "@/components/layout/Nav";
import { Footer } from "@/components/layout/Footer";
import { storyEntries } from "@/lib/content";
import { Button } from "@/components/ui/button";
import { buildTrackedGetStartedHref, trackReferralEvent } from "@/lib/acquisition";
import { usePageSeo } from "@/lib/seo";

export default function Stories() {
  const search = useSearch();
  const startHref = buildTrackedGetStartedHref(search, { ref: "stories:index", src: "stories_index" });

  usePageSeo({
    title: "Kiddo Stories | How families use Kiddo to make gifts last",
    description: "Stories of how Kiddo families turn birthdays, baby showers, and holidays into real investments for their children.",
    ogType: "website",
  });

  return (
    <div className="min-h-screen bg-background">
      <Nav />

      <section className="pt-24 pb-16 md:pt-32 md:pb-20">
        <div className="mx-auto max-w-6xl px-4">
          <div className="mx-auto max-w-3xl text-center">
            {/* Headline + subhead softened 2026-05-25 audit. Previous
                copy ("Real families. Real funds. Real growth." + "Every
                story here is a real family using Kiddo...") made a
                verified-customer claim, but the underlying story files
                (emma-birthday-fund.md, noah-baby-shower-fund.md) carry
                explicit "needs verified customer details before wider
                promotion" notes. Pre-launch, asserting these are
                real-customer stories without that verification creates
                FTC-side and trust risk. New copy frames them as the
                kind of story Kiddo is built for, without claiming any
                specific story is a verified customer. When real
                customer stories ship (with verified quotes + permission),
                the page copy can return to the stronger framing. */}
            <p className="text-sm font-semibold uppercase tracking-[0.2em] text-primary">Stories</p>
            <h1 className="mt-4 font-heading text-4xl font-bold tracking-tight text-foreground md:text-6xl">
              The kinds of stories Kiddo is built for.
            </h1>
            <p className="mt-6 text-lg leading-relaxed text-muted-foreground">
              Examples of how families turn everyday occasions into something that lasts. As Kiddo families share their own, real stories will live here too.
            </p>
          </div>
        </div>
      </section>

      <section className="pb-14 md:pb-16">
        <div className="mx-auto max-w-6xl px-4">
          <ProductFrame
            src="/product/memory-full.webp"
            alt="A family's Memory Book: the occasions, who gave, and every gift with its note, scrolling through the whole story."
            caption="Every story becomes a Memory Book."
            mode="scroll"
            imgHeight={3762}
            href="/demo"
            liveLabel="See it live"
          />
        </div>
      </section>

      <section className="pb-20 md:pb-24">
        <div className="mx-auto max-w-6xl px-4">
          <div className="grid gap-6 md:grid-cols-2">
            {storyEntries.map((story, index) => (
              <motion.article
                key={story.slug}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: "-50px" }}
                transition={{ duration: 0.45, delay: index * 0.05 }}
                className="rounded-[32px] border border-border bg-card p-7 shadow-premium-sm"
              >
                <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                  <span className="rounded-full bg-primary/10 px-2.5 py-1 text-primary">{story.occasion || story.category}</span>
                  {/* Honesty: these are illustrative launch examples, not real
                      customer stories — label each card so a quoted, named story
                      never reads as a testimonial (the footer alone isn't enough). */}
                  <span className="rounded-full bg-muted px-2.5 py-1 font-medium">Illustrative example</span>
                  <span>{story.publishedAt}</span>
                </div>
                <h2 className="mt-5 font-heading text-3xl font-semibold text-foreground">{story.title}</h2>
                <p className="mt-4 text-base leading-7 text-muted-foreground">{story.description}</p>
                {story.heroNote ? (
                  <div className="mt-5 rounded-2xl bg-muted/40 p-4 text-sm text-muted-foreground">
                    {story.heroNote}
                  </div>
                ) : null}
                <Link
                  href={`/stories/${story.slug}`}
                  onClick={() =>
                    trackReferralEvent({
                      refCode: `story:${story.slug}`,
                      action: "cta_click",
                      channel: "stories_index",
                      metadata: { destination: "story_page" },
                    })
                  }
                  className="mt-6 inline-flex items-center gap-2 text-sm font-medium text-primary hover:underline"
                  aria-label={`Read story: ${story.title}`}
                >
                  Read story
                  <ArrowRight className="h-4 w-4" aria-hidden="true" />
                </Link>
              </motion.article>
            ))}
          </div>
        </div>
      </section>

      <section className="pb-20 md:pb-28">
        <div className="mx-auto max-w-4xl px-4">
          <div className="rounded-3xl border border-border bg-card p-8 text-center shadow-premium-sm md:p-12">
            <div className="inline-flex items-center gap-2 rounded-full bg-primary/10 px-4 py-2 text-sm font-medium text-primary">
              <Quote className="h-4 w-4" />
              Stories become proof when families share them
            </div>
            <h2 className="mt-6 font-heading text-3xl font-bold tracking-tight text-foreground md:text-4xl">
              Is your family using Kiddo?
            </h2>
            <p className="mx-auto mt-4 max-w-2xl text-muted-foreground">
              Every family that shares helps another family see that gifts can become something lasting.
            </p>
            <div className="mt-8 flex flex-col justify-center gap-4 sm:flex-row">
              <a
                href={startHref}
                onClick={() =>
                  trackReferralEvent({
                    refCode: "stories:index",
                    action: "cta_click",
                    channel: "stories_index",
                    metadata: { destination: "get_started" },
                  })
                }
              >
                <Button size="lg" data-testid="button-stories-cta-primary">Start your child&apos;s fund</Button>
              </a>
              <Link href="/contact">
                <Button variant="outline" size="lg" data-testid="button-stories-cta-secondary">Share your story</Button>
              </Link>
            </div>
          </div>
        </div>
      </section>

      <Footer />
    </div>
  );
}
