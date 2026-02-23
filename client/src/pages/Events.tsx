import { useState } from "react";
import { Link } from "wouter";
import { motion, AnimatePresence } from "framer-motion";
import { useQuery } from "@tanstack/react-query";
import { Calendar, Gift, Share2, Plus, Star, ChevronDown, Copy, TrendingUp, PartyPopper, Baby, TreeDeciduous, GraduationCap, Heart, ChevronLeft, Check, Crown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Logo } from "@/components/ui/logo";
import { haptic } from "@/lib/haptics";
import { GradientText, EnlighteningReveal, ThinkingOrb } from "@/components/ui/gemini";
import { useAuth } from "@/hooks/use-auth";
import { useSubscription } from "@/hooks/use-subscription";
import { useEvents } from "@/hooks/use-events";
import { useFunds } from "@/hooks/use-funds";
import { toast } from "@/hooks/use-toast";
import type { Event } from "@shared/schema";

function getEventTypeLabel(eventType: string | null | undefined): string {
  switch (eventType) {
    case "birthday": return "Birthday";
    case "baby_shower": return "Baby Shower";
    case "holiday": return "Holiday";
    case "christmas": return "Christmas";
    case "graduation": return "Graduation";
    case "just_because": return "Just Because";
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
    default: return <Gift size={20} />;
  }
}

export default function Events() {
  const { user, isAuthenticated, isLoading: authLoading } = useAuth();
  const { data: subscription } = useSubscription();
  const { data: events = [], isLoading: eventsLoading } = useEvents();
  const { data: funds = [], isLoading: fundsLoading } = useFunds();
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const isFamily = subscription?.plan === "family" && subscription?.status === "active";

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
          <Link href="/event/create">
            <Button
              data-testid="button-create-event"
              className="gap-2"
              onClick={() => haptic("medium")}
            >
              <Plus size={18} />
              Create Event
            </Button>
          </Link>
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
              <Link href="/event/create">
                <Button data-testid="button-create-first-event" className="gap-2">
                  <Plus size={18} />
                  Create your first event
                </Button>
              </Link>
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

                        {progress !== null && (
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

                            <div data-testid={`area-qr-code-${event.id}`}>
                              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2">QR Code</p>
                              <div className="w-32 h-32 bg-muted rounded-xl flex items-center justify-center border border-border">
                                <div className="text-center">
                                  <Share2 size={24} className="mx-auto text-muted-foreground mb-1" />
                                  <span className="text-[10px] text-muted-foreground">QR Code</span>
                                </div>
                              </div>
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
                        Platform fee waived up to $15,000/year
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
                        <GradientText>Event Pass</GradientText> · $99 one-time
                      </h3>
                      <ul className="space-y-2 mt-3 text-sm text-muted-foreground">
                        <li className="flex items-start gap-2">
                          <Gift size={14} className="mt-0.5 text-primary shrink-0" />
                          Waives the Kora platform fee on up to $7,500 in gifts for one event
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
                          Get Event Pass
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
    </div>
  );
}
