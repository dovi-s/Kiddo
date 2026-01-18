import { useState } from "react";
import { Link } from "wouter";
import { motion, AnimatePresence } from "framer-motion";
import { Logo } from "@/components/ui/logo";
import { Plus, CalendarHeart, Gift, ChevronDown, ChevronRight, Edit2, Trash2, Share2, MoreHorizontal, Sparkles, Check } from "lucide-react";
import { PageTransition } from "@/components/layout/PageTransition";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { easeOutExpo, staggerPremium, listItemSpring, sharePulse } from "@/lib/animations";
import { toast } from "@/hooks/use-toast";
import { haptic } from "@/lib/haptics";

const funds = [
  { slug: "mila", name: "Mila", accountType: "UTMA Custodial" },
  { slug: "noah", name: "Noah", accountType: "UTMA Custodial" },
];

type Event = {
  id: string;
  title: string;
  fundName: string;
  fundSlug: string;
  date?: string;
  raised: number;
  gifts: number;
  active: boolean;
  type: "birthday" | "holiday" | "anytime" | "custom";
};

const sampleEvents: Event[] = [
  {
    id: "1",
    title: "5th Birthday",
    fundName: "Mila",
    fundSlug: "mila",
    date: "March 15, 2026",
    raised: 450,
    gifts: 6,
    active: true,
    type: "birthday"
  },
  {
    id: "2",
    title: "Christmas 2025",
    fundName: "Mila",
    fundSlug: "mila",
    date: "December 25, 2025",
    raised: 200,
    gifts: 3,
    active: false,
    type: "holiday"
  },
  {
    id: "3",
    title: "Open anytime",
    fundName: "Mila",
    fundSlug: "mila",
    raised: 150,
    gifts: 2,
    active: true,
    type: "anytime"
  },
  {
    id: "4",
    title: "Baby Shower",
    fundName: "Noah",
    fundSlug: "noah",
    date: "February 1, 2026",
    raised: 50,
    gifts: 1,
    active: true,
    type: "custom"
  },
];

function getEventIcon(type: Event["type"]) {
  switch (type) {
    case "birthday":
      return "🎂";
    case "holiday":
      return "🎄";
    case "anytime":
      return "💝";
    case "custom":
      return "✨";
  }
}

