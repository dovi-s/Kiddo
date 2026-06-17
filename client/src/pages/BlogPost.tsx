import { useEffect, useMemo } from "react";
import { Link, useParams, useSearch } from "wouter";
import { ArrowLeft, ArrowRight } from "lucide-react";
import { Nav } from "@/components/layout/Nav";
import { Footer } from "@/components/layout/Footer";
import { MarkdownContent } from "@/components/content/MarkdownContent";
import { blogPosts, getBlogPost } from "@/lib/content";
import { Button } from "@/components/ui/button";
import { buildTrackedGetStartedHref, trackReferralEvent } from "@/lib/acquisition";
import { usePageSeo } from "@/lib/seo";
import { JsonLd } from "@/components/JsonLd";
import NotFound from "@/pages/not-found";

export default function BlogPost() {
  const { slug } = useParams<{ slug: string }>();
  const search = useSearch();
  const post = getBlogPost(String(slug || ""));

  useEffect(() => {
    if (!post) return;
    trackReferralEvent({
      refCode: `blog:${post.slug}`,
      action: "visit",
      channel: "blog_post",
      metadata: { category: post.category, tags: post.tags },
    });
  }, [post]);

  if (!post) return <NotFound />;

  const startHref = buildTrackedGetStartedHref(search, { ref: `blog:${post.slug}`, src: `blog_${post.slug}` });
  const primaryHref = post.ctaHref || "/get-started";
  const resolvedPrimaryHref = primaryHref === "/get-started" ? startHref : primaryHref;
  // Always keep the signup path reachable: when the primary CTA points somewhere
  // educational (how-it-works / pricing / faq), the secondary is "Start your
  // child's fund". Only when the primary IS get-started does the secondary fall
  // back to pricing. Fixes the leak where /how-it-works posts never offered signup.
  const secondaryCta =
    primaryHref === "/get-started"
      ? { href: "/pricing", label: "See pricing", destination: "pricing" }
      : { href: startHref, label: "Start your child's fund", destination: "get_started" };
  const relatedPosts = blogPosts.filter((entry) => entry.slug !== post.slug).slice(0, 3);

  usePageSeo({
    title: `${post.title} | Kiddo`,
    description: post.description,
  });

  // Article structured data so blog posts can earn article rich results.
  const articleJsonLd = useMemo(
    () => ({
      "@context": "https://schema.org",
      "@type": "BlogPosting",
      headline: post.title,
      description: post.description,
      ...(post.publishedAt ? { datePublished: post.publishedAt } : {}),
      author: { "@type": "Organization", name: "Kiddo" },
      publisher: { "@type": "Organization", name: "Kiddo" },
    }),
    [post.title, post.description, post.publishedAt],
  );

  return (
    <div className="min-h-screen bg-background">
      <JsonLd data={articleJsonLd} id="blogpost-jsonld" />
      <Nav />

      <article className="pt-24 pb-20 md:pt-32 md:pb-28">
        <div className="max-w-4xl mx-auto px-4">
          <Link href="/blog" className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground">
            <ArrowLeft className="h-4 w-4" />
            Back to blog
          </Link>

          <div className="mt-8 rounded-[32px] border border-border bg-card p-8 md:p-12 shadow-premium-sm">
            <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
              <span className="rounded-full bg-primary/10 px-2.5 py-1 text-primary">{post.eyebrow || post.category}</span>
              <span>{post.publishedAt}</span>
              {post.readTime ? <span>{post.readTime}</span> : null}
            </div>
            <h1 className="font-heading text-4xl md:text-5xl font-bold tracking-tight text-foreground mt-6">
              {post.title}
            </h1>
            <p className="text-lg leading-8 text-muted-foreground mt-5">{post.description}</p>
            {post.heroNote ? (
              <div className="rounded-2xl bg-primary/5 px-5 py-4 text-sm text-muted-foreground mt-6">
                {post.heroNote}
              </div>
            ) : null}

            <div className="mt-6 rounded-3xl border border-border bg-muted/20 p-6 md:p-8">
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-primary">Make this useful now</p>
              <h2 className="mt-3 font-heading text-2xl font-semibold text-foreground">
                Read it now. Set it up before the next occasion.
              </h2>
              <p className="mt-3 max-w-2xl text-sm leading-7 text-muted-foreground">
                Most families do not need more theory. They need the link ready before the birthday, baby shower, holiday, or graduation actually arrives.
              </p>
              <div className="mt-5 flex flex-col gap-4 sm:flex-row">
                <a
                  href={resolvedPrimaryHref}
                  onClick={() =>
                    trackReferralEvent({
                      refCode: `blog:${post.slug}`,
                      action: "cta_click",
                      channel: "blog_post",
                      metadata: { destination: primaryHref.replace(/^\//, "") || "get_started", cta: "hero_inline" },
                    })
                  }
                >
                  <Button data-testid="button-blog-post-top-primary">
                    {post.ctaLabel || "Start your child's fund"}
                  </Button>
                </a>
                <Link
                  href="/pricing"
                  onClick={() =>
                    trackReferralEvent({
                      refCode: `blog:${post.slug}`,
                      action: "cta_click",
                      channel: "blog_post",
                      metadata: { destination: "pricing", cta: "hero_inline_secondary" },
                    })
                  }
                >
                  <Button variant="outline" data-testid="button-blog-post-top-secondary">See pricing</Button>
                </Link>
              </div>
            </div>

            <div className="mt-10">
              <MarkdownContent body={post.body} />
            </div>

            <div className="rounded-3xl border border-border bg-muted/20 p-6 md:p-8 mt-10">
              <h2 className="font-heading text-2xl font-semibold text-foreground">Next step</h2>
              <p className="text-muted-foreground mt-3">
                When the next occasion comes around, the easiest time to set this up is before you need it.
              </p>
              <div className="flex flex-col sm:flex-row gap-4 mt-6">
                <a
                  href={resolvedPrimaryHref}
                  onClick={() =>
                    trackReferralEvent({
                      refCode: `blog:${post.slug}`,
                      action: "cta_click",
                      channel: "blog_post",
                      metadata: { destination: primaryHref.replace(/^\//, "") || "get_started" },
                    })
                  }
                >
                  <Button data-testid="button-blog-post-primary">{post.ctaLabel || "Start your child's fund"}</Button>
                </a>
                {secondaryCta.href !== primaryHref && (
                  <Link
                    href={secondaryCta.href}
                    onClick={() =>
                      trackReferralEvent({
                        refCode: `blog:${post.slug}`,
                        action: "cta_click",
                        channel: "blog_post",
                        metadata: { destination: secondaryCta.destination, cta: "secondary" },
                      })
                    }
                  >
                    <Button variant="outline" data-testid="button-blog-post-secondary">{secondaryCta.label}</Button>
                  </Link>
                )}
              </div>
            </div>
          </div>

          <div className="mt-12">
            <h2 className="font-heading text-2xl font-semibold text-foreground">Keep reading</h2>
            <div className="grid gap-4 md:grid-cols-3 mt-6">
              {relatedPosts.map((entry) => (
                <Link key={entry.slug} href={`/blog/${entry.slug}`} className="rounded-2xl border border-border bg-card p-5 shadow-premium-sm hover:border-primary/30">
                  <p className="text-xs text-primary font-medium">{entry.category}</p>
                  <h3 className="font-heading text-lg font-semibold text-foreground mt-3">{entry.title}</h3>
                  <p className="text-sm text-muted-foreground mt-2">{entry.description}</p>
                  <span className="inline-flex items-center gap-2 text-sm text-primary mt-4">
                    Read next
                    <ArrowRight className="h-4 w-4" />
                  </span>
                </Link>
              ))}
            </div>
          </div>
        </div>
      </article>

      <Footer />
    </div>
  );
}
