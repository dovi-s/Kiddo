import { useState } from "react";
import { Link } from "wouter";
import { motion, AnimatePresence } from "framer-motion";

const STOCKS = [
  { symbol: "AAPL", name: "Apple", price: 178.50 },
  { symbol: "DIS", name: "Disney", price: 92.30 },
  { symbol: "TSLA", name: "Tesla", price: 248.75 },
  { symbol: "AMZN", name: "Amazon", price: 178.25 },
  { symbol: "GOOGL", name: "Google", price: 141.80 },
  { symbol: "MSFT", name: "Microsoft", price: 378.90 },
  { symbol: "NFLX", name: "Netflix", price: 628.50 },
  { symbol: "NVDA", name: "NVIDIA", price: 875.30 },
];

export default function Send() {
  const [step, setStep] = useState(0);
  const [recipientName, setRecipientName] = useState("");
  const [recipientEmail, setRecipientEmail] = useState("");
  const [selectedStock, setSelectedStock] = useState<typeof STOCKS[0] | null>(null);
  const [amount, setAmount] = useState("50");
  const [message, setMessage] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [isProcessing, setIsProcessing] = useState(false);

  const filteredStocks = STOCKS.filter(s => 
    s.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    s.symbol.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const shares = selectedStock ? (parseFloat(amount) / selectedStock.price) : 0;
  const futureValue = parseFloat(amount) * 2.5;

  const handleSend = () => {
    setIsProcessing(true);
    setTimeout(() => {
      setStep(3);
      setIsProcessing(false);
    }, 1500);
  };

  return (
    <div className="min-h-screen bg-stone-50">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-stone-50/95 backdrop-blur-sm border-b border-stone-200">
        <div className="max-w-lg mx-auto px-6 h-14 flex items-center justify-between">
          <Link href="/">
            <span className="text-sm text-stone-500 hover:text-stone-900">← Back</span>
          </Link>
          <span className="text-sm font-medium tracking-tight text-stone-900">Send stock</span>
          <span className="text-xs text-stone-400">Secure</span>
        </div>
      </header>

      <main className="max-w-lg mx-auto px-6 py-10">
        <AnimatePresence mode="wait">
          
          {/* Step 0: Who */}
          {step === 0 && (
            <motion.div 
              key="who"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
            >
              <h1 className="text-2xl font-light text-stone-900 mb-2">Send stock to anyone</h1>
              <p className="text-stone-500 mb-10">Better than cash. They'll own a piece of a real company.</p>

              <div className="space-y-4 mb-8">
                <div>
                  <label className="block text-sm text-stone-500 mb-2">Their name</label>
                  <input 
                    type="text"
                    value={recipientName}
                    onChange={(e) => setRecipientName(e.target.value)}
                    className="w-full px-4 py-3 bg-white border border-stone-200 rounded text-stone-900 focus:outline-none focus:border-stone-400"
                    placeholder="Name"
                  />
                </div>
                <div>
                  <label className="block text-sm text-stone-500 mb-2">Their email</label>
                  <input 
                    type="email"
                    value={recipientEmail}
                    onChange={(e) => setRecipientEmail(e.target.value)}
                    className="w-full px-4 py-3 bg-white border border-stone-200 rounded text-stone-900 focus:outline-none focus:border-stone-400"
                    placeholder="email@example.com"
                  />
                </div>
              </div>

              <button 
                onClick={() => setStep(1)}
                disabled={!recipientName || !recipientEmail}
                className="w-full py-3 bg-stone-900 text-stone-50 rounded font-medium disabled:opacity-40 disabled:cursor-not-allowed hover:bg-stone-800 transition-colors"
              >
                Continue
              </button>
              
              <p className="text-xs text-stone-400 mt-4 text-center">
                We'll send them a link to claim their shares
              </p>
            </motion.div>
          )}

          {/* Step 1: Pick Stock */}
          {step === 1 && (
            <motion.div 
              key="stock"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
            >
              <button 
                onClick={() => setStep(0)}
                className="text-sm text-stone-500 hover:text-stone-900 mb-6"
              >
                ← Back
              </button>

              <p className="text-sm text-stone-500 mb-1">Sending to {recipientName}</p>
              <h1 className="text-2xl font-light text-stone-900 mb-8">Pick a stock</h1>

              <input
                type="text"
                placeholder="Search companies..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full px-4 py-3 bg-white border border-stone-200 rounded text-stone-900 focus:outline-none focus:border-stone-400 mb-6"
              />

              <div className="space-y-2 mb-8">
                {filteredStocks.map((stock) => (
                  <button
                    key={stock.symbol}
                    onClick={() => setSelectedStock(stock)}
                    className={`w-full p-4 text-left rounded border transition-all ${
                      selectedStock?.symbol === stock.symbol
                        ? "border-stone-900 bg-white"
                        : "border-stone-200 bg-white hover:border-stone-300"
                    }`}
                  >
                    <div className="flex justify-between items-center">
                      <div>
                        <p className="font-medium text-stone-900">{stock.name}</p>
                        <p className="text-sm text-stone-500">{stock.symbol}</p>
                      </div>
                      <p className="text-stone-600">${stock.price}</p>
                    </div>
                  </button>
                ))}
              </div>

              <button 
                onClick={() => setStep(2)}
                disabled={!selectedStock}
                className="w-full py-3 bg-stone-900 text-stone-50 rounded font-medium disabled:opacity-40 disabled:cursor-not-allowed hover:bg-stone-800 transition-colors"
              >
                Continue with {selectedStock?.name || "..."}
              </button>
            </motion.div>
          )}

          {/* Step 2: Amount */}
          {step === 2 && (
            <motion.div 
              key="amount"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
            >
              <button 
                onClick={() => setStep(1)}
                className="text-sm text-stone-500 hover:text-stone-900 mb-6"
              >
                ← Back
              </button>

              <p className="text-sm text-stone-500 mb-1">Sending {selectedStock?.name} to {recipientName}</p>
              <h1 className="text-2xl font-light text-stone-900 mb-8">How much?</h1>

              <div className="mb-8">
                <div className="relative mb-2">
                  <span className="absolute left-4 top-1/2 -translate-y-1/2 text-2xl text-stone-400">$</span>
                  <input
                    type="text"
                    inputMode="numeric"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value.replace(/[^0-9.]/g, ""))}
                    className="w-full pl-10 pr-4 py-4 text-3xl font-light bg-white border border-stone-200 rounded text-stone-900 focus:outline-none focus:border-stone-400"
                  />
                </div>
                <p className="text-sm text-stone-500">
                  ≈ {shares.toFixed(4)} shares of {selectedStock?.symbol}
                </p>
              </div>

              {/* Projection */}
              <div className="p-5 bg-stone-900 text-stone-50 rounded mb-6">
                <div className="flex justify-between items-baseline">
                  <div>
                    <p className="text-stone-400 text-sm">Could become</p>
                    <p className="text-2xl font-light">${futureValue.toFixed(0)}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-stone-400 text-sm">in 10 years</p>
                    <p className="text-emerald-400 text-sm">+{Math.round((futureValue / parseFloat(amount || "1") - 1) * 100)}%</p>
                  </div>
                </div>
              </div>

              {/* Message */}
              <div className="mb-6">
                <label className="block text-sm text-stone-500 mb-2">Add a note (optional)</label>
                <textarea 
                  placeholder="Why you're sending this..."
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  rows={3}
                  className="w-full px-4 py-3 bg-white border border-stone-200 rounded text-stone-900 focus:outline-none focus:border-stone-400 resize-none"
                />
              </div>

              {/* Summary */}
              <div className="p-4 bg-white border border-stone-200 rounded mb-6 space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-stone-500">{selectedStock?.name} ({shares.toFixed(4)} shares)</span>
                  <span className="text-stone-900">${parseFloat(amount || "0").toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-stone-500">Fee</span>
                  <span className="text-emerald-700">$0.00</span>
                </div>
                <div className="flex justify-between font-medium pt-2 border-t border-stone-100">
                  <span className="text-stone-900">Total</span>
                  <span className="text-stone-900">${parseFloat(amount || "0").toFixed(2)}</span>
                </div>
              </div>

              <button 
                onClick={handleSend}
                disabled={isProcessing || parseFloat(amount) < 1}
                className="w-full py-3 bg-stone-900 text-stone-50 rounded font-medium disabled:opacity-40 disabled:cursor-not-allowed hover:bg-stone-800 transition-colors"
              >
                {isProcessing ? "Sending..." : `Send $${amount}`}
              </button>
            </motion.div>
          )}

          {/* Step 3: Success */}
          {step === 3 && (
            <motion.div 
              key="success"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="text-center pt-16"
            >
              <motion.div
                initial={{ scale: 0.9 }}
                animate={{ scale: 1 }}
                className="mb-8"
              >
                <div className="w-16 h-16 rounded-full bg-emerald-100 mx-auto flex items-center justify-center mb-6">
                  <svg className="w-8 h-8 text-emerald-700" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                  </svg>
                </div>
                <h1 className="text-2xl font-light text-stone-900 mb-2">Sent</h1>
                <p className="text-stone-500">
                  {recipientName} will receive an email to claim their {selectedStock?.name} shares
                </p>
              </motion.div>

              <div className="p-5 bg-white border border-stone-200 rounded text-left mb-8 max-w-xs mx-auto">
                <div className="flex justify-between mb-3">
                  <div>
                    <p className="font-medium text-stone-900">{shares.toFixed(4)} shares</p>
                    <p className="text-sm text-stone-500">{selectedStock?.name}</p>
                  </div>
                  <p className="font-medium text-stone-900">${amount}</p>
                </div>
                <div className="text-sm text-stone-500 pt-3 border-t border-stone-100">
                  <p>To: {recipientName}</p>
                  {message && <p className="mt-1 italic">"{message}"</p>}
                </div>
              </div>

              <button 
                onClick={() => {
                  setStep(0);
                  setRecipientName("");
                  setRecipientEmail("");
                  setSelectedStock(null);
                  setAmount("50");
                  setMessage("");
                }}
                className="text-sm text-stone-500 hover:text-stone-900"
              >
                Send another
              </button>

              <p className="text-xs text-stone-400 mt-8">
                They have 30 days to claim their shares
              </p>
            </motion.div>
          )}
        </AnimatePresence>
      </main>
    </div>
  );
}
