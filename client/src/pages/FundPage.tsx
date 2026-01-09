import { useState } from "react";
import { Link, useParams } from "wouter";
import { motion } from "framer-motion";

export default function FundPage() {
  const params = useParams<{ slug: string }>();
  const fundSlug = params.slug || "mila";
  
  // Convert slug to display name
  const recipientName = fundSlug
    .split("-")
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");

  // Mock fund data - in real app would fetch based on slug
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
        <div className="max-w-lg mx-auto px-6 h-14 flex items-center justify-between">
          <Link href="/">
            <span className="text-sm font-medium tracking-tight text-stone-900">Everleaf</span>
          </Link>
          <span className="text-xs text-stone-400">Secure</span>
        </div>
      </header>

      <main className="max-w-lg mx-auto px-6 py-12">
        
        {/* Breadcrumb */}
        <div className="text-sm mb-10 flex items-center gap-1.5">
          <Link href="/">
            <span className="text-stone-400 hover:text-stone-600">Everleaf</span>
          </Link>
          <span className="text-stone-300">/</span>
          <span className="text-stone-900">{recipientName}</span>
        </div>

        {/* Fund Header */}
        <motion.div 
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="text-center mb-12"
        >
          <div className="w-20 h-20 rounded-full bg-stone-900 text-stone-50 flex items-center justify-center text-2xl font-light mx-auto mb-6">
            {recipientName.charAt(0)}
          </div>
          <h1 className="text-2xl font-light text-stone-900 mb-2">
            {recipientName}'s Fund
          </h1>
          <p className="text-stone-500">
            Created by {fund.createdBy}
          </p>
        </motion.div>

        {/* Stats */}
        <motion.div 
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.1 }}
          className="flex justify-center gap-8 mb-12 pb-8 border-b border-stone-200"
        >
          <div className="text-center">
            <p className="text-2xl font-light text-stone-900">${fund.totalRaised.toLocaleString()}</p>
            <p className="text-sm text-stone-500">raised</p>
          </div>
          <div className="text-center">
            <p className="text-2xl font-light text-stone-900">{fund.contributors}</p>
            <p className="text-sm text-stone-500">contributors</p>
          </div>
        </motion.div>

        {/* Events */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.2 }}
        >
          <p className="text-xs font-medium text-stone-400 uppercase tracking-wider mb-4">
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
                  <div className="p-5 bg-white border border-stone-200 rounded-lg hover:border-stone-300 transition-colors cursor-pointer group">
                    <div className="flex justify-between items-start">
                      <div>
                        <p className="font-medium text-stone-900 group-hover:text-stone-700">{event.title}</p>
                        <p className="text-sm text-stone-500 mt-0.5">{event.description}</p>
                      </div>
                      <span className="text-stone-400 group-hover:text-stone-600 transition-colors">→</span>
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
        </motion.div>

        {/* Footer */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.5 }}
          className="mt-12 pt-8 border-t border-stone-200"
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
