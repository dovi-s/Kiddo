import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Gift, DollarSign, TrendingUp, Zap, GraduationCap, Check, ArrowLeft } from "lucide-react";
import { Link } from "wouter";
import { toast } from "@/hooks/use-toast";

const RECIPIENT = {
  name: "Leo",
  photo: "https://images.unsplash.com/photo-1488521787991-ed7bbaae773c?q=80&w=300&auto=format&fit=crop",
  event: "Bar Mitzvah",
  date: "May 24, 2025"
};

const GIFT_OPTIONS = [
  { id: "basket", label: "Growth Basket", desc: "Diversified index funds", icon: Zap, recommended: true },
  { id: "sp500", label: "S&P 500", desc: "Top 500 companies", icon: TrendingUp },
  { id: "education", label: "College Fund", desc: "529 education savings", icon: GraduationCap },
];

const AMOUNTS = ["36", "54", "100", "180", "360"];

export default function Give() {
  const [step, setStep] = useState(1);
  const [amount, setAmount] = useState("100");
  const [customAmount, setCustomAmount] = useState("");
  const [selectedGift, setSelectedGift] = useState("basket");
  const [message, setMessage] = useState("");
  const [giverName, setGiverName] = useState("");

  const finalAmount = customAmount || amount;

  const handleConfirm = () => {
    toast({
      title: "Gift Sent!",
      description: `You've gifted $${finalAmount} to ${RECIPIENT.name}. They'll receive your message.`,
    });
    setStep(3);
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-muted/30 font-sans flex flex-col">
      {/* Minimal Header */}
      <header className="p-4 flex items-center justify-between container mx-auto">
        <Link href="/">
          <a className="flex items-center gap-2 text-primary hover:opacity-80 transition-opacity">
            <div className="flex h-8 w-8 items-center justify-center rounded bg-primary text-primary-foreground">
              <Gift className="h-5 w-5" />
            </div>
            <span className="font-serif text-xl font-bold tracking-tight">DorVador</span>
          </a>
        </Link>
      </header>

      <main className="flex-grow flex items-center justify-center p-4">
        <Card className="w-full max-w-md shadow-2xl border-none">
          {step === 1 && (
            <>
              <CardHeader className="text-center pb-6">
                <div className="mx-auto mb-4 h-20 w-20 overflow-hidden rounded-full border-4 border-white shadow-lg">
                  <img src={RECIPIENT.photo} alt={RECIPIENT.name} className="h-full w-full object-cover" />
                </div>
                <CardTitle className="font-serif text-2xl">Gift to {RECIPIENT.name}</CardTitle>
                <CardDescription>{RECIPIENT.event} • {RECIPIENT.date}</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="space-y-3">
                  <Label className="text-sm font-bold">Select Amount</Label>
                  <div className="grid grid-cols-5 gap-2">
                    {AMOUNTS.map((val) => (
                      <Button
                        key={val}
                        variant={amount === val && !customAmount ? "default" : "outline"}
                        onClick={() => { setAmount(val); setCustomAmount(""); }}
                        className="h-12 font-bold"
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
                      onChange={(e) => setCustomAmount(e.target.value)}
                      className="pl-9 h-12"
                    />
                  </div>
                </div>

                <div className="space-y-3">
                  <Label className="text-sm font-bold">Where should it go?</Label>
                  <div className="space-y-2">
                    {GIFT_OPTIONS.map((opt) => (
                      <button
                        key={opt.id}
                        onClick={() => setSelectedGift(opt.id)}
                        className={`w-full flex items-center gap-4 p-4 rounded-xl border transition-all text-left ${
                          selectedGift === opt.id 
                            ? "border-primary bg-primary/5 ring-1 ring-primary" 
                            : "border-border hover:border-primary/50"
                        }`}
                      >
                        <div className={`h-10 w-10 rounded-lg flex items-center justify-center ${
                          selectedGift === opt.id ? "bg-primary text-primary-foreground" : "bg-muted"
                        }`}>
                          <opt.icon className="h-5 w-5" />
                        </div>
                        <div className="flex-grow">
                          <p className="font-bold text-sm">{opt.label}</p>
                          <p className="text-xs text-muted-foreground">{opt.desc}</p>
                        </div>
                        {opt.recommended && (
                          <span className="text-[10px] font-bold uppercase text-secondary bg-secondary/10 px-2 py-1 rounded">Best</span>
                        )}
                        {selectedGift === opt.id && (
                          <Check className="h-5 w-5 text-primary" />
                        )}
                      </button>
                    ))}
                  </div>
                </div>

                <Button onClick={() => setStep(2)} className="w-full h-12 text-lg font-bold">
                  Continue
                </Button>
              </CardContent>
            </>
          )}

          {step === 2 && (
            <>
              <CardHeader className="pb-4">
                <button onClick={() => setStep(1)} className="text-muted-foreground hover:text-primary transition-colors flex items-center gap-1 text-sm mb-4">
                  <ArrowLeft className="h-4 w-4" /> Back
                </button>
                <CardTitle className="font-serif text-2xl">Add a message</CardTitle>
                <CardDescription>Your gift will become fractional shares for {RECIPIENT.name}.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="space-y-2">
                  <Label>Your Name</Label>
                  <Input 
                    placeholder="Uncle Dave" 
                    value={giverName}
                    onChange={(e) => setGiverName(e.target.value)}
                    className="h-12"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Personal Message</Label>
                  <Textarea
                    placeholder={`Mazel Tov ${RECIPIENT.name}! Investing in your future...`}
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    rows={4}
                  />
                </div>

                <div className="rounded-xl bg-muted/50 p-4 space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Gift Amount</span>
                    <span className="font-bold">${finalAmount}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Processing</span>
                    <span className="font-bold">${(Number(finalAmount) * 0.029 + 0.30).toFixed(2)}</span>
                  </div>
                  <hr className="my-2" />
                  <div className="flex justify-between">
                    <span className="font-bold">Total</span>
                    <span className="font-bold text-lg">${(Number(finalAmount) * 1.029 + 0.30).toFixed(2)}</span>
                  </div>
                </div>

                <Button onClick={handleConfirm} className="w-full h-12 text-lg font-bold bg-secondary text-secondary-foreground hover:bg-secondary/90">
                  Confirm Gift
                </Button>
                <p className="text-xs text-center text-muted-foreground">
                  Secure payment powered by Stripe. 256-bit encryption.
                </p>
              </CardContent>
            </>
          )}

          {step === 3 && (
            <>
              <CardHeader className="text-center py-12">
                <div className="mx-auto mb-6 h-16 w-16 rounded-full bg-green-100 flex items-center justify-center">
                  <Check className="h-8 w-8 text-green-600" />
                </div>
                <CardTitle className="font-serif text-2xl">Gift Sent!</CardTitle>
                <CardDescription className="text-base mt-2">
                  You've invested ${finalAmount} in {RECIPIENT.name}'s future.
                </CardDescription>
              </CardHeader>
              <CardContent className="text-center space-y-6">
                <p className="text-sm text-muted-foreground">
                  {RECIPIENT.name} will see your message and can track how this gift grows over time.
                </p>
                <Link href="/">
                  <Button variant="outline" className="w-full">Return Home</Button>
                </Link>
              </CardContent>
            </>
          )}
        </Card>
      </main>

      <footer className="p-4 text-center text-xs text-muted-foreground">
        &copy; {new Date().getFullYear()} DorVador Inc. Not an investment advisor.
      </footer>
    </div>
  );
}
