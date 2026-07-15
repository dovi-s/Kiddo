import { FormEvent, useState } from "react";
import { useLocation } from "wouter";
import { motion } from "framer-motion";
import { ArrowRight, Gift, Mail, Search, Send } from "lucide-react";
import { Nav } from "@/components/layout/Nav";
import { Footer } from "@/components/layout/Footer";
import { Button } from "@/components/ui/button";
import { GradientText } from "@/components/ui/gemini";
import { Mascot } from "@/components/ui/mascot";
import { useToast } from "@/hooks/use-toast";
import { haptic } from "@/lib/haptics";

type ResolveResponse = {
  code: string;
  codeType: "fund" | "event";
  fund: {
    id: string;
    name: string;
    recipientFirstName: string | null;
    slug: string;
  };
  event?: { id: string; name: string; slug: string; status: string };
  eventClosed?: boolean;
  eventName?: string | null;
  warmMessage?: string | null;
  redirectPath: string;
};

export default function GiftLookup() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [code, setCode] = useState("");
  const [isLookingUp, setIsLookingUp] = useState(false);
  const [parentContact, setParentContact] = useState("");
  const [childName, setChildName] = useState("");
  const [requesterName, setRequesterName] = useState("");
  const [isRequestingInvite, setIsRequestingInvite] = useState(false);

  const normalizedCode = code
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "")
    .slice(0, 16);

  const handleLookup = async (e: FormEvent) => {
    e.preventDefault();
    if (!normalizedCode) {
      toast({ title: "Enter a code", description: "Ask the parent for their child's Kiddo gift code.", variant: "destructive" });
      return;
    }

    try {
      setIsLookingUp(true);
      const res = await fetch("/api/public/fund-code/resolve", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: normalizedCode }),
      });
      const data: ResolveResponse | { error?: string } = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error("error" in data && data.error ? data.error : "Could not find that fund.");
      }
      haptic("success");
      const resolved = data as ResolveResponse;
      if (resolved.eventClosed && resolved.warmMessage) {
        toast({ title: "Event wrapped up", description: resolved.warmMessage });
      }
      setLocation(resolved.redirectPath);
    } catch (error) {
      haptic("error");
      toast({
        title: "Fund not found",
        description: error instanceof Error ? error.message : "Please double-check the code and try again.",
        variant: "destructive",
      });
    } finally {
      setIsLookingUp(false);
    }
  };

  const handleInviteRequest = async (e: FormEvent) => {
    e.preventDefault();
    if (!parentContact.trim()) {
      toast({ title: "Add a parent contact", description: "Enter an email or phone so the parent can be invited.", variant: "destructive" });
      return;
    }
    try {
      setIsRequestingInvite(true);
      const res = await fetch("/api/public/gift-invitations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          parentContact: parentContact.trim(),
          childName: childName.trim(),
          requesterName: requesterName.trim(),
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || "Could not save the request.");
      haptic("success");
      // Branch on delivery mode. Email path = "we sent it" toast.
      // Phone (or non-email) path = "we don't text yet, here's the link
      // we already copied to your clipboard for you" toast. This
      // replaces the previous behavior where phone entries were
      // silently dropped into a server-side log file and the user got
      // a polite "request saved" toast covering for nothing happening.
      if (data?.deliveryMode === "email") {
        toast({
          title: "Invitation sent",
          description: "Once the parent sets up the fund, they can share the link or fund code back.",
        });
      } else {
        // Auto-copy the shareable URL so the requester can paste it
        // straight into a text message to the parent without having
        // to hunt for it. Best-effort: clipboard access can be denied
        // (older Safari, in-app browsers, no HTTPS in dev) so the
        // toast carries the URL too as the visible fallback.
        const url = String(data?.shareableUrl || "");
        let copied = false;
        if (url && typeof navigator !== "undefined" && navigator.clipboard?.writeText) {
          try {
            await navigator.clipboard.writeText(url);
            copied = true;
          } catch {
            // ignore — fall back to showing the URL in the toast
          }
        }
        toast({
          title: copied ? "Link copied. Text it to them." : "Text this link to them",
          description: url
            ? (copied
                ? `${url} is on your clipboard. Paste it in a message to the parent and we'll guide them from there.`
                : `Send the parent: ${url}`)
            : "Send the parent the kiddofund.com/get-started link and we'll guide them from there.",
        });
      }
      setParentContact("");
      setChildName("");
      setRequesterName("");
    } catch (error) {
      toast({
        title: "Could not save request",
        description: error instanceof Error ? error.message : "Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsRequestingInvite(false);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <Nav />
      <main className="px-4 pb-20 pt-24 md:pb-28 md:pt-32">
        <div className="mx-auto max-w-5xl">
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.45 }}
            className="mx-auto max-w-3xl text-center"
          >
            <Mascot size="lg" className="mx-auto mb-6 drop-shadow-lg" context="gift-lookup" />
            <h1 className="font-heading text-4xl font-bold tracking-tight text-foreground md:text-6xl">
              Gift to a child on <GradientText>Kiddo</GradientText>
            </h1>
            <p className="mx-auto mt-5 max-w-2xl text-lg leading-relaxed text-muted-foreground">
              Enter the fund code and we&apos;ll open the private gift page. No public search. No account required to give.
            </p>
          </motion.div>

          <div className="mx-auto mt-12 grid max-w-5xl gap-6 lg:grid-cols-[1.1fr_0.9fr]">
            <motion.section
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.45, delay: 0.05 }}
              className="rounded-3xl border border-border bg-card p-8 shadow-premium-sm"
            >
              <div className="flex items-center gap-2 text-primary">
                <Gift size={16} />
                <p className="text-sm font-medium">Find a fund by code</p>
              </div>
              <h2 className="mt-3 font-heading text-2xl font-semibold text-foreground">No link? Use the <GradientText>fund code</GradientText>.</h2>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                Ask the parent, grandparent, or anyone in the family for the child&apos;s Kiddo code. Enter it here and you&apos;re in.
              </p>

              <form onSubmit={handleLookup} className="mt-6 space-y-4">
                <label className="block">
                  <span className="text-sm font-medium text-foreground">Fund code</span>
                  <div className="relative mt-2">
                    <Search size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground" />
                    <input
                      value={code}
                      onChange={(e) => setCode(e.target.value)}
                      placeholder="EMMA7K4Q"
                      className="h-14 w-full rounded-2xl border border-border bg-background pl-11 pr-4 text-base font-semibold tracking-[0.18em] uppercase text-foreground"
                      data-testid="input-gift-code"
                    />
                  </div>
                </label>
                <Button type="submit" size="lg" className="h-14 w-full text-base" disabled={isLookingUp} data-testid="button-find-fund-by-code">
                  {isLookingUp ? "Finding fund..." : "Find fund"}
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              </form>

              <div className="mt-6 rounded-2xl border border-border/60 bg-muted/30 p-4 text-sm text-muted-foreground">
                <p className="font-medium text-foreground">Three ways to gift</p>
                <p className="mt-2">1. Tap the link</p>
                <p>2. Scan the QR code</p>
                <p>3. Enter the fund code here</p>
              </div>
            </motion.section>

            <motion.section
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.45, delay: 0.1 }}
              className="rounded-3xl border border-border bg-card p-8 shadow-premium-sm"
            >
              <div className="flex items-center gap-2 text-primary">
                <Mail size={16} />
                <p className="text-sm font-medium">Need the parent to set one up first?</p>
              </div>
              <h2 className="mt-3 font-heading text-2xl font-semibold text-foreground">Request a parent <GradientText>invitation</GradientText></h2>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                If the child is not on Kiddo yet, leave the parent&apos;s contact info here. We&apos;ll save the request so they can set up the fund and share it back.
              </p>

              <form onSubmit={handleInviteRequest} className="mt-6 space-y-4">
                {/* Visible sr-only labels + input type attributes added
                    2026-05-25 audit. The placeholder-only inputs failed
                    WCAG 3.3.2 (labels must persist, not vanish on focus).
                    type="email" on the contact field triggers the mobile
                    email keyboard, materially better UX on phones where
                    most gifters land. */}
                <label htmlFor="lookup-parent-contact" className="sr-only">Parent email or phone</label>
                <input
                  id="lookup-parent-contact"
                  type="email"
                  inputMode="email"
                  value={parentContact}
                  onChange={(e) => setParentContact(e.target.value)}
                  placeholder="Parent email or phone"
                  className="h-12 w-full rounded-2xl border border-border bg-background px-4 text-base sm:text-sm"
                  data-testid="input-parent-contact"
                />
                <label htmlFor="lookup-child-name" className="sr-only">Child's first name (optional)</label>
                <input
                  id="lookup-child-name"
                  type="text"
                  value={childName}
                  onChange={(e) => setChildName(e.target.value)}
                  placeholder="Child's first name (optional)"
                  className="h-12 w-full rounded-2xl border border-border bg-background px-4 text-base sm:text-sm"
                  data-testid="input-child-name"
                />
                <label htmlFor="lookup-requester-name" className="sr-only">Your name (optional)</label>
                <input
                  id="lookup-requester-name"
                  type="text"
                  value={requesterName}
                  onChange={(e) => setRequesterName(e.target.value)}
                  placeholder="Your name (optional)"
                  className="h-12 w-full rounded-2xl border border-border bg-background px-4 text-base sm:text-sm"
                  data-testid="input-requester-name"
                />
                <Button type="submit" variant="outline" size="lg" className="h-12 w-full" disabled={isRequestingInvite} data-testid="button-request-parent-invite">
                  {isRequestingInvite ? "Saving..." : "Save invitation request"}
                  <Send className="ml-2 h-4 w-4" />
                </Button>
              </form>

              <p className="mt-4 text-xs leading-relaxed text-muted-foreground">
                Custodial accounts still require the parent or guardian to complete setup. This just removes the awkward &quot;remember to ask later&quot; step.
              </p>
            </motion.section>
          </div>
        </div>
      </main>
      <Footer />
    </div>
  );
}

