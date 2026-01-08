import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Leaf, DollarSign, Check, ArrowLeft, ChevronDown } from "lucide-react";
import { Link, useSearch } from "wouter";
import { toast } from "@/hooks/use-toast";
import { motion, AnimatePresence } from "framer-motion";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";

const AMOUNTS = ["25", "50", "100", "200"];

export default function Moment() {
  const search = useSearch();
  const params = new URLSearchParams(search);
  const recipientName = decodeURIComponent(params.get("name") || "Ari");
  const eventTitle = decodeURIComponent(params.get("title") || `${recipientName}'s Fund`);

  const [step, setStep] = useState(0);
  const [amount, setAmount] = useState("50");
  const [customAmount, setCustomAmount] = useState("");
  const [message, setMessage] = useState("");
  const [giverName, setGiverName] = useState("");
  const [showDetails, setShowDetails] = useState(false);

  const finalAmount = customAmount || amount;
  const fee = (Number(finalAmount) * 0.03).toFixed(2);
  const total = (Number(finalAmount) + Number(fee)).toFixed(2);

  const handleContinue = () => setStep(1);
  const handleConfirm = () => {
    toast({ title: "Gift sent", description: `$${finalAmount} contributed to ${recipientName}'s fund.` });
    setStep(2);
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="p-4 border-b">
        <div className="container mx-auto flex justify-between items-center">
          <Link href="/">
            <a className="flex items-center gap-2 text-foreground">
              <Leaf className="h-5 w-5 text-primary" />
              <span className="font-semibold">Everleaf</span>
            </a>
          </Link>
        </div>
      </header>

      <main className="container mx-auto px-4 py-10 max-w-md">
        <AnimatePresence mode="wait">
          {step === 0 && (
            <motion.div key="amount" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
              <div className="text-center mb-10">
                <div className="mx-auto mb-5 h-14 w-14 rounded-full bg-foreground/5 flex items-center justify-center text-xl font-semibold text-foreground">
                  {recipientName.charAt(0)}
                </div>
                <h1 className="text-xl font-semibold text-foreground">{eventTitle}</h1>
                <p className="text-muted-foreground text-sm mt-1">Give a gift that grows.</p>
              </div>

              <Card className="border">
                <CardContent className="p-6 space-y-6">
                  <div className="space-y-3">
                    <Label className="text-sm text-muted-foreground">Amount</Label>
                    <div className="grid grid-cols-4 gap-2">
                      {AMOUNTS.map((val) => (
                        <Button
                          key={val}
                          variant={amount === val && !customAmount ? "default" : "outline"}
                          onClick={() => { setAmount(val); setCustomAmount(""); }}
                          className="h-12"
                          data-testid={`button-amount-${val}`}
                        >
                          ${val}
                        </Button>
                      ))}
                    </div>
                    <div className="relative">
                      <DollarSign className="absolute left-3 top-3.5 h-4 w-4 text-muted-foreground" />
                      <Input
                        placeholder="Other amount"
                        value={customAmount}
                        onChange={(e) => setCustomAmount(e.target.value.replace(/[^0-9]/g, ""))}
                        className="pl-9 h-12"
                        data-testid="input-custom-amount"
                      />
                    </div>
                  </div>

                  <div className="space-y-3">
                    <Label className="text-sm text-muted-foreground">Your name</Label>
                    <Input 
                      placeholder="First and last" 
                      value={giverName} 
                      onChange={(e) => setGiverName(e.target.value)} 
                      className="h-12"
                      data-testid="input-giver-name"
                    />
                  </div>

                  <div className="space-y-3">
                    <Label className="text-sm text-muted-foreground">Message (optional)</Label>
                    <Textarea 
                      placeholder={`A note for ${recipientName}...`}
                      value={message}
                      onChange={(e) => setMessage(e.target.value)}
                      className="min-h-[80px] resize-none"
                      data-testid="input-message"
                    />
                  </div>

                  <Button className="w-full h-12" onClick={handleContinue} data-testid="button-continue">
                    Continue
                  </Button>
                </CardContent>
              </Card>

              <Collapsible open={showDetails} onOpenChange={setShowDetails}>
                <CollapsibleTrigger asChild>
                  <button className="w-full flex items-center justify-center gap-2 p-4 text-sm text-muted-foreground hover:text-foreground">
                    How it works
                    <ChevronDown className={`h-4 w-4 transition-transform ${showDetails ? "rotate-180" : ""}`} />
                  </button>
                </CollapsibleTrigger>
                <CollapsibleContent>
                  <Card className="border mt-2">
                    <CardContent className="p-5 space-y-4 text-sm text-muted-foreground">
                      <p><strong className="text-foreground">Where it goes:</strong> Directly into {recipientName}'s brokerage account. Invests automatically.</p>
                      <p><strong className="text-foreground">Who controls it:</strong> {recipientName}'s parent until they reach 18-21.</p>
                      <p><strong className="text-foreground">Fees:</strong> ~3% at checkout. No hidden fees.</p>
                      <p><strong className="text-foreground">Refunds:</strong> Available before investment. Not after.</p>
                      <p className="text-xs pt-2 border-t">Brokerage by [Broker-Dealer], Member FINRA/SIPC. Clearing by Apex.</p>
                    </CardContent>
                  </Card>
                </CollapsibleContent>
              </Collapsible>
            </motion.div>
          )}

          {step === 1 && (
            <motion.div key="confirm" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
              <button onClick={() => setStep(0)} className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground mb-8">
                <ArrowLeft className="h-4 w-4" /> Back
              </button>

              <h1 className="text-xl font-semibold text-foreground mb-6">Confirm your gift</h1>

              <Card className="border">
                <CardContent className="p-6 space-y-4">
                  <div className="flex justify-between py-2">
                    <span className="text-muted-foreground">Gift amount</span>
                    <span className="font-medium">${finalAmount}</span>
                  </div>
                  <div className="flex justify-between py-2">
                    <span className="text-muted-foreground">Processing</span>
                    <span className="font-medium">${fee}</span>
                  </div>
                  <div className="flex justify-between py-2 border-t pt-4">
                    <span className="font-medium">Total</span>
                    <span className="font-semibold text-lg">${total}</span>
                  </div>
                </CardContent>
              </Card>

              <div className="mt-6 p-4 rounded-md border text-sm">
                <p className="text-muted-foreground">To</p>
                <p className="font-medium">{recipientName}'s Fund</p>
                {giverName && (
                  <>
                    <p className="text-muted-foreground mt-3">From</p>
                    <p className="font-medium">{giverName}</p>
                  </>
                )}
                {message && (
                  <>
                    <p className="text-muted-foreground mt-3">Message</p>
                    <p className="font-medium">{message}</p>
                  </>
                )}
              </div>

              <Button className="w-full h-12 mt-6" onClick={handleConfirm} data-testid="button-confirm">
                Pay ${total}
              </Button>

              <p className="text-xs text-muted-foreground text-center mt-4">
                Encrypted. Apple Pay, cards, or bank.
              </p>
            </motion.div>
          )}

          {step === 2 && (
            <motion.div key="done" initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="text-center py-12">
              <div className="mx-auto h-16 w-16 rounded-full bg-foreground flex items-center justify-center mb-6">
                <Check className="h-8 w-8 text-background" />
              </div>
              <h1 className="text-xl font-semibold text-foreground mb-2">Gift sent</h1>
              <p className="text-muted-foreground mb-8">
                ${finalAmount} is on its way to {recipientName}'s fund.
              </p>
              <Link href="/">
                <Button variant="outline">Done</Button>
              </Link>
            </motion.div>
          )}
        </AnimatePresence>
      </main>
    </div>
  );
}
