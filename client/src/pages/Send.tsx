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
  const [deliveryType, setDeliveryType] = useState<"stock" | "cash">("stock");

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
        <div className="max-w-6xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between">
          <Link href="/">
            <span className="text-sm text-stone-500 hover:text-stone-900 transition-colors" data-testid="link-back">← Back</span>
          </Link>
          <span className="text-sm font-medium tracking-tight text-stone-900">Send stock</span>
          <span className="text-xs text-stone-400">Secure</span>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 sm:px-6 py-8 lg:py-12">
        
        {/* Desktop: Two column layout */}
        <div className="lg:grid lg:grid-cols-2 lg:gap-16 lg:items-start">
          
          {/* Left column - Context info (desktop) */}
          <div className="hidden lg:block lg:sticky lg:top-20">
            <div className="mb-8">
              <h1 className="text-3xl font-light text-stone-900 mb-3">Send stock to anyone</h1>
              <p className="text-lg text-stone-500 leading-relaxed">
                Better than cash. They'll own a piece of a real company that can grow over time.
              </p>
            </div>

            {/* Progress indicator */}
            <div className="flex items-center gap-3 mb-10">
              {[
                { label: "Who", step: 0 },
                { label: "Stock", step: 1 },
                { label: "Amount", step: 2 },
                { label: "Done", step: 3 },
              ].map((s, i) => (
                <div key={s.step} className="flex items-center gap-3">
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium transition-colors ${
                    step >= s.step 
                      ? "bg-stone-900 text-white" 
                      : "bg-stone-200 text-stone-500"
                  }`}>
                    {step > s.step ? (
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                      </svg>
                    ) : (
                      i + 1
                    )}
                  </div>
                  {i < 3 && <div className={`w-8 h-px ${step > s.step ? "bg-stone-900" : "bg-stone-200"}`} />}
                </div>
              ))}
            </div>

            {/* Trust badges */}
            <div className="space-y-3 text-sm text-stone-500">
              <div className="flex items-center gap-3">
                <svg className="w-5 h-5 text-stone-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                </svg>
                <span>No fees to send stock</span>
              </div>
              <div className="flex items-center gap-3">
                <svg className="w-5 h-5 text-stone-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <span>They have 30 days to claim</span>
              </div>
              <div className="flex items-center gap-3">
                <svg className="w-5 h-5 text-stone-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <span>SIPC protected up to $500,000</span>
              </div>
            </div>
          </div>

          {/* Right column - Form */}
          <div className="max-w-lg mx-auto lg:mx-0 lg:max-w-none">
            <AnimatePresence mode="wait">
              
              {/* Step 0: Who */}
              {step === 0 && (
                <motion.div 
                  key="who"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                >
                  <div className="lg:bg-white lg:border lg:border-stone-200 lg:rounded-xl lg:p-6">
                    <h1 className="text-2xl font-light text-stone-900 mb-2 lg:hidden">Send stock to anyone</h1>
                    <p className="text-stone-500 mb-10 lg:hidden">Better than cash. They'll own a piece of a real company.</p>

                    <h2 className="hidden lg:block text-lg font-medium text-stone-900 mb-6">Who's receiving?</h2>

                    <div className="space-y-4 mb-8">
                      <div>
                        <label className="block text-sm text-stone-500 mb-2">Their name</label>
                        <input 
                          type="text"
                          value={recipientName}
                          onChange={(e) => setRecipientName(e.target.value)}
                          data-testid="input-recipient-name"
                          className="w-full px-4 py-3 lg:py-4 bg-white border border-stone-200 rounded text-stone-900 focus:outline-none focus:border-stone-400"
                          placeholder="Name"
                        />
                      </div>
                      <div>
                        <label className="block text-sm text-stone-500 mb-2">Their email</label>
                        <input 
                          type="email"
                          value={recipientEmail}
                          onChange={(e) => setRecipientEmail(e.target.value)}
                          data-testid="input-recipient-email"
                          className="w-full px-4 py-3 lg:py-4 bg-white border border-stone-200 rounded text-stone-900 focus:outline-none focus:border-stone-400"
                          placeholder="email@example.com"
                        />
                      </div>
                    </div>

                    <button 
                      onClick={() => setStep(1)}
                      disabled={!recipientName || !recipientEmail}
                      data-testid="button-continue-step0"
                      className="w-full py-3 lg:py-4 bg-stone-900 text-stone-50 rounded font-medium disabled:opacity-40 disabled:cursor-not-allowed hover:bg-stone-800 transition-colors"
                    >
                      Continue
                    </button>
                    
                    <p className="text-xs text-stone-400 mt-4 text-center">
                      We'll send them a link to claim their shares
                    </p>
                  </div>
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
                    data-testid="button-back-step1"
                    className="text-sm text-stone-500 hover:text-stone-900 mb-6 transition-colors"
                  >
                    ← Back
                  </button>

                  <div className="lg:bg-white lg:border lg:border-stone-200 lg:rounded-xl lg:p-6">
                    <p className="text-sm text-stone-500 mb-1">Sending to {recipientName}</p>
                    <h1 className="text-2xl font-light text-stone-900 mb-8">Pick a stock</h1>

                    <input
                      type="text"
                      placeholder="Search companies..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      data-testid="input-search-stock"
                      className="w-full px-4 py-3 lg:py-4 bg-white border border-stone-200 rounded text-stone-900 focus:outline-none focus:border-stone-400 mb-6"
                    />

                    <div className="space-y-2 mb-8 max-h-80 overflow-auto">
                      {filteredStocks.map((stock) => (
                        <button
                          key={stock.symbol}
                          onClick={() => setSelectedStock(stock)}
                          data-testid={`stock-${stock.symbol}`}
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
                      data-testid="button-continue-step1"
                      className="w-full py-3 lg:py-4 bg-stone-900 text-stone-50 rounded font-medium disabled:opacity-40 disabled:cursor-not-allowed hover:bg-stone-800 transition-colors"
                    >
                      Continue with {selectedStock?.name || "..."}
                    </button>
                  </div>
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
                    data-testid="button-back-step2"
                    className="text-sm text-stone-500 hover:text-stone-900 mb-6 transition-colors"
                  >
                    ← Back
                  </button>

                  <div className="lg:bg-white lg:border lg:border-stone-200 lg:rounded-xl lg:p-6">
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
                          data-testid="input-amount"
                          className="w-full pl-10 pr-4 py-4 lg:py-5 text-3xl font-light bg-white border border-stone-200 rounded text-stone-900 focus:outline-none focus:border-stone-400"
                        />
                      </div>
                      <p className="text-sm text-stone-500">
                        ≈ {shares.toFixed(4)} shares of {selectedStock?.symbol}
                      </p>
                    </div>

                    {/* Projection */}
                    <div className="p-5 lg:p-6 bg-stone-900 text-stone-50 rounded mb-6">
                      <div className="flex justify-between items-baseline">
                        <div>
                          <p className="text-stone-400 text-sm">Could become</p>
                          <p className="text-2xl lg:text-3xl font-light">${futureValue.toFixed(0)}</p>
                        </div>
                        <div className="text-right">
                          <p className="text-stone-400 text-sm">in 10 years</p>
                          <p className="text-emerald-400 text-sm">+{Math.round((futureValue / parseFloat(amount || "1") - 1) * 100)}%</p>
                        </div>
                      </div>
                    </div>

                    {/* Delivery Type */}
                    <div className="mb-6">
                      <label className="block text-sm text-stone-500 mb-3">How should they receive it?</label>
                      <div className="space-y-2">
                        <button
                          onClick={() => setDeliveryType("stock")}
                          data-testid="delivery-stock"
                          className={`w-full p-4 text-left rounded border transition-all ${
                            deliveryType === "stock"
                              ? "border-stone-900 bg-white"
                              : "border-stone-200 bg-white hover:border-stone-300"
                          }`}
                        >
                          <div className="flex justify-between items-start">
                            <div>
                              <p className="font-medium text-stone-900">Buy {selectedStock?.symbol} shares</p>
                              <p className="text-sm text-stone-500">We'll purchase the stock immediately</p>
                            </div>
                            <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center shrink-0 mt-0.5 ${
                              deliveryType === "stock" ? "border-stone-900" : "border-stone-300"
                            }`}>
                              {deliveryType === "stock" && <div className="w-2 h-2 rounded-full bg-stone-900" />}
                            </div>
                          </div>
                        </button>
                        <button
                          onClick={() => setDeliveryType("cash")}
                          data-testid="delivery-cash"
                          className={`w-full p-4 text-left rounded border transition-all ${
                            deliveryType === "cash"
                              ? "border-stone-900 bg-white"
                              : "border-stone-200 bg-white hover:border-stone-300"
                          }`}
                        >
                          <div className="flex justify-between items-start">
                            <div>
                              <p className="font-medium text-stone-900">Send to cash balance</p>
                              <p className="text-sm text-stone-500">They choose what to invest in</p>
                            </div>
                            <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center shrink-0 mt-0.5 ${
                              deliveryType === "cash" ? "border-stone-900" : "border-stone-300"
                            }`}>
                              {deliveryType === "cash" && <div className="w-2 h-2 rounded-full bg-stone-900" />}
                            </div>
                          </div>
                        </button>
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
                        data-testid="input-message"
                        className="w-full px-4 py-3 lg:py-4 bg-white border border-stone-200 rounded text-stone-900 focus:outline-none focus:border-stone-400 resize-none"
                      />
                    </div>

                    {/* Summary */}
                    <div className="p-4 bg-white border border-stone-200 rounded mb-6 space-y-2">
                      <div className="flex justify-between text-sm">
                        <span className="text-stone-500">
                          {deliveryType === "stock" 
                            ? `${selectedStock?.name} (${shares.toFixed(4)} shares)` 
                            : "Cash balance"}
                        </span>
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
                      data-testid="button-send"
                      className="w-full py-3 lg:py-4 bg-stone-900 text-stone-50 rounded font-medium disabled:opacity-40 disabled:cursor-not-allowed hover:bg-stone-800 transition-colors"
                    >
                      {isProcessing ? "Sending..." : `Send $${amount}`}
                    </button>
                  </div>
                </motion.div>
              )}

              {/* Step 3: Success */}
              {step === 3 && (
                <motion.div 
                  key="success"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="text-center pt-8 lg:pt-16"
                >
                  <div className="lg:bg-white lg:border lg:border-stone-200 lg:rounded-xl lg:p-8">
                    <motion.div
                      initial={{ scale: 0.9 }}
                      animate={{ scale: 1 }}
                      className="mb-8"
                    >
                      <div className="w-16 h-16 lg:w-20 lg:h-20 rounded-full bg-slate-100 mx-auto flex items-center justify-center mb-6">
                        <svg className="w-8 h-8 lg:w-10 lg:h-10 text-slate-700" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                        </svg>
                      </div>
                      <h1 className="text-2xl lg:text-3xl font-light text-stone-900 mb-2">Sent</h1>
                      <p className="text-stone-500">
                        {deliveryType === "stock" 
                          ? `${recipientName} will receive an email to claim their ${selectedStock?.name} shares`
                          : `${recipientName} will receive an email to claim their $${amount} cash balance`
                        }
                      </p>
                    </motion.div>

                    <div className="p-5 bg-white border border-stone-200 rounded text-left mb-8 max-w-xs mx-auto">
                      <div className="flex justify-between mb-3">
                        <div>
                          {deliveryType === "stock" ? (
                            <>
                              <p className="font-medium text-stone-900">{shares.toFixed(4)} shares</p>
                              <p className="text-sm text-stone-500">{selectedStock?.name}</p>
                            </>
                          ) : (
                            <>
                              <p className="font-medium text-stone-900">Cash balance</p>
                              <p className="text-sm text-stone-500">They choose their investment</p>
                            </>
                          )}
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
                      data-testid="button-send-another"
                      className="text-sm text-stone-500 hover:text-stone-900 transition-colors"
                    >
                      Send another
                    </button>

                    <p className="text-xs text-stone-400 mt-8">
                      They have 30 days to claim their shares
                    </p>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </main>
    </div>
  );
}
