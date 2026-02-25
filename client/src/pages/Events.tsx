import { useState, useCallback } from "react";
import { Link } from "wouter";
import { motion, AnimatePresence } from "framer-motion";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Calendar, Gift, Share2, Plus, Star, ChevronDown, Copy, TrendingUp, PartyPopper, Baby, TreeDeciduous, GraduationCap, Heart, ChevronLeft, Check, Crown, ExternalLink, X, Eye, Pencil, Download, Trash2 } from "lucide-react";
import { QRCodeSVG } from "qrcode.react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Logo } from "@/components/ui/logo";
import { haptic } from "@/lib/haptics";
import { GradientText, EnlighteningReveal, ThinkingOrb } from "@/components/ui/gemini";
import { useAuth } from "@/hooks/use-auth";
import { useSubscription } from "@/hooks/use-subscription";
import { useEvents, useDeleteEvent } from "@/hooks/use-events";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { useFunds } from "@/hooks/use-funds";
import { toast } from "@/hooks/use-toast";
import { EventGateModal } from "@/components/EventGateModal";
import { GoalCard, EventPassBadge, EventPassUpgrade } from "@/components/ui/premium-themes";
import type { Event } from "@shared/schema";

function getEventTypeLabel(eventType: string | null | undefined): string {
  switch (eventType) {
    case "birthday": return "Birthday";
    case "baby_shower": return "Baby Shower";
    case "holiday": return "Holiday";
    case "christmas": return "Christmas";
    case "graduation": return "Graduation";
    case "just_because": return "Just Because";
    case "gift_anytime": return "Permanent";
    default: return "Event";
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

export default function Events() {
  const { user, isAuthenticated, isLoading: authLoading } = useAuth();
  const { data: subscription } = useSubscription();
  const { data: events = [], isLoading: eventsLoading } = useEvents();
  const { data: funds = [], isLoading: fundsLoading } = useFunds();
  const queryClient = useQueryClient();
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [editingEvent, setEditingEvent] = useState<Event | null>(null);
  const [editName, setEditName] = useState("");
  const [editDescription, setEditDescription] = useState("");
  const [editDate, setEditDate] = useState("");
  const [editType, setEditType] = useState("");
  const [saving, setSaving] = useState(false);
  const [eventGateOpen, setEventGateOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Event | null>(null);
  const [dismissedUpgrades, setDismissedUpgrades] = useState<Set<string>>(new Set());
  const deleteEventMutation = useDeleteEvent();
  const isFamily = subscription?.plan === "family" && subscription?.status === "active";
  const isFree = !subscription || subscription.plan === "free" || subscription.status !== "active";

  const handleEventPassUpgrade = useCallback(async (event: Event) => {
    try {
      const res = await fetch("/api/stripe/checkout/event-pass", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ eventId: event.id, eventName: event.name }),
      });
      if (res.ok) {
        const data = await res.json();
        if (data.url) {
          window.location.href = data.url;
        }
      } else {
        toast({ title: "Could not start checkout", variant: "destructive" });
      }
    } catch {
      toast({ title: "Could not start checkout", variant: "destructive" });
    }
  }, []);

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
    haptic("light");
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
      const res = await fetch(`/api/events/${editingEvent.id}`, {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(updates),
      });
      if (res.ok) {
        queryClient.invalidateQueries({ queryKey: ["/api/events"] });
        haptic("success");
        toast({ title: "Event updated" });
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
      <div className="min-h-screen flex items-center justify-center md:ml-[220px] lg:ml-[260px]">
        <ThinkingOrb size={40} variant="default" />
      </div>
    );
  }

  if (!isAuthenticated) {
    window.location.href = "/login";
    return null;
  }

  const fundLookup = Object.fromEntries(funds.map(f => [f.id, f]));

  const handleCopyLink = (event: Event) => {
    const fund = fundLookup[event.fundId];
    if (!fund) return;
    const url = `${window.location.origin}/${fund.slug}/${event.slug}`;
    navigator.clipboard.writeText(url);
    haptic("success");
    toast({ title: "Link copied!", description: "Share this link with friends and family" });
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

  return (
    <div className="min-h-screen bg-background pb-28 md:ml-[220px] lg:ml-[260px]">
      <div className="md:hidden sticky top-0 z-40 h-14 flex items-center px-4 bg-background/80 backdrop-blur-lg border-b border-border/40">
        <Link href="/dashboard">
          <button className="flex items-center gap-1 text-muted-foreground hover:text-foreground transition-colors" data-testid="button-back-dashboard">
            <ChevronLeft size={20} />
            <span className="text-sm">Fund</span>
          </button>
        </Link>
        <div className="flex-1" />
        <Logo size="sm" className="text-foreground" linkTo="/dashboard" />
      </div>
      <main className="max-w-lg md:max-w-3xl mx-auto px-4 py-8">
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
          className="flex items-center justify-between mb-8"
        >
          <h1 className="font-heading text-2xl font-bold text-foreground" data-testid="heading-your-events">
            Your Events
          </h1>
          <Button
            data-testid="button-create-event"
            className="gap-2"
            onClick={() => {
              haptic("medium");
              if (isFamily) {
                window.location.href = "/event/create";
              } else {
                setEventGateOpen(true);
              }
            }}
          >
            <Plus size={18} />
            Create Event
          </Button>
        </motion.div>

        {events.length === 0 ? (
          <EnlighteningReveal>
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="text-center py-16 bg-card rounded-2xl shadow-premium-sm"
              data-testid="empty-state-events"
            >
              <Gift size={48} className="mx-auto mb-4 text-muted-foreground" />
              <h3 className="font-heading text-lg font-semibold text-foreground mb-2">No events yet</h3>
              <p className="text-muted-foreground mb-6 max-w-sm mx-auto">
                Create your first event to start receiving gifts!
              </p>
              <Button
                data-testid="button-create-first-event"
                className="gap-2"
                onClick={() => {
                  haptic("medium");
                  if (isFamily) {
                    window.location.href = "/event/create";
                  } else {
                    setEventGateOpen(true);
                  }
                }}
              >
                <Plus size={18} />
                Create your first event
              </Button>
            </motion.div>
          </EnlighteningReveal>
        ) : (
          <div className="space-y-4">
            {events.map((event, index) => {
              const fund = fundLookup[event.fundId];
              const isExpanded = expandedId === event.id;
              const progress = goalProgress(event);
              const raised = parseFloat(event.giftVolume || "0");
              const giftCount = event.giftCount || 0;

              return (
                <motion.div
                  key={event.id}
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.05, duration: 0.3 }}
                  className="bg-card rounded-2xl shadow-premium-sm border border-border overflow-hidden"
                  data-testid={`card-event-${event.id}`}
                >
                  <div className="p-5">
                    <div className="flex items-start gap-4">
                      <div className="w-11 h-11 rounded-xl bg-primary/10 text-primary flex items-center justify-center shrink-0">
                        {getEventTypeIcon(event.eventType)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <h3 className="font-heading font-semibold text-foreground truncate" data-testid={`text-event-name-${event.id}`}>
                            {event.name}
                          </h3>
                          {event.hasEventPass && (
                            <span data-testid={`badge-event-pass-${event.id}`}>
                              <EventPassBadge size="sm" />
                            </span>
                          )}
                          {event.isPermanent && (
                            <span className="inline-flex items-center gap-1 text-[10px] font-medium uppercase tracking-wide px-1.5 py-0.5 rounded bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400 shrink-0" data-testid={`badge-permanent-${event.id}`}>
                              <Star size={10} />
                              Permanent
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                          <span data-testid={`text-event-type-${event.id}`}>{getEventTypeLabel(event.eventType)}</span>
                          {event.eventDate && (
                            <>
                              <span>·</span>
                              <span className="flex items-center gap-1" data-testid={`text-event-date-${event.id}`}>
                                <Calendar size={12} />
                                {new Date(event.eventDate).toLocaleDateString()}
                              </span>
                            </>
                          )}
                        </div>
                        <div className="flex items-center gap-1 mt-2 text-sm" data-testid={`text-gift-stats-${event.id}`}>
                          <TrendingUp size={14} className="text-primary" />
                          <span className="font-medium text-foreground">${raised.toFixed(0)} raised</span>
                          <span className="text-muted-foreground">from {giftCount} {giftCount === 1 ? "gift" : "gifts"}</span>
                        </div>

                        {progress !== null && (event.hasEventPass || isFamily) && (
                          <div className="mt-3" data-testid={`goal-card-${event.id}`}>
                            <GoalCard
                              goalAmount={parseFloat(event.goalAmount!)}
                              currentAmount={raised}
                              recipientName={fund?.recipientFirstName || fund?.name || "Recipient"}
                              eventTitle={event.name}
                              contributorCount={giftCount}
                            />
                          </div>
                        )}

                        {progress !== null && !(event.hasEventPass || isFamily) && (
                          <div className="mt-3" data-testid={`progress-bar-${event.id}`}>
                            <div className="flex items-center justify-between text-xs text-muted-foreground mb-1">
                              <span>Progress</span>
                              <span>{progress.toFixed(0)}%</span>
                            </div>
                            <div className="w-full h-2 bg-muted rounded-full overflow-hidden">
                              <motion.div
                                className="h-full bg-primary rounded-full"
                                initial={{ width: 0 }}
                                animate={{ width: `${progress}%` }}
                                transition={{ duration: 0.8, ease: "easeOut" }}
                              />
                            </div>
                          </div>
                        )}

                        {isFree && !event.hasEventPass && !dismissedUpgrades.has(event.id) && (
                          <div className="mt-4" data-testid={`upgrade-prompt-${event.id}`}>
                            <EventPassUpgrade
                              eventTitle={event.name}
                              onUpgrade={() => {
                                haptic("medium");
                                handleEventPassUpgrade(event);
                              }}
                              onDismiss={() => {
                                haptic("light");
                                setDismissedUpgrades(prev => new Set(prev).add(event.id));
                              }}
                            />
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
                        onClick={() => handleCopyLink(event)}
                      >
                        <Copy size={14} />
                        Share Link
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        className="gap-1.5"
                        data-testid={`button-preview-${event.id}`}
                        onClick={() => {
                          const f = fundLookup[event.fundId];
                          if (f) {
                            setPreviewUrl(`/${f.slug}/${event.slug}`);
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
                                <p className="text-sm text-foreground">{event.description}</p>
                              </div>
                            )}

                            {fund && (
                              <div data-testid={`text-fund-name-${event.id}`}>
                                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1">Linked Fund</p>
                                <p className="text-sm text-foreground">{fund.name}</p>
                              </div>
                            )}

                            {fund && (
                              <div data-testid={`text-page-url-${event.id}`}>
                                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1">Gift Page Link</p>
                                <button
                                  onClick={() => setPreviewUrl(`/${fund.slug}/${event.slug}`)}
                                  className="text-sm text-primary hover:underline break-all flex items-center gap-1 text-left"
                                >
                                  {window.location.origin}/{fund.slug}/{event.slug}
                                  <Eye size={12} className="shrink-0" />
                                </button>
                              </div>
                            )}

                            <div data-testid={`area-qr-code-${event.id}`}>
                              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2">QR Code</p>
                              <div className="flex items-end gap-3">
                                <div className="w-32 h-32 bg-white rounded-xl flex items-center justify-center border border-border p-2">
                                  {fund && (
                                    <QRCodeSVG
                                      id={`qr-svg-${event.id}`}
                                      value={`${window.location.origin}/${fund.slug}/${event.slug}`}
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
                            </div>

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
                              {!event.isPermanent && (
                                <Button
                                  variant="outline"
                                  size="sm"
                                  className="gap-1.5 text-destructive hover:text-destructive hover:bg-destructive/10 border-destructive/30"
                                  data-testid={`button-delete-event-${event.id}`}
                                  onClick={() => {
                                    haptic("light");
                                    setDeleteTarget(event);
                                  }}
                                >
                                  <Trash2 size={14} />
                                  Delete
                                </Button>
                              )}
                            </div>
                          </div>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </motion.div>
              );
            })}
          </div>
        )}

        {events.length < 2 && (
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3, duration: 0.4 }}
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
                      Family Plan Active
                    </h3>
                    <p className="text-sm text-muted-foreground mb-3">
                      Your events include all premium features at no extra cost.
                    </p>
                    <ul className="space-y-2 text-sm text-muted-foreground">
                      <li className="flex items-center gap-2">
                        <Check size={14} className="text-primary shrink-0" />
                        Platform fee waived on all gifts
                      </li>
                      <li className="flex items-center gap-2">
                        <Check size={14} className="text-primary shrink-0" />
                        Premium themes, goal cards, and thank-you automation
                      </li>
                      <li className="flex items-center gap-2">
                        <Check size={14} className="text-primary shrink-0" />
                        Unlimited premium event pages
                      </li>
                    </ul>
                  </div>
                </div>
              </div>
            ) : (
              <div className="gemini-featured-border rounded-2xl">
                <div className="bg-card rounded-2xl p-6" data-testid="card-event-pass-upsell">
                  <div className="flex items-start gap-4">
                    <div className="w-11 h-11 rounded-xl bg-amber-100 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400 flex items-center justify-center shrink-0">
                      <Star size={20} />
                    </div>
                    <div className="flex-1">
                      <h3 className="font-heading font-semibold text-foreground mb-1" data-testid="text-event-pass-title">
                        <GradientText>Event Boost</GradientText> · $29 one-time
                      </h3>
                      <ul className="space-y-2 mt-3 text-sm text-muted-foreground">
                        <li className="flex items-start gap-2">
                          <Gift size={14} className="mt-0.5 text-primary shrink-0" />
                          Waives the $2 platform fee on gifts for one event. Includes premium themes, goal cards, and thank-you automation.
                        </li>
                        <li className="flex items-start gap-2">
                          <Star size={14} className="mt-0.5 text-primary shrink-0" />
                          Includes premium themes, goal cards, and thank-you automation
                        </li>
                      </ul>
                      <Link href="/settings">
                        <Button
                          className="mt-4 gap-2"
                          data-testid="button-get-event-pass"
                          onClick={() => haptic("medium")}
                        >
                          Get Event Boost
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
        <DialogContent className="max-w-md w-[95vw] p-0 gap-0 overflow-hidden rounded-2xl" aria-describedby={undefined}>
          <DialogTitle className="sr-only">Edit Event</DialogTitle>
          <div className="flex items-center justify-between px-5 py-4 border-b border-border/50">
            <div className="flex items-center gap-2">
              <Pencil size={16} className="text-muted-foreground" />
              <span className="font-heading font-semibold">Edit Event</span>
            </div>
            <button
              onClick={() => setEditingEvent(null)}
              className="w-7 h-7 rounded-lg flex items-center justify-center hover:bg-muted transition-colors"
              data-testid="button-edit-close"
            >
              <X size={16} className="text-muted-foreground" />
            </button>
          </div>
          <div className="p-5 space-y-4">
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
                  <option value="birthday">Birthday</option>
                  <option value="baby_shower">Baby Shower</option>
                  <option value="holiday">Holiday</option>
                  <option value="christmas">Christmas</option>
                  <option value="graduation">Graduation</option>
                  <option value="just_because">Just Because</option>
                </select>
              </div>
            )}
            <div>
              <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1.5 block">Description (optional)</label>
              <textarea
                value={editDescription}
                onChange={(e) => setEditDescription(e.target.value)}
                placeholder="Add a short description for your gift page"
                rows={3}
                className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring resize-none"
                data-testid="input-edit-event-description"
              />
            </div>
            {!editingEvent?.isPermanent && (
              <div>
                <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1.5 block">Date (optional)</label>
                <Input
                  type="date"
                  value={editDate}
                  onChange={(e) => setEditDate(e.target.value)}
                  data-testid="input-edit-event-date"
                />
              </div>
            )}
            <Button
              className="w-full"
              onClick={handleSaveEvent}
              disabled={saving || !editName.trim()}
              data-testid="button-save-event"
            >
              {saving ? "Saving..." : "Save Changes"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleteTarget} onOpenChange={(open) => { if (!open) setDeleteTarget(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle data-testid="text-delete-confirm-title">Delete Event</AlertDialogTitle>
            <AlertDialogDescription data-testid="text-delete-confirm-description">
              Are you sure you want to delete "{deleteTarget?.name}"? This action cannot be undone. All gift links for this event will stop working.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel data-testid="button-delete-cancel">Cancel</AlertDialogCancel>
            <AlertDialogAction
              data-testid="button-delete-confirm"
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => {
                if (!deleteTarget) return;
                deleteEventMutation.mutate(deleteTarget.id, {
                  onSuccess: () => {
                    haptic("success");
                    toast({ title: "Event deleted" });
                    setDeleteTarget(null);
                    setExpandedId(null);
                  },
                  onError: () => {
                    toast({ title: "Could not delete event", variant: "destructive" });
                  },
                });
              }}
            >
              {deleteEventMutation.isPending ? "Deleting..." : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <EventGateModal
        open={eventGateOpen}
        onClose={() => setEventGateOpen(false)}
      />
    </div>
  );
}
