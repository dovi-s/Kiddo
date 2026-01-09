import { useState, useEffect } from "react";
import { Link, useParams } from "wouter";
import { motion, AnimatePresence } from "framer-motion";

const AMOUNTS = [25, 50, 100, 250];

export default function EventPage() {
  const params = useParams<{ slug: string; event: string }>();
  const fundSlug = params.slug || "mila";
  const eventSlug = params.event || "anytime";
  
  const recipientName = fundSlug
    .split("-")
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");

  const eventTitle = eventSlug === "anytime" 
    ? null 
    : eventSlug
        .split("-")
        .map(word => word.charAt(0).toUpperCase() + word.slice(1))
        .join(" ");

  const [step, setStep] = useState(0);
  const [amount, setAmount] = useState(50);
  const [customAmount, setCustomAmount] = useState("");
  const [message, setMessage] = useState("");
  const [giverName, setGiverName] = useState("");
  const [isProcessing, setIsProcessing] = useState(false);

  const finalAmount = customAmount ? parseInt(customAmount) || 0 : amount;
  const fee = Math.round(finalAmount * 0.029 * 100) / 100;
  const total = (finalAmount + fee).toFixed(2);
  const projectedGrowth = Math.round(finalAmount * 4.6);

  const handleGive = () => {
    setIsProcessing(true);
    setTimeout(() => {
      setStep(2);
      setIsProcessing(false);
    }, 1500);
  };

  return (
    <div className="min-h-screen bg-stone-50">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-stone-50/95 backdrop-blur-sm border-b border-stone-200">
        <div className="max-w-lg mx-auto px-6 h-14 flex items-center justify-between">
          <Link href={`/${fundSlug}`}>
            <span className="text-sm text-stone-500 hover:text-stone-900">← {recipientName}</span>
          </Link>
          <span className="text-sm font-medium text-stone-900">{eventTitle || "Give"}</span>
          <span className="text-xs text-stone-400 w-16 text-right">Secure</span>
        </div>
      </header>

      <main className="max-w-lg mx-auto px-6 py-10">
        <AnimatePresence mode="wait">
          
          {/* Step 0: Amount */}
          {step === 0 && (
            <motion.div
              key="amount"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
            >
              {/* Breadcrumb */}
              <div className="text-sm mb-8 flex items-center gap-1.5">
                <Link href="/dashboard">
                  <span className="text-stone-400 hover:text-stone-600">Dashboard</span>
                </Link>
                <span className="text-stone-300">/</span>
                <Link href={`/${fundSlug}`}>
                  <span className="text-stone-500 hover:text-stone-900">{recipientName}</span>
                </Link>
                {eventTitle && (
                  <>
                    <span className="text-stone-300">/</span>
                    <span className="text-stone-900">{eventTitle}</span>
                  </>
                )}
              </div>

              {/* Header */}
              <div className="text-center mb-10">
                <div className="w-16 h-16 rounded-full bg-stone-900 text-stone-50 flex items-center justify-center text-xl font-light mx-auto mb-5">
                  {recipientName.charAt(0)}
                </div>
                <h1 className="text-2xl font-light text-stone-900 mb-1">
                  Give to {recipientName}
                </h1>
                {eventTitle && (
                  <p className="text-stone-500">{eventTitle}</p>
                )}
              </div>

              {/* Amount Selection */}
              <div className="grid grid-cols-4 gap-2 mb-4">
                {AMOUNTS.map((a) => (
                  <button
                    key={a}
                    onClick={() => { setAmount(a); setCustomAmount(""); }}
                    className={`py-3 rounded text-sm font-medium transition-all ${
                      amount === a && !customAmount
                        ? "bg-stone-900 text-stone-50"
                        : "bg-white border border-stone-200 text-stone-900 hover:border-stone-300"
                    }`}
                  >
                    ${a}
                  </button>
                ))}
              </div>

              <div className="relative mb-8">
                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-stone-400">$</span>
                <input
                  type="text"
                  inputMode="numeric"
                  placeholder="Other amount"
                  value={customAmount}
                  onChange={(e) => setCustomAmount(e.target.value.replace(/[^0-9]/g, ""))}
                  className="w-full pl-8 pr-4 py-3 bg-white border border-stone-200 rounded text-stone-900 focus:outline-none focus:border-stone-400"
                />
              </div>

              {/* Projection */}
              {finalAmount > 0 && (
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="p-5 bg-stone-900 text-stone-50 rounded mb-8"
                >
                  <p className="text-stone-400 text-sm mb-1">Your ${finalAmount} could become</p>
                  <p className="text-3xl font-light">${projectedGrowth.toLocaleString()}</p>
                  <p className="text-stone-500 text-sm mt-1">in 18 years at 7% annual return</p>
                </motion.div>
              )}

              <button
                onClick={() => setStep(1)}
                disabled={finalAmount < 5}
                className="w-full py-3 bg-stone-900 text-stone-50 rounded font-medium disabled:opacity-40 hover:bg-stone-800 transition-colors"
              >
                Continue
              </button>
            </motion.div>
          )}

          {/* Step 1: Details + Payment */}
          {step === 1 && (
            <motion.div
              key="details"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
            >
              <button 
                onClick={() => setStep(0)}
                className="text-sm text-stone-500 hover:text-stone-900 mb-8"
              >
                ← Back
              </button>

              <p className="text-sm text-stone-500 mb-1">Giving ${finalAmount} to {recipientName}</p>
              <h1 className="text-2xl font-light text-stone-900 mb-8">Add your details</h1>

              <div className="space-y-4 mb-8">
                <div>
                  <label className="block text-sm text-stone-500 mb-2">Your name</label>
                  <input
                    type="text"
                    value={giverName}
                    onChange={(e) => setGiverName(e.target.value)}
                    placeholder="How they'll see you"
                    className="w-full px-4 py-3 bg-white border border-stone-200 rounded text-stone-900 focus:outline-none focus:border-stone-400"
                  />
                </div>
                <div>
                  <label className="block text-sm text-stone-500 mb-2">Add a note (optional)</label>
                  <textarea
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    placeholder="A message for them..."
                    rows={3}
                    className="w-full px-4 py-3 bg-white border border-stone-200 rounded text-stone-900 focus:outline-none focus:border-stone-400 resize-none"
                  />
                </div>
              </div>

              {/* Summary */}
              <div className="p-4 bg-white border border-stone-200 rounded mb-6 space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-stone-500">Gift amount</span>
                  <span className="text-stone-900">${finalAmount.toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-stone-500">Processing fee</span>
                  <span className="text-stone-900">${fee.toFixed(2)}</span>
                </div>
                <div className="flex justify-between font-medium pt-2 border-t border-stone-100">
                  <span className="text-stone-900">Total</span>
                  <span className="text-stone-900">${total}</span>
                </div>
              </div>

              {/* Payment buttons */}
              <div className="space-y-3">
                <button
                  onClick={handleGive}
                  disabled={isProcessing || !giverName}
                  className="w-full py-3 bg-stone-900 text-stone-50 rounded font-medium disabled:opacity-40 hover:bg-stone-800 transition-colors flex items-center justify-center gap-2"
                >
                  {isProcessing ? "Processing..." : (
                    <>
                      <svg className="h-5 w-5" viewBox="0 0 24 24" fill="currentColor">
                        <path d="M17.0361 6.26816C16.9101 5.85953 16.5165 5.58594 16.0754 5.58594H7.92467C7.48358 5.58594 7.08997 5.85953 6.96392 6.26816L5.99219 9.57031V10.5703C5.99219 11.1226 6.43991 11.5703 6.99219 11.5703H7.00781V17.418C7.00781 17.9703 7.45553 18.418 8.00781 18.418H15.9922C16.5445 18.418 16.9922 17.9703 16.9922 17.418V11.5703H17.0078C17.5601 11.5703 18.0078 11.1226 18.0078 10.5703V9.57031L17.0361 6.26816Z"/>
                      </svg>
                      Pay with Apple Pay
                    </>
                  )}
                </button>
                <button
                  onClick={handleGive}
                  disabled={isProcessing || !giverName}
                  className="w-full py-3 bg-white border border-stone-200 text-stone-900 rounded font-medium disabled:opacity-40 hover:bg-stone-50 transition-colors"
                >
                  Pay with card
                </button>
              </div>

              <p className="text-xs text-stone-400 text-center mt-4">
                100% of your gift is invested
              </p>
            </motion.div>
          )}

          {/* Step 2: Success */}
          {step === 2 && (
            <motion.div
              key="success"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="text-center pt-16"
            >
              <motion.div
                initial={{ scale: 0.9 }}
                animate={{ scale: 1 }}
              >
                <div className="w-16 h-16 rounded-full bg-emerald-100 mx-auto flex items-center justify-center mb-6">
                  <svg className="w-8 h-8 text-emerald-700" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                  </svg>
                </div>
                <h1 className="text-2xl font-light text-stone-900 mb-2">Gift sent</h1>
                <p className="text-stone-500 mb-8">
                  You gave ${finalAmount} to {recipientName}'s future
                </p>
              </motion.div>

              <div className="p-5 bg-white border border-stone-200 rounded text-left max-w-xs mx-auto mb-8">
                <div className="flex justify-between mb-3">
                  <span className="text-stone-500">Amount</span>
                  <span className="font-medium text-stone-900">${finalAmount}</span>
                </div>
                <div className="flex justify-between mb-3">
                  <span className="text-stone-500">To</span>
                  <span className="font-medium text-stone-900">{recipientName}</span>
                </div>
                {eventTitle && (
                  <div className="flex justify-between mb-3">
                    <span className="text-stone-500">For</span>
                    <span className="font-medium text-stone-900">{eventTitle}</span>
                  </div>
                )}
                <div className="flex justify-between pt-3 border-t border-stone-100">
                  <span className="text-stone-500">Could grow to</span>
                  <span className="font-medium text-emerald-700">${projectedGrowth.toLocaleString()}</span>
                </div>
              </div>

              <Link href={`/${fundSlug}`}>
                <span className="text-sm text-stone-500 hover:text-stone-900">
                  View {recipientName}'s fund →
                </span>
              </Link>
            </motion.div>
          )}
        </AnimatePresence>
      </main>
    </div>
  );
}
