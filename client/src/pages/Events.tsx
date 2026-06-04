import { useState, useCallback, useEffect, useMemo } from "react";
import { getActiveFundId, ACTIVE_FUND_CHANGE_EVENT } from "@/hooks/use-active-fund";
import { Link } from "wouter";
import { motion, AnimatePresence } from "framer-motion";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Calendar, Gift, Share2, Plus, ChevronDown, TrendingUp, PartyPopper, Baby, TreeDeciduous, GraduationCap, Heart, Check, Crown, ExternalLink, X, Eye, Pencil, Download, Pause, Play, CalendarIcon, Home, Car, Briefcase, Plane, Shield, Star, Target } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar as CalendarPicker } from "@/components/ui/calendar";
import { RichTextEditor, RichText } from "@/components/ui/rich-text-editor";
import { QRCodeSVG } from "qrcode.react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Logo } from "@/components/ui/logo";
import { haptic } from "@/lib/haptics";
import { capFirst } from "@/lib/format-name";
import { TrustMicroStrip } from "@/components/ui/ux-foundations";
import { GradientText, EnlighteningReveal, ThinkingOrb } from "@/components/ui/gemini";
import { useAuth } from "@/hooks/use-auth";
import { useSubscription } from "@/hooks/use-subscription";
import { useCachedFirstNumber } from "@/hooks/use-cached-first-number";
import { useEvents, useUpdateEvent } from "@/hooks/use-events";
import { useFunds } from "@/hooks/use-funds";
import { toast } from "@/hooks/use-toast";
import { EventGateModal } from "@/components/EventGateModal";
import { MascotMoment } from "@/components/ui/mascot-moment";
import { GoalCard, EventPassBadge } from "@/components/ui/premium-themes";
import { ShareModal, type SharePage } from "@/components/ui/share-modal";
import { LOCAL_CACHE_KEYS, readLocalCache, writeLocalCache } from "@/lib/local-cache";
import { AppHeader } from "@/components/layout/AppHeader";
import type { Event } from "@shared/schema";
import { trackReferralEvent } from "@/lib/acquisition";

function getEventTypeLabel(eventType: string | null | undefined): string {
  switch (eventType) {
    case "birthday": return "Birthday";
    case "baby_shower": return "Baby Shower";
    case "holiday": return "Holiday / seasonal";
    case "christmas": return "Christmas";
    case "graduation": return "Graduation";
    case "just_because": return "Just Because";
    case "gift_anytime": return "Anytime gift page";
    default: return "Occasion";
  }
}

function getEventTypeIcon(eventType: string | null | undefined) {
  switch (eventType) {
    case "birthday": return <PartyPopper size={20} />;
    case "baby_shower": return <Baby size={20} />;
    case "holiday": return <TreeDeciduous size={20} />;
    case "christmas": return <TreeDeciduous size={20} />;
    case "graduation": return <GraduationCap size={20} />;
    case "just_because": return <Heart size={20} />;
    case "gift_anytime": return <Gift size={20} />;
    default: return <Gift size={20} />;
  }
}

function getSavingsGoalTypeLabel(eventType: string | null | undefined): string {
  switch (eventType) {
    case "college": return "College fund";
    case "car": return "First car";
    case "home": return "First home";
    case "travel": return "Gap year";
    case "business": return "Business seed";
    case "emergency": return "Emergency fund";
    default: return "Savings goal";
  }
}

function getSavingsGoalTypeIcon(eventType: string | null | undefined) {
  switch (eventType) {
    case "college": return <GraduationCap size={20} />;
    case "car": return <Car size={20} />;
    case "home": return <Home size={20} />;
    case "travel": return <Plane size={20} />;
    case "business": return <Briefcase size={20} />;
    case "emergency": return <Shield size={20} />;
    default: return <Target size={20} />;
  }
}

function getPublicEventPath(fundSlug: string | undefined, event: Event) {
  if (!fundSlug) return null;
  if (event.isPermanent) return `/${fundSlug}`;
  return `/${fundSlug}/${event.slug}`;
}

