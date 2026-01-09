import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Lock, ArrowLeft, ArrowRight, Check, Search, TrendingUp, Sparkles } from "lucide-react";
import { Link } from "wouter";
import { toast } from "@/hooks/use-toast";
import { motion, AnimatePresence } from "framer-motion";

const POPULAR_STOCKS = [
  { symbol: "AAPL", name: "Apple", price: 178.50, logo: "🍎", color: "from-gray-100 to-gray-200" },
  { symbol: "DIS", name: "Disney", price: 92.30, logo: "🏰", color: "from-blue-100 to-indigo-100" },
  { symbol: "TSLA", name: "Tesla", price: 248.75, logo: "⚡", color: "from-red-50 to-red-100" },
  { symbol: "AMZN", name: "Amazon", price: 178.25, logo: "📦", color: "from-amber-50 to-orange-100" },
  { symbol: "GOOGL", name: "Google", price: 141.80, logo: "🔍", color: "from-blue-50 to-green-50" },
  { symbol: "NFLX", name: "Netflix", price: 628.50, logo: "🎬", color: "from-red-100 to-red-200" },
  { symbol: "MSFT", name: "Microsoft", price: 378.90, logo: "💻", color: "from-blue-100 to-cyan-100" },
  { symbol: "NVDA", name: "NVIDIA", price: 875.30, logo: "🎮", color: "from-green-100 to-emerald-100" },
];