export default function Events() {
  const [events, setEvents] = useState(sampleEvents);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [selectedFundSlug, setSelectedFundSlug] = useState("mila");
  const [showFundPicker, setShowFundPicker] = useState(false);
  const selectedFund = funds.find(f => f.slug === selectedFundSlug) || funds[0];
  const [actionEventId, setActionEventId] = useState<string | null>(null);

  const activeEvents = events.filter(e => e.active);
  const pastEvents = events.filter(e => !e.active);

  const handleDelete = (id: string) => {
    setEvents(events.filter(e => e.id !== id));
    setActionEventId(null);
    toast({ title: "Event deleted" });
  };

  const handleShare = (event: Event) => {
    const url = `${window.location.origin}/give/${event.fundSlug}/${event.id}`;
    navigator.clipboard.writeText(url);
    setActionEventId(null);
    toast({ title: "Link copied!", description: "Share this link with friends and family" });
  };

  return (
    <PageTransition>
      <div className="min-h-screen bg-background pb-28">
        <motion.header 
          className="sticky top-0 z-50 bg-background/95 backdrop-blur-xl border-b border-border/50"
          initial={{ y: -20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ duration: 0.2, ease: easeOutExpo }}
        >
          <div className="max-w-lg mx-auto px-4 h-14 flex items-center">
            <Logo size="sm" className="text-primary" />
          </div>
        </motion.header>

        <main className="max-w-lg mx-auto px-4 py-6">
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.2 }}
            className="mb-8"
          >
            {funds.length > 1 ? (
              <motion.button
                onClick={() => { haptic('selection'); setShowFundPicker(true); }}
                whileTap={{ scale: 0.98 }}
                className="inline-flex items-center gap-2 mb-2"
                data-testid="button-fund-context"
              >
                <h1 className="text-2xl font-bold text-foreground">{selectedFund.name}'s Events</h1>
                <ChevronDown size={20} className="text-muted-foreground" />
              </motion.button>
            ) : (
              <h1 className="text-2xl font-bold text-foreground mb-2">Events</h1>
            )}
            <p className="text-muted-foreground">Create gift occasions for birthdays, holidays, and more</p>
          </motion.div>

          {activeEvents.length > 0 && (
            <div className="mb-8">
              <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-4">Active Events</h2>
              <motion.div 
                className="space-y-3"
                initial="hidden"
                animate="visible"
                variants={staggerPremium}
              >
                {activeEvents.map((event, index) => {
                  const isExpanded = expandedId === event.id;
                  return (
                    <motion.div
                      key={event.id}
                      layout
                      variants={listItemSpring}
                      className={`bg-card border rounded-2xl overflow-hidden transition-shadow duration-200 ${isExpanded ? "border-[hsl(var(--kora-evergreen)/0.3)] shadow-premium-lg" : "border-border shadow-premium-sm"}`}
                    >
                      <motion.div 
                        className="p-5 cursor-pointer"
                        onClick={() => { haptic('selection'); setExpandedId(isExpanded ? null : event.id); }}
                        whileTap={{ scale: 0.98 }}
                      >
                        <div className="flex items-center gap-4">
                          <div className="w-12 h-12 rounded-xl bg-muted flex items-center justify-center text-2xl">
                            {getEventIcon(event.type)}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="font-semibold text-foreground truncate">{event.title}</p>
                            <p className="text-sm text-muted-foreground">
                              {event.fundName} · {event.date || "Always open"}
                            </p>
                          </div>
                          <div className="flex items-center gap-3">
                            <div className="text-right">
                              <p className="font-bold text-foreground">${event.raised}</p>
                              <p className="text-xs text-muted-foreground">{event.gifts} gifts</p>
                            </div>
                            <motion.div
                              animate={{ rotate: isExpanded ? 180 : 0 }}
                              transition={{ duration: 0.2 }}
                            >
                              <ChevronDown size={18} className="text-muted-foreground" />
                            </motion.div>
                          </div>
                        </div>
                      </motion.div>

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
                              <div className="pt-4 grid grid-cols-3 gap-2">
                                <motion.button
                                  initial={{ opacity: 0, y: 8 }}
                                  animate={{ opacity: 1, y: 0 }}
                                  transition={{ delay: 0.05 }}
                                  whileTap={{ scale: 0.95 }}
                                  onClick={() => handleShare(event)}
                                  className="flex flex-col items-center gap-2 p-3 rounded-xl bg-[hsl(var(--kora-evergreen)/0.1)] text-[hsl(var(--kora-evergreen))]"
                                  data-testid={`button-share-${event.id}`}
                                >
                                  <Share2 size={18} />
                                  <span className="text-xs font-medium">Share</span>
                                </motion.button>
                                <Link href={`/edit/${event.fundSlug}/${event.id}`}>
                                  <motion.button
                                    initial={{ opacity: 0, y: 8 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    transition={{ delay: 0.1 }}
                                    whileTap={{ scale: 0.95 }}
                                    className="w-full flex flex-col items-center gap-2 p-3 rounded-xl bg-muted text-muted-foreground hover:bg-border transition-colors"
                                    data-testid={`button-edit-${event.id}`}
                                  >
                                    <Edit2 size={18} />
                                    <span className="text-xs font-medium">Edit</span>
                                  </motion.button>
                                </Link>
                                <motion.button
                                  initial={{ opacity: 0, y: 8 }}
                                  animate={{ opacity: 1, y: 0 }}
                                  transition={{ delay: 0.15 }}
                                  whileTap={{ scale: 0.95 }}
                                  onClick={() => setActionEventId(event.id)}
                                  className="flex flex-col items-center gap-2 p-3 rounded-xl bg-muted text-muted-foreground hover:bg-border transition-colors"
                                  data-testid={`button-more-${event.id}`}
                                >
                                  <MoreHorizontal size={18} />
                                  <span className="text-xs font-medium">More</span>
                                </motion.button>
                              </div>

                              <Link href={`/checkout/${event.fundSlug}/${event.id}`}>
                                <motion.div
                                  initial={{ opacity: 0, y: 8 }}
                                  animate={{ opacity: 1, y: 0 }}
                                  transition={{ delay: 0.2 }}
                                  className="mt-4 p-4 rounded-xl bg-[hsl(var(--kora-gold)/0.1)] flex items-center justify-between cursor-pointer"
                                >
                                  <div className="flex items-center gap-3">
                                    <Gift size={18} className="text-[hsl(var(--kora-gold))]" />
                                    <span className="text-sm font-medium text-[hsl(var(--kora-gold))]">View gift page</span>
                                  </div>
                                  <ChevronRight size={16} className="text-[hsl(var(--kora-gold))]" />
                                </motion.div>
                              </Link>
                            </div>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </motion.div>
                  );
                })}
              </motion.div>
            </div>
          )}

          {pastEvents.length > 0 && (
            <div className="mb-8">
              <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-4">Past Events</h2>
              <div className="space-y-3">
                {pastEvents.map((event, index) => (
                  <motion.div
                    key={event.id}
                    initial={{ opacity: 0, y: 12 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: index * 0.04, duration: 0.2 }}
                    className="bg-card border border-border rounded-2xl p-5 opacity-70"
                  >
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 rounded-xl bg-muted flex items-center justify-center text-2xl grayscale">
                        {getEventIcon(event.type)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold text-foreground truncate">{event.title}</p>
                        <p className="text-sm text-muted-foreground">
                          {event.fundName} · {event.date}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="font-bold text-foreground">${event.raised}</p>
                        <p className="text-xs text-muted-foreground">{event.gifts} gifts</p>
                      </div>
                    </div>
                  </motion.div>
                ))}
              </div>
            </div>
          )}

          {events.length === 0 && (
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="text-center py-16"
            >
              <div className="w-20 h-20 rounded-full bg-muted mx-auto mb-6 flex items-center justify-center">
                <CalendarHeart size={32} className="text-muted-foreground" />
              </div>
              <h3 className="text-lg font-semibold text-foreground mb-2">No events yet</h3>
              <p className="text-muted-foreground mb-6">Create an event for birthdays, holidays, or any occasion</p>
              <Link href="/event/create">
                <motion.button
                  whileTap={{ scale: 0.97 }}
                  className="px-6 py-3 bg-primary text-primary-foreground rounded-xl font-semibold flex items-center gap-2 mx-auto"
                  data-testid="button-create-first-event"
                >
                  <Sparkles size={18} />
                  Create your first event
                </motion.button>
              </Link>
            </motion.div>
          )}
        </main>

        <Sheet open={!!actionEventId} onOpenChange={() => setActionEventId(null)}>
          <SheetContent side="bottom" className="rounded-t-3xl">
            <SheetHeader className="text-left mb-4">
              <SheetTitle className="text-lg font-semibold">Event options</SheetTitle>
            </SheetHeader>
            
            <div className="space-y-2 pb-4">
              <motion.button
                whileTap={{ scale: 0.98 }}
                onClick={() => actionEventId && handleDelete(actionEventId)}
                className="w-full p-4 rounded-xl bg-destructive/10 text-destructive flex items-center gap-4 font-medium"
                data-testid="button-delete-event"
              >
                <Trash2 size={20} />
                Delete event
              </motion.button>
            </div>
          </SheetContent>
        </Sheet>

        <Link href="/event/create">
          <motion.button
            initial={{ scale: 0, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ type: "spring", stiffness: 400, damping: 25, delay: 0.2 }}
            whileTap={{ scale: 0.9 }}
            onClick={() => haptic('medium')}
            className="fixed bottom-28 right-6 w-14 h-14 rounded-full bg-primary flex items-center justify-center text-primary-foreground shadow-premium-lg z-40"
            data-testid="button-create-event"
          >
            <Plus size={24} />
          </motion.button>
        </Link>

        {/* Fund Picker Sheet */}
        <Sheet open={showFundPicker} onOpenChange={setShowFundPicker}>
          <SheetContent side="bottom" className="rounded-t-3xl">
            <SheetHeader className="text-left mb-4">
              <SheetTitle className="text-lg font-semibold">Select fund</SheetTitle>
            </SheetHeader>
            
            <div className="space-y-2 pb-4">
              {funds.map((fund) => (
                <motion.button
                  key={fund.slug}
                  onClick={() => {
                    haptic('selection');
                    setSelectedFundSlug(fund.slug);
                    setShowFundPicker(false);
                  }}
                  whileTap={{ scale: 0.98 }}
                  className={`w-full p-4 rounded-xl flex items-center gap-4 transition-colors ${
                    fund.slug === selectedFundSlug
                      ? "bg-[hsl(var(--kora-evergreen)/0.1)] border-2 border-[hsl(var(--kora-evergreen))]"
                      : "bg-muted border-2 border-transparent hover:bg-border"
                  }`}
                  data-testid={`fund-option-${fund.slug}`}
                >
                  <div className="w-12 h-12 rounded-full bg-[hsl(var(--kora-gold))] flex items-center justify-center text-[hsl(var(--kora-evergreen))] text-lg font-semibold">
                    {fund.name.charAt(0)}
                  </div>
                  <div className="flex-1 text-left">
                    <p className="font-semibold text-foreground">{fund.name}'s Fund</p>
                    <p className="text-sm text-muted-foreground">{fund.accountType}</p>
                  </div>
                  {fund.slug === selectedFundSlug && (
                    <div className="w-6 h-6 rounded-full bg-[hsl(var(--kora-evergreen))] flex items-center justify-center">
                      <Check size={14} className="text-white" />
                    </div>
                  )}
                </motion.button>
              ))}
            </div>
          </SheetContent>
        </Sheet>
      </div>
    </PageTransition>
  );
}
