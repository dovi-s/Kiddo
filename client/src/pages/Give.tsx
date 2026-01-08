import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Leaf, DollarSign, TrendingUp, Sprout, Check, ArrowLeft, CreditCard, Smartphone } from "lucide-react";
import { Link } from "wouter";
import { toast } from "@/hooks/use-toast";
import { motion, AnimatePresence } from "framer-motion";

const RECIPIENT = {
  name: "Ari",
  photo: "https://images.unsplash.com/photo-1488521787991-ed7bbaae773c?q=80&w=300&auto=format&fit=crop",
  moment: "Bar Mitzvah",
  date: "May 24, 2025"
};

const FUND_OPTIONS = [
  { id: "future", label: "Future Fund", desc: "Auto-invested in a diversified basket", icon: TrendingUp, recommended: true },
  { id: "seed", label: "Seed", desc: "Held until the guardian decides where to invest", icon: Sprout },
];

const AMOUNTS = ["36", "54", "100", "180", "360"];

export default function Give() {
  const [step, setStep] = useState(1);
  const [amount, setAmount] = useState("100");
  const [customAmount, setCustomAmount] = useState("");
  const [selectedFund, setSelectedFund] = useState("future");
  const [message, setMessage] = useState("");
  const [giverName, setGiverName] = useState("");

  const finalAmount = customAmount || amount;
  const fee = (Number(finalAmount) * 0.029 + 0.30).toFixed(2);
  const total = (Number(finalAmount) + Number(fee)).toFixed(2);

  const handleConfirm = () => {
    toast({ title: "Gift sent!", description: `You've contributed $${finalAmount} to ${RECIPIENT.name}'s future.` });
    setStep(3);
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-muted/30 font-sans flex flex-col">
      <header className="p-4 container mx-auto">
        <Link href="/">
          <a className="flex items-center gap-2 text-foreground hover:opacity-80 transition-opacity" data-testid="link-logo">
            <Leaf className="h-5 w-5 text-primary" />
            <span className="font-serif text-xl font-semibold">Everleaf</span>
          </a>
        </Link>
      </header>

      <main className="flex-grow flex items-center justify-center p-4">
        <AnimatePresence mode="wait">
          <motion.div
            key={step}
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -16 }}
            transition={{ duration: 0.3 }}
          >
            <Card className="w-full max-w-md shadow-2xl border-none">
              {step === 1 && (
                <>
                  <CardHeader className="text-center pb-6 pt-10">
                    <div className="mx-auto mb-4 h-24 w-24 overflow-hidden rounded-full border-4 border-card shadow-lg">
                      <img src={RECIPIENT.photo} alt={RECIPIENT.name} className="h-full w-full object-cover" />
                    </div>
                    <p className="font-serif text-3xl font-semibold text-foreground">{RECIPIENT.name}'s {RECIPIENT.moment}</p>
                    <p className="text-muted-foreground">{RECIPIENT.date}</p>
                  </CardHeader>
                  <CardContent className="space-y-8 pb-10">
                    <div className="space-y-3">
                      <Label className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Amount</Label>
                      <div className="grid grid-cols-5 gap-2">
                        {AMOUNTS.map((val) => (
                          <Button
                            key={val}
                            variant={amount === val && !customAmount ? "default" : "outline"}
                            onClick={() => { setAmount(val); setCustomAmount(""); }}
                            className="h-12 font-bold text-base"
                            data-testid={`button-amount-${val}`}
                          >
                            ${val}
                          </Button>
                        ))}
                      </div>
                      <div className="relative">
                        <DollarSign className="absolute left-3.5 top-3.5 h-4 w-4 text-muted-foreground" />
                        <Input
                          placeholder="Or enter custom amount"
                          value={customAmount}
                          onChange={(e) => setCustomAmount(e.target.value.replace(/[^0-9]/g, ""))}
                          className="pl-9 h-12 text-base"
                          data-testid="input-custom-amount"
                        />
                      </div>
                    </div>

                    <div className="space-y-3">
                      <Label className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Fund Type</Label>
                      <div className="space-y-2">
                        {FUND_OPTIONS.map((opt) => (
                          <button
                            key={opt.id}
                            onClick={() => setSelectedFund(opt.id)}
                            className={`w-full flex items-center gap-4 p-4 rounded-xl border-2 transition-all text-left ${
                              selectedFund === opt.id 
                                ? "border-primary bg-primary/5" 
                                : "border-border hover:border-primary/40"
                            }`}
                            data-testid={`button-fund-${opt.id}`}
                          >
                            <div className={`h-11 w-11 rounded-xl flex items-center justify-center ${
                              selectedFund === opt.id ? "bg-primary text-primary-foreground" : "bg-muted"
                            }`}>
                              <opt.icon className="h-5 w-5" />
                            </div>
                            <div className="flex-grow">
                              <p className="font-semibold text-foreground">{opt.label}</p>
                              <p className="text-xs text-muted-foreground">{opt.desc}</p>
                            </div>
                            {opt.recommended && <span className="text-[10px] font-bold uppercase text-primary bg-primary/10 px-2 py-1 rounded-full">Best</span>}
                            {selectedFund === opt.id && <Check className="h-5 w-5 text-primary" />}
                          </button>
                        ))}
                      </div>
                    </div>

                    <Button onClick={() => setStep(2)} className="w-full h-14 text-lg font-semibold" data-testid="button-continue">
                      Continue
                    </Button>
                  </CardContent>
                </>
              )}

              {step === 2 && (
                <>
                  <CardHeader className="pb-4 pt-8">
                    <button onClick={() => setStep(1)} className="text-muted-foreground hover:text-foreground transition-colors flex items-center gap-1 text-sm mb-4" data-testid="button-back">
                      <ArrowLeft className="h-4 w-4" /> Back
                    </button>
                    <p className="font-serif text-2xl font-semibold text-foreground">Add a personal touch</p>
                  </CardHeader>
                  <CardContent className="space-y-6 pb-10">
                    <div className="space-y-2">
                      <Label>Your Name</Label>
                      <Input placeholder="e.g. Uncle Dave" value={giverName} onChange={(e) => setGiverName(e.target.value)} className="h-12" data-testid="input-name" />
                    </div>
                    <div className="space-y-2">
                      <Label>Message for {RECIPIENT.name}</Label>
                      <Textarea placeholder={`Mazel Tov, ${RECIPIENT.name}! Watching you grow has been amazing...`} value={message} onChange={(e) => setMessage(e.target.value)} rows={4} data-testid="input-message" />
                    </div>

                    <div className="rounded-xl bg-muted/50 p-5 space-y-3 text-sm">
                      <div className="flex justify-between"><span className="text-muted-foreground">Gift</span><span className="font-semibold">${finalAmount}</span></div>
                      <div className="flex justify-between"><span className="text-muted-foreground">Processing fee</span><span className="font-semibold">${fee}</span></div>
                      <hr className="border-border" />
                      <div className="flex justify-between text-base"><span className="font-semibold">Total</span><span className="font-bold text-primary">${total}</span></div>
                    </div>

                    <div className="flex gap-3">
                      <Button onClick={handleConfirm} className="flex-1 h-14 text-lg font-semibold gap-2" data-testid="button-pay-card">
                        <CreditCard className="h-5 w-5" /> Pay ${total}
                      </Button>
                    </div>
                    <p className="text-xs text-center text-muted-foreground">Secure payment. 256-bit encryption.</p>
                  </CardContent>
                </>
              )}

              {step === 3 && (
                <CardContent className="text-center py-16 space-y-6">
                  <motion.div 
                    initial={{ scale: 0.8, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    transition={{ type: "spring", stiffness: 200, damping: 15 }}
                    className="mx-auto h-20 w-20 rounded-full bg-primary/10 flex items-center justify-center"
                  >
                    <Check className="h-10 w-10 text-primary" />
                  </motion.div>
                  <p className="font-serif text-3xl font-semibold text-foreground">Gift sent!</p>
                  <p className="text-muted-foreground max-w-xs mx-auto">
                    You've contributed ${finalAmount} to {RECIPIENT.name}'s future. They'll see your message.
                  </p>
                  <Link href="/"><Button variant="outline" className="w-full max-w-xs" data-testid="button-done">Done</Button></Link>
                </CardContent>
              )}
            </Card>
          </motion.div>
        </AnimatePresence>
      </main>

      <footer className="p-6 text-center text-xs text-muted-foreground">
        &copy; {new Date().getFullYear()} Everleaf Inc.
      </footer>
    </div>
  );
}
