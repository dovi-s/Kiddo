import { useState, useMemo } from "react";
import { useLocation, useSearch } from "wouter";
import { motion, AnimatePresence } from "framer-motion";
import { Calendar, Gift, PartyPopper, Baby, TreeDeciduous, GraduationCap, Heart, ArrowRight, ArrowLeft, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Logo } from "@/components/ui/logo";
import { haptic } from "@/lib/haptics";
import { GradientText, EnlighteningReveal, ThinkingOrb } from "@/components/ui/gemini";
import { useAuth } from "@/hooks/use-auth";
import { useSubscription } from "@/hooks/use-subscription";
import { useCreateEvent } from "@/hooks/use-events";
import { useFunds } from "@/hooks/use-funds";
import { toast } from "@/hooks/use-toast";
import { EventGateModal } from "@/components/EventGateModal";

const EVENT_TYPES = [
  { value: "birthday", label: "Birthday", icon: PartyPopper, color: "text-pink-500 bg-pink-50 dark:bg-pink-950/30" },
  { value: "baby_shower", label: "Baby Shower", icon: Baby, color: "text-sky-500 bg-sky-50 dark:bg-sky-950/30" },
  { value: "holiday", label: "Holiday", icon: TreeDeciduous, color: "text-green-500 bg-green-50 dark:bg-green-950/30" },
  { value: "christmas", label: "Christmas", icon: TreeDeciduous, color: "text-red-500 bg-red-50 dark:bg-red-950/30" },
  { value: "graduation", label: "Graduation", icon: GraduationCap, color: "text-violet-500 bg-violet-50 dark:bg-violet-950/30" },
  { value: "just_because", label: "Just Because", icon: Heart, color: "text-rose-500 bg-rose-50 dark:bg-rose-950/30" },
] as const;

function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
}