export default function Send() {
  const [step, setStep] = useState(0);
  const [recipientName, setRecipientName] = useState("");
  const [recipientEmail, setRecipientEmail] = useState("");
  const [selectedStock, setSelectedStock] = useState<typeof POPULAR_STOCKS[0] | null>(null);
  const [amount, setAmount] = useState("50");
  const [message, setMessage] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [isProcessing, setIsProcessing] = useState(false);

  const filteredStocks = POPULAR_STOCKS.filter(s => 
    s.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    s.symbol.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const shares = selectedStock ? (parseFloat(amount) / selectedStock.price) : 0;
  const futureValue = parseFloat(amount) * 2.5; // Simplified 10-year projection

  const handleSend = () => {
    setIsProcessing(true);
    setTimeout(() => {
      setStep(3);
      setIsProcessing(false);
    }, 2000);
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-violet-50/50 via-background to-background dark:from-violet-950/20">
      {/* Header */}
      <header className="p-4 sticky top-0 z-50 bg-background/80 backdrop-blur-lg border-b">
        <div className="container mx-auto flex justify-between items-center max-w-lg">
          <Link href="/">
            <span className="flex items-center gap-2 text-foreground">
              <div className="w-7 h-7 rounded-full bg-gradient-to-br from-emerald-400 to-emerald-600 flex items-center justify-center">
                <svg className="w-4 h-4 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M12 2v20M8 6l4-4 4 4" />
                </svg>
              </div>
              <span className="font-semibold tracking-tight">Everleaf</span>
            </span>
          </Link>
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground bg-muted/50 px-2.5 py-1 rounded-full">
            <Lock className="h-3 w-3" />
            <span>Secure</span>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8 max-w-lg">
        <AnimatePresence mode="wait">
          
          {/* Step 0: Who */}
          {step === 0 && (
            <motion.div 
              key="who"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              transition={{ duration: 0.4 }}
            >
              <div className="text-center mb-10">
                <motion.div 
                  initial={{ scale: 0.8, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  className="mx-auto mb-6 h-16 w-16 rounded-2xl bg-gradient-to-br from-violet-400 to-violet-600 flex items-center justify-center shadow-xl shadow-violet-500/25"
                >
                  <Sparkles className="h-8 w-8 text-white" />
                </motion.div>
                <h1 className="text-2xl md:text-3xl font-semibold text-foreground tracking-tight mb-2">
                  Send stock to anyone
                </h1>
                <p className="text-muted-foreground">
                  Better than cash. They'll own a piece of a real company.
                </p>
              </div>

              <Card className="border-0 shadow-xl shadow-black/5 overflow-hidden">
                <CardContent className="p-6 space-y-6">
                  <div>
                    <Label className="text-sm text-muted-foreground mb-2 block">Who's it for?</Label>
                    <Input 
                      placeholder="Their name"
                      value={recipientName}
                      onChange={(e) => setRecipientName(e.target.value)}
                      className="h-14 text-lg border-2 focus:border-foreground mb-3"
                    />
                    <Input 
                      type="email"
                      placeholder="Their email"
                      value={recipientEmail}
                      onChange={(e) => setRecipientEmail(e.target.value)}
                      className="h-14 text-lg border-2 focus:border-foreground"
                    />
                    <p className="text-xs text-muted-foreground mt-2">
                      We'll send them a link to claim their shares
                    </p>
                  </div>

                  <motion.div whileHover={{ scale: 1.01 }} whileTap={{ scale: 0.99 }}>
                    <Button 
                      className="w-full h-14 text-lg font-semibold rounded-xl"
                      onClick={() => setStep(1)}
                      disabled={!recipientName || !recipientEmail}
                    >
                      Continue
                      <ArrowRight className="ml-2 h-5 w-5" />
                    </Button>
                  </motion.div>
                </CardContent>
              </Card>
            </motion.div>
          )}

          {/* Step 1: Pick Stock */}
          {step === 1 && (
            <motion.div 
              key="stock"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              transition={{ duration: 0.4 }}
            >
              <button 
                onClick={() => setStep(0)}
                className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors mb-6"
              >
                <ArrowLeft className="h-4 w-4" /> Back
              </button>

              <div className="text-center mb-8">
                <p className="text-muted-foreground mb-1">Sending to {recipientName}</p>
                <h1 className="text-2xl font-semibold tracking-tight">
                  Pick a stock
                </h1>
              </div>

              {/* Search */}
              <div className="relative mb-6">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
                <Input
                  placeholder="Search companies..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="h-14 pl-12 text-lg border-2 focus:border-foreground"
                />
              </div>

              {/* Stock Grid */}
              <div className="grid grid-cols-2 gap-3 mb-6">
                {filteredStocks.map((stock, i) => (
                  <motion.button
                    key={stock.symbol}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.05 }}
                    onClick={() => setSelectedStock(stock)}
                    className={`p-4 rounded-2xl border-2 text-left transition-all ${
                      selectedStock?.symbol === stock.symbol
                        ? "border-foreground bg-foreground/5 shadow-lg"
                        : "border-transparent bg-card hover:border-foreground/20"
                    }`}
                  >
                    <div className={`h-12 w-12 rounded-xl bg-gradient-to-br ${stock.color} flex items-center justify-center text-2xl mb-3`}>
                      {stock.logo}
                    </div>
                    <p className="font-semibold">{stock.name}</p>
                    <p className="text-sm text-muted-foreground">{stock.symbol} · ${stock.price}</p>
                  </motion.button>
                ))}
              </div>

              <motion.div whileHover={{ scale: 1.01 }} whileTap={{ scale: 0.99 }}>
                <Button 
                  className="w-full h-14 text-lg font-semibold rounded-xl"
                  onClick={() => setStep(2)}
                  disabled={!selectedStock}
                >
                  Continue with {selectedStock?.name || "stock"}
                  <ArrowRight className="ml-2 h-5 w-5" />
                </Button>
              </motion.div>
            </motion.div>
          )}

          {/* Step 2: Amount & Message */}
          {step === 2 && (
            <motion.div 
              key="amount"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              transition={{ duration: 0.4 }}
            >
              <button 
                onClick={() => setStep(1)}
                className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors mb-6"
              >
                <ArrowLeft className="h-4 w-4" /> Back
              </button>

              <div className="text-center mb-8">
                <div className={`mx-auto h-16 w-16 rounded-2xl bg-gradient-to-br ${selectedStock?.color} flex items-center justify-center text-3xl mb-4`}>
                  {selectedStock?.logo}
                </div>
                <p className="text-muted-foreground">
                  Sending {selectedStock?.name} to {recipientName}
                </p>
              </div>

              <Card className="border-0 shadow-xl shadow-black/5 overflow-hidden">
                <CardContent className="p-6 space-y-6">
                  
                  {/* Amount Input */}
                  <div>
                    <Label className="text-sm text-muted-foreground mb-2 block">Amount</Label>
                    <div className="relative">
                      <span className="absolute left-4 top-1/2 -translate-y-1/2 text-2xl text-muted-foreground">$</span>
                      <Input
                        type="text"
                        inputMode="numeric"
                        value={amount}
                        onChange={(e) => setAmount(e.target.value.replace(/[^0-9.]/g, ""))}
                        className="h-16 pl-10 text-3xl font-light border-2 focus:border-foreground"
                      />
                    </div>
                    <p className="text-sm text-muted-foreground mt-2">
                      ≈ {shares.toFixed(4)} shares of {selectedStock?.symbol}
                    </p>
                  </div>

                  {/* Future Value Card */}
                  <div className="p-5 rounded-2xl bg-gradient-to-br from-slate-900 to-slate-800 text-white">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-slate-400 text-sm">Could become</p>
                        <p className="text-2xl font-light">${futureValue.toFixed(0)}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-slate-400 text-sm">in 10 years</p>
                        <div className="flex items-center gap-1 text-emerald-400">
                          <TrendingUp className="h-4 w-4" />
                          <span className="text-sm font-medium">+{Math.round((futureValue / parseFloat(amount) - 1) * 100)}%</span>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Message */}
                  <div>
                    <Label className="text-sm text-muted-foreground mb-2 block">
                      Add a note <span className="text-muted-foreground/50">(optional)</span>
                    </Label>
                    <Textarea 
                      placeholder={`Why you're sending ${selectedStock?.name}...`}
                      value={message}
                      onChange={(e) => setMessage(e.target.value)}
                      className="min-h-[100px] border-2 focus:border-foreground resize-none"
                    />
                  </div>

                  {/* Total */}
                  <div className="p-4 rounded-xl bg-muted/30 space-y-2">
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">{selectedStock?.name} ({shares.toFixed(4)} shares)</span>
                      <span>${parseFloat(amount).toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Fee</span>
                      <span className="text-emerald-600">$0.00</span>
                    </div>
                    <div className="flex justify-between font-semibold pt-2 border-t">
                      <span>Total</span>
                      <span>${parseFloat(amount).toFixed(2)}</span>
                    </div>
                  </div>

                  {/* Submit */}
                  <motion.div whileHover={{ scale: 1.01 }} whileTap={{ scale: 0.99 }}>
                    <Button 
                      className="w-full h-14 text-lg font-semibold rounded-xl bg-foreground hover:bg-foreground/90"
                      onClick={handleSend}
                      disabled={isProcessing || parseFloat(amount) < 1}
                    >
                      {isProcessing ? (
                        <span className="flex items-center gap-2">
                          <motion.div
                            animate={{ rotate: 360 }}
                            transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                            className="h-5 w-5 border-2 border-background/30 border-t-background rounded-full"
                          />
                          Sending...
                        </span>
                      ) : (
                        `Send $${amount} of ${selectedStock?.symbol}`
                      )}
                    </Button>
                  </motion.div>
                </CardContent>
              </Card>
            </motion.div>
          )}

          {/* Step 3: Success */}
          {step === 3 && (
            <motion.div 
              key="success"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.5 }}
              className="text-center pt-12"
            >
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ delay: 0.2, type: "spring", stiffness: 200 }}
                className="mx-auto mb-8 h-24 w-24 rounded-full bg-gradient-to-br from-emerald-400 to-emerald-600 flex items-center justify-center shadow-xl shadow-emerald-500/30"
              >
                <motion.div
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={{ delay: 0.4, type: "spring" }}
                >
                  <Check className="h-12 w-12 text-white" strokeWidth={3} />
                </motion.div>
              </motion.div>

              <motion.h1
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.3 }}
                className="text-3xl font-semibold tracking-tight mb-3"
              >
                Sent!
              </motion.h1>

              <motion.p
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.4 }}
                className="text-lg text-muted-foreground mb-8"
              >
                {recipientName} will get an email to claim their {selectedStock?.name} shares
              </motion.p>

              {/* Summary Card */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.5 }}
              >
                <Card className="border-0 shadow-xl shadow-black/5 overflow-hidden max-w-sm mx-auto text-left">
                  <CardContent className="p-6">
                    <div className="flex items-center gap-4 mb-4">
                      <div className={`h-14 w-14 rounded-2xl bg-gradient-to-br ${selectedStock?.color} flex items-center justify-center text-2xl`}>
                        {selectedStock?.logo}
                      </div>
                      <div>
                        <p className="font-semibold">{shares.toFixed(4)} shares</p>
                        <p className="text-sm text-muted-foreground">{selectedStock?.name} ({selectedStock?.symbol})</p>
                      </div>
                      <div className="ml-auto text-right">
                        <p className="font-semibold">${amount}</p>
                      </div>
                    </div>
                    
                    <div className="p-4 rounded-xl bg-muted/30">
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">To</span>
                        <span className="font-medium">{recipientName}</span>
                      </div>
                      <div className="flex justify-between text-sm mt-1">
                        <span className="text-muted-foreground">Email</span>
                        <span className="font-medium">{recipientEmail}</span>
                      </div>
                      {message && (
                        <div className="mt-3 pt-3 border-t">
                          <p className="text-sm text-muted-foreground mb-1">Your note</p>
                          <p className="text-sm">"{message}"</p>
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              </motion.div>

              {/* Actions */}
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.7 }}
                className="mt-8 space-y-4"
              >
                <Button variant="outline" className="rounded-xl" onClick={() => {
                  setStep(0);
                  setRecipientName("");
                  setRecipientEmail("");
                  setSelectedStock(null);
                  setAmount("50");
                  setMessage("");
                }}>
                  Send another
                </Button>

                <p className="text-xs text-muted-foreground">
                  {recipientName} has 30 days to claim their shares
                </p>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
      </main>
    </div>
  );
}
