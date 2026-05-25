import { useState, useEffect, useRef } from "react"
import { Link, useSearch, useLocation } from "wouter"
import { motion } from "framer-motion"
import { useQuery } from "@tanstack/react-query"
import { Check, Copy, Share2, Heart, Gift, Mail, Bookmark, Smartphone } from "lucide-react"
import { WhatsAppIcon, MessageIcon } from "@/components/ui/share-modal"
import { projectFundValue } from "@shared/projection"
import { Button } from "@/components/ui/button"
import { haptic } from "@/lib/haptics"
import { Logo } from "@/components/ui/logo"
import { StockLogo } from "@/components/ui/stock-logo"
import { RecurringGiftNudge, RecurringSetupModal } from "@/components/ui/plg-loops"
import { MemoryMediaPicker, EMPTY_MEMORY_MEDIA, type MemoryMediaValue } from "@/components/MemoryMediaPicker"
import { toast } from "@/hooks/use-toast"
import { buildTrackedGetStartedHref, trackReferralEvent as trackAcquisitionEvent } from "@/lib/acquisition"
import { useAuth } from "@/hooks/use-auth"

// Ticker → human-readable company name. Used to render "Nike" instead
// of "NKE" alongside the brand mark from <StockLogo /> on the gift
// success page. The emoji proxies that previously sat next to each
// name (👟 for NKE, 📱 for AAPL, etc.) were retired in favor of real
// brand logos via the Parqet CDN — emojis are charming but ambiguous
// (📱 for Apple loses brand specificity, 🎬 for Netflix could be any
// streamer), and the gifter surface deserves the real swoosh.
// StockLogo handles the empty-name and CDN-failure cases via its
// own ticker-text fallback, so this map is purely for the prose
// label, not for any logo behavior.
const COMPANY_INFO: Record<string, { name: string }> = {
  DIS: { name: "Disney" },
  AAPL: { name: "Apple" },
  NKE: { name: "Nike" },
  SBUX: { name: "Starbucks" },
  NFLX: { name: "Netflix" },
  AMZN: { name: "Amazon" },
  GOOGL: { name: "Google" },
  SPOT: { name: "Spotify" },
  RBLX: { name: "Roblox" },
}

// Mirrors the canonical EVENT_TYPE_EMOJI map used on Dashboard. Inline here
// so GiftSuccess (a public/anonymous page) doesn't pull from a parent-only
// module. Keep in sync when new event types are added.
const EVENT_TYPE_EMOJI: Record<string, string> = {
  birthday: "🎂",
  graduation: "🎓",
  holiday: "🎄",
  christmas: "🎄",
  hanukkah: "🕎",
  baby: "🍼",
  baby_shower: "🍼",
  wedding: "💍",
  car: "🚗",
  first_car: "🚗",
  college: "🎓",
  home: "🏡",
  travel: "✈️",
  trip: "✈️",
  business: "💼",
  emergency: "🛡️",
  custom: "✨",
  just_because: "💚",
}

