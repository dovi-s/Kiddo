// Gifter-led acquisition: a gifter who doesn't have a fund link
// can still start the loop. Per GIFTER_LED_ACQUISITION_SPEC.md.
//
// The flow:
//   1. Gifter (typically a grandparent) lands here
//   2. Fills in: their name + email, parent's email, kid's first
//      name, amount, optional message
//   3. Submits → POST /api/gift-intents → server saves intent +
//      emails the parent a warm nudge
//   4. Confirmation screen tells them what happens next
//
// V1 is warm-promise: no card charged at intent creation. The
// gifter gets a follow-up email once the parent sets up the
// fund, with a one-click link to complete the actual gift via
// the existing /:fund gift checkout.
//
// Tone register: calm, low-pressure, family-warm. The hero
// framing is "give a child a gift that lasts" not "fast-track
// your gift now." Matches the locked Kiddo copy discipline.

import { FormEvent, useState } from "react";
import { Link } from "wouter";
import { motion } from "framer-motion";
import { ArrowRight, Check, Gift, Heart, Mail, Sprout } from "lucide-react";
import { Nav } from "@/components/layout/Nav";
import { Footer } from "@/components/layout/Footer";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { usePageSeo } from "@/lib/seo";
import { haptic } from "@/lib/haptics";

const PRESET_AMOUNTS = [25, 50, 100, 250, 500] as const;

