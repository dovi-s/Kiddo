import { useState } from "react";
import { Link, useParams } from "wouter";
import { motion } from "framer-motion";

export default function FundPage() {
  const params = useParams<{ slug: string }>();
  const fundSlug = params.slug || "mila";
  
  const recipientName = fundSlug
    .split("-")
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");

  const fund = {
    name: recipientName,
    accountType: "UTMA",
    totalRaised: 4250,
    contributors: 18,
    createdBy: "Sarah",
    events: [
      { slug: "anytime", title: "Give anytime", description: "Contribute to their future, no occasion needed", raised: 2180, gifts: 12, active: true },
      { slug: "5th-birthday", title: "5th Birthday", description: "December 15, 2025", raised: 1420, gifts: 8, active: true },
      { slug: "kindergarten-graduation", title: "Kindergarten Graduation", description: "May 2026", raised: 650, gifts: 4, active: false },
    ]
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
          <span className="text-sm font-medium text-stone-900">{recipientName}</span>
          <span className="text-xs text-stone-400 w-16 text-right">Secure</span>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 sm:px-6 py-8 lg:py-16">
        
        {/* Desktop: Two column layout */}
        <div className="lg:grid lg:grid-cols-2 lg:gap-16 lg:items-start">
          
          {/* Left column - Fund info */}
          <div className="lg:sticky lg:top-20">
            
            {/* Breadcrumb */}
            <div className="text-sm mb-8 lg:mb-10 flex items-center gap-1.5">
              <Link href="/dashboard">
                <span className="text-stone-400 hover:text-stone-600 transition-colors">Dashboard</span>
              </Link>
              <span className="text-stone-300">/</span>
              <span className="text-stone-900">{recipientName}</span>
            </div>

            {/* Fund Header */}
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="text-center lg:text-left mb-10 lg:mb-12"
            >
              <div className="w-20 h-20 lg:w-24 lg:h-24 rounded-full bg-stone-900 text-stone-50 flex items-center justify-center text-2xl lg:text-3xl font-light mx-auto lg:mx-0 mb-6">
                {recipientName.charAt(0)}
              </div>
              <h1 className="text-2xl lg:text-4xl font-light text-stone-900 mb-2">
                {recipientName}'s Fund
              </h1>
              <p className="text-stone-500 lg:text-lg">
                Created by {fund.createdBy}
              </p>
            </motion.div>

            {/* Stats */}
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.1 }}
              className="flex justify-center lg:justify-start gap-8 lg:gap-12 mb-10 lg:mb-0 pb-8 lg:pb-0 border-b lg:border-b-0 border-stone-200"
            >
              <div className="text-center lg:text-left">
                <p className="text-2xl lg:text-3xl font-light text-stone-900">${fund.totalRaised.toLocaleString()}</p>
                <p className="text-sm text-stone-500">raised</p>
              </div>
              <div className="text-center lg:text-left">
                <p className="text-2xl lg:text-3xl font-light text-stone-900">{fund.contributors}</p>
                <p className="text-sm text-stone-500">contributors</p>
              </div>
            </motion.div>

            {/* Trust badges - Desktop only */}
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.2 }}
              className="hidden lg:block mt-12 space-y-3 text-sm text-stone-500"
            >
              <div className="flex items-center gap-3">
                <svg className="w-5 h-5 text-stone-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                </svg>
                <span>100% of gifts are invested</span>
              </div>
              <div className="flex items-center gap-3">
                <svg className="w-5 h-5 text-stone-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <span>SIPC protected up to $500,000</span>
              </div>
              <div className="flex items-center gap-3">
                <svg className="w-5 h-5 text-stone-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
                </svg>
                <span>Invested for long-term growth</span>
              </div>
            </motion.div>
          </div>

          {/* Right column - Events */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.2 }}
          >
            <div className="lg:bg-white lg:border lg:border-stone-200 lg:rounded-xl lg:p-6">
              <p className="text-xs font-medium text-stone-400 uppercase tracking-wider mb-4 lg:mb-6">
                Choose an occasion
              </p>

              <div className="space-y-3">
                {fund.events.filter(e => e.active).map((event, i) => (
                  <motion.div
                    key={event.slug}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.3 + i * 0.1 }}
                  >
                    <Link href={`/${fundSlug}/${event.slug}`}>
                      <div 
                        className="p-5 lg:p-6 bg-white border border-stone-200 lg:bg-stone-50 lg:border-stone-100 rounded-lg hover:border-stone-300 lg:hover:bg-stone-100 transition-colors cursor-pointer group"
                        data-testid={`event-${event.slug}`}
                      >
                        <div className="flex justify-between items-start">
                          <div>
                            <p className="font-medium text-stone-900 group-hover:text-stone-700 transition-colors">{event.title}</p>
                            <p className="text-sm text-stone-500 mt-0.5">{event.description}</p>
                          </div>
                          <span className="text-stone-400 group-hover:text-stone-600 transition-colors text-lg">→</span>
                        </div>
                        <div className="mt-3 pt-3 border-t border-stone-100 flex gap-4 text-sm text-stone-500">
                          <span>${event.raised.toLocaleString()} raised</span>
                          <span>{event.gifts} gifts</span>
                        </div>
                      </div>
                    </Link>
                  </motion.div>
                ))}
              </div>
            </div>
          </motion.div>
        </div>

        {/* Footer */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.5 }}
          className="mt-12 lg:mt-20 pt-8 border-t border-stone-200"
        >
          <p className="text-sm text-stone-500 text-center mb-4">
            {recipientName}'s fund is invested for long-term growth
          </p>
          <p className="text-xs text-stone-400 text-center">
            Brokerage services by Alpaca Securities LLC<br />
            Member FINRA/SIPC
          </p>
        </motion.div>
      </main>
    </div>
  );
}