function getEventLifecycleSummary(event: Event) {
  const status = String(event.status || "active").toLowerCase();
  const goal = Number(event.goalAmount || 0);
  const raised = Number(event.giftVolume || 0);
  const giftCount = Number(event.giftCount || 0);
  const goalReached = goal > 0 && raised >= goal;
  const eventDatePassed = Boolean(!event.isPermanent && event.eventDate && new Date(event.eventDate).getTime() < Date.now());

  if (["paused", "archived", "closed"].includes(status)) {
    return {
      badge: "Closed",
      copy: raised > 0
        ? `$${raised.toFixed(0)} raised from ${giftCount} ${giftCount === 1 ? "person" : "people"}. Every dollar is already invested.`
        : event.isPermanent
          ? "This always-on gift page is not taking new gifts right now."
          : "This occasion is closed.",
    };
  }

  if (goalReached) {
    return {
      badge: "Goal reached",
      copy: `$${raised.toFixed(0)} raised from ${giftCount} ${giftCount === 1 ? "person" : "people"}. Every dollar is already invested.`,
    };
  }

  if (eventDatePassed) {
    return {
      badge: "Date passed",
      copy: raised > 0
        ? `$${raised.toFixed(0)} raised from ${giftCount} ${giftCount === 1 ? "person" : "people"}. Every dollar is already invested.`
        : "The occasion date passed. Kiddo keeps the page open until you close it.",
    };
  }

  // Active event with upcoming date - show days remaining
  if (!event.isPermanent && event.eventDate && status === "active") {
    const daysAway = Math.ceil((new Date(event.eventDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
    if (daysAway > 0) {
      return {
        badge: "Upcoming",
        copy: `${daysAway} ${daysAway === 1 ? "day" : "days"} away.${raised > 0 ? ` $${raised.toFixed(0)} raised${goal > 0 ? ` of $${goal.toFixed(0)} goal` : ""} so far.` : ""}`,
      };
    }
  }

  return null;
}

export default function Events() {
  const { user, isAuthenticated, isLoading: authLoading } = useAuth();
  const { data: subscription } = useSubscription();
  const { data: events = [], isLoading: eventsLoading } = useEvents();
  const { data: funds = [], isLoading: fundsLoading } = useFunds();
  const storedFundId = getActiveFundId();
  const activeFund = (storedFundId && funds.find((f: any) => f.id === storedFundId)) || funds[0] || null;
  // Post-handoff adult owner: occasions are still available (Share stays post-handoff), but
  // they're for collecting gifts to THEIR own fund — so "your" not "{child}'s".
  const isOwnerMode = Boolean((activeFund as any)?.transferredAt && (activeFund as any)?.accessRole === "owner");
  const { data: fundCodes = {} } = useQuery<Record<string, { code: string }>>({
    queryKey: ["/api/gift-codes/funds"],
    queryFn: async () => {
      const res = await fetch(`/api/gift-codes/funds`, { credentials: "include" });
      if (!res.ok) return {};
      const data = await res.json().catch(() => ({}));
      writeLocalCache(LOCAL_CACHE_KEYS.giftCodes, data);
      return data;
    },
    enabled: funds.length > 0,
    initialData: () => readLocalCache<Record<string, { code: string }>>(LOCAL_CACHE_KEYS.giftCodes),
    initialDataUpdatedAt: 0,
    staleTime: 1000 * 60 * 10,
  });
  const queryClient = useQueryClient();
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [editingEvent, setEditingEvent] = useState<Event | null>(null);
  const [editName, setEditName] = useState("");
  const [editDescription, setEditDescription] = useState("");
  const [editDate, setEditDate] = useState("");
  const [editType, setEditType] = useState("");
  const [editGoalAmount, setEditGoalAmount] = useState("");
  const [editImageUrl, setEditImageUrl] = useState("");
  const [imageUploading, setImageUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [eventGateOpen, setEventGateOpen] = useState(false);
  const [shareTargetPages, setShareTargetPages] = useState<SharePage[]>([]);
  const [shareModalOpen, setShareModalOpen] = useState(false);
  const [shareRecipientName, setShareRecipientName] = useState("");
  const [selectedFundId, setSelectedFundId] = useState<string>(
    storedFundId ? String(storedFundId) : "all"
  );
  useEffect(() => {
    const handler = (event: globalThis.Event) => {
      const id = (event as CustomEvent<{ id: string }>).detail?.id;
      if (id) setSelectedFundId(id);
    };
    window.addEventListener(ACTIVE_FUND_CHANGE_EVENT, handler);
    return () => window.removeEventListener(ACTIVE_FUND_CHANGE_EVENT, handler);
  }, []);
  const togglePauseMutation = useUpdateEvent();
  const isFamily = subscription?.effectivePlan === "family" || subscription?.effectivePlan === "legacy";
  const starterByFund = (subscription?.starterByFund || {}) as Record<string, any>;
  const hasAnyStarter = Object.values(starterByFund).some((membership: any) => {
    if (!membership) return false;
    if (membership.status === "active") return true;
    if (membership.status === "canceled" && membership.currentPeriodEnd) {
      return new Date(membership.currentPeriodEnd).getTime() > Date.now();
    }
    return false;
  });
  const isFree = !isFamily && !hasAnyStarter;
  const activeCustomEventCount = events.filter((event) => !event.isPermanent && event.status === "active").length;
  const activeEventLimit = isFamily ? Number.POSITIVE_INFINITY : hasAnyStarter ? 3 : 1;
  const canCreateAnotherEvent = activeCustomEventCount < activeEventLimit;
  const pendingEventPass: { count: number } | null = null;
  const pendingEventPassSessionId = "";
  const setPendingEventPassSessionId = (_value: string) => {};
  const setShowEventPassSuccess = (_value: boolean) => {};
  const fundLookup = Object.fromEntries(funds.map(f => [f.id, f]));
  const fundEventCounts = events.reduce<Record<string, number>>((acc, event) => {
    const key = event.fundId || "unknown";
    acc[key] = (acc[key] || 0) + 1;
    return acc;
  }, {});
  const filteredEvents = selectedFundId === "all"
    ? events
    : events.filter((event) => event.fundId === selectedFundId);
  const cachedEvents = useMemo(() => readLocalCache<Event[]>(LOCAL_CACHE_KEYS.events) || [], []);
  const cachedFunds = useMemo(() => readLocalCache<any[]>(LOCAL_CACHE_KEYS.funds) || [], []);
  const cachedFilteredEvents = selectedFundId === "all"
    ? cachedEvents
    : cachedEvents.filter((event) => event.fundId === selectedFundId);
  const cachedVisibleActive = cachedFilteredEvents.filter((e) => !e.isPermanent && e.eventType !== "gift_anytime" && e.status === "active").length;
  const visibleActive = filteredEvents.filter((e) => !e.isPermanent && e.eventType !== "gift_anytime" && e.status === "active").length;
  const { displayValue: displayVisibleActive } = useCachedFirstNumber({
    seedValue: cachedVisibleActive,
    liveValue: visibleActive,
    minDelta: 1,
  });
  const { displayValue: displayFilteredEventCount } = useCachedFirstNumber({
    seedValue: cachedFilteredEvents.length,
    liveValue: filteredEvents.length,
    minDelta: 1,
  });
  const { displayValue: displayTotalEventCount } = useCachedFirstNumber({
    seedValue: cachedEvents.length,
    liveValue: events.length,
    minDelta: 1,
  });
  const { displayValue: displayFundCount } = useCachedFirstNumber({
    seedValue: cachedFunds.length,
    liveValue: funds.length,
    minDelta: 1,
  });
  const groupedEvents = Object.entries(
    filteredEvents.reduce<Record<string, Event[]>>((acc, event) => {
      const key = event.fundId || "unknown";
      if (!acc[key]) acc[key] = [];
      acc[key].push(event);
      return acc;
    }, {})
  );

  const handleDownloadQR = useCallback((eventId: string, eventName: string) => {
    const svgElement = document.getElementById(`qr-svg-${eventId}`);
    if (!svgElement) return;
    const svgData = new XMLSerializer().serializeToString(svgElement);
    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d");
    const img = new Image();
    img.onload = () => {
      canvas.width = img.width;
      canvas.height = img.height;
      ctx?.drawImage(img, 0, 0);
      const pngUrl = canvas.toDataURL("image/png");
      const link = document.createElement("a");
      link.download = `${eventName.replace(/[^a-zA-Z0-9]/g, "-").toLowerCase()}-qr.png`;
      link.href = pngUrl;
      link.click();
      haptic("success");
    };
    img.src = "data:image/svg+xml;base64," + btoa(unescape(encodeURIComponent(svgData)));
  }, []);

  const openEditModal = (event: Event) => {
    setEditingEvent(event);
    setEditName(event.name);
    setEditDescription(event.description || "");
    setEditDate(event.eventDate ? new Date(event.eventDate).toISOString().split("T")[0] : "");
    setEditType(event.eventType || "");
    setEditGoalAmount(event.goalAmount ? String(parseFloat(event.goalAmount)) : "");
    setEditImageUrl((event as any).imageUrl || "");
    haptic("light");
  };

  const handleImageUpload = async (file: File) => {
    if (!editingEvent) return;
    setImageUploading(true);
    try {
      const reader = new FileReader();
      reader.onload = async (ev) => {
        const dataUrl = ev.target?.result as string;
        const res = await fetch(`/api/events/${editingEvent.id}/upload-image`, {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ dataUrl }),
        });
        if (res.ok) {
          const { url } = await res.json();
          setEditImageUrl(url);
          haptic("success");
        } else {
          toast({ title: "Image upload failed", variant: "destructive" });
        }
        setImageUploading(false);
      };
      reader.readAsDataURL(file);
    } catch {
      toast({ title: "Image upload failed", variant: "destructive" });
      setImageUploading(false);
    }
  };

  const handleSaveEvent = async () => {
    if (!editingEvent) return;
    setSaving(true);
    try {
      const updates: Record<string, any> = { name: editName.trim() };
      if (editDescription.trim()) updates.description = editDescription.trim();
      else updates.description = null;
      if (editDate) updates.eventDate = editDate;
      else updates.eventDate = null;
      if (editType) updates.eventType = editType;
      if (editGoalAmount && parseFloat(editGoalAmount) > 0) updates.goalAmount = String(parseFloat(editGoalAmount));
      else updates.goalAmount = null;
      if (editImageUrl) updates.imageUrl = editImageUrl;
      const res = await fetch(`/api/events/${editingEvent.id}`, {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(updates),
      });
      if (res.ok) {
        queryClient.invalidateQueries({ queryKey: ["/api/events"] });
        // Drop the dashboard-summary cache for this fund too — Dashboard
        // event tiles render from dashboard-summary.events, not from
        // /api/events directly. Without this the new image waits for the
        // 20s HTTP cache + staleTime to expire on the next dashboard visit.
        if (editingEvent.fundId) {
          queryClient.invalidateQueries({ queryKey: ["/api/funds", editingEvent.fundId, "dashboard-summary"] });
          queryClient.invalidateQueries({ queryKey: ["/api/funds", editingEvent.fundId, "events"] });
        }
        haptic("success");
        toast({ title: "Occasion updated", variant: "saved", duration: 1200 });
        setEditingEvent(null);
      } else {
        toast({ title: "Could not save changes", variant: "destructive" });
      }
    } catch {
      toast({ title: "Could not save changes", variant: "destructive" });
    }
    setSaving(false);
  };

  if (authLoading || eventsLoading || fundsLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center md:ml-[264px]">
        <ThinkingOrb size={40} variant="default" />
      </div>
    );
  }

  if (!isAuthenticated) {
    window.location.href = "/login";
    return null;
  }

  const handleShareEvent = async (event: Event) => {
    haptic("light");
    const directSlug = (event as any).fundSlug as string | undefined;
    let fund = fundLookup[event.fundId];
    if (!fund && !directSlug) {
      try {
        const res = await fetch(`/api/funds/${event.fundId}`, { credentials: "include" });
        if (res.ok) fund = await res.json();
      } catch {
        // noop
      }
    }
    const fundSlug = fund?.slug || directSlug;
    if (!fundSlug) {
      haptic("error");
      toast({ title: "Could not open share", description: "Fund link is not ready yet.", variant: "destructive" });
      return;
    }
    const origin = window.location.origin;
    const recipient = capFirst(fund?.recipientFirstName) || fund?.name || "your child";
    const pages: SharePage[] = [];
    // Include permanent (anytime) link for this fund
    pages.push({
      label: ((fund as any)?.transferredAt && (fund as any)?.accessRole === "owner") ? "Your gift link" : `${recipient}'s gift link`,
      url: `${origin}/${fundSlug}`,
      isPermanent: true,
    });
    // Include this event's page (not permanent events - they are the anytime link already)
    if (!event.isPermanent && event.slug) {
      pages.unshift({
        label: event.name,
        url: `${origin}/${fundSlug}/${event.slug}`,
        themeId: (event as any).theme || undefined,
      });
    }
    setShareTargetPages(pages);
    setShareRecipientName(recipient);
    setShareModalOpen(true);
  };

  const handleCopyFundLink = () => {
    const firstFund = activeFund;
    if (!firstFund?.slug) {
      haptic("error");
      toast({ title: "Could not open share", description: "Fund link is not ready yet.", variant: "destructive" });
      return;
    }
    haptic("light");
    const origin = window.location.origin;
    const recipient = capFirst(firstFund.recipientFirstName) || firstFund.name || "your child";
    const fundEvents = events.filter(
      (e) => String(e.fundId) === String(firstFund.id) && !e.isPermanent && String(e.status || "active") === "active"
    );
    const pages: SharePage[] = [{
      label: isOwnerMode ? "Your gift link" : `${recipient}'s gift link`,
      url: `${origin}/${firstFund.slug}`,
      isPermanent: true,
    }];
    for (const ev of fundEvents) {
      if (!ev.slug) continue;
      pages.push({
        label: ev.name,
        url: `${origin}/${firstFund.slug}/${ev.slug}`,
        themeId: (ev as any).theme || undefined,
      });
    }
    setShareTargetPages(pages);
    setShareRecipientName(recipient);
    setShareModalOpen(true);
  };

  const toggleExpand = (id: string) => {
    haptic("selection");
    setExpandedId(prev => prev === id ? null : id);
  };

  const goalProgress = (event: Event) => {
    if (!event.goalAmount) return null;
    const goal = parseFloat(event.goalAmount);
    const raised = parseFloat(event.giftVolume || "0");
    if (goal <= 0) return null;
    return Math.min((raised / goal) * 100, 100);
  };

  const trackEventsSurface = (action: "cta_click", channel: string, metadata?: Record<string, unknown>) => {
    trackReferralEvent({
      refCode: selectedFundId === "all" ? "events" : `events:${selectedFundId}`,
      fundId: selectedFundId === "all" ? null : selectedFundId,
      eventId: null,
      action,
      channel,
      metadata: metadata || {},
    });
  };

  return (
    <div className="min-h-screen bg-background pb-28 md:ml-[264px]">
      <AppHeader />
      <main className="max-w-lg md:max-w-3xl mx-auto px-4 py-8">
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
          className="mb-8 flex items-start justify-between gap-4"
        >
          <div>
            <h1 className="font-heading text-2xl font-bold text-foreground" data-testid="heading-your-events">
              Your Occasions
            </h1>
            <p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted-foreground" data-testid="text-events-sharing-model">
              One fund code always opens the anytime gift page for that child. Occasion links and QR codes open a specific occasion page.
            </p>
          </div>
          <Button
            size="sm"
            className="rounded-xl shrink-0"
            onClick={() => {
              haptic("medium");
              if (canCreateAnotherEvent) {
                const fundParam = activeFund?.id ? `?fundId=${encodeURIComponent(String(activeFund.id))}` : "";
                window.location.href = `/event/create${fundParam}`;
              } else {
                setEventGateOpen(true);
              }
            }}
            data-testid="button-create-event-header"
          >
            <Plus size={14} className="mr-1" />
            New event
          </Button>
        </motion.div>

        <div className="mb-5 rounded-2xl border border-border/50 bg-card p-4 shadow-premium-sm" data-testid="card-event-slot-summary">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-sm font-semibold text-foreground">
                {(() => {
                  const fundLabel = selectedFundId === "all" ? "across all funds" : "for this fund";
                  return Number.isFinite(activeEventLimit)
                    ? `${activeCustomEventCount} of ${activeEventLimit} active event${activeEventLimit === 1 ? "" : "s"} running.`
                    : `${Math.round(displayVisibleActive)} active event${Math.round(displayVisibleActive) === 1 ? "" : "s"} live ${fundLabel}.`;
                })()}
              </p>
              <p className="mt-1 text-sm text-muted-foreground">
                {Number.isFinite(activeEventLimit)
                  ? activeCustomEventCount >= activeEventLimit
                    ? "At your limit. Close an occasion to start a new one."
                    : `${activeEventLimit - activeCustomEventCount} more allowed at the same time.`
                  : "No limit on concurrent occasions."}
              </p>
              <p className="mt-2 text-xs text-muted-foreground">
                Use the fund code for evergreen sharing. Use event links for birthdays, showers, holidays, and milestone invites.
              </p>
            </div>
            {!isFamily && (
              <div className="text-sm text-muted-foreground sm:text-right">
                {isFree && activeCustomEventCount >= activeEventLimit ? (
                  <Link href="/settings">
                    <Button variant="outline" size="sm" onClick={() => haptic("light")}>Upgrade for more</Button>
                  </Link>
                ) : (
                  <>
                    <p>{hasAnyStarter ? "Kiddo+ includes 3 active occasions at a time." : "Free includes 1 active occasion at a time."}</p>
                    <p>Kiddo Family is unlimited.</p>
                  </>
                )}
              </div>
            )}
          </div>
        </div>

        {false && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-5 rounded-2xl border border-emerald-200 bg-emerald-50 p-4"
            data-testid="event-pass-ready-banner"
          >
            <p className="text-sm font-medium text-emerald-800">Kiddo Occasion saved successfully</p>
            <p className="text-xs text-emerald-700 mt-1">
              You can apply it now when creating an event, or keep it saved for later.
            </p>
            {(pendingEventPass?.count || 0) > 1 && (
              <p className="text-[11px] text-emerald-700 mt-1">
                You currently have {pendingEventPass?.count} saved Kiddo Occasion credits.
              </p>
            )}
            <div className="mt-3 flex flex-wrap gap-2">
              <Button
                size="sm"
                data-testid="button-event-pass-create-now"
                onClick={() => {
                  haptic("selection");
                  window.location.href = `/event/create?eventPass=purchased&session_id=${encodeURIComponent(pendingEventPassSessionId)}`;
                }}
              >
                Create event now
              </Button>
              <Button
                size="sm"
                variant="outline"
                data-testid="button-event-pass-hide-banner"
                onClick={() => {
                  haptic("light");
                  setShowEventPassSuccess(false);
                }}
              >
                I’ll do this later
              </Button>
              <Button
                size="sm"
                variant="ghost"
                data-testid="button-event-pass-clear-saved"
                onClick={() => {
                  haptic("light");
                  try {
                    window.localStorage.removeItem("koraPendingEventPassSessionId");
                  } catch {
                    // noop
                  }
                  setPendingEventPassSessionId("");
                  setShowEventPassSuccess(false);
                  toast({ title: "Saved premium coverage cleared" });
                }}
              >
                Clear saved boost
              </Button>
            </div>
          </motion.div>
        )}
        {events.length > 0 && (
          <div className="mb-5 space-y-3">
            <p className="text-xs text-muted-foreground" data-testid="text-events-context-summary">
              Showing {Math.round(displayFilteredEventCount)} of {Math.round(displayTotalEventCount)} {Math.round(displayTotalEventCount) === 1 ? "occasion" : "occasions"} across {Math.round(displayFundCount)} {Math.round(displayFundCount) === 1 ? "fund" : "funds"}
            </p>

            <div className="flex flex-wrap items-center gap-2" data-testid="events-fund-filter-bar">
              <button
                onClick={() => {
                  haptic("selection");
                  setSelectedFundId("all");
                }}
                className={`rounded-full px-3 py-1.5 text-xs font-medium transition-colors ${
                  selectedFundId === "all"
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted text-muted-foreground hover:bg-muted/80"
                }`}
                data-testid="button-filter-fund-all"
              >
                All Funds ({Math.round(displayTotalEventCount)})
              </button>
              {funds.map((fund) => (
                <button
                  key={fund.id}
                  onClick={() => {
                    haptic("selection");
                    setSelectedFundId(fund.id);
                  }}
                  className={`rounded-full px-3 py-1.5 text-xs font-medium transition-colors ${
                    selectedFundId === fund.id
                      ? "bg-primary text-primary-foreground"
                      : "bg-muted text-muted-foreground hover:bg-muted/80"
                  }`}
                  data-testid={`button-filter-fund-${fund.id}`}
                >
                  {fund.name} ({fundEventCounts[fund.id] || 0})
                </button>
              ))}
            </div>
          </div>
        )}

        {events.length === 0 ? (
          <EnlighteningReveal>
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="py-2"
              data-testid="empty-state-events"
            >
              <MascotMoment
                mood="guide"
                context="events-empty"
                title={isOwnerMode ? "Your birthday is coming." : activeFund?.recipientFirstName ? `${capFirst(activeFund.recipientFirstName)}'s birthday is coming.` : "Birthdays. Baby showers. Holidays."}
                description={isOwnerMode
                  ? "Create an occasion and let family show up for you. Takes 2 minutes. Gifts start flowing immediately."
                  : activeFund?.recipientFirstName
                    ? `Create an occasion and let family show up for ${capFirst(activeFund.recipientFirstName)}. Takes 2 minutes. Gifts start flowing immediately.`
                    : "Create a gifting occasion and give your people a reason to show up. Takes 2 minutes."}
                primaryAction={{
                  label: `Create ${isOwnerMode ? "your" : activeFund?.recipientFirstName ? `${capFirst(activeFund.recipientFirstName)}'s` : "your"} first occasion`,
                  testId: "button-create-first-event",
                  onClick: () => {
                    haptic("medium");
                    trackEventsSurface("cta_click", "events_empty_create");
                    if (canCreateAnotherEvent) {
                      const fundParam = funds[0]?.id ? `?fundId=${encodeURIComponent(funds[0].id)}` : "";
                      window.location.href = `/event/create${fundParam}`;
                    } else {
                      setEventGateOpen(true);
                    }
                  },
                }}
                secondaryAction={{
                  label: "Share fund link",
                  testId: "button-share-fund-link-empty",
                  variant: "outline",
                  onClick: () => {
                    trackEventsSurface("cta_click", "events_empty_share_link");
                    void handleCopyFundLink();
                  },
                }}
              />
            </motion.div>
          </EnlighteningReveal>
        ) : filteredEvents.length === 0 ? (
          <motion.div
            initial={{ opacity: 0, scale: 0.98 }}
            animate={{ opacity: 1, scale: 1 }}
            className="rounded-2xl border border-border/50 bg-card px-5 py-8 text-center"
            data-testid="empty-state-events-filtered"
          >
            <p className="text-sm text-muted-foreground mb-4">No events for this fund yet. Create one for the next birthday, holiday, or milestone.</p>
            <Button
              variant="outline"
              size="sm"
              data-testid="button-clear-events-fund-filter"
              onClick={() => {
                haptic("selection");
                setSelectedFundId("all");
              }}
            >
              Show All Funds
            </Button>
          </motion.div>
        ) : (
          <div className="space-y-6">
            {groupedEvents.map(([groupFundId, fundEvents], groupIndex) => {
              const groupFund = fundLookup[groupFundId];
              const groupFundName = groupFund?.name || "Unknown fund";
              const groupRecipient = capFirst(groupFund?.recipientFirstName) || groupFund?.name || "Recipient";
              return (
                <section
                  key={groupFundId}
                  className="space-y-3"
                  data-testid={`events-fund-group-${groupFundId}`}
                >
                  <div className="rounded-2xl border border-border/50 bg-muted/30 px-4 py-3">
                    <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Fund</p>
                    <p className="text-sm font-medium text-foreground">{groupFundName}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      For {groupRecipient} · {fundEvents.length} {fundEvents.length === 1 ? "event" : "events"}
                    </p>
                  </div>
                  {(() => {
                    const gifting = fundEvents.filter((e) => (e as any).eventCategory !== 'savings_goal');
                    const goals = fundEvents.filter((e) => (e as any).eventCategory === 'savings_goal');
                    const hasBoth = gifting.length > 0 && goals.length > 0;
                    const renderEventCard = (event: Event, index: number) => {
              const fund = fundLookup[event.fundId];
              const isSavingsGoal = (event as any).eventCategory === 'savings_goal';
              const isExpanded = expandedId === event.id;
              const progress = goalProgress(event);
              const lifecycle = getEventLifecycleSummary(event);
              const raised = parseFloat(event.giftVolume || "0");
              const giftCount = event.giftCount || 0;
              const recipientName = capFirst(fund?.recipientFirstName) || fund?.name || "Recipient";

              return (
                <motion.div
                  key={event.id}
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: (groupIndex * 0.03) + (index * 0.05), duration: 0.3 }}
                  className={`rounded-2xl shadow-premium-sm border overflow-hidden ${
                    event.isPermanent
                      ? "bg-[hsl(var(--kiddo-evergreen)/0.04)] border-[hsl(var(--kiddo-evergreen)/0.18)]"
                      : "bg-card border-border"
                  }`}
                  data-testid={`card-event-${event.id}`}
                >
                  <div className="p-5">
                    <div className="flex items-start gap-4">
                      <div
                        className={`w-11 h-11 rounded-xl flex items-center justify-center shrink-0 ${
                          event.isPermanent
                            ? "bg-[hsl(var(--kiddo-evergreen)/0.12)] text-[hsl(var(--kiddo-evergreen))]"
                            : isSavingsGoal
                              ? "bg-[hsl(var(--kiddo-gold)/0.12)] text-[hsl(var(--kiddo-gold-ink))]"
                              : "bg-primary/10 text-primary"
                        }`}
                      >
                        {isSavingsGoal ? getSavingsGoalTypeIcon(event.eventType) : getEventTypeIcon(event.eventType)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <h3 className="font-heading font-semibold text-foreground truncate" data-testid={`text-event-name-${event.id}`}>
                            {event.name}
                          </h3>
                          <span
                            className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide shrink-0 ${
                              event.isPermanent
                                ? "bg-[hsl(var(--kiddo-evergreen)/0.10)] text-[hsl(var(--kiddo-evergreen))]"
                                : isSavingsGoal
                                  ? "bg-[hsl(var(--kiddo-gold)/0.18)] text-[hsl(var(--kiddo-gold-ink))]"
                                  : "bg-[hsl(var(--kiddo-gold)/0.12)] text-[hsl(var(--kiddo-gold-ink))]"
                            }`}
                            data-testid={`badge-sharing-lane-${event.id}`}
                          >
                            {event.isPermanent ? "Anytime page" : isSavingsGoal ? "Savings goal" : "Event page"}
                          </span>
                          {event.hasEventPass && (
                            <span data-testid={`badge-event-pass-${event.id}`}>
                              <EventPassBadge size="sm" />
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-2 text-sm text-muted-foreground flex-wrap">
  {!event.isPermanent && (
    <span data-testid={`text-event-type-${event.id}`}>
      {isSavingsGoal ? getSavingsGoalTypeLabel(event.eventType) : getEventTypeLabel(event.eventType)}
    </span>
  )}
  {event.eventDate && (
    <>
      {!event.isPermanent && <span>·</span>}
      <span className="flex items-center gap-1" data-testid={`text-event-date-${event.id}`}>
        <Calendar size={12} />
        {new Date(event.eventDate).toLocaleDateString(undefined, { timeZone: "UTC" })}
      </span>
    </>
  )}
  {(event.eventDate || !event.isPermanent) && <span>·</span>}
  <span data-testid={`text-event-status-${event.id}`}>
    {(() => {
      const s = String(event.status || "active").toLowerCase();
      const eventDatePassed = !event.isPermanent && event.eventDate && new Date(event.eventDate).getTime() < Date.now();
      if (["paused", "archived", "closed"].includes(s)) {
        return <span className="inline-flex items-center rounded-full bg-muted px-2 py-0.5 text-[11px] font-medium text-muted-foreground">Closed</span>;
      }
      if (eventDatePassed) {
        return <span className="inline-flex items-center rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-medium text-amber-700">Date passed</span>;
      }
      if (s === "active" && !event.isPermanent && event.eventDate && new Date(event.eventDate).getTime() > Date.now()) {
        return <span className="inline-flex items-center rounded-full bg-blue-100 px-2 py-0.5 text-[11px] font-medium text-blue-700">Upcoming</span>;
      }
      if (fund?.status && fund.status !== "active") {
        return <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-medium text-amber-700"><span className="inline-block w-1.5 h-1.5 rounded-full bg-amber-400" />Accepting gifts · fund not activated</span>;
      }
      return <span className="inline-flex items-center gap-1 rounded-full bg-green-100 px-2 py-0.5 text-[11px] font-medium text-green-700 live-badge-pulse"><span className="inline-block w-1.5 h-1.5 rounded-full bg-green-500" />Live</span>;
    })()}
  </span>
</div>
                        {isSavingsGoal && event.goalAmount ? (
                          <div className="mt-3" data-testid={`savings-goal-progress-${event.id}`}>
                            <div className="flex items-center justify-between text-xs mb-1.5">
                              <span className="font-semibold text-foreground">${raised.toLocaleString()} saved</span>
                              <span className="text-muted-foreground">of ${parseFloat(event.goalAmount).toLocaleString()} goal</span>
                            </div>
                            <div className="w-full h-2.5 bg-muted rounded-full overflow-hidden">
                              <motion.div
                                className="h-full rounded-full"
                                style={{ background: "hsl(var(--kiddo-gold))" }}
                                initial={{ width: 0 }}
                                animate={{ width: `${Math.min((raised / parseFloat(event.goalAmount)) * 100, 100).toFixed(1)}%` }}
                                transition={{ duration: 0.8, ease: [0.34, 1.56, 0.64, 1] }}
                              />
                            </div>
                            <p className="mt-1 text-[11px] text-muted-foreground">
                              {((raised / parseFloat(event.goalAmount)) * 100).toFixed(0)}% · {giftCount} {giftCount === 1 ? "gift" : "gifts"}
                            </p>
                          </div>
                        ) : (
                          <div className="flex items-center gap-1 mt-2 text-sm" data-testid={`text-gift-stats-${event.id}`}>
                            <TrendingUp size={14} className="text-primary" />
                            <span className="font-medium text-foreground">${raised.toFixed(0)} raised</span>
                            <span className="text-muted-foreground">from {giftCount} {giftCount === 1 ? "gift" : "gifts"}</span>
                          </div>
                        )}
                        {lifecycle && (
                          <div className="mt-3 rounded-2xl border border-border/50 bg-muted/30 px-3 py-2" data-testid={`event-lifecycle-${event.id}`}>
                            <p className="text-xs font-medium text-foreground">{lifecycle.badge}</p>
                            <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{lifecycle.copy}</p>
                          </div>
                        )}

                        {!isSavingsGoal && progress !== null && (event.hasEventPass || isFamily) && (
                          <div className="mt-3" data-testid={`goal-card-${event.id}`}>
                            <GoalCard
                              goalAmount={parseFloat(event.goalAmount!)}
                              currentAmount={raised}
                              recipientName={capFirst(fund?.recipientFirstName) || fund?.name || "Recipient"}
                              eventTitle={event.name}
                              contributorCount={giftCount}
                            />
                          </div>
                        )}

                        {!isSavingsGoal && progress !== null && !(event.hasEventPass || isFamily) && (
                          <div className="mt-3" data-testid={`progress-bar-${event.id}`}>
                            <div className="flex items-center justify-between text-xs text-muted-foreground mb-1">
                              <span>Progress</span>
                              <span>{progress.toFixed(0)}%</span>
                            </div>
                            <div className="w-full h-2 bg-muted rounded-full overflow-hidden">
                              <motion.div
                                className="h-full bg-primary rounded-full progress-liquid"
                                initial={{ width: 0 }}
                                animate={{ width: `${progress}%` }}
                                transition={{ duration: 0.8, ease: [0.34, 1.56, 0.64, 1] }}
                              />
                            </div>
                          </div>
                        )}

                      </div>
                    </div>

                    <div className="flex items-center gap-2 mt-4">
                      <Button
                        variant="outline"
                        size="sm"
                        className="gap-1.5"
                        data-testid={`button-share-link-${event.id}`}
                        onClick={() => void handleShareEvent(event)}
                      >
                        <Share2 size={14} />
                        Share
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        className="gap-1.5"
                        data-testid={`button-preview-${event.id}`}
                        onClick={() => {
                          const f = fundLookup[event.fundId];
                          const eventPath = getPublicEventPath(f?.slug, event);
                          if (eventPath) {
                            setPreviewUrl(`${eventPath}?preview=1`);
                            haptic("light");
                          }
                        }}
                      >
                        <Eye size={14} />
                        Preview
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="gap-1.5"
                        data-testid={`button-view-details-${event.id}`}
                        onClick={() => toggleExpand(event.id)}
                      >
                        <motion.div
                          animate={{ rotate: isExpanded ? 180 : 0 }}
                          transition={{ duration: 0.2 }}
                        >
                          <ChevronDown size={14} />
                        </motion.div>
                        View Details
                      </Button>
                    </div>
                  </div>

                  <AnimatePresence>
                    {isExpanded && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: "auto", opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.25, ease: [0.25, 0.1, 0.25, 1] }}
                        className="overflow-hidden"
                      >
                        <div className="px-5 pb-5 pt-0 border-t border-border/50">
                          <div className="pt-4 space-y-4">
                            {event.description && (
                              <div data-testid={`text-description-${event.id}`}>
                                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1">Description</p>
                                <RichText html={event.description} className="text-foreground" />
                              </div>
                            )}

                            {fund && (
                              <div data-testid={`text-fund-name-${event.id}`}>
                                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1">Linked Fund</p>
                                <p className="text-sm text-foreground">{fund.name}</p>
                              </div>
                            )}

                            <div data-testid={`text-fee-policy-${event.id}`}>
                              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1">Fee Policy</p>
                              <p className="text-sm text-foreground">
                                {event.hasEventPass || isFamily || (() => {
                                  const membership = starterByFund[String(event.fundId)];
                                  if (!membership) return false;
                                  if (membership.status === "active") return true;
                                  if (membership.status === "canceled" && membership.currentPeriodEnd) {
                                    return new Date(membership.currentPeriodEnd).getTime() > Date.now();
                                  }
                                  return false;
                                })()
                                  ? "Kiddo Occasion styling and premium event features apply here."
                                  : "Standard Free, Kiddo+, or Kiddo Family features apply based on this fund's plan."}
                              </p>
                            </div>

                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                              <div data-testid={`text-event-created-${event.id}`}>
                                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1">Created</p>
                                <p className="text-sm text-foreground">{new Date(event.createdAt || Date.now()).toLocaleDateString()}</p>
                              </div>
                              <div data-testid={`text-event-updated-${event.id}`}>
                                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1">Last Updated</p>
                                <p className="text-sm text-foreground">{new Date(event.updatedAt || event.createdAt || Date.now()).toLocaleDateString()}</p>
                              </div>
                            </div>

                            {fund && (
                              <div data-testid={`text-page-url-${event.id}`}>
                                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1">
                                  {event.isPermanent ? "Anytime gift page" : "Event page link"}
                                </p>
                                <button
                                  onClick={() => {
                                    const eventPath = getPublicEventPath(fund.slug, event);
                                    if (eventPath) setPreviewUrl(`${eventPath}?preview=1`);
                                  }}
                                  className="text-sm text-primary hover:underline break-all flex items-center gap-1 text-left"
                                >
                                  {window.location.origin}{getPublicEventPath(fund.slug, event)}
                                  <Eye size={12} className="shrink-0" />
                                </button>
                                <p className="mt-1 text-xs text-muted-foreground">
                                  {event.isPermanent
                                    ? "This is the evergreen gift page for this child. The fund code below opens this same anytime path."
                                    : "This opens this specific event page. Share it for birthdays, showers, holidays, and other occasion-specific invites."}
                                </p>
                              </div>
                            )}

                            <div data-testid={`area-qr-code-${event.id}`}>
                              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2">
                                {event.isPermanent ? "Anytime page QR code" : "Event QR code"}
                              </p>
                              <div className="flex items-end gap-3">
                                <div className="w-32 h-32 bg-white rounded-xl flex items-center justify-center border border-border p-2">
                                  {fund && (
                                    <QRCodeSVG
                                      id={`qr-svg-${event.id}`}
                                      value={`${window.location.origin}${getPublicEventPath(fund.slug, event)}`}
                                      size={112}
                                      level="M"
                                      data-testid={`qr-code-${event.id}`}
                                    />
                                  )}
                                </div>
                                <Button
                                  variant="outline"
                                  size="sm"
                                  className="gap-1.5"
                                  data-testid={`button-download-qr-${event.id}`}
                                  onClick={() => handleDownloadQR(event.id, event.name)}
                                >
                                  <Download size={14} />
                                  Download
                                </Button>
                              </div>
                              <p className="mt-2 text-xs text-muted-foreground">
                                {event.isPermanent
                                  ? "Scan to open the child’s anytime gift page."
                                  : "Scan to open this specific event page."}
                              </p>
                              {fund && fundCodes[fund.id]?.code ? (
                                <div className={`mt-3 rounded-xl border bg-muted/30 p-3 text-xs text-muted-foreground ${event.isPermanent ? "border-border" : "border-border/60 opacity-90"}`}>
                                  <p className="font-medium uppercase tracking-wide text-foreground">Fund code</p>
                                  <p className="mt-1 font-semibold tracking-[0.2em] text-primary">{fundCodes[fund.id]?.code}</p>
                                  <p className="mt-1">
                                    {event.isPermanent
                                      ? `Always opens the anytime gift page for this child at ${window.location.origin}/gift`
                                      : `Always opens the anytime gift page for this child at ${window.location.origin}/gift. Use the event link or event QR above for this specific occasion.`}
                                  </p>
                                </div>
                              ) : null}
                            </div>

                            {/* Edit/Pause are writes the server only allows for the
                                event's creator, the fund owner, or a co-admin —
                                viewer/previous_owner get a 403. Hide the buttons for
                                those read-only roles instead of rendering a trap. */}
                            {!["viewer", "previous_owner"].includes(String((fund as any)?.accessRole || "")) && (
                            <div className="flex items-center gap-2">
                              <Button
                                variant="outline"
                                size="sm"
                                className="gap-1.5"
                                data-testid={`button-edit-event-${event.id}`}
                                onClick={() => openEditModal(event)}
                              >
                                <Pencil size={14} />
                                Edit Event
                              </Button>
                              {(() => {
                                const isPaused = String(event.status || "active").toLowerCase() === "paused";
                                return (
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    className={`gap-1.5 ${isPaused ? "text-[hsl(var(--kiddo-evergreen))] border-[hsl(var(--kiddo-evergreen)/0.4)] hover:bg-[hsl(var(--kiddo-evergreen)/0.08)]" : "text-muted-foreground hover:text-foreground"}`}
                                    data-testid={`button-toggle-pause-event-${event.id}`}
                                    disabled={togglePauseMutation.isPending}
                                    onClick={() => {
                                      haptic("light");
                                      const newStatus = isPaused ? "active" : "paused";
                                      togglePauseMutation.mutate(
                                        { id: event.id, data: { status: newStatus } },
                                        {
                                          onSuccess: () => {
                                            haptic("success");
                                            toast({ title: isPaused ? "Event resumed. Gift link is live again." : "Event paused. Gift link is offline." });
                                          },
                                          onError: () => {
                                            toast({ title: "Could not update event", variant: "destructive" });
                                          },
                                        }
                                      );
                                    }}
                                  >
                                    {isPaused ? <Play size={14} /> : <Pause size={14} />}
                                    {isPaused ? "Resume" : "Pause"}
                                  </Button>
                                );
                              })()}
                            </div>
                            )}
                          </div>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </motion.div>
              );
                    };
                    return (
                      <div className="space-y-4">
                        {hasBoth && gifting.length > 0 && (
                          <p className="text-[11px] font-bold uppercase tracking-[0.10em] text-muted-foreground/50 px-1">Gifting occasions</p>
                        )}
                        {gifting.map((event, index) => renderEventCard(event, index))}
                        {hasBoth && goals.length > 0 && (
                          <p className="mt-2 text-[11px] font-bold uppercase tracking-[0.10em] text-muted-foreground/50 px-1">Savings goals</p>
                        )}
                        {goals.map((event, index) => renderEventCard(event, gifting.length + index))}
                      </div>
                    );
                  })()}
                </section>
              );
            })}
          </div>
        )}

        {events.length < 2 && (
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.120, duration: 0.4 }}
            className="mt-8"
          >
            {isFamily ? (
              <div className="bg-card rounded-2xl border border-primary/20 p-6" data-testid="card-family-plan-active">
                <div className="flex items-start gap-4">
                  <div className="w-11 h-11 rounded-xl bg-primary/10 text-primary flex items-center justify-center shrink-0">
                    <Crown size={20} />
                  </div>
                  <div className="flex-1">
                    <h3 className="font-heading font-semibold text-foreground mb-1" data-testid="text-family-plan-title">
                      Kiddo Family Active
                    </h3>
                    <p className="text-sm text-muted-foreground mb-3">
                      Your events include all premium features at no extra cost.
                    </p>
                    <ul className="space-y-2 text-sm text-muted-foreground">
                      <li className="flex items-center gap-2">
                        <Check size={14} className="text-primary shrink-0" />
                        Premium themes, goal cards, and thank-you automation
                      </li>
                      <li className="flex items-center gap-2">
                        <Check size={14} className="text-primary shrink-0" />
                        Unlimited premium event pages
                      </li>
                      <li className="flex items-center gap-2">
                        <Check size={14} className="text-primary shrink-0" />
                        Household-wide event coverage
                      </li>
                    </ul>
                  </div>
                </div>
              </div>
            ) : (
              <div className="gemini-featured-border rounded-2xl">
                <div className="bg-card rounded-2xl p-6" data-testid="card-events-upsell">
                  <div className="flex items-start gap-4">
                    <div className="w-11 h-11 rounded-xl bg-amber-100 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400 flex items-center justify-center shrink-0">
                      <Crown size={20} />
                    </div>
                    <div className="flex-1">
                      <h3 className="sr-only font-heading font-semibold text-foreground mb-1" data-testid="text-events-upgrade-title">
                        Kiddo Occasion upgrades
                      </h3>
                      <p className="font-heading font-semibold text-foreground mb-1">Kiddo+, Family, or Legacy</p>
                      <ul className="space-y-2 mt-3 text-sm text-muted-foreground">
                        <li className="flex items-start gap-2">
                          <Gift size={14} className="mt-0.5 text-primary shrink-0" />
                          Kiddo+ unlocks premium occasion themes and three active occasions at a time for one child.
                        </li>
                        <li className="flex items-start gap-2">
                          <Crown size={14} className="mt-0.5 text-primary shrink-0" />
                          Kiddo Family unlocks unlimited active occasions with premium themes across every child.
                        </li>
                      </ul>
                      <Link href="/settings">
                        <Button
                          className="mt-4 gap-2"
                          data-testid="button-view-event-plans"
                          onClick={() => haptic("medium")}
                        >
                          View plans
                        </Button>
                      </Link>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </motion.div>
        )}
      </main>

      <Dialog open={!!previewUrl} onOpenChange={(open) => { if (!open) setPreviewUrl(null); }}>
        <DialogContent className="max-w-lg w-[95vw] p-0 gap-0 overflow-hidden rounded-2xl max-h-[90vh]" aria-describedby={undefined}>
          <DialogTitle className="sr-only">Page Preview</DialogTitle>
          <div className="flex items-center justify-between px-4 py-3 border-b border-border/50 bg-muted/30">
            <div className="flex items-center gap-2">
              <Eye size={16} className="text-muted-foreground" />
              <span className="text-sm font-medium">Page Preview</span>
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="ghost"
                size="sm"
                className="gap-1.5 text-xs"
                onClick={() => {
                  if (previewUrl) window.open(previewUrl, "_blank");
                }}
                data-testid="button-preview-open-tab"
              >
                <ExternalLink size={12} />
                Open
              </Button>
              <button
                onClick={() => setPreviewUrl(null)}
                className="w-7 h-7 rounded-lg flex items-center justify-center hover:bg-muted transition-colors"
                data-testid="button-preview-close"
                aria-label="Close preview"
              >
                <X size={16} className="text-muted-foreground" />
              </button>
            </div>
          </div>
          <div className="w-full bg-background" style={{ height: "70vh" }}>
            {previewUrl && (
              <iframe
                src={previewUrl}
                className="w-full h-full border-0"
                title="Event page preview"
              />
            )}
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={!!editingEvent} onOpenChange={(open) => { if (!open) setEditingEvent(null); }}>
        <DialogContent className="max-w-md w-[95vw] p-0 gap-0 overflow-hidden rounded-2xl max-h-[90vh] flex flex-col" aria-describedby={undefined}>
          <DialogTitle className="sr-only">Edit Event</DialogTitle>
          <div className="flex items-center justify-between px-5 py-4 border-b border-border/50 shrink-0">
            <div className="flex items-center gap-2">
              <Pencil size={16} className="text-muted-foreground" />
              <span className="font-heading font-semibold">Edit Event</span>
            </div>
            <button
              onClick={() => setEditingEvent(null)}
              className="w-7 h-7 rounded-lg flex items-center justify-center hover:bg-muted transition-colors"
              data-testid="button-edit-close"
              aria-label="Close edit event"
            >
              <X size={16} className="text-muted-foreground" />
            </button>
          </div>
          <div className="overflow-y-auto flex-1 p-5 space-y-4">
            <div>
              <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1.5 block">Event Name</label>
              <Input
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                placeholder="e.g. Dovi's 5th Birthday"
                data-testid="input-edit-event-name"
              />
            </div>
            {!editingEvent?.isPermanent && (
              <div>
                <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1.5 block">Event Type</label>
                <select
                  value={editType}
                  onChange={(e) => setEditType(e.target.value)}
                  className="w-full h-10 rounded-lg border border-border bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                  data-testid="select-edit-event-type"
                >
                  <option value="just_because">Just Because</option>
                  <option value="birthday">Birthday</option>
                  <option value="baby_shower">Baby Shower</option>
                  <option value="holiday">Holiday / seasonal</option>
                  <option value="christmas">Christmas</option>
                  <option value="graduation">Graduation</option>
                </select>
              </div>
            )}
            <div>
              <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1.5 block">Description (optional)</label>
              <RichTextEditor
                value={editDescription}
                onChange={setEditDescription}
                placeholder="Add a short description for your gift page"
                data-testid="input-edit-event-description"
              />
            </div>
            {!editingEvent?.isPermanent && (
              <div>
                <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1.5 block">Date (optional)</label>
                <Popover>
                  <PopoverTrigger asChild>
                    <button
                      type="button"
                      className="flex w-full items-center justify-between rounded-lg border border-border bg-background px-3 h-10 text-left text-sm focus:outline-none focus:ring-2 focus:ring-ring hover:border-primary/40 transition-colors"
                      data-testid="input-edit-event-date"
                    >
                      <span className={editDate ? "text-foreground" : "text-muted-foreground"}>
                        {editDate
                          ? (() => {
                              const [y, m, d] = editDate.split("-").map(Number);
                              return new Date(y, m - 1, d).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });
                            })()
                          : "Pick a date"}
                      </span>
                      <CalendarIcon size={14} className="shrink-0 text-muted-foreground" />
                    </button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <CalendarPicker
                      mode="single"
                      captionLayout="dropdown"
                      selected={editDate ? new Date(editDate + "T12:00:00") : undefined}
                      onSelect={(date) => {
                        if (!date) { setEditDate(""); return; }
                        const y = date.getFullYear();
                        const m = String(date.getMonth() + 1).padStart(2, "0");
                        const d = String(date.getDate()).padStart(2, "0");
                        setEditDate(`${y}-${m}-${d}`);
                      }}
                      fromYear={new Date().getFullYear() - 1}
                      toYear={new Date().getFullYear() + 10}
                      defaultMonth={editDate ? new Date(editDate + "T12:00:00") : new Date()}
                    />
                  </PopoverContent>
                </Popover>
              </div>
            )}
            <div>
              <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1.5 block">Goal Amount (optional)</label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">$</span>
                <Input
                  type="number"
                  min="0"
                  step="1"
                  value={editGoalAmount}
                  onChange={(e) => setEditGoalAmount(e.target.value)}
                  placeholder="e.g. 500"
                  className="pl-7"
                  data-testid="input-edit-event-goal"
                />
              </div>
              <p className="mt-1 text-[11px] text-muted-foreground">Set a fundraising goal to show a progress bar on your gift page.</p>
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1.5 block">Cover Photo (optional)</label>
              {editImageUrl && (
                <div className="relative mb-2 rounded-xl overflow-hidden border border-border" style={{ height: 140 }}>
                  <img src={editImageUrl} alt="Event cover" className="w-full h-full object-cover" />
                  <button
                    type="button"
                    onClick={() => setEditImageUrl("")}
                    className="absolute top-2 right-2 w-7 h-7 rounded-full bg-black/50 flex items-center justify-center hover:bg-black/70 transition-colors"
                    data-testid="button-remove-cover-photo"
                    aria-label="Remove cover photo"
                  >
                    <X size={14} className="text-white" />
                  </button>
                </div>
              )}
              <label
                className={`flex flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-border bg-muted/30 px-4 py-5 text-center cursor-pointer hover:border-primary/40 hover:bg-muted/50 transition-colors ${imageUploading ? "pointer-events-none opacity-60" : ""}`}
                data-testid="label-upload-cover-photo"
              >
                <input
                  type="file"
                  accept="image/*"
                  className="sr-only"
                  disabled={imageUploading}
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) void handleImageUpload(file);
                    e.target.value = "";
                  }}
                  data-testid="input-upload-cover-photo"
                />
                {imageUploading ? (
                  <span className="text-sm text-muted-foreground">Uploading...</span>
                ) : (
                  <>
                    <span className="text-sm font-medium text-foreground">{editImageUrl ? "Replace photo" : "Upload cover photo"}</span>
                    <span className="text-[11px] text-muted-foreground">JPG, PNG, WebP up to 10 MB</span>
                  </>
                )}
              </label>
            </div>
            <Button
              className="w-full"
              onClick={handleSaveEvent}
              disabled={saving || !editName.trim() || imageUploading}
              data-testid="button-save-event"
            >
              {saving ? "Saving..." : "Save Changes"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>


      <EventGateModal
        open={eventGateOpen}
        onClose={() => setEventGateOpen(false)}
        showKiddoPlusOption={!hasAnyStarter}
      />

      <ShareModal
        open={shareModalOpen}
        onClose={() => setShareModalOpen(false)}
        pages={shareTargetPages}
        recipientName={shareRecipientName}
      />

      <TrustMicroStrip />
    </div>
  );
}