export default function GiftSuccess() {
  const searchString = useSearch()
  const params = new URLSearchParams(searchString)
  const [, setLocation] = useLocation()

  const fundId = params.get("fundId") || ""
  const eventId = params.get("eventId") || ""
  const fundSlugParam = params.get("fundSlug") || ""
  const eventSlugParam = params.get("eventSlug") || ""
  const eventNameParam = params.get("eventName") || ""
  const amountParam = params.get("amount") || "0"
  const senderNameParam = params.get("senderName") || "Someone"
  const tickerParam = params.get("ticker") || ""
  const executionModelParam = params.get("executionModel") || ""
  const fundNameParam = params.get("fundName") || ""
  const sessionId = params.get("session_id") || ""
  // Recurring-checkout URL params — set by /api/stripe/checkout/gift-recurring
  // on the success_url. When recurring=1 the page renders a recurring-aware
  // headline/subheadline ("Your monthly to Emma is set up" vs the one-time
  // "Your gift is growing"). Locked 2026-05-23 to close the gap where
  // recurring gifters were seeing the one-time success copy.
  const isRecurringSetup = params.get("recurring") === "1"
  const recurringFrequencyParam = params.get("frequency") || "monthly"
  const recurringCadenceLabel =
    recurringFrequencyParam === "weekly" ? "weekly"
    : recurringFrequencyParam === "yearly" ? "yearly"
    : "monthly"

  // Guard against direct-URL navigation to /gift/success with no params.
  // This page is meant to be reached ONLY via Stripe's success_url
  // redirect (which populates fundId + amount + session_id at minimum).
  // Without a real gift context, the page used to render a broken
  // "$0 to nobody" state. Redirect to home instead. Locked 2026-05-23.
  useEffect(() => {
    if (!fundId && !sessionId && (!amountParam || amountParam === "0")) {
      setLocation("/")
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
  const isOrphanedDirectNav =
    !fundId && !sessionId && (!amountParam || amountParam === "0")
  if (isOrphanedDirectNav) {
    return null
  }

  const [copied, setCopied] = useState(false)
  const [showRecurringNudge, setShowRecurringNudge] = useState(() => {
    // Check both old and new keys so previously-dismissed users stay dismissed across the rename.
    try {
      return !localStorage.getItem("kora:dismissed:reminder-nudge")
        && !localStorage.getItem("kora:dismissed:recurring-nudge");
    } catch { return true; }
  })
  const [recurringModalOpen, setRecurringModalOpen] = useState(false)
  const [amount, setAmount] = useState(amountParam)
  const [senderName, setSenderName] = useState(senderNameParam)
  const [ticker, setTicker] = useState(tickerParam)
  const [fundNameState, setFundNameState] = useState(fundNameParam)
  const [fundSlug, setFundSlug] = useState(fundSlugParam)
  const [eventSlug, setEventSlug] = useState(eventSlugParam)
  const [hasMessage, setHasMessage] = useState(false)
  const [hasPhoto, setHasPhoto] = useState(false)
  const [hasVideo, setHasVideo] = useState(false)
  const [hasAudio, setHasAudio] = useState(false)
  // Explicit anonymous flag from the gift session payload. When true,
  // the success page swaps the placeholder-named confirmation for an
  // affirmative "Your gift was sent anonymously" treatment.
  const [isAnonymous, setIsAnonymous] = useState(false)
  const [noteRetrying, setNoteRetrying] = useState(false)
  const [noteError, setNoteError] = useState<string | null>(null)
  const [noteText, setNoteText] = useState("")
  const [submittingNote, setSubmittingNote] = useState(false)
  const [noteSubmitted, setNoteSubmitted] = useState(false)
  // Forgot-to-add media state — feeds the shared MemoryMediaPicker so
  // gifters can attach photo / video / voice from the success page if
  // they didn't during checkout. Per project_giving_flows_full_media.md,
  // every giving flow exposes the full trio. Voice is the moat.
  const [memoryMedia, setMemoryMedia] = useState<MemoryMediaValue>(EMPTY_MEMORY_MEDIA)
  const [receiptEmail, setReceiptEmail] = useState("")
  const [updatesEmail, setUpdatesEmail] = useState("")
  const [savingUpdates, setSavingUpdates] = useState(false)
  const [updatesSaved, setUpdatesSaved] = useState(false)
  const [giftStatus, setGiftStatus] = useState<string | null>(null)
  const [holdUntil, setHoldUntil] = useState<string | null>(null)
  // Initial state 0 (not 18) so the projection doesn't render with a
  // wildly rosy max-growth assumption before the server-loaded value
  // arrives. The projection gates on `yearsUntil18 > 1` further below;
  // a 0 default means "don't show a projection yet" rather than "show
  // an 18-year growth curve we haven't confirmed." Audit 2026-05-25.
  // Variable name kept as `yearsUntil18` for parity with the server's
  // gift-summary contract; the value is the years-until-majority,
  // state-variant under the locked state-majority-age policy.
  const [yearsUntil18, setYearsUntil18] = useState<number>(0)
  // State-specific UTMA majority age — server may or may not include this
  // on the gift summary today; fall back to 18 (universal default). The
  // "when {kid} turns {N}" projection copy below uses this. See
  // project_state_majority_age_sweep.md.
  const [majorityAge, setMajorityAge] = useState<number>(18)
  const [eventInfo, setEventInfo] = useState<{
    name: string;
    eventType: string | null;
    goalAmount: number | null;
    giftVolume: number;
    goalReached: boolean;
  } | null>(null)
  const isMobileDevice = /Android|iPhone|iPad|iPod/i.test(typeof navigator !== "undefined" ? navigator.userAgent : "")
  const receiptQueuedRef = useRef(false)
  const { isAuthenticated } = useAuth()

  const parsePositiveAmount = (value: unknown): string | null => {
    const n = Number(value)
    if (!Number.isFinite(n) || n <= 0) return null
    return n.toFixed(2)
  }
  const inferExecutionModel = (raw: unknown, fallbackTicker?: string): "pick" | "family" | "auto" => {
    const normalized = String(raw || "").toLowerCase()
    if (normalized.includes("pick")) return "pick"
    if (normalized.includes("family")) return "family"
    if (fallbackTicker) return "pick"
    return "auto"
  }
  const [executionModel, setExecutionModel] = useState(() => {
    return inferExecutionModel(executionModelParam, tickerParam)
  })

  const completionTrackedRef = useRef(false)

  const trackGiftEvent = (
    action:
      | "share"
      | "copy_link"
      | "visit"
      | "signup"
      | "checkout_complete"
      | "cta_click"
      | "gift_completed"
      | "gifter_updates_opt_in"
      | "gifter_started_own_fund"
      // Specific repeat-gift loop signal so the PLG funnel can answer
      // "what % of completed gifts produced a return-to-checkout
      // intent?" Distinct from cta_click (too generic) and share
      // (different intent — broadcasting vs. self-acting). Fires
      // on the quiet "Send {child} another →" link near the
      // celebration moment.
      | "gift_again_click",
    metadata?: Record<string, unknown>,
    channelOverride?: string,
  ) => {
    trackAcquisitionEvent({
      refCode: `gift-success:${fundId || "unknown"}`,
      fundId: fundId || null,
      eventId: eventId || null,
      action,
      channel: channelOverride || "gift_success",
      metadata: metadata || null,
    })
  }

  useEffect(() => {
    trackGiftEvent("visit")
  }, [])

  useEffect(() => {
    if (!sessionId) return
    let cancelled = false
    const loadSession = async () => {
      try {
        for (let i = 0; i < 8; i += 1) {
          if (cancelled) return
          await fetch(`/api/stripe/session/${encodeURIComponent(sessionId)}/finalize`, { method: "POST" })
          const summaryRes = await fetch(`/api/stripe/session/${encodeURIComponent(sessionId)}/gift-summary`)
          if (summaryRes.ok) {
            const summary = await summaryRes.json()
            const parsedSummaryAmount = parsePositiveAmount(summary?.amount)
            if (parsedSummaryAmount) setAmount(parsedSummaryAmount)
            if (summary?.senderName) setSenderName(summary.senderName)
            if (summary?.fundName) setFundNameState(summary.fundName)
            if (summary?.fundSlug) setFundSlug(summary.fundSlug)
            if (summary?.eventSlug) setEventSlug(summary.eventSlug)
            if (summary?.hasPhoto) setHasPhoto(true)
            if (summary?.hasVideo) setHasVideo(true)
            if (summary?.hasAudio) setHasAudio(true)
            if (typeof summary?.isAnonymous === "boolean") setIsAnonymous(summary.isAnonymous)
            if (typeof summary?.yearsUntil18 === "number" && summary.yearsUntil18 >= 0) {
              setYearsUntil18(summary.yearsUntil18)
            }
            if (typeof (summary as any)?.majorityAge === "number" && (summary as any).majorityAge >= 18) {
              setMajorityAge((summary as any).majorityAge)
            }
            if (summary?.event && typeof summary.event === "object") {
              setEventInfo({
                name: String(summary.event.name || ""),
                eventType: summary.event.eventType ? String(summary.event.eventType) : null,
                goalAmount: typeof summary.event.goalAmount === "number" ? summary.event.goalAmount : null,
                giftVolume: typeof summary.event.giftVolume === "number" ? summary.event.giftVolume : 0,
                goalReached: Boolean(summary.event.goalReached),
              })
            }
            const nextTicker = String(summary?.selectedTicker || "").toUpperCase()
            const nextModel = inferExecutionModel(summary?.executionModel, nextTicker)
            setExecutionModel(nextModel)
            if (nextTicker) { setTicker(nextTicker) } else if (nextModel !== "pick") { setTicker("") }
            setHasMessage(Boolean(summary?.message))
            setGiftStatus(summary?.giftStatus || null)
            setHoldUntil(summary?.holdUntil || null)
            if (summary?.giftFound && !completionTrackedRef.current) {
              completionTrackedRef.current = true
              const completionMetadata = { source: "gift_summary", amount: summary?.amount || amount, executionModel: summary?.executionModel || executionModel, selectedTicker: nextTicker || null }
              trackGiftEvent("checkout_complete", completionMetadata, "gift_checkout")
              trackGiftEvent("gift_completed", { ...completionMetadata, baselineEvent: "gift_completed" }, "payment_started_to_gift_completed")
            }
            if (summary?.senderEmail) setReceiptEmail(String(summary.senderEmail))
            if (summary?.senderEmail) setUpdatesEmail(String(summary.senderEmail))
            if (summary?.giftFound) break
          }
          await new Promise((resolve) => setTimeout(resolve, 1200))
        }
        if (cancelled) return
        const res = await fetch(`/api/stripe/session/${encodeURIComponent(sessionId)}`)
        if (!res.ok) return
        const data = await res.json()
        const metadata = data?.metadata || {}
        const parsedMetaAmount = parsePositiveAmount(metadata.baseAmount || metadata.amount || metadata.netToFund)
        if (parsedMetaAmount) setAmount(parsedMetaAmount)
        if (metadata.senderName) setSenderName(metadata.senderName)
        if (metadata.senderEmail) setReceiptEmail(String(metadata.senderEmail))
        if (metadata.senderEmail) setUpdatesEmail(String(metadata.senderEmail))
        setHasMessage(Boolean(metadata.message))
        setGiftStatus(String(metadata.giftStatus || giftStatus || ""))
        const nextTicker = String(metadata.selectedTicker || metadata.ticker || "").toUpperCase()
        const model = inferExecutionModel(metadata.executionModel, nextTicker)
        setExecutionModel(model)
        if (nextTicker) { setTicker(nextTicker) } else if (model !== "pick") { setTicker("") }
      } catch {
        // keep URL-param fallbacks
      }
    }
    loadSession()
    return () => { cancelled = true }
  }, [sessionId])

  const [shareReady, setShareReady] = useState(!!fundSlugParam)

  // Resolve fund slug immediately from fundId - don't wait for gift summary polling
  useEffect(() => {
    if (fundSlugParam) { setShareReady(true); return }
    if (!fundId) return
    fetch(`/api/public/funds/${encodeURIComponent(fundId)}`)
      .then(r => r.ok ? r.json() : null)
      .then(data => {
        if (data?.fund?.slug) { setFundSlug(data.fund.slug); setShareReady(true) }
        else setShareReady(false)
      })
      .catch(() => setShareReady(false))
  }, [fundId])

  useEffect(() => {
    if (!sessionId || !receiptEmail || receiptQueuedRef.current) return
    let cancelled = false
    const queueReceiptFollowup = async () => {
      for (let i = 0; i < 4; i += 1) {
        try {
          const res = await fetch("/api/gifter-notifications/receipt", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ sessionId, email: receiptEmail.trim().toLowerCase() }),
          })
          if (res.ok) { receiptQueuedRef.current = true; return }
        } catch { }
        if (cancelled) return
        await new Promise((resolve) => setTimeout(resolve, 1200))
      }
    }
    void queueReceiptFollowup()
    return () => { cancelled = true }
  }, [receiptEmail, sessionId])

  const shareUrl = fundSlug
    ? `${window.location.origin}/${fundSlug}`
    : `${window.location.origin}/${fundId}`
  const startFundHref = buildTrackedGetStartedHref(searchString, {
    ref: `gift-success:${fundId || "unknown"}`,
    src: "gift_success",
    loop_touchpoint: "gift_success_cta",
    loop_channel: "web",
    gift_session_id: sessionId || undefined,
  })

  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(shareUrl)
      setCopied(true)
      haptic("success")
      trackGiftEvent("copy_link", { target: "fund_share_link" })
      setTimeout(() => setCopied(false), 2000)
    } catch { setCopied(false) }
  }

  // Build the canonical referral URL that all the per-channel share
  // handlers below use. Centralized so the tracking params stay
  // consistent across native-share, copy-link, WhatsApp, Messages,
  // and Email paths. Each channel calls buildReferralUrl() then
  // composes the warm-copy prefill in its own preferred format.
  const buildReferralUrl = () =>
    `${window.location.origin}${buildTrackedGetStartedHref(searchString, {
      ref: fundId || "gift-success",
      src: "gift_success",
      loop_touchpoint: "gift_success_cta",
      loop_channel: "web",
      gift_session_id: sessionId || undefined,
    })}`

  // Warm prefill copy for the referral share. Mentions the gift that
  // just happened (anchor moment), names the moat (voice memos), and
  // leaves the "real money instead of toys" framing in. Length kept
  // tight so it fits in a one-line WhatsApp / Messages preview.
  // Per locked discipline: no em-dashes, no AI-slop closers, no
  // marketing-teaser quotes.
  const buildReferralCopy = () => {
    const referralUrl = buildReferralUrl()
    return `Just used Kiddo for a kid I love. Real investment money instead of toys, and family can leave voice memos that play on the kid's 18th birthday. Thought you'd like it for your family: ${referralUrl}`
  }

  const handleReferralShareNative = async () => {
    const referralUrl = buildReferralUrl()
    try {
      if (navigator.share) {
        await navigator.share({
          title: "Kiddo",
          text: buildReferralCopy(),
          url: referralUrl,
        })
        haptic("success")
        trackGiftEvent("share", { target: "referral_native_share" })
      } else {
        await handleReferralShare()
      }
    } catch {
      // share dismissed or unsupported, nothing to do
    }
  }

  const handleReferralShareWhatsApp = () => {
    haptic("selection")
    const text = encodeURIComponent(buildReferralCopy())
    window.open(`https://wa.me/?text=${text}`, "_blank", "noopener,noreferrer")
    trackGiftEvent("share", { target: "referral_whatsapp" })
  }

  const handleReferralShareMessages = () => {
    haptic("selection")
    // sms: scheme works on iOS (iMessage) + Android (default SMS app).
    // Body param uses the ?body= form (most reliable across iOS / Android).
    const text = encodeURIComponent(buildReferralCopy())
    window.open(`sms:?&body=${text}`, "_blank")
    trackGiftEvent("share", { target: "referral_messages" })
  }

  const handleReferralShareEmail = () => {
    haptic("selection")
    const subject = encodeURIComponent("Worth a look: Kiddo")
    const body = encodeURIComponent(buildReferralCopy())
    window.open(`mailto:?subject=${subject}&body=${body}`, "_blank")
    trackGiftEvent("share", { target: "referral_email" })
  }

  const handleReferralShare = async () => {
    const referralUrl = buildReferralUrl()
    try {
      await navigator.clipboard.writeText(referralUrl)
      haptic("success")
      trackGiftEvent("share", { target: "get_started_referral_link" })
      toast({ title: "Referral link copied", description: "Share it with a parent to get them started." })
    } catch { }
  }

  const handleFundShare = async () => {
    try {
      if (navigator.share) {
        await navigator.share({ title: fundName, text: `Here is the Kiddo gift link for ${fundName}.`, url: shareUrl })
      } else {
        await navigator.clipboard.writeText(shareUrl)
        toast({ title: "Gift link copied", description: "Save it for the next gifting moment." })
      }
      haptic("success")
      trackGiftEvent("share", { target: "fund_share_link" })
    } catch { }
  }

  const handleSubmitNote = async (isRetry = false) => {
    // Submit if ANY field has a value — note OR photo OR video OR voice.
    // Server enforces per-field first-write-wins, so re-submitting after
    // adding only a photo will land just the photo without affecting an
    // earlier-saved note.
    const trimmedNote = noteText.trim()
    const hasAnyMedia = !!(memoryMedia.photoUrl.trim() || memoryMedia.videoUrl.trim() || memoryMedia.audioUrl.trim())
    if ((!trimmedNote && !hasAnyMedia) || !sessionId) return
    if (isRetry) setNoteRetrying(true)
    else setSubmittingNote(true)
    setNoteError(null)
    try {
      const res = await fetch(`/api/public/gifts/session/${encodeURIComponent(sessionId)}/note`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          note: trimmedNote || undefined,
          photoUrl: memoryMedia.photoUrl.trim() || undefined,
          videoUrl: memoryMedia.videoUrl.trim() || undefined,
          audioUrl: memoryMedia.audioUrl.trim() || undefined,
          audioTranscript: memoryMedia.audioTranscript.trim() || undefined,
        }),
      })
      const data = await res.json().catch(() => ({}))
      if (res.status === 404) {
        // Gift still settling - webhook hasn't fired yet
        setNoteError("still-settling")
        return
      }
      if (!res.ok) throw new Error(data?.error || "Could not save")
      haptic("success")
      setNoteSubmitted(true)
      setNoteError(null)
    } catch {
      toast({ title: "Could not save", description: "Please try again.", variant: "destructive" })
    } finally {
      setSubmittingNote(false)
      setNoteRetrying(false)
    }
  }

  const handleRecurringConfirm = async (recurringAmount: number, frequency: string, reminderEmail: string) => {
    try {
      const res = await fetch("/api/recurring-gifts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fundId,
          senderName,
          senderEmail: reminderEmail,
          amount: recurringAmount,
          frequency,
          occasionType: frequency === "yearly" ? "birthday" : "regular",
        }),
      })
      if (res.ok) {
        haptic("success")
        toast({ title: "Reminder saved", description: `We'll email ${reminderEmail} when it's time to gift ${fundName} again.` })
        trackGiftEvent("cta_click", { target: "gift_reminder_confirmed", amount: recurringAmount, frequency }, "gift_success_reminder")
        try { localStorage.setItem("kora:dismissed:reminder-nudge", "1"); } catch {}
        setRecurringModalOpen(false)
        setShowRecurringNudge(false)
      } else {
        const data = await res.json()
        toast({ title: "Could not save reminder", description: data.error || "Please try again", variant: "destructive" })
      }
    } catch {
      toast({ title: "Could not save reminder", description: "Please try again", variant: "destructive" })
    }
  }

  const looksLikeUuid = (value: string) =>
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value.trim())

  const fallbackFundName = fundId && !looksLikeUuid(fundId)
    ? fundId.replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())
    : "their fund"

  const fundName = (fundNameState && !looksLikeUuid(fundNameState)) ? fundNameState : fallbackFundName
  const provenanceName = fundName.replace(/\s+fund$/i, "").replace(/'s$/i, "").trim()
  const childFirstName = provenanceName && provenanceName.toLowerCase() !== "their" ? provenanceName : null
  const senderLooksGeneric = /^someone who loves /i.test(senderName) || senderName === "Someone"
  const numericAmount = Number(amount)
  // "Your gift could grow to ~$X at age 18" — routes through the canonical
  // projectFundValue helper so the gifter sees the same fee-netted,
  // effective-rate-compounded number that every other surface uses.
  // Migrated from raw Math.pow(1.07, yearsUntil18) on 2026-05-21 as part
  // of the projection-helper consolidation sweep; previously this gifter-
  // facing projection ran slightly higher than the parent-facing
  // projections on Dashboard / Projection / Memory Book.
  const projectedAmount = Number.isFinite(numericAmount) && numericAmount > 0 && yearsUntil18 > 1
    ? projectFundValue({
        startingValue: numericAmount,
        monthlyContribution: 0,
        yearsAhead: yearsUntil18,
      })
    : null

  const { data: tickerQuoteData } = useQuery<{ quotes: Array<{ symbol: string; price: number }> }>({
    queryKey: ["gift-success-ticker-quote", ticker],
    queryFn: async () => {
      const res = await fetch(`/api/market/quotes?symbols=${encodeURIComponent(ticker)}`)
      if (!res.ok) return { quotes: [] }
      return res.json()
    },
    enabled: !!ticker && executionModel === "pick",
    staleTime: 5 * 60 * 1000,
  })

  const tickerCurrentPrice = tickerQuoteData?.quotes?.[0]?.price ?? null
  const estimatedShares = tickerCurrentPrice && tickerCurrentPrice > 0 && numericAmount > 0
    ? numericAmount / tickerCurrentPrice
    : null
  const estimatedSharesLabel = estimatedShares !== null
    ? (estimatedShares >= 1 ? estimatedShares.toFixed(2) : estimatedShares.toFixed(2))
    : null
  const companyInfo = ticker ? COMPANY_INFO[ticker.toUpperCase()] : null
  const companyName = companyInfo?.name || ticker

  // Pull the fund's CURRENT position for this ticker so we can render the "before / after"
  // panel — the brilliant moment the gifter sees what their specific gift just grew, not
  // just an abstract "0.41 shares." Public endpoint returns ONLY this ticker's row, never
  // the full portfolio.
  const { data: holdingData } = useQuery<{
    ticker: string
    exists: boolean
    shares?: string
    costBasis?: string
    currentValue?: string
    name?: string
  }>({
    queryKey: ["gift-success-holding", fundId, ticker],
    queryFn: async () => {
      if (!fundId || !ticker) return { ticker: ticker || "", exists: false }
      const res = await fetch(`/api/public/funds/${encodeURIComponent(fundId)}/holding/${encodeURIComponent(ticker)}`)
      if (!res.ok) return { ticker, exists: false }
      return res.json()
    },
    enabled: !!fundId && !!ticker && executionModel === "pick",
    staleTime: 30_000,
  })

  // After / before computation. "After" = whatever the fund holds right now. "Before" =
  // after minus what THIS gift just bought. Uses a slight epsilon so "no prior position"
  // (rounding noise) gets treated as a fresh start, not a misleading 0.0001-share before.
  const afterShares = holdingData?.exists && holdingData.shares != null
    ? parseFloat(String(holdingData.shares)) : null
  const afterValue = holdingData?.exists && holdingData.currentValue != null
    ? parseFloat(String(holdingData.currentValue)) : null
  const beforeShares = afterShares !== null && estimatedShares !== null
    ? Math.max(0, afterShares - estimatedShares) : null
  const beforeValue = beforeShares !== null && tickerCurrentPrice && tickerCurrentPrice > 0
    ? beforeShares * tickerCurrentPrice : null
  const HAD_PRIOR_POSITION_EPSILON = 0.0001
  const hadPriorPosition = beforeShares !== null && beforeShares > HAD_PRIOR_POSITION_EPSILON
  const stakeGrowthPct = hadPriorPosition && beforeValue !== null && beforeValue > 0 && afterValue !== null
    ? ((afterValue - beforeValue) / beforeValue) * 100
    : null
  const formatShares = (n: number) => (n >= 1 ? n.toFixed(2) : n.toFixed(4))
  const formatMoneyShort = (n: number) =>
    new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n)

  const handleSaveUpdates = async () => {
    const normalized = updatesEmail.trim().toLowerCase()
    if (!sessionId) {
      toast({ title: "Missing session", description: "We couldn't attach updates to this gift.", variant: "destructive" })
      return
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalized)) {
      toast({ title: "Enter a valid email", description: "We need a valid email to send milestone updates.", variant: "destructive" })
      return
    }
    try {
      setSavingUpdates(true)
      const res = await fetch("/api/gifter-notifications/opt-in", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId, email: normalized, name: senderLooksGeneric ? undefined : senderName }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data?.error || "Could not save your preference.")
      haptic("success")
      setUpdatesSaved(true)
      toast({ title: "Updates saved", description: `You'll hear about ${data?.childName || fundName}'s big milestones once in a while.` })
      trackGiftEvent("cta_click", { target: "gifter_updates_opt_in", emailCaptured: true }, "gift_success_updates")
      trackGiftEvent("gifter_updates_opt_in", { baselineEvent: "gifter_completes_to_updates_opt_in", emailCaptured: true }, "gifter_completes_to_updates_opt_in")
    } catch (error) {
      toast({ title: "Could not save updates", description: error instanceof Error ? error.message : "Please try again.", variant: "destructive" })
    } finally {
      setSavingUpdates(false)
    }
  }

  const handleSaveFund = async () => {
    trackGiftEvent("cta_click", { target: "gifter_save_fund", method: "open_fund_in_new_tab" }, "gift_success_dashboard")
    haptic("success")

    // Open the fund page in a new tab so the user's NATIVE browser tools
    // (Cmd+D on desktop, Share → Add to Home Screen on mobile) operate on
    // the correct URL — Emma's evergreen gift link, not this success page.
    //
    // The previous platform-specific dance had three real bugs:
    //   1) Android installPrompt installed the WHOLE Kora PWA from the
    //      manifest's start_url, not Emma's gift page. The user thought
    //      they were saving Emma's link; they got the Kora app icon.
    //   2) iOS Web Share opened the iOS share sheet, which is for sending
    //      a URL TO another app (Messages, Mail). It does NOT include
    //      Add to Home Screen — that's the separate Safari share button,
    //      which acts on the CURRENT page (the success URL with stale
    //      query params), not the URL passed to navigator.share.
    //   3) Desktop toast told users to press Cmd+D, which bookmarks the
    //      CURRENT page (success URL), not the link they just copied.
    //
    // Opening the fund page first sidesteps all three. On the new tab,
    // every platform's bookmark / save-to-home-screen action operates on
    // Emma's link, which is what the user actually wanted.
    const opened = window.open(shareUrl, "_blank", "noopener,noreferrer")

    // Belt + suspenders: also copy the URL to the clipboard. Covers two
    // failure modes — popup blocker swallowing the new tab, OR user
    // closing the new tab before they bookmark it.
    try { await navigator.clipboard.writeText(shareUrl) } catch { }

    if (!opened) {
      // Popup blocker. The clipboard fallback is now the user's only path.
      toast({
        title: `${fundName}'s link copied`,
        description: "Paste it into your browser to bookmark or save to home screen.",
      })
      return
    }

    if (isMobileDevice) {
      toast({
        title: `${fundName}'s link is open`,
        description: "Tap your browser's share button → Add to Home Screen on the new tab.",
      })
    } else {
      const isMac = typeof navigator !== "undefined" && (navigator.platform?.toLowerCase().includes("mac") || navigator.userAgent.toLowerCase().includes("mac"))
      toast({
        title: `${fundName}'s link is open`,
        description: `Press ${isMac ? "Cmd" : "Ctrl"}+D in the new tab to bookmark it.`,
      })
    }
  }

  return (
    <div className="kiddo-app-page min-h-screen">
      <div className="kiddo-canvas flex flex-col items-center px-4 py-8">

        {/* Logo */}
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="mb-10 text-center"
        >
          <Logo size="lg" className="justify-center" linkTo={null} />
          <div className="mt-1 text-xs font-medium text-muted-foreground">Gifts that last.</div>
        </motion.div>

        {/* 🌱 Sprout - first thing they see */}
        <motion.div
          className="mb-5 flex justify-center"
          initial={{ scale: 0.2, opacity: 0, y: 20 }}
          animate={{ scale: 1, opacity: 1, y: 0 }}
          transition={{ delay: 0.15, duration: 0.6, type: "spring", stiffness: 240, damping: 16 }}
          aria-hidden="true"
        >
          <span className="text-6xl select-none" style={{ filter: "drop-shadow(0 6px 16px rgba(39,74,56,0.22))" }}>🌱</span>
        </motion.div>

        {/* Headline — recurring vs one-time. Recurring setup gets a
            distinct headline ("Your monthly to Emma is set up") so the
            gifter understands they've actually established a subscription,
            not just sent a one-time gift. The one-time copy ("Your gift
            is growing") would mislead a recurring setup. */}
        <motion.h1
          className="font-heading text-3xl md:text-4xl font-bold text-center mb-2"
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.38, duration: 0.45 }}
          data-testid="text-success-heading"
        >
          {isRecurringSetup
            ? `Your ${recurringCadenceLabel} is set up.`
            : "Your gift is growing."}
        </motion.h1>

        {/* Subheadline */}
        <motion.p
          className="text-muted-foreground text-center mb-2"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.52 }}
          data-testid="text-success-subheading"
        >
          {isRecurringSetup
            ? `${childFirstName || "They"} will receive $${amount} ${recurringCadenceLabel} from you, starting today.`
            : `You just invested $${amount} in ${childFirstName ? `${childFirstName}'s` : "their"} future.`}
        </motion.p>

        {/* Settling-window note. Tells the gifter the gift takes 1 to 2
            business days to land in the kid's investments. Without this,
            a gifter who checks the kid's balance on day 1 sees a
            mismatch between what they sent and what's invested and
            wonders where the rest went. Per the money-classification
            audit (2026-05-14), this is the lowest-leverage / highest-
            confusion gap to close. Calm muted register; not a love
            mark. */}
        <motion.p
          className="mx-auto max-w-md text-center text-xs text-muted-foreground/80 mb-6"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.62 }}
          data-testid="text-success-settling-note"
        >
          {isRecurringSetup
            ? `Settles into ${childFirstName ? `${childFirstName}'s` : "their"} investments over the next 1 to 2 business days. Manage or cancel any time from your gifter dashboard.`
            : `Settles into ${childFirstName ? `${childFirstName}'s` : "their"} investments over the next 1 to 2 business days.`}
        </motion.p>

        {/* Gifter dashboard CTA for recurring gifts (shipped 2026-05-23
            after user flagged: "theres gifter dashboards? wheres it
            at?"). The dashboard already existed at /gifter, but
            nothing on the success page surfaced the link. Recurring
            gifters are the cohort that NEEDS this surface most (to
            cancel, change amount, see history); one-time gifters
            don't usually need it post-send. So the CTA fires only
            for isRecurringSetup. */}
        {isRecurringSetup && (
          <motion.div
            className="flex justify-center mb-6"
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.66, duration: 0.4 }}
            data-testid="cta-success-gifter-dashboard"
          >
            <Link href="/gifter">
              <Button variant="outline" size="sm" className="rounded-full">
                See your gifter dashboard
              </Button>
            </Link>
          </motion.div>
        )}

        {/* One-time gifters: "send another" CTA. The team-audit conversion
            specialist flagged that one-time gifters land on success with
            NO follow-up CTA (only recurring gifters get the dashboard
            link). A gifter who just sent $50 and felt good is in the
            highest-intent moment to send again or save the fund for
            next year. The CTA routes back to the gift page (using
            fundSlug when resolved, fundId as fallback) so the gifter
            can immediately start another gift. Audit 2026-05-25. */}
        {!isRecurringSetup && (fundSlug || fundId) && (
          <motion.div
            className="flex justify-center mb-6"
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.66, duration: 0.4 }}
            data-testid="cta-success-send-another"
          >
            <Link href={`/${fundSlug || fundId}`}>
              <Button variant="outline" size="sm" className="rounded-full" data-testid="button-send-another">
                Send {childFirstName ? `${childFirstName}` : "another gift"} again →
              </Button>
            </Link>
          </motion.div>
        )}

        {/* Affirmative anonymous confirmation. Replaces what would
            otherwise read as "Someone added $50..." (placeholder name)
            with explicit acknowledgment that the gifter chose anonymous
            and that the family won't see their name. Calm pill, not
            celebratory — anonymous is a deliberate privacy choice that
            should feel respected, not flagged. */}
        {isAnonymous && (
          <motion.div
            className="mb-6 flex justify-center"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.7, duration: 0.4 }}
            data-testid="text-success-anonymous-confirm"
          >
            <div className="inline-flex flex-col items-center rounded-2xl border border-[hsl(var(--kiddo-evergreen)/0.30)] bg-[hsl(var(--kiddo-evergreen)/0.05)] px-5 py-3 max-w-md">
              <p className="text-sm font-semibold text-foreground">Sent anonymously.</p>
              <p className="mt-1 text-xs text-muted-foreground text-center leading-relaxed">
                {childFirstName ? `${childFirstName}'s` : "The"} family knows the gift came in but won&apos;t see your name. You won&apos;t appear in the public &quot;who&apos;s already given&quot; list either.
              </p>
            </div>
          </motion.div>
        )}
        {!isAnonymous && <div className="mb-4" />}

        {/* Position card — two flavors:
            (a) Prior position exists → before/after: "You grew Emma's Spotify position by
                X%". The brilliant moment per the spec — the gifter feels what they did,
                not just a fraction.
            (b) Fresh position → "You started Emma's Spotify position" with the new
                shares. Same warmth, different framing.
            Falls back to the simple "~X shares" line if we don't have the holding data
            yet (network blip / first-render). */}
        {estimatedSharesLabel && tickerCurrentPrice && ticker && (
          <motion.div
            className="mb-4 w-full max-w-sm rounded-2xl border border-[hsl(var(--kiddo-evergreen)/0.18)] bg-[hsl(var(--kiddo-evergreen)/0.05)] px-5 py-4"
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.6 }}
            data-testid="text-estimated-shares"
          >
            {hadPriorPosition && afterShares !== null && beforeShares !== null && stakeGrowthPct !== null && beforeValue !== null && afterValue !== null ? (
              // BEFORE / AFTER: prior position existed, this gift grew it
              <>
                <p className="text-[10.5px] font-bold uppercase tracking-wide text-[hsl(var(--kiddo-evergreen))] mb-2 text-center inline-flex items-center justify-center gap-1.5 w-full">
                  <span>{childFirstName ? `${childFirstName}'s` : "The"}</span>
                  <StockLogo ticker={ticker} size={14} className="inline-block" />
                  <span>{companyName} position</span>
                </p>
                <div className="grid grid-cols-2 gap-3 mt-2">
                  <div className="text-center">
                    <p className="text-[10px] uppercase tracking-wide text-muted-foreground/80 mb-0.5">Before</p>
                    <p className="font-heading text-base font-bold text-foreground/70 tabular-nums">
                      {formatShares(beforeShares)} <span className="text-[11px] font-normal text-muted-foreground/70">shares</span>
                    </p>
                    <p className="text-[11px] text-muted-foreground tabular-nums">{formatMoneyShort(beforeValue)}</p>
                  </div>
                  <div className="text-center">
                    <p className="text-[10px] uppercase tracking-wide text-[hsl(var(--kiddo-evergreen))] font-bold mb-0.5">After 🌱</p>
                    <p className="font-heading text-base font-bold text-foreground tabular-nums">
                      {formatShares(afterShares)} <span className="text-[11px] font-normal text-muted-foreground">shares</span>
                    </p>
                    <p className="text-[11px] text-foreground tabular-nums font-semibold">{formatMoneyShort(afterValue)}</p>
                  </div>
                </div>
                <div className="mt-3 pt-3 border-t border-[hsl(var(--kiddo-evergreen)/0.15)] text-center">
                  <p className="text-sm font-semibold text-foreground">
                    You grew {childFirstName ? `${childFirstName}'s` : "the"} {companyName} stake by{" "}
                    <span className="text-[hsl(var(--kiddo-evergreen))] tabular-nums">{stakeGrowthPct >= 100 ? Math.round(stakeGrowthPct) : stakeGrowthPct.toFixed(0)}%</span>.
                  </p>
                </div>
              </>
            ) : afterShares !== null ? (
              // FRESH POSITION: this gift started the position
              <>
                <p className="text-[10.5px] font-bold uppercase tracking-wide text-[hsl(var(--kiddo-evergreen))] mb-2 text-center inline-flex items-center justify-center gap-1.5 w-full">
                  <span>{childFirstName ? `${childFirstName}'s first` : "First"}</span>
                  <StockLogo ticker={ticker} size={14} className="inline-block" />
                  <span>{companyName} shares</span>
                </p>
                <p className="font-heading text-2xl font-bold text-foreground tabular-nums text-center">
                  {formatShares(afterShares)} <span className="text-sm font-normal text-muted-foreground">shares</span>
                </p>
                {afterValue !== null && (
                  <p className="text-xs text-muted-foreground text-center mt-0.5 tabular-nums">{formatMoneyShort(afterValue)}</p>
                )}
                <p className="mt-2 text-sm font-semibold text-foreground text-center">
                  You started {childFirstName ? `${childFirstName}'s` : "this"} {companyName} story.
                </p>
              </>
            ) : (
              // FALLBACK: holding data not yet available — keep the simple estimate
              <>
                <p className="text-base font-semibold text-foreground text-center inline-flex items-center justify-center gap-1.5 w-full">
                  <span>~{estimatedSharesLabel} shares of</span>
                  <StockLogo ticker={ticker} size={18} className="inline-block" />
                  <span>{companyName}</span>
                </p>
                <p className="mt-0.5 text-xs text-muted-foreground text-center">
                  at ~${tickerCurrentPrice.toFixed(2)}/share
                </p>
              </>
            )}
            <p className="mt-2.5 text-[10px] text-muted-foreground/60 text-center">
              Final shares and value confirmed after market execution.
            </p>
          </motion.div>
        )}

        {/* Goal progress — the dopamine hit. When the event has a goal, show
            the bar move with this gift baked in. Two states: still-climbing
            (default) and goal-reached (🌟 celebration). Hidden for anytime
            gifts and goalless occasions; their warmth lives elsewhere. */}
        {eventInfo && eventInfo.goalAmount !== null && eventInfo.goalAmount > 0 && (() => {
          const eventEmoji = eventInfo.eventType
            ? EVENT_TYPE_EMOJI[String(eventInfo.eventType).toLowerCase()] || "🎁"
            : "🎁"
          const total = eventInfo.giftVolume
          const goal = eventInfo.goalAmount
          const pct = Math.max(0, Math.min(100, (total / goal) * 100))
          const reached = eventInfo.goalReached
          const childName = childFirstName || "they"
          const fmtMoney = (n: number) =>
            new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n)
          return (
            <motion.div
              className="mb-4 w-full max-w-sm rounded-2xl border border-[hsl(var(--kiddo-evergreen)/0.18)] bg-[hsl(var(--kiddo-evergreen)/0.05)] px-5 py-4"
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.66 }}
              data-testid="card-event-goal-progress"
            >
              <div className="flex items-center gap-2 mb-2">
                <span className="text-xl leading-none">{eventEmoji}</span>
                <p className="text-[10.5px] font-bold uppercase tracking-wide text-[hsl(var(--kiddo-evergreen))]">
                  {reached
                    ? `Goal reached for ${eventInfo.name}`
                    : `New total toward ${eventInfo.name}`}
                </p>
              </div>
              <div className="flex items-baseline justify-between mb-1.5">
                <p className="font-heading text-xl font-bold text-foreground tabular-nums">
                  {fmtMoney(total)} <span className="text-sm font-normal text-muted-foreground">of {fmtMoney(goal)}</span>
                </p>
                <p className="text-xs font-semibold text-[hsl(var(--kiddo-evergreen))] tabular-nums">{Math.round(pct)}%</p>
              </div>
              <div className="h-2.5 rounded-full bg-[hsl(var(--kiddo-evergreen)/0.12)] overflow-hidden">
                <motion.div
                  className="h-full rounded-full bg-[hsl(var(--kiddo-evergreen))]"
                  initial={{ width: "0%" }}
                  animate={{ width: `${pct}%` }}
                  transition={{ delay: 0.78, duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
                />
              </div>
              <p className="mt-2.5 text-[11.5px] text-muted-foreground leading-relaxed">
                {reached
                  ? `${childName} hit the goal. Every dollar from here just keeps growing.`
                  : `${fmtMoney(Math.max(0, goal - total))} to go. Every gift gets ${childName} closer.`}
              </p>
            </motion.div>
          )
        })()}

        {/* Projection */}
        {projectedAmount && (
          <motion.p
            className="mb-4 w-full max-w-sm rounded-2xl border border-[hsl(var(--kiddo-gold)/0.35)] bg-[hsl(var(--kiddo-gold)/0.10)] px-4 py-3 text-center text-sm font-medium text-foreground"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.68 }}
            data-testid="text-success-projection"
          >
            At 7% historical average returns, that could be about ${projectedAmount.toLocaleString()} when {childFirstName || "they"} turn{childFirstName ? "s" : ""} {majorityAge}. Not guaranteed. But gifts that last? Those are.
          </motion.p>
        )}

        {/* Provenance */}
        <motion.p
          className="mb-6 rounded-full border border-[hsl(var(--kiddo-evergreen)/0.15)] bg-[hsl(var(--kiddo-evergreen)/0.06)] px-4 py-2 text-center text-xs font-semibold text-[hsl(var(--kiddo-evergreen))]"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.76 }}
          data-testid="text-gift-provenance"
        >
          This gift was invested with Kiddo. Gifts that actually last.
        </motion.p>

        {/* Quiet "send another" affordance. NOT a card, NOT a primary
            button — just a small text link near the celebration moment.
            The most-likely-to-give-again person is the one who just gave;
            hiding the path entirely behind "Keep Emma's link ready"
            (which is framed as save-for-later, not act-now) leaves an
            obvious surface gap. Per the gifter Robinhood-minimal register
            this stays restrained — single line, evergreen text-link
            treatment, no card chrome. Only renders when we know the
            target URL (fundSlug resolved). */}
        {shareReady && fundSlug && (
          <motion.div
            className="mb-6 text-center"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.80 }}
          >
            <Link
              href={`/${fundSlug}`}
              data-testid="link-gift-again"
              onClick={() => {
                haptic("selection")
                // PLG loop measurement — answers "did this completed
                // gift produce a return-to-checkout intent?" Metadata
                // captures the prior gift's ticker + amount so we can
                // see whether repeat-gift intent skews toward bigger
                // / smaller / different-stock gifts. Channel override
                // routes the event to a distinct funnel slice.
                trackGiftEvent(
                  "gift_again_click",
                  {
                    priorTicker: ticker || null,
                    priorAmount: amount || null,
                    fundSlug: fundSlug || null,
                  },
                  "gift_success_repeat",
                )
              }}
              className="inline-flex items-center gap-1 text-sm font-semibold text-[hsl(var(--kiddo-evergreen))] hover:opacity-75 transition-opacity"
            >
              {childFirstName ? `Send ${childFirstName} another` : "Send another gift"}
              <span aria-hidden>→</span>
            </Link>
          </motion.div>
        )}

        {/* Share this gift - prominent early CTA, only when slug is resolved */}
        {shareReady && (
          <motion.div
            className="mb-8 w-full max-w-sm flex gap-2"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.82 }}
          >
            <Button className="flex-1 gap-2" onClick={handleFundShare} data-testid="button-share-gift-early">
              <Share2 className="w-4 h-4" />
              Share this gift 🎁
            </Button>
            <Button variant="outline" className="gap-2 px-3" onClick={handleCopyLink} data-testid="button-copy-link-early">
              {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
            </Button>
          </motion.div>
        )}

        {/* Gift summary card */}
        <motion.div
          className="kiddo-card w-full p-6 space-y-4 mb-8"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.88, duration: 0.5 }}
          data-testid="card-gift-summary"
        >
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-[hsl(var(--kiddo-evergreen)/0.10)] flex items-center justify-center">
              <Gift className="w-5 h-5 text-[hsl(var(--kiddo-evergreen))]" />
            </div>
            <h2 className="font-heading text-lg font-semibold" data-testid="text-gift-amount">
              You sent ${amount} to {fundName}
            </h2>
          </div>

          <div className="space-y-3 text-sm text-muted-foreground">
            {giftStatus === "host_hold" && (
              <p className="rounded-2xl border border-amber-200 bg-amber-50 px-3 py-2 text-amber-800" data-testid="text-large-gift-hold">
                This large gift is waiting up to 24 hours before final processing so the parent can upgrade and protect more of it.
                {holdUntil ? ` Hold ends ${new Date(holdUntil).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}.` : ""}
              </p>
            )}
            {ticker ? (
              <p data-testid="text-investment-info">
                <span className="font-semibold text-foreground">${amount}</span> is tied to <span className="font-semibold text-foreground">{companyName || ticker}</span> for this gift, so the story stays personal.
              </p>
            ) : executionModel === "auto" ? (
              <p data-testid="text-investment-info">It follows the family's chosen investing path automatically.</p>
            ) : executionModel === "family" ? (
              <p data-testid="text-investment-info">It lands in the fund for the family to invest later.</p>
            ) : (
              <p data-testid="text-investment-info">It will follow the family's selected gift path.</p>
            )}

            {/* Memory book + note prompt */}
            {(() => {
              const attachmentLabel = hasAudio ? "voice note" : hasVideo ? "video" : hasPhoto ? "photo" : null
              const childLabel = childFirstName ? `${childFirstName}'s` : "their"
              const childTarget = childFirstName || "them"

              if (hasMessage) {
                return (
                  <p data-testid="text-memory-book-info">
                    Your note is in {childLabel} Memory Book. {attachmentLabel ? `Your ${attachmentLabel} is there too.` : "They will read it when they are older."}
                  </p>
                )
              }

              if (noteSubmitted) {
                return (
                  <p data-testid="text-memory-book-info">
                    <span className="font-semibold text-foreground">Your note is in {childLabel} Memory Book.</span>
                    {attachmentLabel ? ` Your ${attachmentLabel} is there too.` : " They will read it when they are older."}
                  </p>
                )
              }

              // Always-on add-anything-you-forgot block. Note + the
              // shared MemoryMediaPicker (photo + video + voice). Per
              // project_giving_flows_full_media.md, every giving flow
              // exposes the full trio. The success page is the
              // gifter's last touchpoint — surface what they could add,
              // don't force them to dig back through checkout.
              const hasAnyMediaPicked = !!(memoryMedia.photoUrl.trim() || memoryMedia.videoUrl.trim() || memoryMedia.audioUrl.trim())
              const canSubmit = !!noteText.trim() || hasAnyMediaPicked
              return (
                <div data-testid="section-note-prompt">
                  <p className="mb-3">
                    {attachmentLabel
                      ? `Your ${attachmentLabel} is in ${childLabel} Memory Book. Add a note or more media — they read everything when they are older.`
                      : `This gift lives in ${childLabel} Memory Book forever. Add a note, photo, video, or voice memo. They read everything when they are older.`
                    }
                  </p>
                  <textarea
                    value={noteText}
                    onChange={(e) => { setNoteText(e.target.value); setNoteError(null) }}
                    placeholder={`Write something to ${childTarget}...`}
                    rows={3}
                    className="w-full rounded-2xl border border-border bg-background px-4 py-3 text-sm text-foreground outline-none focus:border-[hsl(var(--kiddo-evergreen))] resize-none"
                    data-testid="input-note-text"
                  />
                  {fundId && !isAnonymous ? (
                    // MemoryMediaPicker uses the public upload endpoints
                    // (no auth required) when uploadEndpointPrefix is
                    // overridden — gifters aren't signed in. Voice is
                    // the moat per the design lens; the Picker handles
                    // the recorder + 60s cap + transcript prompt.
                    <div className="mt-3">
                      <MemoryMediaPicker
                        fundId={fundId}
                        value={memoryMedia}
                        onChange={setMemoryMedia}
                        childName={childFirstName}
                        uploadEndpointPrefix="/api/public/funds"
                      />
                    </div>
                  ) : fundId && isAnonymous ? (
                    // Anonymous + media is a hard ban (mirror of the
                    // checkout-side rule). The success page exists to
                    // let the gifter add what they forgot, but voice +
                    // photo + video all identify them. Note-only retains
                    // because text is the gifter's character-by-character
                    // authorship. See feedback_anonymous_as_explicit_flag.md.
                    <div className="mt-3 rounded-2xl border border-border bg-muted/30 p-3 text-xs text-muted-foreground leading-relaxed" data-testid="anonymous-media-disabled-note">
                      Anonymous gifts are note-only. Photos, videos, and voice memos identify you, so they can&apos;t be added when the gift is anonymous.
                    </div>
                  ) : null}
                  {noteError === "still-settling" ? (
                    <div className="mt-2 rounded-2xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
                      <p>The gift is still settling. Your message is ready. This usually takes 30 to 60 seconds. Try again in a moment, or wait for the page to refresh.</p>
                      <button
                        className="mt-1.5 font-semibold underline underline-offset-2 hover:opacity-70 transition-opacity"
                        disabled={noteRetrying}
                        onClick={() => handleSubmitNote(true)}
                      >
                        {noteRetrying ? "Trying..." : "Try again"}
                      </button>
                    </div>
                  ) : (
                    <Button
                      variant="outline"
                      size="sm"
                      className="mt-3 w-full"
                      disabled={!canSubmit || submittingNote}
                      onClick={() => handleSubmitNote()}
                      data-testid="button-submit-note"
                    >
                      {submittingNote ? "Saving..." : `Save to ${childTarget}'s Memory Book`}
                    </Button>
                  )}
                </div>
              )
            })()}
          </div>
        </motion.div>

        {/* Gifter updates opt-in */}
        <motion.div
          className="kiddo-card w-full p-6 mb-8"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.96, duration: 0.5 }}
          data-testid="card-gifter-updates-opt-in"
        >
          <div className="flex items-center gap-2 text-[hsl(var(--kiddo-evergreen))]">
            <Mail className="w-4 h-4" />
            <p className="text-sm font-medium">Stay part of {fundName}&apos;s story</p>
          </div>
          <h3 className="font-heading text-lg font-semibold mt-3">Get occasional milestone updates</h3>
          <p className="text-sm text-muted-foreground mt-2">
            Birthday reminders, parent-shared Memory Book updates, and one final note when they turn {majorityAge}. Parent-controlled, opt-in only, and never performance claims or spam. One-click unsubscribe in every email.
          </p>
          {senderName && !senderLooksGeneric && (
            <p className="mt-2 text-[11px] text-muted-foreground/80 leading-relaxed">
              Heads up — your first name now appears in {childFirstName ? `${childFirstName}'s` : "the"} family Memory Book and on the gift page as a "who's already given" name. Full name stays private.
            </p>
          )}
          <div className="mt-4 space-y-3">
            <input
              type="email"
              value={updatesEmail}
              onChange={(e) => setUpdatesEmail(e.target.value)}
              placeholder="you@example.com"
              className="h-12 w-full rounded-2xl border border-border bg-background px-4 text-sm"
              data-testid="input-gifter-updates-email"
            />
            <Button
              variant={updatesSaved ? "outline" : "default"}
              className="w-full"
              onClick={handleSaveUpdates}
              disabled={savingUpdates || updatesSaved}
              data-testid="button-save-gifter-updates"
            >
              {updatesSaved ? "Updates saved" : savingUpdates ? "Saving..." : "Save update preference"}
            </Button>
          </div>
        </motion.div>

        {/* Share / save section */}
        {shareReady && (
          <motion.div
            className="kiddo-card w-full p-6 mb-8"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 1.04, duration: 0.5 }}
            data-testid="card-share-section"
          >
            <h3 className="font-heading text-lg font-semibold text-center mb-1" data-testid="text-share-heading">
              Keep {fundName}&apos;s link ready
            </h3>
            <p className="text-sm text-muted-foreground text-center mb-4">
              Birthdays, holidays, and just-because days are easier when the gift link is already in the family thread.
            </p>
            <Button className="w-full mb-3 gap-2" onClick={handleFundShare} data-testid="button-share-message">
              <Share2 className="w-4 h-4" />
              Share {fundName}&apos;s link
            </Button>
            <Button variant="outline" className="w-full mb-3 gap-2" onClick={handleCopyLink} data-testid="button-copy-link">
              {copied ? <><Check className="w-4 h-4" />Link copied!</> : <><Copy className="w-4 h-4" />Copy link</>}
            </Button>
            <Button variant="outline" className="w-full mb-4 gap-2" onClick={handleSaveFund} data-testid="button-save-fund">
              {isMobileDevice
                ? <><Smartphone className="w-4 h-4" />Save to home screen</>
                : <><Bookmark className="w-4 h-4" />Bookmark {fundName}&apos;s fund</>
              }
            </Button>
            {/* Tiny 'Tell someone about Kiddo' link removed 2026-05-21
                and elevated to its own card below (the
                share-Kiddo-with-other-families surface). Single
                copy-link affordance lives here as a quiet fallback;
                the multi-channel surface is the primary referral
                experience now. */}
            <div className="flex items-center justify-center gap-4 text-xs text-muted-foreground">
              <button className="hover:text-foreground transition-colors flex items-center gap-1" onClick={handleReferralShare} data-testid="button-share-heart">
                <Heart className="w-3 h-3" />
                Copy a referral link
              </button>
            </div>
          </motion.div>
        )}

        {/* Share-Kiddo-with-other-families card. Added 2026-05-21 per
            the wow-factor / word-of-mouth audit: a satisfied gifter is
            the strongest 'who else would love this?' moment in the
            entire customer journey. Previously the only referral
            affordance was a tiny 'Tell someone about Kiddo' link
            buried at the bottom of the share card above. This card
            elevates it to a proper multi-channel surface with WhatsApp
            / Messages / Email / copy-link options, each pre-filling
            warm copy that mentions the gift just sent and the
            voice-memo moat.
            Order matters: this card sits AFTER 'Keep [fund]'s link
            ready' (which shares this kid's gift link with HER family)
            and BEFORE the 'Start a fund' CTA (which is for the
            gifter to start their own kid's fund). The three cards
            cover three distinct viral mechanics in the right
            psychological order. */}
        {shareReady && (
          <motion.div
            className="kiddo-card w-full p-6 mb-8"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.85, duration: 0.5 }}
            data-testid="card-share-kiddo-with-family"
          >
            <h3 className="font-heading text-lg font-semibold text-center mb-1" data-testid="text-share-kiddo-heading">
              Know a family who&apos;d love Kiddo too?
            </h3>
            <p className="text-sm text-muted-foreground text-center mb-4">
              Most Kiddo families found us through someone like you. Worth a moment to pass it along.
            </p>
            <div className="grid grid-cols-3 gap-2 mb-3">
              <button
                type="button"
                onClick={handleReferralShareWhatsApp}
                className="flex flex-col items-center justify-center gap-1.5 rounded-2xl py-3 bg-[rgb(37,211,102)] text-white font-medium text-xs hover:opacity-90 transition-opacity"
                data-testid="button-share-kiddo-whatsapp"
              >
                <WhatsAppIcon />
                WhatsApp
              </button>
              <button
                type="button"
                onClick={handleReferralShareMessages}
                className="flex flex-col items-center justify-center gap-1.5 rounded-2xl py-3 bg-[rgb(50,150,250)] text-white font-medium text-xs hover:opacity-90 transition-opacity"
                data-testid="button-share-kiddo-messages"
              >
                <MessageIcon />
                Messages
              </button>
              <button
                type="button"
                onClick={handleReferralShareEmail}
                className="flex flex-col items-center justify-center gap-1.5 rounded-2xl py-3 bg-[rgb(184,121,26)] text-white font-medium text-xs hover:opacity-90 transition-opacity"
                data-testid="button-share-kiddo-email"
              >
                <Mail className="w-[17px] h-[17px]" />
                Email
              </button>
            </div>
            <Button
              variant="outline"
              className="w-full gap-2"
              onClick={handleReferralShareNative}
              data-testid="button-share-kiddo-more"
            >
              <Share2 className="w-4 h-4" />
              More apps
            </Button>
          </motion.div>
        )}

        {/* Start a fund CTA */}
        <motion.div
          className="kiddo-card w-full p-6 mb-8"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 1.1, duration: 0.5 }}
          data-testid="card-start-fund-primary"
        >
          <h3 className="font-heading text-2xl font-semibold text-center text-foreground">
            Want to set up a fund for your own child or grandchild?
          </h3>
          <p className="text-sm text-muted-foreground text-center mt-2">
            Takes two minutes. No fees to start. The whole family can send lasting gifts in under a minute.
          </p>
          <a
            href={startFundHref}
            data-testid="link-start-fund-primary-card"
            onClick={() => {
              trackGiftEvent("cta_click", { target: "primary_start_fund_card" }, "gift_success_cta")
              trackGiftEvent("gifter_started_own_fund", { baselineEvent: "gifter_completes_to_starts_own_fund", target: "primary_start_fund_card" }, "gifter_completes_to_starts_own_fund")
            }}
          >
            <Button className="kiddo-gold-button w-full mt-5 h-14 text-base font-bold" size="lg">
              Start a Kiddo fund
            </Button>
          </a>
          <p className="text-center text-xs text-muted-foreground mt-3">Free to start. No credit card required.</p>
        </motion.div>

        {/* Recurring nudge */}
        {showRecurringNudge && (
          <motion.div
            className="w-full mb-8"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 1.18, duration: 0.5 }}
            data-testid="section-reminder-nudge"
          >
            <RecurringGiftNudge
              lastGiftDate={new Date().toISOString()}
              recipientName={fundName}
              occasionName={eventNameParam || undefined}
              onSetupRecurring={() => {
                trackGiftEvent("cta_click", { target: "gift_reminder_open_modal" }, "gift_success_reminder")
                setRecurringModalOpen(true)
              }}
              onDismiss={() => {
                trackGiftEvent("cta_click", { target: "gift_reminder_dismiss" }, "gift_success_reminder")
                try { localStorage.setItem("kora:dismissed:reminder-nudge", "1"); } catch {}
                setShowRecurringNudge(false)
              }}
            />
          </motion.div>
        )}

        <RecurringSetupModal
          isOpen={recurringModalOpen}
          onClose={() => setRecurringModalOpen(false)}
          recipientName={fundName}
          defaultEmail={receiptEmail || updatesEmail || ""}
          onConfirm={handleRecurringConfirm}
        />

        {/* Footer */}
        <motion.div
          className="w-full flex flex-col items-center gap-4"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 1.25, duration: 0.5 }}
        >
          <div className="flex items-center gap-4 text-sm text-muted-foreground">
            <Link href="/" className="hover:text-foreground transition-colors" data-testid="link-back-home">Back to home</Link>
            <span>·</span>
            <Link href="/faq" className="hover:text-foreground transition-colors">FAQ</Link>
            <span>·</span>
            <Link href="/security" className="hover:text-foreground transition-colors">Security</Link>
          </div>
          {/* SIPC + FINRA trust line on the post-payment success surface.
              Quantified per the team trust-audit (2026-05-25): previously
              read "Eligible assets have SIPC coverage" without the dollar
              amount, which felt like bait-and-switch vs the GiftCheckout
              landing page that DOES quantify ($500,000). Payment-completed
              is the highest-anxiety moment a gifter encounters — the
              dollar amount needs to repeat exactly here. Also surfaces
              the brokerage-failure-vs-market-loss distinction explicitly
              (was implicit in "Investing can go up or down" — too soft). */}
          <p className="text-[10px] text-muted-foreground/60 text-center px-4">
            Real stocks, real accounts. Assets held by DriveWealth, LLC (Member FINRA/SIPC). SIPC protection up to $500,000 against brokerage failure. SIPC does not protect against market losses.
          </p>
        </motion.div>

      </div>
    </div>
  )
}
