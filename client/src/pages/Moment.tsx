import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Leaf, DollarSign, TrendingUp, Sprout, Check, ArrowLeft, Users, Target } from "lucide-react";
import { Link } from "wouter";
import { toast } from "@/hooks/use-toast";
import { motion, AnimatePresence } from "framer-motion";
import { Progress } from "@/components/ui/progress";

const MOMENT = {
  title: "Ari's Bar Mitzvah",
  recipient: "Ari",
  photo: "https://images.unsplash.com/photo-1488521787991-ed7bbaae773c?q=80&w=400&auto=format&fit=crop",
  date: "May 24, 2025",
  message: "Help Ari build his future! Instead of things that break, we're asking for contributions to his lifelong investment fund.",
  theme: "elegant",
  goal: 5000,
  raised: 4250,
  contributors: 18,
};

const FUND_OPTIONS = [
  { id: "future", label: "Future Fund", desc: "Auto-invested diversified basket", icon: TrendingUp, recommended: true },
  { id: "seed", label: "Seed", desc: "Held until Ari decides", icon: Sprout },
];

const AMOUNTS = ["36", "54", "100", "180", "360"];

export default function Moment() {
  const [step, setStep] = useState(0);
  const [amount, setAmount] = useState("100");
  const [customAmount, setCustomAmount] = useState("");
  const [selectedFund, setSelectedFund] = useState("future");
  const [message, setMessage] = useState("");
  const [giverName, setGiverName] = useState("");

  const finalAmount = customAmount || amount;
  const fee = (Number(finalAmount) * 0.029 + 0.30).toFixed(2);
  const total = (Number(finalAmount) + Number(fee)).toFixed(2);
  const progress = (MOMENT.raised / MOMENT.goal) * 100;

  const handleConfirm = () => {
    toast({ title: "Gift sent!", description: `You've contributed $${finalAmount} to ${MOMENT.recipient}'s future.` });
    setStep(2);
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-primary/5 to-background font-sans">
      <header className="p-4 container mx-auto flex justify-between items-center">
        <Link href="/">
          <a className="flex items-center gap-2 text-foreground hover:opacity-80 transition-opacity">
            <Leaf className="h-5 w-5 text-primary" />
            <span className="font-serif text-xl font-semibold">Everleaf</span>
          </a>
        </Link>
      </header>

      <main className="container mx-auto px-4 py-8">
        <div className="max-w-4xl mx-auto">
          {step === 0 && (
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}>
              {/* Hero Card */}
              <Card className="overflow-hidden border-none shadow-2xl mb-8">
                <div className="relative h-64 md:h-80">
                  <img src={MOMENT.photo} alt={MOMENT.recipient} className="w-full h-full object-cover" />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/20 to-transparent" />
                  <div className="absolute bottom-0 left-0 right-0 p-8 text-white">
                    <p className="text-sm font-medium opacity-80 mb-2">{MOMENT.date}</p>
                    <h1 className="font-serif text-4xl md:text-5xl font-semibold">{MOMENT.title}</h1>
                  </div>
                </div>
                <CardContent className="p-8 space-y-6">
                  <p className="text-lg text-muted-foreground leading-relaxed">{MOMENT.message}</p>
                  
                  <div className="space-y-3">
                    <div className="flex justify-between items-end">
                      <div>
                        <p className="text-3xl font-bold text-foreground">${MOMENT.raised.toLocaleString()}</p>
                        <p className="text-sm text-muted-foreground">raised of ${MOMENT.goal.toLocaleString()} goal</p>
                      </div>
                      <div className="text-right">
                        <p className="text-2xl font-bold text-foreground">{MOMENT.contributors}</p>
                        <p className="text-sm text-muted-foreground">contributors</p>
                      </div>
                    </div>
                    <Progress value={progress} className="h-3" />
                  </div>

                  <Button onClick={() => setStep(1)} size="lg" className="w-full h-14 text-lg font-semibold" data-testid="button-contribute">
                    Contribute to {MOMENT.recipient}'s Future
                  </Button>
                </CardContent>
              </Card>

              {/* Contributors Preview */}
              <Card className="border-none shadow-sm">
                <CardHeader className="pb-4">
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <Users className="h-5 w-5" />
                    <span className="font-medium">Recent Contributors</span>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="flex flex-wrap gap-3">
                    {["Uncle Dave", "Grandma Ruth", "The Cohens", "Aunt Lisa", "The Goldbergs"].map((name, i) => (
                      <div key={i} className="flex items-center gap-2 bg-muted/50 rounded-full px-4 py-2">
                        <div className="h-6 w-6 rounded-full bg-primary/20 flex items-center justify-center text-xs font-bold text-primary">
                          {name.charAt(0)}
                        </div>
                        <span className="text-sm font-medium">{name}</span>
                      </div>
                    ))}
                    <div className="flex items-center gap-2 bg-muted/50 rounded-full px-4 py-2">
                      <span className="text-sm text-muted-foreground">+13 more</span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          )}

          {step === 1 && (
            <AnimatePresence mode="wait">
              <motion.div key="contribute" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }}>
                <Card className="max-w-md mx-auto border-none shadow-2xl">
                  <CardHeader className="pb-4 pt-8">
                    <button onClick={() => setStep(0)} className="text-muted-foreground hover:text-foreground transition-colors flex items-center gap-1 text-sm mb-4">
                      <ArrowLeft className="h-4 w-4" /> Back
                    </button>
                    <p className="font-serif text-2xl font-semibold text-foreground">Contribute to {MOMENT.recipient}</p>
                  </CardHeader>
                  <CardContent className="space-y-6 pb-10">
                    <div className="space-y-3">
                      <Label className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Amount</Label>
                      <div className="grid grid-cols-5 gap-2">
                        {AMOUNTS.map((val) => (
                          <Button key={val} variant={amount === val && !customAmount ? "default" : "outline"} onClick={() => { setAmount(val); setCustomAmount(""); }} className="h-12 font-bold">
                            ${val}
                          </Button>
                        ))}
                      </div>
                      <div className="relative">
                        <DollarSign className="absolute left-3.5 top-3.5 h-4 w-4 text-muted-foreground" />
                        <Input placeholder="Custom amount" value={customAmount} onChange={(e) => setCustomAmount(e.target.value.replace(/[^0-9]/g, ""))} className="pl-9 h-12" />
                      </div>
                    </div>

                    <div className="space-y-3">
                      <Label className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Fund</Label>
                      <div className="space-y-2">
                        {FUND_OPTIONS.map((opt) => (
                          <button key={opt.id} onClick={() => setSelectedFund(opt.id)} className={`w-full flex items-center gap-4 p-4 rounded-xl border-2 transition-all text-left ${selectedFund === opt.id ? "border-primary bg-primary/5" : "border-border hover:border-primary/40"}`}>
                            <div className={`h-10 w-10 rounded-xl flex items-center justify-center ${selectedFund === opt.id ? "bg-primary text-primary-foreground" : "bg-muted"}`}>
                              <opt.icon className="h-5 w-5" />
                            </div>
                            <div className="flex-grow">
                              <p className="font-semibold">{opt.label}</p>
                              <p className="text-xs text-muted-foreground">{opt.desc}</p>
                            </div>
                            {opt.recommended && <span className="text-[10px] font-bold uppercase text-primary bg-primary/10 px-2 py-1 rounded-full">Best</span>}
                            {selectedFund === opt.id && <Check className="h-5 w-5 text-primary" />}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div className="space-y-3">
                      <Label>Your Name</Label>
                      <Input placeholder="e.g. Uncle Dave" value={giverName} onChange={(e) => setGiverName(e.target.value)} className="h-12" />
                    </div>

                    <div className="space-y-3">
                      <Label>Message for {MOMENT.recipient}</Label>
                      <Textarea placeholder={`Mazel Tov, ${MOMENT.recipient}!`} value={message} onChange={(e) => setMessage(e.target.value)} rows={3} />
                    </div>

                    <div className="rounded-xl bg-muted/50 p-5 space-y-2 text-sm">
                      <div className="flex justify-between"><span className="text-muted-foreground">Gift</span><span className="font-semibold">${finalAmount}</span></div>
                      <div className="flex justify-between"><span className="text-muted-foreground">Fee</span><span className="font-semibold">${fee}</span></div>
                      <hr />
                      <div className="flex justify-between text-base"><span className="font-semibold">Total</span><span className="font-bold text-primary">${total}</span></div>
                    </div>

                    <Button onClick={handleConfirm} className="w-full h-14 text-lg font-semibold">Confirm Gift</Button>
                  </CardContent>
                </Card>
              </motion.div>
            </AnimatePresence>
          )}

          {step === 2 && (
            <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="max-w-md mx-auto">
              <Card className="border-none shadow-2xl text-center py-16">
                <CardContent className="space-y-6">
                  <motion.div initial={{ scale: 0.5 }} animate={{ scale: 1 }} transition={{ type: "spring", stiffness: 200 }} className="mx-auto h-20 w-20 rounded-full bg-primary/10 flex items-center justify-center">
                    <Check className="h-10 w-10 text-primary" />
                  </motion.div>
                  <div>
                    <p className="font-serif text-3xl font-semibold text-foreground">Gift Sent!</p>
                    <p className="text-muted-foreground mt-2">You've contributed ${finalAmount} to {MOMENT.recipient}'s future.</p>
                  </div>
                  <div className="bg-muted/30 rounded-xl p-6 text-left space-y-3">
                    <p className="text-sm text-muted-foreground">Your contribution will appear in {MOMENT.recipient}'s timeline with your message.</p>
                  </div>
                  <Link href="/"><Button variant="outline" className="w-full">Done</Button></Link>
                </CardContent>
              </Card>
            </motion.div>
          )}
        </div>
      </main>

      <footer className="p-6 text-center text-xs text-muted-foreground">
        &copy; {new Date().getFullYear()} Everleaf Inc.
      </footer>
    </div>
  );
}
