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

import { FormEvent, useEffect, useState } from "react";
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
import { useScrollResetOnChange } from "@/lib/scroll-to-element";
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
  // P0-1 capture-at-intent (Option C): return from the hosted setup-Checkout.
  // ?setup=done → card saved; ?setup=cancelled → they backed out (stay on form).
  const [cardSaved, setCardSaved] = useState(false);
  // When capture-at-intent is on, the server returns a hosted-Checkout URL. We
  // show the point-of-charge disclosure + affirmative consent BEFORE redirecting
  // (per the advisory panel's required floor). Copy here is PENDING COUNSEL.
  const [pendingCapture, setPendingCapture] = useState<{ url: string; amount: number; kidFirstName: string } | null>(null);

  // The three terminal screens (pending-capture / card-saved / completed) are
  // state-driven early returns, NOT route changes, so the global ScrollToTop
  // (which fires on location change) never runs for them. Without this, a gifter
  // who filled the long form near the viewport bottom lands on the success
  // screen scrolled past its headline. Reset to top whenever the screen mode flips.
  const screenMode = pendingCapture ? "pendingCapture" : cardSaved ? "cardSaved" : completed ? "completed" : "form";
  useScrollResetOnChange(screenMode);

  const [gifterName, setGifterName] = useState("");
  const [gifterEmail, setGifterEmail] = useState("");
  const [recipientEmail, setRecipientEmail] = useState("");
  const [kidFirstName, setKidFirstName] = useState("");
  const [amount, setAmount] = useState<number>(100);
  const [customAmount, setCustomAmount] = useState("");
  const [message, setMessage] = useState("");

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const setup = params.get("setup");
    if (setup === "done") {
      setCardSaved(true);
    } else if (setup === "cancelled") {
      toast({ title: "No card saved", description: "You can still send the note. Your gift completes when the parent sets up the fund." });
    }
    if (setup) {
      // Clean the query so a refresh doesn't re-trigger the screen.
      window.history.replaceState({}, "", window.location.pathname);
    }
  }, [toast]);

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
      // P0-1 capture-at-intent (Option C): if the server vaulted a card path
      // (flag on), it returns a hosted setup-Checkout URL; redirect so the
      // gifter can save their card. Absent → warm-promise confirmation, as before.
      if (data.captureCheckoutUrl) {
        haptic("success");
        // Show the point-of-charge disclosure + affirmative consent before the
        // redirect, rather than bouncing straight to Stripe.
        setPendingCapture({ url: data.captureCheckoutUrl as string, amount: finalAmount, kidFirstName: kidFirstName.trim() });
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

  // P0-1 capture-at-intent (Option C) point-of-charge disclosure, shown BEFORE
  // the redirect to Stripe's hosted card-save page, with affirmative consent.
  // Meets the advisory panel's §5 floor. ALL COPY HERE IS PENDING COUNSEL
  // (LAWYER_Q gate #3) before GIFTER_CAPTURE_AT_INTENT is enabled.
  if (pendingCapture) {
    return (
      <div className="min-h-screen bg-background">
        <Nav />
        <main className="px-4 pb-20 pt-24 md:pb-28 md:pt-32">
          <div className="mx-auto max-w-2xl">
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4 }}
              className="space-y-6"
            >
              <h1 className="font-heading text-2xl md:text-3xl font-bold tracking-tight text-center">
                Before you save your card
              </h1>
              <div className="rounded-2xl border border-border bg-card p-5 text-left text-sm text-foreground/80 leading-relaxed space-y-2">
                <p><span className="font-semibold text-foreground">Your card will be saved now and charged later, not today.</span></p>
                <ul className="list-disc pl-5 space-y-1.5">
                  <li>We securely save your card now. <span className="font-semibold">You will not be charged today.</span></li>
                  <li>Your card is charged <span className="font-semibold">${pendingCapture.amount.toFixed(2)}</span> when {pendingCapture.kidFirstName}'s parent creates the fund, the moment your gift can actually be invested.</li>
                  <li><span className="font-semibold">If no fund is ever created, your card is never charged</span>, and we delete your saved card after 60 days.</li>
                  <li>If a charge doesn't go through (e.g. expired card), we'll email you and try again over the next 30 days. Your gift isn't complete until the charge succeeds.</li>
                  <li>This is a <span className="font-semibold">one-time charge</span> for this gift, not a subscription.</li>
                </ul>
                <p className="text-xs text-muted-foreground pt-1">By continuing, you authorize this future one-time charge to your saved card.</p>
              </div>
              <div className="flex flex-col gap-3 max-w-xs mx-auto">
                <Button className="w-full" size="lg" onClick={() => { window.location.href = pendingCapture.url; }}>
                  Continue to save my card
                  <ArrowRight size={16} className="ml-2" />
                </Button>
                <Button variant="ghost" className="w-full" onClick={() => setPendingCapture(null)}>
                  Go back
                </Button>
              </div>
            </motion.div>
          </div>
        </main>
        <Footer />
      </div>
    );
  }

  // P0-1 capture-at-intent (Option C) return screen: the gifter saved a card on
  // the hosted page. NOTE: final wording here + the point-of-charge disclosure
  // on the form are PENDING COUNSEL (LAWYER_Q gate #2) before the flag is enabled.
  if (cardSaved) {
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
                <Check size={24} />
              </div>
              <h1 className="font-heading text-3xl md:text-4xl font-bold tracking-tight">
                Your card is saved.
              </h1>
              <p className="text-base text-foreground/80 leading-relaxed max-w-md mx-auto">
                We won't charge it yet. When the parent sets up the child's fund, we'll charge your card and your gift becomes a real investment in the child's name. If they don't set it up, we won't charge you, and you can change your mind any time before then.
              </p>
              <div className="flex flex-col gap-3 max-w-xs mx-auto">
                <Link href="/">
                  <Button variant="outline" className="w-full">Back to Kiddo</Button>
                </Link>
              </div>
            </motion.div>
          </div>
        </main>
        <Footer />
      </div>
    );
  }

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
                  <li>They set up {completed.kidFirstName}'s fund (about 5 minutes, no card needed).</li>
                  <li>You get an email saying "ready to send your gift?"</li>
                  <li>One click and your ${completed.amount.toFixed(2)} becomes a real investment for {completed.kidFirstName}.</li>
                </ol>
                {/* Lifecycle clarity. Verified across the stack:
                    server/routes.ts POST /api/gift-intents sends ONE
                    nudge to the parent (no follow-up drip). The
                    intent stays open 60 days. server/
                    giftIntentExpiryWorker.ts emails the gifter
                    roughly 10 days before expiry as a heads-up if
                    the parent hasn't acted, and flips the intent
                    to 'expired' on tick after expiresAt passes.
                    Copy reflects all three honestly so the gifter
                    isn't left wondering. */}
                <p className="text-xs text-muted-foreground pt-2 leading-relaxed">
                  We send one warm note to the parent, not a follow-up drip. The intent stays open for 60 days. If they haven't acted with about 10 days left, we'll email you a heads-up so you can nudge them yourself. Kiddo's role is the welcome, yours is the relationship.
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
          {/* Deflector banner. A gifter who landed here by mistake
              (received a real gift link from a parent and ended up
              here instead) should NOT fill out the wrong form. This
              hint at the top routes them to the right place before
              they invest time in the intent flow. Used to live at
              the bottom (line ~339); moved 2026-05-15 because the
              bottom placement means they read it only after they've
              already started filling fields. */}
          <div className="mx-auto mb-6 max-w-xl rounded-2xl border border-border bg-muted/30 px-4 py-3 text-center text-xs text-muted-foreground">
            Already have a gift link from a parent? <span className="font-semibold text-foreground">Tap it instead.</span> It's the faster path. Straight to checkout.
          </div>
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4 }}
            className="text-center mb-10"
          >
            {/* Eyebrow rewrite 2026-05-18. Prior copy "For anyone
                who loves a kid" tried to capture audience by
                emotional descriptor and landed as predatory ('who's
                loving a kid that isn't theirs'). Replaced with a
                concrete role list that self-selects without
                emotional overreach: if you're one of these, you're
                in the right place. Same audience, cleaner read,
                Apple-Settings register. */}
            <div className="inline-flex items-center gap-2 text-xs uppercase tracking-wide text-muted-foreground mb-3">
              <Sprout size={14} className="text-primary" />
              <span>Aunt, grandparent, godparent, friend</span>
            </div>
            <h1 className="font-heading text-4xl md:text-5xl font-bold tracking-tight">
              Give a gift that lasts.
            </h1>
            <p className="mx-auto mt-5 max-w-xl text-lg leading-relaxed text-muted-foreground">
              Want to invest for a child but their parents don't have a Kiddo fund yet?
              Tell us about your gift. We'll let the parents know. They set up the fund. Your gift becomes a real investment in the child's name.
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
                    placeholder="Sarah Rivera"
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
                A parent or guardian sets up the fund and becomes the legal custodian. The money is your gift, but Kiddo keeps custody simple by routing every fund through the parent. They control the account until the kid is 18.
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
                    aria-pressed={amount === preset && !customAmount}
                    onClick={() => { setAmount(preset); setCustomAmount(""); }}
                    className={`rounded-full border py-2.5 text-sm font-semibold transition-colors ${
                      amount === preset && !customAmount
                        ? "border-primary bg-primary/10 text-primary"
                        : "border-border bg-card text-foreground/70 hover:border-foreground/30 hover:text-foreground"
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
              {/* No-fee reassurance. Per locked policy: "NO platform
                  fee on gifts. Gift amount stays whole. $50 from
                  grandma = $50 to fund. Gifter pays Stripe processing
                  only." A gifter mid-decision worrying "will Kiddo
                  skim my $100" gets no signal without this line.
                  Added 2026-05-15 as part of the gifter-form audit. */}
              <p className="text-xs text-foreground/80 leading-relaxed bg-[hsl(var(--kiddo-evergreen)/0.06)] border border-[hsl(var(--kiddo-evergreen)/0.18)] rounded-xl px-3 py-2">
                <span className="font-semibold text-[hsl(var(--kiddo-evergreen))]">Every dollar reaches the kid.</span> Kiddo doesn't take a platform fee on gifts. You cover only the standard card-processing charge.
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
            <HowItWorks icon={<Check size={16} />} step="2" body="They set up the fund in about 5 minutes. No card needed." />
            <HowItWorks icon={<Heart size={16} />} step="3" body="You complete your gift. It becomes a real investment for the kid." />
          </motion.section>

          {/* (Removed 2026-05-15: a duplicate "Already have a gift link"
              hint used to live here too. The single banner above the
              hero is enough; repeating it after the form reads as
              the page second-guessing the user's choice.) */}
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
