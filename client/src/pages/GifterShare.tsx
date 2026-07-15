import { useQuery } from "@tanstack/react-query";
import { useParams } from "wouter";
import { motion } from "framer-motion";
import { BookOpen, Gift, Heart } from "lucide-react";
import { Nav } from "@/components/layout/Nav";
import { Footer } from "@/components/layout/Footer";
import { Button } from "@/components/ui/button";
import { FadeImage } from "@/components/ui/fade-image";
import { Mascot } from "@/components/ui/mascot";

type SharePayload = {
  token: string;
  childName: string;
  parentName: string | null;
  message: string;
  photoUrl: string | null;
  createdAt: string;
  recipientCount: number;
  giftUrl: string;
  startFundUrl: string;
};

export default function GifterShare() {
  const { token } = useParams<{ token: string }>();
  const { data, isLoading, isError } = useQuery<SharePayload>({
    queryKey: ["gifter-share", token],
    queryFn: async () => {
      const res = await fetch(`/api/gifter-notifications/share/${token}`);
      if (!res.ok) throw new Error("Could not load this shared update.");
      return res.json();
    },
    enabled: !!token,
  });

  return (
    <div className="min-h-screen bg-background">
      <Nav />
      <main className="px-4 pb-20 pt-24 md:pb-28 md:pt-32">
        <div className="mx-auto max-w-3xl">
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.45 }}
            className="text-center"
          >
            <Mascot size="lg" className="mx-auto mb-6 drop-shadow-lg" context="memory-book" />
            <p className="text-sm font-medium uppercase tracking-[0.2em] text-primary">Memory Book Share</p>
            <h1 className="mt-3 font-heading text-4xl font-bold tracking-tight text-foreground md:text-5xl">
              An update from {data?.childName || "a Kiddo family"}
            </h1>
            <p className="mx-auto mt-4 max-w-2xl text-base leading-relaxed text-muted-foreground">
              This page only shows what the parent chose to share. No balances. No portfolio details. Just the story.
            </p>
          </motion.div>

          <div className="mt-10 rounded-3xl border border-border bg-card p-6 shadow-premium-sm md:p-8">
            {isLoading ? (
              <p className="text-sm text-muted-foreground">Loading shared update...</p>
            ) : isError || !data ? (
              <p className="text-sm text-muted-foreground">We couldn&apos;t load this shared update.</p>
            ) : (
              <div className="space-y-6">
                <div className="flex items-center gap-2 text-primary">
                  <BookOpen size={16} />
                  <p className="text-sm font-medium">Shared by {data.parentName || `parent of ${data.childName}`}</p>
                </div>

                {data.photoUrl ? (
                  <FadeImage
                    src={data.photoUrl}
                    alt={`${data.childName} memory`}
                    className="h-64 w-full rounded-2xl object-cover"
                  />
                ) : null}

                <blockquote className="rounded-2xl border border-border/60 bg-muted/30 p-5 text-base leading-relaxed text-foreground">
                  {data.message}
                </blockquote>

                <div className="rounded-2xl border border-border/60 bg-background p-4 text-sm text-muted-foreground">
                  <p className="font-medium text-foreground">{data.recipientCount} opted-in gifter{data.recipientCount === 1 ? "" : "s"} received this update.</p>
                  <p className="mt-1">
                    Posted {new Date(data.createdAt).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}.
                  </p>
                </div>

                <div className="flex flex-col gap-3 sm:flex-row">
                  <a href={data.giftUrl} className="flex-1">
                    <Button className="w-full" data-testid="button-gifter-share-gift-again">
                      <Gift className="mr-2 h-4 w-4" />
                      Gift {data.childName} again
                    </Button>
                  </a>
                  <a href={data.startFundUrl} className="flex-1">
                    <Button variant="outline" className="w-full" data-testid="button-gifter-share-start-fund">
                      <Heart className="mr-2 h-4 w-4" />
                      Start my child&apos;s fund
                    </Button>
                  </a>
                </div>
              </div>
            )}
          </div>
        </div>
      </main>
      <Footer />
    </div>
  );
}
