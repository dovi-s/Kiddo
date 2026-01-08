import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Progress } from "@/components/ui/progress";
import { Leaf, DollarSign, Check, ArrowLeft, Shield, Zap, Clock, ChevronDown, Share2, MessageSquare, Printer } from "lucide-react";
import { Link } from "wouter";
import { toast } from "@/hooks/use-toast";
import { motion, AnimatePresence } from "framer-motion";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";

const MOMENT = {
  title: "Ari's Bar Mitzvah",
  recipient: "Ari",
  photo: "https://images.unsplash.com/photo-1488521787991-ed7bbaae773c?q=80&w=400&auto=format&fit=crop",
  date: "May 24, 2025",
  message: "A modern way to give a gift that lasts.",
  goal: 5000,
  raised: 4250,
  contributors: 18,
};

const AMOUNTS = ["54", "100", "180", "360"];

export default function Moment() {
  const [step, setStep] = useState(0);
  const [amount, setAmount] = useState("100");
  const [customAmount, setCustomAmount] = useState("");
  const [message, setMessage] = useState("");
  const [giverName, setGiverName] = useState("");
  const [showHow, setShowHow] = useState(false);

  const finalAmount = customAmount || amount;
  const fee = (Number(finalAmount) * 0.029 + 0.30).toFixed(2);
  const total = (Number(finalAmount) + Number(fee)).toFixed(2);
  const progress = (MOMENT.raised / MOMENT.goal) * 100;

  const handleConfirm = () => {
    toast({ title: "Gift sent!", description: `You've contributed $${finalAmount} to ${MOMENT.recipient}'s future.` });
    setStep(2);
  };

  return (
    <div className="min-h-screen bg-background font-sans">
      {/* Header */}
      <header className="p-4 border-b bg-card">
        <div className="container mx-auto flex justify-between items-center">
          <Link href="/">
            <a className="flex items-center gap-2 text-foreground">
              <Leaf className="h-5 w-5 text-primary" />
              <span className="font-semibold">Everleaf</span>
            </a>
          </Link>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8 max-w-lg">
        <AnimatePresence mode="wait">
          {step === 0 && (
            <motion.div key="main" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
              {/* Hero */}
              <div className="text-center mb-8">
                <div className="mx-auto mb-4 h-24 w-24 overflow-hidden rounded-full border-4 border-card shadow-lg">
                  <img src={MOMENT.photo} alt={MOMENT.recipient} className="h-full w-full object-cover" />
                </div>
                <h1 className="text-2xl font-semibold text-foreground mb-1">{MOMENT.title}</h1>
                <p className="text-muted-foreground">{MOMENT.message}</p>
              </div>

              {/* Amount selection */}
              <Card className="border-none shadow-sm mb-4">
                <CardContent className="p-6 space-y-5">
                  <div className="space-y-3">
                    <Label className="text-sm font-medium text-muted-foreground">Select amount</Label>
                    <div className="grid grid-cols-4 gap-2">
                      {AMOUNTS.map((val) => (
                        <Button
                          key={val}
                          variant={amount === val && !customAmount ? "default" : "outline"}
                          onClick={() => { setAmount(val); setCustomAmount(""); }}
                          className="h-12 font-semibold"
                          data-testid={`button-amount-${val}`}
                        >
                          ${val}
                        </Button>
                      ))}
                    </div>
                    <div className="relative">
                      <DollarSign className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                      <Input
                        placeholder="Custom amount"
                        value={customAmount}
                        onChange={(e) => setCustomAmount(e.target.value.replace(/[^0-9]/g, ""))}
                        className="pl-9 h-12"
                        data-testid="input-custom-amount"
                      />
                    </div>
                  </div>

                  <Button onClick={() => setStep(1)} className="w-full h-12 text-base font-medium" data-testid="button-contribute">
                    Contribute to {MOMENT.recipient}'s Future Fund
                  </Button>

                  {/* Trust strip */}
                  <div className="flex items-center justify-center gap-4 text-xs text-muted-foreground pt-2">
                    <span className="flex items-center gap-1"><Shield className="h-3 w-3" /> Secure</span>
                    <span className="flex items-center gap-1"><Zap className="h-3 w-3" /> Apple Pay</span>
                    <span className="flex items-center gap-1"><Clock className="h-3 w-3" /> Instant receipt</span>
                  </div>
                </CardContent>
              </Card>

              {/* Goal card */}
              <Card className="border-none shadow-sm mb-4">
                <CardContent className="p-5">
                  <div className="flex justify-between items-end mb-2">
                    <div>
                      <p className="text-2xl font-semibold text-foreground">${MOMENT.raised.toLocaleString()}</p>
                      <p className="text-xs text-muted-foreground">of ${MOMENT.goal.toLocaleString()} goal</p>
                    </div>
                    <p className="text-sm text-muted-foreground">{MOMENT.contributors} contributors</p>
                  </div>
                  <Progress value={progress} className="h-2" />
                </CardContent>
              </Card>

              {/* How it works */}
              <Collapsible open={showHow} onOpenChange={setShowHow}>
                <CollapsibleTrigger asChild>
                  <button className="w-full flex items-center justify-between p-4 text-sm text-muted-foreground hover:text-foreground transition-colors">
                    <span>How it works</span>
                    <ChevronDown className={`h-4 w-4 transition-transform ${showHow ? "rotate-180" : ""}`} />
                  </button>
                </CollapsibleTrigger>
                <CollapsibleContent>
                  <Card className="border-none shadow-sm mb-4">
                    <CardContent className="p-5 space-y-4 text-sm text-muted-foreground">
                      <div className="flex gap-3">
                        <div className="h-6 w-6 rounded-full bg-primary/10 flex items-center justify-center text-xs font-semibold text-primary shrink-0">1</div>
                        <p>Your contribution goes directly to {MOMENT.recipient}'s fund, managed by the family.</p>
                      </div>
                      <div className="flex gap-3">
                        <div className="h-6 w-6 rounded-full bg-primary/10 flex items-center justify-center text-xs font-semibold text-primary shrink-0">2</div>
                        <p>It invests into a diversified Future Fund by end of day.</p>
                      </div>
                      <div className="flex gap-3">
                        <div className="h-6 w-6 rounded-full bg-primary/10 flex items-center justify-center text-xs font-semibold text-primary shrink-0">3</div>
                        <p>You'll receive a receipt instantly. Refunds available within 48 hours.</p>
                      </div>
                    </CardContent>
                  </Card>
                </CollapsibleContent>
              </Collapsible>
            </motion.div>
          )}

          {step === 1 && (
            <motion.div key="checkout" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}>
              <button onClick={() => setStep(0)} className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground mb-6" data-testid="button-back">
                <ArrowLeft className="h-4 w-4" /> Back
              </button>

              <Card className="border-none shadow-sm">
                <CardContent className="p-6 space-y-5">
                  <div>
                    <p className="font-semibold text-foreground mb-1">Contributing ${finalAmount}</p>
                    <p className="text-sm text-muted-foreground">Your contribution becomes a long-term fund, managed by the family.</p>
                  </div>

                  <div className="space-y-4">
                    <div className="space-y-2">
                      <Label className="text-sm">Your name</Label>
                      <Input placeholder="How should we sign the card?" value={giverName} onChange={(e) => setGiverName(e.target.value)} className="h-11" data-testid="input-name" />
                    </div>
                    <div className="space-y-2">
                      <Label className="text-sm">Message (optional)</Label>
                      <Textarea placeholder={`Mazel Tov, ${MOMENT.recipient}!`} value={message} onChange={(e) => setMessage(e.target.value)} rows={3} data-testid="input-message" />
                    </div>
                  </div>

                  <div className="rounded-lg bg-muted/50 p-4 space-y-2 text-sm">
                    <div className="flex justify-between"><span className="text-muted-foreground">Gift</span><span className="font-medium">${finalAmount}</span></div>
                    <div className="flex justify-between"><span className="text-muted-foreground">Service fee</span><span className="font-medium">${fee}</span></div>
                    <hr className="border-border" />
                    <div className="flex justify-between"><span className="font-medium">Total</span><span className="font-semibold">${total}</span></div>
                  </div>

                  <Button onClick={handleConfirm} className="w-full h-12 text-base font-medium" data-testid="button-pay">
                    Pay ${total}
                  </Button>

                  <p className="text-xs text-center text-muted-foreground">Secure checkout • 256-bit encryption</p>
                </CardContent>
              </Card>
            </motion.div>
          )}

          {step === 2 && (
            <motion.div key="success" initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="animate-card-reveal">
              <Card className="border-none shadow-lg text-center">
                <CardContent className="p-8 space-y-6">
                  <motion.div 
                    initial={{ scale: 0 }} 
                    animate={{ scale: 1 }} 
                    transition={{ type: "spring", stiffness: 200, delay: 0.2 }}
                    className="mx-auto h-16 w-16 rounded-full bg-primary/10 flex items-center justify-center"
                  >
                    <Check className="h-8 w-8 text-primary" />
                  </motion.div>
                  
                  <div>
                    <p className="text-xl font-semibold text-foreground mb-1">Your card is ready</p>
                    <p className="text-muted-foreground">You contributed ${finalAmount} to {MOMENT.recipient}'s future.</p>
                  </div>

                  {/* Card preview */}
                  <div className="bg-gradient-to-br from-primary/5 to-primary/10 rounded-xl p-6 text-left border border-primary/10">
                    <p className="text-sm text-muted-foreground mb-2">From {giverName || "Anonymous"}</p>
                    <p className="text-foreground">{message || `Mazel Tov, ${MOMENT.recipient}!`}</p>
                    <p className="text-sm font-semibold text-primary mt-4">${finalAmount} contributed</p>
                  </div>

                  <div className="flex gap-2">
                    <Button variant="outline" className="flex-1" data-testid="button-share-text">
                      <MessageSquare className="mr-2 h-4 w-4" /> Text
                    </Button>
                    <Button variant="outline" className="flex-1" data-testid="button-share-email">
                      <Share2 className="mr-2 h-4 w-4" /> Email
                    </Button>
                    <Button variant="outline" className="flex-1" data-testid="button-print">
                      <Printer className="mr-2 h-4 w-4" /> Print
                    </Button>
                  </div>

                  <Link href="/">
                    <Button variant="ghost" className="w-full text-muted-foreground" data-testid="button-done">Done</Button>
                  </Link>
                </CardContent>
              </Card>
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      <footer className="p-6 text-center text-xs text-muted-foreground border-t">
        <a href="#" className="hover:text-foreground">Support</a> · <a href="#" className="hover:text-foreground">Privacy</a>
      </footer>
    </div>
  );
}
