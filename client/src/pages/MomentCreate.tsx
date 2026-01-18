import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Link, useLocation } from "wouter";
import { ArrowLeft, Check, Loader2, Share2, Copy, Sparkles, CalendarHeart } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { PageTransition } from "@/components/layout/PageTransition";
import { useKora } from "@/lib/KoraContext";
import { toast } from "@/hooks/use-toast";
import { haptic } from "@/lib/haptics";

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
  
  const [eventType, setEventType] = useState("birthday");
  const [title, setTitle] = useState("");
  const [goal, setGoal] = useState("1000");
  const [customGoal, setCustomGoal] = useState("");
  const [isCreating, setIsCreating] = useState(false);
  const [created, setCreated] = useState(false);
  const [eventSlug, setEventSlug] = useState("");

  const selectedType = EVENT_TYPES.find(t => t.id === eventType);
  const finalGoal = customGoal || goal;

  const handleCreate = () => {
    if (!title.trim()) {
      toast({ title: "Please enter a title", variant: "destructive" });
      return;
    }

    haptic('medium');
    setIsCreating(true);
    const slug = title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
    setEventSlug(slug);
    
    setTimeout(() => {
      haptic('success');
      setIsCreating(false);
      setCreated(true);
    }, 1200);
  };

  const handleCopyLink = () => {
    haptic('selection');
    const url = `${window.location.origin}/checkout/${profileName.toLowerCase().replace(/\s/g, "-")}/${eventSlug}`;
    navigator.clipboard.writeText(url);
    toast({ title: "Link copied!" });
  };

  if (created) {
    return (
      <PageTransition>
        <div className="min-h-screen bg-background">
          <main className="max-w-lg mx-auto px-4 py-12">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }} 
              animate={{ opacity: 1, scale: 1 }}
              className="text-center"
            >
              <motion.div 
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ type: "spring", stiffness: 200, damping: 15, delay: 0.1 }}
                className="w-20 h-20 rounded-full bg-[hsl(var(--kora-evergreen))] flex items-center justify-center mx-auto mb-6"
              >
                <Check className="w-10 h-10 text-white" />
              </motion.div>
              
              <h1 className="text-2xl font-bold text-foreground mb-2">Event created!</h1>
              <p className="text-muted-foreground mb-8">{title} is ready to share</p>

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
        <header className="sticky top-0 z-50 bg-background/95 backdrop-blur-xl border-b border-border/50">
          <div className="max-w-lg mx-auto px-4 h-14 flex items-center">
            <Link href="/events" className="flex items-center gap-2 text-muted-foreground">
              <ArrowLeft size={20} />
              <span className="text-sm">Back</span>
            </Link>
          </div>
        </header>

        <main className="max-w-lg mx-auto px-4 py-6">
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
                ) : (
                  <>
                    <Sparkles size={18} />
                    Create event
                  </>
                )}
              </motion.button>
              <p className="text-xs text-muted-foreground text-center mt-4">
                You can customize the page design later
              </p>
            </div>
          </motion.div>
        </main>
      </div>
    </PageTransition>
  );
}
