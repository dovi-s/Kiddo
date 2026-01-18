import { useState } from "react";
import { Link, useParams, useLocation } from "wouter";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowLeft, Gift, CreditCard, Building2, Check, ChevronDown, Lock, Shield, Eye, EyeOff, Smartphone } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Nav } from "@/components/layout/Nav";
import { PageTransition } from "@/components/layout/PageTransition";
import { Celebration, SuccessGlow, CountUp } from "@/components/ui/celebration";
import { bouncySpring, gentleSpring, successPop, easeOutExpo, springSnappy } from "@/lib/animations";

const SUGGESTED_AMOUNTS = ["25", "50", "100", "250"];

export default function GiftCheckout() {
  const { fund, event } = useParams<{ fund: string; event?: string }>();
  const [, setLocation] = useLocation();
  
  const [amount, setAmount] = useState("50");
  const [customAmount, setCustomAmount] = useState("");
  const [paymentMethod, setPaymentMethod] = useState<'apple' | 'card' | 'bank'>('apple');
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [note, setNote] = useState("");
  const [hideFromOthers, setHideFromOthers] = useState(false);
  const [showDetails, setShowDetails] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isComplete, setIsComplete] = useState(false);
  
  const displayAmount = customAmount || amount;
  const numAmount = parseFloat(displayAmount) || 0;
  
  const cardFee = Math.max(1, Math.min(10, numAmount * 0.015));
  const isCardPayment = paymentMethod === 'card' || paymentMethod === 'apple';
  const processingFee = isCardPayment ? numAmount * 0.029 + 0.30 : 0.75;
  const platformFee = isCardPayment ? cardFee : Math.max(0.75, Math.min(10, numAmount * 0.01));
  const total = numAmount + processingFee + platformFee;
  
  const recipientName = fund ? fund.charAt(0).toUpperCase() + fund.slice(1) : "Recipient";
  const eventTitle = event ? event.split('-').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ') : null;

  const canQuickPay = numAmount >= 5 && paymentMethod === 'apple';
  const canSubmit = numAmount >= 5 && (paymentMethod === 'apple' || (name && email));

  const handleSubmitPayment = () => {
    if (!canQuickPay && !canSubmit) return;
    setIsProcessing(true);
    setTimeout(() => {
      setIsProcessing(false);
      setIsComplete(true);
    }, 2000);
  };

  if (isComplete) {
    return (
      <div className="min-h-screen bg-background font-sans">
        <Nav />
        <Celebration trigger={isComplete} intensity="grand" type="confetti" />
        <main className="container mx-auto px-4 py-12 max-w-md">
          <SuccessGlow trigger={isComplete}>
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              transition={bouncySpring}
            >
              <Card className="border-border shadow-xl text-center overflow-hidden">
                <motion.div 
                  className="h-2 bg-success"
                  initial={{ scaleX: 0, originX: 0 }}
                  animate={{ scaleX: 1 }}
                  transition={{ delay: 0.2, duration: 0.6 }}
                />
                <CardContent className="p-8 space-y-6">
                  <motion.div
                    className="h-16 w-16 rounded-full bg-success/10 flex items-center justify-center mx-auto relative"
                    variants={successPop}
                    initial="hidden"
                    animate="visible"
                  >
                  <motion.div
                    className="absolute inset-0 rounded-full bg-success/20"
                    initial={{ scale: 1, opacity: 0.5 }}
                    animate={{ scale: 1.5, opacity: 0 }}
                    transition={{ duration: 0.6, delay: 0.3 }}
                  />
                  <motion.div
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    transition={{ delay: 0.2, ...bouncySpring }}
                  >
                    <Check className="h-8 w-8 text-success" />
                  </motion.div>
                </motion.div>
                <div>
                  <h2 className="text-xl font-semibold mb-1 text-foreground">Gift sent!</h2>
                  <p className="text-muted-foreground">
                    ${displayAmount} to {recipientName}'s Future Fund
                  </p>
                </div>
                
                <div className="p-4 rounded-xl bg-muted text-left">
                  <div className="flex items-center gap-3 mb-3">
                    <div className="w-10 h-10 rounded-full bg-[hsl(var(--kora-gold))]/20 flex items-center justify-center">
                      <Gift className="w-5 h-5 text-[hsl(var(--kora-gold))]" />
                    </div>
                    <div>
                      <p className="text-sm font-medium text-foreground">${displayAmount}</p>
                      <p className="text-xs text-muted-foreground">Will invest at next market open</p>
                    </div>
                  </div>
                  <div className="space-y-1 text-xs text-muted-foreground border-t border-border pt-3">
                    <div className="flex justify-between">
                      <span>Status</span>
                      <span className="text-[hsl(var(--kora-gold))] font-medium flex items-center gap-1">
                        <span className="w-1.5 h-1.5 rounded-full bg-[hsl(var(--kora-gold))] animate-pulse"></span>
                        Processing
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span>Invests in</span>
                      <span className="text-foreground">~4 hours (9:30 AM ET)</span>
                    </div>
                  </div>
                </div>

                {note && (
                  <div className="p-3 rounded-lg bg-[hsl(var(--kora-gold))]/10 border border-[hsl(var(--kora-gold))]/20 text-left">
                    <p className="text-xs text-[hsl(var(--kora-gold))] mb-1">Your message</p>
                    <p className="text-sm text-foreground">"{note}"</p>
                  </div>
                )}

                <div className="space-y-2">
                  <Button 
                    className="w-full bg-primary hover:bg-primary/90"
                    onClick={() => {
                      navigator.share?.({ 
                        title: `I just gifted to ${recipientName}'s Future Fund!`,
                        url: window.location.origin + `/${fund}`
                      }).catch(() => {});
                    }}
                  >
                    Share this gift
                  </Button>
                  <Link href="/">
                    <Button variant="outline" className="w-full border-border text-foreground hover:bg-muted">Done</Button>
                  </Link>
                </div>

                <p className="text-[10px] text-muted-foreground">
                  Confirmation sent to {email}. Assets held by Alpaca Securities LLC, Member FINRA/SIPC.
                </p>
              </CardContent>
              </Card>
            </motion.div>
          </SuccessGlow>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background font-sans">
      <Nav />
      
      <main className="container mx-auto px-4 py-8 max-w-lg">
        <button 
          onClick={() => window.history.back()}
          className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground mb-6 transition-colors"
        >
          <ArrowLeft className="h-4 w-4" /> Back
        </button>

        <div className="text-center mb-6">
          <div className="w-14 h-14 rounded-full bg-[hsl(var(--kora-gold))]/15 flex items-center justify-center mx-auto mb-3">
            <Gift className="w-7 h-7 text-[hsl(var(--kora-gold))]" />
          </div>
          <h1 className="text-xl font-semibold text-foreground">
            Gift to {recipientName}'s Future Fund
          </h1>
          {eventTitle && (
            <p className="text-sm text-muted-foreground mt-1">{eventTitle}</p>
          )}
        </div>

        <Card className="border-border shadow-sm mb-4">
          <CardContent className="p-6">
            <Label className="text-sm font-medium text-foreground mb-3 block">Choose amount</Label>
            <div className="grid grid-cols-4 gap-2 mb-4">
              {SUGGESTED_AMOUNTS.map((amt) => (
                <motion.div
                  key={amt}
                  whileTap={{ scale: 0.95 }}
                  whileHover={{ scale: 1.02 }}
                  transition={gentleSpring}
                >
                  <Button
                    variant={amount === amt && !customAmount ? "default" : "outline"}
                    onClick={() => { setAmount(amt); setCustomAmount(""); }}
                    className={`h-12 w-full transition-all ${
                      amount === amt && !customAmount 
                        ? 'bg-primary text-primary-foreground shadow-md' 
                        : 'border-border text-foreground hover:bg-muted'
                    }`}
                    data-testid={`amount-${amt}`}
                  >
                    ${amt}
                  </Button>
                </motion.div>
              ))}
            </div>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">$</span>
              <Input
                type="number"
                placeholder="Other amount"
                value={customAmount}
                onChange={(e) => setCustomAmount(e.target.value)}
                className="pl-7 h-12 border-border bg-card text-foreground placeholder:text-muted-foreground"
                data-testid="input-custom-amount"
              />
            </div>
            {numAmount > 0 && numAmount < 5 && (
              <p className="text-xs text-muted-foreground mt-2">Minimum gift is $5</p>
            )}
          </CardContent>
        </Card>

        {paymentMethod === 'apple' && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-4"
          >
            <motion.button
              whileTap={{ scale: 0.98 }}
              onClick={handleSubmitPayment}
              disabled={!canQuickPay || isProcessing}
              className="w-full h-14 bg-black text-white rounded-xl font-medium flex items-center justify-center gap-2 disabled:opacity-50 shadow-lg"
              data-testid="button-apple-pay"
            >
              {isProcessing ? (
                <span>Processing...</span>
              ) : (
                <>
                  <svg viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5">
                    <path d="M17.05 20.28c-.98.95-2.05.8-3.08.35-1.09-.46-2.09-.48-3.24 0-1.44.62-2.2.44-3.06-.35C2.79 15.25 3.51 7.59 9.05 7.31c1.35.07 2.29.74 3.08.8 1.18-.24 2.31-.93 3.57-.84 1.51.12 2.65.72 3.4 1.8-3.12 1.87-2.38 5.98.48 7.13-.57 1.5-1.31 2.99-2.54 4.09l.01-.01zM12.03 7.25c-.15-2.23 1.66-4.07 3.74-4.25.29 2.58-2.34 4.5-3.74 4.25z"/>
                  </svg>
                  <span>Pay · ${total.toFixed(2)}</span>
                </>
              )}
            </motion.button>
            <p className="text-[10px] text-muted-foreground text-center mt-2 flex items-center justify-center gap-1">
              <Lock className="w-3 h-3" />
              Instant checkout with Apple Pay
            </p>
          </motion.div>
        )}

        <button
          onClick={() => setShowDetails(!showDetails)}
          className="w-full flex items-center justify-between p-4 rounded-xl bg-muted mb-4 transition-colors hover:bg-muted/80"
          data-testid="button-show-details"
        >
          <span className="text-sm font-medium text-foreground">
            {paymentMethod === 'apple' ? 'Add a note or change payment' : 'Your details & payment'}
          </span>
          <ChevronDown className={`w-4 h-4 text-muted-foreground transition-transform ${showDetails ? 'rotate-180' : ''}`} />
        </button>

        <AnimatePresence>
          {showDetails && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              className="space-y-4 overflow-hidden"
            >
              <Card className="border-border shadow-sm">
                <CardContent className="p-5 space-y-4">
                  <h2 className="text-sm font-semibold text-foreground">Your details</h2>
                  <p className="text-xs text-muted-foreground -mt-2">So {recipientName} knows who sent this gift</p>
                  
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <Label className="text-sm font-medium text-foreground">Your name</Label>
                      <Input
                        placeholder="Jane Smith"
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        className="h-11 border-border bg-card text-foreground placeholder:text-muted-foreground"
                        data-testid="input-name"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label className="text-sm font-medium text-foreground">Email</Label>
                      <Input
                        type="email"
                        placeholder="jane@example.com"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        className="h-11 border-border bg-card text-foreground placeholder:text-muted-foreground"
                        data-testid="input-email"
                      />
                      <p className="text-xs text-muted-foreground">For your receipt and confirmation</p>
                    </div>
                  </div>

                  <div className="pt-2 border-t border-border">
                    <div className="flex items-center justify-between py-3">
                      <div className="flex items-center gap-2">
                        {hideFromOthers ? (
                          <EyeOff className="w-4 h-4 text-muted-foreground" />
                        ) : (
                          <Eye className="w-4 h-4 text-muted-foreground" />
                        )}
                        <div>
                          <p className="text-sm font-medium text-foreground">Hide my name from others</p>
                          <p className="text-xs text-muted-foreground">
                            {hideFromOthers 
                              ? "Only the recipient will see your name" 
                              : "Your name will appear on the contributor list"}
                          </p>
                        </div>
                      </div>
                      <Switch
                        checked={hideFromOthers}
                        onCheckedChange={setHideFromOthers}
                        data-testid="toggle-hide-name"
                      />
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card className="border-border shadow-sm">
                <CardContent className="p-5 space-y-4">
                  <Label className="text-sm font-medium text-foreground">Add a note (optional)</Label>
                  <Textarea
                    placeholder="Happy birthday! This is for your future..."
                    value={note}
                    onChange={(e) => setNote(e.target.value)}
                    className="resize-none border-border bg-card text-foreground placeholder:text-muted-foreground"
                    rows={3}
                    data-testid="input-note"
                  />
                </CardContent>
              </Card>

              <Card className="border-border shadow-sm">
                <CardContent className="p-5">
                  <h2 className="text-sm font-semibold text-foreground mb-3">Payment method</h2>
                  
                  <div className="space-y-2">
                    <button
                      onClick={() => setPaymentMethod('apple')}
                      className={`w-full p-3.5 rounded-lg border-2 transition-all flex items-center gap-3 ${
                        paymentMethod === 'apple' 
                          ? 'border-primary bg-primary/5' 
                          : 'border-border hover:border-muted-foreground/30'
                      }`}
                      data-testid="payment-apple"
                    >
                      <div className={`w-5 h-5 flex items-center justify-center ${paymentMethod === 'apple' ? 'text-primary' : 'text-muted-foreground'}`}>
                        <svg viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5">
                          <path d="M17.05 20.28c-.98.95-2.05.8-3.08.35-1.09-.46-2.09-.48-3.24 0-1.44.62-2.2.44-3.06-.35C2.79 15.25 3.51 7.59 9.05 7.31c1.35.07 2.29.74 3.08.8 1.18-.24 2.31-.93 3.57-.84 1.51.12 2.65.72 3.4 1.8-3.12 1.87-2.38 5.98.48 7.13-.57 1.5-1.31 2.99-2.54 4.09l.01-.01zM12.03 7.25c-.15-2.23 1.66-4.07 3.74-4.25.29 2.58-2.34 4.5-3.74 4.25z"/>
                        </svg>
                      </div>
                      <div className="text-left flex-1">
                        <p className="text-sm font-medium text-foreground">Apple Pay</p>
                        <p className="text-xs text-muted-foreground">Fastest · 2.9% + $0.30</p>
                      </div>
                      {paymentMethod === 'apple' && <Check className="w-4 h-4 text-primary" />}
                    </button>
                    
                    <button
                      onClick={() => setPaymentMethod('card')}
                      className={`w-full p-3 rounded-lg border-2 transition-all flex items-center gap-3 ${
                        paymentMethod === 'card' 
                          ? 'border-primary bg-primary/5' 
                          : 'border-border hover:border-muted-foreground/30'
                      }`}
                      data-testid="payment-card"
                    >
                      <CreditCard className={`w-5 h-5 ${paymentMethod === 'card' ? 'text-primary' : 'text-muted-foreground'}`} />
                      <div className="text-left flex-1">
                        <p className="text-sm font-medium text-foreground">Card</p>
                        <p className="text-xs text-muted-foreground">Instant · 2.9% + $0.30</p>
                      </div>
                      {paymentMethod === 'card' && <Check className="w-4 h-4 text-primary" />}
                    </button>
                    
                    <button
                      onClick={() => setPaymentMethod('bank')}
                      className={`w-full p-3 rounded-lg border-2 transition-all flex items-center gap-3 ${
                        paymentMethod === 'bank' 
                          ? 'border-primary bg-primary/5' 
                          : 'border-border hover:border-muted-foreground/30'
                      }`}
                      data-testid="payment-bank"
                    >
                      <Building2 className={`w-5 h-5 ${paymentMethod === 'bank' ? 'text-primary' : 'text-muted-foreground'}`} />
                      <div className="text-left flex-1">
                        <p className="text-sm font-medium text-foreground">Bank transfer</p>
                        <p className="text-xs text-muted-foreground">2-3 days · $0.75</p>
                      </div>
                      {paymentMethod === 'bank' && <Check className="w-4 h-4 text-primary" />}
                    </button>
                  </div>
                </CardContent>
              </Card>

              {paymentMethod === 'card' && (
                <Card className="border-border shadow-sm">
                  <CardContent className="p-5 space-y-4">
                    <div className="space-y-2">
                      <Label className="text-sm font-medium text-foreground">Card number</Label>
                      <Input placeholder="4242 4242 4242 4242" className="h-11 border-border bg-card" data-testid="input-card-number" />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label className="text-sm font-medium text-foreground">Expiry</Label>
                        <Input placeholder="MM/YY" className="h-11 border-border bg-card" data-testid="input-card-expiry" />
                      </div>
                      <div className="space-y-2">
                        <Label className="text-sm font-medium text-foreground">CVC</Label>
                        <Input placeholder="123" className="h-11 border-border bg-card" data-testid="input-card-cvc" />
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )}

              <Card className="border-border shadow-sm bg-muted">
                <CardContent className="p-4">
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Gift amount</span>
                      <span className="text-foreground">${numAmount.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Processing fee</span>
                      <span className="text-foreground">${processingFee.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Kora fee</span>
                      <span className="text-foreground">${platformFee.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between font-medium pt-2 border-t border-border">
                      <span className="text-foreground">Total</span>
                      <span className="text-foreground">${total.toFixed(2)}</span>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Button 
                className="w-full h-12 text-base bg-primary hover:bg-primary/90"
                onClick={handleSubmitPayment}
                disabled={!canSubmit || isProcessing}
                data-testid="button-complete-gift"
              >
                {isProcessing ? (
                  <>Processing...</>
                ) : (
                  <>
                    <Lock className="w-4 h-4 mr-2" />
                    Complete gift · ${total.toFixed(2)}
                  </>
                )}
              </Button>

              <div className="flex items-center justify-center gap-4 text-xs text-muted-foreground">
                <div className="flex items-center gap-1">
                  <Lock className="w-3 h-3" />
                  <span>Secure payment</span>
                </div>
                <div className="flex items-center gap-1">
                  <Shield className="w-3 h-3" />
                  <span>SIPC protected</span>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {!showDetails && !canSubmit && (
          <p className="text-xs text-muted-foreground text-center">
            Expand "Your details" above to enter your name and email
          </p>
        )}
      </main>
    </div>
  );
}