export default function EventCreate() {
  const { isAuthenticated, isLoading: authLoading } = useAuth();
  const { data: subscription, isLoading: subLoading } = useSubscription();
  const { data: funds = [], isLoading: fundsLoading } = useFunds();
  const createEvent = useCreateEvent();
  const [, setLocation] = useLocation();
  const searchString = useSearch();
  const searchParams = useMemo(() => new URLSearchParams(searchString), [searchString]);
  const hasEventPass = searchParams.get("eventPass") === "purchased";
  const stripeSessionId = searchParams.get("session_id");

  const [step, setStep] = useState(1);
  const [eventType, setEventType] = useState("");
  const [eventName, setEventName] = useState("");
  const [description, setDescription] = useState("");
  const [eventDate, setEventDate] = useState("");
  const [fundId, setFundId] = useState("");
  const [goalAmount, setGoalAmount] = useState("");

  const isFamily = subscription?.plan === "family" && subscription?.status === "active";

  if (authLoading || fundsLoading || subLoading) {
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

  if (!isFamily && !hasEventPass) {
    return (
      <div className="min-h-screen bg-background md:ml-[220px] lg:ml-[260px]">
        <EventGateModal
          open={true}
          onClose={() => setLocation("/events")}
        />
      </div>
    );
  }

  const canProceedStep1 = eventType !== "";
  const canProceedStep2 = eventName.trim() !== "";
  const canProceedStep3 = fundId !== "";

  const handleSubmit = async () => {
    haptic("medium");
    const slug = slugify(eventName) || "event";
    try {
      await createEvent.mutateAsync({
        name: eventName.trim(),
        description: description.trim() || undefined,
        eventDate: eventDate ? new Date(eventDate) : undefined,
        fundId,
        eventType,
        goalAmount: goalAmount ? goalAmount : undefined,
        slug,
        userId: "",
        status: "active",
        ...(stripeSessionId ? { stripeSessionId } : {}),
      } as any);
      haptic("success");
      toast({ title: "Event created!", description: "Your new event is ready to share." });
      setLocation("/events");
    } catch (err: any) {
      toast({ title: "Something went wrong", description: err.message || "Could not create event", variant: "destructive" });
    }
  };

  const goNext = () => {
    haptic("selection");
    setStep(prev => Math.min(prev + 1, 4));
  };

  const goBack = () => {
    haptic("selection");
    setStep(prev => Math.max(prev - 1, 1));
  };

  return (
    <div className="min-h-screen bg-background pb-28 md:ml-[220px] lg:ml-[260px]">
      <main className="max-w-lg md:max-w-3xl mx-auto px-4 py-8">
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
          className="mb-8"
        >
          <button
            onClick={() => setLocation("/events")}
            className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors mb-4"
            data-testid="button-back-to-events"
          >
            <ArrowLeft size={16} />
            Back to Events
          </button>
          <h1 className="font-heading text-2xl font-bold text-foreground" data-testid="heading-create-event">
            Create Event
          </h1>
          <p className="text-muted-foreground mt-1">Set up a new gift occasion in a few steps</p>
        </motion.div>

        <div className="flex items-center gap-2 mb-8" data-testid="step-indicator">
          {[1, 2, 3, 4].map(s => (
            <div key={s} className="flex items-center gap-2">
              <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium transition-colors ${
                s === step ? "bg-primary text-primary-foreground" :
                s < step ? "bg-primary/20 text-primary" :
                "bg-muted text-muted-foreground"
              }`}>
                {s}
              </div>
              {s < 4 && <div className={`w-8 h-0.5 rounded ${s < step ? "bg-primary/40" : "bg-muted"}`} />}
            </div>
          ))}
        </div>

        <AnimatePresence mode="wait">
          {step === 1 && (
            <motion.div
              key="step1"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ duration: 0.25 }}
            >
              <h2 className="font-heading text-lg font-semibold text-foreground mb-4" data-testid="heading-step-1">
                What type of event?
              </h2>
              <div className="grid grid-cols-2 gap-3">
                {EVENT_TYPES.map(type => {
                  const Icon = type.icon;
                  const isSelected = eventType === type.value;
                  return (
                    <motion.button
                      key={type.value}
                      whileTap={{ scale: 0.97 }}
                      onClick={() => { haptic("selection"); setEventType(type.value); }}
                      className={`p-4 rounded-2xl border-2 transition-all text-left ${
                        isSelected
                          ? "border-primary bg-primary/5 shadow-premium-sm"
                          : "border-border bg-card hover:border-primary/30"
                      }`}
                      data-testid={`button-type-${type.value}`}
                    >
                      <div className={`w-10 h-10 rounded-xl flex items-center justify-center mb-2 ${type.color}`}>
                        <Icon size={20} />
                      </div>
                      <span className="font-medium text-foreground text-sm">{type.label}</span>
                    </motion.button>
                  );
                })}
              </div>
              <div className="mt-6 flex justify-end">
                <Button
                  disabled={!canProceedStep1}
                  onClick={goNext}
                  className="gap-2"
                  data-testid="button-next-step-1"
                >
                  Next
                  <ArrowRight size={16} />
                </Button>
              </div>
            </motion.div>
          )}

          {step === 2 && (
            <motion.div
              key="step2"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ duration: 0.25 }}
            >
              <h2 className="font-heading text-lg font-semibold text-foreground mb-4" data-testid="heading-step-2">
                Event details
              </h2>
              <div className="space-y-4">
                <div>
                  <label className="text-sm font-medium text-foreground block mb-1.5">Event Name</label>
                  <input
                    type="text"
                    value={eventName}
                    onChange={e => setEventName(e.target.value)}
                    placeholder="e.g. Emma's 5th Birthday"
                    className="w-full px-4 py-3 rounded-xl border border-border bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-all"
                    data-testid="input-event-name"
                  />
                </div>
                <div>
                  <label className="text-sm font-medium text-foreground block mb-1.5">Description (optional)</label>
                  <textarea
                    value={description}
                    onChange={e => setDescription(e.target.value)}
                    placeholder="Tell guests about the event..."
                    rows={3}
                    className="w-full px-4 py-3 rounded-xl border border-border bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-all resize-none"
                    data-testid="input-event-description"
                  />
                </div>
                <div>
                  <label className="text-sm font-medium text-foreground block mb-1.5">Event Date (optional)</label>
                  <input
                    type="date"
                    value={eventDate}
                    onChange={e => setEventDate(e.target.value)}
                    className="w-full px-4 py-3 rounded-xl border border-border bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-all"
                    data-testid="input-event-date"
                  />
                </div>
              </div>
              <div className="mt-6 flex justify-between">
                <Button variant="outline" onClick={goBack} className="gap-2" data-testid="button-back-step-2">
                  <ArrowLeft size={16} />
                  Back
                </Button>
                <Button disabled={!canProceedStep2} onClick={goNext} className="gap-2" data-testid="button-next-step-2">
                  Next
                  <ArrowRight size={16} />
                </Button>
              </div>
            </motion.div>
          )}

          {step === 3 && (
            <motion.div
              key="step3"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ duration: 0.25 }}
            >
              <h2 className="font-heading text-lg font-semibold text-foreground mb-4" data-testid="heading-step-3">
                Link to a fund
              </h2>
              <p className="text-sm text-muted-foreground mb-4">Choose which fund gifts from this event will go to</p>
              {funds.length === 0 ? (
                <div className="bg-card rounded-2xl border border-border p-6 text-center" data-testid="empty-state-no-funds">
                  <p className="text-muted-foreground">No funds found. Please create a fund first.</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {funds.map(fund => {
                    const isSelected = fundId === fund.id;
                    return (
                      <motion.button
                        key={fund.id}
                        whileTap={{ scale: 0.98 }}
                        onClick={() => { haptic("selection"); setFundId(fund.id); }}
                        className={`w-full p-4 rounded-2xl border-2 text-left transition-all flex items-center gap-4 ${
                          isSelected
                            ? "border-primary bg-primary/5 shadow-premium-sm"
                            : "border-border bg-card hover:border-primary/30"
                        }`}
                        data-testid={`button-fund-${fund.id}`}
                      >
                        <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center text-primary font-semibold">
                          {fund.name.charAt(0)}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-foreground truncate">{fund.name}</p>
                          <p className="text-xs text-muted-foreground">
                            {fund.accountType === "UTMA" ? "Custodial" : fund.accountType === "Personal" ? "Personal" : fund.accountType}
                          </p>
                        </div>
                      </motion.button>
                    );
                  })}
                </div>
              )}
              <div className="mt-6 flex justify-between">
                <Button variant="outline" onClick={goBack} className="gap-2" data-testid="button-back-step-3">
                  <ArrowLeft size={16} />
                  Back
                </Button>
                <Button disabled={!canProceedStep3} onClick={goNext} className="gap-2" data-testid="button-next-step-3">
                  Next
                  <ArrowRight size={16} />
                </Button>
              </div>
            </motion.div>
          )}

          {step === 4 && (
            <motion.div
              key="step4"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ duration: 0.25 }}
            >
              <h2 className="font-heading text-lg font-semibold text-foreground mb-4" data-testid="heading-step-4">
                Set a goal (optional)
              </h2>
              <p className="text-sm text-muted-foreground mb-4">
                Add a gift goal to track progress. You can skip this if you prefer.
              </p>
              <div>
                <label className="text-sm font-medium text-foreground block mb-1.5">Goal Amount ($)</label>
                <input
                  type="number"
                  min="0"
                  step="1"
                  value={goalAmount}
                  onChange={e => setGoalAmount(e.target.value)}
                  placeholder="e.g. 500"
                  className="w-full px-4 py-3 rounded-xl border border-border bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-all"
                  data-testid="input-goal-amount"
                />
              </div>
              <div className="mt-6 flex justify-between">
                <Button variant="outline" onClick={goBack} className="gap-2" data-testid="button-back-step-4">
                  <ArrowLeft size={16} />
                  Back
                </Button>
                <Button
                  onClick={handleSubmit}
                  disabled={createEvent.isPending}
                  className="gap-2"
                  data-testid="button-create-event-submit"
                >
                  {createEvent.isPending ? (
                    <ThinkingOrb size={16} variant="default" />
                  ) : (
                    <Plus size={16} />
                  )}
                  {createEvent.isPending ? "Creating..." : "Create Event"}
                </Button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </main>
    </div>
  );
}