export default function GiveAGift() {
  const { toast } = useToast();
  usePageSeo({
    title: "Give a gift that lasts | Kiddo",
    description: "Start a Kiddo gift for a child whose parents haven't set up a fund yet. We'll send them a warm note.",
    robots: "index,follow",
  });

  const [submitting, setSubmitting] = useState(false);
  const [completed, setCompleted] = useState<{ recipientEmail: string; kidFirstName: string; gifterName: string; amount: number } | null>(null);

  const [gifterName, setGifterName] = useState("");
  const [gifterEmail, setGifterEmail] = useState("");
  const [recipientEmail, setRecipientEmail] = useState("");
  const [kidFirstName, setKidFirstName] = useState("");
  const [amount, setAmount] = useState<number>(100);
  const [customAmount, setCustomAmount] = useState("");
  const [message, setMessage] = useState("");

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (submitting) return;
    const finalAmount = customAmount.trim() ? parseFloat(customAmount) : amount;
    if (!Number.isFinite(finalAmount) || finalAmount < 5) {
      toast({ title: "Amount must be at least $5", variant: "destructive" });
      return;
    }
    setSubmitting(true);
    haptic("medium");
    try {
      const res = await fetch("/api/gift-intents", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          gifterName: gifterName.trim(),
          gifterEmail: gifterEmail.trim(),
          recipientEmail: recipientEmail.trim(),
          kidFirstName: kidFirstName.trim(),
          amount: finalAmount,
          message: message.trim() || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast({ title: "Couldn't send", description: data.error || "Try again in a moment.", variant: "destructive" });
        return;
      }
      haptic("success");
      setCompleted({
        recipientEmail: recipientEmail.trim(),
        kidFirstName: kidFirstName.trim(),
        gifterName: gifterName.trim(),
        amount: finalAmount,
      });
    } catch (err) {
      toast({ title: "Couldn't send", description: "Check your connection and try again.", variant: "destructive" });
    } finally {
      setSubmitting(false);
    }
  };

  if (completed) {
    return (
      <div className="min-h-screen bg-background">
        <Nav />
        <main className="px-4 pb-20 pt-24 md:pb-28 md:pt-32">
          <div className="mx-auto max-w-2xl">
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4 }}
              className="space-y-6 text-center"
            >
              <div className="mx-auto h-14 w-14 rounded-full bg-primary/10 text-primary flex items-center justify-center">
                <Mail size={24} />
              </div>
              <h1 className="font-heading text-3xl md:text-4xl font-bold tracking-tight">
                On its way.
              </h1>
              <p className="text-base text-foreground/80 leading-relaxed max-w-md mx-auto">
                We just emailed {completed.recipientEmail} letting them know you have ${completed.amount.toFixed(2)} ready for {completed.kidFirstName}.
              </p>
              <div className="rounded-2xl border border-border bg-card p-5 text-left space-y-3 max-w-md mx-auto">
                <p className="text-sm font-semibold text-foreground">What happens next</p>
                <ol className="space-y-2 text-sm text-foreground/70 leading-relaxed list-decimal pl-5">
                  <li>They set up {completed.kidFirstName}'s fund (a few minutes, no card needed).</li>
                  <li>You get an email saying "ready to send your gift?"</li>
                  <li>One click and your ${completed.amount.toFixed(2)} becomes real shares for {completed.kidFirstName}.</li>
                </ol>
                <p className="text-xs text-muted-foreground italic pt-2">
                  No rush on their end. The note we sent is warm, not pushy.
                </p>
              </div>
              <div className="flex flex-col gap-3 max-w-xs mx-auto">
                <Link href="/">
                  <Button variant="outline" className="w-full">
                    Back to Kiddo
                  </Button>
                </Link>
              </div>
            </motion.div>
          </div>
        </main>
        <Footer />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <Nav />
      <main className="px-4 pb-20 pt-24 md:pb-28 md:pt-32">
        <div className="mx-auto max-w-2xl">
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4 }}
            className="text-center mb-10"
          >
            <div className="inline-flex items-center gap-2 text-xs uppercase tracking-wide text-muted-foreground mb-3">
              <Sprout size={14} className="text-primary" />
              <span>For grandparents, aunts, uncles, anyone</span>
            </div>
            <h1 className="font-heading text-4xl md:text-5xl font-bold tracking-tight">
              Give a gift that lasts.
            </h1>
            <p className="mx-auto mt-5 max-w-xl text-lg leading-relaxed text-muted-foreground">
              Want to invest for a child but their parents don't have a Kiddo fund yet?
              Tell us about your gift. We'll send the parents a warm note. They set up the fund. Your gift becomes real shares.
            </p>
          </motion.div>

          <motion.form
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 0.05 }}
            onSubmit={handleSubmit}
            className="space-y-6 rounded-3xl border border-border bg-card p-6 md:p-8 shadow-premium-sm"
          >
            <section className="space-y-4">
              <div className="flex items-center gap-2">
                <span className="h-7 w-7 rounded-full bg-primary/10 text-primary flex items-center justify-center text-xs font-bold">1</span>
                <h2 className="font-heading text-lg font-semibold">About you</h2>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label htmlFor="gift-intent-gifter-name">Your name</Label>
                  <Input
                    id="gift-intent-gifter-name"
                    name="gifterName"
                    type="text"
                    value={gifterName}
                    onChange={(e) => setGifterName(e.target.value)}
                    autoComplete="name"
                    required
                    placeholder="Sarah Pritchett"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="gift-intent-gifter-email">Your email</Label>
                  <Input
                    id="gift-intent-gifter-email"
                    name="gifterEmail"
                    type="email"
                    value={gifterEmail}
                    onChange={(e) => setGifterEmail(e.target.value)}
                    autoComplete="email"
                    required
                    placeholder="sarah@example.com"
                  />
                </div>
              </div>
            </section>

            <section className="space-y-4">
              <div className="flex items-center gap-2">
                <span className="h-7 w-7 rounded-full bg-primary/10 text-primary flex items-center justify-center text-xs font-bold">2</span>
                <h2 className="font-heading text-lg font-semibold">Who's the gift for?</h2>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label htmlFor="gift-intent-kid-name">Child's first name</Label>
                  <Input
                    id="gift-intent-kid-name"
                    name="kidFirstName"
                    type="text"
                    value={kidFirstName}
                    onChange={(e) => setKidFirstName(e.target.value)}
                    autoComplete="off"
                    required
                    placeholder="Emma"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="gift-intent-recipient-email">Parent's email</Label>
                  <Input
                    id="gift-intent-recipient-email"
                    name="recipientEmail"
                    type="email"
                    value={recipientEmail}
                    onChange={(e) => setRecipientEmail(e.target.value)}
                    autoComplete="off"
                    required
                    placeholder="parent@example.com"
                  />
                </div>
              </div>
              <p className="text-xs text-muted-foreground">
                Whoever sets up the fund will be the custodian. UTMA accounts have to be in a parent or guardian's name.
              </p>
            </section>

            <section className="space-y-4">
              <div className="flex items-center gap-2">
                <span className="h-7 w-7 rounded-full bg-primary/10 text-primary flex items-center justify-center text-xs font-bold">3</span>
                <h2 className="font-heading text-lg font-semibold">How much?</h2>
              </div>
              <div className="grid grid-cols-3 gap-2 sm:grid-cols-5">
                {PRESET_AMOUNTS.map((preset) => (
                  <button
                    key={preset}
                    type="button"
                    onClick={() => { setAmount(preset); setCustomAmount(""); }}
                    className={`rounded-xl border-2 py-3 text-sm font-semibold transition-colors ${
                      amount === preset && !customAmount
                        ? "border-primary bg-primary/5 text-foreground"
                        : "border-border bg-card text-foreground/70 hover:border-foreground/30"
                    }`}
                  >
                    ${preset}
                  </button>
                ))}
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="gift-intent-custom-amount" className="text-xs text-muted-foreground">Or a custom amount</Label>
                <Input
                  id="gift-intent-custom-amount"
                  name="customAmount"
                  type="number"
                  min={5}
                  step={1}
                  value={customAmount}
                  onChange={(e) => setCustomAmount(e.target.value)}
                  autoComplete="off"
                  placeholder="e.g. 75"
                />
              </div>
              <p className="text-xs text-muted-foreground">
                You won't be charged yet. We'll email you to complete the gift once the fund is set up.
              </p>
            </section>

            <section className="space-y-4">
              <div className="flex items-center gap-2">
                <span className="h-7 w-7 rounded-full bg-primary/10 text-primary flex items-center justify-center text-xs font-bold">4</span>
                <h2 className="font-heading text-lg font-semibold">Add a note <span className="font-normal text-muted-foreground text-sm">(optional)</span></h2>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="gift-intent-message" className="sr-only">Personal message</Label>
                <Textarea
                  id="gift-intent-message"
                  name="message"
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  rows={3}
                  maxLength={490}
                  placeholder="For my granddaughter, with all my love."
                />
                <p className="text-xs text-muted-foreground text-right">
                  {message.length}/490
                </p>
              </div>
            </section>

            <div className="space-y-3 pt-2">
              <Button
                type="submit"
                disabled={submitting}
                className="w-full"
                size="lg"
              >
                {submitting ? "Sending..." : "Send the note"}
                {!submitting && <ArrowRight size={16} className="ml-2" />}
              </Button>
              <p className="text-xs text-center text-muted-foreground">
                We send a warm note, not a sales pitch. Promise.
              </p>
            </div>
          </motion.form>

          <motion.section
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 0.1 }}
            className="mt-10 grid gap-4 sm:grid-cols-3"
          >
            <HowItWorks icon={<Mail size={16} />} step="1" body="We email the parent saying you have a gift ready." />
            <HowItWorks icon={<Check size={16} />} step="2" body="They set up the fund in a few minutes. No card needed." />
            <HowItWorks icon={<Heart size={16} />} step="3" body="You complete your gift. It becomes real shares." />
          </motion.section>

          <p className="mt-10 text-xs text-center text-muted-foreground">
            Already have a gift link from a parent? Open it directly in your browser, or tap it in their email.
          </p>
        </div>
      </main>
      <Footer />
    </div>
  );
}

function HowItWorks({ icon, step, body }: { icon: React.ReactNode; step: string; body: string }) {
  return (
    <div className="rounded-2xl border border-border bg-card p-4 flex items-start gap-3">
      <span className="shrink-0 h-7 w-7 rounded-full bg-primary/10 text-primary flex items-center justify-center text-xs font-bold">
        {step}
      </span>
      <div className="min-w-0">
        <p className="text-sm text-foreground/80 leading-relaxed">{body}</p>
      </div>
    </div>
  );
}
