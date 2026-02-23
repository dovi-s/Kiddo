import { useState, useEffect } from "react"
import { Link, useLocation, useSearch } from "wouter"
import { motion } from "framer-motion"
import { Check, Copy, Share2, ArrowRight, Heart, Gift } from "lucide-react"
import { Button } from "@/components/ui/button"
import { SparkleBurst, GradientText, GeminiHeroGradient } from "@/components/ui/gemini"
import { haptic } from "@/lib/haptics"
import { Logo } from "@/components/ui/logo"
import { Mascot } from "@/components/ui/mascot"

export default function GiftSuccess() {
  const searchString = useSearch()
  const params = new URLSearchParams(searchString)

  const fundId = params.get("fundId") || ""
  const eventId = params.get("eventId") || ""
  const amount = params.get("amount") || "0"
  const senderName = params.get("senderName") || "Someone"
  const ticker = params.get("ticker") || ""

  const [copied, setCopied] = useState(false)
  const [burstActive, setBurstActive] = useState(false)

  useEffect(() => {
    const timer = setTimeout(() => setBurstActive(true), 300)
    return () => clearTimeout(timer)
  }, [])

  const shareUrl = eventId
    ? `${window.location.origin}/${fundId}/${eventId}`
    : `${window.location.origin}/${fundId}`

  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(shareUrl)
      setCopied(true)
      haptic("success")
      setTimeout(() => setCopied(false), 2000)
    } catch {
      setCopied(false)
    }
  }

  const fundName = fundId
    ? fundId.replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())
    : "their fund"

  return (
    <div className="min-h-screen gemini-warm-section relative overflow-hidden">
      <GeminiHeroGradient />

      <div className="relative z-10 flex flex-col items-center px-4 py-8 max-w-lg mx-auto">
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="mb-8"
        >
          <Logo />
        </motion.div>

        <motion.div
          initial={{ scale: 0.7, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
          className="mb-4"
        >
          <Mascot size="lg" className="mx-auto drop-shadow-lg" context="gift-success" />
        </motion.div>

        <div className="relative flex items-center justify-center mb-6">
          <SparkleBurst active={burstActive} />
          <motion.div
            className="w-20 h-20 rounded-full flex items-center justify-center"
            style={{
              background: "linear-gradient(135deg, hsl(152, 45%, 18%), hsl(180, 30%, 40%))",
            }}
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ type: "spring", stiffness: 260, damping: 20, delay: 0.2 }}
            data-testid="icon-checkmark"
          >
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ delay: 0.5, type: "spring", stiffness: 300 }}
            >
              <Check className="w-10 h-10 text-white" strokeWidth={3} />
            </motion.div>
          </motion.div>
        </div>

        <motion.h1
          className="font-heading text-3xl md:text-4xl font-bold text-center mb-2"
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4, duration: 0.5 }}
          data-testid="text-success-heading"
        >
          <GradientText>Your gift is on its way!</GradientText>
        </motion.h1>

        <motion.p
          className="text-muted-foreground text-center mb-8"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.6 }}
          data-testid="text-success-subheading"
        >
          What a thoughtful thing to do, {senderName}
        </motion.p>

        <motion.div
          className="w-full bg-card rounded-2xl p-6 space-y-4 mb-8 border border-border/50"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.7, duration: 0.5 }}
          data-testid="card-gift-summary"
        >
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
              <Gift className="w-5 h-5 text-primary" />
            </div>
            <h2 className="font-heading text-lg font-semibold" data-testid="text-gift-amount">
              You sent ${amount} to {fundName}
            </h2>
          </div>

          <div className="space-y-3 text-sm text-muted-foreground">
            {ticker ? (
              <p data-testid="text-investment-info">
                It will be invested in <span className="font-semibold text-foreground">{ticker}</span> stock
              </p>
            ) : (
              <p data-testid="text-investment-info">
                It will be invested automatically in a diversified mix
              </p>
            )}
            <p data-testid="text-memory-book-info">
              Your message will be saved in their Memory Book forever
            </p>
          </div>
        </motion.div>

        <motion.div
          className="w-full bg-card rounded-2xl p-6 mb-8 border border-border/50"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.9, duration: 0.5 }}
          data-testid="card-share-section"
        >
          <h3 className="font-heading text-lg font-semibold text-center mb-4" data-testid="text-share-heading">
            Know someone who would love this?
          </h3>

          <Button
            variant="outline"
            className="w-full mb-4 gap-2"
            onClick={handleCopyLink}
            data-testid="button-copy-link"
          >
            {copied ? (
              <>
                <Check className="w-4 h-4" />
                Link copied!
              </>
            ) : (
              <>
                <Copy className="w-4 h-4" />
                Copy Link
              </>
            )}
          </Button>

          <div className="flex items-center justify-center gap-3">
            <button
              className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-muted hover:bg-muted/80 text-sm font-medium transition-colors"
              onClick={() => haptic("light")}
              data-testid="button-share-message"
            >
              <Share2 className="w-4 h-4" />
              Share
            </button>
            <button
              className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-muted hover:bg-muted/80 text-sm font-medium transition-colors"
              onClick={() => haptic("light")}
              data-testid="button-share-heart"
            >
              <Heart className="w-4 h-4" />
              Recommend
            </button>
          </div>
        </motion.div>

        <motion.div
          className="w-full flex flex-col items-center gap-4"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 1.1, duration: 0.5 }}
        >
          <Link href="/get-started" data-testid="link-start-fund">
            <Button className="gap-2 w-full max-w-xs" size="lg">
              Start a fund for someone you love
              <ArrowRight className="w-4 h-4" />
            </Button>
          </Link>

          <Link
            href="/"
            className="text-sm text-muted-foreground hover:text-foreground transition-colors"
            data-testid="link-back-home"
          >
            Back to home
          </Link>
        </motion.div>
      </div>
    </div>
  )
}
