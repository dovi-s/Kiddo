import { Link, useSearch } from "wouter";
import { motion } from "framer-motion";
import { ArrowRight, BookOpenText } from "lucide-react";
import { Nav } from "@/components/layout/Nav";
import { Footer } from "@/components/layout/Footer";
import { blogPosts } from "@/lib/content";
import { Button } from "@/components/ui/button";
import { Mascot } from "@/components/ui/mascot";
import { buildTrackedGetStartedHref, trackReferralEvent } from "@/lib/acquisition";
import { usePageSeo } from "@/lib/seo";

export default function Blog() {
  const search = useSearch();
  const startHref = buildTrackedGetStartedHref(search, { ref: "blog:index", src: "blog_index" });
  const featuredPost = blogPosts[0];
  const rest = blogPosts.slice(1);

  usePageSeo({
    title: "Kiddo Blog | Investing for kids, gifting, and more.",
    description: "Guides for parents on investing for children, setting up gifting funds, UTMA accounts, and making every occasion count.",
    ogType: "website",
  });

  return (
    <div className="min-h-screen bg-background">
      <Nav />

      <section className="pt-24 pb-16 md:pt-32 md:pb-20">
        <div className="mx-auto max-w-6xl px-4">
          <div className="mx-auto max-w-3xl text-center">
            <Mascot size="lg" className="mx-auto mb-6" context="faq-hero" />
            <p className="text-sm font-semibold uppercase tracking-[0.2em] text-primary">Blog</p>
            <h1 className="mt-4 font-heading text-4xl font-bold tracking-tight text-foreground md:text-6xl">
              Gifts that grow. Guides that help.
            </h1>
            <p className="mt-6 text-lg leading-relaxed text-muted-foreground">
              Everything you need to know about investing for your child, setting up a fund, and making every gift count.
            </p>
          </div>
        </div>
      </section>

      {featuredPost ? (
        <section className="pb-12">
          <div className="mx-auto max-w-6xl px-4">
            <motion.article
              initial={{ opacity: 0, y: 16 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-50px" }}
              className="rounded-[32px] border border-border bg-card p-8 shadow-premium-sm md:p-10"
            >
              <p className="text-sm font-semibold uppercase tracking-[0.2em] text-primary">Featured article</p>
              <h2 className="mt-4 font-heading text-3xl font-semibold text-foreground md:text-4xl">{featuredPost.title}</h2>
              <p className="mt-3 text-sm text-muted-foreground">{featuredPost.publishedAt} {featuredPost.readTime ? `· ${featuredPost.readTime}` : ""}</p>
              <p className="mt-4 max-w-3xl text-base leading-8 text-muted-foreground">{featuredPost.description}</p>
              <Link href={`/blog/${featuredPost.slug}`} className="mt-6 inline-flex items-center gap-2 text-sm font-medium text-primary hover:underline">
                Read
                <ArrowRight className="h-4 w-4" />
              </Link>
            </motion.article>
          </div>
        </section>
      ) : null}

      <section className="pb-20 md:pb-24">
        <div className="mx-auto max-w-6xl px-4">
          <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
            {rest.map((post, index) => (
              <motion.article
                key={post.slug}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: "-50px" }}
                transition={{ duration: 0.45, delay: index * 0.04 }}
                className="rounded-3xl border border-border bg-card p-6 shadow-premium-sm"
              >
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <span className="rounded-full bg-primary/10 px-2.5 py-1 text-primary">{post.category}</span>
                  <span>{post.readTime}</span>
                </div>
                <h2 className="mt-5 font-heading text-2xl font-semibold text-foreground">{post.title}</h2>
                <p className="mt-3 text-sm leading-7 text-muted-foreground">{post.description}</p>
                <div className="mt-5 flex flex-wrap gap-2">
                  {post.tags.map((tag) => (
                    <span key={tag} className="rounded-full border border-border px-2.5 py-1 text-xs text-muted-foreground">
                      {tag}
                    </span>
                  ))}
                </div>
                <Link
                  href={`/blog/${post.slug}`}
                  onClick={() =>
                    trackReferralEvent({
                      refCode: `blog:${post.slug}`,
                      action: "cta_click",
                      channel: "blog_index",
                      metadata: { destination: "blog_post" },
                    })
                  }
                  className="mt-6 inline-flex items-center gap-2 text-sm font-medium text-primary hover:underline"
                >
                  Read guide
                  <ArrowRight className="h-4 w-4" />
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
              <BookOpenText className="h-4 w-4" />
              Built for parents, gifters, and the next big occasion
            </div>
            <h2 className="mt-6 font-heading text-3xl font-bold tracking-tight text-foreground md:text-4xl">
              Ready to make the next occasion easier?
            </h2>
            <p className="mx-auto mt-4 max-w-2xl text-muted-foreground">
              Set up once, share one link, and let family give something that actually lasts.
            </p>
            <div className="mt-8 flex flex-col justify-center gap-4 sm:flex-row">
              <a
                href={startHref}
                onClick={() =>
                  trackReferralEvent({
                    refCode: "blog:index",
                    action: "cta_click",
                    channel: "blog_index",
                    metadata: { destination: "get_started" },
                  })
                }
              >
                <Button size="lg" data-testid="button-blog-cta-primary">Start your child&apos;s fund</Button>
              </a>
              <Link href="/faq">
                <Button variant="outline" size="lg" data-testid="button-blog-cta-secondary">Read the FAQ</Button>
              </Link>
            </div>
          </div>
        </div>
      </section>

      <Footer />
    </div>
  );
}
