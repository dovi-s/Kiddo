import { useMutation } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { Link, useParams } from "wouter";
import { CheckCircle2, MailX } from "lucide-react";
import { Nav } from "@/components/layout/Nav";
import { Footer } from "@/components/layout/Footer";
import { Button } from "@/components/ui/button";

export default function GifterUnsubscribe() {
  const { token } = useParams<{ token: string }>();
  const unsubscribe = useMutation({
    mutationFn: async () => {
      const res = await fetch(`/api/gifter-notifications/unsubscribe/${token}`, { method: "POST" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || "Could not unsubscribe.");
      return data;
    },
  });

  return (
    <div className="min-h-screen bg-background">
      <Nav />
      <main className="px-4 pb-20 pt-24 md:pb-28 md:pt-32">
        <div className="mx-auto max-w-xl">
          <motion.div
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4 }}
            className="rounded-3xl border border-border bg-card p-8 text-center shadow-premium-sm"
          >
            {!unsubscribe.isSuccess ? (
              <>
                <div className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-full bg-muted">
                  <MailX className="h-6 w-6 text-muted-foreground" />
                </div>
                <h1 className="font-heading text-3xl font-semibold text-foreground">Stop gifter updates</h1>
                <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
                  You&apos;ll stop receiving birthday reminders, parent-shared Memory Book updates, and the final age-18 milestone email for this fund.
                </p>
                {unsubscribe.isError ? (
                  <p className="mt-4 text-sm text-red-600">
                    {unsubscribe.error instanceof Error ? unsubscribe.error.message : "Could not unsubscribe."}
                  </p>
                ) : null}
                <Button
                  className="mt-6 w-full"
                  onClick={() => unsubscribe.mutate()}
                  disabled={unsubscribe.isPending}
                  data-testid="button-confirm-gifter-unsubscribe"
                >
                  {unsubscribe.isPending ? "Unsubscribing..." : "Unsubscribe"}
                </Button>
              </>
            ) : (
              <>
                <div className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-full bg-green-100">
                  <CheckCircle2 className="h-6 w-6 text-green-700" />
                </div>
                <h1 className="font-heading text-3xl font-semibold text-foreground">You&apos;re unsubscribed</h1>
                <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
                  You won&apos;t receive future updates about this child&apos;s fund. Your past gifts are still part of their story.
                </p>
                <Link href="/" className="mt-6 inline-block w-full">
                  <Button variant="outline" className="w-full" data-testid="button-back-home-after-unsubscribe">
                    Back to home
                  </Button>
                </Link>
              </>
            )}
          </motion.div>
        </div>
      </main>
      <Footer />
    </div>
  );
}
