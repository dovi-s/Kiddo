import { useState } from "react";
import { Link, useParams, useLocation } from "wouter";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowLeft, Gift, CreditCard, Building2, Check, Heart, ChevronRight, Lock, Shield, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import { Nav } from "@/components/layout/Nav";
import { bouncySpring, gentleSpring, successPop } from "@/lib/animations";
import { ProcessingDots } from "@/components/ui/shimmer";

const SUGGESTED_AMOUNTS = ["25", "50", "100", "250"];

export default function GiftCheckout() {
  const { fund, event } = useParams<{ fund: string; event?: string }>();
  const [, setLocation] = useLocation();
  
  const [step, setStep] = useState<'amount' | 'details' | 'payment' | 'confirmation'>('amount');
  const [amount, setAmount] = useState("50");
  const [customAmount, setCustomAmount] = useState("");
  const [paymentMethod, setPaymentMethod] = useState<'card' | 'bank'>('card');
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [note, setNote] = useState("");
  const [isProcessing, setIsProcessing] = useState(false);
  
  const displayAmount = customAmount || amount;
  const numAmount = parseFloat(displayAmount) || 0;
  
  const cardFee = Math.max(1, Math.min(10, numAmount * 0.015));
  const processingFee = paymentMethod === 'card' ? numAmount * 0.029 + 0.30 : 0.75;
  const platformFee = paymentMethod === 'card' ? cardFee : Math.max(0.75, Math.min(10, numAmount * 0.01));
  const total = numAmount + processingFee + platformFee;
  
  const recipientName = fund ? fund.charAt(0).toUpperCase() + fund.slice(1) : "Recipient";
  const eventTitle = event ? event.split('-').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ') : null;

  const handleSubmitPayment = () => {
    setIsProcessing(true);
    setTimeout(() => {
      setIsProcessing(false);
      setStep('confirmation');
    }, 2000);
  };

  if (step === 'confirmation') {
    return (
      <div className="min-h-screen bg-gradient-to-b from-stone-50 to-white font-sans">
        <Nav />
        <main className="container mx-auto px-4 py-12 max-w-md">
          <motion.div
            initial={{ opacity: 0, scale: 0.9, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            transition={bouncySpring}
          >
            <Card className="border-none shadow-xl text-center overflow-hidden">
              <motion.div 
                className="h-2 bg-gradient-to-r from-emerald-400 via-emerald-500 to-teal-400"
                initial={{ scaleX: 0, originX: 0 }}
                animate={{ scaleX: 1 }}
                transition={{ delay: 0.2, duration: 0.6 }}
              />
              <CardContent className="p-8 space-y-6">
                <motion.div
                  className="h-16 w-16 rounded-full bg-emerald-100 flex items-center justify-center mx-auto relative"
                  variants={successPop}
                  initial="hidden"
                  animate="visible"
                >
                  <motion.div
                    className="absolute inset-0 rounded-full bg-emerald-200"
                    initial={{ scale: 1, opacity: 0.5 }}
                    animate={{ scale: 1.5, opacity: 0 }}
                    transition={{ duration: 0.6, delay: 0.3 }}
                  />
                  <motion.div
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    transition={{ delay: 0.2, ...bouncySpring }}
                  >
                    <Check className="h-8 w-8 text-emerald-600" />
                  </motion.div>
                </motion.div>
                <div>
                  <h2 className="text-xl font-semibold mb-1 text-stone-900">Gift sent!</h2>
                  <p className="text-stone-500">
                    ${displayAmount} to {recipientName}'s Future Fund
                  </p>
                </div>
                
                <div className="p-4 rounded-xl bg-stone-50 text-left">
                  <div className="flex items-center gap-3 mb-3">
                    <div className="w-10 h-10 rounded-full bg-gradient-to-br from-stone-200 to-stone-300 flex items-center justify-center">
                      <Gift className="w-5 h-5 text-stone-600" />
                    </div>
                    <div>
                      <p className="text-sm font-medium text-stone-900">${displayAmount}</p>
                      <p className="text-xs text-stone-500">Will invest at next market open</p>
                    </div>
                  </div>
                  <div className="space-y-1 text-xs text-stone-500 border-t border-stone-200 pt-3">
                    <div className="flex justify-between">
                      <span>Status</span>
                      <span className="text-amber-600 font-medium flex items-center gap-1">
                        <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse"></span>
                        Processing
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span>Invests in</span>
                      <span className="text-stone-700">~4 hours (9:30 AM ET)</span>
                    </div>
                  </div>
                </div>

                {note && (
                  <div className="p-3 rounded-lg bg-rose-50 border border-rose-100 text-left">
                    <p className="text-xs text-rose-400 mb-1">Your message</p>
                    <p className="text-sm text-stone-700">"{note}"</p>
                  </div>
                )}

                <div className="space-y-2">
                  <Button 
                    className="w-full"
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
                    <Button variant="outline" className="w-full">Done</Button>
                  </Link>
                </div>

                <p className="text-[10px] text-stone-400">
                  Confirmation sent to {email}. Assets held by Alpaca Securities LLC, Member FINRA/SIPC.
                </p>
              </CardContent>
            </Card>
          </motion.div>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-stone-50 to-white font-sans">
      <Nav />
      
      <main className="container mx-auto px-4 py-8 max-w-lg">
        <button 
          onClick={() => step === 'amount' ? setLocation(`/${fund}${event ? `/${event}` : ''}`) : setStep(step === 'payment' ? 'details' : 'amount')}
          className="flex items-center gap-1 text-sm text-stone-500 hover:text-stone-900 mb-6 transition-colors"
        >
          <ArrowLeft className="h-4 w-4" /> {step === 'amount' ? 'Back to page' : 'Back'}
        </button>

        <div className="mb-8">
          <div className="flex items-center gap-2 mb-2">
            {['amount', 'details', 'payment'].map((s, i) => (
              <div key={s} className="flex items-center">
                <motion.div 
                  className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-medium ${
                    step === s ? 'bg-stone-900 text-white' : 
                    ['amount', 'details', 'payment'].indexOf(step) > i ? 'bg-emerald-500 text-white' : 'bg-stone-200 text-stone-500'
                  }`}
                  animate={step === s ? { scale: [1, 1.1, 1] } : {}}
                  transition={{ duration: 0.3 }}
                >
                  {['amount', 'details', 'payment'].indexOf(step) > i ? (
                    <motion.div
                      initial={{ scale: 0 }}
                      animate={{ scale: 1 }}
                      transition={bouncySpring}
                    >
                      <Check className="w-3.5 h-3.5" />
                    </motion.div>
                  ) : i + 1}
                </motion.div>
                {i < 2 && (
                  <motion.div 
                    className={`w-10 h-0.5 mx-1 origin-left ${['amount', 'details', 'payment'].indexOf(step) > i ? 'bg-emerald-500' : 'bg-stone-200'}`}
                    initial={{ scaleX: 0 }}
                    animate={{ scaleX: 1 }}
                    transition={{ delay: i * 0.1, duration: 0.3 }}
                  />
                )}
              </div>
            ))}
          </div>
          <motion.p 
            className="text-xs text-stone-400"
            key={step}
            initial={{ opacity: 0, y: -5 }}
            animate={{ opacity: 1, y: 0 }}
          >
            {step === 'amount' ? 'Choose amount' : step === 'details' ? 'Your details' : 'Payment'}
          </motion.p>
        </div>

        <AnimatePresence mode="wait">
          {step === 'amount' && (
            <motion.div
              key="amount"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
            >
              <Card className="border-none shadow-sm mb-6">
                <CardContent className="p-6">
                  <div className="text-center mb-6">
                    <div className="w-12 h-12 rounded-full bg-gradient-to-br from-stone-100 to-stone-200 flex items-center justify-center mx-auto mb-3">
                      <Gift className="w-6 h-6 text-stone-600" />
                    </div>
                    <h1 className="text-lg font-semibold text-stone-900">
                      Gift to {recipientName}'s Future Fund
                    </h1>
                    {eventTitle && (
                      <p className="text-sm text-stone-500 mt-1">{eventTitle}</p>
                    )}
                  </div>

                  <div className="space-y-4">
                    <Label className="text-sm font-medium text-stone-700">Amount</Label>
                    <div className="grid grid-cols-4 gap-2">
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
                            className={`h-12 w-full transition-all ${amount === amt && !customAmount ? 'shadow-md' : ''}`}
                            data-testid={`amount-${amt}`}
                          >
                            ${amt}
                          </Button>
                        </motion.div>
                      ))}
                    </div>
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-stone-400">$</span>
                      <Input
                        type="number"
                        placeholder="Other amount"
                        value={customAmount}
                        onChange={(e) => setCustomAmount(e.target.value)}
                        className="pl-7 h-12"
                        data-testid="input-custom-amount"
                      />
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card className="border-none shadow-sm mb-6">
                <CardContent className="p-6">
                  <Label className="text-sm font-medium text-stone-700">Add a note (optional)</Label>
                  <Textarea
                    placeholder="Happy birthday! This is for your future..."
                    value={note}
                    onChange={(e) => setNote(e.target.value)}
                    className="mt-2 resize-none"
                    rows={3}
                    data-testid="input-note"
                  />
                </CardContent>
              </Card>

              <Button 
                className="w-full h-12 text-base"
                onClick={() => setStep('details')}
                disabled={numAmount < 5}
                data-testid="button-continue-details"
              >
                Continue
                <ChevronRight className="w-4 h-4 ml-1" />
              </Button>
              
              {numAmount < 5 && numAmount > 0 && (
                <p className="text-xs text-stone-400 text-center mt-2">Minimum gift is $5</p>
              )}
            </motion.div>
          )}

          {step === 'details' && (
            <motion.div
              key="details"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
            >
              <Card className="border-none shadow-sm mb-6">
                <CardContent className="p-6 space-y-4">
                  <h2 className="text-lg font-semibold text-stone-900">Your details</h2>
                  <p className="text-sm text-stone-500">So {recipientName} knows who sent this gift</p>
                  
                  <div className="space-y-4 pt-2">
                    <div className="space-y-2">
                      <Label className="text-sm font-medium">Your name</Label>
                      <Input
                        placeholder="Jane Smith"
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        className="h-12"
                        data-testid="input-name"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label className="text-sm font-medium">Email</Label>
                      <Input
                        type="email"
                        placeholder="jane@example.com"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        className="h-12"
                        data-testid="input-email"
                      />
                      <p className="text-xs text-stone-400">For your receipt and confirmation</p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Button 
                className="w-full h-12 text-base"
                onClick={() => setStep('payment')}
                disabled={!name || !email}
                data-testid="button-continue-payment"
              >
                Continue to payment
                <ChevronRight className="w-4 h-4 ml-1" />
              </Button>
            </motion.div>
          )}

          {step === 'payment' && (
            <motion.div
              key="payment"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
            >
              <Card className="border-none shadow-sm mb-6">
                <CardContent className="p-6">
                  <h2 className="text-lg font-semibold text-stone-900 mb-4">Payment method</h2>
                  
                  <div className="space-y-2">
                    <button
                      onClick={() => setPaymentMethod('card')}
                      className={`w-full p-4 rounded-lg border-2 transition-all flex items-center gap-3 ${
                        paymentMethod === 'card' ? 'border-stone-900 bg-stone-50' : 'border-stone-200 hover:border-stone-300'
                      }`}
                      data-testid="payment-card"
                    >
                      <CreditCard className={`w-5 h-5 ${paymentMethod === 'card' ? 'text-stone-900' : 'text-stone-400'}`} />
                      <div className="text-left flex-1">
                        <p className="text-sm font-medium text-stone-900">Card</p>
                        <p className="text-xs text-stone-500">Instant · 2.9% + $0.30 processing</p>
                      </div>
                      {paymentMethod === 'card' && <Check className="w-4 h-4 text-stone-900" />}
                    </button>
                    
                    <button
                      onClick={() => setPaymentMethod('bank')}
                      className={`w-full p-4 rounded-lg border-2 transition-all flex items-center gap-3 ${
                        paymentMethod === 'bank' ? 'border-stone-900 bg-stone-50' : 'border-stone-200 hover:border-stone-300'
                      }`}
                      data-testid="payment-bank"
                    >
                      <Building2 className={`w-5 h-5 ${paymentMethod === 'bank' ? 'text-stone-900' : 'text-stone-400'}`} />
                      <div className="text-left flex-1">
                        <p className="text-sm font-medium text-stone-900">Bank transfer</p>
                        <p className="text-xs text-stone-500">2-3 days · $0.75 processing</p>
                      </div>
                      {paymentMethod === 'bank' && <Check className="w-4 h-4 text-stone-900" />}
                    </button>
                  </div>
                </CardContent>
              </Card>

              {paymentMethod === 'card' && (
                <Card className="border-none shadow-sm mb-6">
                  <CardContent className="p-6 space-y-4">
                    <div className="space-y-2">
                      <Label className="text-sm font-medium">Card number</Label>
                      <Input placeholder="4242 4242 4242 4242" className="h-12" data-testid="input-card-number" />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label className="text-sm font-medium">Expiry</Label>
                        <Input placeholder="MM/YY" className="h-12" data-testid="input-card-expiry" />
                      </div>
                      <div className="space-y-2">
                        <Label className="text-sm font-medium">CVC</Label>
                        <Input placeholder="123" className="h-12" data-testid="input-card-cvc" />
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )}

              <Card className="border-none shadow-sm mb-6 bg-stone-50">
                <CardContent className="p-4">
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-stone-600">Gift amount</span>
                      <span className="text-stone-900">${numAmount.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-stone-600">Processing fee</span>
                      <span className="text-stone-900">${processingFee.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-stone-600">Kora fee</span>
                      <span className="text-stone-900">${platformFee.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between font-medium pt-2 border-t border-stone-200">
                      <span className="text-stone-900">Total</span>
                      <span className="text-stone-900">${total.toFixed(2)}</span>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Button 
                className="w-full h-12 text-base"
                onClick={handleSubmitPayment}
                disabled={isProcessing}
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

              <div className="flex items-center justify-center gap-4 mt-4 text-xs text-stone-400">
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
      </main>
    </div>
  );
}
