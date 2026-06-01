import { useEffect } from "react";
import { Link, useParams, useSearch } from "wouter";
import { ArrowLeft, ArrowRight, Heart } from "lucide-react";
import { Nav } from "@/components/layout/Nav";
import { Footer } from "@/components/layout/Footer";
import { MarkdownContent } from "@/components/content/MarkdownContent";
import { getStoryEntry, storyEntries } from "@/lib/content";
import { Button } from "@/components/ui/button";
import { buildTrackedGetStartedHref, trackReferralEvent } from "@/lib/acquisition";
import { usePageSeo } from "@/lib/seo";
import NotFound from "@/pages/not-found";

export default function StoryPage() {
  const { slug } = useParams<{ slug: string }>();
  const search = useSearch();
  const story = getStoryEntry(String(slug || ""));

  useEffect(() => {
    if (!story) return;
    trackReferralEvent({
      refCode: `story:${story.slug}`,
      action: "visit",
      channel: "story_page",
      metadata: { category: story.category, tags: story.tags, occasion: story.occasion },
    });
  }, [story]);

  if (!story) return <NotFound />;

  const startHref = buildTrackedGetStartedHref(search, { ref: `story:${story.slug}`, src: `story_${story.slug}` });
  const otherStories = storyEntries.filter((entry) => entry.slug !== story.slug).slice(0, 2);

  usePageSeo({
    title: `${story.title} | Kiddo Stories`,
    description: story.description,
  });

  return (
    <div className="min-h-screen bg-background">
      <Nav />

      <article className="pt-24 pb-20 md:pt-32 md:pb-28">
        <div className="max-w-4xl mx-auto px-4">
          <Link href="/stories" className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground">
            <ArrowLeft className="h-4 w-4" />
            Back to stories
          </Link>

          <div className="mt-8 rounded-[32px] border border-border bg-card p-8 md:p-12 shadow-premium-sm">
            <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
              <span className="rounded-full bg-primary/10 px-2.5 py-1 text-primary">{story.occasion || story.category}</span>
              <span>{story.publishedAt}</span>
            </div>
            <h1 className="font-heading text-4xl md:text-5xl font-bold tracking-tight text-foreground mt-6">
              {story.title}
            </h1>
            <p className="text-lg leading-8 text-muted-foreground mt-5">{story.description}</p>
            {story.heroNote ? (
              <div className="rounded-2xl bg-primary/5 px-5 py-4 text-sm text-muted-foreground mt-6">
                {story.heroNote}
              </div>
            ) : null}

            <div className="mt-10">
              <MarkdownContent body={story.body} />
            </div>

            <div className="rounded-3xl border border-border bg-muted/20 p-6 md:p-8 mt-10">
              <div className="inline-flex items-center gap-2 rounded-full bg-primary/10 px-4 py-2 text-sm font-medium text-primary">
                <Heart className="h-4 w-4" />
                Start with the fund, then let the story become real
              </div>
              <p className="text-muted-foreground mt-4">
                The strongest version of this page is the one your family builds over time, from the gifts, notes, and occasions you add along the way.
              </p>
              <div className="flex flex-col sm:flex-row gap-4 mt-6">
                <a
                  href={startHref}
                  onClick={() =>
                    trackReferralEvent({
                      refCode: `story:${story.slug}`,
                      action: "cta_click",
                      channel: "story_page",
                      metadata: { destination: "get_started" },
                    })
                  }
                >
                  <Button data-testid="button-story-primary">{story.ctaLabel || "Start your child's fund"}</Button>
                </a>
                <Link href="/how-it-works">
                  <Button variant="outline" data-testid="button-story-secondary">See how it works</Button>
                </Link>
              </div>
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-2 mt-12">
            {otherStories.map((entry) => (
              <Link key={entry.slug} href={`/stories/${entry.slug}`} className="rounded-2xl border border-border bg-card p-5 shadow-premium-sm hover:border-primary/30">
                <p className="text-xs text-primary font-medium">{entry.occasion || entry.category}</p>
                <h3 className="font-heading text-xl font-semibold text-foreground mt-3">{entry.title}</h3>
                <p className="text-sm text-muted-foreground mt-2">{entry.description}</p>
                <span className="inline-flex items-center gap-2 text-sm text-primary mt-4">
                  Read story
                  <ArrowRight className="h-4 w-4" />
                </span>
              </Link>
            ))}
          </div>
        </div>
      </article>

      <Footer />
    </div>
  );
}
