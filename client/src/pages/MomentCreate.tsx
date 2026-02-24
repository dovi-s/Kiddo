import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Link, useLocation } from "wouter";
import { ArrowLeft, Check, Loader2, Share2, Copy, Sparkles, CalendarHeart, Zap, Info } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { PageTransition } from "@/components/layout/PageTransition";
import { Mascot } from "@/components/ui/mascot";
import { useKora } from "@/lib/KoraContext";
import { toast } from "@/hooks/use-toast";
import { haptic } from "@/lib/haptics";
import { useQuery, useMutation } from "@tanstack/react-query";

const EVENT_TYPES = [
  { id: "birthday", label: "Birthday", emoji: "🎂" },
  { id: "holiday", label: "Holiday", emoji: "🎄" },
  { id: "anytime", label: "Anytime", emoji: "💝" },
  { id: "graduation", label: "Graduation", emoji: "🎓" },
  { id: "baby", label: "Baby Shower", emoji: "👶" },
  { id: "other", label: "Other", emoji: "✨" },
];

const GOAL_OPTIONS = ["500", "1000", "2500", "5000"];

export default function MomentCreate() {
  const { selectedFund, funds } = useKora();
  const [, navigate] = useLocation();
  const profileName = selectedFund?.name || funds[0]?.name || "Your Child";
  const fundId = selectedFund?.id || funds[0]?.id;
  
  const [eventType, setEventType] = useState("birthday");
  const [title, setTitle] = useState("");
  const [goal, setGoal] = useState("1000");
  const [customGoal, setCustomGoal] = useState("");
  const [isCreating, setIsCreating] = useState(false);
  const [created, setCreated] = useState(false);
  const [eventSlug, setEventSlug] = useState("");

  const { data: subscription } = useQuery({
    queryKey: ['subscription'],
    queryFn: async () => {
      const res = await fetch('/api/subscription');
      if (!res.ok) return null;
      return res.json();
    },
  });
  
  const hasFamilyPlan = subscription?.plan === 'family' && subscription?.status === 'active';

  const selectedType = EVENT_TYPES.find(t => t.id === eventType);
  const finalGoal = customGoal || goal;

  const createEventMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch('/api/events', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fundId,
          name: title,
          eventType,
          goalAmount: parseInt(finalGoal),
          hasEventPass: hasFamilyPlan,
        }),
      });
      if (!res.ok) throw new Error('Failed to create event');
      return res.json();
    },
    onSuccess: (event) => {
      haptic('success');
      setEventSlug(event.slug);
      setCreated(true);
      setIsCreating(false);
    },
    onError: () => {
      toast({ title: "Failed to create event", variant: "destructive" });
      setIsCreating(false);
    },
  });

  const handleCreate = async () => {
    if (!title.trim()) {
      toast({ title: "Please enter a title", variant: "destructive" });
      return;
    }

    haptic('medium');
    setIsCreating(true);
    const slug = title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
    setEventSlug(slug);

    if (hasFamilyPlan) {
      createEventMutation.mutate();
    } else {
      try {
        const res = await fetch('/api/stripe/checkout/event-pass', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            eventName: title,
            fundId,
            eventType,
            goalAmount: parseInt(finalGoal),
          }),
        });
        
        if (!res.ok) {
          const error = await res.json();
          throw new Error(error.error || 'Failed to start checkout');
        }
        
        const { url } = await res.json();
        if (url) {
          window.location.href = url;
        }
      } catch (error: any) {
        toast({ title: error.message || "Failed to start checkout", variant: "destructive" });
        setIsCreating(false);
      }
    }
  };

  const handleCopyLink = () => {
    haptic('selection');
    const url = `${window.location.origin}/${profileName.toLowerCase().replace(/\s/g, "-")}/${eventSlug}`;
    navigator.clipboard.writeText(url);
    toast({ title: "Link copied!" });
  };

  if (created) {
    return (
      <PageTransition>
        <div className="min-h-screen bg-background">
          <main className="max-w-lg md:max-w-2xl mx-auto px-4 py-12">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }} 
              animate={{ opacity: 1, scale: 1 }}
              className="text-center"
            >
              <motion.div 
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ type: "spring", stiffness: 200, damping: 15, delay: 0.1 }}
                className="mx-auto mb-4"
              >
                <Mascot size="lg" className="mx-auto" context="event-created" />
              </motion.div>
              
              <h1 className="text-2xl font-bold text-foreground mb-2">Event created!</h1>
              <p className="text-muted-foreground mb-4">{title} is ready to share</p>
              
              <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-[hsl(var(--kora-gold)/0.15)] text-[hsl(var(--kora-gold))] text-sm font-medium mb-6">
                <Zap size={14} />
                {hasFamilyPlan ? "Fee-free gifting" : "Event Boost active"}
              </div>

              <div className="bg-card border border-border rounded-2xl p-5 mb-6">
                <p className="text-xs text-muted-foreground mb-3">Share this link with friends & family</p>
                <div className="flex gap-2">
                  <Input 
                    value={`kora.com/${profileName.toLowerCase().replace(/\s/g, "-")}/${eventSlug}`} 
                    readOnly 
                    className="text-sm bg-muted" 
                  />
                  <Button variant="outline" size="icon" onClick={handleCopyLink}>
                    <Copy className="h-4 w-4" />
                  </Button>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3 mb-8">
                <motion.button
                  whileTap={{ scale: 0.97 }}
                  onClick={handleCopyLink}
                  className="p-4 rounded-xl bg-[hsl(var(--kora-evergreen))] text-white flex flex-col items-center gap-2"
                >
                  <Share2 size={20} />
                  <span className="text-sm font-medium">Share link</span>
                </motion.button>
                <Link href="/events">
                  <motion.button
                    whileTap={{ scale: 0.97 }}
                    className="w-full p-4 rounded-xl bg-muted text-foreground flex flex-col items-center gap-2"
                  >
                    <CalendarHeart size={20} />
                    <span className="text-sm font-medium">View events</span>
                  </motion.button>
                </Link>
              </div>

              <Link href="/dashboard">
                <Button variant="ghost" className="w-full">
                  Back to dashboard
                </Button>
              </Link>
            </motion.div>
          </main>
        </div>
      </PageTransition>
    );
  }

  return (
    <PageTransition>
      <div className="min-h-screen bg-background pb-28">
        <header className="sticky top-0 z-50 gemini-glass-nav">
          <div className="max-w-lg md:max-w-2xl mx-auto px-4 h-14 flex items-center">
            <Link href="/events" className="flex items-center gap-2 text-muted-foreground">
              <ArrowLeft size={20} />
              <span className="text-sm">Back</span>
            </Link>
          </div>
        </header>

        <main className="max-w-lg md:max-w-2xl mx-auto px-4 py-6">
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.2 }}
          >
            <h1 className="text-2xl font-bold text-foreground mb-2">Create an event</h1>
            <p className="text-muted-foreground mb-8">Set up a gift occasion for {profileName}</p>

            <div className="space-y-6">
              <div className="space-y-3">
                <Label className="text-sm font-medium">What's the occasion?</Label>
                <div className="grid grid-cols-3 gap-2">
                  {EVENT_TYPES.map((type) => (
                    <motion.button
                      key={type.id}
                      whileTap={{ scale: 0.95 }}
                      onClick={() => {
                        setEventType(type.id);
                        if (!title) setTitle(`${profileName}'s ${type.label}`);
                      }}
                      className={`p-3 rounded-xl border-2 text-center transition-all ${
                        eventType === type.id 
                          ? "border-[hsl(var(--kora-evergreen))] bg-[hsl(var(--kora-evergreen)/0.05)]" 
                          : "border-border hover:border-muted-foreground"
                      }`}
                      data-testid={`event-type-${type.id}`}
                    >
                      <span className="text-2xl mb-1 block">{type.emoji}</span>
                      <span className="text-xs font-medium text-foreground">{type.label}</span>
                    </motion.button>
                  ))}
                </div>
              </div>

              <div className="space-y-2">
                <Label className="text-sm font-medium">Event title</Label>
                <Input 
                  value={title} 
                  onChange={(e) => setTitle(e.target.value)} 
                  className="h-12 text-base rounded-xl" 
                  placeholder={`${profileName}'s ${selectedType?.label || "Event"}`}
                  data-testid="input-event-title"
                />
              </div>

              <div className="space-y-3">
                <Label className="text-sm font-medium">Gift goal <span className="text-muted-foreground font-normal">(optional)</span></Label>
                <div className="grid grid-cols-4 gap-2">
                  {GOAL_OPTIONS.map((amt) => (
                    <motion.button
                      key={amt}
                      whileTap={{ scale: 0.95 }}
                      onClick={() => { setGoal(amt); setCustomGoal(""); }}
                      className={`py-3 rounded-xl border-2 text-sm font-medium transition-all ${
                        goal === amt && !customGoal 
                          ? "border-[hsl(var(--kora-evergreen))] bg-[hsl(var(--kora-evergreen)/0.05)] text-[hsl(var(--kora-evergreen))]" 
                          : "border-border text-foreground"
                      }`}
                    >
                      ${Number(amt).toLocaleString()}
                    </motion.button>
                  ))}
                </div>
                <div className="relative">
                  <span className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground">$</span>
                  <Input 
                    placeholder="Custom amount" 
                    value={customGoal} 
                    onChange={(e) => {
                      setCustomGoal(e.target.value.replace(/[^0-9]/g, ""));
                      if (e.target.value) setGoal("custom");
                    }}
                    className="h-12 pl-8 text-base rounded-xl"
                    data-testid="input-custom-goal"
                  />
                </div>
              </div>

              <div className="space-y-3">
                <Label className="text-sm font-medium">Event pricing</Label>
                <div className="p-4 rounded-2xl border-2 border-[hsl(var(--kora-gold))] bg-[hsl(var(--kora-gold)/0.05)]">
                  <div className="flex items-start gap-3">
                    <div className="w-10 h-10 rounded-xl bg-[hsl(var(--kora-gold))] flex items-center justify-center flex-shrink-0">
                      <Zap size={20} className="text-background" />
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-semibold text-foreground">Event Boost</span>
                        {hasFamilyPlan ? (
                          <span className="text-xs font-medium text-primary bg-primary/10 px-2 py-0.5 rounded-full">Covered by Family Plan</span>
                        ) : (
                          <span className="text-sm font-bold text-[hsl(var(--kora-gold))]">$29</span>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground">
                        {hasFamilyPlan 
                          ? "No $2 platform fee on gifts for this event."
                          : "Waives the $2 platform fee on all gifts for this event."}
                      </p>
                    </div>
                  </div>
                </div>
                {!hasFamilyPlan && (
                  <p className="text-xs text-muted-foreground flex items-start gap-1.5">
                    <Info size={12} className="flex-shrink-0 mt-0.5" />
                    Upgrade to Family Plan ($12/mo or $119/yr) to create unlimited events with no per-event fee.
                  </p>
                )}
              </div>
            </div>

            <div className="mt-10">
              <motion.button
                whileTap={{ scale: 0.98 }}
                onClick={handleCreate}
                disabled={isCreating || !title.trim()}
                className="w-full py-4 bg-primary text-primary-foreground font-semibold rounded-2xl flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-primary/20"
                data-testid="button-create-event"
              >
                {isCreating ? (
                  <>
                    <Loader2 className="h-5 w-5 animate-spin" />
                    Creating...
                  </>
                ) : hasFamilyPlan ? (
                  <>
                    <Sparkles size={18} />
                    Create event
                  </>
                ) : (
                  <>
                    <Sparkles size={18} />
                    Create event ($29)
                  </>
                )}
              </motion.button>
              <p className="text-xs text-muted-foreground text-center mt-4">
                {hasFamilyPlan 
                  ? "Covered by your Family Plan"
                  : "Includes Event Boost for fee-free gifting"}
              </p>
            </div>
          </motion.div>
        </main>
      </div>
    </PageTransition>
  );
}
