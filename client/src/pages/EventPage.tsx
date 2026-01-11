import { useState, useEffect } from "react";
import { Link, useParams } from "wouter";
import { motion, AnimatePresence } from "framer-motion";

const AMOUNTS = [25, 50, 100, 250];

const getStoredPageData = (key: string) => {
  try {
    const stored = localStorage.getItem(`everleaf_page_${key}`);
    return stored ? JSON.parse(stored) : null;
  } catch { return null; }
};

export default function EventPage() {
  const params = useParams<{ slug: string; event: string }>();
  const fundSlug = params.slug || "mila";
  const eventSlug = params.event || "anytime";
  
  const savedData = getStoredPageData(`${fundSlug}_${eventSlug}`);
  
  const recipientName = fundSlug
    .split("-")
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");

  const eventTitle = savedData?.title || (eventSlug === "anytime" 
    ? null 
    : eventSlug
        .split("-")
        .map(word => word.charAt(0).toUpperCase() + word.slice(1))
        .join(" "));
  
  const headline = savedData?.headline;
  const description = savedData?.description;
  const photo = savedData?.photo;
  const buttonText = savedData?.buttonText || "Continue";
  const showProgress = savedData?.showAmount;
  const goalAmount = savedData?.goalAmount || 1000;
  const currentAmount = savedData?.currentAmount || 0;

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
        <div className="max-w-6xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between">
          <button 
            onClick={() => window.history.back()}
            data-testid="button-back"
            className="text-sm text-stone-500 hover:text-stone-900 transition-colors"
          >
            ← Back
          </button>
          <span className="text-sm font-medium text-stone-900">{eventTitle || "Give"}</span>
          <span className="text-xs text-stone-400 w-16 text-right">Secure</span>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 sm:px-6 py-8 lg:py-12">
        
        {/* Desktop: Two column layout */}
        <div className="lg:grid lg:grid-cols-2 lg:gap-16 lg:items-start">
          
          {/* Left column - Info (desktop) */}
          <div className="hidden lg:block lg:sticky lg:top-20">
            {/* Photo */}
            {photo && (
              <img 
                src={photo} 
                alt="" 
                className="w-full aspect-video object-cover rounded-2xl mb-8"
              />
            )}

            {/* Header */}
            <div className="mb-8">
              {!photo && (
                <div className="w-20 h-20 rounded-full bg-stone-900 text-stone-50 flex items-center justify-center text-2xl font-light mb-6">
                  {recipientName.charAt(0)}
                </div>
              )}
              <h1 className="text-3xl font-light text-stone-900 mb-2">
                {headline || `Give to ${recipientName}`}
              </h1>
              {description && (
                <p className="text-stone-500 text-lg leading-relaxed">{description}</p>
              )}
              {!description && eventTitle && (
                <p className="text-stone-500 text-lg">{eventTitle}</p>
              )}
            </div>

            {/* Progress bar */}
            {showProgress && (
              <div className="mb-8">
                <div className="flex justify-between text-sm mb-2">
                  <span className="font-medium text-stone-900">${currentAmount.toLocaleString()}</span>
                  <span className="text-stone-400">of ${goalAmount.toLocaleString()}</span>
                </div>
                <div className="h-2.5 bg-stone-200 rounded-full overflow-hidden">
                  <div 
                    className="h-full bg-stone-900 transition-all"
                    style={{ width: `${Math.min((currentAmount / goalAmount) * 100, 100)}%` }}
                  />
                </div>
              </div>
            )}

            {/* Trust badges */}
            <div className="space-y-3 text-sm text-stone-500">
              <div className="flex items-center gap-3">
                <svg className="w-5 h-5 text-stone-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                </svg>
                <span>100% of your gift is invested</span>
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
              
              {/* Step 0: Amount */}
              {step === 0 && (
                <motion.div
                  key="amount"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                >
                  {/* Mobile-only info section */}
                  <div className="lg:hidden">
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

                    {/* Photo */}
                    {photo && (
                      <img 
                        src={photo} 
                        alt="" 
                        className="w-full aspect-video object-cover rounded-xl mb-6"
                      />
                    )}

                    {/* Header */}
                    <div className="text-center mb-10">
                      {!photo && (
                        <div className="w-16 h-16 rounded-full bg-stone-900 text-stone-50 flex items-center justify-center text-xl font-light mx-auto mb-5">
                          {recipientName.charAt(0)}
                        </div>
                      )}
                      <h1 className="text-2xl font-light text-stone-900 mb-1">
                        {headline || `Give to ${recipientName}`}
                      </h1>
                      {description && (
                        <p className="text-stone-500 text-sm mt-2 leading-relaxed">{description}</p>
                      )}
                      {!description && eventTitle && (
                        <p className="text-stone-500">{eventTitle}</p>
                      )}
                    </div>

                    {/* Progress bar */}
                    {showProgress && (
                      <div className="mb-6">
                        <div className="flex justify-between text-sm mb-2">
                          <span className="font-medium text-stone-900">${currentAmount.toLocaleString()}</span>
                          <span className="text-stone-400">of ${goalAmount.toLocaleString()}</span>
                        </div>
                        <div className="h-2 bg-stone-200 rounded-full overflow-hidden">
                          <div 
                            className="h-full bg-stone-900 transition-all"
                            style={{ width: `${Math.min((currentAmount / goalAmount) * 100, 100)}%` }}
                          />
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Amount Selection */}
                  <div className="lg:bg-white lg:border lg:border-stone-200 lg:rounded-xl lg:p-6">
                    <h2 className="hidden lg:block text-lg font-medium text-stone-900 mb-6">Choose an amount</h2>
                    
                    <div className="grid grid-cols-4 gap-2 mb-4">
                      {AMOUNTS.map((a) => (
                        <button
                          key={a}
                          onClick={() => { setAmount(a); setCustomAmount(""); }}
                          data-testid={`amount-${a}`}
                          className={`py-3 lg:py-4 rounded text-sm font-medium transition-all ${
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
                        data-testid="input-custom-amount"
                        className="w-full pl-8 pr-4 py-3 lg:py-4 bg-white border border-stone-200 rounded text-stone-900 focus:outline-none focus:border-stone-400"
                      />
                    </div>

                    {/* Projection */}
                    {finalAmount > 0 && (
                      <motion.div
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="p-5 lg:p-6 bg-stone-900 text-stone-50 rounded-lg mb-8"
                      >
                        <p className="text-stone-400 text-sm mb-1">Your ${finalAmount} could become</p>
                        <p className="text-3xl lg:text-4xl font-light">${projectedGrowth.toLocaleString()}</p>
                        <p className="text-stone-500 text-sm mt-1">in 18 years at 7% annual return</p>
                      </motion.div>
                    )}

                    <button
                      onClick={() => setStep(1)}
                      disabled={finalAmount < 5}
                      data-testid="button-continue"
                      className="w-full py-3 lg:py-4 bg-stone-900 text-stone-50 rounded font-medium disabled:opacity-40 hover:bg-stone-800 transition-colors"
                    >
                      {buttonText}
                    </button>
                  </div>
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
                    data-testid="button-back-step1"
                    className="text-sm text-stone-500 hover:text-stone-900 mb-8 transition-colors"
                  >
                    ← Back
                  </button>

                  <div className="lg:bg-white lg:border lg:border-stone-200 lg:rounded-xl lg:p-6">
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
                          data-testid="input-name"
                          className="w-full px-4 py-3 lg:py-4 bg-white border border-stone-200 rounded text-stone-900 focus:outline-none focus:border-stone-400"
                        />
                      </div>
                      <div>
                        <label className="block text-sm text-stone-500 mb-2">Add a note (optional)</label>
                        <textarea
                          value={message}
                          onChange={(e) => setMessage(e.target.value)}
                          placeholder="A message for them..."
                          rows={3}
                          data-testid="input-message"
                          className="w-full px-4 py-3 lg:py-4 bg-white border border-stone-200 rounded text-stone-900 focus:outline-none focus:border-stone-400 resize-none"
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
                        data-testid="button-apple-pay"
                        className="w-full py-3 lg:py-4 bg-stone-900 text-stone-50 rounded font-medium disabled:opacity-40 hover:bg-stone-800 transition-colors flex items-center justify-center gap-2"
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
                        data-testid="button-card"
                        className="w-full py-3 lg:py-4 bg-white border border-stone-200 text-stone-900 rounded font-medium disabled:opacity-40 hover:bg-stone-50 transition-colors"
                      >
                        Pay with card
                      </button>
                    </div>

                    <p className="text-xs text-stone-400 text-center mt-4">
                      100% of your gift is invested
                    </p>
                  </div>
                </motion.div>
              )}

              {/* Step 2: Success */}
              {step === 2 && (
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
                    >
                      <div className="w-16 h-16 lg:w-20 lg:h-20 rounded-full bg-emerald-100 mx-auto flex items-center justify-center mb-6">
                        <svg className="w-8 h-8 lg:w-10 lg:h-10 text-emerald-700" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                        </svg>
                      </div>
                      <h1 className="text-2xl lg:text-3xl font-light text-stone-900 mb-2">Gift sent</h1>
                      <p className="text-stone-500 mb-4">
                        You gave ${finalAmount} to {recipientName}'s future
                      </p>
                      <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-amber-50 text-amber-700 text-sm mb-8">
                        <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse"></span>
                        Will invest when markets open
                      </div>
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
                      <span className="text-sm text-stone-500 hover:text-stone-900 transition-colors" data-testid="link-view-fund">
                        View {recipientName}'s fund →
                      </span>
                    </Link>
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
